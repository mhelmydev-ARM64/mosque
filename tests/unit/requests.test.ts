import { describe, expect, it } from 'vitest';
import {
  CURRENCIES,
  FINANCIAL_TYPES,
  MANUAL_TYPES,
  MEMO_LEVELS,
  canTransition,
  formatMoney,
  memoLabel,
  requestTypeInfo,
  statusBadgeClass,
} from '../../src/domain/requests';

describe('حالات الطلب', () => {
  it('المسودة تُرسل أو تلغى فقط', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(canTransition('draft', 'cancelled')).toBe(true);
    expect(canTransition('draft', 'approved')).toBe(false);
  });

  it('المُرسل يقبل القرار أو المراجعة أو الإلغاء', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true);
    expect(canTransition('submitted', 'approved')).toBe(true);
    expect(canTransition('submitted', 'rejected')).toBe(true);
    expect(canTransition('submitted', 'cancelled')).toBe(true);
    expect(canTransition('submitted', 'executed')).toBe(false);
  });

  it('المقبول ينفذ فقط، والنهائية لا تعود', () => {
    expect(canTransition('approved', 'executed')).toBe(true);
    expect(canTransition('approved', 'rejected')).toBe(false);
    expect(canTransition('executed', 'approved')).toBe(false);
    expect(canTransition('rejected', 'submitted')).toBe(false);
    expect(canTransition('cancelled', 'draft')).toBe(false);
  });
});

describe('أنواع الطلبات', () => {
  it('الأنواع المالية أربعة واليدوية اثنان', () => {
    expect(FINANCIAL_TYPES).toHaveLength(4);
    expect(MANUAL_TYPES).toEqual(['manual_income', 'manual_expense']);
    expect(MANUAL_TYPES.every((t) => FINANCIAL_TYPES.includes(t))).toBe(true);
  });

  it('الاتجاه يشتق من النوع', () => {
    expect(requestTypeInfo('income')).toMatchObject({ financial: true, direction: 'income' });
    expect(requestTypeInfo('manual_expense')).toMatchObject({ financial: true, direction: 'expense', manual: true });
    expect(requestTypeInfo('formatting')).toMatchObject({ financial: false });
  });

  it('العملات الثلاث فقط', () => {
    expect(CURRENCIES).toEqual(['SYP', 'USD', 'TRY']);
  });
});

describe('العرض', () => {
  it('تسميات الحفظ', () => {
    expect(memoLabel('hafiz')).toBe('حافظ');
    expect(memoLabel('none')).toBe('غير محدد');
    expect(MEMO_LEVELS).toHaveLength(5);
  });

  it('تنسيق المبلغ يضم العملة', () => {
    expect(formatMoney(1500, 'SYP')).toContain('ل.س');
    expect(formatMoney(5, 'USD')).toContain('$');
    expect(formatMoney(5, 'XXX')).toContain('XXX');
  });

  it('صفوف الشارات حسب النبرة', () => {
    expect(statusBadgeClass('approved')).toContain('badge--ok');
    expect(statusBadgeClass('rejected')).toContain('badge--bad');
    expect(statusBadgeClass('under_review')).toContain('badge--warn');
    expect(statusBadgeClass('submitted')).toContain('badge--info');
    expect(statusBadgeClass('draft')).not.toContain('badge--');
  });
});
