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
import { IVORY } from "@/components/redesign/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "@/components/location/LocationContext";
import { logEvent } from "@/lib/analytics";
import { useCameraPreview } from "@/lib/useCameraPreview";

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
        console.log(`📦 Exchange rate cache hit: ${fromCurrency} -> ${toCurrency}`);
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
          console.log(`💾 Cached exchange rate: ${fromCurrency} -> ${toCurrency} = ${data.rate}`);
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
    console.log("📸 Freeze & convert tapped...");
    setIsScanning(true);

    try {
      const base64 = await capturePhoto();
      if (!base64) { setIsScanning(false); return; }

      const prices = await extractPricesFromImage(base64);
      console.log("💰 Extracted prices:", prices);

      if (prices && prices.length > 0) {
        const conversions = await Promise.all(
          prices.map(price => convertToPreferredCurrency(price))
        );

        const filtered = conversions.filter(c => c !== null);
        console.log("💱 Converted prices:", filtered);

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
      const desc = (data?.itemDescription || '').trim();
      return desc || null;
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

    let itemDescription = first.original?.context || 'Item';
    if (base64) {
      const visionDesc = await describeItemFromImage(base64);
      if (visionDesc) itemDescription = visionDesc;
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
      await runAnalysis(p.context || 'Item', first);
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
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity font-semibold text-[calc(14px*var(--fs))]"
            >
              <ChevronLeft size={18} color="#fff" strokeWidth={2.2} />
              <span>Back</span>
            </button>
          </div>
          <div className="max-w-md mx-auto mt-2 text-[calc(22px*var(--fs))] font-extrabold tracking-tight leading-tight">
            Smart <span className="font-serif italic font-normal">Price Scanner</span>
          </div>
        </div>

        {/* Body — fits one screen; Start pinned to the bottom */}
        <div
          className="max-w-md w-full mx-auto px-5 pt-5 flex-1 flex flex-col min-h-0"
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-[calc(14px*var(--fs))] font-medium text-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
            {analysisOnly ? '👉 Point at the price tag to analyze · pinch to zoom' : '👉 Point at the price tag · pinch to zoom'}
          </div>
        </div>
      )}

      {/* ITEM PHOTO (photo 2) — instruction to frame the whole item */}
      {isItemPhoto && (
        <div className="absolute left-0 right-0 z-10 flex justify-center pointer-events-none px-6" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-[calc(14px*var(--fs))] font-medium text-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
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

      {/* FROZEN STATE — show detected prices + 3 buttons */}
      {isFrozen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/85 backdrop-blur-md rounded-2xl p-6 max-w-sm w-full pointer-events-auto"
          >
            {detectedPrices.length > 0 ? (
              <>
                <h3 className="text-white font-bold text-lg mb-4">✓ Prices Detected</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                  {detectedPrices.map((conversion, index) => (
                    <div key={index} className="bg-white/10 rounded-xl p-4">
                      {conversion.original.context && (
                        <p className="text-white/70 text-sm mb-2">{conversion.original.context}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/80 text-sm">Original</p>
                          <p className="text-white font-semibold">
                            {conversion.original.symbol}{conversion.original.amount.toLocaleString()} {conversion.original.currency}
                          </p>
                        </div>
                        <div className="text-green-400 text-xl mx-3">→</div>
                        <div className="text-right">
                          <p className="text-white/80 text-sm">Your Currency</p>
                          <p className="text-green-400 font-bold text-xl">
                            {conversion.converted.symbol}{parseFloat(conversion.converted.amount).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mb-4">
                <h3 className="text-white font-bold text-lg mb-2">No prices found</h3>
                <p className="text-white/70 text-sm">Try framing the price tag more clearly and tap Scan another.</p>
              </div>
            )}

            <div className="space-y-2">
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
                      <div className="text-center text-[calc(11px*var(--fs))] font-medium mb-1" style={{
                        color: analysesLeft === 0 ? '#FCA5A5' : analysesLeft <= 1 ? '#FCD34D' : 'rgba(255,255,255,0.5)',
                      }}>
                        {analysesLeft} of {caps.analyses} analyses left today
                      </div>
                    )}
                    {/* Prompt so the analyze option is obvious after a scan. */}
                    {!analysis && !analysisCapHit && (
                      <div className="text-center text-white/70 text-[calc(12px*var(--fs))] mb-1">
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
                      className="w-full text-white font-bold py-3 rounded-xl flex flex-col items-center justify-center transition-colors"
                      style={{ background: (analysisCapHit && !analysis) ? '#475569' : '#7C3AED' }}
                    >
                      {analysis ? (
                        <span className="flex items-center gap-2">💡 View price analysis</span>
                      ) : analysisCapHit ? (
                        <span className="flex items-center gap-2">🔒 Daily analysis limit reached</span>
                      ) : (
                        <>
                          <span className="flex items-center gap-2 text-[calc(15.5px*var(--fs))]">💡 Analyze this price</span>
                          <span className="text-[calc(11px*var(--fs))] font-normal opacity-85">snap the item to compare prices</span>
                        </>
                      )}
                    </button>
                  </>
                );
              })()}
              <button
                onClick={handleScanAnother}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Scan another
              </button>
              <button
                onClick={handleDone}
                className="w-full text-white/70 hover:text-white text-sm font-medium py-2 transition-colors"
              >
                🏠 Done
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ANALYSIS CARD — fetched lazily on first View Analysis tap. */}
      {isAnalysis && (
        <div className="absolute inset-0 z-10 flex items-start justify-center px-4 pt-16 pb-8 overflow-y-auto pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/90 backdrop-blur-md rounded-2xl p-6 max-w-sm w-full pointer-events-auto"
          >
            <h3 className="text-white font-bold text-lg mb-2">💡 Price Analysis</h3>
            {itemFrame && (
              <img src={itemFrame} alt="Item" className="w-full h-32 object-cover rounded-xl mb-3" />
            )}
            {detectedPrices[0]?.original?.context && (
              <p className="text-white/70 text-[calc(13px*var(--fs))] mb-3">{detectedPrices[0].original.context}</p>
            )}

            {analysisLoading && (
              <div className="bg-white/10 rounded-xl p-5 mb-4 text-center">
                <div className="w-10 h-10 mx-auto mb-3 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-white/80 text-sm">Analyzing similar items at nearby stores…</p>
              </div>
            )}

            {analysisError && !analysisLoading && (
              <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 mb-4">
                <p className="text-red-200 text-sm">Couldn't load analysis: {analysisError}</p>
              </div>
            )}

            {analysis && !analysisLoading && (
              <div className="mb-4">
                {/* Verdict chip */}
                <div className="mb-3">
                  <span className="inline-block px-3 py-1.5 rounded-full text-[calc(13px*var(--fs))] font-bold" style={{
                    background: verdictBg(analysis.verdict),
                    color: verdictFg(analysis.verdict),
                  }}>
                    {analysis.verdictBadge}
                  </span>
                </div>

                {/* GS Verdict sentence */}
                {analysis.gsVerdict && (
                  <p className="text-white text-[calc(14px*var(--fs))] leading-relaxed mb-4">{analysis.gsVerdict}</p>
                )}

                {/* Alternatives. Header copy varies by comparisonType so the
                    user knows whether these are exact-match alternatives
                    (chain-store items) or look-alike comparable pieces
                    (handcrafted / artisan items where the exact item won't
                    be at chain stores). */}
                {analysis.alternatives && analysis.alternatives.length > 0 && (
                  <div className="bg-white/10 rounded-xl p-4 mb-3">
                    <div className="text-white/70 text-[calc(11px*var(--fs))] font-bold uppercase tracking-wide mb-2">
                      {analysis.comparisonType === 'similar_style'
                        ? <>🎨 Comparable handcrafted / look-alike pieces</>
                        : <>Similar items nearby</>}
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[calc(9px*var(--fs))] font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>estimated</span>
                    </div>
                    {analysis.comparisonType === 'similar_style' && (
                      <div className="text-white/60 text-[calc(11px*var(--fs))] mb-2 leading-relaxed">
                        Exact item isn't typically sold at chain stores. These are similar in style / category at places that sell comparable handcrafted pieces.
                      </div>
                    )}
                    <ul className="space-y-2">
                      {analysis.alternatives.map((a, i) => (
                        <li key={i} className="text-white text-[calc(13px*var(--fs))]">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-semibold">{a.store}</span>
                              <span className="text-white/50 text-[calc(11px*var(--fs))] ml-2">{a.scope === 'online' ? '🌐 online' : '📍 local'}</span>
                            </div>
                            <div className="text-emerald-300 font-semibold whitespace-nowrap">{a.priceRange}</div>
                          </div>
                          {a.note && <div className="text-white/60 text-[calc(11px*var(--fs))] mt-0.5">{a.note}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Home country reference */}
                {analysis.homeReference && (
                  <div className="bg-white/5 rounded-xl p-3 mb-3 text-white/80 text-[calc(12px*var(--fs))] leading-relaxed">
                    🏠 {analysis.homeReference}
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[calc(9px*var(--fs))] font-semibold align-middle" style={{ background: '#FEF3C7', color: '#92400E' }}>estimated</span>
                  </div>
                )}

                {/* Honesty footer */}
                <p className="text-white/40 text-[calc(10px*var(--fs))] leading-relaxed">
                  Price ranges are estimates based on typical store pricing — not live data. Verify before purchase.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={handleScanAnother}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Scan another item
              </button>
              <button
                onClick={handleDone}
                className="w-full text-white/70 hover:text-white text-sm font-medium py-2 transition-colors"
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
