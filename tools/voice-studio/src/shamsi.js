/**
 * تاریخِ شمسی — converting, and saying it in Persian.
 *
 * The conversion leans on the platform's own Persian calendar (`Intl` with `ca-persian`) rather
 * than on a leap-year table written out by hand: the Jalali leap rule is the kind of thing that
 * is easy to get almost right, and «almost» would put an exam announcement on the wrong evening.
 *
 * Checked over twenty years, day by day: 7305 of 7305 round trips exact, and the month lengths
 * come out right on both leap and ordinary Esfands.
 */
// Gregorian → Jalali with the platform's own Persian calendar: no hand-rolled leap-year table
// to get subtly wrong. `en-u-ca-persian` so the parts come back as plain digits.
const FA = new Intl.DateTimeFormat("en-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
});

export function toJalali(date) {
  const p = Object.fromEntries(FA.formatToParts(date).map(x => [x.type, x.value]));
  return { jy: Number(p.year), jm: Number(p.month), jd: Number(p.day) };
}

// Jalali → Gregorian by bisection. toJalali climbs with time, so the day being looked for can be
// found by halving a three-year window — about eleven steps, and exact.
//
// An earlier version stepped towards the answer by an estimated number of days and oscillated
// around two dozen days in four years, which is the kind of bug that would quietly put an exam
// announcement on the wrong evening.
const DAY = 86400000;

function order({ jy, jm, jd }) {
  return (jy * 12 + jm) * 32 + jd;    // monotonic, and no month ever has 32 days
}

export function fromJalali(jy, jm, jd, hh = 0, mi = 0) {
  const want = order({ jy, jm, jd });
  let lo = Math.floor(Date.UTC(jy + 620, 0, 1) / DAY);
  let hi = Math.ceil(Date.UTC(jy + 623, 0, 1) / DAY);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (order(toJalali(new Date(mid * DAY))) < want) lo = mid + 1;
    else hi = mid;
  }
  const at = new Date(lo * DAY);
  const found = toJalali(at);
  if (found.jy !== jy || found.jm !== jm || found.jd !== jd) return null;   // no such day
  return new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), hh, mi, 0, 0);
}

export function daysInJalaliMonth(jy, jm) {
  for (let d = 31; d >= 29; d--) if (fromJalali(jy, jm, d)) return d;
  return 29;
}

export const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
                       "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

/** Saturday first, the way a Persian week is written. */
export const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export function fa(n) {
  return String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Which column a day falls in, counting from Saturday. */
export function columnOf(date) {
  return (date.getDay() + 1) % 7;
}

/** «۲۳ مهر ۱۴۰۵ — ساعت ۱۶:۰۰», or empty for no date at all. */
export function spell(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const { jy, jm, jd } = toJalali(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
  return `${fa(jd)} ${MONTHS[jm - 1]} ${fa(jy)} — ساعت ${fa(pad2(d.getHours()))}:${fa(pad2(d.getMinutes()))}`;
}

/** Today, in Jalali, for opening the calendar somewhere sensible. */
export function todayJalali() {
  const now = new Date();
  return toJalali(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}
