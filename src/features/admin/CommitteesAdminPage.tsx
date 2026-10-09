import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCommittees, useMembers, useProfiles } from '../../services/hooks';
import { saveCommittee, saveMembership } from '../../services/atomicWrites';
import { Loading, EmptyState, Modal, useToast } from '../../components/ui';
import { COMMITTEE_PERMISSIONS, type CommitteePermission } from '../../domain/permissions';
import { COMMITTEE_COLORS, COLOR_LABELS, committeeBadgeProps, committeeBorderProps } from '../../domain/colors';
import { IconCommittee, IconLock, IconPlus } from '../../components/icons';
import type { Committee, CommitteeMembership } from '../../domain/models';

export default function CommitteesAdminPage() {
  const { user, isAdmin, hasGlobal } = useAuth();
  const toast = useToast();
  const { committees, loading, error } = useCommittees();
  const { data: profiles } = useProfiles();
  const canManage = hasGlobal('committees.manage');

  const [editing, setEditing] = useState<Committee | null>(null);
  const [creating, setCreating] = useState(false);
  const [membersOf, setMembersOf] = useState<Committee | null>(null);

  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<string>('emerald');
  const [teamWide, setTeamWide] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.uid, p.name);
    return map;
  }, [profiles]);

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function openCreate() {
    setName('');
    setColorKey(COMMITTEE_COLORS[committees.length % COMMITTEE_COLORS.length]);
    setTeamWide([]);
    setCreating(true);
  }

  function openEdit(c: Committee) {
    setName(c.name);
    setColorKey(c.colorKey);
    setTeamWide(c.teamWidePermissions ?? []);
    setEditing(c);
  }

  async function save() {
    if (!user) return;
    if (name.trim().length < 2) {
      toast.showError('اسم اللجنة قصير');
      return;
    }
    setBusy(true);
    try {
      await saveCommittee(
        editing
          ? { id: editing.id, name, colorKey, status: editing.status, teamWidePermissions: teamWide }
          : { name, colorKey, teamWidePermissions: teamWide },
        user
      );
      toast.showSuccess(editing ? 'تم تحديث اللجنة' : 'تمت إضافة اللجنة');
      setCreating(false);
      setEditing(null);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر الحفظ');
    }
    setBusy(false);
  }

  if (!isAdmin) return <EmptyState icon={<IconLock size={34} />} title="للإدارة فقط" />;

  return (
    <div className="stack">
      <div className="row">
        <h2 className="page-title flex1">اللجان ({committees.length})</h2>
        {canManage && (
          <button className="btn btn--primary btn--sm" onClick={openCreate}>
            <IconPlus size={15} />لجنة جديدة
          </button>
        )}
      </div>

      {loading && <Loading />}
      {error && <p className="error-text">{error}</p>}
      {!loading && committees.length === 0 && <EmptyState icon={<IconCommittee size={34} />} title="لا لجان بعد" sub="أنشئ أول لجنة واختر لونها." />}

      {[...committees].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((c) => (
        <div key={c.id} {...committeeBorderProps(c.colorKey)}>
          <div className="row row--nowrap" style={{ alignItems: 'baseline' }}>
            <span {...committeeBadgeProps(c.colorKey)}>{c.name}</span>
            {c.status === 'archived' && <span className="badge">معطّلة</span>}
            <span className="flex1" />
            <span className="tiny muted">{(c.teamWidePermissions ?? []).length} صلاحية عامة</span>
          </div>
          {canManage && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => openEdit(c)}>تعديل</button>
              <button className="btn btn--ghost btn--sm" onClick={() => setMembersOf(c)}>الأعضاء</button>
            </div>
          )}
        </div>
      ))}

      {(creating || editing) ? (
        <Modal title={editing ? `تعديل اللجنة` : 'لجنة جديدة'} onClose={() => { setCreating(false); setEditing(null); }}>
          <div className="col" style={{ gap: 10 }}>
            <div className="field">
              <label className="label" htmlFor="c-name">اسم اللجنة <span className="required">*</span></label>
              <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>

            <div>
              <span className="label">لون اللجنة <span className="required">*</span></span>
              <div className="chips">
                {COMMITTEE_COLORS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`swatch ${colorKey === k ? 'swatch--on' : ''}`}
                    data-cc={k}
                    title={COLOR_LABELS[k]}
                    aria-label={COLOR_LABELS[k]}
                    onClick={() => setColorKey(k)}
                  />
                ))}
              </div>
              <p className="help-text">يظهر اللون في شارات اللجنة وحدود البطاقات فقط.</p>
            </div>

            <div>
              <span className="label">صلاحيات عامة لكل أعضاء اللجنة</span>
              <div className="perms-grid">
                {COMMITTEE_PERMISSIONS.map((p) => (
                  <label key={p.key} className="check-row">
                    <input type="checkbox" checked={teamWide.includes(p.key)} onChange={() => setTeamWide(toggle(teamWide, p.key))} />
                    {p.label}
                  </label>
                ))}
              </div>
              <p className="help-text">يمكن منح أو منع صلاحيات فردية لكل عضو من شاشة الأعضاء.</p>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => { setCreating(false); setEditing(null); }}>إلغاء</button>
              <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {membersOf ? (
        <MembersModal
          committee={membersOf}
          profileNames={profileNames}
          onClose={() => setMembersOf(null)}
        />
      ) : null}
    </div>
  );
}

function MembersModal({
  committee,
  profileNames,
  onClose,
}: {
  committee: Committee;
  profileNames: Map<string, string>;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: members, loading } = useMembers(committee.id);
  const [editing, setEditing] = useState<CommitteeMembership | null>(null);
  const [busy, setBusy] = useState(false);

  const [role, setRole] = useState<CommitteeMembership['role']>('member');
  const [grants, setGrants] = useState<string[]>([]);
  const [denies, setDenies] = useState<string[]>([]);

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function openEdit(m: CommitteeMembership) {
    setRole(m.role);
    setGrants(m.grants ?? []);
    setDenies(m.denies ?? []);
    setEditing(m);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await saveMembership({
        committeeId: committee.id,
        member: { ...editing, role, grants, denies },
        removeFromUserDoc: false,
      });
      toast.showSuccess('تم حفظ العضوية');
      setEditing(null);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر الحفظ');
    }
    setBusy(false);
  }

  async function remove(m: CommitteeMembership) {
    setBusy(true);
    try {
      await saveMembership({ committeeId: committee.id, member: m, removeFromUserDoc: true });
      toast.showSuccess('تمت إزالة العضو');
      setEditing(null);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر التنفيذ');
    }
    setBusy(false);
  }

  const sorted = useMemo(() => [...members].sort((a, b) => (profileNames.get(a.uid) ?? '').localeCompare(profileNames.get(b.uid) ?? '', 'ar')), [members, profileNames]);

  return (
    <Modal title={`أعضاء: ${committee.name}`} onClose={onClose}>
      <div className="stack">
        {loading && <Loading />}
        {!loading && sorted.length === 0 && <p className="muted small">لا أعضاء. تُضاف العضوية تلقائيًا عند تعيين مستخدم لهذه اللجنة.</p>}
        {sorted.map((m) => (
          <div key={m.uid} className="card">
            <div className="row row--nowrap" style={{ alignItems: 'baseline' }}>
              <strong className="flex1 ellipsis">{profileNames.get(m.uid) ?? m.uid}</strong>
              <span className={`badge ${m.role === 'manager' ? 'badge--info' : ''}`}>
                {m.role === 'manager' ? 'مدير لجنة' : 'عضو'}
              </span>
            </div>
            <div className="tiny muted">
              منح: {m.grants?.length ?? 0} · منع: {m.denies?.length ?? 0}
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => openEdit(m)}>تعديل الصلاحيات</button>
              <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => void remove(m)}>إزالة</button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <Modal
          title={`صلاحيات: ${profileNames.get(editing.uid) ?? editing.uid}`}
          onClose={() => setEditing(null)}
          footer={
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => setEditing(null)}>إلغاء</button>
              <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </div>
          }
        >
          <div className="col" style={{ gap: 10 }}>
            <div>
              <span className="label">الدور داخل اللجنة</span>
              <div className="chips">
                <button className={`chip ${role === 'member' ? 'chip--on' : ''}`} onClick={() => setRole('member')}>عضو</button>
                <button className={`chip ${role === 'manager' ? 'chip--on' : ''}`} onClick={() => setRole('manager')}>مدير لجنة</button>
              </div>
            </div>

            <div>
              <span className="label">منح فردي</span>
              <div className="perms-grid">
                {COMMITTEE_PERMISSIONS.map((p) => (
                  <label key={p.key} className="check-row">
                    <input
                      type="checkbox"
                      checked={grants.includes(p.key)}
                      onChange={() => setGrants(toggle(grants, p.key as CommitteePermission))}
                      disabled={denies.includes(p.key)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="label">منع فردي (يتجاوز المنح ومنحة اللجنة)</span>
              <div className="perms-grid">
                {COMMITTEE_PERMISSIONS.map((p) => (
                  <label key={p.key} className="check-row">
                    <input
                      type="checkbox"
                      checked={denies.includes(p.key)}
                      onChange={() => setDenies(toggle(denies, p.key as CommitteePermission))}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </Modal>
  );
}
