import { useMemo, useState } from "react";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees, useRequestsFor, useRoutingRules } from "../../services/hooks";
import { createRequest, decideRequest, cancelRequest, executeFinancialRequest, executePlainRequest, AppError } from "../../services/atomicWrites";
import { REQUEST_TYPES, requestTypeInfo, STATUS_LABELS, statusBadgeClass, CURRENCIES, CURRENCY_LABELS, formatMoney } from "../../domain/requests";
import type { RequestDoc, RequestType } from "../../domain/models";
import { committeeBadgeProps } from "../../domain/colors";
import { formatDateTime } from "../../lib/format";
import { Loading, EmptyState, Modal, useToast, ConfirmModal } from "../../components/ui";

export default function RequestsPage() {
  const { user, isSuperAdmin, committeePerm } = useAuth();
  const { byId } = useCommittees();
  const { byType: routingByType } = useRoutingRules();

  const [tab, setTab] = useState<"incoming" | "sent">("incoming");

  const receiveCommittees = useMemo(
    () => (user?.committeeIds ?? []).filter((cid) => isSuperAdmin || committeePerm(cid, "requests.receive")),
    [user, isSuperAdmin, committeePerm]
  );
  const sendCommittees = useMemo(
    () => (user?.committeeIds ?? []).filter((cid) => isSuperAdmin || committeePerm(cid, "requests.send")),
    [user, isSuperAdmin, committeePerm]
  );

  const incoming = useRequestsFor(receiveCommittees, null);
  const sent = useRequestsFor([], user?.uid ?? null);

  const active = tab === "incoming" ? incoming : sent;
  const sorted = useMemo(
    () =>
      [...active.data].sort((a, b) => {
        const at = a.createdAt && typeof a.createdAt === "object" && "seconds" in a.createdAt ? a.createdAt.seconds : 0;
        const bt = b.createdAt && typeof b.createdAt === "object" && "seconds" in b.createdAt ? b.createdAt.seconds : 0;
        return bt - at;
      }),
    [active.data]
  );

  return (
    <AppLayout title="الطلبات">
      <div className="tabs">
        <button type="button" className={`tab ${tab === "incoming" ? "tab--on" : ""}`} onClick={() => setTab("incoming")}>
          واردة {receiveCommittees.length === 0 ? "" : `(${receiveCommittees.length} لجنة)`}
        </button>
        <button type="button" className={`tab ${tab === "sent" ? "tab--on" : ""}`} onClick={() => setTab("sent")}>
          مرسلة
        </button>
      </div>

      {tab === "incoming" ? (
        <>
          {receiveCommittees.length === 0 ? (
            <EmptyState icon="🔒" title="لا تملك صلاحية استقبال الطلبات" sub="تحتاج صلاحية requests.receive في لجنة" />
          ) : active.error ? (
            <p className="error-text">{active.error}</p>
          ) : active.loading ? (
            <Loading />
          ) : sorted.length === 0 ? (
            <EmptyState icon="📭" title="لا توجد طلبات واردة" />
          ) : (
            <div className="list">
              {sorted.map((r) => (
                <RequestCard key={r.id} request={r} perspective="receiver" byId={byId} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row mb-1">
            {sendCommittees.length > 0 ? <NewRequestButton sendCommittees={sendCommittees} routingByType={routingByType} /> : <span className="help-text">تحتاج صلاحية إرسال طلبات في لجنة</span>}
          </div>
          {active.error ? (
            <p className="error-text">{active.error}</p>
          ) : active.loading ? (
            <Loading />
          ) : sorted.length === 0 ? (
            <EmptyState icon="📤" title="لم ترسل أي طلب بعد" />
          ) : (
            <div className="list">
              {sorted.map((r) => (
                <RequestCard key={r.id} request={r} perspective="sender" byId={byId} />
              ))}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}

function NewRequestButton({
  sendCommittees,
  routingByType,
}: {
  sendCommittees: string[];
  routingByType: Map<string, { type: RequestType; mode: "fixed" | "sender_choice"; committeeId?: string | null }>;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const { byId } = useCommittees();
  const [open, setOpen] = useState(false);

  const [type, setType] = useState<RequestType>("formatting");
  const [senderCommitteeId, setSenderCommitteeId] = useState(sendCommittees[0] ?? "");
  const [destinationCommitteeId, setDestination] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("SYP");
  const [busy, setBusy] = useState(false);

  const info = requestTypeInfo(type);
  const rule = routingByType.get(type);
  const fixedDestination = rule?.mode === "fixed" ? rule.committeeId ?? "" : "";

  async function submit() {
    if (!user) return;
    if (!title.trim() || title.trim().length < 3) {
      toast.showError("العنوان 3 أحرف على الأقل");
      return;
    }
    const dest = fixedDestination || destinationCommitteeId;
    if (!dest) {
      toast.showError("اختر اللجنة الوجهة");
      return;
    }
    if (info.financial && !(Number.isInteger(Number(amount)) && Number(amount) > 0)) {
      toast.showError("المبلغ عدد صحيح موجب");
      return;
    }
    setBusy(true);
    try {
      await createRequest(
        {
          type,
          senderCommitteeId,
          destinationCommitteeId: dest,
          title,
          body,
          ...(info.financial ? { amount: Number(amount), currency, direction: info.direction } : {}),
        },
        user
      );
      toast.showSuccess("أُرسل الطلب");
      setOpen(false);
      setTitle("");
      setBody("");
      setAmount("");
    } catch (e) {
      toast.showError(e instanceof AppError ? e.message : "تعذر إرسال الطلب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
        + طلب جديد
      </button>
      {open ? (
        <Modal
          title="طلب جديد"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>إلغاء</button>
              <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
                {busy ? "جارٍ الإرسال..." : "إرسال"}
              </button>
            </>
          }
        >
          <div className="field">
            <span className="label required">النوع</span>
            <select className="select" value={type} onChange={(e) => { setType(e.target.value as RequestType); setDestination(""); }}>
              {REQUEST_TYPES.filter((t) => !t.manual).map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label required">لجنتي المرسلة</span>
            <select className="select" value={senderCommitteeId} onChange={(e) => { setSenderCommitteeId(e.target.value); setDestination(""); }}>
              {sendCommittees.map((cid) => (
                <option key={cid} value={cid}>{byId.get(cid)?.name ?? cid}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label required">اللجنة الوجهة</span>
            {rule?.mode === "fixed" ? (
              <input className="input" value={byId.get(fixedDestination)?.name ?? "غير محددة"} disabled />
            ) : (
              <select className="select" value={destinationCommitteeId} onChange={(e) => setDestination(e.target.value)}>
                <option value="">— اختر —</option>
                {sendCommittees.length > 0 && byId
                  ? [...byId.values()].filter((c) => c.status === "active" && c.id !== senderCommitteeId).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  : null}
              </select>
            )}
            {rule?.mode === "fixed" ? <span className="help-text">التوجيه ثابت حسب قواعد الإدارة</span> : null}
          </div>

          <div className="field">
            <label className="label required" htmlFor="rq-title">العنوان</label>
            <input id="rq-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>

          <div className="field">
            <label className="label" htmlFor="rq-body">التفاصيل</label>
            <textarea id="rq-body" className="textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
          </div>

          {info.financial ? (
            <div className="grid-2">
              <div className="field">
                <label className="label required" htmlFor="rq-amount">المبلغ</label>
                <input id="rq-amount" className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
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
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}

function RequestCard({
  request: r,
  perspective,
  byId,
}: {
  request: RequestDoc;
  perspective: "sender" | "receiver";
  byId: Map<string, import("../../domain/models").Committee>;
}) {
  const { user, isSuperAdmin, committeePerm } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const info = requestTypeInfo(r.type);
  const sender = byId.get(r.senderCommitteeId);
  const destination = byId.get(r.destinationCommitteeId);

  const canDecide =
    perspective === "receiver" &&
    user &&
    (r.status === "submitted" || r.status === "under_review") &&
    (isSuperAdmin || committeePerm(r.destinationCommitteeId, "requests.decide"));
  const canExecute =
    perspective === "receiver" &&
    user &&
    r.status === "approved" &&
    (info.financial
      ? isSuperAdmin || committeePerm(r.destinationCommitteeId, "finance.post")
      : isSuperAdmin || committeePerm(r.destinationCommitteeId, "requests.execute"));
  const canCancel =
    perspective === "sender" && user && (r.status === "submitted" || r.status === "under_review") && r.createdBy === user.uid;

  async function act(fn: () => Promise<void>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.showSuccess(okMsg);
    } catch (e) {
      toast.showError(e instanceof AppError ? e.message : "تعذر التنفيذ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`card ${destination ? "card--bordered" : ""} mb-0`}
      data-cc={destination ? destination.colorKey : undefined}
    >
      <div className="card__title">
        <span className={`badge ${statusBadgeClass(r.status)}`}>{STATUS_LABELS[r.status]}</span>
        <span className="badge badge--info">{info.label}</span>
        {info.financial && r.amount ? <span className={`badge ${r.direction === "income" ? "badge--ok" : "badge--bad"}`}>{formatMoney(r.amount, r.currency ?? "SYP")}</span> : null}
        <span className="tiny faint flex1" style={{ textAlign: "end" }}>{formatDateTime(r.createdAt)}</span>
      </div>

      <div className="bold">{r.title}</div>
      {r.body ? <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{r.body}</p> : null}

      <div className="row small muted">
        {sender ? <span {...committeeBadgeProps(sender.colorKey)}>{sender.name}</span> : null}
        <span>→</span>
        {destination ? <span {...committeeBadgeProps(destination.colorKey)}>{destination.name}</span> : null}
        <span>· {r.createdByName}</span>
      </div>

      {r.decisionReason ? (
        <div className={`small mt-1 ${r.status === "rejected" ? "money-out" : "muted"}`}>
          السبب: {r.decisionReason}
        </div>
      ) : null}
      {r.status === "executed" ? <div className="tiny faint mt-1">نفّذها: {r.executedByName ?? "—"}</div> : null}

      {(canDecide || canExecute || canCancel) && (
        <div className="row mt-1">
          {canDecide && r.status === "submitted" ? (
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void act(() => decideRequest({ request: r, decision: "under_review", reason: "", actor: user! }), "أُضيف للمراجعة")}>
              مراجعة
            </button>
          ) : null}
          {canDecide ? (
            <>
              <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => { setDecision("approved"); setReason(""); }}>
                قبول
              </button>
              <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => { setDecision("rejected"); setReason(""); }}>
                رفض
              </button>
            </>
          ) : null}
          {canExecute ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={() =>
                void act(
                  () => (info.financial ? executeFinancialRequest(r, user!) : executePlainRequest(r, user!)),
                  "نُفِّذ الطلب"
                )
              }
            >
              {info.financial ? "تنفيذ وترحيل مالي" : "تنفيذ"}
            </button>
          ) : null}
          {canCancel ? (
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setConfirmCancel(true)}>
              إلغاء
            </button>
          ) : null}
        </div>
      )}

      {decision ? (
        <Modal
          title={decision === "approved" ? "قبول الطلب" : "رفض الطلب"}
          onClose={() => setDecision(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDecision(null)} disabled={busy}>رجوع</button>
              <button
                type="button"
                className={`btn ${decision === "approved" ? "btn--primary" : "btn--danger"}`}
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await decideRequest({ request: r, decision, reason, actor: user! });
                    setDecision(null);
                  }, decision === "approved" ? "قُبل الطلب" : "رُفض الطلب")
                }
              >
                تأكيد القرار
              </button>
            </>
          }
        >
          <div className="field">
            <label className="label required" htmlFor="dec-reason">سبب القرار (إلزامي)</label>
            <textarea id="dec-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} placeholder="اذكر السبب بوضوح — يظهر للمرسل" />
          </div>
        </Modal>
      ) : null}

      {confirmCancel ? (
        <ConfirmModal
          title="إلغاء الطلب"
          message="سيُلغى الطلب ولا يمكن قراره لاحقًا."
          danger
          busy={busy}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => void act(async () => { await cancelRequest(r, user!); setConfirmCancel(false); }, "أُلغي الطلب")}
        />
      ) : null}
    </div>
  );
}
