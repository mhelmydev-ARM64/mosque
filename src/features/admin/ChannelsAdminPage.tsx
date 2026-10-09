import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCommittees, useVisibleChannels } from '../../services/hooks';
import { archiveChannel, saveChannel } from '../../services/atomicWrites';
import { Loading, EmptyState, Modal, useToast } from '../../components/ui';
import { committeeBadgeProps } from '../../domain/colors';
import { IconChat, IconLock, IconMegaphone, IconPlus } from '../../components/icons';
import type { Channel } from '../../domain/models';

export default function ChannelsAdminPage() {
  const { user, isAdmin, hasGlobal } = useAuth();
  const toast = useToast();
  const { data: channels, loading, error } = useVisibleChannels(user);
  const { committees } = useCommittees();
  const canManage = hasGlobal('committees.manage');

  const [editing, setEditing] = useState<Channel | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<Channel['type']>('announcements');
  const [audience, setAudience] = useState<Channel['audience']>('allApproved');
  const [committeeIds, setCommitteeIds] = useState<string[]>([]);

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function openCreate() {
    setName('');
    setType('announcements');
    setAudience('allApproved');
    setCommitteeIds([]);
    setCreating(true);
  }

  function openEdit(c: Channel) {
    setName(c.name);
    setType(c.type);
    setAudience(c.audience);
    setCommitteeIds(c.committeeIds ?? []);
    setEditing(c);
  }

  async function save() {
    if (!user) return;
    if (name.trim().length < 2) {
      toast.showError('اسم القناة قصير');
      return;
    }
    if (audience === 'committees' && committeeIds.length === 0) {
      toast.showError('اختر لجنة واحدة على الأقل لهذا الجمهور');
      return;
    }
    setBusy(true);
    try {
      await saveChannel({
        id: editing?.id,
        name,
        type,
        audience,
        committeeIds: audience === 'committees' ? committeeIds : [],
        actor: user,
      });
      toast.showSuccess(editing ? 'تم تحديث القناة' : 'تمت إضافة القناة');
      setCreating(false);
      setEditing(null);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر الحفظ');
    }
    setBusy(false);
  }

  async function toggleArchive(c: Channel) {
    try {
      await archiveChannel(c.id, c.status === 'active');
      toast.showSuccess(c.status === 'active' ? 'تم تعطيل القناة' : 'تم تنشيط القناة');
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر التنفيذ');
    }
  }

  if (!isAdmin) return <EmptyState icon={<IconLock size={34} />} title="للإدارة فقط" />;

  return (
    <div className="stack">
      <div className="row">
        <h2 className="page-title flex1">القنوات ({channels.length})</h2>
        {canManage && (
          <button className="btn btn--primary btn--sm" onClick={openCreate}>
            <IconPlus size={15} />قناة جديدة
          </button>
        )}
      </div>

      {loading && <Loading />}
      {error && <p className="error-text">{error}</p>}
      {!loading && channels.length === 0 && <EmptyState icon={<IconChat size={34} />} title="لا قنوات بعد" sub="أنشئ قناة إعلانات عامة أو مجموعات دردشة للجان." />}

      {channels.map((c) => (
        <div key={c.id} className="card">
          <div className="row row--nowrap" style={{ alignItems: 'baseline' }}>
            <strong className="flex1 ellipsis">{c.name}</strong>
            <span className={`badge ${c.type === 'announcements' ? 'badge--info' : ''}`}>
              {c.type === 'announcements' ? 'إعلانات' : 'دردشة'}
            </span>
            {c.status === 'archived' && <span className="badge badge--bad">معطّلة</span>}
          </div>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {c.audience === 'allApproved' ? 'كل المقبولين' : 'لجان محددة:'}
          </div>
          {c.audience === 'committees' && (
            <div className="chips" style={{ marginTop: 4 }}>
              {(c.committeeIds ?? []).map((cid) => {
                const cm = committees.find((x) => x.id === cid);
                return cm ? (
                  <span key={cid} {...committeeBadgeProps(cm.colorKey)}>{cm.name}</span>
                ) : null;
              })}
            </div>
          )}
          {canManage && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => openEdit(c)}>تعديل</button>
              <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void toggleArchive(c)}>
                {c.status === 'active' ? 'تعطيل' : 'تنشيط'}
              </button>
            </div>
          )}
        </div>
      ))}

      {creating || editing ? (
        <Modal title={editing ? 'تعديل القناة' : 'قناة جديدة'} onClose={() => { setCreating(false); setEditing(null); }}>
          <div className="col" style={{ gap: 10 }}>
            <div className="field">
              <label className="label" htmlFor="ch-name">اسم القناة <span className="required">*</span></label>
              <input id="ch-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>

            <div>
              <span className="label">النوع</span>
              <div className="chips">
                <button className={`chip ${type === 'announcements' ? 'chip--on' : ''}`} onClick={() => setType('announcements')}>
                  <IconMegaphone size={14} />إعلانات (النشر للإدارة فقط)
                </button>
                <button className={`chip ${type === 'discussion' ? 'chip--on' : ''}`} onClick={() => setType('discussion')}>
                  <IconChat size={14} />دردشة
                </button>
              </div>
            </div>

            <div>
              <span className="label">الجمهور</span>
              <div className="chips">
                <button className={`chip ${audience === 'allApproved' ? 'chip--on' : ''}`} onClick={() => setAudience('allApproved')}>
                  كل المقبولين
                </button>
                <button className={`chip ${audience === 'committees' ? 'chip--on' : ''}`} onClick={() => setAudience('committees')}>
                  لجان محددة
                </button>
              </div>
            </div>

            {audience === 'committees' && (
              <div>
                <span className="label">اللجان المشاركة <span className="required">*</span></span>
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
                <p className="help-text">يرى أعضاء هذه اللجان القناة فقط، وينشرون فيها في قنوات الدردشة.</p>
              </div>
            )}

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => { setCreating(false); setEditing(null); }}>إلغاء</button>
              <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
