/**
 * NameLanguageHelp — quiet "How to say it" / "Say it" / "Translate" links under business
 * names that aren't plain English (the new look: Eat.dc.html L146-150).
 *
 * Decision matrix (using nameAnalyzer.js, purely client-side):
 *   hasNonLatin                 → How to say it + Say it + Translate
 *   !hasNonLatin && !looksEnglish → Say it + Translate
 *   !hasNonLatin && looksEnglish  → render nothing
 *
 * Lazy fetch: tapping ANY link fires a single getNameInfo call that
 * returns { romanization, translation }. Cached 90 days per placeId.
 * Subsequent taps of the other link reveal the already-loaded data
 * without a second fetch.
 *
 * Look: 12.5/500 #3A3128 links underlined in the world line, each with a 14px lucide icon
 * in the world ink (Type, Volume2, Languages), joined by a muted '·'. Each link has a 44px
 * hit area while the row stays one text line tall. The two disclosures carry aria-expanded
 * and aria-controls. No emoji.
 *
 * Props: placeId, name; ink (icon colour) and line (underline colour), or world (a WORLD
 * row or key, giving iconInk and line). Defaults are the shared neutrals.
 *
 * Used by: PlacesToEat, CoffeeFinder, MoneyExchange, ThingsToDo,
 * Shopping, ConvenienceStore, RestroomFinder. (Excluded: ATMFinder.)
 */
import React, { useState, useEffect, useId } from 'react';
import { Languages, Type, Volume2 } from 'lucide-react';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { hasNonLatinScript, looksEnglish } from '@/lib/nameAnalyzer';
import { NEUTRAL, fs, worldOf } from '@/components/redesign/constants';

/**
 * @param {{ placeId?: string, name?: string, ink?: string, line?: string, world?: any }} props
 */
export default function NameLanguageHelp({ placeId = undefined, name = undefined, ink = undefined, line = undefined, world = undefined }) {
  const w = world && typeof world === 'object' ? world : worldOf(world);
  const iconInk = ink || (w ? w.iconInk : NEUTRAL.ink2);
  const underline = line || (w ? w.line : NEUTRAL.lobbyLine);
  const uid = useId();
  const pronounceId = `${uid}-say`;
  const translateId = `${uid}-tr`;
  const [pronounceOpen, setPronounceOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  // sayItPending: user tapped "Say it" but data hasn't loaded yet —
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
    callWorker(ROUTE.getNameInfo, { placeId, name })
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

  const linkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    minHeight: 44,
    // The 44px hit area reaches past the 18px row instead of making it taller.
    margin: '-13px 0',
    padding: 0,
    background: 'transparent',
    border: 0,
    color: NEUTRAL.ink2,
    fontSize: fs(12.5),
    lineHeight: 1.2,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    textDecorationColor: underline,
    textUnderlineOffset: 3,
  };
  const icon = (Icon) => <Icon size={14} color={iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />;
  const dot = <span aria-hidden="true" style={{ fontSize: fs(12.5), color: NEUTRAL.ink3 }}>·</span>;

  const revealStyle = {
    marginTop: '4px',
    fontSize: fs(12),
    color: NEUTRAL.ink2,
    fontStyle: 'italic',
    lineHeight: '1.4',
  };

  const links = [];
  if (showPronounce) {
    links.push(
      <button
        key="say"
        type="button"
        onClick={(e) => { e.stopPropagation(); setPronounceOpen(o => !o); }}
        style={linkStyle}
        aria-expanded={pronounceOpen}
        aria-controls={pronounceId}
      >
        {icon(Type)}
        {pronounceOpen ? 'Hide pronunciation' : 'How to say it'}
      </button>
    );
  }
  if (showSayIt && speechSupported) {
    links.push(
      <button
        key="audio"
        type="button"
        onClick={onSayIt}
        style={linkStyle}
        aria-label="Say it in the local language"
      >
        {icon(Volume2)}
        Say it
      </button>
    );
  }
  if (showTranslate) {
    links.push(
      <button
        key="tr"
        type="button"
        onClick={(e) => { e.stopPropagation(); setTranslateOpen(o => !o); }}
        style={linkStyle}
        aria-expanded={translateOpen}
        aria-controls={translateId}
      >
        {icon(Languages)}
        {translateOpen ? 'Hide translation' : 'Translate'}
      </button>
    );
  }

  return (
    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '8px', rowGap: '26px', minHeight: 18 }}>
        {links.map((l, i) => (
          <React.Fragment key={i}>
            {i > 0 ? dot : null}
            {l}
          </React.Fragment>
        ))}
      </div>

      <div id={pronounceId} hidden={!pronounceOpen}>
        {loading && pronounceOpen && <div style={revealStyle}>Loading…</div>}
        {error && pronounceOpen && <div style={{ ...revealStyle, color: NEUTRAL.stamp }}>Couldn't load: {error}</div>}
        {pronounceOpen && data?.romanization && <div style={revealStyle}>Pronounced: {data.romanization}</div>}
        {pronounceOpen && data && !data.romanization && <div style={revealStyle}>Already in Latin script.</div>}
      </div>
      <div id={translateId} hidden={!translateOpen}>
        {loading && translateOpen && !pronounceOpen && <div style={revealStyle}>Loading…</div>}
        {error && translateOpen && !pronounceOpen && <div style={{ ...revealStyle, color: NEUTRAL.stamp }}>Couldn't load: {error}</div>}
        {translateOpen && data?.translation && <div style={revealStyle}>Means: {data.translation}</div>}
        {translateOpen && data && !data.translation && <div style={revealStyle}>Name is already English (or a person's name).</div>}
      </div>
    </div>
  );
}
