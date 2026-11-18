/**
 * Dates are handled as whole days: a "day number" is days since 1970-01-01 (UTC),
 * which avoids time-zone drift when moving bars around.
 */
export type Day = number;

const MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** 'YYYY-MM-DD' → Day */
export function parseDay(iso: string | null | undefined): Day | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / MS;
}

/** Jira datetime ('2026-11-15T09:00:00.000+02:00') → Day of that moment in local time. */
export function dayFromDateTime(iso: string | null | undefined): Day | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS;
}

export function today(): Day {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS;
}

/** Day → 'YYYY-MM-DD' (the format Jira date fields expect) */
export function toIso(day: Day): string {
  return new Date(day * MS).toISOString().slice(0, 10);
}

function parts(day: Day) {
  const d = new Date(day * MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() };
}

export const weekday = (day: Day) => parts(day).wd;
export const dayOfMonth = (day: Day) => parts(day).d;
export const weekdayLetter = (day: Day) => LETTERS[parts(day).wd];

/** 'Nov 18' */
export function fmt(day: Day | null): string {
  if (day == null) return 'No date';
  const p = parts(day);
  return `${MONTHS[p.m]} ${p.d}`;
}

/** 'Nov 15–28, 2026' or 'Nov 29 – Dec 12, 2026' */
export function fmtRange(a: Day, b: Day): string {
  const p = parts(a);
  const q = parts(b);
  if (p.y === q.y && p.m === q.m) return `${MONTHS[p.m]} ${p.d}–${q.d}, ${p.y}`;
  if (p.y === q.y) return `${MONTHS[p.m]} ${p.d} – ${MONTHS[q.m]} ${q.d}, ${q.y}`;
  return `${MONTHS[p.m]} ${p.d}, ${p.y} – ${MONTHS[q.m]} ${q.d}, ${q.y}`;
}
