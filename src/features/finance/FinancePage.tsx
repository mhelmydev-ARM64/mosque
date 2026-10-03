import { useMemo, useState } from "react";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees, useLedgerFor } from "../../services/hooks";
import { manualFinanceEntry, AppError } from "../../services/atomicWrites";
import { CURRENCIES, CURRENCY_LABELS, formatMoney, requestTypeInfo } from "../../domain/requests";
import type { LedgerEntry } from "../../domain/models";
import { committeeBadgeProps } from "../../domain/colors";
import { formatDateTime } from "../../lib/format";
import { Loading, EmptyState, useToast } from "../../components/ui";

export default function FinancePage() {
  const { user, isSuperAdmin, committeePerm } = useAuth();
  const { byId } = useCommittees();

  const readCommittees = useMemo(
    () => (user?.committeeIds ?? []).filter((cid) => isSuperAdmin || committeePerm(cid, "finance.read")),
    [user, isSuperAdmin, committeePerm]
  );
  const postCommittees = useMemo(
    () => (user?.committeeIds ?? []).filter((cid) => isSuperAdmin || committeePerm(cid, "finance.post")),
    [user, isSuperAdmin, committeePerm]
  );

  const { data: entries, loading, error } = useLedgerFor(readCommittees);

  const [currencyFilter, setCurrencyFilter] = useState("");
  const [committeeFilter, setCommitteeFilter] = useState("");

  const sorted = useMemo(
    () =>
      [...entries]
        .filter((e) => (!currencyFilter || e.currency === currencyFilter) && (!committeeFilter || e.committeeId === committeeFilter))
        .sort((a, b) => {
          const at = a.createdAt && typeof a.createdAt === "object" && "seconds" in a.createdAt ? a.createdAt.seconds : 0;
          const bt = b.createdAt && typeof b.createdAt === "object" && "seconds" in b.createdAt ? b.createdAt.seconds : 0;
          return bt - at;
        }),
    [entries, currencyFilter, committeeFilter]
  );

  const summary = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const e of sorted) {
      const cur = map.get(e.currency) ?? { income: 0, expense: 0 };
      if (e.direction === "income") cur.income += e.amount;
      else cur.expense += e.amount;
      map.set(e.currency, cur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sorted]);

  if (readCommittees.length === 0) {
    return (
      <AppLayout title="السجل المالي">
        <EmptyState icon="🔒" title="لا تملك صلاحية القراءة المالية" sub="تحتاج صلاحية finance.read في لجنة" />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="السجل المالي">
      {postCommittees.length > 0 ? <ManualEntry postCommittees={postCommittees} /> : null}

      <div className="row mb-1">
        <select className="select" style={{ width: "auto" }} value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}>
          <option value="">كل العملات</option>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{CURRENCY_LABELS[c]} ({c})</option>
          ))}
        </select>
        <select className="select" style={{ width: "auto" }} value={committeeFilter} onChange={(e) => setCommitteeFilter(e.target.value)}>
          <option value="">كل اللجان</option>
          {readCommittees.map((cid) => (
            <option key={cid} value={cid}>{byId.get(cid)?.name ?? cid}</option>
          ))}
        </select>
      </div>

      {summary.length > 0 ? (
        <div className="stat-grid">
          {summary.map(([cur, s]) => (
            <div key={cur} className="stat">
              <div className="stat__label">{CURRENCY_LABELS[cur] ?? cur}</div>
              <div className="stat__value money-in">+{new Intl.NumberFormat("ar-SY").format(s.income)}</div>
              <div className="stat__value money-out">-{new Intl.NumberFormat("ar-SY").format(s.expense)}</div>
              <div className="small bold">الرصيد: {new Intl.NumberFormat("ar-SY").format(s.income - s.expense)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <EmptyState icon="💰" title="لا توجد حركات مالية" sub="كل حركة مالية تبدأ كطلب، والإدخال اليدوي ينشئها فورًا" />
      ) : (
        <div className="list">
          {sorted.map((e) => (
            <LedgerRow key={e.id} entry={e} byId={byId} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function LedgerRow({ entry: e, byId }: { entry: LedgerEntry; byId: Map<string, import("../../domain/models").Committee> }) {
  const income = e.direction === "income";
  const c = byId.get(e.committeeId);
  return (
    <div
      className={`card mb-0 card--bordered ${income ? "stat--in" : "stat--out"}`}
      data-cc={c?.colorKey ?? undefined}
    >
      <div className="card__row">
        <span className={`bold ${income ? "money-in" : "money-out"}`} style={{ fontSize: "1.05rem" }}>
          {income ? "+" : "−"} {formatMoney(e.amount, e.currency)}
        </span>
        <span className="badge badge--info">{requestTypeInfo(e.type).label}</span>
        {c ? <span {...committeeBadgeProps(c.colorKey)}>{c.name}</span> : null}
        <span className="tiny faint flex1" style={{ textAlign: "end" }}>{formatDateTime(e.executedAt ?? e.createdAt)}</span>
      </div>
      {e.note ? <div className="small muted mt-1">{e.note}</div> : null}
      <div className="tiny faint mt-1">بواسطة: {e.executedByName} · حركة غير قابلة للتعديل</div>
    </div>
  );
}

function ManualEntry({ postCommittees }: { postCommittees: string[] }) {
  const toast = useToast();
  const { user } = useAuth();
  const { byId } = useCommittees();
  const [type, setType] = useState<"manual_income" | "manual_expense">("manual_income");
  const [committeeId, setCommitteeId] = useState(postCommittees[0] ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SYP");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) return;
    if (!(Number.isInteger(Number(amount)) && Number(amount) > 0)) {
      toast.showError("المبلغ عدد صحيح موجب");
      return;
    }
    if (note.trim().length < 3) {
      toast.showError("الوصف 3 أحرف على الأقل (سبب إلزامي)");
      return;
    }
    setBusy(true);
    try {
      await manualFinanceEntry({ committeeId, type, amount: Number(amount), currency, note, actor: user });
      toast.showSuccess("سُجّلت الحركة المالية");
      setAmount("");
      setNote("");
    } catch (e) {
      toast.showError(e instanceof AppError ? e.message : "تعذر التسجيل");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card__title">⚡ إدخال مالي سريع</div>
      <p className="tiny faint">ينشئ طلبًا معتمدًا ومنفَّذًا وحركته في خطوة واحدة — يظهر في سجل الطلبات أيضًا.</p>
      <div className="grid-2">
        <div className="field">
          <span className="label required">النوع</span>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as "manual_income" | "manual_expense")}>
            <option value="manual_income">دخل</option>
            <option value="manual_expense">مصروف</option>
          </select>
        </div>
        <div className="field">
          <span className="label required">اللجنة</span>
          <select className="select" value={committeeId} onChange={(e) => setCommitteeId(e.target.value)}>
            {postCommittees.map((cid) => (
              <option key={cid} value={cid}>{byId.get(cid)?.name ?? cid}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label required" htmlFor="fin-amount">المبلغ</label>
          <input id="fin-amount" className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <span className="label required">العملة</span>
          <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{CURRENCY_LABELS[c]} ({c})</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label required" htmlFor="fin-note">الوصف / السبب</label>
        <textarea id="fin-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="مثال: تبرعات الأهالي لشهر تشرين الأول" />
      </div>
      <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
        {busy ? "جارٍ التسجيل..." : "ترحيل الحركة"}
      </button>
    </div>
  );
}
