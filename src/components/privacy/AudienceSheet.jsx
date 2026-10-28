// AudienceSheet — the one privacy picker (founder, 2026-10-26: "privacy [in] 2 easy locations:
// settings and passport page and album page and stamping"). The same four words wherever it opens:
// the passport, a stamp, an album, right after stamping, and Settings → Privacy.
//
//   <AudienceSheet title value options ceiling onPick onClose confirmWider note onChangePassport />
//   options     AUDIENCES (default) or ALBUM_OPTS, from src/lib/audience.js
//   ceiling     the most this can reach (the passport's setting; for an album, its stamp's or the
//               passport's, whichever is narrower): wider options are greyed out, with one line
//               saying why (ceilingNote, else the passport's) and "Change your passport ›"
//               (onChangePassport) when given
//   onPick(v)   saves; resolve to true to close the sheet, false to keep it open
//   confirmWider(v) → words to confirm with, or null. Opening asks once; closing works at once
//               (founder's answer 7) — so it is only consulted for a wider choice.
//   note        a line under the choices (what this setting covers)
import React, { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { useDismissable } from "@/lib/dismissStack";
import { AUDIENCES, AUD, RANK, aboveCeiling } from "@/lib/audience";

const SERIF = "'Instrument Serif', Georgia, serif";
const BLUE = NEUTRAL.airmailBlue;

export default function AudienceSheet({ title, value, options = AUDIENCES, ceiling = null, onPick, onClose,
  confirmWider = undefined, note = undefined, onChangePassport = undefined, kicker = undefined, ceilingNote = undefined, extra = null }) {
  useDismissable(true, onClose);
  const titleId = `aud-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [busy, setBusy] = useState(null);
  const [ask, setAsk] = useState(null);   // { key, text } while a wider choice waits for its yes
  // Any list of the four words greys out what the ceiling doesn't allow (albums too, 2026-10-27).
  const isLevel = (k) => RANK[k] !== undefined;
  const capped = !!ceiling && options.some((o) => isLevel(o.key) && aboveCeiling(o.key, ceiling));

  const save = async (key) => {
    if (busy) return;
    setBusy(key);
    const ok = await onPick(key);
    setBusy(null);
    setAsk(null);
    if (ok !== false) onClose();
  };
  const pick = (key) => {
    if (busy || key === value) return;
    if (isLevel(key) && aboveCeiling(key, ceiling)) return;
    const wider = (RANK[key] ?? 0) > (RANK[value] ?? 0);
    const text = wider && typeof confirmWider === "function" ? confirmWider(key) : null;
    if (text) { setAsk({ key, text }); return; }
    save(key);
  };

  return createPortal(
    // A portal still bubbles through React: stop here, so closing this never closes the sheet under it.
    <div className="fixed inset-0 z-[10020] flex items-end justify-center" style={{ background: "rgba(22,17,13,.45)" }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
        style={{ background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0" }}>
        <AirmailChevron height={4} />
        <div style={{ padding: "12px 16px calc(20px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              {kicker ? <div style={{ fontSize: fs(11.5), color: NEUTRAL.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kicker}</div> : null}
              <h2 id={titleId} style={{ margin: 0, fontFamily: SERIF, fontSize: fs(23), fontWeight: 400, color: NEUTRAL.ink, lineHeight: 1.15 }}>{title}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 -8px 0 0", padding: 0, border: 0, background: "transparent", cursor: "pointer", flex: "none" }}>
              <X size={20} strokeWidth={2} color={NEUTRAL.ink2} aria-hidden="true" focusable="false" />
            </button>
          </div>

          {/* extra: what the choice covers, above the choices (an album lists its stamps). */}
          {extra}
          <div role="radiogroup" aria-labelledby={titleId} style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {options.map((o) => {
              const on = o.key === value;
              const off = isLevel(o.key) && aboveCeiling(o.key, ceiling);
              return (
                <button key={o.key} type="button" role="radio" aria-checked={on} aria-disabled={off || undefined} onClick={() => pick(o.key)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 58, padding: "8px 12px", textAlign: "left", borderRadius: 14,
                    border: `1.5px solid ${on ? BLUE : NEUTRAL.airmailLine}`, background: on ? "rgba(43,74,126,.06)" : NEUTRAL.white,
                    opacity: off ? 0.45 : 1, cursor: off ? "default" : "pointer", font: "inherit" }}>
                  <span aria-hidden="true" style={{ fontSize: fs(20), width: 28, textAlign: "center", flex: "none" }}>{o.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: fs(15), fontWeight: 650, color: NEUTRAL.ink }}>{o.label}</span>
                    <span style={{ display: "block", fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink3 }}>{o.line}</span>
                  </span>
                  <span aria-hidden="true" style={{ width: 24, flex: "none", display: "flex", justifyContent: "center" }}>
                    {busy === o.key ? <span style={{ fontSize: fs(13), color: BLUE }}>…</span> : on ? <Check size={20} strokeWidth={2.6} color={BLUE} /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          {capped ? (
            <p style={{ margin: "12px 2px 0", fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              {ceilingNote || <>Your passport is set to {AUD[ceiling].icon} {AUD[ceiling].label}, so this can’t reach more than {ceiling === "me" ? "you" : ceiling === "inner" ? "your friends" : "your friends and followers"}.</>}
              {typeof onChangePassport === "function" ? (
                <> <button type="button" onClick={onChangePassport} style={{ padding: 0, border: 0, background: "transparent", color: BLUE, font: "inherit", fontWeight: 650, cursor: "pointer" }}>Change your passport ›</button></>
              ) : null}
            </p>
          ) : null}

          {ask ? (
            <div role="alertdialog" aria-label="Confirm" style={{ marginTop: 12, padding: "12px 12px 10px", borderRadius: 14, background: "#FBF3E2", border: "1px solid #E5CA98" }}>
              <p style={{ margin: 0, fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink }}>{ask.text}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => save(ask.key)} disabled={!!busy}
                  style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 0, background: BLUE, color: NEUTRAL.white, font: "inherit", fontSize: fs(14), fontWeight: 650, cursor: "pointer" }}>
                  {busy ? "Saving…" : `Open to ${AUD[ask.key]?.label || "them"}`}
                </button>
                <button type="button" onClick={() => setAsk(null)}
                  style={{ flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, font: "inherit", fontSize: fs(14), fontWeight: 600, cursor: "pointer" }}>
                  Not now
                </button>
              </div>
            </div>
          ) : null}

          {note ? <p style={{ margin: "12px 2px 0", fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>{note}</p> : null}
          <p style={{ margin: "10px 2px 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink3 }}>🔒 Postcards and telegrams are always private: only you and the people you send them to.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
