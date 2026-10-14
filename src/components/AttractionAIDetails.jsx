/**
 * AttractionAIDetails: the "AI details" panel in a Things to Do place's sheet.
 *
 * A fork of AIDetailsSection.jsx for attractions (Phase 1 of the Things to Do redesign):
 * PlacesToEat and the other finders keep the shared AIDetailsSection.jsx, so the
 * attraction layout can differ without any risk to restaurants.
 *
 * Look (the new look, plan S9 detail 8): a white card with the world line holding a quiet
 * row (Sparkles in the world's icon ink, 'AI details', a turning chevron, aria-expanded
 * and aria-controls); the body opens under it with mono labels in the world ink, plain
 * words and lucide icons. No lilac, no emoji; sizes follow --fs; every control is a 44px
 * target. `world` is a WORLD row or key (Things to Do's lapis by default).
 *
 * Data: /attraction-ai-details (the Worker's v7 schema plus verifiedFacts and a _sources
 * map), fetched on the first open. Layout:
 *   Decide: the quick-fit tiles, the GS verdict, the price, lines and wait
 *   Do: "What you'll do here" (from alsoRecommended)
 *   Traveler fit: limited mobility, stroller, heights (only from data we hold)
 *   Plan ahead: reservation and timed-entry facts (information, never booking)
 *   Fit and prep: tap rows
 *   More detail: vibe, what you see, about and history, crowd, best time, ...
 *
 * Honesty rules:
 *   - Every fact says where it comes from (src/lib/sourceMeta.js): Verified in the open
 *     green; from reviews, from forecast and AI estimate muted; call to confirm as a link
 *     to the place's website when there is one. Only the Worker may say "from reviews";
 *     anything it didn't tag is an AI estimate.
 *   - Unknowns say so and point to the venue; conditional parts (the smart tip) show only
 *     on a real signal. No editorializing.
 */
import React, { useState, useEffect, useId } from 'react';
import {
  Accessibility, Armchair, Baby, BookOpen, CalendarCheck, Check, ChevronDown, DoorOpen, Flag, Lightbulb,
  Mountain, PawPrint, Shirt, Sparkles, Star, Ticket, Timer, Users, X,
} from 'lucide-react';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { logEvent } from '@/lib/analytics';
import { openPartner } from '@/lib/openPartner';
import { SOURCE_META, makeSourceFor } from '@/lib/sourceMeta';
import { NEUTRAL, fs } from '@/components/redesign/constants';
import { worldRow } from '@/components/finder/FinderControls';
import { QuietRow } from '@/components/finder/FinderCard';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/**
 * A style object that may carry CSS custom properties (--w-wash).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

// One key shared with the restaurant panel: the "what is GS verdict" subtitle is a
// one-time introduction. Seen on a restaurant card, it isn't repeated here.
const GS_VERDICT_HELPER_KEY = 'gs_verdict_helper_seen';
function readVerdictHelperSeen() {
  try { return localStorage.getItem(GS_VERDICT_HELPER_KEY) === '1'; }
  catch { return true; }
}
function markVerdictHelperSeen() {
  try { localStorage.setItem(GS_VERDICT_HELPER_KEY, '1'); } catch { /* ignore */ }
}

// The worth-it tiers in words (one tone; the words carry it). An unknown value hides
// the tag rather than mislabel the place.
const WORTH_LABELS = {
  worth_the_stop: 'Worth the stop',
  strong_nearby_pick: 'Strong nearby pick',
  craving_match: 'Niche match',
  know_before_you_go: 'Know before you go',
  better_if_convenient: 'Better if convenient',
};

// The panel's shared type, in the world's colours.
const styles = (w) => ({
  /** @type {CSS} */
  label: { fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.34, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: w.ink, marginBottom: 6 },
  /** @type {CSS} */
  body: { fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink },
  /** @type {CSS} */
  box: { background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 12, padding: '10px 12px' },
});

// Where a fact comes from, said quietly after it.
function SourceStamp({ tier, onClick = null, w }) {
  const s = SOURCE_META[tier];
  if (!s) return null;
  if (tier === 'call' && typeof onClick === 'function') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-14px 0 -14px 6px', padding: 0,
          background: 'transparent', border: 0, fontFamily: 'inherit', fontSize: fs(11.5), fontWeight: 600,
          color: w.ink, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', verticalAlign: 'baseline',
        }}
      >
        {s.label}
      </button>
    );
  }
  const sure = tier === 'verified' || tier === 'confirmed';
  return (
    <span style={{ marginLeft: 6, fontFamily: 'inherit', fontSize: fs(11.5), fontWeight: 600, letterSpacing: 'normal', textTransform: 'none', color: sure ? NEUTRAL.open : NEUTRAL.ink3, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// A yes or no from Google's flags: a check or a cross, never an emoji.
function YesNo({ yes }) {
  const Icon = yes ? Check : X;
  return <Icon size={14} color={yes ? NEUTRAL.open : NEUTRAL.stamp} strokeWidth={2.5} aria-label={yes ? 'Yes' : 'No'} style={{ flexShrink: 0, marginTop: 3 }} />;
}

/**
 * @param {{ placeId?: string, placeName?: string, page?: string, world?: any }} props
 */
export default function AttractionAIDetails({ placeId, placeName, page, world = 'todo' }) {
  const w = worldRow(world);
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Read once, so the subtitle stays for THIS open after it is marked seen.
  const [showVerdictHelper] = useState(() => !readVerdictHelperSeen());

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      logEvent('ai_details_opened', {
        placeId, placeName, kind: 'attraction', variant: 'attraction_v2',
      }, page || 'ThingsToDo');
      if (showVerdictHelper) markVerdictHelperSeen();
    }
  };

  useEffect(() => {
    if (!open) return;
    if (details || loading) return;
    if (!placeId) return;
    setLoading(true);
    setError(null);
    // /attraction-ai-details returns the richer payload (verifiedFacts and the _sources
    // map), so each source stamp tells the field's real provenance.
    callWorker(ROUTE.getAttractionAIDetails, { placeId })
      .then(({ data }) => {
        if (data?.error) {
          setError(data.error);
        } else if (data?.aiDetails) {
          setDetails(data.aiDetails);
        } else {
          setError('No AI details returned');
        }
        const cache = data?._cache || 'unknown';
        logEvent('ai_details_fetched', {
          placeId, placeName,
          kind: 'attraction', variant: 'attraction_v2',
          cache, paid: cache !== 'hit',
        }, page || 'ThingsToDo');
      })
      .catch((e) => setError(e?.message || 'Failed to load AI details'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placeId]);

  return (
    <section style={{ background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 16, padding: '2px 16px' }}>
      <QuietRow world={w} icon={Sparkles} expanded={open} controls={bodyId} onClick={onToggle} chevron>
        AI details
      </QuietRow>
      <div id={bodyId} hidden={!open} style={{ padding: '6px 0 14px' }}>
        {open ? <Body loading={loading} error={error} details={details} showVerdictHelper={showVerdictHelper} w={w} /> : null}
      </div>
    </section>
  );
}

function Body({ loading, error, details, showVerdictHelper, w }) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading AI details" style={css({ display: 'flex', flexDirection: 'column', gap: 8, '--w-wash': w.wash })}>
        {[88, 72, 80, 66, 75].map((pct, i) => (
          <span key={i} className="gs-shimmer" aria-hidden="true" style={{ display: 'block', height: 12, width: `${pct}%`, borderRadius: 4 }} />
        ))}
      </div>
    );
  }
  if (error) return <div role="alert" style={{ fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.stamp }}>AI details unavailable right now. {error}</div>;
  if (!details) return null;

  const websiteUri = details.websiteUri || null;
  // "call to confirm" opens the place's website; without one it is only words.
  const callConfirm = websiteUri ? () => openPartner(websiteUri) : null;
  // Any field the Worker didn't tag is model-written: an AI estimate.
  const sourceFor = makeSourceFor(details);
  const host = websiteUri ? websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;

  return (
    <div>
      <ZoneDecide details={details} showVerdictHelper={showVerdictHelper} callConfirm={callConfirm} sourceFor={sourceFor} w={w} />
      <ZoneDo details={details} sourceFor={sourceFor} w={w} />
      <TravelerChips details={details} callConfirm={callConfirm} sourceFor={sourceFor} w={w} />
      <ZoneBook details={details} sourceFor={sourceFor} w={w} />
      <ZoneFitPrep details={details} callConfirm={callConfirm} sourceFor={sourceFor} w={w} />
      <DepthMore details={details} sourceFor={sourceFor} w={w} />
      {host && (
        <p style={{ margin: '12px 0 0', fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
          For more information, visit{' '}
          <button
            type="button"
            onClick={() => openPartner(websiteUri)}
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-14px 0', padding: 0, background: 'transparent', border: 0, fontFamily: 'inherit', fontSize: 'inherit', color: w.ink, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', overflowWrap: 'anywhere', textAlign: 'left' }}
          >
            {host}
          </button>
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Decide
// ============================================================================

function ZoneDecide({ details, showVerdictHelper, callConfirm, sourceFor, w }) {
  const st = styles(w);
  const worthTag = details.worthIt && WORTH_LABELS[details.worthIt];
  const stars = Math.min(5, Math.max(0, Math.round(Number(details.gsStars) || 0)));
  const hasVerdict = (details.gsStars != null || details.gsRedFlag || details.gsVerdict || worthTag);
  // The quick-fit tiles, a five-second go or no-go. Each tile's stamp comes from the
  // Worker's verifiedFacts and _sources map.
  const quickFit = buildQuickFit(details, sourceFor);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
        {quickFit.map((tile) => <QuickFitTile key={tile.label} tile={tile} callConfirm={callConfirm} w={w} />)}
      </div>

      {hasVerdict && (
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${w.line}` }}>
          <div style={{ ...st.label, marginBottom: showVerdictHelper ? 2 : 6 }}>GS verdict</div>
          {showVerdictHelper && (
            <div style={{ fontSize: fs(12), color: NEUTRAL.ink3, fontStyle: 'italic', marginBottom: 8 }}>
              Globeskimmers&rsquo; traveler-fit take on this place.
            </div>
          )}
          {worthTag && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, boxSizing: 'border-box', padding: '2px 10px', borderRadius: 999, background: w.wash, color: w.washInk, fontSize: fs(12), fontWeight: 600 }}>
                {worthTag}
              </span>
            </div>
          )}
          {details.gsRedFlag ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: fs(13), fontWeight: 600, color: NEUTRAL.stamp }}>
              <Flag size={14} color={NEUTRAL.stamp} strokeWidth={2} aria-hidden="true" focusable="false" />
              Red flag
            </div>
          ) : stars > 0 ? (
            <div role="img" aria-label={`${stars} out of 5`} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 4 }}>
              {Array.from({ length: stars }, (_, i) => (
                <Star key={i} size={14} color={w.star} fill={w.star} strokeWidth={1.5} aria-hidden="true" focusable="false" />
              ))}
            </div>
          ) : null}
          {details.gsVerdict && <div style={st.body}>{details.gsVerdict}</div>}
        </div>
      )}

      {/* The price: Verified when Google gave a price level, else where the words came from. */}
      {details.value && (
        <div style={{ marginBottom: 10 }}>
          <div style={st.label}>Price</div>
          <div style={st.body}>
            {details.value}
            <SourceStamp tier={details?.verifiedFacts?.priceBand ? 'verified' : sourceFor('value')} w={w} />
          </div>
        </div>
      )}

      <LinesWait wait={details.wait} callConfirm={callConfirm} sourceFor={sourceFor} w={w} />
    </div>
  );
}

// Lines and wait: a built-in queue (timing won't fix it), a crowd-driven one (timing
// will) and the typical wait, when the Worker has them; a calm note when it has none.
function LinesWait({ wait, callConfirm, sourceFor, w }) {
  const st = styles(w);
  const hasReal = !!(wait && (wait.builtIn || wait.crowdDriven || wait.typicalMinutes != null));
  const kind = (t) => <span style={{ fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: w.ink, marginRight: 6 }}>{t}</span>;
  return (
    <div style={{ ...st.box, marginBottom: 4 }}>
      <div style={st.label}>Lines &amp; wait</div>
      {hasReal ? (
        <div style={st.body}>
          {wait.builtIn && <div style={{ marginBottom: 4 }}>{kind('Built-in')}{wait.builtIn}<SourceStamp tier={sourceFor('wait.builtIn')} w={w} /></div>}
          {wait.crowdDriven && <div style={{ marginBottom: wait.typicalMinutes != null ? 4 : 0 }}>{kind('Crowd')}{wait.crowdDriven}<SourceStamp tier={sourceFor('wait.crowdDriven')} w={w} /></div>}
          {wait.typicalMinutes != null && <div>{kind('Typical')}~{wait.typicalMinutes} min<SourceStamp tier={sourceFor('wait.typicalMinutes')} w={w} /></div>}
        </div>
      ) : (
        <div style={{ ...st.body, color: NEUTRAL.ink2 }}>
          No queueing reported. Check the venue site if you&rsquo;re visiting on a peak day.
          <SourceStamp tier="call" onClick={callConfirm} w={w} />
        </div>
      )}
    </div>
  );
}

function QuickFitTile({ tile, callConfirm, w }) {
  const Icon = tile.icon;
  return (
    <div style={{ ...styles(w).box, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, fontFamily: MONO, fontSize: fs(10), lineHeight: 1.3, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: NEUTRAL.ink3 }}>
        <Icon size={13} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        {tile.label}
      </div>
      <div style={{ fontSize: fs(13), fontWeight: 600, lineHeight: 1.3, color: NEUTRAL.ink, overflowWrap: 'break-word' }}>{tile.value}</div>
      {tile.stamp && (
        <div style={{ marginTop: 4, marginLeft: -6 }}>
          <SourceStamp tier={tile.stamp} onClick={tile.stamp === 'call' ? callConfirm : null} w={w} />
        </div>
      )}
    </div>
  );
}

// The quick-fit derivations: verifiedFacts (Google's hard facts) and the _sources map
// set each tile's stamp. The time tile reads typicalDurationMin, else "Allow 1–2 hr"
// with call to confirm.
function buildQuickFit(details, sourceFor) {
  const vf = details.verifiedFacts || {};
  const dur = Number.isInteger(details.typicalDurationMin) ? details.typicalDurationMin : null;
  return [
    {
      icon: Timer, label: 'Time',
      value: dur ? formatDurationMin(dur) : 'Allow 1–2 hr',
      stamp: dur ? sourceFor('typicalDurationMin') : 'call',
    },
    {
      icon: Ticket, label: 'Price',
      value: derivePrice(details, vf),
      // Verified with Google's price level; else the words' own source; else call.
      stamp: vf.priceBand
        ? 'verified'
        : (details.value ? sourceFor('value') : 'call'),
    },
    {
      icon: Users, label: 'Best for',
      value: deriveBestFor(details),
      stamp: (details.crowd || details.worthIt) ? sourceFor('crowd') : 'call',
    },
    {
      icon: DoorOpen, label: 'Entry',
      value: deriveBooking(details, vf),
      // Verified with Google's reservable flag; else the reservation words' source; else call.
      stamp: typeof vf.reservable === 'boolean'
        ? 'verified'
        : (details?.practical?.reservation ? sourceFor('practical.reservation') : 'call'),
    },
  ];
}

// "~45m" / "~1h" / "~1h 30m" / "~3h" / "~6h+" for the time tile: whole hours when it
// divides evenly, hours and minutes otherwise.
function formatDurationMin(mins) {
  if (mins < 60) return `~${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 6) return `~${h}h`;          // past half a day, drop the precision
  if (m === 0) return `~${h}h`;
  if (m <= 15) return `~${h}h`;          // small remainders round down to the hour
  if (m >= 45) return `~${h + 1}h`;      // large ones round up
  return `~${h}h ${m}m`;
}

function derivePrice(details, vf) {
  // Google's verified price band first.
  if (vf && vf.priceBand) return vf.priceBand;
  const v = details.value;
  if (!v) return 'Check at the gate';
  // A leading word like "Free" / "Cheap" / "Pricey" / "$10".
  const match = v.match(/^(Free|Cheap|Fair|Pricey|Splurge-only|Splurge|Affordable|Budget|\$[\d\-+~]+|\$\$+)\b/i);
  if (match) return match[0];
  return v.length > 28 ? v.slice(0, 26).trim() + '…' : v;
}

function deriveBestFor(details) {
  if (details.crowd) {
    const clause = String(details.crowd).split(/[;,.]/)[0].trim();
    return clause.length > 32 ? clause.slice(0, 30).trim() + '…' : clause;
  }
  if (details.worthIt === 'craving_match') return 'Niche interest';
  if (details.worthIt === 'worth_the_stop') return 'Most travelers';
  if (details.worthIt === 'better_if_convenient') return 'Casual stop';
  return 'Mixed crowd';
}

function deriveBooking(details, vf) {
  // Google's reservable flag is the strongest signal; else the reservation words.
  if (typeof vf?.reservable === 'boolean') {
    return vf.reservable ? 'Reservation available' : 'Walk-in only';
  }
  const r = details?.practical?.reservation;
  if (!r) return 'Walk-in or call';
  const lower = r.toLowerCase();
  if (/required|must book|book ahead|advance/.test(lower)) return 'Reserve ahead';
  if (/timed[- ]entry/.test(lower)) return 'Timed entry';
  if (/recommended/.test(lower)) return 'Reservation suggested';
  if (/walk[- ]in/.test(lower)) return 'Walk-in OK';
  return r.length > 24 ? r.slice(0, 22).trim() + '…' : r;
}

// ============================================================================
// Do
// ============================================================================

function ZoneDo({ details, sourceFor, w }) {
  const st = styles(w);
  const items = Array.isArray(details.alsoRecommended) ? details.alsoRecommended : [];
  if (items.length === 0) return null;
  const tier = sourceFor('alsoRecommended');
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={st.label}>What you&rsquo;ll do here</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', ...st.body }}>
        {items.map((it, i) => (
          <li key={i} style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ flexShrink: 0, width: 5, height: 5, marginTop: '0.6em', borderRadius: 999, background: w.ink }} />
            <span>
              <strong style={{ fontWeight: 600 }}>{it.name}</strong>
              {it.context ? <span style={{ color: NEUTRAL.ink2 }}> — {it.context}</span> : null}
              {/* The source once per list, on the first item. */}
              {i === 0 && <SourceStamp tier={tier} w={w} />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Plan ahead
// ============================================================================

function ZoneBook({ details, sourceFor, w }) {
  const st = styles(w);
  // Information for planning the day: GlobeSkimmers never books (founder, 2026-10-03),
  // so the reservation facts and no ticket button.
  const reservation = details?.practical?.reservation;
  const reservable = details?.verifiedFacts?.reservable;
  if (!reservation && typeof reservable !== 'boolean') return null;
  return (
    <div style={{ ...st.box, marginBottom: 14 }}>
      <div style={st.label}>Plan ahead</div>
      {typeof reservable === 'boolean' && (
        <div style={{ ...st.body, marginBottom: reservation ? 6 : 0 }}>
          {reservable ? 'Reservations available.' : 'Walk-in only.'}
          <SourceStamp tier="verified" w={w} />
        </div>
      )}
      {reservation && (
        <div style={st.body}>
          {reservation}
          <SourceStamp tier={sourceFor('practical.reservation')} w={w} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Fit and prep (tap rows)
// ============================================================================

function ZoneFitPrep({ details, callConfirm, sourceFor, w }) {
  const st = styles(w);
  // Accessibility reads Google's accessibilityOptions (Verified); the reservation row
  // reads the Worker's words when it has them; the rest say what we don't know yet and
  // point to the venue (empty beats invented). The smart tip shows only when the Worker
  // found a concrete, review-backed saving.
  const rows = [
    buildAccessibilityRow(details),
    {
      key: 'restWait', icon: Armchair, label: 'Rest & wait',
      summary: 'Benches, shade, indoor breaks',
      body: 'Rest-stop info isn’t in our data yet. If you’re visiting with kids or seniors, scout shaded benches and indoor cool-down spots on arrival.',
      stamp: 'call',
    },
    {
      key: 'wear', icon: Shirt, label: 'What to wear',
      summary: 'Dress code, weather layers',
      body: 'Dress recommendations aren’t in our data yet. For religious or formal venues, cover shoulders and knees by default.',
      stamp: 'call',
    },
    {
      key: 'surprises', icon: Sparkles, label: 'Local surprises',
      summary: 'Unexpected etiquette or quirks',
      body: 'Local-quirk notes aren’t in our data yet. Ask staff on arrival about photography rules, tipping norms, and entry rituals.',
      stamp: 'call',
    },
    {
      key: 'pets', icon: PawPrint, label: 'Pets & wheels',
      summary: 'Strollers, wheelchairs, pets',
      body: 'Pet and stroller policy isn’t in our data yet. Most indoor museums and religious sites do not allow either; outdoor parks often do.',
      stamp: 'call',
    },
    {
      key: 'reservation', icon: CalendarCheck, label: 'Reservation',
      summary: details?.practical?.reservation || 'Walk-in or call',
      body: details?.practical?.reservation || 'Reservation info isn’t in our data yet. Call ahead or check the venue site.',
      stamp: details?.practical?.reservation ? sourceFor('practical.reservation') : 'call',
    },
  ];

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={st.label}>Fit &amp; prep</div>
      {details.smartTip && (
        <div style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 12, background: w.wash, color: NEUTRAL.ink, fontSize: fs(13), lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontFamily: MONO, fontSize: fs(10.5), fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: w.washInk }}>
            <Lightbulb size={14} color={w.washInk} strokeWidth={2} aria-hidden="true" focusable="false" />
            Smart tip
          </div>
          {details.smartTip}
          <SourceStamp tier={sourceFor('smartTip')} w={w} />
        </div>
      )}
      <div style={{ background: NEUTRAL.white, borderRadius: 12, border: `1px solid ${w.line}`, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <FitPrepRow key={r.key} row={r} isLast={i === rows.length - 1} callConfirm={callConfirm} w={w} />
        ))}
      </div>
    </div>
  );
}

// The accessibility row from Google's accessibilityOptions: each flag we have is a check
// or a cross; flags Google didn't report are left out, so "no" never stands for "no
// data". Verified only when at least one flag is reported.
function buildAccessibilityRow(details) {
  const acc = details?.verifiedFacts?.accessibility;
  const unknown = (body) => ({ key: 'accessibility', icon: Accessibility, label: 'Accessibility', summary: 'Mobility, vision, hearing notes', body, stamp: 'call' });
  if (!acc) return unknown('Detailed accessibility info isn’t in our data yet. Check the venue website for ramps, elevators, audio guides, and seating availability.');
  const items = [
    { key: 'wheelchairAccessibleEntrance', label: 'Wheelchair-accessible entrance' },
    { key: 'wheelchairAccessibleParking',  label: 'Wheelchair-accessible parking' },
    { key: 'wheelchairAccessibleRestroom', label: 'Wheelchair-accessible restroom' },
    { key: 'wheelchairAccessibleSeating',  label: 'Wheelchair-accessible seating' },
  ];
  const reported = items.filter((i) => acc[i.key] != null);
  if (reported.length === 0) return unknown('Detailed accessibility info isn’t reported for this place. Check the venue website to confirm.');
  // The summary from the strongest signal, the entrance.
  const entrance = acc.wheelchairAccessibleEntrance;
  const summary = entrance === true
    ? 'Wheelchair-accessible entrance reported'
    : entrance === false
      ? 'No wheelchair entrance reported'
      : 'Some accessibility flags reported';
  const body = (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {reported.map((i) => (
        <li key={i.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
          <YesNo yes={!!acc[i.key]} />
          <span>{i.label}</span>
        </li>
      ))}
    </ul>
  );
  return { key: 'accessibility', icon: Accessibility, label: 'Accessibility', summary, body, stamp: 'verified' };
}

function FitPrepRow({ row, isLast, callConfirm, w }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const Icon = row.icon;
  return (
    <div style={{ borderBottom: isLast ? 'none' : `1px solid ${w.line}` }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '8px 12px', background: 'transparent', border: 0, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', outlineOffset: -2 }}
      >
        <Icon size={18} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: fs(13), fontWeight: 600, lineHeight: 1.3, color: NEUTRAL.ink }}>{row.label}</span>
          <span style={{ fontSize: fs(12), lineHeight: 1.3, color: NEUTRAL.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.summary}</span>
        </span>
        <ChevronDown size={16} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      <div id={id} hidden={!open} style={{ padding: '0 12px 12px 40px', fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
        {open ? (
          <>
            {row.body}
            <div style={{ marginTop: 4, marginLeft: -6 }}>
              <SourceStamp tier={row.stamp} onClick={row.stamp === 'call' ? callConfirm : null} w={w} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// Traveler fit
// ============================================================================
// Tap to open quick reads for kinds of traveler. Strict rules:
//   1. Only data already in details / verifiedFacts; no new model call.
//   2. A chip shows only when its data exists (empty beats invented).
//   3. Heights names a harness only when one is required.
//   4. Stroller leads with "can it roll inside", says distance neutrally, and the
//      park-it line carries call to confirm.
//   5. Limited mobility: Google's verified flags first, then what the text says.

function TravelerChips({ details, callConfirm, sourceFor, w }) {
  const st = styles(w);
  const acc = details?.verifiedFacts?.accessibility || {};
  const rawTexts = collectScannableText(details);
  const chips = [
    buildLimitedMobilityChip(details, acc, rawTexts, sourceFor),
    buildStrollerChip(details, acc, rawTexts, sourceFor),
    buildHeightsChip(details, rawTexts, sourceFor),
  ].filter(Boolean);
  if (chips.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={st.label}>Traveler fit</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8 }}>
        {chips.map((c) => <TravelerChip key={c.key} chip={c} callConfirm={callConfirm} w={w} />)}
      </div>
    </div>
  );
}

function TravelerChip({ chip, callConfirm, w }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const Icon = chip.icon;
  return (
    <div style={{ width: open ? '100%' : 'auto' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: 0, background: 'transparent', border: 0, fontFamily: 'inherit', cursor: 'pointer' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, boxSizing: 'border-box', padding: '0 11px', borderRadius: 10, border: `1px solid ${open ? w.ink : w.line}`, background: open ? w.wash : NEUTRAL.white, color: NEUTRAL.ink2, fontSize: fs(12.5), fontWeight: 600 }}>
          <Icon size={14} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" />
          {chip.label}
          <ChevronDown size={14} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </span>
      </button>
      <div id={id} hidden={!open}>
        {open ? (
          <div style={{ ...styles(w).box, marginBottom: 6, fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink }}>
            {chip.lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i === chip.lines.length - 1 ? 0 : 6 }}>
                {line.yes != null ? <YesNo yes={line.yes} /> : null}
                <span>
                  {line.text}
                  {line.stamp && <SourceStamp tier={line.stamp} onClick={line.stamp === 'call' ? callConfirm : null} w={w} />}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Every renderable string field, lowercased into one blob for the keyword scans. Cheap;
// runs once per open.
function collectScannableText(details) {
  const parts = [];
  if (details.whatYouSee) parts.push(details.whatYouSee);
  if (details.aboutAndHistory) parts.push(details.aboutAndHistory);
  if (details.crowd) parts.push(details.crowd);
  if (details.vibe) parts.push(details.vibe);
  if (details.travelerNotes) parts.push(details.travelerNotes);
  if (Array.isArray(details.goodToKnow)) parts.push(details.goodToKnow.join(' '));
  if (Array.isArray(details.alsoRecommended)) {
    parts.push(details.alsoRecommended.map((x) => `${x.name || ''} ${x.context || ''}`).join(' '));
  }
  const lower = parts.join(' \n ').toLowerCase();
  return { lower, has: (rx) => rx.test(lower) };
}

// Limited mobility: Google's accessibility flags first (the strongest signal), then
// friction the text mentions (stairs, levels, long walks). Shown on any signal.
function buildLimitedMobilityChip(details, acc, rawTexts, sourceFor) {
  const accReported = Object.values(acc || {}).some((v) => v != null);
  const stairsRx = /\b(stairs?|steep|climb|many steps?|multi[- ]level|no elevator)\b/i;
  const accessibleRx = /\b(wheelchair|step[- ]free|ramp|elevator|accessible)\b/i;
  const friction = rawTexts.has(stairsRx);
  const accessibleMention = rawTexts.has(accessibleRx);
  if (!accReported && !friction && !accessibleMention) return null;

  const lines = [];
  // One verified line per reported Google flag.
  if (accReported) {
    const entrance = acc.wheelchairAccessibleEntrance;
    if (entrance === true) lines.push({ yes: true, text: 'Wheelchair-accessible entrance reported.', stamp: 'verified' });
    else if (entrance === false) lines.push({ yes: false, text: 'No wheelchair-accessible entrance reported.', stamp: 'verified' });
    if (acc.wheelchairAccessibleRestroom === true) lines.push({ yes: true, text: 'Wheelchair-accessible restroom reported.', stamp: 'verified' });
    if (acc.wheelchairAccessibleParking === true) lines.push({ yes: true, text: 'Wheelchair-accessible parking reported.', stamp: 'verified' });
  }
  if (friction) lines.push({ text: 'Reviewers mention stairs or steps inside.', stamp: sourceFor('whatYouSee') });
  if (accessibleMention && !accReported) {
    // Scanned from the model's own copy (collectScannableText), not review text: labelled like its siblings.
    lines.push({ text: 'Accessibility features are mentioned. Confirm specifics with the venue.', stamp: sourceFor('whatYouSee') });
  }
  if (lines.length === 0) lines.push({ text: 'Some accessibility info reported. Confirm specifics with the venue.', stamp: 'call' });
  return { key: 'limitedMobility', icon: Accessibility, label: 'Limited mobility', lines };
}

// Stroller: can it roll inside (the positive frame), paths stated neutrally, then
// where to park it (call to confirm: we hold no stroller-parking data). Shown on any
// wheelchair-entrance signal or a mention of paths or strollers.
function buildStrollerChip(details, acc, rawTexts, sourceFor) {
  const rollInside = acc?.wheelchairAccessibleEntrance === true;
  const noRoll = acc?.wheelchairAccessibleEntrance === false;
  const strollerMention = rawTexts.has(/\b(stroller|pram|paths?|walkway|pavement|paved)\b/i);
  if (!rollInside && !noRoll && !strollerMention) return null;

  const lines = [];
  if (rollInside) lines.push({ yes: true, text: 'Can roll inside: wheelchair-accessible entrance reported.', stamp: 'verified' });
  else if (noRoll) lines.push({ yes: false, text: 'No wheelchair-accessible entrance reported. Strollers may face the same access issues.', stamp: 'verified' });
  if (strollerMention) lines.push({ text: 'Reviewers mention paths or walkways on site.', stamp: sourceFor('whatYouSee') });
  lines.push({ text: 'Stroller parking isn’t in our data. Check with the venue.', stamp: 'call' });
  return { key: 'stroller', icon: Baby, label: 'Stroller', lines };
}

// Heights: only when the text mentions towers, decks, drops or harnesses, and a harness
// only when one is required (silent otherwise).
function buildHeightsChip(details, rawTexts, sourceFor) {
  const heightsRx = /\b(tower|observation deck|skywalk|sky walk|glass floor|cliff|viewpoint|panoram|rooftop|gondola|cable car|drop tower|ferris wheel|zipline|bungee|skydive|height)\b/i;
  const harnessRequiredRx = /\b(harness (?:required|provided|mandatory|needed)|safety harness|requires? a harness)\b/i;
  const heights = rawTexts.has(heightsRx);
  const harnessRequired = rawTexts.has(harnessRequiredRx);
  if (!heights && !harnessRequired) return null;
  const lines = [];
  if (heights) lines.push({ text: 'Reviewers mention high vantage points or vertical drops on site.', stamp: sourceFor('whatYouSee') });
  if (harnessRequired) lines.push({ text: 'A safety harness is required for parts of the visit.', stamp: sourceFor('goodToKnow') });
  return { key: 'heights', icon: Mountain, label: 'Heights', lines };
}

// ============================================================================
// More detail
// ============================================================================

function DepthMore({ details, sourceFor, w }) {
  const st = styles(w);
  const [open, setOpen] = useState(false);
  const id = useId();
  const rows = [
    { sourceKey: 'vibe',            label: 'Vibe',            value: details.vibe },
    { sourceKey: 'whatYouSee',      label: 'What you see',    value: details.whatYouSee },
    { sourceKey: 'aboutAndHistory', label: 'About & history', value: details.aboutAndHistory },
    { sourceKey: 'crowd',           label: 'Crowd',           value: details.crowd },
    { sourceKey: 'bestTime',        label: 'Best time',       value: details.bestTime },
    { sourceKey: 'awards',          label: 'Awards',          value: details.awards },
    { sourceKey: 'photoWorthy',     label: 'Photo-worthy',    value: details.photoWorthy },
    { sourceKey: 'travelerNotes',   label: 'Traveler notes',  value: details.travelerNotes },
  ].filter((r) => r.value);
  const goodToKnow = Array.isArray(details.goodToKnow) ? details.goodToKnow.filter(Boolean) : [];
  if (rows.length === 0 && goodToKnow.length === 0) return null;

  return (
    <div style={{ marginBottom: 4, borderTop: `1px solid ${w.line}` }}>
      <QuietRow world={w} icon={BookOpen} expanded={open} controls={id} onClick={() => setOpen((o) => !o)} chevron>
        More detail
      </QuietRow>
      <div id={id} hidden={!open} style={{ paddingTop: 4 }}>
        {open ? (
          <>
            {goodToKnow.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
                  <div style={{ ...st.label, marginBottom: 0 }}>Good to know</div>
                  <SourceStamp tier={sourceFor('goodToKnow')} w={w} />
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, ...st.body }}>
                  {goodToKnow.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
            {rows.map((r) => (
              <div key={r.label} style={{ marginBottom: 10 }}>
                <div style={st.label}>{r.label}</div>
                <div style={st.body}>
                  {r.value}
                  <SourceStamp tier={sourceFor(r.sourceKey)} w={w} />
                </div>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
