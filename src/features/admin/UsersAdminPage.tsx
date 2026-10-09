import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAllUsers, useCommittees } from '../../services/hooks';
import { reinstateUser, suspendUser, updateUserAssignment } from '../../services/atomicWrites';
import { Loading, EmptyState, ConfirmModal, Modal, useToast } from '../../components/ui';
import { GLOBAL_PERMISSIONS } from '../../domain/permissions';
import { USER_STATUS_LABELS } from '../../domain/requests';
import { committeeBadgeProps } from '../../domain/colors';
import { IconBan, IconLock, IconPencil, IconSearch, IconUndo, IconUsers, IconX } from '../../components/icons';
import type { AppUser, CommitteeMembership, GlobalRole } from '../../domain/models';

function statusTone(status: string): string {
  if (status === 'approved') return 'badge--ok';
  if (status === 'rejected' || status === 'suspended') return 'badge--bad';
  if (status === 'pending' || status === 'under_review') return 'badge--warn';
  return '';
}

export default function UsersAdminPage() {
  const { user: me, isAdmin, hasGlobal } = useAuth();
  const toast = useToast();
  const { data: users, loading, error } = useAllUsers();
  const { committees, byId } = useCommittees();

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [suspending, setSuspending] = useState<AppUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [reinstating, setReinstating] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);

  const [role, setRole] = useState<GlobalRole>('member');
  const [perms, setPerms] = useState<string[]>([]);
  const [committeeIds, setCommitteeIds] = useState<string[]>([]);
  const [memberships, setMemberships] = useState<Record<string, CommitteeMembership>>({});
  const [reason, setReason] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim();
    const list = [...users].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ar'));
    if (!needle) return list;
    return list.filter((u) => u.name.includes(needle) || u.phone.includes(needle));
  }, [users, q]);

  const manageable = (u: AppUser) => u.uid !== me?.uid && u.role !== 'superAdmin';

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function openEdit(u: AppUser) {
    setRole(u.role);
    setPerms(u.globalPermissions ?? []);
    setCommitteeIds(u.committeeIds ?? []);
    setMemberships({});
    setReason('');
    setEditing(u);
  }

  const pendingAdditions = editing
    ? committeeIds.filter((id) => !(editing.committeeIds ?? []).includes(id))
    : [];

  async function saveEdit() {
    if (!editing || !me) return;
    setBusy(true);
    try {
      await updateUserAssignment({
        targetUid: editing.uid,
        role,
        globalPermissions: perms,
        nextCommitteeIds: committeeIds,
        memberships,
        actor: me,
        reason,
      });
      toast.showSuccess('تم حفظ التعديلات');
      setEditing(null);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر الحفظ');
    }
    setBusy(false);
  }

  async function doSuspend() {
    if (!suspending || !me) return;
    if (suspendReason.trim().length < 3) {
      toast.showError('سبب التعليق مطلوب');
      return;
    }
    setBusy(true);
    try {
      await suspendUser(suspending.uid, suspendReason, me);
      toast.showSuccess('تم تعليق الحساب');
      setSuspending(null);
      setSuspendReason('');
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر التنفيذ');
    }
    setBusy(false);
  }

  async function doReinstate() {
    if (!reinstating || !me) return;
    setBusy(true);
    try {
      await reinstateUser(reinstating.uid, me);
      toast.showSuccess('تم إلغاء التعليق وعاد الحساب مقبولًا');
      setReinstating(null);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر التنفيذ');
    }
    setBusy(false);
  }

  if (!isAdmin) return <EmptyState icon={<IconLock size={34} />} title="للإدارة فقط" />;

  return (
    <div className="stack">
      <div className="search-field">
        <IconSearch size={16} />
        <input
          className="search-field__input"
          type="search"
          placeholder="بحث بالاسم أو الهاتف…"
          aria-label="بحث في المستخدمين"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <button type="button" className="search-field__clear" aria-label="مسح البحث" onClick={() => setQ('')}>
            <IconX size={14} />
          </button>
        ) : null}
      </div>

      {loading && <Loading />}
      {error && <p className="error-text">{error}</p>}
      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={q ? <IconSearch size={34} /> : <IconUsers size={34} />}
          title={q ? 'لا نتائج مطابقة' : 'لا مستخدمين'}
          sub={q ? 'جرّب اسمًا أو رقمًا آخر' : undefined}
        />
      )}

      {filtered.map((u) => (
        <div key={u.uid} className="card">
          <div className="row row--nowrap" style={{ alignItems: 'baseline' }}>
            <strong className="flex1 ellipsis">{u.name}</strong>
            <span className={`badge ${statusTone(u.status)}`}>{USER_STATUS_LABELS[u.status] ?? u.status}</span>
          </div>
          <div className="kv"><span className="kv__k">الهاتف</span><span className="sw">{u.phone}</span></div>
          <div className="kv"><span className="kv__k">الدور</span><span>{u.role === 'superAdmin' ? 'مدير عام' : u.role === 'admin' ? 'مدير' : 'عضو'}</span></div>
          {(u.committeeIds ?? []).length > 0 && (
            <div className="chips" style={{ marginTop: 4 }}>
              {u.committeeIds.map((cid) => {
                const c = byId.get(cid);
                return c ? (
                  <span key={cid} {...committeeBadgeProps(c.colorKey)}>{c.name}</span>
                ) : null;
              })}
            </div>
          )}
          {u.status === 'rejected' && u.decisionReason && (
            <div className="kv"><span className="kv__k">سبب الرفض</span><span>{u.decisionReason}</span></div>
          )}
          {u.status === 'suspended' && u.decisionReason && (
            <div className="kv"><span className="kv__k">سبب التعليق</span><span>{u.decisionReason}</span></div>
          )}
          {manageable(u) ? (
            <div className="row" style={{ marginTop: 8 }}>
              {hasGlobal('users.managePermissions') && (
                <button className="btn btn--ghost btn--sm" onClick={() => openEdit(u)}>
                  <IconPencil size={15} />تعديل الدور واللجان
                </button>
              )}
              {hasGlobal('users.review') && u.status === 'approved' && (
                <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => { setSuspendReason(''); setSuspending(u); }}>
                  <IconBan size={15} />تعليق
                </button>
              )}
              {hasGlobal('users.review') && u.status === 'suspended' && (
                <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setReinstating(u)}>
                  <IconUndo size={15} />إلغاء التعليق
                </button>
              )}
            </div>
          ) : u.role === 'superAdmin' && u.uid !== me?.uid ? (
            <p className="tiny faint mt-1">حساب المدير العام يُدار يدويًا من Firebase Console فقط.</p>
          ) : null}
        </div>
      ))}

      {editing ? (
        <Modal title={`تعديل: ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="col" style={{ gap: 10 }}>
            <div>
              <span className="label">الدور</span>
              <div className="chips">
                <button className={`chip ${role === 'member' ? 'chip--on' : ''}`} onClick={() => { setRole('member'); setPerms([]); }}>عضو</button>
                <button className={`chip ${role === 'admin' ? 'chip--on' : ''}`} onClick={() => setRole('admin')}>مدير</button>
              </div>
              <p className="help-text">ترقية إلى «مدير عام» تتم يدويًا من Firebase Console فقط.</p>
            </div>

            {role === 'admin' && (
              <div>
                <span className="label">الصلاحيات العالمية <span className="required">*</span></span>
                <div className="perms-grid">
                  {GLOBAL_PERMISSIONS.map((p) => (
                    <label key={p.key} className="check-row">
                      <input
                        type="checkbox"
                        checked={perms.includes(p.key)}
                        onChange={() => setPerms(toggle(perms, p.key))}
                        disabled={editing.role === 'superAdmin'}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="label">اللجان</span>
              <div className="chips">
                {committees.filter((c) => c.status === 'active').map((c) => (
                  <button
                    key={c.id}
                    className={`chip ${committeeIds.includes(c.id) ? 'chip--on' : ''}`}
                    onClick={() => setCommitteeIds(toggle(committeeIds, c.id))}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="help-text">إزالة اللجنة تحذف عضويتها، والإضافة تنشئ عضوية أساسية. المنح والمنع الفردي يُدار من صفحة اللجان.</p>
            </div>

            {pendingAdditions.length > 0 && (
              <div className="field">
                <label className="label" htmlFor="assign-reason">سبب إدخال العضو في لجنة جديدة <span className="required">*</span></label>
                <textarea
                  id="assign-reason"
                  className="textarea"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: تكليفه بمتابعة ملف الطلاب في اللجنة"
                />
                <p className="help-text">يُسجَّل السبب في الأثر الأمني مع أسماء اللجان المضافة.</p>
              </div>
            )}

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => setEditing(null)}>إلغاء</button>
              <button
                className="btn btn--primary"
                disabled={busy || (role === 'admin' && perms.length === 0) || (pendingAdditions.length > 0 && reason.trim().length < 3)}
                onClick={() => void saveEdit()}
              >
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {reinstating ? (
        <ConfirmModal
          title={`إلغاء تعليق: ${reinstating.name}`}
          message="سيعود الحساب إلى حالة «مقبول» ويستطيع الدخول والعمل من جديد."
          confirmLabel="إلغاء التعليق"
          busy={busy}
          onConfirm={() => void doReinstate()}
          onClose={() => setReinstating(null)}
        />
      ) : null}

      {suspending ? (
        <Modal
          title={`تعليق حساب: ${suspending.name}`}
          onClose={() => setSuspending(null)}
          footer={
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => setSuspending(null)}>إلغاء</button>
              <button className="btn btn--danger" disabled={busy} onClick={() => void doSuspend()}>
                {busy ? 'جارٍ التنفيذ…' : 'تعليق'}
              </button>
            </div>
          }
        >
          <div className="field">
            <label className="label" htmlFor="susp-reason">سبب التعليق <span className="required">*</span></label>
            <textarea
              id="susp-reason"
              className="textarea"
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
