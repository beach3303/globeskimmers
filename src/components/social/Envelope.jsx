// Envelope: one piece of news from your circle, as a letter on airmail stock. Home's circle
// zone shows the compact envelope (Home-Boxes L80-89); Mailbox shows the full one
// (Mailbox L84-105). Both read a social/feed row as the worker sends it and print only
// what the row says.
//
//   <Envelope row variant me onClick href as className style />
//   row      a social/feed row: { type 'stamp'|'postcard', name, city, country, kind,
//            visited_on, created_at, verified, film, by: { name, handle, cloth?, avatar? } }
//            for a stamp; a postcard carries photo, message, place, to_me instead of the
//            stamp fields. Rows from blocked people must be dropped by the caller first.
//   variant  'compact' (default)  190px wide (it follows the text size): a 3px airmail
//            chevron, a 20px paper face and 'THEO · YESTERDAY', 'stamped *Torre de Belém*'
//            in Instrument Serif 16, then 'Verified' and the mono place line. A postcard
//            adds its 3:2 photo above and its message in serif italic (three lines at
//            most; Mailbox has the whole card).
//            'full'  the Mailbox letter: the stamp on a cream square tilted -3 degrees with
//            a postmark across its corner, a 20px solid face and the time, the line in
//            Instrument Serif 18, then the place, 'Verified · GPS' when the row names the
//            proof, and 'FILMED HERE: …' when the stamp has a film. Mailbox's own
//            PostcardCard draws postcards there; a postcard row here shows its photo on
//            the square.
//   me       the viewer's @handle (or { handle }): their own rows read 'You'.
//   onClick  the whole envelope becomes one <button>; href makes it an <a>; otherwise it
//            is an <article> (full) or a <div> (compact), or `as`.
//
// The words (bible.word.lines): 'stamped *Griffith Observatory*'; 'landed at *LAX*' when an
// airport stamp's name ends in its bracketed code, else 'landed at *<the full name>*';
// 'sent a postcard from *Lisbon*'. The sender is the first word of their name, else
// '@handle', else 'A traveler'. 'Verified' prints only when row.verified is true. The place
// line is the city and the two-letter country ('LISBON · PT'), with the code taken as-is
// when the row already stores one.
//
// Until the feed sends a stamp's id, kind, region and art key (backend item B6), airport and
// state envelopes show a postmark ring holding the city where the stamp would be; a place
// of respect prints typographic (StampThumb feedSafe).
//
// Helpers for the slices: senderName, whenLabel, placeLine, envelopeTitle, PostmarkRing.
import React from 'react';
import { NEUTRAL, fs, rgba } from '@/components/redesign/constants';
import { AirmailChevron, PostmarkLines } from '@/components/redesign/ornaments';
import StampThumb, { stampThumbKind } from '@/components/passport/StampThumb';
import { airportCodeIn, feedStamp, stampCountryCode } from '@/lib/stampKind';
import { Face, VerifiedMark } from './SocialMarks';

/** @typedef {import('react').CSSProperties} CSS */

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

const handleOf = (v) => String((v && typeof v === 'object' ? v.handle : v) ?? '').trim().replace(/^@+/, '').toLowerCase();

/**
 * Who sent a row: the first word of by.name, else '@handle', else 'A traveler'. The
 * viewer's own rows ('me' is their handle) read 'You'.
 * @param {any} by
 * @param {any} [me]
 */
export function senderName(by, me) {
  const h = handleOf(by);
  const mine = handleOf(me);
  if (h && mine && h === mine) return 'You';
  const first = String(by?.name ?? '').trim().split(/\s+/)[0];
  if (first) return first;
  return h ? `@${h}` : 'A traveler';
}

/**
 * When, in calendar days on this device: 'today', 'yesterday', '3d ago' (under a week), then
 * 'Oct 5'. Unreadable dates give ''.
 * @param {any} iso
 * @param {number} [now]
 */
export function whenLabel(iso, now = Date.now()) {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return '';
  const day = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const days = Math.round((day(now) - day(t)) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * 'LISBON · PT': the city and the two-letter country, in capitals. Either part may be
 * missing; a country name we can't resolve is left out.
 * @param {any} city
 * @param {any} country
 */
export function placeLine(city, country) {
  return [String(city ?? '').trim(), stampCountryCode(country)].filter(Boolean).join(' · ').toUpperCase();
}

/**
 * The envelope's line as { verb, place, rest } (place is the one italic word):
 * 'stamped' + 'Torre de Belém'; 'landed at' + 'LAX'; 'sent a postcard from' + 'Lisbon'.
 * @param {any} row
 */
export function envelopeTitle(row) {
  if (row?.type === 'postcard') {
    const where = String(row.place || row.city || '').trim();
    const verb = row.to_me ? 'sent you a postcard' : 'sent a postcard';
    return where ? { verb: `${verb} from`, place: where } : { verb, place: '' };
  }
  const name = String(row?.name ?? '').trim();
  if (row?.kind === 'airport') return { verb: 'landed at', place: airportCodeIn(name) || name };
  return { verb: 'stamped', place: name };
}

// 'OCT 9' for a postmark.
const markDate = (iso) => {
  const s = String(iso ?? '');
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '';
};

/**
 * A round postmark: a 1px ring tilted -12 degrees with the city over the date in mono
 * (Mailbox L192: 40px, ink-3). The envelope's stand-in for stamp art it can't draw uses it
 * in airmail blue. Decorative: the city and date are printed in words beside it.
 * @param {{ city?: any, date?: any, color?: string, size?: number, style?: CSS, className?: string }} props
 */
export function PostmarkRing({ city = undefined, date = undefined, color = NEUTRAL.ink3, size = 40, style = undefined, className = undefined }) {
  const s = Math.max(24, Math.round(Number(size) || 40));
  const place = String(city ?? '').trim().toUpperCase();
  const when = markDate(date);
  // The type follows the text size but never outgrows the ring: it shrinks until the
  // longest word fits a line (mono letters are about 0.64em with their tracking), so a word
  // never breaks in the middle. Two lines of city at most.
  const pad = s >= 48 ? 6 : 3;
  const longest = Math.max(4, when.length, ...place.split(/\s+/).map((w) => Array.from(w).length));
  const fit = Math.max(5, Math.min(9, (s - 2 - 2 * pad) / (longest * 0.64)));
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        flex: 'none',
        width: s,
        height: s,
        boxSizing: 'border-box',
        padding: pad,
        overflow: 'hidden',
        borderRadius: 999,
        border: `1px solid ${color}`,
        transform: 'rotate(-12deg)',
        fontFamily: MONO,
        fontSize: `min(${fs(8)}, ${+fit.toFixed(2)}px)`,
        lineHeight: 1.12,
        letterSpacing: '.04em',
        textAlign: 'center',
        color,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {place ? (
        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', maxWidth: '100%' }}>{place}</span>
      ) : null}
      {when ? <span style={{ whiteSpace: 'nowrap' }}>{when}</span> : null}
    </span>
  );
}

/**
 * @param {{
 *   row: any, variant?: 'compact'|'full', me?: any, onClick?: (e: any) => void, href?: string,
 *   as?: any, className?: string, style?: CSS, [key: string]: any,
 * }} props
 */
export default function Envelope({
  row,
  variant = 'compact',
  me = undefined,
  onClick = undefined,
  href = undefined,
  as = undefined,
  className = undefined,
  style = undefined,
  ...rest
}) {
  if (!row || typeof row !== 'object') return null;
  const full = variant === 'full';
  const postcard = row.type === 'postcard';
  const by = row.by || {};
  const who = senderName(by, me);
  const when = whenLabel(row.created_at);
  const head = when ? `${who} · ${when}` : who;
  const title = envelopeTitle(row);
  const line = placeLine(row.city, row.country);
  const verified = !postcard && row.verified === true;
  const film = !postcard && row.film && String(row.film.title || '').trim() ? String(row.film.title).trim() : null;
  const photo = postcard && typeof row.photo === 'string' && row.photo ? row.photo : null;
  const message = postcard ? String(row.message ?? '').trim() : '';
  const photoAlt = String(row.place || row.city || '').trim() ? `Postcard from ${String(row.place || row.city).trim()}` : 'A postcard';

  const Root = onClick ? 'button' : href ? 'a' : as || (full ? 'article' : 'div');
  /** @type {any} */
  const rootProps = onClick ? { type: 'button', onClick } : href ? { href } : {};

  const face = <Face name={by.name} handle={by.handle} avatar={by.avatar} cloth={by.cloth} size={20} variant={full ? 'solid' : 'paper'} />;
  /** @type {CSS} */
  const headText = {
    minWidth: 0,
    fontFamily: MONO,
    fontSize: fs(full ? 10 : 9.5),
    lineHeight: 12 / (full ? 10 : 9.5),
    letterSpacing: full ? '.08em' : '.06em',
    textTransform: 'uppercase',
    color: NEUTRAL.ink3,
    overflowWrap: 'anywhere',
  };
  // The line: 'stamped *Torre de Belém*'. A postcard's message is the person's own words, in
  // serif italic, three lines at most (Mailbox's PostcardCard prints all of it).
  const lineNode = (
    <span style={{ display: 'block', fontFamily: SERIF, fontSize: fs(full ? 18 : 16), lineHeight: full ? 22 / 18 : 18 / 16, color: NEUTRAL.ink, overflowWrap: 'anywhere' }}>
      {title.verb}
      {title.place ? <> <em style={{ fontStyle: 'italic' }}>{title.place}</em></> : null}
    </span>
  );
  const messageNode = message ? (
    <span
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: fs(full ? 17 : 15),
        lineHeight: full ? 22 / 17 : 1.25,
        color: NEUTRAL.ink,
      }}
    >
      &ldquo;{message}&rdquo;
    </span>
  ) : null;
  /** @type {CSS} */
  const lineText = {
    fontFamily: MONO,
    fontSize: fs(full ? 10 : 9.5),
    lineHeight: full ? 14 / 10 : 12 / 9.5,
    letterSpacing: full ? '.08em' : '.04em',
    color: NEUTRAL.ink3,
    overflowWrap: 'anywhere',
  };
  // A column flex box, so a <button> envelope stretched to its row's tallest card keeps its
  // content at the top (a button centres its content vertically otherwise).
  /** @type {CSS} */
  const reset = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    boxSizing: 'border-box',
    margin: 0,
    font: 'inherit',
    textAlign: 'left',
    textDecoration: 'none',
    color: NEUTRAL.ink,
    cursor: onClick || href ? 'pointer' : undefined,
  };

  if (!full) {
    return (
      <Root
        {...rootProps}
        {...rest}
        className={className}
        style={{
          ...reset,
          position: 'relative',
          flex: 'none',
          width: fs(190),
          maxWidth: '100%',
          overflow: 'hidden',
          borderRadius: 12,
          background: NEUTRAL.white,
          border: `1px solid ${NEUTRAL.airmailLine}`,
          padding: photo ? 0 : '12px 12px 8px',
          ...style,
        }}
      >
        <AirmailChevron height={3} absolute style={{ zIndex: 1 }} />
        {photo ? (
          <img src={photo} alt={photoAlt} loading="lazy" decoding="async"
            style={{ display: 'block', width: '100%', aspectRatio: '3 / 2', objectFit: 'cover' }} />
        ) : null}
        <span style={{ display: 'block', padding: photo ? '10px 12px 8px' : 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 20 }}>
            {face}
            <span style={headText}>{head}</span>
          </span>
          <span style={{ display: 'block', marginTop: 4, minHeight: messageNode ? undefined : fs(36) }}>{messageNode || lineNode}</span>
          {verified || line ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 8px', marginTop: 4, minHeight: 14 }}>
              {verified ? <VerifiedMark /> : null}
              {line ? <span style={{ ...lineText, marginLeft: 'auto', textAlign: 'right' }}>{line}</span> : null}
            </span>
          ) : null}
        </span>
      </Root>
    );
  }

  // Full: the stamp (or the postcard's photo) on its cream square.
  const stamp = feedStamp(row);
  const drawable = !postcard && stampThumbKind(stamp, { feedSafe: true }) !== null;
  return (
    <Root
      {...rootProps}
      {...rest}
      className={className}
      style={{
        ...reset,
        width: onClick || href ? '100%' : undefined,
        overflow: 'hidden',
        borderRadius: 14,
        background: NEUTRAL.white,
        border: `1px solid ${NEUTRAL.airmailLine}`,
        padding: 0,
        ...style,
      }}
    >
      <AirmailChevron height={3} />
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 14px' }}>
        <span style={{ position: 'relative', display: 'block', flex: 'none', width: 72, height: 72 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              boxSizing: 'border-box',
              overflow: 'hidden',
              background: NEUTRAL.cream,
              border: `1px solid ${NEUTRAL.creamRule}`,
              borderRadius: 4,
              transform: 'rotate(-3deg)',
              boxShadow: `0 6px 14px -10px ${rgba(NEUTRAL.ink, 0.35)}`,
            }}
          >
            {photo ? (
              <img src={photo} alt={photoAlt} loading="lazy" decoding="async"
                style={{ display: 'block', width: 64, height: 64, objectFit: 'cover', borderRadius: 2 }} />
            ) : drawable ? (
              <StampThumb stamp={stamp} size={64} feedSafe />
            ) : (
              <PostmarkRing city={row.city || row.name} date={row.visited_on || row.created_at} color={NEUTRAL.airmailBlue} size={56} />
            )}
          </span>
          <PostmarkLines variant="envelope" style={{ position: 'absolute', left: 36, top: -6 }} />
        </span>
        <span style={{ display: 'block', flex: 1, minWidth: 0, paddingTop: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
            {face}
            <span style={headText}>{head}</span>
          </span>
          <span style={{ display: 'block', marginTop: 4 }}>{lineNode}</span>
          {messageNode ? <span style={{ display: 'block', marginTop: 4 }}>{messageNode}</span> : null}
          {line || verified || film ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', marginTop: 4 }}>
              {line ? <span style={lineText}>{line}</span> : null}
              {verified ? <VerifiedMark method={row.verified_by} /> : null}
              {film ? <span style={lineText}>FILMED HERE: {film.toUpperCase()}</span> : null}
            </span>
          ) : null}
        </span>
      </span>
    </Root>
  );
}
