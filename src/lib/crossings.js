// Border grace (founder, 2026-11-03: she drove I-10 into Arizona, reopened the app again and again past
// the welcome sign, and never got the crossing prompt; 2026-11-05: "i do want the 48 hour window plan").
// A crossing is a WINDOW, not a line. The one hard rule stays — the app must have seen you inside the new
// state, country or airport — and nothing is stamped until you tap. Everything else is grace:
//
//   baseline  — the last CONFIRMED place the app saw you { cc, region, lat, lng, at, near }, any age. It
//               moves the moment a new region is confirmed, never because a window closed.
//   windows   — pending offers. Each opens when a live fix is confirmed somewhere new (or inside an
//               airport fence) and stays for 48 hours: offered as a sheet on every open, listed on the
//               passport page, stamped from anywhere inside, dated the day the app first saw you there.
//               Crossings queue (CA → AZ → NM in a day keeps two).
//
// Kept on the phone (localStorage); the stamp itself goes to the worker only when tapped.
import { useEffect, useState } from "react";
import { pickInk } from "@/lib/stampInks";

// The one line every sensed card carries (founder, 2026-11-06: "short and sweet … tell them their location is
// private and the app only wants to offer the opportunity to get a stamp … make words matter").
export const PRIVACY_LINE = "Your location stays on your phone. We only ask so you never miss a stamp.";
// One switch for every suggestion — crossings, airports, flights. The two older keys still count as "off"
// (Settings wrote them until 2026-11-06), and the switch writes all three so older bundles agree.
const SWITCH_KEYS = ["pp_suggest_stamps", "pp_city_prompt", "pp_suggest_arrivals"];
export const suggestionsOn = () => { try { return SWITCH_KEYS.every((k) => localStorage.getItem(k) !== "0"); } catch { return true; } };
export const setSuggestions = (on) => { try { for (const k of SWITCH_KEYS) localStorage.setItem(k, on ? "1" : "0"); } catch { /* ignore */ } };

const KEY = "pp_crossings_v1";
const LEGACY_BASE = "pp_live_region_v2";   // BorderCrossingPrompt's old baseline; AirportArrivalPrompt still reads it
export const WINDOW_MS = 48 * 3600 * 1000;
const EVENT = "crossings:changed";

const empty = () => ({ baseline: null, windows: [] });
function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v === "object" && Array.isArray(v.windows) ? v : empty();
  } catch { return empty(); }
}
function write(s) {
  const now = Date.now();
  s.windows = s.windows.filter((w) => w && Number(w.expiresAt) > now);   // expired ones leave, closed ones stay until they expire (so they never reopen)
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* ignore */ }
}

export function baseline() {
  const s = read();
  if (s.baseline?.cc) return s.baseline;
  try { const old = JSON.parse(localStorage.getItem(LEGACY_BASE) || "null"); if (old?.cc) return old; } catch { /* ignore */ }
  return null;
}
export function setBaseline(fix) {
  const s = read();
  s.baseline = fix;
  write(s);
  try { localStorage.setItem(LEGACY_BASE, JSON.stringify(fix)); } catch { /* ignore */ }
}

// The open windows, oldest first.
export function windows() {
  const now = Date.now();
  return read().windows.filter((w) => w.status === "open" && Number(w.expiresAt) > now).sort((a, b) => (a.firstSeen?.at || 0) - (b.firstSeen?.at || 0));
}
export const windowById = (id) => read().windows.find((w) => w.id === id) || null;

// Open a window, unless one with this key is already open (then the caught crossing, if new, joins it)
// or was closed — stamped or declined — within its 48 hours (then nothing reopens). Returns the window
// or null.
export function openWindow(w) {
  const s = read();
  const now = Date.now();
  const same = s.windows.find((x) => x.key === w.key && Number(x.expiresAt) > now);
  if (same) {
    if (same.status !== "open") return null;
    if (w.crossing && !same.crossing) { same.crossing = w.crossing; write(s); }
    return same;
  }
  const at = w.firstSeen?.at || now;
  const win = { ...w, id: `${w.key}:${at.toString(36)}`, status: "open", ink: pickInk(), openedAt: now, expiresAt: at + WINDOW_MS };
  s.windows.push(win);
  write(s);
  return win;
}
export function closeWindow(id, as = "declined") {
  const s = read();
  const w = s.windows.find((x) => x.id === id);
  if (w) { w.status = "closed"; w.closedAs = as; w.closedAt = Date.now(); }
  write(s);
}
export const hoursLeft = (w) => Math.max(0, Math.ceil((Number(w?.expiresAt || 0) - Date.now()) / 3.6e6));

// "Later": this app run leaves the window alone until the next open (the passport card still shows it).
const deferred = new Set();
export const deferWindow = (id) => { deferred.add(id); try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* ignore */ } };
export const undefer = (id) => { deferred.delete(id); };
export const isDeferred = (id) => deferred.has(id);

// The passport card's "Stamp it" asks the sheet to show one window now, deferred or not.
export const OPEN_EVENT = "crossings:open";
export const askToStamp = (id) => { undefer(id); try { window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id } })); } catch { /* ignore */ } };

// The open windows as React state: re-read on every change and once a minute (the hours left).
export function useCrossings() {
  const [list, setList] = useState(() => windows());
  useEffect(() => {
    const tick = () => setList(windows());
    window.addEventListener(EVENT, tick);
    const t = setInterval(tick, 60 * 1000);
    return () => { window.removeEventListener(EVENT, tick); clearInterval(t); };
  }, []);
  return list;
}

// "Tue 3 PM" — when a window closes, in the traveler's own words.
export function untilLabel(w) {
  const d = new Date(Number(w?.expiresAt || 0));
  if (isNaN(d)) return "";
  return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}
// "3 Nov, 3:05 PM"
export function seenLabel(at) {
  const d = new Date(Number(at || 0));
  if (isNaN(d)) return "";
  return d.toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
