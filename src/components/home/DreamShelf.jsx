// DreamShelf — Home's stamp shelf on the plum stock (Home-Boxes L190-269), dream
// stack only.
//
// The region's stampable places as the promise of the trip: 'Stamps of *Lisbon*'
// (fallback 'Your *stamp shelf*'), then the worker's rows (ICONS OF …, CUSTOMER
// FAVORITES, WORTH A DAY TRIP), each card with its distance from the shelf's anchor
// in the traveler's unit. Owned attraction data only (/dream/shelf, D1 — zero
// Google/AI spend). Not-yet-collected places lead each row.
//
//   The count line: '39 TO COLLECT' until one is earned, then '3 OF 39 COLLECTED',
//   plus '68°F NOW' and, when it's a flight away, '~9H FLIGHT (EST)'. Each fragment
//   shows only when its data is real.
//   earnedIds   a Set of collected entity ids from Home's one passport read. While it
//               is null the shelf waits, so the count and the order never flip after
//               it lands; earnedError: the read failed, so the shelf shows without
//               a count or collected marks rather than claiming none are collected.
//               Without the prop (undefined) the shelf reads the passport itself.
//
// Deliberately different from StampsNearYou: no secrets (found by being there,
// never dreamed); the REGION, not a circle around you; photo cards when a place
// has a real photo, the stamp tile otherwise. A tap opens the place's page (Home's
// onOpenActivity). Collected cards get a brass edge and the COLLECTED badge (boxes)
// or 'COLLECTED' printed after the distance (bands).
import { useEffect, useState } from "react";
import { Ship } from "lucide-react";
import { useLocation } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { countryCode } from "@/lib/countries";
import { distanceUnit, distanceLabel } from "@/lib/units";
import { callWorker } from "@/lib/callWorker";
import { listPassport } from "@/lib/passport";
import { haversineKm } from "@/lib/homeContext";
import { estFlightHours, MIN_FLIGHT_MILES, KM_TO_MI } from "@/lib/flightTime";
import { logDiscover } from "@/lib/logDiscover";
import { HomeZone, useHomeZoneStyle } from "@/components/redesign/Zone";
import { NEUTRAL, ZONE, fs } from "@/components/redesign/constants";
import StampThumb from "@/components/passport/StampThumb";

const Z = ZONE.shelf;
const FERRY = ["catalina", "alcatraz", "statue of liberty", "liberty island", "ellis island", "angel island", "channel islands"];

const spokenDist = (d) => (d ? d.replace(/ MI$/, " miles").replace(/ KM$/, " kilometres") : "");

function CollectedBadge() {
  return (
    <span
      className="font-mono uppercase"
      style={{ position: "absolute", top: 6, left: 6, padding: "2px 4px", borderRadius: 4, background: "rgba(251,246,236,.94)", fontSize: fs(8.5), lineHeight: 1.2, letterSpacing: ".1em", color: NEUTRAL.stamp }}
    >
      Collected
    </span>
  );
}

// The mono line under a card: the distance (or FERRY · distance with a ship), and in
// the bands variant 'COLLECTED' printed after it in stamp red.
function DistanceLine({ dist, ferry, collectedInline }) {
  if (!dist && !collectedInline) return null;
  return (
    <span className="font-mono uppercase inline-flex items-center" style={{ marginTop: 2, gap: 4, fontSize: fs(10), lineHeight: 1.2, letterSpacing: ".08em", color: NEUTRAL.ink3 }}>
      {ferry && <Ship size={11} strokeWidth={2} aria-hidden="true" />}
      {ferry && "FERRY · "}{dist}
      {collectedInline && <span style={{ color: NEUTRAL.stamp }}>{dist ? " · " : ""}Collected</span>}
    </span>
  );
}

function ShelfCard({ item, collected, dist, ferry, bands, onOpen }) {
  const [photoFail, setPhotoFail] = useState(false);
  const label = [item.name, spokenDist(dist), ferry ? "by ferry" : "", collected ? "collected" : ""].filter(Boolean).join(", ");
  const edge = collected ? `1px solid ${Z.accent}` : "1px solid transparent";

  if (item.photoUrl && !photoFail) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="flex-none flex flex-col text-left overflow-hidden"
        style={{ width: fs(132), borderRadius: 16, background: NEUTRAL.white, border: edge, padding: 0, cursor: "pointer" }}
      >
        <span className="relative block w-full" style={{ aspectRatio: "4 / 3", background: NEUTRAL.ivory2 }}>
          <img src={item.photoUrl} alt="" loading="lazy" onError={() => setPhotoFail(true)} className="w-full h-full object-cover" />
          {collected && !bands && <CollectedBadge />}
        </span>
        <span className="flex flex-col" style={{ padding: "8px 10px 10px" }}>
          <span className="font-serif" style={{ fontSize: fs(15), lineHeight: 1.1, color: NEUTRAL.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.name}</span>
          <DistanceLine dist={dist} ferry={ferry} collectedInline={collected && bands} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="flex-none relative flex flex-col items-center"
      style={{ width: fs(132), minHeight: 160, boxSizing: "border-box", padding: collected ? "7px 7px 10px" : "8px 8px 10px", borderRadius: 18, background: Z.tile, border: collected ? edge : 0, cursor: "pointer" }}
    >
      <span aria-hidden="true" className="flex-none" style={{ display: "block", width: 96, height: 96 }}>
        <StampThumb stamp={{ ...item, entity_id: item.id }} size={96} strength={collected ? undefined : 0} />
      </span>
      <span className="font-serif" style={{ marginTop: 6, width: "100%", fontSize: fs(15), lineHeight: 1.1, textAlign: "center", color: NEUTRAL.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.name}</span>
      <DistanceLine dist={dist} ferry={ferry} collectedInline={collected && bands} />
      {collected && !bands && <CollectedBadge />}
    </button>
  );
}

// cityTempF / cityTempC are OPTIONAL: the dreamed city's current temperature, when
// Home already holds it; tempUnit picks which one prints. No temperature → that
// fragment hides.
export default function DreamShelf({ latitude, longitude, cityName, cityTempF = null, cityTempC = null, tempUnit = "F", earnedIds: earnedProp = undefined, earnedError = false, onOpenActivity }) {
  const { currentGpsLocation, activeLocation } = useLocation();
  const { profile } = useAuth();
  const zoneStyle = useHomeZoneStyle();
  const [tiers, setTiers] = useState([]); // [{ key, title, items }]
  const [metroName, setMetroName] = useState(null);
  const [ownEarned, setOwnEarned] = useState(null);
  const ownRead = earnedProp === undefined;

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { setTiers([]); return undefined; }
    (async () => {
      try {
        // The REGION's shelf: the worker names the rows. No secrets.
        const [shelf, pass] = await Promise.all([
          callWorker("dream/shelf", { latitude, longitude, cityName: cityName || "" }),
          ownRead ? listPassport() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const got = (!shelf.error && Array.isArray(shelf.data?.tiers)) ? shelf.data.tiers : [];
        setMetroName(shelf.data?.metro?.name || null);
        setTiers(got.map((t) => ({ ...t, items: (t.items || []).filter((a) => a.tier !== "secret") })));
        // Attraction stamps store the attraction id as entity_id.
        if (pass) setOwnEarned(pass.error ? false : new Set((pass.stamps || []).filter((s) => s && s.entity_id != null).map((s) => String(s.entity_id))));
      } catch { if (!cancelled) setTiers([]); }
    })();
    return () => { cancelled = true; };
  }, [latitude, longitude, cityName, ownRead]);

  // What's collected: a Set, or false when the read failed (no count, no marks).
  let earned = null;
  if (ownRead) earned = ownEarned;
  else if (earnedProp instanceof Set) earned = earnedProp;
  else if (earnedError) earned = false;
  if (earned === null) return null; // wait, so the count and the order never flip

  const has = (it) => earned instanceof Set && earned.has(String(it.id));
  // Each row needs 3+ places to read as a set; the shelf hides when none does.
  // Not-yet-collected places lead each row, so the shelf always offers what's next.
  const rows = tiers
    .map((t) => ({ ...t, items: [...t.items.filter((it) => !has(it)), ...t.items.filter(has)].slice(0, 16) }))
    .filter((t) => t.items.length >= 3);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !rows.length) return null;

  const all = rows.flatMap((t) => t.items);
  const got = earned instanceof Set ? all.filter(has).length : null;
  const city = String(metroName || cityName || "").trim();

  // The count line's fragments, each only when its data is real.
  const frags = [];
  if (got != null) frags.push(got > 0 ? `${got} OF ${all.length} COLLECTED` : `${all.length} TO COLLECT`);
  const t = tempUnit === "C" ? cityTempC : cityTempF;
  if (Number.isFinite(t)) frags.push(`${Math.round(t)}°${tempUnit === "C" ? "C" : "F"} NOW`);
  const gpsLat = currentGpsLocation?.coordinates?.latitude;
  const gpsLng = currentGpsLocation?.coordinates?.longitude;
  if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng)) {
    const mi = haversineKm(gpsLat, gpsLng, latitude, longitude) * KM_TO_MI;
    if (mi >= MIN_FLIGHT_MILES) frags.push(`~${estFlightHours(mi)}H FLIGHT (EST)`);
  }

  // Distance under each card, from the shelf's anchor, in the traveler's unit.
  const unit = distanceUnit(profile, countryCode(activeLocation?.address?.country || currentGpsLocation?.address?.country) || "");
  const distOf = (it) => (Number.isFinite(it?.lat) && Number.isFinite(it?.lng) ? distanceLabel(haversineKm(latitude, longitude, it.lat, it.lng), unit) : null);
  const ferryOf = (it) => FERRY.some((f) => String(it.name || "").toLowerCase().includes(f));
  const bands = zoneStyle === "bands";

  const openDream = (item) => {
    logDiscover("dream_shelf_tap", { place_id: item.id, place_name: item.name });
    onOpenActivity?.(item);
  };

  return (
    <HomeZone zone="shelf" label="Stamp shelf">
      <h3 className="font-serif m-0" style={{ fontWeight: 400, fontSize: fs(24), lineHeight: 1.15, color: Z.title }}>
        {city ? <>Stamps of <em style={{ color: Z.accent }}>{city}</em></> : <>Your <em style={{ color: Z.accent }}>stamp shelf</em></>}
      </h3>
      {frags.length > 0 && (
        <p className="font-mono" style={{ margin: "4px 0 0", fontSize: fs(10), lineHeight: 1.3, letterSpacing: ".1em", color: Z.meta }}>{frags.join(" · ")}</p>
      )}
      {rows.map((row, i) => (
        <div key={row.key} style={{ marginTop: i === 0 ? 12 : 10 }}>
          <div className="flex items-center" style={{ gap: 10, minHeight: 12, marginRight: -16 }}>
            <span className="flex-none font-mono uppercase" style={{ fontSize: fs(10), lineHeight: 1.2, letterSpacing: ".14em", color: Z.meta }}>{row.title}</span>
            <span aria-hidden="true" style={{ flex: 1, height: 1, background: Z.rowRule }} />
          </div>
          <div className="flex items-start overflow-x-auto" style={{ gap: 12, marginTop: 6, marginRight: -16, paddingRight: 16, paddingBottom: 2, scrollbarWidth: "none" }}>
            {row.items.map((it) => (
              <ShelfCard key={it.id} item={it} collected={has(it)} dist={distOf(it)} ferry={ferryOf(it)} bands={bands} onOpen={() => openDream(it)} />
            ))}
          </div>
        </div>
      ))}
    </HomeZone>
  );
}
