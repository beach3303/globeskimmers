// TelegramCard — a telegram in the Mailbox (founder, 2026-10-19). A new one arrives SEALED
// (TelegramEnvelope): tapping it breaks the seal, the worker stamps RECEIVED, and the blank with
// its words on tape takes its place. Then one row: Reply (a telegram back, once it's open) and
// the ••• (Delete, Report, Block — the caller's TravelerSheet). One place per action.
//
//   <TelegramCard row me meName onReply onReport />
//   row      a social/feed telegram row ({ id, body, created_at, reply, by: { name, handle } })
//   me       your @handle; meName your first name (the TO line)
import React, { useState } from "react";
import { CornerUpLeft } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { ReportControl, senderName, whenLabel } from "@/components/social/Envelope";
import { openTelegram, telegramNumber, telegramWords } from "@/lib/telegram";
import TelegramPaper, { TINK3 } from "@/components/telegram/TelegramPaper";
import TelegramEnvelope from "@/components/telegram/TelegramEnvelope";

const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
// The reveal: the telegram rises out of the envelope.
const REVEAL = "@keyframes gsTgReveal{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

export default function TelegramCard({ row, me = undefined, meName = null, onReply = undefined, onReport = undefined, className = undefined, style = undefined }) {
  // sealed → opening (the flap lifts) → open. An opened one stays open.
  const [state, setState] = useState(() => (row?.received_at ? "open" : "sealed"));
  const [receivedAt, setReceivedAt] = useState(row?.received_at || null);
  if (!row || typeof row !== "object") return null;
  const open = () => {
    if (state !== "sealed") return;
    const now = new Date().toISOString();
    setReceivedAt(now);
    openTelegram(row.id).then((r) => {
      if (r.receivedAt) setReceivedAt(r.receivedAt);
      try { window.dispatchEvent(new Event("gs:mail")); } catch { /* no window */ }   // the Mailbox badge counts one fewer
    }).catch(() => {});
    if (reduced()) { setState("open"); return; }
    setState("opening");
    setTimeout(() => setState("open"), 720);
  };
  const from = senderName(row.by || {}, me);
  const myHandle = String((me && typeof me === "object" ? me.handle : me) ?? "").replace(/^@+/, "") || null;
  const firstName = String(meName ?? "").trim().split(/\s+/)[0] || null;
  const groupSize = Array.isArray(row.group) ? row.group.filter(Boolean).length + 1 : 1;
  return (
    // Each telegram sits in its own tray (founder, 2026-10-23: "there should be divisions between top
    // telegram versus the next … i couldn't tell if the reply and delete is for the below telegram or
    // the top"): a header naming the sender, the blank, and its own Reply row under a hairline.
    <article aria-label={state === "open" ? `Telegram from ${from === "You" ? "you" : from}: ${row.body || ""}` : `A sealed telegram from ${from === "You" ? "you" : from}`} className={className}
      style={{ position: "relative", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 18, padding: 10, boxShadow: "0 10px 22px -16px rgba(22,17,13,.4)", ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, margin: "2px 4px 8px" }}>
        <span style={{ minWidth: 0, fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", textTransform: "uppercase", color: TINK3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Telegram from <b style={{ fontWeight: 600, color: NEUTRAL.ink }}>{from}</b>{row.reply ? " · a reply" : ""}
        </span>
        {whenLabel(row.created_at) ? <span style={{ flex: "none", fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".08em", textTransform: "uppercase", color: TINK3 }}>{whenLabel(row.created_at)}</span> : null}
      </div>
      {state === "open" ? (
        <div style={{ animation: row.received_at && receivedAt === row.received_at ? undefined : "gsTgReveal .45s ease-out both" }}>
          <style>{REVEAL}</style>
          <TelegramPaper mode="received" body={row.body} to={{ name: firstName, handle: myHandle }} also={row.group} ink={row.ink} from={row.by} at={row.created_at} receivedAt={receivedAt}
            number={telegramNumber(row.id)} words={telegramWords(row.body)} />
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <TelegramEnvelope to={{ name: firstName, handle: myHandle }} from={row.by} group={Array.isArray(row.group) && row.group.length > 0} opening={state === "opening"} onOpen={open} />
          {/* Sealed, the ••• sits in the envelope's corner: no empty row under it. */}
          <ReportControl row={row} me={me} onReport={onReport} style={{ position: "absolute", right: 2, bottom: 2, zIndex: 4 }} />
        </div>
      )}
      {state === "open" ? <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${NEUTRAL.airmailHair}` }}>
        {typeof onReply === "function" && row.id && state === "open" ? (
          <>
            <button type="button" onClick={() => onReply(row, false)} aria-label={`Reply to ${from}`}
              style={{ flex: 1, minWidth: 0, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${NEUTRAL.airmailBlue}`, background: NEUTRAL.white, color: NEUTRAL.airmailBlue, fontSize: fs(13.5), fontWeight: 600 }}>
              <CornerUpLeft size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> Reply to {from}
            </button>
            {/* A group telegram (2026-10-25): reply to the sender or to everyone on it. */}
            {groupSize > 1 ? (
              <button type="button" onClick={() => onReply(row, true)} aria-label={`Reply to all ${groupSize} on it`}
                style={{ flex: 1, minWidth: 0, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${NEUTRAL.airmailBlue}`, background: NEUTRAL.airmailBlue, color: NEUTRAL.white, fontSize: fs(13.5), fontWeight: 600 }}>
                <CornerUpLeft size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> Reply to all {groupSize}
              </button>
            ) : null}
          </>
        ) : <span style={{ flex: 1 }} />}
        <ReportControl row={row} me={me} onReport={onReport} />
      </div> : null}
    </article>
  );
}
