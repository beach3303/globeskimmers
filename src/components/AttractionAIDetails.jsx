/**
 * AttractionAIDetails — Things-To-Do "🤖 AI DETAILS" panel.
 *
 * FORK of AIDetailsSection.jsx (Phase 1 of the Things To Do redesign).
 * Attraction-only renderer; PlacesToEat and the other finders keep using
 * the shared AIDetailsSection.jsx. Forked so the attraction layout can
 * diverge from the restaurant panel without risk to restaurant rendering.
 *
 * Phase 1 scope: presentation restructure ONLY.
 * - Still calls the existing getAIDetails Base44 function (which routes to
 *   the Worker /ai-details endpoint with kind='attraction').
 * - Consumes the SAME JSON shape the Worker returns today (v7 schema).
 * - No Worker/prompt changes. No new fields. No new cache key.
 * - Source-stamp badges are visual-only ("Verified" / "from reviews" /
 *   "call to confirm") and hardcoded per field for now. Phase 2 will
 *   plumb real per-field source tiers from a forked attraction prompt.
 *
 * Layout (per handoff):
 *   Zone 1 — DECIDE: Quick-Fit strip + GS Verdict + Price + Lines & Wait
 *   Zone 2 — DO: "What You'll Do Here" (built from alsoRecommended)
 *   Zone 3 — BOOK AHEAD: affiliate placeholder slot (Phase 4 wires real button)
 *   Zone 4 — FIT & PREP: collapsed tap-rows
 *   "More" tap: depth prose (Vibe, About, Crowd, BestTime, Value, GoodToKnow, Traveler)
 *
 * Honesty rules in render:
 *   - Each fact carries a source stamp.
 *   - Unknowns show "call to confirm" wired to the place's website (when present).
 *   - Conditional sections (sell-out nudge, smart tip) render ONLY on a real
 *     signal — Phase 1 always omits them since we have no signal yet.
 *   - No editorializing.
 */
import React, { useState, useEffect } from 'react';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { logEvent } from '@/lib/analytics';

// Shared palette — matches AIDetailsSection.jsx so the AI panel reads the
// same across the app even after the fork.
const DARK = '#1A2332';
const GRAY = '#64748B';
const GRAY_DEEP = '#475569';
const PURPLE = '#6D28D9';
const PURPLE_LIGHT = '#DDD6FE';
const PURPLE_BG = '#F5F3FF';
const PURPLE_SHIMMER = '#EDE9FE';
const DIVIDER = '#E5E7EB';

// One key shared with the restaurant panel — the "what is GS Verdict"
// subtitle is a one-time onboarding. If the user already saw it on a
// restaurant card, no reason to re-explain on an attraction card.
const GS_VERDICT_HELPER_KEY = 'gs_verdict_helper_seen';
function readVerdictHelperSeen() {
  try { return localStorage.getItem(GS_VERDICT_HELPER_KEY) === '1'; }
  catch { return true; }
}
function markVerdictHelperSeen() {
  try { localStorage.setItem(GS_VERDICT_HELPER_KEY, '1'); } catch { /* ignore */ }
}

// Source-stamp palette. Phase 1 stamps are visual stand-ins; Phase 2 will
// drive these from a per-field source tier the Worker returns.
const STAMP_STYLES = {
  verified:  { label: 'Verified',        bg: '#DCFCE7', color: '#166534' },
  reviews:   { label: 'from reviews',    bg: '#FEF3C7', color: '#92400E' },
  forecast:  { label: 'from forecast',   bg: '#FEF3C7', color: '#92400E' },
  // Frontend-only tier for model-written copy the Worker didn't tag.
  estimated: { label: 'AI estimate',     bg: '#FEF3C7', color: '#92400E' },
  call:      { label: 'call to confirm', bg: '#DBEAFE', color: '#1E40AF' },
};

function SourceStamp({ tier, onClick }) {
  const s = STAMP_STYLES[tier];
  if (!s) return null;
  const interactive = tier === 'call' && typeof onClick === 'function';
  return (
    <span
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: '600',
        padding: '1px 6px',
        background: s.bg,
        color: s.color,
        borderRadius: '4px',
        marginLeft: '6px',
        cursor: interactive ? 'pointer' : 'default',
        textDecoration: interactive ? 'underline dotted' : 'none',
        verticalAlign: 'middle',
      }}
    >
      {s.label}
    </span>
  );
}

// Worth-It badge palette — kept identical to the restaurant panel so the
// brand vocabulary stays consistent across the app.
const WORTH_LABELS = {
  worth_the_stop:       { icon: '💎', label: 'Worth the Stop',       bg: '#DCFCE7', color: '#166534' },
  strong_nearby_pick:   { icon: '✅', label: 'Strong Nearby Pick',   bg: '#DBEAFE', color: '#1E40AF' },
  craving_match:        { icon: '🎯', label: 'Niche Match',          bg: '#FCE7F3', color: '#9D174D' },
  know_before_you_go:   { icon: '⚠️', label: 'Know Before You Go',   bg: '#FEF3C7', color: '#92400E' },
  better_if_convenient: { icon: '↪️', label: 'Better If Convenient', bg: '#F1F5F9', color: '#475569' },
};

export default function AttractionAIDetails({ placeId, placeName, page }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Snapshot at mount so the subtitle stays visible for THIS open even
  // after we mark it seen; the next panel reads the freshly-true flag.
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
    // Phase 2: switched from /ai-details to /attraction-ai-details. The new
    // endpoint returns a richer payload (verifiedFacts + _sources map) so
    // the panel's source stamps reflect real per-field provenance instead
    // of hardcoded placeholders.
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
    <div style={{ padding: '12px 14px', background: PURPLE_BG, borderRadius: '10px', border: `1px solid ${PURPLE_LIGHT}` }}>
      <button
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.5px' }}>🤖 AI DETAILS</span>
        <span style={{ fontSize: '11px', color: PURPLE }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: '10px' }}>
          <Body loading={loading} error={error} details={details} showVerdictHelper={showVerdictHelper} />
        </div>
      )}
    </div>
  );
}

function Body({ loading, error, details, showVerdictHelper }) {
  if (loading) return <Shimmer />;
  if (error) return <div style={{ fontSize: '12px', color: '#B91C1C' }}>AI Details unavailable right now. {error}</div>;
  if (!details) return null;

  const websiteUri = details.websiteUri || null;
  // Tap "call to confirm" stamps to open the place's website in a new tab.
  // When no website is known, the stamp is non-interactive (informational).
  const callConfirm = websiteUri ? () => window.open(websiteUri, '_blank', 'noopener,noreferrer') : null;

  // Phase 2: read source-tier from the Worker's _sources map. Any field the
  // Worker didn't tag (old cached entries, unmarked fields) is still
  // model-written copy, so it falls back to 'estimated' ("AI estimate") —
  // only the Worker may claim a field came "from reviews".
  const sourcesMap = (details && typeof details._sources === 'object' && details._sources) || {};
  const sourceFor = (key, fallback = 'estimated') => sourcesMap[key] || fallback;

  return (
    <div>
      <ZoneDecide details={details} showVerdictHelper={showVerdictHelper} callConfirm={callConfirm} sourceFor={sourceFor} />
      <ZoneDo details={details} sourceFor={sourceFor} />
      <TravelerChips details={details} callConfirm={callConfirm} sourceFor={sourceFor} />
      <ZoneBook details={details} sourceFor={sourceFor} />
      <ZoneFitPrep details={details} callConfirm={callConfirm} sourceFor={sourceFor} />
      <DepthMore details={details} sourceFor={sourceFor} />
      {websiteUri && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: GRAY }}>
          For more information, visit{' '}
          <a href={websiteUri} target="_blank" rel="noopener noreferrer" style={{ color: PURPLE, textDecoration: 'underline' }}>
            {websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        </div>
      )}
    </div>
  );
}

function Shimmer() {
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[88, 72, 80, 66, 75].map((w, i) => (
          <div
            key={i}
            style={{
              height: '12px',
              width: `${w}%`,
              background: `linear-gradient(90deg,${PURPLE_SHIMMER} 0%,${PURPLE_LIGHT} 50%,${PURPLE_SHIMMER} 100%)`,
              backgroundSize: '200% 100%',
              borderRadius: '4px',
              animation: 'gsShimmer 1.2s ease-in-out infinite',
            }}
          />
        ))}
      </div>
      <style>{`@keyframes gsShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

// ============================================================================
// Zone 1 — DECIDE
// ============================================================================

function ZoneDecide({ details, showVerdictHelper, callConfirm, sourceFor }) {
  const worthTag = details.worthIt && WORTH_LABELS[details.worthIt];
  const hasVerdict = (details.gsStars != null || details.gsRedFlag || details.gsVerdict || worthTag);

  // Quick-Fit strip values. Each tile carries a source stamp driven by the
  // Worker's verifiedFacts + _sources map (Phase 2). Time is still derived
  // because we don't yet collect typical-visit-duration anywhere.
  const quickFit = buildQuickFit(details, sourceFor);

  return (
    <div style={{ marginBottom: '14px' }}>
      {/* Quick-Fit strip — 5-second go/no-go. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {quickFit.map((tile) => (
          <QuickFitTile key={tile.label} tile={tile} callConfirm={callConfirm} />
        ))}
      </div>

      {/* GS Verdict anchors the decide zone. */}
      {hasVerdict && (
        <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: `1px solid ${PURPLE_LIGHT}` }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: showVerdictHelper ? '2px' : '6px' }}>💯 GS VERDICT</div>
          {showVerdictHelper && (
            <div style={{ fontSize: '11px', color: GRAY, fontStyle: 'italic', marginBottom: '8px' }}>
              Globeskimmers' traveler-fit take on this place.
            </div>
          )}
          {worthTag && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{
                display: 'inline-block', fontSize: '12px', fontWeight: '600',
                padding: '3px 10px', background: worthTag.bg, color: worthTag.color, borderRadius: '9999px',
              }}>
                {worthTag.icon} {worthTag.label}
              </span>
            </div>
          )}
          {(details.gsStars != null && details.gsStars > 0) || details.gsRedFlag ? (
            <div style={{ fontSize: '13px', marginBottom: '4px' }}>
              {details.gsRedFlag
                ? <strong>🚩</strong>
                : <strong style={{ letterSpacing: '1px' }}>{'⭐'.repeat(Math.min(5, Math.max(0, details.gsStars)))}</strong>}
            </div>
          ) : null}
          {details.gsVerdict && (
            <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>{details.gsVerdict}</div>
          )}
        </div>
      )}

      {/* Price line — Verified stamp when Google priceLevel exists
          (verifiedFacts.priceBand), reviews otherwise. */}
      {details.value && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>💰 PRICE</div>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>
            {details.value}
            <SourceStamp tier={details?.verifiedFacts?.priceBand ? 'verified' : sourceFor('value')} />
          </div>
        </div>
      )}

      {/* Lines & Wait — Phase 2.5 renders the structured wait object when
          present: built-in (mechanism, timing won't fix) vs crowd-driven
          (timing-fixable bottleneck) vs typical wait in minutes. Falls back
          to a calm "coming soon" placeholder ONLY when no signal exists. */}
      <LinesWait wait={details.wait} callConfirm={callConfirm} sourceFor={sourceFor} />
    </div>
  );
}

function LinesWait({ wait, callConfirm, sourceFor }) {
  const hasReal = !!(wait && (wait.builtIn || wait.crowdDriven || wait.typicalMinutes != null));
  return (
    <div style={{ marginBottom: '4px', padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}` }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>⏳ LINES &amp; WAIT</div>
      {hasReal ? (
        <div style={{ fontSize: '13px', color: DARK, lineHeight: '1.5' }}>
          {wait.builtIn && (
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ color: PURPLE, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '6px' }}>Built-in</strong>
              {wait.builtIn}
              <SourceStamp tier={sourceFor('wait.builtIn')} />
            </div>
          )}
          {wait.crowdDriven && (
            <div style={{ marginBottom: wait.typicalMinutes != null ? '4px' : 0 }}>
              <strong style={{ color: PURPLE, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '6px' }}>Crowd</strong>
              {wait.crowdDriven}
              <SourceStamp tier={sourceFor('wait.crowdDriven')} />
            </div>
          )}
          {wait.typicalMinutes != null && (
            <div>
              <strong style={{ color: PURPLE, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '6px' }}>Typical</strong>
              ~{wait.typicalMinutes} min
              <SourceStamp tier={sourceFor('wait.typicalMinutes')} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: GRAY_DEEP, lineHeight: '1.5' }}>
          No queueing reported. Check the venue site if you're visiting on a peak day.
          <SourceStamp tier="call" onClick={callConfirm} />
        </div>
      )}
    </div>
  );
}

function QuickFitTile({ tile, callConfirm }) {
  return (
    <div style={{ padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}` }}>
      <div style={{ fontSize: '10px', fontWeight: '700', color: GRAY, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '3px' }}>
        {tile.icon} {tile.label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: '600', color: DARK, lineHeight: '1.3' }}>
        {tile.value}
      </div>
      {tile.stamp && (
        <div style={{ marginTop: '4px' }}>
          <SourceStamp tier={tile.stamp} onClick={tile.stamp === 'call' ? callConfirm : null} />
        </div>
      )}
    </div>
  );
}

// Quick-Fit derivations. Phase 2 reads verifiedFacts (Google-sourced hard
// facts) + the per-field _sources map so each tile's stamp reflects real
// provenance. Phase 2.5 adds typicalDurationMin into the Time tile —
// falls back to the "Allow 1–2 hr" stub with a call-to-confirm stamp
// when reviews don't support a confident number.
function buildQuickFit(details, sourceFor) {
  const vf = details.verifiedFacts || {};
  const dur = Number.isInteger(details.typicalDurationMin) ? details.typicalDurationMin : null;
  return [
    {
      icon: '⏱️', label: 'Time',
      value: dur ? formatDurationMin(dur) : 'Allow 1–2 hr',
      stamp: dur ? sourceFor('typicalDurationMin') : 'call',
    },
    {
      icon: '💵', label: 'Price',
      value: derivePrice(details, vf),
      // Verified when Google priceLevel exists (vf.priceBand); reviews
      // when the Haiku-derived value field is what we're showing; call
      // when neither.
      stamp: vf.priceBand
        ? 'verified'
        : (details.value ? sourceFor('value') : 'call'),
    },
    {
      icon: '👥', label: 'Best for',
      value: deriveBestFor(details),
      stamp: (details.crowd || details.worthIt) ? sourceFor('crowd') : 'call',
    },
    {
      icon: '🎟️', label: 'Booking',
      value: deriveBooking(details, vf),
      // Verified when Google reservable flag is present, reviews when
      // we're falling back to the practical.reservation text, call when
      // neither.
      stamp: typeof vf.reservable === 'boolean'
        ? 'verified'
        : (details?.practical?.reservation ? sourceFor('practical.reservation') : 'call'),
    },
  ];
}

// "~45m" / "~1h" / "~1h 30m" / "~3h" / "~6h+" rendering for the Time tile.
// Hours-only for >=60min that divides evenly; mixed h+m otherwise.
function formatDurationMin(mins) {
  if (mins < 60) return `~${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 6) return `~${h}h`;          // anything beyond half-day, drop precision
  if (m === 0) return `~${h}h`;
  if (m <= 15) return `~${h}h`;          // round small remainders to the hour
  if (m >= 45) return `~${h + 1}h`;      // round up large remainders
  return `~${h}h ${m}m`;
}

function derivePrice(details, vf) {
  // Prefer the Google-verified price band when we have one.
  if (vf && vf.priceBand) return vf.priceBand;
  const v = details.value;
  if (!v) return 'Check at gate';
  // Pull a leading token like "Free" / "Cheap" / "Pricey" / "$10".
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
  // Google's reservable flag is the strongest signal. true → "Reservation
  // available"; false → "Walk-in only". When unknown, fall back to the
  // Haiku-derived practical.reservation text.
  if (typeof vf?.reservable === 'boolean') {
    return vf.reservable ? 'Reservation available' : 'Walk-in only';
  }
  const r = details?.practical?.reservation;
  if (!r) return 'Walk-in or call';
  const lower = r.toLowerCase();
  if (/required|must book|book ahead|advance/.test(lower)) return 'Book ahead';
  if (/timed[- ]entry/.test(lower)) return 'Timed entry';
  if (/recommended/.test(lower)) return 'Reservation suggested';
  if (/walk[- ]in/.test(lower)) return 'Walk-in OK';
  return r.length > 24 ? r.slice(0, 22).trim() + '…' : r;
}

// ============================================================================
// Zone 2 — DO
// ============================================================================

function ZoneDo({ details, sourceFor }) {
  const items = Array.isArray(details.alsoRecommended) ? details.alsoRecommended : [];
  if (items.length === 0) return null;
  const tier = sourceFor('alsoRecommended');
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        🎯 WHAT YOU'LL DO HERE
      </div>
      <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', fontSize: '13px', lineHeight: '1.55', color: DARK }}>
        {items.map((it, i) => (
          <li key={i} style={{ marginBottom: '8px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, color: PURPLE, fontWeight: '700' }}>•</span>
            <span>
              <strong style={{ fontWeight: '600' }}>{it.name}</strong>
              {it.context ? <span style={{ color: GRAY_DEEP }}> — {it.context}</span> : null}
              {/* Source stamp once per list (on the first item) to avoid noise. */}
              {i === 0 && <SourceStamp tier={tier} />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Zone 3 — BOOK AHEAD
// ============================================================================

function ZoneBook({ details, sourceFor }) {
  // Phase 4 is rescoped — the original affiliate-ticket button is on hold.
  // The replacement direction is an "Eat Nearby" hand-off (attraction →
  // PlacesToEat search of the attraction's address, with a return path
  // back here). Until that's spec'd we render the existing practical.reservation
  // line as the actionable info in this zone, with no fake CTA below it.
  const reservation = details?.practical?.reservation;
  const reservable = details?.verifiedFacts?.reservable;
  if (!reservation && typeof reservable !== 'boolean') return null;
  return (
    <div style={{ marginBottom: '14px', padding: '12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}` }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        🎟️ BOOKING
      </div>
      {typeof reservable === 'boolean' && (
        <div style={{ fontSize: '13px', color: DARK, lineHeight: '1.5', marginBottom: reservation ? '6px' : '0' }}>
          {reservable ? 'Reservations available.' : 'Walk-in only.'}
          <SourceStamp tier="verified" />
        </div>
      )}
      {reservation && (
        <div style={{ fontSize: '13px', color: DARK, lineHeight: '1.5' }}>
          {reservation}
          <SourceStamp tier={sourceFor('practical.reservation')} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Zone 4 — FIT & PREP (collapsed tap-rows)
// ============================================================================

function ZoneFitPrep({ details, callConfirm, sourceFor }) {
  // Phase 2: Accessibility row reads real Google accessibilityOptions
  // (Verified). Reservation row reads real Haiku-derived data when
  // present. Other rows still fall back to "call to confirm" until we
  // collect that data — handoff honesty rule: empty beats invented.
  // Phase 2.5: Smart Tip surfaces at the top of the zone when the Worker
  // returned a concrete review-supported save (money/time/mistake-avoidance).
  // Silently absent when smartTip is null — no platitude fallback.
  const rows = [
    buildAccessibilityRow(details),
    {
      key: 'restWait', icon: '🪑', label: 'Rest & Wait',
      summary: 'Benches, shade, indoor breaks',
      body: 'Rest-stop info isn’t in our data yet. If you’re visiting with kids or seniors, scout shaded benches and indoor cool-down spots on arrival.',
      stamp: 'call',
    },
    {
      key: 'wear', icon: '👕', label: 'What to Wear',
      summary: 'Dress code, weather layers',
      body: 'Dress recommendations aren’t in our data yet. For religious or formal venues, cover shoulders and knees by default.',
      stamp: 'call',
    },
    {
      key: 'surprises', icon: '✨', label: 'Local Surprises',
      summary: 'Unexpected etiquette or quirks',
      body: 'Local-quirk notes aren’t in our data yet. Ask staff on arrival about photography rules, tipping norms, and entry rituals.',
      stamp: 'call',
    },
    {
      key: 'pets', icon: '🐾', label: 'Pets & Wheels',
      summary: 'Strollers, wheelchairs, pets',
      body: 'Pet and stroller policy isn’t in our data yet. Most indoor museums and religious sites do not allow either; outdoor parks often do.',
      stamp: 'call',
    },
    {
      key: 'reservation', icon: '📅', label: 'Reservation',
      summary: details?.practical?.reservation || 'Walk-in or call',
      body: details?.practical?.reservation || 'Reservation info isn’t in our data yet. Call ahead or check the venue site.',
      stamp: details?.practical?.reservation ? sourceFor('practical.reservation') : 'call',
    },
  ];

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        🧭 FIT &amp; PREP
      </div>
      {details.smartTip && (
        <div style={{
          marginBottom: '8px',
          padding: '10px 12px',
          background: '#FEF9C3',
          borderRadius: '8px',
          border: '1px solid #FDE68A',
          fontSize: '13px',
          color: '#713F12',
          lineHeight: '1.5',
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.4px', marginBottom: '4px' }}>
            💡 SMART TIP
          </div>
          {details.smartTip}
          <SourceStamp tier={sourceFor('smartTip')} />
        </div>
      )}
      <div style={{ background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}`, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <FitPrepRow
            key={r.key}
            row={r}
            isLast={i === rows.length - 1}
            callConfirm={callConfirm}
          />
        ))}
      </div>
    </div>
  );
}

// Build the Accessibility row from Google's accessibilityOptions when
// present. Each flag we have becomes a checkmark line in the expanded
// body; absent flags get a "not reported" line so the user can see the
// difference between "no" and "no data". Verified stamp ONLY when at
// least one flag is present.
function buildAccessibilityRow(details) {
  const acc = details?.verifiedFacts?.accessibility;
  if (!acc) {
    return {
      key: 'accessibility', icon: '♿', label: 'Accessibility',
      summary: 'Mobility, vision, hearing notes',
      body: 'Detailed accessibility info isn’t in our data yet. Check the venue website for ramps, elevators, audio guides, and seating availability.',
      stamp: 'call',
    };
  }
  const items = [
    { key: 'wheelchairAccessibleEntrance', label: 'Wheelchair-accessible entrance' },
    { key: 'wheelchairAccessibleParking',  label: 'Wheelchair-accessible parking' },
    { key: 'wheelchairAccessibleRestroom', label: 'Wheelchair-accessible restroom' },
    { key: 'wheelchairAccessibleSeating',  label: 'Wheelchair-accessible seating' },
  ];
  const reported = items.filter(i => acc[i.key] != null);
  if (reported.length === 0) {
    return {
      key: 'accessibility', icon: '♿', label: 'Accessibility',
      summary: 'Mobility, vision, hearing notes',
      body: 'Detailed accessibility info isn’t reported for this place. Check the venue website to confirm.',
      stamp: 'call',
    };
  }
  // Build the summary from the strongest signal (entrance).
  const entrance = acc.wheelchairAccessibleEntrance;
  const summary = entrance === true
    ? 'Wheelchair-accessible entrance reported'
    : entrance === false
      ? 'No wheelchair entrance reported'
      : 'Some accessibility flags reported';
  const body = (
    <ul style={{ margin: 0, paddingLeft: '18px' }}>
      {reported.map(i => (
        <li key={i.key} style={{ marginBottom: '4px' }}>
          {acc[i.key] ? '✅ ' : '❌ '} {i.label}
        </li>
      ))}
    </ul>
  );
  return {
    key: 'accessibility', icon: '♿', label: 'Accessibility',
    summary, body, stamp: 'verified',
  };
}

function FitPrepRow({ row, isLast, callConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'transparent', border: 'none',
          padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: DARK }}>
            {row.icon} {row.label}
            <SourceStamp tier={row.stamp} onClick={row.stamp === 'call' ? callConfirm : null} />
          </span>
          <span style={{ fontSize: '12px', color: GRAY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.summary}
          </span>
        </span>
        <span style={{ fontSize: '11px', color: PURPLE, marginLeft: '8px', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px 12px', fontSize: '13px', lineHeight: '1.5', color: GRAY_DEEP }}>
          {row.body}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Traveler chips — Phase 3
// ============================================================================
// Tap-to-expand chips for traveler-type quick reads. STRICT RULES:
//   1. Recombine data ALREADY in details / verifiedFacts. No new Haiku call.
//   2. Render a chip ONLY if its underlying data exists (handoff: empty
//      beats invented).
//   3. Heights chip mentions a harness ONLY if a harness is required.
//      Silent on harnesses for venues that don't need one — no editorializing.
//   4. Stroller chip: lead with "can it roll inside" (positive), distance
//      stated neutrally, park-it line carries "call to confirm".
//   5. Limited-mobility chip: surface verified accessibility flags first,
//      then review-derived friction (stairs etc.) below.

function TravelerChips({ details, callConfirm, sourceFor }) {
  const acc = details?.verifiedFacts?.accessibility || {};
  const rawTexts = collectScannableText(details);

  const chips = [
    buildLimitedMobilityChip(details, acc, rawTexts, sourceFor),
    buildStrollerChip(details, acc, rawTexts, sourceFor),
    buildHeightsChip(details, rawTexts, sourceFor),
  ].filter(Boolean);

  if (chips.length === 0) return null;

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        🧑‍🤝‍🧑 TRAVELER FIT
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {chips.map(c => <TravelerChip key={c.key} chip={c} callConfirm={callConfirm} />)}
      </div>
    </div>
  );
}

function TravelerChip({ chip, callConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: '100%' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '12px', fontWeight: '600',
          padding: '4px 10px',
          background: open ? PURPLE_LIGHT : '#FFFFFF',
          color: PURPLE,
          border: `1px solid ${PURPLE_LIGHT}`,
          borderRadius: '9999px',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span>{chip.icon} {chip.label}</span>
        <span style={{ fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: '8px', padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}`, fontSize: '13px', lineHeight: '1.5', color: DARK }}>
          {chip.lines.map((line, i) => (
            <div key={i} style={{ marginBottom: i === chip.lines.length - 1 ? 0 : '6px' }}>
              {line.text}
              {line.stamp && (
                <SourceStamp
                  tier={line.stamp}
                  onClick={line.stamp === 'call' ? callConfirm : null}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Pulls every renderable string field into one normalized lowercase blob
// for keyword scanning. Cheap, runs once per panel open.
function collectScannableText(details) {
  const parts = [];
  if (details.whatYouSee) parts.push(details.whatYouSee);
  if (details.aboutAndHistory) parts.push(details.aboutAndHistory);
  if (details.crowd) parts.push(details.crowd);
  if (details.vibe) parts.push(details.vibe);
  if (details.travelerNotes) parts.push(details.travelerNotes);
  if (Array.isArray(details.goodToKnow)) parts.push(details.goodToKnow.join(' '));
  if (Array.isArray(details.alsoRecommended)) {
    parts.push(details.alsoRecommended.map(x => `${x.name || ''} ${x.context || ''}`).join(' '));
  }
  const lower = parts.join(' \n ').toLowerCase();
  return {
    lower,
    has: (rx) => rx.test(lower),
  };
}

// Limited-mobility chip — surfaces Google accessibility flags first (the
// strongest signal), then review-derived friction (stairs, multi-level,
// long walks) below. Renders if there is ANY signal.
function buildLimitedMobilityChip(details, acc, rawTexts, sourceFor) {
  const accReported = Object.values(acc || {}).some(v => v != null);
  const stairsRx = /\b(stairs?|steep|climb|many steps?|multi[- ]level|no elevator)\b/i;
  const accessibleRx = /\b(wheelchair|step[- ]free|ramp|elevator|accessible)\b/i;
  const friction = rawTexts.has(stairsRx);
  const accessibleMention = rawTexts.has(accessibleRx);
  if (!accReported && !friction && !accessibleMention) return null;

  const lines = [];
  // Verified line per reported Google flag (compact, one sentence).
  if (accReported) {
    const entrance = acc.wheelchairAccessibleEntrance;
    if (entrance === true) {
      lines.push({ text: '✅ Wheelchair-accessible entrance reported.', stamp: 'verified' });
    } else if (entrance === false) {
      lines.push({ text: '❌ No wheelchair-accessible entrance reported.', stamp: 'verified' });
    }
    if (acc.wheelchairAccessibleRestroom === true) {
      lines.push({ text: '✅ Wheelchair-accessible restroom reported.', stamp: 'verified' });
    }
    if (acc.wheelchairAccessibleParking === true) {
      lines.push({ text: '✅ Wheelchair-accessible parking reported.', stamp: 'verified' });
    }
  }
  if (friction) {
    lines.push({ text: 'Reviewers mention stairs or steps inside.', stamp: sourceFor('whatYouSee') });
  }
  if (accessibleMention && !accReported) {
    // accessibleMention is regex-scanned from the model's own copy (collectScannableText), not review text — label it like its siblings.
    lines.push({ text: 'Accessibility features are mentioned. Confirm specifics with the venue.', stamp: sourceFor('whatYouSee') });
  }
  if (lines.length === 0) {
    lines.push({ text: 'Some accessibility info reported. Confirm specifics with the venue.', stamp: 'call' });
  }

  return {
    key: 'limitedMobility', icon: '♿', label: 'Limited mobility',
    lines,
  };
}

// Stroller chip — leads with "can it roll inside" (positive frame), then
// distance neutrally, then park-it (call to confirm because we don't have
// stroller-parking metadata anywhere). Renders if there's any wheelchair-
// accessible signal or review mention of paths/strollers.
function buildStrollerChip(details, acc, rawTexts, sourceFor) {
  const rollInside = acc?.wheelchairAccessibleEntrance === true;
  const noRoll = acc?.wheelchairAccessibleEntrance === false;
  const strollerMention = rawTexts.has(/\b(stroller|pram|paths?|walkway|pavement|paved)\b/i);
  if (!rollInside && !noRoll && !strollerMention) return null;

  const lines = [];
  if (rollInside) {
    lines.push({ text: '✅ Can roll inside — wheelchair-accessible entrance reported.', stamp: 'verified' });
  } else if (noRoll) {
    lines.push({ text: '❌ No wheelchair-accessible entrance reported. Strollers may face the same access issues.', stamp: 'verified' });
  }
  // Path / walkway mention is neutral — just state it.
  if (strollerMention) {
    lines.push({ text: 'Reviewers mention paths or walkways on site.', stamp: sourceFor('whatYouSee') });
  }
  // Park-it line — we don't have stroller-parking data anywhere yet.
  lines.push({ text: 'Stroller-parking location is not in our data. Tap to check with the venue.', stamp: 'call' });

  return {
    key: 'stroller', icon: '🚼', label: 'Stroller',
    lines,
  };
}

// Heights chip — render ONLY if the attraction text references heights,
// towers, observation decks, drops, or harnesses. Mention a harness ONLY
// when one is required (silent otherwise — no editorializing).
function buildHeightsChip(details, rawTexts, sourceFor) {
  const heightsRx = /\b(tower|observation deck|skywalk|sky walk|glass floor|cliff|viewpoint|panoram|rooftop|gondola|cable car|drop tower|ferris wheel|zipline|bungee|skydive|height)\b/i;
  const harnessRequiredRx = /\b(harness (?:required|provided|mandatory|needed)|safety harness|requires? a harness)\b/i;
  const heights = rawTexts.has(heightsRx);
  const harnessRequired = rawTexts.has(harnessRequiredRx);
  if (!heights && !harnessRequired) return null;

  const lines = [];
  if (heights) {
    lines.push({ text: 'Reviewers mention high vantage points or vertical drops on site.', stamp: sourceFor('whatYouSee') });
  }
  if (harnessRequired) {
    // ONLY mention harness if required. Silent otherwise.
    lines.push({ text: 'A safety harness is required for parts of the visit.', stamp: sourceFor('goodToKnow') });
  }
  return {
    key: 'heights', icon: '🏔️', label: 'Heights',
    lines,
  };
}

// ============================================================================
// Depth — "More" tap-row
// ============================================================================

function DepthMore({ details, sourceFor }) {
  const [open, setOpen] = useState(false);
  const rows = [
    { sourceKey: 'vibe',            icon: '🎭', label: 'VIBE',            value: details.vibe },
    { sourceKey: 'whatYouSee',      icon: '👀', label: 'WHAT YOU SEE',    value: details.whatYouSee },
    { sourceKey: 'aboutAndHistory', icon: '📜', label: 'ABOUT & HISTORY', value: details.aboutAndHistory },
    { sourceKey: 'crowd',           icon: '👥', label: 'CROWD',           value: details.crowd },
    { sourceKey: 'bestTime',        icon: '⏰', label: 'BEST TIME',       value: details.bestTime },
    { sourceKey: 'awards',          icon: '🏆', label: 'AWARDS',          value: details.awards },
    { sourceKey: 'photoWorthy',     icon: '📸', label: 'PHOTO-WORTHY',    value: details.photoWorthy },
    { sourceKey: 'travelerNotes',   icon: '🌍', label: 'TRAVELER NOTES',  value: details.travelerNotes },
  ].filter(r => r.value);

  const goodToKnow = Array.isArray(details.goodToKnow) ? details.goodToKnow.filter(Boolean) : [];
  if (rows.length === 0 && goodToKnow.length === 0) return null;

  return (
    <div style={{ marginBottom: '4px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.5px' }}>📖 MORE DETAIL</span>
        <span style={{ fontSize: '11px', color: PURPLE }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ paddingTop: '6px' }}>
          {goodToKnow.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>
                📌 GOOD TO KNOW
                <SourceStamp tier={sourceFor('goodToKnow')} />
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.5', color: DARK }}>
                {goodToKnow.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}
          {rows.map(r => (
            <div key={r.label} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '3px' }}>
                {r.icon} {r.label}
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>
                {r.value}
                <SourceStamp tier={sourceFor(r.sourceKey)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
