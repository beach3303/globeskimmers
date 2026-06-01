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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Flow steps:
  //   'intro'        — welcome card (first open only, then persisted)
  //   'language'     — language picker
  //   'camera'       — live camera preview, awaiting freeze
  //   'translating'  — Claude API call in flight
  //   'frozen'       — frame frozen, translation overlay visible
  //   'limit'        — daily limit reached card
  const [step, setStep] = useState('intro');

  const [targetLang, setTargetLang] = useState('en');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const [frozenFrame, setFrozenFrame] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [todayCount, setTodayCount] = useState(0);

  // Initial setup: load saved lang + count, decide which step to show
  useEffect(() => {
    const savedLang = localStorage.getItem(STORAGE_KEY_LANG);
    if (savedLang) setTargetLang(savedLang);

    const introSeen = localStorage.getItem(STORAGE_KEY_INTRO_SEEN) === '1';
    const count = readDailyCount();
    setTodayCount(count);

    if (count >= DAILY_LIMIT) {
      setStep('limit');
    } else if (introSeen) {
      setStep('camera');
    } else {
      setStep('intro');
    }
  }, []);

  // Persist target language whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANG, targetLang);
  }, [targetLang]);

  // Start/stop camera based on step
  useEffect(() => {
    if (step === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Camera handling (rear-only, mirrors SmartPriceScanner) ────────────────
  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError({ message: 'Camera not supported on this device' });
      return;
    }
    try {
      // Tier 1: exact environment
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' } },
          audio: false,
        });
      } catch {
        // Tier 2: ideal environment + verify
        try {
          const s = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
          const settings = s.getVideoTracks()[0]?.getSettings();
          if (settings?.facingMode === 'environment') {
            stream = s;
          } else {
            s.getTracks().forEach((t) => t.stop());
          }
        } catch {}
      }
      // Tier 3: device enumeration, pick by label
      if (!stream) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videos = devices.filter((d) => d.kind === 'videoinput');
        const rear = videos.find((d) => /back|rear|environment/i.test(d.label)) || videos[videos.length - 1];
        if (rear) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: rear.deviceId } },
            audio: false,
          });
        }
      }
      if (!stream) {
        setCameraError({ message: 'Could not access rear camera. Try opening this in a browser with camera permission.' });
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((res, rej) => {
          videoRef.current.onloadedmetadata = () => videoRef.current.play().then(res).catch(rej);
          videoRef.current.onerror = rej;
        });
        // Enable continuous autofocus when the device supports it. Falls back
        // silently on devices that don't expose focusMode (most iOS Safari).
        try {
          const track = stream.getVideoTracks()[0];
          const caps = track?.getCapabilities?.() || {};
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch { /* focus constraints are best-effort */ }
        setCameraReady(true);
      }
    } catch (e) {
      setCameraError({ message: e.message || 'Camera error' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  // ── Capture frame + call Claude for translation ───────────────────────────
  const handleFreezeAndTranslate = async () => {
    if (!cameraReady || !videoRef.current || !canvasRef.current) return;
    if (todayCount >= DAILY_LIMIT) {
      setStep('limit');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frozenUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFrozenFrame(frozenUrl);
    setStep('translating');

    // Convert to base64 (strip data: prefix)
    const base64 = frozenUrl.split(',')[1];

    try {
      const res = await fetch(`${WORKER_URL}/scan-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg', targetLanguage: targetLang }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Translation failed');
        setStep('frozen');
        return;
      }
      // Quality gate: if Claude returned empty / low confidence
      if (!data.originalText || !data.translation || data.confidence < 0.3) {
        setErrorMessage('No clear text detected — hold the camera steady and closer to the text.');
        setStep('frozen');
        return;
      }
      // Charge a token only on a successful translate. Refunds aren't a thing
      // since cost is incurred regardless, but we don't punish OCR-failed scans.
      const next = incrementDailyCount();
      setTodayCount(next);
      setTranslation(data);
      setStep('frozen');
    } catch (e) {
      setErrorMessage('Network error — check your connection and try again.');
      setStep('frozen');
    }
  };

  const handleDismissTranslation = () => {
    setFrozenFrame(null);
    setTranslation(null);
    setErrorMessage(null);
    if (todayCount >= DAILY_LIMIT) {
      setStep('limit');
    } else {
      setStep('camera');
    }
  };

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
      <div className="min-h-screen font-sans flex flex-col" style={{ background: IVORY }}>
        {/* Violet gradient header */}
        <div
          className="text-white px-5 pt-6 pb-7 rounded-b-[24px]"
          style={{
            background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 55%, #A855F7 100%)',
            boxShadow: '0 14px 30px -16px rgba(124,58,237,.55)',
          }}
        >
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity font-semibold text-[14px]"
            >
              <ChevronLeft size={18} color="#fff" strokeWidth={2.2} />
              <span>Back</span>
            </button>
          </div>
          <div className="max-w-md mx-auto mt-3 text-[26px] font-extrabold tracking-tight leading-tight">
            Smart <span className="font-serif italic font-normal">Text Scanner</span>
          </div>
        </div>

        {/* Intro body */}
        <div className="max-w-md mx-auto px-5 pt-6 pb-8 flex-1 flex flex-col">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div
              className="w-[88px] h-[88px] mx-auto rounded-[26px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #C5197A 100%)',
                boxShadow: '0 16px 34px -14px rgba(124,58,237,.6)',
              }}
            >
              <ScanLine size={42} color="#fff" strokeWidth={1.8} />
            </div>
            <div className="mt-[18px] text-[28px] font-extrabold text-[#0F1419] tracking-tight">
              Translate anything, <span className="font-serif italic font-normal text-[#7C3AED]">instantly.</span>
            </div>
            <div className="mt-3 text-[15px] text-[#475569] leading-relaxed">
              Point your camera at a sign, menu, or product label — we read it, translate it, AND show you how to say it.
            </div>
          </motion.div>

          {/* What you get */}
          <div className="mt-6 px-4 py-4 rounded-[16px]" style={{ background: '#fff', border: '1px solid #F0E9DC' }}>
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase font-semibold text-[#6B7280] mb-2">What's in your pocket</div>
            <ul className="space-y-2 text-[13.5px] text-[#0F1419]">
              <li className="flex gap-2"><span>•</span><span><strong>25 languages</strong> with pronunciation for Japanese, Thai, Korean, Arabic, Chinese and more</span></li>
              <li className="flex gap-2"><span>•</span><span>Lives right next to your maps + money exchange — <strong>no app-switching</strong> mid-trip</span></li>
              <li className="flex gap-2"><span>•</span><span><strong>10 free translations daily</strong></span></li>
            </ul>
          </div>

          {/* Screenshot tip */}
          <div className="mt-3 px-4 py-3.5 rounded-[14px] text-[12.5px] leading-relaxed" style={{ background: CAT.todo.bg, color: CAT.todo.ink }}>
            <div className="font-bold mb-1">📸 Want to remember a translation?</div>
            Feel free to take a screenshot to save it on your device.
          </div>

          {/* Start button */}
          <div className="mt-auto pt-6">
            <button
              onClick={handleStartScanning}
              className="w-full h-[54px] rounded-[16px] text-white flex items-center justify-center gap-2 font-bold text-[15.5px]"
              style={{ background: '#0F1419', boxShadow: '0 12px 28px -14px rgba(15,20,25,.4)' }}
            >
              Got it, let's translate
              <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Limit reached card ───────────────────────────────────────────
  if (step === 'limit') {
    return (
      <div className="min-h-screen font-sans flex flex-col items-center justify-center px-5" style={{ background: IVORY }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center">
          <div className="text-[64px] leading-none">🎯</div>
          <div className="mt-4 text-[28px] font-extrabold text-[#0F1419] tracking-tight">
            You've used all <span className="font-serif italic font-normal text-[#C5197A]">10 free</span> translations today.
          </div>
          <div className="mt-3 text-[14.5px] text-[#475569] leading-relaxed">
            Resets at midnight your time.
          </div>

          <div className="mt-5 px-4 py-4 rounded-[14px] text-left" style={{ background: CAT.todo.bg, color: CAT.todo.ink }}>
            <div className="font-bold text-[13.5px] mb-1">✨ Quick travel tip</div>
            <div className="text-[12.5px] leading-relaxed">
              Screenshot your most-needed translations as you go — they'll be saved on your phone forever, even offline.
            </div>
          </div>

          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="mt-6 w-full h-[54px] rounded-[16px] text-white font-bold text-[15.5px]"
            style={{ background: '#0F1419', boxShadow: '0 12px 28px -14px rgba(15,20,25,.4)' }}
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  // ── RENDER: Camera + frozen states ───────────────────────────────────────
  const currentLang = findLanguage(targetLang);
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0F1419' }}>
      {/* Video preview (always mounted so the stream stays warm) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: frozenFrame ? 'none' : 'block' }}
      />
      {frozenFrame && (
        <img src={frozenFrame} alt="frozen frame" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera error state */}
      {cameraError && step === 'camera' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center" style={{ background: '#0F1419' }}>
          <div className="text-[48px] mb-3">📷</div>
          <div className="text-white text-[18px] font-bold mb-2">Camera not available</div>
          <div className="text-white/70 text-[14px] mb-6">{cameraError.message}</div>
          <button onClick={() => navigate(createPageUrl('Home'))} className="px-5 py-3 rounded-[14px] bg-white text-[#0F1419] font-bold text-[14px]">
            Back to Home
          </button>
        </div>
      )}

      {/* TOP CHROME — Back + counter chip + language pill */}
      <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-3 pb-4 bg-gradient-to-b from-black/60 to-transparent">
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
            className="px-3 py-1.5 rounded-full font-mono text-[10.5px] font-semibold tracking-[0.08em]"
            style={{ background: 'rgba(0,0,0,0.55)', color: counterColor, backdropFilter: 'blur(10px)' }}
          >
            {remaining} of {DAILY_LIMIT} left today
          </div>

          {/* Language picker pill — only on camera step (not while frozen) */}
          {step === 'camera' && (
            <button
              onClick={() => setShowLangPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-[12.5px]"
              style={{ background: 'rgba(255,255,255,0.95)', color: '#0F1419', backdropFilter: 'blur(10px)' }}
            >
              <span>{currentLang.flag}</span>
              <span>{currentLang.label}</span>
              <ChevronDown size={14} color="#0F1419" strokeWidth={2.4} />
            </button>
          )}
          {(step === 'frozen' || step === 'translating') && <div className="w-10 h-10" />}
        </div>
      </div>

      {/* CAMERA aim hint */}
      {step === 'camera' && cameraReady && !cameraError && (
        <div className="absolute left-0 right-0 top-1/3 z-10 pointer-events-none text-center text-white">
          <div className="inline-block px-4 py-2 rounded-full text-[12.5px] font-semibold" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}>
            👉 Point at a sign, menu, or label
          </div>
        </div>
      )}

      {/* TRANSLATING spinner */}
      {step === 'translating' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="px-6 py-5 rounded-[20px] text-center text-white" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(14px)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <RefreshCw size={28} color="#fff" strokeWidth={2} className="inline-block" />
            </motion.div>
            <div className="mt-2 font-bold text-[14px]">Translating…</div>
          </div>
        </div>
      )}

      {/* TRANSLATION overlay — appears in 'frozen' state */}
      {step === 'frozen' && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-0 left-0 right-0 z-20 rounded-t-[24px] px-5 pt-5 pb-7 text-[#0F1419]"
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
              <div className="text-[18px] font-bold mb-1">Couldn't read the text</div>
              <div className="text-[14px] text-[#475569] mb-4">{errorMessage}</div>
              <button
                onClick={handleDismissTranslation}
                className="w-full h-[48px] rounded-[14px] text-white font-bold text-[14px]"
                style={{ background: '#0F1419' }}
              >
                Try again
              </button>
            </>
          ) : translation && (
            <>
              {/* Source language label */}
              {translation.sourceLanguageName && (
                <div className="font-mono text-[10px] tracking-[0.16em] uppercase font-semibold text-[#94A3B8] mb-1">
                  From {translation.sourceLanguageName}
                  {translation.textCategory && translation.textCategory !== 'other' && (
                    <span> · {translation.textCategory.replace(/_/g, ' ')}</span>
                  )}
                </div>
              )}

              {/* Original text */}
              <div className="text-[14.5px] text-[#3A3128] leading-relaxed whitespace-pre-wrap mb-3">
                {translation.originalText}
              </div>

              {/* Romanization (only for non-Latin scripts) */}
              {translation.romanization && (
                <div className="mb-3 px-3 py-2 rounded-[10px] flex items-start gap-2" style={{ background: '#F7F4EC' }}>
                  <div className="font-mono text-[9.5px] tracking-[0.14em] uppercase font-semibold text-[#6B7280] mt-0.5 flex-none">Say it</div>
                  <div className="text-[13px] italic text-[#3A3128] flex-1">{translation.romanization}</div>
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
                <div className="font-mono text-[10px] tracking-[0.16em] uppercase font-semibold mb-1" style={{ color: CAT.todo.ink }}>
                  {currentLang.flag} {currentLang.label}
                </div>
                <div className="text-[17px] font-bold leading-relaxed whitespace-pre-wrap" style={{ color: CAT.todo.ink }}>
                  {translation.translation}
                </div>
              </div>

              {/* Screenshot hint */}
              <div className="text-[12px] text-[#6B7280] text-center mt-2 mb-3">
                📸 Feel free to take a screenshot to save it on your device.
              </div>

              {/* Scan-another quick action */}
              <button
                onClick={handleDismissTranslation}
                className="w-full h-[48px] rounded-[14px] flex items-center justify-center gap-2 font-bold text-[14px]"
                style={{ background: '#0F1419', color: '#fff' }}
              >
                <ScanLine size={16} color="#fff" strokeWidth={2.2} />
                Scan another
              </button>
            </>
          )}
        </motion.div>
      )}

      {/* BOTTOM CTA — "Freeze & translate" (only on camera step) */}
      {step === 'camera' && cameraReady && !cameraError && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-8 pt-6 bg-gradient-to-t from-black/60 to-transparent">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleFreezeAndTranslate}
              className="w-full h-[58px] rounded-[18px] flex items-center justify-center gap-2 font-bold text-[16px] text-white"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #C5197A 100%)',
                boxShadow: '0 14px 34px -10px rgba(124,58,237,.55)',
              }}
            >
              <ScanLine size={20} color="#fff" strokeWidth={2.2} />
              Freeze & translate
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
            className="absolute inset-0 z-40 flex items-end"
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
                  <div className="text-[18px] font-extrabold text-[#0F1419]">Translate into…</div>
                  <div className="text-[12px] text-[#6B7280] mt-0.5">{LANGUAGES.length} languages</div>
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
                      <span className="text-[22px] flex-none">{lang.flag}</span>
                      <div className="flex-1">
                        <div className="font-bold text-[14.5px]" style={{ color: isSelected ? CAT.todo.ink : '#0F1419' }}>
                          {lang.label}
                        </div>
                        <div className="font-mono text-[10px] tracking-[0.08em] text-[#94A3B8]">{lang.code}</div>
                      </div>
                      {isSelected && <span className="font-mono text-[10px] tracking-[0.14em] font-bold" style={{ color: CAT.todo.ink }}>✓ SELECTED</span>}
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
