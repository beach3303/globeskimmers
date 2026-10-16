// CityBoards: every city whose board has postcards (founder, 2026-10-14: "A City Boards
// page. Every city whose board has postcards, busiest first, each with its newest photo as
// the cover and a count ("Lisbon · 24 postcards"), plus a search box"). Opened from Home
// ('See every city's board') and Mailbox; each tile opens that city's board.
//
// Busiest first is the worker's order (the last 30 days, then all time). The search asks the
// worker, so it finds a city by its country and ignores accents. It shows nothing untrue:
// nothing social until the age tier is known; the hold or birthday note for a held account;
// a skeleton while the list loads; 'Try again' when a read fails; 'no boards yet' only when
// the read worked; and before the worker has the list, a line saying it opens with the next
// update. A board whose every newest photo is from someone you blocked shows its postmark.
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Search, Stamp } from "lucide-react";
import { createPageUrl } from "@/utils";
import { boardUrl } from "@/lib/boardLinks";
import { useAuth } from "@/lib/AuthContext";
import { cityBoards } from "@/lib/passport";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { PostmarkRing } from "@/components/social/Envelope";
import ConfirmBirthdayNote from "@/components/social/ConfirmBirthdayNote";
import TeenHoldNote from "@/components/social/TeenHoldNote";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const BLUE = NEUTRAL.airmailBlue;

/** @type {import('react').CSSProperties} */
const OUTLINE = { minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, font: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" };
/** @type {import('react').CSSProperties} */
const NOTE = { padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 };

// "312 photos · 41 cards" (City Billboards, 2026-10-16); an older worker sends count alone.
const countLabel = (b) => { const ph = Number(b?.photos) || 0; const cd = Number(b?.cards ?? b?.count) || 0; const parts = []; if (ph) parts.push(`${ph} photo${ph === 1 ? "" : "s"}`); if (cd) parts.push(`${cd} card${cd === 1 ? "" : "s"}`); return parts.join(" · ") || "new"; };

function useBack() {
  const navigate = useNavigate();
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate(createPageUrl("Home"));
  };
}

function Masthead({ onBack }) {
  return (
    <>
      <div aria-hidden="true" style={{ height: 12 }} />
      <header className={COLUMN} style={{ paddingTop: 4, paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" onClick={onBack} aria-label="Back"
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "0 0 0 -12px", padding: 0, borderRadius: 999, background: "transparent", border: 0, color: BLUE, cursor: "pointer" }}>
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
          <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".2em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.stamp }}>Globeskimmers · City boards</div>
        </div>
        <h1 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 1.04, color: NEUTRAL.ink }}>
          A board for <em style={{ fontStyle: "italic", color: BLUE }}>every city</em>
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>Photos and postcards from travelers who were really there. Busiest first.</p>
      </header>
      <AirmailChevron height={5} />
    </>
  );
}

// One board: its newest photo (or its postmark), the city, the country and the count.
function BoardTile({ board }) {
  const [broken, setBroken] = useState(false);
  const cover = board.cover && !broken;
  return (
    <Link to={boardUrl(board)} aria-label={`${board.name || board.city}, ${board.country}: ${countLabel(board)}`}
      style={{ display: "block", overflow: "hidden", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 14, textDecoration: "none", color: "inherit" }}>
      <div style={{ position: "relative", aspectRatio: "4 / 3", background: NEUTRAL.airmail }}>
        {cover ? (
          <img src={board.cover} alt="" loading="lazy" onError={() => setBroken(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PostmarkRing city={board.name || board.city} date={board.last_at || new Date().toISOString()} color={BLUE} size={64} />
          </div>
        )}
      </div>
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontFamily: SERIF, fontSize: fs(19), lineHeight: 1.1, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{board.name || board.city}</div>
        <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", gap: "2px 8px", fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".08em", lineHeight: 1.35, textTransform: "uppercase", color: NEUTRAL.ink2 }}>
          <span style={{ overflowWrap: "anywhere" }}>{board.kind === "country" ? "Country board" : board.kind === "state" ? `${board.country} · State board` : board.country}</span>
          <span style={{ color: BLUE }}>{countLabel(board)}</span>
        </div>
      </div>
    </Link>
  );
}

function Boards({ onBack }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);   // { boards, unavailable, error } for `asked`
  const [asked, setAsked] = useState(null); // the query the shown list answers
  const [attempt, setAttempt] = useState(0);
  const live = useRef(0);

  // The search waits for a pause in typing; the newest answer wins.
  const query = q.trim();
  useEffect(() => {
    const n = ++live.current;
    const t = setTimeout(async () => {
      const r = await cityBoards(query);
      if (n !== live.current) return;
      setList(r);
      setAsked(query);
    }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, attempt]);
  const retry = () => { setList(null); setAsked(null); setAttempt((a) => a + 1); };

  const searching = asked !== query;
  let body;
  if (!list) {
    body = (
      <>
        <span className="sr-only" role="status">Opening the city boards</span>
        <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none"
              style={{ aspectRatio: "4 / 4.4", borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }} />
          ))}
        </div>
      </>
    );
  } else if (list.held) {
    body = list.held === "confirm" ? <ConfirmBirthdayNote /> : <TeenHoldNote />;
  } else if (list.unavailable) {
    body = <div style={NOTE}><p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>City boards open with the next app update.</p></div>;
  } else if (list.error) {
    body = (
      <div style={NOTE}>
        <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Couldn’t open the city boards.</p>
        <button type="button" onClick={retry} style={{ ...OUTLINE, marginTop: 10 }}>Try again</button>
      </div>
    );
  } else if (!list.boards.length && !(list.rollups || []).length) {
    body = asked ? (
      <p role="status" style={{ margin: 0, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>No city board matches “{asked}” yet.</p>
    ) : (
      <div style={{ ...NOTE, padding: "24px 20px", borderRadius: 18, textAlign: "center" }}>
        <Stamp size={34} strokeWidth={1.6} color={BLUE} aria-hidden="true" focusable="false" style={{ display: "block", margin: "0 auto" }} />
        <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>
          No city has postcards <em style={{ fontStyle: "italic", color: BLUE }}>yet</em>
        </p>
        <p style={{ margin: "6px auto 0", maxWidth: "36ch", fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
          Stamp a city with GPS or a photo taken there, and you can post the first one to its board.
        </p>
      </div>
    );
  } else {
    body = (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12, opacity: searching ? 0.55 : 1, transition: "opacity .15s" }}>
          {list.boards.map((b) => <BoardTile key={`${b.city}|${b.country}`} board={b} />)}
        </div>
        {(list.rollups || []).length ? (
          <>
            <h2 style={{ margin: "18px 0 8px", fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.2, textTransform: "uppercase", color: BLUE }}>States &amp; countries</h2>
            <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12, opacity: searching ? 0.55 : 1, transition: "opacity .15s" }}>
              {list.rollups.map((b) => <BoardTile key={`${b.kind}|${b.name}|${b.country}`} board={b} />)}
            </div>
          </>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <Masthead onBack={onBack} />
      <div className={COLUMN}>
        <label style={{ position: "relative", display: "block", marginTop: 16 }}>
          <span className="sr-only">Search the city boards</span>
          <Search size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} type="search" inputMode="search" enterKeyHint="search" placeholder="Search a city or country"
            autoCapitalize="words" autoCorrect="off" spellCheck={false}
            style={{ width: "100%", height: 48, boxSizing: "border-box", padding: "0 14px 0 42px", borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, font: "inherit", fontSize: fs(15), color: NEUTRAL.ink, outline: "none" }} />
        </label>
        <section aria-label="City boards" aria-busy={searching || !list || undefined} style={{ marginTop: 14 }}>{body}</section>
      </div>
    </div>
  );
}

export default function CityBoardsPage() {
  const { socialTier, socialTierReady } = useAuth();
  const onBack = useBack();
  // Nothing social until the age tier is known; a held account keeps the masthead with its note.
  if (!socialTierReady || socialTier === "blocked") return <Masthead onBack={onBack} />;
  if (socialTier === "confirm" || socialTier === "teen") {
    return (
      <div>
        <Masthead onBack={onBack} />
        <div className={COLUMN}><div style={{ marginTop: 16 }}>{socialTier === "confirm" ? <ConfirmBirthdayNote /> : <TeenHoldNote />}</div></div>
      </div>
    );
  }
  return <Boards onBack={onBack} />;
}
