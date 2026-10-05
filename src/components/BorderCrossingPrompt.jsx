import React, { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { addStamp } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { nearestAirport } from "@/lib/airports";
import { countryCode } from "@/lib/countries";
import { regionInfo } from "@/lib/stateNicknames";
import LandStamp from "@/components/passport/LandStamp";

// ============================================================================
// 🛂 Border-crossing stamps on the ground (founder, 2026-10-05). When a
// signed-in user's GPS says they are IN a new place — never before the line,
// only after — we ask which way they crossed:
//   · a new COUNTRY (San Diego → Tijuana by car, Paris → Brussels by train, a
//     cruise stop): the checkpoint stamp, Entry / Exit, by car, train or ship;
//   · a new US STATE or UK NATION (California → Nevada, England → Scotland):
//     the welcome-sign stamp with the state's claim ("The Silver State").
// Consent-gated (never auto), foreground only, no background tracking. An
// airport nearby hands the moment to AirportArrivalPrompt instead.
// ============================================================================
const LAST = "pp_last_country";
const LAST_REGION = "pp_last_region";
const suggestOn = () => { try { return localStorage.getItem("pp_city_prompt") !== "0"; } catch { return true; } };
const readLS = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const regionName = (cc) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; } };
const flagFor = (cc) => (/^[a-z]{2}$/i.test(cc || "")
  ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
  : "🌍");

const MODES = [["car", "🚗 Car"], ["train", "🚆 Train"], ["ship", "🚢 Ship"]];

export default function BorderCrossingPrompt() {
  const { activeLocation, locationMode } = useLocation();
  const { isAuthenticated } = useAuth();
  // { type:'country', cc, country, lat, lng } | { type:'region', cc, country, region, info, lat, lng }
  const [pending, setPending] = useState(null);
  const [mode, setMode] = useState("car");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated || locationMode !== "current" || !suggestOn() || pending) return;
      const c = activeLocation?.coordinates;
      const cc = (countryCode(activeLocation?.address?.country) || "").toUpperCase();
      if (!cc || !c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
      const region = String(activeLocation?.address?.state || "").trim();
      const regionKey = region ? `${cc}:${region}` : "";
      const lastC = readLS(LAST), lastR = readLS(LAST_REGION);
      if (!lastC) { writeLS(LAST, cc); writeLS(LAST_REGION, regionKey); return; } // first run → baseline, no prompt
      if (cc !== lastC) {
        // A new country — and we're already across. A nearby airport owns it.
        const ap = await nearestAirport(c.latitude, c.longitude, 12);
        if (cancelled) return;
        writeLS(LAST_REGION, regionKey);
        if (ap) { writeLS(LAST, cc); return; }
        setMode("car");
        setPending({ type: "country", cc, country: regionName(cc), lat: c.latitude, lng: c.longitude });
        return;
      }
      // Same country — a new state / nation inside it (US + UK only).
      const info = regionInfo(cc, region);
      if (info && regionKey && lastR && regionKey !== lastR) {
        setMode("car");
        setPending({ type: "region", cc, country: regionName(cc), region, info, lat: c.latitude, lng: c.longitude });
        return;
      }
      if (regionKey && regionKey !== lastR) writeLS(LAST_REGION, regionKey);
    })();
    return () => { cancelled = true; };
  }, [activeLocation, locationMode, isAuthenticated, pending]);

  const settle = () => {
    if (!pending) return;
    writeLS(LAST, pending.cc);
    writeLS(LAST_REGION, pending.type === "region" ? `${pending.cc}:${pending.region}` : readLS(LAST_REGION));
    setPending(null);
  };
  const turnOff = () => { writeLS("pp_city_prompt", "0"); settle(); };

  const add = async (direction) => {
    if (!pending || busy) return;
    setBusy(direction);
    const today = new Date().toISOString().slice(0, 10);
    const isRegion = pending.type === "region";
    const { data, error } = await addStamp(isRegion ? {
      kind: "state", tier: "page", entity_type: "border", entity_id: pending.info.abbr,
      name: pending.region, region: pending.region, country: pending.country, cc: pending.cc,
      lat: pending.lat, lng: pending.lng, visited_on: today, verified: "gps",
      local_hour: new Date().getHours(), direction, mode: mode === "ship" ? "car" : mode,
    } : {
      kind: "country", tier: "page", entity_type: "border", entity_id: pending.cc,
      name: `${pending.country} · Border Crossing`, city: null, country: pending.country, cc: pending.cc,
      lat: pending.lat, lng: pending.lng, visited_on: today, verified: "gps",
      local_hour: new Date().getHours(), direction, mode,
    });
    setBusy(false);
    const what = isRegion ? pending.region : pending.country;
    const flag = isRegion ? "🛣️" : flagFor(pending.cc);
    settle();
    if (error) { showToast(error, "error"); return; }
    showToast(`${flag} ${what} ${direction === "departure" ? "exit" : "entry"} stamped 🛂${data?.verified === "gps" ? " ✓" : ""}`, "success");
  };

  if (!pending) return null;
  const today = new Date().toISOString().slice(0, 10);
  const isRegion = pending.type === "region";
  const stampFor = (direction) => (isRegion
    ? <LandStamp template="state" name={pending.region} sub={pending.info.nickname} date={today} direction={direction} mode={mode} width={134} />
    : <LandStamp template="country" name={pending.country} countryCode={pending.cc} date={today} direction={direction} mode={mode} width={134} />);
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
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {(isRegion ? MODES.slice(0, 2) : MODES).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)} disabled={!!busy} aria-pressed={mode === k}
              style={{ borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, border: "1px solid rgba(22,17,13,.16)", background: mode === k ? "#16110D" : "#fff", color: mode === k ? "#fff" : "#3A3128" }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
