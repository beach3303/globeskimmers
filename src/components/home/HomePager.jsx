// HomePager — Home as six pages (founder's decision sheet, 2026-10-25: "Six pages, two rows of tabs",
// "tabs should be tappable and pages should be swipeable"): two rows of folder tabs in the Home tabs'
// airmail blue — Nearby · Stamps · Virtual Passport / Arrivals · City Board · City Cards (which took
// My Profile's tab on 2026-10-28: the Profile has its own button in the bottom bar) — that stay
// stuck under the app banner, and the pages under them. A tap on a tab opens its page; a sideways
// swipe slides to the page beside it, in reading order. A page mounts the first time it's opened and
// stays mounted (its state kept); one not opened yet slides in as a quiet placeholder.
//
// A swipe that starts on something that scrolls sideways itself (a stamp row) or keeps its own swipes
// (an open passport book, data-swipe-own) is left to it. At rest only the page on show is laid out,
// with no transform, so its sheets (position: fixed) sit where they should; the slide uses transforms
// only while a finger is down and for the 0.3 s after.
//
// When the lobby has scrolled away, a slim "📍 Los Angeles · Change" line joins the stuck tabs, so
// changing the location is never more than a tap away (founder: "i don't ever want to lose the
// ability to change locations").
//
//   <HomePager page onPage render location />
//   page      a HOME_PAGES id; onPage(id) on a tap or a swipe
//   render    (id) => the page's content
//   location  { label, onChange } for the slim location line
import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { HOME_TAB } from "@/components/redesign/Zone";
import { NEUTRAL, fs } from "@/components/redesign/constants";

// A `link` tab (Virtual Passport, founder 2026-10-30: "direct the user to the same page where
// user goes when they click the virtual passport from the bottom navigation bar") looks like the
// others but opens a page of its own, full screen: onPage(id) fires, Home navigates, and no page
// sits under it here — a swipe passes over it.
export const HOME_PAGES = [
  { id: "nearby", label: "Nearby" },
  { id: "stamps", label: "Stamps" },
  { id: "passport", label: "Virtual Passport", link: true },
  { id: "arrivals", label: "Arrivals" },
  { id: "cityboard", label: "City Board" },
  { id: "citycards", label: "City Cards" },
];
const KEY = "gs_home_page_v1";
const BLUE = NEUTRAL.airmailBlue;
const STICK = "calc(50px + env(safe-area-inset-top))";
const SLIDE_MS = 300;
const isPage = (id) => HOME_PAGES.some((p) => p.id === id && !p.link);

// The page to open on: the one asked for, else the one used last, else Stamps for a new member
// (founder's decision sheet: "Which page should a brand-new member see first? Stamps").
export function initialHomePage(asked) {
  if (isPage(asked)) return asked;
  try { const v = localStorage.getItem(KEY); if (isPage(v)) return v; } catch { /* storage off */ }
  return "stamps";
}
export function rememberHomePage(id) {
  try { localStorage.setItem(KEY, id); } catch { /* storage off */ }
}

// Does this touch belong to something that scrolls sideways or keeps its own swipes?
function ownsSwipe(target, root) {
  for (let el = target; el && el !== root && el.nodeType === 1; el = el.parentElement) {
    if (el.hasAttribute("data-swipe-own")) return true;
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}

function Placeholder({ label }) {
  return (
    <div style={{ padding: "18px 16px 0" }}>
      <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: fs(24), color: NEUTRAL.ink3 }}>{label}</div>
      <div aria-hidden="true" style={{ height: 140, marginTop: 12, borderRadius: 18, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.rule}` }} />
      <div aria-hidden="true" style={{ height: 220, marginTop: 12, borderRadius: 18, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.rule}` }} />
    </div>
  );
}

export default function HomePager({ page, onPage, render, location = null }) {
  const idx = Math.max(0, HOME_PAGES.findIndex((p) => p.id === page));
  const [mounted, setMounted] = useState(() => new Set([idx]));
  useEffect(() => { setMounted((s) => (s.has(idx) ? s : new Set([...s, idx]))); }, [idx]);

  // The slide: dx while a finger is down; then { to, dx } while it settles.
  const [drag, setDrag] = useState(null);       // { dx, n } — n: the neighbor sliding in (idx ± 1)
  const [settle, setSettle] = useState(null);   // { n, commit }
  const touch = useRef(null);
  const dxRef = useRef(0);
  const areaRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const tabsRef = useRef(/** @type {HTMLDivElement|null} */ (null));

  // The slim location line once the lobby is out of sight (the sentinel sits just above the tabs).
  const sentinel = useRef(/** @type {HTMLDivElement|null} */ (null));
  const [lobbyGone, setLobbyGone] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setLobbyGone(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: "-60px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // A new page starts at its top when you were further down.
  const toTop = () => {
    const area = areaRef.current;
    const tabs = tabsRef.current;
    if (!area || !tabs) return;
    const gap = area.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom;
    if (gap < 0) window.scrollTo(0, window.scrollY + gap);
  };
  const open = (i) => {
    const n = Math.max(0, Math.min(HOME_PAGES.length - 1, i));
    if (HOME_PAGES[n].link) { onPage(HOME_PAGES[n].id); return; }   // its own page; Home navigates
    if (n === idx) return;
    onPage(HOME_PAGES[n].id);
    requestAnimationFrame(toTop);
  };
  // The page beside this one in a swipe, passing over a link tab.
  const beside = (dir) => {
    let n = idx + dir;
    while (n >= 0 && n < HOME_PAGES.length && HOME_PAGES[n].link) n += dir;
    return n;
  };

  const onTouchStart = (e) => {
    if (settle || e.touches.length !== 1 || ownsSwipe(e.target, areaRef.current)) { touch.current = null; return; }
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, at: Date.now(), lock: null };
    dxRef.current = 0;
  };
  const onTouchMove = (e) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    }
    if (s.lock !== "x") return;
    const n = beside(dx < 0 ? 1 : -1);
    const edge = n < 0 || n >= HOME_PAGES.length;
    const v = edge ? dx / 3 : dx;     // a little give at either end
    dxRef.current = v;
    setDrag({ dx: v, n: edge ? null : n });
  };
  const onTouchEnd = () => {
    const s = touch.current;
    touch.current = null;
    if (!s || s.lock !== "x" || !drag) { setDrag(null); return; }
    const w = areaRef.current?.offsetWidth || 1;
    const dx = dxRef.current;
    const fast = Math.abs(dx) > 40 && Date.now() - s.at < 260;
    const commit = drag.n != null && (Math.abs(dx) > w * 0.22 || fast);
    setSettle({ n: drag.n, commit, dx });
    setDrag(null);
    setTimeout(() => {
      setSettle(null);
      if (commit) open(drag.n);
    }, SLIDE_MS);
  };

  // Where each page sits: at rest, only the page on show, in the flow; sliding, the page on show and
  // the neighbor coming in (absolutely placed beside it), both moved by transforms.
  const sliding = drag || settle;
  const n = drag ? drag.n : settle ? settle.n : null;
  const side = n == null ? 0 : n > idx ? 1 : -1;
  let offset = 0;                 // px for the page on show
  let anim = false;
  if (drag) offset = drag.dx;
  else if (settle) { anim = true; offset = settle.commit ? -side * 100 : 0; }
  const unit = settle && settle.commit ? "%" : "px";
  const pos = (i) => {
    if (!sliding) return i === idx ? { display: "block" } : { display: "none" };
    if (i === idx) return { display: "block", transform: `translateX(${offset}${unit})`, transition: anim ? `transform ${SLIDE_MS}ms cubic-bezier(.2,.8,.2,1)` : "none" };
    if (i === n) {
      const base = side * 100;
      const t = settle ? (settle.commit ? "translateX(0%)" : `translateX(${base}%)`) : `translateX(calc(${base}% + ${offset}px))`;
      return { display: "block", position: "absolute", top: 0, left: 0, width: "100%", transform: t, transition: anim ? `transform ${SLIDE_MS}ms cubic-bezier(.2,.8,.2,1)` : "none" };
    }
    return { display: "none" };
  };

  const rows = [HOME_PAGES.slice(0, 3), HOME_PAGES.slice(3)];
  return (
    <div>
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
      <div ref={tabsRef} style={{ position: "sticky", top: STICK, zIndex: 30, background: NEUTRAL.ivory, padding: "6px 16px 0" }}>
        {lobbyGone && location ? (
          <button type="button" onClick={location.onChange}
            style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 30, margin: "0 0 4px", padding: "0 2px", border: 0, background: "transparent", font: "inherit", fontSize: fs(12.5), color: NEUTRAL.ink2, cursor: "pointer" }}>
            <MapPin size={14} strokeWidth={2} color={NEUTRAL.brandTeal} aria-hidden="true" focusable="false" />
            <b style={{ fontWeight: 650, color: NEUTRAL.ink }}>{location.label}</b>
            <span style={{ color: NEUTRAL.brandTeal, fontWeight: 650, textDecoration: "underline", textUnderlineOffset: 2 }}>Change</span>
          </button>
        ) : null}
        <div role="tablist" aria-label="Home" style={{ display: "flex", flexDirection: "column", gap: 3, borderBottom: `2px solid ${BLUE}` }}>
          {rows.map((row, r) => (
            <div key={r} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, ...(r === 0 ? { paddingBottom: 3, borderBottom: `1px solid ${NEUTRAL.airmailLine}` } : {}) }}>
              {row.map((p) => {
                const on = p.id === page;
                return (
                  <button key={p.id} type="button" role="tab" id={`home-tab-${p.id}`} aria-selected={on} aria-controls={`home-panel-${p.id}`}
                    onClick={() => open(HOME_PAGES.indexOf(p))}
                    style={{
                      minWidth: 0, minHeight: 38, padding: "0 4px", borderRadius: "10px 10px 0 0", font: "inherit", fontSize: fs(12.5), fontWeight: on ? 700 : 600,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer",
                      ...(on ? HOME_TAB : { background: NEUTRAL.airmailHair, color: BLUE, border: "1px solid transparent", borderBottom: 0 }),
                    }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div ref={areaRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        style={{ position: "relative", overflow: sliding ? "hidden" : "visible", touchAction: "pan-y" }}>
        {HOME_PAGES.map((p, i) => (
          <div key={p.id} role="tabpanel" id={`home-panel-${p.id}`} aria-labelledby={`home-tab-${p.id}`} aria-hidden={i !== idx || undefined} style={pos(i)}>
            {p.link ? null : mounted.has(i) ? render(p.id) : <Placeholder label={p.label} />}
          </div>
        ))}
      </div>
    </div>
  );
}
