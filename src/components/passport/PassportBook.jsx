import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import html2canvas from "html2canvas";
import { ChevronLeft, ChevronRight, X, Share2 } from "lucide-react";
import { countryCode } from "@/lib/countries";
import { stampArtUrl } from "@/lib/stampArt";
import AirportStamp from "@/components/passport/AirportStamp";

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
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#243447", INK3 = "#66717D", STAMP = "#B0472F";
const PAPER = "#FBF6EC", PAPER_EDGE = "#EADFC9";
const NAVY = "#0C2B50", NAVY_DEEP = "#071B33", GOLD = "#D6A64A";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const KIND = {
  country: "🌍", city: "🏙️", airport: "✈️", icon: "🗽", wonder: "🏔️", attraction: "📍",
};
const flagFor = (country) => {
  const cc = countryCode(country);
  if (!cc || !/^[a-z]{2}$/i.test(cc)) return "🗺️";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

// A large stamp pressed onto the page. Airport ≈ ⅓ page; iconic ≈ ½ page with
// "I was here!", a big ink date, and up to 4 memory photos in a 2×2 grid.
function StampToken({ stamp, idx, onOpen }) {
  const [artFail, setArtFail] = useState(false);
  const rot = ((idx * 47 + 3) % 9) - 4;   // deterministic -4..+4°
  const nudge = ((idx * 53) % 26) - 13;    // deterministic -13..+12px horizontal
  const art = stamp.kind === "country" ? null : stampArtUrl(stamp.name);
  const showArt = !!art && !artFail;
  const flag = stamp.kind === "country" ? flagFor(stamp.country || stamp.name) : null;
  const isAirport = stamp.kind === "airport";
  const bigDate = stamp.visited_on
    ? new Date(stamp.visited_on + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  const photos = (stamp.photos || []).slice(0, 4);
  return (
    <button
      onClick={() => onOpen(stamp)}
      aria-label={`Open stamp: ${stamp.name}`}
      className="relative active:scale-95 transition-transform"
      style={{ transform: `translateX(${nudge}px) rotate(${rot}deg)`, width: isAirport ? "94%" : "88%", maxWidth: isAirport ? 340 : 320 }}
    >
      {isAirport ? (
        <div className="flex flex-col items-center w-full">
          <AirportStamp iata={stamp.entity_id} city={stamp.city} countryCode={stamp.country} date={stamp.visited_on} width={320} />
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          {showArt ? (
            <img src={art} alt={stamp.name} loading="lazy" onError={() => setArtFail(true)} style={{ width: 210, height: 210, objectFit: "contain" }} />
          ) : (
            <div className="flex flex-col items-center justify-center text-center" style={{ width: 190, height: 190, borderRadius: 20, border: `2.5px solid ${STAMP}`, background: "rgba(255,255,255,.45)", padding: 12 }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>{flag || KIND[stamp.kind] || KIND.attraction}</span>
              <span className="leading-tight" style={{ fontFamily: SERIF, fontSize: fs(22), color: STAMP, marginTop: 4 }}>{stamp.name}</span>
            </div>
          )}
          <div style={{ fontFamily: SERIF, fontStyle: "italic", color: STAMP, fontSize: fs(19), marginTop: 6, lineHeight: 1 }}>I was here!</div>
          {bigDate && <div style={{ fontFamily: SERIF, color: STAMP, fontSize: fs(23), letterSpacing: ".01em", marginTop: 2, lineHeight: 1 }}>{bigDate}</div>}
        </div>
      )}

      {/* Memory photos — 2×2 grid, max 4, under the date */}
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, width: 168, marginLeft: "auto", marginRight: "auto" }}>
          {photos.map((p) => (
            <img key={p.id} src={p.photo_url} alt="" loading="lazy"
              style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, border: `1px solid ${PAPER_EDGE}` }} />
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
      <div style={{ position: "relative", height: "100%", overflowY: "auto", scrollbarWidth: "none" }}>{children}</div>
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
function StampPage({ pg, onOpenStamp, coverH, pageNo, watermark }) {
  return (
    <Paper coverH={coverH} pageNo={pageNo} watermark={watermark}>
      <div style={{ position: "relative", minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: pg.stamps.length <= 1 ? "center" : "space-around", gap: 20, paddingTop: 12, paddingBottom: 22 }}>
        {pg.stamps.map((s, j) => <StampToken key={s.id} stamp={s} idx={j} onOpen={() => onOpenStamp(s.id)} />)}
      </div>
    </Paper>
  );
}

// Blank ivory page — trailing fresh pages waiting for stamps.
function EmptyCollectionPage({ coverH, pageNo, watermark }) {
  return <Paper coverH={coverH} pageNo={pageNo} watermark={watermark} />;
}

export default function PassportBook({
  pages, holder, homeCountry, countries, totalStamps, onOpenStamp,
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

  const stampCount = pages.length;
  const MIN_TOTAL = 10; // a fresh passport ships as a 10-page booklet to flip through
  // ownership + every stamp page + always ≥1 trailing blank (auto-grows as stamps fill up)
  const total = Math.max(MIN_TOTAL, 1 + stampCount + 1);
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
    if (ci < stampCount) return <StampPage pg={pages[ci]} onOpenStamp={onOpenStamp} coverH={coverH} pageNo={pageNo} watermark={watermark} />;
    return <EmptyCollectionPage coverH={coverH} pageNo={pageNo} watermark={watermark} />;
  };

  const pageLabel = `Page ${page + 1} of ${total}`;

  // Share the current page as an image → native share sheet (Messages, WhatsApp,
  // Instagram, Snapchat, Facebook, LinkedIn, TikTok, Mail — whatever's installed).
  const activePageRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const shareCurrentPage = useCallback(async () => {
    const el = activePageRef.current;
    if (!el || sharing) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(el, { useCORS: true, backgroundColor: "#FBF6EC", scale: 2, logging: false });
      // Baked-in brand watermark — every share markets the app.
      try {
        const ctx = canvas.getContext("2d");
        const pad = Math.round(canvas.width * 0.03);
        ctx.font = `600 ${Math.round(canvas.width * 0.036)}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(11,43,80,0.5)";
        ctx.fillText("Globeskimmers 🛂", canvas.width / 2, canvas.height - pad);
      } catch { /* watermark best-effort */ }
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("render failed");
      const file = new File([blob], "globeskimmers-passport.png", { type: "image/png" });
      const data = { files: [file], title: "My Virtual Passport", text: "My Virtual Passport on Globeskimmers 🛂" };
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share(data);
      } else {
        // Fallback (share sheet or file-share unsupported): save the image.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "globeskimmers-passport.png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch { /* user cancelled or render failed — no-op */ }
    finally { setSharing(false); }
  }, [sharing]);
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

        {/* Interior pages (revealed beneath the opening cover) */}
        {open && (
          <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
            <AnimatePresence custom={dir} initial={false}>
              <motion.div
                key={page}
                ref={activePageRef}
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
              onClick={shareCurrentPage} disabled={sharing}
              aria-label="Share this page"
              className="h-10 px-3 rounded-full flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "#fff", border: `1px solid ${PAPER_EDGE}`, color: INK, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".04em" }}
            >
              <Share2 size={14} color={STAMP} strokeWidth={2.2} /> {sharing ? "…" : "Share"}
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
    </div>
  );
}
