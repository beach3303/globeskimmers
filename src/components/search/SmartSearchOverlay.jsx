// SmartSearchOverlay — the full-screen Smart-Search experience.
//
// One input + three scope chips (Near me · At my stay · A place…). Most searches
// need NO AI: the scope is a tap and the category is rule-parsed. Only ambiguous
// free-text falls through to the Haiku parser. On submit it re-centers the app and
// opens the right finder (or re-centers Home for a bare place), logging the search
// to the demand graph. Reuses smartSearch.js (parse + dispatch), searchLocation
// (place autocomplete), and the LocationContext re-center primitive.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Search, MapPin, Home as HomeIcon, Globe, Loader2, Clock } from "lucide-react";
import { useLocation } from "@/components/location/LocationContext";
import { getPrimaryStay } from "@/lib/savedLocations";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { placePhrase } from "@/lib/placeContext";
import { parseSmartSearch, runSmartSearch } from "@/lib/smartSearch";

const IVORY = "#FFFCF7", INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const RECENTS_KEY = "gs_smart_search_recents_v1";

const SCOPES = [
  { id: "near_me", label: "Near me", icon: MapPin },
  { id: "at_stay", label: "At my stay", icon: HomeIcon },
  { id: "named_place", label: "A place…", icon: Globe },
];
// Starter suggestions (shown until the user has recents) — each seeds the input.
const SUGGESTIONS = ["Coffee near me", "Things to do", "Where to stay", "Best dinner", "Viral desserts", "ATM"];

function readRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); } catch { return []; }
}

export default function SmartSearchOverlay({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("near_me");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState([]);
  const [chosenPlace, setChosenPlace] = useState(null); // a searchLocation result
  const [busy, setBusy] = useState(false);
  const [recents, setRecents] = useState([]);
  const inputRef = useRef(null);

  const hasStay = !!getPrimaryStay();

  // Reset + focus when opened.
  useEffect(() => {
    if (!isOpen) return;
    setQ(""); setScope("near_me"); setPlaceQuery(""); setPlaceResults([]); setChosenPlace(null); setBusy(false);
    setRecents(readRecents().slice(0, 6));
    const t = setTimeout(() => inputRef.current?.focus(), 70);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Esc closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Place autocomplete (debounced) for the "A place…" scope.
  useEffect(() => {
    if (scope !== "named_place" || chosenPlace) { setPlaceResults([]); return; }
    const term = placeQuery.trim();
    if (term.length < 2) { setPlaceResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await callWorker(ROUTE.searchLocation, { query: term });
        if (!cancelled) setPlaceResults(Array.isArray(data?.results) ? data.results.slice(0, 5) : []);
      } catch { if (!cancelled) setPlaceResults([]); }
    }, 280);
    return () => { cancelled = true; clearTimeout(t); };
  }, [scope, placeQuery, chosenPlace]);

  const saveRecent = (text) => {
    try {
      const next = [text, ...readRecents().filter((r) => r !== text)].slice(0, 8);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const submit = useCallback(async (rawOverride) => {
    const raw = String(rawOverride ?? q).trim();
    // Named-place with no chosen place + no text → nothing to do.
    if (!raw && !(scope === "named_place" && (chosenPlace || placeQuery.trim()))) return;
    setBusy(true);
    try {
      const active = location.getActiveLocation?.();
      const explicitPlace = scope === "named_place"
        ? (chosenPlace?.placeName || chosenPlace?.address?.city || placeQuery.trim() || null)
        : null;
      const parsed = await parseSmartSearch(raw, {
        scopeChip: scope,
        explicitPlace,
        activePhrase: placePhrase(active),
      });
      if (raw) saveRecent(raw);
      // Fast path: user picked an exact place from autocomplete → re-center on it
      // directly (skip re-geocoding by name), then dispatch category/query.
      if (scope === "named_place" && chosenPlace?.coordinates) {
        try { await location.switchToNavigateMode(chosenPlace); } catch { /* ignore */ }
        await runSmartSearch({ ...parsed, scope: "near_me", place: chosenPlace.placeName || explicitPlace }, { navigate, location });
      } else {
        await runSmartSearch(parsed, { navigate, location });
      }
      onClose();
    } catch { /* keep the overlay open on failure */ }
    setBusy(false);
  }, [q, scope, chosenPlace, placeQuery, location, navigate, onClose]);

  if (!isOpen) return null;

  const canSubmit = !!q.trim() || (scope === "named_place" && (chosenPlace || placeQuery.trim()));

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col" style={{ background: IVORY }}>
      {/* Header: input + close */}
      <div className="px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${EDGE}` }}>
        <div className="max-w-md mx-auto flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: "#fff", border: `1px solid ${EDGE}` }}>
            <Search className="w-[18px] h-[18px] flex-none" style={{ color: TEAL }} strokeWidth={2.4} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Search food, hotels, a whole city…"
              className="flex-1 bg-transparent outline-none text-[calc(15px*var(--fs))]"
              style={{ color: INK }}
              enterKeyHint="search"
              autoComplete="off"
            />
            {q && <button onClick={() => setQ("")} aria-label="Clear" className="flex-none" style={{ color: SUB }}><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={onClose} className="flex-none text-[calc(13px*var(--fs))] font-semibold px-2 py-2" style={{ color: SUB }}>Cancel</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-4">
          {/* Scope chips */}
          <div className="flex items-center gap-2 mb-4">
            {SCOPES.map((s) => {
              const active = scope === s.id;
              const disabled = s.id === "at_stay" && !hasStay;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  disabled={disabled}
                  onClick={() => { setScope(s.id); if (s.id !== "named_place") { setChosenPlace(null); setPlaceQuery(""); } }}
                  title={disabled ? "Set where you're staying first" : undefined}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[calc(12.5px*var(--fs))] font-semibold transition-colors disabled:opacity-40"
                  style={active ? { background: TEAL, color: "#fff" } : { background: "#F2EEE6", color: INK }}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />{s.label}
                </button>
              );
            })}
          </div>

          {/* Place picker — only for "A place…" */}
          {scope === "named_place" && (
            <div className="mb-4">
              {chosenPlace ? (
                <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "#fff", border: `1px solid ${EDGE}` }}>
                  <Globe className="w-4 h-4 flex-none" style={{ color: TEAL }} />
                  <span className="flex-1 min-w-0 truncate text-[calc(14px*var(--fs))] font-semibold" style={{ color: INK }}>{chosenPlace.placeName || chosenPlace.full_name}</span>
                  <button onClick={() => { setChosenPlace(null); setPlaceQuery(""); }} aria-label="Change place" style={{ color: SUB }}><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "#fff", border: `1px solid ${EDGE}` }}>
                    <MapPin className="w-4 h-4 flex-none" style={{ color: SUB }} />
                    <input
                      value={placeQuery}
                      onChange={(e) => setPlaceQuery(e.target.value)}
                      placeholder="Which city or place?"
                      className="flex-1 bg-transparent outline-none text-[calc(14px*var(--fs))]"
                      style={{ color: INK }}
                      autoComplete="off"
                    />
                  </div>
                  {placeResults.length > 0 && (
                    <div className="mt-1.5 rounded-xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${EDGE}` }}>
                      {placeResults.map((r, i) => (
                        <button
                          key={r.placeId || i}
                          onClick={() => { setChosenPlace(r); setPlaceResults([]); }}
                          className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-black/[0.02]"
                          style={{ borderTop: i ? `1px solid ${EDGE}` : "none" }}
                        >
                          <MapPin className="w-3.5 h-3.5 flex-none" style={{ color: TEAL }} />
                          <span className="min-w-0 truncate text-[calc(13.5px*var(--fs))]" style={{ color: INK }}>{r.full_name || r.placeName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={() => submit()}
            disabled={!canSubmit || busy}
            className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-45 transition-opacity"
            style={{ background: TEAL }}
          >
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</> : <><Search className="w-4 h-4" strokeWidth={2.4} /> Search</>}
          </button>

          {/* Recents / suggestions */}
          <div className="mt-6">
            <div className="font-mono uppercase tracking-[0.14em] text-[calc(10px*var(--fs))] font-semibold mb-2.5" style={{ color: SUB }}>
              {recents.length ? "Recent" : "Try"}
            </div>
            <div className="flex flex-wrap gap-2">
              {(recents.length ? recents : SUGGESTIONS).map((text, i) => (
                <button
                  key={i}
                  onClick={() => { setQ(text); submit(text); }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[calc(12.5px*var(--fs))]"
                  style={{ background: "#F2EEE6", color: INK }}
                >
                  {recents.length && <Clock className="w-3 h-3" style={{ color: SUB }} />}
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
