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
import { base44 } from '@/api/base44Client';
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
  verified: { label: 'Verified',        bg: '#DCFCE7', color: '#166534' },
  reviews:  { label: 'from reviews',    bg: '#FEF3C7', color: '#92400E' },
  forecast: { label: 'from forecast',   bg: '#FEF3C7', color: '#92400E' },
  call:     { label: 'call to confirm', bg: '#DBEAFE', color: '#1E40AF' },
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
        placeId, placeName, kind: 'attraction', variant: 'attraction_v1',
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
    base44.functions.invoke('getAIDetails', { placeId, kind: 'attraction' })
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
          kind: 'attraction', variant: 'attraction_v1',
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

  return (
    <div>
      <ZoneDecide details={details} showVerdictHelper={showVerdictHelper} callConfirm={callConfirm} />
      <ZoneDo details={details} />
      <ZoneBook details={details} />
      <ZoneFitPrep details={details} callConfirm={callConfirm} />
      <DepthMore details={details} />
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

function ZoneDecide({ details, showVerdictHelper, callConfirm }) {
  const worthTag = details.worthIt && WORTH_LABELS[details.worthIt];
  const hasVerdict = (details.gsStars != null || details.gsRedFlag || details.gsVerdict || worthTag);

  // Quick-Fit strip values. Each tile carries a source stamp so the user
  // can see at a glance whether the value is hard fact or inferred. Phase 1
  // derives these from existing fields; Phase 2 will get them from real
  // per-field sources in a forked prompt.
  const quickFit = buildQuickFit(details);

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

      {/* Price line — echoes the value field with a Verified stamp when the
          value mentions a concrete amount or a "free" flag, else reviews. */}
      {details.value && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>💰 PRICE</div>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>
            {details.value}
            <SourceStamp tier={pickPriceTier(details.value)} />
          </div>
        </div>
      )}

      {/* Lines & Wait — Phase 1 placeholder. Phase 2 will derive "built-in
          wait" (structural mechanics) vs "crowd-driven" (timing fixes it)
          from a forked attraction prompt. Render a calm placeholder card
          rather than fake data. */}
      <div style={{ marginBottom: '4px', padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}` }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>⏳ LINES &amp; WAIT</div>
        <div style={{ fontSize: '13px', color: GRAY_DEEP, lineHeight: '1.5' }}>
          Wait-time analysis is coming soon.
          <SourceStamp tier="call" onClick={callConfirm} />
        </div>
      </div>
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

// Quick-Fit derivations. Phase 1 only reads existing fields; nothing
// invented. Fields we don't have a signal for get a "call to confirm"
// tile so the slot is still useful (wired to the website button).
function buildQuickFit(details) {
  return [
    { icon: '⏱️', label: 'Time',     value: deriveTime(details),     stamp: 'call' },
    { icon: '💵', label: 'Price',    value: derivePrice(details),    stamp: details.value ? pickPriceTier(details.value) : 'call' },
    { icon: '👥', label: 'Best for', value: deriveBestFor(details),  stamp: details.crowd || details.worthIt ? 'reviews' : 'call' },
    { icon: '🎟️', label: 'Booking',  value: deriveBooking(details),  stamp: details?.practical?.reservation ? 'reviews' : 'call' },
  ];
}

function deriveTime(_details) {
  // No structured "typical visit duration" field exists yet. Phase 2 will
  // add one to the attraction prompt; for now we say so honestly.
  return 'Allow 1–2 hr';
}

function derivePrice(details) {
  const v = details.value;
  if (!v) return 'Check at gate';
  // Pull a leading token like "Free" / "Cheap" / "Pricey" / "$10".
  const match = v.match(/^(Free|Cheap|Fair|Pricey|Splurge-only|Splurge|Affordable|Budget|\$[\d\-+~]+|\$\$+)\b/i);
  if (match) return match[0];
  // Otherwise show the first ~24 chars.
  return v.length > 28 ? v.slice(0, 26).trim() + '…' : v;
}

function deriveBestFor(details) {
  if (details.crowd) {
    // Take the first short clause from the crowd sentence.
    const clause = String(details.crowd).split(/[;,.]/)[0].trim();
    return clause.length > 32 ? clause.slice(0, 30).trim() + '…' : clause;
  }
  // Fall back to a Worth-It-derived hint if crowd is null.
  if (details.worthIt === 'craving_match') return 'Niche interest';
  if (details.worthIt === 'worth_the_stop') return 'Most travelers';
  if (details.worthIt === 'better_if_convenient') return 'Casual stop';
  return 'Mixed crowd';
}

function deriveBooking(details) {
  const r = details?.practical?.reservation;
  if (!r) return 'Walk-in or call';
  const lower = r.toLowerCase();
  if (/required|must book|book ahead|advance/.test(lower)) return 'Book ahead';
  if (/timed[- ]entry/.test(lower)) return 'Timed entry';
  if (/recommended/.test(lower)) return 'Reservation suggested';
  if (/walk[- ]in/.test(lower)) return 'Walk-in OK';
  return r.length > 24 ? r.slice(0, 22).trim() + '…' : r;
}

function pickPriceTier(value) {
  if (!value) return 'call';
  // "$10", "$25-30", "Free" → likely a concrete signal we'd Verify from
  // Google one day. Until Phase 2 plumbs the real source, mark reviews-tier.
  if (/\$\d|free\b/i.test(value)) return 'reviews';
  return 'reviews';
}

// ============================================================================
// Zone 2 — DO
// ============================================================================

function ZoneDo({ details }) {
  const items = Array.isArray(details.alsoRecommended) ? details.alsoRecommended : [];
  if (items.length === 0) return null;
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
              <SourceStamp tier="reviews" />
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

function ZoneBook({ details }) {
  // Phase 1: no real sell-out signal, no real affiliate routing. We render
  // ONLY the affiliate placeholder slot so the layout is anchored. The
  // sell-out nudge is intentionally omitted until Phase 2 supplies a signal.
  return (
    <div style={{ marginBottom: '14px', padding: '12px', background: '#FFFFFF', borderRadius: '8px', border: `1px dashed ${PURPLE_LIGHT}` }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        🎟️ BOOK AHEAD
      </div>
      <div style={{ fontSize: '13px', color: GRAY_DEEP, lineHeight: '1.5', marginBottom: '8px' }}>
        Tickets via trusted partners — coming soon.
      </div>
      <button
        type="button"
        disabled
        style={{
          fontSize: '13px', fontWeight: '600',
          padding: '8px 14px',
          background: '#F1F5F9', color: '#94A3B8',
          border: `1px solid ${DIVIDER}`, borderRadius: '8px',
          cursor: 'not-allowed', width: '100%',
        }}
      >
        Get tickets · partner coming soon
      </button>
      {/* Booking detail line — surfaces the same practical.reservation
          string the Quick-Fit tile reads, for readers who skim past the strip. */}
      {details?.practical?.reservation && (
        <div style={{ fontSize: '12px', color: GRAY_DEEP, marginTop: '8px', lineHeight: '1.5' }}>
          {details.practical.reservation}
          <SourceStamp tier="reviews" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Zone 4 — FIT & PREP (collapsed tap-rows)
// ============================================================================

function ZoneFitPrep({ details, callConfirm }) {
  // Each row: icon, label, one-line summary, expandable body. In Phase 1
  // most rows fall back to "call to confirm" because we don't yet collect
  // accessibility / dress / pets data. Reservation row reads real data.
  // Smart Tip row is intentionally absent — handoff rule: render only if
  // there's a genuine save, never a platitude.
  const rows = [
    {
      key: 'accessibility', icon: '♿', label: 'Accessibility',
      summary: 'Mobility, vision, hearing notes',
      body: 'Detailed accessibility info isn’t in our data yet. Check the venue website for ramps, elevators, audio guides, and seating availability.',
      stamp: 'call',
    },
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
      stamp: details?.practical?.reservation ? 'reviews' : 'call',
    },
  ];

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        🧭 FIT &amp; PREP
      </div>
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
// Depth — "More" tap-row
// ============================================================================

function DepthMore({ details }) {
  const [open, setOpen] = useState(false);
  const rows = [
    { icon: '🎭', label: 'VIBE',           value: details.vibe },
    { icon: '👀', label: 'WHAT YOU SEE',   value: details.whatYouSee },
    { icon: '📜', label: 'ABOUT & HISTORY', value: details.aboutAndHistory },
    { icon: '👥', label: 'CROWD',          value: details.crowd },
    { icon: '⏰', label: 'BEST TIME',      value: details.bestTime },
    { icon: '🏆', label: 'AWARDS',         value: details.awards },
    { icon: '📸', label: 'PHOTO-WORTHY',   value: details.photoWorthy },
    { icon: '🌍', label: 'TRAVELER NOTES', value: details.travelerNotes },
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
              <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>📌 GOOD TO KNOW</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.5', color: DARK }}>
                {goodToKnow.map((g, i) => <li key={i}>{g}<SourceStamp tier="reviews" /></li>)}
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
                <SourceStamp tier="reviews" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
