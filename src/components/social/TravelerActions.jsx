// TravelerActions: the one action under someone's bookplate (Profile-Visit L75-88;
// bible.profile.visiting, word.lines). It follows the relationship, read from your own
// circle (useCircle) so it changes the moment you act:
//   nobody yet            'Follow' (solid, their cloth)       + •••
//   they follow you       'Follow back' (solid)               + •••
//   you asked, waiting    'Requested' (words, no button)      + •••
//   you follow them       'Following' (outline: asks first)   + •••
//   inner circle          'Send a postcard' (solid, Mail) + 'Inner circle ⌄' (two rings),
//                         whose menu is the •••
// The ••• ('More options for @handle') holds Unfollow (or Cancel request) when you follow
// them, Report always, and Block only where the worker can honour it (useCircle.canBlock)
// and their user id is known. Unfollow, Cancel request and Block ask first
// (UnfollowConfirm). Without a handle there is no Follow (the worker follows by handle).
// On today's worker (fallback) the page knows only the share link, so Block goes through
// production's TravelerSheet by slug, as production's friend view does (go-live decision 6).
//
//   <TravelerActions person relation cloth fallback slug report onChanged className style />
//   person    { user_id, handle, name }.
//   relation  useCircle().relationOf(person), else the world's: 'inner', 'following',
//             'requested', 'follower', 'requesting', 'blocked' or null.
//   fallback  today's worker by slug: no follow edges are known, so only the ••• with Report
//             (and Block by the share link, below).
//   slug      their passport's share link, for that Block.
//   report    { payload, subject } for ReportSheet (reportTraveler in world.js).
//   onChanged called after a follow, unfollow or block lands (the page reads again).
//
//   MoreMenu (exported) is the ••• menu the circle list shares: a 44px trigger with
//   aria-haspopup='menu', a white menu of 44px items under it, closed by a tap outside,
//   Escape, the back gesture (dismiss stack) or a choice.
import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Mail, MoreHorizontal } from "lucide-react";
import { showToast } from "@/components/Toast";
import useCircle from "@/lib/useCircle";
import { useDismissable } from "@/lib/dismissStack";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";
import { TwoRingMark } from "@/components/social/SocialMarks";
import { ReportSheet } from "@/components/social/Envelope";
import { workerMessage } from "@/components/social/FollowByHandle";
import PostcardCompose from "@/components/passport/PostcardCompose";
import UnfollowConfirm from "@/components/social/UnfollowConfirm";
import TravelerSheet from "@/components/social/TravelerSheet";

/** @typedef {import('react').CSSProperties} CSS */

const handleOf = (p) => String(p?.handle ?? "").trim().replace(/^@+/, "");
const whoOf = (p) => (handleOf(p) ? `@${handleOf(p)}` : String(p?.name ?? "").trim() || "this traveler");

/**
 * @param {{
 *   label: string, items: Array<{ key: string, label: string, onSelect: () => void, danger?: boolean }>,
 *   children?: import('react').ReactNode, triggerStyle?: CSS, menuWidth?: number, className?: string, style?: CSS,
 * }} props
 */
export function MoreMenu({ label, items, children = null, triggerStyle = undefined, menuWidth = 220, className = undefined, style = undefined }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
  const menuId = `menu-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const close = (focusBack = true) => {
    setOpen(false);
    if (focusBack && triggerRef.current) triggerRef.current.focus({ preventScroll: true });
  };
  useDismissable(open, () => close(false));

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") close(true); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    // The first choice takes focus, as a menu should.
    const t = setTimeout(() => { wrapRef.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true }); }, 0);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const list = (items || []).filter(Boolean);
  if (!list.length) return null;

  const onMenuKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const all = [...(wrapRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    const i = all.indexOf(document.activeElement);
    const next = all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length];
    next?.focus({ preventScroll: true });
  };

  return (
    <div ref={wrapRef} className={className} style={{ position: "relative", flexShrink: 0, ...style }}>
      <button ref={triggerRef} type="button" aria-label={children ? undefined : label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        style={children ? triggerStyle : {
          display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, margin: 0,
          borderRadius: 999, background: "transparent", border: 0, cursor: "pointer", ...triggerStyle,
        }}>
        {children || (
          <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, boxSizing: "border-box", borderRadius: 999, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, boxShadow: `0 1px 3px ${rgba(NEUTRAL.ink, 0.12)}` }}>
            <MoreHorizontal size={16} color={NEUTRAL.ink2} strokeWidth={2} />
          </span>
        )}
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKey}
          style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 40, width: menuWidth, maxWidth: "calc(100vw - 32px)", boxSizing: "border-box", padding: 6, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 14, boxShadow: `0 16px 32px -18px ${rgba(NEUTRAL.ink, 0.45)}` }}>
          {list.map((it) => (
            <button key={it.key} type="button" role="menuitem" onClick={() => { close(false); it.onSelect(); }}
              style={{ display: "flex", alignItems: "center", width: "100%", minHeight: 44, boxSizing: "border-box", padding: "0 12px", margin: 0, borderRadius: 10, background: "transparent", border: 0, font: "inherit", fontSize: fs(14), fontWeight: 600, textAlign: "left", color: it.danger ? NEUTRAL.stamp : NEUTRAL.ink2, cursor: "pointer" }}>
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   person: any, relation?: string|null, cloth?: any, fallback?: boolean, slug?: string|null, report?: any,
 *   onChanged?: (what: string) => void, className?: string, style?: CSS,
 * }} props
 */
export default function TravelerActions({ person, relation = null, cloth = undefined, fallback = false, slug = null, report = null, onChanged = undefined, className = undefined, style = undefined }) {
  const circle = useCircle();
  const c = clothRow(cloth);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(/** @type {null|'unfollow'|'inner'|'cancel'|'block'} */ (null));
  const [reporting, setReporting] = useState(false);
  const [writing, setWriting] = useState(false);
  const [blockingLink, setBlockingLink] = useState(false);

  const h = handleOf(person);
  const id = person?.user_id ? String(person.user_id) : null;
  const who = whoOf(person);
  const canBlock = !fallback && circle.canBlock && !!id;
  const canBlockLink = !canBlock && circle.canBlock && !!slug;
  const changed = (what) => { if (typeof onChanged === "function") onChanged(what); };

  const follow = async () => {
    if (busy || !h) return;
    setBusy(true);
    const res = await circle.follow({ handle: h, ...(id ? { user_id: id } : {}) });
    setBusy(false);
    if (!res.ok) { showToast(workerMessage(res.error, "Couldn’t follow them. Try again."), "error"); return; }
    const pending = res.data?.status === "pending";
    showToast(pending ? `Asked to follow @${h} — they approve first` : `Following @${h}`, "success");
    changed("follow");
  };

  const act = async () => {
    if (busy || !confirm) return;
    setBusy(true);
    const res = confirm === "block" ? await circle.block({ user_id: id }) : await circle.unfollow({ user_id: id, handle: h });
    setBusy(false);
    if (!res.ok) { showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error"); return; }
    const what = confirm;
    setConfirm(null);
    showToast(what === "block" ? `Blocked ${who}` : what === "cancel" ? "Request cancelled" : `Unfollowed ${who}`, "success");
    changed(what);
  };

  const rel = fallback ? null : relation;
  const items = [
    rel === "inner" || rel === "following" ? { key: "unfollow", label: "Unfollow", onSelect: () => setConfirm(rel === "inner" ? "inner" : "unfollow") } : null,
    rel === "requested" ? { key: "cancel", label: "Cancel request", onSelect: () => setConfirm("cancel") } : null,
    report ? { key: "report", label: "Report", onSelect: () => setReporting(true) } : null,
    canBlock ? { key: "block", label: "Block", danger: true, onSelect: () => setConfirm("block") } : null,
    canBlockLink ? { key: "block", label: "Block", danger: true, onSelect: () => setBlockingLink(true) } : null,
  ].filter(Boolean);
  const moreLabel = `More options for ${who}`;

  /** @type {CSS} */
  const big = { display: "flex", flex: "1 1 auto", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 0, minHeight: 48, boxSizing: "border-box", padding: "4px 12px", borderRadius: 14, font: "inherit", fontSize: fs(15), lineHeight: 1.2, fontWeight: 600, cursor: busy ? "progress" : "pointer" };
  const solid = { ...big, background: c.cloth, border: 0, color: NEUTRAL.white };
  const outline = { ...big, background: "transparent", border: `1.5px solid ${c.cloth}`, color: c.cloth };

  let primary = null;
  if (!fallback && rel !== "blocked") {
    if (rel === "inner") {
      primary = (
        <>
          {h ? (
            <button type="button" onClick={() => setWriting(true)} style={solid}>
              <Mail size={18} strokeWidth={2} aria-hidden="true" focusable="false" /> Send a postcard
            </button>
          ) : null}
          <MoreMenu label={moreLabel} items={items}
            triggerStyle={{ ...outline, flex: h ? "0 0 auto" : "1 1 auto", gap: 6, padding: "4px 14px", fontSize: fs(14) }}>
            <TwoRingMark color={c.cloth} strokeWidth={1.5} />
            <span>Friends</span>
            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
            <span className="sr-only">, more options for {who}</span>
          </MoreMenu>
        </>
      );
    } else if (rel === "following") {
      primary = (
        <button type="button" onClick={() => setConfirm("unfollow")} aria-label={`Following ${who}. Unfollow?`} style={outline}>Following</button>
      );
    } else if (rel === "requested") {
      // A tap cancels the request (founder, 2026-10-30: "allow users to cancel their request to follow").
      primary = (
        <button type="button" onClick={() => setConfirm("cancel")} aria-label={`You asked to follow ${who}. Cancel the request?`}
          style={{ ...outline, borderColor: NEUTRAL.rule, color: NEUTRAL.ink3, fontWeight: 500 }}>
          Requested
        </button>
      );
    } else if (h) {
      primary = (
        <button type="button" onClick={follow} aria-busy={busy || undefined} aria-disabled={busy || undefined} style={{ ...solid, opacity: busy ? 0.75 : 1 }}>
          {busy ? "One moment…" : rel === "follower" ? "Follow back" : "Follow"}
        </button>
      );
    }
  }

  const showMore = rel !== "inner" || fallback;
  return (
    <div className={className} style={{ display: "flex", alignItems: "center", justifyContent: primary ? "flex-start" : "flex-end", gap: 8, ...style }}>
      {primary}
      {showMore ? <MoreMenu label={moreLabel} items={items} /> : null}
      <UnfollowConfirm person={confirm ? person : null} mode={confirm || "unfollow"} busy={busy} onConfirm={act} onClose={() => setConfirm(null)} />
      <ReportSheet payload={reporting ? report?.payload : undefined} subject={report?.subject} onClose={() => setReporting(false)} />
      {blockingLink ? (
        <TravelerSheet person={{ slug, handle: h || null, name: String(person?.name ?? "").trim() || null }} start="block"
          report={{ kind: "passport", slug }} onClose={() => setBlockingLink(false)}
          onChanged={(what) => { setBlockingLink(false); changed(what === "blocked" ? "block" : what); }} />
      ) : null}
      {h ? (
        <PostcardCompose open={writing} onClose={() => setWriting(false)} onSent={() => setWriting(false)} toHandle={h}
          blocked={circle.blocked} />
      ) : null}
    </div>
  );
}
