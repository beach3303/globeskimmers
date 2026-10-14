/**
 * AIDetailsSection — the "AI details" disclosure on per-place cards. Drops into
 * PlacesToEat (RestaurantCard) and CoffeeFinder (CoffeeCard) as a single
 * self-contained component.
 *
 * Look (the new look; Eat.dc.html L122): the header is a quiet row (Sparkles 18 in the
 * world's icon ink, 'AI details', the word 'AI' kept) with aria-expanded and
 * aria-controls; the body opens under it on white with a 1px world line, mono labels in
 * the world ink and plain words. No lilac, no emoji. Inside a card's QuietRows the body
 * takes the full width under the rows (QuietPanel); anywhere else it follows the row.
 *
 * Behavior:
 * - Collapsed by default. Tap the row to open.
 * - First open triggers lazy fetch via callWorker(ROUTE.getAIDetails), which
 *   routes through the Worker /ai-details endpoint:
 *   • Worker checks 30-day KV cache → returns instantly if hit ($0)
 *   • Cache miss → Place Details ($0.02, cached 90d) + Claude Haiku ($0.005)
 * - Shimmer placeholders (on the world wash) while loading.
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
 *   lat, lng  — passed to the Worker as before.
 *   world     — WORLD row or key ('eat'); the shared neutrals without it.
 */
import React, { useState, useEffect, useId } from 'react';
import { Flag, Sparkles, Star } from 'lucide-react';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { logEvent } from '@/lib/analytics';
import { NEUTRAL, fs, rgba } from '@/components/redesign/constants';
import { worldRow } from '@/components/finder/FinderControls';
import { QuietRow, QuietPanel } from '@/components/finder/FinderCard';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/**
 * A style object that may carry CSS custom properties (--w-wash).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

// Per-kind text highlight rules. Each rule = { pattern: regex, tone }.
// Applied to all AI Details body text (best dish/crowd/vibe/value/good to
// know/traveler/verdict) via the highlightText() helper below.
//
// Restroom highlights are designed to help travelers scan fast:
//   positive = clean, free
//   friction = paid, customer-only, stairs
//   attention = location callouts
// "free" is scoped to /free to use|free of charge|free for use|free$/i to
// avoid false positives on "free wifi", "stress-free", etc.
const HIGHLIGHT_RULES = {
  restroom: [
    // positives
    { pattern: /\b(clean|spotless|well[- ]maintained|tidy)\b/gi, tone: 'positive' },
    { pattern: /\b(free to use|free of charge|free for use|no fee|no charge)\b/gi, tone: 'positive' },
    // (accessibility phrases are deliberately NOT highlighted: AI copy can't
    //  verify them, and a positive highlight reads as confirmed)
    // friction
    { pattern: /\b(need to (?:order|buy|purchase|pay)|purchase required|customers? only|for customers?|paying customers?|requires purchase|small fee|fee required|paid|coin[- ]operated|requires payment)\b/gi, tone: 'friction' },
    { pattern: /\b(stairs?|staircase|steps?(?:\s+up)?|no elevator|walk up)\b/gi, tone: 'friction' },
    // attention/location callouts
    { pattern: /\b(located[^.]*?(?=[.,;\n]|$))/gi, tone: 'attention' },
  ],
};

// The highlight tones, in the shared inks: green and red text on their own faint tints,
// and ink on a pale gold for a location callout.
const HIGHLIGHT_TONES = {
  positive: { background: rgba(NEUTRAL.open, 0.1), color: NEUTRAL.open },
  friction: { background: rgba(NEUTRAL.stamp, 0.08), color: NEUTRAL.stamp },
  attention: { background: rgba(NEUTRAL.gold, 0.22), color: NEUTRAL.ink },
};

// Render a string with per-kind highlights as React nodes. Returns the
// original string if no rules match or no kind-specific rules exist.
function highlightText(text, kind) {
  if (!text || typeof text !== 'string') return text;
  const rules = HIGHLIGHT_RULES[kind];
  if (!rules || rules.length === 0) return text;

  // Collect all matches across all rules, then merge into a non-overlapping
  // sequence of spans. First-rule-wins on overlap (positives checked before friction).
  const matches = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, tone: rule.tone });
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
      <span key={i} style={{ ...HIGHLIGHT_TONES[m.tone], padding: '0 4px', borderRadius: '3px', fontWeight: '600' }}>
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

/**
 * @param {{ placeId?: string, placeName?: string, page?: string, kind?: string, lat?: number, lng?: number, world?: any }} props
 */
export default function AIDetailsSection({ placeId = undefined, placeName = undefined, page = undefined, kind = undefined, lat = undefined, lng = undefined, world = undefined }) {
  const w = worldRow(world);
  const bodyId = useId();
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
    callWorker(ROUTE.getAIDetails, { placeId, kind: kind || 'restaurant', name: placeName, lat, lng })
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
    <>
      <QuietRow world={w} icon={Sparkles} expanded={open} controls={bodyId} onClick={onToggle}>
        AI details
      </QuietRow>
      <QuietPanel world={w} id={bodyId} order={2} hidden={!open} style={{ padding: '14px 16px' }}>
        {open ? <AIDetailsBody loading={loading} error={error} details={details} kind={kind} showVerdictHelper={showVerdictHelper} w={w} /> : null}
      </QuietPanel>
    </>
  );
}

function AIDetailsBody({ loading, error, details, kind, showVerdictHelper, w }) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading AI details" style={css({ display: 'flex', flexDirection: 'column', gap: '8px', '--w-wash': w.wash })}>
        {[88, 72, 80, 66, 75].map((pct, i) => (
          <span key={i} className="gs-shimmer" aria-hidden="true" style={{ display: 'block', height: '12px', width: `${pct}%`, borderRadius: '4px' }} />
        ))}
      </div>
    );
  }
  if (error) {
    return <div role="alert" style={{ fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.stamp }}>AI details unavailable right now. {error}</div>;
  }
  if (!details) return null;

  // Highlight text per kind-specific rules. For restaurant/coffee/attraction
  // this is a no-op (no rules defined). For restroom, highlights clean/free
  // (positive) / paid/stairs (friction) / located (attention).
  const h = (text) => highlightText(text, kind);

  /** @type {CSS} */
  const labelStyle = { fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.34, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: w.ink, marginBottom: '4px' };
  /** @type {CSS} */
  const bodyStyle = { fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink };
  const Label = ({ children }) => <div style={labelStyle}>{children}</div>;

  const row = (label, value) =>
    value ? (
      <div style={{ marginBottom: '10px' }}>
        <Label>{label}</Label>
        <div style={bodyStyle}>{h(value)}</div>
      </div>
    ) : null;

  // Worth-it tag → words. Five tiers in v6; any unknown value (or legacy v5 enum)
  // hides the chip rather than mislabeling. One tone for all: the words carry it.
  const WORTH_LABELS = {
    worth_the_stop: 'Worth the stop',
    strong_nearby_pick: 'Strong nearby pick',
    craving_match: 'Craving match',
    know_before_you_go: 'Know before you go',
    better_if_convenient: 'Better if convenient',
  };
  const worthTag = details.worthIt && WORTH_LABELS[details.worthIt];

  // Bulleted outline renderer for arrays of { name, context } objects
  // (bestDish wrapped into a 1-item array; alsoRecommended already is one).
  const renderDishList = (items) => (
    <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', ...bodyStyle }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: '6px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 5, height: 5, marginTop: '0.6em', borderRadius: 999, background: w.ink }} />
          <span>
            <strong style={{ fontWeight: 600 }}>{h(it.name)}</strong>
            {it.context ? <span style={{ color: NEUTRAL.ink2 }}> — {h(it.context)}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );

  const bestDishItems = details.bestDish?.name
    ? [{ name: details.bestDish.name, context: details.bestDish.context }]
    : [];

  // Top dishes (v10): the AI names them, the Worker's code counts how many of
  // the Google reviews it read mention each one — the only number shown.
  const topDishes = Array.isArray(details.topDishes) ? details.topDishes.filter((d) => d?.name).slice(0, 3) : [];
  const read = Number(details.dishReviewsRead) || 0;
  const mentionLine = (m) => {
    if (!(m > 0) || !read) return null;
    return read === 1 ? 'Mentioned in the one Google review we read' : `Mentioned in ${Math.min(m, read)} of the ${read} Google reviews we read`;
  };

  const stars = Math.min(5, Math.max(0, Math.round(Number(details.gsStars) || 0)));
  const hasVerdict = (details.gsStars != null || details.gsRedFlag || details.gsVerdict || worthTag);

  return (
    <div>
      {/* GS VERDICT at the top. The worth tag carries its words; on the user's
          first-ever open of any AI Details panel, a one-line helper subtitle
          explains what GS Verdict means; after that it's hidden. */}
      {hasVerdict && (
        <div style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${w.line}` }}>
          <div style={{ ...labelStyle, marginBottom: showVerdictHelper ? '2px' : '6px' }}>GS verdict</div>
          {showVerdictHelper && (
            <div style={{ fontSize: fs(12), color: NEUTRAL.ink3, fontStyle: 'italic', marginBottom: '8px' }}>
              Globeskimmers' traveler-fit take on this place.
            </div>
          )}
          {worthTag && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 24,
                boxSizing: 'border-box',
                fontSize: fs(12),
                fontWeight: 600,
                padding: '2px 10px',
                background: w.wash,
                color: w.washInk,
                borderRadius: '9999px',
              }}>
                {worthTag}
              </span>
            </div>
          )}
          {details.gsRedFlag ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '4px', fontSize: fs(13), fontWeight: 600, color: NEUTRAL.stamp }}>
              <Flag size={14} color={NEUTRAL.stamp} strokeWidth={2} aria-hidden="true" focusable="false" />
              Red flag
            </div>
          ) : stars > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: '4px' }}>
              {Array.from({ length: stars }, (_, i) => (
                <Star key={i} size={14} color={w.star} fill={w.star} strokeWidth={2} aria-hidden="true" focusable="false" />
              ))}
              <span style={{ marginLeft: 6, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: '.12em', color: NEUTRAL.ink3 }}>
                {stars} OF 5
              </span>
            </div>
          ) : null}
          {details.gsVerdict && (
            <div style={bodyStyle}>
              {h(details.gsVerdict)}
            </div>
          )}
        </div>
      )}

      {/* Awards next when present — Michelin / UNESCO / etc.
          is the strongest single recognition signal. */}
      {row('Awards', details.awards)}

      {topDishes.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <Label>{kind === 'coffee' ? 'Top orders' : 'Top dishes'}</Label>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {topDishes.map((d, i) => (
              <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span aria-hidden="true" style={{ flexShrink: 0, minWidth: '20px', minHeight: '20px', boxSizing: 'border-box', borderRadius: '9999px', border: `1px solid ${w.line}`, color: w.ink, fontFamily: MONO, fontSize: fs(10.5), fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}>{i + 1}</span>
                <span style={{ minWidth: 0, ...bodyStyle }}>
                  <strong style={{ fontWeight: 600 }}>{h(d.name)}</strong>
                  {d.context ? <span style={{ color: NEUTRAL.ink2 }}> — {h(d.context)}</span> : null}
                  {mentionLine(d.mentions) && (
                    <span style={{ display: 'block', fontSize: fs(11.5), color: NEUTRAL.ink3, marginTop: '1px' }}>{mentionLine(d.mentions)}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* BEST DISH — single-bullet outline (one item, formatted like the
          alsoRecommended list for visual consistency). Older cached panels. */}
      {topDishes.length === 0 && bestDishItems.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <Label>Best dish</Label>
          {renderDishList(bestDishItems)}
        </div>
      )}

      {/* ALSO RECOMMENDED — bulleted outline, one bullet per dish/item.
          v5 schema: array of {name, context} objects. */}
      {topDishes.length === 0 && details.alsoRecommended?.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <Label>Also recommended</Label>
          {renderDishList(details.alsoRecommended)}
        </div>
      )}

      {/* PRACTICAL — payment / English menu / reservation / dietary / tipping.
          The top traveler-anxiety cluster: surfaced high in the panel so
          users see it before deciding to go. v8 added tipping to address
          the #1 reported money-surprise complaint (service charges, cover
          charges, cash-only tip jars, country-level norms travelers don't
          know coming in). */}
      {details.practical && (() => {
        const rows = [
          { key: 'payment',     label: 'Payment' },
          { key: 'englishMenu', label: 'English' },
          { key: 'reservation', label: 'Reservation' },
          { key: 'dietary',     label: 'Dietary' },
          { key: 'tipping',     label: 'Tipping' },
        ].filter(r => details.practical[r.key]);
        if (rows.length === 0) return null;
        return (
          <div style={{ marginBottom: '10px' }}>
            <Label>Practical</Label>
            <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', ...bodyStyle }}>
              {rows.map(r => (
                <li key={r.key} style={{ marginBottom: '4px' }}>
                  <strong style={{ fontWeight: '600' }}>{r.label}:</strong> {h(details.practical[r.key])}
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {row('Photo-worthy', details.photoWorthy)}

      {/* Attraction-only fields */}
      {row('What you see', details.whatYouSee)}
      {row('About & history', details.aboutAndHistory)}

      {row('Crowd', details.crowd)}
      {row('Best time', details.bestTime)}
      {row('Vibe', details.vibe)}
      {row('Value', details.value)}

      {details.goodToKnow?.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <Label>Good to know</Label>
          <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'disc', ...bodyStyle }}>
            {details.goodToKnow.map((g, i) => (
              <li key={i}>{h(g)}</li>
            ))}
          </ul>
        </div>
      )}

      {row('Traveler', details.travelerNotes)}

      {details.websiteUri && (
        <div style={{ marginTop: '10px', fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
          For more information, visit{' '}
          <a href={details.websiteUri} target="_blank" rel="noopener noreferrer" style={{ color: w.ink, textDecoration: 'underline', textUnderlineOffset: 3, overflowWrap: 'anywhere' }}>
            {details.websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        </div>
      )}
    </div>
  );
}
