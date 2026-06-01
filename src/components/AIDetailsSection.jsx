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

// localStorage flag so the GS Verdict helper subtitle (one-line explainer
// of what "GS Verdict" means) shows only on the user's first-ever open of
// any AI Details panel, then disappears forever. Wrapped in try/catch so
// private-mode / disabled-storage failures degrade silently.
const GS_VERDICT_HELPER_KEY = 'gs_verdict_helper_seen';
function readVerdictHelperSeen() {
  try { return localStorage.getItem(GS_VERDICT_HELPER_KEY) === '1'; }
  catch { return true; }  // fail-safe: hide subtitle if storage broken
}
function markVerdictHelperSeen() {
  try { localStorage.setItem(GS_VERDICT_HELPER_KEY, '1'); } catch { /* ignore */ }
}

export default function AIDetailsSection({ placeId, placeName, page, kind }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Snapshot the helper-seen state at MOUNT (not on every render) so the
  // subtitle stays visible for this open even after we mark it seen. Next
  // panel the user opens reads the freshly-true flag and hides it.
  const [showVerdictHelper] = useState(() => !readVerdictHelperSeen());

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      logEvent('ai_details_opened', { placeId, placeName, kind: kind || 'restaurant' }, page || 'unknown');
      // Mark the helper as seen on first open so the next panel suppresses
      // it. The current panel keeps showing it (snapshot above).
      if (showVerdictHelper) markVerdictHelperSeen();
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
          <AIDetailsBody loading={loading} error={error} details={details} kind={kind} showVerdictHelper={showVerdictHelper} />
        </div>
      )}
    </div>
  );
}

function AIDetailsBody({ loading, error, details, kind, showVerdictHelper }) {
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

  // Worth-it tag → display label + emoji. Five tiers in v6; any unknown
  // value (or legacy v5 enum) hides the chip rather than mislabeling.
  const WORTH_LABELS = {
    worth_the_stop:       { icon: '💎', label: 'Worth the Stop',       bg: '#DCFCE7', color: '#166534' },
    strong_nearby_pick:   { icon: '✅', label: 'Strong Nearby Pick',   bg: '#DBEAFE', color: '#1E40AF' },
    craving_match:        { icon: '🍽️', label: 'Craving Match',        bg: '#FCE7F3', color: '#9D174D' },
    know_before_you_go:   { icon: '⚠️', label: 'Know Before You Go',   bg: '#FEF3C7', color: '#92400E' },
    better_if_convenient: { icon: '↪️', label: 'Better If Convenient', bg: '#F1F5F9', color: '#475569' },
  };
  const worthTag = details.worthIt && WORTH_LABELS[details.worthIt];

  // Bulleted outline renderer for arrays of { name, context } objects
  // (bestDish wrapped into a 1-item array; alsoRecommended already is one).
  const renderDishList = (items) => (
    <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', fontSize: '13px', lineHeight: '1.55', color: DARK }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: '6px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, color: PURPLE, fontWeight: '700' }}>•</span>
          <span>
            <strong style={{ fontWeight: '600' }}>{h(it.name)}</strong>
            {it.context ? <span style={{ color: '#475569' }}> — {h(it.context)}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );

  // Tag-chip row for goodFor / notIdealFor arrays.
  const renderChips = (tags, palette) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {tags.map((t, i) => (
        <span
          key={i}
          style={{
            fontSize: '12px',
            lineHeight: '1.3',
            padding: '4px 10px',
            background: palette.bg,
            color: palette.color,
            borderRadius: '9999px',
            fontWeight: '500',
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );

  const bestDishItems = details.bestDish?.name
    ? [{ name: details.bestDish.name, context: details.bestDish.context }]
    : [];

  const hasVerdict = (details.gsStars != null || details.gsRedFlag || details.gsVerdict || worthTag);

  return (
    <div>
      {/* GS VERDICT — moved to the TOP. The badge carries the personality
          (💎 / ✅ / 🍽️ / ⚠️ / ↪️) so the title itself stays clean. On the
          user's first-ever open of any AI Details panel, a one-line helper
          subtitle explains what GS Verdict means; after that it's hidden. */}
      {hasVerdict && (
        <div style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${PURPLE_LIGHT}` }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: showVerdictHelper ? '2px' : '6px' }}>GS VERDICT</div>
          {showVerdictHelper && (
            <div style={{ fontSize: '11px', color: GRAY, fontStyle: 'italic', marginBottom: '8px' }}>
              Globeskimmers' traveler-fit take on this place.
            </div>
          )}
          {worthTag && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '12px',
                fontWeight: '600',
                padding: '3px 10px',
                background: worthTag.bg,
                color: worthTag.color,
                borderRadius: '9999px',
              }}>
                {worthTag.icon} {worthTag.label}
              </span>
            </div>
          )}
          {(details.gsStars != null && details.gsStars > 0) || details.gsRedFlag ? (
            <div style={{ fontSize: '13px', marginBottom: '4px' }}>
              {details.gsRedFlag ? (
                <strong>🚩</strong>
              ) : (
                <strong style={{ letterSpacing: '1px' }}>{'⭐'.repeat(Math.min(5, Math.max(0, details.gsStars)))}</strong>
              )}
            </div>
          ) : null}
          {details.gsVerdict && (
            <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>
              {h(details.gsVerdict)}
            </div>
          )}
        </div>
      )}

      {/* Awards next when present — Michelin / UNESCO / etc.
          is the strongest single recognition signal. */}
      {row('🏆', 'AWARDS', details.awards)}

      {/* BEST DISH — single-bullet outline (one item, formatted like the
          alsoRecommended list for visual consistency). */}
      {bestDishItems.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>🥘 BEST DISH</div>
          {renderDishList(bestDishItems)}
        </div>
      )}

      {/* ALSO RECOMMENDED — bulleted outline, one bullet per dish/item.
          v5 schema: array of {name, context} objects. */}
      {details.alsoRecommended?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>👍 ALSO RECOMMENDED</div>
          {renderDishList(details.alsoRecommended)}
        </div>
      )}

      {/* PRACTICAL — payment / English menu / reservation / dietary.
          The top traveler-anxiety cluster: surfaced high in the panel so
          users see it before deciding to go. */}
      {details.practical && (() => {
        const rows = [
          { key: 'payment',     icon: '💳', label: 'Payment' },
          { key: 'englishMenu', icon: '🗣️', label: 'English' },
          { key: 'reservation', icon: '📅', label: 'Reservation' },
          { key: 'dietary',     icon: '🥗', label: 'Dietary' },
        ].filter(r => details.practical[r.key]);
        if (rows.length === 0) return null;
        return (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>📋 PRACTICAL</div>
            <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', fontSize: '13px', lineHeight: '1.5', color: DARK }}>
              {rows.map(r => (
                <li key={r.key} style={{ marginBottom: '4px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0 }}>{r.icon}</span>
                  <span><strong style={{ fontWeight: '600' }}>{r.label}:</strong> {h(details.practical[r.key])}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* HEADS-UP — short factual planning items framed neutrally
          (not complaints). Empty array hides the row. */}
      {details.headsUp?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>⚠️ HEADS-UP</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.5', color: DARK }}>
            {details.headsUp.map((u, i) => (
              <li key={i}>{h(u)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* GOOD FOR — short positive tags (chips). Replaces the old
          age-graded ageFit breakdown which was overbuilt + part-guessed. */}
      {details.goodFor?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>🎯 GOOD FOR</div>
          {renderChips(details.goodFor, { bg: '#DDD6FE', color: '#5B21B6' })}
        </div>
      )}

      {/* NOT IDEAL FOR — atmosphere-fit mismatch tags (always parenthetical
          with reason). Never quality complaints. Hidden when empty. */}
      {details.notIdealFor?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>🤔 NOT IDEAL FOR</div>
          {renderChips(details.notIdealFor, { bg: '#FEE2E2', color: '#991B1B' })}
        </div>
      )}

      {row('📸', 'PHOTO-WORTHY', details.photoWorthy)}

      {/* Attraction-only fields */}
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

      {row('🌍', 'TRAVELER', details.travelerNotes)}

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
