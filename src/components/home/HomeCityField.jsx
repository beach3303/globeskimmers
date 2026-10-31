import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { searchHomeCities, resolveHomePlace, matchCountry, countryHomePlace } from '@/lib/homePlace';

// Reusable "search your home city" field. Debounces a city search, and on pick
// resolves the exact timezone (from the city's coordinates) before handing the
// parent a place: { city, country, latitude, longitude, timezone, label }.
// Used by onboarding and Settings so both capture home the same accurate way.
//
// 2026-10-30 (the founder's Android test): a country typed on its own ("US", "USA", "United
// States of America") is offered as an answer too — its flag and name at the top of the list,
// `countryOnly: true` in the place — and the list keeps to the room above the keyboard: the
// field scrolls to the top when it takes focus, and the list's height follows the visual
// viewport. `onFocusChange(true)` tells the step the keyboard is coming, so it can fold its
// header away.
export default function HomeCityField({ onSelect, autoFocus = false, placeholder = 'Search your home city…', onFocusChange = undefined }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [resolvingKey, setResolvingKey] = useState(null);
  const [maxH, setMaxH] = useState(288);
  const timerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); setSearching(false); return; }
    setSearching(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = await searchHomeCities(query);
      setResults(r);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // The list ends above the keyboard: its height is what the visual viewport leaves under it.
  const fit = () => {
    const el = listRef.current;
    if (!el) return;
    const vh = window.visualViewport?.height || window.innerHeight;
    const top = el.getBoundingClientRect().top - (window.visualViewport?.offsetTop || 0);
    setMaxH(Math.max(132, Math.min(288, Math.floor(vh - top - 60))));
  };
  useEffect(() => {
    const vv = window.visualViewport;
    const on = () => fit();
    vv?.addEventListener('resize', on);
    window.addEventListener('resize', on);
    return () => { vv?.removeEventListener('resize', on); window.removeEventListener('resize', on); };
  }, []);
  useEffect(() => { fit(); }, [results.length, query]);

  const onFocus = () => {
    onFocusChange?.(true);
    // Once the keyboard has settled, the list fits what's left. (No scrollIntoView: it moved the
    // whole page and put the title under the banner.)
    setTimeout(fit, 300);
    setTimeout(fit, 700);
  };

  const pick = async (result, key) => {
    if (resolvingKey != null) return;
    setResolvingKey(key);
    const place = await resolveHomePlace(result);
    setResolvingKey(null);
    onSelect(place);
  };
  const pickCountry = (c) => {
    if (resolvingKey != null) return;
    onSelect(countryHomePlace(c));
  };

  const q = query.trim();
  const countries = useMemo(() => matchCountry(q), [q]);
  const empty = !searching && q.length >= 3 && results.length === 0;

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoCapitalize="words"
          autoCorrect="off"
          enterKeyHint="search"
          className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-xl focus:border-[#088395] focus:outline-none"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />}
      </div>

      <div ref={listRef} className="overflow-y-auto rounded-xl border-2 border-gray-200 divide-y divide-gray-100" style={{ maxHeight: maxH }}>
        {/* A country, typed on its own: the flag's country as home. */}
        {countries.map((c) => (
          <button
            key={c.iso}
            onClick={() => pickCountry(c)}
            disabled={resolvingKey != null}
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{c.name}</p>
              <p className="text-xs text-gray-500">Set {c.name} as home. Add your city later for an exact local time.</p>
            </div>
          </button>
        ))}
        {results.map((r, i) => {
          const key = r.placeId || i;
          return (
            <button
              key={key}
              onClick={() => pick(r, key)}
              disabled={resolvingKey != null}
              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-blue-50 transition-colors disabled:opacity-60"
            >
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{r.placeName || r.address?.city || r.city}</p>
                <p className="text-xs text-gray-500 truncate">{r.address?.formatted || r.full_name}</p>
              </div>
              {resolvingKey === key && <Loader2 className="w-4 h-4 text-[#088395] animate-spin flex-shrink-0" />}
            </button>
          );
        })}

        {empty && countries.length > 0 && (
          <div className="px-4 py-3 text-center text-gray-500 text-xs">Or type your city for an exact local time — “Manila”, “Los Angeles”.</div>
        )}
        {empty && countries.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500 text-sm">No cities match — try &ldquo;City, Country&rdquo;.</div>
        )}
        {q.length < 3 && countries.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Type your home city or country (at least 3 letters).</div>
        )}
      </div>
    </div>
  );
}
