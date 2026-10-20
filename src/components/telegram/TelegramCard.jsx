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
import { ReportControl, senderName } from "@/components/social/Envelope";
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
    openTelegram(row.id).then((r) => { if (r.receivedAt) setReceivedAt(r.receivedAt); }).catch(() => {});
    if (reduced()) { setState("open"); return; }
    setState("opening");
    setTimeout(() => setState("open"), 720);
  };
  const from = senderName(row.by || {}, me);
  const myHandle = String((me && typeof me === "object" ? me.handle : me) ?? "").replace(/^@+/, "") || null;
  const firstName = String(meName ?? "").trim().split(/\s+/)[0] || null;
  return (
    <article aria-label={state === "open" ? `Telegram from ${from === "You" ? "you" : from}: ${row.body || ""}` : `A sealed telegram from ${from === "You" ? "you" : from}`} className={className} style={{ position: "relative", ...style }}>
      {row.reply ? (
        <div style={{ margin: "0 0 4px 2px", fontFamily: MONO, fontSize: fs(9), letterSpacing: ".18em", textTransform: "uppercase", color: TINK3 }}>A reply by wire</div>
      ) : null}
      {state === "open" ? (
        <div style={{ animation: row.received_at && receivedAt === row.received_at ? undefined : "gsTgReveal .45s ease-out both" }}>
          <style>{REVEAL}</style>
          <TelegramPaper mode="received" body={row.body} to={{ name: firstName, handle: myHandle }} also={row.group} ink={row.ink} from={row.by} at={row.created_at} receivedAt={receivedAt}
            number={telegramNumber(row.id)} words={telegramWords(row.body)} />
        </div>
      ) : (
        <TelegramEnvelope to={{ name: firstName, handle: myHandle }} from={row.by} group={Array.isArray(row.group) && row.group.length > 0} opening={state === "opening"} onOpen={open} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        {typeof onReply === "function" && row.id && state === "open" ? (
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
