// useDwell — whole-surface dwell timing, reported as ONE analytics event.
//
// HONEST SEMANTICS: this measures FOREGROUND TIME, not attention. The clock
// runs while the component is mounted and the document is visible; it pauses
// while document.hidden (tab switch, app backgrounded) and resumes on return.
// It does NOT know whether the surface was scrolled into view (v1 has no
// IntersectionObserver — whole-surface dwell only) or whether the user was
// actually looking at it. Treat `ms` as an upper bound on attention.
//
// Reporting: exactly once per mounted session, on the earlier of pagehide or
// unmount, via logDiscover('dwell', { surface, ms, ...meta }) — and only when
// the accumulated foreground time is >= minMs (default 2s: drive-by bounces
// are noise, not dwell). `ms` is clamped to maxMs (default 10 min) so a tab
// left open overnight can't skew averages. Timing uses performance.now()
// (monotonic — immune to wall-clock jumps) with a Date.now() fallback.
//
// `meta` is re-read at report time (latest render wins), so derived values
// like { dest: dest?.name || null } capture what the user ended the session
// on, not what the page mounted with. minMs/maxMs are fixed when the timer
// starts. logDiscover attaches the standard coarse context
// (city/country/intent/persona); explicit meta keys win over it.
//
// Teardown is clean: no intervals — just two listeners (visibilitychange,
// pagehide), both removed on unmount.
//
// Usage:
//   useDwell('smart_packages', { dest: dest?.name || null });

import { useEffect, useRef } from 'react';
import { logDiscover } from '@/lib/logDiscover';
import { flushEvents } from '@/lib/analytics';

/**
 * Report foreground dwell time on a surface as a single 'dwell' event.
 *
 * @param {string} surface — stable surface id, e.g. 'smart_packages'. Falsy → hook does nothing.
 * @param {object} [meta] — extra payload fields (names/ids only — no PII); latest render's value is what gets reported.
 * @param {object} [opts]
 * @param {number} [opts.minMs=2000] — sessions shorter than this are dropped, not reported.
 * @param {number} [opts.maxMs=600000] — reported ms is clamped to this ceiling (10 min).
 */
export function useDwell(surface, meta = {}, { minMs = 2000, maxMs = 600000 } = {}) {
  // Ref-carried meta: callers pass a fresh object literal every render; the
  // effect below must NOT re-run for that (it would split one session into
  // many), so the effect reads this ref at report time instead.
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    if (!surface || typeof document === 'undefined' || typeof window === 'undefined') return;

    const now = () =>
      (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();

    let accum = 0; // ms accumulated across completed visible stretches
    let startedAt = document.hidden ? null : now(); // open visible stretch, or null while hidden
    let reported = false;

    const onVisibility = () => {
      if (document.hidden) {
        if (startedAt != null) { accum += now() - startedAt; startedAt = null; }
      } else if (startedAt == null) {
        startedAt = now();
      }
    };

    const report = () => {
      if (reported) return; // once per session — pagehide then unmount reports a single event
      reported = true;
      let total = accum;
      if (startedAt != null) { total += now() - startedAt; startedAt = null; }
      const ms = Math.min(Math.round(total), maxMs);
      if (ms >= minMs) {
        logDiscover('dwell', { surface, ms, ...metaRef.current });
        // Force-flush: on real unload the analytics module's own pagehide flush
        // has ALREADY run before this report queues, and the 200ms batch timer
        // never fires during teardown — without this, the tab-close dwell (the
        // one this hook exists for) is silently dropped. keepalive survives it.
        try { flushEvents(); } catch { /* non-fatal */ }
      }
    };

    const onPageHide = () => report();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      report();
    };
    // Deps: [surface] on purpose (NOT exhaustive) — minMs/maxMs are fixed for
    // the life of a session and meta arrives via metaRef, so only a surface
    // change ends one session and starts another.
  }, [surface]);
}

export default useDwell;
