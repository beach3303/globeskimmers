// PassportHero — the passport zone at the top of Home (Home-Boxes L54-68): the navy
// folder with the gold keyline, the whole box one button to the Passport.
//
//   total    the stamp count; null while loading and on error (never a made-up 0)
//   newest   the newest stamp row, drawn on the cream tile by kind (StampThumb)
//   nearest  { name, km, miles } of the closest stampable place (StampsNearYou)
//   unit     'mi' | 'km' for the next-stamp distance
//   error    the passport read failed: a neutral "Open your Virtual Passport",
//            no count, no zero copy, no globe
//
// Endowed progress, no guilt: a count when there is one, the nearest stamp when
// known, a warm zero state, and nothing that pretends while it loads.
import React from "react";
import { Globe } from "lucide-react";
import { HomeZone } from "@/components/redesign/Zone";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import StampThumb from "@/components/passport/StampThumb";
import { KM_PER_MI, distanceLabel } from "@/lib/units";

// The 50px tile with the gold edge that holds the newest stamp (cream), or the
// zero state's globe (night navy).
function Tile({ children, night = false }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: "none",
        width: 50,
        height: 50,
        boxSizing: "border-box",
        borderRadius: 12,
        background: night ? NEUTRAL.coverNight : NEUTRAL.cream,
        border: `1px solid ${NEUTRAL.gold}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {children}
    </span>
  );
}

// On the gold every Home tab shares (Zone's HOME_TAB), the passport's name is set in the serif,
// italic and larger, with a light emboss: the one tab that reads as a title, not a label.
const TAB_POP = {
  fontFamily: "'Instrument Serif', Georgia, serif",
  fontStyle: "italic",
  fontSize: fs(17),
  fontWeight: 400,
  letterSpacing: ".01em",
  textTransform: "none",
  lineHeight: 1,
  padding: "6px 16px 6px 15px",
  textShadow: "0 1px 0 rgba(255,244,214,.65)",
};

export default function PassportHero({ total, newest = null, nearest = null, unit = "mi", error = null, onOpen }) {
  const loading = total == null && !error;
  const failed = !!error;
  const count = Number.isFinite(total) ? total : null;
  const has = count != null && count > 0;

  let km = NaN;
  if (nearest && Number.isFinite(nearest.km)) km = nearest.km;
  else if (nearest && Number.isFinite(nearest.miles)) km = nearest.miles * KM_PER_MI;
  const dist = distanceLabel(km, unit);
  let next = "";
  if (nearest && nearest.name) next = `NEXT STAMP · ${String(nearest.name).toUpperCase()}${dist ? ` · ${dist}` : ""}`;
  else if (!loading && !failed) next = has ? "OPEN THE BOOKLET · SHARE A PAGE" : "STAMP YOUR HOME CITY TO BEGIN";

  const headStyle = { display: "block", fontSize: fs(22), lineHeight: 1.15, color: NEUTRAL.cream };
  const accent = { fontStyle: "italic", color: NEUTRAL.gold };

  let headline;
  if (loading) {
    // A quiet, wordless placeholder: a bar where the count goes, no number.
    headline = <span aria-hidden="true" style={{ display: "block", width: "62%", height: 22, borderRadius: 6, background: rgba(NEUTRAL.cream, 0.12) }} />;
  } else if (failed) {
    headline = <span className="font-serif" style={headStyle}>Open your Virtual <em style={accent}>Passport</em></span>;
  } else if (has) {
    headline = <span className="font-serif" style={headStyle}>{count} stamp{count === 1 ? "" : "s"} <em style={accent}>collected</em></span>;
  } else {
    headline = <span className="font-serif" style={headStyle}>Your first page is <em style={accent}>waiting</em></span>;
  }

  let tile = null;
  if (loading) tile = <Tile><span style={{ display: "block", width: 32, height: 32, borderRadius: 999, background: rgba(NEUTRAL.navy, 0.08) }} /></Tile>;
  else if (has && newest) tile = <Tile><StampThumb stamp={newest} size={40} /></Tile>;
  else if (!failed && count === 0) tile = <Tile night><Globe size={22} color={NEUTRAL.gold} strokeWidth={2} /></Tile>;

  return (
    // Shorter, under Nearby services, its name the one serif tab (founder, 2026-10-17: "shrink the size
    // … make 'my virtual passport' attractive to look at and pop"). Home only: Profile keeps its look.
    <HomeZone zone="passport" label="My Virtual Passport" onPress={onOpen} ariaLabel="Open your Virtual Passport"
      boxPadding="14px 16px 13px" tabStyle={TAB_POP}>
      <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ flex: 1, minWidth: 0, display: "block" }}>
          {headline}
          {loading && (
            <span aria-hidden="true" style={{ display: "block", width: "45%", height: 11, marginTop: 10, borderRadius: 4, background: rgba(NEUTRAL.goldPale, 0.18) }} />
          )}
          {next && (
            <span
              className="font-mono"
              style={{ display: "block", marginTop: 6, fontSize: fs(10.5), lineHeight: 1.35, letterSpacing: ".03em", color: NEUTRAL.goldPale, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {next}
            </span>
          )}
        </span>
        {tile}
      </span>
    </HomeZone>
  );
}
