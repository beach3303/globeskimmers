import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { searchHomeCities, resolveHomePlace } from '@/lib/homePlace';

// Reusable "search your home city" field. Debounces a city search, and on pick
// resolves the exact timezone (from the city's coordinates) before handing the
// parent a place: { city, country, latitude, longitude, timezone, label }.
// Used by onboarding and Settings so both capture home the same accurate way.
export default function HomeCityField({ onSelect, autoFocus = false, placeholder = 'Search your home city…' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [resolvingKey, setResolvingKey] = useState(null);
  const timerRef = useRef(null);

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

  const pick = async (result, key) => {
    if (resolvingKey != null) return;
    setResolvingKey(key);
    const place = await resolveHomePlace(result);
    setResolvingKey(null);
    onSelect(place);
  };

  const q = query.trim();

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-xl focus:border-[#088395] focus:outline-none"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />}
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border-2 border-gray-200 divide-y divide-gray-100">
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

        {!searching && q.length >= 3 && results.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500 text-sm">No cities match — try &ldquo;City, Country&rdquo;.</div>
        )}
        {q.length < 3 && (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Type your home city (at least 3 letters).</div>
        )}
      </div>
    </div>
  );
}
