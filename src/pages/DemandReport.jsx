// DemandReport — the founder-readable demand brief.
//
// One quiet page answering five questions in plain language: what people
// browse, what they search (the actual query strings), where they linger,
// what they book, and what recent guests said. Reads the same admin-gated
// Worker /analytics-query route AdminAnalytics fans out over — one named
// D1 query per section — but rendered Passport Standard (serif headlines,
// mono data) instead of dashboard bars.
//
// Admin-gated exactly like AdminAnalytics: non-admin emails redirect Home
// (the Worker enforces the same allowlist server-side via requireAdmin).
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { callWorker } from '@/lib/callWorker';
import { createPageUrl } from '@/utils';
import { isAdminEmail } from '@/lib/admins';
import { IVORY, SHADOW_CARD_SOFT } from '@/components/redesign/constants';

// Editorial design tokens (shared with Trips / MyTrip / Wishlist).
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = '#16110D', ED_INK3 = '#736657';
const ED_RULE = 'rgba(22,17,13,.10)';
const STAMP_RED = '#B0472F'; // warm passport-ink red (same as Passport)

// One named D1 query per section — same fan-out shape as AdminAnalytics.
const TYPES = [
  'demand_top_browsed_30d',
  'demand_top_searches_30d',
  'demand_dwell_30d',
  'demand_bookings_by_country_90d',
  'trip_feedback_recent',
];

const EMPTY_LINE = 'No data yet — this fills as travelers use the app';

// ms → "4m 32s" (under a minute → "32s").
const fmtDwell = (ms) => {
  const totalSec = Math.round((Number(ms) || 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// rating → "★★★☆☆" (clamped 0–5).
const starsFor = (rating) => {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
};

// Defensive field readers — the queries are named contracts, but the exact
// column aliases live in the Worker; missing fields degrade to blanks/zero
// rather than a crashed founder page.
const pick = (...vals) => vals.find((v) => v !== null && v !== undefined && v !== '') ?? null;
const num = (...vals) => Number(pick(...vals)) || 0;

// checkout ('YYYY-MM-DD') beats created (D1 datetime text, date part kept).
const fmtWhen = (f) => {
  if (f.checkout) return String(f.checkout);
  if (f.created) return String(f.created).slice(0, 10);
  return '';
};

// One report section: mono window kicker over a serif headline, then a ruled
// ledger of rows. Every section carries the same honest empty state.
function Section({ kicker, title, isEmpty, children }) {
  return (
    <section className="rounded-[20px] px-5 py-5 mb-4" style={{ background: '#FFFFFF', border: `1px solid ${ED_RULE}`, boxShadow: SHADOW_CARD_SOFT }}>
      <p className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: 9.5, letterSpacing: '.14em', color: ED_INK3 }}>{kicker}</p>
      <h2 className="italic mt-1" style={{ fontFamily: ED_SERIF, fontSize: 23, color: ED_INK, lineHeight: 1.15 }}>{title}</h2>
      <div className="mt-3">
        {isEmpty ? (
          <p className="py-4 text-center" style={{ fontFamily: ED_MONO, fontSize: 11, letterSpacing: '.03em', color: ED_INK3 }}>{EMPTY_LINE}</p>
        ) : children}
      </div>
    </section>
  );
}

// One ledger row: serif label (+ optional mono detail) left, mono value right.
function DataRow({ label, detail, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2" style={{ borderTop: `1px solid ${ED_RULE}` }}>
      <div className="min-w-0">
        <div className="truncate" style={{ fontFamily: ED_SERIF, fontSize: 16, color: ED_INK, lineHeight: 1.25 }}>{label}</div>
        {detail && (
          <div className="truncate mt-0.5" style={{ fontFamily: ED_MONO, fontSize: 10, letterSpacing: '.04em', color: ED_INK3 }}>{detail}</div>
        )}
      </div>
      <div className="flex-none" style={{ fontFamily: ED_MONO, fontSize: 13, color: ED_INK }}>{value}</div>
    </div>
  );
}

export default function DemandReport() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Admin gate via Supabase (native-safe). The app-wide AuthGate guarantees
      // a signed-in user; non-admins are redirected home. (Same as AdminAnalytics.)
      if (!isAdminEmail(authUser?.email)) {
        navigate(createPageUrl('Home'));
        return;
      }
      const pairs = await Promise.all(TYPES.map(async (type) => {
        const { data: qd, error: qe } = await callWorker(`analytics-query?type=${encodeURIComponent(type)}`, {});
        return [type, { results: qd?.results || [], error: qe || qd?.error || null }];
      }));
      setData(Object.fromEntries(pairs));
      setGeneratedAt(new Date().toISOString());
    } catch (e) {
      setError(e?.message || 'Failed to load the demand report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const browsed = data?.demand_top_browsed_30d?.results || [];
  const searches = data?.demand_top_searches_30d?.results || [];
  const dwell = data?.demand_dwell_30d?.results || [];
  const bookings = data?.demand_bookings_by_country_90d?.results || [];
  const feedback = data?.trip_feedback_recent?.results || [];

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      {/* HEADER — back button, mono kicker, serif headline (Passport Standard) */}
      <div className="px-4 pt-2 pb-1">
        <div className="max-w-md mx-auto flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/5"
            style={{ background: '#FFFFFF', border: `1px solid ${ED_RULE}` }}
            aria-label="Back"
          >
            <ChevronLeft size={18} color={ED_INK} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="px-4 max-w-md mx-auto pb-1 text-center">
        <p className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: 10, letterSpacing: '0.16em', color: ED_INK3 }}>
          Founder brief
        </p>
        <h1 className="italic leading-none mt-1.5" style={{ fontFamily: ED_SERIF, fontSize: 32, color: ED_INK }}>
          Demand Report
        </h1>
        <button
          onClick={load}
          disabled={loading}
          className="mt-2 uppercase font-semibold"
          style={{ fontFamily: ED_MONO, fontSize: 9.5, letterSpacing: '.1em', color: ED_INK3, background: 'transparent', border: 'none', cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? 'Refreshing…' : generatedAt ? `As of ${new Date(generatedAt).toLocaleTimeString()} · Refresh` : 'Refresh'}
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 pb-6 pt-4">
        {error && (
          <div className="rounded-[16px] px-4 py-3 mb-4" style={{ background: '#FFFFFF', border: `1px solid ${ED_RULE}` }}>
            <p style={{ fontFamily: ED_MONO, fontSize: 11, color: STAMP_RED }}>{error}</p>
          </div>
        )}

        {/* Minimal loading skeleton — three quiet pulsing cards. */}
        {loading && !data && (
          <div className="animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[20px] px-5 py-5 mb-4" style={{ background: '#FFFFFF', border: `1px solid ${ED_RULE}` }}>
                <div className="h-5 w-44 rounded" style={{ background: 'rgba(22,17,13,.08)' }} />
                <div className="h-3 w-full rounded mt-4" style={{ background: 'rgba(22,17,13,.05)' }} />
                <div className="h-3 w-2/3 rounded mt-2" style={{ background: 'rgba(22,17,13,.05)' }} />
              </div>
            ))}
          </div>
        )}

        {data && (
          <>
            {/* demand_top_browsed_30d: {city, country, actions, sessions} */}
            <Section kicker="Last 30 days" title="What people browse" isEmpty={browsed.length === 0}>
              {browsed.map((r, i) => {
                const city = pick(r.city);
                const country = pick(r.country);
                return (
                  <DataRow
                    key={i}
                    label={city || country || '(unknown)'}
                    detail={[city ? country : null, num(r.sessions) ? `${num(r.sessions)} sessions` : null].filter(Boolean).join(' · ') || null}
                    value={num(r.actions, r.views, r.taps, r.count)}
                  />
                );
              })}
            </Section>

            {/* demand_top_searches_30d: {query, category, searches} — the actual
                typed strings are the gold; render them verbatim. */}
            <Section kicker="Last 30 days" title="What people search" isEmpty={searches.length === 0}>
              {searches.map((r, i) => (
                <DataRow
                  key={i}
                  label={`“${pick(r.query, r.q, r.term) || '(no query)'}”`}
                  detail={[pick(r.city), pick(r.country), pick(r.category)].filter(Boolean).join(' · ') || null}
                  value={num(r.searches, r.hits, r.count)}
                />
              ))}
            </Section>

            {/* demand_dwell_30d: {surface, place, dwells, total_ms} */}
            <Section kicker="Last 30 days" title="Where people linger" isEmpty={dwell.length === 0}>
              {dwell.map((r, i) => {
                const place = pick(r.place);
                const surface = pick(r.surface);
                return (
                  <DataRow
                    key={i}
                    label={place || surface || '(unknown)'}
                    detail={[place ? surface : null, num(r.dwells) ? `${num(r.dwells)} visits` : null].filter(Boolean).join(' · ') || null}
                    value={fmtDwell(num(r.total_ms, r.avg_ms, r.dwell_ms, r.ms))}
                  />
                );
              })}
            </Section>

            {/* demand_bookings_by_country_90d: {country, partner, bookings, commission} —
                real conversions only; sandbox test bookings are excluded in SQL. */}
            <Section kicker="Last 90 days" title="What people book" isEmpty={bookings.length === 0}>
              {bookings.map((r, i) => (
                <DataRow
                  key={i}
                  label={pick(r.country, r.dest_country, r.label) || '(unknown)'}
                  detail={[pick(r.partner), num(r.commission) ? `$${num(r.commission).toFixed(2)}` : null].filter(Boolean).join(' · ') || null}
                  value={num(r.bookings, r.count, r.clicks)}
                />
              ))}
            </Section>

            <Section kicker="Most recent" title="Recent trip feedback" isEmpty={feedback.length === 0}>
              {feedback.map((f, i) => (
                <div key={i} className="py-2.5" style={{ borderTop: `1px solid ${ED_RULE}` }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span style={{ fontFamily: ED_MONO, fontSize: 14, letterSpacing: '.14em', color: STAMP_RED }}>
                      {starsFor(pick(f.rating, f.stars))}
                    </span>
                    <span className="flex-none" style={{ fontFamily: ED_MONO, fontSize: 10, color: ED_INK3 }}>{fmtWhen(f)}</span>
                  </div>
                  <div className="mt-1 truncate" style={{ fontFamily: ED_SERIF, fontSize: 15.5, color: ED_INK, lineHeight: 1.3 }}>
                    {pick(f.hotel_name, f.hotelName, f.hotel, f.product_name) || 'Stay'}
                    {pick(f.city, f.dest_city) ? ` · ${pick(f.city, f.dest_city)}` : ''}
                  </div>
                  {pick(f.problems, f.problem) && (
                    <p className="mt-1" style={{ color: ED_INK3, fontSize: 13, lineHeight: 1.5 }}>
                      {`“${pick(f.problems, f.problem)}”`}
                    </p>
                  )}
                </div>
              ))}
            </Section>
          </>
        )}

        {/* The privacy line — quiet, mono, always present. */}
        <p className="text-center mt-6 mb-8" style={{ fontFamily: ED_MONO, fontSize: 10, letterSpacing: '.05em', color: ED_INK3 }}>
          Demand sections are aggregate and anonymous. Trip feedback shows individual anonymous reviews — no names, no accounts, no booking references.
        </p>
      </div>
    </div>
  );
}
