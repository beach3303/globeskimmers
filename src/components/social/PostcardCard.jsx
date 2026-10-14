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
import React from "react";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { PostmarkLines } from "@/components/redesign/ornaments";
import { PostmarkRing, ReportControl, senderName, whenLabel } from "@/components/social/Envelope";
import StampThumb, { stampThumbKind } from "@/components/passport/StampThumb";
import OfficialSeal from "@/components/passport/OfficialSeal";
import { feedStamp } from "@/lib/stampKind";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const DIVIDE = NEUTRAL.creamRule;     // #EADFC9 between the message and the address
const ADDRESS_RULE = "#DDD0B4";       // the ruled address lines (Mailbox L196-197)
const STAMP_BOX_LINE = "#CDBB98";     // the dashed stamp box (kraft line)

const handleOf = (v) => String((v && typeof v === "object" ? v.handle : v) ?? "").trim().replace(/^@+/, "").toLowerCase();

/**
 * @param {{ row: any, me?: any, meName?: string|null, onReport?: (row: any) => void, className?: string, style?: import('react').CSSProperties }} props
 */
export default function PostcardCard({ row, me = undefined, meName = null, onReport = undefined, className = undefined, style = undefined }) {
  if (!row || typeof row !== "object") return null;
  const by = row.by || {};
  const from = senderName(by, me);
  const toMe = row.to_me === true;
  const myHandle = handleOf(me);
  const place = String(row.place ?? "").trim();
  const message = String(row.message ?? "").trim();
  const dish = String(row.dish ?? "").trim();
  const stamp = feedStamp(row);
  const canStamp = !!stamp && stampThumbKind(stamp, { feedSafe: true }) !== null;
  const when = whenLabel(row.created_at);
  const seal = by.seal && by.verified !== false ? String(by.seal) : null;
  const firstName = String(meName ?? "").trim().split(/\s+/)[0] || null;

  return (
    <article aria-label={`Postcard from ${from === "You" ? "you" : from}${place ? `, ${place}` : ""}`} className={className}
      style={{ position: "relative", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 14, overflow: "hidden", boxShadow: `0 10px 22px -18px ${rgba(NEUTRAL.ink, 0.45)}`, ...style }}>
      <div style={{ margin: "8px 8px 0", borderRadius: 8, overflow: "hidden", aspectRatio: "3 / 2", background: NEUTRAL.airmailHair }}>
        <img src={row.photo} alt={place ? `Postcard from ${place}` : "A postcard"} loading="lazy" decoding="async"
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
            <div aria-hidden="true" style={{ position: "relative", height: 48 }}>
              <div style={{ position: "absolute", right: 4, top: 1, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: NEUTRAL.cream, border: `1px dashed ${STAMP_BOX_LINE}`, borderRadius: 2, transform: "rotate(3deg)" }}>
                {canStamp ? <StampThumb stamp={stamp} size={36} feedSafe /> : <PostmarkRing city={row.city || place} date={row.created_at} size={34} />}
              </div>
              <PostmarkRing city={row.city || place} date={row.created_at} size={40} style={{ position: "absolute", left: 18, top: 4 }} />
              <PostmarkLines variant="postcard" style={{ position: "absolute", left: 56, top: 17 }} />
            </div>
            {toMe && (firstName || myHandle) ? (
              <div style={{ marginTop: 8 }}>
                {firstName ? <div style={{ borderBottom: `1px solid ${ADDRESS_RULE}`, fontFamily: SERIF, fontSize: fs(17), lineHeight: 22 / 17, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{firstName}</div> : null}
                {myHandle ? <div style={{ marginTop: 4, borderBottom: `1px solid ${ADDRESS_RULE}`, fontFamily: MONO, fontSize: fs(10), lineHeight: 1.6, color: NEUTRAL.ink3, overflowWrap: "anywhere" }}>@{myHandle}</div> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 2, marginTop: 8, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.ink3 }}>
          <span>From {from}</span>
          {seal ? <OfficialSeal size={12} tier={seal} style={undefined} /> : null}
          {toMe ? <span>· To you</span> : null}
          {when ? <span style={{ marginLeft: "auto" }}>{when}</span> : null}
        </div>
      </div>
      <ReportControl row={row} me={me} onReport={onReport} style={{ position: "absolute", top: 8, right: 8 }} />
    </article>
  );
}
