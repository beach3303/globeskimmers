// Border Watch (founder, 2026-11-06: "include border watch with this build"; docs/plans/border-grace.md,
// phase 3). The 48-hour window needs the app to have SEEN you in the new state — and a closed app sees
// nothing. For a road trip the traveler can turn the watch on: the phone itself (BorderWatchPlugin on iOS,
// a foreground service on Android) checks which state or country it is in at a few points along the way,
// keeps only the last one and the crossings it noticed, shows one notification per line crossed, and is
// off by itself after 24 hours. Nothing leaves the phone: on the next open the app reads the crossings
// here (drain) and opens the same windows the live sensing would have.
//
//   available()        the plugin is here (a phone build with it)
//   status()           { on, until, permission: 'always' | 'whenInUse' | 'denied' | 'unknown', notifications }
//   start(hours) / stop()
//   drainCrossings()   the crossings the phone caught while the app was away → windows; returns how many
//   useBorderWatch()   the status as React state, refreshed on every return to the app
import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { openWindow, setBaseline, suggestionsOn } from "@/lib/crossings";
import { regionInfo } from "@/lib/stateNicknames";
import { portNearSegment, postLabel } from "@/lib/portsOfEntry";

let plugin = null;
try { plugin = registerPlugin("BorderWatch"); } catch { plugin = null; }

export const HOURS = 24;
export const available = () => !!plugin && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BorderWatch");
const OFF = { on: false, until: null, permission: "unavailable", notifications: false };
const norm = (s) => ({ on: !!s?.on, until: s?.on ? Number(s.until) || null : null, permission: s?.permission || "unknown", notifications: s?.notifications !== false });

export async function status() {
  if (!available()) return OFF;
  try { return norm(await plugin.status()); } catch { return { ...OFF, permission: "unknown" }; }
}
// Rejects with "location" when the phone's location is off for the app.
export async function start(hours = HOURS) {
  if (!available()) throw new Error("unavailable");
  return norm(await plugin.start({ hours }));
}
export async function stop() {
  if (!available()) return OFF;
  try { return norm(await plugin.stop()); } catch { return OFF; }
}
// "Fri 3:05 PM"
export const untilLabel = (ms) => {
  const d = new Date(Number(ms || 0));
  return isNaN(d) ? "" : d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
};

const rough = (v) => Math.round(v * 1000) / 1000;
const regionName = (cc) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; } catch { return cc; } };

// The crossings the phone caught while the app was away → the windows the live sensing would have opened
// (the same keys, so a crossing the app also saw itself never doubles). The baseline moves to the newest
// one, so the next live fix in the new state is not a crossing again. With suggestions off, the watch
// stops instead.
export async function drainCrossings() {
  if (!available()) return 0;
  if (!suggestionsOn()) { await stop(); return 0; }
  let list = [];
  try { list = (await plugin.drain())?.crossings || []; } catch { return 0; }
  let n = 0;
  for (const c of [...list].sort((a, b) => Number(a.at) - Number(b.at))) {
    const to = c.to || {}, from = c.from || {};
    const cc = String(to.cc || "").toUpperCase();
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!cc || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const at = Number(c.at) || Date.now();
    const spot = { at, lat: rough(lat), lng: rough(lng), near: null };
    const prev = Number.isFinite(Number(from.lat)) && Number.isFinite(Number(from.lng)) ? { lat: Number(from.lat), lng: Number(from.lng) } : null;
    // Both sides seen within the hour: the crossing itself (and its port of entry), not just "inside".
    const caught = !!prev && at - Number(from.at || 0) < 3.6e6;
    const base = { firstSeen: spot, crossing: caught ? spot : null, modeGuess: "car", cc, country: regionName(cc), watched: true };
    const fromCc = String(from.cc || "").toUpperCase();
    let opened = null;
    if (cc !== fromCc) {
      const post = caught && fromCc ? postLabel(portNearSegment(fromCc, cc, prev, spot), cc) : null;
      opened = openWindow({ ...base, kind: "country", key: `country:${cc}`, name: regionName(cc), post });
    } else {
      const info = regionInfo(cc, String(to.region || ""));
      const wasInfo = regionInfo(cc, String(from.region || ""));
      if (!info) continue;
      const post = caught && wasInfo ? postLabel(portNearSegment(wasInfo.abbr, info.abbr, prev, spot), info.abbr) : null;
      opened = openWindow({ ...base, kind: "region", key: `region:${cc}-${info.abbr}`, name: to.region, region: to.region, info, post });
    }
    if (opened) n++;
    setBaseline({ cc, region: String(to.region || ""), lat, lng, at, near: null });
  }
  return n;
}

export function useBorderWatch() {
  const [s, setS] = useState(() => ({ ...OFF, available: available() }));
  useEffect(() => {
    if (!available()) return undefined;
    let gone = false, handle = null;
    const load = () => status().then((x) => { if (!gone) setS((p) => ({ ...p, ...x })); }).catch(() => {});
    load();
    App.addListener("appStateChange", ({ isActive }) => { if (isActive) load(); }).then((h) => { handle = h; }).catch(() => {});
    return () => { gone = true; try { handle?.remove?.(); } catch { /* ignore */ } };
  }, []);
  const turnOn = async (hours = HOURS) => { const x = await start(hours); setS((p) => ({ ...p, ...x })); return x; };
  const turnOff = async () => { const x = await stop(); setS((p) => ({ ...p, ...x })); return x; };
  return { ...s, turnOn, turnOff };
}
