// CityBoard: a city's board (founder, 2026-10-03: "i love the city board"; built
// 2026-10-14; the billboard, 2026-10-16). A painted header in a deco frame — the city's
// art kit when it has one, the plain plate until then — over a dense wall: the reviewed
// photos of every public stamp taken there, three across, with the postcards addressed
// to the city woven in as full-width cards. Tap a photo to see it large, signed with its
// @username. /CityBoard?city=Lisbon&country=Portugal; a US state is
// ?kind=state&region=Texas&country=United%20States and a country ?kind=country&country=Ghana —
// those roll up everything inside them and take no posts of their own.
//
// 'Post to this city board' shows only when the worker says you can (can_post: an adult with a
// verified stamp there); otherwise one line says how to earn it. It shows nothing untrue:
// nothing social until the age tier is known; the hold or birthday note for a held
// account; a skeleton while the first page loads; 'Try again' when a read fails; an empty
// board only when the read worked; and before the worker has boards, a line saying the
// board opens with the next update. Each card's '•••' opens TravelerSheet (Report,
// Unfollow, Block); cards from people you blocked never show.
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, Mail, Stamp, X } from "lucide-react";
import Guestbook, { BOARD_PROMPTS } from "@/components/Guestbook";
import { createPageUrl } from "@/utils";
import { cityBoardUrl } from "@/lib/boardLinks";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { blotterReadBoard, cityBoard, getHandle, getSocialProfile } from "@/lib/passport";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { whenLabel } from "@/components/social/Envelope";
import PostcardCard from "@/components/social/PostcardCard";
import PostcardCompose from "@/components/passport/PostcardCompose";
import { BlotterStrip } from "@/components/passport/Blotter";
import TravelerSheet from "@/components/social/TravelerSheet";
import ConfirmBirthdayNote from "@/components/social/ConfirmBirthdayNote";
import TeenHoldNote from "@/components/social/TeenHoldNote";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const BLUE = NEUTRAL.airmailBlue;

// The wall's look (founder, 2026-10-16: "billboard and pins"): prints and cards pinned on cork
// under the painted billboard, each with a small tilt and a pushpin; 'flat' is the plain grid.
const WALL = "pins";
const CORK = { background: "#B5926B", backgroundImage: "radial-gradient(rgba(60,42,28,.18) 1.2px, transparent 1.3px)", backgroundSize: "14px 14px" };
const tiltOf = (i) => [-2.5, 1.5, -1, 2.5, -1.5, 2, -2, 1][i % 8];
const Pin = ({ color = NEUTRAL.stamp }) => (
  <span aria-hidden="true" style={{ position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", width: 13, height: 13, borderRadius: "50%", background: color, boxShadow: "inset -2px -3px 4px rgba(0,0,0,.35), 0 2px 3px rgba(0,0,0,.3)", zIndex: 2 }} />
);
const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const clip = (t, n) => { const v = String(t || "").replace(/\s+/g, " ").trim(); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };
const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/** @type {import('react').CSSProperties} */
const KICKER = { margin: 0, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.2, textTransform: "uppercase", color: BLUE };
/** @type {import('react').CSSProperties} */
const OUTLINE = { minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, font: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" };

function useBack() {
  const navigate = useNavigate();
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate(createPageUrl("Home"));
  };
}

// The billboard (founder, 2026-10-16: "a billboard design almost, with photo collections of
// photos taken in that city"): the kit's painting in a deco frame, the board's name over its
// calm lower third, the counts, and Post when the viewer may. Without a kit, the plate alone.
// Palettes for boards without a kit yet: deco plates in the house family, picked by the
// board's name so a board keeps its colours and neighbours differ.
const PLATES = [
  { plate: "#0C2B50", accent: "#D6A64A", sky: "#123A66" }, // navy · gold
  { plate: "#5C3F30", accent: "#E8D3A3", sky: "#7C5A42" }, // umber · cream
  { plate: "#0A4A42", accent: "#D6A64A", sky: "#0E7C73" }, // pine · gold
  { plate: "#7A2E2A", accent: "#F2C230", sky: "#A2423B" }, // oxblood · sun
  { plate: "#2B4C8C", accent: "#F6E7C8", sky: "#4E6FB0" }, // airmail · ivory
  { plate: "#4A3A5E", accent: "#E8B64C", sky: "#6A5784" }, // plum · amber
];
const plateOf = (name) => { let h = 0; for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PLATES[h % PLATES.length]; };
const RAYS = Array.from({ length: 16 }, (_, k) => { const a = (k - 16) * 0.19635, b = (k - 15) * 0.19635; return `<polygon points="201,160 ${201 + 260 * Math.cos(a)},${160 + 260 * Math.sin(a)} ${201 + 260 * Math.cos(b)},${160 + 260 * Math.sin(b)}" fill="${k % 2 ? "#FFFFFF" : "#000000"}" opacity="${k % 2 ? 0.08 : 0.06}"/>`; }).join("");

function Billboard({ name, kind = "city", country = "", region = "", kit = null, counts = null, onBack, onPost = undefined, guestbookCount = null, onGuestbook = undefined }) {
  const fallback = plateOf(name);
  const plate = kit?.palette?.plate || fallback.plate;
  const accent = kit?.palette?.accent || fallback.accent;
  const ink = kit?.palette?.ink || NEUTRAL.ivory;
  const kindWord = kind === "state" ? "State board" : kind === "country" ? "Country board" : "City board";
  const icons = Array.isArray(kit?.icons) ? kit.icons.slice(0, 5) : [];
  return (
    <header style={{ background: plate, padding: "8px 12px 12px" }}>
      <div className="max-w-md md:max-w-2xl mx-auto">
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <button type="button" onClick={onBack} aria-label="Back"
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "0 0 0 -12px", padding: 0, borderRadius: 999, background: "transparent", border: 0, color: ink, cursor: "pointer" }}>
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".24em", lineHeight: 1.2, textTransform: "uppercase", color: accent }}>Globeskimmers · {kindWord}</div>
        </div>
        <div style={{ border: `3px solid ${accent}`, borderRadius: 10, padding: 8 }}>
          <div style={{ position: "relative", height: 170, borderRadius: 6, overflow: "hidden", border: `1px solid ${accent}`, background: `linear-gradient(180deg, ${fallback.sky}, ${plate})` }}>
            {kit?.header ? (
              <img src={kit.header} alt="" aria-hidden="true" decoding="async" onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              // The typographic header: deco rays, a sun, a horizon — the name does the talking.
              <svg aria-hidden="true" viewBox="0 0 402 230" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                dangerouslySetInnerHTML={{ __html: `${RAYS}<circle cx="62" cy="58" r="22" fill="${accent}" opacity=".9"/><path d="M0 182 L402 182 L402 230 L0 230 Z" fill="#000000" opacity=".22"/><path d="M0 182 L402 182" stroke="${accent}" stroke-width="1.5" opacity=".6"/>` }} />
            )}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "26px 12px 10px", background: "linear-gradient(180deg, rgba(8,16,32,0), rgba(8,16,32,.78))" }}>
              <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 1.05, letterSpacing: ".03em", color: ink, overflowWrap: "anywhere" }}>{name}</h1>
              {kind !== "country" && country ? <div style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".18em", textTransform: "uppercase", color: accent, marginTop: 2 }}>{kind === "city" && region ? `${region} · ${country}` : country}</div> : null}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, color: accent }}>
            <span style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".14em", textTransform: "uppercase" }}>
              {counts ? `${counts.photos ?? 0} photo${counts.photos === 1 ? "" : "s"} · ${counts.cards ?? 0} card${counts.cards === 1 ? "" : "s"}` : "From travelers who were really there"}
            </span>
            {onPost ? (
              <button type="button" onClick={onPost}
                style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 14px", borderRadius: 999, border: 0, background: NEUTRAL.stamp, font: "inherit", fontSize: fs(12.5), fontWeight: 600, color: NEUTRAL.white, cursor: "pointer" }}>
                <Mail size={15} strokeWidth={2} aria-hidden="true" focusable="false" />
                Post to this city board
              </button>
            ) : null}
          </div>
        </div>
        {/* The board's guestbook, in the header (founder, 2026-10-16): tips, favorite spots and doodles. */}
        {onGuestbook ? (
          <button type="button" onClick={onGuestbook}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 44, marginTop: 10, padding: "0 14px", borderRadius: 12, background: "transparent", border: `1.5px solid ${accent}`, fontFamily: "inherit", fontSize: fs(13.5), fontWeight: 600, color: accent, cursor: "pointer" }}>
            <BookOpen size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
            {name}&rsquo;s guestbook{guestbookCount ? ` · ${guestbookCount} tip${guestbookCount === 1 ? "" : "s"} & doodle${guestbookCount === 1 ? "" : "s"}` : " · tips & doodles"}
          </button>
        ) : null}
        {icons.length ? (
          <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
            {icons.map((src) => (
              <span key={src} style={{ width: 40, height: 40, borderRadius: 999, background: NEUTRAL.coverNight, border: `2px solid ${accent}`, overflow: "hidden", display: "block" }}>
                <img src={src} alt="" loading="lazy" onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", padding: 5, boxSizing: "border-box" }} />
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

// The viewer (founder, 2026-10-16: "enlarge them… comment on each photo… the stickers appear
// when user enlarges… scroll to next photo enlarged, scroll to postcard enlarged if postcard is
// next, collapse so everything goes back to board"). One item at a time over the wall's rows,
// swiped or arrowed through, each with its sticker tray and comments (board rules: anyone
// adult may react, the owner hears of it in the Mailbox).
function BoardViewer({ rows, index, onIndex, onClose, book, onBook, me, meName, onReport, readOnly = false }) {
  const row = rows[index];
  const touch = useRef(null);
  const go = (d) => { const n = index + d; if (n >= 0 && n < rows.length) onIndex(n); };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  if (!row) return null;
  const handle = lc(row?.by?.handle);
  const ownerView = !!me && !!handle && lc(me) === handle;
  const onTouchStart = (e) => {
    // A finger on a drawing pad or a text field is never a swipe (founder, 2026-10-16).
    if (e.target.closest?.("canvas, input, textarea, select")) { touch.current = null; return; }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    const t = touch.current; touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  };
  const arrow = (d) => (
    <button type="button" onClick={() => go(d)} aria-label={d > 0 ? "Next" : "Previous"} disabled={d > 0 ? index >= rows.length - 1 : index <= 0}
      className="disabled:opacity-25"
      style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(255,255,255,.08)", border: 0, color: NEUTRAL.ivory, cursor: "pointer" }}>
      {d > 0 ? <ChevronRight size={22} strokeWidth={2} aria-hidden="true" focusable="false" /> : <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" focusable="false" />}
    </button>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label={row.type === "photo" ? `Photo ${index + 1} of ${rows.length}` : `Postcard ${index + 1} of ${rows.length}`}
      className="fixed inset-0 z-[9998] flex flex-col" style={{ background: "rgba(8,16,32,.96)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(8px + env(safe-area-inset-top)) 8px 0" }}>
        {arrow(-1)}
        <span style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".16em", color: NEUTRAL.goldPale }}>{index + 1} / {rows.length}</span>
        <div style={{ display: "flex", gap: 2 }}>
          {arrow(1)}
          <button type="button" onClick={onClose} aria-label="Back to the board"
            style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: 0, color: NEUTRAL.ivory, cursor: "pointer" }}>
            <X size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: "6px 12px calc(24px + env(safe-area-inset-bottom))" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {row.type === "photo" ? (
          <>
            <img key={row.id} src={row.photo} alt={row.caption || `Photo from ${row.place || ""}`} style={{ display: "block", width: "100%", maxHeight: "54vh", objectFit: "contain", borderRadius: 6 }} />
            <div style={{ color: NEUTRAL.ivory, padding: "10px 4px 0" }}>
              {row.caption ? <p style={{ margin: 0, fontFamily: SERIF, fontStyle: "italic", fontSize: fs(16), lineHeight: 1.35 }}>&ldquo;{row.caption}&rdquo;</p> : null}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", marginTop: row.caption ? 8 : 0, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".1em", textTransform: "uppercase", color: NEUTRAL.goldPale }}>
                <span>{handle ? `From @${handle}` : "From a traveler"}</span>
                {row.place ? <span>· {row.place}</span> : null}
                {whenLabel(row.created_at) ? <span style={{ marginLeft: "auto" }}>{whenLabel(row.created_at)}</span> : null}
              </div>
            </div>
          </>
        ) : (
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <PostcardCard row={row} me={me} meName={meName} onReport={onReport} />
          </div>
        )}
        {row.id ? (
          <div style={{ marginTop: 12 }}>
            <BlotterStrip {...(row.type === "photo" ? { boardPhotoId: row.id } : { postcardId: row.id })} blotter={book} food={!!row.dish} ownerView={ownerView} onChanged={onBook} readOnly={readOnly} />
          </div>
        ) : null}
        {row.type === "photo" && onReport ? (
          <button type="button" onClick={() => onReport(row)}
            style={{ marginTop: 12, minHeight: 36, padding: "0 12px", borderRadius: 999, background: "transparent", border: `1px solid ${NEUTRAL.goldPale}`, font: "inherit", fontSize: fs(12), fontWeight: 600, color: NEUTRAL.goldPale, cursor: "pointer" }}>
            Report this photo
          </button>
        ) : null}
      </div>
    </div>
  );
}

// The board's guestbook in a sheet: the short, positive ask, then the place guestbook's
// notes and doodles under the board's id (City Billboards, 2026-10-16).
function BoardGuestbookSheet({ name, gb, signBoard, onClose, onCount }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`${name}’s guestbook`} className="fixed inset-0 z-[9998] flex items-end justify-center" style={{ background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div className="w-full max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0", padding: "16px 16px calc(28px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>The guestbook</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
              <em style={{ fontStyle: "italic", color: BLUE }}>{name}</em>, by travelers who were here
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close the guestbook"
            style={{ flex: "none", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "transparent", border: 0, color: NEUTRAL.ink2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <p style={{ margin: "6px 0 12px", fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
          {gb.can_sign === false
            ? "Tips from travelers: the best spots, the best food, the best nature, and their favorite parts."
            : "Leave a tip, your favorite spot, the best food or the best nature — anything that helps the next visitor. Doodles welcome."}
        </p>
        <Guestbook entityType="board" entityId={gb.id} entityName={name} prompts={BOARD_PROMPTS}
          intro="Help the next traveler: a tip, the best spot, the best food or nature, your favorite part."
          signExtra={{ board: signBoard }} canSign={gb.can_sign !== false}
          cantSignNote="Notes and comments open at age 18 — you can read them all, and add sticker likes to photos."
          onCount={onCount} />
      </div>
    </div>
  );
}

// A tile on the wall: the photo, and the @username when the owner signed it.
function PhotoTile({ row, onOpen, index = 0 }) {
  const handle = lc(row?.by?.handle);
  const pinned = WALL === "pins";
  return (
    <button type="button" onClick={() => onOpen(row)} aria-label={`Open the photo${row.place ? ` from ${row.place}` : ""}${handle ? ` by @${handle}` : ""}`}
      style={pinned
        ? { position: "relative", display: "block", width: "100%", padding: "4px 4px 6px", border: 0, borderRadius: 3, background: NEUTRAL.ivory, boxShadow: "0 6px 12px rgba(22,17,13,.28)", transform: `rotate(${tiltOf(index)}deg)`, cursor: "pointer", marginTop: 6 }
        : { position: "relative", display: "block", width: "100%", aspectRatio: "1 / 1", padding: 0, borderRadius: 8, overflow: "hidden", border: 0, background: NEUTRAL.airmailHair, cursor: "pointer" }}>
      {pinned ? <Pin /> : null}
      <span style={{ position: "relative", display: "block", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: pinned ? 2 : 8, background: NEUTRAL.airmailHair }}>
        <img src={row.photo} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {handle ? (
          <span style={{ position: "absolute", left: 5, bottom: 5, padding: "2px 6px", borderRadius: 999, background: "rgba(22,17,13,.72)", color: NEUTRAL.white, fontFamily: MONO, fontSize: fs(7.5), letterSpacing: ".1em", textTransform: "uppercase" }}>@{handle}</span>
        ) : null}
      </span>
    </button>
  );
}

function Board({ kind, city, region, country, onBack }) {
  const { profile } = useAuth();
  const circle = useCircle();
  const name = kind === "state" ? region : kind === "country" ? country : city;
  const [board, setBoard] = useState(null);       // { rows, next, can_post, board, kit, counts, held, unavailable, error } once read
  const [older, setOlder] = useState("idle");     // 'idle' | 'busy' | 'failed'
  const [me, setMe] = useState({ handle: null, name: null });
  const [traveler, setTraveler] = useState(null);
  const [compose, setCompose] = useState(false);
  const [view, setView] = useState(null);     // the viewer's index into rows, or null
  const [gbOpen, setGbOpen] = useState(false);
  const [gbCount, setGbCount] = useState(null);
  // The cards' likes and comments (the guestbook, 2026-10-14), read for every card shown.
  const [book, setBook] = useState(null);
  const readBook = (list) => blotterReadBoard((list || []).filter((x) => x?.type !== "photo").map((x) => x?.id), (list || []).filter((x) => x?.type === "photo").map((x) => x?.id)).then(setBook);
  const live = useRef(0);
  // A US city asked without its state opens the busiest one; later reads keep that state.
  const askOf = (b) => ({ city, country, kind, region: region || b?.board?.region || null });

  useEffect(() => {
    let gone = false;
    getHandle().then((h) => { if (!gone) setMe((m) => ({ ...m, handle: h.handle || null })); });
    getSocialProfile().then((sp) => { if (!gone) setMe((m) => ({ ...m, name: sp.profile?.display_name || null })); });
    return () => { gone = true; };
  }, []);

  const load = async () => {
    const n = ++live.current;
    const r = await cityBoard(askOf(null));
    if (n !== live.current) return;
    setBoard(r);
    setOlder("idle");
    readBook(r.rows);
  };
  useEffect(() => { load(); }, [kind, city, region, country]);
  const retry = () => { setBoard(null); load(); };

  const readOlder = async () => {
    if (older === "busy" || !board?.next) return;
    const n = live.current;
    setOlder("busy");
    const r = await cityBoard({ ...askOf(board), before: board.next });
    if (n !== live.current) return;
    if (r.error || r.held || r.unavailable) { setOlder("failed"); return; }
    setOlder("idle");
    setBoard((b) => {
      const seen = new Set((b.rows || []).map((x) => x.id));
      const all = [...(b.rows || []), ...(r.rows || []).filter((x) => !seen.has(x.id))];
      readBook(all);
      return { ...b, rows: all, next: r.next };
    });
  };

  const blocked = circle.blockedHandles || new Set();
  const rows = board && !board.error && !board.held && !board.unavailable ? (board.rows || []).filter((r) => !blocked.has(lc(r?.by?.handle))) : [];
  const canPost = kind === "city" && !!board && board.can_post === true && !board.held && !board.unavailable;
  const report = (row) => setTraveler({
    person: { ...(row.by || {}), postcard_id: row.type === "photo" ? null : row.id || null },
    report: row.type === "photo"
      ? { kind: "photo", ...(row.id ? { ref: `ph:${row.id}` } : {}), note: clip(`Photo on ${name}’s board${row.place ? `, ${row.place}` : ""}, ${whenLabel(row.created_at)}${row.caption ? `: "${row.caption}"` : ""}`, 480) }
      : { kind: "postcard", ...(row.id ? { ref: `pc:${row.id}` } : {}), note: clip(`City board ${name}${row.place ? `, ${row.place}` : ""}, ${whenLabel(row.created_at)}${row.message ? `: "${row.message}"` : ""}`, 480) },
  });

  let body;
  if (!board) {
    body = (
      <>
        <span className="sr-only" role="status">{`Opening ${name}’s board`}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none" style={{ aspectRatio: "1 / 1", borderRadius: 8, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }} />
          ))}
        </div>
      </>
    );
  } else if (board.held) {
    body = board.held === "confirm" ? <ConfirmBirthdayNote /> : <TeenHoldNote />;
  } else if (board.unavailable) {
    body = (
      <div style={{ padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
        <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>{name}’s board opens with the next app update.</p>
      </div>
    );
  } else if (board.error) {
    body = (
      <div style={{ padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
        <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Couldn’t open {name}’s board.</p>
        <button type="button" onClick={retry} style={{ ...OUTLINE, marginTop: 10 }}>Try again</button>
      </div>
    );
  } else if (!rows.length && !board.next) {
    body = (
      <div style={{ padding: "24px 20px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 18, textAlign: "center" }}>
        <Mail size={36} strokeWidth={1.6} color={BLUE} aria-hidden="true" focusable="false" style={{ display: "block", margin: "0 auto" }} />
        <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>
          Nothing from {name} <em style={{ fontStyle: "italic", color: BLUE }}>yet</em>
        </p>
        <p style={{ margin: "6px auto 0", maxWidth: "36ch", fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
          {canPost ? "You were here, so the first card can be yours — and the photos on your public stamps hang here on their own." : `Photos on public stamps from ${name} hang here on their own; travelers who stamp it, verified, can post cards too.`}
        </p>
      </div>
    );
  } else {
    body = (
      <>
        <h2 style={{ ...KICKER, ...(WALL === "pins" ? { color: "#4A3426" } : {}) }}>Newest first · tap any photo</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: WALL === "pins" ? "10px 8px" : 6, marginTop: 8, alignItems: "start" }}>
          {rows.map((r, i) => (r.type === "photo" ? (
            <PhotoTile key={r.id || `ph-${i}`} row={r} onOpen={() => setView(i)} index={i} />
          ) : (
            <div key={r.id || `bc-${r.created_at}-${i}`} role="button" tabIndex={0} aria-label="Open this postcard"
              onClick={(e) => { if (!e.target.closest("button, a")) setView(i); }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.target.closest("button, a")) { e.preventDefault(); setView(i); } }}
              style={{ gridColumn: "1 / -1", cursor: "pointer", ...(WALL === "pins" ? { position: "relative", transform: `rotate(${tiltOf(i) / 2}deg)`, margin: "8px 2px 4px", filter: "drop-shadow(0 8px 10px rgba(22,17,13,.28))" } : {}) }}>
              {WALL === "pins" ? <Pin color={NEUTRAL.airmailBlue} /> : null}
              <PostcardCard row={r} me={me.handle} meName={me.name || profile?.first_name || null} onReport={report} />
            </div>
          )))}
        </div>
        {board.next ? (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button type="button" onClick={readOlder} aria-busy={older === "busy" || undefined} aria-disabled={older === "busy" || undefined}
              style={{ ...OUTLINE, background: NEUTRAL.white, cursor: older === "busy" ? "progress" : "pointer" }}>
              {older === "busy" ? "One moment…" : "Show more"}
            </button>
            {older === "failed" ? (
              <p role="status" style={{ margin: "8px 0 0", fontSize: fs(12.5), color: NEUTRAL.ink2 }}>Couldn’t load more. Try again.</p>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <Billboard name={name} kind={kind} country={country} region={kind === "city" ? board?.board?.region || region : ""} kit={board?.kit || null} counts={board?.counts || null} onBack={onBack} onPost={canPost ? () => setCompose(true) : undefined}
        guestbookCount={gbCount ?? board?.guestbook?.count ?? null}
        onGuestbook={board?.guestbook?.id && !board.held && !board.unavailable && !board.error ? () => setGbOpen(true) : undefined} />
      <div className={COLUMN}>
        {/* Same name, another state (founder, 2026-10-16): Portland, Oregon offers Portland, Maine. */}
        {kind === "city" && (board?.alternates || []).length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 0" }}>
            {board.alternates.map((a) => (
              <Link key={a.region} to={cityBoardUrl(city, country, a.region)}
                style={{ display: "inline-flex", alignItems: "center", minHeight: 32, padding: "0 12px", borderRadius: 999, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, fontSize: fs(12), fontWeight: 600, color: BLUE, textDecoration: "none" }}>
                Also {city}, {a.region} →
              </Link>
            ))}
          </div>
        ) : null}
        {board && board.read_only ? (
          <p style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "14px 0 0", fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
            <Stamp size={15} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Browse every photo, card and tip, and add sticker likes. Posting and notes open at age 18.</span>
          </p>
        ) : kind === "city" && board && !board.held && !board.unavailable && !board.error && !canPost ? (
          <p style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "14px 0 0", fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
            <Stamp size={15} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Stamp {city} with GPS or a photo taken there, and you can post a card here too.</span>
          </p>
        ) : null}
        <section aria-label={`${name}’s board`} style={{ marginTop: 14 }}>{WALL === "pins" && rows.length ? null : body}</section>
      </div>
      {WALL === "pins" && rows.length ? (
        <div style={{ ...CORK, padding: "14px 0 24px", marginTop: 14 }}>
          <div className={COLUMN}>{body}</div>
        </div>
      ) : null}
      {gbOpen && board?.guestbook?.id ? (
        <BoardGuestbookSheet name={name} gb={board.guestbook} onClose={() => setGbOpen(false)} onCount={setGbCount}
          signBoard={{ kind, city: board?.board?.city || city, region: board?.board?.region || region || null, country: board?.board?.country || country }} />
      ) : null}
      {view !== null && rows[view] ? (
        <BoardViewer rows={rows} index={view} onIndex={setView} onClose={() => setView(null)} book={book} onBook={() => readBook(board?.rows)} readOnly={board?.read_only === true}
          me={me.handle} meName={me.name || profile?.first_name || null} onReport={(row) => { setView(null); report(row); }} />
      ) : null}
      {traveler ? (
        <TravelerSheet person={traveler.person} report={traveler.report}
          onClose={() => setTraveler(null)} onChanged={() => { setTraveler(null); circle.retry(); retry(); }} />
      ) : null}
      {kind === "city" ? (
        <PostcardCompose open={compose} onClose={() => setCompose(false)} onSent={() => { setCompose(false); retry(); }}
          toCity={{ city, country, region: region || board?.board?.region || null }} blocked={circle.blocked} />
      ) : null}
    </div>
  );
}

export default function CityBoardPage() {
  const { socialTier, socialTierReady } = useAuth();
  const location = useLocation();
  const onBack = useBack();
  const params = new URLSearchParams(location.search);
  const kindParam = clean(params.get("kind")).toLowerCase();
  const kind = kindParam === "state" || kindParam === "country" ? kindParam : "city";
  const city = clean(params.get("city"));
  const region = clean(params.get("region") || params.get("state"));
  const country = clean(params.get("country"));
  const name = kind === "state" ? region : kind === "country" ? country : city;
  const named = kind === "state" ? !!region && !!country : kind === "country" ? !!country : !!city && !!country;
  // Nothing until the age tier is known; a frozen account sees the billboard alone. A minor
  // reads every board and adds sticker likes (founder, 2026-10-16) — the worker answers
  // read_only, and posting, guestbook notes and comments stay 18+.
  if (!socialTierReady || socialTier === "blocked") return <Billboard name={name || "This board"} kind={kind} country={country} onBack={onBack} />;
  if (!named) {
    return (
      <div>
        <Billboard name="This board" kind={kind} country={country} onBack={onBack} />
        <div className={COLUMN}>
          <p style={{ margin: "16px 0 0", fontSize: fs(14), color: NEUTRAL.ink2 }}>This board needs a place. Open it from Home.</p>
        </div>
      </div>
    );
  }
  return <Board kind={kind} city={city} region={region} country={country} onBack={onBack} />;
}
