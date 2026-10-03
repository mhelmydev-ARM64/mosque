export const DEFAULT_COUNTRY_CODE = '963';

export class InvalidPhoneError extends Error {}

/**
 * تطبيع رقم الهاتف إلى صيغة دولية موحدة بدون + أو أصفار بادئة.
 * 0980603814 → 963980603814 ، +963 980 603 814 → 963980603814
 */
export function normalizePhone(raw: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  let digits = (raw ?? '').replace(/\D+/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  digits = digits.replace(/^0+/, '');
  if (!digits) throw new InvalidPhoneError('EMPTY');
  if (!digits.startsWith(countryCode)) digits = countryCode + digits;
  if (digits.length < 10 || digits.length > 15) throw new InvalidPhoneError('LENGTH');
  return digits;
}

/** بريد وهمي حتمي من الهاتف المطبّع؛ لا يُخزن في Firestore ولا يظهر للمستخدم. */
export function pseudoEmail(normalizedPhone: string): string {
  return `p.${normalizedPhone}@system.app`;
}

/** شكل عرض ودود للرقم مع رمز الدولة. */
export function displayPhone(normalizedPhone: string): string {
  return `+${normalizedPhone}`;
}
