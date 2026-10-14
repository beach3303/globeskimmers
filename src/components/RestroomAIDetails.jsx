/**
 * RestroomAIDetails: the "AI details" disclosure on restroom cards (the new look, plan S10
 * detail 5), the restroom-voiced sibling of AIDetailsSection.
 *
 * Look: a quiet row (Sparkles in the world's icon ink, 'AI details', aria-expanded and
 * aria-controls); the body opens under it on white with the world line, the amenity
 * tags in the world's wash, mono section labels in the world ink and plain words. No
 * teal, no emoji; sizes follow --fs. Inside a card's QuietRows the body takes the full
 * width under the rows (QuietPanel). `world`: a WORLD row or key (Restrooms' iris by
 * default).
 *
 * Data: lazy-fetched on the first open via callWorker(ROUTE.getRestroomAIDetails), the
 * Worker's /restroom-ai-details, which runs the place's reviews and metadata through Haiku
 * and returns 7 sections plus restroomAmenities with confidence labels (confirmed |
 * reported | likely | not_confirmed | unknown). KV-cached 90 days (Haiku about once per
 * place).
 *
 * Honest by design: only confirmed, reported or likely amenities show, likely ones say
 * so ("Bidet likely"); not_confirmed and unknown stay hidden, and so do access rules
 * that aren't there. The footer says what it is based on.
 */
import React, { useState, useEffect, useId } from 'react';
import { Sparkles } from 'lucide-react';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { logEvent } from '@/lib/analytics';
import { NEUTRAL, fs } from '@/components/redesign/constants';
import { worldRow } from '@/components/finder/FinderControls';
import { QuietRow, QuietPanel, WorldTag, TagRow } from '@/components/finder/FinderCard';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/**
 * A style object that may carry CSS custom properties (--w-wash).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

// A confidence label in words: confirmed and reported state the amenity, likely says
// "likely", and anything less is not shown.
function said(status) {
  if (status === 'confirmed' || status === 'reported') return '';
  if (status === 'likely') return ' likely';
  return null;
}

// The amenity tags from restroomAmenities, in the order a traveler scans them.
function amenityTags(a) {
  if (!a) return [];
  const tags = [];
  const add = (base, status) => {
    const s = said(status);
    if (s != null) tags.push(`${base}${s}`);
  };
  // The toilet type has its own values, not a confidence label.
  if (a.toiletType === 'western') tags.push('Western toilet');
  else if (a.toiletType === 'squat') tags.push('Squat toilet');
  else if (a.toiletType === 'both') tags.push('Western and squat');
  add('Toilet paper', a.toiletPaper);
  add('Soap', a.soap);
  add('Hand drying', a.handDryerOrPaperTowels);
  add('Bidet', a.bidet);
  add('Seat covers', a.toiletSeatCovers);
  add('Accessible stall', a.accessibleStall);
  add('Changing table', a.babyChangingTable);
  add('Family restroom', a.familyRestroom);
  // Access rules only when there is one.
  add('Ask staff for a key', a.keyOrCodeRequired);
  add('Purchase may be required', a.purchaseRequired);
  return tags;
}

const SECTIONS = [
  { key: 'verdict', title: 'GS restroom verdict' },
  { key: 'toiletSetup', title: 'Toilet setup' },
  { key: 'supplies', title: 'Supplies' },
  { key: 'accessRules', title: 'Access rules' },
  { key: 'accessibility', title: 'Accessibility' },
  { key: 'familyElderly', title: 'Family and elderly comfort' },
  { key: 'safety', title: 'Safety note' },
];

function Body({ loading, error, d, w }) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading restroom details" style={css({ display: 'flex', flexDirection: 'column', gap: 8, '--w-wash': w.wash })}>
        {[82, 64, 74, 58].map((pct, i) => (
          <span key={i} className="gs-shimmer" aria-hidden="true" style={{ display: 'block', height: 12, width: `${pct}%`, borderRadius: 4 }} />
        ))}
      </div>
    );
  }
  if (error) return <div role="alert" style={{ fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.stamp }}>Couldn&rsquo;t load the restroom details. {error}</div>;
  if (!d) return null;

  const tags = amenityTags(d.restroomAmenities);
  return (
    <div>
      {tags.length > 0 && (
        <TagRow max={tags.length} style={{ marginBottom: 12 }}>
          {tags.map((t) => <WorldTag key={t} world={w} tone="wash">{t}</WorldTag>)}
        </TagRow>
      )}
      {SECTIONS.map((s) => (d[s.key] ? (
        <div key={s.key} style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 4, fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.34, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: w.ink }}>{s.title}</div>
          <div style={{ fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink }}>{d[s.key]}</div>
        </div>
      ) : null))}
      <div style={{ marginTop: 4, fontSize: fs(11.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
        Based on reviews and place info. Confirm at the place if it matters.
      </div>
    </div>
  );
}

/**
 * @param {{ placeId?: string, placeName?: string, venueLabel?: string, venueCategory?: string, accessType?: string, page?: string, world?: any }} props
 */
export default function RestroomAIDetails({ placeId, placeName, venueLabel, venueCategory, accessType, page = 'RestroomFinder', world = 'restroom' }) {
  const w = worldRow(world);
  const bodyId = useId();
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
    <>
      <QuietRow world={w} icon={Sparkles} expanded={open} controls={bodyId} onClick={onToggle}>
        AI details
      </QuietRow>
      <QuietPanel world={w} id={bodyId} order={2} hidden={!open} style={{ padding: '14px 16px' }}>
        {open ? <Body loading={loading} error={error} d={data} w={w} /> : null}
      </QuietPanel>
    </>
  );
}
