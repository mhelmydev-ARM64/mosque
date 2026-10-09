import { useMemo, useState } from "react";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees, useRequests, useRoutingRules } from "../../services/hooks";
import {
  createRequest,
  decideRequest,
  cancelRequest,
  executeFinancialRequest,
  executePlainRequest,
  AppError,
} from "../../services/atomicWrites";
import {
  REQUEST_TYPES,
  requestTypeInfo,
  STATUS_LABELS,
  statusBadgeClass,
  CURRENCIES,
  CURRENCY_LABELS,
  formatMoney,
} from "../../domain/requests";
import type { RequestDoc, RequestType } from "../../domain/models";
import { committeeColor } from "../../domain/colors";
import { formatDate, formatDateTime } from "../../lib/format";
import { ConfirmModal, EmptyState, Loading, Modal, Select, useToast } from "../../components/ui";
import {
  IconAlert,
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconCheck,
  IconInbox,
  IconPlay,
  IconPlus,
  IconSearch,
  IconSend,
  IconUndo,
  IconX,
} from "../../components/icons";

type Tab = "incoming" | "sent" | "oversight";

const newest = (a: RequestDoc, b: RequestDoc) => tsSeconds(b.createdAt) - tsSeconds(a.createdAt);

function tsSeconds(ts: unknown): number {
  return ts && typeof ts === "object" && "seconds" in ts ? Number((ts as { seconds: number }).seconds) : 0;
}

export default function RequestsPage() {
  const { user, isSuperAdmin, hasGlobal, committeePerm } = useAuth();
  const { committees, byId } = useCommittees();
  const { byType: routingByType } = useRoutingRules();

  const [tab, setTab] = useState<Tab>("incoming");
  const [filter, setFilter] = useState("");

  const activeCommitteeIds = useMemo(() => committees.filter((c) => c.status === "active").map((c) => c.id), [committees]);
  const receiveCommittees = useMemo(
    () =>
      isSuperAdmin
        ? activeCommitteeIds
        : (user?.committeeIds ?? []).filter(
            (cid) => committeePerm(cid, "requests.receive") || committeePerm(cid, "finance.read")
          ),
    [user, isSuperAdmin, committeePerm, activeCommitteeIds]
  );
  const sendCommittees = useMemo(
    () =>
      isSuperAdmin
        ? activeCommitteeIds
        : (user?.committeeIds ?? []).filter(
            (cid) => committeePerm(cid, "requests.send") || committeePerm(cid, "finance.read")
          ),
    [user, isSuperAdmin, committeePerm, activeCommitteeIds]
  );
  const canSend = sendCommittees.length > 0;
  const oversight = hasGlobal("requests.oversight");

  const scope = useMemo(
    () => ({ receiveCommittees, sendCommittees, createdBy: user?.uid ?? null, all: oversight }),
    [receiveCommittees, sendCommittees, user?.uid, oversight]
  );
  const { data, loading, error } = useRequests(scope);

  const recvSet = useMemo(() => new Set(receiveCommittees), [receiveCommittees]);
  const sendSet = useMemo(() => new Set(sendCommittees), [sendCommittees]);

  const groups = useMemo(() => {
    const incoming = data.filter((r) => recvSet.has(r.destinationCommitteeId));
    const sent = data.filter((r) => sendSet.has(r.senderCommitteeId) || r.createdBy === user?.uid);
    return { incoming, sent, all: data };
  }, [data, recvSet, sendSet, user?.uid]);

  const activeTab: Tab = tab === "oversight" && !oversight ? "incoming" : tab;
  const list = groups[activeTab === "incoming" ? "incoming" : activeTab === "sent" ? "sent" : "all"];

  const needle = filter.trim();
  const sorted = useMemo(() => {
    const rows = [...list].sort(newest);
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.title.includes(needle) ||
        r.body.includes(needle) ||
        r.createdByName.includes(needle) ||
        STATUS_LABELS[r.status].includes(needle) ||
        (byId.get(r.senderCommitteeId)?.name ?? "").includes(needle) ||
        (byId.get(r.destinationCommitteeId)?.name ?? "").includes(needle)
    );
  }, [list, needle, byId]);

  const pendingCount = groups.incoming.filter((r) => r.status === "submitted" || r.status === "under_review").length;

  const tabs: Array<{ key: Tab; label: string; count: number; show: boolean }> = [
    { key: "incoming", label: "واردة", count: groups.incoming.length, show: receiveCommittees.length > 0 },
    { key: "sent", label: "مرسلة", count: groups.sent.length, show: true },
    { key: "oversight", label: "كل الطلبات", count: groups.all.length, show: oversight },
  ];

  const emptyIcon =
    activeTab === "sent" ? <IconSend size={34} /> : activeTab === "oversight" ? <IconSearch size={34} /> : <IconInbox size={34} />;

  return (
    <AppLayout title="الطلبات">
      <div className="tabs" role="tablist">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={`tab ${activeTab === t.key ? "tab--on" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <span>{t.label}</span>
              {t.count > 0 ? <span className="tab__count">{t.count}</span> : null}
              {t.key === "incoming" && pendingCount > 0 ? <span className="tab__dot" aria-label={`${pendingCount} بانتظار القرار`} /> : null}
            </button>
          ))}
      </div>

      <div className="toolbar">
        <div className="search-field flex1">
          <IconSearch size={17} />
          <input
            className="search-field__input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="ابحث في الطلبات..."
            aria-label="بحث في الطلبات"
          />
          {filter ? (
            <button type="button" className="search-field__clear" onClick={() => setFilter("")} aria-label="مسح البحث">
              <IconX size={14} />
            </button>
          ) : null}
        </div>
        {canSend ? <NewRequestButton sendCommittees={sendCommittees} routingByType={routingByType} /> : null}
      </div>

      {activeTab === "incoming" && receiveCommittees.length === 0 ? (
        <EmptyState
          icon={<IconAlert size={34} />}
          title="لا تملك صلاحية استقبال الطلبات"
          sub="تحتاج صلاحية استلام الطلبات أو عرض السجل المالي في لجنة واحدة على الأقل"
        />
      ) : !canSend && activeTab === "sent" ? (
        <>
          <EmptyState icon={<IconSend size={34} />} title="لا تملك صلاحية إرسال الطلبات" sub="تحتاج صلاحية إرسال الطلبات في لجنة" />
          {sorted.length > 0 ? <RequestList rows={sorted} byId={byId} /> : null}
        </>
      ) : error ? (
        <div className="notice notice--bad">
          <IconAlert size={17} />
          <span>{error}</span>
        </div>
      ) : loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={needle ? "لا نتائج مطابقة" : activeTab === "incoming" ? "لا توجد طلبات واردة" : activeTab === "sent" ? "لم ترسل أي طلب بعد" : "لا توجد طلبات بعد"}
          sub={needle ? undefined : activeTab === "sent" && canSend ? "اضغط «طلب جديد» لإرسال أول طلب" : undefined}
        />
      ) : (
        <RequestList rows={sorted} byId={byId} />
      )}
    </AppLayout>
  );
}

function RequestList({ rows, byId }: { rows: RequestDoc[]; byId: Map<string, import("../../domain/models").Committee> }) {
  const { committeePerm, isSuperAdmin } = useAuth();
  return (
    <div className="list">
      {rows.map((r) => {
        const receiver = isSuperAdmin || committeePerm(r.destinationCommitteeId, "requests.receive") || committeePerm(r.destinationCommitteeId, "finance.read");
        return <RequestCard key={r.id} request={r} perspective={receiver ? "receiver" : "sender"} byId={byId} />;
      })}
    </div>
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
  const fixed = rule?.mode === "fixed";
  const fixedDestination = fixed ? rule?.committeeId ?? "" : "";

  const typeOptions = REQUEST_TYPES.filter((t) => !t.manual).map((t) => ({ value: t.key, label: t.label }));
  const senderOptions = sendCommittees.map((cid) => ({ value: cid, label: byId.get(cid)?.name ?? cid }));
  const destinationOptions = [...byId.values()]
    .filter((c) => c.status === "active" && c.id !== senderCommitteeId)
    .map((c) => ({ value: c.id, label: c.name }));
  const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABELS[c], hint: c }));

  function reset() {
    setTitle("");
    setBody("");
    setAmount("");
    setDestination("");
  }

  async function submit() {
    if (!user) return;
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length < 3) return toast.showError("العنوان 3 أحرف على الأقل");
    if (!senderCommitteeId) return toast.showError("اختر لجنتك المرسلة");

    const dest = fixed ? fixedDestination : destinationCommitteeId;
    if (!dest) return toast.showError("اختر اللجنة الوجهة");
    if (dest === senderCommitteeId) return toast.showError("اللجنة الوجهة يجب أن تختلف عن اللجنة المرسلة");

    if (info.financial) {
      const value = Number(amount);
      if (!Number.isInteger(value) || value <= 0) return toast.showError("المبلغ عدد صحيح موجب");
      if (value > 1_000_000_000) return toast.showError("المبلغ أكبر من المسموح");
      if (cleanBody.length < 5) return toast.showError("اكتب سبب الطلب المالي (5 أحرف على الأقل)");
    }

    setBusy(true);
    try {
      await createRequest(
        {
          type,
          senderCommitteeId,
          destinationCommitteeId: dest,
          title: cleanTitle,
          body: cleanBody,
          ...(info.financial ? { amount: Number(amount), currency, direction: info.direction } : {}),
        },
        user
      );
      toast.showSuccess("أُرسل الطلب");
      setOpen(false);
      reset();
    } catch (e) {
      toast.showError(e instanceof AppError ? e.message : "تعذر إرسال الطلب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
        <IconPlus size={16} />
        <span>طلب جديد</span>
      </button>
      {open ? (
        <Modal
          title="طلب جديد"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>
                إلغاء
              </button>
              <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
                <IconSend size={16} />
                <span>{busy ? "جارٍ الإرسال..." : "إرسال"}</span>
              </button>
            </>
          }
        >
          <div className="field">
            <span className="label required" id="rq-type-label">النوع</span>
            <Select
              value={type}
              onChange={(v) => {
                setType(v as RequestType);
                setDestination("");
              }}
              options={typeOptions}
              aria-labelledby="rq-type-label"
            />
          </div>

          <div className="field">
            <span className="label required" id="rq-sender-label">لجنتي المرسلة</span>
            <Select
              value={senderCommitteeId}
              onChange={(v) => {
                setSenderCommitteeId(v);
                setDestination("");
              }}
              options={senderOptions}
              aria-labelledby="rq-sender-label"
            />
          </div>

          <div className="field">
            <span className="label required" id="rq-dest-label">اللجنة الوجهة</span>
            {fixed ? (
              <div className="readonly-field">
                <span>{byId.get(fixedDestination)?.name ?? "غير محددة"}</span>
                <span className="tiny faint">توجيه ثابت</span>
              </div>
            ) : (
              <Select
                value={destinationCommitteeId}
                onChange={setDestination}
                options={destinationOptions}
                placeholder="— اختر اللجنة —"
                aria-labelledby="rq-dest-label"
              />
            )}
            {fixed ? (
              <span className="help-text">التوجيه ثابت حسب قواعد الإدارة</span>
            ) : rule ? null : (
              <span className="help-text">لا توجد قاعدة توجيه لهذا النوع — أنت تختار الوجهة</span>
            )}
          </div>

          <div className="field">
            <label className="label required" htmlFor="rq-title">العنوان</label>
            <input
              id="rq-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="مثال: طلب دعم لحملة الحفظ"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="rq-body">
              {info.financial ? "سبب الطلب / التفاصيل" : "التفاصيل"}
              {info.financial ? <span className="label__req">مطلوب</span> : null}
            </label>
            <textarea
              id="rq-body"
              className="textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="اكتب السبب بوضوح — يظهر للجهة المستلمة وللإدارة"
            />
            <span className="help-text">{body.length} / 2000</span>
          </div>

          {info.financial ? (
            <div className="grid-2">
              <div className="field">
                <label className="label required" htmlFor="rq-amount">المبلغ</label>
                <input
                  id="rq-amount"
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="field">
                <span className="label required" id="rq-cur-label">العملة</span>
                <Select value={currency} onChange={setCurrency} options={currencyOptions} aria-labelledby="rq-cur-label" />
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
  const [delivery, setDelivery] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const info = requestTypeInfo(r.type);
  const sender = byId.get(r.senderCommitteeId);
  const destination = byId.get(r.destinationCommitteeId);

  // الموافقة المالية صلاحية مستقلة عن تسجيل الحركة (finance.approve مقابل finance.post)
  const decidePermission = info.financial ? (info.manual ? "finance.post" : "finance.approve") : "requests.decide";
  const executePermission = info.financial ? "finance.post" : "requests.execute";

  const canDecide =
    !!user &&
    (r.status === "submitted" || r.status === "under_review") &&
    (isSuperAdmin || committeePerm(r.destinationCommitteeId, decidePermission));
  const canExecute =
    perspective === "receiver" &&
    !!user &&
    r.status === "approved" &&
    (isSuperAdmin || committeePerm(r.destinationCommitteeId, executePermission));
  const canCancel =
    perspective === "sender" && !!user && (r.status === "submitted" || r.status === "under_review") && r.createdBy === user.uid;

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

  function openDecision(kind: "approved" | "rejected") {
    setDecision(kind);
    setReason(r.status === "under_review" ? (r.decisionReason ?? "") : "");
    setDelivery("");
  }

  return (
    <article className="card rq-card mb-0" data-cc={destination ? destination.colorKey : undefined}>
      <header className="rq-card__head">
        <span className={statusBadgeClass(r.status)}>{STATUS_LABELS[r.status]}</span>
        <span className="badge badge--info">{info.label}</span>
        {info.financial && r.amount ? (
          <span className={`badge badge--money ${r.direction === "income" ? "is-in" : "is-out"}`}>
            {r.direction === "income" ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />}
            {formatMoney(r.amount, r.currency ?? "SYP")}
          </span>
        ) : null}
        <time className="rq-card__time" dateTime={r.createdAt ? String(tsSeconds(r.createdAt)) : undefined}>
          {formatDateTime(r.createdAt)}
        </time>
      </header>

      <h3 className="rq-card__title">{r.title}</h3>
      {r.body ? <p className="rq-card__body">{r.body}</p> : null}

      <div className="rq-card__route">
        {sender ? <span className="chip chip--cc" data-cc={committeeColor(sender.colorKey)}>{sender.name}</span> : <span className="chip">{r.senderCommitteeId}</span>}
        <span className="rq-card__arrow" aria-hidden="true">
          <IconSend size={14} />
        </span>
        {destination ? (
          <span className="chip chip--cc" data-cc={committeeColor(destination.colorKey)}>{destination.name}</span>
        ) : (
          <span className="chip">{r.destinationCommitteeId}</span>
        )}
        <span className="rq-card__by">· {r.createdByName}</span>
      </div>

      {r.decisionReason ? (
        <div className={`rq-card__note ${r.status === "rejected" ? "is-bad" : ""}`}>
          <span className="rq-card__note-label">{r.status === "rejected" ? "سبب الرفض" : "سبب القرار"}</span>
          <span>{r.decisionReason}</span>
        </div>
      ) : null}

      {r.deliveryDate ? (
        <div className="rq-card__note is-date">
          <IconCalendar size={14} />
          <span className="rq-card__note-label">موعد التسليم</span>
          <span>{formatDate(r.deliveryDate)}</span>
        </div>
      ) : null}

      <footer className="rq-card__foot">
        {r.status === "executed" ? (
          <span className="tiny faint flex1">
            <IconCheck size={13} /> نفّذها {r.executedByName ?? "—"}
          </span>
        ) : (
          <span className="flex1" />
        )}

        {canDecide && r.status === "submitted" ? (
          <button
            type="button"
            className="btn btn--sm"
            disabled={busy}
            onClick={() => void act(() => decideRequest({ request: r, decision: "under_review", reason: "", actor: user! }), "أُضيف للمراجعة")}
          >
            <IconSearch size={15} />
            <span>مراجعة</span>
          </button>
        ) : null}

        {canDecide ? (
          <>
            <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => openDecision("approved")}>
              <IconCheck size={15} />
              <span>قبول</span>
            </button>
            <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => openDecision("rejected")}>
              <IconX size={15} />
              <span>رفض</span>
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
            <IconPlay size={15} />
            <span>{info.financial ? "تنفيذ وترحيل مالي" : "تنفيذ"}</span>
          </button>
        ) : null}

        {canCancel ? (
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setConfirmCancel(true)}>
            <IconUndo size={15} />
            <span>إلغاء</span>
          </button>
        ) : null}
      </footer>

      {decision ? (
        <Modal
          title={decision === "approved" ? "قبول الطلب" : "رفض الطلب"}
          onClose={() => setDecision(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDecision(null)} disabled={busy}>
                رجوع
              </button>
              <button
                type="button"
                className={`btn ${decision === "approved" ? "btn--primary" : "btn--danger"}`}
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    if (reason.trim().length < 3) throw new AppError("REASON_REQUIRED", "سبب القرار مطلوب (3 أحرف على الأقل)");
                    const parsed = delivery ? new Date(`${delivery}T12:00:00`) : null;
                    await decideRequest({
                      request: r,
                      decision,
                      reason: reason.trim(),
                      deliveryDate: decision === "approved" && parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
                      actor: user!,
                    });
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
            <label className="label required" htmlFor="dec-reason">سبب القرار</label>
            <textarea
              id="dec-reason"
              className="textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="اذكر السبب بوضوح — يظهر للمرسل ويُسجَّل في السجل المالي"
            />
            <span className="help-text">{reason.length} / 500</span>
          </div>

          {decision === "approved" ? (
            <div className="field">
              <label className="label" htmlFor="dec-date">موعد التسليم (اختياري)</label>
              <input id="dec-date" className="input" type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
              <span className="help-text">يظهر للمرسل حتى يعرف متى يُنجز طلبه</span>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {confirmCancel ? (
        <ConfirmModal
          title="إلغاء الطلب"
          message="سيُلغى الطلب ولا يمكن اتخاذ قرار فيه لاحقًا."
          danger
          busy={busy}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() =>
            void act(async () => {
              await cancelRequest(r, user!);
              setConfirmCancel(false);
            }, "أُلغي الطلب")
          }
        />
      ) : null}
    </article>
  );
}
