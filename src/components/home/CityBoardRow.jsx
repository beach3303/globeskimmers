// CityBoardRow: 'Lisbon City Board' on Home (City Board, 2026-10-14; named so 2026-10-17, founder:
// "explore City Board photo posts from other travelers … i want 'City board' to be there"). One
// airmail row with the city's postmark that opens the board. It shows only when there is something
// honest to show: posts on the board, or a board you may post to (you stamped the city, verified).
// On its upper left, a gold tab 'See all City Boards' opens the list. When this city has no board but others do, a row
// 'Explore City Boards' stands in its place. Nothing while the age tier is unknown,
// for a held account, or before the worker has boards.
//
//   <CityBoardRow city country />   the active location's city and country.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Globe } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cityBoard, cityBoards } from "@/lib/passport";
import { cityBoardUrl, cityBoardsUrl } from "@/lib/boardLinks";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { PostmarkRing } from "@/components/social/Envelope";
import { HOME_TAB } from "@/components/redesign/Zone";

const MANY_BOARDS = 50;
const MANY_POSTS = 25;

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BLUE = NEUTRAL.airmailBlue;

/** @type {import('react').CSSProperties} */
const ROW = { display: "flex", alignItems: "center", gap: 12, minHeight: 64, boxSizing: "border-box", padding: "8px 12px 8px 14px", background: NEUTRAL.airmail, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, textDecoration: "none" };

// 'See all City Boards' as a gold tab on the row's upper left (founder, 2026-10-17), the same
// gold as every Home tab (Zone's HOME_TAB) and a link to the list of boards. The link reaches
// 15 px above the 29 px tab, invisibly, for a 44 px tap target; the zone's gap shrinks to match.
const TAB_REACH = 15;
/** @type {import('react').CSSProperties} */
const TAB_LINK = { position: "relative", zIndex: 1, display: "block", width: "fit-content", margin: "0 0 -1px 16px", paddingTop: TAB_REACH, textDecoration: "none" };
/** @type {import('react').CSSProperties} */
const TAB = {
  display: "flex", alignItems: "center", gap: 2, minHeight: 29, boxSizing: "border-box",
  padding: "4px 8px 5px 14px", borderRadius: "10px 10px 0 0",
  fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.2, letterSpacing: ".16em", textTransform: "uppercase",
  ...HOME_TAB,
};

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

  return (
    // The zones' own column: px-4 outside, the same max width inside (Zone.jsx columnClass).
    <div className="px-4" style={{ marginTop: showHere && boards.length ? 16 - TAB_REACH : 12 }}>
      <div className="mx-auto max-w-md md:max-w-[720px]">
        {showHere ? (
          <>
            {boards.length ? (
              <Link to={cityBoardsUrl()} style={TAB_LINK}>
                <span style={TAB}>
                  See all City Boards
                  <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" focusable="false" />
                </span>
              </Link>
            ) : null}
            <Link to={cityBoardUrl(c, k, r)} style={ROW}>
              <PostmarkRing city={c} date={new Date().toISOString()} color={BLUE} size={44} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: SERIF, fontSize: fs(19), lineHeight: 1.15, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>
                  <em style={{ fontStyle: "italic", color: BLUE }}>{c}</em> City Board
                </span>
                <span style={{ display: "block", marginTop: 2, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink2 }}>{line}</span>
              </span>
              <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
            </Link>
          </>
        ) : (
          <Link to={cityBoardsUrl()} style={ROW}>
            <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: 44, height: 44, borderRadius: 999, border: `1.5px solid ${BLUE}` }}>
              <Globe size={22} strokeWidth={1.8} color={BLUE} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: SERIF, fontSize: fs(19), lineHeight: 1.15, color: NEUTRAL.ink }}>
                Explore <em style={{ fontStyle: "italic", color: BLUE }}>City Boards</em>
              </span>
              <span style={{ display: "block", marginTop: 2, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink2 }}>
                {total >= MANY_BOARDS ? `${total}${boards.length >= 60 ? "+" : ""} boards of photo posts from travelers who were really there` : "Photo posts from travelers who were really there"}
              </span>
            </span>
            <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
          </Link>
        )}
      </div>
    </div>
  );
}
