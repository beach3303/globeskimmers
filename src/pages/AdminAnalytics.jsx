/**
 * AdminAnalytics — Phase 2 dashboard reading from D1 events table.
 *
 * Source: base44.functions.invoke('getAnalytics') → Worker /analytics-query
 *         (allowlisted SELECTs against D1) → render here.
 *
 * Admin-gated: redirects non-admin emails to Home.
 *
 * Separate from /AdminDashboard which reads Base44-native users + events
 * (signups, onboarding, etc). This page is for the in-app behavior signal
 * (page views, search queries, zero-result rates, dish gallery usage).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { ArrowLeft, RefreshCw, Activity, Eye, Search, AlertTriangle, Image } from 'lucide-react';

const ADMIN_EMAILS = ['maizasimeon@gmail.com', 'founder@globeskimmers.io'];

const COLORS = {
  bg: '#F0F4F8',
  card: '#FFFFFF',
  dark: '#1A2332',
  gray: '#64748B',
  border: '#E2E8F0',
  accent: '#6366F1',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
};

function KpiCard({ icon: Icon, label, value, sublabel, color = COLORS.accent }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.dark, lineHeight: 1.1 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 4 }}>{sublabel}</div>}
    </div>
  );
}

function BarRow({ label, count, max, color = COLORS.accent }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: COLORS.dark, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{label}</span>
        <span style={{ color: COLORS.gray, fontWeight: 700 }}>{count}</span>
      </div>
      <div style={{ height: 6, background: COLORS.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, empty }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {Icon && <Icon size={18} color={COLORS.accent} />}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark, margin: 0 }}>{title}</h2>
      </div>
      {empty ? (
        <div style={{ fontSize: 13, color: COLORS.gray, padding: '20px 0', textAlign: 'center' }}>{empty}</div>
      ) : children}
    </div>
  );
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) {
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }
      const me = await base44.auth.me();
      if (!ADMIN_EMAILS.includes(String(me.email || '').toLowerCase())) {
        navigate(createPageUrl('Home'));
        return;
      }
      const { data: resp } = await base44.functions.invoke('getAnalytics', {});
      if (resp?.error) throw new Error(resp.error);
      setData(resp?.data || {});
      setGeneratedAt(resp?.generatedAt || null);
    } catch (e) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = data?.totals_7d?.results?.[0] || {};
  const pageViews = data?.page_views_7d?.results || [];
  const eventBreakdown = data?.event_type_breakdown_7d?.results || [];
  const zeroResults = data?.top_zero_results?.results || [];
  const topSearches = data?.top_searches_7d?.results || [];
  const eventsByDay = data?.events_by_day_14d?.results || [];
  const dishSearches = data?.dish_gallery_searches?.results || [];

  const maxPageViews = Math.max(...pageViews.map(p => p.views || 0), 1);
  const maxEventCount = Math.max(...eventBreakdown.map(e => e.count || 0), 1);
  const maxZero = Math.max(...zeroResults.map(z => z.hits || 0), 1);
  const maxSearches = Math.max(...topSearches.map(s => s.hits || 0), 1);
  const maxDish = Math.max(...dishSearches.map(d => d.searches || 0), 1);
  const maxDay = Math.max(...eventsByDay.map(d => d.count || 0), 1);

  return (
    <div style={{ fontFamily: "'DM Sans',-apple-system,sans-serif", background: COLORS.bg, minHeight: '100vh' }}>
      <div style={{ background: 'linear-gradient(135deg,#1E293B 0%,#6366F1 100%)', padding: '16px 16px 24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.9)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: 12, fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📊 Analytics</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              {generatedAt ? `Last refreshed ${new Date(generatedAt).toLocaleTimeString()}` : 'D1 events table'}
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '8px 14px', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {error && (
          <div style={{ padding: 14, background: '#FEF2F2', color: '#B91C1C', borderRadius: 12, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 60, color: COLORS.gray }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
            <div>Loading analytics…</div>
          </div>
        )}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <KpiCard
                icon={Activity}
                label="Events (7d)"
                value={totals.total_events ?? 0}
                color={COLORS.accent}
              />
              <KpiCard
                icon={Eye}
                label="Sessions (7d)"
                value={totals.unique_sessions ?? 0}
                color={COLORS.green}
              />
            </div>

            <Section title="Events per day (14d)" icon={Activity} empty={eventsByDay.length === 0 ? 'No data yet — events will appear once users start interacting.' : null}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                {eventsByDay.map(d => {
                  const h = (d.count / maxDay) * 100;
                  return (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div title={`${d.day}: ${d.count}`} style={{ width: '100%', height: `${Math.max(h, 4)}%`, background: COLORS.accent, borderRadius: '3px 3px 0 0' }} />
                      <div style={{ fontSize: 9, color: COLORS.gray }}>{d.day.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Page views (7d)" icon={Eye} empty={pageViews.length === 0 ? 'No page views logged yet.' : null}>
              {pageViews.map(p => (
                <BarRow key={p.page} label={p.page || '(unknown)'} count={p.views} max={maxPageViews} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="Event type breakdown (7d)" icon={Activity} empty={eventBreakdown.length === 0 ? 'No events logged yet.' : null}>
              {eventBreakdown.map(e => (
                <BarRow key={e.event_type} label={e.event_type} count={e.count} max={maxEventCount} color={COLORS.green} />
              ))}
            </Section>

            <Section title="Top zero-result searches (30d)" icon={AlertTriangle} empty={zeroResults.length === 0 ? 'No zero-result searches yet — the search reliability work is paying off.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                These are queries users typed that returned nothing. Each one is a coverage gap worth investigating.
              </div>
              {zeroResults.map((z, i) => (
                <BarRow key={i} label={`${z.query || '(no query)'}${z.cuisine ? ` · ${z.cuisine}` : ''}`} count={z.hits} max={maxZero} color={COLORS.red} />
              ))}
            </Section>

            <Section title="Top searches (7d)" icon={Search} empty={topSearches.length === 0 ? 'No text searches yet.' : null}>
              {topSearches.map((s, i) => (
                <BarRow
                  key={i}
                  label={`${s.query} · avg ${Math.round(s.avg_results || 0)} results`}
                  count={s.hits}
                  max={maxSearches}
                  color={COLORS.accent}
                />
              ))}
            </Section>

            <Section title="Dish Gallery searches (30d)" icon={Image} empty={dishSearches.length === 0 ? 'No dish gallery usage yet.' : null}>
              {dishSearches.map((d, i) => (
                <BarRow
                  key={i}
                  label={`${d.query} · avg ${Math.round(d.avg_photos || 0)} photos`}
                  count={d.searches}
                  max={maxDish}
                  color={COLORS.amber}
                />
              ))}
            </Section>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
