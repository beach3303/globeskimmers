/**
 * CafeWorkProfileSection — collapsible "💻 GOOD FOR WORKING" panel for coffee
 * cards. Lazy-fetches a review-derived work-friendliness profile (wifi, power
 * outlets, work tables, AC, seating comfort, noise) via
 * base44.functions.invoke('getCafeWorkProfile') → Worker /cafe-work-profile,
 * which is cached permanently in D1 (pay Haiku once per cafe, ever). Honest by
 * design: anything the reviews don't mention shows as omitted/unknown, with a
 * "based on reviews" disclaimer.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { logEvent } from '@/lib/analytics';

const TEAL = '#0E7C73';
const GRAY = '#64748B';
const DARK = '#1A2332';
const BG = '#ECFEFF';
const BORDER = '#A5F3EF';
const SHIMMER = '#CFFAFE';

const VERDICT = {
  great:     { icon: '💻', label: 'Great for working',   color: '#065F46', bg: '#D1FAE5' },
  ok:        { icon: '👍', label: 'OK for working',       color: '#1E40AF', bg: '#DBEAFE' },
  not_ideal: { icon: '🙅', label: 'Not ideal for work',   color: '#9A3412', bg: '#FFEDD5' },
  unknown:   { icon: '🤷', label: 'Not enough info yet',  color: '#475569', bg: '#F1F5F9' },
};
const STATUS_ICON = { yes: '✅', limited: '🟡', no: '❌', unknown: '·' };
const PILL = { fontSize: '11px', color: '#475569', background: '#fff', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: '6px' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Chip({ icon, label, status, note }) {
  if (!status || status === 'unknown') return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: DARK, marginBottom: '4px' }}>
      <span>{STATUS_ICON[status] || '·'}</span>
      <span style={{ fontWeight: '600' }}>{icon} {label}</span>
      {note ? <span style={{ color: GRAY }}>— {note}</span> : null}
    </div>
  );
}

function Body({ loading, error, d }) {
  if (loading) {
    return (
      <div>
        {[80, 66, 72].map((w, i) => (
          <div key={i} style={{ height: '12px', width: `${w}%`, background: `linear-gradient(90deg,${SHIMMER} 0%,${BORDER} 50%,${SHIMMER} 100%)`, backgroundSize: '200% 100%', borderRadius: '4px', marginBottom: '8px', animation: 'gsShimmer 1.2s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes gsShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      </div>
    );
  }
  if (error) return <div style={{ fontSize: '12px', color: '#B91C1C' }}>Couldn't load work info. {error}</div>;
  if (!d) return null;

  const v = VERDICT[d.laptopFriendly] || VERDICT.unknown;
  const anyChip = ['wifi', 'outlets', 'tables', 'ac'].some((k) => d[k]?.status && d[k].status !== 'unknown');

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <span style={{ display: 'inline-block', fontSize: '12px', fontWeight: '700', padding: '3px 10px', background: v.bg, color: v.color, borderRadius: '9999px' }}>
          {v.icon} {v.label}
        </span>
      </div>
      {d.summary && <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK, marginBottom: '10px' }}>{d.summary}</div>}
      {anyChip && (
        <div style={{ marginBottom: '8px' }}>
          <Chip icon="📶" label="WiFi" status={d.wifi?.status} note={d.wifi?.note} />
          <Chip icon="🔌" label="Outlets" status={d.outlets?.status} note={d.outlets?.note} />
          <Chip icon="🪑" label="Work tables" status={d.tables?.status} note={d.tables?.note} />
          <Chip icon="❄️" label="Air conditioning" status={d.ac?.status} note={d.ac?.note} />
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {d.seatingComfort && d.seatingComfort !== 'unknown' && <span style={PILL}>🛋️ {cap(d.seatingComfort)} seating</span>}
        {d.noise && d.noise !== 'unknown' && <span style={PILL}>🔉 {cap(d.noise)}</span>}
        {d.bestForWork && <span style={PILL}>⏰ Best: {d.bestForWork}</span>}
      </div>
      <div style={{ fontSize: '10.5px', color: GRAY, fontStyle: 'italic' }}>
        {d.laptopFriendly === 'unknown'
          ? "Not enough reviews mention working here yet."
          : 'Based on customer reviews — call ahead to confirm.'}
      </div>
    </div>
  );
}

export default function CafeWorkProfileSection({ placeId, placeName, page = 'CoffeeFinder' }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) logEvent('cafe_work_opened', { placeId, placeName }, page);
  };

  useEffect(() => {
    if (!open || data || loading || !placeId) return;
    setLoading(true);
    setError(null);
    base44.functions.invoke('getCafeWorkProfile', { placeId, placeName })
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

  return (
    <div style={{ padding: '12px 14px', background: BG, borderRadius: '10px', border: `1px solid ${BORDER}` }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: TEAL, letterSpacing: '0.5px' }}>💻 GOOD FOR WORKING</span>
        <span style={{ fontSize: '11px', color: TEAL }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ marginTop: '10px' }}><Body loading={loading} error={error} d={data} /></div>}
    </div>
  );
}
