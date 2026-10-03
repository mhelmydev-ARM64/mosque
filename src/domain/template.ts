import type { StudentTemplate, Student, TemplateField } from './models';

export function fieldKeyFor(label: string, existing: string[]): string {
  const base = `f_${Date.now().toString(36)}`;
  let key = base;
  let i = 1;
  while (existing.includes(key)) key = `${base}_${i++}`;
  return key;
}

export function defaultTemplate(): StudentTemplate {
  const fields: TemplateField[] = [
    { key: 'phone', label: 'رقم الهاتف', type: 'text', required: false, searchable: true },
    { key: 'level', label: 'الصف', type: 'text', required: false, searchable: true },
  ];
  return {
    fields,
    fieldKeys: fields.map((f) => f.key),
    requiredKeys: [],
    version: 1,
    updatedAt: null,
  };
}

/** قيمة حقل لسجل قديم لا يملكه: القيمة الافتراضية أو فارغة حسب النوع. */
export function fieldValueOrDefault(field: TemplateField, value: unknown): unknown {
  if (value !== undefined && value !== null && value !== '') return value;
  if (field.defaultValue !== undefined && field.defaultValue !== null) return field.defaultValue;
  switch (field.type) {
    case 'multiselect':
      return [];
    case 'boolean':
      return false;
    case 'number':
      return '';
    default:
      return '';
  }
}

export function validateStudentValues(
  template: StudentTemplate,
  name: string,
  values: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!name || name.trim().length < 2) errors.name = 'الاسم مطلوب (حرفان على الأقل)';
  if (name.trim().length > 80) errors.name = 'الاسم طويل جدًا';
  for (const field of template.fields) {
    const raw = values[field.key];
    const empty = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0);
    if (field.required && empty) {
      errors[field.key] = 'هذا الحقل مطلوب';
      continue;
    }
    if (empty) continue;
    switch (field.type) {
      case 'number': {
        const n = Number(raw);
        if (Number.isNaN(n)) errors[field.key] = 'أدخل رقمًا صحيحًا';
        break;
      }
      case 'select':
        if (!field.options?.includes(String(raw))) errors[field.key] = 'قيمة غير مسموحة';
        break;
      case 'multiselect':
        if (
          !Array.isArray(raw) ||
          raw.some((v) => !field.options?.includes(String(v)))
        ) {
          errors[field.key] = 'قيم غير مسموحة';
        }
        break;
      default:
        break;
    }
  }
  return errors;
}

export function cleanValues(template: StudentTemplate, values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of template.fields) {
    const raw = values[field.key];
    if (raw === undefined || raw === null || raw === '') {
      if (field.required) out[field.key] = field.type === 'multiselect' ? [] : field.type === 'boolean' ? false : '';
      continue;
    }
    if (field.type === 'number') out[field.key] = Number(raw);
    else if (field.type === 'boolean') out[field.key] = Boolean(raw);
    else if (field.type === 'multiselect') out[field.key] = Array.isArray(raw) ? raw.map(String) : [];
    else out[field.key] = String(raw);
  }
  return out;
}

export function studentMatchesFieldFilter(student: Student, key: string, wanted: string): boolean {
  const v = student.values?.[key];
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.map(String).some((x) => x.includes(wanted));
  return String(v).includes(wanted);
}
