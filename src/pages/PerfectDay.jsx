// PerfectDay — the doctrine's Perfect Day planner v1: selection-before-itinerary.
//
// S1 PICK: eight stampable attractions near the base (attractions/nearby → D1,
// owned data, zero Google/AI spend), photo-forward ONLY where a real photoUrl
// exists — a photoless stampable place renders as an engraved typographic stamp
// card (same visual register as StampsNearYou), never a colored placeholder.
// A mood lens (the VibeBundles moods, labels only — no emoji) reorders the deck
// by category affinity. Pick 2–4 cards, then compose.
//
// S2 DAY: Morning / Afternoon / Evening blocks, stops sequenced nearest-first
// from the base with honest straight-line travel estimates; lunch + dinner
// anchors from the owned restaurant default-browse path (coords-only body =
// the free Supabase path; the worker escalates to Google itself only when
// owned coverage < 5 — that spend is by design, not this page's doing); the
// Evening block appends tonight's priced event from the 6h-KV-cached events
// route. No new AI calls anywhere on this page.
//
// "Save this day" persists to localStorage (perfect_day_saved) and the saved
// day renders back on the next open with a "Start fresh" option.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getPrimaryStay } from "@/lib/savedLocations";
import { haversineKm } from "@/lib/homeContext";
import { localISODate } from "@/lib/localDate";
import { VIBE_BUNDLES } from "@/lib/vibeBundles";
import { stampArtUrl } from "@/lib/stampArt";
import TypographicStamp from "@/components/passport/TypographicStamp";
import { showToast } from "@/components/Toast";
import { createPageUrl } from "@/utils";
import { IVORY, IVORY_2, TEAL_DEEP } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INK = "#16302B", SUB = "#71827D", EDGE = "#E6DFD0";
const STAMP = "#B0472F", PAPER = "#FBF6EC";
const fs = (n) => `calc(${n}px*var(--fs))`;

const SAVE_KEY = "perfect_day_saved";

// Mood lens → attraction-category affinity. Categories are the D1 seed enum
// (scripts/attractions-seed/emit-seed.mjs CAT table); each mood translates its
// VibeBundles slots' intent onto the categories the stamp deck actually carries.
// Tapping a mood REORDERS the deck (affinity hits float to the top, prior order
// preserved within each group) — it never removes cards, so the pick stays open.
//   selfcare  (spa / quiet café / healthy)   → calm greens + water
//   nightout  (dinner / bars / live music)   → evening-walkable civic fabric
//   family    (family spots / parks / fun)   → big-draw all-ages places
//   active    (outdoors / hike / reset)      → nature, trails, water
//   relaxed   (stroll, shop, savor)          → markets, gardens, galleries
//   classics  (must-sees / photo spots)      → the icon shelf
const MOOD_AFFINITY = {
  selfcare: ["garden", "park", "viewpoint", "beach", "lake", "river"],
  nightout: ["square", "market", "tower", "viewpoint", "experience"],
  family: ["theme_park", "zoo", "aquarium", "park", "beach", "experience"],
  active: ["national_park", "nature_reserve", "waterfall", "viewpoint", "lake", "river", "beach", "park"],
  relaxed: ["market", "square", "garden", "art_gallery", "park"],
  classics: ["landmark", "historic", "monument", "museum", "palace", "fortress", "cathedral", "religious", "mosque", "shrine", "tower"],
};

// Straight-line travel heuristic between two stops: walk at 3 mph under 1.2 mi,
// otherwise drive at 25 mph. Labeled as an estimate in the day-view footnote.
function travelDelta(a, b) {
  if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return null;
  const miles = haversineKm(a.lat, a.lng, b.lat, b.lng) * 0.621371;
  if (miles < 1.2) return `+${Math.max(1, Math.round((miles / 3) * 60))} min walk`;
  return `+${Math.max(1, Math.round((miles / 25) * 60))} min drive`;
}


// Mono data line for a restaurant anchor. Owned rows carry rating:null — show
// only what we actually have; tierLabel exists only on the Google dish path.
function restNote(r) {
  if (!r) return "";
  const parts = [];
  if (Number.isFinite(r.rating)) parts.push(`${r.rating.toFixed(1)} rated`);
  if (Number.isFinite(r.distanceMiles)) parts.push(`${r.distanceMiles.toFixed(1)} mi`);
  if (r.tierLabel) parts.push(r.tierLabel);
  return parts.join(" · ");
}
// Source label per repo convention (always say whose data it is).
const restSource = (r) => (r && r._source === "owned" ? "GlobeSkimmers data" : "Google data");

// The engraved-stamp visual (the StampsNearYou register): bespoke stamp art in
// a dashed "not yet earned" ring, typographic stamp when a spot has no art yet.
function StampVisual({ item, size = 84 }) {
  const [fail, setFail] = useState(false);
  const art = stampArtUrl(item.name);
  return (
    <div
      className="mx-auto flex items-center justify-center"
      style={{
        width: size, height: size, borderRadius: "50%",
        border: `2px dashed ${STAMP}`, background: PAPER,
        boxShadow: "inset 0 0 0 1px rgba(176,71,47,.15)", opacity: 0.96,
      }}
    >
      {art && !fail ? (
        <img
          src={art} alt="" loading="lazy" onError={() => setFail(true)}
          style={{ width: size * 0.78, height: size * 0.78, objectFit: "contain", opacity: 0.92 }}
        />
      ) : (
        <TypographicStamp
          name={item.name} city={item.city} country={item.country}
          entityId={item.id || item.name} width={size * 0.84}
        />
      )}
    </div>
  );
}

// One pick card. Photo-forward only with a real photoUrl (broken photos degrade
// to the stamp register, never a colored box). Selected state rings in teal.
function DeckCard({ item, selected, onToggle }) {
  const [imgFail, setImgFail] = useState(false);
  const photo = item.photoUrl && !imgFail;
  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={`${selected ? "Remove" : "Add"}: ${item.name}`}
      className="text-left rounded-2xl overflow-hidden transition-transform active:scale-[0.98]"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${EDGE}`,
        boxShadow: selected ? `0 0 0 2px ${STAMP}` : "none",   // stamp red — teal is reserved for Compose, the surface's one primary action
      }}
    >
      {photo ? (
        <img
          src={item.photoUrl} alt="" loading="lazy" onError={() => setImgFail(true)}
          className="w-full object-cover" style={{ height: 96, display: "block" }}
        />
      ) : (
        <div className="pt-3"><StampVisual item={item} /></div>
      )}
      <div className="px-3 pt-2 pb-3">
        <div style={{ fontFamily: SERIF, color: INK, fontSize: fs(15), lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.name}
        </div>
        {Number.isFinite(item.distanceMiles) && (
          <div className="mt-1" style={{ fontFamily: MONO, color: SUB, fontSize: fs(10.5) }}>
            {item.distanceMiles.toFixed(1)} mi
          </div>
        )}
      </div>
    </button>
  );
}

// One attraction stop row in the day view.
function StopRow({ item, delta, onSwap, canSwap }) {
  const [imgFail, setImgFail] = useState(false);
  return (
    <div>
      {delta && (
        <div className="pl-1 pb-1.5" style={{ fontFamily: MONO, color: SUB, fontSize: fs(11) }}>{delta}</div>
      )}
      <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
        {item.photoUrl && !imgFail ? (
          <img src={item.photoUrl} alt="" loading="lazy" onError={() => setImgFail(true)} className="flex-none rounded-xl object-cover" style={{ width: 52, height: 52 }} />
        ) : (
          <div className="flex-none"><StampVisual item={item} size={52} /></div>
        )}
        <div className="min-w-0 flex-1">
          <div style={{ fontFamily: SERIF, color: INK, fontSize: fs(16), lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.name}
          </div>
          {Number.isFinite(item.distanceMiles) && (
            <div className="mt-0.5" style={{ fontFamily: MONO, color: SUB, fontSize: fs(10.5) }}>
              {item.distanceMiles.toFixed(1)} mi from base
            </div>
          )}
        </div>
        {canSwap && (
          <button onClick={onSwap} className="flex-none font-semibold" style={{ color: SUB, fontSize: fs(12) }}>
            Swap
          </button>
        )}
      </div>
    </div>
  );
}

// Lunch / dinner anchor row (self-hides upstream when there's no pick).
function AnchorRow({ kicker, name, note, source }) {
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ background: IVORY_2, border: `1px solid ${EDGE}` }}>
      <div style={{ fontFamily: MONO, color: STAMP, fontSize: fs(10), letterSpacing: "0.08em" }}>{kicker}</div>
      <div className="mt-0.5" style={{ fontFamily: SERIF, color: INK, fontSize: fs(16), lineHeight: 1.15 }}>{name}</div>
      <div className="mt-0.5 flex items-baseline justify-between gap-3">
        {note ? <div style={{ fontFamily: MONO, color: SUB, fontSize: fs(10.5) }}>{note}</div> : <span />}
        {source && <div className="flex-none" style={{ fontFamily: MONO, color: SUB, fontSize: fs(9.5) }}>{source}</div>}
      </div>
    </div>
  );
}

function BlockTitle({ children }) {
  return <div className="mb-2" style={{ fontFamily: SERIF, color: INK, fontSize: fs(20), lineHeight: 1.1 }}>{children}</div>;
}

// The single designed empty state (also serves the no-coords case) — engraved
// register: dashed border on paper, serif title, mono sub, exactly one action.
function EmptyState({ title, sub, actionLabel, onAction }) {
  return (
    <div className="rounded-2xl px-5 py-7 text-center" style={{ background: PAPER, border: `2px dashed ${STAMP}` }}>
      <div style={{ fontFamily: SERIF, color: INK, fontSize: fs(19), lineHeight: 1.15 }}>{title}</div>
      <div className="mt-1.5" style={{ fontFamily: MONO, color: SUB, fontSize: fs(11) }}>{sub}</div>
      <button
        onClick={onAction}
        className="mt-4 px-5 py-2.5 rounded-full font-semibold text-white"
        style={{ background: TEAL_DEEP, fontSize: fs(13.5) }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

export default function PerfectDay() {
  const navigate = useNavigate();
  const { getActiveLocation, switchToCurrentLocation } = useLocation();

  // Saved day (if any) renders back on open; "Start fresh" clears it.
  const [saved, setSaved] = useState(() => {
    try {
      const j = JSON.parse(localStorage.getItem(SAVE_KEY));
      return j && Array.isArray(j.stops) && j.stops.length ? j : null;
    } catch { return null; }
  });
  const [stage, setStage] = useState(saved ? "saved" : "pick"); // pick | day | saved

  const [deck, setDeck] = useState([]);
  const [deckLoading, setDeckLoading] = useState(true);
  const [mood, setMood] = useState(null);
  const [selected, setSelected] = useState([]); // attraction ids, 2-4
  const [dayStops, setDayStops] = useState([]);
  const [lunch, setLunch] = useState(null);
  const [dinner, setDinner] = useState(null);
  const [regenCount, setRegenCount] = useState(0);

  // Base = primary stay when set, else the active location (the finder pattern).
  // Coords are NESTED on the active-location shape; flat fallbacks cover the rest.
  const base = getPrimaryStay() || getActiveLocation?.() || null;
  const a = base?.address || {};
  const city = a.city || base?.city || base?.placeName || "";
  const lat = base?.coordinates?.latitude ?? base?.latitude ?? base?.lat;
  const lng = base?.coordinates?.longitude ?? base?.longitude ?? base?.lng;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  // Load the stampable deck — owned D1 data only. Secrets stay hidden unless
  // the traveler is physically inside the footprint (the StampsNearYou rule).
  useEffect(() => {
    let cancelled = false;
    if (!hasCoords) { setDeck([]); setDeckLoading(false); return; }
    setDeckLoading(true);
    (async () => {
      try {
        const { data, error } = await callWorker("attractions/nearby", { latitude: lat, longitude: lng, radiusKm: 40, limit: 24, includeSecrets: true, stampsOnly: true });
        if (cancelled) return;
        const raw = (!error && Array.isArray(data?.attractions)) ? data.attractions : [];
        setDeck(raw.filter((x) => x.tier !== "secret" || (Number.isFinite(x.distanceKm) && x.distanceKm * 1000 <= (x.footprint_radius_m || 150))));
      } catch { if (!cancelled) setDeck([]); }
      if (!cancelled) setDeckLoading(false);
    })();
    return () => { cancelled = true; };
  }, [hasCoords, lat, lng]);

  // Deck order: photo rows lead (photo-forward pick), then marquee, then nearest.
  // A mood lens floats its affinity categories to the top, order preserved
  // within each group — deterministic for the same deck + mood.
  const orderedDeck = useMemo(() => {
    const sorted = [...deck].sort((x, y) =>
      (Number(!!y.photoUrl) - Number(!!x.photoUrl)) ||
      (Number(!!y.isMarquee) - Number(!!x.isMarquee)) ||
      ((x.distanceMiles ?? 999) - (y.distanceMiles ?? 999)));
    const aff = mood ? MOOD_AFFINITY[mood] : null;
    if (!aff) return sorted;
    return [...sorted.filter((x) => aff.includes(x.category)), ...sorted.filter((x) => !aff.includes(x.category))];
  }, [deck, mood]);
  const deckView = orderedDeck.slice(0, 8);

  const toggleSelect = (id) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 4) return cur; // 3-4 picks is the design; hard cap at 4
      return [...cur, id];
    });
  };

  // Compose: selected stops nearest-first from the base (distanceMiles is the
  // worker's haversine from the queried center) — morning gets the first.
  const compose = () => {
    const chosen = orderedDeck.filter((x) => selected.includes(x.id));
    setDayStops([...chosen].sort((x, y) => (x.distanceMiles ?? 999) - (y.distanceMiles ?? 999)));
    setStage("day");
  };

  // Swap a stop for the next unused candidate AFTER it in deck order, wrapping
  // to the top — same tap on the same day, same result (deterministic).
  const swapStop = (idx) => {
    const used = new Set(dayStops.map((s) => s.id));
    const pool = orderedDeck.filter((x) => !used.has(x.id));
    if (!pool.length) return;
    const curPos = orderedDeck.findIndex((x) => x.id === dayStops[idx].id);
    const next = pool.find((x) => orderedDeck.findIndex((y) => y.id === x.id) > curPos) || pool[0];
    setDayStops(dayStops.map((s, i) => (i === idx ? next : s)));
  };

  // Re-deal the afternoon from the unused pool, stepping the starting point by
  // one per press (regenCount) — deterministic, and the morning stop is kept.
  const regenAfternoon = () => {
    const morning = dayStops[0];
    const aft = dayStops.slice(1);
    const used = new Set(dayStops.map((s) => s.id));
    const pool = orderedDeck.filter((x) => !used.has(x.id));
    if (!pool.length) return;
    const fresh = [];
    for (let i = 0; i < aft.length && fresh.length < pool.length; i++) {
      const c = pool[(regenCount + i) % pool.length];
      if (!fresh.some((f) => f.id === c.id)) fresh.push(c);
    }
    setDayStops([morning, ...fresh, ...aft.slice(fresh.length)]);
    setRegenCount((c) => c + 1);
  };

  // Lunch anchors near the morning stop, dinner near the last stop — coords-only
  // body keeps both requests on the owned (free) default-browse path. Re-runs
  // after a swap so the anchors stay near the actual stops (KV-cached upstream).
  useEffect(() => {
    if (stage !== "day" || !dayStops.length) return;
    let cancelled = false;
    const first = dayStops[0], last = dayStops[dayStops.length - 1];
    (async () => {
      const [l, d] = await Promise.all([
        callWorker(ROUTE.getRestaurants, { latitude: first.lat, longitude: first.lng, radius: 3000, maxResults: 12 }),
        callWorker(ROUTE.getRestaurants, { latitude: last.lat, longitude: last.lng, radius: 3000, maxResults: 12 }),
      ]);
      if (cancelled) return;
      const pick = (res, notId) => {
        const arr = Array.isArray(res?.data?.places) ? res.data.places : [];
        const best = arr
          .filter((p) => (p.id || p.placeId) !== notId)
          .sort((x, y) => ((y.rating ?? -1) - (x.rating ?? -1)) || ((x.distanceMiles ?? 999) - (y.distanceMiles ?? 999)))[0];
        return best ? { ...best, _source: res?.data?.source || "" } : null;
      };
      const lu = pick(l, null);
      setLunch(lu);
      setDinner(pick(d, lu ? (lu.id || lu.placeId) : null));
    })();
    return () => { cancelled = true; };
  }, [stage, dayStops]);


  const saveDay = () => {
    if (!dayStops.length) return;
    const stops = [];
    const seq = dayStops;
    const stopNote = (s) => (Number.isFinite(s.distanceMiles) ? `${s.distanceMiles.toFixed(1)} mi from base` : "");
    stops.push({ block: "Morning", kind: "stop", name: seq[0].name, note: stopNote(seq[0]) });
    if (lunch) stops.push({ block: "Morning", kind: "lunch", name: lunch.name, note: restNote(lunch), source: restSource(lunch) });
    seq.slice(1).forEach((s) => stops.push({ block: "Afternoon", kind: "stop", name: s.name, note: stopNote(s) }));
    if (dinner) stops.push({ block: "Evening", kind: "dinner", name: dinner.name, note: restNote(dinner), source: restSource(dinner) });
    const payload = { city, date: localISODate(), stops };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(payload)); } catch { /* storage unavailable — the day still shows */ }
    setSaved(payload);
    setStage("saved");
    showToast("Perfect day saved");
  };

  const startFresh = () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    setSaved(null);
    setSelected([]);
    setDayStops([]);
    setLunch(null); setDinner(null); setEvt(null);
    setStage("pick");
  };

  const kicker = city ? `A PERFECT DAY IN ${String(city).toUpperCase()}` : "A PERFECT DAY";
  const morning = dayStops[0] || null;
  const afternoon = dayStops.slice(1);
  const swapPoolLeft = orderedDeck.some((x) => !dayStops.some((s) => s.id === x.id));

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => (stage === "day" ? setStage("pick") : navigate(-1))}
          aria-label="Back"
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "#F1EADF" }}
        >
          <ArrowLeft size={18} color={INK} strokeWidth={2.2} />
        </button>
        <div className="min-w-0">
          <div style={{ fontFamily: MONO, color: SUB, fontSize: fs(10.5), letterSpacing: "0.1em" }}>{kicker}</div>
          <h1 style={{ fontFamily: SERIF, fontSize: fs(26), color: INK, lineHeight: 1.05 }}>
            {stage === "pick" ? "Pick what appeals" : stage === "day" ? "Your day, composed" : "Your saved day"}
          </h1>
        </div>
      </div>

      <div className="px-4 pt-2 pb-10" style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* ============ S1 — PICK ============ */}
        {stage === "pick" && (
          <>
            {!hasCoords ? (
              <EmptyState
                title="Where will this day happen?"
                sub="Set a location and the stamp deck fills in"
                actionLabel="Use my current location"
                onAction={() => switchToCurrentLocation?.()}
              />
            ) : deckLoading ? (
              <div className="py-10 text-center" style={{ fontFamily: MONO, color: SUB, fontSize: fs(11) }}>
                Finding stampable places nearby…
              </div>
            ) : !deckView.length ? (
              <EmptyState
                title="No stamps within reach yet"
                sub="Nothing stampable inside 25 miles of this spot"
                actionLabel="Browse things to do"
                onAction={() => navigate(createPageUrl("ThingsToDo"))}
              />
            ) : (
              <>
                {/* Mood lens — reorders the deck, never narrows it */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                  {VIBE_BUNDLES.map((b) => {
                    const on = mood === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setMood(on ? null : b.id)}
                        className="flex-none px-3.5 py-1.5 rounded-full"
                        style={{
                          background: on ? INK : IVORY_2,
                          color: on ? IVORY : INK,
                          border: `1px solid ${on ? INK : EDGE}`,
                          fontFamily: MONO,
                          fontSize: fs(11.5),
                        }}
                      >
                        {b.title}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  {deckView.map((it) => (
                    <DeckCard key={it.id} item={it} selected={selected.includes(it.id)} onToggle={() => toggleSelect(it.id)} />
                  ))}
                </div>

                {/* Compose — the one primary action on this surface */}
                <div className="sticky bottom-0 pt-4 pb-3" style={{ background: `linear-gradient(transparent, ${IVORY} 40%)` }}>
                  <button
                    onClick={compose}
                    disabled={selected.length < 2}
                    className="w-full py-3 rounded-full font-semibold text-white transition-opacity"
                    style={{ background: TEAL_DEEP, opacity: selected.length < 2 ? 0.4 : 1, fontSize: fs(15) }}
                  >
                    Compose my day{selected.length ? ` · ${selected.length}` : ""}
                  </button>
                  <div className="mt-1.5 text-center" style={{ fontFamily: MONO, color: SUB, fontSize: fs(10) }}>
                    Pick 2–4 places
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ============ S2 — DAY ============ */}
        {stage === "day" && morning && (
          <div className="space-y-6">
            <section>
              <BlockTitle>Morning</BlockTitle>
              <div className="space-y-2">
                <StopRow item={morning} delta={null} canSwap={swapPoolLeft} onSwap={() => swapStop(0)} />
                {lunch && <AnchorRow kicker="LUNCH" name={lunch.name} note={restNote(lunch)} source={restSource(lunch)} />}
              </div>
            </section>

            {afternoon.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between mb-2 gap-3">
                  <div style={{ fontFamily: SERIF, color: INK, fontSize: fs(20), lineHeight: 1.1 }}>Afternoon</div>
                  {swapPoolLeft && (
                    <button onClick={regenAfternoon} className="flex-none font-semibold" style={{ color: SUB, fontSize: fs(12) }}>
                      Regenerate afternoon
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {afternoon.map((s, i) => (
                    <StopRow
                      key={s.id}
                      item={s}
                      delta={travelDelta(i === 0 ? morning : afternoon[i - 1], s)}
                      canSwap={swapPoolLeft}
                      onSwap={() => swapStop(i + 1)}
                    />
                  ))}
                </div>
              </section>
            )}

            {dinner && (
              <section>
                <BlockTitle>Evening</BlockTitle>
                <div className="space-y-2">
                  <AnchorRow kicker="DINNER" name={dinner.name} note={restNote(dinner)} source={restSource(dinner)} />
                </div>
              </section>
            )}

            <div style={{ fontFamily: MONO, color: SUB, fontSize: fs(10) }}>
              Travel times are estimates — straight-line distance at a 3 mph walk / 25 mph drive.
            </div>

            {/* Footer — provenance + the one primary action on this surface */}
            <div>
              <button
                onClick={saveDay}
                className="w-full py-3 rounded-full font-semibold text-white"
                style={{ background: TEAL_DEEP, fontSize: fs(15) }}
              >
                Save this day
              </button>
              <div className="mt-2 text-center" style={{ fontFamily: MONO, color: SUB, fontSize: fs(10) }}>
                Every stop from our own data · real prices where shown
              </div>
            </div>
          </div>
        )}

        {/* ============ SAVED ============ */}
        {stage === "saved" && saved && (
          <div className="space-y-6">
            <div style={{ fontFamily: MONO, color: SUB, fontSize: fs(10.5), letterSpacing: "0.08em" }}>
              SAVED · {saved.date}{saved.city ? ` · ${String(saved.city).toUpperCase()}` : ""}
            </div>
            {["Morning", "Afternoon", "Evening"].map((block) => {
              const rows = saved.stops.filter((s) => s.block === block);
              if (!rows.length) return null;
              return (
                <section key={block}>
                  <BlockTitle>{block}</BlockTitle>
                  <div className="space-y-2">
                    {rows.map((s, i) => (
                      <div key={`${block}-${i}`} className="rounded-2xl px-3 py-2.5" style={{ background: s.kind === "stop" ? "#FFFFFF" : IVORY_2, border: `1px solid ${EDGE}` }}>
                        {s.kind !== "stop" && (
                          <div style={{ fontFamily: MONO, color: STAMP, fontSize: fs(10), letterSpacing: "0.08em" }}>
                            {s.kind === "lunch" ? "LUNCH" : s.kind === "dinner" ? "DINNER" : "TONIGHT"}
                          </div>
                        )}
                        <div style={{ fontFamily: SERIF, color: INK, fontSize: fs(16), lineHeight: 1.15 }}>{s.name}</div>
                        <div className="mt-0.5 flex items-baseline justify-between gap-3">
                          {s.note ? <div style={{ fontFamily: MONO, color: SUB, fontSize: fs(10.5) }}>{s.note}</div> : <span />}
                          {s.source && <div className="flex-none" style={{ fontFamily: MONO, color: SUB, fontSize: fs(9.5) }}>{s.source}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
            <div>
              <button
                onClick={startFresh}
                className="w-full py-3 rounded-full font-semibold text-white"
                style={{ background: TEAL_DEEP, fontSize: fs(15) }}
              >
                Start fresh
              </button>
              <div className="mt-2 text-center" style={{ fontFamily: MONO, color: SUB, fontSize: fs(10) }}>
                Every stop from our own data · real prices where shown
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
