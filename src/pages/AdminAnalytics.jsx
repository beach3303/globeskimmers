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
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { exportCsv, saveCsvText } from '@/lib/adminExport';
import { callWorker } from '@/lib/callWorker';
import { openPartner } from '@/lib/openPartner';
import { createPageUrl } from '@/utils';
import { ArrowLeft, RefreshCw, Activity, Eye, Search, AlertTriangle, Sparkles, DollarSign, Zap, Users, UserCheck, Mail, MapPin, MapPinPlus, Cake } from 'lucide-react';
import { isAdminEmail } from '@/lib/admins';
import { ageOnDate } from '@/lib/ageGate';
import { adminPlaceSuggestions, REPORT_REASONS, REVIEW_AT } from '@/lib/suggestions';
import { showToast } from '@/components/Toast';
import { PhotoView } from '@/components/home/SuggestPlaceSection';
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

// The whole app's activity, aggregated (founder, 2026-10-05) — the investor
// view: how many activities per day/week/month, which kinds, which places.
// Counts only; no per-user data.
const OV_LABELS = {
  total: 'All activity', stamps_attraction: 'Attraction stamps', stamps_city: 'City stamps',
  stamps_airport: 'Airport stamps', stamps_country: 'Country stamps', stamps_icon: 'Icon stamps',
  stamps_wonder: 'Wonder stamps', guestbook_notes: 'Guestbook notes', doodles: 'Doodles',
  dish_photos_restaurant: 'Dish photos (restaurants)', dish_photos_coffee: 'Dish photos (cafés)',
  dish_photos_store: 'Store finds', owner_messages: 'Owner messages',
};
const xbtn = { borderRadius: 8, padding: '5px 11px', fontSize: 12, fontWeight: 600, border: '1px solid #d8d2c6', background: '#fff', color: '#3A3128', cursor: 'pointer' };
const today = () => new Date().toISOString().slice(0, 10);

function ActivityOverview() {
  const [ov, setOv] = React.useState(null);
  const [gran, setGran] = React.useState('month');
  React.useEffect(() => {
    (async () => {
      const { data, error } = await callWorker('admin/activity-overview', {});
      setOv(error || data?.error ? { error: error || data.error } : data);
    })();
  }, []);
  if (!ov) return <Section title="📈 Activity overview" icon={Activity}><div style={{ color: COLORS.gray, fontSize: 13 }}>Counting…</div></Section>;
  if (ov.error) return <Section title="📈 Activity overview" icon={Activity}><div style={{ color: '#B0472F', fontSize: 13 }}>{ov.error}</div></Section>;
  const rows = ov[gran] || [];
  const shown = gran === 'day' ? rows.slice(-14) : rows.slice(-12);
  const metrics = ['total', ...Object.keys(OV_LABELS).filter((k) => k !== 'total' && shown.some((r) => r[k]))];
  const keyLabel = (k) => (gran === 'month' ? k.slice(2) : k.slice(5));
  const delta = (k) => {
    const m = ov.month;
    if (!m || m.length < 2) return null;
    const cur = m[m.length - 1][k] || 0, prev = m[m.length - 2][k] || 0;
    if (!prev) return null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  };
  const top = (list, title) => (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: COLORS.gray, marginBottom: 4 }}>{title}</div>
      {(list || []).slice(0, 6).map((x) => <div key={x.name} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span><b>{x.n}</b></div>)}
    </div>
  );
  return (
    <Section title="📈 Activity overview — the investor view" icon={Activity}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline', marginBottom: 8, fontSize: 13 }}>
        <span>All-time: <b>{ov.allTime.stamps ?? '—'}</b> stamps · <b>{ov.allTime.guestbook ?? '—'}</b> notes &amp; doodles · <b>{ov.allTime.dish_photos ?? '—'}</b> food photos · <b>{ov.allTime.owner_messages ?? '—'}</b> owner messages</span>
        <span style={{ color: COLORS.gray }}>This month vs last: {delta('total') || '—'} overall{delta('stamps_airport') ? `, airports ${delta('stamps_airport')}` : ''}{delta('dish_photos_restaurant') ? `, food ${delta('dish_photos_restaurant')}` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {['day', 'week', 'month'].map((g) => (
          <button key={g} type="button" onClick={() => setGran(g)} style={{ borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${COLORS.border || '#ddd'}`, background: gran === g ? COLORS.dark : '#fff', color: gran === g ? '#fff' : COLORS.dark }}>{g === 'day' ? 'Days' : g === 'week' ? 'Weeks' : 'Months'}</button>
        ))}
        {ov.truncated && <span style={{ fontSize: 11, color: '#B0472F', alignSelf: 'center' }}>window truncated at 40k rows — numbers are a floor</span>}
        <span style={{ flex: 1 }} />
        <button type="button" style={xbtn} onClick={() => {
          const keys = [...new Set(['total', ...['day', 'week', 'month'].flatMap((g) => (ov[g] || []).flatMap((r) => Object.keys(r))).filter((k) => k !== 'key')])];
          const rows = ['day', 'week', 'month'].flatMap((g) => (ov[g] || []).map((r) => [g, r.key, ...keys.map((k) => r[k] || 0)]));
          exportCsv(`globeskimmers-activity-${today()}.csv`, ['granularity', 'period', ...keys.map((k) => OV_LABELS[k] || k)], rows);
        }}>⬇ Activity CSV</button>
        <button type="button" style={xbtn} onClick={() => {
          const rows = [
            ...(ov.topCountries || []).map((x) => ['country', x.name, x.n]),
            ...(ov.topCities || []).map((x) => ['city', x.name, x.n]),
            ...(ov.topPlaces || []).map((x) => ['place', x.name, x.n]),
          ];
          exportCsv(`globeskimmers-activity-by-place-${today()}.csv`, ['level', 'name', 'stamps (12 mo)'], rows);
        }}>⬇ Countries &amp; places CSV</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', fontSize: 12.5, minWidth: 420 }}>
          <thead><tr><th style={{ textAlign: 'left', paddingRight: 12 }}></th>{shown.map((r) => <th key={r.key} style={{ textAlign: 'right', padding: '0 7px', color: COLORS.gray, fontWeight: 600 }}>{keyLabel(r.key)}</th>)}</tr></thead>
          <tbody>
            {metrics.map((k) => (
              <tr key={k} style={k === 'total' ? { fontWeight: 700, borderBottom: `1px solid ${COLORS.border || '#eee'}` } : {}}>
                <td style={{ paddingRight: 12, whiteSpace: 'nowrap', color: k === 'total' ? COLORS.dark : COLORS.gray }}>{OV_LABELS[k] || k}</td>
                {shown.map((r) => <td key={r.key} style={{ textAlign: 'right', padding: '2px 7px' }}>{r[k] || ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 12 }}>
        {top(ov.topCities, 'Top stamped cities · 12 mo')}
        {top(ov.topPlaces, 'Top stamped places · 12 mo')}
        {top(ov.topCountries, 'Top countries · 12 mo')}
      </div>
    </Section>
  );
}

// Virtual items report (founder, 2026-10-05): what travelers pick — laptops,
// tumblers, bottles, buddies — current totals from profile_gear plus the pick
// stream per day / week / month and per city / country, all CSV-exportable.
const GEAR_LABELS = { laptop: 'Laptop', tumbler: 'XL coffee tumbler', 'straw-bottle': 'XXL straw bottle', 'lid-bottle': 'Water bottle' };
function VirtualItemsReport() {
  const [rep, setRep] = React.useState(null);
  const [gran, setGran] = React.useState('month');
  React.useEffect(() => {
    (async () => {
      const { data, error } = await callWorker('admin/gear-report', {});
      setRep(error || data?.error ? { error: error || data.error } : data);
    })();
  }, []);
  if (!rep) return <Section title="🧳 Virtual items" icon={Sparkles}><div style={{ color: COLORS.gray, fontSize: 13 }}>Counting…</div></Section>;
  if (rep.error) return <Section title="🧳 Virtual items" icon={Sparkles}><div style={{ color: '#B0472F', fontSize: 13 }}>{rep.error}</div></Section>;
  const cur = rep.current || {};
  const ev = rep.events || {};
  const fmt = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ') || '—';
  // Weeks are derived from the daily rows (the week's Monday, like the activity table).
  const weekOf = (d) => {
    const x = new Date(d + 'T00:00:00Z');
    if (Number.isNaN(+x)) return '?';
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  };
  const weekly = {};
  for (const r of ev.itemsByDay || []) {
    const k = weekOf(r.k), it = r.item || '?';
    ((weekly[k] ||= {})[it] ||= { n: 0 }).n += r.n;
  }
  const byWeek = Object.entries(weekly).sort().flatMap(([k, items]) => Object.entries(items).map(([item, v]) => ({ k, item, n: v.n })));
  const source = gran === 'day' ? ev.itemsByDay : gran === 'week' ? byWeek : ev.itemsByMonth;
  const periods = [...new Set((source || []).map((r) => r.k))].sort().slice(gran === 'day' ? -14 : -12);
  const cell = {};
  for (const r of source || []) (cell[r.item || '?'] ||= {})[r.k] = r.n;
  const items = Object.keys(cell).sort();
  const topPlace = (list, title) => (
    <div style={{ minWidth: 170 }}>
      <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: COLORS.gray, marginBottom: 4 }}>{title}</div>
      {Object.entries((list || []).reduce((m, r) => { (m[r.k] ||= { n: 0 }).n += r.n; return m; }, {}))
        .sort((a, b) => b[1].n - a[1].n).slice(0, 6)
        .map(([name, v]) => <div key={name} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span><b>{v.n}</b></div>)}
    </div>
  );
  return (
    <Section title="🧳 Virtual items — what travelers pick" icon={Sparkles}>
      <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
        <div><b>{cur.travelers ?? 0}</b> travelers have set up items · <b>{cur.laptop?.n ?? 0}</b> laptops · <b>{cur.drink?.n ?? 0}</b> drink containers · <b>{cur.buddies?.n ?? 0}</b> travel buddies with <b>{cur.buddies?.travelers ?? 0}</b> travelers</div>
        <div style={{ color: COLORS.gray, fontSize: 12 }}>Drinks: {fmt(cur.drink?.variants)} &nbsp;·&nbsp; Laptop colors: {fmt(cur.laptop?.colors)} &nbsp;·&nbsp; Buddies: {fmt(cur.buddies?.species)}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {['day', 'week', 'month'].map((g) => (
          <button key={g} type="button" onClick={() => setGran(g)} style={{ borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${COLORS.border || '#ddd'}`, background: gran === g ? COLORS.dark : '#fff', color: gran === g ? '#fff' : COLORS.dark }}>{g === 'day' ? 'Days' : g === 'week' ? 'Weeks' : 'Months'}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" style={xbtn} onClick={() => {
          const rows = [['travelers with items', '', cur.travelers ?? 0], ['laptops', '', cur.laptop?.n ?? 0],
            ...Object.entries(cur.laptop?.colors || {}).map(([k, n]) => ['laptop color', k, n]),
            ['drink containers', '', cur.drink?.n ?? 0],
            ...Object.entries(cur.drink?.variants || {}).map(([k, n]) => ['drink', GEAR_LABELS[k] || k, n]),
            ...Object.entries(cur.drink?.colors || {}).map(([k, n]) => ['drink color', k, n]),
            ['travel buddies', '', cur.buddies?.n ?? 0],
            ...Object.entries(cur.buddies?.species || {}).map(([k, n]) => ['buddy species', k, n]),
            ...Object.entries(cur.buddies?.breeds || {}).map(([k, n]) => ['buddy breed', k, n])];
          exportCsv(`globeskimmers-items-current-${today()}.csv`, ['what', 'which', 'count'], rows);
        }}>⬇ Current items CSV</button>
        <button type="button" style={xbtn} onClick={() => {
          const rows = [
            ...(ev.itemsByDay || []).map((r) => ['day', r.k, GEAR_LABELS[r.item] || r.item, r.n, r.travelers ?? '']),
            ...byWeek.map((r) => ['week', r.k, GEAR_LABELS[r.item] || r.item, r.n, '']),
            ...(ev.itemsByMonth || []).map((r) => ['month', r.k, GEAR_LABELS[r.item] || r.item, r.n, r.travelers ?? '']),
          ];
          exportCsv(`globeskimmers-item-picks-${today()}.csv`, ['granularity', 'period', 'item', 'picks', 'travelers'], rows);
        }}>⬇ Picks CSV</button>
        <button type="button" style={xbtn} onClick={() => {
          const rows = [
            ...(ev.itemsByCity || []).map((r) => ['city', r.k, GEAR_LABELS[r.item] || r.item, r.n, r.travelers ?? '']),
            ...(ev.itemsByCountry || []).map((r) => ['country', r.k, GEAR_LABELS[r.item] || r.item, r.n, r.travelers ?? '']),
            ...(ev.buddiesByCity || []).map((r) => ['city (buddies)', r.k, r.species, r.n, '']),
          ];
          exportCsv(`globeskimmers-item-picks-by-place-${today()}.csv`, ['level', 'name', 'item', 'picks', 'travelers'], rows);
        }}>⬇ By city &amp; country CSV</button>
        <button type="button" style={xbtn} onClick={() => {
          const rows = [
            ...(ev.buddiesByDay || []).map((r) => ['day', r.k, r.species, r.n]),
            ...(ev.buddiesByMonth || []).map((r) => ['month', r.k, r.species, r.n]),
            ...(ev.buddiesBySpecies || []).map((r) => ['breed', r.k, r.breed, r.n]),
          ];
          exportCsv(`globeskimmers-buddies-${today()}.csv`, ['slice', 'period or species', 'detail', 'count'], rows);
        }}>⬇ Buddies CSV</button>
      </div>
      {items.length === 0 ? (
        <div style={{ color: COLORS.gray, fontSize: 12.5 }}>No picks logged yet — the stream starts with the next app update.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', fontSize: 12.5, minWidth: 420 }}>
            <thead><tr><th style={{ textAlign: 'left', paddingRight: 12 }}></th>{periods.map((p) => <th key={p} style={{ textAlign: 'right', padding: '0 7px', color: COLORS.gray, fontWeight: 600 }}>{gran === 'month' ? p.slice(2) : p.slice(5)}</th>)}</tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it}>
                  <td style={{ paddingRight: 12, whiteSpace: 'nowrap', color: COLORS.gray }}>{GEAR_LABELS[it] || it}</td>
                  {periods.map((p) => <td key={p} style={{ textAlign: 'right', padding: '2px 7px' }}>{cell[it]?.[p] || ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 12 }}>
        {topPlace(ev.itemsByCity, 'Top cities · item picks')}
        {topPlace(ev.itemsByCountry, 'Top countries · item picks')}
      </div>
    </Section>
  );
}

// One traveler's activity record, pulled on demand (founder, 2026-10-05) —
// for legal requests and audits only. Computed when asked; nothing is stored.
// The record and its spreadsheet are shared with the Newest members rows.
function travelerCsv(res) {
  const vi = res.virtual_items;
  const viRows = vi ? [
    ...(vi.laptop ? [['', 'virtual item', 'laptop', `${vi.laptop.color} · ${vi.laptop.stickers} stickers`]] : []),
    ...(vi.drink ? [['', 'virtual item', vi.drink.variant, `${vi.drink.color} · ${vi.drink.stickers} stickers`]] : []),
    ...(vi.buddies || []).map((bd) => ['', 'travel buddy', `${bd.species}/${bd.breed}`, bd.coat || '']),
  ] : [];
  exportCsv(`globeskimmers-traveler-${(res.handle || res.user_id).replace(/[^a-z0-9_-]/gi, '')}-${today()}.csv`,
    ['date', 'activity', 'place', 'detail'], [...(res.timeline || []).map((t) => [t.date, t.type, t.name, t.detail]), ...viRows]);
}

function TravelerPull() {
  const [q, setQ] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState(null);
  const pull = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    const { data, error } = await callWorker('admin/user-activity', { q: q.trim() });
    setBusy(false);
    setRes(error || data?.error ? { error: error || data.error } : data);
  };
  return (
    <Section title="🔎 Traveler activity — audit pull" icon={Eye}>
      <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 8 }}>On-demand only (legal requests, audits). Handle or user id; nothing is saved from this view.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="@handle or user id" aria-label="Handle or user id"
          style={{ flex: 1, border: `1px solid ${COLORS.border || '#ddd'}`, borderRadius: 8, padding: '8px 10px', fontSize: 13 }} />
        <button type="button" onClick={pull} disabled={busy || !q.trim()} style={{ borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, background: COLORS.dark, color: '#fff', border: 'none', opacity: busy ? 0.6 : 1 }}>{busy ? 'Pulling…' : 'Pull'}</button>
        {res && !res.error && (
          <button type="button" style={xbtn} onClick={() => travelerCsv(res)}>⬇ CSV</button>
        )}
      </div>
      {res?.error && <div style={{ color: '#B0472F', fontSize: 13, marginTop: 8 }}>{res.error}</div>}
      {res && !res.error && <TravelerRecord res={res} title={res.handle ? `@${res.handle}` : res.user_id} />}
    </Section>
  );
}

// The per-year counts, virtual items and airport sequence of one pulled record.
function TravelerRecord({ res, title, style }) {
  const years = [...new Set(Object.values(res.byYear).flatMap((o) => Object.keys(o)))].sort();
  return (
    <div style={{ marginTop: 10, fontSize: 13, color: COLORS.dark, ...style }}>
      {title && <div style={{ fontWeight: 700 }}>{title}</div>}
      <table style={{ marginTop: 6, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead><tr><th style={{ textAlign: 'left', paddingRight: 14 }}></th>{years.map((y) => <th key={y} style={{ textAlign: 'right', paddingRight: 14 }}>{y}</th>)}<th style={{ textAlign: 'right' }}>All</th></tr></thead>
        <tbody>
          {[['Stamps', 'stamps'], ['Guestbook notes', 'guestbook_notes'], ['Dish photos', 'dish_photos'], ['Owner messages', 'owner_messages']].map(([label, k]) => (
            <tr key={k}><td style={{ paddingRight: 14, color: COLORS.gray }}>{label}</td>{years.map((y) => <td key={y} style={{ textAlign: 'right', paddingRight: 14 }}>{res.byYear[k]?.[y] || 0}</td>)}<td style={{ textAlign: 'right', fontWeight: 700 }}>{res.totals[k === 'stamps' ? 'stamps' : k]}</td></tr>
          ))}
        </tbody>
      </table>
      {res.virtual_items && (
        <div style={{ marginTop: 8, fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: COLORS.gray }}>Virtual items</div>
          {res.virtual_items.laptop && <span>💻 {res.virtual_items.laptop.color} laptop ({res.virtual_items.laptop.stickers} stickers) &nbsp;</span>}
          {res.virtual_items.drink && <span>🥤 {res.virtual_items.drink.color} {res.virtual_items.drink.variant} ({res.virtual_items.drink.stickers} stickers) &nbsp;</span>}
          {(res.virtual_items.buddies || []).length > 0 && <span>🐾 {res.virtual_items.buddies.map((bd) => `${bd.breed || bd.species}${bd.coat ? ` (${bd.coat})` : ''}`).join(', ')}</span>}
        </div>
      )}
      {res.airport_sequence?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: COLORS.gray }}>Airport sequence</div>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, lineHeight: 1.7 }}>
            {res.airport_sequence.map((a, i) => <span key={i}>{a.date} {a.iata}{a.direction ? (a.direction === 'departure' ? ' ⬈ out' : ' ⬊ in') : ''}{a.verified === 'gps' ? ' ✓' : ''}{i < res.airport_sequence.length - 1 ? '  →  ' : ''}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// Newest members (founder, 2026-10-13). The team's alerts carry a member
// number, never a name (privacy policy §2): this card is where the number
// becomes a person. An alert's tap opens this page at ?member=<n>, and that
// member's row is highlighted and scrolled to; a member older than the newest
// 50 is fetched by number and shown first. Their activity opens only when the
// row itself is tapped: it is the audit pull's record (private stamps
// included), for support, safety or legal requests, never on a routine alert.
// The worker numbers members in sign-up order (#1 first), never gives a
// number to anyone else, and sends no emails here.
const MEMBER_PROVIDER = { apple: 'Apple', google: 'Google', email: 'Email', facebook: 'Facebook' };
const MEMBERS_FIRST = 10;   // rows shown before "Show all"
const memberProvider = (p) => {
  const k = String(p || '').trim();
  return MEMBER_PROVIDER[k.toLowerCase()] || (k && k[0].toUpperCase() + k.slice(1));
};
// "Oct 13, 9:41 AM" in the phone's own time; the year only when it isn't this one.
const memberJoined = (iso) => {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' };
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', ...year, hour: 'numeric', minute: '2-digit' });
};
function NewestMembers({ focus, refreshKey }) {
  // A failed load keeps the rows that were there and says so. older = the
  // alert's member when they aren't among the newest; numbered = false when
  // the worker can't give numbers right now.
  const [st, setSt] = React.useState({ members: [], older: null, numbered: true, error: null, loaded: false });
  const [showAll, setShowAll] = React.useState(false);
  const [open, setOpen] = React.useState(null);          // { id, busy } | { id, res }: the row showing its activity
  const [scrollTo, setScrollTo] = React.useState(null);  // a row to bring into view once it's on screen
  const pullSeq = React.useRef(0);
  const rowEls = React.useRef({});
  const picked = React.useRef(null);                     // the ?member= already picked out
  const pull = async (m) => {
    const my = ++pullSeq.current;
    setOpen({ id: m.user_id, busy: true });
    const { data, error } = await callWorker('admin/user-activity', { q: m.user_id });
    if (my !== pullSeq.current) return; // another row was tapped, or this one was closed
    const err = error || data?.error || (data ? null : 'No record came back');
    setOpen({ id: m.user_id, res: err ? { error: err } : data });
  };
  const toggle = (m) => {
    if (open?.id === m.user_id) { pullSeq.current += 1; setOpen(null); return; }
    pull(m);
  };
  // Loads on open, on the page's Refresh, and when an alert brings a new
  // ?member= while the page is already open (that member may be newer than
  // the rows on screen). The worker is asked for that member by number, so
  // one older than the newest 50 comes back too. Each ?member= is picked out
  // once — a Refresh doesn't scroll back to it.
  React.useEffect(() => {
    let live = true;
    (async () => {
      const { data, error } = await callWorker('admin/members', focus != null ? { n: focus } : {});
      if (!live) return;
      const err = error || data?.error || null;
      if (err) { setSt((s) => ({ ...s, error: err, loaded: true })); return; }
      const members = Array.isArray(data?.members) ? data.members : [];
      const older = data?.focus?.user_id && !members.some((m) => m.user_id === data.focus.user_id) ? data.focus : null;
      setSt({ members, older, numbered: data?.numbered !== false, error: null, loaded: true });
      if (focus == null || picked.current === focus) return;
      picked.current = focus;
      const i = members.findIndex((m) => Number(m.n) === focus);
      if (i >= MEMBERS_FIRST) setShowAll(true);
      const target = i >= 0 ? members[i] : older && Number(older.n) === focus ? older : null;
      if (target) setScrollTo(target.user_id);
    })();
    return () => { live = false; };
  }, [focus, refreshKey]);
  React.useEffect(() => {
    const el = scrollTo && rowEls.current[scrollTo];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollTo(null);
  }, [scrollTo, showAll, st.members, st.older]);
  const shown = showAll ? st.members : st.members.slice(0, MEMBERS_FIRST);
  const found = st.members.some((m) => Number(m.n) === focus) || Number(st.older?.n) === focus;
  const missing = focus != null && st.loaded && !st.error && st.members.length > 0 && !found;
  const row = (m, note) => {
    const hit = focus != null && Number(m.n) === focus;
    const isOpen = open?.id === m.user_id;
    const joined = memberJoined(m.joined);
    const more = [m.handle ? `@${String(m.handle).replace(/^@/, '')}` : null, memberProvider(m.provider), m.country, joined && `joined ${joined}`].filter(Boolean);
    return (
      <div key={m.user_id} ref={(el) => { rowEls.current[m.user_id] = el; }}
        style={{ margin: '0 -8px', padding: '0 8px', borderTop: `1px solid ${COLORS.border}`, background: hit ? `${COLORS.accent}15` : 'transparent', boxShadow: hit ? `inset 3px 0 0 ${COLORS.accent}` : 'none' }}>
        {note && <div style={{ paddingTop: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: COLORS.accent }}>{note}</div>}
        <button type="button" onClick={() => toggle(m)} aria-expanded={isOpen}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: note ? '4px 0 10px' : '10px 0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.45, color: COLORS.gray }}>
          <span style={{ fontWeight: 700, color: COLORS.dark }}>{m.n != null ? `#${m.n} · ` : ''}{m.name || 'No name yet'}</span>
          {more.map((x) => ` · ${x}`).join('')}
        </button>
        {isOpen && (
          <div style={{ paddingBottom: 12 }}>
            {open.busy && <div style={{ fontSize: 12.5, color: COLORS.gray }}>Pulling…</div>}
            {open.res?.error && <div style={{ fontSize: 12.5, color: COLORS.red }}>{open.res.error}</div>}
            {open.res && !open.res.error && (
              <>
                <TravelerRecord res={open.res} style={{ marginTop: 0 }} />
                <button type="button" style={{ ...xbtn, marginTop: 8 }} onClick={() => travelerCsv(open.res)}>⬇ CSV</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };
  return (
    <Section title="🆕 Newest members" icon={Users}>
      <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 8 }}>Your alerts show a member number, never a name. Here&rsquo;s who each number is. Tap a row to pull their activity, for support, safety or legal requests only.</div>
      {st.error && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>Couldn&rsquo;t load members: {st.error}</div>}
      {st.loaded && !st.error && !st.numbered && <div style={{ fontSize: 12, color: COLORS.amber, marginBottom: 8 }}>Member numbers aren&rsquo;t available right now. Tap Refresh to try again.</div>}
      {missing && st.numbered && <div style={{ fontSize: 12, color: COLORS.amber, marginBottom: 8 }}>No account has member #{focus} now. It may have been deleted.</div>}
      {!st.loaded && <div style={{ fontSize: 13, color: COLORS.gray, padding: '12px 0' }}>Loading…</div>}
      {st.loaded && !st.error && st.members.length === 0 && <div style={{ fontSize: 13, color: COLORS.gray, padding: '12px 0' }}>No members yet.</div>}
      {st.older && row(st.older, `From your alert · not among the newest ${st.members.length}`)}
      {shown.map((m) => row(m))}
      {st.members.length > MEMBERS_FIRST && (
        <button type="button" onClick={() => setShowAll((v) => !v)}
          style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: COLORS.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          {showAll ? `Show the newest ${MEMBERS_FIRST}` : `Show all ${st.members.length}`}
        </button>
      )}
    </Section>
  );
}

// Age appeal (go-live decision 8, 2026-10-13). A birthday under 13 freezes an
// account, and the daily clean-up deletes its content after 7 days. An adult
// who mistyped writes to founder@ from the frozen screen; that mail carries
// the account id. Paste it here with the corrected birthday: the worker
// (/admin/age-appeal, admin only) recomputes the tier from it and lifts the
// freeze. It restores access only: anything already deleted stays deleted.
// A birthday that is still under 13 is refused here, before anything is sent.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const APPEAL_TIER = {
  adult: 'Access restored · adult',
  teen: 'Access restored · teen hold: travel tools and a private passport, no social until 18',
  blocked: 'Still under 13 · the account stays frozen',
  confirm: 'Saved · the app will ask for the month and day',
};
const longDate = (y, md) => new Date(Date.UTC(y, Number(md.slice(0, 2)) - 1, Number(md.slice(3, 5)))).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
function AgeAppealDesk() {
  const [idText, setIdText] = React.useState('');
  const [dob, setDob] = React.useState('');          // 'YYYY-MM-DD' from the date field
  const [asking, setAsking] = React.useState(false); // the confirm step is showing
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState(null);        // { tier, id } | { error }
  const id = (UUID_RE.exec(idText) || [''])[0].toLowerCase(); // a pasted "Account ID: …" line works too
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const year = parts ? Number(parts[1]) : null;
  const md = parts ? `${parts[2]}-${parts[3]}` : null;
  const age = parts ? ageOnDate(year, md) : null;
  const tooYoung = age != null && age < 13;
  const ready = !!id && age != null && !tooYoung && !busy;
  const edit = (fn) => (e) => { fn(e.target.value); setAsking(false); setRes(null); };
  const send = async () => {
    if (!ready) return;
    setBusy(true); setRes(null);
    const { data, error } = await callWorker('admin/age-appeal', { user_id: id, birth_year: year, birth_md: md });
    setBusy(false); setAsking(false);
    const err = error || data?.error || (data?.ok ? null : 'No answer came back');
    if (err) { setRes({ error: err }); return; }
    setRes({ tier: data.tier || null, id });
    setIdText(''); setDob('');
  };
  const field = { minHeight: 44, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', color: COLORS.dark, background: '#fff' };
  const primary = { minHeight: 44, borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, background: COLORS.dark, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <Section title="🎂 Age appeal" icon={Cake}>
      <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 10, lineHeight: 1.5 }}>
        For an adult who mistyped a birthday under 13 and wrote in from the frozen screen. Paste the account ID from their mail and the corrected birthday.
        This lifts the freeze and restores access only: anything the 7-day clean-up already deleted stays deleted.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input value={idText} onChange={edit(setIdText)} placeholder="Account ID" aria-label="Account ID from the appeal mail" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          style={{ ...field, flex: '1 1 220px', minWidth: 0, fontFamily: 'ui-monospace, Menlo, monospace' }} />
        <input type="date" value={dob} onChange={edit(setDob)} aria-label="Corrected birthday" min="1900-01-01" max={today()}
          style={{ ...field, flex: '0 1 170px' }} />
        {!asking && (
          <button type="button" onClick={() => setAsking(true)} disabled={!ready} style={{ ...primary, opacity: ready ? 1 : 0.5, cursor: ready ? 'pointer' : 'default' }}>Review</button>
        )}
      </div>
      {idText.trim() && !id && <div role="alert" style={{ fontSize: 12, color: COLORS.red, marginTop: 6 }}>That isn&rsquo;t an account ID. It looks like 8-4-4-4-12 letters and digits.</div>}
      {tooYoung && <div role="alert" style={{ fontSize: 12, color: COLORS.red, marginTop: 6 }}>That birthday is under 13 too, so an appeal can&rsquo;t restore access. The account stays frozen.</div>}
      {asking && ready && (
        <div role="group" aria-label="Confirm the appeal" style={{ marginTop: 10, padding: 12, borderRadius: 10, background: `${COLORS.accent}0D`, border: `1px solid ${COLORS.accent}33` }}>
          <div style={{ fontSize: 13, color: COLORS.dark, lineHeight: 1.5 }}>
            Restore access for <code style={{ fontSize: 12 }}>{id}</code>, born {longDate(year, md)} (age {age}{age < 18 ? ': teen hold' : ''})?
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={send} disabled={busy} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Restoring…' : 'Yes, restore access'}</button>
            <button type="button" onClick={() => setAsking(false)} disabled={busy} style={{ ...xbtn, minHeight: 44, padding: '8px 14px', fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}
      {res?.error && <div role="alert" style={{ fontSize: 12.5, color: COLORS.red, marginTop: 8 }}>Couldn&rsquo;t send the appeal: {res.error}</div>}
      {res?.tier !== undefined && !res?.error && (
        <div role="status" style={{ fontSize: 12.5, color: res.tier === 'blocked' ? COLORS.red : COLORS.green, marginTop: 8, fontWeight: 600 }}>
          {APPEAL_TIER[res.tier] || `Saved · tier ${res.tier || 'unknown'}`} <span style={{ color: COLORS.gray, fontWeight: 400 }}>({res.id})</span>
        </div>
      )}
    </Section>
  );
}

// "I'm here, but the app is saying I'm not" (founder, 2026-10-10): every tap,
// newest first — the place, how far GPS put the traveler from our pin and the
// allowed distance, GPS accuracy, the spot rounded to about a city block (none
// for minors), phone and app version, an anonymous user code — with a status
// to work the list down (the stamp was granted either way). Under it, the
// quiet refusals per place (30 days, no positions), and an Excel download.
const SR_WHY = { not_here: 'Outside our map for this place', other_variant: 'At another park or rim of this place', proof_needed: 'No GPS reading', unlocatable: 'Place not on our map', unconfirmed: 'GPS not trusted (VPN or travel speed)' };
const SR_TONE = { new: COLORS.amber, fixed: COLORS.green, ignored: COLORS.gray };
function StampReportsDesk({ refreshKey }) {
  const [openOnly, setOpenOnly] = React.useState(true);
  // ok: the numbers on screen came from a successful load (a failed one keeps
  // what was there and says so — never "0 new").
  const [st, setSt] = React.useState({ reports: [], total: 0, open: 0, refusals: [], error: null, loaded: false, ok: false });
  const [csvBusy, setCsvBusy] = React.useState(false);
  const [statusBusy, setStatusBusy] = React.useState(null);
  const [actionError, setActionError] = React.useState(null);   // an export or status change that failed
  const [note, setNote] = React.useState(null);
  const seq = React.useRef(0);
  const openRef = React.useRef(openOnly);
  openRef.current = openOnly;
  const load = async () => {
    const my = ++seq.current;
    const { data, error } = await callWorker('admin/stamp-reports', { op: 'list', open: openRef.current, limit: 200 });
    if (my !== seq.current) return; // a newer load (the other filter, a refresh) owns the screen
    const err = error || data?.error || null;
    if (err) { setSt((s) => ({ ...s, error: err, loaded: true })); return; }
    setSt({ reports: data?.reports || [], total: data?.total || 0, open: data?.open || 0, refusals: data?.refusals_30d || [], error: null, loaded: true, ok: true });
  };
  React.useEffect(() => { load(); }, [openOnly, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Switching the filter clears the list until the new one arrives, so the
  // other filter's rows (or a false "No reports yet") never show under it.
  const showOpen = (v) => {
    if (v === openOnly) return;
    setSt((s) => ({ ...s, reports: [], loaded: false }));
    setOpenOnly(v);
  };
  const setStatus = async (id, status) => {
    setStatusBusy(id); setActionError(null);
    const { data, error } = await callWorker('admin/stamp-reports', { op: 'status', id, status });
    setStatusBusy(null);
    if (error || data?.error) { setActionError(`Couldn’t update that report: ${error || data.error}`); return; }
    load();
  };
  const download = async () => {
    if (csvBusy) return;
    setCsvBusy(true); setNote(null); setActionError(null);
    const { data, error } = await callWorker('admin/stamp-reports', { op: 'csv', as: 'json' }, { timeoutMs: 60000 });
    if (error || !data?.csv) { setCsvBusy(false); setActionError(`Couldn’t export: ${error || data?.error || 'no file came back'}`); return; }
    if (data.truncated) setNote(`The file holds the newest ${data.rows} reports — there are more than that.`);
    try { await saveCsvText(data.filename || `stamp-reports-${today()}.csv`, data.csv); }
    catch (e) { setActionError(`Couldn’t save the file: ${e?.message || e}`); }
    finally { setCsvBusy(false); }
  };
  const when = (iso) => String(iso || '').slice(0, 16).replace('T', ' ');
  const link = { fontSize: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer' };
  const placeTotal = (q) => (q.refusals || 0) + (q.reported || 0);
  const maxQuiet = Math.max(1, ...st.refusals.map(placeTotal));
  return (
    <Section title={`📍 “I’m here, but the app is saying I’m not” — ${st.ok ? st.open : '—'} new`} icon={MapPin}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <button type="button" style={{ ...xbtn, background: openOnly ? COLORS.dark : '#fff', color: openOnly ? '#fff' : '#3A3128' }} onClick={() => showOpen(true)}>New only</button>
        <button type="button" style={{ ...xbtn, background: !openOnly ? COLORS.dark : '#fff', color: !openOnly ? '#fff' : '#3A3128' }} onClick={() => showOpen(false)}>All{st.ok ? ` ${st.total}` : ''}</button>
        <button type="button" style={xbtn} onClick={load} aria-label="Reload the list">↻</button>
        <button type="button" style={{ ...xbtn, marginLeft: 'auto' }} onClick={download} disabled={csvBusy}>{csvBusy ? 'Preparing…' : '⬇ Excel (CSV)'}</button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 8 }}>Every tap is here — the stamp was granted either way. Fix the place&rsquo;s map, then mark it fixed.</div>
      {st.error && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>Couldn&rsquo;t load the latest: {st.error}</div>}
      {actionError && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>{actionError}</div>}
      {note && <div style={{ fontSize: 12, color: COLORS.amber, marginBottom: 8 }}>{note}</div>}
      {!st.loaded && !st.error && <div style={{ fontSize: 13, color: COLORS.gray, padding: '12px 0' }}>Loading…</div>}
      {st.loaded && st.ok && !st.error && st.reports.length === 0 && (
        <div style={{ fontSize: 13, color: COLORS.gray, padding: '12px 0' }}>
          {openOnly && st.total > 0 ? `Nothing new — all ${st.total} handled.` : 'No reports yet. When GPS refuses a stamp and the traveler taps “I’m here, but the app is saying I’m not”, it lands here.'}
        </div>
      )}
      {st.reports.map((r) => (
        <div key={r.id} style={{ padding: '10px 0', borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: COLORS.dark }}>{r.place_name}</span>
            <span style={{ color: COLORS.gray, fontSize: 12 }}>{[r.city, r.country].filter(Boolean).join(', ')}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: SR_TONE[r.status] || COLORS.gray }}>{r.status}</span>
            <span style={{ color: COLORS.gray, marginLeft: 'auto', fontSize: 12 }}>{when(r.created_at)} UTC</span>
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.dark, marginTop: 4 }}>
            {SR_WHY[r.refusal] || r.refusal || 'GPS passed on retry'}
            {r.distance_m != null ? ` · ${r.distance_m} m from our pin` : ''}
            {r.radius_m != null ? ` (allowed ${r.radius_m} m)` : ''}
            {r.accuracy_m != null ? ` · GPS ±${r.accuracy_m} m` : ''}
          </div>
          <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>
            {[r.outcome, [r.platform, r.app_version].filter(Boolean).join(' '), r.user_code ? `user ${r.user_code}` : null, r.entity_id].filter(Boolean).join(' · ')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
            {r.spot_lat != null && r.spot_lng != null && (
              <button type="button" style={{ ...link, color: COLORS.accent }} onClick={() => openPartner(`https://www.google.com/maps/search/?api=1&query=${r.spot_lat},${r.spot_lng}`)}>Spot on the map (≈1 block)</button>
            )}
            {r.status !== 'fixed' && <button type="button" disabled={statusBusy === r.id} style={{ ...link, color: COLORS.green }} onClick={() => setStatus(r.id, 'fixed')}>Fixed</button>}
            {r.status !== 'ignored' && <button type="button" disabled={statusBusy === r.id} style={{ ...link, color: COLORS.gray }} onClick={() => setStatus(r.id, 'ignored')}>Ignore</button>}
            {r.status !== 'new' && <button type="button" disabled={statusBusy === r.id} style={{ ...link, color: COLORS.amber }} onClick={() => setStatus(r.id, 'new')}>Reopen</button>}
          </div>
        </div>
      ))}
      {st.refusals.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: COLORS.gray, marginBottom: 8 }}>Refusals per place · 30 days · no positions kept</div>
          {st.refusals.map((q, i) => (
            <BarRow key={q.entity_id || `${q.name}-${i}`} label={`${q.name || q.entity_id || 'Unknown place'} · ${q.refusals || 0} refused${q.reported ? `, ${q.reported} reported` : ''}`} count={placeTotal(q)} max={maxQuiet} color={COLORS.amber} />
          ))}
        </div>
      )}
    </Section>
  );
}

// Suggest a Place to Stamp (founder decisions 2026-10-10): the review desk.
// Only places with 5 or more suggestions show here, and the count keeps going.
// Approve makes the place a Local favorite stamp — nothing goes live without
// it; Decline takes it off every list. Each card: where (and the map), the
// count, locals vs visitors, likes, the top reasons and the "Other" texts,
// and (2026-10-12) its photos — up to 6, each opens full screen — so nothing
// is approved or kept unseen; an approved place's name opens its page.
// Reported (2026-10-12): places people reported, at any count — three
// reports hide an open place until it's decided here. Remove takes it down
// for everyone; Keep clears the reports and puts a hidden place back.
// Excel export: every place with 5+, whatever its status.
const PSD_TABS = [['ready', 'Ready'], ['approved', 'Approved'], ['declined', 'Declined'], ['reported', 'Reported']];
const PSD_DONE = {
  approved: { text: 'Approved: now a Local favorite stamp', background: '#E8F4F2', color: '#0A5F58' },
  declined: { text: 'Declined', background: '#EFEBE2', color: '#3D4550' },
  removed: { text: 'Removed', background: '#EFEBE2', color: '#3D4550' },
  keep: { text: 'Kept — reports cleared', background: '#E8F4F2', color: '#0A5F58' },
};
const PSD_VERB = { approved: 'approve', declined: 'decline', removed: 'remove', keep: 'keep' };
const PSD_EMPTY = {
  ready: 'Nothing to review. A place shows here once 5 people suggest it.',
  approved: 'No Local favorites yet.',
  declined: 'Nothing declined.',
  reported: 'No reports. A place shows here when someone reports it, whatever its count.',
};
const PSD_NOTE = {
  review: 'Only places with 5 or more suggestions show here. Counts keep going after 5. Approve makes it a Local favorite stamp — nothing goes live without it.',
  reported: 'Places people reported, at any count. Three reports hide an open place until you decide; an approved stamp stays up and is only flagged. Remove takes it off every list; Keep clears the reports.',
};
// Where a reported place stands, when it isn't simply open.
const PSD_STATUS = {
  held: { text: 'Hidden until you decide', background: '#FFF3DC', color: '#8A5A00' },
  approved: { text: 'Approved stamp', background: '#E8F4F2', color: '#0A5F58' },
};
const psdCount = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const psdDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
// "3 reports: Offensive or unkind (2), Spam or advertising (1)" — most first.
const psdReports = (r) => {
  const parts = REPORT_REASONS.map((x) => ({ label: x.label, n: Number(r?.reasons?.[x.key]) || 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  return `${psdCount(r?.n || 0, 'report', 'reports')}${parts.length ? `: ${parts.map((x) => `${x.label} (${x.n})`).join(', ')}` : ''}`;
};
// The tab counts after a decision made here, so they move at once (the next
// load brings the server's own). Ready = open with 5+; Reported = held, or
// open or approved with reports left; a decline leaves Reported, a removal
// leaves everything, and Keep puts a hidden place with 5+ back in Ready.
function psdCountsAfter(c, p, decision) {
  const next = { ...c };
  const move = (k, d) => { next[k] = Math.max(0, (next[k] || 0) + d); };
  const ready = p.status === 'review' || (p.status === 'open' && p.count >= REVIEW_AT);
  const reported = p.status === 'held' || (p.reports?.n || 0) > 0;
  if (decision === 'approved' || decision === 'declined') {
    if (ready) move('ready', -1);
    move(decision, 1);
    if (decision === 'declined' && reported) move('reported', -1);
  } else if (decision === 'removed') {
    if (ready) move('ready', -1);
    if (p.status === 'approved') move('approved', -1);
    if (reported) move('reported', -1);
  } else if (decision === 'keep') {
    if (reported) move('reported', -1);
    if (p.status === 'held' && p.count >= REVIEW_AT) move('ready', 1);
  }
  return next;
}
function PlaceSuggestionsDesk({ refreshKey }) {
  const [tab, setTab] = React.useState('ready');
  // ok: the counts on screen came from a successful load (a failed one keeps
  // what was there and says so — never "0 ready").
  const [st, setSt] = React.useState({ places: [], counts: null, error: null, loaded: false, ok: false });
  const [decided, setDecided] = React.useState({});     // id → the decision made on this screen
  const [busyId, setBusyId] = React.useState(null);
  const [csvBusy, setCsvBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState(null);   // a decision or export that failed
  const [allTexts, setAllTexts] = React.useState({});   // id → every "Other" text shown
  const [photo, setPhoto] = React.useState(null);       // { src, name }: the photo open full screen
  const [broken, setBroken] = React.useState({});       // photo url → it didn't load (tried again on the next load)
  const seq = React.useRef(0);
  const listing = React.useRef(false);   // the newest list request is still on its way
  const tabRef = React.useRef(tab);
  tabRef.current = tab;
  const load = async () => {
    const my = ++seq.current;
    listing.current = true;
    const { data, error } = await adminPlaceSuggestions({ op: 'list', tab: tabRef.current });
    if (my !== seq.current) return; // a newer load (another tab, a refresh) or a decision owns the screen
    listing.current = false;
    if (error) { setSt((s) => ({ ...s, error, loaded: true })); return; }
    setDecided({});
    setBroken({});
    setSt({ places: data?.places || [], counts: data?.counts || null, error: null, loaded: true, ok: true });
  };
  React.useEffect(() => { load(); }, [tab, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Switching tabs clears the list until the new one arrives, so the other
  // tab's places (or a false "Nothing to review") never show under it.
  const showTab = (t) => {
    if (t === tab) return;
    setSt((s) => ({ ...s, places: [], loaded: false }));
    setTab(t);
  };
  const decide = async (p, decision) => {
    if (busyId) return;
    if (decision === 'removed' && !window.confirm('Remove this place for everyone?')) return;
    setBusyId(p.id); setActionError(null);
    const { data, error } = await adminPlaceSuggestions({ op: 'decide', id: p.id, decision });
    setBusyId(null);
    // Approve / Decline on a card that went stale — reports hid the place, or
    // it was decided on another device (2026-10-12): nothing was changed, so
    // the tab loads again to show where it stands (a newer load still wins).
    if (data?.code === 'stale') {
      showToast('This place changed since the list loaded — here’s where it stands now.', 'info');
      load();
      return;
    }
    if (error) { setActionError(`Couldn’t ${PSD_VERB[decision]} ${p.name}: ${error}`); return; }
    // A list asked for before this decision landed would put the card back
    // undecided, and the counts with it: it no longer owns the screen. One
    // still on its way is asked again — the new answer has the decision in it.
    const again = listing.current;
    seq.current += 1;
    listing.current = false;
    // The card keeps its place with the decision on it; the tab counts move now.
    setDecided((d) => ({ ...d, [p.id]: decision }));
    setSt((s) => (s.counts ? { ...s, counts: psdCountsAfter(s.counts, p, decision) } : s));
    if (again) load();
  };
  const download = async () => {
    if (csvBusy) return;
    setCsvBusy(true); setActionError(null);
    const { data, error } = await adminPlaceSuggestions({ op: 'csv', as: 'json' }, { timeoutMs: 60000 });
    if (error || !data?.csv) { setCsvBusy(false); setActionError(`Couldn’t export: ${error || 'no file came back'}`); return; }
    try { await saveCsvText(data.filename || `place-suggestions-${today()}.csv`, data.csv); }
    catch (e) { setActionError(`Couldn’t save the file: ${e?.message || e}`); }
    finally { setCsvBusy(false); }
  };
  const link = { fontSize: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer' };
  const counts = st.ok ? st.counts : null;
  const reportedTab = tab === 'reported';
  const pill = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700 };
  const act = (dim) => ({ flex: 1, minHeight: 42, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: dim ? 0.6 : 1 });
  const thumb = { width: 56, height: 56, flex: 'none', borderRadius: 8, background: '#EFEBE2' };
  return (
    <Section title={`⭐ Place suggestions — ${counts ? counts.ready : '—'} ready${counts?.reported ? ` · ${counts.reported} reported` : ''}`} icon={MapPinPlus}>
      {photo && <PhotoView src={photo.src} alt={`A photo of ${photo.name}`} onClose={() => setPhoto(null)} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        {PSD_TABS.map(([k, label]) => (
          <button key={k} type="button" style={{ ...xbtn, background: tab === k ? COLORS.dark : '#fff', color: tab === k ? '#fff' : '#3A3128' }} onClick={() => showTab(k)}>
            {label} · {counts ? counts[k] || 0 : '—'}
          </button>
        ))}
        <button type="button" style={xbtn} onClick={load} aria-label="Reload the list">↻</button>
        <button type="button" style={{ ...xbtn, marginLeft: 'auto' }} onClick={download} disabled={csvBusy}>{csvBusy ? 'Preparing…' : '⬇ Excel (CSV)'}</button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 8 }}>{reportedTab ? PSD_NOTE.reported : PSD_NOTE.review}</div>
      {st.error && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>Couldn&rsquo;t load the latest: {st.error}</div>}
      {actionError && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>{actionError}</div>}
      {!st.loaded && !st.error && <div style={{ fontSize: 13, color: COLORS.gray, padding: '12px 0' }}>Loading…</div>}
      {st.loaded && st.ok && !st.error && st.places.length === 0 && (
        <div style={{ fontSize: 13, color: COLORS.gray, padding: '12px 0' }}>{PSD_EMPTY[tab]}</div>
      )}
      {st.places.map((p) => {
        // On Reported, an approved place is still waiting on Remove or Keep.
        const done = decided[p.id] || (!reportedTab && (p.status === 'approved' || p.status === 'declined') ? p.status : null);
        const look = done ? PSD_DONE[done] : null;
        const stands = reportedTab && !decided[p.id] ? PSD_STATUS[p.status] : null;
        const where = [p.city, p.region, p.country].filter(Boolean).join(', ');
        const texts = Array.isArray(p.other_texts) ? p.other_texts : [];
        const shown = allTexts[p.id] ? texts : texts.slice(0, 3);
        const busy = busyId === p.id;
        // Where it stands now, a decision made here included (Keep leaves the
        // status as it was): an approved place's name opens its Local
        // favorite page; a removed place's photos were deleted with it.
        const now = decided[p.id] && decided[p.id] !== 'keep' ? decided[p.id] : p.status;
        const photos = now !== 'removed' && Array.isArray(p.photos) ? p.photos.filter(Boolean).slice(0, 6) : [];
        return (
          <div key={p.id} style={{ padding: '12px 0', borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark, overflowWrap: 'anywhere' }}>
                  {now === 'approved' ? (
                    <Link to={`${createPageUrl('LocalFavorite')}?id=${encodeURIComponent(p.id)}`} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>{p.name}</Link>
                  ) : p.name}
                </div>
                <div style={{ fontSize: 12.5, color: COLORS.gray, marginTop: 2 }}>
                  {where || 'No town on record'} · <button type="button" style={{ ...link, fontSize: 12.5, fontWeight: 600, color: COLORS.accent }}
                    onClick={() => openPartner(p.map_url || `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`)}>map</button>
                </div>
              </div>
              <div style={{ flex: 'none', textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.dark, lineHeight: 1.1 }}>{p.count}</div>
                <div style={{ fontSize: 11.5, color: COLORS.gray }}>{p.count === 1 ? 'suggestion' : 'suggestions'}</div>
              </div>
            </div>
            {((p.reports?.n || 0) > 0 || stands) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6 }}>
                {(p.reports?.n || 0) > 0 && <span style={{ fontSize: 12.5, fontWeight: 600, color: '#9A3412', lineHeight: 1.4 }}>{psdReports(p.reports)}</span>}
                {stands && <span style={{ ...pill, background: stands.background, color: stands.color }}>{stands.text}</span>}
              </div>
            )}
            <div style={{ fontSize: 12.5, color: '#3D4550', marginTop: 6 }}>
              {psdCount(p.locals || 0, 'local', 'locals')}, {psdCount(p.visitors || 0, 'visitor', 'visitors')} · {psdCount(p.likes || 0, 'like', 'likes')}
            </div>
            {p.reasons?.length > 0 && (
              <div style={{ fontSize: 12.5, color: '#3D4550', marginTop: 4, lineHeight: 1.4 }}>Top reasons: {p.reasons.map((r) => `${r.short} (${r.n})`).join(', ')}</div>
            )}
            {shown.map((t, i) => (
              <div key={i} style={{ fontSize: 12.5, color: COLORS.gray, fontStyle: 'italic', lineHeight: 1.4, marginTop: 4 }}>&ldquo;{t}&rdquo;</div>
            ))}
            {texts.length > shown.length && (
              <button type="button" style={{ ...link, color: COLORS.accent, marginTop: 4 }} onClick={() => setAllTexts((a) => ({ ...a, [p.id]: true }))}>All {texts.length} in their own words</button>
            )}
            {photos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {photos.map((src, i) => (broken[src] ? (
                  <div key={src} style={{ ...thumb, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, fontSize: 10.5, lineHeight: 1.2, color: COLORS.gray, textAlign: 'center' }}>
                    Couldn&rsquo;t load
                  </div>
                ) : (
                  <button key={src} type="button" onClick={() => setPhoto({ src, name: p.name })} aria-label={`Open photo ${i + 1} of ${photos.length}: ${p.name}`}
                    style={{ ...thumb, padding: 0, border: 'none', overflow: 'hidden', cursor: 'pointer' }}>
                    <img src={src} alt="" loading="lazy" onError={() => setBroken((b) => ({ ...b, [src]: true }))}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                )))}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: COLORS.gray, marginTop: 4 }}>
              First suggested {psdDay(p.created_at)}{p.decided_at ? ` · decided ${psdDay(p.decided_at)}` : ''}
            </div>
            {look ? (
              <div style={{ marginTop: 9, minHeight: 40, borderRadius: 10, background: look.background, color: look.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 600 }}>{look.text}</div>
            ) : reportedTab ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                <button type="button" disabled={busy} onClick={() => decide(p, 'removed')}
                  style={{ ...act(busy), border: '1px solid #E4C3BC', background: '#fff', color: '#B42318' }}>
                  Remove
                </button>
                <button type="button" disabled={busy} onClick={() => decide(p, 'keep')}
                  style={{ ...act(busy), border: '1px solid #d8d2c6', background: '#fff', color: COLORS.dark }}>
                  Keep
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                <button type="button" disabled={busy} onClick={() => decide(p, 'approved')}
                  style={{ flex: 1, minHeight: 42, borderRadius: 10, border: 'none', background: '#0E7C73', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                  Approve as Local favorite
                </button>
                <button type="button" disabled={busy} onClick={() => decide(p, 'declined')}
                  style={{ flex: 'none', minHeight: 42, padding: '0 14px', borderRadius: 10, border: '1px solid #d8d2c6', background: '#fff', color: COLORS.dark, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                  Decline
                </button>
              </div>
            )}
          </div>
        );
      })}
    </Section>
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
  const location = useLocation();
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [userStats, setUserStats] = useState(null); // real Supabase-profiles aggregates
  const [generatedAt, setGeneratedAt] = useState(null);
  // A team alert's tap lands here as ?member=<n> (AuthContext's appUrlOpen).
  const memberParam = new URLSearchParams(location.search).get('member') || '';
  const memberFocus = /^\d{1,9}$/.test(memberParam) && Number(memberParam) > 0 ? Number(memberParam) : null;
  // Bumped by the Refresh button only: Newest members loads on its own when
  // the page opens, and reloads on a refresh — not again when the first
  // analytics load finishes.
  const [refreshTick, setRefreshTick] = useState(0);
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
  // Guestbook review: notes held as negative, and notes hidden by 3 reports.
  const [gbDesk, setGbDesk] = useState({ held: [], reported: [], error: null, busy: null });
  const gbCall = async (body) => {
    setGbDesk((d) => ({ ...d, busy: body.id || 'list' }));
    const { data, error } = await callWorker('admin/guestbook', body);
    setGbDesk((d) => ({ held: data?.held || d.held, reported: data?.reported || d.reported, error: error || data?.error || null, busy: null }));
  };
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
      await loadInbox(); loadReports(); heldCall({ op: 'list' }); sealCall({ op: 'list' }); reqCall({ op: 'list' }); gbCall({ op: 'list' });
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
            onClick={() => { setRefreshTick((t) => t + 1); load(); }}
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
        {/* Who is behind each alert's member number. First on the page and
            not waiting on the analytics, so an alert's tap shows the person
            at once and nothing arriving above it moves the row it scrolls to. */}
        {isAdminEmail(authUser?.email) && <NewestMembers focus={memberFocus} refreshKey={refreshTick} />}
        {/* Time-bound (the 7-day clean-up), so it doesn't wait on the analytics either. */}
        {isAdminEmail(authUser?.email) && <AgeAppealDesk />}

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

            <ActivityOverview />

            <VirtualItemsReport />

            <TravelerPull />

            <StampReportsDesk refreshKey={generatedAt} />

            <PlaceSuggestionsDesk refreshKey={generatedAt} />

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

            <Section title={`📝 Guestbook review — ${gbDesk.held.length + gbDesk.reported.length} waiting`} icon={Mail}
              empty={gbDesk.held.length + gbDesk.reported.length === 0 && !gbDesk.error ? 'Nothing waiting. Kind notes post on their own; notes that read as negative, and notes hidden after 3 reports, land here.' : null}>
              {gbDesk.error && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>{gbDesk.error}</div>}
              {[...gbDesk.held.map((r) => ({ ...r, _why: `Held: ${r.review_reason || 'reads as negative'}` })),
                ...gbDesk.reported.map((r) => ({ ...r, _why: `Hidden after ${r.flag_count} reports${r.report_reasons?.length ? ` — ${r.report_reasons.join(' · ')}` : ''}` }))].map((r) => (
                <div key={r.id} style={{ padding: '10px 0', borderTop: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: COLORS.dark }}>{r.entity_name || r.entity_id}</span>
                    <span style={{ color: COLORS.gray }}>{r.display_name}{r.home_city ? ` · ${r.home_city}` : ''}</span>
                    <span style={{ color: COLORS.gray, marginLeft: 'auto' }}>{String(r.edited_at || r.created_at || '').slice(0, 16).replace('T', ' ')}{r.edited_at ? ' · edited' : ''}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: COLORS.amber, fontWeight: 600, marginTop: 3 }}>{r._why}</div>
                  {r.body && <div style={{ fontSize: 13, color: COLORS.dark, whiteSpace: 'pre-wrap', marginTop: 4 }}>{r.body}</div>}
                  {r.is_doodle && r.photo_url && <img src={r.photo_url} alt="Doodle" style={{ marginTop: 6, maxWidth: 160, borderRadius: 8, border: `1px solid ${COLORS.border}` }} />}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button type="button" disabled={gbDesk.busy === r.id} onClick={() => gbCall({ op: 'approve', id: r.id })} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: COLORS.green, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Publish</button>
                    <button type="button" disabled={gbDesk.busy === r.id} onClick={() => gbCall({ op: 'reject', id: r.id })} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.gray, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Keep private</button>
                    <button type="button" disabled={gbDesk.busy === r.id} onClick={() => { if (window.confirm('Delete this note for good?')) gbCall({ op: 'delete', id: r.id }); }} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <button type="button" style={xbtn} onClick={() => {
                  const signups = new Map((userStats?.signupsByDay || []).map((d) => [d.day, d.count]));
                  const rows = activeByDay.map((d) => [d.day, d.active, signups.get(d.day) ?? '']);
                  rows.push([], ['DAU today', activeUsers.dau ?? ''], ['WAU (7d)', activeUsers.wau ?? ''], ['MAU (30d)', activeUsers.mau ?? ''], ['Return rate 7d %', returnRate], ['Stickiness %', stickiness]);
                  exportCsv(`globeskimmers-active-users-${today()}.csv`, ['day', 'active users', 'sign-ups'], rows);
                }}>⬇ Active users CSV</button>
              </div>
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
