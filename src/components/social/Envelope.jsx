// Envelope: one piece of news from your circle, as a letter on airmail stock. Home's circle
// zone shows the compact envelope (Home-Boxes L80-89); Mailbox shows the full one
// (Mailbox L84-105). Both read a social/feed row as the worker sends it and print only
// what the row says.
//
//   <Envelope row variant me onClick href onReport as className style />
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
//   onReport (row) => void. Someone else's envelope gets the report door: a 44px '•••'
//            named 'Report Theo’s postcard' at its top right, beside the envelope's own
//            button or link, never inside it (one control can't hold another). The card is
//            then a frame (`as`, else article or div) that takes className and style; the
//            rest of the props go on the inner button or link (on the frame when there is
//            neither). The viewer's own rows get no door. Open <ReportSheet row={row}/> from
//            it. Without onReport nothing changes.
//
// The report door (principle 8: Report wherever another person's content shows):
//   reportPayload(row)   what /social/report takes for a feed row. The feed sends no row id,
//                        so a postcard is found by the key in its photo URL (pc/<uuid>.jpg,
//                        kind 'photo') and a stamp by its sender's @handle (kind 'passport').
//                        The note names the sender and the place for the team.
//   canReport(row, me)   false only for the viewer's own row.
//   <ReportControl row me onReport className style>  the 44px door alone, for cards that
//                        are not Envelopes (Mailbox's PostcardCard); place it yourself.
//   <ReportSheet row onClose onSent payload subject>  the reasons the worker takes (a
//                        child's safety, nudity, harassment, spam, something else); one tap
//                        sends. Open while row (or payload, with subject naming it) is set.
//                        Cancel, the backdrop, Escape and swipe-down close it. Success toasts
//                        'Thank you — we review every report' and calls onSent(row, reason);
//                        an error toasts and keeps the sheet open to try again.
//   REPORT_REASONS       [[reason, label], ...] in that order.
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
// Helpers for the slices: senderName, whenLabel, placeLine, envelopeTitle, PostmarkRing, and
// the report door above.
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { NEUTRAL, fs, rgba } from '@/components/redesign/constants';
import { AirmailChevron, PostmarkLines } from '@/components/redesign/ornaments';
import StampThumb, { stampThumbKind } from '@/components/passport/StampThumb';
import { showToast } from '@/components/Toast';
import { useDismissable } from '@/lib/dismissStack';
import { reportShared } from '@/lib/passport';
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

// ── The report door ──────────────────────────────────────────────────────

// The reasons /social/report takes, in the order the sheet lists them (as on a shared
// passport). minor_safety carries the team's 24-hour triage.
export const REPORT_REASONS = Object.freeze([
  ['minor_safety', 'A child’s safety'],
  ['nudity', 'Nudity or sexual content'],
  ['harassment', 'Harassment or hate'],
  ['spam', 'Spam or a scam'],
  ['other', 'Something else'],
]);

/**
 * Whether the viewer can report a row: anything but their own ('me' is their handle).
 * @param {any} row
 * @param {any} [me]
 */
export function canReport(row, me) {
  if (!row || typeof row !== 'object') return false;
  const h = handleOf(row.by);
  const mine = handleOf(me);
  return !(h && mine && h === mine);
}

/**
 * What /social/report takes for a feed row: { kind, ref, note }, or null for no row. The feed
 * sends no row id, so a postcard is found by the key in its photo URL ('pc/<uuid>.jpg'; a row
 * id when the feed sends one) and a stamp by its sender's handle. The note tells the team who
 * sent it and where.
 * @param {any} row
 * @returns {{ kind: 'photo'|'passport', ref: string|null, note: string }|null}
 */
export function reportPayload(row) {
  if (!row || typeof row !== 'object') return null;
  const by = row.by || {};
  const h = handleOf(by);
  const name = String(by.name ?? '').trim();
  const sender = [h ? `@${h}` : '', name && name.toLowerCase() !== h ? name : ''].filter(Boolean).join(' ') || 'a traveler with no name or handle';
  if (row.type === 'postcard') {
    const key = /\/pc-photo\/(pc\/[^?#\s]+)/.exec(String(row.photo ?? ''));
    const id = row.id != null && String(row.id).trim() ? String(row.id).trim() : null;
    const where = String(row.place || row.city || '').trim();
    return { kind: 'photo', ref: key ? key[1] : id, note: `Postcard from ${sender}${where ? ` · ${where}` : ''}` };
  }
  const place = String(row.name ?? '').trim();
  const line = placeLine(row.city, row.country);
  return { kind: 'passport', ref: h ? `@${h}` : null, note: `Stamp by ${sender}${place ? `: ${place}` : ''}${line ? ` · ${line}` : ''}` };
}

// 'Theo’s postcard from Lisbon', 'Theo’s stamp of Torre de Belém': what the door reports.
function reportSubject(row, me) {
  const who = senderName(row?.by || {}, me);
  const owner = who === 'A traveler' ? 'A traveler’s' : `${who}’s`;
  if (row?.type === 'postcard') {
    const where = String(row.place || row.city || '').trim();
    return `${owner} postcard${where ? ` from ${where}` : ''}`;
  }
  const { place } = envelopeTitle(row);
  return `${owner} stamp${place ? ` of ${place}` : ''}`;
}

/**
 * The report door on its own: a 44px button holding a '•••' disc, named 'Report Theo’s
 * postcard'. Nothing for the viewer's own row or without onReport. Position it yourself.
 * @param {{ row: any, me?: any, onReport?: (row: any, e: any) => void, className?: string, style?: CSS }} props
 */
export function ReportControl({ row, me = undefined, onReport = undefined, className = undefined, style = undefined }) {
  if (typeof onReport !== 'function' || !canReport(row, me)) return null;
  const who = senderName(row.by || {}, me);
  const what = row.type === 'postcard' ? 'postcard' : 'stamp';
  return (
    <button
      type="button"
      aria-label={who === 'A traveler' ? `Report this ${what}` : `Report ${who}’s ${what}`}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.stopPropagation();
        // WebKit doesn't focus a tapped button, so focus it here: the sheet hands focus
        // back to whatever was focused when it opened.
        if (e.currentTarget && typeof e.currentTarget.focus === 'function') e.currentTarget.focus({ preventScroll: true });
        onReport(row, e);
      }}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        padding: 0,
        margin: 0,
        borderRadius: 999,
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          boxSizing: 'border-box',
          borderRadius: 999,
          background: NEUTRAL.white,
          border: `1px solid ${NEUTRAL.airmailLine}`,
          boxShadow: `0 1px 3px ${rgba(NEUTRAL.ink, 0.12)}`,
        }}
      >
        <MoreHorizontal size={16} color={NEUTRAL.ink2} strokeWidth={2} aria-hidden="true" focusable="false" />
      </span>
    </button>
  );
}

// A send failure as words: the network, or the report itself.
const reportError = (error) => {
  const raw = String((error && typeof error === 'object' ? error.message : error) ?? '').trim();
  return /^(timeout|network error|failed to fetch|load failed|HTTP 5\d\d)$/i.test(raw)
    ? 'Couldn’t reach Globeskimmers. Try again.'
    : 'Couldn’t send the report. Try again.';
};

/**
 * The report sheet: the reasons, one tap sends. Open while `row` (a feed row) or `payload`
 * ({ kind, ref, slug, note } for anything else, with `subject` naming it) is set.
 * @param {{
 *   row?: any, payload?: any, subject?: string, me?: any,
 *   onClose?: () => void, onSent?: (row: any, reason: string) => void,
 * }} props
 */
export function ReportSheet({ row = null, payload = undefined, subject = undefined, me = undefined, onClose = undefined, onSent = undefined }) {
  const open = !!(payload || (row && typeof row === 'object'));
  const sheetRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [busy, setBusy] = useState(/** @type {string|null} */ (null));
  const close = () => {
    if (typeof onClose === 'function') onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  const subjectRef = useRef(/** @type {any} */ (null));
  subjectRef.current = payload || row;
  useDismissable(open, close);

  // A new subject starts with nothing sending.
  useEffect(() => {
    setBusy(null);
  }, [row, payload]);

  // Focus moves into the sheet when it opens and back to the door when it closes; Escape
  // closes it.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const before = document.activeElement;
    const t = setTimeout(() => {
      if (sheetRef.current) sheetRef.current.focus({ preventScroll: true });
    }, 0);
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      if (before instanceof HTMLElement && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  const body = payload || reportPayload(row);
  const what = String(subject || (row ? reportSubject(row, me) : '')).trim().replace(/[.!?]+$/, '');

  // The toast always tells the result. A sheet closed or moved to another subject while this
  // was sending is left alone.
  const send = async (reason) => {
    if (busy || !body) return;
    const sentFor = subjectRef.current;
    const sentRow = row;
    setBusy(reason);
    const { error } = await reportShared({ ...body, reason });
    const still = subjectRef.current === sentFor;
    if (still) setBusy(null);
    if (error) {
      showToast(reportError(error), 'error');
      return;
    }
    showToast('Thank you — we review every report', 'success');
    if (typeof onSent === 'function') onSent(sentRow, reason);
    if (still) closeRef.current();
  };

  /** @type {CSS} */
  const choice = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    boxSizing: 'border-box',
    margin: 0,
    padding: '10px 16px',
    borderRadius: 12,
    background: NEUTRAL.white,
    border: `1px solid ${NEUTRAL.airmailLine}`,
    font: 'inherit',
    fontSize: fs(14),
    lineHeight: 1.3,
    fontWeight: 600,
    textAlign: 'left',
    color: NEUTRAL.ink2,
    cursor: 'pointer',
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" style={{ background: rgba(NEUTRAL.ink, 0.5) }} onClick={close}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-what`}
        tabIndex={-1}
        className="w-full max-w-md max-h-[88vh] overflow-y-auto"
        style={{ position: 'relative', background: NEUTRAL.ivory, borderRadius: '22px 22px 0 0', outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <AirmailChevron height={4} />
        <div style={{ padding: '16px 20px calc(24px + env(safe-area-inset-bottom))' }}>
          <p style={{ margin: 0, fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.3, fontWeight: 500, letterSpacing: '.2em', textTransform: 'uppercase', color: NEUTRAL.stamp }}>Report</p>
          <h3 id={`${uid}-title`} style={{ margin: '2px 0 0', fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
            What’s wrong <em style={{ fontStyle: 'italic', color: NEUTRAL.airmailBlue }}>here?</em>
          </h3>
          <p id={`${uid}-what`} style={{ margin: '6px 0 0', fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2, overflowWrap: 'anywhere' }}>
            {what ? `${what}. ` : ''}Only the Globeskimmers team sees your report.
          </p>
          <div role="group" aria-label="Reasons" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {REPORT_REASONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => send(id)}
                aria-disabled={busy ? true : undefined}
                style={{ ...choice, opacity: busy && busy !== id ? 0.55 : 1, cursor: busy ? 'default' : 'pointer' }}
              >
                {busy === id ? 'Sending…' : label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            style={{ ...choice, justifyContent: 'center', marginTop: 10, minHeight: 44, background: 'transparent', border: 0, color: NEUTRAL.ink2 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * @param {{
 *   row: any, variant?: 'compact'|'full', me?: any, onClick?: (e: any) => void, href?: string,
 *   onReport?: (row: any, e: any) => void, as?: any, className?: string, style?: CSS,
 *   [key: string]: any,
 * }} props
 */
export default function Envelope({
  row,
  variant = 'compact',
  me = undefined,
  onClick = undefined,
  href = undefined,
  onReport = undefined,
  as = undefined,
  className = undefined,
  style = undefined,
  ...rest
}) {
  if (!row || typeof row !== 'object') return null;
  // Someone else's envelope with a report door: the card becomes a frame holding the
  // envelope's own element and the door beside it.
  const reportable = typeof onReport === 'function' && canReport(row, me);
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
  // With the door, the frame is the card (`as`, else an article or a div) and the envelope's
  // own button, link or block fills it.
  const Frame = as || (full ? 'article' : 'div');
  const Inner = onClick ? 'button' : href ? 'a' : 'div';
  // The other props (aria-*, data-*, handlers) go on the button or link; on the frame when
  // the envelope is neither.
  const innerRest = onClick || href ? rest : {};
  const frameRest = onClick || href ? {} : rest;

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

  // The door's own frame and the element it holds. The frame keeps the card's border and
  // radius but doesn't clip, so the inner element's focus ring stays visible; the inner
  // element clips the photo and chevron to the corners instead.
  /** @type {CSS} */
  const frameBase = { position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` };
  /** @type {CSS} */
  const innerBase = { ...reset, position: 'relative', flex: '1 1 auto', width: '100%', minWidth: 0, overflow: 'hidden', background: 'transparent', border: 0 };
  // The door sits on the header row: its 28px disc is centred 22px in from the top right
  // (27px down in the full letter), and the header keeps 28px clear of it.
  const door = (top) => (
    <ReportControl row={row} me={me} onReport={onReport} style={{ position: 'absolute', top, right: 0, zIndex: 2 }} />
  );

  if (!full) {
    const content = (
      <>
        <AirmailChevron height={3} absolute style={{ zIndex: 1 }} />
        {photo ? (
          <img src={photo} alt={photoAlt} loading="lazy" decoding="async"
            style={{ display: 'block', width: '100%', aspectRatio: '3 / 2', objectFit: 'cover' }} />
        ) : null}
        <span style={{ display: 'block', padding: photo ? '10px 12px 8px' : 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 20, paddingRight: reportable && !photo ? 28 : undefined }}>
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
      </>
    );
    if (reportable) {
      return (
        <Frame {...frameRest} className={className} style={{ ...frameBase, flex: 'none', width: fs(190), maxWidth: '100%', borderRadius: 12, ...style }}>
          <Inner {...rootProps} {...innerRest} style={{ ...innerBase, borderRadius: 11, padding: photo ? 0 : '12px 12px 8px' }}>
            {content}
          </Inner>
          {door(0)}
        </Frame>
      );
    }
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
        {content}
      </Root>
    );
  }

  // Full: the stamp (or the postcard's photo) on its cream square.
  const stamp = feedStamp(row);
  const drawable = !postcard && stampThumbKind(stamp, { feedSafe: true }) !== null;
  const letter = (
    <>
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20, paddingRight: reportable ? 28 : undefined }}>
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
    </>
  );
  if (reportable) {
    return (
      <Frame {...frameRest} className={className} style={{ ...frameBase, borderRadius: 14, ...style }}>
        <Inner {...rootProps} {...innerRest} style={{ ...innerBase, borderRadius: 13, padding: 0 }}>
          {letter}
        </Inner>
        {door(5)}
      </Frame>
    );
  }
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
      {letter}
    </Root>
  );
}
