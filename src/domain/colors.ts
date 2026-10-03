export const COMMITTEE_COLORS = [
  'emerald',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'rose',
  'red',
  'orange',
  'amber',
  'lime',
] as const;

export type CommitteeColorKey = (typeof COMMITTEE_COLORS)[number];

export const COLOR_LABELS: Record<CommitteeColorKey, string> = {
  emerald: 'زمردي',
  teal: 'تركوازي',
  cyan: 'سماوي',
  blue: 'أزرق',
  indigo: 'نيلي',
  violet: 'بنفسجي',
  fuchsia: 'أرجواني',
  rose: 'وردي',
  red: 'أحمر',
  orange: 'برتقالي',
  amber: 'عنبري',
  lime: 'ليموني',
};

export function isCommitteeColor(key: string): key is CommitteeColorKey {
  return (COMMITTEE_COLORS as readonly string[]).includes(key);
}

const safeColor = (key: string): CommitteeColorKey => (isCommitteeColor(key) ? key : 'emerald');

export function committeeBadgeProps(key: string): { className: string; 'data-cc': string } {
  return { className: 'badge badge--committee', 'data-cc': safeColor(key) };
}

export function committeeBorderProps(key: string): { className: string; 'data-cc': string } {
  return { className: 'card--bordered', 'data-cc': safeColor(key) };
}
