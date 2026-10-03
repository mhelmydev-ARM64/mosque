import { describe, expect, it } from 'vitest';
import { buildSearchTokens, normalizeArabic, prefixRange } from '../../src/domain/arabic';

describe('normalizeArabic', () => {
  it('يزيل التشكيل', () => {
    expect(normalizeArabic('أَحْمَدُ')).toBe('احمد');
  });

  it('يوحد الهمزات والألف', () => {
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabic('آمنة')).toBe('امنه');
  });

  it('يوحد الألف المقصورة والياء', () => {
    expect(normalizeArabic('مستشفى')).toBe('مستشفي');
    expect(normalizeArabic('يَحْيى')).toBe('يحيي');
  });

  it('يوحد التاء المربوطة', () => {
    expect(normalizeArabic('مدرسة')).toBe('مدرسه');
  });

  it('يطبع المسافات المتعددة ويزيل الأطراف', () => {
    expect(normalizeArabic('  علي   سمير  ')).toBe('علي سمير');
  });

  it('يحوّل اللاتينية إلى صغيرة', () => {
    expect(normalizeArabic('Ahmed')).toBe('ahmed');
  });

  it('يعامل النصوص المتطابقة بعد التطبيع كواحدة', () => {
    expect(normalizeArabic('أَحْمَد سمير')).toBe(normalizeArabic('احمد سمير'));
  });
});

describe('prefixRange', () => {
  it('يبني نطاق بادئة للاستعلام', () => {
    const [start, end] = prefixRange('احم');
    expect(start).toBe('احم');
    expect(end).toBe('احم\uf8ff');
    expect('احمد' >= start && 'احمد' < end).toBe(true);
    expect('احمي' >= start && 'احمي' < end).toBe(true);
    expect('اح' >= start && 'اح' < end).toBe(false);
  });
});

describe('buildSearchTokens', () => {
  it('يبني رموزًا من الكلمات والهاتف', () => {
    const tokens = buildSearchTokens('أحمد سمير الحلبي', '0980603814');
    expect(tokens).toContain('احمد');
    expect(tokens).toContain('سمير');
    expect(tokens).toContain('الحلبي');
    expect(tokens).toContain('0980603814');
    expect(tokens).toContain('603814');
    expect(tokens.length).toBeLessThanOrEqual(12);
  });

  it('يتجاهل الكلمات الأقصر من حرفين', () => {
    expect(buildSearchTokens('ا ب ج د')).toEqual([]);
  });

  it('يسقف رموز الكلمات بثمانية ثم يضيف الهاتف', () => {
    const name = 'كلمة واحدة كلمتان ثلاثة اربعة خمسة ستة سبعة ثمانية تسعة';
    const tokens = buildSearchTokens(name, '963900000001');
    const wordTokens = tokens.filter((t) => !/^\d+$/.test(t));
    expect(wordTokens.length).toBe(8);
    expect(tokens).toContain('900000001'.slice(-6));
  });

  it('بلا هاتف يعطي رموز الأسماء فقط', () => {
    const tokens = buildSearchTokens('علي حسن');
    expect(tokens).toEqual(['علي', 'حسن']);
  });
});
