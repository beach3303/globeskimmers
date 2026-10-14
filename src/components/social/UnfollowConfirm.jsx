// UnfollowConfirm: 'Unfollow @aiko?' before an unfollow happens (bible.profile.circle_screen:
// where one tap on a Mailbox chip used to unfollow at once). A bottom sheet on ivory with
// the airmail edge, the person's name, one sentence on what changes, and two 48px answers:
// the action in stamp red, and Cancel. Registered with the dismiss stack, so a swipe down
// or the back gesture closes it; Escape too. It renders on <body>.
//
//   <UnfollowConfirm person mode busy onConfirm onClose />
//   person   { handle, name } (the sheet is open while it is set).
//   mode     'unfollow' (default), 'inner' (unfollowing someone in your inner circle),
//            'cancel' (a follow request still waiting) or 'block'.
//   busy     the action is on its way: the answers wait, focus stays.
import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useDismissable } from "@/lib/dismissStack";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";

const SERIF = "'Instrument Serif', Georgia, serif";

const handleOf = (p) => String(p?.handle ?? "").trim().replace(/^@+/, "");

const WORDS = {
  unfollow: {
    title: (who) => `Unfollow ${who}?`,
    body: "Their new stamps and postcards stop reaching your mailbox. You can follow them again any time.",
    action: "Unfollow",
  },
  inner: {
    title: (who) => `Unfollow ${who}?`,
    body: "You leave each other’s inner circle, so their private passport closes to you. You can follow them again any time.",
    action: "Unfollow",
  },
  cancel: {
    title: (who) => `Cancel your request to ${who}?`,
    body: "They won’t see it any more. You can ask again any time.",
    action: "Cancel request",
  },
  block: {
    title: (who) => `Block ${who}?`,
    body: "You stop following each other, and they can’t open your page or send you postcards. You can unblock them from Your circle.",
    action: "Block",
  },
};

/**
 * @param {{ person?: any, mode?: 'unfollow'|'inner'|'cancel'|'block', busy?: boolean, onConfirm?: () => void, onClose?: () => void }} props
 */
export default function UnfollowConfirm({ person = null, mode = "unfollow", busy = false, onConfirm = undefined, onClose = undefined }) {
  const open = !!person;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const sheetRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const close = () => { if (!busy && typeof onClose === "function") onClose(); };
  const closeRef = useRef(close);
  closeRef.current = close;
  useDismissable(open, close);

  // Focus moves into the sheet and back to the door; Escape closes it.
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const before = document.activeElement;
    const t = setTimeout(() => { if (sheetRef.current) sheetRef.current.focus({ preventScroll: true }); }, 0);
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      if (before instanceof HTMLElement && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const w = WORDS[mode] || WORDS.unfollow;
  const h = handleOf(person);
  const who = h ? `@${h}` : String(person?.name ?? "").trim() || "this traveler";

  const answer = {
    display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 48,
    boxSizing: "border-box", margin: 0, padding: "0 16px", borderRadius: 14, font: "inherit",
    fontSize: fs(15), fontWeight: 600, cursor: busy ? "progress" : "pointer",
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" style={{ background: rgba(NEUTRAL.ink, 0.5) }} onClick={close}>
      <div ref={sheetRef} role="alertdialog" aria-modal="true" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`} tabIndex={-1}
        className="w-full max-w-md" onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0", overflow: "hidden", outline: "none" }}>
        <AirmailChevron height={4} />
        <div style={{ padding: "18px 20px calc(24px + env(safe-area-inset-bottom))" }}>
          <h3 id={`${uid}-t`} style={{ margin: 0, fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.15, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{w.title(who)}</h3>
          <p id={`${uid}-d`} style={{ margin: "6px 0 0", fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>{w.body}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => { if (!busy && typeof onConfirm === "function") onConfirm(); }} aria-busy={busy || undefined} aria-disabled={busy || undefined}
              style={{ ...answer, background: NEUTRAL.stamp, border: 0, color: NEUTRAL.white, opacity: busy ? 0.75 : 1 }}>
              {busy ? "One moment…" : w.action}
            </button>
            <button type="button" onClick={close} aria-disabled={busy || undefined}
              style={{ ...answer, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, color: NEUTRAL.ink2 }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
