import React from 'react';
import { NEUTRAL, worldOf, fs } from '@/components/redesign/constants';

// Shared mi/km toggle pill. Three visual modes:
//   variant="plate" — on a finder plate (FinderHeader's location row; Eat.dc.html L56-59):
//                     a 32px pill in the world's unitPill tokens (dark plates: a glass
//                     track with the active segment in plateTitle and a plate-colour label;
//                     light plates: white with the active segment in ink and white). 26px
//                     segments inside 44px hit areas. world: a WORLD row or key (night:
//                     Weather's night plate). options and label let the same pill switch
//                     another unit (Weather's °F/°C, label 'Temperature unit').
//   variant="dark"  — for dark gradient page headers (translucent white).
//   variant="light" — for light page surfaces (outlined neutral).
// Every variant is a role=group of aria-pressed buttons.
const UNITS = [
  { value: 'mi', label: 'MI' },
  { value: 'km', label: 'KM' },
];

/**
 * @param {{
 *   unit?: string|null, setUnit?: (u: string) => void, variant?: 'light'|'dark'|'plate',
 *   world?: any, night?: boolean, options?: { value: string, label: string }[],
 *   label?: string, style?: import('react').CSSProperties,
 * }} props
 */
export default function DistanceUnitToggle({
  unit = null,
  setUnit = undefined,
  variant = 'light',
  world = undefined,
  night = false,
  options = UNITS,
  label = 'Distance unit',
  style = {},
}) {
  const choose = (v) => {
    if (typeof setUnit === 'function' && v !== unit) setUnit(v);
  };

  if (variant === 'plate') {
    const w = world && typeof world === 'object' ? world : worldOf(world, { night });
    const pill = w?.unitPill || { track: NEUTRAL.white, border: NEUTRAL.rule, on: NEUTRAL.ink, onInk: NEUTRAL.white, off: NEUTRAL.ink2 };
    return (
      <div
        role="group"
        aria-label={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          minHeight: 32,
          boxSizing: 'border-box',
          borderRadius: 999,
          border: `1px solid ${pill.border}`,
          background: pill.track,
          ...style,
        }}
      >
        {options.map((o) => {
          const on = unit === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => choose(o.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 44,
                minHeight: 44,
                // The hit area is 44px; the pill stays 32px tall.
                margin: '-7px 0',
                padding: '0 2px',
                background: 'transparent',
                border: 0,
                outlineOffset: -2,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 40,
                  minHeight: 26,
                  boxSizing: 'border-box',
                  padding: '0 9px',
                  borderRadius: 999,
                  background: on ? pill.on : 'transparent',
                  color: on ? pill.onInk : pill.off,
                  fontSize: fs(11.5),
                  lineHeight: 1,
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const isDark = variant === 'dark';
  const wrapStyle = {
    display: 'inline-flex',
    gap: '2px',
    padding: '3px',
    borderRadius: '10px',
    background: isDark ? 'rgba(255,255,255,0.12)' : '#F1F5F9',
    border: isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid #E2E8F0',
    ...style
  };
  const btnStyle = (active) => ({
    padding: '5px 12px',
    borderRadius: '8px',
    border: 'none',
    background: active ? (isDark ? 'rgba(255,255,255,0.95)' : '#1E3A5F') : 'transparent',
    color: active ? (isDark ? '#1E3A5F' : '#fff') : (isDark ? 'rgba(255,255,255,0.85)' : '#64748B'),
    fontWeight: '700',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.3px'
  });
  return (
    <div role="group" aria-label={label} style={wrapStyle}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={unit === o.value} onClick={() => choose(o.value)} style={btnStyle(unit === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
