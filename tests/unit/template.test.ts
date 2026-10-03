import { describe, expect, it } from 'vitest';
import {
  cleanValues,
  fieldValueOrDefault,
  validateStudentValues,
} from '../../src/domain/template';
import type { StudentTemplate, TemplateField } from '../../src/domain/models';
import { defaultTemplate } from '../../src/domain/template';

const field = (over: Partial<TemplateField> & { key: string }): TemplateField => ({
  label: over.key,
  type: 'text',
  required: false,
  ...over,
});

const tpl = (fields: TemplateField[]): StudentTemplate => {
  const fieldKeys = fields.map((f) => f.key);
  return {
    fields,
    fieldKeys,
    requiredKeys: fields.filter((f) => f.required).map((f) => f.key),
    version: 1,
    updatedAt: null,
  };
};

describe('validateStudentValues', () => {
  it('الاسم مطلوب بحرفين على الأقل', () => {
    const t = defaultTemplate();
    expect(validateStudentValues(t, '', {}).name).toBeTruthy();
    expect(validateStudentValues(t, 'أ', {}).name).toBeTruthy();
    expect(validateStudentValues(t, 'أحمد', {})).toEqual({});
  });

  it('الاسم الطويل جدًا يرفض', () => {
    const t = defaultTemplate();
    expect(validateStudentValues(t, 'أ'.repeat(81), {}).name).toBeTruthy();
    expect(validateStudentValues(t, 'أ'.repeat(80), {})).toEqual({});
  });

  it('الحقل المطلوب الفارغ يرفض', () => {
    const t = tpl([field({ key: 'level', required: true })]);
    const errors = validateStudentValues(t, 'أحمد', { level: '' });
    expect(errors.level).toBe('هذا الحقل مطلوب');
  });

  it('select يرفض قيمة خارج الخيارات', () => {
    const t = tpl([field({ key: 'gender', type: 'select', required: true, options: ['ذكر', 'أنثى'] })]);
    expect(validateStudentValues(t, 'أحمد', { gender: 'ذكر' })).toEqual({});
    expect(validateStudentValues(t, 'أحمد', { gender: 'x' }).gender).toBeTruthy();
  });

  it('multiselect يرفض قيمة خارج الخيارات', () => {
    const t = tpl([field({ key: 'halaqat', type: 'multiselect', options: ['ح1', 'ح2'] })]);
    expect(validateStudentValues(t, 'أحمد', { halaqat: ['ح1'] })).toEqual({});
    expect(validateStudentValues(t, 'أحمد', { halaqat: ['ح3'] }).halaqat).toBeTruthy();
    expect(validateStudentValues(t, 'أحمد', { halaqat: 'ح1' }).halaqat).toBeTruthy();
  });

  it('number يرفض غير الأرقام', () => {
    const t = tpl([field({ key: 'age', type: 'number' })]);
    expect(validateStudentValues(t, 'أحمد', { age: 'abc' }).age).toBeTruthy();
    expect(validateStudentValues(t, 'أحمد', { age: '12' })).toEqual({});
  });
});

describe('cleanValues', () => {
  it('يطبع الأنواع: رقم/منطقي/قائمة/نص', () => {
    const t = tpl([
      field({ key: 'age', type: 'number' }),
      field({ key: 'active', type: 'boolean' }),
      field({ key: 'tags', type: 'multiselect', options: ['a', 'b'] }),
      field({ key: 'phone' }),
    ]);
    const out = cleanValues(t, { age: '12', active: 'x', tags: ['a'], phone: 123 });
    expect(out).toEqual({ age: 12, active: true, tags: ['a'], phone: '123' });
  });

  it('multiselect بقيمة غير مصفوفة يُهمل إلى [] (الاستيراد يفصل النص بنفسه)', () => {
    const t = tpl([field({ key: 'tags', type: 'multiselect', options: ['a', 'b'] })]);
    expect(cleanValues(t, { tags: 'a' })).toEqual({ tags: [] });
  });

  it('يضمن وجود المفاتيح المطلوبة حتى لو فارغة (شرط hasAll في القواعد)', () => {
    const t = tpl([
      field({ key: 'level', required: true }),
      field({ key: 'circle', type: 'multiselect', required: true }),
      field({ key: 'flag', type: 'boolean', required: true }),
      field({ key: 'phone' }),
    ]);
    const out = cleanValues(t, {});
    expect(out).toEqual({ level: '', circle: [], flag: false });
  });

  it('يحذف الاختياري الفارغ ولا يدرجه', () => {
    const t = tpl([field({ key: 'phone' })]);
    expect(cleanValues(t, {})).toEqual({});
  });
});

describe('fieldValueOrDefault — القيم الافتراضية للسجلات القديمة', () => {
  it('يرجع القيمة الموجودة كما هي', () => {
    const f = field({ key: 'x', type: 'select', options: ['a'] });
    expect(fieldValueOrDefault(f, 'a')).toBe('a');
  });

  it('يستخدم defaultValue عند توفره', () => {
    const f = field({ key: 'x', type: 'text', defaultValue: 'قيمة' });
    expect(fieldValueOrDefault(f, undefined)).toBe('قيمة');
  });

  it('الافتراضي حسب النوع عند غياب كل شيء', () => {
    expect(fieldValueOrDefault(field({ key: 'a', type: 'multiselect' }), undefined)).toEqual([]);
    expect(fieldValueOrDefault(field({ key: 'b', type: 'boolean' }), undefined)).toBe(false);
    expect(fieldValueOrDefault(field({ key: 'c', type: 'number' }), undefined)).toBe('');
    expect(fieldValueOrDefault(field({ key: 'd', type: 'text' }), undefined)).toBe('');
  });
});
