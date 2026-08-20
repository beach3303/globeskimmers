// StampsNearYou — "Stamps near your stay" homepage row.
//
// Turns the Virtual Passport into a discovery hook: iconic, collectible stamps
// you can earn near where you are / where you're staying, with the DISTANCE from
// your spot. Centered on the active location (which auto-follow keeps current;
// the accommodation anchor in Phase 2 will pin it). Owned attraction data only
// (attractions/nearby, D1 — zero Google/AI spend). Renders NOTHING when there's
// no coverage, so the tiles + feed above stand alone.
//
// A tap opens the attraction (ActivityDetail), where the GPS-verified "I was
// here" stamp is actually earned — we never claim a tap collects a stamp.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { stampArtUrl } from "@/lib/stampArt";
import { logDiscover } from "@/lib/logDiscover";
import { createPageUrl } from "@/utils";

const INK = "#243447", INK3 = "#66717D", STAMP = "#B0472F", PAPER = "#FBF6EC", EDGE = "#E6DFD0";

// One collectible stamp: the bespoke stamp art in a dashed "not yet earned" ring;
// falls back to a clean rubber-stamp placeholder when a spot has no art yet.
function StampChip({ item, wide, onOpen }) {
  const [fail, setFail] = useState(false);
  const art = stampArtUrl(item.name);
  const size = wide ? 116 : 100;
  const miles = Number.isFinite(item.distanceMiles) ? `${item.distanceMiles.toFixed(1)} mi` : null;
  return (
    <button onClick={onOpen} className={`flex-none text-center ${wide ? "w-[150px]" : "w-[128px]"}`} aria-label={`Stamp: ${item.name}`}>
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
          <div className="flex flex-col items-center justify-center px-1 text-center">
            <span style={{ fontSize: size * 0.26, lineHeight: 1 }}>🛂</span>
            <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', color: STAMP, fontSize: `calc(11px*var(--fs))`, marginTop: 2, lineHeight: 1.05, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.name}</span>
          </div>
        )}
      </div>
      <div className="mt-1.5 leading-tight" style={{ fontFamily: '"Instrument Serif", Georgia, serif', color: INK, fontSize: `calc(13px*var(--fs))`, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {item.name}
      </div>
      {miles && <div className="mt-0.5" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: INK3, fontSize: `calc(10.5px*var(--fs))` }}>{miles}</div>}
    </button>
  );
}

export default function StampsNearYou({ onAction, wide = false }) {
  const { getActiveLocation } = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loc = getActiveLocation?.();
    const lat = loc?.latitude ?? loc?.lat;
    const lng = loc?.longitude ?? loc?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setItems([]); return; }
    (async () => {
      try {
        const { data, error } = await callWorker("attractions/nearby", { latitude: lat, longitude: lng, radius: 15000, limit: 16 });
        if (cancelled) return;
        const list = (!error && Array.isArray(data?.attractions)) ? data.attractions.slice() : [];
        // Iconic first, then nearest — the marquee spots read as "worth a stamp".
        list.sort((a, b) => (Number(!!b.isMarquee) - Number(!!a.isMarquee)) || ((a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)));
        setItems(list.slice(0, 12));
      } catch { if (!cancelled) setItems([]); }
    })();
    return () => { cancelled = true; };
  }, [getActiveLocation]);

  if (!items.length) return null;

  // Open the attraction so the user can earn the stamp there (GPS "I was here").
  const openStamp = (item) => {
    try {
      const loc = getActiveLocation?.();
      const activity = {
        id: item.id, name: item.name, category: item.category,
        photos: item.photoUrl ? [item.photoUrl] : [],
        description: item.whyVisit || item.description || "",
        latitude: item.lat, longitude: item.lng, rating: item.rating,
        free_to_visit: item.freeToVisit,
        distance_km: Number.isFinite(item.distanceKm) ? item.distanceKm : undefined,
      };
      sessionStorage.setItem("current_activity", JSON.stringify(activity));
      if (loc) sessionStorage.setItem("activity_location", JSON.stringify(loc));
      logDiscover("home_stamp_tap", { place_id: item.id, place_name: item.name });
      navigate(createPageUrl("ActivityDetail"));
    } catch { onAction?.("Things to Do"); }
  };

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="flex items-baseline justify-between mb-2 px-0.5 gap-3">
          <div className="min-w-0">
            <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: "#16302B" }}>Stamps near your stay 🛂</div>
            <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: "#71827D" }}>Collect these as you explore</div>
          </div>
          <button
            onClick={() => navigate(createPageUrl("Passport"))}
            className="flex-none text-[calc(12.5px*var(--fs))] font-semibold"
            style={{ color: "#17A38F" }}
          >
            My Passport →
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {items.map((it) => (
            <StampChip key={it.id} item={it} wide={wide} onOpen={() => openStamp(it)} />
          ))}
        </div>
      </div>
    </div>
  );
}
