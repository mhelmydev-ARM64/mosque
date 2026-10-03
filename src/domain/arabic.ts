const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

/** توحيد النص العربي للبحث: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة والمسافات. */
export function normalizeArabic(input: string): string {
  return (input ?? '')
    .replace(DIACRITICS, '')
    .replace(/[إأآٱا]/g, 'ا')
    .replace(/[ىیي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** نطاق بادئة لاستعلام اسم: [start, end) لاستخدام where >= / < . */
export function prefixRange(normalizedPrefix: string): [string, string] {
  return [normalizedPrefix, normalizedPrefix + '\uf8ff'];
}

/** رموز بحث محدودة من الاسم والهاتف (بحد أقصى 12) لتقليل الاستهلاك. */
export function buildSearchTokens(name: string, phone?: string): string[] {
  const tokens = new Set<string>();
  const norm = normalizeArabic(name);
  for (const word of norm.split(' ')) {
    if (word.length >= 2) tokens.add(word);
    if (tokens.size >= 8) break;
  }
  if (phone) {
    const digits = phone.replace(/\D+/g, '');
    if (digits.length >= 4) tokens.add(digits);
    if (digits.length > 4) tokens.add(digits.slice(-6));
  }
  return Array.from(tokens).slice(0, 12);
}
