import React, { useEffect, useState } from "react";
import { useLocation, isLiveFix } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { addStamp, setStampNote } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { airportAt, markAirportVisit } from "@/lib/airports";
import { localISODate } from "@/lib/localDate";
import AirportStamp from "@/components/passport/AirportStamp";
import LandStamp from "@/components/passport/LandStamp";
import { useCrossings, openWindow, closeWindow, deferWindow, isDeferred, hoursLeft, seenLabel, windowById, OPEN_EVENT } from "@/lib/crossings";

// ============================================================================
// ✈️ Airport stamp — when a signed-in user opens the app while physically
// AT/near an airport (foreground GPS / current-location mode), we PROMPT to
// stamp it, asking which way they're flying (founder, 2026-10-05): Arriving or
// Departing goes on the stamp, and a round trip collects both — the prompt
// comes back on a later day at the same airport (one ask per airport per day).
// Consent-gated (never auto-stamp), foreground only — no background tracking.
// ============================================================================
// BORDER GRACE (founder, 2026-11-05; src/lib/crossings.js): a fix inside the fence opens a 48-hour
// WINDOW for that airport — this sheet on every open (any page: mounted in Layout), an "airport stamp
// waiting" card on the passport page, dated the day the app saw you there. One window per airport per
// day, so a return visit re-asks; stamped or declined, it never reopens. The old "asked today" set
// (pp_prompted_airport_v2) is retired.
const regionName = (cc) => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; }
};
// User can turn arrival suggestions off in Settings (default ON).
const suggestOn = () => { try { return localStorage.getItem("pp_suggest_arrivals") !== "0"; } catch { return true; } };
const flagFor = (cc) => (/^[a-z]{2}$/i.test(cc || "") ? String.fromCodePoint(...[...String(cc).toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "");

// An international airport (founder, 2026-10-24: "for the international airports, also add entry or
// exit, would love departure and arrival instead") also offers the COUNTRY stamp, like immigration's:
// after the airport stamp, one more choice — the country's arrival or departure, or just the airport.
// International = the name says so (in the languages our airport names come in), or a major hub
// whose name doesn't, or the phone's last live fix was in another country (it just flew in).
const INTL_NAME = /international|intercontinental|internacional|internationale|internazionale|internasional|国際|國際|国际|국제|intl/i;
const INTL_HUBS = new Set(["LHR", "LGW", "STN", "MAN", "EDI", "CDG", "ORY", "NCE", "AMS", "FRA", "MUC", "ZRH", "GVA", "VIE", "BRU", "CPH", "ARN", "OSL", "HEL", "DUB", "MAD", "BCN", "LIS", "OPO", "FCO", "MXP", "VCE", "ATH", "IST", "SAW", "PRG", "WAW", "BUD", "SIN", "BKK", "DMK", "HKT", "SYD", "MEL", "BNE", "PER", "TLV", "CAI"]);
// "the Philippines", "the United States", "the Bahamas": the names English says with "the".
const withThe = (name) => (/^(United |Czech Republic|Dominican Republic|Central African Republic)|Islands$|^(Philippines|Netherlands|Bahamas|Maldives|Gambia|Comoros|Seychelles)$/.test(String(name || "")) ? `the ${name}` : name);
const lastLiveCountry = () => { try { return JSON.parse(localStorage.getItem("pp_live_region_v2") || "null")?.cc || null; } catch { return null; } };
const isIntl = (ap) => INTL_NAME.test(String(ap.name || "")) || INTL_HUBS.has(String(ap.iata || "").toUpperCase()) || (!!lastLiveCountry() && !!ap.cc && lastLiveCountry() !== ap.cc);

export default function AirportArrivalPrompt() {
  const { currentGpsLocation } = useLocation();
  const { isAuthenticated } = useAuth();
  const open = useCrossings();
  const [forced, setForced] = useState(null);   // a window the passport card asked to stamp now
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = (e) => setForced(e.detail?.id || null);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  // Sensing: a live fix inside the fence opens the airport's 48-hour window.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated || !suggestOn()) return;
      // LIVE GPS only (founder, 2026-10-11): a fix the phone took in this app
      // run, in the last 30 minutes — never a picked destination (switching
      // back from a picked airport) or a restored last location (yesterday's
      // fix at LAX).
      if (!isLiveFix(currentGpsLocation)) return;
      const c = currentGpsLocation.coordinates;
      if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
      // Only when GPS is INSIDE the airport perimeter (terminals/runways/
      // planes) — not drive-bys or people waiting outside. Any airport, domestic
      // or international; consent-gated.
      const ap = await airportAt(c.latitude, c.longitude, c.accuracy);
      if (cancelled || !ap || !ap.iata) return;
      markAirportVisit();   // a flight, for the border-crossing prompt
      const at = Number(currentGpsLocation.fixedAt) || Date.now();
      openWindow({
        kind: "airport", key: `airport:${ap.iata}:${localISODate(new Date(at))}`,
        iata: ap.iata, city: ap.city || ap.name, cc: ap.cc, name: `${ap.city || ap.name} (${ap.iata})`,
        lat: ap.lat, lng: ap.lng, intl: isIntl(ap), firstSeen: { at, lat: ap.lat, lng: ap.lng, near: ap.city || ap.name },
      });
    })();
    return () => { cancelled = true; };
  }, [currentGpsLocation, isAuthenticated]);

  // The sheet: the window asked for, else the oldest open airport window not deferred this run.
  const asked = forced ? windowById(forced) : null;
  const win = (asked && asked.kind === "airport" && asked.status === "open" ? asked : null)
    || open.find((x) => x.kind === "airport" && !isDeferred(x.id)) || null;
  const pending = win ? { winId: win.id, iata: win.iata, city: win.city, countryCode: win.cc, lat: win.lat, lng: win.lng, intl: win.intl, seenAt: Number(win.firstSeen?.at) || Date.now(), ink: win.ink, left: hoursLeft(win) } : null;
  // Later keeps the window for the next open; Not this one closes it for good.
  const close = (forGood) => {
    if (pending) { if (forGood) closeWindow(pending.winId, "declined"); else deferWindow(pending.winId); }
    setForced(null);
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
  // The country stamp, offered after an international airport's stamp: { direction, iata, city, cc, country, lat, lng, noteId }.
  const [countryFor, setCountryFor] = useState(null);
  const [countryBusy, setCountryBusy] = useState(false);
  const stampCountry = async (yes) => {
    const c = countryFor;
    if (!c || countryBusy) return;
    if (yes) {
      setCountryBusy(true);
      const { data, error } = await addStamp({
        kind: "country", tier: "page", entity_type: "border", entity_id: c.cc,
        name: `${c.country} · ${c.iata}`, city: c.city, country: c.country, cc: c.cc,
        lat: c.lat, lng: c.lng, visited_on: localISODate(new Date(c.seenAt || Date.now())), verified: "gps",
        local_hour: new Date(c.seenAt || Date.now()).getHours(), direction: c.direction, mode: "air", ink: c.ink,
      });
      setCountryBusy(false);
      if (error) showToast(error, "error");
      else showToast(`${flagFor(c.cc)} ${c.country} ${c.direction} stamped 🛂${data?.verified === "gps" ? " ✓" : ""}`, "success");
    }
    setCountryFor(null);
    if (c.noteId) setNoteFor({ id: c.noteId, city: c.city });
  };
  const add = async (direction) => {
    if (!pending || busy) return;
    setBusy(direction);
    const seen = new Date(pending.seenAt);
    const today = localISODate(seen);   // the day the app saw you at the airport, even if you tap tomorrow
    const { data, error } = await addStamp({
      kind: "airport", tier: "page", entity_type: "airport", entity_id: pending.iata,
      name: `${pending.city} (${pending.iata})`, city: pending.city, country: pending.countryCode,
      cc: pending.countryCode, lat: pending.lat, lng: pending.lng, visited_on: today, verified: "gps",
      local_hour: seen.getHours(), direction,
    });
    setBusy(false);
    const city = pending.city;
    if (error) { close(false); showToast(error, "error"); return; }
    closeWindow(pending.winId, "stamped"); setForced(null);
    // Reflect the server's verdict: show the ✓ only if the GPS claim was corroborated.
    showToast(`✈️ ${city} (${pending.iata}) ${direction} stamped 🛂${data?.verified === "gps" ? " ✓" : ""}`, "success");
    // An international airport: the country's stamp next, then the trip note.
    if (pending.intl && pending.countryCode) {
      setCountryFor({ direction, iata: pending.iata, city, cc: pending.countryCode, country: regionName(pending.countryCode), lat: pending.lat, lng: pending.lng, noteId: data?.id || null, ink: pending.ink, seenAt: pending.seenAt });
      return;
    }
    if (data?.id) setNoteFor({ id: data.id, city });
  };

  if (countryFor) {
    const c = countryFor;
    const arriving = c.direction !== "departure";
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#f3eee1", borderRadius: 22, maxWidth: 380, width: "100%", padding: 22, textAlign: "center", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }}>
          <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 24, color: "#16110D", margin: "0 0 2px" }}>{arriving ? `Welcome to ${withThe(c.country)}!` : `Leaving ${withThe(c.country)}?`} {flagFor(c.cc)}</p>
          <p style={{ color: "#3A3128", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            International flight? Add {withThe(c.country).startsWith("the ") ? "" : "the "}{withThe(c.country)} {arriving ? "arrival" : "departure"} stamp too, like the one at immigration.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <LandStamp template="country" via="air" name={c.country} countryCode={c.cc} code={c.iata} date={localISODate(new Date(c.seenAt || Date.now()))} direction={c.direction} ink={c.ink} width={210} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => stampCountry(false)} disabled={countryBusy} style={{ flex: 1, borderRadius: 12, padding: "12px", fontWeight: 600, background: "#fff", color: "#3A3128", border: "1px solid rgba(22,17,13,.12)", fontSize: 14 }}>Just the airport</button>
            <button onClick={() => stampCountry(true)} disabled={countryBusy} style={{ flex: 1, borderRadius: 12, padding: "12px", fontWeight: 700, background: "#B0472F", color: "#fff", border: "none", fontSize: 14 }}>{countryBusy ? "Stamping…" : `Stamp ${c.country}`}</button>
          </div>
        </div>
      </div>
    );
  }
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
  const today = localISODate(new Date(pending.seenAt));
  const country = regionName(pending.countryCode);
  const later = Date.now() - pending.seenAt > 30 * 60 * 1000;   // not at the airport any more: the window's words
  const choice = (direction, label, sub) => (
    <button onClick={() => add(direction)} disabled={!!busy}
      style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: "10px 6px 9px", background: "#fff", border: "1.5px solid rgba(22,17,13,.16)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: busy && busy !== direction ? 0.55 : 1 }}>
      <AirportStamp iata={pending.iata} city={pending.city} countryCode={pending.countryCode} date={today} direction={direction} width={128} />
      <span style={{ fontWeight: 700, fontSize: 15, color: "#16110D" }}>{busy === direction ? "Stamping…" : label}</span>
      <span style={{ fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 10, color: "#736657" }}>{sub}</span>
    </button>
  );
  return (
    <div onClick={() => close(false)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#f3eee1", borderRadius: 22, maxWidth: 380, width: "100%", padding: 22, textAlign: "center", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }}>
        {later ? <p style={{ fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 9.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#B0472F", margin: "0 0 6px" }}>{pending.iata} · seen {seenLabel(pending.seenAt)} · {pending.left} h left</p> : null}
        <p style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 24, color: "#16110D", margin: "0 0 2px" }}>{later ? "You were at" : "You’re at"} {pending.city} ({pending.iata})</p>
        <p style={{ color: "#3A3128", fontSize: 14, lineHeight: 1.5, margin: 0 }}>{later ? "The stamp has been waiting. Which way were you flying? It goes on the stamp." : "Stamp your passport? Tell us which way you’re flying — it goes on the stamp."} {country}.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {choice("arrival", "Arriving", "Just landed")}
          {choice("departure", "Departing", "Flying out")}
        </div>
        <button onClick={() => close(false)} disabled={!!busy} style={{ width: "100%", marginTop: 10, borderRadius: 12, padding: "10px", fontWeight: 600, background: "none", color: "#3A3128", border: "none", fontSize: 14 }}>Later — it waits {pending.left} hours</button>
        <p style={{ color: "#736657", fontSize: 11, lineHeight: 1.4, marginTop: 2 }}>Nothing is stamped until you tap. Round trip? You&rsquo;ll be asked again on the way home.</p>
        <button onClick={() => close(true)} disabled={!!busy} style={{ marginTop: 6, color: "#736657", fontSize: 11.5, textDecoration: "underline", background: "none", border: "none" }}>Not this one</button>
      </div>
    </div>
  );
}
