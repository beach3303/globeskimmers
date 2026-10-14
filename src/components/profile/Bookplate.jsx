// Bookplate: whose world this is (bible.profile.header (3); Profile.dc.html L62-75,
// Profile-Visit L59-72). A cream plate framed twice in the owner's cloth, centred: the
// avatar, 'FROM THE TRAVELS OF', the name as the page's h1 in the cloth's italic, the
// handle line, one stats line, the bio and the website.
//
//   <Bookplate mode cloth avatar name handle seal place stats bio website showClaim onClaim
//              onAvatar avatarBusy avatarLabel nameAs kicker className style>
//     children
//   </Bookplate>
//   mode        'own' (your profile), 'visit' (someone else's) or 'edit' (your profile while
//               editing: the avatar becomes a button, and the children take the place of the
//               name, handle, stats, bio and website, so the page puts its fields there).
//   cloth       the owner's cloth key or CLOTH row; Harbour without one.
//   avatar      a photo URL, else the name's initial in Instrument Serif 30 cream on the cloth
//               (a photo that fails to load falls back to the initial).
//   name        the display name (else first name). Without one: '@handle', else 'Your name'
//               on your own plate and 'A traveler' on someone else's.
//   handle      without the '@'. seal: the OfficialSeal tier ('gold', 'burgundy', 'teal',
//               'sunshine-heart', 'sunshine-star'), or true for the default; pass it only when
//               the account is verified. It prints right after the handle, never a checkmark.
//   place       'Los Angeles · United States', or an array of parts. Printed in capitals after
//               the handle. Nothing more precise than a city.
//   stats       { total, countries, verified } (ppStats). Singular at one, a zero stat is left
//               out, 'VERIFIED' only above zero, and a passport with no stamps reads
//               'A NEW PASSPORT'. null while loading: no stats line, never a guessed 0.
//   bio         three lines, then 'More' (and 'Less'), which carries aria-expanded.
//   website     printed without its protocol in mono teal-deep; the link adds https:// when
//               the stored value has none (the worker drops a website without it).
//   showClaim   your own plate without a handle: 'Claim your @username' (teal-deep, underlined)
//               in the handle's place, calling onClaim. Hide it for teens.
//   onAvatar    edit mode: the avatar is a 44px+ button that calls it (pick a photo).
//               avatarBusy shows a spinner; avatarLabel overrides 'Change your photo'.
//   nameAs      the name's element, 'h1' by default.
//
// BookplateStats and statParts(stats) are exported for pages that print the stats line
// elsewhere (edit mode).
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { FOIL, NEUTRAL, fs, rgba } from '@/components/redesign/constants';
import OfficialSeal from '@/components/passport/OfficialSeal';
import { initialOf } from '@/components/social/SocialMarks';
import { clothRow } from './CoverBand';

/** @typedef {import('react').CSSProperties} CSS */

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const NBSP = ' ';

/**
 * A style object that may carry CSS custom properties (--gs-focus).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

const count = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

/**
 * The stats line's parts: null (nothing to print: loading or no data), 'new' (no stamps yet)
 * or [{ n, label }] with zero stats left out and the labels singular at one.
 * @param {any} stats
 * @returns {null | 'new' | Array<{ n: number, label: string }>}
 */
export function statParts(stats) {
  if (!stats || typeof stats !== 'object') return null;
  const total = count(stats.total ?? stats.stamps);
  const countries = count(stats.countries);
  const verified = count(stats.verified);
  if (total === 0) return 'new';
  const parts = [];
  if (total) parts.push({ n: total, label: total === 1 ? 'STAMP' : 'STAMPS' });
  if (countries) parts.push({ n: countries, label: countries === 1 ? 'COUNTRY' : 'COUNTRIES' });
  if (verified) parts.push({ n: verified, label: 'VERIFIED' });
  return parts.length ? parts : null;
}

/**
 * The one stats line (Profile L69-73): serif stamp-red figures, mono ink-3 labels, '·'
 * between them. Renders nothing when statParts gives null.
 * @param {{ stats: any, style?: CSS, className?: string }} props
 */
export function BookplateStats({ stats, style = undefined, className = undefined }) {
  const parts = statParts(stats);
  if (!parts) return null;
  /** @type {CSS} */
  const label = { fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.26, fontWeight: 500, letterSpacing: '.14em', color: NEUTRAL.ink3 };
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        justifyContent: 'center',
        columnGap: 12,
        rowGap: 2,
        minHeight: 24,
        marginTop: 12,
        ...style,
      }}
    >
      {parts === 'new' ? (
        <span style={{ ...label, alignSelf: 'center' }}>A NEW PASSPORT</span>
      ) : (
        parts.map((p, i) => (
          <React.Fragment key={p.label}>
            {i > 0 ? <><span className="sr-only">, </span><span aria-hidden="true" style={label}>·</span></> : null}
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: SERIF, fontSize: fs(22), lineHeight: 24 / 22, color: NEUTRAL.stamp }}>{p.n}</span>
              <span style={label}>{p.label}</span>
            </span>
          </React.Fragment>
        ))
      )}
    </div>
  );
}

// The 72px avatar (Profile L65): the photo or the initial on the cloth, with a foil ring
// 4px inside the edge.
function Avatar({ c, avatar, name, handle }) {
  const [failed, setFailed] = useState(/** @type {string|null} */ (null));
  const photo = typeof avatar === 'string' && avatar.trim() !== '' && failed !== avatar ? avatar : null;
  const letter = initialOf(name, handle);
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 72,
        height: 72,
        flex: 'none',
        overflow: 'hidden',
        borderRadius: 999,
        background: c.cloth,
        fontFamily: SERIF,
        fontSize: `min(${fs(30)}, 44px)`,
        lineHeight: 1,
        color: NEUTRAL.cream,
      }}
    >
      {photo ? (
        <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailed(photo)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        letter || null
      )}
      <span style={{ position: 'absolute', inset: 4, border: `1px solid ${rgba(FOIL, 0.55)}`, borderRadius: 999, pointerEvents: 'none' }} />
    </span>
  );
}

// The bio, clamped to three lines with 'More' only when it is clamped.
function Bio({ text, c }) {
  const id = `bp-bio-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const ref = useRef(/** @type {HTMLParagraphElement|null} */ (null));
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return undefined;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);

  // A new bio starts closed.
  useEffect(() => { setOpen(false); }, [text]);

  return (
    <div style={{ marginTop: 8, maxWidth: '100%' }}>
      <p
        id={id}
        ref={ref}
        style={{
          margin: 0,
          fontSize: fs(14),
          lineHeight: 20 / 14,
          color: NEUTRAL.ink2,
          whiteSpace: 'pre-line',
          overflowWrap: 'anywhere',
          ...(open ? null : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
        }}
      >
        {text}
      </p>
      {clamped || open ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 8px',
            margin: '-6px 0 -10px',
            background: 'transparent',
            border: 0,
            fontSize: fs(13),
            fontWeight: 600,
            color: c.cloth,
            cursor: 'pointer',
          }}
        >
          {open ? 'Less' : 'More'}
        </button>
      ) : null}
    </div>
  );
}

const websiteHref = (w) => (/^https?:\/\//i.test(w) ? w : `https://${w}`);
const websiteText = (w) => w.replace(/^https?:\/\//i, '').replace(/\/$/, '');

/**
 * @param {{
 *   mode?: 'own'|'visit'|'edit', cloth?: any, avatar?: string|null, name?: string|null,
 *   handle?: string|null, seal?: string|boolean|null, place?: string|string[]|null,
 *   stats?: any, bio?: string|null, website?: string|null, showClaim?: boolean,
 *   onClaim?: (e: any) => void, onAvatar?: (e: any) => void, avatarBusy?: boolean,
 *   avatarLabel?: string, nameAs?: any, kicker?: import('react').ReactNode,
 *   className?: string, style?: CSS, children?: import('react').ReactNode,
 * }} props
 */
export default function Bookplate({
  mode = 'own',
  cloth = undefined,
  avatar = null,
  name = null,
  handle = null,
  seal = null,
  place = null,
  stats = null,
  bio = null,
  website = null,
  showClaim = false,
  onClaim = undefined,
  onAvatar = undefined,
  avatarBusy = false,
  avatarLabel = undefined,
  nameAs: Name = 'h1',
  kicker = 'FROM THE TRAVELS OF',
  className = undefined,
  style = undefined,
  children = null,
}) {
  const c = clothRow(cloth);
  const editing = mode === 'edit';
  const own = mode !== 'visit';
  const h = String(handle ?? '').trim().replace(/^@+/, '');
  const shownName = String(name ?? '').trim() || (h ? `@${h}` : own ? 'Your name' : 'A traveler');
  const places = (Array.isArray(place) ? place : String(place ?? '').split(/\s+·\s+/))
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  const sealTier = seal === true ? 'burgundy' : typeof seal === 'string' && seal.trim() ? seal.trim() : null;
  const site = String(website ?? '').trim();
  const about = String(bio ?? '').trim();
  const claim = own && !editing && !h && showClaim && typeof onClaim === 'function';

  /** @type {CSS} */
  const lineStyle = {
    marginTop: 4,
    maxWidth: '100%',
    fontFamily: MONO,
    fontSize: fs(11),
    lineHeight: 16 / 11,
    letterSpacing: '.02em',
    textTransform: 'uppercase',
    overflowWrap: 'anywhere',
    color: NEUTRAL.ink3,
  };
  // Each part keeps its own words together; the line breaks between parts at large text.
  const keep = (s) => s.replace(/ /g, NBSP);

  const avatarEl = editing && typeof onAvatar === 'function' ? (
    <button
      type="button"
      onClick={avatarBusy ? undefined : onAvatar}
      aria-label={avatarLabel || (avatar ? 'Change your photo' : 'Add your photo')}
      aria-busy={avatarBusy || undefined}
      style={{ position: 'relative', display: 'block', padding: 0, margin: 0, background: 'transparent', border: 0, borderRadius: 999, cursor: avatarBusy ? 'progress' : 'pointer' }}
    >
      <Avatar c={c} avatar={avatar} name={name} handle={h} />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -2,
          bottom: -2,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: NEUTRAL.white,
          border: `1px solid ${rgba(c.cloth, 0.45)}`,
          color: c.cloth,
        }}
      >
        {avatarBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} strokeWidth={2} />}
      </span>
    </button>
  ) : (
    <Avatar c={c} avatar={avatar} name={name} handle={h} />
  );

  return (
    <div
      className={className}
      style={css({
        position: 'relative',
        boxSizing: 'border-box',
        padding: 20,
        background: NEUTRAL.cream,
        border: `1px solid ${rgba(c.cloth, 0.45)}`,
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        '--gs-focus': c.cloth,
        ...style,
      })}
    >
      <span aria-hidden="true" style={{ position: 'absolute', inset: 4, border: `1px solid ${rgba(c.cloth, 0.2)}`, borderRadius: 12, pointerEvents: 'none' }} />
      {avatarEl}
      {kicker ? (
        <div style={{ position: 'relative', marginTop: 8, fontFamily: MONO, fontSize: fs(9.5), lineHeight: 12 / 9.5, fontWeight: 500, letterSpacing: '.2em', textTransform: 'uppercase', color: NEUTRAL.ink3 }}>
          {kicker}
        </div>
      ) : null}
      {editing ? (
        children ? <div style={{ position: 'relative', alignSelf: 'stretch', marginTop: 8, textAlign: 'left' }}>{children}</div> : null
      ) : (
        <>
          <Name style={{ position: 'relative', margin: '4px 0 0', maxWidth: '100%', fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 32 / 30, overflowWrap: 'anywhere', color: c.cloth }}>
            <em style={{ fontStyle: 'italic' }}>{shownName}</em>
          </Name>
          {h || places.length ? (
            <div style={{ ...lineStyle, position: 'relative' }}>
              {h ? (
                <span style={{ textTransform: 'none' }}>
                  @{h}
                  {sealTier ? <OfficialSeal size={13} tier={sealTier} style={undefined} /> : null}
                </span>
              ) : null}
              {places.map((p, i) => (
                <React.Fragment key={`${i}-${p}`}>
                  {h || i > 0 ? <><span className="sr-only">, </span><span aria-hidden="true"> · </span></> : null}
                  <span>{keep(p)}</span>
                </React.Fragment>
              ))}
            </div>
          ) : null}
          {claim ? (
            <button
              type="button"
              onClick={onClaim}
              style={{
                position: 'relative',
                minHeight: 44,
                padding: '0 8px',
                margin: '-6px 0 -8px',
                background: 'transparent',
                border: 0,
                fontSize: fs(12),
                fontWeight: 600,
                color: NEUTRAL.tealInk,
                textDecoration: 'underline',
                textUnderlineOffset: 2,
                cursor: 'pointer',
              }}
            >
              Claim your @username
            </button>
          ) : null}
          <BookplateStats stats={stats} style={{ position: 'relative' }} />
          {about ? <Bio text={about} c={c} /> : null}
          {site ? (
            <a
              href={websiteHref(site)}
              target="_blank"
              rel="noreferrer"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                maxWidth: '100%',
                // A 44px target around a 16px line: the text sits where the bible's 4px gap puts it.
                margin: '-4px 0 -12px',
                fontFamily: MONO,
                fontSize: fs(12),
                lineHeight: 1.3,
                overflowWrap: 'anywhere',
                color: NEUTRAL.tealInk,
              }}
            >
              {websiteText(site)}
            </a>
          ) : null}
          {children ? <div style={{ position: 'relative', alignSelf: 'stretch', marginTop: 12 }}>{children}</div> : null}
        </>
      )}
    </div>
  );
}
