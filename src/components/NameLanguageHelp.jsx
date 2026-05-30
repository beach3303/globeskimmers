/**
 * NameLanguageHelp — renders subtle "🔤 Pronounce" / "🌐 Translate" buttons
 * under business names that aren't plain English.
 *
 * Decision matrix (using nameAnalyzer.js, purely client-side):
 *   hasNonLatin                 → both Pronounce + Translate buttons
 *   !hasNonLatin && !looksEnglish → Translate only
 *   !hasNonLatin && looksEnglish  → render nothing
 *
 * Lazy fetch: tapping EITHER button fires a single getNameInfo call that
 * returns { romanization, translation }. Cached 90 days per placeId.
 * Subsequent taps of the other button reveal the already-loaded data
 * without a second fetch.
 *
 * Used by: PlacesToEat, CoffeeFinder, MoneyExchange, ThingsToDo,
 * Shopping, ConvenienceStore, RestroomFinder. (Excluded: ATMFinder.)
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { hasNonLatinScript, looksEnglish } from '@/lib/nameAnalyzer';

const GRAY = '#64748B';
const GRAY_DARK = '#475569';

export default function NameLanguageHelp({ placeId, name }) {
  const [pronounceOpen, setPronounceOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  // sayItPending: user tapped "🔊 Say it" but data hasn't loaded yet —
  // speak as soon as it arrives.
  const [sayItPending, setSayItPending] = useState(false);
  const [data, setData] = useState(/** @type {{romanization: string|null, translation: string|null, lang: string|null, nativeScript: string|null}|null} */ (null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const nonLatin = hasNonLatinScript(name);
  const english = looksEnglish(name);
  const showPronounce = nonLatin;
  const showTranslate = nonLatin || !english;
  // Audio button appears whenever Translate would — i.e., any name that
  // isn't plain English. Lets users hear "Trattoria della Nonna" in
  // Italian even though it's already in Latin script.
  const showSayIt = showTranslate;
  const speechSupported = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

  const needFetch = (pronounceOpen || translateOpen || sayItPending) && !data && !loading;

  useEffect(() => {
    if (!needFetch) return;
    if (!placeId || !name) return;
    setLoading(true);
    setError(null);
    base44.functions.invoke('getNameInfo', { placeId, name })
      .then(({ data: resp }) => {
        if (resp?.error) {
          setError(resp.error);
        } else {
          setData({
            romanization: resp?.romanization ?? null,
            translation: resp?.translation ?? null,
            lang: resp?.lang ?? null,
            nativeScript: resp?.nativeScript ?? null,
          });
        }
      })
      .catch((e) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [needFetch, placeId, name]);

  // Fires the audio once data lands after a deferred "Say it" tap.
  // Prefer the native-script form (e.g., 大丸東京) over the displayed
  // romanization ("Daimaru Tokyo") so the native voice can pronounce
  // it authentically instead of spelling letters.
  useEffect(() => {
    if (!sayItPending || !data) return;
    const textToSpeak = data.nativeScript || name;
    speak(textToSpeak, data.lang);
    setSayItPending(false);
  }, [sayItPending, data, name]);

  // Resolves with the device's voice list. iOS Safari returns an empty
  // array on first call and fires `voiceschanged` once voices load —
  // handle both cases here so we can match by language.
  const ensureVoicesLoaded = () => new Promise((resolve) => {
    if (!speechSupported) { resolve([]); return; }
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    const onChanged = () => {
      voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = null;
      resolve(voices);
    };
    window.speechSynthesis.onvoiceschanged = onChanged;
    // Fallback if voiceschanged never fires
    setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 1200);
  });

  // Pick the best voice for the target lang. Scoring prefers exact
  // region match, then same language different region, then bumps for
  // higher-quality variants (enhanced/premium) and local-service voices
  // (e.g. iOS Siri voices, which are on-device and native-sounding).
  const pickBestVoice = (voices, lang) => {
    if (!lang || !voices || voices.length === 0) return null;
    const targetLower = lang.toLowerCase();
    const targetPrefix = targetLower.split('-')[0];
    const scored = [];
    for (const v of voices) {
      const vLang = (v.lang || '').toLowerCase();
      if (!vLang) continue;
      let score = 0;
      if (vLang === targetLower) score += 100;
      else if (vLang.split('-')[0] === targetPrefix) score += 50;
      else continue; // language mismatch — skip entirely (avoid the
                     // "English voice tries to pronounce Japanese
                     // characters phonetically" failure mode)
      const nameLower = (v.name || '').toLowerCase();
      if (nameLower.includes('enhanced') || nameLower.includes('premium') || nameLower.includes('siri')) score += 15;
      if (v.localService) score += 8;
      // Avoid English-named voices that happen to have other lang variants
      if (vLang.startsWith('en-')) score -= 20;
      scored.push({ voice: v, score });
    }
    if (scored.length === 0) return null;
    scored.sort((a, b) => b.score - a.score);
    return scored[0].voice;
  };

  const speak = async (text, lang) => {
    if (!speechSupported || !text) return;
    try {
      window.speechSynthesis.cancel(); // stop any current playback
      const voices = await ensureVoicesLoaded();
      const voice = pickBestVoice(voices, lang);
      const u = new window.SpeechSynthesisUtterance(text);
      if (voice) {
        // Setting voice tells the engine WHICH voice to use, regardless
        // of utterance.lang. This is the fix for the "phonetic English
        // voice tries to read Japanese" issue — we explicitly pick the
        // native voice instead.
        u.voice = voice;
        u.lang = voice.lang;
      } else if (lang) {
        // No matching local voice on this device — try the lang code
        // anyway. Browser may fall back to a synthesizer that can
        // produce something useful, or remain silent.
        u.lang = lang;
      }
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch (_e) { /* graceful no-op */ }
  };

  const onSayIt = (e) => {
    e.stopPropagation();
    if (data) {
      // Prefer native script (e.g., 大丸東京) over romanized displayed
      // name ("Daimaru Tokyo") for authentic local pronunciation.
      const textToSpeak = data.nativeScript || name;
      speak(textToSpeak, data.lang);
    } else {
      // Fetch first; useEffect will speak once data arrives.
      setSayItPending(true);
    }
  };

  if (!showPronounce && !showTranslate) return null;

  const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'transparent',
    border: 'none',
    padding: '2px 4px',
    color: GRAY,
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
  };

  const revealStyle = {
    marginTop: '4px',
    fontSize: '12px',
    color: GRAY_DARK,
    fontStyle: 'italic',
    lineHeight: '1.4',
  };

  return (
    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {showPronounce && (
          <button
            onClick={(e) => { e.stopPropagation(); setPronounceOpen(o => !o); }}
            style={buttonStyle}
            aria-label={pronounceOpen ? 'Hide pronunciation' : 'Show pronunciation'}
          >
            🔤 {pronounceOpen ? 'Hide pronunciation' : 'How to say it'}
          </button>
        )}
        {showSayIt && speechSupported && (
          <button
            onClick={onSayIt}
            style={buttonStyle}
            aria-label="Play audio pronunciation in local language"
            title="Hear it spoken in the local language"
          >
            🔊 Say it
          </button>
        )}
        {showTranslate && (
          <button
            onClick={(e) => { e.stopPropagation(); setTranslateOpen(o => !o); }}
            style={buttonStyle}
            aria-label={translateOpen ? 'Hide translation' : 'Show translation'}
          >
            🌐 {translateOpen ? 'Hide translate' : 'Translate'}
          </button>
        )}
      </div>

      {loading && (pronounceOpen || translateOpen) && (
        <div style={revealStyle}>Loading…</div>
      )}
      {error && (pronounceOpen || translateOpen) && (
        <div style={{ ...revealStyle, color: '#B91C1C' }}>Couldn't load: {error}</div>
      )}
      {pronounceOpen && data?.romanization && (
        <div style={revealStyle}>↪ {data.romanization}</div>
      )}
      {translateOpen && data?.translation && (
        <div style={revealStyle}>↪ Means: {data.translation}</div>
      )}
      {pronounceOpen && data && !data.romanization && (
        <div style={revealStyle}>Already in Latin script.</div>
      )}
      {translateOpen && data && !data.translation && (
        <div style={revealStyle}>Name is already English (or a person's name).</div>
      )}
    </div>
  );
}
