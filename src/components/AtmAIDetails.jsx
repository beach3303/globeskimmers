/**
 * AtmAIDetails: the "AI details" disclosure on ATM cards (the new look, plan S11 detail 5;
 * Carbon Copy).
 *
 * A fork of AIDetailsSection.jsx for ATMs: PlacesToEat, Coffee and Restrooms keep their
 * own panels, so the ATM layout (card compatibility, fees, the withdrawal calculator,
 * limits, location, safety) can evolve without touching theirs.
 *
 * Look: a quiet row (Sparkles in the world's icon ink, 'AI details', aria-expanded and
 * aria-controls); the body opens under it on white with the world line. Mono labels in
 * carbon, plain words, lucide icons; the worth tiers stepped by lightness and said in
 * words; where each fact comes from as mono text; every size on fs() and every control a
 * 44px target. No lilac, no emoji (flags included). `world`: a WORLD row or key (ATMs'
 * Carbon Copy by default).
 *
 * Data (unchanged): /atm-ai-details (cardCompatibility, atmOperatorFee, withdrawalLimits,
 * locationContext, safety, verifiedFacts, _sources), fetched on the first open; the
 * calculator reads live rates from /exchange-rate and the traveler's
 * primary_banking_currency.
 *
 * Honesty rules: each fact says where it comes from; "call to confirm" opens the ATM's
 * website (in the in-app browser) when there is one; a section with no data is absent,
 * not filled; the calculator says when the operator fee isn't confirmed.
 */
import React, { useState, useEffect, useId } from 'react';
import {
  BookOpen, Check, CreditCard, Flag, Globe, Landmark, Sparkles, Star, TriangleAlert, X,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { legacyUser } from '@/lib/legacyUser';
import { supabase } from '@/lib/supabaseClient';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { logEvent } from '@/lib/analytics';
import { openPartner } from '@/lib/openPartner';
import { SOURCE_META, makeSourceFor } from '@/lib/sourceMeta';
import { NEUTRAL, fs } from '@/components/redesign/constants';
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

// One key shared with the restaurant and attraction panels: the GS verdict subtitle is
// shown to a traveler at most once.
const GS_VERDICT_HELPER_KEY = 'gs_verdict_helper_seen';
function readVerdictHelperSeen() {
  try { return localStorage.getItem(GS_VERDICT_HELPER_KEY) === '1'; }
  catch { return true; }
}
function markVerdictHelperSeen() {
  try { localStorage.setItem(GS_VERDICT_HELPER_KEY, '1'); } catch { /* ignore */ }
}

// The panel's shared type, in the world's colours.
const styles = (w) => ({
  /** @type {CSS} */
  label: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6, fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.34, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: w.ink },
  /** @type {CSS} */
  body: { fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink },
  /** @type {CSS} */
  box: { background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 12, padding: '10px 12px' },
});

// Where a fact comes from, as mono text: Verified in the open green, the rest muted;
// "call to confirm" is a 44px link to the ATM's website when there is one.
function SourceStamp({ tier, onClick = null, w }) {
  const s = SOURCE_META[tier];
  if (!s) return null;
  /** @type {CSS} */
  const word = { marginLeft: 8, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  if (tier === 'call' && typeof onClick === 'function') {
    return (
      <button type="button" onClick={onClick}
        style={{ ...word, display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-14px 0 -14px 8px', padding: 0, background: 'transparent', border: 0, color: w.ink, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', verticalAlign: 'baseline' }}>
        {s.label}
      </button>
    );
  }
  const sure = tier === 'verified' || tier === 'confirmed';
  return <span style={{ ...word, color: sure ? NEUTRAL.open : NEUTRAL.ink3 }}>{s.label}</span>;
}

// The worth tiers, stepped by lightness so they read without colour: solid, wash,
// outline, dashed (a caution, in stamp red) and plain. The words carry the meaning.
const WORTH = {
  worth_the_stop:       { label: 'Top-tier ATM',          step: 'solid' },
  strong_nearby_pick:   { label: 'Solid nearby ATM',      step: 'wash' },
  craving_match:        { label: 'Specialist (bank ATM)', step: 'outline' },
  know_before_you_go:   { label: 'Know before you go',    step: 'caution' },
  better_if_convenient: { label: 'Better if convenient',  step: 'plain' },
};
function worthStyle(step, w) {
  switch (step) {
    case 'solid': return { background: w.ink, color: NEUTRAL.white, border: `1px solid ${w.ink}` };
    case 'wash': return { background: w.wash, color: w.washInk, border: `1px solid ${w.wash}` };
    case 'outline': return { background: NEUTRAL.white, color: w.ink, border: `1px solid ${w.ink}` };
    case 'caution': return { background: NEUTRAL.white, color: NEUTRAL.stamp, border: `1px dashed ${NEUTRAL.stamp}` };
    default: return { background: 'transparent', color: NEUTRAL.ink2, border: `1px solid ${w.line}` };
  }
}

// Currencies for the calculator's pickers: the top travel currencies, short enough to
// scroll without a search. Nationality is never a proxy for the banking currency; the
// traveler picks both sides (the first defaults to their primary_banking_currency).
const CALC_CURRENCIES = [
  { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' }, { code: 'AUD', name: 'Australian Dollar' }, { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' }, { code: 'SGD', name: 'Singapore Dollar' }, { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' }, { code: 'THB', name: 'Thai Baht' }, { code: 'PHP', name: 'Philippine Peso' },
  { code: 'IDR', name: 'Indonesian Rupiah' }, { code: 'MYR', name: 'Malaysian Ringgit' }, { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'CNY', name: 'Chinese Yuan' }, { code: 'KRW', name: 'South Korean Won' }, { code: 'INR', name: 'Indian Rupee' },
  { code: 'MXN', name: 'Mexican Peso' }, { code: 'BRL', name: 'Brazilian Real' }, { code: 'AED', name: 'UAE Dirham' },
  { code: 'TRY', name: 'Turkish Lira' }, { code: 'ZAR', name: 'South African Rand' },
];

const CALC_SAMPLE_TIERS = [50, 100, 200, 500, 1000]; // amounts in the "withdraw from" currency; the ATM's max is added when known

// The card networks we recognize (details.cardCompatibility names them).
const CARD_NETWORKS = [
  { key: 'visa', label: 'Visa' }, { key: 'mastercard', label: 'Mastercard' }, { key: 'plus', label: 'Plus' },
  { key: 'cirrus', label: 'Cirrus' }, { key: 'maestro', label: 'Maestro' }, { key: 'unionpay', label: 'UnionPay' },
  { key: 'jcb', label: 'JCB' }, { key: 'discover', label: 'Discover' }, { key: 'amex', label: 'American Express' },
];

/**
 * @param {{ placeId?: string, placeName?: string, page?: string, world?: any }} props
 */
export default function AtmAIDetails({ placeId, placeName, page, world = 'atm' }) {
  const w = worldRow(world);
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showVerdictHelper] = useState(() => !readVerdictHelperSeen());

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // variant 'atm_v2': the dedicated /atm-ai-details endpoint; the same event name
      // keeps the ATM analytics queries working.
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
    <>
      <QuietRow world={w} icon={Sparkles} expanded={open} controls={bodyId} onClick={onToggle}>
        AI details
      </QuietRow>
      <QuietPanel world={w} id={bodyId} order={2} hidden={!open} style={{ padding: '14px 16px' }}>
        {open ? <Body loading={loading} error={error} details={details} showVerdictHelper={showVerdictHelper} w={w} /> : null}
      </QuietPanel>
    </>
  );
}

function Body({ loading, error, details, showVerdictHelper, w }) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading AI details" style={css({ display: 'flex', flexDirection: 'column', gap: 8, '--w-wash': w.wash })}>
        {[88, 72, 80, 66, 75].map((pct, i) => (
          <span key={i} className="gs-shimmer" aria-hidden="true" style={{ display: 'block', height: 12, width: `${pct}%`, borderRadius: 4 }} />
        ))}
      </div>
    );
  }
  if (error) return <div role="alert" style={{ fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.stamp }}>AI details unavailable right now. {error}</div>;
  if (!details) return null;

  const websiteUri = details.websiteUri || null;
  const callConfirm = websiteUri ? () => openPartner(websiteUri) : null;
  // Any field the Worker didn't tag is model-written: an AI estimate.
  const sourceFor = makeSourceFor(details);
  const host = websiteUri ? websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;

  return (
    <div>
      <ZoneVerdict details={details} showVerdictHelper={showVerdictHelper} sourceFor={sourceFor} w={w} />
      <ZoneCalculator details={details} w={w} />
      <ZoneFees details={details} callConfirm={callConfirm} sourceFor={sourceFor} w={w} />
      <ZoneCardCompatibility details={details} callConfirm={callConfirm} sourceFor={sourceFor} w={w} />
      <ZoneLimits details={details} callConfirm={callConfirm} sourceFor={sourceFor} w={w} />
      <ZoneLocation details={details} sourceFor={sourceFor} w={w} />
      <ZoneSafety details={details} callConfirm={callConfirm} sourceFor={sourceFor} w={w} />
      <DepthMore details={details} sourceFor={sourceFor} w={w} />
      {host && (
        <p style={{ margin: '12px 0 0', fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
          For more information, visit{' '}
          <button type="button" onClick={() => openPartner(websiteUri)}
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-14px 0', padding: 0, background: 'transparent', border: 0, fontFamily: 'inherit', fontSize: 'inherit', color: w.ink, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', overflowWrap: 'anywhere', textAlign: 'left' }}>
            {host}
          </button>
        </p>
      )}
    </div>
  );
}

// ============================================================================
// GS verdict
// ============================================================================

function ZoneVerdict({ details, showVerdictHelper, sourceFor, w }) {
  const st = styles(w);
  const worth = details.worthIt && WORTH[details.worthIt];
  const stars = Math.min(5, Math.max(0, Math.round(Number(details.gsStars) || 0)));
  const hasVerdict = (details.gsStars != null || details.gsRedFlag || details.gsVerdict || worth);
  if (!hasVerdict) return null;
  return (
    <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${w.line}` }}>
      <div style={{ ...st.label, marginBottom: showVerdictHelper ? 2 : 6 }}>GS verdict</div>
      {showVerdictHelper && (
        <div style={{ fontSize: fs(12), color: NEUTRAL.ink3, fontStyle: 'italic', marginBottom: 8 }}>
          Globeskimmers&rsquo; traveler-fit take on this ATM.
        </div>
      )}
      {worth && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, boxSizing: 'border-box', padding: '2px 10px', borderRadius: 999, fontSize: fs(12), fontWeight: 600, ...worthStyle(worth.step, w) }}>
            {worth.label}
          </span>
        </div>
      )}
      {details.gsRedFlag ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: fs(13), fontWeight: 600, color: NEUTRAL.stamp }}>
          <Flag size={14} color={NEUTRAL.stamp} strokeWidth={2} aria-hidden="true" focusable="false" />
          Red flag
        </div>
      ) : stars > 0 ? (
        <div role="img" aria-label={`${stars} out of 5`} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 4 }}>
          {Array.from({ length: stars }, (_, i) => (
            <Star key={i} size={14} color={w.star} fill={w.star} strokeWidth={1.5} aria-hidden="true" focusable="false" />
          ))}
        </div>
      ) : null}
      {details.gsVerdict && (
        <div style={st.body}>
          {details.gsVerdict}
          <SourceStamp tier={sourceFor('gsVerdict')} w={w} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Withdrawal calculator
// ============================================================================
// "Withdraw from" defaults to the traveler's primary_banking_currency; "receive" to the
// ATM's local currency when the Worker knows it, else USD. Live rates from the Worker's
// /exchange-rate (the Money page's handler), cached an hour in this module.

const RATE_CACHE = new Map();
const RATE_TTL_MS = 60 * 60 * 1000;
// callWorker works on web and native (Base44's getExchangeRate 403'd on native).
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
    // Currencies an ATM rarely shows cents for.
    : (currency && /^(JPY|KRW|VND|IDR|HUF|CLP)$/.test(currency)) ? 0
    : (amount >= 1000 ? 0 : 2);
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: fractionDigits, minimumFractionDigits: 0 })} ${currency || ''}`.trim();
}

function ZoneCalculator({ details, w }) {
  const st = styles(w);
  const { user: authUser, profile } = useAuth();
  const [user, setUser] = useState(null);
  useEffect(() => { setUser(legacyUser(authUser, profile)); }, [authUser, profile]);

  const defaultFrom = user?.primary_banking_currency || user?.preferred_currencies?.[0] || 'USD';
  const defaultTo = details?.atmOperatorFee?.currency || details?.withdrawalLimits?.currency || 'USD';
  const [fromCurrency, setFromCurrency] = useState(defaultFrom);
  const [toCurrency, setToCurrency] = useState(defaultTo);
  // The defaults land after the first render.
  useEffect(() => { if (user && fromCurrency === 'USD' && defaultFrom !== 'USD') setFromCurrency(defaultFrom); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (defaultTo !== 'USD') setToCurrency(defaultTo); }, [defaultTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const [amount, setAmount] = useState(100);
  const [rate, setRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [usdRef, setUsdRef] = useState(false);
  const [usdRate, setUsdRate] = useState(null);
  const fromId = useId(), toId = useId(), amountId = useId();

  useEffect(() => {
    let cancelled = false;
    setRate(null);
    if (fromCurrency === toCurrency) { setRate(1); return undefined; }
    setRateLoading(true);
    fetchRate(fromCurrency, toCurrency).then((r) => {
      if (cancelled) return;
      setRate(r);
      setRateLoading(false);
    });
    return () => { cancelled = true; };
  }, [fromCurrency, toCurrency]);

  // The USD reference, when asked for and the destination isn't USD already.
  useEffect(() => {
    if (!usdRef || toCurrency === 'USD') { setUsdRate(null); return undefined; }
    let cancelled = false;
    fetchRate('USD', toCurrency).then((r) => { if (!cancelled) setUsdRate(r); });
    return () => { cancelled = true; };
  }, [usdRef, toCurrency]);

  // The ATM's max, in the "from" currency, as a last tier when known.
  const atmMaxLocal = details?.withdrawalLimits?.perTransaction || null;
  const atmMaxFrom = (atmMaxLocal && rate && rate > 0) ? Math.floor(atmMaxLocal / rate) : null;
  const tiers = atmMaxFrom ? [...CALC_SAMPLE_TIERS.filter((t) => t < atmMaxFrom), atmMaxFrom] : CALC_SAMPLE_TIERS;

  const grossLocal = (rate && Number.isFinite(amount)) ? amount * rate : null;
  const operatorFeeLocal = details?.atmOperatorFee?.amount && details?.atmOperatorFee?.currency === toCurrency ? details.atmOperatorFee.amount : null;
  const netLocal = (grossLocal != null && operatorFeeLocal != null) ? Math.max(0, grossLocal - operatorFeeLocal) : grossLocal;
  const usdEquiv = (usdRef && grossLocal != null && usdRate) ? grossLocal / usdRate : null;
  const needsBankingCurrencyPrompt = user && !user.primary_banking_currency;
  /** @type {CSS} */
  const fieldLabel = { display: 'block', marginBottom: 4, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: NEUTRAL.ink3 };

  return (
    <div style={{ ...st.box, marginBottom: 14, padding: 12 }}>
      <div style={st.label}>Withdrawal calculator</div>

      {needsBankingCurrencyPrompt && (
        <BankingCurrencyPrompt user={user} w={w} onSet={(code) => { setUser({ ...user, primary_banking_currency: code }); setFromCurrency(code); }} />
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor={fromId} style={fieldLabel}>Withdraw from</label>
          <CurrencyPicker id={fromId} value={fromCurrency} onChange={setFromCurrency} w={w} />
        </div>
        <span aria-hidden="true" style={{ paddingBottom: 12, fontSize: fs(15), color: w.ink }}>→</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor={toId} style={fieldLabel}>Receive</label>
          <CurrencyPicker id={toId} value={toCurrency} onChange={setToCurrency} w={w} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label htmlFor={amountId} style={fieldLabel}>Amount ({fromCurrency})</label>
        <input
          id={amountId}
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          onChange={(e) => {
            const n = Number(e.target.value);
            setAmount(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '8px 10px', borderRadius: 10, border: `1px solid ${w.line}`, background: NEUTRAL.white, fontFamily: 'inherit', fontSize: fs(15), color: NEUTRAL.ink }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, marginTop: 2 }}>
          {tiers.map((t, i) => {
            const isMax = atmMaxFrom && t === atmMaxFrom;
            const active = amount === t;
            return (
              <button key={`${t}-${i}`} type="button" aria-pressed={active} onClick={() => setAmount(t)}
                style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: 0, background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 30, boxSizing: 'border-box', padding: '0 10px', borderRadius: 8, border: `1px solid ${active ? w.ink : w.line}`, background: active ? w.ink : NEUTRAL.white, color: active ? NEUTRAL.white : NEUTRAL.ink2, fontSize: fs(12.5), fontWeight: 600 }}>
                  {isMax ? `Max · ${formatLocal(t, fromCurrency)}` : `${t.toLocaleString()} ${fromCurrency}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="status" aria-live="polite" style={{ position: 'relative', padding: '10px 12px', borderRadius: 10, background: w.receipt || w.wash, fontSize: fs(13), lineHeight: 1.6, color: NEUTRAL.ink }}>
        <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 10, right: 10, borderTop: `1px dashed ${w.tearLine || w.line}` }} />
        <ResultRow label="Gross estimate" value={rateLoading ? 'Loading rate…' : formatLocal(grossLocal, toCurrency)} bold />
        {operatorFeeLocal != null && <ResultRow label="ATM operator fee" value={`− ${formatLocal(operatorFeeLocal, toCurrency)}`} muted />}
        {operatorFeeLocal != null && <ResultRow label="Estimated cash received" value={formatLocal(netLocal, toCurrency)} bold accent />}
        {operatorFeeLocal == null && (
          <div style={{ marginTop: 4, fontSize: fs(11.5), color: NEUTRAL.ink3 }}>
            Operator fee not confirmed: the cash you receive may be less than the gross estimate.
          </div>
        )}
        {rate != null && rate !== 1 && (
          <div style={{ marginTop: 6, fontSize: fs(11.5), color: NEUTRAL.ink3 }}>
            1 {fromCurrency} ≈ {rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {toCurrency}
          </div>
        )}
      </div>

      {toCurrency !== 'USD' && (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: fs(12.5), color: NEUTRAL.ink2, cursor: 'pointer' }}>
            <input type="checkbox" checked={usdRef} onChange={(e) => setUsdRef(e.target.checked)} style={{ width: 18, height: 18, accentColor: w.ink }} />
            Show USD reference
          </label>
          {usdRef && usdEquiv != null && <span style={{ fontSize: fs(12.5), color: NEUTRAL.ink2 }}>≈ {formatLocal(usdEquiv, 'USD')}</span>}
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: fs(11), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
        Your bank&rsquo;s or card&rsquo;s foreign-transaction fees aren&rsquo;t included. If the ATM offers to convert to your home currency (DCC), decline for a better rate.
      </div>
    </div>
  );
}

function CurrencyPicker({ id, value, onChange, w }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 10, border: `1px solid ${w.line}`, background: NEUTRAL.white, fontFamily: 'inherit', fontSize: fs(13.5), color: NEUTRAL.ink }}>
      {CALC_CURRENCIES.find((c) => c.code === value) ? null : (
        // A currency the Worker returns that isn't on the short list (RON, say) still shows.
        <option value={value}>{value}</option>
      )}
      {CALC_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
    </select>
  );
}

function ResultRow({ label, value, bold, accent, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, color: muted ? NEUTRAL.ink2 : (accent ? NEUTRAL.open : NEUTRAL.ink) }}>
      <span style={{ fontSize: fs(12.5) }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, fontSize: bold ? fs(15) : fs(13) }}>{value}</span>
    </div>
  );
}

function BankingCurrencyPrompt({ user, onSet, w }) {
  const { refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(user?.preferred_currencies?.[0] || 'USD');
  const [saving, setSaving] = useState(false);
  const pickId = useId();

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ primary_banking_currency: picked }).eq('id', user?.id);
      if (error) throw error;
      refreshProfile?.();
      onSet?.(picked);
      setOpen(false);
    } catch (_e) {
      // Fine to fail quietly: Settings can set it.
    }
    setSaving(false);
  };
  /** @type {CSS} */
  const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 14px', borderRadius: 10, fontFamily: 'inherit', fontSize: fs(13), fontWeight: 600, cursor: 'pointer' };

  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, padding: '6px 6px 6px 12px', borderRadius: 10, background: w.wash, color: w.washInk, fontSize: fs(12.5), lineHeight: 1.4 }}>
        <span>Set your main banking currency for estimates that fit you.</span>
        <button type="button" onClick={() => setOpen(true)} style={{ ...btn, flexShrink: 0, background: NEUTRAL.white, color: w.ink, border: `1px solid ${w.line}` }}>Set now</button>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: w.wash }}>
      <label htmlFor={pickId} style={{ display: 'block', marginBottom: 6, fontSize: fs(12.5), fontWeight: 600, color: w.washInk }}>Which currency does your main travel card or bank account use?</label>
      <CurrencyPicker id={pickId} value={picked} onChange={setPicked} w={w} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={save} disabled={saving} style={{ ...btn, flex: 1, background: w.cta, color: w.ctaInk, border: 0 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ ...btn, background: NEUTRAL.white, color: NEUTRAL.ink2, border: `1px solid ${w.line}` }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Fees (the operator's, your bank's, foreign transaction, DCC)
// ============================================================================

function ZoneFees({ details, callConfirm, sourceFor, w }) {
  const st = styles(w);
  const fee = details.atmOperatorFee || null;
  const operatorLine = fee?.amount != null && fee?.currency ? `${formatMoney(fee.amount, fee.currency)} per withdrawal` : null;
  const operatorTier = fee?.confidence === 'confirmed' ? 'verified'
    : fee?.confidence === 'reported' ? 'reported'
    : fee?.confidence === 'estimated' ? 'estimated'
    : 'call';

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={st.label}>Fees</div>
      <div style={{ background: NEUTRAL.white, borderRadius: 12, border: `1px solid ${w.line}`, overflow: 'hidden' }}>
        <FeeRow w={w} icon={CreditCard} label="ATM operator fee"
          value={operatorLine || 'Unknown: check the ATM screen before you confirm.'}
          stamp={operatorTier} onCallConfirm={callConfirm} />
        <FeeRow w={w} icon={Landmark} label="Your bank’s foreign ATM fee"
          value="Your home bank may charge a foreign ATM fee. Add your bank or card in Settings to estimate it."
          stamp="call" onCallConfirm={callConfirm} />
        <FeeRow w={w} icon={Globe} label="Foreign transaction fee"
          value="Many banks charge 0–3% when a withdrawal is in a foreign currency. Some travel cards charge nothing."
          stamp="call" onCallConfirm={callConfirm} />
        {/* General guidance we wrote: not from reviews and not AI, so no source. */}
        <FeeRow w={w} icon={TriangleAlert} label="Dynamic currency conversion"
          value="If the ATM asks to convert to your home currency, decline: choose the local currency for a better rate." isLast />
      </div>
      {!fee && (
        <div style={{ marginTop: 6, fontSize: fs(11.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
          This ATM&rsquo;s own fee isn&rsquo;t known yet.<SourceStamp tier={sourceFor('atmOperatorFee')} w={w} />
        </div>
      )}
    </div>
  );
}

function FeeRow({ w, icon: Icon, label, value, stamp = undefined, onCallConfirm = null, isLast = false }) {
  return (
    <div style={{ padding: '10px 12px', borderBottom: isLast ? 'none' : `1px solid ${w.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 3, fontSize: fs(12.5), fontWeight: 600, color: NEUTRAL.ink }}>
        <Icon size={15} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        {label}
        {stamp ? <SourceStamp tier={stamp} onClick={stamp === 'call' ? onCallConfirm : null} w={w} /> : null}
      </div>
      <div style={{ fontSize: fs(12.5), lineHeight: 1.5, color: NEUTRAL.ink2 }}>{value}</div>
    </div>
  );
}

function formatMoney(amount, currency) {
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(num)) return '—';
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

// ============================================================================
// Card compatibility
// ============================================================================

function ZoneCardCompatibility({ details, callConfirm, sourceFor, w }) {
  const st = styles(w);
  // details.cardCompatibility: [{ network, accepted }], or nothing when the Worker
  // hasn't tagged this ATM.
  const list = Array.isArray(details.cardCompatibility) ? details.cardCompatibility : null;
  const accepted = list ? new Set(list.filter((n) => n?.accepted).map((n) => n.network)) : null;
  const tier = list ? sourceFor('cardCompatibility') : 'call';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={st.label}>Card compatibility<SourceStamp tier={tier} onClick={tier === 'call' ? callConfirm : null} w={w} /></div>
      {!list ? (
        <div style={{ ...st.box, ...st.body, color: NEUTRAL.ink2 }}>
          Compatibility not confirmed for this ATM. Most international debit cards on Visa, Mastercard, Plus or Cirrus may work.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CARD_NETWORKS.map((n) => {
            const ok = accepted.has(n.key);
            const Icon = ok ? Check : X;
            return (
              <span key={n.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 26, boxSizing: 'border-box', padding: '0 9px', borderRadius: 8, fontSize: fs(12), fontWeight: 600, background: ok ? w.wash : NEUTRAL.white, color: ok ? w.washInk : NEUTRAL.ink3, border: `1px solid ${ok ? w.wash : w.line}`, textDecoration: ok ? 'none' : 'line-through' }}>
                <Icon size={12} color={ok ? w.washInk : NEUTRAL.ink3} strokeWidth={2.5} aria-label={ok ? 'Accepted' : 'Not accepted'} />
                {n.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Withdrawal limits
// ============================================================================

function ZoneLimits({ details, callConfirm, sourceFor, w }) {
  const st = styles(w);
  const limits = details.withdrawalLimits || null;
  const tier = limits ? sourceFor('withdrawalLimits') : 'call';
  /** @type {CSS} */
  const kind = { marginRight: 6, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: w.ink };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={st.label}>Withdrawal limits<SourceStamp tier={tier} onClick={tier === 'call' ? callConfirm : null} w={w} /></div>
      <div style={{ ...st.box, ...st.body }}>
        {limits?.perTransaction != null && <div><span style={kind}>Per withdrawal</span>{formatMoney(limits.perTransaction, limits.currency || '')}</div>}
        {limits?.daily != null && <div style={{ marginTop: 4 }}><span style={kind}>Daily</span>{formatMoney(limits.daily, limits.currency || '')}</div>}
        {!limits && <div style={{ color: NEUTRAL.ink2 }}>Limit not confirmed. The ATM shows its maximum before you confirm a withdrawal.</div>}
        {limits?.dependsOnCard && <div style={{ marginTop: 4, fontSize: fs(12.5), color: NEUTRAL.ink2 }}>Limits may vary with your home bank or card.</div>}
      </div>
    </div>
  );
}

// ============================================================================
// Location
// ============================================================================

function ZoneLocation({ details, sourceFor, w }) {
  const st = styles(w);
  // locationContext when the Worker has it; the older 'vibe' field carried the same.
  const loc = details.locationContext || details.vibe || null;
  if (!loc) return null;
  const text = typeof loc === 'string' ? loc : loc.summary || '';
  if (!text) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={st.label}>Location<SourceStamp tier={sourceFor(details.locationContext ? 'locationContext' : 'vibe')} w={w} /></div>
      <div style={{ ...st.box, ...st.body }}>{text}</div>
    </div>
  );
}

// ============================================================================
// Safety and convenience
// ============================================================================

// Each flag in words either way: what a yes says and what a no says.
const SAFETY_FLAGS = [
  { key: 'indoor', yes: 'Indoors', no: 'Outdoors', good: true },
  { key: 'wellLit', yes: 'Well-lit', no: 'Poorly lit', good: true },
  { key: 'securityGuard', yes: 'Security on site', no: 'No security on site', good: true },
  { key: 'bankBranch', yes: 'Bank branch', no: 'Not a bank branch', good: true },
  { key: 'cameras', yes: 'Cameras', no: 'No cameras', good: true },
  { key: 'highFootTraffic', yes: 'Busy area', no: 'Quiet area', good: true },
  { key: 'open24h', yes: 'Open 24/7', no: 'Not open 24/7', good: true },
  { key: 'skimmerReports', yes: 'Skimmer reports', no: 'No skimmer reports', good: false },
];

function ZoneSafety({ details, callConfirm, sourceFor, w }) {
  const st = styles(w);
  const safety = details.safety && typeof details.safety === 'object' ? details.safety : null;
  const flags = safety ? SAFETY_FLAGS.filter((f) => safety[f.key] != null) : [];
  if (!flags.length) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={st.label}>Safety and convenience<SourceStamp tier="call" onClick={callConfirm} w={w} /></div>
        <div style={{ ...st.box, ...st.body, color: NEUTRAL.ink2 }}>
          Safety info isn&rsquo;t reported for this ATM. Take the care you would at any unfamiliar ATM.
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={st.label}>Safety and convenience<SourceStamp tier={sourceFor('safety')} w={w} /></div>
      <div style={{ ...st.box, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {flags.map((f) => {
          const present = !!safety[f.key];
          const positive = f.good ? present : !present;
          const Icon = positive ? Check : TriangleAlert;
          return (
            <span key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 26, boxSizing: 'border-box', padding: '0 9px', borderRadius: 8, fontSize: fs(12), fontWeight: 600, background: positive ? w.wash : NEUTRAL.white, color: positive ? w.washInk : NEUTRAL.stamp, border: `1px ${positive ? 'solid' : 'dashed'} ${positive ? w.wash : NEUTRAL.stamp}` }}>
              <Icon size={12} color={positive ? w.washInk : NEUTRAL.stamp} strokeWidth={2.5} aria-hidden="true" />
              {present ? f.yes : f.no}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// More detail
// ============================================================================

function DepthMore({ details, sourceFor, w }) {
  const st = styles(w);
  const [open, setOpen] = useState(false);
  const id = useId();
  const rows = [
    { sourceKey: 'bestTime', label: 'Best time', value: details.bestTime },
    { sourceKey: 'crowd', label: 'Crowd', value: details.crowd },
    { sourceKey: 'travelerNotes', label: 'Traveler notes', value: details.travelerNotes },
    { sourceKey: 'value', label: 'Pricing note', value: details.value },
  ].filter((r) => r.value);
  const goodToKnow = Array.isArray(details.goodToKnow) ? details.goodToKnow.filter(Boolean) : [];
  if (rows.length === 0 && goodToKnow.length === 0) return null;
  return (
    <div style={{ marginBottom: 4, borderTop: `1px solid ${w.line}` }}>
      <QuietRow world={w} icon={BookOpen} expanded={open} controls={id} onClick={() => setOpen((o) => !o)} chevron>
        More detail
      </QuietRow>
      <div id={id} hidden={!open} style={{ paddingTop: 4 }}>
        {open ? (
          <>
            {goodToKnow.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={st.label}>Good to know<SourceStamp tier={sourceFor('goodToKnow')} w={w} /></div>
                <ul style={{ margin: 0, paddingLeft: 18, ...st.body }}>
                  {goodToKnow.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
            {rows.map((r) => (
              <div key={r.label} style={{ marginBottom: 10 }}>
                <div style={st.label}>{r.label}</div>
                <div style={st.body}>{r.value}<SourceStamp tier={sourceFor(r.sourceKey)} w={w} /></div>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
