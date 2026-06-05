import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, RefreshCw, ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "@/components/location/LocationContext";
import { logEvent } from "@/lib/analytics";

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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [user, setUser] = useState(null);
  // step values: 'currency' (pick currency) → 'scanning' (live camera OR
  // frozen frame with prices, distinguished by frozenFrame state) →
  // 'analysis' (price-analysis card from P2 — alternatives, GS verdict).
  const [step, setStep] = useState('currency');
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
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
    return () => { stopCamera(); };
  }, []);

  useEffect(() => {
    // Camera runs on the live scanning step AND on the analysis step
    // (so "Scan another" from the analysis card can hop back to a warm
    // stream). It's stopped only on the currency picker step.
    if (step === 'scanning' || step === 'analysis') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [step]);

  const loadUser = async () => {
    try {
      const isAuthenticated = await base44.auth.isAuthenticated();
      if (!isAuthenticated) {
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }

      const userData = await base44.auth.me();
      setUser(userData);

      setStep('currency');
    } catch (error) {
      console.error("Error loading user:", error);
      base44.auth.redirectToLogin(window.location.pathname);
    }
  };

  const startCamera = async () => {
    console.log("🎥 Starting camera - REAR CAMERA ONLY MODE");
    setDebugInfo("Starting rear camera...");
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported");
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      let stream = null;
      let rearCameraFound = false;
      
      try {
        console.log("📱 Attempting rear camera (exact environment)...");
        setDebugInfo("Requesting rear camera...");
        
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: "environment" }
          },
          audio: false
        });
        
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        console.log("📷 Camera settings:", settings);
        
        if (settings.facingMode === "environment") {
          console.log("✅ SUCCESS: Rear camera acquired!");
          setDebugInfo(`Rear camera: ${settings.width}x${settings.height}`);
          rearCameraFound = true;
        } else {
          console.log("❌ Wrong camera - got:", settings.facingMode);
          stream.getTracks().forEach(track => track.stop());
          stream = null;
        }
      } catch (error) {
        console.log("⚠️ Exact rear camera failed:", error.name);
      }

      if (!rearCameraFound && !stream) {
        try {
          console.log("📱 Attempting rear camera (ideal environment)...");
          setDebugInfo("Trying rear camera (fallback)...");
          
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" }
            },
            audio: false
          });
          
          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          
          if (settings.facingMode === "environment") {
            rearCameraFound = true;
            setDebugInfo(`Rear camera: ${settings.width}x${settings.height}`);
          } else {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
          }
        } catch (error) {
          console.log("⚠️ Ideal environment failed:", error.name);
        }
      }

      if (!rearCameraFound && !stream) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          
          const rearCamera = videoDevices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
          
          if (rearCamera) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: rearCamera.deviceId } },
              audio: false
            });
            rearCameraFound = true;
          } else if (videoDevices.length > 1) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: videoDevices[videoDevices.length - 1].deviceId } },
              audio: false
            });
            rearCameraFound = true;
          }
        } catch (error) {
          console.log("⚠️ Device enumeration failed:", error.name);
        }
      }

      if (!stream) {
        throw {
          message: "Could not access rear camera",
          type: "NotFoundError",
          details: { name: "NotFoundError", message: "No rear camera available" }
        };
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play()
              .then(resolve)
              .catch(reject);
          };
          videoRef.current.onerror = reject;
        });
        
        setCameraReady(true);
        setCameraError(null);
        setDebugInfo("📷 Rear camera ready");
      }
    } catch (error) {
      console.error("❌ Camera error:", error);
      
      let errorMessage = "Could not access rear camera";
      if (error.name === 'NotAllowedError' || error.type === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access.";
      } else if (error.name === 'NotFoundError' || error.type === 'NotFoundError') {
        errorMessage = "No rear camera found on this device.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera is in use by another app.";
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "No rear camera available on this device.";
      } else if (error.name === 'TypeError') {
        errorMessage = "Camera API not supported in this browser.";
      }
      
      setCameraError({
        message: errorMessage,
        type: error.name || error.type,
        details: error
      });
      setCameraReady(false);
      setDebugInfo(`Error: ${error.name || error.type}`);
    }
  };

  const stopCamera = () => {
    console.log("🛑 Stopping camera...");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setDebugInfo("Camera stopped");
  };

  // ── Freeze & Convert (manual trigger) ─────────────────────────────────────
  // Replaces the previous auto-scan interval. Fires only when the user taps
  // the Freeze CTA, mirroring the Text Scanner pattern. Same backend call
  // (extractPricesFromImage → convertToPreferredCurrency) — just user-gated.
  const handleFreezeAndConvert = async () => {
    if (isScanning) return;                      // ignore double-taps
    if (!cameraReady || !videoRef.current) return;
    console.log("📸 Freeze & convert tapped...");
    setIsScanning(true);
    
    try {
      const imageBlob = await captureVideoFrame();
      console.log("📦 Captured frame, size:", imageBlob.size);
      
      const prices = await extractPricesFromImage(imageBlob);
      console.log("💰 Extracted prices:", prices);
      
      if (prices && prices.length > 0) {
        const conversions = await Promise.all(
          prices.map(price => convertToPreferredCurrency(price))
        );
        
        const filtered = conversions.filter(c => c !== null);
        console.log("💱 Converted prices:", filtered);
        
        if (filtered.length > 0) {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frozenImageUrl = canvas.toDataURL('image/jpeg', 0.95);
          
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

  const captureVideoFrame = () => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      if (!video || !canvas) {
        reject(new Error("Video or canvas not available"));
        return;
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        reject(new Error("Video dimensions are 0"));
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      }, 'image/jpeg', 0.95);
    });
  };

  // Direct call to our Cloudflare Worker → Anthropic Claude Sonnet 4.6 with
  // prompt caching. Skips Base44's InvokeLLM wrapper for visibility into cost,
  // model choice, and caching. No file upload step — image goes straight to
  // the Worker as base64.
  const extractPricesFromImage = async (imageBlob) => {
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          // Strip the `data:image/jpeg;base64,` prefix.
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

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

  const handleContinue = async () => {
    if (!selectedCurrency) return;
    
    await base44.auth.updateMe({
      price_scanner_currency: selectedCurrency
    });
    
    setStep('instructions');
  };

  const handleStartScanning = () => {
    setStep('scanning');
  };

  // "Scan another" — drops the frozen frame + cleared prices and returns to
  // the live camera so the user can frame the next item and tap Freeze again.
  // Used from BOTH the post-freeze panel and the analysis card.
  const handleScanAnother = () => {
    setDetectedPrices([]);
    setFrozenFrame(null);
    setAnalysis(null);
    setAnalysisError(null);
    setStep('scanning');
  };

  // Exit the scanner entirely. Stops the camera, clears state, returns
  // the user to Home.
  const handleDone = () => {
    setDetectedPrices([]);
    setFrozenFrame(null);
    setAnalysis(null);
    setAnalysisError(null);
    stopCamera();
    navigate(createPageUrl("Home"));
  };

  // Open the price-analysis card and fetch alternatives + GS verdict from
  // the Worker /analyze-price endpoint. Uses the first detected price as
  // the input (most common case is one price tag at a time). Caches at the
  // Worker layer keyed by (item description + currency + price bucket +
  // country pair) so repeats of the same product type are free.
  const handleViewAnalysis = async () => {
    setStep('analysis');
    if (analysis || analysisLoading) return;  // already loaded / loading
    const first = detectedPrices[0];
    if (!first) return;  // nothing to analyze (shouldn't happen — button is gated above)
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const { data } = await base44.functions.invoke('analyzePrice', {
        itemDescription: first.original?.context || 'Item',
        price: first.original?.amount,
        currency: first.original?.currency,
        country: activeLocation?.address?.country || null,
        homeCountry: user?.home_country || null,
      });
      if (data?.error) {
        setAnalysisError(data.error);
      } else if (data?.analysis) {
        setAnalysis(data.analysis);
      } else {
        setAnalysisError('No analysis returned');
      }
    } catch (e) {
      setAnalysisError(e?.message || 'Failed to load analysis');
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (step === 'currency') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#06BCC1] to-[#0891B2]">
        <div className="px-6 py-8">
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="mb-8 flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>

          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#06BCC1] to-[#0891B2] flex items-center justify-center mb-4">
                  <span className="text-3xl">🏷️</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Smart Price Scanner</h2>
                <p className="text-gray-600 text-center">Choose your preferred currency</p>
              </div>

              <div className="mb-6">
                <Select value={selectedCurrency} onValueChange={handleCurrencySelect}>
                  <SelectTrigger className="w-full h-14 text-base border-gray-300 rounded-xl">
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

              <Button
                onClick={handleContinue}
                disabled={!selectedCurrency}
                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-[#06BCC1] to-[#0891B2] hover:opacity-90 rounded-xl disabled:opacity-50"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'instructions') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#06BCC1] to-[#0891B2]">
        <div className="px-6 py-8">
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={() => navigate(createPageUrl("Home"))}
              className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            
            <button
              onClick={handleStartScanning}
              className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#06BCC1] to-[#0891B2] flex items-center justify-center mb-4">
                  <span className="text-3xl">🏷️</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Smart Price Scanner</h2>
                <p className="text-gray-600 text-center">Instantly convert prices to your preferred currency</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#06BCC1] to-[#0891B2] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">01</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">Point your camera at any price tag</h3>
                    <p className="text-sm text-gray-600">Menus, receipts, store signs</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#06BCC1] to-[#0891B2] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">02</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">Hold steady for 2–3 seconds</h3>
                    <p className="text-sm text-gray-600">Auto-scanning every 3 seconds</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#06BCC1] to-[#0891B2] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">03</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">Prices automatically convert</h3>
                    <p className="text-sm text-gray-600">To {selectedCurrency} with real-time rates</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <span>✓</span>
                  Features:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>Detects multiple prices at once</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>Works with all languages and currencies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>Real-time exchange rates (cached for speed)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>No button press needed</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleStartScanning}
                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-[#06BCC1] to-[#0891B2] hover:opacity-90 rounded-xl"
              >
                Start Scanning
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
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
              onClick={startCamera}
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
  const isLive     = step === 'scanning' && !frozenFrame;
  const isFrozen   = step === 'scanning' && !!frozenFrame;
  const isAnalysis = step === 'analysis';

  // X-button behavior: live → home, frozen → unfreeze to live, analysis → back to frozen.
  const handleClose = () => {
    if (isAnalysis) {
      setStep('scanning');
    } else if (isFrozen) {
      setDetectedPrices([]);
      setFrozenFrame(null);
    } else {
      handleDone();
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" style={{ background: '#0F1419' }}>
      {/* Live camera preview — absolute inset-0 so it truly fills the screen
          on iOS Safari where vh shrinks under the dynamic URL bar. Matches
          Text Scanner's fullscreen treatment. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: frozenFrame ? 'none' : 'block' }}
      />
      {frozenFrame && (
        <img
          src={frozenFrame}
          alt="Frozen frame"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* TOP CHROME — X button + debug pill */}
      <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-3 pb-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex justify-between items-center">
          <button
            onClick={handleClose}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          {debugInfo && isLive && (
            <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
              <p className="text-white text-xs">{debugInfo}</p>
            </div>
          )}
        </div>
      </div>

      {/* LIVE CAMERA — gentle instruction text only (no auto-scan). The user
          taps the bottom Freeze CTA when ready, mirroring Text Scanner. */}
      {isLive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-[14px] font-medium" style={{ background: 'rgba(0,0,0,0.5)' }}>
              👉 Point at a price tag
            </div>
          </div>
        </div>
      )}

      {/* LIVE CAMERA — Freeze CTA at bottom */}
      {isLive && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-8 pt-6 bg-gradient-to-t from-black/70 to-transparent">
          <button
            onClick={handleFreezeAndConvert}
            disabled={!cameraReady || isScanning}
            className="w-full py-4 rounded-[18px] text-white font-bold text-[16px] flex items-center justify-center gap-2 shadow-lg transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)' }}
          >
            {!cameraReady
              ? <>📷 Starting rear camera…</>
              : isScanning
                ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Scanning prices…</>
                : <>🧊 Freeze &amp; convert price</>}
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
                  P1 ships the button + nav; the analysis card itself is
                  populated by the P2 Worker endpoint. */}
              {detectedPrices.length > 0 && (
                <button
                  onClick={handleViewAnalysis}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  💡 View price analysis
                </button>
              )}
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
        <div className="absolute inset-0 z-10 flex items-start justify-center px-4 pt-16 pb-8 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/90 backdrop-blur-md rounded-2xl p-6 max-w-sm w-full pointer-events-auto"
          >
            <h3 className="text-white font-bold text-lg mb-2">💡 Price Analysis</h3>
            {detectedPrices[0]?.original?.context && (
              <p className="text-white/70 text-[13px] mb-3">{detectedPrices[0].original.context}</p>
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
                  <span className="inline-block px-3 py-1.5 rounded-full text-[13px] font-bold" style={{
                    background: verdictBg(analysis.verdict),
                    color: verdictFg(analysis.verdict),
                  }}>
                    {analysis.verdictBadge}
                  </span>
                </div>

                {/* GS Verdict sentence */}
                {analysis.gsVerdict && (
                  <p className="text-white text-[14px] leading-relaxed mb-4">{analysis.gsVerdict}</p>
                )}

                {/* Alternatives */}
                {analysis.alternatives && analysis.alternatives.length > 0 && (
                  <div className="bg-white/10 rounded-xl p-4 mb-3">
                    <div className="text-white/70 text-[11px] font-bold uppercase tracking-wide mb-2">
                      Similar items nearby
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>estimated</span>
                    </div>
                    <ul className="space-y-2">
                      {analysis.alternatives.map((a, i) => (
                        <li key={i} className="text-white text-[13px]">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-semibold">{a.store}</span>
                              <span className="text-white/50 text-[11px] ml-2">{a.scope === 'online' ? '🌐 online' : '📍 local'}</span>
                            </div>
                            <div className="text-emerald-300 font-semibold whitespace-nowrap">{a.priceRange}</div>
                          </div>
                          {a.note && <div className="text-white/60 text-[11px] mt-0.5">{a.note}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Home country reference */}
                {analysis.homeReference && (
                  <div className="bg-white/5 rounded-xl p-3 mb-3 text-white/80 text-[12px] leading-relaxed">
                    🏠 {analysis.homeReference}
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold align-middle" style={{ background: '#FEF3C7', color: '#92400E' }}>estimated</span>
                  </div>
                )}

                {/* Honesty footer */}
                <p className="text-white/40 text-[10px] leading-relaxed">
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
