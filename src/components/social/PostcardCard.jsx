// PostcardCard: a postcard in the Mailbox, drawn like one (Mailbox.dc.html L175-208;
// bible.mailbox). The photo is the front, inset on a cream back with an airmail hairline;
// the back has the message in Instrument Serif italic, a divider, then the stamp box (the
// place's stamp at 36px in a dashed cream box tilted 3 degrees, or a postmark ring when the
// place has no stamp we can print), the round postmark with the city and date, and, only
// on a card addressed to you, the address lines with your name and @handle. The footer reads
// 'FROM LÉA', her seal only when the row carries one, '· TO YOU' only when it was sent to
// you, and the date. A broadcast to everyone who follows her reads 'FROM LÉA' alone.
//
//   <PostcardCard row me meName onReport className style />
//   row      a social/feed postcard row ({ photo, message, place, city, country, dish,
//            to_me, created_at, by: { name, handle, seal?, verified? } }).
//   me       your @handle: your own card has no report door and reads 'FROM YOU'.
//   meName   your first name for the address line.
//   onReport (row) => void: someone else's card gets the 44px report door at its top right,
//            outside any button or link (the card itself is not a control).
//   onKeep   (row) => void: a card sent to everyone that the feed marks with a boolean `kept`
//            gets the Keep pill at its top left ('Keep' / 'Kept', aria-pressed), which saves it
//            into the postcard box or lets it go. Cards addressed to you are always kept.
// The postmark opens that city's board (City Boards, 2026-10-14): a 44px link wherever the
// card names a city and a country, except on the board itself and for a held account.
import React from "react";
import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, CornerUpLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cityBoardUrl, hasBoard } from "@/lib/boardLinks";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { PostmarkLines } from "@/components/redesign/ornaments";
import { PostmarkRing, ReportControl, canReport, senderName, whenLabel } from "@/components/social/Envelope";
import StampThumb, { stampThumbKind } from "@/components/passport/StampThumb";
import OfficialSeal from "@/components/passport/OfficialSeal";
import { feedStamp } from "@/lib/stampKind";
import FollowSender from "@/components/social/FollowSender";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const DIVIDE = NEUTRAL.creamRule;     // #EADFC9 between the message and the address
const ADDRESS_RULE = "#DDD0B4";       // the ruled address lines (Mailbox L196-197)
const STAMP_BOX_LINE = "#CDBB98";     // the dashed stamp box (kraft line)

const handleOf = (v) => String((v && typeof v === "object" ? v.handle : v) ?? "").trim().replace(/^@+/, "").toLowerCase();

/**
 * @param {{ row: any, me?: any, meName?: string|null, onReport?: (row: any) => void, onKeep?: (row: any) => void, className?: string, style?: import('react').CSSProperties }} props
 */
// onReply (2026-10-19): a card addressed to me gets one Reply button under it. Delete lives in
// its ••• (the caller's TravelerSheet), so each action has one place on the card.
// onFollow (2026-10-25): mail from someone you don't follow gets "+ Follow" (FollowSender).
export default function PostcardCard({ row, me = undefined, meName = null, onReport = undefined, onKeep = undefined, onReply = undefined, onFollow = undefined, className = undefined, style = undefined }) {
  const { socialTier } = useAuth();
  if (!row || typeof row !== "object") return null;
  const by = row.by || {};
  // A city-board card signed without a name (founder, 2026-10-15/16): "@local"
  // or "@traveler" is all it says — no handle, no face, Report still works.
  const from = row.anon ? (row.anon === "local" ? "@local" : "@traveler") : senderName(by, me);
  const toMe = row.to_me === true;
  const also = toMe && Array.isArray(row.also_to) ? row.also_to.filter(Boolean) : [];
  const myHandle = handleOf(me);
  const place = String(row.place ?? "").trim();
  const message = String(row.message ?? "").trim();
  const dish = String(row.dish ?? "").trim();
  const stamp = feedStamp(row);
  const canStamp = !!stamp && stampThumbKind(stamp, { feedSafe: true }) !== null;
  const when = whenLabel(row.created_at);
  const seal = by.seal && by.verified !== false ? String(by.seal) : null;
  const firstName = String(meName ?? "").trim().split(/\s+/)[0] || null;
  const keepable = typeof onKeep === "function" && typeof row.kept === "boolean" && !toMe && canReport(row, me);
  const kept = row.kept === true;
  const boardCity = String(row.city ?? "").trim();
  const boardCountry = String(row.country ?? "").trim();
  const toBoard = row.board !== true && hasBoard(boardCity, boardCountry) && !["blocked", "teen", "confirm"].includes(String(socialTier || ""));

  return (
    <article aria-label={`Postcard from ${from === "You" ? "you" : from}${place ? `, ${place}` : ""}`} className={className}
      style={{ position: "relative", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 14, overflow: "hidden", boxShadow: `0 10px 22px -18px ${rgba(NEUTRAL.ink, 0.45)}`, ...style }}>
      <div style={{ margin: "8px 8px 0", borderRadius: 8, overflow: "hidden", aspectRatio: "3 / 2", background: NEUTRAL.airmailHair }}>
        {/* A photo that can't load leaves the plain airmail panel, never a broken-image icon. */}
        <img src={row.photo} alt={place ? `Postcard from ${place}` : "A postcard"} loading="lazy" decoding="async"
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {message ? (
              <p style={{ margin: 0, fontFamily: SERIF, fontStyle: "italic", fontSize: fs(17), lineHeight: 22 / 17, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>&ldquo;{message}&rdquo;</p>
            ) : null}
            {dish || place ? (
              <p style={{ margin: message ? "6px 0 0" : 0, fontSize: fs(12.5), lineHeight: 1.4, color: NEUTRAL.ink2, overflowWrap: "anywhere" }}>
                {dish ? <b style={{ fontWeight: 600 }}>{dish}</b> : null}{dish && place ? " · " : ""}{place}
              </p>
            ) : null}
          </div>
          <div aria-hidden="true" style={{ flex: "none", width: 1, background: DIVIDE }} />
          <div style={{ flex: "none", width: 112 }}>
            <div style={{ position: "relative", height: 48 }}>
              <div aria-hidden="true" style={{ position: "absolute", right: 4, top: 1, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: NEUTRAL.cream, border: `1px dashed ${STAMP_BOX_LINE}`, borderRadius: 2, transform: "rotate(3deg)" }}>
                {canStamp ? <StampThumb stamp={stamp} size={36} feedSafe /> : <PostmarkRing city={row.city || place} date={row.created_at} size={34} />}
              </div>
              <span aria-hidden="true" style={{ position: "absolute", left: 56, top: 17, pointerEvents: "none" }}><PostmarkLines variant="postcard" style={{ display: "block" }} /></span>
              {toBoard ? (
                <Link to={cityBoardUrl(boardCity, boardCountry, row.region)} aria-label={`Postcards from ${boardCity}${row.region ? `, ${row.region}` : ""}`}
                  style={{ position: "absolute", left: 16, top: 2, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999 }}>
                  <PostmarkRing city={row.city || place} date={row.created_at} size={40} />
                </Link>
              ) : (
                <span aria-hidden="true" style={{ position: "absolute", left: 18, top: 4 }}><PostmarkRing city={row.city || place} date={row.created_at} size={40} /></span>
              )}
            </div>
            {toMe && (firstName || myHandle) ? (
              <div style={{ marginTop: 8 }}>
                {firstName ? <div style={{ borderBottom: `1px solid ${ADDRESS_RULE}`, fontFamily: SERIF, fontSize: fs(17), lineHeight: 22 / 17, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{firstName}</div> : null}
                {myHandle ? <div style={{ marginTop: 4, borderBottom: `1px solid ${ADDRESS_RULE}`, fontFamily: MONO, fontSize: fs(10), lineHeight: 1.6, color: NEUTRAL.ink3, overflowWrap: "anywhere" }}>@{myHandle}</div> : null}
                {/* A group card names everyone it went to in its address lines, the way a real card
                    would (founder, 2026-10-25: "user wants to see who else received" it). */}
                {also.slice(0, also.length > 4 ? 3 : 4).map((h) => (
                  <div key={h} style={{ marginTop: 4, borderBottom: `1px solid ${ADDRESS_RULE}`, fontFamily: MONO, fontSize: fs(10), lineHeight: 1.6, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>@{h}</div>
                ))}
                {also.length > 4 ? <div style={{ marginTop: 4, fontFamily: MONO, fontSize: fs(10), lineHeight: 1.6, color: NEUTRAL.ink3 }}>+{also.length - 3} more</div> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 2, marginTop: 8, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.ink3 }}>
          <span>From {from}</span>
          {seal ? <OfficialSeal size={12} tier={seal} style={undefined} /> : null}
          {toMe ? <span>{also.length ? `· Group card · ${also.length + 1} people` : "· To you"}</span> : null}
          {when ? <span style={{ marginLeft: "auto" }}>{when}</span> : null}
        </div>
        {toMe && row.from_new && by.handle && typeof onFollow === "function" ? (
          <FollowSender name={by.name || `@${by.handle}`} onFollow={() => onFollow(row)} style={{ marginTop: 10 }} />
        ) : null}
        {toMe && row.id && typeof onReply === "function" ? (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${DIVIDE}` }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => onReply(row, false)} aria-label={`Reply to ${from}`}
                style={{ flex: 1, minWidth: 0, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${NEUTRAL.airmailBlue}`, background: NEUTRAL.white, color: NEUTRAL.airmailBlue, fontSize: fs(13.5), fontWeight: 600 }}>
                <CornerUpLeft size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> {also.length ? `Reply to ${from}` : "Reply"}
              </button>
              {/* A group card (2026-10-25): reply to the sender or to everyone on it. */}
              {also.length ? (
                <button type="button" onClick={() => onReply(row, true)} aria-label={`Reply to all ${also.length + 1} on it`}
                  style={{ flex: 1, minWidth: 0, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${NEUTRAL.airmailBlue}`, background: NEUTRAL.airmailBlue, color: NEUTRAL.white, fontSize: fs(13.5), fontWeight: 600 }}>
                  <CornerUpLeft size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> Reply to all {also.length + 1}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <ReportControl row={row} me={me} onReport={onReport} style={{ position: "absolute", top: 8, right: 8 }} />
      {keepable ? (
        <button type="button" onClick={() => onKeep(row)} aria-pressed={kept}
          aria-label={kept ? "Kept in your postcard box. Remove it" : `Keep ${from}’s postcard in your postcard box`}
          style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", minHeight: 44, padding: "0 8px", margin: 0, background: "transparent", border: 0, cursor: "pointer" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, boxSizing: "border-box", padding: "0 12px", borderRadius: 999, background: kept ? NEUTRAL.airmailBlue : NEUTRAL.white, border: `1px solid ${kept ? NEUTRAL.airmailBlue : NEUTRAL.airmailLine}`, boxShadow: `0 1px 3px ${rgba(NEUTRAL.ink, 0.12)}`, fontSize: fs(12.5), fontWeight: 600, lineHeight: 1, color: kept ? NEUTRAL.white : NEUTRAL.airmailBlue }}>
            {kept ? <BookmarkCheck size={14} strokeWidth={2} aria-hidden="true" focusable="false" /> : <Bookmark size={14} strokeWidth={2} aria-hidden="true" focusable="false" />}
            {kept ? "Kept" : "Keep"}
          </span>
        </button>
      ) : null}
    </article>
  );
}
