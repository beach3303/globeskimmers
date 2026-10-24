// CityBoardRow: 'Lisbon City Board' on Home (City Board, 2026-10-14; named so 2026-10-17, founder:
// "explore City Board photo posts from other travelers … i want 'City board' to be there"). It
// shows only when there is something honest to show: posts on the board, or a board you may post
// to (you stamped the city, verified). When this city has no board but others do, 'City Boards'
// (the list) stands in its place. Nothing while the age tier is unknown, for a held account, or
// before the worker has boards.
//
// The look is a roadside billboard (founder, 2026-10-24: "lets do city board 3, but save all
// designs for future change"): three lamps over a framed panel on two posts; the panel a sunset
// sky over a skyline, NOW SHOWING, the board's name and its line, and a black pill. The whole
// billboard is one link; 'All City Boards', when there are others, is a second small link under
// it. The four other designs (Live wire, Mural, Departures board, Corkboard) are kept in
// docs/design/2026-10-24-home-tabs-city-boards.
//
//   <CityBoardRow city country region />   the active location's city, country and region.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cityBoard, cityBoards } from "@/lib/passport";
import { cityBoardUrl, cityBoardsUrl } from "@/lib/boardLinks";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const MANY_BOARDS = 50;
const MANY_POSTS = 25;

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const FRAME = "#24201C";      // the billboard's frame and lamps
const POST = "#3A332C";       // its posts and catwalk
const SKY = "linear-gradient(180deg, #FF9A5A 0%, #FF6F7D 45%, #7A4BD0 100%)";
const NIGHT = "#2B1D47";      // the skyline
const SKYLINE = [[14, 40], [20, 66], [12, 30], [18, 52], [10, 76], [16, 44]];   // [width, height] px

// A lamp on an arm over the panel, throwing a soft cone of light down onto it.
function Lamp({ left }) {
  return (
    <span aria-hidden="true" style={{ position: "absolute", top: 0, left, width: 60, height: 96, marginLeft: -30, pointerEvents: "none" }}>
      <span style={{ position: "absolute", left: 28, top: 0, width: 3, height: 18, background: FRAME }} />
      <span style={{ position: "absolute", left: 16, top: 14, width: 28, height: 10, borderRadius: "5px 5px 2px 2px", background: FRAME }} />
      <span style={{ position: "absolute", left: -4, top: 24, width: 68, height: 72, background: "radial-gradient(60% 100% at 50% 0%, rgba(255,226,140,.6), rgba(255,226,140,0) 70%)" }} />
    </span>
  );
}

function Billboard({ to, title, accent = null, line, cta, label }) {
  return (
    <Link to={to} aria-label={label} style={{ position: "relative", display: "block", paddingTop: 24, paddingBottom: 54, textDecoration: "none" }}>
      <Lamp left="18%" />
      <Lamp left="50%" />
      <Lamp left="82%" />
      <span style={{ position: "relative", display: "block", minHeight: 150, boxSizing: "border-box", borderRadius: 6, border: `7px solid ${FRAME}`, overflow: "hidden", background: SKY, boxShadow: "0 14px 22px -14px rgba(22,17,13,.7)" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 46, background: "linear-gradient(180deg, rgba(36,24,60,0), rgba(36,24,60,.55))" }} />
        <span aria-hidden="true" style={{ position: "absolute", right: 16, bottom: 0, display: "flex", alignItems: "flex-end", gap: 4 }}>
          {SKYLINE.map(([w, h], i) => <span key={i} style={{ width: w, height: h, background: NIGHT }} />)}
        </span>
        <span style={{ position: "relative", display: "block", padding: "14px 118px 16px 16px" }}>
          <span style={{ display: "block", fontFamily: MONO, fontWeight: 700, fontSize: fs(10.5), letterSpacing: ".24em", color: "#FFF4E6" }}>NOW SHOWING</span>
          <span style={{ display: "block", marginTop: 6, fontWeight: 900, fontSize: fs(29), lineHeight: 1, letterSpacing: "-.01em", color: "#FFFFFF", overflowWrap: "anywhere", textShadow: "0 2px 0 rgba(43,29,71,.35)" }}>{title}</span>
          {accent ? <span style={{ display: "block", fontFamily: SERIF, fontStyle: "italic", fontSize: fs(23), lineHeight: 1.05, color: "#FFF4E6" }}>{accent}</span> : null}
          <span style={{ display: "block", marginTop: 8, fontSize: fs(12.5), lineHeight: 1.35, color: "#FFF4E6" }}>{line}</span>
        </span>
      </span>
      {/* Two posts and the catwalk between them. */}
      <span aria-hidden="true" style={{ position: "absolute", left: "18%", bottom: 8, width: 10, height: 46, background: POST }} />
      <span aria-hidden="true" style={{ position: "absolute", right: "18%", bottom: 8, width: 10, height: 46, background: POST }} />
      <span aria-hidden="true" style={{ position: "absolute", left: "10%", right: "10%", bottom: 40, height: 4, background: POST }} />
      <span style={{ position: "absolute", right: 0, bottom: 2, display: "inline-flex", alignItems: "center", gap: 4, minHeight: 40, padding: "0 12px 0 16px", borderRadius: 999, background: NEUTRAL.ink, color: NEUTRAL.ivory, fontWeight: 800, fontSize: fs(13.5) }}>
        {cta}
        <ChevronRight size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
      </span>
    </Link>
  );
}

export default function CityBoardRow({ city = "", country = "", region = "" }) {
  const r = String(region || "").trim();
  const { socialTier, socialTierReady } = useAuth();
  const c = String(city || "").trim();
  const k = String(country || "").trim();
  const social = socialTierReady && String(socialTier || "") !== "blocked";   // minors read boards (2026-10-16)
  const open = social && !!c && !!k;
  const [board, setBoard] = useState(null);
  const [all, setAll] = useState(null);

  useEffect(() => {
    if (!open) { setBoard(null); return undefined; }
    let gone = false;
    cityBoard({ city: c, country: k, region: r || null }).then((res) => { if (!gone) setBoard(res); });
    return () => { gone = true; };
  }, [open, c, k, r]);

  // The list of every board is the same for everyone (the worker keeps it five minutes).
  useEffect(() => {
    if (!social) { setAll(null); return undefined; }
    let gone = false;
    cityBoards().then((r) => { if (!gone) setAll(r); });
    return () => { gone = true; };
  }, [social]);

  const here = open && board && !board.held && !board.unavailable && !board.error ? board : null;
  const n = here ? here.rows.length : 0;
  const showHere = !!here && (n > 0 || here.can_post);
  const boards = all && !all.held && !all.unavailable && !all.error ? all.boards : [];
  const rollups = boards.length && Array.isArray(all?.rollups) ? all.rollups : [];
  const total = boards.length + rollups.length;
  if (!showHere && !boards.length) return null;
  // Counts stay quiet until they're big (founder, 2026-10-16: "we don't need to say this until
  // there are many posts") — a small number reads as empty.
  const line = n >= MANY_POSTS
    ? `${here.next ? `${n}+` : n} photo posts from travelers who were really there`
    : n ? "Explore photo posts from travelers who were really there" : "You were here. Post the first one.";
  const allLine = total >= MANY_BOARDS ? `${total}${boards.length >= 60 ? "+" : ""} boards of photo posts from travelers who were really there` : "Photo posts from travelers who were really there";

  return (
    // The zones' own column: px-4 outside, the same max width inside (Zone.jsx columnClass).
    <div className="px-4" style={{ marginTop: 16 }}>
      <div className="mx-auto max-w-md md:max-w-[720px]" style={{ position: "relative" }}>
        {showHere ? (
          <Billboard to={cityBoardUrl(c, k, r)} title={c} accent="City Board" line={line} cta="See the board" label={`${c} City Board. ${line}`} />
        ) : (
          <Billboard to={cityBoardsUrl()} title="City Boards" line={allLine} cta="Explore" label={`City Boards. ${allLine}`} />
        )}
        {/* Every board, under the left post, when this city's board is the one showing. */}
        {showHere && boards.length ? (
          <Link to={cityBoardsUrl()} style={{ position: "absolute", left: 0, bottom: 2, display: "inline-flex", alignItems: "center", gap: 2, minHeight: 40, padding: "0 10px 0 12px", borderRadius: 999, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.airmailBlue, fontFamily: MONO, fontSize: fs(10.5), fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", textDecoration: "none" }}>
            All City Boards
            <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" focusable="false" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
