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
import { baseline, setBaseline, openWindow, closeWindow, deferWindow, isDeferred, hoursLeft, seenLabel, useCrossings, windowById, OPEN_EVENT } from "@/lib/crossings";
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
// BORDER GRACE (founder, 2026-11-03/05; src/lib/crossings.js). The founder drove
// I-10 into Arizona and never got this prompt: it lived on Home only, needed a
// previous live fix under 8 hours old, and one failed lookup at the river made
// the new state the baseline — the crossing was consumed for good. Now:
//   · a crossing is a WINDOW: a confirmed live fix somewhere new opens a
//     48-hour window — this sheet on every open (any page: mounted in Layout),
//     an ENTRY WAITING card on the passport page, stamped from anywhere inside,
//     dated the day the app first saw you there;
//   · the baseline is any age — if the app last saw you in California
//     yesterday and sees you in Arizona now, that is a crossing;
//   · a lookup that fails leaves the baseline where it was: the next fix tries
//     again. A crossing is never consumed by thin coverage;
//   · the sheet asks "How did you get here?" — Car · Train · Ship · Plane —
//     with the speed's guess pre-picked; Plane is no land stamp (flights are
//     airport to airport). A flight the app itself sensed (an airport fence
//     since the last fix, or faster than the ground allows) opens no window.
// Still LIVE GPS ONLY (founder, 2026-10-11): a fix the phone took in this app
// run, ≤ 30 min — never a picked destination or a restored last location — and
// both ends confirmed at street-block resolution before anything is offered.
const suggestOn = () => { try { return localStorage.getItem("pp_city_prompt") !== "0"; } catch { return true; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
// A border stamp keeps about a city block, never the exact spot (founder, 2026-10-10).
const rough = (v) => Math.round(v * 1000) / 1000;
let judging = false;   // one crossing judged at a time, app-wide

// The country and state/nation at a point, from the precise (~110 m) lookup.
async function placeAt(lat, lng) {
  const { data, error } = await callWorker("reverse-geocode", { latitude: lat, longitude: lng, precise: true });
  if (error || !data || data.error || !data.country) return null;
  const cc = (countryCode(data.country) || "").toUpperCase();
  if (!cc) return null;
  const region = data.country === "United Kingdom" ? String(data.region || "")
    : data.state_or_country && data.state_or_country !== data.country ? String(data.state_or_country) : "";
  return { cc, region: region.trim(), near: data.city ? String(data.city) : null };
}
const regionName = (cc) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; } };
// "the Philippines", "the United States", "the Bahamas": the names English says with "the".
const withThe = (name) => (/^(United |Czech Republic|Dominican Republic|Central African Republic)|Islands$|^(Philippines|Netherlands|Bahamas|Maldives|Gambia|Comoros|Seychelles)$/.test(String(name || "")) ? `the ${name}` : name);
const flagFor = (cc) => (/^[a-z]{2}$/i.test(cc || "")
  ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
  : "🌍");
const MODES = [["car", "Car"], ["train", "Train"], ["ship", "Ship"], ["plane", "Plane"]];
const MONO = '"JetBrains Mono",ui-monospace,monospace';

export default function BorderCrossingPrompt() {
  const { currentGpsLocation } = useLocation();
  const { isAuthenticated } = useAuth();
  const open = useCrossings();
  const [forced, setForced] = useState(null);   // a window the passport card asked to stamp now
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    const on = (e) => setForced(e.detail?.id || null);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  // ── Sensing: every live fix is compared with the baseline ────────────────
  useEffect(() => {
    (async () => {
      if (!isAuthenticated || !suggestOn() || judging) return;
      const g = currentGpsLocation;
      if (!isLiveFix(g)) return;   // never a picked place, never an old fix
      const at = g.fixedAt;
      const c = g.coordinates;
      const cc = (countryCode(g.address?.country) || "").toUpperCase();
      if (!cc || !c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
      const region = String(g.address?.state || "").trim();
      const near = g.address?.city ? String(g.address.city) : null;
      const prev = baseline();
      if (prev && Number(prev.at) >= at) return;   // already judged
      const fix = { cc, region, lat: c.latitude, lng: c.longitude, at, near };
      // A state the lookup didn't resolve keeps the last known one, so a gap never reads as a crossing back into it.
      const keep = (f) => setBaseline({ ...f, region: f.region || (prev?.cc === f.cc ? prev.region || "" : "") });
      if (!prev?.cc || !Number.isFinite(prev.lat) || !Number.isFinite(prev.lng)) { keep(fix); return; }   // the first live fix: the baseline
      const differs = prev.cc !== fix.cc || (!!fix.region && !!prev.region && fix.region !== prev.region);
      if (!differs) { keep(fix); return; }
      judging = true;
      try {
        // Inside an airport fence: the airport prompt owns this moment (and opens its own window).
        const ap = await airportAt(fix.lat, fix.lng, c.accuracy).catch(() => null);
        if (ap) { markAirportVisit(); keep(fix); return; }
        // Through an airport since the last live fix, or faster than the ground allows: a flight, not a
        // drive — flights are airport to airport, so no land window. Over a short span an interstate, a
        // fast train or the readings' own noise can top 160 km/h; over hours a car averages far less, a
        // plane far more.
        if (lastAirportVisit() > Number(prev.at || 0)) { keep(fix); return; }
        const hours = (fix.at - Number(prev.at || 0)) / 3.6e6;
        const km = metersBetween(prev.lat, prev.lng, fix.lat, fix.lng) / 1000;
        const cap = hours < 1 ? 300 : prev.cc === fix.cc ? 160 : 250;
        if (hours > 0 && km / hours > cap) { keep(fix); return; }
        const now = await getStampFix().catch(() => null);
        const pt = now ? { lat: now.lat, lng: now.lng, at: Date.now() } : { lat: fix.lat, lng: fix.lng, at };
        const [was, is] = await Promise.all([placeAt(prev.lat, prev.lng), placeAt(pt.lat, pt.lng)]);
        if (!was || !is) return;   // can't confirm now: the baseline stays, the next fix tries again
        const kind = is.cc !== was.cc ? "country" : is.region && was.region && is.region !== was.region ? "region" : null;
        const here = is.near || near;
        setBaseline({ cc: is.cc, region: is.region, lat: pt.lat, lng: pt.lng, at: pt.at, near: here });
        if (!kind || !alive.current) return;
        // Both sides seen within the hour and a short hop: the crossing itself, not just "inside".
        const caught = hours < 1 && km < 80;
        const spot = { at: pt.at, lat: rough(pt.lat), lng: rough(pt.lng), near: here };
        const base = { firstSeen: spot, crossing: caught ? spot : null, modeGuess: "car", cc: is.cc, country: regionName(is.cc) };
        if (kind === "country") { openWindow({ ...base, kind: "country", key: `country:${is.cc}`, name: regionName(is.cc) }); return; }
        // Same country — a new state / nation inside it (US + UK only).
        const info = regionInfo(is.cc, is.region);
        if (info) openWindow({ ...base, kind: "region", key: `region:${is.cc}-${info.abbr}`, name: is.region, region: is.region, info });
      } finally { judging = false; }
    })();
  }, [currentGpsLocation, isAuthenticated]);

  // ── The sheet: the window asked for, else the oldest open land window not deferred this run ──
  const askedFor = forced ? windowById(forced) : null;
  // An airport window that is still up has the screen (one sheet at a time); this one waits its turn.
  const airportUp = !askedFor && open.some((x) => x.kind === "airport" && !isDeferred(x.id));
  const w = airportUp ? null : (askedFor && askedFor.status === "open" && askedFor.kind !== "airport" ? askedFor : null)
    || open.find((x) => (x.kind === "region" || x.kind === "country") && !isDeferred(x.id)) || null;
  const wid = w?.id || null;
  // A new window resets the mode to its guess (keyed on the id, not the object: the store re-reads).
  useEffect(() => { setMode(windowById(wid)?.modeGuess || "car"); setBusy(false); }, [wid]);

  if (!w) return null;
  const isRegion = w.kind === "region";
  const spot = w.crossing || w.firstSeen;
  const date = localISODate(new Date(spot.at));
  const picked = mode || w.modeGuess || "car";
  const settle = () => { deferWindow(w.id); setForced(null); };
  const decline = () => { closeWindow(w.id, "declined"); setForced(null); };
  const turnOff = () => { writeLS("pp_city_prompt", "0"); decline(); };

  const add = async (direction) => {
    if (busy) return;
    if (picked === "plane") {
      closeWindow(w.id, "plane"); setForced(null);
      showToast("Flights are airport to airport — the airport gives its own stamp", "info");
      return;
    }
    setBusy(direction);
    const { data, error } = await addStamp(isRegion ? {
      kind: "state", tier: "page", entity_type: "border", entity_id: w.info.abbr,
      name: w.region, region: w.region, country: w.country, cc: w.cc,
      lat: spot.lat, lng: spot.lng, visited_on: date, verified: "gps",
      local_hour: new Date(spot.at).getHours(), direction, mode: picked, ink: w.ink,
    } : {
      kind: "country", tier: "page", entity_type: "border", entity_id: w.cc,
      name: `${w.country} · Border Crossing`, city: null, country: w.country, cc: w.cc,
      lat: spot.lat, lng: spot.lng, visited_on: date, verified: "gps",
      local_hour: new Date(spot.at).getHours(), direction, mode: picked, ink: w.ink,
    });
    setBusy(false);
    if (error) { showToast(error, "error"); return; }
    closeWindow(w.id, "stamped"); setForced(null);
    const what = isRegion ? w.region : w.country;
    const flag = isRegion ? "🛣️" : flagFor(w.cc);
    showToast(`${flag} ${what} ${direction === "departure" ? "exit" : "entry"} stamped 🛂${data?.verified === "gps" ? " ✓" : ""}`, "success");
  };

  const stampFor = (direction) => (isRegion
    ? <LandStamp template="state" name={w.region} sub={w.info?.nickname} date={date} direction={direction} ink={w.ink} width={134} />
    : <LandStamp template="country" name={w.country} countryCode={w.cc} date={date} direction={direction} ink={w.ink} width={134} />);
  const choice = (direction, label, sub) => (
    <button type="button" onClick={() => add(direction)} disabled={!!busy}
      style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: "10px 6px 9px", background: "#fff", border: "1.5px solid rgba(22,17,13,.16)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: busy && busy !== direction ? 0.55 : 1, fontFamily: "inherit", cursor: "pointer" }}>
      {stampFor(direction)}
      <span style={{ fontWeight: 700, fontSize: 15, color: "#16110D" }}>{busy === direction ? "Stamping…" : label}</span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: "#736657" }}>{sub}</span>
    </button>
  );
  const name = isRegion ? w.region : withThe(w.country);
  const left = hoursLeft(w);
  const kicker = w.crossing
    ? `${isRegion ? "State line" : "Checkpoint"}${spot.near ? ` · ${spot.near}` : ""} · ${seenLabel(spot.at)}`
    : `${isRegion ? w.region : w.country} · first seen${spot.near ? ` near ${spot.near}` : ""} · ${seenLabel(spot.at)}`;
  return (
    <div onClick={settle} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#f3eee1", borderRadius: 22, maxWidth: 380, width: "100%", padding: 20, textAlign: "center", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }}>
        <p style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#B0472F", margin: "0 0 6px" }}>{kicker}</p>
        <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 24, color: "#16110D", margin: "0 0 2px" }}>
          {w.crossing ? `You crossed into ${name}!` : `You're in ${name}`}{isRegion ? "" : ` ${flagFor(w.cc)}`}
        </p>
        <p style={{ color: "#3A3128", fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
          {isRegion && w.info?.nickname ? `${w.info.nickname} · ` : ""}{w.crossing ? "Stamp the crossing? Entry or exit goes on the stamp." : `You crossed earlier — the stamp has been waiting. ${left} h left of 48.`}
        </p>
        <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "#16110D" }}>How did you get here?</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
          {MODES.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMode(id)} disabled={!!busy} aria-pressed={picked === id}
              style={{ height: 34, padding: "0 12px", borderRadius: 999, border: picked === id ? "none" : "1px solid #E6DFD2", background: picked === id ? "#0E7C73" : "#fff", color: picked === id ? "#fff" : "#3A3128", fontSize: 12.5, fontWeight: picked === id ? 700 : 600, fontFamily: "inherit", cursor: "pointer" }}>{label}</button>
          ))}
        </div>
        {picked === "plane" ? (
          <p style={{ color: "#736657", fontSize: 11.5, lineHeight: 1.45, margin: "10px 0 0" }}>A flight gives no land stamp — the airport gives its own, arriving and departing.</p>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {choice("arrival", "Entry", isRegion ? (w.crossing ? "Just crossed in" : "Dated the day seen") : "Entering the country")}
            {choice("departure", "Exit", isRegion ? "Heading out" : "Leaving the country")}
          </div>
        )}
        {picked === "plane" ? (
          <button type="button" onClick={() => add("arrival")} disabled={!!busy} style={{ width: "100%", marginTop: 10, borderRadius: 12, padding: "11px", fontWeight: 700, background: "#B0472F", color: "#fff", border: "none", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>Got it — no land stamp</button>
        ) : null}
        <button type="button" onClick={settle} disabled={!!busy} style={{ width: "100%", marginTop: 8, borderRadius: 12, padding: "10px", fontWeight: 600, background: "none", color: "#3A3128", border: "none", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>Later — it waits {left} hours</button>
        <p style={{ color: "#736657", fontSize: 10.5, lineHeight: 1.4, margin: "2px 0 0" }}>Nothing is stamped until you tap — and only after you&rsquo;ve crossed.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 6 }}>
          <button type="button" onClick={decline} disabled={!!busy} style={{ color: "#736657", fontSize: 11.5, textDecoration: "underline", background: "none", border: "none", fontFamily: "inherit", cursor: "pointer" }}>Not this one</button>
          <button type="button" onClick={turnOff} disabled={!!busy} style={{ color: "#736657", fontSize: 11.5, textDecoration: "underline", background: "none", border: "none", fontFamily: "inherit", cursor: "pointer" }}>Turn off crossing pop-ups</button>
        </div>
      </div>
    </div>
  );
}
