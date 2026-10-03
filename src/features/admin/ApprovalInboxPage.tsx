import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useApprovalInbox, useCommittees } from '../../services/hooks';
import { resolveApproval, type ApprovalDecision } from '../../services/atomicWrites';
import { Loading, EmptyState, Modal, useToast } from '../../components/ui';
import { GLOBAL_PERMISSIONS } from '../../domain/permissions';
import type { AdminApprovalMessage, GlobalRole } from '../../domain/models';

export default function ApprovalInboxPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data: inbox, loading, error } = useApprovalInbox();
  const { committees } = useCommittees();

  const [reviewTarget, setReviewTarget] = useState<AdminApprovalMessage | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminApprovalMessage | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [role, setRole] = useState<GlobalRole>('member');
  const [perms, setPerms] = useState<string[]>([]);
  const [committeeIds, setCommitteeIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function openApprove(m: AdminApprovalMessage) {
    setRole('member');
    setPerms([]);
    setCommitteeIds([]);
    setReviewTarget(m);
  }

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function decide(m: AdminApprovalMessage, decision: ApprovalDecision, reason?: string) {
    if (!user) return;
    setBusy(true);
    try {
      await resolveApproval({
        message: m,
        decision,
        actor: user,
        role,
        globalPermissions: perms,
        committeeIds,
        reason,
      });
      toast.showSuccess(decision === 'reject' ? 'تم رفض الحساب' : 'تم قبول الحساب');
      setReviewTarget(null);
      setRejectTarget(null);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر تنفيذ القرار');
    }
    setBusy(false);
  }

  if (!user) return null;

  return (
    <div className="stack">
      {loading && <Loading />}
      {error && <p className="error-text">{error}</p>}
      {!loading && inbox.length === 0 && (
        <EmptyState icon="✅" title="لا طلبات حسابات معلقة" sub="ستظهر هنا رسالة فور تسجيل أي حساب جديد." />
      )}

      {inbox.map((m) => (
        <div key={m.uid} className="card">
          <div className="row row--nowrap" style={{ alignItems: 'baseline' }}>
            <strong className="flex1 ellipsis">{m.name}</strong>
            <span className={`badge ${m.status === 'open' ? 'badge--info' : 'badge--warn'}`}>
              {m.status === 'open' ? 'جديد' : 'قيد المراجعة'}
            </span>
          </div>
          <div className="kv"><span className="kv__k">الهاتف</span><span className="sw">{m.phone}</span></div>
          {m.createdAt && (
            <div className="kv">
              <span className="kv__k">وقت التسجيل</span>
              <span>{new Date(m.createdAt.toMillis()).toLocaleString('ar-SY', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn--ghost btn--sm" onClick={() => void decide(m, 'under_review')} disabled={busy}>
              قيد المراجعة
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => openApprove(m)} disabled={busy}>
              قبول
            </button>
            <button className="btn btn--danger btn--sm" onClick={() => { setRejectReason(''); setRejectTarget(m); }} disabled={busy}>
              رفض
            </button>
          </div>
        </div>
      ))}

      {reviewTarget ? (
      <Modal title={`قبول حساب: ${reviewTarget.name}`} onClose={() => setReviewTarget(null)}>
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
                    <input type="checkbox" checked={perms.includes(p.key)} onChange={() => setPerms(toggle(perms, p.key))} />
                    {p.label}
                  </label>
                ))}
              </div>
              <p className="help-text">المدير يحتاج صلاحية عالمية واحدة على الأقل.</p>
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
              {committees.length === 0 && <span className="muted small">لا لجان بعد — يمكنك القبول بدون لجان.</span>}
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost" onClick={() => setReviewTarget(null)}>إلغاء</button>
            <button
              className="btn btn--primary"
              disabled={busy || (role === 'admin' && perms.length === 0)}
              onClick={() => void decide(reviewTarget, 'approve')}
            >
              {busy ? 'جارٍ الحفظ…' : 'تأكيد القبول'}
            </button>
          </div>
        </div>
      </Modal>
      ) : null}

      {rejectTarget ? (
      <Modal
        title={`رفض حساب: ${rejectTarget.name}`}
        onClose={() => setRejectTarget(null)}
        footer={
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost" onClick={() => setRejectTarget(null)}>إلغاء</button>
            <button
              className="btn btn--danger"
              disabled={busy || rejectReason.trim().length < 3}
              onClick={() => void decide(rejectTarget, 'reject', rejectReason)}
            >
              {busy ? 'جارٍ التنفيذ…' : 'رفض الحساب'}
            </button>
          </div>
        }
      >
        <div className="field">
          <label className="label" htmlFor="rej-reason">سبب الرفض <span className="required">*</span></label>
          <textarea
            id="rej-reason"
            className="textarea"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="يظهر السبب للمستخدم في صفحة حالته (3 أحرف على الأقل)"
          />
        </div>
      </Modal>
      ) : null}
    </div>
  );
}

