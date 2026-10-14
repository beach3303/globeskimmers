// CityBoardRow: 'Postcards from Lisbon' on Home, under your circle (City Board,
// 2026-10-14). One airmail row with the city's postmark that opens the board. It shows
// only when there is something honest to show: cards on the board, or a board you may
// post to (you stamped the city, verified). Nothing while the age tier is unknown, for a
// held account, or before the worker has boards.
//
//   <CityBoardRow city country />   the active location's city and country.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { cityBoard } from "@/lib/passport";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { PostmarkRing } from "@/components/social/Envelope";

const SERIF = "'Instrument Serif', Georgia, serif";
const BLUE = NEUTRAL.airmailBlue;

export default function CityBoardRow({ city = "", country = "" }) {
  const { socialTier, socialTierReady } = useAuth();
  const c = String(city || "").trim();
  const k = String(country || "").trim();
  const open = socialTierReady && !["blocked", "teen", "confirm"].includes(String(socialTier || "")) && !!c && !!k;
  const [board, setBoard] = useState(null);

  useEffect(() => {
    if (!open) { setBoard(null); return undefined; }
    let gone = false;
    cityBoard({ city: c, country: k }).then((r) => { if (!gone) setBoard(r); });
    return () => { gone = true; };
  }, [open, c, k]);

  if (!open || !board || board.held || board.unavailable || board.error) return null;
  const n = board.rows.length;
  if (!n && !board.can_post) return null;
  const line = n
    ? `${board.next ? `${n}+` : n} from travelers who were really there`
    : "You were here. Post the first one.";

  return (
    // The zones' own column: px-4 outside, the same max width inside (Zone.jsx columnClass).
    <div className="px-4" style={{ marginTop: 12 }}>
      <div className="mx-auto max-w-md md:max-w-[720px]">
        <Link to={`${createPageUrl("CityBoard")}?city=${encodeURIComponent(c)}&country=${encodeURIComponent(k)}`}
          style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 64, boxSizing: "border-box", padding: "8px 12px 8px 14px", background: NEUTRAL.airmail, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, textDecoration: "none" }}>
          <PostmarkRing city={c} date={new Date().toISOString()} color={BLUE} size={44} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: SERIF, fontSize: fs(19), lineHeight: 1.15, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>
              Postcards from <em style={{ fontStyle: "italic", color: BLUE }}>{c}</em>
            </span>
            <span style={{ display: "block", marginTop: 2, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink2 }}>{line}</span>
          </span>
          <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        </Link>
      </div>
    </div>
  );
}
