/**
 * Shared date/time formatting for the UI.
 *
 * Dates are numeric fragments: design.md §4 requires Western digits (0-9),
 * mono face, and LTR isolation. `toLocaleString('ar-LY')` embeds RTL bidi
 * marks that garble the output inside the LTR `.mono` utility, so we format
 * manually as `YYYY-MM-DD HH:mm` — always bidi-safe.
 */

const pad = (n: number) => String(n).padStart(2, '0');

const toDate = (value: string | number | Date): Date | null => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "2026-07-20 03:36" — LTR-safe date + time (24h). */
export function formatDateTime(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-07-20" — LTR-safe date only. */
export function formatDate(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
