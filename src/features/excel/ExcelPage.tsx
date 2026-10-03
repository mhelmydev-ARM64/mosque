import { useCallback, useEffect, useMemo, useState } from "react";
import { Workbook, type Worksheet } from "exceljs";
import {
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type CollectionReference,
  type Timestamp,
} from "firebase/firestore";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { db, firebaseReady, requireDb } from "../../lib/firebase";
import { useCommittees, useTemplate, fetchOnce, errText } from "../../services/hooks";
import { normalizeArabic, buildSearchTokens } from "../../domain/arabic";
import { cleanValues, fieldValueOrDefault, validateStudentValues } from "../../domain/template";
import { MEMO_LEVELS, memoLabel, requestTypeInfo, STATUS_LABELS } from "../../domain/requests";
import type {
  AppUser,
  Committee,
  CommitteeMembership,
  LedgerEntry,
  MemorizationLevel,
  RequestDoc,
  RoutingRule,
  Student,
  StudentTemplate,
  TemplateField,
} from "../../domain/models";
import { EmptyState, Loading, useToast } from "../../components/ui";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;
const CHUNK = 180;

type CellVal = string | number | boolean | null;

function typed<T>(path: string): CollectionReference<T> {
  return collection(requireDb(), path) as CollectionReference<T>;
}

function cellText(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: Array<{ text?: unknown }> };
    if (Array.isArray(o.richText)) return o.richText.map((t) => String(t?.text ?? "")).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    return "";
  }
  return String(v);
}

function cellNumber(v: unknown): number | null {
  const raw = cellText(v).trim();
  if (raw === "") return null;
  const s = raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/٫/g, ".")
    .replace(/[,\s]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmtTs(t?: Timestamp | null): string {
  try {
    return t?.toDate?.()?.toLocaleString("ar-SY") ?? "";
  } catch {
    return "";
  }
}

function stamp(): string {
  return new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
}

function displayValue(field: TemplateField, v: unknown): string {
  const val = fieldValueOrDefault(field, v);
  if (Array.isArray(val)) return val.map(String).join("، ");
  if (typeof val === "boolean") return val ? "نعم" : "لا";
  return String(val ?? "");
}

function addSheet(wb: Workbook, title: string, rows: CellVal[][]): void {
  const ws = wb.addWorksheet(title);
  const head = ws.addRow(rows[0] ?? []);
  head.font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (let i = 1; i < rows.length; i++) ws.addRow(rows[i]);
  for (const col of ws.columns) {
    if ((col.width ?? 0) < 14) col.width = 14;
  }
}

async function downloadWorkbook(wb: Workbook, filename: string): Promise<void> {
  const buf = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function studentRow(
  s: Student,
  committeeName: string,
  template: StudentTemplate
): CellVal[] {
  const row: CellVal[] = [
    s.name,
    committeeName,
    s.points,
    memoLabel(s.memorizationLevel),
    s.archived ? "نعم" : "لا",
  ];
  for (const f of template.fields) row.push(displayValue(f, s.values?.[f.key]));
  return row;
}

function studentHeader(committeeHeader: string, template: StudentTemplate): CellVal[] {
  return ["الاسم", committeeHeader, "النقاط", "مستوى الحفظ", "مؤرشف", ...template.fields.map((f) => f.label)];
}

const ARROW_TRUE = /^(نعم|true|1|✓|صح|yes)$/i;
const ARROW_FALSE = /^(لا|لا يوجد|false|0|✗|خطأ|no)$/i;

interface ParsedRow {
  excelRow: number;
  name: string;
  values: Record<string, unknown>;
  points: number;
  memo: MemorizationLevel;
  errors: string[];
  duplicateInFile: boolean;
}

type ImportResult = { created: number; updated: number; skipped: number; failed: string[] };

export default function ExcelPage() {
  const { user, hasGlobal, committeePerm } = useAuth();
  const toast = useToast();
  const { committees, byId: committeesById } = useCommittees();
  const { data: template, loading: tplLoading } = useTemplate();

  const [tab, setTab] = useState<"import" | "export" | "backup">("export");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  const tpl: StudentTemplate | null = template ?? null;

  const canStudents = useCallback(
    (cid: string, perm: string) => !!user && committeePerm(cid, perm),
    [user, committeePerm]
  );

  const exportable = useMemo(() => committees.filter((c) => canStudents(c.id, "students.export")), [committees, canStudents]);
  const importable = useMemo(
    () => committees.filter((c) => canStudents(c.id, "students.create") || canStudents(c.id, "students.update")),
    [committees, canStudents]
  );

  /* ---------------- التصدير ---------------- */
  const [exportCid, setExportCid] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    if (!exportCid && exportable.length > 0) setExportCid(exportable[0].id);
  }, [exportable, exportCid]);

  const doExport = async () => {
    if (!exportCid || !tpl) return;
    setBusy(true);
    setStage("قراءة الطلاب...");
    try {
      const archiveStates = includeArchived ? [false, true] : [false];
      const all: Student[] = [];
      for (const st of archiveStates) {
        all.push(
          ...(await fetchOnce<Student>(
            query(
              typed<Student>("students"),
              where("committeeId", "==", exportCid),
              where("archived", "==", st),
              orderBy("normalizedName", "asc")
            )
          ))
        );
      }
      setStage("إنشاء الملف...");
      const wb = new Workbook();
      const cname = committeesById.get(exportCid)?.name ?? exportCid;
      addSheet(wb, "الطلاب", [studentHeader("اللجنة", tpl), ...all.map((s) => studentRow(s, cname, tpl))]);
      await downloadWorkbook(wb, `students-${cname}-${stamp()}.xlsx`.replace(/\s+/g, "_"));
      toast.showSuccess(`تم تصدير ${all.length} طالب`);
    } catch (e) {
      toast.showError(errText(e));
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  /* ---------------- الاستيراد ---------------- */
  const [fileName, setFileName] = useState("");
  const [wb, setWb] = useState<Workbook | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [importCid, setImportCid] = useState("");
  const [mode, setMode] = useState<"create" | "merge">("create");
  const [colMap, setColMap] = useState<Record<number, string>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [existing, setExisting] = useState<Map<string, string> | null>(null);
  const [dupCheck, setDupCheck] = useState<"loading" | "ok" | "denied">("ok");
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (!importCid && importable.length > 0) setImportCid(importable[0].id);
  }, [importable, importCid]);

  const resetParsed = () => {
    setParsed(null);
    setExisting(null);
    setResult(null);
    setColMap({});
  };

  const onFile = async (file: File | null) => {
    setFileName("");
    setWb(null);
    resetParsed();
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      toast.showError("الملف يجب أن يكون بصيغة .xlsx");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.showError("حجم الملف يتجاوز 5MB");
      return;
    }
    try {
      const reader = new Workbook();
      await reader.xlsx.load(await file.arrayBuffer());
      if (reader.worksheets.length === 0) {
        toast.showError("الملف لا يحتوي أوراق عمل");
        return;
      }
      setWb(reader);
      setSheetIdx(0);
      setFileName(file.name);
    } catch (e) {
      toast.showError(`تعذر قراءة الملف: ${errText(e)}`);
    }
  };

  const computeAutoMap = (ws: Worksheet, t: StudentTemplate): Record<number, string> => {
    const headerVals = (ws.getRow(1).values ?? []) as unknown[];
    const heads: string[] = [];
    for (let c = 1; c < headerVals.length; c++) heads[c] = cellText(headerVals[c]).trim();
    const auto: Record<number, string> = {};
    for (let c = 1; c < heads.length; c++) {
      const h = normalizeArabic(heads[c]);
      if (!h) continue;
      if (h === normalizeArabic("الاسم")) auto[c] = "name";
      else if (h === normalizeArabic("النقاط")) auto[c] = "points";
      else if (h === normalizeArabic("مستوى الحفظ")) auto[c] = "memo";
      else {
        const f = t.fields.find((x) => normalizeArabic(x.label) === h);
        if (f) auto[c] = `v:${f.key}`;
      }
    }
    setHeaders(heads);
    return auto;
  };

  const parseSheet = (map: Record<number, string>) => {
    if (!wb || !tpl) return;
    const ws = wb.worksheets[sheetIdx];
    if (!ws) return;
    let currentRow = 2;
    const colOf = (target: string): number | null => {
      const key = Object.keys(map).find((k) => map[Number(k)] === target);
      return key === undefined ? null : Number(key);
    };
    const raw = (target: string): unknown => {
      const c = colOf(target);
      return c ? (ws.getRow(currentRow).values as unknown[])[c] : undefined;
    };

    const rows: ParsedRow[] = [];
    const seen = new Map<string, number>();
    const last = Math.min(ws.rowCount, MAX_ROWS + 1);
    for (let r = 2; r <= last; r++) {
      currentRow = r;
      const vals = (ws.getRow(r).values ?? []) as unknown[];
      const rawField = (fieldKey: string): unknown => {
        const c = colOf(`v:${fieldKey}`);
        return c ? vals[c] : undefined;
      };

      const name = cellText(raw("name")).trim();
      const errors: string[] = [];
      if (name === "" && vals.some((v) => cellText(v).trim() !== "")) {
        errors.push("الاسم فارغ");
      }
      if (name !== "" && name.length < 2) errors.push("الاسم قصير جدًا");

      const values: Record<string, unknown> = {};
      for (const f of tpl.fields) {
        const cellV = rawField(f.key);
        if (cellV === undefined) continue;
        const text = cellText(cellV).trim();
        if (text === "") continue;
        switch (f.type) {
          case "number": {
            const n = cellNumber(cellV);
            if (n === null) errors.push(`«${f.label}» ليس رقمًا`);
            else values[f.key] = n;
            break;
          }
          case "boolean": {
            if (ARROW_TRUE.test(text)) values[f.key] = true;
            else if (ARROW_FALSE.test(text)) values[f.key] = false;
            else errors.push(`«${f.label}»: استخدم نعم/لا`);
            break;
          }
          case "multiselect": {
            const parts = text.split(/[،,;؛]/).map((x) => x.trim()).filter(Boolean);
            values[f.key] = parts;
            break;
          }
          default:
            values[f.key] = text;
        }
      }

      let points = 0;
      const rawPoints = raw("points");
      if (rawPoints !== undefined && cellText(rawPoints).trim() !== "") {
        const n = cellNumber(rawPoints);
        if (n === null) errors.push("النقاط ليست رقمًا");
        else points = Math.max(0, Math.min(1000000, Math.round(n)));
      }

      let memo: MemorizationLevel = "none";
      const rawMemo = raw("memo");
      if (rawMemo !== undefined && cellText(rawMemo).trim() !== "") {
        const hit = MEMO_LEVELS.find((m) => normalizeArabic(m.label) === normalizeArabic(cellText(rawMemo)));
        if (!hit) errors.push("مستوى الحفظ غير معروف");
        else memo = hit.key;
      }

      if (name) {
        const norm = normalizeArabic(name);
        if (seen.has(norm)) errors.push(`مكرر داخل الملف (سطر ${seen.get(norm)})`);
        else seen.set(norm, r);
      }

      Object.assign(errors, Object.entries(validateStudentValues(tpl, name, values)).map(([k, msg]) => {
        const f = tpl.fields.find((x) => x.key === k);
        return f ? `${f.label}: ${msg}` : msg;
      }));

      rows.push({ excelRow: r, name, values, points, memo, errors, duplicateInFile: false });
    }
    const usable = rows.filter((x) => x.name !== "" || x.errors.length > 0);
    setParsed(usable);
    setResult(null);
  };

  useEffect(() => {
    if (!parsed || !importCid || !firebaseReady || !db) return;
    let alive = true;
    if (!canStudents(importCid, "students.read")) {
      setDupCheck("denied");
      setExisting(null);
      return;
    }
    setDupCheck("loading");
    fetchOnce<Student>(query(typed<Student>("students"), where("committeeId", "==", importCid)))
      .then((list) => {
        if (!alive) return;
        const m = new Map<string, string>();
        for (const s of list) m.set(s.normalizedName || normalizeArabic(s.name), s.id);
        setExisting(m);
        setDupCheck("ok");
      })
      .catch(() => {
        if (!alive) return;
        setExisting(null);
        setDupCheck("denied");
      });
    return () => {
      alive = false;
    };
  }, [parsed, importCid, canStudents]);

  const validRows = useMemo(() => (parsed ?? []).filter((r) => r.errors.length === 0), [parsed]);
  const withExisting = useMemo(
    () => (existing ? validRows.filter((r) => existing.has(normalizeArabic(r.name))) : []),
    [validRows, existing]
  );
  const freshRows = useMemo(
    () => (existing ? validRows.filter((r) => !existing.has(normalizeArabic(r.name))) : validRows),
    [validRows, existing]
  );

  const canCreateRows = !importCid || canStudents(importCid, "students.create");
  const canUpdateRows = !importCid || canStudents(importCid, "students.update");
  const importBlocked =
    !canCreateRows ||
    (mode === "merge" && !canUpdateRows) ||
    (mode === "merge" && dupCheck === "denied");

  const applyImport = async () => {
    if (!tpl || !importCid || validRows.length === 0 || importBlocked) return;
    setBusy(true);
    setResult(null);
    try {
      const targets = validRows
        .map((r) => ({ row: r, existingId: dupCheck === "ok" ? existing?.get(normalizeArabic(r.name)) : undefined }))
        .filter(({ existingId }) => !(mode === "create" && existingId));
      let skipped = validRows.length - targets.length;

      const commits = targets.map(({ row, existingId }) => ({
        excelRow: row.excelRow,
        run: async (): Promise<"created" | "updated"> => {
          const values = cleanValues(tpl, row.values);
          const phone = typeof values["phone"] === "string" ? (values["phone"] as string) : undefined;
          const payload = {
            name: row.name,
            values,
            searchTokens: buildSearchTokens(row.name, phone),
            normalizedName: normalizeArabic(row.name),
            points: row.points,
            memorizationLevel: row.memo,
            archived: false,
            templateVersion: tpl.version,
          };
          const adb = requireDb();
          const batch = writeBatch(adb);
          if (existingId) {
            batch.update(doc(adb, "students", existingId), { ...payload, updatedAt: serverTimestamp() });
          } else {
            batch.set(doc(collection(adb, "students")), {
              committeeId: importCid,
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
          return existingId ? "updated" : "created";
        },
      }));

      const chunks: Array<Array<{ excelRow: number; run: () => Promise<"created" | "updated"> }>> = [];
      for (let i = 0; i < commits.length; i += CHUNK) chunks.push(commits.slice(i, i + CHUNK));

      let created = 0;
      let updated = 0;
      const failed: string[] = [];
      const applyChunk = async (
        chunk: Array<{ excelRow: number; run: () => Promise<"created" | "updated"> }>
      ): Promise<void> => {
        const res = await Promise.all(chunk.map((c) => c.run()));
        created += res.filter((x) => x === "created").length;
        updated += res.filter((x) => x === "updated").length;
      };
      for (let ci = 0; ci < chunks.length; ci++) {
        setStage(`كتابة الدفعة ${ci + 1} من ${chunks.length}...`);
        const chunk = chunks[ci];
        try {
          await applyChunk(chunk);
        } catch {
          try {
            await applyChunk(chunk);
          } catch (e2) {
            failed.push(...chunk.map((c) => `سطر ${c.excelRow}: ${errText(e2)}`));
            skipped += chunk.length;
          }
        }
      }
      setResult({ created, updated, skipped, failed });
      toast.showSuccess(`تم: ${created} جديد، ${updated} تحديث${failed.length ? `، ${failed.length} فشلت` : ""}`);
    } catch (e) {
      toast.showError(errText(e));
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  /* ---------------- النسخة الاحتياطية ---------------- */
  const doBackup = async () => {
    if (!user || !tpl) return;
    setBusy(true);
    try {
      const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? "";
      const info: CellVal[][] = [
        ["البند", "القيمة"],
        ["التاريخ", new Date().toLocaleString("ar-SY")],
        ["المنفّذ", `${user.name} (${user.phone})`],
        ["المشروع", projectId],
        ["إصدار القالب", tpl.version],
      ];

      setStage("قراءة اللجان...");
      const allCommittees = await fetchOnce<Committee>(typed<Committee>("committees"));

      setStage("قراءة العضويات...");
      const memberRows: CellVal[][] = [["اللجنة", "معرّف العضو", "الدور", "منح", "منع", "الحالة"]];
      for (const c of allCommittees) {
        try {
          const ms = await fetchOnce<CommitteeMembership>(typed<CommitteeMembership>(`committees/${c.id}/members`));
          for (const m of ms) {
            memberRows.push([
              c.name,
              m.uid,
              m.role === "manager" ? "مدير" : "عضو",
              (m.grants ?? []).join("، "),
              (m.denies ?? []).join("، "),
              m.status,
            ]);
          }
        } catch (e) {
          info.push([`تعذر قراءة أعضاء «${c.name}»`, errText(e)]);
        }
      }

      setStage("قراءة الطلاب...");
      const studentRows: CellVal[][] = [studentHeader("اللجنة", tpl)];
      const readCids = allCommittees.filter((c) => canStudents(c.id, "students.read"));
      for (const c of readCids) {
        for (const st of [false, true]) {
          try {
            const list = await fetchOnce<Student>(
              query(
                typed<Student>("students"),
                where("committeeId", "==", c.id),
                where("archived", "==", st),
                orderBy("normalizedName", "asc")
              )
            );
            for (const s of list) studentRows.push(studentRow(s, c.name, tpl));
          } catch (e) {
            info.push([`تعذر قراءة طلاب «${c.name}»`, errText(e)]);
          }
        }
      }

      setStage("قراءة الطلبات...");
      const requestRows: CellVal[][] = [
        ["المعرّف", "النوع", "العنوان", "النص", "المُرسل", "لجنة المرسل", "الوجهة", "الحالة", "المبلغ", "العملة", "الاتجاه", "سبب القرار", "أنشئ", "حُسم/نُفّذ"],
      ];
      const seenReq = new Set<string>();
      const recvCids = allCommittees.filter((c) => canStudents(c.id, "requests.receive") || canStudents(c.id, "requests.decide"));
      const sendCids = allCommittees.filter((c) => canStudents(c.id, "requests.send"));
      const pullRequests = async (cid: string, field: "destinationCommitteeId" | "senderCommitteeId") => {
        try {
          const list = await fetchOnce<RequestDoc>(
            query(typed<RequestDoc>("requests"), where(field, "==", cid))
          );
          for (const r of list) {
            if (seenReq.has(r.id)) continue;
            seenReq.add(r.id);
            requestRows.push([
              r.id,
              requestTypeInfo(r.type).label,
              r.title,
              r.body,
              r.createdByName,
              committeesById.get(r.senderCommitteeId)?.name ?? r.senderCommitteeId,
              committeesById.get(r.destinationCommitteeId)?.name ?? r.destinationCommitteeId,
              STATUS_LABELS[r.status] ?? r.status,
              r.amount ?? "",
              r.currency ?? "",
              r.direction === "income" ? "دخل" : r.direction === "expense" ? "مصروف" : "",
              r.decisionReason ?? "",
              fmtTs(r.createdAt),
              fmtTs(r.executedAt ?? r.decidedAt),
            ]);
          }
        } catch (e) {
          info.push([`تعذر قراءة طلبات «${committeesById.get(cid)?.name ?? cid}»`, errText(e)]);
        }
      };
      for (const c of recvCids) await pullRequests(c.id, "destinationCommitteeId");
      for (const c of sendCids) await pullRequests(c.id, "senderCommitteeId");

      setStage("قراءة التوجيه والمالية...");
      const routingRows: CellVal[][] = [["النوع", "النمط", "لجنة الوجهة"]];
      let routing: RoutingRule[] = [];
      try {
        routing = await fetchOnce<RoutingRule>(typed<RoutingRule>("routingRules"));
        for (const r of routing) {
          routingRows.push([
            requestTypeInfo(r.type).label,
            r.mode === "fixed" ? "وجهة ثابتة" : "اختيار المرسل",
            r.committeeId ? (committeesById.get(r.committeeId)?.name ?? r.committeeId) : "",
          ]);
        }
      } catch (e) {
        info.push(["تعذر قراءة قواعد التوجيه", errText(e)]);
      }

      const ledgerRows: CellVal[][] = [["الطلب", "اللجنة", "النوع", "الاتجاه", "المبلغ", "العملة", "البيان", "نفّذها", "وقت التنفيذ"]];
      const finCids = allCommittees.filter((c) => canStudents(c.id, "finance.read"));
      for (const c of finCids) {
        try {
          const list = await fetchOnce<LedgerEntry>(
            query(typed<LedgerEntry>("ledgerEntries"), where("committeeId", "==", c.id))
          );
          for (const l of list) {
            ledgerRows.push([
              l.requestId,
              c.name,
              requestTypeInfo(l.type).label,
              l.direction === "income" ? "دخل" : "مصروف",
              l.amount,
              l.currency,
              l.note,
              l.executedByName,
              fmtTs(l.executedAt),
            ]);
          }
        } catch (e) {
          info.push([`تعذر قراءة مالية «${c.name}»`, errText(e)]);
        }
      }

      let userRows: CellVal[][] | null = null;
      if (hasGlobal("users.review")) {
        setStage("قراءة المستخدمين...");
        try {
          const users = await fetchOnce<AppUser>(typed<AppUser>("users"));
          userRows = [
            ["المعرّف", "الاسم", "الهاتف", "الحالة", "الدور", "اللجان", "صلاحيات عالمية", "سبب القرار", "أُنشئ"],
            ...users.map((u): CellVal[] => [
              u.uid,
              u.name,
              u.phone,
              u.status,
              u.role,
              (u.committeeIds ?? []).map((cid) => committeesById.get(cid)?.name ?? cid).join("، "),
              (u.globalPermissions ?? []).join("، "),
              u.decisionReason ?? "",
              fmtTs(u.createdAt),
            ]),
          ];
        } catch (e) {
          info.push(["تعذر قراءة المستخدمين", errText(e)]);
        }
      }

      setStage("إنشاء الملف...");
      const wbk = new Workbook();
      addSheet(wbk, "معلومات", info);
      addSheet(wbk, "اللجان", [
        ["المعرّف", "الاسم", "اللون", "الحالة", "صلاحيات الفريق", "أنشئت"],
        ...allCommittees.map((c): CellVal[] => [c.id, c.name, c.colorKey, c.status, (c.teamWidePermissions ?? []).join("، "), fmtTs(c.createdAt)]),
      ]);
      addSheet(wbk, "العضويات", memberRows);
      addSheet(wbk, "القالب", [
        ["الإصدار", tpl.version],
        [],
        ["المفتاح", "التسمية", "النوع", "إلزامي", "قابل للبحث", "الخيارات", "القيمة الافتراضية"],
        ...tpl.fields.map((f): CellVal[] => [
          f.key,
          f.label,
          f.type,
          f.required ? "نعم" : "لا",
          f.searchable ? "نعم" : "لا",
          (f.options ?? []).join("، "),
          Array.isArray(f.defaultValue) ? (f.defaultValue as string[]).join("، ") : (f.defaultValue ?? ""),
        ]),
      ]);
      addSheet(wbk, "الطلاب", studentRows);
      addSheet(wbk, "الطلبات", requestRows);
      addSheet(wbk, "التوجيه", routingRows);
      addSheet(wbk, "المالية", ledgerRows);
      if (userRows) addSheet(wbk, "المستخدمون", userRows);

      await downloadWorkbook(wbk, `backup-${projectId || "app"}-${stamp()}.xlsx`);
      toast.showSuccess(
        `النسخة جاهزة: ${allCommittees.length} لجنة، ${studentRows.length - 1} طالب، ${seenReq.size} طلب، ${ledgerRows.length - 1} حركة`
      );
    } catch (e) {
      toast.showError(errText(e));
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  /* ---------------- الواجهة ---------------- */
  if (!user) return <Loading />;
  if (tplLoading) return <Loading />;

  const targetOptions = (extra?: "name" | "points" | "memo"): Array<{ value: string; label: string }> => {
    const opts: Array<{ value: string; label: string }> = [{ value: "ignore", label: "— تجاهل —" }];
    if (extra === "name") opts.push({ value: "name", label: "الاسم (إلزامي)" });
    if (extra === "points") opts.push({ value: "points", label: "النقاط" });
    if (extra === "memo") opts.push({ value: "memo", label: "مستوى الحفظ" });
    for (const f of tpl?.fields ?? []) opts.push({ value: `v:${f.key}`, label: `${f.label} (${f.type})` });
    return opts;
  };

  return (
    <AppLayout title="إكسل والنسخ الاحتياطي">
      <div className="stack">
        <div className="tabs">
          <button type="button" className={`tab ${tab === "export" ? "tab--on" : ""}`} onClick={() => setTab("export")}>
            تصدير الطلاب
          </button>
          <button type="button" className={`tab ${tab === "import" ? "tab--on" : ""}`} onClick={() => setTab("import")}>
            استيراد الطلاب
          </button>
          {hasGlobal("backup.export") && (
            <button type="button" className={`tab ${tab === "backup" ? "tab--on" : ""}`} onClick={() => setTab("backup")}>
              نسخة احتياطية
            </button>
          )}
        </div>

        {busy && stage && <p className="muted small">{stage}</p>}

        {tab === "export" && (
          exportable.length === 0 ? (
            <EmptyState icon="📤" title="لا تملك صلاحية التصدير" sub="اطلب صلاحية «تصدير الطلاب» داخل لجانك من الإدارة." />
          ) : (
            <>
              <div className="field">
                <span className="label required">اللجنة</span>
                <select className="select" value={exportCid} onChange={(e) => setExportCid(e.target.value)}>
                  {exportable.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
                <span className="label">تضمين الطلاب المؤرشفين</span>
              </label>
              <div>
                <button type="button" className="btn btn--primary" disabled={busy || !exportCid || !tpl} onClick={() => void doExport()}>
                  {busy ? "جارٍ التصدير..." : "تصدير إلى Excel"}
                </button>
              </div>
              <p className="muted small">الملف يُنشأ داخل متصفحك ويُحفظ على جهازك مباشرة — لا يمر عبر أي خادم.</p>
            </>
          )
        )}

        {tab === "import" && (
          importable.length === 0 ? (
            <EmptyState icon="📥" title="لا تملك صلاحية الاستيراد" sub="اطلب صلاحية «إضافة طالب» أو «تعديل طالب» داخل لجانك من الإدارة." />
          ) : (
            <>
              <div className="field">
                <span className="label required">ملف Excel (.xlsx حتى 5MB و{MAX_ROWS.toLocaleString("ar")} صف)</span>
                <input
                  className="input"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                />
                {fileName && <span className="muted small">{fileName}</span>}
              </div>

              {wb && (
                <>
                  <div className="field">
                    <span className="label">ورقة العمل</span>
                    <select
                      className="select"
                      value={sheetIdx}
                      onChange={(e) => {
                        setSheetIdx(Number(e.target.value));
                        resetParsed();
                      }}
                    >
                      {wb.worksheets.map((ws, i) => (
                        <option key={i} value={i}>{ws.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <span className="label required">اللجنة الهدف</span>
                    <select className="select" value={importCid} onChange={(e) => { setImportCid(e.target.value); setResult(null); }}>
                      {importable.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <span className="label required">وضع الاستيراد</span>
                    <select className="select" value={mode} onChange={(e) => { setMode(e.target.value as "create" | "merge"); setResult(null); }}>
                      <option value="create">إنشاء فقط — تخطّي الأسماء الموجودة</option>
                      <option value="merge">دمج — تحديث الموجود وإنشاء الجديد</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !wb || !tpl}
                    onClick={() => {
                      const ws = wb?.worksheets[sheetIdx];
                      if (ws && tpl) {
                        const m = computeAutoMap(ws, tpl);
                        setColMap(m);
                        parseSheet(m);
                      }
                    }}
                  >
                    تحليل ومعاينة
                  </button>

                  {parsed && (
                    <>
                      <div className="field">
                        <span className="label required">مطابقة الأعمدة</span>
                        <div className="stack" style={{ gap: 6 }}>
                          {headers.map((h, ci) => (
                            <div key={ci} className="row" style={{ gap: 8 }}>
                              <span className="kv__k" style={{ minWidth: 120 }}>{h || `عمود ${ci}`}</span>
                              <select
                                className="select"
                                style={{ maxWidth: 240 }}
                                value={colMap[ci] ?? "ignore"}
                                onChange={(e) => {
                                  const next = { ...colMap, [ci]: e.target.value };
                                  setColMap(next);
                                  setResult(null);
                                  parseSheet(next);
                                }}
                              >
                                {targetOptions("name").map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        <span className="muted small">
                          الحقول غير المطابقة تُتجاهل. الاسم إلزامي لكل صف صالح.
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => parseSheet(colMap)}
                      >
                        إعادة التحليل بعد تعديل المطابقة
                      </button>

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <span className="badge badge--ok">صالح: {validRows.length}</span>
                        {dupCheck === "ok" && (
                          <>
                            <span className="badge badge--info">سيُحدَّث: {withExisting.length}</span>
                            <span className="badge">جديد: {freshRows.length}</span>
                          </>
                        )}
                        {dupCheck === "denied" && (
                          <span className="badge badge--warn">فحص التكرار غير متاح (لا تملك صلاحية عرض الطلاب)</span>
                        )}
                        <span className="badge badge--bad">أخطاء: {(parsed ?? []).length - validRows.length}</span>
                      </div>

                      {validRows.length > 0 && (
                        <div className="table-wrap">
                          <table className="data">
                            <thead>
                              <tr>
                                <th>السطر</th>
                                <th>الاسم</th>
                                <th>النقاط</th>
                                <th>الحفظ</th>
                                <th>الحالة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {validRows.slice(0, 8).map((r) => {
                                const eid = existing?.get(normalizeArabic(r.name));
                                return (
                                  <tr key={r.excelRow}>
                                    <td>{r.excelRow}</td>
                                    <td>{r.name}</td>
                                    <td>{r.points}</td>
                                    <td>{memoLabel(r.memo)}</td>
                                    <td>
                                      {dupCheck === "ok" ? (
                                        eid ? (mode === "merge" ? "تحديث" : "سيُتخطى (موجود)") : "جديد"
                                      ) : "جديد"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {(parsed ?? []).some((r) => r.errors.length > 0) && (
                        <div className="field">
                          <span className="label">أخطاء الصفوف ({(parsed ?? []).filter((r) => r.errors.length > 0).length})</span>
                          <div className="stack" style={{ gap: 4 }}>
                            {(parsed ?? []).filter((r) => r.errors.length > 0).slice(0, 10).map((r) => (
                              <span key={r.excelRow} className="small" style={{ color: "var(--danger, #c0392b)" }}>
                                سطر {r.excelRow}: {r.errors.join(" — ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {importBlocked && (
                        <p className="muted small">
                          الوضع المختار يتطلب صلاحيات لا تملكها داخل اللجنة الهدف
                          {mode === "merge" && dupCheck === "denied" ? " (الدمج يحتاج صلاحية عرض الطلاب لفحص التكرار)" : ""}.
                        </p>
                      )}

                      <div>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={busy || validRows.length === 0 || importBlocked}
                          onClick={() => void applyImport()}
                        >
                          {busy ? "جارٍ الاستيراد..." : `استيراد ${validRows.length} صف`}
                        </button>
                      </div>

                      {result && (
                        <div className="stack" style={{ gap: 6 }}>
                          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                            <span className="badge badge--ok">أُنشئ: {result.created}</span>
                            <span className="badge badge--info">حُدِّث: {result.updated}</span>
                            <span className="badge">تخطّي: {result.skipped}</span>
                            <span className="badge badge--bad">فشل: {result.failed.length}</span>
                          </div>
                          {result.failed.slice(0, 10).map((f, i) => (
                            <span key={i} className="small" style={{ color: "var(--danger, #c0392b)" }}>{f}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )
        )}

        {tab === "backup" && (
          hasGlobal("backup.export") ? (
            <>
              <p className="muted small">
                ملف واحد متعدد الأوراق: المعلومات، اللجان، العضويات، القالب، الطلاب، الطلبات، التوجيه، المالية
                {hasGlobal("users.review") ? "، والمستخدمون" : ""}. تُقرأ أوراق الطلاب/الطلبات/المالية فقط للجان
                التي تملك صلاحية قراءتها، ويُحفظ الملف على جهازك فقط.
              </p>
              <div>
                <button type="button" className="btn btn--primary" disabled={busy || !tpl} onClick={() => void doBackup()}>
                  {busy ? "جارٍ إنشاء النسخة..." : "إنشاء نسخة احتياطية الآن"}
                </button>
              </div>
              <p className="muted small">
                ملاحظة: النسخة تحتوي البيانات ولا تحتوي كلمات المرور أو حسابات Firebase Auth، ولا تُستخدم للاستعادة التلقائية.
              </p>
            </>
          ) : (
            <EmptyState icon="🗄️" title="صلاحية غير متوفرة" sub="النسخ الاحتياطي الشامل يتطلب صلاحية «النسخ الاحتياطي والتصدير الشامل»." />
          )
        )}
      </div>
    </AppLayout>
  );
}
