// cloudSync.js — syncs the Wishlist + Saved places to the signed-in user's
// account (Supabase, via the Worker's /saves/pull + /saves/push).
//
// Design: localStorage stays the INSTANT source of truth (works offline + signed
// out, zero latency). On sign-in we pull the cloud copy, MERGE it with local (so
// nothing is lost across devices or a reinstall), write the union back locally,
// and push the union up. Every later change debounce-pushes. This turns two
// localStorage-only lists into real switching cost — and feeds the demand lake.
// Passport already persists server-side, so it's not handled here.
//
// Side-effect module: `import '@/lib/cloudSync'` once (from Layout) to start it.
//
// A frozen account (under 13) syncs nothing (go-live round 3): the under-13
// clean-up deletes the cloud copy, and this module — which runs under the
// frozen screen too — used to merge the phone's copy back in and push it up.
// The worker now refuses a frozen account at /saves/pull and /saves/push
// (code under_age); hearing that, here or anywhere (AGE_GATE_EVENT), stops
// every pull and push until another account signs in. A pull that fails for
// any reason is skipped, never treated as an empty cloud copy (merging [] and
// pushing would have overwritten what other devices saved).
import { supabase } from "@/lib/supabaseClient";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getWishlist, replaceWishlist, CHANGE_EVENT as WISHLIST_EVENT } from "@/lib/wishlist";
import { getSavedLocations, replaceSavedLocations, SAVED_CHANGE_EVENT } from "@/lib/savedLocations";
import { AGE_GATE_EVENT } from "@/lib/ageGate";

const KINDS = {
  wishlist: {
    event: WISHLIST_EVENT,
    read: getWishlist,
    replace: replaceWishlist,
    keyOf: (it) => it.key || `${it.kind || ""}:${String(it.id || it.title || "").toLowerCase()}`,
  },
  places: {
    event: SAVED_CHANGE_EVENT,
    read: getSavedLocations,
    replace: replaceSavedLocations,
    keyOf: (it) => {
      const c = it && it.coordinates;
      if (c && typeof c.latitude === "number") return `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`;
      return String((it && (it.nickname || it.placeName || it.placeId)) || JSON.stringify(it));
    },
  },
};

let signedIn = false;
let frozen = false;              // the worker answered under_age for this account: sync nothing
let applying = false;            // true while writing merged cloud data locally (skip re-push)
const pushTimers = {};

async function push(kind) {
  if (!signedIn || frozen) return;
  try {
    const { data, error } = await callWorker(ROUTE.savesPush, { kind, data: KINDS[kind].read() });
    if (error && data?.code === "under_age") frozen = true;
  } catch { /* offline — local is safe; the next change retries */ }
}
function schedulePush(kind) {
  if (!signedIn || applying || frozen) return;
  clearTimeout(pushTimers[kind]);
  pushTimers[kind] = setTimeout(() => push(kind), 800);
}

// Union by stable key; a LOCAL item wins ties (their most recent edit on device).
function mergeByKey(cloud, local, keyOf) {
  const seen = new Map();
  for (const it of [...local, ...cloud]) {
    const k = keyOf(it);
    if (k && !seen.has(k)) seen.set(k, it);
  }
  return Array.from(seen.values());
}

async function pullMergeAll() {
  for (const kind of Object.keys(KINDS)) {
    if (frozen) return;
    const cfg = KINDS[kind];
    let cloud = [];
    try {
      const { data, error } = await callWorker(ROUTE.savesPull, { kind });
      if (error) { if (data?.code === "under_age") frozen = true; continue; }   // refused or failed: keep local, push nothing
      cloud = Array.isArray(data?.data) ? data.data : [];
    } catch { continue; }         // offline — keep local, retry on next sign-in
    const merged = mergeByKey(cloud, cfg.read(), cfg.keyOf);
    applying = true;
    try { cfg.replace(merged); } finally { applying = false; }
    push(kind);                   // write the union back to the cloud
  }
}

if (typeof window !== "undefined") {
  for (const kind of Object.keys(KINDS)) {
    window.addEventListener(KINDS[kind].event, () => schedulePush(kind));
  }
  // A frozen account, heard from any call (src/lib/ageGate.js).
  window.addEventListener(AGE_GATE_EVENT, (e) => { if (/** @type {CustomEvent} */ (e).detail?.code === "under_age") frozen = true; });
  try {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) { signedIn = true; pullMergeAll(); }
    }).catch(() => {});
    supabase.auth.onAuthStateChange((_e, session) => {
      const nowIn = !!session?.user;
      if (nowIn && !signedIn) { signedIn = true; frozen = false; pullMergeAll(); }  // fresh sign-in → merge
      else signedIn = nowIn;
    });
  } catch { /* analytics/sync must never break the app */ }
}
