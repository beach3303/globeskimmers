// ActivityList: what happened on your passport, the activity behind the Mailbox dot
// (Mailbox.dc.html L58-78; bible.mailbox). 'ON YOUR PASSPORT · 2 NEW' in mono airmail blue
// (the count only when something is new), then one white sheet with hairline rows: the
// person's 28px face ringed in their cloth, '<b>Ben</b> stamped WOW on your Griffith
// Observatory page', and the time in mono. Unread rows sit on the airmail tint and carry the
// word NEW, never a red dot. Rows that lead somewhere are buttons: reactions, signatures and
// tags open your Passport; a follow or a request opens your circle.
//
//   <ActivityList items onOpen className style />
//   items    social/unread activity ({ type, by: { name, handle, verified, seal, cloth?,
//            avatar? }, at, unread, to_me, place, reactions, photo, stamp, board, doodle, body }).
//            Hidden when empty.
//   onOpen   (destination) => void, where destination is 'passport', 'circle', or a card sent to
//            you: 'pc:<id>' / 'tg:<id>' (2026-10-19), which the Mailbox brings into view.
//   onMore   (item) => void: a 44px '•••' beside each row ('Options for {name}'), outside
//            the row's own button, e.g. TravelerSheet for Report and Block (go-live decision 6).
import React, { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { Face } from "@/components/social/SocialMarks";
import { whenLabel } from "@/components/social/Envelope";
import OfficialSeal from "@/components/passport/OfficialSeal";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const MAX_ROWS = 30;
// Collapsed to this many rows (founder, 2026-10-19: "quite a scroll"); "Show N more" opens the rest.
const SHOW_ROWS = 3;

/**
 * One line per thing that happened to you.
 * @param {any} a
 * @returns {{ who: string, text: string }}
 */
export function activityLine(a) {
  const by = a?.by || {};
  const who = String(by.name ?? "").trim() || (by.handle ? `@${String(by.handle).replace(/^@+/, "")}` : "A traveler");
  const from = a?.place ? ` from ${a.place}` : "";
  switch (a?.type) {
    case "follow_request": return { who, text: "asked to follow you" };
    case "follow": return { who, text: "followed you" };
    case "postcard": return { who, text: a.to_me ? `sent you a postcard${from}` : `sent a postcard${from}` };
    case "telegram": return { who, text: "sent you a telegram" };
    case "reaction": {
      const marks = Array.isArray(a.reactions) ? a.reactions.join(" · ") : "";
      // A board postcard (City Boards, 2026-10-14) carries `board`, its city.
      const where = "board" in a ? ` on your ${a.photo ? "photo" : "postcard"}${a.board ? ` on ${a.board}’s city board` : ""}` : a.photo ? ` on your photo${a.stamp ? ` from ${a.stamp}` : ""}` : a.stamp ? ` on your ${a.stamp} page` : " on your passport";
      return { who, text: `stamped ${marks}${where}` };
    }
    case "signature": {
      const words = a.body ? `: “${a.body}”` : "";
      if ("board" in a) return { who, text: `${a.doodle && !a.body ? "doodled on" : "commented on"} your ${a.photo ? "photo" : "postcard"}${a.board ? ` on ${a.board}’s city board` : ""}${words}` };
      if (a.photo) return { who, text: `${a.doodle && !a.body ? "doodled on" : "commented on"} your photo${a.stamp ? ` from ${a.stamp}` : ""}${words}` };
      return { who, text: `${a.doodle && !a.body ? "left a doodle on" : "signed"}${a.stamp ? ` your ${a.stamp} page` : " your passport"}${words}` };
    }
    case "tag": return { who, text: `tagged you${a.place ? ` at ${a.place}` : ""}. Were you there together?` };
    // The heads-up that photos hang on a board (City Billboards, 2026-10-16): no `who`, the board speaks.
    // The heads-up that people can now find you by name and email (Find people, 2026-10-18).
    case "board": if (a.board_kind === "find") return { who: "Find people", text: "is new: members can now find you by your name or the email you signed up with. Turn either off in Settings → Privacy." };
      // Several boards at once (2026-10-19): one line instead of one per board.
      if (a.board_kind === "many") { const names = a.boards || []; const shown = names.slice(0, 3).join(", "); const rest = names.length - 3; return { who: "Your photos", text: `now hang on ${names.length} boards — ${shown}${rest > 0 ? ` and ${rest} more` : ""}. Take any down from your album.` }; }
      return { who: a.board || "A city", text: `${a.board_kind === "state" ? "state" : a.board_kind === "country" ? "country" : "city"} board now shows ${a.photos === 1 ? "one of your photos" : `${a.photos || "some"} of your photos`} — take any down from your album` };
    default: return { who, text: "" };
  }
}

// Where a row leads, or null.
const destinationOf = (a) => {
  if (a?.type === "reaction" || a?.type === "signature" || a?.type === "tag") return "passport";
  if (a?.type === "follow" || a?.type === "follow_request") return "circle";
  if (a?.type === "postcard" && a.to_me && a.postcard_id) return `pc:${a.postcard_id}`;
  if (a?.type === "telegram" && a.telegram_id) return `tg:${a.telegram_id}`;
  return null;
};

/**
 * @param {{ items?: any[], onOpen?: (to: string) => void, className?: string, style?: import('react').CSSProperties }} props
 */
export default function ActivityList({ items = [], onOpen = undefined, onMore = undefined, className = undefined, style = undefined }) {
  const [open, setOpen] = useState(false);
  const all = (Array.isArray(items) ? items : []).filter((a) => a && typeof a === "object" && activityLine(a).text).slice(0, MAX_ROWS);
  const list = open ? all : all.slice(0, SHOW_ROWS);
  const hidden = all.length - list.length;
  if (!all.length) return null;
  const fresh = all.filter((a) => a.unread).length;
  return (
    <section aria-label="On your passport" className={className} style={style}>
      <h2 style={{ margin: 0, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.airmailBlue }}>
        On your passport{fresh > 0 ? ` · ${fresh} new` : ""}
      </h2>
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, overflow: "hidden" }}>
        {list.map((a, i) => {
          const { who, text } = activityLine(a);
          const to = destinationOf(a);
          const by = a.by || {};
          const when = whenLabel(a.at);
          const body = (
            <>
              <Face name={by.name} handle={by.handle} avatar={by.avatar} cloth={by.cloth} size={28} style={{ marginTop: 2 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: fs(13), lineHeight: 18 / 13, color: NEUTRAL.ink2, overflowWrap: "anywhere" }}>
                <b style={{ fontWeight: 600, color: NEUTRAL.ink }}>{who}</b>
                {by.verified ? <OfficialSeal size={11} tier={by.seal || "burgundy"} style={undefined} /> : null} {text}
              </span>
              <span style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, paddingTop: 2 }}>
                {a.unread ? <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", lineHeight: 1.26, color: NEUTRAL.stamp }}>NEW</span> : null}
                {when ? <span style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".06em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.ink3, whiteSpace: "nowrap" }}>{when}</span> : null}
              </span>
            </>
          );
          const rowStyle = {
            display: "flex", alignItems: "flex-start", gap: 10, width: "100%", minHeight: 44, boxSizing: "border-box",
            padding: "8px 14px", margin: 0, border: 0, borderTop: i ? `1px solid ${NEUTRAL.airmailHair}` : 0,
            background: a.unread ? NEUTRAL.airmailUnread : NEUTRAL.white, font: "inherit", textAlign: "left", color: "inherit",
          };
          const more = typeof onMore === "function";
          return (
            <li key={`${a.type}-${a.at}-${i}`} style={{ margin: 0, display: "flex", alignItems: "flex-start", borderTop: rowStyle.borderTop, background: rowStyle.background }}>
              {to && typeof onOpen === "function" ? (
                <button type="button" onClick={() => onOpen(to)} style={{ ...rowStyle, flex: 1, minWidth: 0, borderTop: 0, paddingRight: more ? 4 : 14, cursor: "pointer" }}>{body}</button>
              ) : (
                <div style={{ ...rowStyle, flex: 1, minWidth: 0, borderTop: 0, paddingRight: more ? 4 : 14 }}>{body}</div>
              )}
              {more ? (
                <button type="button" onClick={() => onMore(a)} aria-label={`Options for ${who}`} aria-haspopup="dialog"
                  style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "2px 4px 0 0", padding: 0, background: "transparent", border: 0, borderRadius: 999, color: NEUTRAL.ink3, cursor: "pointer" }}>
                  <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
                </button>
              ) : null}
            </li>
          );
        })}
        {open && all.length > SHOW_ROWS ? (
          <li>
            <button type="button" onClick={() => setOpen(false)} style={{ display: "block", width: "100%", minHeight: 44, padding: "8px 14px", margin: 0, border: 0, borderTop: `1px solid ${NEUTRAL.airmailHair}`, background: "transparent", font: "inherit", fontSize: fs(13), fontWeight: 600, color: NEUTRAL.airmailBlue, textAlign: "left", cursor: "pointer" }}>
              Show fewer
            </button>
          </li>
        ) : null}
        {hidden > 0 ? (
          <li>
            <button type="button" onClick={() => setOpen(true)} style={{ display: "block", width: "100%", minHeight: 44, padding: "8px 14px", margin: 0, border: 0, borderTop: `1px solid ${NEUTRAL.airmailHair}`, background: "transparent", font: "inherit", fontSize: fs(13), fontWeight: 600, color: NEUTRAL.airmailBlue, textAlign: "left", cursor: "pointer" }}>
              Show {hidden} more
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
