import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTemplate } from '../../services/hooks';
import { saveTemplate } from '../../services/atomicWrites';
import { Loading, EmptyState, Modal, useToast } from '../../components/ui';
import { fieldKeyFor } from '../../domain/template';
import type { FieldType, StudentTemplate, TemplateField } from '../../domain/models';

const FIELD_TYPES: Array<{ key: FieldType; label: string }> = [
  { key: 'text', label: 'نص' },
  { key: 'number', label: 'رقم' },
  { key: 'date', label: 'تاريخ' },
  { key: 'select', label: 'اختيار مفرد' },
  { key: 'multiselect', label: 'اختيار متعدد' },
  { key: 'boolean', label: 'نعم/لا' },
];

function blankField(existingKeys: string[]): TemplateField {
  return { key: fieldKeyFor('f', existingKeys), label: '', type: 'text', required: false, searchable: false };
}

export default function TemplateEditorPage() {
  const { isAdmin, hasGlobal } = useAuth();
  const toast = useToast();
  const { data: template, loading } = useTemplate();
  const [fields, setFields] = useState<TemplateField[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canManage = hasGlobal('templates.manage');
  const current: TemplateField[] = fields ?? template?.fields ?? [];

  function update(idx: number, patch: Partial<TemplateField>) {
    setFields(current.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...current];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setFields(next);
  }

  function removeField(idx: number) {
    setFields(current.filter((_, i) => i !== idx));
  }

  function validate(): string | null {
    for (const f of current) {
      if (f.label.trim().length < 2) return `حقل بدون عنوان واضح: «${f.label || f.key}»`;
      if ((f.type === 'select' || f.type === 'multiselect') && (!f.options || f.options.length === 0))
        return `الحقل «${f.label}» يحتاج خيارات واحدة على الأقل`;
    }
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) {
      toast.showError(problem);
      return;
    }
    if (!template) return;
    setBusy(true);
    try {
      const clean: StudentTemplate = {
        ...template,
        fields: current.map((f) => ({
          ...f,
          label: f.label.trim(),
          options: f.type === 'select' || f.type === 'multiselect' ? f.options : undefined,
        })),
      };
      await saveTemplate(clean);
      toast.showSuccess(`تم حفظ القالب (إصدار ${(template.version ?? 0) + 1})`);
      setFields(null);
      setConfirmOpen(false);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر حفظ القالب');
    }
    setBusy(false);
  }

  if (!isAdmin) return <EmptyState icon="🔒" title="للإدارة فقط" />;
  if (loading) return <Loading />;

  return (
    <div className="stack">
      <div className="row">
        <h2 className="page-title flex1">قالب الطلاب</h2>
        {template && <span className="badge">إصدار {template.version}</span>}
      </div>
      <p className="muted small">
        الحقول الاختيارية الجديدة تعرض قيمة افتراضية للطلاب السابقين. حذف حقل لا يحذف قيمه من الطلاب القديمين لكنه يخفيها من النماذج.
      </p>

      {!canManage && <p className="help-text">لديك عرض فقط.</p>}

      {current.length === 0 && <EmptyState icon="🧾" title="لا حقول" sub="أضف أول حقل للقالب." />}

      {current.map((f, i) => (
        <div key={f.key} className="card">
          <div className="row row--nowrap" style={{ alignItems: 'center' }}>
            <span className="tiny muted">#{i + 1}</span>
            <input
              className="input flex1"
              value={f.label}
              placeholder="عنوان الحقل"
              onChange={(e) => update(i, { label: e.target.value })}
              disabled={!canManage}
            />
            {canManage && (
              <>
                <button className="icon-btn" onClick={() => move(i, -1)} aria-label="أعلى">↑</button>
                <button className="icon-btn" onClick={() => move(i, 1)} aria-label="أسفل">↓</button>
                <button className="icon-btn" onClick={() => removeField(i)} aria-label="حذف">🗑️</button>
              </>
            )}
          </div>

          <div className="grid-2" style={{ marginTop: 8 }}>
            <div className="field">
              <span className="label">النوع</span>
              <select
                className="input"
                value={f.type}
                onChange={(e) => update(i, { type: e.target.value as FieldType })}
                disabled={!canManage}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="col">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                  disabled={!canManage}
                />
                إلزامي
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!f.searchable}
                  onChange={(e) => update(i, { searchable: e.target.checked })}
                  disabled={!canManage}
                />
                قابل للبحث والفلترة
              </label>
            </div>
          </div>

          {(f.type === 'select' || f.type === 'multiselect') && (
            <div className="field">
              <span className="label">الخيارات (افصل بفاصلة)</span>
              <input
                className="input"
                value={(f.options ?? []).join('، ')}
                onChange={(e) =>
                  update(i, {
                    options: e.target.value
                      .split(/[,،]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                disabled={!canManage}
                placeholder="مثال: الصف الأول، الصف الثاني، الصف الثالث"
              />
            </div>
          )}
        </div>
      ))}

      {canManage && (
        <div className="row">
          <button className="btn btn--ghost" onClick={() => setFields([...current, blankField(current.map((f) => f.key))])}>
            + حقل جديد
          </button>
          <span className="flex1" />
          <button
            className="btn btn--primary"
            disabled={busy || !fields}
            onClick={() => setConfirmOpen(true)}
          >
            {busy ? 'جارٍ الحفظ…' : fields ? 'حفظ القالب' : 'لا تغييرات'}
          </button>
        </div>
      )}

      {confirmOpen ? (
        <Modal title="حفظ القالب" onClose={() => setConfirmOpen(false)}>
          <p className="small">
            سيُنشأ إصدار جديد من القالب (الإصدار الحالي: {template?.version ?? '-'}). يجب أن يملك الطلاب الجدد الحقول الإلزامية،
            أما الطلاب السابقون فتظهر لهم القيم الافتراضية.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn--ghost" onClick={() => setConfirmOpen(false)}>إلغاء</button>
            <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>
              {busy ? 'جارٍ الحفظ…' : 'تأكيد الحفظ'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
