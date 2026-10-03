import type { MemorizationLevel, RequestStatus, RequestType } from './models';

export interface RequestTypeInfo {
  key: RequestType;
  label: string;
  financial: boolean;
  direction?: 'income' | 'expense';
  manual?: boolean;
}

export const REQUEST_TYPES: RequestTypeInfo[] = [
  { key: 'formatting', label: 'تنسيق', financial: false },
  { key: 'support', label: 'دعم', financial: false },
  { key: 'resources', label: 'موارد', financial: false },
  { key: 'inquiry', label: 'استفسار', financial: false },
  { key: 'income', label: 'طلب دخل', financial: true, direction: 'income' },
  { key: 'expense', label: 'طلب مصروف', financial: true, direction: 'expense' },
  { key: 'manual_income', label: 'إدخال دخل يدوي', financial: true, direction: 'income', manual: true },
  { key: 'manual_expense', label: 'إدخال مصروف يدوي', financial: true, direction: 'expense', manual: true },
];

export const MANUAL_TYPES: RequestType[] = ['manual_income', 'manual_expense'];
export const FINANCIAL_TYPES: RequestType[] = ['income', 'expense', 'manual_income', 'manual_expense'];

export function requestTypeInfo(type: RequestType): RequestTypeInfo {
  return REQUEST_TYPES.find((t) => t.key === type) ?? { key: type, label: type, financial: false };
}

export const CURRENCIES = ['SYP', 'USD', 'TRY'] as const;
export const CURRENCY_LABELS: Record<string, string> = { SYP: 'ل.س', USD: '$', TRY: '₺' };

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'مسودة',
  submitted: 'مُرسَل',
  under_review: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  executed: 'منفَّذ',
  cancelled: 'ملغى',
};

export const STATUS_TONES: Record<RequestStatus, string> = {
  draft: 'gray',
  submitted: 'blue',
  under_review: 'amber',
  approved: 'green',
  rejected: 'red',
  executed: 'green',
  cancelled: 'gray',
};

const TRANSITIONS: Array<[RequestStatus, RequestStatus[]]> = [
  ['draft', ['submitted', 'cancelled']],
  ['submitted', ['under_review', 'approved', 'rejected', 'cancelled']],
  ['under_review', ['approved', 'rejected', 'cancelled']],
  ['approved', ['executed']],
  ['rejected', []],
  ['executed', []],
  ['cancelled', []],
];

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS.find(([f]) => f === from)?.[1].includes(to) ?? false;
}

export const MEMO_LEVELS: Array<{ key: MemorizationLevel; label: string }> = [
  { key: 'none', label: 'غير محدد' },
  { key: 'beginner', label: 'مبتدئ' },
  { key: 'intermediate', label: 'متوسط' },
  { key: 'advanced', label: 'متقدم' },
  { key: 'hafiz', label: 'حافظ' },
];

export function memoLabel(level: MemorizationLevel): string {
  return MEMO_LEVELS.find((l) => l.key === level)?.label ?? level;
}

const TONE_BADGE_CLASS: Record<string, string> = {
  gray: '',
  blue: 'badge--info',
  amber: 'badge--warn',
  green: 'badge--ok',
  red: 'badge--bad',
};

export function statusBadgeClass(status: RequestStatus): string {
  return `badge ${TONE_BADGE_CLASS[STATUS_TONES[status]] ?? ''}`;
}

export const USER_STATUS_LABELS: Record<string, string> = {
  pending: 'بانتظار المراجعة',
  under_review: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  suspended: 'معلّق',
};

export function formatMoney(amount: number, currency: string): string {
  const label = CURRENCY_LABELS[currency] ?? currency;
  const formatted = new Intl.NumberFormat('ar-SY', { maximumFractionDigits: 2 }).format(amount);
  return `${formatted} ${label}`;
}
