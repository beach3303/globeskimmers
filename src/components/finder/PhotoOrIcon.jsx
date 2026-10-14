// PhotoOrIcon — the unified finder-card photo (Passport Standard; the new look's card
// photo with `world`).
//
// With `world` (the new look; the bible's shared finder frame, part 5):
//   Strip or photo is decided up front from photos.length. No photos: the world's no-photo
//   strip (WorldStrip below). Photos: a frame at the world's photo aspect (16:10; 16:9 for
//   Restrooms and ATMs; `aspect` overrides) on the world wash, showing the first photo that
//   loads and moving to the next on an error; if none loads, the frame keeps its size and
//   shows the world's icon on the wash, so the card never jumps. split shows the first two
//   photos side by side. children are overlays drawn on top (NumberMark, pills); litWindow
//   draws Convenience's 3px lit line along the bottom edge (only for stores open all day).
//   onClick(i) makes the photo a button ('View photos of {alt}'), apart from the overlays.
// Without `world` (the legacy look, for the finders not yet moved): the first working
// photo at `height` (default 160), else the lucide `fallbackIcon` on the `tint` gradient,
// exactly as before.
//
// Props: photos (URLs; holes tolerated), alt, world, aspect, height, children, litWindow,
// split, onClick, className, style; strip: icon (or the legacy fallbackIcon; default the
// world's icon), name (Coffee's strip prints its initial), stripContent (replaces the
// strip's drawing), stripHeight; legacy: tint, iconSize.
//
// WorldStrip({ world, icon, name, height, content, litWindow, children }): the no-photo
// strip on its own, as each board draws it (Eat L92-97, Coffee L77-84, ThingsToDo L193-195,
// Restrooms L111-113, ATMs L93-95, Convenience L71-75, Shopping L88-95): the world's strip
// colour, its motif and the world icon, never an emoji or a stock image. content replaces
// the drawing; children are overlays. Decorative: hidden from screen readers, apart from
// overlays that speak for themselves.
import React, { useState } from 'react';
import { NEUTRAL, TEAL_DEEP, IVORY_2, rgba } from '@/components/redesign/constants';
import { CupRing, Contours, LitWindow, MenuLeader, SecurityTint, Tile, iconOf } from '@/components/finder/motifs';
import { worldRow } from './FinderControls';

/** @typedef {import('react').CSSProperties} CSS */

function tintStyles(tint) {
  if (tint && typeof tint === 'object') {
    return {
      gradient: `linear-gradient(135deg, ${tint.bg}, ${tint.soft || tint.bg})`,
      ink: tint.ink,
    };
  }
  if (typeof tint === 'string' && tint) {
    return { gradient: `linear-gradient(135deg, ${tint}22, ${tint}44)`, ink: tint };
  }
  return { gradient: `linear-gradient(135deg, ${IVORY_2}, #EDE7D9)`, ink: TEAL_DEEP };
}

// ── The no-photo strip ───────────────────────────────────────────────────

const glyph = (Icon, color, size = 22, style = undefined) =>
  Icon ? <Icon size={size} color={color} strokeWidth={2} aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0, ...style }} /> : null;

/** @type {CSS} */
const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };
/** @type {CSS} */
const centre = { ...fill, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function stripDrawing(w, Icon, name) {
  switch (w.key) {
    case 'eat':
      return (
        <span style={{ ...centre, gap: 12, padding: '0 56px' }}>
          <MenuLeader world={w} variant="strip" />
          {glyph(Icon, w.plateAccent)}
          <MenuLeader world={w} variant="strip" />
        </span>
      );
    case 'coffee': {
      const initial = typeof name === 'string' ? name.trim().charAt(0).toUpperCase() : '';
      return (
        <span style={centre}>
          <CupRing world={w} variant="card">{initial || glyph(Icon, w.plateTitle, 26)}</CupRing>
        </span>
      );
    }
    case 'todo':
      return (
        <>
          <Contours world={w} variant="card" />
          <span style={centre}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 46,
                height: 46,
                boxSizing: 'border-box',
                borderRadius: 999,
                background: w.plateTitle,
                border: `1px solid ${rgba(w.ink, 0.22)}`,
              }}
            >
              {glyph(Icon, w.ink, 20)}
            </span>
          </span>
        </>
      );
    case 'restroom':
      return (
        <>
          <Tile world={w} variant="strip" />
          <span style={{ ...fill, right: 'auto', left: 54, display: 'flex', alignItems: 'center' }}>{glyph(Icon, w.ink)}</span>
        </>
      );
    case 'atm':
      return (
        <>
          <SecurityTint world={w} variant="strip" />
          <span style={{ ...fill, right: 'auto', left: 54, display: 'flex', alignItems: 'center' }}>{glyph(Icon, w.ink)}</span>
        </>
      );
    case 'convenience':
      return <span style={{ ...fill, left: 'auto', right: 16, display: 'flex', alignItems: 'center' }}>{glyph(Icon, w.plateAccent)}</span>;
    case 'shopping':
      return (
        <>
          <span style={{ ...fill, backgroundImage: `repeating-linear-gradient(135deg, ${rgba(w.plate, 0.07)} 0 1px, transparent 1px 8px)` }} />
          <span style={{ ...centre, opacity: 0.55 }}>{glyph(Icon, w.plate)}</span>
        </>
      );
    default:
      return <span style={centre}>{glyph(Icon, w.ink)}</span>;
  }
}

/**
 * @param {{
 *   world?: any, icon?: any, name?: string, height?: number, content?: import('react').ReactNode,
 *   litWindow?: boolean, children?: import('react').ReactNode, className?: string, style?: CSS,
 * }} props
 */
export function WorldStrip({
  world = undefined,
  icon = undefined,
  name = undefined,
  height = undefined,
  content = undefined,
  litWindow = false,
  children = undefined,
  className = undefined,
  style = undefined,
}) {
  const w = worldRow(world);
  const Icon = icon || iconOf(w);
  const h = Number(height) > 0 ? Number(height) : (w.strip && w.strip.height) || 72;
  return (
    <div
      className={className}
      style={{ position: 'relative', overflow: 'hidden', minHeight: h, background: (w.strip && w.strip.bg) || w.wash, ...style }}
    >
      <span aria-hidden="true" style={{ ...fill, pointerEvents: 'none' }}>
        {content != null && content !== false ? content : stripDrawing(w, Icon, name)}
      </span>
      {litWindow ? <LitWindow world={w} /> : null}
      {children}
    </div>
  );
}

// ── One photo, tried in order ────────────────────────────────────────────

/**
 * @param {{ urls: string[], alt: string, w: any, Icon?: any, onOpen?: (i: number) => void, label?: string, style?: CSS }} props
 */
function Photo({ urls, alt, w, Icon = undefined, onOpen = undefined, label = undefined, style = undefined }) {
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState({});
  const shownIdx = urls.findIndex((u, i) => u && !errors[i]);
  const url = shownIdx >= 0 ? urls[shownIdx] : null;
  const img = url ? (
    <img
      src={url}
      alt={onOpen ? '' : alt}
      loading="lazy"
      decoding="async"
      onError={() => setErrors((p) => ({ ...p, [shownIdx]: true }))}
      onLoad={() => setLoaded((p) => ({ ...p, [shownIdx]: true }))}
      style={{ ...fill, width: '100%', height: '100%', objectFit: 'cover', opacity: loaded[shownIdx] ? 1 : 0, transition: 'opacity 0.4s' }}
    />
  ) : null;
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: w.wash, ...style }}>
      {!url || !loaded[shownIdx] ? (
        <span aria-hidden="true" style={{ ...centre, pointerEvents: 'none' }}>
          {glyph(Icon, w.iconInk, 28, { opacity: 0.55 })}
        </span>
      ) : null}
      {onOpen && url ? (
        <button
          type="button"
          aria-label={label}
          onClick={() => onOpen(shownIdx)}
          style={{ ...fill, display: 'block', width: '100%', height: '100%', padding: 0, margin: 0, border: 0, background: 'transparent', cursor: 'pointer', outlineOffset: -4 }}
        >
          {img}
        </button>
      ) : (
        img
      )}
    </div>
  );
}

/**
 * @param {{
 *   photos?: any[], alt?: string, fallbackIcon?: any, icon?: any, tint?: any, height?: number|string,
 *   className?: string, onClick?: (i?: number) => void, iconSize?: number, world?: any, aspect?: string,
 *   children?: import('react').ReactNode, litWindow?: boolean, stripContent?: import('react').ReactNode,
 *   stripHeight?: number, name?: string, split?: boolean, style?: CSS,
 * }} props
 */
export default function PhotoOrIcon({
  photos = undefined,
  alt = '',
  fallbackIcon: Icon = undefined,
  icon = undefined,
  tint = undefined,
  height = undefined,
  className = '',
  onClick = undefined,
  iconSize = 44,
  world = undefined,
  aspect = undefined,
  children = undefined,
  litWindow = false,
  stripContent = undefined,
  stripHeight = undefined,
  name = undefined,
  split = false,
  style = undefined,
}) {
  // The legacy path's state; declared on both paths so the hook order never changes.
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState({});

  if (world) {
    const w = worldRow(world);
    const StripIcon = icon || Icon || iconOf(w);
    const list = (Array.isArray(photos) ? photos : []).filter((p) => typeof p === 'string' && p);
    if (!list.length) {
      return (
        <WorldStrip world={w} icon={StripIcon} name={name || alt} height={stripHeight} content={stripContent} litWindow={litWindow} className={className || undefined} style={style}>
          {children}
        </WorldStrip>
      );
    }
    const label = alt ? `View photos of ${alt}` : 'View photos';
    /** @type {CSS} */
    const frame = {
      position: 'relative',
      overflow: 'hidden',
      background: w.wash,
      ...(height != null ? { height: typeof height === 'number' ? `${height}px` : height } : { aspectRatio: aspect || w.photoAspect || '16 / 10' }),
      ...style,
    };
    const open = onClick ? (i) => onClick(i) : undefined;
    return (
      <div className={className || undefined} style={frame}>
        {split && list.length > 1 ? (
          <div style={{ ...fill, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: NEUTRAL.white }}>
            <Photo urls={[list[0]]} alt={alt} w={w} Icon={StripIcon} onOpen={open ? () => open(0) : undefined} label={label} style={{ height: '100%' }} />
            <Photo urls={[list[1]]} alt={alt} w={w} Icon={StripIcon} onOpen={open ? () => open(1) : undefined} label={label} style={{ height: '100%' }} />
          </div>
        ) : (
          <Photo urls={list} alt={alt} w={w} Icon={StripIcon} onOpen={open} label={label} style={{ ...fill }} />
        )}
        {litWindow ? <LitWindow world={w} /> : null}
        {children}
      </div>
    );
  }

  // ── Legacy look ──
  const H = height == null ? '160px' : typeof height === 'number' ? `${height}px` : height;
  const { gradient, ink } = tintStyles(tint);
  const shownIdx = (photos || []).findIndex((p, i) => p && !errors[i]);
  const url = shownIdx >= 0 ? photos[shownIdx] : null;

  const fallbackTile = (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: gradient }}
      aria-hidden={url ? true : undefined}
    >
      {Icon && <Icon size={iconSize} color={ink} strokeWidth={1.6} />}
    </div>
  );

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ height: H, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick ? () => (shownIdx >= 0 ? onClick(shownIdx) : onClick()) : undefined}
    >
      {(!url || !loaded[shownIdx]) && fallbackTile}
      {url && (
        <img
          src={url}
          alt={alt}
          onError={() => setErrors((p) => ({ ...p, [shownIdx]: true }))}
          onLoad={() => setLoaded((p) => ({ ...p, [shownIdx]: true }))}
          style={{ width: '100%', height: H, objectFit: 'cover', opacity: loaded[shownIdx] ? 1 : 0, transition: 'opacity 0.4s' }}
        />
      )}
      {children}
    </div>
  );
}
