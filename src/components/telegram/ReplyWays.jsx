// ReplyWays — how to answer a postcard (founder, 2026-10-19: "allow for reply to be sent even
// without a photo"): a postcard back, with a photo, or a telegram back, words only. One Reply
// button on the card opens this; each way is one tap.
//
//   <ReplyWays name onPostcard onTelegram onClose />
import React from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, Zap } from "lucide-react";
import { useDismissable } from "@/lib/dismissStack";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { TELEGRAM_WORDS, WORD_NAMES } from "@/lib/telegram";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

function Way({ icon, title, desc, onClick, tone }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 64, padding: "10px 14px", borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, textAlign: "left", cursor: "pointer" }}>
      <span aria-hidden="true" style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 12, background: tone.bg, color: tone.ink }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: fs(15), fontWeight: 600, color: NEUTRAL.ink }}>{title}</span>
        <span style={{ display: "block", marginTop: 1, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink3 }}>{desc}</span>
      </span>
    </button>
  );
}

export default function ReplyWays({ name = null, onPostcard, onTelegram, onClose }) {
  const close = () => onClose?.();
  useDismissable(true, close);
  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-end justify-center" style={{ background: rgba(NEUTRAL.ink, 0.45) }} onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="gs-replyways-h" className="w-full max-w-md" onClick={(e) => e.stopPropagation()}
        style={{ background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0", padding: "18px 20px calc(22px + env(safe-area-inset-bottom))" }}>
        <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>Reply</div>
        <h2 id="gs-replyways-h" style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.15, color: NEUTRAL.ink }}>
          Write back to <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>{name || "them"}</em>
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          <Way icon={<ImageIcon size={20} strokeWidth={2} />} title="A postcard back" desc="A photo on the front, your words on the back"
            tone={{ bg: rgba(NEUTRAL.stamp, 0.12), ink: NEUTRAL.stamp }} onClick={() => { close(); onPostcard?.(); }} />
          <Way icon={<Zap size={20} strokeWidth={2} />} title="A telegram back" desc={`${WORD_NAMES[TELEGRAM_WORDS].charAt(0).toUpperCase()}${WORD_NAMES[TELEGRAM_WORDS].slice(1)} words, no photo needed`}
            tone={{ bg: "#F2E4BC", ink: "#2A2219" }} onClick={() => { close(); onTelegram?.(); }} />
        </div>
        <button type="button" onClick={close} style={{ width: "100%", minHeight: 46, marginTop: 10, borderRadius: 12, border: 0, background: "transparent", color: NEUTRAL.ink2, fontSize: fs(14), fontWeight: 600 }}>Cancel</button>
      </div>
    </div>,
    document.body,
  );
}
