import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees, useDocument, useTemplate } from "../../services/hooks";
import { saveStudent, setStudentArchived, hardDeleteStudent, AppError } from "../../services/atomicWrites";
import { doc } from "firebase/firestore";
import { db, firebaseReady } from "../../lib/firebase";
import type { Student } from "../../domain/models";
import { normalizeArabic, buildSearchTokens } from "../../domain/arabic";
import { cleanValues, fieldValueOrDefault, validateStudentValues } from "../../domain/template";
import { MEMO_LEVELS } from "../../domain/requests";
import { Loading, EmptyState, ConfirmModal, useToast } from "../../components/ui";

type Draft = Record<string, unknown>;

export default function StudentEditorPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isSuperAdmin, committeePerm } = useAuth();
  const { committees, byId } = useCommittees();
  const { data: template } = useTemplate();

  const studentRef = useMemo(
    () => (firebaseReady && db && studentId ? (doc(db!, "students", studentId) as import("firebase/firestore").DocumentReference<Student>) : null),
    [studentId]
  );
  const { data: existing, loading } = useDocument<Student>(studentRef);

  const [name, setName] = useState("");
  const [committeeId, setCommitteeId] = useState("");
  const [points, setPoints] = useState("0");
  const [memo, setMemo] = useState<string>("none");
  const [values, setValues] = useState<Draft>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!existing || !template) return;
    setName(existing.name);
    setCommitteeId(existing.committeeId);
    setPoints(String(existing.points ?? 0));
    setMemo(existing.memorizationLevel ?? "none");
    const filled: Draft = {};
    for (const f of template.fields) filled[f.key] = fieldValueOrDefault(f, existing.values?.[f.key]);
    setValues(filled);
  }, [existing, template]);

  const creatable = useMemo(
    () => committees.filter((c) => c.status === "active").filter((c) => isSuperAdmin || committeePerm(c.id, "students.create")),
    [committees, isSuperAdmin, committeePerm]
  );

  const isEdit = !!studentId;
  const canWrite = isEdit
    ? !!existing && (isSuperAdmin || committeePerm(existing.committeeId, "students.update"))
    : true;
  const committeeLocked = isEdit && !isSuperAdmin;

  function buildStudent(): Student | null {
    if (!template) return null;
    const cleaned = cleanValues(template, values);
    const trimmedName = name.trim();
    const normalized = normalizeArabic(trimmedName);
    const tokens = buildSearchTokens(trimmedName, String(values["phone"] ?? ""));
    return {
      id: studentId ?? "",
      committeeId,
      name: trimmedName,
      values: cleaned,
      searchTokens: tokens,
      normalizedName: normalized,
      points: Number(points) || 0,
      memorizationLevel: memo as Student["memorizationLevel"],
      archived: existing?.archived ?? false,
      templateVersion: template.version,
    };
  }

  async function onSave() {
    if (!template || !user) return;
    const candidate = buildStudent();
    if (!candidate) return;
    const errs = validateStudentValues(template, candidate.name, candidate.values);
    if (!candidate.committeeId) errs.committeeId = "اختر اللجنة";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setBusy(true);
    try {
      const id = await saveStudent({ student: candidate, id: studentId }, user);
      toast.showSuccess(isEdit ? "تم حفظ التعديلات" : "أُضيف الطالب");
      navigate(`/students/${id}`, { replace: true });
    } catch (e) {
      toast.showError(e instanceof AppError ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  if (studentId && loading) {
    return (
      <AppLayout title="الطالب">
        <Loading />
      </AppLayout>
    );
  }
  if (studentId && !existing) {
    return (
      <AppLayout title="الطالب">
        <EmptyState icon="🔍" title="الطالب غير موجود" sub="ربما حُذف أو لا تملك صلاحية قراءته" />
      </AppLayout>
    );
  }
  if (!template) {
    return (
      <AppLayout title="الطالب">
        <EmptyState icon="📋" title="لم يُعرَّف قالب الطلاب بعد" sub="تُعرّفه الإدارة من لوحة الإدارة ← القالب" />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={isEdit ? existing!.name : "طالب جديد"}>
      {isEdit && existing?.archived ? (
        <p className="badge badge--warn mb-1">هذا الطالب مؤرشف</p>
      ) : null}

      <div className="card">
        <div className="field">
          <label className="label required" htmlFor="st-name">الاسم</label>
          <input id="st-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={!canWrite} />
          {errors.name ? <span className="error-text">{errors.name}</span> : null}
        </div>

        <div className="field">
          <span className="label required">اللجنة</span>
          {committeeLocked ? (
            <p className="mb-0">
              {committeeId ? <span {...(byId.get(committeeId) ? { className: "badge badge--committee", "data-cc": byId.get(committeeId)!.colorKey } : {})}>{byId.get(committeeId)?.name ?? "—"}</span> : "—"}
            </p>
          ) : (
            <select className="select" value={committeeId} onChange={(e) => setCommitteeId(e.target.value)}>
              <option value="">— اختر اللجنة —</option>
              {creatable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {errors.committeeId ? <span className="error-text">{errors.committeeId}</span> : null}
        </div>

        {template.fields.map((f) => {
          const v = values[f.key];
          const set = (nv: unknown) => setValues((prev) => ({ ...prev, [f.key]: nv }));
          return (
            <div key={f.key} className="field">
              <span className={`label ${f.required ? "required" : ""}`}>{f.label}</span>
              {f.type === "text" ? (
                <input className="input" value={String(v ?? "")} onChange={(e) => set(e.target.value)} disabled={!canWrite} />
              ) : f.type === "number" ? (
                <input className="input" type="number" value={v === "" || v === undefined ? "" : String(v)} onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))} disabled={!canWrite} />
              ) : f.type === "date" ? (
                <input className="input" type="date" value={String(v ?? "")} onChange={(e) => set(e.target.value)} disabled={!canWrite} />
              ) : f.type === "select" ? (
                <select className="select" value={String(v ?? "")} onChange={(e) => set(e.target.value)} disabled={!canWrite}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "multiselect" ? (
                <div className="row">
                  {(f.options ?? []).map((o) => {
                    const arr = Array.isArray(v) ? v.map(String) : [];
                    const on = arr.includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        className={`chip ${on ? "chip--on" : ""}`}
                        onClick={() => set(on ? arr.filter((x) => x !== o) : [...arr, o])}
                        disabled={!canWrite}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <label className="check-row">
                  <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(e.target.checked)} disabled={!canWrite} />
                  نعم
                </label>
              )}
              {errors[f.key] ? <span className="error-text">{errors[f.key]}</span> : null}
            </div>
          );
        })}

        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="st-points">النقاط</label>
            <input id="st-points" className="input" type="number" value={points} onChange={(e) => setPoints(e.target.value)} disabled={!canWrite} />
          </div>
          <div className="field">
            <span className="label">مستوى الحفظ</span>
            <select className="select" value={memo} onChange={(e) => setMemo(e.target.value)} disabled={!canWrite}>
              {MEMO_LEVELS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {canWrite ? (
          <button type="button" className="btn btn--primary btn--block" onClick={() => void onSave()} disabled={busy}>
            {busy ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الطالب"}
          </button>
        ) : (
          <p className="help-text">لا تملك صلاحية التعديل في لجنة هذا الطالب</p>
        )}
      </div>

      {isEdit && (isSuperAdmin || committeePerm(existing!.committeeId, "students.update")) ? (
        <div className="card">
          <div className="card__title">إجراءات</div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setConfirmArchive(true)}>
              {existing!.archived ? "إلغاء الأرشفة" : "أرشفة"}
            </button>
            {isSuperAdmin || committeePerm(existing!.committeeId, "students.delete") ? (
              <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
                حذف نهائي
              </button>
            ) : null}
          </div>
          <p className="help-text mt-1">الأرشفة تخفي الطالب من القائمة اليومية مع إمكانية استعادته.</p>
        </div>
      ) : null}

      {confirmArchive ? (
        <ConfirmModal
          title={existing!.archived ? "إلغاء الأرشفة" : "أرشفة الطالب"}
          message={existing!.archived ? "سيعود الطالب للظهور في القوائم." : "سيُخفى الطالب من القوائم اليومية."}
          busy={busy}
          onClose={() => setConfirmArchive(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await setStudentArchived(studentId!, !existing!.archived);
              toast.showSuccess("تم التنفيذ");
              setConfirmArchive(false);
            } catch {
              toast.showError("تعذر التنفيذ");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmModal
          title="حذف نهائي"
          message="لا يمكن التراجع عن حذف الطالب نهائيًا. يُفضّل الأرشفة بدلًا من الحذف."
          confirmLabel="حذف نهائي"
          danger
          busy={busy}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            if (!user) return;
            setBusy(true);
            try {
              await hardDeleteStudent(studentId!, user);
              toast.showSuccess("تم الحذف");
              navigate("/students");
            } catch {
              toast.showError("تعذر الحذف");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </AppLayout>
  );
}
