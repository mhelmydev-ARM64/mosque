import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  useCommittees,
  useMyTasks,
  useProfilesIn,
  useRequests,
  useTasks,
  useWeeklyReports,
} from "../../services/hooks";
import { createWeeklyReport, deleteTask, saveTask, updateTaskProgress } from "../../services/atomicWrites";
import { ConfirmModal, EmptyState, Loading, Modal, Select, useToast } from "../../components/ui";
import { committeeBadgeProps } from "../../domain/colors";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isOverdue,
  taskStatusBadgeClass,
} from "../../domain/tasks";
import { requestTypeInfo } from "../../domain/requests";
import { formatDate, formatDateTime, formatPlainDate, tsToDate } from "../../lib/format";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconFlag,
  IconPencil,
  IconPlus,
  IconReport,
  IconTasks,
  IconTrash,
  IconUser,
} from "../../components/icons";
import type { CommitteeTask, TaskPriority, TaskStatus } from "../../domain/models";

type Tab = "mine" | "committees" | "reports";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  const p = (n: number) => `${n}`.padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fromDateInput(v: string): Date | null {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** فترة افتراضية للتقرير: آخر سبعة أيام. */
function currentWeek(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return { from, to };
}

export default function TasksAdminPage() {
  const { user, isSuperAdmin, hasGlobal, committeePerm } = useAuth();
  const toast = useToast();
  const { committees, byId } = useCommittees();

  const [tab, setTab] = useState<Tab>("mine");
  const [scopeAll, setScopeAll] = useState(false);
  const [committeeFilter, setCommitteeFilter] = useState("");

  const canOversight = isSuperAdmin || hasGlobal("requests.oversight");
  const myCommitteeIds = useMemo(
    () =>
      isSuperAdmin
        ? committees.filter((c) => c.status === "active").map((c) => c.id)
        : (user?.committeeIds ?? []),
    [isSuperAdmin, committees, user?.committeeIds]
  );

  /* ---- البيانات ---- */
  const mine = useMyTasks(user?.uid ?? null);
  const tasks = useTasks(myCommitteeIds, scopeAll && canOversight);
  const reports = useWeeklyReports(myCommitteeIds, scopeAll && canOversight);
  const { data: profiles } = useProfilesIn(myCommitteeIds);
  const { data: requests } = useRequests({
    receiveCommittees: myCommitteeIds,
    sendCommittees: myCommitteeIds,
    createdBy: user?.uid ?? null,
    all: false,
  });

  const manageable = useMemo(
    () => myCommitteeIds.filter((cid) => isSuperAdmin || committeePerm(cid, "tasks.manage")),
    [myCommitteeIds, isSuperAdmin, committeePerm]
  );
  const reportable = useMemo(
    () => myCommitteeIds.filter((cid) => isSuperAdmin || committeePerm(cid, "reports.write")),
    [myCommitteeIds, isSuperAdmin, committeePerm]
  );

  /* ---- محرر المهمة ---- */
  const [editing, setEditing] = useState<CommitteeTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [progressFor, setProgressFor] = useState<CommitteeTask | null>(null);
  const [deleteFor, setDeleteFor] = useState<CommitteeTask | null>(null);
  const [busy, setBusy] = useState(false);

  const [tCommittee, setTCommittee] = useState("");
  const [tTitle, setTTitle] = useState("");
  const [tDetails, setTDetails] = useState("");
  const [tStatus, setTStatus] = useState<TaskStatus>("open");
  const [tPriority, setTPriority] = useState<TaskPriority>("normal");
  const [tAssignee, setTAssignee] = useState("");
  const [tDue, setTDue] = useState("");
  const [tRequest, setTRequest] = useState("");

  /* ---- محرر التقدم ---- */
  const [pStatus, setPStatus] = useState<TaskStatus>("in_progress");
  const [pDetails, setPDetails] = useState("");

  /* ---- محرر التقرير ---- */
  const [reportOpen, setReportOpen] = useState(false);
  const [rCommittee, setRCommittee] = useState("");
  const [rTitle, setRTitle] = useState("");
  const [rBody, setRBody] = useState("");
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");

  function openCreate() {
    setTCommittee(manageable[0] ?? myCommitteeIds[0] ?? "");
    setTTitle("");
    setTDetails("");
    setTStatus("open");
    setTPriority("normal");
    setTAssignee("");
    setTDue("");
    setTRequest("");
    setCreating(true);
  }

  function openEdit(t: CommitteeTask) {
    setTCommittee(t.committeeId);
    setTTitle(t.title);
    setTDetails(t.details ?? "");
    setTStatus(t.status);
    setTPriority(t.priority);
    setTAssignee(t.assigneeUid ?? "");
    setTDue(toDateInput(tsToDate(t.dueDate)));
    setTRequest(t.requestId ?? "");
    setEditing(t);
  }

  function openProgress(t: CommitteeTask) {
    setPStatus(t.status === "cancelled" ? "in_progress" : t.status);
    setPDetails(t.details ?? "");
    setProgressFor(t);
  }

  function openReport() {
    const w = currentWeek();
    setRCommittee(reportable[0] ?? myCommitteeIds[0] ?? "");
    setRTitle(`تقرير إنجازات ${formatPlainDate(w.from)} – ${formatPlainDate(w.to)}`);
    setRBody("");
    setRFrom(toDateInput(w.from));
    setRTo(toDateInput(w.to));
    setReportOpen(true);
  }

  const assigneeOptions = useMemo(
    () =>
      profiles
        .filter((p) => !!p.uid && (p.committeeIds ?? []).includes(tCommittee))
        .map((p) => ({ value: p.uid, label: p.name })),
    [profiles, tCommittee]
  );

  const requestOptions = useMemo(
    () =>
      requests
        .filter((r) => r.senderCommitteeId === tCommittee || r.destinationCommitteeId === tCommittee)
        .map((r) => ({
          value: r.id,
          label: r.title,
          hint: requestTypeInfo(r.type).label,
        })),
    [requests, tCommittee]
  );

  async function submitTask() {
    if (!user) return;
    setBusy(true);
    try {
      const assignee = profiles.find((p) => p.uid === tAssignee);
      await saveTask({
        id: editing?.id,
        committeeId: tCommittee,
        title: tTitle,
        details: tDetails,
        status: tStatus,
        priority: tPriority,
        assigneeUid: tAssignee,
        assigneeName: assignee?.name ?? "",
        dueDate: fromDateInput(tDue),
        requestId: tRequest,
        actor: user,
      });
      toast.showSuccess(editing ? "تم تحديث المهمة" : "تمت إضافة المهمة");
      setCreating(false);
      setEditing(null);
    } catch (e) {
      toast.showError((e as Error).message || "تعذر حفظ المهمة");
    } finally {
      setBusy(false);
    }
  }

  async function submitProgress() {
    if (!progressFor) return;
    setBusy(true);
    try {
      await updateTaskProgress({ taskId: progressFor.id, status: pStatus, details: pDetails });
      toast.showSuccess("تم تحديث التقدم");
      setProgressFor(null);
    } catch (e) {
      toast.showError((e as Error).message || "تعذر التحديث");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteFor) return;
    setBusy(true);
    try {
      await deleteTask(deleteFor.id);
      toast.showSuccess("تم حذف المهمة");
      setDeleteFor(null);
    } catch (e) {
      toast.showError((e as Error).message || "تعذر الحذف");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!user) return;
    setBusy(true);
    try {
      const from = fromDateInput(rFrom);
      const to = fromDateInput(rTo);
      if (!from || !to) throw new Error("حدّد فترة صحيحة للتقرير");
      await createWeeklyReport({
        committeeId: rCommittee,
        title: rTitle,
        body: rBody,
        periodFrom: from,
        periodTo: to,
        actor: user,
      });
      toast.showSuccess("تم إرسال التقرير للإدارة");
      setReportOpen(false);
    } catch (e) {
      toast.showError((e as Error).message || "تعذر إرسال التقرير");
    } finally {
      setBusy(false);
    }
  }

  /* ---- العرض ---- */

  const active = tab === "mine" ? mine.data : tasks.data;
  const state = tab === "mine" ? mine : tasks;
  const visibleTasks = useMemo(() => {
    const list = active.filter((t) => !committeeFilter || t.committeeId === committeeFilter);
    const rank: Record<TaskStatus, number> = { open: 0, in_progress: 1, done: 2, cancelled: 3 };
    return [...list].sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      const pa = TASK_PRIORITIES.indexOf(a.priority);
      const pb = TASK_PRIORITIES.indexOf(b.priority);
      if (pa !== pb) return pb - pa;
      const da = tsToDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = tsToDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }, [active, committeeFilter]);

  const visibleReports = useMemo(() => {
    const list = reports.data.filter((r) => !committeeFilter || r.committeeId === committeeFilter);
    return [...list].sort((a, b) => (tsToDate(b.createdAt)?.getTime() ?? 0) - (tsToDate(a.createdAt)?.getTime() ?? 0));
  }, [reports.data, committeeFilter]);

  const openCount = visibleTasks.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const overdueCount = visibleTasks.filter((t) => isOverdue(t.status, t.dueDate)).length;

  const committeeChips = tab === "reports" ? reportable : manageable.length > 0 ? manageable : myCommitteeIds;

  return (
    <div className="stack">
      <div className="row">
        <h2 className="page-title flex1">المهام والتقارير</h2>
        {tab !== "reports" && manageable.length > 0 ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={openCreate}>
            <IconPlus size={15} /> مهمة
          </button>
        ) : null}
        {tab === "reports" && reportable.length > 0 ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={openReport}>
            <IconPlus size={15} /> تقرير أسبوعي
          </button>
        ) : null}
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${tab === "mine" ? "tab--on" : ""}`} onClick={() => setTab("mine")}>
          <IconUser size={16} />
          <span>مهامي</span>
          {mine.data.length ? <span className="tab__count">{mine.data.length}</span> : null}
        </button>
        <button type="button" className={`tab ${tab === "committees" ? "tab--on" : ""}`} onClick={() => setTab("committees")}>
          <IconTasks size={16} />
          <span>مهام اللجان</span>
        </button>
        <button type="button" className={`tab ${tab === "reports" ? "tab--on" : ""}`} onClick={() => setTab("reports")}>
          <IconReport size={16} />
          <span>التقارير</span>
          {reports.data.length ? <span className="tab__count">{reports.data.length}</span> : null}
        </button>
      </div>

      {tab !== "mine" ? (
        <>
          {canOversight ? (
            <label className="check-row">
              <input type="checkbox" checked={scopeAll} onChange={(e) => setScopeAll(e.target.checked)} />
              عرض كل اللجان (متابعة إدارية)
            </label>
          ) : null}

          {committeeChips.length > 1 && !scopeAll ? (
            <div className="chips">
              <button
                type="button"
                className={`chip ${committeeFilter === "" ? "chip--on" : ""}`}
                onClick={() => setCommitteeFilter("")}
              >
                الكل
              </button>
              {committeeChips.map((cid) => {
                const c = byId.get(cid);
                if (!c) return null;
                return (
                  <button
                    key={cid}
                    type="button"
                    className={`chip ${committeeFilter === cid ? "chip--on" : ""}`}
                    data-cc={committeeFilter === cid ? c.colorKey : undefined}
                    onClick={() => setCommitteeFilter(cid)}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {tab !== "reports" ? (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat__label">مهام معروضة</span>
              <span className="stat__value">{visibleTasks.length}</span>
            </div>
            <div className="stat">
              <span className="stat__label">قيد العمل</span>
              <span className="stat__value">{openCount}</span>
            </div>
            <div className={`stat ${overdueCount > 0 ? "stat--out" : ""}`}>
              <span className="stat__label">متأخرة</span>
              <span className="stat__value">{overdueCount}</span>
            </div>
          </div>

          {state.error ? <p className="error-text">{state.error}</p> : null}
          {state.loading ? <Loading /> : null}
          {!state.loading && visibleTasks.length === 0 ? (
            <EmptyState
              icon={<IconTasks size={30} />}
              title={tab === "mine" ? "لا مهام مكلَّفًا بها" : "لا مهام بعد"}
              sub={
                manageable.length > 0
                  ? "أضف مهمة لتوزيع العمل ومتابعة الإنجاز داخل اللجنة."
                  : "ستظهر هنا المهام التي يكلّفك بها مسؤول اللجنة."
              }
            />
          ) : null}

          {visibleTasks.map((t) => {
            const c = byId.get(t.committeeId);
            const linked = requests.find((r) => r.id === t.requestId);
            const canManage = isSuperAdmin || committeePerm(t.committeeId, "tasks.manage");
            const isMine = !!user && t.assigneeUid === user.uid;
            const overdue = isOverdue(t.status, t.dueDate);
            const due = tsToDate(t.dueDate);
            return (
              <article
                key={t.id}
                className={`task ${t.status === "done" ? "task--done" : ""}`}
                data-cc={c ? c.colorKey : undefined}
              >
                {(canManage || isMine) && t.status !== "cancelled" ? (
                  <button
                    type="button"
                    className="task__check"
                    aria-label={t.status === "done" ? "إعادة فتح المهمة" : "وضع علامة منجز"}
                    onClick={() => {
                      setPStatus(t.status === "done" ? "in_progress" : "done");
                      setPDetails(t.details ?? "");
                      setProgressFor(t);
                    }}
                  >
                    {t.status === "done" ? <IconCheck size={15} /> : null}
                  </button>
                ) : (
                  <span className="task__check" aria-hidden="true">
                    {t.status === "done" ? <IconCheck size={15} /> : null}
                  </span>
                )}

                <div className="task__main">
                  <div className="task__title">{t.title}</div>
                  {t.details ? <div className="task__details">{t.details}</div> : null}
                  <div className="task__meta">
                    <span className={taskStatusBadgeClass(t.status)}>{TASK_STATUS_LABELS[t.status] ?? t.status}</span>
                    <span className={`badge prio prio--${t.priority}`}>
                      <IconFlag size={12} />
                      {TASK_PRIORITY_LABELS[t.priority] ?? t.priority}
                    </span>
                    {c && (tab !== "committees" || scopeAll) ? (
                      <span {...committeeBadgeProps(c.colorKey)}>{c.name}</span>
                    ) : null}
                    {t.assigneeName ? (
                      <span className="badge">
                        <IconUser size={12} />
                        {t.assigneeName}
                      </span>
                    ) : null}
                    {due ? (
                      <span className={`badge ${overdue ? "badge--bad" : ""}`}>
                        {overdue ? <IconAlert size={12} /> : <IconCalendar size={12} />}
                        {overdue ? "متأخرة: " : ""}
                        {formatPlainDate(due)}
                      </span>
                    ) : null}
                    {linked ? (
                      <span className="badge badge--info">
                        <IconTasks size={12} />
                        {requestTypeInfo(linked.type).label}: {linked.title}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="task__side">
                  {canManage ? (
                    <>
                      <button type="button" className="icon-btn" aria-label="تعديل المهمة" onClick={() => openEdit(t)}>
                        <IconPencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="حذف المهمة"
                        onClick={() => setDeleteFor(t)}
                      >
                        <IconTrash size={16} />
                      </button>
                    </>
                  ) : isMine && t.status !== "done" ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => openProgress(t)}>
                      تحديث التقدم
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </>
      ) : (
        <>
          {reports.error ? <p className="error-text">{reports.error}</p> : null}
          {reports.loading ? <Loading /> : null}
          {!reports.loading && visibleReports.length === 0 ? (
            <EmptyState
              icon={<IconReport size={30} />}
              title="لا تقارير بعد"
              sub="اكتب تقرير الإنجازات الأسبوعي ليصل إلى الإدارة مع ما أنجزته اللجنة."
            />
          ) : null}

          {visibleReports.map((r) => {
            const c = byId.get(r.committeeId);
            return (
              <article key={r.id} className="card report" data-cc={c ? c.colorKey : undefined}>
                <div className="report__head">
                  <span className="report__week">{r.title}</span>
                  {c ? <span {...committeeBadgeProps(c.colorKey)}>{c.name}</span> : null}
                  {r.periodFrom && r.periodTo ? (
                    <span className="badge">
                      <IconCalendar size={12} />
                      {formatDate(r.periodFrom)} – {formatDate(r.periodTo)}
                    </span>
                  ) : null}
                </div>
                <div className="report__body">{r.body}</div>
                <div className="report__foot">
                  <span>
                    {r.createdByName} · {formatDateTime(r.createdAt)}
                  </span>
                </div>
              </article>
            );
          })}
        </>
      )}

      {/* محرر المهمة */}
      {creating || editing ? (
        <Modal title={editing ? "تعديل المهمة" : "مهمة جديدة"} onClose={() => { setCreating(false); setEditing(null); }}>
          <div className="col">
            <div className="field">
              <span className="label">اللجنة</span>
              <Select
                value={tCommittee}
                onChange={setTCommittee}
                options={manageable.map((cid) => ({ value: cid, label: byId.get(cid)?.name ?? cid }))}
                disabled={!!editing}
              />
            </div>
            <div className="field">
              <label className="label required" htmlFor="task-title">العنوان</label>
              <input
                id="task-title"
                className="input"
                value={tTitle}
                maxLength={120}
                onChange={(e) => setTTitle(e.target.value)}
                placeholder="مثال: تجهيز كشوف نقاط الحلقة الأسبوعية"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="task-details">التفاصيل وملاحظات التنفيذ</label>
              <textarea
                id="task-details"
                className="input textarea"
                rows={4}
                maxLength={2000}
                value={tDetails}
                onChange={(e) => setTDetails(e.target.value)}
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <span className="label">الحالة</span>
                <Select
                  value={tStatus}
                  onChange={(v) => setTStatus(v as TaskStatus)}
                  options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
                />
              </div>
              <div className="field">
                <span className="label">الأولوية</span>
                <Select
                  value={tPriority}
                  onChange={(v) => setTPriority(v as TaskPriority)}
                  options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
                />
              </div>
            </div>
            <div className="field">
              <span className="label">المكلَّف بالمهمة</span>
              <Select
                value={tAssignee}
                onChange={setTAssignee}
                placeholder="— بدون تكليف —"
                options={assigneeOptions}
              />
              <span className="help-text">
                {assigneeOptions.length === 0 ? "لا أعضاء في هذه اللجنة بعد" : "يرى المكلَّف المهمة في تبويب «مهامي» ويستطيع تحديث تقدمها."}
              </span>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label" htmlFor="task-due">تاريخ التسليم</label>
                <input id="task-due" className="input" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} />
              </div>
              <div className="field">
                <span className="label">مرتبط بطلب</span>
                <Select
                  value={tRequest}
                  onChange={setTRequest}
                  placeholder="— بدون ربط —"
                  size="md"
                  options={requestOptions}
                />
              </div>
            </div>
            <div className="row row--end">
              <button type="button" className="btn" onClick={() => { setCreating(false); setEditing(null); }}>إلغاء</button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void submitTask()}>
                {busy ? "جارٍ الحفظ..." : "حفظ المهمة"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* تحديث التقدم */}
      {progressFor ? (
        <Modal title="تحديث تقدم المهمة" onClose={() => setProgressFor(null)}>
          <div className="col">
            <p className="bold mb-0">{progressFor.title}</p>
            <div className="field">
              <span className="label">الحالة</span>
              <Select
                value={pStatus}
                onChange={(v) => setPStatus(v as TaskStatus)}
                options={TASK_STATUSES.filter((s) =>
                  isSuperAdmin || committeePerm(progressFor.committeeId, "tasks.manage") ? true : s !== "cancelled"
                ).map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="progress-details">ما تم إنجازه</label>
              <textarea
                id="progress-details"
                className="input textarea"
                rows={5}
                maxLength={2000}
                value={pDetails}
                onChange={(e) => setPDetails(e.target.value)}
                placeholder="اكتب ما أنجزته وما تبقّى، وما تحتاجه من لجان أخرى."
              />
            </div>
            <div className="row row--end">
              <button type="button" className="btn" onClick={() => setProgressFor(null)}>إلغاء</button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void submitProgress()}>
                {busy ? "جارٍ الحفظ..." : "حفظ التقدم"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* تقرير أسبوعي */}
      {reportOpen ? (
        <Modal title="تقرير الإنجازات الأسبوعي" onClose={() => setReportOpen(false)}>
          <div className="col">
            <div className="field">
              <span className="label">اللجنة</span>
              <Select
                value={rCommittee}
                onChange={setRCommittee}
                options={reportable.map((cid) => ({ value: cid, label: byId.get(cid)?.name ?? cid }))}
              />
            </div>
            <div className="field">
              <label className="label required" htmlFor="report-title">العنوان</label>
              <input id="report-title" className="input" maxLength={120} value={rTitle} onChange={(e) => setRTitle(e.target.value)} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label required" htmlFor="report-from">من</label>
                <input id="report-from" className="input" type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} />
              </div>
              <div className="field">
                <label className="label required" htmlFor="report-to">إلى</label>
                <input id="report-to" className="input" type="date" value={rTo} onChange={(e) => setRTo(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="label required" htmlFor="report-body">المنجزات والملاحظات</label>
              <textarea
                id="report-body"
                className="input textarea"
                rows={8}
                maxLength={6000}
                value={rBody}
                onChange={(e) => setRBody(e.target.value)}
                placeholder={"• ما أُنجز هذا الأسبوع\n• العقبات\n• ما تحتاجه من لجان أخرى أو من الإدارة"}
              />
              <span className="help-text">يُرسل للإدارة ولا يمكن تعديله بعد الإرسال.</span>
            </div>
            <div className="row row--end">
              <button type="button" className="btn" onClick={() => setReportOpen(false)}>إلغاء</button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void submitReport()}>
                {busy ? "جارٍ الإرسال..." : "إرسال التقرير"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteFor ? (
        <ConfirmModal
          title="حذف المهمة"
          message={`سيتم حذف «${deleteFor.title}» نهائيًا.`}
          confirmLabel="حذف"
          danger
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleteFor(null)}
        />
      ) : null}
    </div>
  );
}
