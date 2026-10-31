// AddFriendsSheet — the one Add friends sheet (founder's decision sheet, 2026-10-25: a labeled "+ Add
// friends", "people already listed when Find people opens", and "where is the invite people by text?
// … do we have invite by email?"). Opened from the Mailbox and from Home's Arrivals page:
//   · Find people: name, @username or the email they signed up with (FindPeople);
//   · people already listed, before anyone types: who wrote to you and isn't in your circle yet, and
//     who follows you that you don't follow back — each with one Follow / Follow back;
//   · for friends not on GlobeSkimmers yet: Invite by text (the share sheet, as InviteButton) and
//     Invite by email (your mail app, with the same note and link), and a line on sending them a
//     postcard or telegram by their email address — with the two composers when the caller has them.
//
//   <AddFriendsSheet onClose writers onFollowed onPostcard onTelegram />
//   writers   the senders of mail to you ({ handle, name, avatar, cloth, user_id? }); only those with
//             a @username you don't follow (or asked to follow) are listed, five at most.
import React, { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Mail, X, Zap } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { useDismissable } from "@/lib/dismissStack";
import useCircle from "@/lib/useCircle";
import { getHandle, getShareLink } from "@/lib/passport";
import { askForAlerts } from "@/lib/pushAlerts";
import { showToast } from "@/components/Toast";
import { Face } from "@/components/social/SocialMarks";
import { workerMessage } from "@/components/social/FollowByHandle";
import FindPeople from "@/components/social/FindPeople";
import InviteButton, { inviteText } from "@/components/passport/InviteButton";
import UnfollowConfirm from "@/components/social/UnfollowConfirm";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BLUE = NEUTRAL.airmailBlue;
const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const KICKER = { margin: 0, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".16em", textTransform: "uppercase", color: BLUE };

function Person({ p, label, sub, busy, done, onFollow, onUndo = undefined }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52, borderBottom: `1px solid ${NEUTRAL.rule}` }}>
      <Face name={p.name} handle={p.handle} avatar={p.avatar} cloth={p.cloth} size={34} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: fs(14.5), fontWeight: 650, color: NEUTRAL.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name || `@${p.handle}`}</span>
        <span style={{ display: "block", fontSize: fs(12), color: NEUTRAL.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name && p.handle ? `@${p.handle} · ` : ""}{sub}</span>
      </span>
      {done ? (
        // A tap undoes it (founder, 2026-10-30): cancel the request, or unfollow.
        <button type="button" onClick={onUndo} aria-label={done === "Requested" ? `You asked to follow ${p.name || `@${p.handle}`}. Cancel the request?` : `Following ${p.name || `@${p.handle}`}. Unfollow?`}
          style={{ flex: "none", minHeight: 36, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 999, border: `1px solid ${NEUTRAL.airmailLine}`, background: "transparent", color: NEUTRAL.ink2, font: "inherit", fontSize: fs(13), fontWeight: 600, cursor: "pointer" }}>{done}</button>
      ) : (
        <button type="button" onClick={onFollow} aria-busy={busy || undefined} aria-label={`${label} ${p.name || `@${p.handle}`}`}
          style={{ flex: "none", minHeight: 36, padding: "0 14px", borderRadius: 999, border: 0, background: BLUE, color: NEUTRAL.white, font: "inherit", fontSize: fs(13), fontWeight: 650, cursor: "pointer" }}>
          {busy ? "…" : label}
        </button>
      )}
    </li>
  );
}

export default function AddFriendsSheet({ onClose, writers = [], onFollowed = undefined, onPostcard = undefined, onTelegram = undefined }) {
  useDismissable(true, onClose);
  const titleId = `af-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const circle = useCircle();
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});         // handle -> "Following" | "Requested"
  const ready = circle.status === "ready";
  const mine = new Set([...(circle.acc || []), ...(circle.pendingOut || [])].map((r) => lc(r.handle)).filter(Boolean));
  const blocked = circle.blockedHandles || new Set();
  const seen = new Set();
  const wrote = ready ? (writers || []).filter((p) => {
    const h = lc(p?.handle);
    if (!h || mine.has(h) || blocked.has(h) || seen.has(h)) return false;
    seen.add(h);
    return true;
  }).slice(0, 5) : [];
  const back = ready ? (circle.followersOnly || []).filter((p) => lc(p.handle) && !seen.has(lc(p.handle))).slice(0, 5) : [];

  const follow = async (p) => {
    const h = lc(p.handle);
    if (busy) return;
    setBusy(h);
    const res = await circle.follow({ user_id: p.user_id, handle: h });
    setBusy(null);
    if (!res.ok) { showToast(workerMessage(res.error, "Couldn’t follow them. Try again."), "error"); return; }
    const pending = res.data?.status === "pending";
    setDone((d) => ({ ...d, [h]: pending ? "Requested" : "Following" }));
    askForAlerts();
    showToast(pending ? `Asked to follow @${h} — they approve first` : `Following @${h}`, "success");
    if (typeof onFollowed === "function") onFollowed({ handle: h, status: pending ? "pending" : "accepted" });
  };
  // The pill undoes itself: the request is withdrawn, or the follow ends (founder, 2026-10-30).
  const [confirm, setConfirm] = useState(null);   // { person, mode }
  const [undoing, setUndoing] = useState(false);
  const askUndo = (p) => setConfirm({ person: p, mode: done[lc(p.handle)] === "Requested" ? "cancel" : "unfollow" });
  const undo = async () => {
    if (!confirm || undoing) return;
    const { person: p, mode } = confirm;
    const h = lc(p.handle);
    setUndoing(true);
    const res = await circle.unfollow({ user_id: p.user_id, handle: h });
    setUndoing(false);
    if (!res.ok) { showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error"); return; }
    setConfirm(null);
    setDone((d) => { const n = { ...d }; delete n[h]; return n; });
    showToast(mode === "cancel" ? "Request cancelled" : `Unfollowed @${h}`, "success");
  };

  const [mailing, setMailing] = useState(false);
  const emailInvite = async () => {
    if (mailing) return;
    setMailing(true);
    try {
      const [{ handle }, { data: sl }] = await Promise.all([getHandle(), getShareLink()]);
      const url = sl?.url || "https://globeskimmers.io";
      const href = `mailto:?subject=${encodeURIComponent("Join me on Globeskimmers")}&body=${encodeURIComponent(inviteText(handle, url))}`;
      window.location.href = href;
    } catch {
      showToast("Couldn’t open your email. Try Invite by text instead.", "error");
    } finally { setMailing(false); }
  };

  const line = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flex: 1, minWidth: 0, minHeight: 46, borderRadius: 14, font: "inherit", fontSize: fs(14), fontWeight: 600, cursor: "pointer" };
  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-end justify-center" style={{ background: "rgba(22,17,13,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
        style={{ background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0" }}>
        <AirmailChevron height={4} />
        <div style={{ padding: "12px 16px calc(22px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 id={titleId} style={{ margin: 0, fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, color: NEUTRAL.ink }}>Add <em style={{ fontStyle: "italic", color: BLUE }}>friends</em></h2>
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 -8px 0 0", padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
              <X size={20} strokeWidth={2} color={NEUTRAL.ink2} aria-hidden="true" focusable="false" />
            </button>
          </div>

          <FindPeople onFollowed={onFollowed} labelHidden style={{ marginTop: 6 }} />
          <UnfollowConfirm person={confirm?.person || null} mode={confirm?.mode || "unfollow"} busy={undoing} onConfirm={undo} onClose={() => setConfirm(null)} zIndex={10020} />

          {wrote.length ? (
            <section aria-label="People who wrote to you" style={{ marginTop: 18 }}>
              <h3 style={KICKER}>People who wrote to you</h3>
              <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
                {wrote.map((p) => <Person key={lc(p.handle)} p={p} label="Follow" sub="sent you mail" busy={busy === lc(p.handle)} done={done[lc(p.handle)]} onFollow={() => follow(p)} onUndo={() => askUndo(p)} />)}
              </ul>
            </section>
          ) : null}
          {back.length ? (
            <section aria-label="They follow you" style={{ marginTop: 18 }}>
              <h3 style={KICKER}>They follow you</h3>
              <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
                {back.map((p) => <Person key={lc(p.handle)} p={p} label="Follow back" sub="follows you" busy={busy === lc(p.handle)} done={done[lc(p.handle)]} onFollow={() => follow(p)} onUndo={() => askUndo(p)} />)}
              </ul>
            </section>
          ) : null}

          <section aria-label="Invite friends who aren’t on GlobeSkimmers" style={{ marginTop: 20, padding: 14, borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }}>
            <h3 style={KICKER}>Not on GlobeSkimmers yet?</h3>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <InviteButton label="Invite by text" variant="solid" style={{ flex: 1, minWidth: 0, marginTop: 0 }} />
              <button type="button" onClick={emailInvite} aria-busy={mailing || undefined} style={{ ...line, border: `1px solid ${BLUE}`, background: NEUTRAL.white, color: BLUE }}>
                <Mail size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> Invite by email
              </button>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: fs(12.5), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
              Or send them a postcard or telegram: put their email address in Send to, and they get it with an invitation to join. “Or text or share it” sends it by text instead.
            </p>
            {onPostcard || onTelegram ? (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {onPostcard ? (
                  <button type="button" onClick={onPostcard} style={{ ...line, minHeight: 42, border: `1px solid ${BLUE}`, background: "transparent", color: BLUE }}>
                    <Mail size={15} strokeWidth={2} aria-hidden="true" focusable="false" /> Send a postcard
                  </button>
                ) : null}
                {onTelegram ? (
                  <button type="button" onClick={onTelegram} style={{ ...line, minHeight: 42, border: "1px solid #2A2219", background: "#F2E4BC", color: "#2A2219" }}>
                    <Zap size={15} strokeWidth={2} aria-hidden="true" focusable="false" /> Send a telegram
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
