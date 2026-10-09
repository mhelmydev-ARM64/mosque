import { useAuth } from '../auth/AuthContext';
import { useCommittees, useRoutingRules } from '../../services/hooks';
import { saveRoutingRule } from '../../services/atomicWrites';
import { Loading, EmptyState, useToast } from '../../components/ui';
import { REQUEST_TYPES } from '../../domain/requests';
import { committeeBadgeProps } from '../../domain/colors';
import { IconLock } from '../../components/icons';
import type { RequestType, RoutingRule } from '../../domain/models';

export default function RoutingAdminPage() {
  const { isAdmin, hasGlobal } = useAuth();
  const toast = useToast();
  const { byType, loading, error } = useRoutingRules();
  const { committees } = useCommittees();
  const canManage = hasGlobal('committees.manage');

  const types = REQUEST_TYPES.filter((t) => !t.manual);
  const active = committees.filter((c) => c.status === 'active');

  async function setRule(type: RequestType, mode: RoutingRule['mode'], committeeId: string | null) {
    if (mode === 'fixed' && !committeeId) {
      toast.showError('اختر لجنة الوجهة');
      return;
    }
    try {
      await saveRoutingRule({ type, mode, committeeId: mode === 'fixed' ? committeeId : null });
      toast.showSuccess('تم حفظ قاعدة التوجيه');
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر الحفظ');
    }
  }

  if (!isAdmin) return <EmptyState icon={<IconLock size={34} />} title="للإدارة فقط" />;

  return (
    <div className="stack">
      <h2 className="page-title">قواعد توجيه الطلبات</h2>
      <p className="muted small">
        «وجهة ثابتة» تُرسل الطلبات تلقائيًا إلى لجنة محددة. «اختيار المرسل» يتيح للجنة المرسلة اختيار أي لجنة أخرى.
      </p>

      {loading && <Loading />}
      {error && <p className="error-text">{error}</p>}

      {types.map((t) => {
        const rule = byType.get(t.key);
        return (
          <div key={t.key} className="card">
            <div className="row row--nowrap" style={{ alignItems: 'baseline' }}>
              <strong>{t.label}</strong>
              {t.financial && <span className="badge badge--warn">مالي</span>}
              <span className="flex1" />
              <span className="tiny muted">{rule ? 'مضبوط' : 'بدون قاعدة (اختيار المرسل)'}</span>
            </div>

            <div className="chips" style={{ marginTop: 8 }}>
              <button
                className={`chip ${(!rule || rule.mode === 'sender_choice') ? 'chip--on' : ''}`}
                disabled={!canManage}
                onClick={() => void setRule(t.key, 'sender_choice', null)}
              >
                اختيار المرسل
              </button>
              <button
                className={`chip ${rule?.mode === 'fixed' ? 'chip--on' : ''}`}
                disabled={!canManage}
                onClick={() => void setRule(t.key, 'fixed', rule?.committeeId ?? active[0]?.id ?? null)}
              >
                وجهة ثابتة
              </button>
            </div>

            {rule?.mode === 'fixed' && (
              <div className="field" style={{ marginTop: 8 }}>
                <span className="label">لجنة الوجهة</span>
                <div className="chips">
                  {active.map((c) => (
                    <button
                      key={c.id}
                      className={`chip ${rule.committeeId === c.id ? 'chip--on' : ''}`}
                      disabled={!canManage}
                      onClick={() => void setRule(t.key, 'fixed', c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {rule.committeeId && (
                  <p className="help-text">
                    الوجهة الحالية:{' '}
                    {(() => {
                      const c = committees.find((x) => x.id === rule.committeeId);
                      return c ? <span {...committeeBadgeProps(c.colorKey)}>{c.name}</span> : 'لجنة محذوفة';
                    })()}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
