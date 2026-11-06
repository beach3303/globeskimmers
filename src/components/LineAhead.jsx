// The line ahead (border grace, phase 2 — founder "go", 2026-11-06). With the app open in a passenger's hand
// or on a mounted phone: when the last two live fixes say the phone is moving and a state line lies ahead
// along that heading, a tile offers "Watch the line". Watching, the phone follows GPS once a second (only
// while this strip shows — it stops when the strip closes, the app leaves the screen, or the line is
// crossed) and counts down "12.4 mi to the Arizona line · I-10". At the line the state's stamp slams in
// with a buzz and a thump, the crossing is caught to the metre and named by its port of entry, and the
// 48-hour window opens with the sheet behind it. No new permission: location while in use, as always.
import React, { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation, isLiveFix } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { loadStates, stateAt, stateName, lineAhead, bearing, kmBetween } from "@/lib/stateLines";
import { portFor, postLabel } from "@/lib/portsOfEntry";
import { regionInfo } from "@/lib/stateNicknames";
import { openWindow, setBaseline, suggestionsOn } from "@/lib/crossings";
import { pickInk } from "@/lib/stampInks";
import LandStamp from "@/components/passport/LandStamp";

const MONO = '"JetBrains Mono",ui-monospace,monospace';
const SERIF = '"Instrument Serif",Georgia,serif';
const NAVY = "#0C2B50", GOLD = "#D6A64A";
const MI = 0.621371;
const rough = (v) => Math.round(v * 1000) / 1000;
const miles = (km) => (km < 10 ? (km * MI).toFixed(1) : Math.round(km * MI).toString());
const OFFER_KM = 80;      // a line within 50 miles ahead
const MOVING_KM = 2;      // the two fixes at least this far apart…
const MOVING_MIN = 20;    // …within this many minutes: the phone is travelling
const DOCK = { position: "fixed", left: 12, right: 12, bottom: "calc(98px + env(safe-area-inset-bottom))", zIndex: 60 };

// A thump through the speaker, made on the spot (the AudioContext is born on the tap, as iOS wants).
function thump(ctx) {
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(110, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.16);
    g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.24);
  } catch { /* no sound: the buzz and the slam still happen */ }
}
const buzz = () => { try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch { /* ignore */ } };

async function startWatch(onReading, onError) {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0, interval: 1000, minimumUpdateInterval: 500 }, (pos, err) => { if (err) onError(err); else if (pos) onReading(pos); });
    return () => { Geolocation.clearWatch({ id }).catch(() => {}); };
  }
  if (!navigator.geolocation) { onError(new Error("no geolocation")); return () => {}; }
  const id = navigator.geolocation.watchPosition(onReading, onError, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  return () => navigator.geolocation.clearWatch(id);
}

// ── The three faces, on their own so they can be shown without a drive ─────────────────────────────
export function OfferTile({ offer, onWatch, onClose, style = undefined }) {
  return (
    <div role="status" style={{ ...DOCK, boxSizing: "border-box", padding: "10px 12px 10px 14px", borderRadius: 16, background: "#FFFCF7", border: "1px solid #E6DFD2", color: "#16110D", boxShadow: "0 14px 30px -18px rgba(22,17,13,.5)", display: "flex", alignItems: "center", gap: 10, ...style }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#B0472F" }}>{offer.name} line ahead · {miles(offer.km)} mi{offer.road ? ` · ${offer.road}` : ""}</div>
        <div style={{ fontSize: 13, lineHeight: 1.4, color: "#3A3128", marginTop: 2 }}>Count it down and catch the stamp at the line. Only while this is open.</div>
      </div>
      <button type="button" onClick={onWatch} style={{ flex: "none", minHeight: 40, padding: "0 14px", borderRadius: 999, border: "none", background: NAVY, color: "#F3EEE1", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Watch the line</button>
      <button type="button" onClick={onClose} aria-label="Not now" style={{ flex: "none", width: 32, height: 32, borderRadius: 999, border: "1px solid #E6DFD2", background: "#fff", color: "#736657", fontSize: 16, lineHeight: 1, cursor: "pointer" }}>×</button>
    </div>
  );
}
export function LiveStrip({ live, onStop, style = undefined }) {
  const pct = live.startKm > 0 ? Math.max(0, Math.min(100, (1 - live.km / live.startKm) * 100)) : 0;
  return (
    <div role="status" style={{ ...DOCK, boxSizing: "border-box", padding: "10px 14px 12px", borderRadius: 16, background: NAVY, color: "#F3EEE1", boxShadow: "0 14px 30px -16px rgba(12,43,80,.7)", display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD }}>The line ahead{live.road ? ` · ${live.road}` : ""}</div>
        <button type="button" onClick={onStop} aria-label="Stop watching the line" style={{ background: "none", border: "none", color: "#F3EEE1", fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", opacity: .8, cursor: "pointer", padding: "4px 0" }}>Stop</button>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1 }}>{miles(live.km)} <span style={{ fontSize: 17 }}>mi</span></div>
        <div style={{ fontSize: 13.5, opacity: .9 }}>to the <em style={{ fontFamily: SERIF, fontStyle: "italic", color: GOLD, fontSize: 17 }}>{live.name}</em> line</div>
      </div>
      <div style={{ position: "relative", height: 5, borderRadius: 999, background: "rgba(243,238,225,.18)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, background: GOLD, transition: "width 600ms ease-out" }} />
      </div>
    </div>
  );
}
export function SlamOverlay({ slam, style = undefined }) {
  return (
    <div aria-live="polite" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center", pointerEvents: "none", background: "rgba(22,17,13,.18)", ...style }}>
      <style>{"@keyframes gs-line-slam { 0% { opacity: 0; transform: scale(1.9) rotate(-12deg); } 55% { opacity: 1; transform: scale(.96) rotate(-6deg); } 75% { transform: scale(1.03) rotate(-6deg); } 100% { opacity: 1; transform: scale(1) rotate(-6deg); } }"}</style>
      <div style={{ animation: "gs-line-slam 360ms cubic-bezier(.2,.9,.3,1.15) both", filter: "drop-shadow(0 14px 22px rgba(0,0,0,.35))", background: "#FBF6EC", padding: 10, borderRadius: 14 }}>
        <LandStamp template="state" name={slam.name} sub={slam.nickname} date={slam.date || new Date().toISOString().slice(0, 10)} direction="arrival" ink={slam.ink} post={slam.post} width={290} />
      </div>
    </div>
  );
}

export default function LineAhead() {
  const { currentGpsLocation } = useLocation();
  const { isAuthenticated } = useAuth();
  const [offer, setOffer] = useState(null);     // { into, from, name, km, road }
  const [live, setLive] = useState(null);       // { into, from, name, km, startKm, road }
  const [slam, setSlam] = useState(null);       // { name, abbr, post, ink, nickname }
  const [dismissed, setDismissed] = useState(null);   // the state an offer was closed for
  const lastFix = useRef(null);                 // { lat, lng, at }
  const stopRef = useRef(null);
  const audioRef = useRef(null);
  const trail = useRef([]);                     // the last readings while watching, for the heading

  // ── The offer: two live fixes apart, a line ahead along their bearing ──────────────────────────
  useEffect(() => {
    (async () => {
      if (!isAuthenticated || !suggestionsOn() || live || slam) return;
      const g = currentGpsLocation;
      if (!isLiveFix(g)) return;
      const c = g.coordinates;
      if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
      const now = { lat: c.latitude, lng: c.longitude, at: Number(g.fixedAt) || Date.now() };
      const prev = lastFix.current;
      lastFix.current = now;
      if (!prev || now.at - prev.at > MOVING_MIN * 60000 || kmBetween(prev.lat, prev.lng, now.lat, now.lng) < MOVING_KM) return;
      const S = await loadStates().catch(() => null);
      if (!S) return;
      const ahead = lineAhead(S, now.lat, now.lng, bearing(prev.lat, prev.lng, now.lat, now.lng), OFFER_KM);
      if (!ahead || !ahead.into || ahead.into === dismissed) { setOffer(null); return; }
      const port = portFor(ahead.from, ahead.into, ahead.lat, ahead.lng, 15);
      setOffer({ into: ahead.into, from: ahead.from, name: stateName(S, ahead.into), km: ahead.km, road: port?.road || null });
    })();
  }, [currentGpsLocation, isAuthenticated, live, slam, dismissed]);

  // ── Watching: GPS once a second while the strip shows ──────────────────────────────────────────
  const stop = () => { if (stopRef.current) { stopRef.current(); stopRef.current = null; } trail.current = []; setLive(null); };
  useEffect(() => () => { if (stopRef.current) stopRef.current(); }, []);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState !== "visible") stop(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const watch = async () => {
    if (!offer) return;
    try { audioRef.current = audioRef.current || new (window.AudioContext || window.webkitAudioContext)(); } catch { audioRef.current = null; }
    const S = await loadStates().catch(() => null);
    if (!S) return;
    const o = offer;
    setOffer(null);
    setLive({ into: o.into, from: o.from, name: o.name, km: o.km, startKm: o.km, road: o.road });
    const started = Date.now();
    let crossed = false;
    stopRef.current = await startWatch((pos) => {
      if (crossed) return;
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const t = trail.current;
      t.push({ lat, lng, at: Date.now() });
      if (t.length > 6) t.shift();
      const here = stateAt(S, lat, lng);
      if (here && here !== o.from) {
        // The line: caught to the metre, named by its port, the window opened behind the slam.
        crossed = true;
        const name = stateName(S, here);
        const info = regionInfo("US", name);
        const port = portFor(o.from, here, lat, lng, 25);
        const post = postLabel(port, here);
        const spot = { at: Date.now(), lat: rough(lat), lng: rough(lng), near: port?.near?.[here] || null };
        const ink = pickInk();
        buzz(); if (audioRef.current) thump(audioRef.current);
        setSlam({ name, abbr: here, post, ink, nickname: info?.nickname || null });
        setBaseline({ cc: "US", region: name, lat, lng, at: spot.at, near: spot.near });
        setTimeout(() => {
          if (info) openWindow({ kind: "region", key: `region:US-${info.abbr}`, cc: "US", country: "United States", region: name, name, info, firstSeen: spot, crossing: spot, modeGuess: "car", post, ink });
          setSlam(null);
          stop();
        }, 2400);
        return;
      }
      // The count: along the heading of the last few readings.
      const head = t.length >= 2 ? bearing(t[0].lat, t[0].lng, lat, lng) : null;
      const ahead = head != null ? lineAhead(S, lat, lng, head, OFFER_KM + 40) : null;
      setLive((l) => (l ? { ...l, km: ahead && ahead.into === o.into ? ahead.km : l.km, name: ahead && ahead.into && ahead.into !== o.into ? stateName(S, ahead.into) : l.name } : l));
      if (Date.now() - started > 2 * 3600 * 1000) stop();
    }, () => { /* a reading failed: keep the last count */ });
  };

  if (slam) return <SlamOverlay slam={slam} />;
  if (live) return <LiveStrip live={live} onStop={stop} />;
  if (offer) return <OfferTile offer={offer} onWatch={watch} onClose={() => { setDismissed(offer.into); setOffer(null); }} />;
  return null;
}
