// Crests: each finder's disc and icon, the same everywhere the finder is offered (Home's
// services chips, the All services grid, the destination strip), so the colour you tap is
// the colour the page opens in (bible.home.zones[services]). Colours come from WORLD
// (crest, crestIcon), icons from WORLD_ICON (finder/motifs).
//
//   <Crest world size label>      The disc: WORLD.crest with the world's lucide icon in
//        WORLD.crestIcon at a 2px stroke. size 28 (chips, 16px icon), 30 (16px icon; the
//        Palettes board) or 36 (tiles, 20px icon); another number scales the icon to 4/7.
//        Decorative (aria-hidden) unless label is given, then role=img with that name.
//        Renders nothing for an unknown world.
//   <CrestChip world|icon label quiet onClick>  A 44px pill button (Home-Boxes L123-144):
//        white, 1px kraft chip line, the 28px crest then the label (the world's name by
//        default) in 13.5/600 ink. With icon (a lucide component) and no world, a bare 16px
//        icon leads instead of a disc. quiet: the 'All services' chip, transparent with a
//        1px umber edge and umber label. Other props (aria-haspopup, aria-expanded, ...)
//        go on the button.
//   <ServiceTile world label onClick>  The All services grid tile: white, radius 18, 1px
//        cream rule, the 36px crest over the label (12.5/600 ink), min-height 88, full width
//        of its grid cell. The label wraps at its spaces; a one-word label hyphenates where
//        the platform can; nothing clips. Other props go on the button.
//
// world is a WORLD row or any key worldOf() reads ('eat', 'food', 'PlacesToEat').
import React from 'react';
import { NEUTRAL, ZONE, fs, worldOf } from './constants';
import { iconOf } from '@/components/finder/motifs';

/** @typedef {import('react').CSSProperties} CSS */

const rowOf = (world) => (world && typeof world === 'object' ? world : worldOf(world));

const ICON_PX = { 28: 16, 30: 16, 36: 20 };

/**
 * @param {{ world: any, size?: number, label?: string, style?: CSS, className?: string }} props
 */
export function Crest({ world, size = 28, label = undefined, style = undefined, className = undefined }) {
  const w = rowOf(world);
  if (!w) return null;
  const Icon = iconOf(w);
  const s = Number(size) > 0 ? Number(size) : 28;
  const px = ICON_PX[s] || Math.round((s * 4) / 7);
  const named = typeof label === 'string' && label.trim() !== '';
  return (
    <span
      role={named ? 'img' : undefined}
      aria-label={named ? label : undefined}
      aria-hidden={named ? undefined : 'true'}
      className={className}
      style={{
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: s,
        height: s,
        borderRadius: 999,
        background: w.crest,
        ...style,
      }}
    >
      {Icon ? <Icon size={px} color={w.crestIcon} strokeWidth={2} aria-hidden="true" focusable="false" style={{ display: 'block' }} /> : null}
    </span>
  );
}

/**
 * @param {{ world?: any, icon?: any, label?: import('react').ReactNode, quiet?: boolean, onClick?: (e: any) => void, className?: string, style?: CSS, [key: string]: any }} props
 */
export function CrestChip({ world = undefined, icon: Icon = undefined, label = undefined, quiet = false, onClick = undefined, className = undefined, style = undefined, ...rest }) {
  const w = world ? rowOf(world) : null;
  const ink = quiet ? ZONE.services.tab : NEUTRAL.ink;
  const text = label ?? (w ? w.label : '');
  let lead = null;
  if (w) lead = <Crest world={w} size={28} />;
  else if (Icon) lead = <Icon size={16} color={ink} strokeWidth={2} aria-hidden="true" focusable="false" style={{ display: 'block', flex: 'none' }} />;
  return (
    <button
      type="button"
      {...rest}
      onClick={onClick}
      className={className}
      style={{
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        boxSizing: 'border-box',
        margin: 0,
        // The crest sits 6px in from the pill's edge; a bare icon 12px (L139).
        padding: w ? '6px 14px 6px 6px' : '6px 14px 6px 12px',
        borderRadius: 999,
        background: quiet ? 'transparent' : NEUTRAL.white,
        border: `1px solid ${quiet ? ZONE.services.tab : ZONE.services.chipLine}`,
        fontSize: fs(13.5),
        fontWeight: 600,
        lineHeight: 1,
        color: ink,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        ...style,
      }}
    >
      {lead}
      {text}
    </button>
  );
}

/**
 * @param {{ world: any, label?: import('react').ReactNode, onClick?: (e: any) => void, className?: string, style?: CSS, [key: string]: any }} props
 */
export function ServiceTile({ world, label = undefined, onClick = undefined, className = undefined, style = undefined, ...rest }) {
  const w = rowOf(world);
  if (!w) return null;
  const text = label ?? w.label;
  // A one-word label too long for a narrow tile at a large text size ('Convenience')
  // hyphenates where the platform can (iOS, Android; the page is lang="en"). A label of
  // several words wraps at its spaces instead, so 'Money exchange' never becomes
  // 'Money ex-change'. Breaking inside a word is the last resort; nothing clips.
  const hyphenate = typeof text === 'string' && !/\s/.test(text.trim()) ? 'auto' : 'manual';
  return (
    <button
      type="button"
      {...rest}
      onClick={onClick}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        minWidth: 0,
        minHeight: 88,
        boxSizing: 'border-box',
        margin: 0,
        padding: '12px 6px',
        borderRadius: 18,
        background: NEUTRAL.white,
        border: `1px solid ${NEUTRAL.creamRule}`,
        fontSize: fs(12.5),
        fontWeight: 600,
        lineHeight: 1.2,
        color: NEUTRAL.ink,
        textAlign: 'center',
        cursor: 'pointer',
        ...style,
      }}
    >
      <Crest world={w} size={36} />
      <span style={{ display: 'block', maxWidth: '100%', overflowWrap: 'break-word', hyphens: hyphenate, WebkitHyphens: hyphenate }}>{text}</span>
    </button>
  );
}

export default Crest;
