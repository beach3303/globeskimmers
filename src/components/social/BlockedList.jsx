// BlockedList: the people you blocked, at the foot of the Circle screen. A quiet row,
// 'Blocked · 2', that opens the list; each person has their face, name and @handle, and
// 'Unblock'. Unblocking works on today's worker (social/follow op 'unblock'), so it is
// always reachable, even where Block itself isn't offered yet. Hidden when nobody is
// blocked.
//
//   <BlockedList circle cloth className style />
//   circle   useCircle(): blocked rows and unblock().
import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { showToast } from "@/components/Toast";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";
import { Face } from "@/components/social/SocialMarks";
import { workerMessage } from "@/components/social/FollowByHandle";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

const handleOf = (p) => String(p?.handle ?? "").trim().replace(/^@+/, "");
const nameOf = (p) => String(p?.name ?? "").trim() || (handleOf(p) ? `@${handleOf(p)}` : "A traveler");

/**
 * @param {{ circle: any, cloth?: any, className?: string, style?: import('react').CSSProperties }} props
 */
export default function BlockedList({ circle, cloth = undefined, className = undefined, style = undefined }) {
  const c = clothRow(cloth);
  const listId = `blocked-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(/** @type {string|null} */ (null));
  const rows = Array.isArray(circle?.blocked) ? circle.blocked : [];
  if (!rows.length) return null;

  const unblock = async (p) => {
    const id = String(p.user_id ?? "");
    if (!id || busy) return;
    setBusy(id);
    const res = await circle.unblock(p);
    setBusy(null);
    if (!res.ok) { showToast(workerMessage(res.error, "Couldn’t unblock them. Try again."), "error"); return; }
    showToast(`Unblocked ${handleOf(p) ? `@${handleOf(p)}` : nameOf(p)}`, "success");
  };

  return (
    <section aria-label="Blocked" className={className} style={{ background: NEUTRAL.white, border: `1px solid ${c.line}`, borderRadius: 16, overflow: "hidden", ...style }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={listId}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", minHeight: 52, padding: "0 16px", background: "transparent", border: 0, font: "inherit", textAlign: "left", cursor: "pointer" }}>
        <span style={{ fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.3, fontWeight: 500, letterSpacing: ".14em", color: NEUTRAL.ink3 }}>
          BLOCKED · {rows.length}
        </span>
        <ChevronDown size={16} strokeWidth={2} color={NEUTRAL.ink3} aria-hidden="true" focusable="false"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open ? (
        <ul id={listId} style={{ margin: 0, padding: "0 0 8px", listStyle: "none", borderTop: `1px solid ${c.line}` }}>
          {rows.map((p) => {
            const id = String(p.user_id ?? handleOf(p));
            const h = handleOf(p);
            return (
              <li key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 8px 0 16px" }}>
                <Face name={p.name} handle={h} avatar={p.avatar} cloth={p.cloth} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SERIF, fontSize: fs(17), lineHeight: 1.2, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{nameOf(p)}</div>
                  {h ? <div style={{ marginTop: 2, fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.3, color: NEUTRAL.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{h}</div> : null}
                </div>
                <button type="button" onClick={() => unblock(p)} aria-busy={busy === id || undefined} aria-label={`Unblock ${nameOf(p)}`}
                  style={{ flexShrink: 0, minHeight: 44, padding: "0 14px", borderRadius: 999, background: NEUTRAL.white, border: `1px solid ${c.cloth}`, font: "inherit", fontSize: fs(13), fontWeight: 600, color: c.cloth, cursor: busy === id ? "progress" : "pointer" }}>
                  {busy === id ? "One moment…" : "Unblock"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
