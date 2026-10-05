import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import html2canvas from "html2canvas";
import { ChevronLeft, ChevronRight, X, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { showToast } from "@/components/Toast";
import { logEvent } from "@/lib/analytics";
import { SHARE_TARGETS, targetById, shareUseLabel, composeShare, MAX_PHOTO_SLIDES, photoSlide } from "@/lib/shareCanvas";
import { getShareLink } from "@/lib/passport";
import { countryCode } from "@/lib/countries";
import { stampArtUrl } from "@/lib/stampArt";
import { isPlainArt } from "@/lib/respectPlaces";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";
import { isPhotoFirst } from "@/lib/passport";
import { calmEdge } from "@/lib/photoEdge";
import AirportStamp from "@/components/passport/AirportStamp";
import TypographicStamp from "@/components/passport/TypographicStamp";

// ============================================================================
// PassportBook — the Virtual Passport rendered as a real booklet you open and
// flip through. Closed = the navy Globeskimmers cover (a photo-real render that
// carries its own depth + shadow). Tap/swipe → the cover swings open from the
// left spine and the interior pages appear beneath: an ownership page first,
// then one portrait page per country with the stamps pressed onto ivory paper.
//
// Fictional collectible journal — NOT a government document. No MRZ, seal,
// passport number, or nationality code (see the spec + acceptance criteria).
//
// The book ENGINE is data-driven: pass cover + pages + owner as props so future
// purchasable country covers reuse it unchanged.
// ============================================================================
export const PASSPORT_COVER_URL =
  "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/passport-cover-default-v2.jpg";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const SANS = '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#243447", INK3 = "#66717D", STAMP = "#B0472F";
// Cool inks for city/place visit stamps — a different one per stamp (deterministic).
const CITY_INKS = ["#1F6E6A", "#2B4A7E", "#3E5AA8", "#0E7C86", "#2E6B4E", "#5B4B8A", "#6D3A6E", "#2C6E9B", "#3A7D5B", "#4453A6"];
// Inks for the iconic-place PLACEHOLDER stamp (used until bespoke art is uploaded
// for #301–1006). Includes the warm STAMP red so variety spans warm + cool.
const STAMP_INKS = ["#B0472F", "#2B4A7E", "#2E6B4E", "#5B4B8A", "#6D3A6E", "#0E7C86", "#8A3B2F"];
const hashStr = (s) => { let h = 0; const str = String(s || ""); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };
const PAPER = "#FBF6EC", PAPER_EDGE = "#EADFC9";
const NAVY = "#0C2B50", NAVY_DEEP = "#071B33", GOLD = "#D6A64A";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;
// Stamp width as a share of the page width. The 2026-09-28 "Updated B" sizing
// (0.76, one stamp per page) existed only because the SHARED image was drawn
// from the page. 2026-09-29 the share renderer decoupled: a share can render
// ONE chosen stamp at hero size (HERO_FRAC below, matching Updated B's on-story
// text sizes), so the booklet itself returns to a denser, more passport-like
// 0.56 — two stamps pack a page again.
const ART_FRAC = 0.56;
// The hidden hero page a single-stamp share captures — Updated B's scale.
const HERO_FRAC = 0.76;
// The booklet itself (founder, 2026-10-05): two stamps to a page — one in the
// top half, one in the bottom, each at its own spot — so stamps print compact
// here. A share captures a hidden copy of the page at the sizes above, so the
// shared image stays exactly as big as before.
const BOOK = { art: 0.40, airport: 0.62, thumb: 0.10, text: 0.8 };

const KIND = {
  country: "🌍", city: "🏙️", airport: "✈️", icon: "🗽", wonder: "🏔️", attraction: "📍",
};
const flagFor = (country) => {
  const cc = countryCode(country);
  if (!cc || !/^[a-z]{2}$/i.test(cc)) return "🗺️";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

// Photos on a page are cover-sized backgrounds, not <img object-fit>, because
// html2canvas 1.4 (the share capture) ignores object-fit and would stretch
// them; it does honour background-size: cover.
const clip = (t, n) => { const s = String(t || "").trim(); if (s.length <= n) return s; const cut = s.slice(0, n); return cut.slice(0, Math.max(cut.lastIndexOf(" "), n - 12)).replace(/[,.;:\s]+$/, "") + "…"; };
const coverBg = (url) => ({ backgroundImage: `url("${String(url || "").replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" });
// The context under a scene stamp (founder, 2026-09-29: "include the
// context"): the work, one line on the scene, the two leads. The photo-first
// page prints its own fuller version; this is for a scene stamp with no photos.
function FilmCaption({ film, t = 1 }) {
  if (!film || !film.title) return null;
  const cast = (film.cast || []).filter((c) => c && c.actor).slice(0, 2).map((c) => (c.role ? `${c.actor} as ${c.role}` : c.actor)).join(" · ");
  return (
    <div style={{ textAlign: "center", marginTop: 8, padding: "0 6px", maxWidth: "100%" }}>
      <div style={{ fontFamily: SERIF, fontSize: fs(16 * t), color: INK, lineHeight: 1.15 }}>
        The scene from <i>{film.title}</i>{film.year ? ` (${film.year})` : ""}
      </div>
      {film.scene && <div style={{ fontFamily: SANS, fontSize: fs(11.5 * t), color: "#3F4A52", lineHeight: 1.35, marginTop: 3 }}>{clip(film.scene, 110)}</div>}
      {cast && <div style={{ fontFamily: MONO, fontSize: fs(9.5 * t), color: "#2E6B4E", letterSpacing: ".02em", lineHeight: 1.4, marginTop: 4 }}>{cast}</div>}
    </div>
  );
}
const filmCaptionH = (film) => (film && film.title ? 30 + (film.scene ? 34 : 0) + ((film.cast || []).length ? 18 : 0) : 0);

// ── Booklet pages: two stamps to a page ─────────────────────────────────────
// The page's usable height: the paper (border-box: 18px padding + 1px border,
// top and bottom), a 10px top pad and the 26px page-number strip. Two stamps
// share it with a 12px gap; each sits in its own region with 2+2px padding.
const HALF_PAD = { top: 10, bottom: 26, gap: 12 };
const SLOT_PAD = 4;
const pageInner = (pageW) => pageW * 1.6 - 38 - HALF_PAD.top - HALF_PAD.bottom;
const halfH = (pageW) => (pageInner(pageW) - HALF_PAD.gap) / 2 - SLOT_PAD;
// The reader's text size (Settings → text size sets --fs, 1–1.45): captions grow with it.
export const readFontScale = () => {
  try { return Math.max(1, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fs")) || 1); } catch { return 1; }
};
// A compact stamp's height, over-counted a little so a half never overflows.
const compactH = (s, pageW, fsScale = 1) => {
  const t = BOOK.text * fsScale;
  const n = Math.min(4, (s.photos || []).length);
  const photosH = n ? BOOK.thumb * pageW + 8 : 0;
  const withTag = s.tagged_by_name || s.tagged_by_handle ? 18 * t : 0;
  if (s.kind === "airport") return 0.659 * BOOK.airport * pageW + 8 + photosH + withTag;
  // A place visit: "VISITED <city>, <country>" can wrap to two lines, then the
  // venue and the date. Everything else: "I was here!" and the date.
  const caption = (s.kind === "city" ? 84 : 50) * t;
  return BOOK.art * pageW + caption + photosH + withTag + filmCaptionH(s.meta && s.meta.film) * t + 6;
};
// Two stamps fit one page when their heights together fit it (a tall photo stamp
// can share with an airport stamp; two tall ones can't).
export const fitsTogether = (a, b, pageW, fsScale = 1) =>
  compactH(a, pageW, fsScale) + compactH(b, pageW, fsScale) + HALF_PAD.gap + 2 * SLOT_PAD <= pageInner(pageW);
// Pages in booklet order. A scene stamp with photos (photo-first) or a stamp too
// tall for a page fills one; 'solo' keeps a page to itself; two stamps the
// traveler put together ("Move to another page" → meta.page_with) share one,
// the newest move winning a contested page; everything else pairs up in order
// when the two fit, a later stamp back-filling the first page with room.
export function packBookPages(stamps, pageW, fsScale = 1) {
  const list = stamps || [];
  const full = (s) => isPhotoFirst(s) || compactH(s, pageW, fsScale) + SLOT_PAD > pageInner(pageW);
  const fits = (a, b) => fitsTogether(a, b, pageW, fsScale);
  const byId = new Map(list.map((s) => [s.id, s]));
  const asked = list
    .filter((s) => s.meta && s.meta.page_with && s.meta.page_with !== s.id && byId.has(s.meta.page_with))
    .sort((a, b) => String(b.meta.page_with_at || "").localeCompare(String(a.meta.page_with_at || "")));
  // mover → the stamp it was moved beside. The pair lands on the page where that
  // stamp sits, so the page the traveler picked is the page it joins.
  const moverTo = new Map(), joinedBy = new Map();
  for (const a of asked) {
    const b = byId.get(a.meta.page_with);
    const taken = (x) => moverTo.has(x.id) || joinedBy.has(x.id);
    if (taken(a) || taken(b) || full(a) || full(b) || a.layout === "solo" || b.layout === "solo" || !fits(a, b)) continue;
    moverTo.set(a.id, b.id); joinedBy.set(b.id, a.id);
  }
  const pages = [];
  const placed = new Set();
  for (const s of list) {
    if (placed.has(s.id) || moverTo.has(s.id)) continue;
    placed.add(s.id);
    const mid = joinedBy.get(s.id);
    if (mid) { pages.push({ items: [s, byId.get(mid)], pinned: true }); placed.add(mid); continue; }
    if (full(s)) { pages.push({ items: [s], solo: true, full: true }); continue; }
    if (s.layout === "solo") { pages.push({ items: [s], solo: true }); continue; }
    const open = pages.find((pg) => !pg.solo && !pg.pinned && pg.items.length === 1 && fits(pg.items[0], s));
    if (open) open.items.push(s); else pages.push({ items: [s] });
  }
  return pages.map((p, i) => ({ key: `pg-${i}`, stamps: p.items, solo: !!p.solo, full: !!p.full }));
}

// A large stamp pressed onto the page, sized off the page width so heights are a
// constant fraction across phones (lets pagination fit each page with no scroll).
// Airport ≈ ⅓ page; iconic ≈ ½ page with "I was here!", a big ink date, and up
// to 4 memory photos in a 2×2 grid.
function StampToken({ stamp, idx, onOpen, pageW, compact = false }) {
  const [artFail, setArtFail] = useState(false);
  // In the booklet each stamp keeps its own tilt (its half of the page places
  // it); on a shared page the tilt and nudge follow its order on the page.
  const h = hashStr(stamp.id || stamp.entity_id || stamp.name);
  const rot = compact ? (h % 9) - 4 : ((idx * 47 + 3) % 9) - 4;   // deterministic -4..+4°
  const nudge = compact ? 0 : ((idx * 53) % 26) - 13;            // deterministic -13..+12px horizontal
  const t = compact ? BOOK.text : 1;                              // caption type scale
  // A memorial stamp its owner chose to keep as text only prints typographic.
  const art = stamp.kind === "country" || isPlainArt(stamp) ? null : stampArtUrl(stamp.name, { entityId: stamp.entity_id, country: stamp.country });
  const showArt = !!art && !artFail;
  const flag = stamp.kind === "country" ? flagFor(stamp.country || stamp.name) : null;
  // No bespoke art and not a country -> the typographic stamp carries its own
  // date and "I was here!" strike, so the duplicate lines below are suppressed.
  const showTypo = !showArt && !flag;
  const isAirport = stamp.kind === "airport";
  const isCity = stamp.kind === "city";
  const venue = isCity && stamp.name && stamp.name !== stamp.city ? stamp.name : null;
  const cityInk = CITY_INKS[hashStr(stamp.id || stamp.entity_id || stamp.name) % CITY_INKS.length];
  const placeInk = STAMP_INKS[hashStr(stamp.id || stamp.entity_id || stamp.name) % STAMP_INKS.length];
  const iconicInk = showArt ? STAMP : placeInk; // "I was here!"/date matches the placeholder ink
  const bigDate = stamp.visited_on
    ? new Date(stamp.visited_on + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  const photos = (stamp.photos || []).slice(0, 4);
  const artW = Math.round((compact ? BOOK.art : ART_FRAC) * pageW);
  const badgeW = Math.round((compact ? 0.36 : 0.5) * pageW);
  const airportW = Math.round((compact ? BOOK.airport : 0.82) * pageW);
  const thumbW = Math.round((compact ? BOOK.thumb : 0.185) * pageW);
  return (
    <button
      onClick={() => onOpen(stamp)}
      aria-label={`Open stamp: ${stamp.name}`}
      className="relative active:scale-95 transition-transform"
      style={{ transform: `translateX(${nudge}px) rotate(${rot}deg)`, maxWidth: "100%" }}
    >
      {isAirport ? (
        <div className="flex flex-col items-center">
          <AirportStamp iata={String(stamp.entity_id || "").split(":")[0]} city={stamp.city} country={stamp.country} countryCode={stamp.country} date={stamp.visited_on} direction={stamp.meta?.direction || null} width={airportW} />
        </div>
      ) : isCity ? (
        // A city / place visit (everything minted by "Stamp a place"). This
        // branch used to be text-only and silently DROPPED the engraved art
        // and the typographic stamp that the detail sheet shows — a curated
        // "Lake Louise" engraving never reached the keepsake page. Now it gets
        // the same art-or-typographic treatment as an iconic place, with the
        // "Visited / I was here @" typography kept as the caption.
        <div className="flex flex-col items-center text-center" style={{ maxWidth: airportW, padding: "0 6px" }}>
          {showArt ? (
            <img src={art} alt={stamp.name} loading={compact ? "lazy" : "eager"} onError={() => setArtFail(true)} style={{ width: artW, height: artW, objectFit: "contain" }} />
          ) : (
            // No bespoke art yet → the typographic stamp (carries its own name,
            // date and "I was here!" strike). Auto-upgrades when a PNG lands on R2.
            <TypographicStamp
              name={stamp.name} city={stamp.city} region={stamp.region}
              country={stamp.country} date={stamp.visited_on}
              entityId={stamp.entity_id || stamp.id} width={artW} overprint strength={STAMP_INK_STRENGTH} film={stamp.meta?.film || null}
            />
          )}
          {showArt ? (
            // Under the engraving: the full caption.
            <>
              <div style={{ fontFamily: SANS, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".012em", color: cityInk, fontSize: fs(15 * t), lineHeight: 1.08, marginTop: 8 * t }}>
                Visited {stamp.city || stamp.name}{stamp.country ? `, ${stamp.country}` : ""}
              </div>
              {venue && <div style={{ fontFamily: SERIF, fontStyle: "italic", color: cityInk, fontSize: fs(17 * t), marginTop: 4 * t, lineHeight: 1.1 }}>I was here @ {venue}</div>}
              {bigDate && <div style={{ fontFamily: MONO, color: cityInk, opacity: 0.7, fontSize: fs(11.5 * t), letterSpacing: ".03em", marginTop: 6 * t }}>{bigDate}</div>}
            </>
          ) : (
            // The typographic stamp already says the name + date + "I was
            // here!" — only add the city context when the stamp is a specific
            // spot within a city (e.g. LAKE LOUISE → "Visited Banff, Canada").
            venue && stamp.city && (
              <div style={{ fontFamily: MONO, color: cityInk, opacity: 0.95, fontSize: fs(13 * t), letterSpacing: ".04em", textTransform: "uppercase", marginTop: 8 * t }}>
                Visited {stamp.city}{stamp.country ? `, ${stamp.country}` : ""}
              </div>
            )
          )}
          <FilmCaption film={stamp.meta?.film} t={t} />
          {(stamp.tagged_by_name || stamp.tagged_by_handle) && (
            <div style={{ fontFamily: MONO, fontSize: fs(10 * t), color: "#2E6B4E", letterSpacing: ".06em", marginTop: 6 * t, textTransform: "uppercase" }}>
              WITH {(stamp.tagged_by_name || `@${stamp.tagged_by_handle}`).toUpperCase()}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {showArt ? (
            <img src={art} alt={stamp.name} loading={compact ? "lazy" : "eager"} onError={() => setArtFail(true)} style={{ width: artW, height: artW, objectFit: "contain" }} />
          ) : flag ? (
            // Country stamp with no bespoke art → flag badge.
            <div className="flex flex-col items-center justify-center text-center" style={{ width: badgeW, height: badgeW, borderRadius: 20, border: `2.5px solid ${STAMP}`, background: "rgba(255,255,255,.45)", padding: 12 }}>
              <span style={{ fontSize: Math.round(0.1 * pageW), lineHeight: 1 }}>{flag}</span>
              <span className="leading-tight" style={{ fontFamily: SERIF, fontSize: fs(22 * t), color: STAMP, marginTop: 4 }}>{stamp.name}</span>
            </div>
          ) : (
            // Iconic place, bespoke art not uploaded yet → an inked rubber-stamp
            // placeholder. Auto-upgrades to the illustration once its art lands on R2.
            <TypographicStamp
              name={stamp.name} city={stamp.city} region={stamp.region}
              country={stamp.country} date={stamp.visited_on}
              entityId={stamp.entity_id || stamp.id} width={artW} overprint strength={STAMP_INK_STRENGTH} film={stamp.meta?.film || null}
            />
          )}
          {!showTypo && (<>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", color: iconicInk, fontSize: fs(19 * t), marginTop: 6 * t, lineHeight: 1 }}>I was here!</div>
            {bigDate && <div style={{ fontFamily: SERIF, color: iconicInk, fontSize: fs(23 * t), letterSpacing: ".01em", marginTop: 2, lineHeight: 1 }}>{bigDate}</div>}
          </>)}
          <FilmCaption film={stamp.meta?.film} t={t} />
          {(stamp.tagged_by_name || stamp.tagged_by_handle) && (
            <div style={{ fontFamily: MONO, fontSize: fs(10 * t), color: "#2E6B4E", letterSpacing: ".06em", marginTop: 6 * t, textTransform: "uppercase" }}>
              WITH {(stamp.tagged_by_name || `@${stamp.tagged_by_handle}`).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Memory photos, max 4, under the date — a 2×2 grid on a shared page,
          one small row in the booklet. */}
      {photos.length > 0 && (
        <div style={compact
          ? { display: "grid", gridTemplateColumns: `repeat(${photos.length}, ${thumbW}px)`, gap: 6, marginTop: 8, justifyContent: "center" }
          : { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, width: thumbW * 2 + 8, marginLeft: "auto", marginRight: "auto" }}>
          {photos.map((p) => (
            <span key={p.id} role="img" aria-label="Memory photo"
              style={{ display: "block", width: thumbW, height: thumbW, borderRadius: compact ? 7 : 10, border: `1px solid ${PAPER_EDGE}`, ...coverBg(p.photo_url) }} />
          ))}
        </div>
      )}

      {/* The ✓ sits on the stamp itself, never on the photos (founder,
          2026-09-28), top-left so it never covers the red "I was here!".
          Earned by GPS at the place, a photo's own location, or the place
          recognised in a photo. */}
      {(stamp.verified === "gps" || stamp.verified === "photo_loc" || stamp.verified === "photo_ai") && (
        <span className="absolute" title={stamp.verified === "gps" ? "Verified visit" : "Verified by photo"} style={{ top: -6, left: isAirport ? 10 : 14, background: "#2E6B4E", color: "#fff", fontSize: 14, fontWeight: 700, width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }}>✓</span>
      )}
    </button>
  );
}

// The photo-first page for a scene stamp (founder, 2026-09-28): "one photo is
// open at a time with the stamp at the top or bottom of the photo, depending on
// making sure the stamp does not block the iconic photo". The second photo is
// a thumbnail; tapping it swaps. The stamp only touches the photo's edge, on
// the calmer edge of the open photo (calmEdge), unless the traveller pinned it
// above or below from the stamp options (meta.stamp_pos). The scene and the
// two leads print underneath. Always a page of its own.
function PhotoFirstToken({ stamp, onOpen, pageW }) {
  const photos = (stamp.photos || []).filter((p) => p && p.photo_url).slice(0, 4);
  const [cur, setCur] = useState(0);
  const main = photos[cur % photos.length] || photos[0];
  const next = photos.length > 1 ? photos[(cur + 1) % photos.length] : null;
  const innerW = Math.round(pageW - 38);
  const photoH = Math.round(0.72 * pageW); // the floor; the photo grows into any spare page height
  const stampW = Math.round(0.5 * pageW);
  const overlap = Math.round(0.07 * pageW);
  const thumbW = Math.round(0.2 * pageW);
  const pinned = stamp.meta?.stamp_pos === "top" || stamp.meta?.stamp_pos === "bottom" ? stamp.meta.stamp_pos : null;
  const mainUrl = main ? main.photo_url : "";
  const [auto, setAuto] = useState("bottom");
  useEffect(() => {
    let live = true;
    if (!pinned && mainUrl) calmEdge(mainUrl, innerW, photoH).then((e) => { if (live) setAuto(e); });
    return () => { live = false; };
  }, [pinned, mainUrl, innerW, photoH]);
  const pos = pinned || auto;
  const film = stamp.meta?.film || {};
  const cast = (film.cast || []).filter((c) => c && c.actor).slice(0, 2).map((c) => (c.role ? `${c.actor} as ${c.role}` : c.actor)).join(" · ");
  const verified = stamp.verified === "gps" || stamp.verified === "photo_loc" || stamp.verified === "photo_ai";
  const open = () => onOpen(stamp);
  const photo = (
    <div style={{ position: "relative", width: "100%", flex: "1 1 auto", minHeight: photoH, maxHeight: Math.round(1.05 * pageW), borderRadius: Math.round(0.035 * pageW), overflow: "hidden", background: "#E9E1D2" }}>
      <div role="img" aria-label={`My photo at ${stamp.name}`} style={{ position: "absolute", inset: 0, ...coverBg(main.photo_url) }} />
      {next && (
        <button type="button" aria-label={`Show photo ${((cur + 1) % photos.length) + 1} of ${photos.length}`}
          onClick={(e) => { e.stopPropagation(); setCur((c) => (c + 1) % photos.length); }}
          style={{ position: "absolute", right: 10, [pos === "top" ? "bottom" : "top"]: 10, width: thumbW, height: thumbW, borderRadius: 9, overflow: "hidden", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,.25)", padding: 0, background: "#fff" }}>
          <span aria-hidden style={{ position: "absolute", inset: 0, ...coverBg(next.photo_url) }} />
          <span style={{ position: "absolute", right: 4, bottom: 4, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, background: "#fff", color: "#141A1F", fontFamily: MONO, fontSize: 11, display: "grid", placeItems: "center" }}>
            {photos.length > 2 ? `${((cur + 1) % photos.length) + 1}/${photos.length}` : "2"}
          </span>
        </button>
      )}
    </div>
  );
  const stampEl = (
    <div style={{ position: "relative", width: stampW, height: stampW, flex: "none", transform: "rotate(-3deg)", zIndex: 1, marginTop: pos === "top" ? 0 : -overlap, marginBottom: pos === "top" ? -overlap : 0 }}>
      {/* Soft ivory discs so the stamp reads where it crosses the photo's
          edge. Two flat fills stepped in alpha — no radial-gradient (html2canvas
          1.4 then drew the whole page blank) and no box-shadow (it drew those
          in the wrong place inside this rotated box). Measured 2026-09-28. */}
      <div aria-hidden style={{ position: "absolute", inset: "6%", borderRadius: "50%", background: "rgba(251,246,236,.45)" }} />
      <div aria-hidden style={{ position: "absolute", inset: "15%", borderRadius: "50%", background: "rgba(251,246,236,.6)" }} />
      <div style={{ position: "relative" }}>
        <TypographicStamp name={stamp.name} city={stamp.city} region={stamp.region} country={stamp.country} date={stamp.visited_on}
          entityId={stamp.entity_id || stamp.id} width={stampW} overprint strength={STAMP_INK_STRENGTH} film={stamp.meta?.film || null} />
      </div>
      {verified && (
        <span title={stamp.verified === "gps" ? "Verified visit" : "Verified by photo"} style={{ position: "absolute", top: 4, left: 4, background: "#2E6B4E", color: "#fff", fontSize: 13, fontWeight: 700, width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", border: "2px solid #fff" }}>✓</span>
      )}
    </div>
  );
  return (
    <div role="button" tabIndex={0} aria-label={`Open stamp: ${stamp.name}`} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", cursor: "pointer" }}>
      {pos === "top" ? <>{stampEl}{photo}</> : <>{photo}{stampEl}</>}
      <div style={{ textAlign: "center", padding: "6px 4px 0", maxWidth: "100%", flex: "none" }}>
        {film.title && (
          <div style={{ fontFamily: SERIF, fontSize: fs(21), color: INK, lineHeight: 1.1 }}>
            The scene from <i>{film.title}</i>{film.year ? ` (${film.year})` : ""}
          </div>
        )}
        {film.scene && <div style={{ fontFamily: SANS, fontSize: fs(12.5), color: "#3F4A52", lineHeight: 1.35, marginTop: 4 }}>{clip(film.scene, 120)}</div>}
        {cast && <div style={{ fontFamily: MONO, fontSize: fs(10.5), color: "#2E6B4E", letterSpacing: ".02em", lineHeight: 1.4, marginTop: 5 }}>{cast}</div>}
      </div>
    </div>
  );
}

// Ivory paper wrapper shared by every interior page. Carries a faint alternating
// ✈️/🌍 watermark and a page number in the lower outer (right) corner.
function Paper({ children, coverH, pageNo, watermark, grow = false }) {
  return (
    <div style={{
      background: PAPER, border: `1px solid ${PAPER_EDGE}`, borderRadius: 16,
      padding: 18, position: "relative", overflow: "hidden",
      minHeight: coverH, height: grow ? "auto" : "100%",
      boxShadow: "inset 13px 0 22px -18px rgba(0,0,0,.4), inset -6px 0 14px -12px rgba(0,0,0,.2)",
    }}>
      {watermark && (
        <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.06, fontSize: 180, pointerEvents: "none" }}>{watermark}</div>
      )}
      <div style={{ position: "relative", height: grow ? "auto" : "100%", overflow: grow ? "visible" : "hidden" }}>{children}</div>
      {pageNo != null && (
        <div aria-hidden style={{ position: "absolute", bottom: 10, [pageNo % 2 === 0 ? "left" : "right"]: 16, fontFamily: MONO, fontSize: fs(10.5), color: INK3, opacity: 0.75, pointerEvents: "none" }}>{pageNo}</div>
      )}
    </div>
  );
}

// Page 0 — the ownership page (passport-inspired, clearly fictional).
function OwnershipPage({ holder, homeCountry, countries, totalStamps, coverH, pageNo, watermark }) {
  const Field = ({ label, value }) => (
    <div>
      <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".1em", color: INK3 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: fs(18), color: INK, lineHeight: 1.15, marginTop: 1 }}>{value}</div>
    </div>
  );
  return (
    <Paper coverH={coverH} pageNo={pageNo} watermark={watermark}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".22em", color: STAMP }}>Globeskimmers</div>
        <h2 style={{ fontFamily: SERIF, fontSize: fs(29), color: INK, lineHeight: 1.06, marginTop: 6 }}>
          {holder ? `${holder}’s Virtual Passport` : "My Virtual Passport"}
        </h2>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4" style={{ marginTop: 24 }}>
          {homeCountry ? <Field label="Home Country" value={homeCountry} /> : null}
          <Field label="Countries Explored" value={countries} />
          <Field label="Stamps Collected" value={totalStamps} />
        </div>

        <p style={{ fontFamily: SERIF, fontSize: fs(14), color: INK3, lineHeight: 1.5, marginTop: 20, maxWidth: "92%" }}>
          A personal collection of places explored with Globeskimmers.
        </p>

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(8), letterSpacing: ".12em", color: INK3, opacity: 0.8 }}>
            Not a government document · A keepsake travel journal
          </div>
        </div>
      </div>
    </Paper>
  );
}

// A page of stamps — can mix countries (each stamp carries its own place).
// In the booklet: two halves, top and bottom, each stamp compact and placed at
// its own spot in its half (from its id, so it never jumps); a lone stamp takes
// one half. share: the hidden copy a page share captures — the stamps at full
// share size, centred, the way pages were shared before (it may grow taller than
// a page; the share frame scales it to fit).
const SPOT = ["flex-start", "center", "flex-end"];
function StampPage({ pg, onOpenStamp, coverH, pageNo, watermark, pageW, share = false }) {
  if (pg.stamps.length === 1 && isPhotoFirst(pg.stamps[0])) {
    return (
      <Paper coverH={coverH} pageNo={pageNo} watermark={watermark}>
        <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 18 }}>
          <PhotoFirstToken stamp={pg.stamps[0]} onOpen={() => onOpenStamp(pg.stamps[0].id)} pageW={pageW} />
        </div>
      </Paper>
    );
  }
  if (share) {
    return (
      <Paper coverH={coverH} pageNo={pageNo} watermark={watermark} grow>
        <div style={{ position: "relative", minHeight: `calc(${coverH} - 38px)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: pg.stamps.length <= 1 ? "center" : "space-around", gap: 18, paddingTop: 12, paddingBottom: 22 }}>
          {pg.stamps.map((s, j) => <StampToken key={s.id} stamp={s} idx={j} onOpen={() => {}} pageW={pageW} />)}
        </div>
      </Paper>
    );
  }
  const spot = (s) => { const h = hashStr(s.id || s.name); return { justifyContent: SPOT[h % 3], alignItems: SPOT[(h >>> 3) % 3] }; };
  // Two stamps: one region each, sized to what each needs. One stamp: the top
  // or the bottom half (from its id), or the whole page when it's taller.
  const fsScale = readFontScale();
  const need = (s) => compactH(s, pageW, fsScale) + SLOT_PAD;
  const lone = pg.stamps.length === 1 ? pg.stamps[0] : null;
  const halves = pg.full || (lone && need(lone) > halfH(pageW)) ? [pg.stamps[0]]
    : !lone ? pg.stamps.slice(0, 2)
    : hashStr(lone.id || lone.name) % 2 ? [null, lone] : [lone, null];
  const rows = halves.length === 1 ? "1fr" : !lone ? `${Math.round(need(halves[0]))}fr ${Math.round(need(halves[1]))}fr` : "1fr 1fr";
  return (
    <Paper coverH={coverH} pageNo={pageNo} watermark={watermark}>
      <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: rows, gap: HALF_PAD.gap, paddingTop: HALF_PAD.top, paddingBottom: HALF_PAD.bottom }}>
        {halves.map((s, j) => (
          <div key={s ? s.id : `empty-${j}`} style={{ display: "flex", minHeight: 0, padding: "2px 4px", ...(s ? spot(s) : {}), ...(pg.full ? { justifyContent: "center", alignItems: "center" } : {}) }}>
            {s && <StampToken stamp={s} idx={j} onOpen={() => onOpenStamp(s.id)} pageW={pageW} compact />}
          </div>
        ))}
      </div>
    </Paper>
  );
}

// Share analytics (founder, 2026-09-28: per month, stamps vs shares per
// platform, and story vs post vs message). iOS reports the app picked in the
// share sheet (@capacitor/share → activityType: an iOS extension id, or on
// Android the chosen app's package name); the browser's Web Share reports
// nothing, so those land as "unknown". Pattern-matched so an exact id can
// drift without losing the platform. Android Messenger is com.facebook.orca.
const platformFromActivity = (a) => {
  const s = String(a || "").toLowerCase();
  if (!s) return null;
  if (s.includes("instagram")) return "instagram";
  if (s.includes("messenger") || s.includes("facebook.orca")) return "messenger";
  if (s.includes("facebook")) return "facebook";
  if (s.includes("whatsapp")) return "whatsapp";
  if (s.includes("musically") || s.includes("tiktok")) return "tiktok";
  if (s.includes("picaboo") || s.includes("snapchat")) return "snapchat";
  if (s.includes("tweetie") || s.includes("twitter")) return "x";
  if (s.includes("activity.message") || s.includes("apps.messaging") || s.includes("android.mms")) return "messages";
  if (s.includes("activity.mail") || s.includes("android.gm")) return "mail";
  if (s.includes("savetocameraroll") || s.includes("apps.photos")) return "saved";
  if (s.includes("copytopasteboard")) return "copied";
  return "other";
};
const shareMeta = (p) => ({
  format: p?.use || "story",           // story | post | message (what the admin table splits by)
  preset: p?.preset || null,
  mix: p?.use !== "story" ? (p?.mix || "page") : "page",
  photos_on_page: (p?.photos || []).length,
  target: p?.target || null,
});
const revokeSlides = (slides) => (slides || []).forEach((x) => { try { if (x?.url) URL.revokeObjectURL(x.url); } catch { /* ignore */ } });

// Blank ivory page — trailing fresh pages waiting for stamps.
function EmptyCollectionPage({ coverH, pageNo, watermark, first = false }) {
  return (
    <Paper coverH={coverH} pageNo={pageNo} watermark={watermark}>
      {first && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8" style={{ pointerEvents: "none" }}>
          <p style={{ fontFamily: SERIF, fontSize: fs(20), color: INK, lineHeight: 1.25 }}>Your first stamp lands here.</p>
          <p style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".14em", color: INK3, marginTop: 8, textTransform: "uppercase" }}>Earned by being there</p>
        </div>
      )}
    </Paper>
  );
}

export default function PassportBook({
  stamps, holder, homeCountry, countries, totalStamps, onOpenStamp,
  coverUrl = PASSPORT_COVER_URL,
  renderUnderPage = null, // (pageStamps) => node — the Blotter strip under an open page
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [[page, dir], setPage] = useState([0, 0]); // 0 = ownership, 1..N = stamp pages
  const firstRender = useRef(true);
  const [hintSeen, setHintSeen] = useState(() => {
    try { return !!localStorage.getItem("pp_book_opened"); } catch { return false; }
  });
  useEffect(() => { firstRender.current = false; }, []);

  // Page width drives every stamp size, so heights stay a constant fraction of
  // the page across phones — which lets us paginate to fit with NO scrolling.
  const [pageW, setPageW] = useState(() => {
    try { return Math.min(0.94 * window.innerWidth, 440); } catch { return 360; }
  });
  useEffect(() => {
    const onR = () => { try { setPageW(Math.min(0.94 * window.innerWidth, 440)); } catch { /* ignore */ } };
    window.addEventListener("resize", onR);
    window.addEventListener("orientationchange", onR);
    return () => { window.removeEventListener("resize", onR); window.removeEventListener("orientationchange", onR); };
  }, []);

  // Two stamps to a page (packBookPages above). The page width drives every
  // stamp size, so a half always fits its stamp — no scrolling, on any phone.
  const bookPages = useMemo(() => packBookPages(stamps, pageW, readFontScale()), [stamps, pageW]);

  const stampCount = bookPages.length;
  const MIN_TOTAL = 10; // a fresh passport ships as a 10-page booklet to flip through
  // ownership + every stamp page + always ≥1 trailing blank (auto-grows as stamps fill up)
  const total = Math.max(MIN_TOTAL, 1 + stampCount + 1);
  // Deleting a stamp (or rotating the phone, which repacks the pages) can shrink
  // `total` while the book is open — pull `page` back onto the last page so the
  // indicator never reads "11 / 10" and Next never re-enables past the end.
  useEffect(() => {
    if (page > total - 1) setPage([Math.max(0, total - 1), 0]);
  }, [page, total]);
  const openBook = useCallback(() => {
    setOpen(true);
    try { localStorage.setItem("pp_book_opened", "1"); } catch { /* ignore */ }
    setHintSeen(true);
  }, []);
  const closeBook = useCallback(() => { setOpen(false); setPage([0, 0]); }, []);
  const go = useCallback((delta) => {
    setPage(([p]) => {
      const next = Math.min(total - 1, Math.max(0, p + delta));
      return [next, next === p ? 0 : Math.sign(delta)];
    });
  }, [total]);

  // Swipe via raw touch (reliable in the iOS WebView, unlike framer drag).
  // Vertical scroll is preserved — we only act on a mostly-horizontal swipe.
  const touch = useRef(null);
  const onTouchStart = useCallback((e) => {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback((e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return; // not a horizontal swipe
    if (!open) { if (dx < 0) openBook(); return; }                      // swipe left on cover → open
    if (dx < 0) go(1);                                                  // swipe left → next page
    else if (page === 0) closeBook();                                   // swipe right on page 1 → back to cover
    else go(-1);                                                        // swipe right → previous page
  }, [open, openBook, go, page, closeBook]);

  // Keyboard: Enter/Space open · ← → turn · Esc close.
  const onKey = useCallback((e) => {
    if (!open) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBook(); } return; }
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "Escape") { e.preventDefault(); closeBook(); }
  }, [open, openBook, go, closeBook]);

  // Responsive closed footprint. Cropped cover is 1:1.6; fill the width.
  const coverW = "min(94vw, 440px)";
  const coverH = "calc(min(94vw, 440px) * 1.6)";

  const dur = reduce ? 0.12 : 0.85;
  const pageDur = reduce ? 0.1 : 0.5;

  const pageVariants = {
    enter: (d) => reduce ? { opacity: 0 } : { x: d > 0 ? "42%" : "-42%", rotateY: d > 0 ? 16 : -16, opacity: 0 },
    center: { x: 0, rotateY: 0, opacity: 1 },
    exit: (d) => reduce ? { opacity: 0 } : { x: d > 0 ? "-42%" : "42%", rotateY: d > 0 ? -16 : 16, opacity: 0 },
  };

  const renderPage = (idx) => {
    const pageNo = idx + 1;
    const watermark = idx % 2 === 0 ? "🌍" : "✈️"; // alternate earth / airplane
    if (idx === 0) return <OwnershipPage holder={holder} homeCountry={homeCountry} countries={countries} totalStamps={totalStamps} coverH={coverH} pageNo={pageNo} watermark={watermark} />;
    const ci = idx - 1; // 0-based index into the collection (stamp pages, then blanks)
    if (ci < stampCount) return <StampPage pg={bookPages[ci]} onOpenStamp={onOpenStamp} coverH={coverH} pageNo={pageNo} watermark={watermark} pageW={pageW} />;
    return <EmptyCollectionPage coverH={coverH} pageNo={pageNo} watermark={watermark} first={ci === stampCount && stampCount === 0} />;
  };

  const pageLabel = `Page ${page + 1} of ${total}`;

  // Share the current page as a branded image. Two taps on purpose: the first
  // renders (html2canvas takes a moment, and WebKit only lets navigator.share
  // run inside a user gesture — calling it after the render is why the button
  // "did nothing" on the founder's phone, 2026-09-26); the preview's own Share
  // button then hands the file to the native sheet (Instagram, Facebook,
  // Snapchat, X, Messages — whatever is installed). A native build that carries
  // @capacitor/share + @capacitor/filesystem goes through the plugin (always
  // opens the sheet); otherwise the Web Share API; on the web a plain download.
  // Every failure says why — never silent.
  const activePageRef = useRef(null);
  // The hidden hero page: one chosen stamp at HERO_FRAC ("Updated B") that a
  // single-stamp share captures instead of the on-screen page. Kept in the DOM
  // (offscreen) so html2canvas can draw it with the booklet's exact fonts.
  const heroRef = useRef(null);
  const [heroStamp, setHeroStamp] = useState(null);
  // The hidden share page: the open page at share size (StampPage share). A page
  // share captures this, not the compact page on screen, so shared pages stay as
  // big as before (founder, 2026-10-05). A photo-first page shares as it shows.
  const sharePageRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  // preview: { status: "rendering" } | { status: "ready", url, blob, dataUrl } | { status: "error", message }
  // The overlay appears the instant Share is tapped (founder, 2026-09-27: the
  // tap "did nothing" on the phone even with the new bundle), so a slow or
  // failed render is visible on screen, not only in a toast.
  const [preview, setPreview] = useState(null);
  const renderCurrentPage = useCallback(async () => {
    if (sharing) return;
    // The page element: the ref first, else the DOM marker (a forwarded ref
    // that misses would otherwise make the button a silent no-op).
    let el = sharePageRef.current || activePageRef.current || (typeof document !== "undefined" ? document.querySelector("[data-pp-active-page]") : null);
    if (!el) { setPreview({ status: "error", message: "The page isn't on screen yet — open the passport and try again." }); return; }
    // Two stamps too big to share together at full size would print smaller
    // (the share frame scales a tall page down). Open on the first stamp at full
    // size instead; the preview still offers the other stamp and the whole page.
    const pgNow = page >= 1 && page - 1 < bookPages.length ? bookPages[page - 1] : null;
    const heroFirst = el === sharePageRef.current && pgNow && pgNow.stamps.length > 1 && el.offsetHeight > pageW * 1.6 + 4 ? pgNow.stamps[0] : null;
    setSharing(true);
    setPreview({ status: "rendering" });
    try {
      if (heroFirst) {
        setHeroStamp(heroFirst);
        await new Promise((r) => setTimeout(r, 60)); // let the hero node paint
        el = heroRef.current || el;
      }
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("rendering took too long")), 25000));
      const pageCanvas = await Promise.race([
        // onclone drops the page's inset spine shadow from the copy that is
        // drawn: html2canvas 1.4 paints an inset box-shadow as a dark fill
        // over the whole page (measured 2026-09-28). The screen keeps it.
        html2canvas(el, {
          useCORS: true, backgroundColor: "#FBF6EC", scale: 2, logging: false, imageTimeout: 8000,
          onclone: (doc) => { doc.querySelectorAll("[data-pp-active-page] *, [data-pp-share-page] *").forEach((n) => { if (n.style && /inset/.test(n.style.boxShadow || "")) n.style.boxShadow = "none"; }); },
        }),
        timeout,
      ]);
      const img = await composeShare(pageCanvas, "story_meta");
      // The memory photos on THIS page, in page order — the carousel's slides 2+.
      const pg = page >= 1 && page - 1 < bookPages.length ? bookPages[page - 1] : null;
      const photos = pg ? pg.stamps.flatMap((st) => (st.photos || []).filter((ph) => ph && ph.photo_url).map((ph) => ({ src: ph.photo_url, stamp: st }))) : [];
      if (!heroFirst) setHeroStamp(null);
      // The growth link: every share carries the traveler's landing URL —
      // the research's one multiplier (installs-per-share). Fetched lazily,
      // never blocks the render.
      let shareUrl = null;
      try { const { data: sl } = await getShareLink(); shareUrl = sl?.url || null; } catch { /* the image still shares */ }
      setPreview({ status: "ready", target: "instagram", use: "story", preset: "story_meta", subject: heroFirst ? heroFirst.id : "page", shareUrl, pageStamps: pg ? pg.stamps : [], pageCanvas, photos, mix: photos.length > 0 ? "both" : "page", slides: null, slidesPreset: null, slidesBusy: false, slideFailed: 0, ...img });
      logEvent("passport_share_open", { photos_on_page: photos.length }, "Passport");
    } catch (e) {
      try { console.error("[passport share] render failed", e); } catch { /* ignore */ }
      setPreview({ status: "error", message: e?.message || String(e) });
    } finally { setSharing(false); }
  }, [sharing, page, bookPages, pageW]);
  // Re-render the preview around ONE stamp (subject) or back to the page.
  const chooseSubject = useCallback(async (stampOrNull) => {
    if (!preview || preview.status !== "ready") return;
    setHeroStamp(stampOrNull);
    setPreview((p) => ({ ...p, status: "rendering", subject: stampOrNull ? stampOrNull.id : "page" }));
    try {
      await new Promise((r) => setTimeout(r, 60)); // let the hero node paint
      const el = stampOrNull ? heroRef.current : (sharePageRef.current || activePageRef.current || document.querySelector("[data-pp-active-page]"));
      if (!el) throw new Error("nothing to render");
      const pageCanvas = await html2canvas(el, {
        useCORS: true, backgroundColor: "#FBF6EC", scale: 2, logging: false, imageTimeout: 8000,
        onclone: (doc) => { doc.querySelectorAll("*").forEach((n) => { if (n.style && /inset/.test(n.style.boxShadow || "")) n.style.boxShadow = "none"; }); },
      });
      const img = await composeShare(pageCanvas, preview.preset || "story_meta");
      setPreview((p) => (p && { ...p, status: "ready", pageCanvas, subject: stampOrNull ? stampOrNull.id : "page", ...img }));
    } catch (e) {
      setPreview((p) => (p && { ...p, status: "ready" }));
      showToast(e?.message || "Could not render that stamp", "error");
    }
  }, [preview]);
  const slidesJob = useRef(0);
  const closePreview = useCallback(() => {
    slidesJob.current += 1; // cancels a slide build in flight
    setPreview((p) => { if (p?.url) { try { URL.revokeObjectURL(p.url); } catch { /* ignore */ } } revokeSlides(p?.slides); return null; });
  }, []);
  // Build the photo slides ahead of the Share tap: iOS only opens the sheet
  // when share() runs inside the tap itself.
  const buildSlides = useCallback(async (photos, presetId, cap) => {
    const job = ++slidesJob.current;
    setPreview((p) => (p && p.status === "ready" ? { ...p, slidesBusy: true } : p));
    const out = []; let failed = 0;
    for (const ph of (photos || []).slice(0, Math.max(0, Math.min(MAX_PHOTO_SLIDES, cap)))) {
      try { out.push(await photoSlide(ph.src, ph.stamp, presetId)); } catch { failed += 1; }
    }
    if (job !== slidesJob.current) { revokeSlides(out); return; }
    setPreview((p) => {
      if (!p || p.status !== "ready") { revokeSlides(out); return p; }
      revokeSlides(p.slides);
      return { ...p, slides: out, slidesPreset: presetId, slideFailed: failed, slidesBusy: false };
    });
  }, []);
  // A share can carry several images only as a post or a message, and only
  // where the destination takes more than one.
  const carouselFor = (p) => !!p && p.use !== "story" && targetById(p.target).max > 1 && (p.photos || []).length > 0;
  const needSlides = (p) => carouselFor(p) && p.mix !== "page" && (!p.slides || p.slidesPreset !== p.preset) && !p.slidesBusy;
  // What a post carries (founder, 2026-09-28: "let the user choose between the
  // slide 1 design or slide 2"): "page" = the stamp page with its photo
  // thumbnails, "photos" = each memory photo full size with the I was here!
  // band, "both" = the carousel, page first.
  const chooseMix = useCallback((mix) => {
    if (!preview || preview.status !== "ready" || preview.mix === mix) return;
    const next = { ...preview, mix };
    setPreview((p) => ({ ...p, mix }));
    if (needSlides(next)) buildSlides(next.photos, next.preset, targetById(next.target).max - (mix === "photos" ? 0 : 1));
  }, [preview, buildSlides]);
  // Destination + use → a preset; re-frame the already-rendered page (no second
  // html2canvas). Photo slides are rebuilt when the shape changes: Instagram
  // needs every carousel image in one shape.
  const chooseTarget = useCallback(async (targetId, useWanted) => {
    if (!preview || preview.status !== "ready") return;
    const t = targetById(targetId);
    const use = t.uses[useWanted] ? useWanted : (t.uses[preview.use] ? preview.use : Object.keys(t.uses)[0]);
    const preset = t.uses[use];
    if (t.id === preview.target && use === preview.use) return;
    try {
      const img = preset === preview.preset ? null : await composeShare(preview.pageCanvas, preset);
      const next = { ...preview, target: t.id, use, preset, ...(img || {}) };
      setPreview((p) => {
        if (img && p?.url) { try { URL.revokeObjectURL(p.url); } catch { /* ignore */ } }
        return { ...p, target: t.id, use, preset, ...(img || {}) };
      });
      if (needSlides(next)) buildSlides(next.photos, preset, t.max - (next.mix === "photos" ? 0 : 1));
    } catch (e) { setPreview({ status: "error", message: e?.message || String(e) }); }
  }, [preview, buildSlides]);
  const shareRendered = useCallback(async () => {
    if (!preview || preview.status !== "ready") return;
    const mix = carouselFor(preview) ? (preview.mix || "page") : "page";
    if (mix !== "page" && preview.slidesBusy) return; // slides still being drawn
    const carousel = mix !== "page" && preview.slidesPreset === preview.preset ? (preview.slides || []) : [];
    // "My photos" posts the photo slides alone; if none could be drawn, the page goes instead.
    const includePage = mix !== "photos" || !carousel.length;
    const text = preview.shareUrl ? `My Virtual Passport on Globeskimmers 🛂 ${preview.shareUrl}` : "My Virtual Passport on Globeskimmers 🛂";
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share") && Capacitor.isPluginAvailable("Filesystem")) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const uris = [];
        if (includePage) {
          const w = await Filesystem.writeFile({ path: `globeskimmers-passport-${preview.preset || "story_meta"}.png`, data: String(preview.dataUrl).split(",")[1], directory: Directory.Cache });
          uris.push(w.uri);
        }
        for (let i = 0; i < carousel.length; i++) {
          const ws = await Filesystem.writeFile({ path: `globeskimmers-passport-photo-${i + 1}.jpg`, data: String(carousel[i].dataUrl).split(",")[1], directory: Directory.Cache });
          uris.push(ws.uri);
        }
        const res = await Share.share({ title: "My Virtual Passport", text, url: preview.shareUrl || undefined, files: uris });
        logEvent("passport_share", { ...shareMeta(preview), images: uris.length, via: "app", activity: res?.activityType || null, platform: platformFromActivity(res?.activityType) || preview.target || "unknown" }, "Passport");
        closePreview(); return;
      }
      // Files are built synchronously from blobs already in memory, so share()
      // still runs inside the tap.
      const files = (includePage ? [new File([preview.blob], `globeskimmers-passport-${preview.preset || "story_meta"}.png`, { type: "image/png" })] : [])
        .concat(carousel.map((x, i) => new File([x.blob], `globeskimmers-passport-photo-${i + 1}.jpg`, { type: "image/jpeg" })));
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: "My Virtual Passport", text });
        logEvent("passport_share", { ...shareMeta(preview), images: files.length, via: "web", platform: preview.target || "unknown" }, "Passport");
        closePreview(); return;
      }
      if (files.length > 1 && navigator.canShare && navigator.canShare({ files: [files[0]] })) {
        await navigator.share({ files: [files[0]], title: "My Virtual Passport", text });
        logEvent("passport_share", { ...shareMeta(preview), images: 1, via: "web", partial: true, platform: preview.target || "unknown" }, "Passport");
        showToast(includePage ? "Your phone shared the stamp page only — add the photos from your camera roll" : "Your phone shared the first photo only — add the rest from your camera roll", "error");
        closePreview(); return;
      }
      if (!Capacitor.isNativePlatform()) {
        const a = document.createElement("a"); a.href = preview.url; a.download = "globeskimmers-passport.png";
        document.body.appendChild(a); a.click(); a.remove();
        logEvent("passport_share", { ...shareMeta(preview), images: 1, via: "download", platform: "saved" }, "Passport");
        showToast("Image saved", "success"); return;
      }
      showToast("This version of the app can't share images yet — update it from the store", "error");
    } catch (e) {
      // The traveler dismissed the sheet (web: AbortError; iOS plugin: "Share canceled").
      if (e?.name === "AbortError" || /cancel/i.test(String(e?.message || ""))) { logEvent("passport_share_cancel", shareMeta(preview), "Passport"); return; }
      showToast(`Couldn't share${e?.message ? ` — ${e.message}` : ""}`, "error");
    }
  }, [preview, closePreview]);
  const currentIsBlank = page > 0 && page - 1 >= stampCount;

  return (
    <div
      className="flex flex-col items-center outline-none"
      tabIndex={0}
      role="group"
      aria-label="Virtual Passport book"
      onKeyDown={onKey}
    >
      {/* Book stage */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ perspective: 2000, width: coverW, height: coverH, position: "relative" }}>
        {/* contact shadow */}
        <div aria-hidden style={{ position: "absolute", left: "8%", right: "8%", bottom: -10, height: 24, background: "radial-gradient(ellipse at center, rgba(0,0,0,.34), rgba(0,0,0,0) 70%)", filter: "blur(3px)", zIndex: 0 }} />

        {/* × on the open book (founder, 2026-09-28): the Close button below can
            sit behind the floating tab bar on some phones. Outside the page
            element, so it never appears in a shared image. */}
        {open && (
          <button type="button" onClick={closeBook} aria-label="Close passport"
            className="absolute flex items-center justify-center rounded-full"
            style={{ top: 10, right: 10, zIndex: 5, width: 36, height: 36, background: "#fff", border: `1px solid ${PAPER_EDGE}`, boxShadow: "0 2px 8px rgba(0,0,0,.14)" }}>
            <X size={18} color={INK} strokeWidth={2.4} />
          </button>
        )}
        {/* Interior pages (revealed beneath the opening cover) */}
        {open && (
          <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
            <AnimatePresence custom={dir} initial={false}>
              <motion.div
                key={page}
                ref={activePageRef}
                data-pp-active-page=""
                custom={dir}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: pageDur, ease: [0.22, 0.61, 0.36, 1] }}
                style={{ position: "absolute", inset: 0, transformOrigin: "center" }}
              >
                {renderPage(page)}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* The hidden hero page: one stamp at Updated-B scale, captured when a
            single stamp is shared. Offscreen but in the DOM (html2canvas needs
            a laid-out node). Width matches the real page so composeShare's
            typography lands identically. */}
        {heroStamp && (
          <div ref={heroRef} aria-hidden style={{ position: "absolute", left: -10000, top: 0, width: pageW, height: pageW * 1.6, background: PAPER, border: `1px solid ${PAPER_EDGE}`, borderRadius: 16, padding: 18, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <StampToken stamp={heroStamp} idx={0} onOpen={() => {}} pageW={heroStamp.kind === "airport" ? pageW : pageW * (HERO_FRAC / ART_FRAC)} />
          </div>
        )}

        {open && page >= 1 && page - 1 < bookPages.length && !(bookPages[page - 1].stamps.length === 1 && isPhotoFirst(bookPages[page - 1].stamps[0])) && (
          <div ref={sharePageRef} data-pp-share-page="" aria-hidden style={{ position: "absolute", left: -10000, top: 0, width: pageW }}>
            <StampPage pg={bookPages[page - 1]} onOpenStamp={() => {}} coverH={coverH} pageNo={page + 1} watermark={page % 2 === 0 ? "🌍" : "✈️"} pageW={pageW} share />
          </div>
        )}

        {/* Front cover — hinged at the left spine */}
        <AnimatePresence initial={false}>
          {!open && (
            <motion.button
              key="cover"
              onClick={openBook}
              aria-label="Open My Virtual Passport"
              initial={firstRender.current ? { rotateY: 0 } : { rotateY: -158, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: reduce ? 0 : -158, opacity: reduce ? 0 : 1 }}
              transition={{ duration: dur, ease: [0.33, 0, 0.15, 1] }}
              style={{
                position: "absolute", inset: 0, zIndex: 2,
                transformOrigin: "left center", transformStyle: "preserve-3d",
                backfaceVisibility: "hidden", borderRadius: 16, overflow: "hidden",
                background: NAVY_DEEP, padding: 0, border: "none",
                boxShadow: "0 20px 44px -16px rgba(0,0,0,.55)",
              }}
            >
              <img src={coverUrl} alt="Globeskimmers · My Virtual Passport" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Live region for page changes */}
      <div aria-live="polite" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {open ? pageLabel : "Passport closed"}
      </div>

      {/* The Blotter — reactions + guestbook live UNDER the page, never inside */}
      {open && page >= 1 && renderUnderPage && bookPages[page - 1] ? (
        <div style={{ width: pageW, maxWidth: "100%", margin: "10px auto 0" }}>
          {renderUnderPage(bookPages[page - 1].stamps)}
        </div>
      ) : null}

      {/* Controls (outside the book) */}
      {!open ? (
        !hintSeen && (
          <button onClick={openBook} className="mt-5" style={{ fontFamily: MONO, fontSize: fs(11), letterSpacing: ".08em", color: INK3, textTransform: "uppercase" }}>
            Tap to open ✦
          </button>
        )
      ) : (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => go(-1)} disabled={page === 0}
            aria-label="Previous page"
            className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30"
            style={{ background: "#fff", border: `1px solid ${PAPER_EDGE}` }}
          >
            <ChevronLeft size={18} color={INK} strokeWidth={2.2} />
          </button>
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".08em", color: INK3, minWidth: 64, textAlign: "center" }}>
            {`${page + 1} / ${total}`}
          </span>
          <button
            onClick={() => go(1)} disabled={page === total - 1}
            aria-label="Next page"
            className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30"
            style={{ background: "#fff", border: `1px solid ${PAPER_EDGE}` }}
          >
            <ChevronRight size={18} color={INK} strokeWidth={2.2} />
          </button>
          {!currentIsBlank && (
            <button
              onClick={renderCurrentPage} disabled={sharing}
              aria-label="Share this page"
              className="h-10 px-3 rounded-full flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "#fff", border: `1px solid ${PAPER_EDGE}`, color: INK, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".04em" }}
            >
              <Share2 size={14} color={STAMP} strokeWidth={2.2} /> {sharing ? "Rendering…" : "Share"}
            </button>
          )}
          <button
            onClick={closeBook}
            aria-label="Close passport"
            className="h-10 px-3 rounded-full flex items-center gap-1.5"
            style={{ background: NAVY, color: "#fff", fontFamily: MONO, fontSize: fs(11), letterSpacing: ".04em" }}
          >
            <X size={14} color={GOLD} strokeWidth={2.4} /> Close
          </button>
          {!currentIsBlank && (
            <p className="w-full text-center" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".04em", color: INK3, lineHeight: 1.5, marginTop: 2 }}>
              Shared pages print big: a story fills the whole screen, a post fills the frame.
            </p>
          )}
        </div>
      )}

      {/* Share preview — status on screen from the first tap: rendering → the
          branded image (then the sheet on a fresh tap) → or the exact error. */}
      {preview && (
        <div onClick={closePreview} className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Share this page"
          style={{ background: "rgba(12,10,8,0.88)", backdropFilter: "blur(4px)" }}>
          {preview.status === "ready" ? (
            <img src={(carouselFor(preview) && preview.mix === "photos" && preview.slidesPreset === preview.preset && preview.slides?.[0]?.url) || preview.url}
              alt={carouselFor(preview) && preview.mix === "photos" && preview.slides?.length ? "Your first memory photo, ready to share" : "Your passport page, ready to share"}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "92vw", maxHeight: "62vh", objectFit: "contain", borderRadius: 12, boxShadow: "0 24px 60px -20px rgba(0,0,0,.6)" }} />
          ) : (
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[380px] rounded-[16px] px-5 py-6 text-center" style={{ background: PAPER, color: INK }}>
              <div style={{ fontFamily: SERIF, fontSize: fs(22), lineHeight: 1.15 }}>{preview.status === "rendering" ? "Preparing your page…" : "Couldn't prepare this page"}</div>
              <div className="mt-2" style={{ fontFamily: MONO, fontSize: fs(11.5), color: INK3, lineHeight: 1.5, wordBreak: "break-word" }}>
                {preview.status === "rendering" ? "A few seconds — the stamps and photos are being drawn into one image." : preview.message}
              </div>
            </div>
          )}
          <div className="w-full max-w-[380px] mt-4 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            {preview.status === "ready" && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="radiogroup" aria-label="Where to share" style={{ scrollbarWidth: "none" }}>
                {SHARE_TARGETS.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={preview.target === t.id} onClick={() => chooseTarget(t.id, preview.use)}
                    className="flex-none rounded-full px-3 py-1.5 font-semibold"
                    style={{ background: preview.target === t.id ? "#FBF6EC" : "rgba(255,255,255,0.1)", color: preview.target === t.id ? NAVY : "#fff", border: "1px solid rgba(255,255,255,0.25)", fontSize: fs(12.5) }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            {preview.status === "ready" && (
              <div className="flex gap-2" role="radiogroup" aria-label="Share as">
                {Object.keys(targetById(preview.target).uses).map((u) => (
                  <button key={u} type="button" role="radio" aria-checked={preview.use === u} onClick={() => chooseTarget(preview.target, u)}
                    className="flex-1 rounded-lg py-2 font-semibold"
                    style={{ background: preview.use === u ? "#FBF6EC" : "rgba(255,255,255,0.1)", color: preview.use === u ? NAVY : "#fff", border: "1px solid rgba(255,255,255,0.25)", fontFamily: MONO, fontSize: fs(11.5), letterSpacing: ".04em" }}>
                    {shareUseLabel(preview.target, u)}
                  </button>
                ))}
              </div>
            )}
            {preview.status === "ready" && (preview.pageStamps || []).length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="What to render" style={{ scrollbarWidth: "none" }}>
                <button type="button" role="radio" aria-checked={preview.subject === "page"} onClick={() => chooseSubject(null)}
                  className="flex-none rounded-lg px-3 py-2 font-semibold"
                  style={{ background: preview.subject === "page" ? "#FBF6EC" : "rgba(255,255,255,0.1)", color: preview.subject === "page" ? NAVY : "#fff", border: "1px solid rgba(255,255,255,0.25)", fontSize: fs(12) }}>
                  Whole page
                </button>
                {(preview.pageStamps || []).map((st) => (
                  <button key={st.id} type="button" role="radio" aria-checked={preview.subject === st.id} onClick={() => chooseSubject(st)}
                    className="flex-none rounded-lg px-3 py-2 font-semibold max-w-[46%] truncate"
                    style={{ background: preview.subject === st.id ? "#FBF6EC" : "rgba(255,255,255,0.1)", color: preview.subject === st.id ? NAVY : "#fff", border: "1px solid rgba(255,255,255,0.25)", fontSize: fs(12) }}>
                    {st.name} · big
                  </button>
                ))}
              </div>
            )}
            {preview.status === "ready" && carouselFor(preview) && (
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <div className="flex gap-1.5" role="radiogroup" aria-label="What to post">
                  {[["page", "Stamp page"], ["photos", "My photos"], ["both", "Both"]].map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={preview.mix === id} onClick={() => chooseMix(id)}
                      className="flex-1 rounded-lg py-2 font-semibold"
                      style={{ background: preview.mix === id ? STAMP : "rgba(255,255,255,0.08)", color: "#fff", border: `1px solid ${preview.mix === id ? STAMP : "rgba(255,255,255,0.25)"}`, fontSize: fs(12.5) }}>
                      {label}
                    </button>
                  ))}
                </div>
                <p style={{ color: "rgba(255,252,247,0.78)", fontSize: fs(12), marginTop: 8, lineHeight: 1.4 }}>
                  {preview.mix === "page" ? "The stamp page, with your photos as the thumbnails on it."
                    : preview.mix === "photos" ? "Each memory photo full size, with I was here!, the place and the date."
                    : "A carousel: the stamp page first, then each photo full size."}
                </p>
                {preview.mix !== "page" && (
                  <div className="flex gap-1.5 mt-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                    {preview.mix === "both" && (
                      <img src={preview.url} alt="Slide 1: the stamp page" style={{ width: 44, height: 55, objectFit: "cover", borderRadius: 6, border: "1.5px solid #FBF6EC", flex: "none" }} />
                    )}
                    {preview.slidesBusy
                      ? <span style={{ fontFamily: MONO, fontSize: fs(11), color: "rgba(255,252,247,0.75)", alignSelf: "center", paddingLeft: 4 }}>Preparing your photos…</span>
                      : (preview.slides || []).map((x, i) => (
                          <img key={i} src={x.url} alt={`Memory photo ${i + 1}`} style={{ width: 44, height: 55, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", flex: "none" }} />
                        ))}
                  </div>
                )}
                {preview.mix !== "page" && preview.slideFailed > 0 && (
                  <p style={{ color: "#F3B2A5", fontSize: fs(12), marginTop: 6 }}>{preview.slideFailed} photo{preview.slideFailed === 1 ? "" : "s"} couldn&apos;t be added.</p>
                )}
              </div>
            )}
            {preview.status === "ready" && (() => {
              const mix = carouselFor(preview) ? (preview.mix || "page") : "page";
              const busy = mix !== "page" && preview.slidesBusy;
              const slides = mix !== "page" && preview.slidesPreset === preview.preset ? (preview.slides || []).length : 0;
              const n = (mix === "photos" && slides ? 0 : 1) + slides;
              const dest = `${targetById(preview.target).label} ${shareUseLabel(preview.target, preview.use)}`;
              return (
                <button onClick={shareRendered} disabled={busy} className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: STAMP, color: "#fff", fontSize: fs(15), border: "none" }}>
                  <Share2 size={16} color="#fff" strokeWidth={2.2} />
                  {busy ? "Preparing your photos…" : n > 1 ? `Share to ${dest} · ${n} images` : `Share to ${dest}`}
                </button>
              );
            })()}
            <button onClick={closePreview} className="w-full rounded-xl py-2.5 font-semibold"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: fs(13.5), border: "1px solid rgba(255,255,255,0.25)" }}>
              Close
            </button>
            <p className="text-center" style={{ fontFamily: MONO, fontSize: fs(10.5), color: "rgba(255,252,247,0.6)", letterSpacing: ".04em" }}>
              Sized for {targetById(preview.target).label}. Your phone&apos;s share sheet opens next — pick {targetById(preview.target).label} there.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
