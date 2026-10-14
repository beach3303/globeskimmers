// FinderEmptyState — the one designed empty/error card for finders, printed in the page's
// world (the bible's shared finder frame, part 6). Replaces the ad-hoc "No matches" boxes
// and the dead "Expand radius" buttons: every finder already searches the 25-mile net, so
// the honest actions are "search somewhere else" and "clear filters". It has no
// "Expand radius" action of its own.
//
// White card, radius 16, 1px world line; a 32px lucide icon in the world ink; the title in
// Instrument Serif 20; a 13px #3A3128 hint; ONE outline action in the world ink (44px,
// radius 14); an optional secondary as an underlined link. Text wraps at any size.
//
// Props:
//   world          WORLD row or key ('eat'); catKey is the legacy alias ('food').
//   icon           lucide icon component.
//   title          the line ("No cafés match", "Couldn't load ATMs").
//   hint           the explanation under the title (legacy alias: reason).
//   actionLabel, onAction        the one action; it renders only with both.
//   secondaryLabel, onSecondary  the quiet secondary link ("Clear filters").
//   role           'status' by default, so a screen reader hears the change; pass 'alert'
//                  for an error the traveler must notice, or null for none.
//   className, style
import React from 'react';
import { NEUTRAL, fs } from '@/components/redesign/constants';
import { worldRow } from './FinderControls';

const ED_SERIF = '"Instrument Serif", Georgia, serif';

/**
 * @param {{
 *   world?: any, catKey?: string, icon?: any, title?: import('react').ReactNode,
 *   hint?: import('react').ReactNode, reason?: import('react').ReactNode,
 *   actionLabel?: string, onAction?: () => void, secondaryLabel?: string, onSecondary?: () => void,
 *   role?: string|null, className?: string, style?: import('react').CSSProperties,
 * }} props
 */
export default function FinderEmptyState({
  world = undefined,
  catKey = undefined,
  icon: Icon = undefined,
  title = undefined,
  hint = undefined,
  reason = undefined,
  actionLabel = undefined,
  onAction = undefined,
  secondaryLabel = undefined,
  onSecondary = undefined,
  role = 'status',
  className = undefined,
  style = undefined,
}) {
  const w = worldRow(world != null ? world : catKey);
  const text = hint ?? reason;

  return (
    <div
      role={role || undefined}
      className={className}
      style={{
        boxSizing: 'border-box',
        maxWidth: 448,
        margin: '0 auto',
        padding: '28px 20px',
        textAlign: 'center',
        background: NEUTRAL.white,
        border: `1px solid ${w.line}`,
        borderRadius: 16,
        overflowWrap: 'break-word',
        ...style,
      }}
    >
      {Icon ? <Icon size={32} color={w.ink} strokeWidth={1.8} aria-hidden="true" focusable="false" style={{ display: 'block', margin: '0 auto 12px' }} /> : null}
      {title ? (
        <div style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>
          {title}
        </div>
      ) : null}
      {text ? (
        <div style={{ marginTop: 6, fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
          {text}
        </div>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            marginTop: 16,
            boxSizing: 'border-box',
            padding: '0 18px',
            borderRadius: 14,
            background: NEUTRAL.white,
            border: `1px solid ${w.ink}`,
            color: w.ink,
            fontFamily: 'inherit',
            fontSize: fs(14),
            lineHeight: 1.2,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <div style={{ marginTop: actionLabel && onAction ? 4 : 12 }}>
          <button
            type="button"
            onClick={onSecondary}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 4px',
              background: 'transparent',
              border: 0,
              color: NEUTRAL.ink2,
              fontFamily: 'inherit',
              fontSize: fs(13),
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              cursor: 'pointer',
            }}
          >
            {secondaryLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
