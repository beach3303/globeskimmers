// DayArc: Weather's motif, the day drawn as a diagram from real data, across the top of
// the white now card (bible finders[weather].motif, Weather.dc.html L45-55).
//
// A dotted half-ellipse from sunrise to sunset over a 1px horizon: 2px round dots on a 6px
// pitch in the world ink, 35% from sunrise to now and 15% for the rest of the day. The sun
// at the current time is a 12px sunflower disk in a 22px sunflower halo at 28%, wearing a
// 1.5px ink ring (sunflower alone is 1.36:1 on white). At night the disk becomes a 1.5px
// ink crescent, at the sunset end after sunset and the sunrise end before sunrise. The
// sunrise and sunset times are printed at its feet in mono ink-3, so the arc itself is
// supplementary. The whole piece is one role="img" with a full label.
//
// Props:
//   sunrise, sunset  the place's local clock times: '6:55 AM' (what the weather worker
//                    sends), '18:31', or minutes since local midnight. Missing or
//                    unreadable times, or a sunset not after the sunrise, render nothing.
//   now              the place's local time now, in the same forms (minutesInZone gives
//                    it from the place's IANA zone). Missing: the arc is drawn without the
//                    sun, and nothing claims where it is.
//   night            optional; true draws the crescent. Defaults to now outside daylight.
//   label            the aria-label. Default: 'Sun position: {n}% of daylight, sunrise
//                    6:55 AM, sunset 6:31 PM' (or 'Before sunrise.' / 'After sunset.').
//   world            a WORLD row or key; Weather by default. Colours: ink (dots, ring,
//                    crescent), line (horizon), sun (disk and halo).
//   style, className
//
// Also exported for the Weather page, so the plate's night switch and the arc agree:
//   clockMinutes(value)              '6:55 AM' | '18:31' | minutes -> minutes, or null (a Date
//                                    is read on the device clock, so pass minutes instead)
//   minutesInZone(timeZone, date?)   the local time in an IANA zone, in minutes, or null
//   dayPhase({ sunrise, sunset, now }) -> null when the times are unusable, else
//     { rise, set, now, position (0-1, or null without now), night, phase:
//       'day' | 'before' | 'after' | 'unknown' }; night is false when now is unknown.
import React, { useLayoutEffect, useState } from 'react';
import { NEUTRAL, WORLD, worldOf, rgba, fs } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.weather);

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const DAY = 24 * 60;

// ── Time helpers ─────────────────────────────────────────────────────────

const CLOCK = /(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?\s*[Mm]\.?)?/;
const TWELVE_HOUR = /^\s*\d{1,2}:\d{2}\s*[AaPp]\.?\s*[Mm]\.?\s*$/;

/** @param {unknown} value @returns {number|null} */
export function clockMinutes(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= DAY ? value : null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60 : null;
  }
  if (typeof value !== 'string') return null;
  const m = CLOCK.exec(value);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  if (min > 59 || sec > 59) return null;
  if (m[4]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[4].toLowerCase() === 'p' ? 12 : 0);
  } else if (h > 23) {
    return null;
  }
  return h * 60 + min + sec / 60;
}

/** @param {string} timeZone @param {Date} [date] @returns {number|null} */
export function minutesInZone(timeZone, date = new Date()) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone.trim(),
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(date);
    const part = (type) => parts.find((p) => p.type === type);
    let h = Number(part('hour') ? part('hour').value : NaN);
    const m = Number(part('minute') ? part('minute').value : NaN);
    // An engine without hourCycle falls back to a 12-hour clock with a day period.
    const period = part('dayPeriod');
    if (period && Number.isFinite(h)) h = (h % 12) + (/p/i.test(period.value) ? 12 : 0);
    return Number.isFinite(h) && Number.isFinite(m) ? (h % 24) * 60 + m : null;
  } catch {
    return null;
  }
}

/** @param {{ sunrise?: unknown, sunset?: unknown, now?: unknown }} [times] */
export function dayPhase(times) {
  const { sunrise, sunset, now } = times || {};
  const rise = clockMinutes(sunrise);
  const set = clockMinutes(sunset);
  if (rise == null || set == null || !(set > rise)) return null;
  const at = clockMinutes(now);
  if (at == null) return { rise, set, now: null, position: null, night: false, phase: 'unknown' };
  if (at < rise) return { rise, set, now: at, position: 0, night: true, phase: 'before' };
  if (at > set) return { rise, set, now: at, position: 1, night: true, phase: 'after' };
  return { rise, set, now: at, position: (at - rise) / (set - rise), night: false, phase: 'day' };
}

function formatClock(minutes) {
  const t = ((Math.round(minutes) % DAY) + DAY) % DAY;
  const h = Math.floor(t / 60);
  return `${h % 12 || 12}:${String(t % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// The time as printed: the worker's own '6:55 AM' when that is what came in, else 12-hour.
const clockText = (value, minutes) => (typeof value === 'string' && TWELVE_HOUR.test(value) ? value.trim() : formatClock(minutes));

// ── The arc ──────────────────────────────────────────────────────────────

// The card's content width, measured, so the arc spans it at any width (316px on the
// 390px board). The SVG keeps a fixed 80px height.
function useBoxWidth(fallback) {
  const [el, setEl] = useState(/** @type {HTMLElement|null} */ (null));
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!el) return undefined;
    const read = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return /** @type {[(node: HTMLElement|null) => void, number]} */ ([setEl, width]);
}

// Board geometry (L45-51): horizon at y 70.5; the arc's feet 18px in from each side on
// y 70; vertical radius 62. The sun's position is linear in time along the angle.
const H = 80;
const BASE = 70;
const RY = 62;
const INSET = 18;
const r1 = (n) => +n.toFixed(1);

// The lucide Moon: a 24-unit box whose outer curve is a circle of radius 9 around (12, 12).
// Scaled by 2/3 it is 12px across, the size of the sun's disk.
const MOON = 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z';

/**
 * @param {{ sunrise?: unknown, sunset?: unknown, now?: unknown, night?: boolean, label?: string, world?: any, variant?: 'plate'|'strip'|'inline'|'card', style?: CSS, className?: string }} props
 */
export default function DayArc({ sunrise, sunset, now, night, label, world, style, className }) {
  const w = worldFor(world);
  const [boxRef, measured] = useBoxWidth(316);
  const phase = dayPhase({ sunrise, sunset, now });
  if (!phase) return null;

  const W = Math.max(measured, 2 * INSET + 40);
  const cx = W / 2;
  const rx = W / 2 - INSET;
  const at = (p) => {
    const a = Math.PI * (1 - p);
    return [r1(cx + rx * Math.cos(a)), r1(BASE - RY * Math.sin(a))];
  };
  const arc = (p0, p1) => {
    const [xa, ya] = at(p0);
    const [xb, yb] = at(p1);
    return `M${xa} ${ya} A${r1(rx)} ${RY} 0 0 1 ${xb} ${yb}`;
  };
  const p = phase.position;
  const isNight = typeof night === 'boolean' ? night : phase.night;
  const [sx, sy] = p == null ? [0, 0] : at(p);

  const rise = clockText(sunrise, phase.rise);
  const set = clockText(sunset, phase.set);
  const fallbackLabel = {
    day: `Sun position: ${Math.round((p || 0) * 100)}% of daylight, sunrise ${rise}, sunset ${set}`,
    before: `Before sunrise. Sunrise ${rise}, sunset ${set}`,
    after: `After sunset. Sunrise ${rise}, sunset ${set}`,
    unknown: `Day arc from sunrise at ${rise} to sunset at ${set}`,
  }[phase.phase];

  /** @type {import('react').SVGProps<SVGPathElement>} */
  const dots = { fill: 'none', stroke: w.ink, strokeWidth: 2, strokeLinecap: 'round', strokeDasharray: '0 6' };

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={label || fallbackLabel}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <svg
        aria-hidden="true"
        width="100%"
        height={H}
        viewBox={`0 0 ${r1(W)} ${H}`}
        style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      >
        <line x1="0" y1="70.5" x2={r1(W)} y2="70.5" stroke={w.line} strokeWidth="1" />
        {p == null ? (
          <path d={arc(0, 1)} {...dots} strokeOpacity="0.35" />
        ) : (
          <>
            {p > 0.002 && <path d={arc(0, p)} {...dots} strokeOpacity="0.35" />}
            {p < 0.998 && <path d={arc(p, 1)} {...dots} strokeOpacity="0.15" />}
            {isNight ? (
              <path
                d={MOON}
                transform={`translate(${r1(sx - 8)} ${r1(sy - 8)}) scale(0.6667)`}
                fill="none"
                stroke={w.ink}
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <>
                <circle cx={sx} cy={sy} r="11" fill={rgba(w.sun, 0.28)} />
                <circle cx={sx} cy={sy} r="6" fill={w.sun} stroke={w.ink} strokeWidth="1.5" />
              </>
            )}
          </>
        )}
      </svg>
      <span
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          columnGap: 12,
          marginTop: 6,
          fontFamily: MONO,
          fontSize: fs(10),
          letterSpacing: '0.1em',
          lineHeight: 1.4,
          textTransform: 'uppercase',
          color: NEUTRAL.ink3,
        }}
      >
        <span>Sunrise {rise}</span>
        <span style={{ marginLeft: 'auto' }}>Sunset {set}</span>
      </span>
    </div>
  );
}
