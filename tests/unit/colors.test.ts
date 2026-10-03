import { describe, expect, it } from 'vitest';
import {
  COLOR_LABELS,
  COMMITTEE_COLORS,
  committeeBadgeProps,
  committeeBorderProps,
  isCommitteeColor,
} from '../../src/domain/colors';

// يجب أن يطابق قائمة colors() في firestore.rules حرفيًا — أي انحراف يرفض القواعد اللون.
const RULES_COLORS = [
  'emerald', 'teal', 'cyan', 'blue', 'indigo', 'violet',
  'fuchsia', 'rose', 'red', 'orange', 'amber', 'lime',
];

describe('ألوان اللجان', () => {
  it('تطابق قائمة القواعد تمامًا', () => {
    expect([...COMMITTEE_COLORS]).toEqual(RULES_COLORS);
    expect(COMMITTEE_COLORS).toHaveLength(12);
  });

  it('كل لون له تسمية عربية', () => {
    for (const key of COMMITTEE_COLORS) {
      expect(COLOR_LABELS[key]).toBeTruthy();
    }
  });

  it('isCommitteeColor يتحقق بدقة', () => {
    expect(isCommitteeColor('rose')).toBe(true);
    expect(isCommitteeColor('pink')).toBe(false);
    expect(isCommitteeColor('#ff0000')).toBe(false);
  });

  it('خصائص الشارة تستخدم data-cc مع سقوط آمن إلى emerald', () => {
    expect(committeeBadgeProps('rose')).toEqual({
      className: 'badge badge--committee',
      'data-cc': 'rose',
    });
    expect(committeeBadgeProps('pink')['data-cc']).toBe('emerald');
  });

  it('خصائص الحدود تعرض data-cc بأمان', () => {
    const p = committeeBorderProps('violet');
    expect(p.className).toBe('card--bordered');
    expect(p['data-cc']).toBe('violet');
    expect(committeeBorderProps('nope')['data-cc']).toBe('emerald');
  });
});
