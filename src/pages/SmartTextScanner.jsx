// ============================================================================
// SMART TEXT SCANNER — manual freeze-and-translate camera UI
// ============================================================================
// User opens the page, picks a target language (default: English), aims the
// rear camera at any text, taps "Freeze & translate." Frame freezes, Claude
// Haiku 4.5 vision OCR + translates + romanizes, result overlays the frozen
// image. User can ✕ to dismiss + try again, or screenshot to keep it.
//
// Daily limit: 10 free translations per device (localStorage, resets midnight
// in user's timezone). Generous enough for a real travel day but capped
// against abuse.
//
// COST: ~$0.002 per scan (Claude Haiku vision + cached prompt). Cached 24hr
// per (image hash + target lang), so re-aiming at the same menu costs $0.
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, X, Volume2, ScanLine, ArrowRight, ChevronDown, RefreshCw, Scissors } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CAT, IVORY, TEAL_DEEP } from "@/components/redesign/constants";
import { useCameraPreview } from "@/lib/useCameraPreview";
import { useIsTablet } from "@/lib/useIsTablet";
import { callWorker } from "@/lib/callWorker";

// ─── iPad editorial tokens (tablet-only chrome) ──────────────────────────────
// Mirrors the shipped PlacesToEat / CultureInformation editorial system:
// Instrument Serif headings, JetBrains Mono uppercase kickers, ivory cards with
// a hairline rule. Phone layout never reads these. Accent = the text-scanner
// purple (#6D28D9); CAT/TEAL_DEEP imported per the redesign token contract.
const ED_SERIF = '"Instrument Serif", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#F7F4EC", ED_RULE = "rgba(22,17,13,.10)";
const ED_SCAN = "#6D28D9"; // text-scanner accent (purple)
// Text-scale helper — applied to every tablet-only text size we add.
const fs = (n) => `calc(${n}px*var(--fs))`;

const DAILY_LIMIT = 10;
const STORAGE_KEY_COUNT = 'globeskimmers_text_scan_count';
const STORAGE_KEY_LANG = 'globeskimmers_text_scan_target_lang';
const STORAGE_KEY_INTRO_SEEN = 'globeskimmers_text_scan_intro_seen';

// 25 supported target languages. English pinned at top per user request.
const LANGUAGES = [
  { code: 'en',      label: 'English',     flag: '🇺🇸' },
  { code: 'es',      label: 'Spanish',     flag: '🇪🇸' },
  { code: 'fr',      label: 'French',      flag: '🇫🇷' },
  { code: 'it',      label: 'Italian',     flag: '🇮🇹' },
  { code: 'de',      label: 'German',      flag: '🇩🇪' },
  { code: 'pt',      label: 'Portuguese',  flag: '🇵🇹' },
  { code: 'ja',      label: 'Japanese',    flag: '🇯🇵' },
  { code: 'ko',      label: 'Korean',      flag: '🇰🇷' },
  { code: 'zh-Hans', label: 'Chinese',     flag: '🇨🇳' },
  { code: 'th',      label: 'Thai',        flag: '🇹🇭' },
  { code: 'vi',      label: 'Vietnamese',  flag: '🇻🇳' },
  { code: 'fil',     label: 'Filipino',    flag: '🇵🇭' },
  { code: 'ar',      label: 'Arabic',      flag: '🇸🇦' },
  { code: 'he',      label: 'Hebrew',      flag: '🇮🇱' },
  { code: 'ru',      label: 'Russian',     flag: '🇷🇺' },
  { code: 'el',      label: 'Greek',       flag: '🇬🇷' },
  { code: 'tr',      label: 'Turkish',     flag: '🇹🇷' },
  { code: 'pl',      label: 'Polish',      flag: '🇵🇱' },
  { code: 'nl',      label: 'Dutch',       flag: '🇳🇱' },
  { code: 'sv',      label: 'Swedish',     flag: '🇸🇪' },
  { code: 'no',      label: 'Norwegian',   flag: '🇳🇴' },
  { code: 'cs',      label: 'Czech',       flag: '🇨🇿' },
  { code: 'hu',      label: 'Hungarian',   flag: '🇭🇺' },
  { code: 'id',      label: 'Indonesian',  flag: '🇮🇩' },
  { code: 'ms',      label: 'Malay',       flag: '🇲🇾' },
];

const findLanguage = (code) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];

// Read daily count from localStorage. Resets when the date changes (local time).
function readDailyCount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COUNT);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw);
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    return date === today ? count : 0;
  } catch {
    return 0;
  }
}

function incrementDailyCount() {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const current = readDailyCount();
    const next = current + 1;
    localStorage.setItem(STORAGE_KEY_COUNT, JSON.stringify({ date: today, count: next }));
    return next;
  } catch {
    return 0;
  }
}

export default function SmartTextScannerPage() {
  const navigate = useNavigate();
  // Tablet-only editorial chrome. Phone path is byte-identical (isTablet=false
  // leaves every original className/style untouched). colWrap widens + centers
  // the editorial card columns on iPad, matching PlacesToEat/CultureInformation.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  // canvasRef holds the captured still so the draw-to-crop region select can
  // read sub-rects from it. (No <video>/stream refs — the live preview is the
  // native camera-preview layer, not a DOM element.)
  const canvasRef = useRef(null);

  // Flow steps:
  //   'intro'        — welcome card (first open only, then persisted)
  //   'language'     — language picker
  //   'camera'       — live camera preview, awaiting freeze
  //   'translating'  — Claude API call in flight
  //   'frozen'       — frame frozen, translation overlay visible
  //   'limit'        — daily limit reached card
  const [step, setStep] = useState('intro');

  const [targetLang, setTargetLang] = useState('en');
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Native camera preview — real (iPhone-style) tap-to-focus + pinch-zoom are
  // handled natively by the plugin. Live only on the 'camera' step; the other
  // steps show the captured still. cameraReady/cameraError come from the hook.
  const cameraActive = step === 'camera';
  const { ready: cameraReady, error: cameraError, capture: capturePhoto } = useCameraPreview(cameraActive);

  const [frozenFrame, setFrozenFrame] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  // Draw-to-crop selection (the 'select' step). selRect is in on-screen (CSS)
  // pixels relative to the overlay; it's mapped back to source pixels at crop
  // time accounting for object-cover scaling.
  const [selRect, setSelRect] = useState(null);
  const selStartRef = useRef(null);
  const selectingRef = useRef(false);
  const overlayRef = useRef(null);
  const [todayCount, setTodayCount] = useState(0);

  // Initial setup: load saved lang + count, decide which step to show
  useEffect(() => {
    const savedLang = localStorage.getItem(STORAGE_KEY_LANG);
    if (savedLang) setTargetLang(savedLang);

    const count = readDailyCount();
    setTodayCount(count);

    // Always show the intro before the camera — reliable and consistent with the
    // Price Scanner. (The daily-limit screen still takes priority when capped.)
    if (count >= DAILY_LIMIT) {
      setStep('limit');
    } else {
      setStep('intro');
    }
  }, []);

  // Persist target language whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANG, targetLang);
  }, [targetLang]);

  // ── Capture (native camera) ────────────────────────────────
  // Capture a still from the native preview, draw it into canvasRef so the
  // draw-to-crop region select can read sub-rects, and return the JPEG data
  // URL. Native pinch-zoom already framed the shot — no crop-on-capture needed.
  const captureToCanvas = async () => {
    const base64 = await capturePhoto(92);
    if (!base64) return null;
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = dataUrl;
      });
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
      }
    } catch { /* canvas draw best-effort; OCR still uses the data URL */ }
    return dataUrl;
  };

  // Send a JPEG base64 (whole frame OR a cropped selection) to /scan-text and
  // route the result into the frozen card. failStep = where to land on error.
  const runTranslate = async (base64, failStep = 'frozen') => {
    if (todayCount >= DAILY_LIMIT) { setStep('limit'); return; }
    setStep('translating');
    try {
      const { data, error } = await callWorker('scan-text', { image: base64, mediaType: 'image/jpeg', targetLanguage: targetLang });
      if (error || !data || data.error) {
        setErrorMessage(data?.error || error || 'Translation failed');
        setStep(failStep);
        return;
      }
      if (!data.originalText || !data.translation || data.confidence < 0.3) {
        setErrorMessage('No clear text detected — get closer, hold steady, or select a tighter area.');
        setStep(failStep);
        return;
      }
      // Charge a token only on a successful translate.
      const next = incrementDailyCount();
      setTodayCount(next);
      setTranslation(data);
      setStep('frozen');
    } catch (e) {
      setErrorMessage('Network error — check your connection and try again.');
      setStep(failStep);
    }
  };

  // Fast path: freeze the whole frame and translate immediately.
  const handleFreezeAndTranslate = async () => {
    if (!cameraReady || !canvasRef.current) return;
    if (todayCount >= DAILY_LIMIT) { setStep('limit'); return; }
    const url = await captureToCanvas();
    if (!url) return;
    setFrozenFrame(url);
    runTranslate(url.split(',')[1], 'frozen');
  };

  // Select path: freeze, then let the user drag a box over just the words
  // they want (the 'select' step) before translating.
  const handleFreezeForSelect = async () => {
    if (!cameraReady || !canvasRef.current) return;
    if (todayCount >= DAILY_LIMIT) { setStep('limit'); return; }
    const url = await captureToCanvas();
    if (!url) return;
    setFrozenFrame(url);
    setSelRect(null);
    setErrorMessage(null);
    setStep('select');
  };

  const handleCancelSelect = () => {
    setFrozenFrame(null);
    setSelRect(null);
    setErrorMessage(null);
    setStep('camera');
  };

  // Crop the drawn selection out of the frozen frame and translate only it.
  // Maps the on-screen rect back to source pixels accounting for object-cover
  // (the <img> is scaled to cover the viewport, overflow cropped + centered).
  const handleTranslateSelection = () => {
    if (!selRect || selRect.w < 12 || selRect.h < 12) return;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const Wi = canvas.width, Hi = canvas.height;
    const rect = overlay.getBoundingClientRect();
    const Wc = rect.width, Hc = rect.height;
    if (!Wi || !Hi || !Wc || !Hc) return;
    const scale = Math.max(Wc / Wi, Hc / Hi);     // object-cover scale
    const offX = (Wi * scale - Wc) / 2;            // px cropped off each side (display space)
    const offY = (Hi * scale - Hc) / 2;
    let sx = (selRect.x + offX) / scale;
    let sy = (selRect.y + offY) / scale;
    let sw = selRect.w / scale;
    let sh = selRect.h / scale;
    sx = Math.max(0, Math.min(sx, Wi));
    sy = Math.max(0, Math.min(sy, Hi));
    sw = Math.max(1, Math.min(sw, Wi - sx));
    sh = Math.max(1, Math.min(sh, Hi - sy));
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(sw);
    tmp.height = Math.round(sh);
    tmp.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
    const cropUrl = tmp.toDataURL('image/jpeg', 0.92);
    setFrozenFrame(cropUrl);     // show the cropped region as the result background
    setSelRect(null);
    runTranslate(cropUrl.split(',')[1], 'frozen');
  };

  // "Translate the whole image instead" from the select step.
  const handleTranslateWholeFromSelect = () => {
    if (!frozenFrame) return;
    setSelRect(null);
    runTranslate(frozenFrame.split(',')[1], 'frozen');
  };

  const handleDismissTranslation = () => {
    setFrozenFrame(null);
    setTranslation(null);
    setErrorMessage(null);
    setSelRect(null);
    if (todayCount >= DAILY_LIMIT) {
      setStep('limit');
    } else {
      setStep('camera');
    }
  };

  // Drag-to-select handlers — touch + mouse (more reliable than Pointer Events
  // in the Android WebView). Coordinates are relative to the overlay.
  const onSelStart = (clientX, clientY) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    selectingRef.current = true;
    selStartRef.current = { x: clientX - rect.left, y: clientY - rect.top };
    setSelRect({ x: selStartRef.current.x, y: selStartRef.current.y, w: 0, h: 0 });
  };
  const onSelMove = (clientX, clientY) => {
    if (!selectingRef.current) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = clientX - rect.left, cy = clientY - rect.top;
    const s = selStartRef.current;
    setSelRect({ x: Math.min(s.x, cx), y: Math.min(s.y, cy), w: Math.abs(cx - s.x), h: Math.abs(cy - s.y) });
  };
  const onSelEnd = () => { selectingRef.current = false; };

  const handleSpeak = () => {
    if (!translation?.originalText || !translation?.lang) return;
    try {
      const utter = new SpeechSynthesisUtterance(translation.originalText);
      utter.lang = translation.lang;
      // Pick a matching voice if available
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.lang === translation.lang) || voices.find((v) => v.lang?.startsWith(translation.lang.split('-')[0]));
      if (match) utter.voice = match;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {}
  };

  const handleStartScanning = () => {
    localStorage.setItem(STORAGE_KEY_INTRO_SEEN, '1');
    setStep('camera');
  };

  // ── Render: counter chip color states ──────────────────────────────────────
  const remaining = DAILY_LIMIT - todayCount;
  const counterColor = remaining === 0 ? '#E63946' : remaining <= 3 ? '#D4861A' : '#94A3B8';

  // ── RENDER: Intro card (first open) ──────────────────────────────────────
  if (step === 'intro') {
    return (
      <div className="min-h-screen font-sans" style={{ background: IVORY }}>
        {/* Violet gradient header — compact */}
        <div
          className="text-white px-5 pt-4 pb-5 rounded-b-[22px]"
          style={{
            background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 55%, #A855F7 100%)',
            boxShadow: '0 14px 30px -16px rgba(124,58,237,.55)',
          }}
        >
          <div className={`${colWrap} mx-auto flex items-center justify-between`}>
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity font-semibold text-[calc(14px*var(--fs))]"
            >
              <ChevronLeft size={18} color="#fff" strokeWidth={2.2} />
              <span>Back</span>
            </button>
          </div>
          <div className={`${colWrap} mx-auto mt-2`}>
            <div className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(11) : fs(10), letterSpacing: ".18em", color: "rgba(255,255,255,.78)" }}>
              Live camera translator
            </div>
            <div className="leading-none mt-1" style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(40) : fs(28), color: "#fff" }}>
              Smart <span className="italic">Text Scanner</span>
            </div>
          </div>
        </div>

        {/* Intro body — compact so the icon, copy and CTA all fit one screen */}
        <div className={`${colWrap} mx-auto px-5 pt-4 pb-5`}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div
              className="w-[60px] h-[60px] mx-auto rounded-[18px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #C5197A 100%)',
                boxShadow: '0 16px 34px -14px rgba(124,58,237,.6)',
              }}
            >
              <ScanLine size={30} color="#fff" strokeWidth={1.8} />
            </div>
            <div className={isTablet ? "mt-4 leading-none" : "mt-3 leading-tight"} style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(44) : fs(28), color: ED_INK }}>
              Translate anything, <span className="italic" style={{ color: ED_SCAN }}>instantly.</span>
            </div>
            <div className={isTablet ? "mt-3 mx-auto" : "mt-1.5"} style={{ maxWidth: isTablet ? 560 : undefined, fontSize: isTablet ? fs(16) : fs(13.5), lineHeight: 1.5, color: ED_INK3 }}>
              Point your camera at a sign, menu, or product label — we read it and translate it.
            </div>
          </motion.div>

          {/* What you get */}
          <div
            className={isTablet ? "mt-6 px-6 py-5 rounded-[22px]" : "mt-4 px-4 py-3.5 rounded-[18px]"}
            style={isTablet
              ? { background: '#fff', border: `1px solid ${ED_RULE}`, boxShadow: '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)' }
              : { background: '#fff', border: `1px solid ${ED_RULE}`, boxShadow: '0 6px 18px -12px rgba(22,17,13,.10)' }}
          >
            <div
              className="uppercase font-semibold mb-1.5"
              style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(11) : fs(10), letterSpacing: ".16em", color: ED_INK3 }}
            >
              What's in your pocket
            </div>
            <ul className={isTablet ? "space-y-2.5" : "space-y-1.5"} style={{ fontSize: isTablet ? fs(15) : fs(13.5), color: ED_INK2, lineHeight: 1.5 }}>
              <li className="flex gap-2"><span style={{ color: ED_SCAN }}>•</span><span><strong>25 languages</strong> with pronunciation for Japanese, Thai, Korean, Arabic, Chinese and more</span></li>
              <li className="flex gap-2"><span style={{ color: ED_SCAN }}>•</span><span><strong>All your travel tools in one app</strong> — no app-switching mid-trip</span></li>
              <li className="flex gap-2"><span style={{ color: ED_SCAN }}>•</span><span><strong>10 free translations daily</strong></span></li>
            </ul>
          </div>

          {/* Screenshot tip */}
          <div
            className={isTablet ? "mt-3 px-5 py-4 rounded-[18px] leading-snug" : "mt-2.5 px-4 py-3 rounded-[18px] leading-snug"}
            style={{ background: CAT.todo.bg, color: CAT.todo.ink, fontSize: isTablet ? fs(14) : fs(13.5) }}
          >
            <div className="font-bold mb-0.5">📸 Want to remember a translation?</div>
            Feel free to take a screenshot to save it on your device.
          </div>

          {/* Start button + secondary escape */}
          <div className={isTablet ? "mx-auto" : ""} style={isTablet ? { maxWidth: 460 } : undefined}>
            <button
              onClick={handleStartScanning}
              className={isTablet
                ? "mt-7 w-full rounded-[18px] text-white flex items-center justify-center gap-2"
                : "mt-5 w-full rounded-[18px] text-white flex items-center justify-center gap-2"}
              style={isTablet
                ? { background: ED_INK, boxShadow: '0 14px 30px -16px rgba(22,17,13,.5)', minHeight: 'calc(58px*var(--fs))', fontSize: fs(17), fontWeight: 700 }
                : { background: ED_INK, boxShadow: '0 12px 28px -14px rgba(22,17,13,.4)', minHeight: 'calc(52px*var(--fs))', fontSize: fs(15.5), fontWeight: 700 }}
            >
              Got it, let's translate
              <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
            </button>
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="w-full mt-3 transition-colors"
              style={{ fontSize: isTablet ? fs(13) : fs(11.5), color: ED_INK3, fontFamily: ED_MONO, letterSpacing: ".06em" }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Limit reached card ───────────────────────────────────────────
  // Shown ONLY when the user has hit their daily 10-translation cap.
  // Copy + Premium framing matches the Price Scanner cap-hit modal so the
  // two scanners read consistently when a free-tier user hits the wall.
  if (step === 'limit') {
    return (
      <div className="min-h-screen font-sans flex flex-col items-center justify-center px-5" style={{ background: IVORY }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={isTablet ? "w-full text-center" : "max-w-md w-full text-center"} style={isTablet ? { maxWidth: 560 } : undefined}>
          <div className="text-[calc(64px*var(--fs))] leading-none">🎯</div>
          <div className={isTablet ? "mt-5 leading-tight" : "mt-4 leading-tight"} style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(40) : fs(28), color: ED_INK }}>
            You've used all <span className="italic" style={{ color: ED_SCAN }}>10 free</span> translations today.
          </div>
          <div className={isTablet ? "mt-4 leading-relaxed" : "mt-3 leading-relaxed"} style={{ fontSize: isTablet ? fs(16) : fs(13.5), color: ED_INK3 }}>
            Your free daily translations reset at <strong style={{ color: ED_INK2 }}>midnight your local time</strong>. Or unlock unlimited with <strong style={{ color: ED_INK2 }}>Globeskimmers Premium, launching soon</strong>.
          </div>

          <div
            className={isTablet ? "mt-6 px-5 py-5 rounded-[18px] text-left" : "mt-5 px-4 py-4 rounded-[18px] text-left"}
            style={{ background: CAT.todo.bg, color: CAT.todo.ink }}
          >
            <div
              className="uppercase font-semibold mb-1.5"
              style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(11) : fs(10.5), letterSpacing: ".14em" }}
            >
              ✨ Quick travel tip
            </div>
            <div className="leading-relaxed" style={{ fontSize: isTablet ? fs(14) : fs(13.5) }}>
              Screenshot your most-needed translations as you go — they'll be saved on your phone forever, even offline.
            </div>
          </div>

          {/* Premium CTA — non-functional placeholder until the subscription
              flow lands. Same "coming soon" framing as the Price Scanner
              cap-hit modal so the user hears a consistent message. */}
          <div className={isTablet ? "mx-auto" : ""} style={isTablet ? { maxWidth: 460 } : undefined}>
            <button
              type="button"
              onClick={() => { /* Premium flow lands later */ }}
              className={isTablet
                ? "mt-6 w-full rounded-[18px] text-white transition-opacity hover:opacity-90"
                : "mt-5 w-full rounded-[18px] text-white transition-opacity hover:opacity-90"}
              style={isTablet
                ? { background: 'linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)', minHeight: 'calc(58px*var(--fs))', fontSize: fs(16.5), fontWeight: 700 }
                : { background: 'linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)', minHeight: 'calc(54px*var(--fs))', fontSize: fs(15.5), fontWeight: 700 }}
            >
              ✨ Get Globeskimmers Premium — coming soon
            </button>

            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="mt-3 w-full py-2.5 transition-colors"
              style={{ fontSize: isTablet ? fs(13) : fs(12.5), color: ED_INK3, fontFamily: ED_MONO, letterSpacing: ".06em" }}
            >
              🏠 Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── RENDER: Camera + frozen states ───────────────────────────────────────
  const currentLang = findLanguage(targetLang);
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden pointer-events-none" style={{ background: 'transparent' }}>
      {/* The live preview is the NATIVE camera-preview layer rendered BEHIND
          this transparent page. pointer-events-none here lets taps + pinches
          fall through to the native preview so real tap-to-focus and pinch-zoom
          work; each control below re-enables pointer-events on itself. The
          frozen still is a normal <img> that covers the preview once captured. */}
      {frozenFrame && (
        <img src={frozenFrame} alt="frozen frame" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera error state */}
      {cameraError && step === 'camera' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center pointer-events-auto" style={{ background: '#0F1419' }}>
          <div className="text-[calc(48px*var(--fs))] mb-3">📷</div>
          <div className="text-white text-[calc(18px*var(--fs))] font-bold mb-2">Camera not available</div>
          <div className="text-white/70 text-[calc(14px*var(--fs))] mb-6">{cameraError.message}</div>
          <button onClick={() => navigate(createPageUrl('Home'))} className="px-5 py-3 rounded-[14px] bg-white text-[#0F1419] font-bold text-[calc(14px*var(--fs))]">
            Back to Home
          </button>
        </div>
      )}

      {/* TOP CHROME — Back + counter chip + language pill */}
      <div
        className="absolute top-0 left-0 right-0 z-30 px-4 pb-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className={`${colWrap} mx-auto flex items-center justify-between gap-2`}>
          {/* Back / Dismiss */}
          {step === 'frozen' || step === 'translating' ? (
            <button
              onClick={handleDismissTranslation}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)' }}
              aria-label="Dismiss translation"
            >
              <X size={20} color="#fff" strokeWidth={2.4} />
            </button>
          ) : step === 'select' ? (
            <button
              onClick={handleCancelSelect}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)' }}
              aria-label="Cancel selection"
            >
              <X size={20} color="#fff" strokeWidth={2.4} />
            </button>
          ) : (
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)' }}
              aria-label="Back to Home"
            >
              <ChevronLeft size={20} color="#fff" strokeWidth={2.2} />
            </button>
          )}

          {/* Counter chip */}
          <div
            className="px-3 py-1.5 rounded-full font-mono text-[calc(10.5px*var(--fs))] font-semibold tracking-[0.08em]"
            style={{ background: 'rgba(0,0,0,0.55)', color: counterColor, backdropFilter: 'blur(10px)' }}
          >
            {remaining} of {DAILY_LIMIT} left today
          </div>

          {/* Language picker pill — only on camera step (not while frozen) */}
          {step === 'camera' && (
            <button
              onClick={() => setShowLangPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]"
              style={{ background: 'rgba(255,255,255,0.95)', color: '#0F1419', backdropFilter: 'blur(10px)' }}
            >
              <span>{currentLang.flag}</span>
              <span>{currentLang.label}</span>
              <ChevronDown size={14} color="#0F1419" strokeWidth={2.4} />
            </button>
          )}
          {(step === 'frozen' || step === 'translating' || step === 'select') && <div className="w-10 h-10" />}
        </div>
      </div>

      {/* CAMERA aim hint */}
      {step === 'camera' && cameraReady && !cameraError && (
        <div className="absolute left-0 right-0 z-10 px-6 pointer-events-none text-center text-white" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
          <div className="inline-block px-4 py-2 rounded-full text-[calc(12.5px*var(--fs))] font-semibold" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}>
            👉 Point at a sign, menu, or label
          </div>
        </div>
      )}

      {/* SELECT step — drag a box over the words to translate */}
      {step === 'select' && (
        <>
          <div
            ref={overlayRef}
            className="absolute inset-0 z-10 pointer-events-auto"
            style={{ touchAction: 'none' }}
            onTouchStart={(e) => { const t = e.touches[0]; if (t) onSelStart(t.clientX, t.clientY); }}
            onTouchMove={(e) => { const t = e.touches[0]; if (t) { e.preventDefault(); onSelMove(t.clientX, t.clientY); } }}
            onTouchEnd={onSelEnd}
            onTouchCancel={onSelEnd}
            onMouseDown={(e) => onSelStart(e.clientX, e.clientY)}
            onMouseMove={(e) => onSelMove(e.clientX, e.clientY)}
            onMouseUp={onSelEnd}
          >
            {selRect && selRect.w > 2 && selRect.h > 2 && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: selRect.x, top: selRect.y, width: selRect.w, height: selRect.h,
                  border: '2px solid #C5197A', background: 'rgba(197,25,122,0.14)',
                  borderRadius: 6, boxShadow: '0 0 0 9999px rgba(0,0,0,0.28)',
                }}
              />
            )}
          </div>
          {/* Instruction + error, below the top chrome (pointer-events off so
              it never blocks drawing) */}
          <div className="absolute left-0 right-0 z-20 px-6 pointer-events-none text-center" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
            <div className="inline-block px-4 py-2 rounded-full text-white text-[calc(12.5px*var(--fs))] font-semibold" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}>
              ✏️ Drag a box around the words to translate
            </div>
            {errorMessage && (
              <div className="mt-2">
                <span className="inline-block px-3 py-1.5 rounded-full text-white text-[calc(11.5px*var(--fs))] font-medium" style={{ background: 'rgba(220,38,38,0.9)' }}>
                  {errorMessage}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* TRANSLATING spinner */}
      {step === 'translating' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="px-6 py-5 rounded-[20px] text-center text-white" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(14px)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <RefreshCw size={28} color="#fff" strokeWidth={2} className="inline-block" />
            </motion.div>
            <div className="mt-2 font-bold text-[calc(14px*var(--fs))]">Translating…</div>
          </div>
        </div>
      )}

      {/* TRANSLATION overlay — appears in 'frozen' state */}
      {step === 'frozen' && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={isTablet
            ? "absolute bottom-0 left-1/2 z-20 rounded-t-[28px] px-7 pt-7 pb-8 text-[#0F1419] pointer-events-auto"
            : "absolute bottom-0 left-0 right-0 z-20 rounded-t-[24px] px-5 pt-5 pb-7 text-[#0F1419] pointer-events-auto"}
          style={isTablet
            ? { background: IVORY, width: 'min(620px, 92vw)', transform: 'translateX(-50%)', maxHeight: '78vh', overflowY: 'auto', border: `1px solid ${ED_RULE}`, borderBottom: 'none', boxShadow: '0 -18px 60px -20px rgba(22,17,13,.45)' }
            : { background: IVORY, maxHeight: '70vh', overflowY: 'auto', borderTop: `1px solid ${ED_RULE}`, boxShadow: '0 -14px 48px -16px rgba(22,17,13,.40)' }}
        >
          {/* Card-level dismiss X — top-right, always reachable.
              Tapping returns to the live camera (same as Scan another). */}
          <button
            onClick={handleDismissTranslation}
            className={isTablet
              ? "absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-10 transition-colors hover:brightness-95"
              : "absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center z-10 transition-colors hover:bg-[#EFE8D6]"}
            style={{ background: ED_IVORY2 }}
            aria-label="Close translation"
          >
            <X size={18} color="#0F1419" strokeWidth={2.2} />
          </button>

          {errorMessage ? (
            <>
              <div className={isTablet ? "leading-tight mb-1.5" : "leading-tight mb-1.5"} style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(26) : fs(24), color: ED_INK }}>Couldn't read the text</div>
              <div className={isTablet ? "mb-5" : "mb-4"} style={{ fontSize: isTablet ? fs(15) : fs(13.5), color: ED_INK3, lineHeight: 1.5 }}>{errorMessage}</div>
              <button
                onClick={handleDismissTranslation}
                className={isTablet
                  ? "w-full rounded-[16px] text-white flex items-center justify-center"
                  : "w-full rounded-[18px] text-white flex items-center justify-center"}
                style={isTablet
                  ? { background: ED_INK, minHeight: 'calc(54px*var(--fs))', fontSize: fs(15.5), fontWeight: 700 }
                  : { background: ED_INK, minHeight: 'calc(48px*var(--fs))', fontSize: fs(14), fontWeight: 700 }}
              >
                Try again
              </button>
            </>
          ) : translation && (
            <>
              {/* Source language label */}
              {translation.sourceLanguageName && (
                <div
                  className="uppercase font-semibold mb-1.5"
                  style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(11) : fs(10), letterSpacing: ".16em", color: ED_INK3 }}
                >
                  From {translation.sourceLanguageName}
                  {translation.textCategory && translation.textCategory !== 'other' && (
                    <span> · {translation.textCategory.replace(/_/g, ' ')}</span>
                  )}
                </div>
              )}

              {/* Original text */}
              <div
                className={isTablet ? "whitespace-pre-wrap mb-4" : "whitespace-pre-wrap mb-3"}
                style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(26) : fs(24), lineHeight: 1.22, color: ED_INK }}
              >
                {translation.originalText}
              </div>

              {/* Romanization (only for non-Latin scripts) */}
              {translation.romanization && (
                <div
                  className={isTablet ? "mb-4 px-4 py-3 rounded-[14px] flex items-start gap-3" : "mb-3 px-3.5 py-2.5 rounded-[14px] flex items-start gap-2.5"}
                  style={{ background: ED_IVORY2, border: `1px solid ${ED_RULE}` }}
                >
                  <div
                    className="uppercase font-semibold mt-1 flex-none"
                    style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(10) : fs(10), letterSpacing: ".14em", color: ED_INK3 }}
                  >
                    Say it
                  </div>
                  <div
                    className="italic flex-1"
                    style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(18) : fs(16), color: ED_INK2, lineHeight: 1.35 }}
                  >
                    {translation.romanization}
                  </div>
                  <button
                    onClick={handleSpeak}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-none"
                    style={{ background: TEAL_DEEP, color: '#fff' }}
                    aria-label="Speak"
                  >
                    <Volume2 size={14} color="#fff" strokeWidth={2.2} />
                  </button>
                </div>
              )}

              {/* Translation */}
              <div
                className={isTablet ? "px-5 py-4 rounded-[18px] mb-4" : "px-4 py-3.5 rounded-[18px] mb-3"}
                style={{ background: CAT.todo.bg, border: `1px solid ${ED_RULE}` }}
              >
                <div
                  className="uppercase font-semibold mb-1.5"
                  style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(11) : fs(10), letterSpacing: ".16em", color: CAT.todo.ink }}
                >
                  {currentLang.flag} {currentLang.label}
                </div>
                <div
                  className="whitespace-pre-wrap"
                  style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(30) : fs(24), lineHeight: 1.18, color: CAT.todo.ink }}
                >
                  {translation.translation}
                </div>
              </div>

              {/* Screenshot hint */}
              <div
                className={isTablet ? "text-center mt-3 mb-4" : "text-center mt-2 mb-3"}
                style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(11.5) : fs(11), letterSpacing: ".04em", color: ED_INK3 }}
              >
                📸 Feel free to take a screenshot to save it on your device.
              </div>

              {/* Scan-another quick action */}
              <button
                onClick={handleDismissTranslation}
                className={isTablet
                  ? "w-full rounded-[16px] flex items-center justify-center gap-2"
                  : "w-full rounded-[18px] flex items-center justify-center gap-2"}
                style={isTablet
                  ? { background: ED_INK, color: '#fff', minHeight: 'calc(54px*var(--fs))', fontSize: fs(15.5), fontWeight: 700 }
                  : { background: ED_INK, color: '#fff', minHeight: 'calc(48px*var(--fs))', fontSize: fs(14), fontWeight: 700 }}
              >
                <ScanLine size={16} color="#fff" strokeWidth={2.2} />
                Scan another
              </button>

              {/* Tertiary escape — exit the scanner back to Home. */}
              <button
                onClick={() => navigate(createPageUrl('Home'))}
                className="w-full mt-3 py-2 transition-colors"
                style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(13) : fs(13), letterSpacing: ".06em", color: ED_INK3 }}
              >
                🏠 Back to Home
              </button>
            </>
          )}
        </motion.div>
      )}

      {/* BOTTOM CTA — "Freeze & translate" (only on camera step) */}
      {step === 'camera' && cameraReady && !cameraError && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 px-5 pt-6 bg-gradient-to-t from-black/60 to-transparent pointer-events-auto"
          style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        >
          <div className={isTablet ? "mx-auto" : "max-w-md mx-auto"} style={isTablet ? { maxWidth: 480 } : undefined}>
            <button
              onClick={handleFreezeAndTranslate}
              className="w-full h-[58px] rounded-[18px] flex items-center justify-center gap-2 font-bold text-[calc(16px*var(--fs))] text-white"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #C5197A 100%)',
                boxShadow: '0 14px 34px -10px rgba(124,58,237,.55)',
              }}
            >
              <ScanLine size={20} color="#fff" strokeWidth={2.2} />
              Freeze & translate
            </button>
            <button
              onClick={handleFreezeForSelect}
              className="w-full h-[58px] rounded-[18px] mt-3 flex items-center justify-center gap-2 font-bold text-[calc(16px*var(--fs))] text-white"
              style={{
                background: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.4)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              <Scissors size={20} color="#fff" strokeWidth={2.2} />
              Select part of the image
            </button>
          </div>
        </div>
      )}

      {/* SELECT step — bottom actions */}
      {step === 'select' && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 px-5 pt-6 bg-gradient-to-t from-black/70 to-transparent pointer-events-auto"
          style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        >
          <div className={isTablet ? "mx-auto" : "max-w-md mx-auto"} style={isTablet ? { maxWidth: 480 } : undefined}>
            <button
              onClick={handleTranslateSelection}
              disabled={!selRect || selRect.w < 12 || selRect.h < 12}
              className="w-full h-[54px] rounded-[16px] flex items-center justify-center gap-2 font-bold text-[calc(15.5px*var(--fs))] text-white transition-opacity disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #C5197A 100%)',
                boxShadow: '0 14px 34px -10px rgba(124,58,237,.55)',
              }}
            >
              <ScanLine size={18} color="#fff" strokeWidth={2.2} />
              Translate selection
            </button>
            <button
              onClick={handleTranslateWholeFromSelect}
              className="w-full mt-2 text-white/90 hover:text-white text-[calc(13px*var(--fs))] font-medium py-2"
            >
              Translate the whole image instead
            </button>
          </div>
        </div>
      )}

      {/* LANGUAGE PICKER MODAL */}
      <AnimatePresence>
        {showLangPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={isTablet
              ? "absolute inset-0 z-40 flex items-center justify-center px-6 pointer-events-auto"
              : "absolute inset-0 z-40 flex items-end pointer-events-auto"}
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowLangPicker(false)}
          >
            <motion.div
              initial={isTablet ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
              animate={isTablet ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
              exit={isTablet ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className={isTablet
                ? "w-full max-w-[520px] rounded-[28px] max-h-[78vh] overflow-y-auto"
                : "w-full rounded-t-[24px] max-h-[70vh] overflow-y-auto"}
              style={isTablet
                ? { background: IVORY, border: `1px solid ${ED_RULE}`, boxShadow: '0 30px 80px -30px rgba(22,17,13,.55)' }
                : { background: IVORY, borderTop: `1px solid ${ED_RULE}`, boxShadow: '0 -14px 48px -16px rgba(22,17,13,.40)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={isTablet ? "sticky top-0 px-6 pt-5 pb-4 flex items-center justify-between" : "sticky top-0 px-5 pt-4 pb-3 flex items-center justify-between"}
                style={{ background: IVORY, borderBottom: `1px solid ${ED_RULE}` }}
              >
                <div>
                  <div style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(28) : fs(24), lineHeight: 1.05, color: ED_INK }}>Translate into…</div>
                  <div className="uppercase font-semibold mt-1.5" style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(11) : fs(10.5), letterSpacing: ".16em", color: ED_INK3 }}>{LANGUAGES.length} languages</div>
                </div>
                <button
                  onClick={() => setShowLangPicker(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: ED_IVORY2 }}
                  aria-label="Close picker"
                >
                  <X size={18} color="#0F1419" strokeWidth={2.2} />
                </button>
              </div>
              <div className={isTablet ? "px-3 py-3" : "px-2 py-2"}>
                {LANGUAGES.map((lang) => {
                  const isSelected = lang.code === targetLang;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setTargetLang(lang.code);
                        setShowLangPicker(false);
                      }}
                      className={isTablet
                        ? "w-full flex items-center gap-3 px-4 py-3.5 rounded-[14px] text-left transition-colors"
                        : "w-full flex items-center gap-3 px-4 py-3 rounded-[14px] text-left transition-colors"}
                      style={{ background: isSelected ? CAT.todo.bg : 'transparent' }}
                    >
                      <span className="flex-none" style={{ fontSize: isTablet ? fs(24) : fs(22) }}>{lang.flag}</span>
                      <div className="flex-1">
                        <div
                          style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(20) : fs(20), lineHeight: 1.1, color: isSelected ? CAT.todo.ink : ED_INK }}
                        >
                          {lang.label}
                        </div>
                        <div
                          className="uppercase mt-0.5"
                          style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(10) : fs(10), letterSpacing: ".1em", color: ED_INK3 }}
                        >
                          {lang.code}
                        </div>
                      </div>
                      {isSelected && (
                        <span
                          className="uppercase font-bold"
                          style={{ fontFamily: ED_MONO, fontSize: isTablet ? fs(10) : fs(10), letterSpacing: ".14em", color: CAT.todo.ink }}
                        >
                          ✓ SELECTED
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
