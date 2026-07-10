import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabaseClient";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, RefreshCw, Camera, ChevronLeft, ArrowRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { IVORY, CAT, TEAL_DEEP } from "@/components/redesign/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "@/components/location/LocationContext";
import { logEvent } from "@/lib/analytics";
import { useCameraPreview } from "@/lib/useCameraPreview";
import { useIsTablet } from "@/lib/useIsTablet";

// ── Editorial design tokens (matches PlacesToEat / CultureInformation) ──
// Shared by the result + analysis chrome on BOTH phone and tablet. The LIVE
// CAMERA viewport never references these (its root stays transparent and the
// freeze/capture/instruction overlays keep their original dark-glass styling).
// fs() scales every added text size off the global --fs variable, exactly like
// the shipped pages.
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO  = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY = "#FFFCF7", ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)";
// Price-scanner accent (the teal called for in the redesign brief). TEAL_DEEP
// is imported per the hard rule and used for hover/secondary teal surfaces.
// ED_TEAL is the primary accent (the redesign brief's price-scanner color);
// TEAL_DEEP (from constants) is used for the live-camera instruction pill so
// the imported page accent is wired in per the redesign-constants contract.
const ED_TEAL = "#0F766E";
const fs = (n) => `calc(${n}px*var(--fs))`;
void CAT; // imported per redesign-constants contract; teal is this page's world

// Editorial size scale for the result + analysis chrome. Tablet keeps the
// shipped (larger) values; phone is tuned down per the redesign brief — serif
// headings ~24-28, card titles ~20, body ~13.5, mono kickers ~10-11, card
// radius ~18. Returned as a plain map so the JSX below stays declarative and
// presentation-only (no logic/state changes). GRACEFUL GROWTH: every size is
// wrapped in fs() so the global text-size control still scales the panels, and
// the cards use min-height (not fixed heights) via natural flow.
const edScale = (isTablet) => isTablet
  ? {
      cardMaxW: 560, analysisMaxW: 620, cardRadius: 28, innerRadius: 18,
      cardPad: 32, innerPad: 20,
      kicker: 11, kickerLs: ".16em",
      hero: 52, heroLabel: 10, origAmt: 28, origCur: 13,
      ctxKicker: 10.5, noPriceTitle: 30, bodyLg: 15,
      h3: 34, gsQuote: 22, sectionTitle: 11,
      itemImg: 180, verdictChip: 11.5,
      altName: 14, altMeta: 11, altPrice: 14, altNote: 11.5,
      home: 13, footer: 11, estTag: 9,
      btnPrimary: 16.5, btnPrimarySub: 12, btnSecondary: 15.5, btnGhost: 13,
      ctaPadV: 14, ctaPadH: 16, secPadV: 13, ghostPadV: 8,
    }
  : {
      cardMaxW: 448, analysisMaxW: 448, cardRadius: 22, innerRadius: 18,
      cardPad: 22, innerPad: 16,
      kicker: 10.5, kickerLs: ".14em",
      hero: 40, heroLabel: 10, origAmt: 22, origCur: 12,
      ctxKicker: 10, noPriceTitle: 24, bodyLg: 13.5,
      h3: 26, gsQuote: 18, sectionTitle: 11,
      itemImg: 150, verdictChip: 11,
      altName: 13.5, altMeta: 10.5, altPrice: 13.5, altNote: 11,
      home: 12.5, footer: 10.5, estTag: 9,
      btnPrimary: 15.5, btnPrimarySub: 11, btnSecondary: 14.5, btnGhost: 12.5,
      ctaPadV: 13, ctaPadH: 16, secPadV: 12, ghostPadV: 8,
    };

// ============================================================================
// CONFIGURATION
// ============================================================================

const CURRENCIES = [
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  { code: "ARS", name: "Argentine Peso", symbol: "$", flag: "🇦🇷" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "ATS", name: "Austrian Schilling", symbol: "öS", flag: "🇦🇹" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", flag: "🇨🇭" },
  { code: "CLP", name: "Chilean Peso", symbol: "$", flag: "🇨🇱" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "COP", name: "Colombian Peso", symbol: "$", flag: "🇨🇴" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", flag: "🇨🇿" },
  { code: "DKK", name: "Danish Krone", symbol: "kr", flag: "🇩🇰" },
  { code: "EGP", name: "Egyptian Pound", symbol: "£", flag: "🇪🇬" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", flag: "🇭🇺" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩" },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪", flag: "🇮🇱" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", flag: "🇰🇼" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م.", flag: "🇲🇦" },
  { code: "MOP", name: "Macanese Pataca", symbol: "MOP$", flag: "🇲🇴" },
  { code: "MXN", name: "Mexican Peso", symbol: "$", flag: "🇲🇽" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", flag: "🇳🇴" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/", flag: "🇵🇪" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", flag: "🇵🇭" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", flag: "🇵🇱" },
  { code: "PTG", name: "Portuguese Escudo", symbol: "Esc", flag: "🇵🇹" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", flag: "🇷🇺" },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", flag: "🇸🇦" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$", flag: "🇹🇼" },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "VES", name: "Venezuelan Bolívar", symbol: "Bs.", flag: "🇻🇪" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", flag: "🇻🇳" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
];

// ============================================================================
// FIX: EXCHANGE RATE CACHING SYSTEM - Saves ~$15-40/month
// ============================================================================
const WORKER_URL = 'https://globeskimmers-api.maizasimeon.workers.dev';
const EXCHANGE_RATE_CACHE_KEY = 'globeskimmers_exchange_rates_v2';
const EXCHANGE_RATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ============================================================================
// DAILY USAGE CAPS (free tier)
// ============================================================================
// Why these numbers: see cap analysis in the project thread. Worst-case per
// user per month at the cap: 30 × (10 × $0.011 + 5 × $0.005) = $4.05.
//
// Cap is a hard ceiling on free-tier spend per user and primary defense
// against runaway / abuse scenarios. Premium-tier users will bypass via
// getCaps() — see comment there.
//
// Storage: localStorage keyed by (storage_key, today's YYYY-MM-DD in local
// time). Mirrors the Text Scanner pattern at SmartTextScanner.jsx so the
// helpers are predictable across the app.
const DAILY_SCAN_CAP = 10;
const DAILY_ANALYSIS_CAP = 5;
const STORAGE_KEY_SCAN_COUNT     = 'globeskimmers_price_scan_count';
const STORAGE_KEY_ANALYSIS_COUNT = 'globeskimmers_price_analysis_count';
// Chosen target currency — persisted locally so the choice survives app
// restarts on native (where the Base44 profile write is unavailable).
const STORAGE_KEY_PRICE_CURRENCY = 'globeskimmers_price_scanner_currency';

// Reads count for today from a storage slot. Returns 0 on any error (storage
// disabled, malformed payload, different date). Date check is local-time so
// caps reset at the user's midnight, not UTC.
function readDailyCount(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw);
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    return date === today ? count : 0;
  } catch {
    return 0;
  }
}

function incrementDailyCount(storageKey) {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const current = readDailyCount(storageKey);
    const next = current + 1;
    localStorage.setItem(storageKey, JSON.stringify({ date: today, count: next }));
    return next;
  } catch {
    return 0;
  }
}

// Subscription-aware cap. Today returns the free-tier caps; once Premium
// ships and we set user.subscription_tier='premium', this returns Infinity
// for both and the cap UI disappears for paid users. No other code changes
// needed at that point.
function getCaps(user) {
  if (user?.subscription_tier === 'premium') {
    return { scans: Infinity, analyses: Infinity };
  }
  return { scans: DAILY_SCAN_CAP, analyses: DAILY_ANALYSIS_CAP };
}

const FALLBACK_EXCHANGE_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, CNY: 7.24, KRW: 1320,
  PHP: 56, SGD: 1.35, MYR: 4.7, THB: 36, VND: 24500, IDR: 15500,
  INR: 83, AUD: 1.55, NZD: 1.65, CAD: 1.36, CHF: 0.88, HKD: 7.82,
  TWD: 31.5, AED: 3.67, SAR: 3.75, MXN: 17.5, BRL: 5.0
};

// Get cached exchange rate or fetch from Worker
async function getCachedExchangeRate(fromCurrency, toCurrency) {
  const cacheKey = `${EXCHANGE_RATE_CACHE_KEY}:${fromCurrency}:${toCurrency}`;
  
  try {
    // Check localStorage cache first
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { rate, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      if (age < EXCHANGE_RATE_CACHE_TTL) {
        return rate;
      }
    }
    
    // Try Worker endpoint first (it has server-side KV caching)
    try {
      const response = await fetch(
        `${WORKER_URL}/exchange-rate?from=${fromCurrency}&to=${toCurrency}&amount=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.rate) {
          // Cache locally
          localStorage.setItem(cacheKey, JSON.stringify({
            rate: data.rate,
            timestamp: Date.now()
          }));
          return data.rate;
        }
      }
    } catch (workerError) {
      console.warn('Worker exchange rate failed, trying direct API:', workerError);
    }
    
    // Fallback: Direct API call (if Worker fails)
    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
      if (response.ok) {
        const data = await response.json();
        const rate = data.rates?.[toCurrency];
        if (rate) {
          localStorage.setItem(cacheKey, JSON.stringify({
            rate,
            timestamp: Date.now()
          }));
          return rate;
        }
      }
    } catch (apiError) {
      console.warn('Direct exchange API failed:', apiError);
    }
    
    // Ultimate fallback: Use hardcoded rates
    const fromRate = FALLBACK_EXCHANGE_RATES[fromCurrency] || 1;
    const toRate = FALLBACK_EXCHANGE_RATES[toCurrency] || 1;
    return toRate / fromRate;
    
  } catch (error) {
    console.error('Exchange rate error:', error);
    const fromRate = FALLBACK_EXCHANGE_RATES[fromCurrency] || 1;
    const toRate = FALLBACK_EXCHANGE_RATES[toCurrency] || 1;
    return toRate / fromRate;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SmartPriceScannerPage() {
  const navigate = useNavigate();
  const { activeLocation } = useLocation();
  // Tablet (iPad) gate. EVERY presentation branch below is keyed off this so
  // the phone layout stays byte-identical. No data/handler/state changes.
  const isTablet = useIsTablet();

  const [user, setUser] = useState(null);
  // step values: 'currency' (pick currency) → 'scanning' (live camera OR
  // frozen frame with prices, distinguished by frozenFrame state) →
  // 'itemPhoto' (live camera for photo 2 of the whole item) →
  // 'analysis' (price-analysis card from P2 — alternatives, GS verdict).
  const [step, setStep] = useState('currency');
  const [selectedCurrency, setSelectedCurrency] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_PRICE_CURRENCY) || "USD"; } catch { return "USD"; }
  });
  const [isScanning, setIsScanning] = useState(false);
  const [detectedPrices, setDetectedPrices] = useState([]);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [frozenFrame, setFrozenFrame] = useState(null);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");
  // Price analysis (P2). Loaded lazily when user taps "View Price Analysis".
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  // Daily cap counters (free tier). Loaded from localStorage on mount,
  // incremented on tap (count-on-intent). Re-checked on every action so a
  // tab open since yesterday gets fresh counts after midnight.
  const [scanCount, setScanCount] = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);
  // null | 'scan' | 'analysis' — drives CapHitModal
  const [capHitModal, setCapHitModal] = useState(null);

  // Photo 2 (the whole item) — captured after the price tag is converted, used
  // to identify the item for price comparison and shown in the analysis header.
  const [itemFrame, setItemFrame] = useState(null);
  // True when the item photo (or price-tag scan) didn't clearly show a product,
  // so we honestly say "couldn't identify" instead of fabricating a comparison.
  const [itemNotIdentified, setItemNotIdentified] = useState(false);
  // Analysis-only mode: the user skipped currency conversion and just wants the
  // fair-deal analysis. One scan goes straight to the analysis card (no convert
  // step). Still gated by the daily ANALYSIS cap.
  const [analysisOnly, setAnalysisOnly] = useState(false);
  // Premium waitlist (intro "notify me when available"). One tap captures the
  // email automatically and shows a self-dismissing confirmation toast.
  const [notifyShown, setNotifyShown] = useState(false);

  // Native camera preview — real (iPhone-style) tap-to-focus + pinch-zoom are
  // handled natively by the plugin. Live on the price-tag scan step (before a
  // frame is frozen) and on the item-photo step; the other states show the
  // captured still. cameraReady/cameraError come from the hook (aliased so all
  // existing references keep working).
  const cameraActive = (step === 'scanning' && !frozenFrame) || step === 'itemPhoto';
  const { ready: cameraReady, error: cameraError, capture: capturePhoto, start: startCameraPreview } = useCameraPreview(cameraActive);

  const detectPlatform = () => {
    if (window.Capacitor) {
      return window.Capacitor.isNativePlatform();
    }
    
    if (window.cordova) {
      return true;
    }
    
    const isStandalone = window.navigator.standalone || 
                        window.matchMedia('(display-mode: standalone)').matches;
    
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(userAgent) ||
                     /wv/.test(userAgent) ||
                     /Android.*Version\/\d+\.\d+/i.test(userAgent);
    
    return isStandalone || isWebView;
  };

  useEffect(() => {
    setIsNativeApp(detectPlatform());
    
    loadUser();
    // Seed today's cap counts on mount so the chip + gate are honest from
    // first render. If the user kept the tab open past midnight, the next
    // tap re-reads via readDailyCount and naturally returns 0 for the new day.
    setScanCount(readDailyCount(STORAGE_KEY_SCAN_COUNT));
    setAnalysisCount(readDailyCount(STORAGE_KEY_ANALYSIS_COUNT));
  }, []);

  const loadUser = async () => {
    // Always land on the single compact intro (welcome + currency in one).
    // No first-open-only skip — the intro is identical on every open, so it
    // never "reverts" to a different screen.
    setStep('intro');

    try {
      // Auth is guaranteed by the app-wide sign-in gate; never redirect here.
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.warn("User prefs unavailable:", error?.message || error);
    }
  };

  // ── Freeze & Convert (manual trigger) ─────────────────────────────────────
  // Replaces the previous auto-scan interval. Fires only when the user taps
  // the Freeze CTA, mirroring the Text Scanner pattern. Same backend call
  // (extractPricesFromImage → convertToPreferredCurrency) — just user-gated.
  //
  // Daily cap: counts the user's intent (the tap), not just successes.
  // Failed scans / no-prices-found still consume a slot — this is by design
  // so a frustrated user spamming the button can't bypass the cap.
  const handleFreezeAndConvert = async () => {
    if (isScanning) return;                      // ignore double-taps
    if (!cameraReady) return;
    // Re-read on every tap so a tab kept open past midnight gets fresh counts.
    const liveScans = readDailyCount(STORAGE_KEY_SCAN_COUNT);
    const caps = getCaps(user);
    if (liveScans >= caps.scans) {
      setScanCount(liveScans);  // sync state so the chip reflects reality
      setCapHitModal('scan');
      return;
    }
    // Increment on tap (count-on-intent).
    const nextScans = incrementDailyCount(STORAGE_KEY_SCAN_COUNT);
    setScanCount(nextScans);
    setIsScanning(true);

    try {
      const base64 = await capturePhoto();
      if (!base64) { setIsScanning(false); return; }

      const prices = await extractPricesFromImage(base64);

      if (prices && prices.length > 0) {
        const conversions = await Promise.all(
          prices.map(price => convertToPreferredCurrency(price))
        );

        const filtered = conversions.filter(c => c !== null);

        if (filtered.length > 0) {
          // The native capture already framed the shot (native pinch-zoom),
          // so the frozen still the user sees equals exactly what was analyzed.
          const frozenImageUrl = 'data:image/jpeg;base64,' + base64;

          setFrozenFrame(frozenImageUrl);
          setDetectedPrices(filtered);
          setLastScanTime(new Date());

          // Fire analytics event with USD-normalized amounts so the data is
          // cross-comparable regardless of which target currency the user
          // chose. Each getCachedExchangeRate hits localStorage cache after
          // the first call -- essentially free. Fire-and-forget; never
          // blocks or affects the scan UX.
          try {
            const usdAmounts = await Promise.all(
              filtered.map(async (c) => {
                if (c.original.currency === 'USD') return c.original.amount;
                try {
                  const rate = await getCachedExchangeRate(c.original.currency, 'USD');
                  return c.original.amount * rate;
                } catch {
                  return null;
                }
              })
            );
            logEvent('price_scan', {
              country: activeLocation?.address?.country || null,
              city: activeLocation?.address?.city || null,
              target_currency: selectedCurrency,
              price_count: filtered.length,
              prices: filtered.map((c, i) => ({
                currency: c.original.currency,
                amount: c.original.amount,
                amount_usd: usdAmounts[i] != null ? Number(usdAmounts[i].toFixed(4)) : null,
                context: c.original.context || null,
              })),
            }, 'SmartPriceScanner');
          } catch (e) {
            console.warn('Analytics fire failed (non-fatal):', e);
          }
        }
      }
    } catch (error) {
      console.error("❌ Freeze & convert error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  // Direct call to our Cloudflare Worker → Anthropic Claude Sonnet 4.6 with
  // prompt caching. Skips Base44's InvokeLLM wrapper for visibility into cost,
  // model choice, and caching. No file upload step — image goes straight to
  // the Worker as base64.
  const extractPricesFromImage = async (base64) => {
    try {
      const response = await fetch(`${WORKER_URL}/scan-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' })
      });

      if (!response.ok) {
        console.error('Scanner worker error:', response.status);
        return [];
      }

      const data = await response.json();
      if (data.error) {
        console.error('Scanner worker returned error:', data.error);
        return [];
      }
      return data.prices || [];
    } catch (error) {
      console.error('Price extraction failed:', error);
      return [];
    }
  };

  // ============================================================================
  // FIX: Use cached exchange rates instead of base44.functions.invoke
  // ============================================================================
  const convertToPreferredCurrency = async (detectedPrice) => {
    try {
      const rate = await getCachedExchangeRate(detectedPrice.currency, selectedCurrency);
      const convertedAmount = detectedPrice.amount * rate;

      return {
        original: {
          amount: detectedPrice.amount,
          currency: detectedPrice.currency,
          symbol: detectedPrice.symbol,
          context: detectedPrice.context || "Item"
        },
        converted: {
          amount: convertedAmount.toFixed(2),
          currency: selectedCurrency,
          symbol: getCurrencySymbol(selectedCurrency),
          rate: rate
        }
      };
    } catch (error) {
      console.error("Conversion failed:", error);
      return null;
    }
  };

  const getCurrencySymbol = (code) => {
    const curr = CURRENCIES.find(c => c.code === code);
    return curr ? curr.symbol : code;
  };

  const handleCurrencySelect = (currencyCode) => {
    setSelectedCurrency(currencyCode);
  };

  const handleContinue = () => {
    if (!selectedCurrency) return;

    // Advance to the camera FIRST. The currency preference is saved as a
    // side effect that must NEVER gate opening the camera — on native the
    // Base44 profile write rejects (the app moved off Base44 auth), and the
    // old code awaited it, so the throw skipped setStep and the camera never
    // opened. Persist locally (survives restarts on native), then best-effort
    // sync to Base44 without blocking.
    setAnalysisOnly(false);
    try { localStorage.setItem(STORAGE_KEY_PRICE_CURRENCY, selectedCurrency); } catch { /* private mode */ }
    setStep('scanning');
    Promise.resolve(base44.auth.updateMe({ price_scanner_currency: selectedCurrency }))
      .catch((e) => console.warn('Save currency pref failed (non-fatal):', e?.message || e));
  };

  // "Skip price conversion" — go straight to a scan-and-analyze flow. No
  // currency selection required (analysis uses the price's own currency + the
  // user's home country). Still gated by the daily analysis cap.
  const handleSkipToAnalysis = () => {
    setAnalysisOnly(true);
    setStep('scanning');
  };

  // Premium waitlist: one tap auto-captures the logged-in user's email (from the
  // Supabase session — reliable on native) and logs a 'premium_waitlist'
  // analytics event (persisted in the D1 events DB, queryable for the launch
  // list). Then a confirmation toast that self-dismisses (2s, or tap anywhere).
  const handleNotify = async () => {
    let email = user?.email || null;
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) email = data.user.email;
    } catch { /* ignore — fall back to whatever we have */ }
    try {
      logEvent('premium_waitlist', { email: email || null, source: 'price_scanner_intro' }, 'SmartPriceScanner');
    } catch { /* analytics is best-effort */ }
    setNotifyShown(true);
  };
  useEffect(() => {
    if (!notifyShown) return;
    const t = setTimeout(() => setNotifyShown(false), 2000);
    return () => clearTimeout(t);
  }, [notifyShown]);

  // "Scan another" — drops the frozen frame + cleared prices and returns to
  // the live camera so the user can frame the next item and tap Freeze again.
  // Used from BOTH the post-freeze panel and the analysis card.
  const handleScanAnother = () => {
    setDetectedPrices([]);
    setFrozenFrame(null);
    setItemFrame(null);          // data URL — nothing to revoke
    setAnalysis(null);
    setAnalysisError(null);
    // Dropping frozenFrame flips cameraActive back on, so the hook restarts the
    // native preview (which already resets to 1x zoom on a fresh start).
    setStep('scanning');
  };

  // Exit the scanner entirely. The camera-preview hook stops on unmount; clear
  // state and return the user to Home.
  const handleDone = () => {
    setDetectedPrices([]);
    setFrozenFrame(null);
    setItemFrame(null);          // data URL — nothing to revoke
    setAnalysis(null);
    setAnalysisError(null);
    setAnalysisOnly(false);
    navigate(createPageUrl("Home"));
  };

  // Cached re-view: once the analysis is loaded for this scan, going back and
  // forward is free (no fetch, no slot). Used by the frozen card when an
  // analysis already exists.
  const handleViewAnalysis = () => {
    if (analysis) setStep('analysis');
  };

  // Vision-identify the item from photo 2 so the comparison is about the right
  // product (a bare price tag often has no item name). Best-effort: falls back
  // to the OCR context when /describe-item isn't deployed yet or errors.
  const describeItemFromImage = async (base64) => {
    try {
      const res = await fetch(`${WORKER_URL}/describe-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const itemDescription = (data?.itemDescription || '').trim();
      // Use the Worker's explicit `identified` flag when present (new deploys);
      // fall back to "did we get a description" for older Worker versions so the
      // feature degrades gracefully until the Worker is redeployed.
      const identified = typeof data?.identified === 'boolean' ? data.identified : itemDescription.length > 0;
      return { itemDescription, identified, confidence: data?.confidence || null };
    } catch {
      return null;
    }
  };

  // Fetch alternatives + GS verdict from the Worker /analyze-price endpoint.
  // Caches at the Worker layer keyed by (item description + currency + price
  // bucket + country pair) so repeats of the same product type are free.
  const runAnalysis = async (itemDescription, first) => {
    try {
      const { data, error } = await callWorker(ROUTE.analyzePrice, {
        itemDescription: itemDescription || first?.original?.context || 'Item',
        price: first?.original?.amount,
        currency: first?.original?.currency,
        country: activeLocation?.address?.country || null,
        homeCountry: user?.home_country || null,
      });
      if (error) {
        setAnalysisError(typeof error === 'string' ? error : (error?.message || 'Failed to load analysis'));
      } else if (data?.error) {
        setAnalysisError(data.error);
      } else if (data?.analysis) {
        setAnalysis(data.analysis);
        // Charge an analysis credit ONLY on a successful analysis — failed or
        // not-enough-data attempts must NOT consume one of the daily 5.
        const next = incrementDailyCount(STORAGE_KEY_ANALYSIS_COUNT);
        setAnalysisCount(next);
      } else {
        setAnalysisError('No analysis returned');
      }
      try {
        logEvent('price_analysis_viewed', {
          country: activeLocation?.address?.country || null,
          currency: selectedCurrency,
          item_currency: first?.original?.currency || null,
          cache: data?._cache || (data?.error ? 'error' : 'unknown'),
          paid: data?._cache && data._cache !== 'hit',
          verdict: data?.analysis?.verdict || null,
          comparisonType: data?.analysis?.comparisonType || null,
        }, 'SmartPriceScanner');
      } catch (_e) { /* ignore analytics failure */ }
    } catch (e) {
      setAnalysisError(e?.message || 'Failed to load analysis');
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Smart entry from the "Analyze this price" button. If the price-tag scan
  // already identified the item (meaningful OCR context), analyze right away —
  // no second photo needed. Otherwise we don't have enough to compare, so send
  // the user to the item-photo step to capture the item. The credit is charged
  // later, only on a successful analysis.
  const handleAnalyzeThisPrice = () => {
    const first = detectedPrices[0];
    if (!first || analysisLoading) return;
    const liveAnalyses = readDailyCount(STORAGE_KEY_ANALYSIS_COUNT);
    const caps = getCaps(user);
    if (Number.isFinite(caps.analyses) && liveAnalyses >= caps.analyses) {
      setAnalysisCount(liveAnalyses);
      setCapHitModal('analysis');
      return;
    }
    const ctx = (first.original?.context || '').trim();
    const hasItemInfo = ctx && ctx.toLowerCase() !== 'item' && ctx.length >= 4;
    if (hasItemInfo) {
      // Enough info from the tag scan → analyze directly.
      setStep('analysis');
      setAnalysisLoading(true);
      setAnalysisError(null);
      setItemNotIdentified(false);
      runAnalysis(ctx, first);
    } else {
      // Couldn't read the item from the tag → ask for an item photo.
      setStep('itemPhoto');
    }
  };

  // Photo 2 → price comparison. Captures the whole item, identifies it (vision,
  // with fallback), and runs the analysis. The ANALYSIS credit is charged in
  // runAnalysis on success only.
  const handleCaptureItemPhoto = async () => {
    if (!cameraReady) return;
    if (analysisLoading) return;
    const first = detectedPrices[0];
    if (!first) return;

    const liveAnalyses = readDailyCount(STORAGE_KEY_ANALYSIS_COUNT);
    const caps = getCaps(user);
    if (Number.isFinite(caps.analyses) && liveAnalyses >= caps.analyses) {
      setAnalysisCount(liveAnalyses);
      setCapHitModal('analysis');
      return;
    }

    const base64 = await capturePhoto();
    // Data URL needs no revoke (unlike an object URL), so just swap it in.
    setItemFrame(base64 ? 'data:image/jpeg;base64,' + base64 : null);

    setStep('analysis');
    setAnalysisLoading(true);
    setAnalysisError(null);
    setItemNotIdentified(false);

    let itemDescription = first.original?.context || 'Item';
    if (base64) {
      const vision = await describeItemFromImage(base64);
      if (vision && vision.identified === false) {
        // Honest: the photo doesn't clearly show a product, so we can't compare
        // prices. Don't fabricate a comparison — and don't charge a credit
        // (the credit is only charged inside runAnalysis on success).
        setAnalysis(null);
        setItemNotIdentified(true);
        setAnalysisLoading(false);
        return;
      }
      if (vision && vision.itemDescription) itemDescription = vision.itemDescription;
    }
    await runAnalysis(itemDescription, first);
  };

  // Analysis-only path: one scan of the price tag → straight to the fair-deal
  // analysis (no conversion, no item photo). Uses the tag's own price/currency
  // + OCR context. The ANALYSIS credit is charged in runAnalysis on success.
  const handleScanAndAnalyze = async () => {
    if (isScanning || analysisLoading) return;
    if (!cameraReady) return;

    const liveAnalyses = readDailyCount(STORAGE_KEY_ANALYSIS_COUNT);
    const caps = getCaps(user);
    if (Number.isFinite(caps.analyses) && liveAnalyses >= caps.analyses) {
      setAnalysisCount(liveAnalyses);
      setCapHitModal('analysis');
      return;
    }

    setIsScanning(true);
    try {
      const base64 = await capturePhoto();
      const stillUrl = base64 ? 'data:image/jpeg;base64,' + base64 : null;
      const prices = base64 ? await extractPricesFromImage(base64) : [];

      if (!prices || prices.length === 0) {
        // No price detected (or no capture) — drop into the frozen
        // "no prices" card to retry.
        if (stillUrl) setFrozenFrame(stillUrl);
        setDetectedPrices([]);
        setStep('scanning');
        return;
      }

      const p = prices[0];
      const first = {
        original: { amount: p.amount, currency: p.currency, symbol: p.symbol, context: p.context || 'Item' },
      };
      if (stillUrl) setFrozenFrame(stillUrl);
      setDetectedPrices([first]);

      // Price found → analyze. The analysis credit is charged in runAnalysis on
      // success only, so a no-data result doesn't cost the user a credit.
      setStep('analysis');
      setAnalysisLoading(true);
      setAnalysisError(null);
      setItemNotIdentified(false);

      // This path has only the price tag (no item photo). If the tag scan didn't
      // capture an item name, we can't honestly compare prices — say so instead
      // of fabricating a comparison.
      const ctx = (p.context || '').trim();
      const hasItemInfo = ctx && ctx.toLowerCase() !== 'item' && ctx.length >= 4;
      if (!hasItemInfo) {
        setAnalysis(null);
        setItemNotIdentified(true);
        setAnalysisLoading(false);
        return;
      }
      await runAnalysis(ctx, first);
    } catch (e) {
      setAnalysisError(e?.message || 'Failed to analyze price');
      setStep('analysis');
    } finally {
      setIsScanning(false);
    }
  };

  // ── RENDER: Single compact intro (welcome + currency in one) ─────────────
  // ONE full-screen page so it always fits without scrolling (the button is
  // never below the fold) and is identical on every open — there is no second
  // screen to "revert" to. "Start price scanning" saves the currency and opens
  // the camera. Also handles a stray 'currency' step (e.g. camera-error retry).
  if (step === 'intro' || step === 'currency') {
    return (
      <div className="fixed inset-0 z-[60] font-sans flex flex-col overflow-hidden" style={{ background: IVORY }}>
        {/* Violet gradient header */}
        <div
          className="text-white px-5 rounded-b-[22px] shrink-0"
          style={{
            paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
            paddingBottom: '1.1rem',
            background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 55%, #A855F7 100%)',
            boxShadow: '0 14px 30px -16px rgba(124,58,237,.55)',
          }}
        >
          <div className={`${isTablet ? 'max-w-[680px]' : 'max-w-md'} mx-auto flex items-center justify-between`}>
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity font-semibold text-[calc(14px*var(--fs))]"
            >
              <ChevronLeft size={18} color="#fff" strokeWidth={2.2} />
              <span>Back</span>
            </button>
          </div>
          <div className={`${isTablet ? 'max-w-[680px]' : 'max-w-md'} mx-auto mt-2 text-[calc(22px*var(--fs))] font-extrabold tracking-tight leading-tight`}>
            Smart <span className="font-serif italic font-normal">Price Scanner</span>
          </div>
        </div>

        {/* Body — fits one screen; Start pinned to the bottom. Column widens
            on tablet so it doesn't look stranded at phone width on iPad. */}
        <div
          className={`${isTablet ? 'max-w-[680px]' : 'max-w-md'} w-full mx-auto px-5 pt-5 flex-1 flex flex-col min-h-0`}
          style={{ paddingBottom: 'calc(1.1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="text-center shrink-0">
            <div
              className="w-[60px] h-[60px] mx-auto rounded-[18px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #C5197A 100%)', boxShadow: '0 16px 34px -14px rgba(124,58,237,.6)' }}
            >
              <Tag size={30} color="#fff" strokeWidth={1.8} />
            </div>
            <div className="mt-3 text-[calc(22px*var(--fs))] font-extrabold text-[#0F1419] tracking-tight leading-tight">
              Know what you're paying, <span className="font-serif italic font-normal text-[#7C3AED]">anywhere.</span>
            </div>
            <div className="mt-2 text-[calc(13.5px*var(--fs))] text-[#475569] leading-snug">
              Pick your currency — we'll convert every price you scan and tell you if it's a fair deal.
            </div>
            {/* Daily free caps — shown up front so users know the limits. */}
            <div className="mt-3 inline-block px-3 py-1.5 rounded-full text-[calc(11.5px*var(--fs))] font-semibold" style={{ background: 'rgba(124,58,237,0.10)', color: '#6D28D9' }}>
              🎁 10 price scans + 5 price analyses free every day
            </div>
            {/* Premium teaser — frames the caps kindly + the future unlimited tier. */}
            <div className="mt-2 text-[calc(11.5px*var(--fs))] text-[#64748B] leading-snug">
              Big shopping day? <span className="font-semibold text-[#6D28D9]">Globeskimmers Premium</span> (coming soon) will unlock <span className="font-semibold">unlimited</span> price scans &amp; analyses — and <span className="font-semibold">no ads</span>.
            </div>
            <button onClick={handleNotify} className="mt-1 text-[calc(11.5px*var(--fs))] font-semibold text-[#7C3AED] underline underline-offset-2">
              🔔 Notify me when it's available
            </button>
          </div>

          {/* Currency field */}
          <div className="mt-5 shrink-0">
            <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.14em] uppercase font-semibold text-[#6B7280] mb-1.5 px-1">
              Convert prices to
            </div>
            <div className="px-3.5 py-3 rounded-[14px]" style={{ background: '#fff', border: '1px solid #F0E9DC' }}>
              <Select value={selectedCurrency} onValueChange={handleCurrencySelect}>
                <SelectTrigger className="w-full h-12 text-[calc(15px*var(--fs))] border-gray-300 rounded-[12px]">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      <div className="flex items-center justify-between w-full gap-3">
                        <span>{currency.symbol} - {currency.code} - {currency.name}</span>
                        <span className="text-xl">{currency.flag}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Start — pinned to the bottom of the screen */}
          <button
            onClick={handleContinue}
            disabled={!selectedCurrency}
            className="mt-auto w-full h-[54px] rounded-[16px] text-white flex items-center justify-center gap-2 font-bold text-[calc(15.5px*var(--fs))] disabled:opacity-50"
            style={{ background: '#0F1419', boxShadow: '0 12px 28px -14px rgba(15,20,25,.4)' }}
          >
            Start price scanning
            <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
          </button>
          {/* Skip conversion → straight to a fair-deal price analysis */}
          <button
            onClick={handleSkipToAnalysis}
            className="w-full mt-3 text-[#7C3AED] hover:text-[#5B21B6] text-[calc(13px*var(--fs))] font-semibold transition-colors"
          >
            Skip conversion — just analyze a price →
          </button>
          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="w-full mt-2 text-[#94A3B8] hover:text-[#475569] text-[calc(11.5px*var(--fs))] font-normal transition-colors"
          >
            Back to Home
          </button>
        </div>

        {/* Premium waitlist confirmation — self-dismisses after 2s or on tap. */}
        {notifyShown && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center px-8"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setNotifyShown(false)}
          >
            <div className="rounded-[20px] px-6 py-5 text-center" style={{ background: '#fff', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.4)' }}>
              <div className="text-[calc(34px*var(--fs))]">🎉</div>
              <div className="mt-1 text-[calc(18px*var(--fs))] font-extrabold text-[#0F1419]">You're on the list!</div>
              <div className="mt-1 text-[calc(12.5px*var(--fs))] text-[#475569]">We'll email you when Premium launches.</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center pointer-events-auto">
          <div className="text-6xl mb-4">📱</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Rear Camera Required</h2>
          <p className="text-gray-600 mb-4">{cameraError.message}</p>
          
          <div className="bg-gray-100 rounded-lg p-3 mb-4 text-left">
            <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap">{debugInfo}</p>
            {cameraError.details && (
              <p className="text-xs font-mono text-red-600 mt-2">
                {cameraError.details.name}: {cameraError.details.message}
              </p>
            )}
          </div>
          
          <div className="space-y-3">
            <Button
              onClick={() => startCameraPreview()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            
            <Button
              onClick={() => setStep('currency')}
              variant="outline"
              className="w-full"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Camera + Frozen + Analysis page ───────────────────────────────────────
  // Reached when step === 'scanning' (live camera or frozen frame) or
  // step === 'analysis' (frozen frame with analysis card overlay).
  // Three visual states distinguished by frozenFrame + step:
  //   A. Live camera        → step==='scanning' && !frozenFrame
  //   B. Frozen w/ prices   → step==='scanning' && frozenFrame
  //   C. Analysis card      → step==='analysis'  (always frozen underneath)
  const isLive      = step === 'scanning' && !frozenFrame;
  const isFrozen    = step === 'scanning' && !!frozenFrame;
  const isItemPhoto = step === 'itemPhoto';
  const isAnalysis  = step === 'analysis';

  // Phone/tablet editorial size scale for the result + analysis chrome. Pure
  // presentation — picks tuned values per viewport; no data/handler changes.
  const ed = edScale(isTablet);

  // X-button behavior: live → home, item-photo → back to the result card,
  // frozen → unfreeze to live, analysis → back to the result card.
  const handleClose = () => {
    if (isAnalysis) {
      setStep('scanning');
    } else if (isItemPhoto) {
      setStep('scanning');
    } else if (isFrozen) {
      setDetectedPrices([]);
      setFrozenFrame(null);
    } else {
      handleDone();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden pointer-events-none" style={{ background: 'transparent' }}>
      {/* The live preview is the NATIVE camera-preview layer rendered BEHIND
          this transparent page. pointer-events-none here lets taps + pinches
          fall through to the native preview so real tap-to-focus and pinch-zoom
          work; each control below re-enables pointer-events on itself. The
          frozen still is a normal <img> that covers the preview once captured. */}
      {/* Frozen still shows under the result + analysis cards. NOT during the
          item-photo step, which needs the live camera even though a price-tag
          frozenFrame still exists in state. */}
      {frozenFrame && (isFrozen || isAnalysis) && (
        <img
          src={frozenFrame}
          alt="Frozen frame"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* TOP CHROME — X button + debug pill */}
      <div
        className="absolute top-0 left-0 right-0 z-30 px-4 pb-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className="flex justify-between items-center">
          <button
            onClick={handleClose}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          {/* Top-right slot: scan-counter chip when the user is in their
              last 5 scans of the day (so casual users never see it),
              otherwise the existing debug pill. Color escalates as the
              cap approaches: grey > amber (≤2) > red (0 — button disabled). */}
          {(() => {
            const caps = getCaps(user);
            // Analysis-only mode tracks the ANALYSIS cap (5/day) instead of scans.
            if (analysisOnly) {
              const analysesLeft = Math.max(0, caps.analyses - analysisCount);
              if (!isLive || !Number.isFinite(caps.analyses)) return null;
              const palette =
                analysesLeft === 0 ? { bg: '#DC2626', color: '#FFFFFF' } :
                analysesLeft <= 1  ? { bg: '#F59E0B', color: '#FFFFFF' } :
                                     { bg: 'rgba(255,255,255,0.22)', color: '#FFFFFF' };
              return (
                <div className="backdrop-blur-md px-3 py-1 rounded-full" style={{ background: palette.bg }}>
                  <p className="text-xs font-bold" style={{ color: palette.color }}>
                    {analysesLeft} of {caps.analyses} analyses left today
                  </p>
                </div>
              );
            }
            const scansLeft = Math.max(0, caps.scans - scanCount);
            const showCounter = isLive && Number.isFinite(caps.scans) && scansLeft <= 5;
            if (showCounter) {
              const palette =
                scansLeft === 0  ? { bg: '#DC2626', color: '#FFFFFF' } :
                scansLeft <= 2   ? { bg: '#F59E0B', color: '#FFFFFF' } :
                                   { bg: 'rgba(255,255,255,0.22)', color: '#FFFFFF' };
              return (
                <div className="backdrop-blur-md px-3 py-1 rounded-full" style={{ background: palette.bg }}>
                  <p className="text-xs font-bold" style={{ color: palette.color }}>
                    {scansLeft} of {caps.scans} scans left today
                  </p>
                </div>
              );
            }
            if (debugInfo && isLive) {
              return (
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                  <p className="text-white text-xs">{debugInfo}</p>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* LIVE CAMERA — gentle instruction text only (no auto-scan). The user
          taps the bottom Freeze CTA when ready, mirroring Text Scanner. */}
      {isLive && (
        <div className="absolute left-0 right-0 z-10 flex justify-center pointer-events-none px-6" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
          <div
            className={isTablet
              ? "inline-flex items-center gap-2 rounded-full text-white text-center uppercase"
              : "inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-[calc(14px*var(--fs))] font-medium text-center"}
            style={isTablet
              ? { background: TEAL_DEEP, fontFamily: ED_MONO, fontSize: fs(12), letterSpacing: ".06em", fontWeight: 500, padding: `${fs(9)} ${fs(18)}` }
              : { background: 'rgba(0,0,0,0.55)' }}
          >
            {analysisOnly ? '👉 Point at the price tag to analyze · pinch to zoom' : '👉 Point at the price tag · pinch to zoom'}
          </div>
        </div>
      )}

      {/* ITEM PHOTO (photo 2) — instruction to frame the whole item */}
      {isItemPhoto && (
        <div className="absolute left-0 right-0 z-10 flex justify-center pointer-events-none px-6" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
          <div
            className={isTablet
              ? "inline-flex items-center gap-2 rounded-full text-white text-center uppercase"
              : "inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-[calc(14px*var(--fs))] font-medium text-center"}
            style={isTablet
              ? { background: TEAL_DEEP, fontFamily: ED_MONO, fontSize: fs(12), letterSpacing: ".06em", fontWeight: 500, padding: `${fs(9)} ${fs(18)}` }
              : { background: 'rgba(0,0,0,0.55)' }}
          >
            📸 Point at the whole item so we can compare prices
          </div>
        </div>
      )}

      {/* LIVE CAMERA — Freeze CTA at bottom. When the daily scan cap is
          hit, the button stays tappable but its label flips and the tap
          opens the CapHitModal (gating is done inside handleFreezeAndConvert
          so we don't need to disable here — disabling would lose the
          upgrade-nudge opportunity). */}
      {isLive && (() => {
        const caps = getCaps(user);
        // Analysis-only mode: one tap scans + analyzes (gated by the analysis
        // cap). Normal mode: freeze + convert (gated by the scan cap).
        if (analysisOnly) {
          const analysisCapHit = Number.isFinite(caps.analyses) && analysisCount >= caps.analyses;
          return (
            <div
              className="absolute bottom-0 left-0 right-0 z-20 px-5 pt-6 bg-gradient-to-t from-black/70 to-transparent pointer-events-auto"
              style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={analysisCapHit ? () => setCapHitModal('analysis') : handleScanAndAnalyze}
                disabled={!cameraReady || isScanning}
                className="w-full py-4 rounded-[18px] text-white font-bold text-[calc(16px*var(--fs))] flex items-center justify-center gap-2 shadow-lg transition-opacity disabled:opacity-50"
                style={{
                  background: analysisCapHit
                    ? 'linear-gradient(135deg,#475569 0%,#64748B 100%)'
                    : 'linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)',
                }}
              >
                {!cameraReady
                  ? <>📷 Starting rear camera…</>
                  : isScanning
                    ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing price…</>
                    : analysisCapHit
                      ? <>🔒 Daily analysis limit reached</>
                      : <>🔍 Scan &amp; analyze price</>}
              </button>
            </div>
          );
        }
        const scanCapHit = Number.isFinite(caps.scans) && scanCount >= caps.scans;
        return (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 px-5 pt-6 bg-gradient-to-t from-black/70 to-transparent pointer-events-auto"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={handleFreezeAndConvert}
              disabled={!cameraReady || isScanning}
              className="w-full py-4 rounded-[18px] text-white font-bold text-[calc(16px*var(--fs))] flex items-center justify-center gap-2 shadow-lg transition-opacity disabled:opacity-50"
              style={{
                background: scanCapHit
                  ? 'linear-gradient(135deg,#475569 0%,#64748B 100%)'
                  : 'linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)',
              }}
            >
              {!cameraReady
                ? <>📷 Starting rear camera…</>
                : isScanning
                  ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Scanning prices…</>
                  : scanCapHit
                    ? <>🔒 Daily scan limit reached</>
                    : <>🧊 Freeze &amp; convert price</>}
            </button>
          </div>
        );
      })()}

      {/* ITEM PHOTO — bottom CTA: capture photo 2 of the whole item, then run
          the price comparison (identifies the item via vision, with fallback). */}
      {isItemPhoto && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 px-5 pt-6 bg-gradient-to-t from-black/70 to-transparent pointer-events-auto"
          style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleCaptureItemPhoto}
            disabled={!cameraReady || analysisLoading}
            className="w-full py-4 rounded-[18px] text-white font-bold text-[calc(16px*var(--fs))] flex items-center justify-center gap-2 shadow-lg transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)' }}
          >
            {!cameraReady
              ? <>📷 Starting camera…</>
              : analysisLoading
                ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing…</>
                : <>📷 Capture item &amp; compare</>}
          </button>
        </div>
      )}

      {/* FROZEN STATE — show detected prices + 3 buttons.
          Editorial ivory result card on BOTH phone and tablet: Instrument
          Serif converted price + teal accent, soft white inner cards, hairline
          rule. Sizes/widths come from `ed` (phone-tuned vs tablet). The action
          buttons keep identical gating logic and are themed inline. The frozen
          still beneath is untouched — this is the non-camera chrome only. */}
      {isFrozen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md pointer-events-auto"
            style={{
              maxWidth: ed.cardMaxW,
              minHeight: fs(120),
              padding: fs(ed.cardPad),
              borderRadius: ed.cardRadius,
              background: ED_IVORY,
              border: `1px solid ${ED_RULE}`,
              boxShadow: "0 30px 60px -28px rgba(22,17,13,.55)",
            }}
          >
            {detectedPrices.length > 0 ? (
              <>
                <p className="uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(ed.kicker), letterSpacing: ed.kickerLs, color: ED_TEAL, fontWeight: 600 }}>
                  Converted price
                </p>
                <div className="mt-4 space-y-4 overflow-y-auto" style={{ maxHeight: isTablet ? undefined : "52vh" }}>
                  {detectedPrices.map((conversion, index) => (
                    <div key={index} style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, borderRadius: ed.innerRadius, padding: fs(ed.innerPad) }}>
                      {conversion.original.context && (
                        <p className="uppercase mb-3 line-clamp-2" style={{ fontFamily: ED_MONO, fontSize: fs(ed.ctxKicker), letterSpacing: ".06em", color: ED_INK3 }}>
                          {conversion.original.context}
                        </p>
                      )}
                      <div className="flex items-end justify-between gap-4 flex-wrap">
                        <div>
                          <p className="uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".08em", color: ED_INK3 }}>Original</p>
                          <p style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(ed.origAmt), color: ED_INK2, lineHeight: 1.05, marginTop: fs(4) }}>
                            {conversion.original.symbol}{conversion.original.amount.toLocaleString()}
                            <span style={{ fontFamily: ED_MONO, fontSize: fs(ed.origCur), color: ED_INK3, marginLeft: fs(8) }}>{conversion.original.currency}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(ed.heroLabel), letterSpacing: ".08em", color: ED_TEAL }}>Your currency</p>
                          <p style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(ed.hero), color: ED_TEAL, lineHeight: 1.0, marginTop: fs(2) }}>
                            {conversion.converted.symbol}{parseFloat(conversion.converted.amount).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ marginBottom: fs(8) }}>
                <p className="uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(ed.kicker), letterSpacing: ed.kickerLs, color: ED_INK3, fontWeight: 600 }}>No prices found</p>
                <p className="line-clamp-2" style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(ed.noPriceTitle), color: ED_INK, lineHeight: 1.08, marginTop: fs(8) }}>
                  Couldn&apos;t read a price tag
                </p>
                <p style={{ fontSize: fs(ed.bodyLg), color: ED_INK3, marginTop: fs(8), lineHeight: 1.5 }}>
                  Try framing the price tag more clearly, then tap Scan another.
                </p>
              </div>
            )}

            <div className="space-y-2.5" style={{ marginTop: fs(20) }}>
              {/* View price analysis — only meaningful when we have a price.
                  The button stays tappable when capped; gating happens
                  inside handleViewAnalysis so a tap shows the cap-hit
                  modal (upgrade nudge) instead of being a dead button. */}
              {detectedPrices.length > 0 && (() => {
                const caps = getCaps(user);
                const analysesLeft = Math.max(0, caps.analyses - analysisCount);
                const analysisCapHit = Number.isFinite(caps.analyses) && analysesLeft === 0 && !analysis;
                return (
                  <>
                    {/* Counter line. Always shown so users learn the cadence
                        early. Grey by default, amber at ≤1 left, coral at 0. */}
                    {Number.isFinite(caps.analyses) && (
                      <div
                        className="text-center uppercase mb-1"
                        style={{
                          fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".06em",
                          color: analysesLeft === 0 ? '#B91C1C' : analysesLeft <= 1 ? '#B45309' : ED_INK3,
                        }}>
                        {analysesLeft} of {caps.analyses} analyses left today
                      </div>
                    )}
                    {/* Prompt so the analyze option is obvious after a scan. */}
                    {!analysis && !analysisCapHit && (
                      <div className="text-center mb-1" style={{ fontSize: fs(ed.bodyLg), color: ED_INK3 }}>
                        Is this a fair price? Find out 👇
                      </div>
                    )}
                    <button
                      onClick={
                        analysis
                          ? handleViewAnalysis
                          : analysisCapHit
                            ? () => setCapHitModal('analysis')
                            : handleAnalyzeThisPrice
                      }
                      className="w-full text-white flex flex-col items-center justify-center transition-opacity hover:opacity-90"
                      style={{
                        background: (analysisCapHit && !analysis) ? ED_INK3 : ED_TEAL,
                        borderRadius: 16, padding: `${fs(ed.ctaPadV)} ${fs(ed.ctaPadH)}`, fontWeight: 600,
                      }}
                    >
                      {analysis ? (
                        <span className="flex items-center gap-2" style={{ fontSize: fs(ed.btnPrimary) }}>💡 View price analysis</span>
                      ) : analysisCapHit ? (
                        <span className="flex items-center gap-2" style={{ fontSize: fs(ed.btnPrimary) }}>🔒 Daily analysis limit reached</span>
                      ) : (
                        <>
                          <span className="flex items-center gap-2" style={{ fontSize: fs(ed.btnPrimary) }}>💡 Analyze this price</span>
                          <span className="font-normal opacity-85" style={{ fontSize: fs(ed.btnPrimarySub) }}>snap the item to compare prices</span>
                        </>
                      )}
                    </button>
                  </>
                );
              })()}
              <button
                onClick={handleScanAnother}
                className="w-full flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: ED_IVORY2, color: ED_INK2, borderRadius: 16,
                  padding: `${fs(ed.secPadV)} ${fs(ed.ctaPadH)}`, fontWeight: 600, fontSize: fs(ed.btnSecondary),
                }}
              >
                <Camera className="w-4 h-4" />
                Scan another
              </button>
              <button
                onClick={handleDone}
                className="w-full transition-colors hover:opacity-80"
                style={{ color: ED_INK3, fontSize: fs(ed.btnGhost), fontWeight: 500, padding: `${fs(ed.ghostPadV)} 0` }}
              >
                🏠 Done
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ANALYSIS CARD — fetched lazily on first View Analysis tap.
          Editorial ivory card on BOTH phone and tablet (serif heading, mono
          kickers, tinted chips, soft white inner cards). Sizes from `ed`. */}
      {isAnalysis && (
        <div className="absolute inset-0 z-10 flex items-start justify-center px-4 pt-16 pb-8 overflow-y-auto pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md pointer-events-auto"
            style={{
              maxWidth: ed.analysisMaxW,
              padding: fs(ed.cardPad),
              borderRadius: ed.cardRadius,
              background: ED_IVORY,
              border: `1px solid ${ED_RULE}`,
              boxShadow: "0 30px 60px -28px rgba(22,17,13,.55)",
            }}
          >
            <p className="uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(ed.kicker), letterSpacing: ed.kickerLs, color: ED_TEAL, fontWeight: 600 }}>Price analysis</p>
            <h3 className="line-clamp-2" style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(ed.h3), color: ED_INK, lineHeight: 1.06, margin: `${fs(4)} 0 ${fs(12)}` }}>Is this a fair deal?</h3>
            {itemFrame && (
              <img
                src={itemFrame}
                alt="Item"
                className="w-full object-cover"
                style={{ height: fs(ed.itemImg), borderRadius: ed.innerRadius, marginBottom: fs(16), border: `1px solid ${ED_RULE}` }}
              />
            )}
            {detectedPrices[0]?.original?.context && (
              <p
                className="uppercase mb-3 line-clamp-2"
                style={{ fontFamily: ED_MONO, fontSize: fs(ed.ctxKicker), letterSpacing: ".06em", color: ED_INK3 }}
              >{detectedPrices[0].original.context}</p>
            )}

            {analysisLoading && (
              <div className="text-center" style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, borderRadius: ed.innerRadius, padding: fs(24), marginBottom: fs(16) }}>
                <div className="mx-auto rounded-full animate-spin" style={{ width: fs(40), height: fs(40), marginBottom: fs(12), border: `3px solid ${ED_IVORY2}`, borderTopColor: ED_TEAL }} />
                <p style={{ fontSize: fs(ed.bodyLg), color: ED_INK3 }}>Analyzing similar items at nearby stores…</p>
              </div>
            )}

            {analysisError && !analysisLoading && (
              <div style={{ background: "#FBEAEA", border: "1px solid rgba(185,28,28,.25)", borderRadius: 16, padding: fs(16), marginBottom: fs(16) }}>
                <p style={{ fontSize: fs(ed.bodyLg), color: "#991B1B", lineHeight: 1.5 }}>Couldn&apos;t load analysis: {analysisError}</p>
              </div>
            )}

            {/* Honest "couldn't identify the item" state — shown instead of a
                fabricated comparison when the photo/scan didn't clearly show a
                product. No analysis credit is charged in this case. */}
            {itemNotIdentified && !analysisLoading && (
              <div style={{ marginBottom: fs(20) }}>
                <div style={{ marginBottom: fs(12) }}>
                  <span className="inline-block uppercase" style={{
                    background: '#FEF3C7', color: '#92400E',
                    fontFamily: ED_MONO, fontSize: fs(ed.verdictChip), letterSpacing: ".06em", fontWeight: 600,
                    padding: `${fs(6)} ${fs(14)}`, borderRadius: 999,
                  }}>
                    ❓ Couldn&apos;t identify the item
                  </span>
                </div>
                <p style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(ed.gsQuote), color: ED_INK, lineHeight: 1.3, marginBottom: fs(12) }}>
                  We couldn&apos;t clearly see the item, so we can&apos;t compare prices without guessing.
                </p>
                <p style={{ fontSize: fs(ed.footer), color: ED_INK3, lineHeight: 1.5 }}>
                  Point the camera at the whole item — not just the price tag — and tap “Scan another item” to try again.
                </p>
              </div>
            )}

            {analysis && !analysisLoading && (
              <div style={{ marginBottom: fs(20) }}>
                {/* Verdict chip */}
                <div style={{ marginBottom: fs(12) }}>
                  <span className="inline-block uppercase" style={{
                    background: verdictBg(analysis.verdict),
                    color: verdictFg(analysis.verdict),
                    fontFamily: ED_MONO, fontSize: fs(ed.verdictChip), letterSpacing: ".06em", fontWeight: 600,
                    padding: `${fs(6)} ${fs(14)}`, borderRadius: 999,
                  }}>
                    {analysis.verdictBadge}
                  </span>
                </div>

                {/* GS Verdict sentence — serif pull-quote */}
                {analysis.gsVerdict && (
                  <p style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(ed.gsQuote), color: ED_INK, lineHeight: 1.3, marginBottom: fs(18) }}>{analysis.gsVerdict}</p>
                )}

                {/* Alternatives — soft white inner card with hairline rule. */}
                {analysis.alternatives && analysis.alternatives.length > 0 && (
                  <div style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, borderRadius: ed.innerRadius, padding: fs(ed.innerPad), marginBottom: fs(12) }}>
                    <div className="uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(ed.sectionTitle), letterSpacing: ".06em", color: ED_INK3, fontWeight: 600, marginBottom: fs(8) }}>
                      {analysis.comparisonType === 'similar_style'
                        ? <>🎨 Comparable handcrafted / look-alike pieces</>
                        : <>Similar items nearby</>}
                      <span className="ml-2 inline-block" style={{ background: '#FEF3C7', color: '#92400E', fontFamily: ED_MONO, fontSize: fs(ed.estTag), fontWeight: 600, padding: `${fs(2)} ${fs(6)}`, borderRadius: 6 }}>estimated</span>
                    </div>
                    {analysis.comparisonType === 'similar_style' && (
                      <div style={{ fontSize: fs(ed.altNote), color: ED_INK3, marginBottom: fs(8), lineHeight: 1.5 }}>
                        Exact item isn&apos;t typically sold at chain stores. These are similar in style / category at places that sell comparable handcrafted pieces.
                      </div>
                    )}
                    <ul className="space-y-2">
                      {analysis.alternatives.map((a, i) => (
                        <li key={i} style={{ fontSize: fs(ed.altName), color: ED_INK2 }}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span style={{ fontWeight: 600, color: ED_INK }}>{a.store}</span>
                              <span className="ml-2" style={{ fontFamily: ED_MONO, fontSize: fs(ed.altMeta), color: ED_INK3 }}>{a.scope === 'online' ? '🌐 online' : '📍 local'}</span>
                            </div>
                            <div className="whitespace-nowrap" style={{ color: ED_TEAL, fontWeight: 700, fontSize: fs(ed.altPrice) }}>{a.priceRange}</div>
                          </div>
                          {a.note && <div style={{ fontSize: fs(ed.altNote), color: ED_INK3, marginTop: fs(2) }}>{a.note}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Home country reference */}
                {analysis.homeReference && (
                  <div style={{ background: ED_IVORY2, borderRadius: 16, padding: fs(14), marginBottom: fs(12), color: ED_INK2, fontSize: fs(ed.home), lineHeight: 1.5 }}>
                    🏠 {analysis.homeReference}
                    <span className="ml-2 inline-block align-middle" style={{ background: '#FEF3C7', color: '#92400E', fontFamily: ED_MONO, fontSize: fs(ed.estTag), fontWeight: 600, padding: `${fs(2)} ${fs(6)}`, borderRadius: 6 }}>estimated</span>
                  </div>
                )}

                {/* Honesty footer */}
                <p style={{ fontSize: fs(ed.footer), color: ED_INK3, lineHeight: 1.5 }}>
                  Price ranges are estimates based on typical store pricing — not live data. Verify before purchase.
                </p>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={handleScanAnother}
                className="w-full flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ background: ED_TEAL, color: "#FFFFFF", borderRadius: 16, padding: `${fs(ed.secPadV)} ${fs(ed.ctaPadH)}`, fontWeight: 600, fontSize: fs(ed.btnSecondary) }}
              >
                <Camera className="w-4 h-4" />
                Scan another item
              </button>
              <button
                onClick={handleDone}
                className="w-full transition-colors hover:opacity-80"
                style={{ color: ED_INK3, fontSize: fs(ed.btnGhost), fontWeight: 500, padding: `${fs(ed.ghostPadV)} 0` }}
              >
                🏠 Done
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* CAP-HIT MODAL — single component used for both scan + analysis caps.
          Renders on top of everything (z-50) so the user sees it whether
          they're on the live camera or the freeze panel. The Premium
          button is a placeholder until Stripe / subscription wiring lands. */}
      {capHitModal && (
        <CapHitModal
          type={capHitModal}
          onClose={() => setCapHitModal(null)}
          onGoHome={() => { setCapHitModal(null); handleDone(); }}
        />
      )}
    </div>
  );
}

// Reusable cap-hit modal. type='scan' for the 10-scan cap, type='analysis'
// for the 5-analysis cap. The copy + cap-number changes per type; the
// Premium CTA is identical. Placeholder onClick on Premium button until
// the subscription flow exists.
function CapHitModal({ type, onClose, onGoHome }) {
  const isScan = type === 'scan';
  const cap = isScan ? DAILY_SCAN_CAP : DAILY_ANALYSIS_CAP;
  const what = isScan ? 'price scans' : 'price analyses';
  const icon = isScan ? '📸' : '💡';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5 pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-3 text-center">{icon}</div>
        <h3 className="text-[calc(19px*var(--fs))] font-bold text-gray-900 mb-2 text-center leading-snug">
          You've used today's {cap} free {what}
        </h3>
        <p className="text-[calc(14px*var(--fs))] text-gray-600 mb-5 leading-relaxed text-center">
          Your free daily {what} reset at <strong>midnight your local time</strong>. Or unlock unlimited with <strong>Globeskimmers Premium, launching soon</strong>.
        </p>
        <button
          type="button"
          onClick={() => { /* Premium flow lands later — button is a soft "coming soon" placeholder for now, no false promise it does anything today */ }}
          className="w-full text-white font-bold py-3 rounded-xl mb-2 transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)' }}
        >
          ✨ Get Globeskimmers Premium — coming soon
        </button>
        <button
          type="button"
          onClick={onGoHome}
          className="w-full text-gray-500 text-[calc(13px*var(--fs))] mt-1 hover:text-gray-700"
        >
          🏠 Back to Home
        </button>
      </div>
    </div>
  );
}

// Verdict pill palette. Order matters for fallback through unknown.
function verdictBg(v) {
  switch (v) {
    case 'great_deal': return '#DCFCE7';
    case 'fair_price': return '#DBEAFE';
    case 'pricey':     return '#FEF3C7';
    default:           return '#F1F5F9';
  }
}
function verdictFg(v) {
  switch (v) {
    case 'great_deal': return '#166534';
    case 'fair_price': return '#1E40AF';
    case 'pricey':     return '#92400E';
    default:           return '#475569';
  }
}
