import { describe, expect, it } from 'vitest';
import { InvalidPhoneError, displayPhone, normalizePhone, pseudoEmail } from '../../src/domain/phone';

describe('normalizePhone', () => {
  it('يطبّع الرقم المحلي مع الصفر البادئ', () => {
    expect(normalizePhone('0980603814')).toBe('963980603814');
  });

  it('يقبل الصيغة الدولية مع + ومسافات', () => {
    expect(normalizePhone('+963 980 603 814')).toBe('963980603814');
  });

  it('يعالج بادئة 00 الدولية', () => {
    expect(normalizePhone('00963980603814')).toBe('963980603814');
  });

  it('يضيف رمز الدولة الافتراضي عند غيابه', () => {
    expect(normalizePhone('980603814')).toBe('963980603814');
  });

  it('يحترم رمز دولة مختلف', () => {
    expect(normalizePhone('05551234567', '90')).toBe('905551234567');
  });

  it('يرفض الفارغ', () => {
    expect(() => normalizePhone('')).toThrow(InvalidPhoneError);
    expect(() => normalizePhone('abc')).toThrow(InvalidPhoneError);
  });

  it('يرفض الطول خارج النطاق', () => {
    expect(() => normalizePhone('12345')).toThrow(InvalidPhoneError);
    expect(() => normalizePhone('999999999999999999')).toThrow(InvalidPhoneError);
  });

  it('يرفض إعادة إضافة رمز الدولة مرتين', () => {
    expect(normalizePhone('963980603814')).toBe('963980603814');
  });
});

describe('pseudoEmail و displayPhone', () => {
  it('يبني بريدًا وهميًا حتميًا من الرقم المطبّع', () => {
    expect(pseudoEmail('963980603814')).toBe('p.963980603814@system.app');
  });

  it('حتمي: نفس المدخل يعطي نفس المخرج دائمًا', () => {
    const p = normalizePhone('0980603814');
    expect(pseudoEmail(p)).toBe(pseudoEmail(normalizePhone('+963-980-603-814')));
  });

  it('يعرض الرقم بصيغة دولية', () => {
    expect(displayPhone('963980603814')).toBe('+963980603814');
  });
});
