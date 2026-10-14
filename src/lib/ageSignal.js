// The phone's own age answer (teens plan Phase 0; Apple has required it for new Texas accounts
// since 2026-06-04), the JS side of AgeRangePlugin.swift (iOS). The app asks only where Apple
// says the age laws apply to this person (status().eligible): Apple's sheet, at most once a
// month, and a week's pause after a decline. The answer goes to the worker (POST /social/age
// { os }), which keeps only the tier it implies and caps the birthday's with it; the birthday
// is still asked. The App Store download id goes once per download ({ app_transaction }), so a
// parent's withdrawn consent (RESCIND_CONSENT) finds the account. On Android, AgeSignalsPlugin
// asks Google's Play Age Signals silently: bounds come only where Google has a signal (Texas,
// Brazil…), so no signal is looked for again weekly. Nothing here throws, and nothing runs on
// the web.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { callWorker } from "@/lib/callWorker";

const ASKED_KEY = "gs_os_age_v1"; // { at, declined, none }: when this phone last asked, and how it went
const TXN_KEY = "gs_app_txn_v1";  // the download id already sent
const MONTH = 30 * 86400000;
const WEEK = 7 * 86400000;

let plugin = null;
function ageRange() {
  if (plugin) return plugin;
  try { plugin = registerPlugin("AgeRange"); } catch { plugin = null; }
  return plugin;
}
let playPlugin = null;
function ageSignals() {
  if (playPlugin) return playPlugin;
  try { playPlugin = registerPlugin("AgeSignals"); } catch { playPlugin = null; }
  return playPlugin;
}
const onIos = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
const onAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };
// The answer, or null after ms or on a rejection (a build without the plugin); the timer goes
// with the answer, so no 2-minute wait lingers.
const within = (ms, p) => new Promise((res) => {
  const t = setTimeout(() => res(null), ms);
  Promise.resolve(p).then((v) => { clearTimeout(t); res(v); }, () => { clearTimeout(t); res(null); });
});

// { available, eligible, features, ageRatingCode } from the plugin, or null off iOS.
export async function osAgeStatus() {
  if (!onIos()) return null;
  try { return await within(8000, ageRange().status()); } catch { return null; }
}

// Asks the phone for the age range (Apple where the laws apply here; Play on Android) and tells
// the worker. The worker's answer ({ tier, os_tier }) when one was sent, else null. force skips
// the pause.
export async function syncOsAge({ force = false } = {}) {
  const platform = onIos() ? "ios" : onAndroid() ? "android" : null;
  if (!platform) return null;
  const last = read(ASKED_KEY);
  const now = Date.now();
  if (!force && last?.at && now - last.at < (last.declined || last.none ? WEEK : MONTH)) return null;
  let r = null;
  if (platform === "ios") {
    const st = await osAgeStatus();
    if (!st?.available || st.eligible !== true) return null;
    // Apple's sheet waits for the person, so this waits too (the old 4 s race lost real answers).
    try { r = await within(120000, ageRange().request()); } catch { r = null; }
    if (!r || r.available === false) return null;
    if (r.declined) { write(ASKED_KEY, { at: now, declined: true }); return null; }
  } else {
    // A build without the plugin rejects the call: nothing is remembered, so the first build
    // that has it asks at once. Only Play's own answer of no signal waits a week.
    try { r = await within(15000, ageSignals().check()); } catch { return null; }
    if (!r) return null;
    if (!r.available || (r.lower == null && r.upper == null)) { write(ASKED_KEY, { at: now, none: true }); return null; }
  }
  const { data, error } = await callWorker("social/age", { os: { platform, lower: r.lower ?? null, upper: r.upper ?? null } });
  if (error || !data || data.error) return null;
  write(ASKED_KEY, { at: now, declined: false });
  return data;
}

// Sends this phone's App Store download id, once per download. true when it was sent.
export async function syncAppTransaction() {
  if (!onIos()) return false;
  try {
    const t = await within(10000, ageRange().appTransaction());
    if (!t?.available || !t.id || read(TXN_KEY) === t.id) return false;
    const { data, error } = await callWorker("social/age", { app_transaction: { id: t.id, environment: t.environment || null } });
    if (error || !data?.ok) return false;
    write(TXN_KEY, t.id);
    return true;
  } catch { return false; }
}
