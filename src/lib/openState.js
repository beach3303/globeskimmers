// openState: one honest answer to "is it open?" for every finder card.
//
// The verdict ('Open until 9 PM', 'Closed · opens 7 AM') is worded only when we know the
// place's clock: Google's utcOffsetMinutes, or the device clock when the traveler is
// standing in the place's city (current-location mode). Browsing a city in another time
// zone with no offset gives no verdict, only the hours themselves, because a confidently
// wrong 'Open' is worse than none. Unknown hours read 'Hours not listed', never 'Closed'
// and never blank. Today's line is found by its day NAME, never by array index.
//
//   openState({ weekdayDescriptions, isOpen, utcOffsetMinutes, isLocal, now })
//     weekdayDescriptions  Google's weekly lines, 'Monday: 9:00 AM – 5:00 PM', in any order.
//     isOpen               accepted so callers can pass a row as is, but it never decides the
//                          verdict: it is a cached flag that can be days old (CLAUDE.md:
//                          'Open now is never trusted from a cache'). The hours decide.
//     utcOffsetMinutes     the place's offset from UTC (Google Places). Wins over isLocal.
//     isLocal              true when the device clock is the place's clock.
//     now                  optional Date or epoch ms (tests); defaults to the current time.
//   returns {
//     status    'open' | 'closed' | 'unknown' (no hours) | 'hours' (hours, but no verdict)
//     word      the words to print first in the facts line
//     tone      'open' (#2E6B4E) | 'closed' (#B0472F) | 'muted' (#736657) | 'neutral' (#3A3128)
//     todayText today's hours at the place, compact ('9 AM–5 PM', 'Closed', 'Open 24 hours'),
//               or null when the place's day is unknown
//     allDay    true only when all seven lines read 'Open 24 hours' (needs no time zone)
//     todayName the place's weekday ('Tuesday'), or null when its clock is unknown
//     closesAt  minutes after the place's midnight when open (may pass 1440), else null
//     opensAt   { day: 'Tuesday', minutes } of the next opening when closed, else null
//     week      the seven days Monday first: [{ day, short, text (compact or null), today }]
//   }
//
// Words: 'Open until 9 PM', 'Open 24 hours', 'Closed · opens 7 AM' (later today),
// 'Closed · opens Tue' (another day), 'Closed' (nothing in the coming week). With no
// verdict: '9 AM–5 PM daily' when all seven days match, otherwise the device's day named
// explicitly ('Tue 9 AM–5 PM'), so nothing claims to be the place's today.
//
// Also exported: openStateFor(place, { isLocal, now }) reads the usual row shapes
// (currentOpeningHours / regularOpeningHours / hours, utcOffsetMinutes, isOpen);
// parseDayHours(text) gives { closed, allDay, shifts: [[start, end]] } in minutes (end past
// 1440 runs past midnight); formatClock(minutes) gives '9 AM', '9:30 PM'; compactHours(text)
// gives '9 AM–5 PM'; DAY_NAMES (Sunday first, as Date#getDay).

export const DAY_NAMES = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const DAY = 1440;

const UNKNOWN_WORD = 'Hours not listed';

// Google puts narrow no-break and thin spaces around its dashes and before AM/PM.
const clean = (s) => String(s).replace(/[     ]/g, ' ').replace(/\s+/g, ' ').trim();

/** '9:00 AM – 5:00 PM' -> '9 AM–5 PM'; '5:00 – 10:00 PM' -> '5–10 PM'. */
export function compactHours(text) {
  if (text == null) return null;
  return clean(text)
    .replace(/:00(?=\D|$)/g, '')
    .replace(/\s*[–—-]\s*/g, '–')
    .replace(/\s*,\s*/g, ', ');
}

/** Minutes after midnight (any number of days) -> '9 AM', '9:30 PM', '12 AM'. */
export function formatClock(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const m = ((Math.round(minutes) % DAY) + DAY) % DAY;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${min ? `:${String(min).padStart(2, '0')}` : ''} ${h24 < 12 ? 'AM' : 'PM'}`;
}

const TIME = /(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?\s*m\b\.?)?/g;

/**
 * One day's hours text (without the day name) -> { closed, allDay, shifts, unparsed }.
 * Handles split shifts ('11 AM – 2 PM, 5 – 10 PM'), a start that borrows the end's AM/PM
 * ('5:00 – 10:00 PM'), 24-hour clocks ('17:00–23:00') and shifts past midnight.
 * @param {unknown} text
 * @returns {{ closed: boolean, allDay: boolean, shifts: number[][], unparsed: boolean }}
 */
export function parseDayHours(text) {
  const body = typeof text === 'string' ? clean(text).toLowerCase() : '';
  if (!body) return { closed: false, allDay: false, shifts: [], unparsed: true };
  if (/\bclosed\b/.test(body) && !/\d/.test(body)) return { closed: true, allDay: false, shifts: [], unparsed: false };
  if (/24\s*hours|open 24|24\/7/.test(body)) return { closed: false, allDay: true, shifts: [[0, DAY]], unparsed: false };
  const shifts = [];
  for (const part of body.split(',')) {
    const tokens = [...part.matchAll(TIME)].filter((t) => t[1] != null);
    if (tokens.length < 2) continue;
    const a = tokens[0];
    const b = tokens[tokens.length - 1];
    const endMer = b[3] || null;
    const startMer = a[3] || endMer;
    const toMin = (t, mer) => {
      let h = Number(t[1]);
      const m = Number(t[2] || 0);
      if (h > 24 || m > 59) return null;
      if (mer === 'p' && h < 12) h += 12;
      else if (mer === 'a' && h === 12) h = 0;
      return h * 60 + m;
    };
    const start = toMin(a, startMer);
    let end = toMin(b, endMer);
    if (start == null || end == null) continue;
    if (end <= start) end += DAY; // past midnight (10 PM – 2 AM), or ends at 12 AM
    shifts.push([start, end]);
  }
  return { closed: false, allDay: false, shifts, unparsed: shifts.length === 0 };
}

/**
 * The seven lines by day name, Sunday first; null where a day has no line.
 * @param {unknown} weekdayDescriptions
 * @returns {(string|null)[]}
 */
function linesByDay(weekdayDescriptions) {
  const out = [null, null, null, null, null, null, null];
  if (!Array.isArray(weekdayDescriptions)) return out;
  for (const raw of weekdayDescriptions) {
    if (typeof raw !== 'string') continue;
    const line = clean(raw);
    const lower = line.toLowerCase();
    const i = DAY_NAMES.findIndex((d) => lower.startsWith(d.toLowerCase()));
    if (i < 0 || out[i] != null) continue;
    const colon = line.indexOf(':');
    out[i] = colon >= 0 ? line.slice(colon + 1).trim() : '';
  }
  return out;
}

/** The place's weekday and minute now, or null when its clock is unknown. */
function placeClock(utcOffsetMinutes, isLocal, now) {
  const ms = now instanceof Date ? now.getTime() : Number.isFinite(now) ? Number(now) : Date.now();
  if (!Number.isFinite(ms)) return null;
  if (Number.isFinite(utcOffsetMinutes)) {
    const d = new Date(ms + Number(utcOffsetMinutes) * 60000);
    return { day: d.getUTCDay(), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  if (isLocal) {
    const d = new Date(ms);
    return { day: d.getDay(), minute: d.getHours() * 60 + d.getMinutes() };
  }
  return null;
}

const deviceDay = (now) => {
  const d = now instanceof Date ? now : new Date(Number.isFinite(now) ? Number(now) : Date.now());
  return Number.isFinite(d.getTime()) ? d.getDay() : new Date().getDay();
};

/**
 * @param {{ weekdayDescriptions?: unknown, isOpen?: boolean|null, utcOffsetMinutes?: number|null, isLocal?: boolean, now?: Date|number }} [input]
 */
export function openState(input = {}) {
  const { weekdayDescriptions, utcOffsetMinutes = null, isLocal = false, now = undefined } = input || {};
  const lines = linesByDay(weekdayDescriptions);
  const parsed = lines.map((l) => (l == null ? null : parseDayHours(l)));
  const known = lines.some((l) => l != null);
  const allDay = parsed.every((p) => p != null && p.allDay);
  const clock = known ? placeClock(utcOffsetMinutes, isLocal, now) : null;

  const week = MONDAY_FIRST.map((i) => ({
    day: DAY_NAMES[i],
    short: SHORT[i],
    text: lines[i] == null ? null : compactHours(lines[i]),
    today: !!clock && clock.day === i,
  }));
  const base = { allDay, todayName: null, todayText: null, closesAt: null, opensAt: null, week };

  if (!known) return { ...base, status: 'unknown', word: UNKNOWN_WORD, tone: 'muted' };

  // Open every hour of every day: open now in any time zone.
  if (allDay) {
    return {
      ...base,
      status: 'open',
      word: 'Open 24 hours',
      tone: 'open',
      todayName: clock ? DAY_NAMES[clock.day] : null,
      todayText: clock ? 'Open 24 hours' : null,
    };
  }

  // No clock for the place: the hours, but no verdict.
  if (!clock) {
    const texts = lines.map((l) => (l == null ? null : compactHours(l)));
    if (texts.every((t) => t != null && t === texts[0])) {
      const daily = /^closed$/i.test(texts[0]) ? 'Closed every day' : `${texts[0]} daily`;
      return { ...base, status: 'hours', word: daily, tone: 'neutral' };
    }
    const d = deviceDay(now);
    const t = texts[d];
    const word = t == null ? 'Hours vary by day' : /^closed$/i.test(t) ? `${SHORT[d]} closed` : `${SHORT[d]} ${t}`;
    return { ...base, status: 'hours', word, tone: 'neutral' };
  }

  const { day, minute } = clock;
  const todayLine = lines[day];
  const withToday = {
    ...base,
    todayName: DAY_NAMES[day],
    todayText: todayLine == null ? null : compactHours(todayLine),
  };
  if (todayLine == null) return { ...withToday, status: 'unknown', word: UNKNOWN_WORD, tone: 'muted' };

  const today = parsed[day];
  if (today.allDay) return { ...withToday, status: 'open', word: 'Open 24 hours', tone: 'open' };

  // Every opening interval from yesterday to a week ahead, in minutes from today's midnight.
  const intervals = [];
  for (let d = -1; d <= 7; d += 1) {
    const p = parsed[(((day + d) % 7) + 7) % 7];
    if (!p) continue;
    for (const [s, e] of p.shifts) intervals.push([s + d * DAY, e + d * DAY]);
  }
  intervals.sort((x, y) => x[0] - y[0]);

  const current = intervals.find(([s, e]) => s <= minute && minute < e);
  if (current) {
    // Shifts that meet or overlap run on as one ('9 AM – 12 PM, 12 – 5 PM').
    let end = current[1];
    for (const [s, e] of intervals) if (s <= end && e > end) end = e;
    if (end - minute >= DAY) return { ...withToday, status: 'open', word: 'Open 24 hours', tone: 'open', closesAt: end };
    return { ...withToday, status: 'open', word: `Open until ${formatClock(end)}`, tone: 'open', closesAt: end };
  }

  if (today.unparsed && !today.closed) {
    // A line we can't read ('Open by appointment'): say what it says, without a verdict.
    return { ...withToday, status: 'hours', word: `Today: ${withToday.todayText}`, tone: 'neutral' };
  }

  const next = intervals.find(([s]) => s > minute);
  if (!next) return { ...withToday, status: 'closed', word: 'Closed', tone: 'closed' };
  const offset = Math.floor(next[0] / DAY);
  const nextDay = (((day + offset) % 7) + 7) % 7;
  const opensAt = { day: DAY_NAMES[nextDay], minutes: next[0] - offset * DAY };
  const word = offset === 0 ? `Closed · opens ${formatClock(next[0])}` : `Closed · opens ${SHORT[nextDay]}`;
  return { ...withToday, status: 'closed', word, tone: 'closed', opensAt };
}

/**
 * openState for a place row in any of the usual shapes.
 * @param {any} place
 * @param {{ isLocal?: boolean, now?: Date|number }} [opts]
 */
export function openStateFor(place, opts = {}) {
  const p = place || {};
  const pick = (v) => (Array.isArray(v) && v.length ? v : null);
  const weekdayDescriptions =
    pick(p.currentOpeningHours?.weekdayDescriptions) ||
    pick(p.regularOpeningHours?.weekdayDescriptions) ||
    pick(p.weekdayDescriptions) ||
    pick(p.hours?.weekdayDescriptions) ||
    pick(p.hours) ||
    [];
  return openState({
    weekdayDescriptions,
    isOpen: p.isOpen ?? null,
    utcOffsetMinutes: Number.isFinite(p.utcOffsetMinutes) ? p.utcOffsetMinutes : null,
    isLocal: !!opts.isLocal,
    now: opts.now,
  });
}

export default openState;
