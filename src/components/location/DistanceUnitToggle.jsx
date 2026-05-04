import React from 'react';

// Shared mi/km toggle pill. Two visual modes:
//   variant="dark"  — for dark gradient page headers (translucent white).
//   variant="light" — for light page surfaces (outlined neutral).
export default function DistanceUnitToggle({ unit, setUnit, variant = 'light', style = {} }) {
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
    <div style={wrapStyle}>
      <button onClick={() => setUnit('mi')} style={btnStyle(unit === 'mi')}>MI</button>
      <button onClick={() => setUnit('km')} style={btnStyle(unit === 'km')}>KM</button>
    </div>
  );
}
