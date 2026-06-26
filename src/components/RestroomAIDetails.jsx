/**
 * RestroomAIDetails — collapsible "🤖 AI DETAILS" panel for restroom
 * cards. Replaces the generic restaurant-voiced AIDetailsSection for restrooms.
 *
 * Lazy-fetches restroom-specific intel via callWorker(ROUTE.getRestroomAIDetails)
 * → Worker /restroom-ai-details, which runs Place reviews + metadata through
 * Haiku and returns 7 honest sections + a structured restroomAmenities object
 * with confidence labels (confirmed | reported | likely | not_confirmed |
 * unknown). KV-cached 90d on the Worker (pay Haiku ~once per place).
 *
 * Honest by design: unknown amenities are never shown as facts — they render as
 * "not confirmed" chips or are hidden. Amenity chips sit at the top for fast
 * scanning; the 7 sections follow in priority order.
 */
import React, { useState, useEffect } from 'react';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { logEvent } from '@/lib/analytics';

const TEAL = '#0E7C73';
const DARK = '#1A2332';
const GRAY = '#64748B';
const BG = '#F0FDFA';
const BORDER = '#99F6E4';
const SHIMMER = '#CCFBF1';

// Confidence → chip tone + label suffix. `unknown` returns null (chip hidden).
const TONE = {
  pos: { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' }, // confirmed / reported
  mid: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' }, // likely
  mut: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }, // not_confirmed
};
function conf(status) {
  if (status === 'confirmed' || status === 'reported') return { tone: 'pos', suffix: '' };
  if (status === 'likely') return { tone: 'mid', suffix: ' likely' };
  // not_confirmed / unknown → hide the chip entirely. We only surface amenities
  // that are confirmed or likely, so the list reads as useful facts, not a wall
  // of "not confirmed" negatives.
  return null;
}

// Build the amenity chip list from the structured restroomAmenities object.
function buildChips(a) {
  if (!a) return [];
  const chips = [];
  // Presence amenities: show confirmed/reported/likely/not_confirmed (hide unknown).
  const add = (icon, base, status, positiveOnly = false) => {
    const c = conf(status);
    if (!c) return;
    if (positiveOnly && c.tone === 'mut') return; // access chips only when there IS a rule
    chips.push({ icon, label: `${base}${c.suffix}`, tone: c.tone });
  };
  // Toilet type (its own value set, not a confidence enum).
  if (a.toiletType === 'western') chips.push({ icon: '🚽', label: 'Western toilet', tone: 'pos' });
  else if (a.toiletType === 'squat') chips.push({ icon: '🚽', label: 'Squat toilet', tone: 'pos' });
  else if (a.toiletType === 'both') chips.push({ icon: '🚽', label: 'Western + squat', tone: 'pos' });
  add('🧻', 'Toilet paper', a.toiletPaper);
  add('🧼', 'Soap', a.soap);
  add('🌀', 'Hand drying', a.handDryerOrPaperTowels);
  add('🚿', 'Bidet', a.bidet);
  add('🧷', 'Seat covers', a.toiletSeatCovers);
  add('♿', 'Accessible', a.accessibleStall);
  add('👶', 'Changing table', a.babyChangingTable);
  add('👪', 'Family restroom', a.familyRestroom);
  add('🔑', 'Ask staff for key', a.keyOrCodeRequired, true);
  add('💵', 'Purchase may be required', a.purchaseRequired, true);
  return chips;
}

const SECTIONS = [
  { key: 'verdict', icon: '🚻', title: 'GS RESTROOM VERDICT' },
  { key: 'toiletSetup', icon: '🚽', title: 'TOILET SETUP' },
  { key: 'supplies', icon: '🧻', title: 'SUPPLIES' },
  { key: 'accessRules', icon: '🔑', title: 'ACCESS RULES' },
  { key: 'accessibility', icon: '♿', title: 'ACCESSIBILITY' },
  { key: 'familyElderly', icon: '👵', title: 'FAMILY / ELDERLY COMFORT' },
  { key: 'safety', icon: '🌙', title: 'SAFETY NOTE' },
];

function Body({ loading, error, d }) {
  if (loading) {
    return (
      <div>
        {[82, 64, 74, 58].map((w, i) => (
          <div key={i} style={{ height: '12px', width: `${w}%`, background: `linear-gradient(90deg,${SHIMMER} 0%,${BORDER} 50%,${SHIMMER} 100%)`, backgroundSize: '200% 100%', borderRadius: '4px', marginBottom: '8px', animation: 'gsShimmer 1.2s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes gsShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      </div>
    );
  }
  if (error) return <div style={{ fontSize: '12px', color: '#B91C1C' }}>Couldn't load restroom details. {error}</div>;
  if (!d) return null;

  const chips = buildChips(d.restroomAmenities);
  return (
    <div>
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {chips.map((c, i) => {
            const t = TONE[c.tone] || TONE.mut;
            return (
              <span key={i} style={{ fontSize: '11.5px', fontWeight: 600, padding: '3px 9px', borderRadius: '9999px', background: t.bg, color: t.color, border: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>
                {c.icon} {c.label}
              </span>
            );
          })}
        </div>
      )}
      {SECTIONS.map((s) => (d[s.key] ? (
        <div key={s.key} style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: TEAL, letterSpacing: '0.4px', marginBottom: '3px' }}>{s.icon} {s.title}</div>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>{d[s.key]}</div>
        </div>
      ) : null))}
      <div style={{ fontSize: '10.5px', color: GRAY, fontStyle: 'italic', marginTop: '4px' }}>
        Based on reviews + place info — confirm at the location if needed.
      </div>
    </div>
  );
}

export default function RestroomAIDetails({ placeId, placeName, venueLabel, venueCategory, accessType, page = 'RestroomFinder' }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) logEvent('restroom_ai_opened', { placeId, placeName }, page);
  };

  useEffect(() => {
    if (!open || data || loading || !placeId) return;
    setLoading(true);
    setError(null);
    callWorker(ROUTE.getRestroomAIDetails, { placeId, placeName, venueLabel, venueCategory, accessType })
      .then(({ data: res, error: err }) => {
        if (err) setError(err);
        else if (res?.restroomDetails) setData(res.restroomDetails);
        else if (res?.error) setError(res.error);
        else setError('No data returned');
        logEvent('restroom_ai_fetched', { placeId, cache: res?._cache || 'unknown' }, page);
      })
      .catch((e) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placeId]);

  return (
    <div style={{ padding: '12px 14px', background: BG, borderRadius: '10px', border: `1px solid ${BORDER}` }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: TEAL, letterSpacing: '0.5px' }}>🤖 AI DETAILS</span>
        <span style={{ fontSize: '11px', color: TEAL }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ marginTop: '10px' }}><Body loading={loading} error={error} d={data} /></div>}
    </div>
  );
}
