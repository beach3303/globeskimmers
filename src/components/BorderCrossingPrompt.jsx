import React, { useEffect, useRef, useState } from "react";
import { useLocation, isLiveFix } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { addStamp, metersBetween } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { airportAt, markAirportVisit, lastAirportVisit } from "@/lib/airports";
import { countryCode } from "@/lib/countries";
import { regionInfo } from "@/lib/stateNicknames";
import { callWorker } from "@/lib/callWorker";
import { getStampFix } from "@/lib/geolocation";
import { localISODate } from "@/lib/localDate";
import LandStamp from "@/components/passport/LandStamp";

// ============================================================================
// 🛂 Border-crossing stamps on the ground (founder, 2026-10-05). When a
// signed-in user's GPS says they are IN a new place — never before the line,
// only after — we ask which way they crossed:
//   · a new COUNTRY (San Diego → Tijuana by car, Paris → Brussels by train, a
//     cruise stop): the checkpoint stamp, Entry / Exit, by car, train or ship;
//   · a new US STATE or UK NATION (California → Nevada, England → Scotland):
//     the welcome-sign stamp with the state's claim ("The Silver State").
// Consent-gated (never auto), foreground only, no background tracking. Inside
// an airport fence the moment belongs to AirportArrivalPrompt instead.
// ============================================================================
// LIVE GPS ONLY (founder, 2026-10-11: switching from a picked city, NYC, back
// to "where I am" in Azusa asked to stamp a crossing into California). The
// prompt used to read whichever place the app was SHOWING. Now a crossing is
// two LIVE fixes the phone took itself (isLiveFix: this app run, ≤ 30 min —
// never a picked destination or a restored last location):
//   · the previous live fix (BASE, with its time) was in another state or
//     country, recently (≤ 8 h: the app sensed the trip), at ground speed
//     (≤ 300 km/h over less than an hour of readings, else ≤ 130 for a state
//     line and ≤ 250 for a country, so trains count);
//   · not a flight: the fix isn't inside an airport fence, and no live
//     reading was inside one since the previous fix;
//   · confirmed: both ends looked up again at street-block resolution (the
//     everyday lookup shares one answer per ~11 km tile, which can name the
//     wrong state near a line), "now" from the best of 2–3 fresh readings.
// A crossing that can't be confirmed is a missed prompt, never a wrong one.
const BASE = "pp_live_region_v2";   // { cc, region, lat, lng, at } of the last live fix
const RECENT_MS = 8 * 3600 * 1000;
const suggestOn = () => { try { return localStorage.getItem("pp_city_prompt") !== "0"; } catch { return true; } };
const readBase = () => { try { return JSON.parse(localStorage.getItem(BASE) || "null"); } catch { return null; } };
const writeBase = (v) => { try { localStorage.setItem(BASE, JSON.stringify(v)); } catch { /* ignore */ } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
// A border stamp keeps about a city block, never the exact spot (founder, 2026-10-10).
const rough = (v) => Math.round(v * 1000) / 1000;
let judging = false;   // one crossing judged at a time, app-wide

// The decision on its own: prev = the last live fix's place, fix = this one,
// both { cc, region, lat, lng, at }. null = no prompt; else 'country' | 'region'.
function crossingKind(prev, fix) {
  if (!prev?.cc || !Number.isFinite(prev.at) || !Number.isFinite(prev.lat) || !Number.isFinite(prev.lng)) return null;   // first live fix: the baseline
  const sameCountry = prev.cc === fix.cc;
  if (sameCountry && (!fix.region || !prev.region || fix.region === prev.region)) return null;
  const hours = (fix.at - prev.at) / 3.6e6;
  if (!(hours > 0) || fix.at - prev.at > RECENT_MS) return null;   // not a trip the app sensed
  const km = metersBetween(prev.lat, prev.lng, fix.lat, fix.lng) / 1000;
  // Over a short span an interstate, a fast train or the readings' own noise
  // can top 130 km/h; over hours a car averages far less, a plane far more.
  const cap = hours < 1 ? 300 : sameCountry ? 130 : 250;
  if (km / hours > cap) return null;   // a flight, not a road or rail crossing
  return sameCountry ? "region" : "country";
}
// The country and state/nation at a point, from the precise (~110 m) lookup.
async function placeAt(lat, lng) {
  const { data, error } = await callWorker("reverse-geocode", { latitude: lat, longitude: lng, precise: true });
  if (error || !data || data.error || !data.country) return null;
  const cc = (countryCode(data.country) || "").toUpperCase();
  if (!cc) return null;
  const region = data.country === "United Kingdom" ? String(data.region || "")
    : data.state_or_country && data.state_or_country !== data.country ? String(data.state_or_country) : "";
  return { cc, region: region.trim() };
}
const regionName = (cc) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; } };
const flagFor = (cc) => (/^[a-z]{2}$/i.test(cc || "")
  ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
  : "🌍");

export default function BorderCrossingPrompt() {
  const { currentGpsLocation } = useLocation();
  const { isAuthenticated } = useAuth();
  // { type:'country', cc, country, lat, lng } | { type:'region', cc, country, region, info, lat, lng }
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    (async () => {
      if (!isAuthenticated || !suggestOn() || pending || judging) return;
      const g = currentGpsLocation;
      if (!isLiveFix(g)) return;   // never a picked place, never an old fix
      const at = g.fixedAt;
      const c = g.coordinates;
      const cc = (countryCode(g.address?.country) || "").toUpperCase();
      if (!cc || !c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
      const region = String(g.address?.state || "").trim();
      const prev = readBase();
      if (prev && Number(prev.at) >= at) return;   // already judged
      // A state the lookup didn't resolve keeps the last known one, so a gap
      // never reads as a crossing back into it.
      const keep = (f) => writeBase({ ...f, region: f.region || (prev?.cc === f.cc ? prev.region || "" : "") });
      const fix = { cc, region, lat: c.latitude, lng: c.longitude, at };
      if (!crossingKind(prev, fix)) { keep(fix); return; }
      judging = true;
      try {
        // Inside an airport fence: the airport prompt owns this moment.
        const ap = await airportAt(fix.lat, fix.lng, c.accuracy).catch(() => null);
        if (ap) { markAirportVisit(); keep(fix); return; }
        // Through an airport since the last live fix: a flight, not a drive.
        if (lastAirportVisit() > prev.at) { keep(fix); return; }
        const now = await getStampFix().catch(() => null);
        const pt = now ? { lat: now.lat, lng: now.lng, at: Date.now() } : { lat: fix.lat, lng: fix.lng, at };
        const [was, is] = await Promise.all([placeAt(prev.lat, prev.lng), placeAt(pt.lat, pt.lng)]);
        if (!was || !is) { keep(fix); return; }   // can't confirm: missed, never wrong
        keep({ cc: is.cc, region: is.region, ...pt });
        const kind = is.cc !== was.cc ? "country" : is.region && was.region && is.region !== was.region ? "region" : null;
        if (!kind || !alive.current) return;
        if (kind === "country") { setPending({ type: "country", cc: is.cc, country: regionName(is.cc), lat: rough(pt.lat), lng: rough(pt.lng) }); return; }
        // Same country — a new state / nation inside it (US + UK only).
        const info = regionInfo(is.cc, is.region);
        if (info) setPending({ type: "region", cc: is.cc, country: regionName(is.cc), region: is.region, info, lat: rough(pt.lat), lng: rough(pt.lng) });
      } finally { judging = false; }
    })();
  }, [currentGpsLocation, isAuthenticated, pending]);

  // The live fix is already the baseline, so closing never re-asks for it.
  const settle = () => { if (pending) setPending(null); };
  const turnOff = () => { writeLS("pp_city_prompt", "0"); settle(); };

  const add = async (direction) => {
    if (!pending || busy) return;
    setBusy(direction);
    const today = localISODate();
    const isRegion = pending.type === "region";
    const { data, error } = await addStamp(isRegion ? {
      kind: "state", tier: "page", entity_type: "border", entity_id: pending.info.abbr,
      name: pending.region, region: pending.region, country: pending.country, cc: pending.cc,
      lat: pending.lat, lng: pending.lng, visited_on: today, verified: "gps",
      local_hour: new Date().getHours(), direction,
    } : {
      kind: "country", tier: "page", entity_type: "border", entity_id: pending.cc,
      name: `${pending.country} · Border Crossing`, city: null, country: pending.country, cc: pending.cc,
      lat: pending.lat, lng: pending.lng, visited_on: today, verified: "gps",
      local_hour: new Date().getHours(), direction,
    });
    setBusy(false);
    const what = isRegion ? pending.region : pending.country;
    const flag = isRegion ? "🛣️" : flagFor(pending.cc);
    settle();
    if (error) { showToast(error, "error"); return; }
    showToast(`${flag} ${what} ${direction === "departure" ? "exit" : "entry"} stamped 🛂${data?.verified === "gps" ? " ✓" : ""}`, "success");
  };

  if (!pending) return null;
  const today = localISODate();
  const isRegion = pending.type === "region";
  const stampFor = (direction) => (isRegion
    ? <LandStamp template="state" name={pending.region} sub={pending.info.nickname} date={today} direction={direction} width={134} />
    : <LandStamp template="country" name={pending.country} countryCode={pending.cc} date={today} direction={direction} width={134} />);
  const choice = (direction, label, sub) => (
    <button onClick={() => add(direction)} disabled={!!busy}
      style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: "10px 6px 9px", background: "#fff", border: "1.5px solid rgba(22,17,13,.16)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: busy && busy !== direction ? 0.55 : 1 }}>
      {stampFor(direction)}
      <span style={{ fontWeight: 700, fontSize: 15, color: "#16110D" }}>{busy === direction ? "Stamping…" : label}</span>
      <span style={{ fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 10, color: "#736657" }}>{sub}</span>
    </button>
  );
  return (
    <div onClick={settle} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#f3eee1", borderRadius: 22, maxWidth: 380, width: "100%", padding: 20, textAlign: "center", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }}>
        <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 23, color: "#16110D", margin: "0 0 2px" }}>
          {isRegion ? `You crossed into ${pending.region}!` : `Welcome to ${pending.country}! ${flagFor(pending.cc)}`}
        </p>
        <p style={{ color: "#3A3128", fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
          {isRegion && pending.info.nickname ? `${pending.info.nickname} · ` : ""}Stamp the crossing? Entry or exit goes on the stamp.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {choice("arrival", "Entry", isRegion ? "Just crossed in" : "Entering the country")}
          {choice("departure", "Exit", isRegion ? "Heading out" : "Leaving the country")}
        </div>
        <button onClick={settle} disabled={!!busy} style={{ width: "100%", marginTop: 10, borderRadius: 12, padding: "10px", fontWeight: 600, background: "none", color: "#3A3128", border: "none", fontSize: 14 }}>Not now</button>
        <p style={{ color: "#736657", fontSize: 10.5, lineHeight: 1.4, marginTop: 2 }}>Nothing is stamped until you tap — and only after you&rsquo;ve crossed.</p>
        <button onClick={turnOff} disabled={!!busy} style={{ marginTop: 6, color: "#736657", fontSize: 11.5, textDecoration: "underline", background: "none", border: "none" }}>Turn off crossing pop-ups</button>
      </div>
    </div>
  );
}
