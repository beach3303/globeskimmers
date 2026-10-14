// TravelerSheet: one traveler's options, wherever another person shows up:
// a postcard or stamp in the Mailbox, a follower, a request, someone you
// follow, a shared passport, a guestbook entry (go-live decision 6,
// 2026-10-13; Apple guideline 1.2). Report is always here. "Block this
// traveler" shows only when the worker advertises block_v2 and we know who
// the person is (src/lib/blocks.js), and it asks once, saying exactly what a
// block does, before it blocks. Unfollow shows for someone you follow.
// Rendered on document.body so it opens over any sheet it was called from.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import OfficialSeal from "@/components/passport/OfficialSeal";
import { useOverlayClose } from "@/components/home/SuggestPlaceSection";
import { socialFollow, blockTraveler, unblockTraveler, reportShared } from "@/lib/passport";
import { resolveTraveler, relationTo, blockTarget, travelerLabel } from "@/lib/blocks";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const STAMP = "#B0472F", IVORY = "#FFFCF7", SOFT = "#F6F0E4";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// The same reasons as the shared-passport report (minor_safety gets 24h triage).
const REASONS = [["minor_safety", "A child's safety"], ["nudity", "Nudity or sexual content"], ["harassment", "Harassment or hate"], ["spam", "Spam or a scam"], ["other", "Something else"]];

// person: { user_id?, handle?, name?, verified?, seal?, slug? } as the row has it.
// list: social/follow op:'list' data when the caller has it (else it's read here).
// report: what a Report from here files, over the default of the person
//   ({ kind:'profile', ref: their @handle or id }): { kind?, slug?, ref?, note? }.
//   Kinds the queue knows: profile, postcard, signature, stamp, passport,
//   photo, tag, handle (an older worker files the newer ones as 'passport').
// start: 'menu' | 'block' (straight to the block question).
// onChanged(what): 'blocked' | 'unblocked' | 'unfollowed', after it happened.
export default function TravelerSheet({ person, list: listProp = null, report = null, start = "menu", onClose, onChanged }) {
  const [list, setList] = useState(listProp);
  const [view, setView] = useState(start); // menu | report | block
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const panel = useRef(null);
  const head = useRef(null);
  const close = () => { if (!busy) onClose?.(); };
  useOverlayClose(true, close, panel);

  useEffect(() => {
    if (listProp) return undefined;
    let gone = false;
    (async () => { const { data } = await socialFollow("list"); if (!gone) setList(data || {}); })();
    return () => { gone = true; };
  }, [listProp]);
  // Focus moves into the sheet, and back to the button that opened it.
  useEffect(() => {
    const from = /** @type {HTMLElement | null} */ (document.activeElement);
    panel.current?.focus({ preventScroll: true });
    return () => { from?.focus?.({ preventScroll: true }); };
  }, []);
  useEffect(() => { setErr(null); head.current?.focus({ preventScroll: true }); }, [view]);

  const who = resolveTraveler(person, list);
  const name = travelerLabel(who);
  const rel = relationTo(who, list);
  const target = list ? blockTarget(who, list) : null;
  const loading = !list;

  // The person's @handle or id, as a report or block note names them.
  const byWho = who.handle ? `@${who.handle}` : who.user_id ? `user:${who.user_id}` : null;
  const doBlock = async () => {
    if (!target || busy) return;
    setBusy(true); setErr(null);
    // A block files a safety record for our team too (Apple 1.2): it carries
    // what the person was looking at, the same note a Report from here sends.
    const note = [report?.note, byWho ? `(by ${byWho})` : null].filter(Boolean).join(" ").slice(0, 480);
    const { ok, error } = await blockTraveler(note ? { ...target, note } : target);
    setBusy(false);
    if (!ok) { setErr(error); return; }
    showToast(`${name} is blocked`, "success");
    onChanged?.("blocked");
    onClose?.();
  };
  const doUnblock = async () => {
    if (!who.user_id || busy) return;
    setBusy(true); setErr(null);
    const { ok, error } = await unblockTraveler(who.user_id);
    setBusy(false);
    if (!ok) { setErr(error); return; }
    showToast(`${name} is unblocked`, "success");
    onChanged?.("unblocked");
    onClose?.();
  };
  const doUnfollow = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    const { error } = await socialFollow("unfollow", who.user_id ? { user_id: who.user_id } : { handle: who.handle });
    setBusy(false);
    if (error) { setErr(error); return; }
    showToast(rel.pending ? "Follow request cancelled" : `You unfollowed ${name}`, "success");
    onChanged?.("unfollowed");
    onClose?.();
  };
  const doReport = async (reason) => {
    if (busy) return;
    // The person by default; a caller adds what it is about (a postcard, an
    // entry…). When the ref points at the thing, the note still names the person.
    const by = byWho;
    const r = { kind: "profile", ref: by, ...(report || {}) };
    const note = [r.note, by && r.ref !== by ? `(by ${by})` : null].filter(Boolean).join(" ");
    setBusy(true); setErr(null);
    const { error } = await reportShared({ slug: r.slug || who.slug || undefined, kind: r.kind || "profile", ref: r.ref || undefined, reason, note: note || undefined });
    setBusy(false);
    if (error) { setErr(error); return; }
    showToast("Thank you — we review every report", "success");
    onClose?.();
  };

  const row = "w-full rounded-[12px] px-4 font-semibold text-left flex items-center gap-2 disabled:opacity-60";
  const rowStyle = { minHeight: 48, background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14) };
  const quiet = { minHeight: 48, background: SOFT, color: INK2, fontSize: fs(13.5) };
  const titleStyle = { margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(22), lineHeight: 1.15, color: INK, outline: "none" };

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-end justify-center" style={{ background: "rgba(22,17,13,.45)" }} onClick={close}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="gs-traveler-h" aria-busy={busy || loading}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-md outline-none"
        style={{ background: IVORY, borderRadius: "22px 22px 0 0", padding: "20px 20px calc(24px + env(safe-area-inset-bottom))", maxHeight: "calc(100% - 16px - env(safe-area-inset-top))", overflowY: "auto" }}>

        {view === "menu" && (
          <>
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".18em", color: STAMP }}>Traveler</div>
            <h2 id="gs-traveler-h" ref={head} tabIndex={-1} className="flex items-center gap-1.5" style={{ ...titleStyle, marginTop: 2 }}>
              <span className="truncate">{name}</span>
              {who.verified ? <OfficialSeal size={14} tier={who.seal || "burgundy"} /> : null}
            </h2>
            {who.handle && who.name && <div style={{ fontFamily: MONO, fontSize: fs(11.5), color: INK3, marginTop: 2 }}>@{who.handle}</div>}
            {rel.blocked && <p style={{ fontSize: fs(13), color: INK2, marginTop: 6 }}>You&rsquo;ve blocked {name}.</p>}
            <div className="flex flex-col gap-2 mt-4">
              {rel.following && !rel.blocked && (who.user_id || who.handle) && (
                <button type="button" onClick={doUnfollow} disabled={busy} className={row} style={rowStyle}>
                  {rel.pending ? "Cancel follow request" : "Unfollow"}
                </button>
              )}
              <button type="button" onClick={() => setView("report")} disabled={busy} className={row} style={rowStyle}>
                Report{who.name || who.handle ? ` ${name}` : ""}
              </button>
              {loading && (
                <div className="flex items-center gap-2 px-1" style={{ minHeight: 48, color: INK3, fontSize: fs(13) }}>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Checking what you can do here…
                </div>
              )}
              {target && !rel.blocked && (
                <button type="button" onClick={() => setView("block")} disabled={busy} className={row} style={{ ...rowStyle, color: STAMP }}>
                  Block this traveler
                </button>
              )}
              {rel.blocked && who.user_id && (
                <button type="button" onClick={doUnblock} disabled={busy} className={row} style={rowStyle}>
                  {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}Unblock
                </button>
              )}
              {err && <p role="alert" style={{ fontSize: fs(13), color: STAMP, lineHeight: 1.4 }}>{err}</p>}
              <button type="button" onClick={close} className="w-full rounded-[12px] font-semibold" style={quiet}>Cancel</button>
            </div>
          </>
        )}

        {view === "report" && (
          <>
            <h2 id="gs-traveler-h" ref={head} tabIndex={-1} style={titleStyle}>What&rsquo;s wrong here?</h2>
            <p style={{ fontSize: fs(13), color: INK2, lineHeight: 1.45, marginTop: 4 }}>
              We read every report. {name === "A traveler" ? "They" : name} won&rsquo;t know who sent it.
            </p>
            <div className="flex flex-col gap-2 mt-3">
              {REASONS.map(([id, label]) => (
                <button key={id} type="button" onClick={() => doReport(id)} disabled={busy} className={row} style={rowStyle}>{label}</button>
              ))}
              {err && <p role="alert" style={{ fontSize: fs(13), color: STAMP, lineHeight: 1.4 }}>{err}</p>}
              <button type="button" onClick={() => (start === "menu" ? setView("menu") : close())} disabled={busy} className="w-full rounded-[12px] font-semibold" style={quiet}>
                {start === "menu" ? "Back" : "Cancel"}
              </button>
            </div>
          </>
        )}

        {view === "block" && (
          <>
            <h2 id="gs-traveler-h" ref={head} tabIndex={-1} style={titleStyle}>Block {name}?</h2>
            {loading ? (
              <div className="flex items-center gap-2" style={{ minHeight: 48, color: INK3, fontSize: fs(13) }}>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" /> One moment…
              </div>
            ) : !target ? (
              <p role="alert" style={{ fontSize: fs(13.5), color: INK2, lineHeight: 1.45, marginTop: 8 }}>
                Blocking isn&rsquo;t available here yet. You can still report them.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-1.5" style={{ marginTop: 10, paddingLeft: 18, listStyle: "disc", color: INK2, fontSize: fs(14), lineHeight: 1.45 }}>
                  <li>You stop following each other, and they can&rsquo;t follow you again.</li>
                  <li>Their stamps and postcards stop reaching you, and yours stop reaching them.</li>
                  <li>In the app, your passport looks private to them. They aren&rsquo;t told you blocked them.</li>
                </ul>
                <p style={{ fontSize: fs(12.5), color: INK3, lineHeight: 1.45, marginTop: 8 }}>
                  You can unblock them any time in Settings, under Privacy.
                </p>
              </>
            )}
            {err && <p role="alert" style={{ fontSize: fs(13), color: STAMP, lineHeight: 1.4, marginTop: 8 }}>{err}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => (start === "menu" ? setView("menu") : close())} disabled={busy} className="flex-1 rounded-[12px] font-semibold" style={quiet}>
                Cancel
              </button>
              {target && (
                <button type="button" onClick={doBlock} disabled={busy} className="flex-1 rounded-[12px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ minHeight: 48, background: STAMP, color: "#fff", fontSize: fs(14) }}>
                  {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}{busy ? "Blocking…" : "Block"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
