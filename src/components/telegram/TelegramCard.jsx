// TelegramCard — a telegram in the Mailbox (founder, 2026-10-19): the received blank, its words
// on tape, then one row: Reply (a telegram back) and the ••• (Delete, Report, Block — the
// caller's TravelerSheet). One place per action.
//
//   <TelegramCard row me meName onReply onReport />
//   row      a social/feed telegram row ({ id, body, created_at, reply, by: { name, handle } })
//   me       your @handle; meName your first name (the TO line)
import React from "react";
import { CornerUpLeft } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { ReportControl, senderName } from "@/components/social/Envelope";
import { telegramNumber, telegramWords } from "@/lib/telegram";
import TelegramPaper, { TINK3 } from "@/components/telegram/TelegramPaper";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

export default function TelegramCard({ row, me = undefined, meName = null, onReply = undefined, onReport = undefined, className = undefined, style = undefined }) {
  if (!row || typeof row !== "object") return null;
  const from = senderName(row.by || {}, me);
  const myHandle = String((me && typeof me === "object" ? me.handle : me) ?? "").replace(/^@+/, "") || null;
  const firstName = String(meName ?? "").trim().split(/\s+/)[0] || null;
  return (
    <article aria-label={`Telegram from ${from === "You" ? "you" : from}: ${row.body || ""}`} className={className} style={{ position: "relative", ...style }}>
      {row.reply ? (
        <div style={{ margin: "0 0 4px 2px", fontFamily: MONO, fontSize: fs(9), letterSpacing: ".18em", textTransform: "uppercase", color: TINK3 }}>A reply by wire</div>
      ) : null}
      <TelegramPaper mode="received" body={row.body} to={{ name: firstName, handle: myHandle }} from={row.by} at={row.created_at}
        number={telegramNumber(row.id)} words={telegramWords(row.body)} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        {typeof onReply === "function" && row.id ? (
          <button type="button" onClick={() => onReply(row)} aria-label={`Reply to ${from}`}
            style={{ flex: 1, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${NEUTRAL.airmailBlue}`, background: NEUTRAL.white, color: NEUTRAL.airmailBlue, fontSize: fs(13.5), fontWeight: 600 }}>
            <CornerUpLeft size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> Reply
          </button>
        ) : <span style={{ flex: 1 }} />}
        <ReportControl row={row} me={me} onReport={onReport} />
      </div>
    </article>
  );
}
