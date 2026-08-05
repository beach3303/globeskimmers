import React, { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { addStamp } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { nearestAirport } from "@/lib/airports";
import AirportStamp from "@/components/passport/AirportStamp";

// ============================================================================
// ✈️ Airport arrival stamp — when a signed-in user opens the app while physically
// AT/near an international airport (foreground GPS / current-location mode), we
// PROMPT to add an authentic arrival stamp (IATA · city · country · date, GPS-
// verified). Consent-gated (never auto-stamp), one prompt per airport
// (localStorage guard), foreground only — no background tracking.
// ============================================================================
const KEY = "pp_prompted_airport";
const regionName = (cc) => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; }
};
const getSet = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const saveSet = (s) => { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* ignore */ } };
// User can turn arrival suggestions off in Settings (default ON).
const suggestOn = () => { try { return localStorage.getItem("pp_suggest_arrivals") !== "0"; } catch { return true; } };

export default function AirportArrivalPrompt() {
  const { activeLocation, locationMode } = useLocation();
  const { isAuthenticated } = useAuth();
  const [pending, setPending] = useState(null); // { iata, city, countryCode, lat, lng }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated || locationMode !== "current" || !suggestOn()) return;
      const c = activeLocation?.coordinates;
      if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
      const ap = await nearestAirport(c.latitude, c.longitude, 6);
      if (cancelled || !ap) return;
      if (getSet().has(ap.iata)) return; // already handled this airport
      setPending(ap);
    })();
    return () => { cancelled = true; };
  }, [activeLocation, locationMode, isAuthenticated]);

  const close = (markHandled) => {
    if (markHandled && pending) { const s = getSet(); s.add(pending.iata); saveSet(s); }
    setPending(null);
  };
  const add = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await addStamp({
      kind: "airport", tier: "page", entity_type: "airport", entity_id: pending.iata,
      name: `${pending.city} (${pending.iata})`, city: pending.city, country: pending.countryCode,
      cc: pending.countryCode, lat: pending.lat, lng: pending.lng, visited_on: today, verified: "gps",
    });
    setBusy(false);
    close(true);
    if (error) showToast(error, "error");
    // Reflect the server's verdict: show the ✓ only if the GPS claim was corroborated.
    else showToast(`✈️ ${pending.city} (${pending.iata}) arrival stamped 🛂${data?.verified === "gps" ? " ✓" : ""}`, "success");
  };

  if (!pending) return null;
  const today = new Date().toISOString().slice(0, 10);
  const country = regionName(pending.countryCode);
  return (
    <div onClick={() => close(true)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#f3eee1", borderRadius: 22, maxWidth: 360, width: "100%", padding: 22, textAlign: "center", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <AirportStamp iata={pending.iata} city={pending.city} countryCode={pending.countryCode} date={today} width={252} />
        </div>
        <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 24, color: "#16110D", margin: "6px 0 2px" }}>Welcome to {pending.city}!</p>
        <p style={{ color: "#3A3128", fontSize: 14, lineHeight: 1.5 }}>Add your arrival stamp for {pending.city} ({pending.iata}), {country}?</p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => close(true)} disabled={busy} style={{ flex: 1, borderRadius: 12, padding: "11px", fontWeight: 600, background: "#fff", color: "#3A3128", border: "1px solid rgba(22,17,13,.12)", fontSize: 14 }}>Not now</button>
          <button onClick={add} disabled={busy} style={{ flex: 1, borderRadius: 12, padding: "11px", fontWeight: 700, background: "#B0472F", color: "#fff", border: "none", fontSize: 14 }}>{busy ? "Stamping…" : "Stamp it ✓"}</button>
        </div>
        <p style={{ color: "#736657", fontSize: 11, lineHeight: 1.4, marginTop: 10 }}>Just passing through? Tap “Not now.”</p>
      </div>
    </div>
  );
}
