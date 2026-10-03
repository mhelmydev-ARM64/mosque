export function tsToDate(ts: { toDate(): Date } | null | undefined): Date | null {
  return ts ? ts.toDate() : null;
}

export function formatDateTime(ts: { toDate(): Date } | null | undefined): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return new Intl.DateTimeFormat('ar-SY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn',
  }).format(d);
}

export function formatDate(ts: { toDate(): Date } | null | undefined): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return new Intl.DateTimeFormat('ar-SY', {
    dateStyle: 'medium',
    numberingSystem: 'latn',
  }).format(d);
}

export function timeAgo(ts: { toDate(): Date } | null | undefined): string {
  const d = tsToDate(ts);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `قبل ${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr} س`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `قبل ${day} ي`;
  return formatDate(ts);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ar-SY', { numberingSystem: 'latn' }).format(n);
}

export function fileTimestamp(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}
