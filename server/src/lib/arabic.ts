/**
 * Arabic normalization helper.
 * Standardizes Arabic characters to enable searching regardless of spelling variations:
 * - Removes diacritics (harakat)
 * - Standardizes hamzas (أ, إ, آ -> ا)
 * - Standardizes teh marbuta (ة -> ه)
 * - Standardizes alef maksura (ى -> ي)
 * - Removes tatweel (kashida)
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652]/g, '') // Remove diacritics (fatha, damma, kasra, sukun, shadda, etc.)
    .replace(/[أإآ]/g, 'ا') // Standardize hamzas
    .replace(/ة/g, 'ه') // Standardize teh marbuta
    .replace(/ى/g, 'ي') // Standardize alef maksura
    .replace(/\u0640/g, '') // Remove tatweel (kashida extension)
    .trim()
    .toLowerCase();
}
