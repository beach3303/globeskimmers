/**
 * AIDetailsSection — collapsible "🤖 AI DETAILS" panel used on per-place
 * cards. Drops into PlacesToEat (RestaurantCard) and CoffeeFinder (CoffeeCard)
 * as a single self-contained component.
 *
 * Behavior:
 * - Collapsed by default. Tap header to open.
 * - First open triggers lazy fetch via base44.functions.invoke('getAIDetails')
 *   which routes through the Worker /ai-details endpoint:
 *   • Worker checks 30-day KV cache → returns instantly if hit ($0)
 *   • Cache miss → Place Details ($0.02, cached 90d) + Claude Haiku ($0.005)
 * - Shimmer placeholders while loading.
 * - Fires logEvent('ai_details_opened') on every open (engagement signal).
 * - Fires logEvent('ai_details_fetched') with cache hit/miss flag after
 *   response (cost signal).
 *
 * Caller passes:
 *   placeId   — Google Places ID (required)
 *   placeName — for logging context
 *   page      — analytics page label (e.g. 'PlacesToEat' / 'CoffeeFinder')
 *   kind      — content category that drives the voice rules and star
 *               scoring on the Worker:
 *                 'restaurant' (default) — 1-5 stars, never 0, no red flag
 *                 'coffee'                — same as restaurant
 *                 'attraction'            — 1-5 stars, red flag if unsafe
 *                 'restroom'              — 0-5 stars (0 = always dirty),
 *                                           red flag if unsafe
 *               Different kinds get separate cache entries on the Worker.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { logEvent } from '@/lib/analytics';

const DARK = '#1A2332';
const GRAY = '#64748B';
const PURPLE = '#6D28D9';
const PURPLE_LIGHT = '#DDD6FE';
const PURPLE_BG = '#F5F3FF';
const PURPLE_SHIMMER = '#EDE9FE';

// Per-kind text highlight rules. Each rule = { pattern: regex, bg, color }.
// Applied to all AI Details body text (best dish/crowd/vibe/value/good to
// know/traveler/verdict) via the highlightText() helper below.
//
// Restroom highlights are designed to help travelers scan fast:
//   green = positive (clean, free, accessible)
//   orange = friction (paid, customer-only, stairs)
//   yellow = attention (location callouts)
// "free" is scoped to /free to use|free of charge|free for use|free$/i to
// avoid false positives on "free wifi", "stress-free", etc.
const HIGHLIGHT_RULES = {
  restroom: [
    // GREEN — positives
    { pattern: /\b(clean|spotless|well[- ]maintained|tidy)\b/gi, bg: '#D1FAE5', color: '#065F46' },
    { pattern: /\b(free to use|free of charge|free for use|no fee|no charge)\b/gi, bg: '#D1FAE5', color: '#065F46' },
    { pattern: /\b(accessible|barrier[- ]free|wheelchair[- ]accessible|ADA[- ]compliant)\b/gi, bg: '#D1FAE5', color: '#065F46' },
    // ORANGE — friction
    { pattern: /\b(need to (?:order|buy|purchase|pay)|purchase required|customers? only|for customers?|paying customers?|requires purchase|small fee|fee required|paid|coin[- ]operated|requires payment)\b/gi, bg: '#FED7AA', color: '#9A3412' },
    { pattern: /\b(stairs?|staircase|steps?(?:\s+up)?|no elevator|walk up)\b/gi, bg: '#FED7AA', color: '#9A3412' },
    // YELLOW — attention/location callouts
    { pattern: /\b(located[^.]*?(?=[.,;\n]|$))/gi, bg: '#FEF08A', color: '#713F12' },
  ],
};

// Render a string with per-kind highlights as React nodes. Returns the
// original string if no rules match or no kind-specific rules exist.
function highlightText(text, kind) {
  if (!text || typeof text !== 'string') return text;
  const rules = HIGHLIGHT_RULES[kind];
  if (!rules || rules.length === 0) return text;

  // Collect all matches across all rules, then merge into a non-overlapping
  // sequence of spans. First-rule-wins on overlap (greens checked before oranges).
  const matches = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, bg: rule.bg, color: rule.color });
      if (m[0].length === 0) rule.pattern.lastIndex++; // safety against zero-width loop
    }
  }
  if (matches.length === 0) return text;
  // Sort by start, drop overlaps (keep earlier)
  matches.sort((a, b) => a.start - b.start);
  const merged = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue; // overlap — skip
    merged.push(m);
    cursor = m.end;
  }

  const nodes = [];
  let pos = 0;
  merged.forEach((m, i) => {
    if (m.start > pos) nodes.push(text.slice(pos, m.start));
    nodes.push(
      <span key={i} style={{ background: m.bg, color: m.color, padding: '0 4px', borderRadius: '3px', fontWeight: '600' }}>
        {text.slice(m.start, m.end)}
      </span>
    );
    pos = m.end;
  });
  if (pos < text.length) nodes.push(text.slice(pos));
  return nodes;
}

export default function AIDetailsSection({ placeId, placeName, page, kind }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      logEvent('ai_details_opened', { placeId, placeName, kind: kind || 'restaurant' }, page || 'unknown');
    }
  };

  useEffect(() => {
    if (!open) return;
    if (details || loading) return;
    if (!placeId) return;
    setLoading(true);
    setError(null);
    base44.functions.invoke('getAIDetails', { placeId, kind: kind || 'restaurant' })
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
          placeId,
          placeName,
          kind: kind || 'restaurant',
          cache,
          paid: cache !== 'hit',
        }, page || 'unknown');
      })
      .catch((e) => setError(e?.message || 'Failed to load AI details'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placeId, kind]);

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
          <AIDetailsBody loading={loading} error={error} details={details} kind={kind} />
        </div>
      )}
    </div>
  );
}

function AIDetailsBody({ loading, error, details, kind }) {
  if (loading) {
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
  if (error) {
    return <div style={{ fontSize: '12px', color: '#B91C1C' }}>AI Details unavailable right now. {error}</div>;
  }
  if (!details) return null;

  // Highlight text per kind-specific rules. For restaurant/coffee/attraction
  // this is a no-op (no rules defined). For restroom, highlights clean/free/
  // accessible (green) / paid/stairs (orange) / located (yellow).
  const h = (text) => highlightText(text, kind);

  const row = (icon, label, value) =>
    value ? (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '3px' }}>
          {icon} {label}
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>{h(value)}</div>
      </div>
    ) : null;

  const bestDishText = details.bestDish?.name
    ? `${details.bestDish.name}${details.bestDish.context ? ` — ${details.bestDish.context}` : ''}`
    : null;

  return (
    <div>
      {/* Awards comes FIRST when present — Michelin / UNESCO / etc.
          is the strongest single signal, deserves top placement. */}
      {row('🏆', 'AWARDS', details.awards)}
      {row('🥘', 'BEST DISH', bestDishText)}
      {details.alsoRecommended?.length > 0 && row('👍', 'ALSO RECOMMENDED', details.alsoRecommended.join(', '))}
      {row('📸', 'PHOTO-WORTHY', details.photoWorthy)}

      {/* Attraction-only fields — render below the headline items so the
          flow reads: awards → top items → photo spots → what you see →
          history → who it suits. */}
      {row('👀', 'WHAT YOU SEE', details.whatYouSee)}
      {row('📜', 'ABOUT & HISTORY', details.aboutAndHistory)}

      {row('👥', 'CROWD', details.crowd)}
      {row('⏰', 'BEST TIME', details.bestTime)}
      {row('🎭', 'VIBE', details.vibe)}
      {row('💰', 'VALUE', details.value)}

      {details.goodToKnow?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '3px' }}>📌 GOOD TO KNOW</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.5', color: DARK }}>
            {details.goodToKnow.map((g, i) => (
              <li key={i}>{h(g)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* GOOD FOR — structured per-age-group breakdown. Each line only
          renders if its string is non-null (i.e., reviews/data say the
          place actually suits that age group). All-null => entire
          section hidden. */}
      {details.ageFit && (() => {
        const ageRows = [
          { key: 'toddlers', icon: '👶', label: 'Toddlers (with parents)' },
          { key: 'littleKids', icon: '🧒', label: 'Little Kids (5-12)' },
          { key: 'teens', icon: '🧑', label: 'Teens (13-18)' },
          { key: 'adults', icon: '👨', label: 'Adults' },
          { key: 'olderAdults', icon: '👴', label: 'Older Adults' },
        ].filter(r => details.ageFit[r.key]);
        if (ageRows.length === 0) return null;
        return (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '3px' }}>👨‍👩‍👧‍👦 GOOD FOR</div>
            <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', fontSize: '13px', lineHeight: '1.5', color: DARK }}>
              {ageRows.map(r => (
                <li key={r.key} style={{ marginBottom: '4px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0 }}>{r.icon}</span>
                  <span><strong style={{ fontWeight: '600' }}>{r.label}:</strong> {h(details.ageFit[r.key])}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {row('🌍', 'TRAVELER', details.travelerNotes)}

      {(details.gsStars != null || details.gsRedFlag || details.gsVerdict) && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${PURPLE_LIGHT}` }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '3px' }}>💯 GS VERDICT</div>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>
            {details.gsRedFlag ? (
              <strong>🚩</strong>
            ) : details.gsStars != null && details.gsStars > 0 ? (
              <strong style={{ letterSpacing: '1px' }}>{'⭐'.repeat(Math.min(5, Math.max(0, details.gsStars)))}</strong>
            ) : null}
            {((details.gsRedFlag) || (details.gsStars != null && details.gsStars > 0)) && details.gsVerdict && ' — '}
            {h(details.gsVerdict)}
          </div>
        </div>
      )}

      {details.websiteUri && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: GRAY }}>
          For more information, visit{' '}
          <a href={details.websiteUri} target="_blank" rel="noopener noreferrer" style={{ color: PURPLE, textDecoration: 'underline' }}>
            {details.websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        </div>
      )}
    </div>
  );
}
