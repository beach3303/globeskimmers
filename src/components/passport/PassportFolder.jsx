// PassportFolder: the navy MY VIRTUAL PASSPORT folder on a profile (Profile.dc.html
// L127-164) and on a visit (Profile-Visit L132-190), on F4's Folder at size 'profile'.
// Stamps print only on its cream panels (principle 6); the folder's controls ring in gold.
//
//   <PassportFolder mode cloth ownerFirst stamps slug blotter onBlotterChanged onOpenDoor
//                   tab className style />
//   mode         'own': the tab 'MY VIRTUAL PASSPORT', 'Where I’ve *been*' and a wall of the
//                newest stamps (three squares a row, the wide airport and border stamps
//                after them), then the door 'Open my Virtual Passport'. With no stamps:
//                'Your first page is *waiting*' and the door.
//                'visit': '{FIRST}’S VIRTUAL PASSPORT', 'Where {First}’s *been*', the NEWEST
//                PAGE (its stamp, 'stamped *Kinkaku-ji*' with the place in the owner's
//                cloth, the place and date, 'Verified · GPS' when the stamp says so), the
//                real Blotter for that page, MORE PAGES, and the door 'Open {First}’s Virtual
//                Passport'.
//   cloth        the owner's cloth: the visit's italic place name. Harbour by default.
//   ownerFirst   the owner's first name for the visit's words ('Kenji'). Without one the
//                words don't name them ('Where they’ve been', 'Open this Virtual Passport').
//   stamps       passport rows ({ id, name, city, country, kind, entity_id, visited_on,
//                created_at, verified, ... }), any order: newest first by visited_on, then
//                created_at. Rows StampThumb can't draw are left out.
//   slug         visit: the shared booklet's slug, for the Blotter (blotterRead(slug)).
//   blotter      visit: blotterRead's reply; onBlotterChanged: read it again after a mark.
//   onOpenDoor   the door (own: /Passport; visit: /Passport?view_slug=<slug>). Without it the
//                door isn't drawn.
//   tab          replaces the tab's words.
//
// Each stamp tile is named for screen readers with its place and 'collected <date>'; the
// printed date under it is hidden from them.
import React from 'react';
import { BookOpen } from 'lucide-react';
import { NEUTRAL, ZONE, fs, rgba } from '@/components/redesign/constants';
import { Folder } from '@/components/redesign/Zone';
import StampThumb, { stampThumbKind } from '@/components/passport/StampThumb';
import { BlotterStrip } from '@/components/passport/Blotter';
import { PASSPORT_COVER_URL } from '@/components/passport/PassportBook';
import { VerifiedMark } from '@/components/social/SocialMarks';
import { envelopeTitle } from '@/components/social/Envelope';
import { isVerified } from '@/lib/passport';
import { clothRow } from '@/components/profile/CoverBand';

/** @typedef {import('react').CSSProperties} CSS */

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

const P = ZONE.passport;
const WALL = 5; // the newest stamps on your own folder (Profile L132-155: 3 + 2)
const MORE = 5; // the visit's MORE PAGES after the newest page (Profile-Visit L157-183)
const TILTS = [-2, 1.5, -1, 1, -1.5]; // the boards' small tilts, by position
const SQUARE = 88;
const WIDE = 140;
// How the visit was proven, as the visit board prints it after 'Verified' (Profile-Visit L148).
const PROOF = { gps: 'GPS', photo_loc: 'PHOTO', photo_ai: 'PHOTO' };

// 'YYYY-MM-DD' is a calendar date (no time zone shift); anything else is a timestamp.
function dayOf(v) {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}
const dateOf = (s) => dayOf(s?.visited_on) || dayOf(s?.created_at);
const longDate = (d) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/**
 * The stamps StampThumb can draw, newest first: by visited_on (stamps without one last),
 * then created_at.
 * @param {any} stamps
 */
export function newestStamps(stamps) {
  const rows = (Array.isArray(stamps) ? stamps : []).filter((s) => s && typeof s === 'object' && stampThumbKind(s) !== null);
  const t = (v) => {
    const d = dayOf(v);
    return d ? d.getTime() : null;
  };
  return rows
    .map((s, i) => ({ s, i, v: t(s.visited_on), c: t(s.created_at) }))
    .sort((a, b) => {
      if (a.v !== b.v) {
        if (a.v === null) return 1;
        if (b.v === null) return -1;
        return b.v - a.v;
      }
      if (a.c !== b.c) {
        if (a.c === null) return 1;
        if (b.c === null) return -1;
        return b.c - a.c;
      }
      return a.i - b.i;
    })
    .map((x) => x.s);
}

const isWide = (s) => {
  const k = stampThumbKind(s);
  return k === 'airport' || k === 'land';
};
const nameOf = (s) => {
  const n = String(s?.name ?? '').trim();
  return s?.kind === 'country' ? n.split(' · ')[0] : n;
};

// One stamp and its date (Profile L133-136): 88px square or 140x92 wide, tilted a little.
function Tile({ stamp, tilt }) {
  const wide = isWide(stamp);
  const d = dateOf(stamp);
  const when = longDate(d);
  const label = when ? `${nameOf(stamp)}, collected ${when}` : nameOf(stamp);
  return (
    <li style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: wide ? WIDE : SQUARE, maxWidth: '100%', margin: 0, padding: 0 }}>
      <StampThumb stamp={stamp} size={wide ? WIDE : SQUARE} tilt={tilt} label={label} />
      {when ? (
        <span
          aria-hidden="true"
          style={{
            marginTop: 4,
            fontFamily: MONO,
            fontSize: fs(9.5),
            lineHeight: 12 / 9.5,
            fontWeight: 500,
            letterSpacing: '.12em',
            textAlign: 'center',
            color: NEUTRAL.ink3,
          }}
        >
          {when.toUpperCase()}
        </span>
      ) : null}
    </li>
  );
}

// The stamps on a cream panel: squares and wide stamps wrap in centred rows (Profile L132-155,
// Profile-Visit L157-183).
function Wall({ stamps, label = undefined }) {
  return (
    <ul
      aria-label={label}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-end',
        columnGap: 16,
        rowGap: 12,
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {stamps.map((s, i) => (
        <Tile key={String(s.id ?? `${s.name}-${i}`)} stamp={s} tilt={TILTS[i % TILTS.length]} />
      ))}
    </ul>
  );
}

/** @type {CSS} */
const PANEL = { marginTop: 12, padding: 12, background: P.tile, borderRadius: 12 };

/**
 * @param {{ title: { pre: string, italic: string, post?: string } }} props
 */
function Title({ title }) {
  return (
    <h3 style={{ margin: '0 0 0 4px', fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 24 / 22, overflowWrap: 'anywhere', color: P.title }}>
      {title.pre}
      <em style={{ fontStyle: 'italic', color: P.accent }}>{title.italic}</em>
      {title.post || null}
    </h3>
  );
}

// The navy door (Profile L157-161): the cover, the words, a gold BookOpen.
function Door({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        minHeight: 56,
        boxSizing: 'border-box',
        marginTop: 12,
        padding: '5px 16px 5px 12px', // with the 1px line and the 44px cover: 56px
        background: P.fill,
        border: `1px solid ${NEUTRAL.gold}`,
        borderRadius: 14,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <img
        src={PASSPORT_COVER_URL}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        style={{ display: 'block', flexShrink: 0, width: 28, height: 44, objectFit: 'cover', borderRadius: '2px 4px 4px 2px', boxShadow: `0 2px 6px ${rgba(NEUTRAL.black, 0.5)}` }}
      />
      <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: fs(17), lineHeight: 20 / 17, overflowWrap: 'anywhere', color: P.title }}>{label}</span>
      <BookOpen size={20} strokeWidth={2} color={NEUTRAL.gold} aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0 }} />
    </button>
  );
}

// The visit's newest page (Profile-Visit L138-153).
function NewestPage({ stamp, c }) {
  const t = envelopeTitle(stamp);
  const when = longDate(dateOf(stamp));
  const where = [stamp.city, stamp.country].map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ');
  /** @type {CSS} */
  const mono = { fontFamily: MONO, fontSize: fs(10), lineHeight: 1.4, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', overflowWrap: 'anywhere', color: NEUTRAL.ink3 };
  const wide = isWide(stamp);
  return (
    <div style={{ ...PANEL, display: 'flex', alignItems: 'center', gap: 12 }}>
      <StampThumb stamp={stamp} size={wide ? WIDE : 108} tilt={-2} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: fs(9.5), lineHeight: 12 / 9.5, fontWeight: 500, letterSpacing: '.14em', color: NEUTRAL.stamp }}>NEWEST PAGE</div>
        <div style={{ marginTop: 4, fontFamily: SERIF, fontSize: fs(22), lineHeight: 24 / 22, overflowWrap: 'anywhere', color: NEUTRAL.ink }}>
          {t.verb} <em style={{ fontStyle: 'italic', color: c.cloth }}>{t.place}</em>
        </div>
        {where ? <div style={{ ...mono, marginTop: 4 }}>{where}</div> : null}
        {when ? <div style={{ ...mono, marginTop: 2 }}>{when}</div> : null}
        {isVerified(stamp.verified) ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <VerifiedMark />
            {PROOF[stamp.verified] ? (
              <span style={{ fontFamily: MONO, fontSize: fs(9.5), lineHeight: 14 / 9.5, fontWeight: 500, letterSpacing: '.12em', color: NEUTRAL.ink3 }}>
                <span className="sr-only">, </span><span aria-hidden="true">· </span>{PROOF[stamp.verified]}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const possessive = (first) => `${first}’s`;

/**
 * @param {{
 *   mode?: 'own'|'visit', cloth?: any, ownerFirst?: string|null, stamps?: any[], slug?: string|null,
 *   blotter?: any, onBlotterChanged?: () => void, onOpenDoor?: (e: any) => void,
 *   tab?: import('react').ReactNode, className?: string, style?: CSS,
 * }} props
 */
export default function PassportFolder({
  mode = 'own',
  cloth = undefined,
  ownerFirst = null,
  stamps = [],
  slug = null,
  blotter = null,
  onBlotterChanged = undefined,
  onOpenDoor = undefined,
  tab = undefined,
  className = undefined,
  style = undefined,
}) {
  const c = clothRow(cloth);
  const visit = mode === 'visit';
  const first = String(ownerFirst ?? '').trim();
  const list = newestStamps(stamps);
  const door = typeof onOpenDoor === 'function';

  if (!visit) {
    const wall = list.slice(0, WALL);
    return (
      <Folder stock="passport" size="profile" tab={tab ?? 'My Virtual Passport'} className={className} style={style}>
        <Title title={wall.length ? { pre: 'Where I’ve ', italic: 'been' } : { pre: 'Your first page is ', italic: 'waiting' }} />
        {wall.length ? (
          <div style={PANEL}>
            <Wall stamps={wall} label="Your newest stamps" />
          </div>
        ) : null}
        {door ? <Door label="Open my Virtual Passport" onClick={onOpenDoor} /> : null}
      </Folder>
    );
  }

  const newest = list[0] || null;
  const more = list.slice(1, 1 + MORE);
  const who = first ? possessive(first) : null;
  return (
    <Folder
      stock="passport"
      size="profile"
      tab={tab ?? (who ? `${who} Virtual Passport` : 'A Virtual Passport')}
      className={className}
      style={style}
    >
      <Title title={who ? { pre: `Where ${who} `, italic: 'been' } : { pre: 'Where they’ve ', italic: 'been' }} />
      {newest ? (
        <>
          <NewestPage stamp={newest} c={c} />
          {slug ? (
            <div style={{ ...PANEL, padding: 8 }}>
              <BlotterStrip slug={slug} stamps={[newest]} blotter={blotter} ownerView={false} onChanged={onBlotterChanged} />
            </div>
          ) : null}
          {more.length ? (
            <div style={PANEL}>
              <div style={{ marginBottom: 8, fontFamily: MONO, fontSize: fs(9.5), lineHeight: 12 / 9.5, fontWeight: 500, letterSpacing: '.14em', color: NEUTRAL.ink3 }}>MORE PAGES</div>
              <Wall stamps={more} label="More pages" />
            </div>
          ) : null}
        </>
      ) : (
        <p style={{ ...PANEL, margin: '12px 0 0', fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
          {first ? `${first} hasn’t stamped a page yet.` : 'No pages stamped yet.'}
        </p>
      )}
      {door ? <Door label={who ? `Open ${who} Virtual Passport` : 'Open this Virtual Passport'} onClick={onOpenDoor} /> : null}
    </Folder>
  );
}
