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
import { useAuth } from '@/lib/AuthContext';
import { callWorker } from '@/lib/callWorker';
import { createPageUrl } from '@/utils';
import { ArrowLeft, RefreshCw, Activity, Eye, Search, AlertTriangle, Sparkles, DollarSign, Zap, Users, UserCheck, Mail } from 'lucide-react';
import { isAdminEmail } from '@/lib/admins';
import OfficialSeal from '@/components/passport/OfficialSeal';

const SEAL_TIER_LABEL = { gold: 'Gold · Honored', burgundy: 'Burgundy · Official', teal: 'Teal · GlobeSkimmers team', 'sunshine-heart': 'Sunshine ♥ · Friends & Family', 'sunshine-star': 'Sunshine ★ · Friends & Family' };

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
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [userStats, setUserStats] = useState(null); // real Supabase-profiles aggregates
  const [generatedAt, setGeneratedAt] = useState(null);
  // Messages sent from the website's contact form (worker /admin/contact).
  const [inbox, setInbox] = useState({ messages: [], open: 0, total: 0, error: null });
  // Social safety reports (Apple 1.2 queue). minor_safety rows carry the 24h
  // triage SLA — they sort first and show an age tag.
  const [reports, setReports] = useState({ rows: [], error: null });
  const loadReports = async () => {
    const { data, error } = await callWorker('admin/reports', { status: 'open' });
    const rows = (data?.reports || []).slice().sort((a, b) => (a.reason === 'minor_safety' ? -1 : 0) - (b.reason === 'minor_safety' ? -1 : 0) || String(b.created_at).localeCompare(String(a.created_at)));
    setReports({ rows, error: error || data?.error || null });
  };
  const resolveReport = async (id, resolve) => {
    await callWorker('admin/reports', { id, resolve });
    loadReports();
  };

  // Held usernames (the founder's family reservations) + the Official Seal.
  const [held, setHeld] = useState({ rows: [], emailConfigured: false, error: null });
  const [heldDraft, setHeldDraft] = useState({ handle: '', name: '', email: '' });
  const [heldEdits, setHeldEdits] = useState({});      // handle -> email draft
  const [heldBusy, setHeldBusy] = useState(null);      // handle being acted on
  const [inviteCopy, setInviteCopy] = useState(null);  // { handle, text } when email isn't configured
  const [seals, setSeals] = useState({ rows: [], error: null });
  const [sealDraft, setSealDraft] = useState('');
  const [sealTierDraft, setSealTierDraft] = useState('burgundy');
  const [brandOpen, setBrandOpen] = useState(null);   // brand handle with controls expanded
  const [requests, setRequests] = useState({ rows: [], error: null });
  const reqCall = async (body) => {
    const { data, error } = await callWorker('admin/handle-requests', body || {});
    setRequests({ rows: data?.rows || [], error: error || data?.error || null });
  };
  const famRows = held.rows.filter((r) => r.kind !== 'brand');
  const brandRows = held.rows.filter((r) => r.kind === 'brand');
  const heldCall = async (body) => {
    const { data, error } = await callWorker('admin/held-handles', body);
    if (data?.rows) setHeld({ rows: data.rows, emailConfigured: !!data.emailConfigured, error: error || data?.error || null });
    return { data, error: error || data?.error || null };
  };
  const sealCall = async (body) => {
    const { data, error } = await callWorker('admin/verified', body);
    if (data?.rows) setSeals({ rows: data.rows, error: error || data?.error || null });
    return { data, error: error || data?.error || null };
  };
  const addHeld = async () => {
    const { error } = await heldCall({ op: 'add', handle: heldDraft.handle, display_name: heldDraft.name, email: heldDraft.email, kind: heldDraft.kind || 'family' });
    if (error) setHeld((h) => ({ ...h, error })); else setHeldDraft({ handle: '', name: '', email: '', kind: heldDraft.kind || 'family' });
  };
  const saveHeldEmail = async (handle) => {
    setHeldBusy(handle);
    const { error } = await heldCall({ op: 'update', handle, email: heldEdits[handle] ?? '' });
    setHeldBusy(null);
    if (error) setHeld((h) => ({ ...h, error }));
    else setHeldEdits((e) => { const n = { ...e }; delete n[handle]; return n; });
  };
  const inviteHeld = async (handle) => {
    setHeldBusy(handle); setInviteCopy(null);
    const { data, error } = await heldCall({ op: 'invite', handle });
    setHeldBusy(null);
    if (error) { setHeld((h) => ({ ...h, error })); return; }
    if (data?.sent) { await heldCall({ op: 'list' }); }
    else if (data?.text) {
      setInviteCopy({ handle, text: `Subject: ${data.subject}\n\n${data.text}` });
      try { await navigator.clipboard.writeText(`Subject: ${data.subject}\n\n${data.text}`); } catch { /* shown below anyway */ }
    }
  };
  const removeHeld = async (handle) => { await heldCall({ op: 'remove', handle }); };
  const [sealLetter, setSealLetter] = useState(null); // { sent, subject, text } from the last grant
  const grantSeal = async () => {
    setSealLetter(null);
    const { data, error } = await sealCall({ op: 'grant', handle: sealDraft, seal: sealTierDraft });
    if (error) { setSeals((v) => ({ ...v, error })); return; }
    setSealDraft('');
    if (data?.letter) {
      setSealLetter(data.letter);
      if (!data.letter.sent) {
        try { await navigator.clipboard.writeText(`Subject: ${data.letter.subject}\n\n${data.letter.text}`); } catch { /* shown below */ }
      }
    }
  };
  const revokeSeal = async (handle) => { await sealCall({ op: 'revoke', handle }); };

  const loadInbox = async (markHandled) => {
    try {
      const { data: ib, error: ie } = await callWorker('admin/contact', markHandled ? { markHandled } : {});
      setInbox({ messages: ib?.messages || [], open: ib?.open || 0, total: ib?.total || 0, error: ie || ib?.error || null });
    } catch (e) { setInbox({ messages: [], open: 0, total: 0, error: e?.message || 'Failed' }); }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Admin gate via Supabase (native-safe). The app-wide AuthGate guarantees a
      // signed-in user; non-admins are redirected home.
      if (!isAdminEmail(authUser?.email)) {
        navigate(createPageUrl('Home'));
        return;
      }
      // Fan out over the live Worker /analytics-query route (one D1 query per
      // type), assembling the bundle the renderer expects. Native-safe via
      // callWorker — replaces the Base44 getAnalytics function (403s on device).
      const TYPES = ['totals_7d', 'page_views_7d', 'event_type_breakdown_7d', 'top_zero_results', 'top_searches_7d', 'events_by_day_14d', 'ai_details_opens_by_day_14d', 'ai_details_per_session_7d', 'ai_details_paid_by_day_14d', 'ai_details_free_by_day_14d', 'ai_details_cost_per_session_7d', 'ai_details_cache_rate_7d', 'demand_by_city', 'trending_places', 'active_users', 'active_users_by_day_30d', 'retention_7d', 'retention_cohorts_90d', 'rows_per_session_7d', 'affiliate_by_partner_30d', 'affiliate_by_day_14d', 'affiliate_top_products_30d', 'affiliate_by_country_30d', 'passport_totals', 'passport_by_country', 'passport_by_city', 'passport_by_attraction', 'passport_by_day_30d', 'passport_by_month_12m', 'passport_shares_by_month_12m', 'passport_share_funnel_12m', 'passport_by_year', 'passport_countries_periods', 'passport_countries_by_month', 'passport_by_hour', 'passport_by_day_kind_30d', 'passport_by_week_kind_12w', 'passport_by_month_kind_12m', 'passport_top_airports', 'discover_top_destinations', 'discover_destinations_periods', 'discover_trending_foods', 'discover_hotel_areas', 'discover_escapes', 'searches_by_city', 'search_categories_by_city', 'transfer_vs_rental', 'zero_results_by_city', 'smart_search_by_scope', 'smart_search_by_category', 'smart_search_top_places', 'wishlist_by_city_30d', 'wishlist_top_30d', 'wishlist_by_kind_30d', 'wishlist_cta_30d', 'directions_by_place_30d', 'persona_distribution_30d', 'affiliate_funnel_30d', 'affiliate_clicks_by_intent_30d'];
      const pairs = await Promise.all(TYPES.map(async (type) => {
        const { data: qd, error: qe } = await callWorker(`analytics-query?type=${encodeURIComponent(type)}`, {});
        return [type, { results: qd?.results || [], error: qe || qd?.error || null }];
      }));
      // Stamps per month from passport_stamps itself (the D1 stamp events were
      // lost until 2026-09-28 — see gbLogEvent in the worker). Non-fatal: the
      // table falls back to the D1 events when this fails.
      let passportTruth = null;
      try {
        const { data: pm } = await callWorker('admin/passport-monthly', {});
        if (pm && Array.isArray(pm.months)) passportTruth = pm;
      } catch { /* fallback below */ }
      setData({ ...Object.fromEntries(pairs), passport_monthly_truth: passportTruth });
      // Real user metrics from Supabase profiles (service-role, admin-gated in
      // the Worker). Non-fatal: if it fails, the event analytics still render.
      try {
        const { data: us, error: ue } = await callWorker('admin-user-stats', {});
        setUserStats(ue ? null : us);
      } catch { setUserStats(null); }
      await loadInbox(); loadReports(); heldCall({ op: 'list' }); sealCall({ op: 'list' }); reqCall({ op: 'list' });
      setGeneratedAt(new Date().toISOString());
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
  const demandByCity = data?.demand_by_city?.results || [];        // travel-demand (30d)
  const trendingPlaces = data?.trending_places?.results || [];     // most-tapped places (30d)
  const affByPartner = data?.affiliate_by_partner_30d?.results || [];   // affiliate clicks/conversions/$ per partner (30d)
  const affByDay = data?.affiliate_by_day_14d?.results || [];           // affiliate clicks per day (14d)
  const affTopProducts = data?.affiliate_top_products_30d?.results || []; // most-tapped affiliate products (30d)
  const affByCountry = data?.affiliate_by_country_30d?.results || [];   // affiliate clicks by destination country (30d)
  const affTotalClicks = affByPartner.reduce((s, r) => s + (r.clicks || 0), 0);
  const affTotalConversions = affByPartner.reduce((s, r) => s + (r.conversions || 0), 0);
  const affTotalCommission = affByPartner.reduce((s, r) => s + (r.commission || 0), 0);
  // 🛂 Passport stamps (from 'passport_stamp' events)
  const ppTotals = data?.passport_totals?.results?.[0] || {};
  const ppByCountry = data?.passport_by_country?.results || [];
  const ppByCity = data?.passport_by_city?.results || [];
  const ppByAttraction = data?.passport_by_attraction?.results || [];
  const ppByDay = data?.passport_by_day_30d?.results || [];
  const ppByMonth = data?.passport_by_month_12m?.results || [];
  const ppByYear = data?.passport_by_year?.results || [];
  // 🛂 Stamped vs shared, per month (founder ask 2026-09-28): stamps from
  // 'passport_stamp', previews/shares/cancels from the share events, and each
  // month's shares by platform split into story / post / message.
  const ppShareRows = data?.passport_shares_by_month_12m?.results || [];
  const ppShareFunnel = data?.passport_share_funnel_12m?.results || [];
  const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', messenger: 'Messenger', whatsapp: 'WhatsApp', tiktok: 'TikTok', snapchat: 'Snapchat', x: 'X', messages: 'Messages', mail: 'Mail', saved: 'Saved', copied: 'Copied', other: 'Other', unknown: 'Unknown' };
  const ppShareMonths = (() => {
    const byMonth = new Map();
    const row = (m) => { if (!byMonth.has(m)) byMonth.set(m, { month: m, stamps: 0, previews: 0, shared: 0, cancelled: 0, platforms: new Map() }); return byMonth.get(m); };
    const truth = data?.passport_monthly_truth?.months;
    if (Array.isArray(truth)) truth.forEach((r) => { row(r.month).stamps = r.stamps || 0; });
    else ppByMonth.forEach((r) => { row(r.month).stamps = r.stamps || 0; });
    ppShareFunnel.forEach((r) => { const x = row(r.month); x.previews = r.previews || 0; x.shared = r.shared || 0; x.cancelled = r.cancelled || 0; });
    ppShareRows.forEach((r) => {
      const x = row(r.month);
      if (!x.platforms.has(r.platform)) x.platforms.set(r.platform, { platform: r.platform, story: 0, post: 0, message: 0, other: 0 });
      const p = x.platforms.get(r.platform);
      const k = ['story', 'post', 'message'].includes(r.use) ? r.use : 'other';
      p[k] += r.shares || 0;
    });
    return Array.from(byMonth.values())
      .filter((m) => m.stamps || m.previews || m.shared)
      .sort((a, b) => (a.month < b.month ? 1 : -1))
      .map((m) => ({ ...m, platforms: Array.from(m.platforms.values()).sort((a, b) => (b.story + b.post + b.message + b.other) - (a.story + a.post + a.message + a.other)) }));
  })();
  const ppCountriesPeriods = data?.passport_countries_periods?.results?.[0] || {};
  const ppCountriesByMonth = data?.passport_countries_by_month?.results || [];
  const ppByHour = data?.passport_by_hour?.results || [];
  // Airport-vs-destination splits (founder ask: "airports vs destinations, per day/week/month")
  const ppByDayKind = data?.passport_by_day_kind_30d?.results || [];
  const ppByWeekKind = data?.passport_by_week_kind_12w?.results || [];
  const ppByMonthKind = data?.passport_by_month_kind_12m?.results || [];
  const ppTopAirports = data?.passport_top_airports?.results || [];

  // ── Discover / behavior ("what people pick") — monetization signals, no PII ──
  const discDestinations = data?.discover_top_destinations?.results || [];
  const discPeriods = data?.discover_destinations_periods?.results?.[0] || {};
  const discFoods = data?.discover_trending_foods?.results || [];
  const discAreas = data?.discover_hotel_areas?.results || [];
  const discEscapes = data?.discover_escapes?.results || [];
  // Search-intent graph ("what people search, and where")
  const searchesByCity = data?.searches_by_city?.results || [];
  const searchCatsByCity = data?.search_categories_by_city?.results || [];
  const rideDemand = data?.transfer_vs_rental?.results || [];
  const zeroByCity = data?.zero_results_by_city?.results || [];
  const smartByScope = data?.smart_search_by_scope?.results || [];
  const smartByCat = data?.smart_search_by_category?.results || [];
  const smartTopPlaces = data?.smart_search_top_places?.results || [];
  const wishByCity = data?.wishlist_by_city_30d?.results || [];
  const wishTop = data?.wishlist_top_30d?.results || [];
  const wishByKind = data?.wishlist_by_kind_30d?.results || [];
  const wishCta = data?.wishlist_cta_30d?.results || [];
  const dirByPlace = data?.directions_by_place_30d?.results || [];
  const personaDist = data?.persona_distribution_30d?.results || [];
  const funnel = data?.affiliate_funnel_30d?.results?.[0] || {};
  const affByIntent = data?.affiliate_clicks_by_intent_30d?.results || [];
  const maxDiscDest = Math.max(...discDestinations.map((d) => d.views || 0), 1);
  const maxDiscFood = Math.max(...discFoods.map((d) => d.taps || 0), 1);
  const maxDiscArea = Math.max(...discAreas.map((d) => d.taps || 0), 1);
  const maxDiscEscape = Math.max(...discEscapes.map((d) => d.taps || 0), 1);

  const activeUsers = data?.active_users?.results?.[0] || {};       // DAU/WAU/MAU
  const activeByDay = data?.active_users_by_day_30d?.results || [];
  const retention = data?.retention_7d?.results?.[0] || {};
  const rowsPerSession = data?.rows_per_session_7d?.results?.[0] || {};
  const returnRate = retention.active ? Math.round((retention.returning / retention.active) * 100) : 0;
  const stickiness = activeUsers.mau ? Math.round((activeUsers.dau / activeUsers.mau) * 100) : 0;
  const avgRowsTaps = rowsPerSession.avg_taps ? Number(rowsPerSession.avg_taps).toFixed(1) : '0';
  const maxActive = Math.max(...activeByDay.map(d => d.active || 0), 1);
  // Durable-device retention cohort (anon_id-based): the make-or-break episodic metric.
  const cohort = data?.retention_cohorts_90d?.results?.[0] || {};
  const cohortN = cohort.new_users || 0;
  const cohortPct = (n) => (cohortN ? Math.round(((n || 0) / cohortN) * 100) : 0);
  const eventsByDay = data?.events_by_day_14d?.results || [];
  const aiOpensByDay = data?.ai_details_opens_by_day_14d?.results || [];
  const aiOpensPerSession = data?.ai_details_per_session_7d?.results || [];
  const totalAIOpens = aiOpensByDay.reduce((sum, d) => sum + (d.opens || 0), 0);
  const totalUniqueSessions = aiOpensPerSession.length;
  const avgPerSession = totalUniqueSessions > 0
    ? (aiOpensPerSession.reduce((sum, s) => sum + (s.distinct_places_opened || 0), 0) / totalUniqueSessions).toFixed(1)
    : 0;
  // Cost-tracking metrics (only fetches that actually paid, vs cached free hits)
  const aiPaidByDay = data?.ai_details_paid_by_day_14d?.results || [];
  const aiFreeByDay = data?.ai_details_free_by_day_14d?.results || [];
  const aiCostPerSession = data?.ai_details_cost_per_session_7d?.results || [];
  const cacheRate = data?.ai_details_cache_rate_7d?.results?.[0] || {};
  const totalPaid = aiPaidByDay.reduce((sum, d) => sum + (d.paid_fetches || 0), 0);
  const totalFree = aiFreeByDay.reduce((sum, d) => sum + (d.free_fetches || 0), 0);
  const totalSpend = (totalPaid * 0.025).toFixed(2); // $0.025 per paid fetch (Place Details + Claude)
  const totalSavings = (totalFree * 0.025).toFixed(2); // money saved by cache
  const hitRate = (cacheRate.total_fetches || 0) > 0
    ? Math.round((cacheRate.hits / cacheRate.total_fetches) * 100)
    : 0;

  const maxPageViews = Math.max(...pageViews.map(p => p.views || 0), 1);
  const maxEventCount = Math.max(...eventBreakdown.map(e => e.count || 0), 1);
  const maxZero = Math.max(...zeroResults.map(z => z.hits || 0), 1);
  const maxSearches = Math.max(...topSearches.map(s => s.hits || 0), 1);
  const maxDemand = Math.max(...demandByCity.map(d => d.views || 0), 1);
  const maxTrending = Math.max(...trendingPlaces.map(t => t.taps || 0), 1);
  const maxDay = Math.max(...eventsByDay.map(d => d.count || 0), 1);
  const maxAIOpensDay = Math.max(...aiOpensByDay.map(d => d.opens || 0), 1);
  const maxAIPerSession = Math.max(...aiOpensPerSession.map(s => s.distinct_places_opened || 0), 1);
  const maxAIPaidDay = Math.max(...aiPaidByDay.map(d => d.paid_fetches || 0), 1);
  const maxAIFreeDay = Math.max(...aiFreeByDay.map(d => d.free_fetches || 0), 1);
  const maxAIPaidSession = Math.max(...aiCostPerSession.map(s => s.paid_opens || 0), 1);

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
        {/* Quiet link to the founder-readable demand brief (same data, plain language). */}
        <button
          onClick={() => navigate(createPageUrl('DemandReport'))}
          style={{ marginTop: 10, background: 'transparent', border: 'none', padding: 0, color: 'rgba(255,255,255,0.85)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Demand Report →
        </button>
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
            {/* Real user metrics from Supabase profiles (replaces the dead
                Base44 AdminDashboard user data). */}
            {userStats && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <KpiCard icon={Users} label="Total users" value={userStats.totalUsers ?? 0} color={COLORS.green} />
                  <KpiCard
                    icon={UserCheck}
                    label="Onboarded"
                    value={userStats.onboardingCompleted ?? 0}
                    sublabel={userStats.totalUsers ? `${Math.round((userStats.onboardingCompleted / userStats.totalUsers) * 100)}% of users` : null}
                    color={COLORS.accent}
                  />
                </div>

                {userStats.signupsByDay?.length > 0 && (
                  <Section title="Sign-ups per day (30d)" icon={Users}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                      {userStats.signupsByDay.map(d => {
                        const mx = Math.max(...userStats.signupsByDay.map(x => x.count || 0), 1);
                        return (
                          <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div title={`${d.day}: ${d.count}`} style={{ width: '100%', height: `${Math.max((d.count / mx) * 100, 4)}%`, background: COLORS.green, borderRadius: '3px 3px 0 0' }} />
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Section title="Top home countries" icon={Users} empty={(userStats.byCountry?.length ?? 0) === 0 ? 'No data' : null}>
                    {(userStats.byCountry || []).map(c => (
                      <BarRow key={c.label} label={c.label} count={c.count} max={userStats.byCountry[0]?.count || 1} color={COLORS.green} />
                    ))}
                  </Section>
                  <Section title={`Age mix${userStats.ageKnown ? ` (${userStats.ageKnown} through the age gate)` : ''}`} icon={Users} empty={(userStats.ageMix?.length ?? 0) === 0 ? 'No one through the age gate yet' : null}>
                    {(userStats.ageMix || []).map(a => (
                      <BarRow key={a.label} label={a.label} count={a.count} max={Math.max(...(userStats.ageMix || []).map(x => x.count), 1)} color={COLORS.accent} />
                    ))}
                  </Section>
                  <Section title="Preferred languages" icon={Users} empty={(userStats.byLanguage?.length ?? 0) === 0 ? 'No data' : null}>
                    {(userStats.byLanguage || []).map(l => (
                      <BarRow key={l.label} label={l.label} count={l.count} max={userStats.byLanguage[0]?.count || 1} color={COLORS.accent} />
                    ))}
                  </Section>
                </div>
              </>
            )}

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

            {/* ── Growth & retention ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <KpiCard icon={Activity} label="DAU" value={activeUsers.dau ?? 0} color={COLORS.accent} />
              <KpiCard icon={Activity} label="WAU" value={activeUsers.wau ?? 0} color={COLORS.accent} />
              <KpiCard icon={Activity} label="MAU" value={activeUsers.mau ?? 0} color={COLORS.accent} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <KpiCard icon={Eye} label="Return rate (7d)" value={`${returnRate}%`} color={COLORS.green} />
              <KpiCard icon={Activity} label="Stickiness" value={`${stickiness}%`} color={COLORS.green} />
              <KpiCard icon={Sparkles} label="Taps/session" value={avgRowsTaps} color={COLORS.accent} />
            </div>

            <Section title={`🛡️ Safety reports — ${reports.rows.length} open`} icon={Mail} empty={reports.error ? `Couldn't load reports: ${reports.error}` : reports.rows.length === 0 ? 'No open reports. Shared-passport reports land here; a child-safety reason gets 24h triage.' : null}>
              {reports.rows.map((r) => (
                <div key={r.id} style={{ padding: '10px 0', borderTop: `1px solid ${COLORS.border || '#eee'}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: r.reason === 'minor_safety' ? '#B0472F' : COLORS.dark, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.06em' }}>{r.reason === 'minor_safety' ? '⚠️ CHILD SAFETY — 24H' : r.reason}</span>
                    <span style={{ color: COLORS.gray, fontSize: 12 }}>{r.kind}{r.subject_slug ? ` · /p/${r.subject_slug}` : ''}{r.ref ? ` · ${r.ref}` : ''}</span>
                    <span style={{ color: COLORS.gray, marginLeft: 'auto', fontSize: 12 }}>{String(r.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  {r.note && <div style={{ fontSize: 13, color: COLORS.dark, whiteSpace: 'pre-wrap', marginTop: 4 }}>{r.note}</div>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    <button type="button" onClick={() => resolveReport(r.id, 'resolved')} style={{ fontSize: 12, color: COLORS.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Resolved</button>
                    <button type="button" onClick={() => resolveReport(r.id, 'dismissed')} style={{ fontSize: 12, color: COLORS.gray, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Dismiss</button>
                  </div>
                </div>
              ))}
            </Section>

            <Section title={`✉️ Website messages — ${inbox.open} open`} icon={Mail} empty={inbox.error ? `Couldn't load messages: ${inbox.error}` : inbox.messages.length === 0 ? 'No messages from globeskimmers.io yet. The contact form stores them here.' : null}>
              {inbox.messages.map((m) => (
                <div key={m.id} style={{ padding: '10px 0', borderTop: `1px solid ${COLORS.border || '#eee'}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: COLORS.dark }}>{m.name}</span>
                    <a href={`mailto:${m.email}`} style={{ color: COLORS.accent }}>{m.email}</a>
                    {m.company && <span style={{ color: COLORS.gray }}>{m.company}</span>}
                    <span style={{ color: COLORS.gray, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.06em' }}>{m.who}</span>
                    <span style={{ color: COLORS.gray, marginLeft: 'auto' }}>{String(m.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.dark, whiteSpace: 'pre-wrap', marginTop: 6 }}>{m.message}</div>
                  <button type="button" onClick={() => loadInbox(m.id)} style={{ marginTop: 6, fontSize: 12, color: COLORS.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Mark handled</button>
                </div>
              ))}
            </Section>

            <Section title={`👑 Held usernames — ${famRows.filter(r => r.claimed_at).length} claimed of ${famRows.length}`} icon={UserCheck}
              empty={famRows.length === 0 && !held.error ? 'No names on the hold list yet. Add one below — it instantly reads as "taken" to everyone except the email you attach.' : null}>
              {held.error && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>{held.error}</div>}
              {!held.emailConfigured && famRows.length > 0 && (
                <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                  ✉️ Invitation email isn&rsquo;t wired yet (needs the RESEND_API_KEY secret) — &ldquo;Compose invite&rdquo; copies the message so you can text/email it yourself.
                </div>
              )}
              {famRows.map((r) => (
                <div key={r.handle} style={{ padding: '10px 0', borderTop: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: COLORS.dark }}>@{r.handle}</span>
                    {r.display_name && <span style={{ color: COLORS.gray }}>{r.display_name}</span>}
                    {r.claimed_at
                      ? <span style={{ color: COLORS.green, fontWeight: 700 }}>🎉 Claimed {String(r.claimed_at).slice(0, 10)}</span>
                      : r.invited_at
                        ? <span style={{ color: COLORS.amber, fontWeight: 600 }}>Invited {String(r.invited_at).slice(0, 10)}</span>
                        : <span style={{ color: COLORS.gray }}>Saved</span>}
                  </div>
                  {!r.claimed_at && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      <input value={heldEdits[r.handle] ?? r.email ?? ''} onChange={(e) => setHeldEdits((v) => ({ ...v, [r.handle]: e.target.value }))}
                        placeholder="their-email@example.com" aria-label={`Email for @${r.handle}`}
                        style={{ flex: '1 1 220px', minWidth: 180, padding: '7px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }} />
                      <button type="button" onClick={() => saveHeldEmail(r.handle)} disabled={heldBusy === r.handle || heldEdits[r.handle] === undefined}
                        style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: COLORS.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: heldEdits[r.handle] === undefined ? 0.5 : 1 }}>Save email</button>
                      <button type="button" onClick={() => inviteHeld(r.handle)} disabled={heldBusy === r.handle || !(heldEdits[r.handle] ?? r.email)}
                        style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: COLORS.green, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (heldEdits[r.handle] ?? r.email) ? 1 : 0.5 }}>
                        {heldBusy === r.handle ? 'Working…' : held.emailConfigured ? 'Send invitation' : 'Compose invite'}
                      </button>
                      <button type="button" onClick={() => removeHeld(r.handle)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Release</button>
                    </div>
                  )}
                  {inviteCopy?.handle === r.handle && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600, marginBottom: 4 }}>Copied to your clipboard — paste it into a text or email:</div>
                      <textarea readOnly value={inviteCopy.text} rows={6} style={{ width: '100%', fontSize: 12, padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}`, color: COLORS.dark }} />
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                <input value={heldDraft.handle} onChange={(e) => setHeldDraft((d) => ({ ...d, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) }))}
                  placeholder="@username to hold" aria-label="Username to hold" style={{ flex: '1 1 150px', minWidth: 130, padding: '7px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }} />
                <input value={heldDraft.name} onChange={(e) => setHeldDraft((d) => ({ ...d, name: e.target.value.slice(0, 60) }))}
                  placeholder="Their first name (for the hello)" aria-label="Display name" style={{ flex: '1 1 170px', minWidth: 150, padding: '7px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }} />
                <input value={heldDraft.email} onChange={(e) => setHeldDraft((d) => ({ ...d, email: e.target.value }))}
                  placeholder="Email (now or later)" aria-label="Email" style={{ flex: '1 1 190px', minWidth: 160, padding: '7px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }} />
                <div style={{ display: 'flex', gap: 4 }}>
                  {['family', 'brand'].map((k) => (
                    <button key={k} type="button" onClick={() => setHeldDraft((d) => ({ ...d, kind: k }))}
                      style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: (heldDraft.kind || 'family') === k ? COLORS.dark : '#fff', color: (heldDraft.kind || 'family') === k ? '#fff' : COLORS.gray, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{k}</button>
                  ))}
                </div>
                <button type="button" onClick={addHeld} disabled={heldDraft.handle.length < 3}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: COLORS.dark, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: heldDraft.handle.length < 3 ? 0.5 : 1 }}>Hold it</button>
              </div>
            </Section>

            <Section title={`🏷️ Brand & entity reserve — ${brandRows.length} names held`} icon={UserCheck}
              empty={brandRows.length === 0 ? 'No brand names held yet.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 8 }}>
                Sports, parks, hotels, airlines, luxury, officials — all read as &ldquo;taken&rdquo; to everyone. Tap one to attach a partner&rsquo;s email when a deal lands.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {brandRows.map((r) => (
                  <button key={r.handle} type="button" onClick={() => setBrandOpen(brandOpen === r.handle ? null : r.handle)}
                    style={{ padding: '4px 9px', borderRadius: 999, border: `1px solid ${brandOpen === r.handle ? COLORS.accent : COLORS.border}`, background: r.claimed_at ? '#E7F8F0' : '#fff', color: r.claimed_at ? COLORS.green : COLORS.dark, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                    @{r.handle}{r.claimed_at ? ' 🎉' : r.email ? ' ✉️' : ''}
                  </button>
                ))}
              </div>
              {brandOpen && (() => { const r = brandRows.find((x) => x.handle === brandOpen); return r && !r.claimed_at ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.dark, alignSelf: 'center' }}>@{r.handle}</span>
                  <input value={heldEdits[r.handle] ?? r.email ?? ''} onChange={(e) => setHeldEdits((v) => ({ ...v, [r.handle]: e.target.value }))}
                    placeholder="partner-email@brand.com" aria-label={`Email for @${r.handle}`}
                    style={{ flex: '1 1 200px', minWidth: 170, padding: '7px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }} />
                  <button type="button" onClick={() => saveHeldEmail(r.handle)} disabled={heldBusy === r.handle || heldEdits[r.handle] === undefined}
                    style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: COLORS.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: heldEdits[r.handle] === undefined ? 0.5 : 1 }}>Save email</button>
                  <button type="button" onClick={() => removeHeld(r.handle)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Release</button>
                </div>
              ) : null; })()}
            </Section>

            <Section title={`📨 Username & Seal requests — ${requests.rows.length} open`} icon={Mail}
              empty={requests.rows.length === 0 && !requests.error ? 'No requests yet. Businesses and people can ask for a username or the Seal from Settings.' : null}>
              {requests.error && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>{requests.error}</div>}
              {requests.rows.map((r) => (
                <div key={r.id} style={{ padding: '10px 0', borderTop: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: COLORS.dark }}>{r.kind === 'seal' ? '✪ Seal' : `@${r.handle}`}</span>
                    {r.email && <a href={`mailto:${r.email}`} style={{ color: COLORS.accent }}>{r.email}</a>}
                    <span style={{ color: COLORS.gray, marginLeft: 'auto' }}>{String(r.created_at || '').slice(0, 10)}</span>
                  </div>
                  {r.note && <div style={{ fontSize: 12.5, color: COLORS.dark, whiteSpace: 'pre-wrap', marginTop: 4 }}>{r.note}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button type="button" onClick={() => reqCall({ op: 'resolve', id: r.id, status: 'done' })} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: COLORS.green, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Done</button>
                    <button type="button" onClick={() => reqCall({ op: 'resolve', id: r.id, status: 'dismissed' })} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.gray, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Dismiss</button>
                  </div>
                </div>
              ))}
            </Section>

            <Section title={`✪ The GlobeSkimmers Seal — ${seals.rows.length} granted`} icon={UserCheck}
              empty={seals.rows.length === 0 && !seals.error ? 'No seals granted yet. Reserved for official figures, official businesses, and whoever you choose to gift it to. Users never see a checkmark — they see the Seal.' : null}>
              {seals.error && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>{seals.error}</div>}
              {sealLetter && (
                <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: sealLetter.sent ? '#E7F8F0' : '#FFF8E6', border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sealLetter.sent ? COLORS.green : COLORS.amber }}>
                    {sealLetter.sent ? '✉️ The letter was sent.' : '✉️ Email isn\u2019t configured — the letter was copied to your clipboard to send yourself:'}
                  </div>
                  {!sealLetter.sent && (
                    <textarea readOnly value={`Subject: ${sealLetter.subject}\n\n${sealLetter.text}`} rows={7}
                      style={{ width: '100%', fontSize: 12, padding: 8, marginTop: 6, borderRadius: 8, border: `1px solid ${COLORS.border}`, color: COLORS.dark }} />
                  )}
                </div>
              )}
              {seals.rows.map((r) => (
                <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: COLORS.dark, display: 'flex', alignItems: 'center' }}>@{r.handle}<OfficialSeal size={14} tier={r.seal || 'burgundy'} /></span>
                  <select value={r.seal || 'burgundy'} aria-label={`Seal color for @${r.handle}`}
                    onChange={async (e) => { const { error } = await sealCall({ op: 'recolor', handle: r.handle, seal: e.target.value }); if (error) setSeals((v) => ({ ...v, error })); else sealCall({ op: 'list' }); }}
                    style={{ padding: '5px 6px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12, background: '#fff', color: COLORS.dark }}>
                    {Object.entries(SEAL_TIER_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <button type="button" onClick={() => revokeSeal(r.handle)} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Revoke</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                <input value={sealDraft} onChange={(e) => setSealDraft(e.target.value)} placeholder="@handle to grant the Seal"
                  aria-label="Handle to grant the Seal" style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }} />
                <select value={sealTierDraft} onChange={(e) => setSealTierDraft(e.target.value)} aria-label="Seal tier"
                  style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12.5, background: '#fff' }}>
                  <option value="gold">Gold — Honored</option>
                  <option value="burgundy">Burgundy — Official</option>
                  <option value="teal">Teal — GlobeSkimmers team</option>
                  <option value="sunshine-heart">Sunshine ♥ — Friends & Family</option>
                  <option value="sunshine-star">Sunshine ★ — Friends & Family</option>
                </select>
                <button type="button" onClick={grantSeal} disabled={!sealDraft.trim()}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: COLORS.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: sealDraft.trim() ? 1 : 0.5 }}>Grant</button>
              </div>
            </Section>

            <Section title="Active users per day (30d)" icon={Eye} empty={activeByDay.length === 0 ? 'No active-user data yet.' : null}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
                {activeByDay.map(d => (
                  <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div title={`${d.day}: ${d.active}`} style={{ width: '100%', height: `${Math.max((d.active / maxActive) * 100, 4)}%`, background: COLORS.green, borderRadius: '3px 3px 0 0' }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 8 }}>
                Return rate = of users active this week, the % who first came &gt;7 days ago (came back). Stickiness = DAU ÷ MAU.
              </div>
            </Section>

            <Section title="Retention cohort — do they come back? (90d, per device)" icon={Users} empty={cohortN === 0 ? 'No cohort data yet — needs devices first seen in the last 90 days (after the anon_id fix).' : null}>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <b>{cohortN}</b> new devices · <b>{cohortPct(cohort.ever_returned)}%</b> ever came back
              </div>
              <BarRow label="Came back (ever)" count={cohort.ever_returned || 0} max={cohortN || 1} color={COLORS.green} />
              <BarRow label="Day 1" count={cohort.d1 || 0} max={cohortN || 1} color={COLORS.accent} />
              <BarRow label="Week 1 (D7)" count={cohort.d7 || 0} max={cohortN || 1} color={COLORS.accent} />
              <BarRow label="Day 30+" count={cohort.d30_plus || 0} max={cohortN || 1} color={COLORS.accent} />
              <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 8 }}>
                Durable per-device (anon_id) cohort — the honest episodic-retention signal. "Ever came back" is the number to watch first.
              </div>
            </Section>

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

            <Section title="🌍 Travel demand by city (30d)" icon={Search} empty={demandByCity.length === 0 ? 'No demand data yet — fills as users open Home in cities.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                Which cities users are in or planning (intent: present = there now, planning = browsing). The B2B demand signal.
              </div>
              {demandByCity.map((d, i) => (
                <BarRow key={i} label={`${d.city}${d.country ? ', ' + d.country : ''} · ${d.intent || '—'}`} count={d.views} max={maxDemand} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🔥 Trending places (30d)" icon={Sparkles} empty={trendingPlaces.length === 0 ? 'No taps yet — fills as users tap engagement-row cards.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                Most-tapped places — what converts (your affiliate targets).
              </div>
              {trendingPlaces.map((t, i) => (
                <BarRow key={i} label={`${t.place || '(unknown)'}${t.city ? ' · ' + t.city : ''}`} count={t.taps} max={maxTrending} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🧭 Destinations users are into (30d)" icon={Search} empty={discDestinations.length === 0 ? 'Fills as users open the new Home in cities (present = there now · planning = dreaming).' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                Unique destinations — <strong style={{ color: COLORS.dark }}>{discPeriods.today || 0}</strong> today · <strong style={{ color: COLORS.dark }}>{discPeriods.week || 0}</strong> this week · <strong style={{ color: COLORS.dark }}>{discPeriods.month || 0}</strong> this month. The demand + retargeting signal.
              </div>
              {discDestinations.map((d, i) => (
                <BarRow key={i} label={`${d.city}${d.country ? ', ' + d.country : ''} · ${d.planning || 0} plan / ${d.present || 0} there`} count={d.views} max={maxDiscDest} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🔥 Trending / viral foods (30d)" icon={Sparkles} empty={discFoods.length === 0 ? 'Fills as users tap dishes in the Right-Now strip — our live "what\'s viral here" signal.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Which viral dishes people tap, per city — feeds food curation + restaurant affiliate.</div>
              {discFoods.map((d, i) => (
                <BarRow key={i} label={`${d.dish || '(unknown)'}${d.city ? ' · ' + d.city : ''}`} count={d.taps} max={maxDiscFood} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🏨 Hotel areas people pick (30d)" icon={Search} empty={discAreas.length === 0 ? 'Fills as users tap areas in "Where should I stay?" — the hotel-booking intent signal.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Which base neighborhoods convert — your hotel affiliate targets.</div>
              {discAreas.map((d, i) => (
                <BarRow key={i} label={`${d.area || '(unknown)'}${d.city ? ' · ' + d.city : ''}`} count={d.taps} max={maxDiscArea} color={COLORS.accent} />
              ))}
            </Section>

            {/* ── Search-intent graph — "what people search, and WHERE" (the demand moat) ── */}
            <Section title="🔎 Top searches — and where (30d)" icon={Search} empty={searchesByCity.length === 0 ? 'Fills as users search any finder — the query + the city it was searched in (present = there now · planning = dreaming).' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>What people type + where they typed it — the first-party demand-intent graph.</div>
              {searchesByCity.map((d, i) => (
                <BarRow key={i} label={`"${d.query}" · ${d.city || '—'}${d.country ? ', ' + d.country : ''} · ${d.category || ''} (${d.planning || 0} plan / ${d.present || 0} there)`} count={d.searches} max={searchesByCity[0]?.searches || 1} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🗺️ Demand mix per city (30d)" icon={Search} empty={searchCatsByCity.length === 0 ? 'Fills as searches accrue — what a city\'s visitors mostly want (eat vs shop vs stay vs do).' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Which vertical each destination searches for most — where to push which inventory.</div>
              {searchCatsByCity.map((d, i) => (
                <BarRow key={i} label={`${d.city || '—'}${d.country ? ', ' + d.country : ''} · ${d.category || '?'}`} count={d.searches} max={searchCatsByCity[0]?.searches || 1} color={COLORS.amber} />
              ))}
            </Section>

            <Section title="🚗 Transfers vs rental cars (30d)" icon={Activity} empty={rideDemand.length === 0 ? 'Fills as users tap ride options — airport transfer vs rental car vs rideshare, by city.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Which transport people want, where — steers Get-a-Ride partner priority.</div>
              {rideDemand.map((d, i) => (
                <BarRow key={i} label={`${d.ride_type || '?'}${d.city ? ' · ' + d.city : ''}`} count={d.taps} max={rideDemand[0]?.taps || 1} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🕳️ Searches with NO results (30d)" icon={Search} empty={zeroByCity.length === 0 ? 'Fills as searches come back empty — demand we can\'t serve yet = where to expand.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>The highest-value gap list — unmet demand, per city.</div>
              {zeroByCity.map((d, i) => (
                <BarRow key={i} label={`"${d.query}" · ${d.city || '—'} · ${d.category || ''}`} count={d.misses} max={zeroByCity[0]?.misses || 1} color={COLORS.red} />
              ))}
            </Section>

            {/* ── Smart-Search spine — the unified Home search's demand signals ── */}
            <Section title="🔎 Smart-Search — how people scope (30d)" icon={Search} empty={smartByScope.length === 0 ? 'Fills as users search from the Home spine — near me vs at their stay vs a named place.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>How travelers frame intent on the unified search.</div>
              {smartByScope.map((d, i) => (
                <BarRow key={i} label={d.scope || '(unknown)'} count={d.searches} max={smartByScope[0]?.searches || 1} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🔎 Smart-Search — worlds opened (30d)" icon={Search} empty={smartByCat.length === 0 ? 'Fills as spine searches route into finders — eat / coffee / things / hotel / destination.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Which world the spine drives into (AI = times the AI fallback was needed).</div>
              {smartByCat.map((d, i) => (
                <BarRow key={i} label={`${d.category || 'destination'}${d.ai_parsed ? ' · ' + d.ai_parsed + ' AI' : ''}`} count={d.searches} max={smartByCat[0]?.searches || 1} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🌍 Smart-Search — top destinations named (30d)" icon={Search} empty={smartTopPlaces.length === 0 ? 'Fills as users search a specific place from the spine — pure destination demand.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Places people name in search — destination demand for marketing + inventory.</div>
              {smartTopPlaces.map((d, i) => (
                <BarRow key={i} label={d.place || '(unknown)'} count={d.searches} max={smartTopPlaces[0]?.searches || 1} color={COLORS.accent} />
              ))}
            </Section>

            {/* ── Wishlist Demand Radar — where people DREAM to go (highest-signal, first-party) ── */}
            <Section title="❤️ Wishlist — top destinations (30d)" icon={Search} empty={wishByCity.length === 0 ? 'Fills as users ❤️ places — the highest-signal demand data (where they want to go).' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Where people want to go — first-party demand for retargeting + affiliate.</div>
              {wishByCity.map((d, i) => (
                <BarRow key={i} label={`${d.city || '(unknown)'}${d.country ? ', ' + d.country : ''}`} count={d.wishes} max={wishByCity[0]?.wishes || 1} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="❤️ Most-wishlisted places (30d)" icon={Sparkles} empty={wishTop.length === 0 ? 'Fills as users ❤️ specific places / tours / events.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Specific saved items — your affiliate + Demand-Radar targets.</div>
              {wishTop.map((d, i) => (
                <BarRow key={i} label={`${d.title || '(unknown)'}${d.city ? ' · ' + d.city : ''}`} count={d.wishes} max={wishTop[0]?.wishes || 1} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="❤️ Wishlist by type (30d)" icon={Activity} empty={wishByKind.length === 0 ? 'Fills as users wishlist across types (attraction / event / city / …).' : null}>
              {wishByKind.map((d, i) => (
                <BarRow key={i} label={d.kind || '(unknown)'} count={d.wishes} max={wishByKind[0]?.wishes || 1} color={COLORS.green} />
              ))}
            </Section>

            <Section title="➡️ Wishlist → Book taps (30d)" icon={Search} empty={wishCta.length === 0 ? 'Fills as users tap Find tours / Find hotels from the wishlist — the money step.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Which saved items convert to a booking CTA — wishlist→affiliate.</div>
              {wishCta.map((d, i) => (
                <BarRow key={i} label={`${d.action || '?'} · ${d.kind || ''}${d.city ? ' · ' + d.city : ''}`} count={d.taps} max={wishCta[0]?.taps || 1} color={COLORS.accent} />
              ))}
            </Section>

            {/* ── Highest-intent action + who's traveling ── */}
            <Section title="🧭 Directions taps — going here now (30d)" icon={Activity} empty={dirByPlace.length === 0 ? 'Fills as users tap Directions — the strongest "actually going there" signal, across every finder.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Highest-intent action — foot-traffic + merchant proof.</div>
              {dirByPlace.map((d, i) => (
                <BarRow key={i} label={`${d.place || '(unknown)'}${d.city ? ' · ' + d.city : ''}`} count={d.taps} max={dirByPlace[0]?.taps || 1} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="👥 Who's traveling — persona mix (30d)" icon={Users} empty={personaDist.length === 0 ? 'Fills as users pick a persona (solo / couple / family / friends).' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Party-composition segments (coarse, not identity) — segment-aware curation + targeting.</div>
              {personaDist.map((d, i) => (
                <BarRow key={i} label={d.persona || '(unknown)'} count={d.people} max={personaDist[0]?.people || 1} color={COLORS.green} />
              ))}
            </Section>

            {/* ── THE MONEY FUNNEL — sessions → engaged → clicked → booked ── */}
            <Section title="💸 Affiliate funnel (30d)" icon={Activity} empty={!funnel.sessions ? 'Fills as sessions engage → click → book. "Booked" lights up once the conversion import lands.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Distinct sessions at each stage — the money funnel. Booked = 0 until offline conversion import.</div>
              <BarRow label="Sessions" count={funnel.sessions || 0} max={funnel.sessions || 1} color={COLORS.accent} />
              <BarRow label="Engaged (tapped something)" count={funnel.engaged_sessions || 0} max={funnel.sessions || 1} color={COLORS.accent} />
              <BarRow label="Clicked affiliate" count={funnel.click_sessions || 0} max={funnel.sessions || 1} color={COLORS.green} />
              <BarRow label="Booked" count={funnel.booked_sessions || 0} max={funnel.sessions || 1} color={COLORS.green} />
            </Section>

            <Section title="💸 Booking intent — planning vs present (30d)" icon={Search} empty={affByIntent.length === 0 ? 'Fills as affiliate clicks accrue (planning = dreaming ahead, present = there now).' : null}>
              {affByIntent.map((d, i) => (
                <BarRow key={i} label={`${d.intent}${d.conversions ? ` · ${d.conversions} booked` : ''}`} count={d.clicks} max={affByIntent[0]?.clicks || 1} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🚗 Escapes / day trips people pick (30d)" icon={Sparkles} empty={discEscapes.length === 0 ? 'Fills as users tap escapes — day-trip + tour affiliate demand.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>Which day trips people want from each base — tour/experience affiliate targets.</div>
              {discEscapes.map((d, i) => (
                <BarRow key={i} label={`${d.trip || '(unknown)'}${d.base ? ' · from ' + d.base : ''}`} count={d.taps} max={maxDiscEscape} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="💸 Affiliate performance (30d)" icon={Sparkles} empty={affByPartner.length === 0 ? 'No affiliate clicks yet — taps on Book a Ride / Book a tour appear here once affiliate_clicks is created + the worker deployed.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                <strong style={{ color: COLORS.dark }}>{affTotalClicks}</strong> clicks · <strong style={{ color: COLORS.dark }}>{affTotalConversions}</strong> conversions · <strong style={{ color: COLORS.green }}>${affTotalCommission.toFixed(2)}</strong> commission (conversions fill in once we import each network's report)
              </div>
              {affByPartner.map((r, i) => (
                <BarRow key={i} label={`${r.partner} · ${r.conversions || 0} conv · $${(r.commission || 0).toFixed(2)}`} count={r.clicks} max={Math.max(...affByPartner.map(x => x.clicks || 0), 1)} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🎟️ Top affiliate taps (30d)" icon={Sparkles} empty={affTopProducts.length === 0 ? 'No product taps yet.' : null}>
              {affTopProducts.map((p, i) => (
                <BarRow key={i} label={`${p.name}${p.partner ? ' · ' + p.partner : ''}`} count={p.clicks} max={Math.max(...affTopProducts.map(x => x.clicks || 0), 1)} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🌍 Affiliate taps by destination (30d)" icon={Search} empty={affByCountry.length === 0 ? 'No destination data yet.' : null}>
              {affByCountry.map((c, i) => (
                <BarRow key={i} label={c.country} count={c.clicks} max={Math.max(...affByCountry.map(x => x.clicks || 0), 1)} color={COLORS.accent} />
              ))}
            </Section>

            {/* 🛂 PASSPORT STAMPS */}
            <Section title="🛂 Passport — totals" icon={Sparkles}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: COLORS.dark }}>
                <div><b style={{ fontSize: 20 }}>{ppTotals.total_stamps || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>Total stamps</div></div>
                <div><b style={{ fontSize: 20 }}>{ppTotals.countries || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>Countries</div></div>
                <div><b style={{ fontSize: 20 }}>{ppTotals.attraction_stamps || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>Attractions</div></div>
                <div><b style={{ fontSize: 20 }}>{ppTotals.city_stamps || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>Cities</div></div>
                <div><b style={{ fontSize: 20 }}>{ppTotals.airport_stamps || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>✈️ Airports</div></div>
                <div><b style={{ fontSize: 20 }}>{ppTotals.country_stamps || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>Country stamps</div></div>
              </div>
            </Section>

            <Section title="🛂 Passport — stamped vs shared, per month" icon={Activity} empty={ppShareMonths.length === 0 ? 'Nothing yet — fills as travelers stamp and share passport pages.' : null}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560, fontSize: 12.5, color: COLORS.dark, fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr>
                      {['Month', 'Stamps', 'Previews', 'Shared', 'Cancelled', 'By platform — story · post · message'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: COLORS.gray, fontWeight: 600, fontSize: 11, borderBottom: '1px solid #eee' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ppShareMonths.map((m) => (
                      <tr key={m.month} style={{ borderBottom: '1px solid #f3f3f3' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.month}</td>
                        <td style={{ padding: '6px 8px' }}>{m.stamps}</td>
                        <td style={{ padding: '6px 8px' }}>{m.previews}</td>
                        <td style={{ padding: '6px 8px' }}>{m.shared}</td>
                        <td style={{ padding: '6px 8px' }}>{m.cancelled}</td>
                        <td style={{ padding: '6px 8px' }}>
                          {m.platforms.length === 0 ? '—' : m.platforms.map((p) => (
                            <span key={p.platform} style={{ display: 'inline-block', marginRight: 12, whiteSpace: 'nowrap' }}>
                              <b>{PLATFORM_LABEL[p.platform] || p.platform}</b> {p.story} · {p.post} · {p.message}{p.other ? ` (+${p.other})` : ''}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: COLORS.gray, marginTop: 8, lineHeight: 1.4 }}>
                Platform is the app iPhone reports from the share sheet (store build with the share plugin). Android and browser shares can’t say where they went and show as Unknown. WhatsApp, Messages, Messenger and Mail count as messages; Instagram and Facebook use the size picked in the preview.
              </p>
            </Section>

            <Section title="🛂 Stamps by country (all-time)" icon={Search} empty={ppByCountry.length === 0 ? 'No country stamps yet.' : null}>
              {ppByCountry.map((c, i) => (
                <BarRow key={i} label={c.country} count={c.stamps} max={Math.max(...ppByCountry.map(x => x.stamps || 0), 1)} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🛬 Stamps by city / arrival point (all-time)" icon={Search} empty={ppByCity.length === 0 ? 'No city stamps yet.' : null}>
              {ppByCity.map((c, i) => (
                <BarRow key={i} label={`${c.city}${c.country ? ' · ' + c.country : ''}`} count={c.stamps} max={Math.max(...ppByCity.map(x => x.stamps || 0), 1)} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="📍 Stamps by attraction (all-time)" icon={Sparkles} empty={ppByAttraction.length === 0 ? 'No attraction stamps yet.' : null}>
              {ppByAttraction.map((a, i) => (
                <BarRow key={i} label={`${a.name}${a.city ? ' · ' + a.city : ''}`} count={a.stamps} max={Math.max(...ppByAttraction.map(x => x.stamps || 0), 1)} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="✈️ vs 📍 — stamps per day (30d)" icon={Activity} empty={ppByDayKind.length === 0 ? 'No stamps in the last 30 days.' : null}>
              {ppByDayKind.map((d, i) => (
                <BarRow key={i} label={`${d.day} · ✈️${d.airport || 0} 📍${d.attraction || 0}`} count={d.total} max={Math.max(...ppByDayKind.map(x => x.total || 0), 1)} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="✈️ vs 📍 — stamps per week (12w)" icon={Activity} empty={ppByWeekKind.length === 0 ? 'No stamps in the last 12 weeks.' : null}>
              {ppByWeekKind.map((d, i) => (
                <BarRow key={i} label={`${d.week} · ✈️${d.airport || 0} 📍${d.attraction || 0}`} count={d.total} max={Math.max(...ppByWeekKind.map(x => x.total || 0), 1)} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="✈️ vs 📍 — stamps per month (12m)" icon={Activity} empty={ppByMonthKind.length === 0 ? 'No stamps in the last year.' : null}>
              {ppByMonthKind.map((d, i) => (
                <BarRow key={i} label={`${d.month} · ✈️${d.airport || 0} 📍${d.attraction || 0}`} count={d.total} max={Math.max(...ppByMonthKind.map(x => x.total || 0), 1)} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="✈️ Top airports stamped (all-time)" icon={Search} empty={ppTopAirports.length === 0 ? 'No airport stamps yet.' : null}>
              {ppTopAirports.map((a, i) => (
                <BarRow key={i} label={`${a.name}${a.iata ? ' · ' + a.iata : ''}${a.country ? ' · ' + a.country : ''}`} count={a.stamps} max={Math.max(...ppTopAirports.map(x => x.stamps || 0), 1)} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🛂 Stamps per day (30d)" icon={Activity} empty={ppByDay.length === 0 ? 'No stamps in the last 30 days.' : null}>
              {ppByDay.map((d, i) => (
                <BarRow key={i} label={d.day} count={d.stamps} max={Math.max(...ppByDay.map(x => x.stamps || 0), 1)} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🛂 Stamps per month (12m)" icon={Activity} empty={ppByMonth.length === 0 ? 'No stamps in the last year.' : null}>
              {ppByMonth.map((d, i) => (
                <BarRow key={i} label={d.month} count={d.stamps} max={Math.max(...ppByMonth.map(x => x.stamps || 0), 1)} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🛂 Stamps per year" icon={Activity} empty={ppByYear.length === 0 ? 'No stamps yet.' : null}>
              {ppByYear.map((d, i) => (
                <BarRow key={i} label={d.year} count={d.stamps} max={Math.max(...ppByYear.map(x => x.stamps || 0), 1)} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🌍 Countries stamped" icon={Sparkles}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: COLORS.dark }}>
                <div><b style={{ fontSize: 20 }}>{ppCountriesPeriods.today || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>Today</div></div>
                <div><b style={{ fontSize: 20 }}>{ppCountriesPeriods.week || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>This week</div></div>
                <div><b style={{ fontSize: 20 }}>{ppCountriesPeriods.month || 0}</b><div style={{ color: COLORS.gray, fontSize: 11 }}>This month</div></div>
              </div>
            </Section>

            <Section title="🌍 Countries stamped per month (12m)" icon={Activity} empty={ppCountriesByMonth.length === 0 ? 'No stamps in the last year.' : null}>
              {ppCountriesByMonth.map((d, i) => (
                <BarRow key={i} label={`${d.month} · ${d.stamps} stamps`} count={d.countries} max={Math.max(...ppCountriesByMonth.map(x => x.countries || 0), 1)} color={COLORS.accent} />
              ))}
            </Section>

            <Section title="🕐 Stamps by hour of day (✈️ airport · 📍 attraction)" icon={Activity} empty={ppByHour.length === 0 ? 'No stamps yet.' : null}>
              {ppByHour.map((d, i) => (
                <BarRow key={i} label={`${String(d.hour).padStart(2, '0')}:00 · ✈️${d.airport || 0} 📍${d.attraction || 0}`} count={d.total} max={Math.max(...ppByHour.map(x => x.total || 0), 1)} color={COLORS.green} />
              ))}
            </Section>

            <Section title="🤖 AI Details opens per day (14d)" icon={Sparkles} empty={aiOpensByDay.length === 0 ? 'No AI Details opens yet — open a restaurant card and tap the AI Details panel.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                Total opens in window: <strong style={{ color: COLORS.dark }}>{totalAIOpens}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                {aiOpensByDay.map(d => {
                  const h = (d.opens / maxAIOpensDay) * 100;
                  return (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div title={`${d.day}: ${d.opens} opens`} style={{ width: '100%', height: `${Math.max(h, 4)}%`, background: '#6D28D9', borderRadius: '3px 3px 0 0' }} />
                      <div style={{ fontSize: 9, color: COLORS.gray }}>{d.day.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="🤖 AI Details per user (top 20 sessions, 7d)" icon={Sparkles} empty={aiOpensPerSession.length === 0 ? 'No per-session data yet.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                Average across {totalUniqueSessions} active session{totalUniqueSessions === 1 ? '' : 's'}: <strong style={{ color: COLORS.dark }}>{avgPerSession}</strong> distinct restaurants opened per user
              </div>
              {aiOpensPerSession.map((s, i) => (
                <BarRow
                  key={s.session_id || i}
                  label={`Session ${(s.session_id || '?').slice(0, 8)}… · ${s.total_opens} total opens`}
                  count={s.distinct_places_opened}
                  max={maxAIPerSession}
                  color="#6D28D9"
                />
              ))}
            </Section>

            {/* COST BREAKDOWN — distinguishes paid (uncached) vs free (cached) opens. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <KpiCard
                icon={DollarSign}
                label="Spend (14d)"
                value={`$${totalSpend}`}
                sublabel={`${totalPaid} paid fetches × $0.025`}
                color={COLORS.red}
              />
              <KpiCard
                icon={Zap}
                label="Cache hit rate (7d)"
                value={`${hitRate}%`}
                sublabel={`saved ~$${totalSavings} via cache`}
                color={COLORS.green}
              />
            </div>

            <Section title="💰 AI Details PAID opens per day (14d)" icon={DollarSign} empty={aiPaidByDay.length === 0 ? 'No paid AI Details fetches yet — every open so far was either cached or before this commit shipped.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                Each red bar = cache miss = $0.025 paid. Total spend in window: <strong style={{ color: COLORS.red }}>${totalSpend}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                {aiPaidByDay.map(d => {
                  const h = (d.paid_fetches / maxAIPaidDay) * 100;
                  return (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div title={`${d.day}: ${d.paid_fetches} paid ($${(d.paid_fetches * 0.025).toFixed(2)})`} style={{ width: '100%', height: `${Math.max(h, 4)}%`, background: COLORS.red, borderRadius: '3px 3px 0 0' }} />
                      <div style={{ fontSize: 9, color: COLORS.gray }}>{d.day.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="✅ AI Details FREE opens per day (14d, cache hits)" icon={Zap} empty={aiFreeByDay.length === 0 ? 'No cached opens yet — cache builds up after the first paid open per place.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                Each green bar = cache hit = $0 cost. Cache savings in window: <strong style={{ color: COLORS.green }}>~${totalSavings}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                {aiFreeByDay.map(d => {
                  const h = (d.free_fetches / maxAIFreeDay) * 100;
                  return (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div title={`${d.day}: ${d.free_fetches} free`} style={{ width: '100%', height: `${Math.max(h, 4)}%`, background: COLORS.green, borderRadius: '3px 3px 0 0' }} />
                      <div style={{ fontSize: 9, color: COLORS.gray }}>{d.day.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="💸 AI Details cost per user (top 20 sessions, 7d)" icon={DollarSign} empty={aiCostPerSession.length === 0 ? 'No fetch data yet.' : null}>
              <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10 }}>
                Sessions ranked by PAID opens — these are the most expensive users for AI Details. Green = saved by cache, red = paid.
              </div>
              {aiCostPerSession.map((s, i) => (
                <div key={s.session_id || i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: COLORS.dark, fontWeight: 500 }}>
                      Session {(s.session_id || '?').slice(0, 8)}…
                    </span>
                    <span style={{ color: COLORS.gray }}>
                      <span style={{ color: COLORS.red, fontWeight: 700 }}>{s.paid_opens} paid</span>
                      {' · '}
                      <span style={{ color: COLORS.green, fontWeight: 700 }}>{s.free_opens} free</span>
                      {' · '}
                      <span style={{ color: COLORS.dark, fontWeight: 700 }}>${(s.paid_opens * 0.025).toFixed(2)}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 2, height: 6, background: COLORS.border, borderRadius: 3, overflow: 'hidden' }}>
                    {(() => {
                      const total = (s.paid_opens || 0) + (s.free_opens || 0);
                      if (total === 0) return null;
                      const paidPct = ((s.paid_opens || 0) / total) * 100;
                      const freePct = ((s.free_opens || 0) / total) * 100;
                      return (
                        <>
                          <div style={{ width: `${paidPct}%`, background: COLORS.red }} />
                          <div style={{ width: `${freePct}%`, background: COLORS.green }} />
                        </>
                      );
                    })()}
                  </div>
                </div>
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
