/**
 * CafeWorkProfileSection — the "Good for working" row on coffee cards (the new look:
 * Coffee.dc.html L95, in the world's copper). A 44px row with a lucide Laptop:
 *   - when reviews already mention work things (`reported`: words like 'Wi-Fi',
 *     'outlets', 'quiet'), it says "Good for working: Wi-Fi, outlets (from reviews)";
 *   - otherwise "Good for working?" with "Tap to check".
 * Tapping opens the review-derived work profile (wifi, power outlets, work tables, AC,
 * seating comfort, noise), lazy-fetched from the Worker's /cafe-work-profile, which is
 * cached permanently in D1 (pay Haiku once per café, ever). Honest by design: anything
 * the reviews don't mention is left out, in words and never emoji, with a "based on
 * customer reviews" line. A chain's assumed Wi-Fi is never passed in as `reported`.
 */
import React, { useState, useEffect, useId } from 'react';
import { ChevronDown, Laptop } from 'lucide-react';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { logEvent } from '@/lib/analytics';
import { NEUTRAL, fs, worldOf } from '@/components/redesign/constants';

const VERDICT = {
  great:     'Great for working',
  ok:        'OK for working',
  not_ideal: 'Not ideal for work',
  unknown:   'Not enough information yet',
};
const STATUS_WORD = { yes: 'yes', limited: 'limited', no: 'no' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Fact({ label, status, note }) {
  if (!status || !STATUS_WORD[status]) return null;
  return (
    <div style={{ fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
      <span style={{ fontWeight: 600, color: NEUTRAL.ink }}>{label}:</span> {STATUS_WORD[status]}
      {note ? <span style={{ color: NEUTRAL.ink3 }}> ({note})</span> : null}
    </div>
  );
}

function Body({ loading, error, d, w }) {
  if (loading) {
    return (
      <div aria-hidden="true">
        {[80, 66, 72].map((pct, i) => (
          <div key={i} style={{ height: 12, width: `${pct}%`, background: w.wash, borderRadius: 4, marginBottom: 8 }} />
        ))}
      </div>
    );
  }
  if (error) return <div style={{ fontSize: fs(13), color: NEUTRAL.stamp }}>Couldn&rsquo;t load the work details. Try again in a moment.</div>;
  if (!d) return null;

  const verdict = VERDICT[d.laptopFriendly] || VERDICT.unknown;
  const extras = [
    d.seatingComfort && d.seatingComfort !== 'unknown' ? `${cap(d.seatingComfort)} seating` : null,
    d.noise && d.noise !== 'unknown' ? cap(d.noise) : null,
    d.bestForWork ? `Best time: ${d.bestForWork}` : null,
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="font-mono uppercase" style={{ fontSize: fs(10.5), letterSpacing: '.12em', color: w.iconInk }}>{verdict}</div>
      {d.summary && <div style={{ fontSize: fs(13.5), lineHeight: 1.5, color: NEUTRAL.ink2 }}>{d.summary}</div>}
      <Fact label="Wi-Fi" status={d.wifi?.status} note={d.wifi?.note} />
      <Fact label="Outlets" status={d.outlets?.status} note={d.outlets?.note} />
      <Fact label="Work tables" status={d.tables?.status} note={d.tables?.note} />
      <Fact label="Air conditioning" status={d.ac?.status} note={d.ac?.note} />
      {extras.length > 0 && <div style={{ fontSize: fs(13), color: NEUTRAL.ink2 }}>{extras.join(' · ')}</div>}
      <div style={{ fontSize: fs(12), color: NEUTRAL.ink3 }}>
        {d.laptopFriendly === 'unknown'
          ? 'Not enough reviews mention working here yet.'
          : 'Based on customer reviews. Call ahead to confirm.'}
      </div>
    </div>
  );
}

export default function CafeWorkProfileSection({ placeId, placeName, lat, lng, page = 'CoffeeFinder', world = 'coffee', reported = [] }) {
  const w = (world && typeof world === 'object' ? world : worldOf(world)) || worldOf('coffee');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bodyId = useId();

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) logEvent('cafe_work_opened', { placeId, placeName }, page);
  };

  useEffect(() => {
    if (!open || data || loading || !placeId) return;
    setLoading(true);
    setError(null);
    callWorker(ROUTE.getCafeWorkProfile, { placeId, placeName, lat, lng })
      .then(({ data: res }) => {
        if (res?.error) setError(res.error);
        else if (res?.workProfile) setData(res.workProfile);
        else setError('No data returned');
        const cache = res?._cache || 'unknown';
        logEvent('cafe_work_fetched', { placeId, cache, paid: cache === 'miss' }, page);
      })
      .catch((e) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placeId]);

  const words = Array.isArray(reported) ? reported.filter(Boolean) : [];
  const fromProfile = data && (data.laptopFriendly === 'great' || data.laptopFriendly === 'ok');

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex items-center w-full text-left"
        style={{ gap: 8, minHeight: 44, padding: 0, background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: fs(13), lineHeight: 1.35, color: NEUTRAL.ink2 }}
      >
        <Laptop size={16} color={w.iconInk} strokeWidth={2} aria-hidden="true" style={{ flex: 'none' }} />
        <span className="flex-1 min-w-0">
          {words.length > 0 ? (
            <>Good for working: {words.join(', ')} <span style={{ color: NEUTRAL.ink3 }}>(from reviews)</span></>
          ) : fromProfile ? (
            <>Good for working <span style={{ color: NEUTRAL.ink3 }}>(from reviews)</span></>
          ) : (
            <>Good for working? <span style={{ color: w.iconInk, fontWeight: 600 }}>Tap to check</span></>
          )}
        </span>
        <ChevronDown size={16} color={w.iconInk} strokeWidth={2} aria-hidden="true" style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div id={bodyId} style={{ padding: '12px 14px', marginTop: 4, background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 12 }}>
          <Body loading={loading} error={error} d={data} w={w} />
        </div>
      )}
    </div>
  );
}
