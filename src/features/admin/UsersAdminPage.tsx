import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAllUsers, useCommittees } from '../../services/hooks';
import { suspendUser, updateUserAssignment } from '../../services/atomicWrites';
import { Loading, EmptyState, Modal, useToast } from '../../components/ui';
import { GLOBAL_PERMISSIONS } from '../../domain/permissions';
import { USER_STATUS_LABELS } from '../../domain/requests';
import { committeeBadgeProps } from '../../domain/colors';
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
  const [busy, setBusy] = useState(false);

  const [role, setRole] = useState<GlobalRole>('member');
  const [perms, setPerms] = useState<string[]>([]);
  const [committeeIds, setCommitteeIds] = useState<string[]>([]);
  const [memberships, setMemberships] = useState<Record<string, CommitteeMembership>>({});

  const filtered = useMemo(() => {
    const needle = q.trim();
    const list = [...users].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ar'));
    if (!needle) return list;
    return list.filter((u) => u.name.includes(needle) || u.phone.includes(needle));
  }, [users, q]);

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function openEdit(u: AppUser) {
    setRole(u.role);
    setPerms(u.globalPermissions ?? []);
    setCommitteeIds(u.committeeIds ?? []);
    setMemberships({});
    setEditing(u);
  }

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

  if (!isAdmin) return <EmptyState icon="🔒" title="للإدارة فقط" />;

  return (
    <div className="stack">
      <div className="field">
        <input className="input" placeholder="بحث بالاسم أو الهاتف…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading && <Loading />}
      {error && <p className="error-text">{error}</p>}
      {!loading && filtered.length === 0 && <EmptyState icon="👥" title="لا مستخدمين" />}

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
          <div className="row" style={{ marginTop: 8 }}>
            {hasGlobal('users.managePermissions') && u.uid !== me?.uid && (
              <button className="btn btn--ghost btn--sm" onClick={() => openEdit(u)}>تعديل الدور واللجان</button>
            )}
            {hasGlobal('users.review') && u.uid !== me?.uid && u.status === 'approved' && (
              <button className="btn btn--danger btn--sm" onClick={() => { setSuspendReason(''); setSuspending(u); }}>تعليق</button>
            )}
          </div>
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

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => setEditing(null)}>إلغاء</button>
              <button
                className="btn btn--primary"
                disabled={busy || (role === 'admin' && perms.length === 0)}
                onClick={() => void saveEdit()}
              >
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </div>
          </div>
        </Modal>
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
