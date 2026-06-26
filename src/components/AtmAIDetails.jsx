/**
 * AtmAIDetails — ATM Finder "🤖 AI DETAILS" panel.
 *
 * FORK of AIDetailsSection.jsx (Phase A2 of the ATM redesign).
 * ATM-only renderer; PlacesToEat / Coffee / Restroom keep using the
 * shared AIDetailsSection.jsx. Forked so the ATM layout (Card
 * Compatibility, Fees, Withdrawal Calculator, Limits, Location, Safety)
 * can evolve without touching the restaurant flow.
 *
 * Phase A2 scope: presentation restructure ONLY.
 *   - Still calls the existing getAIDetails Base44 function with
 *     kind='atm'. Consumes the v7 shared JSON shape today.
 *   - ATM-specific sections (Card Compatibility, Fees, Withdrawal
 *     Limits, Location Context, Safety) render as "call to confirm"
 *     stubs in this phase since the shared prompt doesn't generate
 *     that data yet.
 *   - The Withdrawal Calculator slot is a placeholder anchor — Phase
 *     A4 wires it to live exchange rates + primary_banking_currency.
 *   - Best ATM Nearby ranking (section 8 of the spec) is intentionally
 *     OUT of this component — it belongs on the ATMFinder list view,
 *     scheduled for Phase A5.
 *
 * Honesty rules in render:
 *   - Each fact carries a source-tier stamp.
 *   - "Call to confirm" stamps are interactive: tap opens the venue's
 *     website (when known) in a new tab.
 *   - Sections with no data are silently absent rather than filled with
 *     fluff — per the same handoff honesty principle as the Things-To-Do
 *     redesign.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { logEvent } from '@/lib/analytics';

// Palette — matches AIDetailsSection / AttractionAIDetails so the panel
// reads consistently across the app.
const DARK = '#1A2332';
const GRAY = '#64748B';
const GRAY_DEEP = '#475569';
const PURPLE = '#6D28D9';
const PURPLE_LIGHT = '#DDD6FE';
const PURPLE_BG = '#F5F3FF';
const PURPLE_SHIMMER = '#EDE9FE';
const DIVIDER = '#E5E7EB';

// Shared key with the restaurant + attraction panels so the one-time
// GS-Verdict subtitle explainer is shown to a given user at most once.
const GS_VERDICT_HELPER_KEY = 'gs_verdict_helper_seen';
function readVerdictHelperSeen() {
  try { return localStorage.getItem(GS_VERDICT_HELPER_KEY) === '1'; }
  catch { return true; }
}
function markVerdictHelperSeen() {
  try { localStorage.setItem(GS_VERDICT_HELPER_KEY, '1'); } catch { /* ignore */ }
}

// Source-tier stamp palette. Phase A2 mostly uses stubs ('reviews' for
// generated copy / 'call' for fields without data yet). Phase A3 plumbs
// real per-field provenance through a Worker _sources map.
const STAMP_STYLES = {
  verified:  { label: 'Verified',          bg: '#DCFCE7', color: '#166534' },
  reported:  { label: 'reported',          bg: '#E0E7FF', color: '#3730A3' },
  reviews:   { label: 'from reviews',      bg: '#FEF3C7', color: '#92400E' },
  estimated: { label: 'estimated',         bg: '#FEF3C7', color: '#92400E' },
  call:      { label: 'call to confirm',   bg: '#DBEAFE', color: '#1E40AF' },
};

function SourceStamp({ tier, onClick }) {
  const s = STAMP_STYLES[tier];
  if (!s) return null;
  const interactive = tier === 'call' && typeof onClick === 'function';
  return (
    <span
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: '600',
        padding: '1px 6px',
        background: s.bg,
        color: s.color,
        borderRadius: '4px',
        marginLeft: '6px',
        cursor: interactive ? 'pointer' : 'default',
        textDecoration: interactive ? 'underline dotted' : 'none',
        verticalAlign: 'middle',
      }}
    >
      {s.label}
    </span>
  );
}

// Worth-It badge palette — same 5-tier vocabulary as the restaurant and
// attraction panels so the brand stays consistent. The Worker decides
// which tier suits a given ATM (Phase A3 will tune the prompt's mapping
// for ATM-specific signals: bank-branch + 24/7 + low-fee → worth_the_stop,
// outdoor + unknown-network → know_before_you_go, etc.).
const WORTH_LABELS = {
  worth_the_stop:       { icon: '💎', label: 'Top-Tier ATM',         bg: '#DCFCE7', color: '#166534' },
  strong_nearby_pick:   { icon: '✅', label: 'Solid Nearby ATM',     bg: '#DBEAFE', color: '#1E40AF' },
  craving_match:        { icon: '🏦', label: 'Specialist (Bank ATM)', bg: '#FCE7F3', color: '#9D174D' },
  know_before_you_go:   { icon: '⚠️', label: 'Know Before You Go',   bg: '#FEF3C7', color: '#92400E' },
  better_if_convenient: { icon: '↪️', label: 'Better If Convenient', bg: '#F1F5F9', color: '#475569' },
};

// Currencies for the Withdrawal Calculator picker. Top travel currencies
// — small enough to scroll without a search box. Spec says nationality
// is NOT a proxy for banking currency; the user picks both sides
// explicitly (defaulting to their primary_banking_currency from Settings).
const CALC_CURRENCIES = [
  { code: 'USD', name: 'US Dollar',           flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro',                flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',       flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen',        flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar',   flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar',     flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc',         flag: '🇨🇭' },
  { code: 'SGD', name: 'Singapore Dollar',    flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar',    flag: '🇭🇰' },
  { code: 'NZD', name: 'New Zealand Dollar',  flag: '🇳🇿' },
  { code: 'THB', name: 'Thai Baht',           flag: '🇹🇭' },
  { code: 'PHP', name: 'Philippine Peso',     flag: '🇵🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah',   flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit',   flag: '🇲🇾' },
  { code: 'VND', name: 'Vietnamese Dong',     flag: '🇻🇳' },
  { code: 'CNY', name: 'Chinese Yuan',        flag: '🇨🇳' },
  { code: 'KRW', name: 'South Korean Won',    flag: '🇰🇷' },
  { code: 'INR', name: 'Indian Rupee',        flag: '🇮🇳' },
  { code: 'MXN', name: 'Mexican Peso',        flag: '🇲🇽' },
  { code: 'BRL', name: 'Brazilian Real',      flag: '🇧🇷' },
  { code: 'AED', name: 'UAE Dirham',          flag: '🇦🇪' },
  { code: 'TRY', name: 'Turkish Lira',        flag: '🇹🇷' },
  { code: 'ZAR', name: 'South African Rand',  flag: '🇿🇦' },
];

const CALC_SAMPLE_TIERS = [50, 100, 200, 500, 1000];  // "Withdraw From"-currency amounts. ATM Max appended dynamically when known.

// Card networks we recognize. Phase A3 will populate
// details.cardCompatibility with an array of these (with confidence per
// network). For now we render a stub row of all 9 marked "unknown" so
// the user can see the section's shape.
const CARD_NETWORKS = [
  { key: 'visa',         label: 'Visa' },
  { key: 'mastercard',   label: 'Mastercard' },
  { key: 'plus',         label: 'Plus' },
  { key: 'cirrus',       label: 'Cirrus' },
  { key: 'maestro',      label: 'Maestro' },
  { key: 'unionpay',     label: 'UnionPay' },
  { key: 'jcb',          label: 'JCB' },
  { key: 'discover',     label: 'Discover' },
  { key: 'amex',         label: 'American Express' },
];

export default function AtmAIDetails({ placeId, placeName, page }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showVerdictHelper] = useState(() => !readVerdictHelperSeen());

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // variant='atm_v2' (A3) — switched to dedicated /atm-ai-details
      // endpoint with richer ATM schema. Same event name so the existing
      // ATM analytics queries keep working through the version bump.
      logEvent('ai_details_opened', {
        placeId, placeName, kind: 'atm', variant: 'atm_v2',
      }, page || 'ATMFinder');
      if (showVerdictHelper) markVerdictHelperSeen();
    }
  };

  useEffect(() => {
    if (!open) return;
    if (details || loading) return;
    if (!placeId) return;
    setLoading(true);
    setError(null);
    // Phase A3: dedicated /atm-ai-details endpoint that returns the
    // richer ATM schema (cardCompatibility, atmOperatorFee, withdrawalLimits,
    // locationContext, safety, dccWarning, verifiedFacts, _sources).
    // Same ai_details_fetched event name so the existing ATM analytics
    // queries (atm_ai_details_paid_by_day_14d etc.) keep working.
    callWorker(ROUTE.getAtmAIDetails, { placeId })
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
          placeId, placeName,
          kind: 'atm', variant: 'atm_v2',
          cache, paid: cache !== 'hit',
        }, page || 'ATMFinder');
      })
      .catch((e) => setError(e?.message || 'Failed to load AI details'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placeId]);

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
          <Body loading={loading} error={error} details={details} showVerdictHelper={showVerdictHelper} />
        </div>
      )}
    </div>
  );
}

function Body({ loading, error, details, showVerdictHelper }) {
  if (loading) return <Shimmer />;
  if (error) return <div style={{ fontSize: '12px', color: '#B91C1C' }}>AI Details unavailable right now. {error}</div>;
  if (!details) return null;

  const websiteUri = details.websiteUri || null;
  const callConfirm = websiteUri ? () => window.open(websiteUri, '_blank', 'noopener,noreferrer') : null;

  // Phase A2 has no _sources map yet (the shared endpoint doesn't return
  // one). Default everything to 'reviews' so the stamps look right; the
  // Worker fork in A3 will populate _sources for real provenance.
  const sourcesMap = (details && typeof details._sources === 'object' && details._sources) || {};
  const sourceFor = (key, fallback = 'reviews') => sourcesMap[key] || fallback;

  return (
    <div>
      <ZoneVerdict details={details} showVerdictHelper={showVerdictHelper} sourceFor={sourceFor} />
      <ZoneCalculator details={details} />
      <ZoneFees details={details} callConfirm={callConfirm} sourceFor={sourceFor} />
      <ZoneCardCompatibility details={details} callConfirm={callConfirm} sourceFor={sourceFor} />
      <ZoneLimits details={details} callConfirm={callConfirm} sourceFor={sourceFor} />
      <ZoneLocation details={details} sourceFor={sourceFor} />
      <ZoneSafety details={details} callConfirm={callConfirm} sourceFor={sourceFor} />
      <DepthMore details={details} sourceFor={sourceFor} />
      {websiteUri && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: GRAY }}>
          For more information, visit{' '}
          <a href={websiteUri} target="_blank" rel="noopener noreferrer" style={{ color: PURPLE, textDecoration: 'underline' }}>
            {websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        </div>
      )}
    </div>
  );
}

function Shimmer() {
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

// ============================================================================
// Section 1 — GS VERDICT
// ============================================================================

function ZoneVerdict({ details, showVerdictHelper, sourceFor }) {
  const worthTag = details.worthIt && WORTH_LABELS[details.worthIt];
  const hasVerdict = (details.gsStars != null || details.gsRedFlag || details.gsVerdict || worthTag);
  if (!hasVerdict) return null;
  return (
    <div style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${PURPLE_LIGHT}` }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: showVerdictHelper ? '2px' : '6px' }}>💯 GS VERDICT</div>
      {showVerdictHelper && (
        <div style={{ fontSize: '11px', color: GRAY, fontStyle: 'italic', marginBottom: '8px' }}>
          Globeskimmers' traveler-fit take on this ATM.
        </div>
      )}
      {worthTag && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            display: 'inline-block', fontSize: '12px', fontWeight: '600',
            padding: '3px 10px', background: worthTag.bg, color: worthTag.color, borderRadius: '9999px',
          }}>
            {worthTag.icon} {worthTag.label}
          </span>
        </div>
      )}
      {(details.gsStars != null && details.gsStars > 0) || details.gsRedFlag ? (
        <div style={{ fontSize: '13px', marginBottom: '4px' }}>
          {details.gsRedFlag
            ? <strong>🚩</strong>
            : <strong style={{ letterSpacing: '1px' }}>{'⭐'.repeat(Math.min(5, Math.max(0, details.gsStars)))}</strong>}
        </div>
      ) : null}
      {details.gsVerdict && (
        <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>
          {details.gsVerdict}
          <SourceStamp tier={sourceFor('gsVerdict')} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section 4 — WITHDRAWAL CALCULATOR
// ============================================================================
// Defaults the "Withdraw From" currency to the user's primary_banking_currency
// (Phase A1 field). The "Receive" currency defaults to the ATM's local
// currency derived from atmOperatorFee.currency when known, else USD with
// a picker. Live rate via getExchangeRate (1-hour module-level cache to
// avoid redundant calls when the user toggles sample tiers).

// Module-level rate cache. Keyed by `${from}>${to}`. We never persist —
// fresh per app load, which is conservative for accuracy.
const RATE_CACHE = new Map();
const RATE_TTL_MS = 60 * 60 * 1000;  // 1 hour
// Live rate via the Cloudflare Worker POST /exchange-rate (the same handler the
// Money Exchange page uses; returns { exchange_rate }). Base44's getExchangeRate
// 403s on native (no Base44 session), which left rate=null → "Gross estimate —".
// callWorker works on web AND native (CapacitorHttp).
async function fetchRate(from, to) {
  if (!from || !to) return null;
  if (from === to) return 1;
  const key = `${from}>${to}`;
  const hit = RATE_CACHE.get(key);
  if (hit && (Date.now() - hit.ts) < RATE_TTL_MS) return hit.rate;
  try {
    const { data, error } = await callWorker(ROUTE.getExchangeRate, { from, to, amount: 1 });
    if (error || data?.error) return null;
    const rate = typeof data?.exchange_rate === 'number' ? data.exchange_rate : null;
    if (rate != null) RATE_CACHE.set(key, { rate, ts: Date.now() });
    return rate;
  } catch (_e) {
    return null;
  }
}

function formatLocal(amount, currency, opts) {
  if (amount == null || !Number.isFinite(amount)) return '—';
  const { dp } = opts || {};
  const fractionDigits = typeof dp === 'number'
    ? dp
    // No-decimal currencies — JPY/KRW/VND/IDR/HUF/CLP rarely show cents on ATMs.
    : (currency && /^(JPY|KRW|VND|IDR|HUF|CLP)$/.test(currency)) ? 0
    : (amount >= 1000 ? 0 : 2);
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits === 0 ? 0 : 0 })} ${currency || ''}`.trim();
}

function ZoneCalculator({ details }) {
  // Lazy-load the user profile (once per panel open) so we can read
  // primary_banking_currency. Avoid a top-of-Body load to keep the
  // calculator self-contained.
  const [user, setUser] = useState(null);
  useEffect(() => {
    let cancelled = false;
    base44.auth.me().then(u => { if (!cancelled) setUser(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Defaults. fromCurrency = user.primary_banking_currency (fallback to
  // preferred_currencies[0], then USD). toCurrency = ATM's local currency
  // when Phase A3 populated atmOperatorFee.currency, else USD.
  const defaultFrom = user?.primary_banking_currency || user?.preferred_currencies?.[0] || 'USD';
  const defaultTo = details?.atmOperatorFee?.currency || details?.withdrawalLimits?.currency || 'USD';
  const [fromCurrency, setFromCurrency] = useState(defaultFrom);
  const [toCurrency, setToCurrency] = useState(defaultTo);
  // Sync the from/to defaults when user / details land after first render.
  useEffect(() => { if (user && fromCurrency === 'USD' && defaultFrom !== 'USD') setFromCurrency(defaultFrom); }, [user]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (defaultTo !== 'USD') setToCurrency(defaultTo); }, [defaultTo]);  // eslint-disable-line react-hooks/exhaustive-deps

  const [amount, setAmount] = useState(100);
  const [rate, setRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [usdRef, setUsdRef] = useState(false);
  const [usdRate, setUsdRate] = useState(null);

  // Fetch the primary rate whenever the pair changes.
  useEffect(() => {
    let cancelled = false;
    setRate(null);
    if (fromCurrency === toCurrency) { setRate(1); return; }
    setRateLoading(true);
    fetchRate(fromCurrency, toCurrency).then(r => {
      if (cancelled) return;
      setRate(r);
      setRateLoading(false);
    });
    return () => { cancelled = true; };
  }, [fromCurrency, toCurrency]);

  // USD reference rate (only when toggled and the destination isn't already USD).
  useEffect(() => {
    if (!usdRef || toCurrency === 'USD') { setUsdRate(null); return; }
    let cancelled = false;
    fetchRate('USD', toCurrency).then(r => { if (!cancelled) setUsdRate(r); });
    return () => { cancelled = true; };
  }, [usdRef, toCurrency]);

  // Tiers — include the ATM Max as a final tier when known.
  const atmMaxLocal = details?.withdrawalLimits?.perTransaction || null;
  // Convert ATM-max-in-LOCAL into FROM-currency for the tier button.
  const atmMaxFrom = (atmMaxLocal && rate && rate > 0) ? Math.floor(atmMaxLocal / rate) : null;
  const tiers = atmMaxFrom
    ? [...CALC_SAMPLE_TIERS.filter(t => t < atmMaxFrom), atmMaxFrom]
    : CALC_SAMPLE_TIERS;

  // Computed amounts.
  const grossLocal = (rate && Number.isFinite(amount)) ? amount * rate : null;
  const operatorFeeLocal = details?.atmOperatorFee?.amount && details?.atmOperatorFee?.currency === toCurrency
    ? details.atmOperatorFee.amount
    : null;
  const netLocal = (grossLocal != null && operatorFeeLocal != null)
    ? Math.max(0, grossLocal - operatorFeeLocal)
    : grossLocal;
  const usdEquiv = (usdRef && grossLocal != null && usdRate)
    ? grossLocal / usdRate
    : null;

  const needsBankingCurrencyPrompt = user && !user.primary_banking_currency;

  return (
    <div style={{ marginBottom: '14px', padding: '12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${PURPLE_LIGHT}` }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '8px' }}>
        🧮 WITHDRAWAL CALCULATOR
      </div>

      {needsBankingCurrencyPrompt && (
        <BankingCurrencyPrompt user={user} onSet={(code) => { setUser({ ...user, primary_banking_currency: code }); setFromCurrency(code); }} />
      )}

      {/* From / To picker row. */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: GRAY, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>Withdraw From</div>
          <CurrencyPicker value={fromCurrency} onChange={setFromCurrency} />
        </div>
        <div style={{ paddingTop: '16px', fontSize: '16px', color: PURPLE }}>→</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: GRAY, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>Receive</div>
          <CurrencyPicker value={toCurrency} onChange={setToCurrency} />
        </div>
      </div>

      {/* Amount input + tiers. */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: GRAY, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>Amount ({fromCurrency})</div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          onChange={(e) => {
            const n = Number(e.target.value);
            setAmount(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: '6px', border: `1px solid ${DIVIDER}`, fontFamily: 'inherit', marginBottom: '6px', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {tiers.map((t, i) => {
            const isMax = atmMaxFrom && t === atmMaxFrom;
            const active = amount === t;
            return (
              <button
                key={`${t}-${i}`}
                type="button"
                onClick={() => setAmount(t)}
                style={{
                  fontSize: '12px', padding: '4px 10px',
                  background: active ? PURPLE : '#F1F5F9',
                  color: active ? '#FFFFFF' : DARK,
                  border: `1px solid ${active ? PURPLE : DIVIDER}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontFamily: 'inherit',
                }}
              >
                {isMax ? `Max · ${formatLocal(t, fromCurrency)}` : `${t.toLocaleString()} ${fromCurrency}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result rows. */}
      <div style={{ background: PURPLE_BG, borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: DARK, lineHeight: '1.6' }}>
        <ResultRow label="Gross estimate" value={rateLoading ? 'Loading rate…' : formatLocal(grossLocal, toCurrency)} bold />
        {operatorFeeLocal != null && (
          <ResultRow label={`ATM operator fee`} value={`− ${formatLocal(operatorFeeLocal, toCurrency)}`} muted />
        )}
        {operatorFeeLocal != null && (
          <ResultRow label="Estimated cash received" value={formatLocal(netLocal, toCurrency)} bold accent />
        )}
        {operatorFeeLocal == null && (
          <div style={{ fontSize: '11px', color: GRAY, marginTop: '4px' }}>
            Operator fee not confirmed — actual cash received may be lower than the gross estimate.
          </div>
        )}
        {rate != null && rate !== 1 && (
          <div style={{ fontSize: '11px', color: GRAY, marginTop: '6px' }}>
            1 {fromCurrency} ≈ {rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {toCurrency}
          </div>
        )}
      </div>

      {/* USD reference toggle. */}
      {toCurrency !== 'USD' && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '12px', color: GRAY_DEEP, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={usdRef} onChange={(e) => setUsdRef(e.target.checked)} />
            Show USD reference
          </label>
          {usdRef && usdEquiv != null && (
            <span style={{ fontSize: '12px', color: GRAY_DEEP }}>
              ≈ {formatLocal(usdEquiv, 'USD')}
            </span>
          )}
        </div>
      )}

      <div style={{ fontSize: '10px', color: GRAY, marginTop: '8px', lineHeight: '1.4' }}>
        Possible bank/card foreign-transaction fees not included. Decline ATM-side currency conversion (DCC) for a better rate.
      </div>
    </div>
  );
}

function CurrencyPicker({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '6px 8px', fontSize: '13px',
        borderRadius: '6px', border: `1px solid ${DIVIDER}`,
        background: '#FFFFFF', fontFamily: 'inherit', boxSizing: 'border-box',
      }}
    >
      {CALC_CURRENCIES.find(c => c.code === value) ? null : (
        // Allow exotic currencies the Worker may return (e.g. RON) to render
        // even when not in our short list.
        <option value={value}>{value}</option>
      )}
      {CALC_CURRENCIES.map(c => (
        <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
      ))}
    </select>
  );
}

function ResultRow({ label, value, bold, accent, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: muted ? GRAY_DEEP : (accent ? '#166534' : DARK) }}>
      <span style={{ fontSize: '12px' }}>{label}</span>
      <span style={{ fontWeight: bold ? '700' : '500', fontSize: bold ? '15px' : '13px' }}>{value}</span>
    </div>
  );
}

function BankingCurrencyPrompt({ user, onSet }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(user?.preferred_currencies?.[0] || 'USD');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ primary_banking_currency: picked });
      onSet?.(picked);
      setOpen(false);
    } catch (_e) {
      // Silent fail — user can retry from Settings.
    }
    setSaving(false);
  };

  if (!open) {
    return (
      <div style={{
        marginBottom: '10px', padding: '8px 10px',
        background: '#FEF3C7', border: '1px solid #FDE68A',
        borderRadius: '6px', fontSize: '12px', color: '#92400E',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
      }}>
        <span>Set your Primary Banking Currency for accurate estimates.</span>
        <button onClick={() => setOpen(true)} style={{ fontSize: '12px', padding: '3px 10px', background: '#92400E', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}>
          Set now
        </button>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: '10px', padding: '10px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '6px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400E', marginBottom: '6px' }}>Which currency does your main travel card or bank account use?</div>
      <CurrencyPicker value={picked} onChange={setPicked} />
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <button onClick={save} disabled={saving} style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: '#166534', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setOpen(false)} style={{ fontSize: '12px', padding: '6px 10px', background: '#FFFFFF', color: '#92400E', border: '1px solid #FDE68A', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Section 3 — FEES (Operator / Bank / Foreign Transaction / DCC warning)
// ============================================================================

function ZoneFees({ details, callConfirm, sourceFor }) {
  const fee = details.atmOperatorFee || null;
  const operatorLine = fee?.amount != null && fee?.currency
    ? `${formatMoney(fee.amount, fee.currency)} per withdrawal`
    : null;
  const operatorTier = fee?.confidence === 'confirmed' ? 'verified'
    : fee?.confidence === 'reported' ? 'reported'
    : fee?.confidence === 'estimated' ? 'estimated'
    : 'call';

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>💸 FEES</div>
      <div style={{ background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}`, overflow: 'hidden' }}>
        {/* A. ATM operator fee */}
        <FeeRow
          icon="🏧" label="ATM Operator Fee"
          value={operatorLine || 'Unknown — check the ATM screen before confirming.'}
          stamp={operatorTier}
          onCallConfirm={callConfirm}
        />
        {/* B. Your bank's foreign ATM fee */}
        <FeeRow
          icon="🏦" label="Your Bank's Foreign ATM Fee"
          value="Your home bank may charge a foreign ATM fee. Add your bank or card in Settings to estimate this."
          stamp="call"
          onCallConfirm={callConfirm}
        />
        {/* C. Foreign transaction / currency conversion fee */}
        <FeeRow
          icon="🌐" label="Foreign Transaction Fee"
          value="Many banks charge 0%–3% when the transaction is processed in a foreign currency. Some travel cards charge 0%."
          stamp="call"
          onCallConfirm={callConfirm}
        />
        {/* D. DCC warning */}
        <FeeRow
          icon="⚠️" label="Dynamic Currency Conversion"
          value="If the ATM asks 'convert to your home currency?' — decline. Choose local currency for a better rate."
          stamp="reviews"
          isLast
        />
      </div>
      {/* Phase-stub note when no real data is wired yet. */}
      {!fee && (
        <div style={{ fontSize: '11px', color: GRAY, marginTop: '6px', lineHeight: '1.4' }}>
          Specific fee details for this ATM will appear here once the Phase A3 prompt is deployed.<SourceStamp tier={sourceFor('atmOperatorFee')} />
        </div>
      )}
    </div>
  );
}

function FeeRow({ icon, label, value, stamp, onCallConfirm, isLast }) {
  return (
    <div style={{ padding: '10px 12px', borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}` }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: DARK, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>{icon}</span>{label}
        <SourceStamp tier={stamp} onClick={stamp === 'call' ? onCallConfirm : null} />
      </div>
      <div style={{ fontSize: '12px', color: GRAY_DEEP, lineHeight: '1.5' }}>{value}</div>
    </div>
  );
}

function formatMoney(amount, currency) {
  // Minimal formatter; the calculator in A4 will do proper locale formatting.
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(num)) return '—';
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

// ============================================================================
// Section 2 — CARD COMPATIBILITY
// ============================================================================

function ZoneCardCompatibility({ details, callConfirm, sourceFor }) {
  // details.cardCompatibility (added in A3) is expected to be one of:
  //   - array of network keys with confidence: [{ network: 'visa', accepted: true|false }, ...]
  //   - undefined/null when the Worker hasn't tagged this ATM yet
  const list = Array.isArray(details.cardCompatibility) ? details.cardCompatibility : null;
  const accepted = list ? new Set(list.filter(n => n?.accepted).map(n => n.network)) : null;
  const tier = list ? sourceFor('cardCompatibility') : 'call';

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        💳 CARD COMPATIBILITY
        <SourceStamp tier={tier} onClick={tier === 'call' ? callConfirm : null} />
      </div>
      {!list ? (
        <div style={{ fontSize: '13px', color: GRAY_DEEP, lineHeight: '1.5', padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}` }}>
          Compatibility not confirmed for this ATM. Most international debit cards using Visa, Mastercard, Plus, or Cirrus may work.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CARD_NETWORKS.map(n => {
            const ok = accepted.has(n.key);
            return (
              <span key={n.key} style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '9999px',
                background: ok ? '#DCFCE7' : '#F1F5F9',
                color: ok ? '#166534' : '#94A3B8',
                fontWeight: '500',
                textDecoration: ok ? 'none' : 'line-through',
              }}>{ok ? '✅ ' : '•'} {n.label}</span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section 5 — WITHDRAWAL LIMITS
// ============================================================================

function ZoneLimits({ details, callConfirm, sourceFor }) {
  const limits = details.withdrawalLimits || null;
  const tier = limits ? sourceFor('withdrawalLimits') : 'call';
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        📊 WITHDRAWAL LIMITS
        <SourceStamp tier={tier} onClick={tier === 'call' ? callConfirm : null} />
      </div>
      <div style={{ padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}`, fontSize: '13px', color: DARK, lineHeight: '1.5' }}>
        {limits?.perTransaction != null && (
          <div><strong style={{ fontSize: '11px', textTransform: 'uppercase', color: PURPLE, letterSpacing: '0.4px', marginRight: '6px' }}>Per transaction</strong>{formatMoney(limits.perTransaction, limits.currency || '')}</div>
        )}
        {limits?.daily != null && (
          <div style={{ marginTop: '4px' }}><strong style={{ fontSize: '11px', textTransform: 'uppercase', color: PURPLE, letterSpacing: '0.4px', marginRight: '6px' }}>Daily</strong>{formatMoney(limits.daily, limits.currency || '')}</div>
        )}
        {!limits && (
          <div style={{ color: GRAY_DEEP }}>Limit not confirmed. The ATM will display the maximum before you confirm a withdrawal.</div>
        )}
        {limits?.dependsOnCard && (
          <div style={{ fontSize: '12px', color: GRAY_DEEP, marginTop: '4px' }}>Limits may vary based on your home bank or card.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Section 6 — LOCATION CONTEXT
// ============================================================================

function ZoneLocation({ details, sourceFor }) {
  // Phase A2 reuses the existing 'vibe' field — for kind='atm' the shared
  // prompt already places the physical location description there
  // (cloudflare-worker-v7.12.js:1743). Phase A3 will add a richer
  // locationContext object with venue type + sub-location.
  const loc = details.locationContext || details.vibe || null;
  if (!loc) return null;
  const text = typeof loc === 'string' ? loc : loc.summary || '';
  if (!text) return null;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        📍 LOCATION
        <SourceStamp tier={sourceFor(details.locationContext ? 'locationContext' : 'vibe')} />
      </div>
      <div style={{ fontSize: '13px', color: DARK, lineHeight: '1.5', padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}` }}>
        {text}
      </div>
    </div>
  );
}

// ============================================================================
// Section 7 — SAFETY & CONVENIENCE
// ============================================================================

function ZoneSafety({ details, callConfirm, sourceFor }) {
  // Phase A2: render a single-line summary derived from the existing
  // verdict + open-status fields. A3 will provide a structured `safety`
  // object with concrete flags (indoor, well_lit, security_guard, etc.).
  const safety = details.safety || null;
  if (safety && typeof safety === 'object') {
    const flags = [
      { key: 'indoor',          label: 'Indoors',           good: true },
      { key: 'wellLit',         label: 'Well-lit',          good: true },
      { key: 'securityGuard',   label: 'Security on-site',  good: true },
      { key: 'bankBranch',      label: 'Bank branch',       good: true },
      { key: 'cameras',         label: 'Cameras',           good: true },
      { key: 'highFootTraffic', label: 'Busy area',         good: true },
      { key: 'open24h',         label: 'Open 24/7',         good: true },
      { key: 'skimmerReports',  label: 'Skimmer reports',   good: false },
    ].filter(f => safety[f.key] != null);
    if (flags.length === 0) {
      return (
        <SafetyBlock summary="Safety info not reported for this ATM. Use the same caution you would at any unfamiliar ATM." stamp="call" onCallConfirm={callConfirm} />
      );
    }
    return (
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
          🛡️ SAFETY & CONVENIENCE
          <SourceStamp tier={sourceFor('safety')} />
        </div>
        <div style={{ padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}`, display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {flags.map(f => {
            const present = !!safety[f.key];
            const positive = f.good ? present : !present;
            return (
              <span key={f.key} style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '9999px',
                background: positive ? '#DCFCE7' : '#FEE2E2',
                color: positive ? '#166534' : '#991B1B',
                fontWeight: '500',
              }}>
                {positive ? '✅' : '⚠️'} {f.label}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
  // No structured safety yet — fall back to a calm placeholder.
  return (
    <SafetyBlock summary="Safety info not reported for this ATM. Use the same caution you would at any unfamiliar ATM." stamp="call" onCallConfirm={callConfirm} />
  );
}

function SafetyBlock({ summary, stamp, onCallConfirm }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '6px' }}>
        🛡️ SAFETY & CONVENIENCE
        <SourceStamp tier={stamp} onClick={stamp === 'call' ? onCallConfirm : null} />
      </div>
      <div style={{ padding: '10px 12px', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${DIVIDER}`, fontSize: '13px', color: GRAY_DEEP, lineHeight: '1.5' }}>
        {summary}
      </div>
    </div>
  );
}

// ============================================================================
// Depth — "More" tap
// ============================================================================

function DepthMore({ details, sourceFor }) {
  const [open, setOpen] = useState(false);
  const rows = [
    { sourceKey: 'bestTime',      icon: '⏰', label: 'BEST TIME',      value: details.bestTime },
    { sourceKey: 'crowd',         icon: '👥', label: 'CROWD',          value: details.crowd },
    { sourceKey: 'travelerNotes', icon: '🌍', label: 'TRAVELER NOTES', value: details.travelerNotes },
    { sourceKey: 'value',         icon: '💰', label: 'PRICING NOTE',   value: details.value },
  ].filter(r => r.value);
  const goodToKnow = Array.isArray(details.goodToKnow) ? details.goodToKnow.filter(Boolean) : [];
  if (rows.length === 0 && goodToKnow.length === 0) return null;
  return (
    <div style={{ marginBottom: '4px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.5px' }}>📖 MORE DETAIL</span>
        <span style={{ fontSize: '11px', color: PURPLE }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ paddingTop: '6px' }}>
          {goodToKnow.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '4px' }}>
                📌 GOOD TO KNOW<SourceStamp tier={sourceFor('goodToKnow')} />
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.5', color: DARK }}>
                {goodToKnow.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}
          {rows.map(r => (
            <div key={r.label} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, letterSpacing: '0.4px', marginBottom: '3px' }}>
                {r.icon} {r.label}
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.5', color: DARK }}>
                {r.value}<SourceStamp tier={sourceFor(r.sourceKey)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
