import React from 'react';

// Chunky CTA — per Claude-design spec.
// Height 44 (md) / 54 (lg), radius 14/16, weight 600.
// Shadow combines outer drop + inner highlight for the "press-ready" feel.
//
// Props:
//   color: bg color (defaults to ink #0F1419 — primary CTA).
//   textColor: defaults to #fff. Pass darker color when using a soft cat.bg
//              (secondary "go-back" / "alternate" CTAs).
//   icon: optional lucide icon component (left of label).
//   size: 'md' (default, height 44) or 'lg' (height 54).
//   onClick, style, className: passthrough.
export default function ChunkyBtn({
  children,
  color = '#0F1419',
  textColor = '#fff',
  icon: Icon,
  size = 'md',
  onClick,
  style = {},
  className = '',
}) {
  const isLg = size === 'lg';
  return (
    <button
      onClick={onClick}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: isLg ? 54 : 44,
        padding: isLg ? '0 22px' : '0 18px',
        borderRadius: isLg ? 16 : 14,
        background: color,
        color: textColor,
        fontFamily: '"Inter Tight", ui-sans-serif, system-ui, sans-serif',
        fontWeight: 600,
        fontSize: isLg ? '15.5px' : '14px',
        letterSpacing: '0.005em',
        border: 'none',
        cursor: 'pointer',
        boxShadow:
          '0 6px 18px -6px rgba(0,0,0,.25), 0 1px 0 rgba(255,255,255,.18) inset',
        transition: 'transform 180ms ease, box-shadow 200ms ease',
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {Icon && <Icon size={16} color={textColor} strokeWidth={2} />}
      {children}
    </button>
  );
}
