import React, { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { addStamp, setStampNote } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { airportAt } from "@/lib/airports";
import AirportStamp from "@/components/passport/AirportStamp";

// ============================================================================
// ✈️ Airport stamp — when a signed-in user opens the app while physically
// AT/near an airport (foreground GPS / current-location mode), we PROMPT to
// stamp it, asking which way they're flying (founder, 2026-10-05): Arriving or
// Departing goes on the stamp, and a round trip collects both — the prompt
// comes back on a later day at the same airport (one ask per airport per day).
// Consent-gated (never auto-stamp), foreground only — no background tracking.
// ============================================================================
// v2 (2026-10-05): entries are "IATA:YYYY-MM-DD" so a return visit re-asks; the
// old per-airport-forever key is retired so everyone gets the new ask.
const KEY = "pp_prompted_airport_v2";
const dayKey = (iata) => `${iata}:${new Date().toISOString().slice(0, 10)}`;
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
      // Only prompt when GPS is INSIDE the airport perimeter (terminals/runways/
      // planes) — not drive-bys or people waiting outside. Any airport, domestic
      // or international; consent-gated; one prompt per airport (localStorage).
      const ap = await airportAt(c.latitude, c.longitude, c.accuracy);
      if (cancelled || !ap || !ap.iata) return;
      if (getSet().has(dayKey(ap.iata))) return; // already asked here today
      setPending({ iata: ap.iata, city: ap.city || ap.name, countryCode: ap.cc, lat: ap.lat, lng: ap.lng });
    })();
    return () => { cancelled = true; };
  }, [activeLocation, locationMode, isAuthenticated]);

  const close = (markHandled) => {
    if (markHandled && pending) { const s = getSet(); s.add(dayKey(pending.iata)); saveSet(s); }
    setPending(null);
  };
  // After the stamp: "what was this trip for?" — private by default.
  const [noteFor, setNoteFor] = useState(null); // { id, city }
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const saveNote = async () => {
    if (!noteFor || !note.trim()) { setNoteFor(null); return; }
    setNoteBusy(true);
    const { error } = await setStampNote(noteFor.id, { note: note.trim() });
    setNoteBusy(false);
    if (error) { showToast(error, "error"); return; }
    showToast("Saved privately to your stamp 🔒", "success");
    setNoteFor(null); setNote("");
  };
  const add = async (direction) => {
    if (!pending || busy) return;
    setBusy(direction);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await addStamp({
      kind: "airport", tier: "page", entity_type: "airport", entity_id: pending.iata,
      name: `${pending.city} (${pending.iata})`, city: pending.city, country: pending.countryCode,
      cc: pending.countryCode, lat: pending.lat, lng: pending.lng, visited_on: today, verified: "gps",
      local_hour: new Date().getHours(), direction,
    });
    setBusy(false);
    const city = pending.city;
    close(true);
    if (error) { showToast(error, "error"); return; }
    // Reflect the server's verdict: show the ✓ only if the GPS claim was corroborated.
    showToast(`✈️ ${city} (${pending.iata}) ${direction} stamped 🛂${data?.verified === "gps" ? " ✓" : ""}`, "success");
    if (data?.id) setNoteFor({ id: data.id, city });
  };

  if (noteFor) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <div style={{ background: "#f3eee1", borderRadius: 22, maxWidth: 360, width: "100%", padding: 22, boxShadow: "0 24px 60px -20px rgba(0,0,0,.5)" }}>
          <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 22, color: "#16110D", margin: "0 0 4px" }}>What brings you to {noteFor.city}?</p>
          <p style={{ color: "#736657", fontSize: 12.5, lineHeight: 1.45 }}>🔒 Only you can see this — you can share it on your passport later.</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} rows={3} autoFocus
            placeholder="Visiting family, a conference, our honeymoon…" aria-label="Trip note"
            style={{ width: "100%", marginTop: 10, borderRadius: 12, border: "1px solid rgba(22,17,13,.14)", background: "#fff", padding: "10px 12px", fontSize: 15, color: "#16110D", fontFamily: "inherit", resize: "none" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => { setNoteFor(null); setNote(""); }} disabled={noteBusy} style={{ flex: 1, borderRadius: 12, padding: "11px", fontWeight: 600, background: "#fff", color: "#3A3128", border: "1px solid rgba(22,17,13,.12)", fontSize: 14 }}>Skip</button>
            <button onClick={saveNote} disabled={noteBusy || !note.trim()} style={{ flex: 1, borderRadius: 12, padding: "11px", fontWeight: 700, background: "#B0472F", color: "#fff", border: "none", fontSize: 14, opacity: note.trim() ? 1 : 0.6 }}>{noteBusy ? "Saving…" : "Save note"}</button>
          </div>
        </div>
      </div>
    );
  }
  if (!pending) return null;
  const today = new Date().toISOString().slice(0, 10);
  const country = regionName(pending.countryCode);
  const choice = (direction, label, sub) => (
    <button onClick={() => add(direction)} disabled={!!busy}
      style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: "10px 6px 9px", background: "#fff", border: "1.5px solid rgba(22,17,13,.16)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: busy && busy !== direction ? 0.55 : 1 }}>
      <AirportStamp iata={pending.iata} city={pending.city} countryCode={pending.countryCode} date={today} direction={direction} width={128} />
      <span style={{ fontWeight: 700, fontSize: 15, color: "#16110D" }}>{busy === direction ? "Stamping…" : label}</span>
      <span style={{ fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 10, color: "#736657" }}>{sub}</span>
    </button>
  );
  return (
    <div onClick={() => close(true)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#f3eee1", borderRadius: 22, maxWidth: 380, width: "100%", padding: 22, textAlign: "center", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }}>
        <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 24, color: "#16110D", margin: "0 0 2px" }}>You&rsquo;re at {pending.city} ({pending.iata})</p>
        <p style={{ color: "#3A3128", fontSize: 14, lineHeight: 1.5, margin: 0 }}>Stamp your passport? Tell us which way you&rsquo;re flying — it goes on the stamp. {country}.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {choice("arrival", "Arriving", "Just landed")}
          {choice("departure", "Departing", "Flying out")}
        </div>
        <button onClick={() => close(true)} disabled={!!busy} style={{ width: "100%", marginTop: 10, borderRadius: 12, padding: "10px", fontWeight: 600, background: "none", color: "#3A3128", border: "none", fontSize: 14 }}>Not now</button>
        <p style={{ color: "#736657", fontSize: 11, lineHeight: 1.4, marginTop: 2 }}>Nothing is stamped until you tap. Round trip? You&rsquo;ll be asked again on the way home.</p>
      </div>
    </div>
  );
}
