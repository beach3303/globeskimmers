import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import html2canvas from "html2canvas";
import { ChevronLeft, ChevronRight, X, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { showToast } from "@/components/Toast";
import { countryCode } from "@/lib/countries";
import { stampArtUrl } from "@/lib/stampArt";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";
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
// Stamp width as a share of the page width. 0.50 until 2026-09-28; the founder
// chose ink B and asked for the place name, "I was here!" and the date two to
// three sizes larger — scaling the whole stamp 1.28× does exactly that (the
// name is already fitted to the stamp's width, so only the stamp can grow).
// On a phone this means one stamp per page, like a real passport page.
const ART_FRAC = 0.64;

const KIND = {
  country: "🌍", city: "🏙️", airport: "✈️", icon: "🗽", wonder: "🏔️", attraction: "📍",
};
const flagFor = (country) => {
  const cc = countryCode(country);
  if (!cc || !/^[a-z]{2}$/i.test(cc)) return "🗺️";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

// A large stamp pressed onto the page, sized off the page width so heights are a
// constant fraction across phones (lets pagination fit each page with no scroll).
// Airport ≈ ⅓ page; iconic ≈ ½ page with "I was here!", a big ink date, and up
// to 4 memory photos in a 2×2 grid.
function StampToken({ stamp, idx, onOpen, pageW }) {
  const [artFail, setArtFail] = useState(false);
  const rot = ((idx * 47 + 3) % 9) - 4;   // deterministic -4..+4°
  const nudge = ((idx * 53) % 26) - 13;    // deterministic -13..+12px horizontal
  const art = stamp.kind === "country" ? null : stampArtUrl(stamp.name);
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
  const artW = Math.round(ART_FRAC * pageW);
  const badgeW = Math.round(0.5 * pageW);
  const airportW = Math.round(0.82 * pageW);
  const thumbW = Math.round(0.185 * pageW);
  return (
    <button
      onClick={() => onOpen(stamp)}
      aria-label={`Open stamp: ${stamp.name}`}
      className="relative active:scale-95 transition-transform"
      style={{ transform: `translateX(${nudge}px) rotate(${rot}deg)`, maxWidth: "100%" }}
    >
      {isAirport ? (
        <div className="flex flex-col items-center">
          <AirportStamp iata={stamp.entity_id} city={stamp.city} country={stamp.country} countryCode={stamp.country} date={stamp.visited_on} width={airportW} />
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
            <img src={art} alt={stamp.name} loading="lazy" onError={() => setArtFail(true)} style={{ width: artW, height: artW, objectFit: "contain" }} />
          ) : (
            // No bespoke art yet → the typographic stamp (carries its own name,
            // date and "I was here!" strike). Auto-upgrades when a PNG lands on R2.
            <TypographicStamp
              name={stamp.name} city={stamp.city} region={stamp.region}
              country={stamp.country} date={stamp.visited_on}
              entityId={stamp.entity_id || stamp.id} width={artW} overprint strength={STAMP_INK_STRENGTH}
            />
          )}
          {showArt ? (
            // Under the engraving: the full caption.
            <>
              <div style={{ fontFamily: SANS, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".012em", color: cityInk, fontSize: fs(15), lineHeight: 1.08, marginTop: 8 }}>
                Visited {stamp.city || stamp.name}{stamp.country ? `, ${stamp.country}` : ""}
              </div>
              {venue && <div style={{ fontFamily: SERIF, fontStyle: "italic", color: cityInk, fontSize: fs(17), marginTop: 4, lineHeight: 1.1 }}>I was here @ {venue}</div>}
              {bigDate && <div style={{ fontFamily: MONO, color: cityInk, opacity: 0.7, fontSize: fs(11.5), letterSpacing: ".03em", marginTop: 6 }}>{bigDate}</div>}
            </>
          ) : (
            // The typographic stamp already says the name + date + "I was
            // here!" — only add the city context when the stamp is a specific
            // spot within a city (e.g. LAKE LOUISE → "Visited Banff, Canada").
            venue && stamp.city && (
              <div style={{ fontFamily: MONO, color: cityInk, opacity: 0.95, fontSize: fs(13), letterSpacing: ".04em", textTransform: "uppercase", marginTop: 8 }}>
                Visited {stamp.city}{stamp.country ? `, ${stamp.country}` : ""}
              </div>
            )
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {showArt ? (
            <img src={art} alt={stamp.name} loading="lazy" onError={() => setArtFail(true)} style={{ width: artW, height: artW, objectFit: "contain" }} />
          ) : flag ? (
            // Country stamp with no bespoke art → flag badge.
            <div className="flex flex-col items-center justify-center text-center" style={{ width: badgeW, height: badgeW, borderRadius: 20, border: `2.5px solid ${STAMP}`, background: "rgba(255,255,255,.45)", padding: 12 }}>
              <span style={{ fontSize: Math.round(0.1 * pageW), lineHeight: 1 }}>{flag}</span>
              <span className="leading-tight" style={{ fontFamily: SERIF, fontSize: fs(22), color: STAMP, marginTop: 4 }}>{stamp.name}</span>
            </div>
          ) : (
            // Iconic place, bespoke art not uploaded yet → an inked rubber-stamp
            // placeholder. Auto-upgrades to the illustration once its art lands on R2.
            <TypographicStamp
              name={stamp.name} city={stamp.city} region={stamp.region}
              country={stamp.country} date={stamp.visited_on}
              entityId={stamp.entity_id || stamp.id} width={artW} overprint strength={STAMP_INK_STRENGTH}
            />
          )}
          {!showTypo && (<>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", color: iconicInk, fontSize: fs(19), marginTop: 6, lineHeight: 1 }}>I was here!</div>
            {bigDate && <div style={{ fontFamily: SERIF, color: iconicInk, fontSize: fs(23), letterSpacing: ".01em", marginTop: 2, lineHeight: 1 }}>{bigDate}</div>}
          </>)}
        </div>
      )}

      {/* Memory photos — 2×2 grid, max 4, under the date */}
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, width: thumbW * 2 + 8, marginLeft: "auto", marginRight: "auto" }}>
          {photos.map((p) => (
            <img key={p.id} src={p.photo_url} alt="" loading="lazy"
              style={{ width: thumbW, height: thumbW, objectFit: "cover", borderRadius: 10, border: `1px solid ${PAPER_EDGE}` }} />
          ))}
        </div>
      )}

      {stamp.verified === "gps" && (
        <span className="absolute" style={{ top: -6, right: isAirport ? 10 : 22, background: "#2E6B4E", color: "#fff", fontSize: 13, fontWeight: 700, width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }}>✓</span>
      )}
    </button>
  );
}

// Ivory paper wrapper shared by every interior page. Carries a faint alternating
// ✈️/🌍 watermark and a page number in the lower outer (right) corner.
function Paper({ children, coverH, pageNo, watermark }) {
  return (
    <div style={{
      background: PAPER, border: `1px solid ${PAPER_EDGE}`, borderRadius: 16,
      padding: 18, position: "relative", overflow: "hidden",
      minHeight: coverH, height: "100%",
      boxShadow: "inset 13px 0 22px -18px rgba(0,0,0,.4), inset -6px 0 14px -12px rgba(0,0,0,.2)",
    }}>
      {watermark && (
        <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.06, fontSize: 180, pointerEvents: "none" }}>{watermark}</div>
      )}
      <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>{children}</div>
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

// A page of big stamps — can mix countries (each stamp carries its own place).
// Pagination upstream guarantees the stamps fit, so there is never any scrolling.
function StampPage({ pg, onOpenStamp, coverH, pageNo, watermark, pageW }) {
  return (
    <Paper coverH={coverH} pageNo={pageNo} watermark={watermark}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: pg.stamps.length <= 1 ? "center" : "space-around", gap: 18, paddingTop: 12, paddingBottom: 22 }}>
        {pg.stamps.map((s, j) => <StampToken key={s.id} stamp={s} idx={j} onOpen={() => onOpenStamp(s.id)} pageW={pageW} />)}
      </div>
    </Paper>
  );
}

// The shared image at Instagram's exact sizes (founder, 2026-09-28: the first
// story needed shrinking by hand to show the header and footer, and a feed post
// cropped it). Story 1080×1920: brand + "My Virtual Passport" and the footer sit
// inside Instagram's safe area (its top bar covers ~11%, the reply bar ~12%).
// Post 1080×1350 (4:5, the tallest feed size): the header drops to one small
// line so the page — and "I was here!" — gets the height. The rendered page is
// scaled to fit between them, never cropped. System fonts first on purpose:
// the canvas can't wait for web fonts, and a fallback that renders beats a blank.
export const SHARE_FORMATS = {
  story: { W: 1080, H: 1920, label: "Story · 9:16" },
  post: { W: 1080, H: 1350, label: "Post · 4:5" },
};
const SHARE_FOOTER = "collect stamps & memories where you go";
function brandShareCanvas(page, format = "story") {
  const { W, H } = SHARE_FORMATS[format] || SHARE_FORMATS.story;
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  const bg = ctx.createRadialGradient(W / 2, H * 0.2, 0, W / 2, H * 0.2, H * 0.95);
  bg.addColorStop(0, "#12365F"); bg.addColorStop(0.7, NAVY_DEEP); bg.addColorStop(1, NAVY_DEEP);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const serif = '"Instrument Serif", "Iowan Old Style", Georgia, "Times New Roman", serif';
  const sans = '-apple-system, "Inter Tight", system-ui, sans-serif';
  const brand = "G L O B E S K I M M E R S";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  let zoneTop, zoneBottom;
  if (format === "post") {
    // One line: GLOBESKIMMERS · My Virtual Passport
    const bf = `600 ${Math.round(W * 0.026)}px ${sans}`, tf = `${Math.round(W * 0.046)}px ${serif}`;
    ctx.font = bf; const bw = ctx.measureText(brand).width;
    ctx.font = tf; const tw = ctx.measureText("My Virtual Passport").width;
    const dot = W * 0.03, x0 = (W - (bw + dot + tw)) / 2, y = H * 0.068;
    ctx.textAlign = "left";
    ctx.font = bf; ctx.fillStyle = GOLD; ctx.fillText(brand, x0, y);
    ctx.fillText("·", x0 + bw + dot * 0.35, y);
    ctx.font = tf; ctx.fillStyle = "#FBF6EC"; ctx.fillText("My Virtual Passport", x0 + bw + dot, y);
    ctx.textAlign = "center";
    zoneTop = H * 0.10; zoneBottom = H * 0.91;
    ctx.font = `500 ${Math.round(W * 0.027)}px ${sans}`; ctx.fillStyle = "rgba(251,246,236,0.9)";
    ctx.fillText(`globeskimmers.io  ·  ${SHARE_FOOTER}`, W / 2, H * 0.962);
  } else {
    ctx.font = `600 ${Math.round(W * 0.036)}px ${sans}`; ctx.fillStyle = GOLD;
    ctx.fillText(brand, W / 2, H * 0.148);
    ctx.font = `${Math.round(W * 0.082)}px ${serif}`; ctx.fillStyle = "#FBF6EC";
    ctx.fillText("My Virtual Passport", W / 2, H * 0.198);
    zoneTop = H * 0.228; zoneBottom = H * 0.802;
    ctx.font = `600 ${Math.round(W * 0.032)}px ${sans}`; ctx.fillStyle = "#FBF6EC";
    ctx.fillText("globeskimmers.io", W / 2, H * 0.836);
    ctx.font = `500 ${Math.round(W * 0.032)}px ${sans}`; ctx.fillStyle = "rgba(251,246,236,0.9)";
    ctx.fillText(SHARE_FOOTER, W / 2, H * 0.862);
  }
  const zh = zoneBottom - zoneTop, zw = W * 0.9;
  const k = Math.min(zh / page.height, zw / page.width);
  const pw = page.width * k, ph = page.height * k;
  ctx.drawImage(page, (W - pw) / 2, zoneTop + (zh - ph) / 2, pw, ph);
  return out;
}
const composeShare = async (pageCanvas, format) => {
  const canvas = brandShareCanvas(pageCanvas, format);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("the image could not be encoded");
  return { url: URL.createObjectURL(blob), blob, dataUrl: canvas.toDataURL("image/png") };
};

// Blank ivory page — trailing fresh pages waiting for stamps.
function EmptyCollectionPage({ coverH, pageNo, watermark }) {
  return <Paper coverH={coverH} pageNo={pageNo} watermark={watermark} />;
}

export default function PassportBook({
  stamps, holder, homeCountry, countries, totalStamps, onOpenStamp,
  coverUrl = PASSPORT_COVER_URL,
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

  // First-fit packing: each stamp goes on the earliest page it fits (so a later
  // small stamp can back-fill an earlier page's gap); if it fits nowhere, a new
  // page. Estimated heights slightly over-count so a page never overflows.
  const bookPages = useMemo(() => {
    const pageH = pageW * 1.6, USABLE = pageH - 70, GAP = 18;
    const thumbW = 0.185 * pageW, airportW = 0.82 * pageW;
    const estH = (s) => {
      const n = Math.min(4, (s.photos || []).length);
      const rows = n > 0 ? Math.ceil(n / 2) : 0;
      const photosH = rows > 0 ? rows * thumbW + (rows - 1) * 8 + 14 : 0;
      if (s.kind === "airport") return (0.659 * airportW + 14 + photosH) * 1.03;
      // City/place stamps render the same art-or-typographic stamp as iconic
      // ones (plus a caption line), so they are estimated at the stamp's real
      // height — the old 110px guess predates that and let pages overflow.
      if (s.kind === "city") return (ART_FRAC * pageW + 46 + photosH) * 1.05;
      return (ART_FRAC * pageW + 52 + photosH) * 1.03;
    };
    // A stamp whose layout is 'solo' (founder, 2026-09-26: "move a stamp to a
    // solo page") always gets a page of its own, and no later stamp back-fills
    // that page. 'auto' (the default) packs as before.
    const packed = [];
    for (const s of (stamps || [])) {
      const h = estH(s);
      const solo = s.layout === "solo";
      let placed = false;
      if (!solo) for (const pg of packed) {
        if (pg.solo) continue;
        const cost = h + (pg.items.length ? GAP : 0);
        if (pg.used + cost <= USABLE) { pg.items.push(s); pg.used += cost; placed = true; break; }
      }
      if (!placed) packed.push({ items: [s], used: h, solo });
    }
    return packed.map((p, i) => ({ key: `pg-${i}`, stamps: p.items, solo: p.solo }));
  }, [stamps, pageW]);

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
    return <EmptyCollectionPage coverH={coverH} pageNo={pageNo} watermark={watermark} />;
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
    const el = activePageRef.current || (typeof document !== "undefined" ? document.querySelector("[data-pp-active-page]") : null);
    if (!el) { setPreview({ status: "error", message: "The page isn't on screen yet — open the passport and try again." }); return; }
    setSharing(true);
    setPreview({ status: "rendering" });
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("rendering took too long")), 25000));
      const pageCanvas = await Promise.race([
        html2canvas(el, { useCORS: true, backgroundColor: "#FBF6EC", scale: 2, logging: false, imageTimeout: 8000 }),
        timeout,
      ]);
      const img = await composeShare(pageCanvas, "story");
      setPreview({ status: "ready", format: "story", pageCanvas, ...img });
    } catch (e) {
      try { console.error("[passport share] render failed", e); } catch { /* ignore */ }
      setPreview({ status: "error", message: e?.message || String(e) });
    } finally { setSharing(false); }
  }, [sharing]);
  const closePreview = useCallback(() => {
    setPreview((p) => { if (p?.url) { try { URL.revokeObjectURL(p.url); } catch { /* ignore */ } } return null; });
  }, []);
  // Story ↔ Post: re-frame the already-rendered page (no second html2canvas).
  const switchFormat = useCallback(async (format) => {
    if (!preview || preview.status !== "ready" || preview.format === format) return;
    try {
      const img = await composeShare(preview.pageCanvas, format);
      setPreview((p) => { if (p?.url) { try { URL.revokeObjectURL(p.url); } catch { /* ignore */ } } return { ...p, format, ...img }; });
    } catch (e) { setPreview({ status: "error", message: e?.message || String(e) }); }
  }, [preview]);
  const shareRendered = useCallback(async () => {
    if (!preview || preview.status !== "ready") return;
    const text = "My Virtual Passport on Globeskimmers 🛂";
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share") && Capacitor.isPluginAvailable("Filesystem")) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const base64 = String(preview.dataUrl).split(",")[1];
        const w = await Filesystem.writeFile({ path: `globeskimmers-passport-${preview.format || "story"}.png`, data: base64, directory: Directory.Cache });
        await Share.share({ title: "My Virtual Passport", text, files: [w.uri] });
        closePreview(); return;
      }
      const file = new File([preview.blob], "globeskimmers-passport.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Virtual Passport", text });
        closePreview(); return;
      }
      if (!Capacitor.isNativePlatform()) {
        const a = document.createElement("a"); a.href = preview.url; a.download = "globeskimmers-passport.png";
        document.body.appendChild(a); a.click(); a.remove();
        showToast("Image saved", "success"); return;
      }
      showToast("This version of the app can't share images yet — update it from the store", "error");
    } catch (e) {
      if (e?.name === "AbortError") return; // the traveler dismissed the sheet
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
        </div>
      )}

      {/* Share preview — status on screen from the first tap: rendering → the
          branded image (then the sheet on a fresh tap) → or the exact error. */}
      {preview && (
        <div onClick={closePreview} className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Share this page"
          style={{ background: "rgba(12,10,8,0.88)", backdropFilter: "blur(4px)" }}>
          {preview.status === "ready" ? (
            <img src={preview.url} alt="Your passport page, ready to share" onClick={(e) => e.stopPropagation()}
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
              <div className="flex gap-2" role="radiogroup" aria-label="Image size">
                {Object.entries(SHARE_FORMATS).map(([id, f]) => (
                  <button key={id} type="button" role="radio" aria-checked={preview.format === id} onClick={() => switchFormat(id)}
                    className="flex-1 rounded-lg py-2 font-semibold"
                    style={{ background: preview.format === id ? "#FBF6EC" : "rgba(255,255,255,0.1)", color: preview.format === id ? NAVY : "#fff", border: "1px solid rgba(255,255,255,0.25)", fontFamily: MONO, fontSize: fs(11.5), letterSpacing: ".04em" }}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {preview.status === "ready" && (
            <button onClick={shareRendered} className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2"
              style={{ background: STAMP, color: "#fff", fontSize: fs(15), border: "none" }}>
              <Share2 size={16} color="#fff" strokeWidth={2.2} /> Share to Instagram, Facebook, Snapchat, X…
            </button>
            )}
            <button onClick={closePreview} className="w-full rounded-xl py-2.5 font-semibold"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: fs(13.5), border: "1px solid rgba(255,255,255,0.25)" }}>
              Close
            </button>
            <p className="text-center" style={{ fontFamily: MONO, fontSize: fs(10.5), color: "rgba(255,252,247,0.6)", letterSpacing: ".04em" }}>
              Opens your phone&apos;s share sheet — pick a story, a post or a message.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
