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
import { ChevronLeft, X, Volume2, ScanLine, ArrowRight, ChevronDown, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CAT, IVORY } from "@/components/redesign/constants";
import { useCameraPreview } from "@/lib/useCameraPreview";

const WORKER_URL = 'https://globeskimmers-api.maizasimeon.workers.dev';
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
      const res = await fetch(`${WORKER_URL}/scan-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg', targetLanguage: targetLang }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Translation failed');
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
            Smart <span className="font-serif italic font-normal">Text Scanner</span>
          </div>
        </div>

        {/* Intro body — compact so the icon, copy and CTA all fit one screen */}
        <div className="max-w-md mx-auto px-5 pt-4 pb-5">
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
            <div className="mt-3 text-[calc(23px*var(--fs))] font-extrabold text-[#0F1419] tracking-tight leading-tight">
              Translate anything, <span className="font-serif italic font-normal text-[#7C3AED]">instantly.</span>
            </div>
            <div className="mt-1.5 text-[calc(14px*var(--fs))] text-[#475569] leading-snug">
              Point your camera at a sign, menu, or product label — we read it and translate it.
            </div>
          </motion.div>

          {/* What you get */}
          <div className="mt-4 px-4 py-3 rounded-[16px]" style={{ background: '#fff', border: '1px solid #F0E9DC' }}>
            <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.16em] uppercase font-semibold text-[#6B7280] mb-1.5">What's in your pocket</div>
            <ul className="space-y-1.5 text-[calc(13px*var(--fs))] text-[#0F1419]">
              <li className="flex gap-2"><span>•</span><span><strong>25 languages</strong> with pronunciation for Japanese, Thai, Korean, Arabic, Chinese and more</span></li>
              <li className="flex gap-2"><span>•</span><span><strong>All your travel tools in one app</strong> — no app-switching mid-trip</span></li>
              <li className="flex gap-2"><span>•</span><span><strong>10 free translations daily</strong></span></li>
            </ul>
          </div>

          {/* Screenshot tip */}
          <div className="mt-2.5 px-4 py-3 rounded-[14px] text-[calc(12.5px*var(--fs))] leading-snug" style={{ background: CAT.todo.bg, color: CAT.todo.ink }}>
            <div className="font-bold mb-0.5">📸 Want to remember a translation?</div>
            Feel free to take a screenshot to save it on your device.
          </div>

          {/* Start button + secondary escape */}
          <button
            onClick={handleStartScanning}
            className="mt-5 w-full h-[52px] rounded-[16px] text-white flex items-center justify-center gap-2 font-bold text-[calc(15.5px*var(--fs))]"
            style={{ background: '#0F1419', boxShadow: '0 12px 28px -14px rgba(15,20,25,.4)' }}
          >
            Got it, let's translate
            <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
          </button>
          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="w-full mt-2 text-[#94A3B8] hover:text-[#475569] text-[calc(11.5px*var(--fs))] font-normal transition-colors"
          >
            Back to Home
          </button>
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
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center">
          <div className="text-[calc(64px*var(--fs))] leading-none">🎯</div>
          <div className="mt-4 text-[calc(28px*var(--fs))] font-extrabold text-[#0F1419] tracking-tight">
            You've used all <span className="font-serif italic font-normal text-[#C5197A]">10 free</span> translations today.
          </div>
          <div className="mt-3 text-[calc(14.5px*var(--fs))] text-[#475569] leading-relaxed">
            Your free daily translations reset at <strong>midnight your local time</strong>. Or unlock unlimited with <strong>Globeskimmers Premium, launching soon</strong>.
          </div>

          <div className="mt-5 px-4 py-4 rounded-[14px] text-left" style={{ background: CAT.todo.bg, color: CAT.todo.ink }}>
            <div className="font-bold text-[calc(13.5px*var(--fs))] mb-1">✨ Quick travel tip</div>
            <div className="text-[calc(12.5px*var(--fs))] leading-relaxed">
              Screenshot your most-needed translations as you go — they'll be saved on your phone forever, even offline.
            </div>
          </div>

          {/* Premium CTA — non-functional placeholder until the subscription
              flow lands. Same "coming soon" framing as the Price Scanner
              cap-hit modal so the user hears a consistent message. */}
          <button
            type="button"
            onClick={() => { /* Premium flow lands later */ }}
            className="mt-5 w-full h-[54px] rounded-[16px] text-white font-bold text-[calc(15.5px*var(--fs))] transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)' }}
          >
            ✨ Get Globeskimmers Premium — coming soon
          </button>

          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="mt-2 w-full text-gray-500 text-[calc(13px*var(--fs))] font-medium py-2.5 hover:text-gray-700"
          >
            🏠 Back to Home
          </button>
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
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
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
          className="absolute bottom-0 left-0 right-0 z-20 rounded-t-[24px] px-5 pt-5 pb-7 text-[#0F1419] pointer-events-auto"
          style={{ background: '#FFFCF7', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 -10px 40px rgba(0,0,0,0.3)' }}
        >
          {/* Card-level dismiss X — top-right, always reachable.
              Tapping returns to the live camera (same as Scan another). */}
          <button
            onClick={handleDismissTranslation}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center z-10 transition-colors hover:bg-[#EFE8D6]"
            style={{ background: '#F7F4EC' }}
            aria-label="Close translation"
          >
            <X size={18} color="#0F1419" strokeWidth={2.2} />
          </button>

          {errorMessage ? (
            <>
              <div className="text-[calc(18px*var(--fs))] font-bold mb-1">Couldn't read the text</div>
              <div className="text-[calc(14px*var(--fs))] text-[#475569] mb-4">{errorMessage}</div>
              <button
                onClick={handleDismissTranslation}
                className="w-full h-[48px] rounded-[14px] text-white font-bold text-[calc(14px*var(--fs))]"
                style={{ background: '#0F1419' }}
              >
                Try again
              </button>
            </>
          ) : translation && (
            <>
              {/* Source language label */}
              {translation.sourceLanguageName && (
                <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.16em] uppercase font-semibold text-[#94A3B8] mb-1">
                  From {translation.sourceLanguageName}
                  {translation.textCategory && translation.textCategory !== 'other' && (
                    <span> · {translation.textCategory.replace(/_/g, ' ')}</span>
                  )}
                </div>
              )}

              {/* Original text */}
              <div className="text-[calc(14.5px*var(--fs))] text-[#3A3128] leading-relaxed whitespace-pre-wrap mb-3">
                {translation.originalText}
              </div>

              {/* Romanization (only for non-Latin scripts) */}
              {translation.romanization && (
                <div className="mb-3 px-3 py-2 rounded-[10px] flex items-start gap-2" style={{ background: '#F7F4EC' }}>
                  <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold text-[#6B7280] mt-0.5 flex-none">Say it</div>
                  <div className="text-[calc(13px*var(--fs))] italic text-[#3A3128] flex-1">{translation.romanization}</div>
                  <button
                    onClick={handleSpeak}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-none"
                    style={{ background: '#0E7C73', color: '#fff' }}
                    aria-label="Speak"
                  >
                    <Volume2 size={14} color="#fff" strokeWidth={2.2} />
                  </button>
                </div>
              )}

              {/* Translation */}
              <div className="px-4 py-3.5 rounded-[14px] mb-3" style={{ background: CAT.todo.bg }}>
                <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.16em] uppercase font-semibold mb-1" style={{ color: CAT.todo.ink }}>
                  {currentLang.flag} {currentLang.label}
                </div>
                <div className="text-[calc(17px*var(--fs))] font-bold leading-relaxed whitespace-pre-wrap" style={{ color: CAT.todo.ink }}>
                  {translation.translation}
                </div>
              </div>

              {/* Screenshot hint */}
              <div className="text-[calc(12px*var(--fs))] text-[#6B7280] text-center mt-2 mb-3">
                📸 Feel free to take a screenshot to save it on your device.
              </div>

              {/* Scan-another quick action */}
              <button
                onClick={handleDismissTranslation}
                className="w-full h-[48px] rounded-[14px] flex items-center justify-center gap-2 font-bold text-[calc(14px*var(--fs))]"
                style={{ background: '#0F1419', color: '#fff' }}
              >
                <ScanLine size={16} color="#fff" strokeWidth={2.2} />
                Scan another
              </button>

              {/* Tertiary escape — exit the scanner back to Home. */}
              <button
                onClick={() => navigate(createPageUrl('Home'))}
                className="w-full mt-2 text-[#64748B] hover:text-[#0F1419] text-[calc(13px*var(--fs))] font-medium py-2 transition-colors"
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
          <div className="max-w-md mx-auto">
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
              className="w-full mt-2 text-white/90 hover:text-white text-[calc(13px*var(--fs))] font-semibold py-2 flex items-center justify-center gap-1.5"
            >
              ✂️ Select part of the image
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
          <div className="max-w-md mx-auto">
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
            className="absolute inset-0 z-40 flex items-end pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowLangPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-full rounded-t-[24px] max-h-[70vh] overflow-y-auto"
              style={{ background: '#FFFCF7' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 px-5 pt-4 pb-3 flex items-center justify-between" style={{ background: '#FFFCF7', borderBottom: '1px solid #F0E9DC' }}>
                <div>
                  <div className="text-[calc(18px*var(--fs))] font-extrabold text-[#0F1419]">Translate into…</div>
                  <div className="text-[calc(12px*var(--fs))] text-[#6B7280] mt-0.5">{LANGUAGES.length} languages</div>
                </div>
                <button
                  onClick={() => setShowLangPicker(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: '#F7F4EC' }}
                  aria-label="Close picker"
                >
                  <X size={18} color="#0F1419" strokeWidth={2.2} />
                </button>
              </div>
              <div className="px-2 py-2">
                {LANGUAGES.map((lang) => {
                  const isSelected = lang.code === targetLang;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setTargetLang(lang.code);
                        setShowLangPicker(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-left transition-colors"
                      style={{ background: isSelected ? CAT.todo.bg : 'transparent' }}
                    >
                      <span className="text-[calc(22px*var(--fs))] flex-none">{lang.flag}</span>
                      <div className="flex-1">
                        <div className="font-bold text-[calc(14.5px*var(--fs))]" style={{ color: isSelected ? CAT.todo.ink : '#0F1419' }}>
                          {lang.label}
                        </div>
                        <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.08em] text-[#94A3B8]">{lang.code}</div>
                      </div>
                      {isSelected && <span className="font-mono text-[calc(10px*var(--fs))] tracking-[0.14em] font-bold" style={{ color: CAT.todo.ink }}>✓ SELECTED</span>}
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
