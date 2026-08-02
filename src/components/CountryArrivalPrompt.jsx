import React, { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { addStamp } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { countryCode } from "@/lib/countries";

// ============================================================================
// Country arrival stamp — the "collect countries" core. When a signed-in user
// opens the app while physically in a NEW country (foreground GPS / current-
// location mode), we PROMPT to add a country stamp (flag + entry city + date,
// GPS-verified). Consent-gated (never auto-stamp) + handles layovers/transit
// (they can tap "Not now"). Foreground only — no background tracking. Skips the
// user's home country. One prompt per country (localStorage guard).
// ============================================================================
const KEY = "pp_prompted_country";
const flagEmoji = (country) => {
  const cc = countryCode(country);
  if (!cc || !/^[a-z]{2}$/i.test(cc)) return "🛂";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};
const norm = (s) => String(s || "").trim().toLowerCase();

export default function CountryArrivalPrompt() {
  const { activeLocation, locationMode } = useLocation();
  const { isAuthenticated, profile } = useAuth();
  const [pending, setPending] = useState(null); // { country, city }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || locationMode !== "current") return;
    const country = activeLocation?.address?.country;
    if (!country) return;
    if (profile?.home_country && norm(profile.home_country) === norm(country)) return; // skip home
    let prompted = null; try { prompted = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (prompted && norm(prompted) === norm(country)) return; // already handled this country
    setPending({ country, city: activeLocation?.address?.city || "" });
  }, [activeLocation, locationMode, isAuthenticated, profile]);

  const close = (markHandled) => {
    if (markHandled && pending) { try { localStorage.setItem(KEY, pending.country); } catch { /* ignore */ } }
    setPending(null);
  };
  const add = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const cc = countryCode(pending.country);
    const { error } = await addStamp({
      kind: "country", tier: "page", entity_type: "country",
      entity_id: `country:${cc || norm(pending.country).replace(/[^a-z0-9]+/g, "-")}`,
      name: pending.country, city: pending.city || null, country: pending.country,
      visited_on: new Date().toISOString().slice(0, 10), verified: "gps",
    });
    setBusy(false);
    close(true);
    if (error) showToast(error, "error");
    else showToast(`${flagEmoji(pending.country)} ${pending.country} added to your passport 🛂 ✓`, "success");
  };

  if (!pending) return null;
  return (
    <div onClick={() => close(true)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, maxWidth: 340, width: "100%", padding: 22, textAlign: "center", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>{flagEmoji(pending.country)}</div>
        <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 24, color: "#16110D", margin: "8px 0 2px" }}>Welcome to {pending.country}!</p>
        <p style={{ color: "#3A3128", fontSize: 14, lineHeight: 1.5 }}>{pending.city ? `Looks like you're in ${pending.city}. ` : ""}Add a {pending.country} stamp to your Virtual Passport?</p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => close(true)} disabled={busy} style={{ flex: 1, borderRadius: 12, padding: "11px", fontWeight: 600, background: "#fff", color: "#3A3128", border: "1px solid rgba(22,17,13,.12)", fontSize: 14 }}>Not now</button>
          <button onClick={add} disabled={busy} style={{ flex: 1, borderRadius: 12, padding: "11px", fontWeight: 700, background: "#B0472F", color: "#fff", border: "none", fontSize: 14 }}>{busy ? "Adding…" : "Add stamp ✓"}</button>
        </div>
        <p style={{ color: "#736657", fontSize: 11, lineHeight: 1.4, marginTop: 10 }}>Just passing through? Tap “Not now.”</p>
      </div>
    </div>
  );
}
