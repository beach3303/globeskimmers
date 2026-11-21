// Remote switches (founder, 2026-11-20): the worker's GET /flags returns a small JSON the founder
// writes to KV by hand — `flags:v1` — so a door can be opened or closed for everyone without an OTA.
//
//   npx wrangler kv key put --binding=GLOBESKIMMERS_KV flags:v1 '{"stay_category":false}'
//
// The app reads it once per launch (and keeps the last answer in localStorage), so a phone that
// is offline keeps yesterday's switches. Unknown or missing flags fall back to the defaults below;
// a flag listed here is the whole contract — add a line when you add a switch.
//
//   import { useFlag } from "@/lib/remoteFlags";
//   const placePage = useFlag("place_page");          // true unless the founder turns it off
//
// Compile-time product switches that never change at runtime stay in src/lib/flags.js.
import { useEffect, useState } from "react";
import { WORKER_BASE } from "@/lib/callWorker";

export const FLAG_DEFAULTS = {
  place_page: true,       // a stamp opens its place page (2026-11-20); false = the old options sheet
  stay_category: true,    // the "Where I'm staying" door and the Stay category on City Cards
};

const KEY = "gs_flags_v1";
let flags = { ...FLAG_DEFAULTS };
let loaded = false;
let loading = null;
const listeners = new Set();

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved && typeof saved === "object") flags = { ...FLAG_DEFAULTS, ...saved };
} catch { /* storage unavailable: defaults */ }

const emit = () => { for (const fn of listeners) { try { fn(flags); } catch { /* a dead listener */ } } };

// Fetch the switches once per launch; a failure keeps what we had.
export function loadFlags() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
      const res = await fetch(`${WORKER_BASE}/flags`, { method: "GET", signal: ctrl ? ctrl.signal : undefined });
      if (timer) clearTimeout(timer);
      const j = res.ok ? await res.json() : null;
      if (j && j.flags && typeof j.flags === "object") {
        flags = { ...FLAG_DEFAULTS, ...j.flags };
        try { localStorage.setItem(KEY, JSON.stringify(j.flags)); } catch { /* fine */ }
        emit();
      }
    } catch { /* offline or slow: keep the last answer */ }
    loaded = true;
    return flags;
  })();
  return loading;
}

export const getFlag = (name) => (name in flags ? flags[name] : FLAG_DEFAULTS[name]);
export const flagsLoaded = () => loaded;

export function useFlag(name) {
  const [value, setValue] = useState(() => getFlag(name));
  useEffect(() => {
    const fn = () => setValue(getFlag(name));
    listeners.add(fn);
    loadFlags().then(fn, fn);
    return () => { listeners.delete(fn); };
  }, [name]);
  return value;
}
