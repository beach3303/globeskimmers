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
import { addStamp, reportStamp, STAMP_REFUSALS } from "@/lib/passport";
import { getStampFix } from "@/lib/geolocation";
import { useLocation } from "@/components/location/LocationContext";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import { airportAt, markAirportVisit } from "@/lib/airports";
import { stampRadiusFor } from "@/lib/stampRadius";
import { resolveStampVariant } from "@/lib/stampVariants";
import { countryCode } from "@/lib/countries";
import { localISODate } from "@/lib/localDate";
import { stampArtUrl } from "@/lib/stampArt";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";
import { showToast } from "@/components/Toast";
import TypographicStamp from "@/components/passport/TypographicStamp";
import AirportStamp from "@/components/passport/AirportStamp";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const STAMP = "#B0472F", IVORY = "#FFFCF7";
const KEY = "pp_nearby_dismissed";
// The switch lives in Settings → Virtual Passport and on the Passport page
// itself (default ON). Off → this component never takes a GPS fix.
export const NEARBY_KEY = "pp_suggest_nearby";
export const nearbySensingOn = () => { try { return localStorage.getItem(NEARBY_KEY) !== "0"; } catch { return true; } };
const fs = (px) => `calc(${px}px * var(--fs, 1))`;
const readSet = () => { try { return new Set(JSON.parse(sessionStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const remember = (keys) => { try { const s = readSet(); keys.forEach((k) => s.add(k)); sessionStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* ignore */ } };
const getFix = () => new Promise((res) => {
  if (typeof navigator === "undefined" || !navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
});
const ccOf = (a) => a?.countryCode || a?.cc || countryCode(a?.country) || (/^[A-Za-z]{2}$/.test(a?.country || "") ? a.country.toUpperCase() : undefined);
const regionName = (cc) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; } };

function PlaceArt({ name, city, country, id, width, film }) {
  const [fail, setFail] = useState(false);
  const art = film ? null : stampArtUrl(name, { entityId: id, country });   // a film spot shows its Scene stamp
  if (art && !fail) return <img src={art} alt="" onError={() => setFail(true)} style={{ width, height: width, objectFit: "contain" }} />;
  return <TypographicStamp name={name} city={city} country={country} entityId={id || name} width={width} strength={STAMP_INK_STRENGTH} film={film || null} />;
}
const filmLabel = (f) => (f && f.title ? `Filmed here: ${f.title}${f.year ? ` (${f.year})` : ""}` : null);

// A refused stamp (founder, 2026-10-10): what GPS said, and the way through —
// "I'm here, but the app is saying I'm not" always grants it and tells us.
function RefusedNote({ r, name, busy, onReport, fmt }) {
  const away = (m) => (fmt ? fmt(m) : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
  const text = r.why === "denied" ? "Location is off for GlobeSkimmers — turn it on in Settings, then try again."
    : r.why === "no_fix" ? "We couldn’t get a GPS reading just now — step outside or give it a moment, then try again."
    : r.why === "unlocatable" ? "We can’t place this attraction on our map yet."
    : r.why === "unconfirmed" ? "We couldn’t confirm your GPS reading — a VPN, or a long trip today, can cause this."
    : Number.isFinite(r.meters) ? `Your GPS puts you about ${away(r.meters)} from ${name} on our map.`
    : "Your GPS doesn’t show you at this place yet.";
  return (
    <div className="w-full rounded-[12px] px-3 py-2.5 mt-2" style={{ background: "#FFF8EC", border: "1px solid #FCD9A8" }}>
      <p style={{ fontSize: fs(12.5), color: "#7A4A0C", lineHeight: 1.4 }}>{text}</p>
      <button type="button" onClick={onReport} disabled={busy} className="w-full rounded-[10px] py-2 mt-2 font-bold disabled:opacity-60"
        style={{ background: "#fff", color: STAMP, border: `1.5px solid ${STAMP}`, fontSize: fs(13), fontFamily: "inherit" }}>
        {busy ? "Sending…" : "I’m here, but the app is saying I’m not"}
      </button>
      <p className="text-center" style={{ fontSize: fs(11), color: "#7A4A0C", marginTop: 4 }}>You&rsquo;ll get the stamp, and we&rsquo;ll check our map for this place.</p>
    </div>
  );
}

export default function NearbyStampPrompt({ stamps, onStamped }) {
  const [fix, setFix] = useState(null);
  const [cands, setCands] = useState([]);
  const [busy, setBusy] = useState(null);
  const [refused, setRefused] = useState(null); // { key, why, meters, payload } — the request a report resends
  const { activeLocation } = useLocation();
  const units = useDistanceUnit(activeLocation);
  const fmtMeters = (m) => units.formatDistance(m / 1609.34);   // the traveler's mi/km

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!nearbySensingOn()) return;
      const pos = await getFix();
      if (!pos || cancelled) return;
      const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy;
      setFix({ lat, lng, acc });
      const [near, ap] = await Promise.all([
        callWorker("attractions/nearby", { latitude: lat, longitude: lng, radiusKm: 2, limit: 12, includeSecrets: true, stampsOnly: true }).catch(() => ({ data: null })),
        airportAt(lat, lng, acc),
      ]);
      if (ap) markAirportVisit();   // a flight, for the border-crossing prompt
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
  // A report never says ✓: the worker answers with the stamp's strongest
  // proof ever, which can be an older GPS visit, not what this tap proved.
  const done = (c, data, reportedName) => {
    remember([c.key]);
    setRefused((r) => (r?.key === c.key ? null : r));
    setCands((l) => l.filter((x) => x.key !== c.key));
    showToast(reportedName
      ? (data.updated ? `${reportedName} is already in your Virtual Passport — thanks for telling us` : `${reportedName} added to your Virtual Passport 🛂 — thanks for telling us`)
      : data.verified === "gps" ? `✓ Verified — ${c.name} added to your Virtual Passport 🛂` : `${c.name} added to your Virtual Passport 🛂`, "success");
    onStamped?.(data.id);
  };
  const stampOne = async (c) => {
    if (busy) return;
    setBusy(c.key);
    setRefused(null);
    let res, payload = null;
    if (c.kind === "airport") {
      const ap = c.ap;
      res = await addStamp({
        kind: "airport", tier: "page", entity_type: "airport", entity_id: ap.iata,
        name: `${ap.city || ap.name} (${ap.iata})`, city: ap.city || ap.name, country: ap.cc, cc: ap.cc,
        lat: ap.lat, lng: ap.lng, visited_on: localISODate(), verified: "gps", local_hour: new Date().getHours(),
      });
    } else {
      // A fresh best-of-readings fix at the tap — never the one taken when the
      // Passport opened, which may be minutes old. The worker decides (never stored).
      let f = null, noFix = null;
      try { f = await getStampFix(); } catch (e) { noFix = e?.code === 1 ? "denied" : "no_fix"; }
      const a = c.a;
      const build = (v) => ({
        kind: "attraction", entity_type: v ? "landmark" : "place", entity_id: v ? v.entity_id : a.id,
        name: v ? v.name : a.name, city: a.city || null, region: a.region || a.state || null, country: a.country || null, cc: ccOf(a),
        lat: Number.isFinite(+a.lat) ? +a.lat : null, lng: Number.isFinite(+a.lng) ? +a.lng : null,
        visited_on: localISODate(), local_hour: new Date().getHours(), verified: "gps",
        category: a.category || undefined,
        ...(v && a.id ? { parent_id: a.id } : {}),
        ...(f ? { fix: { lat: f.lat, lng: f.lng, ...(Number.isFinite(f.acc) ? { acc: f.acc } : {}) } } : {}),
        ...(a.film ? { film: a.film } : {}),
      });
      payload = build(c.variant);
      // No reading: a refusal like any other, so the report button (with no spot).
      if (!f) { setBusy(null); setRefused({ key: c.key, why: noFix, meters: null, payload }); return; }
      res = await addStamp(payload);
      // A report sends exactly the stamp this prompt shows: its park within a
      // resort came from the reading taken when the Passport opened, which was
      // inside the place (a candidate is listed only then).
      payload = { refused: payload, report: payload };
    }
    setBusy(null);
    if (payload && STAMP_REFUSALS.includes(res.data?.code)) {
      // proof_needed WITH a fix: the worker measured you inside but didn't
      // trust the reading (a VPN, or impossible travel since your last stamp).
      setRefused({ key: c.key, why: res.data.code === "proof_needed" && payload.refused.fix ? "unconfirmed" : res.data.code, meters: Number.isFinite(res.data.distance_m) ? res.data.distance_m : null, payload: payload.report });
      return;
    }
    if (res.error || !res.data?.id) { showToast(/sign in/i.test(res.error || "") ? "Sign in to stamp your Virtual Passport" : (res.error || "Could not add stamp"), "error"); return; }
    // A place stamp you already hold, measured inside but with a reading the
    // worker didn't trust (a VPN, impossible travel), comes back without GPS:
    // a refusal like any other, so the report button.
    if (payload && res.data.verified !== "gps") { setRefused({ key: c.key, why: "unconfirmed", meters: null, payload: payload.report }); return; }
    done(c, res.data);
  };
  // "I'm here, but the app is saying I'm not" — resends the refused request.
  const reportOne = async (c) => {
    if (busy || refused?.key !== c.key) return;
    setBusy(`report:${c.key}`);
    const res = await reportStamp(refused.payload);
    setBusy(null);
    if (res.error || !res.data?.id) { showToast(/sign in/i.test(res.error || "") ? "Sign in to stamp your Virtual Passport" : (res.error || "Couldn’t send that — try again"), "error"); return; }
    done(c, res.data, refused.payload.name || c.name);
  };

  if (!cands.length || !fix) return null;
  const one = cands.length === 1 ? cands[0] : null;
  const distance = (m) => (m == null ? null : `${fmtMeters(m)} away`);   // the traveler's mi/km

  return (
    <div onClick={() => { if (!busy) dismissAll(); }} className="fixed inset-0 z-[9997] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Stamp where you are"
      style={{ background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[22px] px-4 pt-3 overflow-y-auto"
        style={{ background: IVORY, maxHeight: "86vh", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: RULE }} aria-hidden="true" />
        <p style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".14em", color: STAMP, textTransform: "uppercase" }}>You are here</p>
        <p style={{ fontFamily: SERIF, fontSize: fs(23), color: INK, lineHeight: 1.15, marginTop: 4 }}>
          {one ? (one.kind === "airport" ? `Welcome to ${one.ap.city || one.ap.name}` : `Stamp ${one.name}?`) : "Stampable places around you"}
        </p>
        <p style={{ color: INK2, fontSize: fs(13), lineHeight: 1.45, marginTop: 4 }}>
          {one && refused?.key === one.key ? "Our map doesn’t place you here yet — tell us below and keep the stamp."
            : one ? "Add it to your Virtual Passport — GPS-verified, since you're standing right here." : "Pick the one you're visiting, or close this."}
        </p>

        {one ? (
          <div className="flex flex-col items-center mt-3">
            {one.kind === "airport"
              ? <AirportStamp iata={one.ap.iata} city={one.ap.city || one.ap.name} countryCode={one.ap.cc} date={localISODate()} width={240} />
              : <PlaceArt name={one.name} city={one.a.city} country={one.a.country} id={one.a.id} width={150} film={one.a.film} />}
            {one.kind === "place" && filmLabel(one.a.film) && <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), color: INK, marginTop: 8, textAlign: "center" }}>{filmLabel(one.a.film)}</p>}
            {one.kind === "place" && one.a.film?.scene && <p style={{ color: INK2, fontSize: fs(12.5), lineHeight: 1.4, marginTop: 4, textAlign: "center", maxWidth: 320 }}>{one.a.film.scene}</p>}
            {one.kind === "airport" && one.ap.cc && <p style={{ fontFamily: MONO, fontSize: fs(11), color: INK3, marginTop: 6 }}>{regionName(one.ap.cc)}</p>}
            {one.kind === "place" && one.meters != null && <p style={{ fontFamily: MONO, fontSize: fs(11), color: INK3, marginTop: 6 }}>{distance(one.meters)}</p>}
            <div className="flex gap-2 mt-4 w-full">
              <button type="button" onClick={dismissAll} disabled={!!busy} className="flex-1 rounded-xl py-3 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14), fontFamily: "inherit" }}>Not now</button>
              <button type="button" onClick={() => stampOne(one)} disabled={!!busy} className="flex-1 rounded-xl py-3 font-bold" style={{ background: STAMP, color: "#fff", border: "none", fontSize: fs(14), fontFamily: "inherit" }}>{busy === one.key ? "Stamping…" : refused?.key === one.key ? "Try GPS again" : "Stamp it ✓"}</button>
            </div>
            {refused?.key === one.key && <RefusedNote r={refused} name={one.name} busy={busy === `report:${one.key}`} onReport={() => reportOne(one)} fmt={fmtMeters} />}
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-3">
            {cands.map((c) => (
              <React.Fragment key={c.key}>
              <div className="flex items-center gap-3 rounded-[14px] px-3 py-2.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
                <div className="flex-none flex items-center justify-center" style={{ width: 64, height: 64 }}>
                  {c.kind === "airport"
                    ? <span style={{ fontSize: 30 }} aria-hidden="true">✈️</span>
                    : <PlaceArt name={c.name} city={c.a.city} country={c.a.country} id={c.a.id} width={60} film={c.a.film} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontFamily: SERIF, fontSize: fs(17), color: INK, lineHeight: 1.15 }}>{c.name}</p>
                  {c.kind === "place" && filmLabel(c.a.film) && <p className="truncate" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(12.5), color: INK2, marginTop: 1 }}>{filmLabel(c.a.film)}</p>}
                  <p style={{ fontFamily: MONO, fontSize: fs(10.5), color: INK3, marginTop: 2 }}>{c.kind === "airport" ? "Airport · you're inside" : (distance(c.meters) || "Right here")}</p>
                </div>
                <button type="button" onClick={() => stampOne(c)} disabled={!!busy} className="flex-none rounded-lg px-3 py-2 font-bold" style={{ background: STAMP, color: "#fff", border: "none", fontSize: fs(12.5), fontFamily: "inherit" }}>{busy === c.key ? "…" : "Stamp"}</button>
              </div>
              {refused?.key === c.key && <RefusedNote r={refused} name={c.name} busy={busy === `report:${c.key}`} onReport={() => reportOne(c)} fmt={fmtMeters} />}
              </React.Fragment>
            ))}
            <button type="button" onClick={dismissAll} disabled={!!busy} className="w-full rounded-xl py-2.5 font-semibold mt-1" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13.5), fontFamily: "inherit" }}>Close</button>
          </div>
        )}
        <p className="text-center" style={{ color: INK3, fontSize: fs(10.5), lineHeight: 1.4, marginTop: 10 }}>Nothing is stamped until you tap. Just passing through? Close this.</p>
      </div>
    </div>
  );
}
