// NearbyStampPrompt — when the Passport opens, sense where the traveler is and
// offer the stamp they can earn right here (founder, 2026-09-26): an attraction
// whose footprint they are standing in (owned attractions DB, stampsOnly, the
// same GPS rule as "I was here" on the attraction page) or the airport they are
// inside (the worker's aerodrome geofence, same as the arrival prompt). One
// candidate → a single card; several → a list, stamp one or close. Nothing is
// ever stamped without a tap; a "Not now" holds for the rest of the session per
// place (sessionStorage), and places already in the passport are skipped.
import React, { useEffect, useState } from "react";
import { callWorker } from "@/lib/callWorker";
import { addStamp } from "@/lib/passport";
import { airportAt } from "@/lib/airports";
import { stampRadiusFor } from "@/lib/stampRadius";
import { resolveStampVariant } from "@/lib/stampVariants";
import { countryCode } from "@/lib/countries";
import { localISODate } from "@/lib/localDate";
import { stampArtUrl } from "@/lib/stampArt";
import { showToast } from "@/components/Toast";
import TypographicStamp from "@/components/passport/TypographicStamp";
import AirportStamp from "@/components/passport/AirportStamp";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const STAMP = "#B0472F", IVORY = "#FFFCF7";
const KEY = "pp_nearby_dismissed";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;
const readSet = () => { try { return new Set(JSON.parse(sessionStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const remember = (keys) => { try { const s = readSet(); keys.forEach((k) => s.add(k)); sessionStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* ignore */ } };
const getFix = () => new Promise((res) => {
  if (typeof navigator === "undefined" || !navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
});
const ccOf = (a) => a?.countryCode || a?.cc || countryCode(a?.country) || (/^[A-Za-z]{2}$/.test(a?.country || "") ? a.country.toUpperCase() : undefined);
const regionName = (cc) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; } };

function PlaceArt({ name, city, country, id, width }) {
  const [fail, setFail] = useState(false);
  const art = stampArtUrl(name);
  if (art && !fail) return <img src={art} alt="" onError={() => setFail(true)} style={{ width, height: width, objectFit: "contain" }} />;
  return <TypographicStamp name={name} city={city} country={country} entityId={id || name} width={width} />;
}

export default function NearbyStampPrompt({ stamps, onStamped }) {
  const [fix, setFix] = useState(null);
  const [cands, setCands] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pos = await getFix();
      if (!pos || cancelled) return;
      const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy;
      setFix({ lat, lng });
      const [near, ap] = await Promise.all([
        callWorker("attractions/nearby", { latitude: lat, longitude: lng, radiusKm: 2, limit: 12, includeSecrets: true, stampsOnly: true }).catch(() => ({ data: null })),
        airportAt(lat, lng, acc),
      ]);
      if (cancelled) return;
      const have = new Set((stamps || []).map((s) => String(s.entity_id || "").toLowerCase()).filter(Boolean));
      const dismissed = readSet();
      const list = [];
      if (ap && ap.iata && !have.has(String(ap.iata).toLowerCase()) && !dismissed.has(`airport:${ap.iata}`)) {
        list.push({ key: `airport:${ap.iata}`, kind: "airport", ap, name: `${ap.city || ap.name} (${ap.iata})`, meters: null });
      }
      for (const a of (Array.isArray(near?.data?.attractions) ? near.data.attractions : [])) {
        const meters = Number.isFinite(a.distanceKm) ? a.distanceKm * 1000 : Infinity;
        const radius = a.footprint_radius_m || stampRadiusFor({ name: a.name, category: a.category }) || 250;
        if (meters > radius) continue;
        const variant = resolveStampVariant({ name: a.name, lat, lng, country: a.country, verified: "gps" });
        const entityId = String(variant ? variant.entity_id : a.id || "").toLowerCase();
        if (!entityId || have.has(entityId) || have.has(String(a.id || "").toLowerCase()) || dismissed.has(`place:${a.id}`)) continue;
        list.push({ key: `place:${a.id}`, kind: "place", a, variant, name: variant ? variant.name : a.name, meters });
      }
      list.sort((x, y) => (x.kind === "airport" ? 0 : 1) - (y.kind === "airport" ? 0 : 1) || (x.meters ?? 0) - (y.meters ?? 0));
      setCands(list.slice(0, 5));
    })();
    return () => { cancelled = true; };
    // Once per Passport open — the parent mounts this after the stamps load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissAll = () => { remember(cands.map((c) => c.key)); setCands([]); };
  const stampOne = async (c) => {
    if (busy) return;
    setBusy(c.key);
    let res;
    if (c.kind === "airport") {
      const ap = c.ap;
      res = await addStamp({
        kind: "airport", tier: "page", entity_type: "airport", entity_id: ap.iata,
        name: `${ap.city || ap.name} (${ap.iata})`, city: ap.city || ap.name, country: ap.cc, cc: ap.cc,
        lat: ap.lat, lng: ap.lng, visited_on: localISODate(), verified: "gps", local_hour: new Date().getHours(),
      });
    } else {
      const a = c.a, v = c.variant;
      res = await addStamp({
        kind: "attraction", entity_type: v ? "landmark" : "place", entity_id: v ? v.entity_id : a.id,
        name: v ? v.name : a.name, city: a.city || null, region: a.region || a.state || null, country: a.country || null, cc: ccOf(a),
        lat: Number.isFinite(+a.lat) ? +a.lat : null, lng: Number.isFinite(+a.lng) ? +a.lng : null,
        visited_on: localISODate(), local_hour: new Date().getHours(), verified: "gps",
      });
    }
    setBusy(null);
    if (res.error || !res.data?.id) { showToast(/sign in/i.test(res.error || "") ? "Sign in to stamp your Virtual Passport" : (res.error || "Could not add stamp"), "error"); return; }
    remember([c.key]);
    setCands((l) => l.filter((x) => x.key !== c.key));
    showToast(res.data.verified === "gps" ? `✓ Verified — ${c.name} added to your Virtual Passport 🛂` : `${c.name} added to your Virtual Passport 🛂`, "success");
    onStamped?.(res.data.id);
  };

  if (!cands.length || !fix) return null;
  const one = cands.length === 1 ? cands[0] : null;
  const distance = (m) => (m == null ? null : m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`);

  return (
    <div onClick={dismissAll} className="fixed inset-0 z-[9997] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Stamp where you are"
      style={{ background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[22px] px-4 pt-3 overflow-y-auto"
        style={{ background: IVORY, maxHeight: "86vh", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: RULE }} aria-hidden="true" />
        <p style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".14em", color: STAMP, textTransform: "uppercase" }}>You are here</p>
        <p style={{ fontFamily: SERIF, fontSize: fs(23), color: INK, lineHeight: 1.15, marginTop: 4 }}>
          {one ? (one.kind === "airport" ? `Welcome to ${one.ap.city || one.ap.name}` : `Stamp ${one.name}?`) : "Stampable places around you"}
        </p>
        <p style={{ color: INK2, fontSize: fs(13), lineHeight: 1.45, marginTop: 4 }}>
          {one ? "Add it to your Virtual Passport — GPS-verified, since you're standing right here." : "Pick the one you're visiting, or close this."}
        </p>

        {one ? (
          <div className="flex flex-col items-center mt-3">
            {one.kind === "airport"
              ? <AirportStamp iata={one.ap.iata} city={one.ap.city || one.ap.name} countryCode={one.ap.cc} date={localISODate()} width={240} />
              : <PlaceArt name={one.name} city={one.a.city} country={one.a.country} id={one.a.id} width={150} />}
            {one.kind === "airport" && one.ap.cc && <p style={{ fontFamily: MONO, fontSize: fs(11), color: INK3, marginTop: 6 }}>{regionName(one.ap.cc)}</p>}
            {one.kind === "place" && one.meters != null && <p style={{ fontFamily: MONO, fontSize: fs(11), color: INK3, marginTop: 6 }}>{distance(one.meters)}</p>}
            <div className="flex gap-2 mt-4 w-full">
              <button type="button" onClick={dismissAll} disabled={!!busy} className="flex-1 rounded-xl py-3 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14), fontFamily: "inherit" }}>Not now</button>
              <button type="button" onClick={() => stampOne(one)} disabled={!!busy} className="flex-1 rounded-xl py-3 font-bold" style={{ background: STAMP, color: "#fff", border: "none", fontSize: fs(14), fontFamily: "inherit" }}>{busy ? "Stamping…" : "Stamp it ✓"}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-3">
            {cands.map((c) => (
              <div key={c.key} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
                <div className="flex-none flex items-center justify-center" style={{ width: 64, height: 64 }}>
                  {c.kind === "airport"
                    ? <span style={{ fontSize: 30 }} aria-hidden="true">✈️</span>
                    : <PlaceArt name={c.name} city={c.a.city} country={c.a.country} id={c.a.id} width={60} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontFamily: SERIF, fontSize: fs(17), color: INK, lineHeight: 1.15 }}>{c.name}</p>
                  <p style={{ fontFamily: MONO, fontSize: fs(10.5), color: INK3, marginTop: 2 }}>{c.kind === "airport" ? "Airport · you're inside" : (distance(c.meters) || "Right here")}</p>
                </div>
                <button type="button" onClick={() => stampOne(c)} disabled={!!busy} className="flex-none rounded-lg px-3 py-2 font-bold" style={{ background: STAMP, color: "#fff", border: "none", fontSize: fs(12.5), fontFamily: "inherit" }}>{busy === c.key ? "…" : "Stamp"}</button>
              </div>
            ))}
            <button type="button" onClick={dismissAll} disabled={!!busy} className="w-full rounded-xl py-2.5 font-semibold mt-1" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13.5), fontFamily: "inherit" }}>Close</button>
          </div>
        )}
        <p className="text-center" style={{ color: INK3, fontSize: fs(10.5), lineHeight: 1.4, marginTop: 10 }}>Nothing is stamped until you tap. Just passing through? Close this.</p>
      </div>
    </div>
  );
}
