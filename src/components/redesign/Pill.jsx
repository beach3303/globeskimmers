import React from 'react';

// Pill / badge — per Claude-design spec.
// Padding 6×12, radius 999, weight 600, ~12.5px.
// Tinted by category (pass cat.bg + cat.ink) or neutral defaults.
//
// Props:
//   bg, color: pass cat.bg + cat.ink for category-tinted; defaults are neutral.
//   icon: optional lucide icon component (rendered at 13px).
//   fontSize: override default 12.5px (e.g. for small chips inside cards).
export default function Pill({
  children,
  bg = '#F3F4F6',
  color = '#374151',
  icon: Icon,
  fontSize = 12.5,
  style = {},
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 9999,
        background: bg,
        color,
        fontWeight: 600,
        fontSize,
        fontFamily: '"Inter Tight", ui-sans-serif, system-ui, sans-serif',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {Icon && <Icon size={13} color={color} strokeWidth={2} />}
      {children}
    </span>
  );
}
