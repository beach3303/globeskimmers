import React, { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { addStamp } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { nearestAirport } from "@/lib/airports";
import { countryCode } from "@/lib/countries";

// ============================================================================
// 🛂 Land / boat border-crossing stamp. When a signed-in user's GPS country
// CHANGES (reverse-geocoded via LocationContext) and they're NOT near an airport
// (an air arrival is handled by AirportArrivalPrompt), we PROMPT to add a border
// crossing stamp. Consent-gated (never auto), foreground only, no background
// tracking. `pp_last_country` is the shared "where you were last" marker.
// ============================================================================
const LAST = "pp_last_country";
// Dedicated toggle for the new-city / border pop-up (default on; Settings +
// inline turn-off both flip pp_city_prompt).
const suggestOn = () => { try { return localStorage.getItem("pp_city_prompt") !== "0"; } catch { return true; } };
const readLast = () => { try { return (localStorage.getItem(LAST) || "").toUpperCase(); } catch { return ""; } };
const writeLast = (cc) => { try { localStorage.setItem(LAST, cc); } catch { /* ignore */ } };
const regionName = (cc) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; } };
const flagFor = (cc) => (/^[a-z]{2}$/i.test(cc || "")
  ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
  : "🌍");

export default function BorderCrossingPrompt() {
  const { activeLocation, locationMode } = useLocation();
  const { isAuthenticated } = useAuth();
  const [pending, setPending] = useState(null); // { cc, country, lat, lng }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated || locationMode !== "current" || !suggestOn()) return;
      const c = activeLocation?.coordinates;
      const cc = (countryCode(activeLocation?.address?.country) || "").toUpperCase();
      if (!cc || !c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
      const last = readLast();
      if (!last) { writeLast(cc); return; }   // first run → seed baseline silently, no prompt
      if (cc === last) return;                 // same country → no crossing
      // Country changed. If an airport is nearby, the airport prompt owns it.
      const ap = await nearestAirport(c.latitude, c.longitude, 12);
      if (cancelled) return;
      if (ap) { writeLast(cc); return; }       // flew in → AirportArrivalPrompt handles it
      setPending({ cc, country: regionName(cc), lat: c.latitude, lng: c.longitude });
    })();
    return () => { cancelled = true; };
  }, [activeLocation, locationMode, isAuthenticated]);

  const close = () => { if (pending) writeLast(pending.cc); setPending(null); };
  const turnOff = () => { try { localStorage.setItem("pp_city_prompt", "0"); } catch { /* ignore */ } if (pending) writeLast(pending.cc); setPending(null); };
  const add = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const { data, error } = await addStamp({
      kind: "country", tier: "page", entity_type: "border", entity_id: pending.cc,
      name: `${pending.country} · Border Crossing`, city: null, country: pending.country, cc: pending.cc,
      lat: pending.lat, lng: pending.lng, visited_on: new Date().toISOString().slice(0, 10),
      local_hour: new Date().getHours(), verified: "gps",
    });
    setBusy(false);
    writeLast(pending.cc);
    const country = pending.country, flag = flagFor(pending.cc);
    setPending(null);
    if (error) showToast(error, "error");
    else showToast(`${flag} ${country} border crossing stamped 🛂${data?.verified === "gps" ? " ✓" : ""}`, "success");
  };

  if (!pending) return null;
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#f3eee1", borderRadius: 22, maxWidth: 360, width: "100%", padding: 22, textAlign: "center", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }}>
        <div style={{ fontSize: 52, lineHeight: 1 }}>{flagFor(pending.cc)}</div>
        <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 24, color: "#16110D", margin: "8px 0 2px" }}>Welcome to {pending.country}!</p>
        <p style={{ color: "#3A3128", fontSize: 14, lineHeight: 1.5 }}>Crossed a border by land or sea? Add your {pending.country} crossing stamp.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={close} disabled={busy} style={{ flex: 1, borderRadius: 12, padding: "11px", fontWeight: 600, background: "#fff", color: "#3A3128", border: "1px solid rgba(22,17,13,.12)", fontSize: 14 }}>Not now</button>
          <button onClick={add} disabled={busy} style={{ flex: 1, borderRadius: 12, padding: "11px", fontWeight: 700, background: "#B0472F", color: "#fff", border: "none", fontSize: 14 }}>{busy ? "Stamping…" : "Stamp it ✓"}</button>
        </div>
        <p style={{ color: "#736657", fontSize: 11, lineHeight: 1.4, marginTop: 10 }}>Just passing through? Tap “Not now.”</p>
        <button onClick={turnOff} disabled={busy} style={{ marginTop: 8, color: "#736657", fontSize: 12, textDecoration: "underline", background: "none", border: "none" }}>Turn off new-city pop-ups</button>
      </div>
    </div>
  );
}
