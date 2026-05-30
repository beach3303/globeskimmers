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
 * Shopping, ConvenienceStore. (Excluded: RestroomFinder, ATMFinder.)
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { hasNonLatinScript, looksEnglish } from '@/lib/nameAnalyzer';

const GRAY = '#64748B';
const GRAY_DARK = '#475569';

export default function NameLanguageHelp({ placeId, name }) {
  const [pronounceOpen, setPronounceOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [data, setData] = useState(/** @type {{romanization: string|null, translation: string|null}|null} */ (null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const nonLatin = hasNonLatinScript(name);
  const english = looksEnglish(name);
  const showPronounce = nonLatin;
  const showTranslate = nonLatin || !english;

  const needFetch = (pronounceOpen || translateOpen) && !data && !loading;

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
          });
        }
      })
      .catch((e) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [needFetch, placeId, name]);

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
            🔤 {pronounceOpen ? 'Hide pronounce' : 'Pronounce'}
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
