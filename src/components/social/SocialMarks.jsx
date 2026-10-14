// SocialMarks: the small marks that stand for people in the new look. Faces on Home's
// circle zone, the profile's orbit, the Circle screen, the visit page and Mailbox all come
// from here, so a person's cloth means the same thing everywhere (bible.profile.
// personalisation: 'the owner's ring wherever their face appears').
//
//   <Face name handle avatar cloth size variant pending youTag ring fill label />
//     A person: their photo, or the first letter of their name (else of their @handle),
//     ringed in their own cloth. Without a cloth, Harbour (principle 14).
//     variant 'solid' (default)  a 1.5px ring in the cloth, a white gap, then the photo or a
//                                cloth disc with a cream initial (Profile L90, Circle L158,
//                                Mailbox L62, L95, L214). The gap is 1px at 20px and 2px from
//                                24px up (the bible's '2px white ring').
//     variant 'paper'            a cream circle ringed 1.5px in the cloth, the initial in the
//                                cloth (Home-Boxes L86, the compact envelope). `fill` swaps
//                                the cream (Main.dc.html L85 fills it with the cloth's paper).
//     pending                    a dashed, empty airmail-blue circle: a request waiting
//                                (Profile L91). No name, no photo.
//     youTag                     a 'YOU' tag hanging 2px under the face, in the cloth
//                                (Profile-Visit L108). The face's box stays size x size, so
//                                an orbit can place it by its centre.
//     ring                       the ring width; the owner's face at an orbit's centre is 2.
//     label                      faces are decorative (aria-hidden) because the name sits
//                                beside them or on the button around them. With a label the
//                                face is one role=img with that name.
//   <VerifiedMark method />
//     'Verified' 11/600 in the open green after a 12px dashed-ring check (Home-Boxes L87,
//     Mailbox L101), never a social tick. method: the stamp's proof ('gps' prints
//     'Verified · GPS', 'photo_loc' and 'photo_ai' print 'Verified · Photo'); anything else
//     prints 'Verified' alone. Render it only when the row says the visit was verified.
//   TwoRingMark: re-exported from the ornaments ('BOTH WAYS', the inner circle).
//
// initialOf(name, handle) is exported for callers that need the same letter.
import React, { useState } from 'react';
import { User } from 'lucide-react';
import { CLOTH, NEUTRAL, clothOf, fs, rgba } from '@/components/redesign/constants';
import { TwoRingMark } from '@/components/redesign/ornaments';

export { TwoRingMark };

/** @typedef {import('react').CSSProperties} CSS */

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

// A cloth from a stored key ('forest'), a CLOTH row, or nothing (Harbour).
function resolveCloth(c) {
  if (c && typeof c === 'object' && typeof c.key === 'string' && Object.prototype.hasOwnProperty.call(CLOTH, c.key)) {
    return CLOTH[c.key];
  }
  return clothOf(typeof c === 'string' ? c : null);
}

// Grapheme clusters where the platform can split them, so 'É' written as E plus an accent,
// or a letter with its marks, stays one letter.
const SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;
const LETTER = /[\p{L}\p{N}]/u;

/**
 * The first letter or digit of the name, else of the handle (without its '@'), in capitals.
 * An emoji or punctuation in front is skipped. Nothing usable gives ''.
 * @param {any} name
 * @param {any} [handle]
 */
export function initialOf(name, handle) {
  for (const s of [name, handle]) {
    const str = String(s ?? '').trim().replace(/^@+/, '');
    if (!str) continue;
    const parts = SEGMENTER ? Array.from(SEGMENTER.segment(str), (x) => x.segment) : Array.from(str);
    const g = parts.find((p) => LETTER.test(p));
    if (g) return g.toUpperCase();
  }
  return '';
}

// The initial's size on the boards (Mailbox L95 10/20, L214 11/24, L62 13/28; Circle L158
// 19/44; the bookplate's 30/72), else about 43% of the face. The paper face sets 12 on 20.
const SOLID_TYPE = { 20: 10, 24: 11, 28: 13, 44: 19, 72: 30 };
const PAPER_TYPE = { 20: 12 };

/**
 * @param {{
 *   name?: string|null, handle?: string|null, avatar?: string|null, cloth?: any, size?: number,
 *   variant?: 'solid'|'paper', pending?: boolean, youTag?: boolean, ring?: number, fill?: string,
 *   label?: string, className?: string, style?: CSS,
 * }} props
 */
export function Face({
  name = undefined,
  handle = undefined,
  avatar = undefined,
  cloth = undefined,
  size = 24,
  variant = 'solid',
  pending = false,
  youTag = false,
  ring = 1.5,
  fill = undefined,
  label = undefined,
  className = undefined,
  style = undefined,
}) {
  // The photo URL that failed to load: the face falls back to the initial.
  const [failed, setFailed] = useState(/** @type {string|null} */ (null));
  const c = resolveCloth(cloth);
  const s = Math.max(12, Math.round(Number(size) || 24));
  const rw = Number.isFinite(Number(ring)) && Number(ring) > 0 ? Number(ring) : 1.5;
  const paper = variant === 'paper';
  const photo = typeof avatar === 'string' && avatar.trim() !== '' && failed !== avatar ? avatar : null;
  const letter = initialOf(name, handle);
  const named = typeof label === 'string' && label.trim() !== '';

  /** @type {CSS} */
  const box = { display: 'flex', width: s, height: s, flex: 'none', boxSizing: 'border-box', borderRadius: 999 };
  const gap = paper ? 0 : s <= 20 ? 1 : s < 24 ? 1.5 : 2;
  const inner = Math.max(4, s - 2 * rw - 2 * gap);
  // The initial follows the text size but never outgrows its disc.
  const type = (paper ? PAPER_TYPE[s] : SOLID_TYPE[s]) || Math.round(s * (paper ? 0.6 : 0.43));
  /** @type {CSS} */
  const letterStyle = {
    fontFamily: SERIF,
    fontSize: `min(${fs(type)}, ${Math.floor(inner * 0.8)}px)`,
    lineHeight: 1,
    color: paper ? c.cloth : NEUTRAL.cream,
  };
  const img = photo ? (
    <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailed(photo)}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 999 }} />
  ) : null;
  const glyph = letter
    ? <span style={letterStyle}>{letter}</span>
    : <User size={Math.max(8, Math.round(inner * 0.6))} strokeWidth={2} color={paper ? c.cloth : NEUTRAL.cream} aria-hidden="true" focusable="false" />;

  let disc;
  if (pending) {
    disc = <span style={{ ...box, background: NEUTRAL.white, border: `1.5px dashed ${rgba(NEUTRAL.airmailBlue, 0.6)}` }} />;
  } else if (paper) {
    disc = (
      <span style={{ ...box, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: fill || NEUTRAL.cream, border: `${rw}px solid ${c.cloth}` }}>
        {img || glyph}
      </span>
    );
  } else {
    disc = (
      <span style={{ ...box, padding: gap, background: NEUTRAL.white, border: `${rw}px solid ${c.cloth}` }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 999, background: c.cloth }}>
          {img || glyph}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden={named ? undefined : 'true'}
      role={named ? 'img' : undefined}
      aria-label={named ? label : undefined}
      className={className}
      style={{ position: 'relative', display: 'inline-flex', flex: 'none', width: s, height: s, verticalAlign: 'middle', ...style }}
    >
      {disc}
      {youTag && !pending ? (
        <span
          style={{
            position: 'absolute',
            top: s + 2,
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 24,
            minHeight: 12,
            boxSizing: 'border-box',
            padding: '0 3px',
            borderRadius: 3,
            background: NEUTRAL.airmailUnread,
            fontFamily: MONO,
            fontSize: fs(8),
            lineHeight: '12px',
            fontWeight: 500,
            letterSpacing: '.08em',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            color: c.cloth,
          }}
        >
          YOU
        </span>
      ) : null}
    </span>
  );
}

// The proof a stamp's verified field names, as the envelope prints it.
const METHOD = { gps: 'GPS', photo_loc: 'Photo', photo_ai: 'Photo', GPS: 'GPS', Photo: 'Photo' };

/**
 * @param {{ method?: string|null, className?: string, style?: CSS }} props
 */
export function VerifiedMark({ method = undefined, className = undefined, style = undefined }) {
  const how = typeof method === 'string' && Object.prototype.hasOwnProperty.call(METHOD, method) ? METHOD[method] : null;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: fs(11),
        fontWeight: 600,
        lineHeight: 14 / 11,
        color: NEUTRAL.open,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false" style={{ display: 'block', flex: 'none' }}>
        <circle cx="6" cy="6" r="5" stroke={NEUTRAL.open} strokeWidth="1.2" strokeDasharray="2.2 1.6" />
        <path d="M3.7 6.2 5.3 7.7 8.4 4.6" stroke={NEUTRAL.open} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        Verified
        {how ? <><span aria-hidden="true"> ·</span> {how}</> : null}
      </span>
    </span>
  );
}
