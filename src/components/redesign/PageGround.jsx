import React, { createContext, useContext, useId, useLayoutEffect, useMemo, useState } from 'react';
import { IVORY } from './constants';

// The page ground: the paper a page is printed on, painted all the way down (under the
// content, on <body> for iOS overscroll, behind the 12px mat under the banner). Layout
// owns the paint; a page only says which colour it wants.
//
//   <PageGroundProvider fallback={color}>  Layout. fallback is the page's default ground
//                                          (its WORLD paper, airmail, Harbour paper, ivory).
//   usePageGround(color, { ink })          A page (or anything it renders) overrides the
//                                          ground while it is mounted; the override is
//                                          cleared on unmount. ink is optional: the colour
//                                          of the shared chrome over the page (Back-to-top),
//                                          e.g. the owner's cloth on Circle. A null or empty
//                                          color sets no ground, so a page can call this
//                                          before its data loads and keep the default.
//   usePageGroundValue()                   The ground in force: the override, else the
//                                          page default, else ivory. A colour string.
//   usePageInk()                           The chrome ink a page set, or null.
//
// Overrides and their clean-up run in layout effects, so a page's ground and the next
// page's default never show for a frame on the wrong page. When several mounted
// components set a ground, the most recent one wins; each one clears only its own.

const GroundApi = createContext(null);
const GroundValue = createContext({ ground: IVORY, ink: null });

const asColor = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function PageGroundProvider({ fallback, children }) {
  // Overrides from mounted components, oldest first: [{ id, ground, ink }].
  const [stack, setStack] = useState([]);

  const api = useMemo(() => ({
    set(id, ground, ink) {
      setStack((prev) => {
        const i = prev.findIndex((e) => e.id === id);
        if (i !== -1 && prev[i].ground === ground && prev[i].ink === ink) return prev;
        return [...prev.filter((e) => e.id !== id), { id, ground, ink }];
      });
    },
    clear(id) {
      setStack((prev) => (prev.some((e) => e.id === id) ? prev.filter((e) => e.id !== id) : prev));
    },
  }), []);

  // The latest override that names a ground (and, separately, an ink) wins.
  let ground = null;
  let ink = null;
  for (let i = stack.length - 1; i >= 0 && (!ground || !ink); i -= 1) {
    if (!ground && stack[i].ground) ground = stack[i].ground;
    if (!ink && stack[i].ink) ink = stack[i].ink;
  }
  const effective = ground || asColor(fallback) || IVORY;
  const value = useMemo(() => ({ ground: effective, ink }), [effective, ink]);

  return (
    <GroundApi.Provider value={api}>
      <GroundValue.Provider value={value}>{children}</GroundValue.Provider>
    </GroundApi.Provider>
  );
}

export function usePageGround(color, options) {
  const api = useContext(GroundApi);
  const id = useId();
  const ground = asColor(color);
  const ink = asColor(options && options.ink);
  useLayoutEffect(() => {
    // Outside a provider (a page rendered on its own) there is nothing to paint.
    if (!api || (!ground && !ink)) return undefined;
    api.set(id, ground, ink);
    return () => api.clear(id);
  }, [api, id, ground, ink]);
}

export function usePageGroundValue() {
  return useContext(GroundValue).ground;
}

export function usePageInk() {
  return useContext(GroundValue).ink;
}
