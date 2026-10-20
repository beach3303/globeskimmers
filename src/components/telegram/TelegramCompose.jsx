// TelegramCompose — write and wire a telegram (founder, 2026-10-19): words only, four at most,
// to one person by @username, or back to whoever sent you a telegram or a postcard. The sheet
// is the telegraph office's counter (dark), the blank sits on it, and you type straight onto
// the form; a meter of four boxes fills as words go on, and "On the wire" shows the words as
// they'll arrive (as typed, minus links). The worker checks the words at send.
// The chevron at the top right (or a tap above the sheet) collapses it without sending, and the
// words wait: opening the same telegram again brings the draft back (founder, 2026-10-19).
//
// Several people (2026-10-19): pick up to TG_MAX_TO, then SEPARATELY (private copies) or AS A
// GROUP (one telegram naming everyone); a reply to a group telegram can go to the sender or to all.
//
//   <TelegramCompose open onClose onSent following blocked replyTo toHandle meName meHandle />
//   following  op:list `following` rows: accepted people you follow with a @username (12 at most)
//   blocked    op:list `blocked` rows / ids / handles: never offered
//   replyTo    { reply_to, name, handle, group? } — a reply; group = the other @usernames on it
//   toHandle   a fixed @username
import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, Zap } from "lucide-react";
import { showToast } from "@/components/Toast";
import { useDismissable } from "@/lib/dismissStack";
import { askForAlerts } from "@/lib/pushAlerts";
import { workerMessage } from "@/components/social/FollowByHandle";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { TELEGRAM_WORDS, sendTelegram, telegramFit, telegramText, telegramWords } from "@/lib/telegram";
import TelegramPaper, { TINK, TINK3, TRED, TYPE } from "@/components/telegram/TelegramPaper";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const DESK = "#231C15";
const BRASS = "#C9A35A";
const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const HANDLE = /^[a-z0-9._]{2,30}$/;
const TG_MAX_TO = 10;
// "@a, @b, @c" or "@a, @b +3" for the blank's TO line.
const toLineOf = (handles) => (handles.length <= 3 ? handles.map((h) => `@${h}`).join(", ") : `${handles.slice(0, 2).map((h) => `@${h}`).join(", ")} +${handles.length - 2}`);
// Drafts kept while the app is open, one per reply (or one for a new telegram).
const DRAFTS = new Map();
const draftKey = (replyTo, toHandle) => (replyTo && replyTo.reply_to ? `re:${replyTo.reply_to}` : toHandle ? `to:${lc(toHandle)}` : "new");

function Chip({ on = false, fixed = false, onClick = undefined, children }) {
  const style = { minHeight: 36, padding: "0 12px", marginTop: 6, borderRadius: 999, border: `1px solid ${on ? BRASS : "rgba(201,163,90,.4)"}`, background: on ? BRASS : "transparent", color: on ? DESK : "#EADBBE", fontFamily: MONO, fontSize: fs(12), letterSpacing: ".04em", fontWeight: 500 };
  if (fixed) return <span style={{ ...style, display: "inline-flex", alignItems: "center" }}>{children}</span>;
  return <button type="button" onClick={onClick} aria-pressed={on} style={{ ...style, cursor: "pointer" }}>{children}</button>;
}

export default function TelegramCompose({ open = false, onClose = undefined, onSent = undefined, following = [], blocked = undefined, replyTo = null, toHandle = null, meName = null, meHandle = null }) {
  const sheetRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const titleId = `tg-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fixedTo = lc(toHandle);
  const key = draftKey(replyTo, toHandle);
  const [raw, setRaw] = useState(() => DRAFTS.get(key)?.raw || "");
  // Who it's for: @usernames picked from the circle or typed (a kept draft keeps them).
  const [list, setList] = useState(() => (fixedTo ? [fixedTo] : Array.isArray(DRAFTS.get(key)?.list) ? DRAFTS.get(key).list : []));
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);   // "Someone else…": the box for a typed @username
  const [mode, setMode] = useState(() => DRAFTS.get(key)?.mode || "each");   // each | group
  const [toAll, setToAll] = useState(false);     // a reply to a group telegram: everyone on it
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);       // a fourth word was refused just now
  const type = (v) => {
    const fit = telegramFit(String(v).slice(0, 200));
    setFull(fit.length < String(v).length && telegramWords(telegramText(v)) > TELEGRAM_WORDS);
    setRaw(fit);
  };
  const close = () => {
    if (busy) return;
    if (raw.trim() || (!fixedTo && list.length)) DRAFTS.set(key, { raw, list, mode }); else DRAFTS.delete(key);
    if (typeof onClose === "function") onClose();
  };
  useDismissable(open, close);
  useEffect(() => { if (fixedTo) setList([fixedTo]); }, [fixedTo]);
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    const t = setTimeout(() => sheetRef.current?.focus(), 0);
    return () => { clearTimeout(t); if (before && typeof (/** @type {any} */ (before)).focus === "function" && document.contains(before)) (/** @type {any} */ (before)).focus(); };
  }, [open]);
  if (!open) return null;

  const reply = replyTo && replyTo.reply_to ? replyTo : null;
  const blockedSet = new Set((Array.isArray(blocked) ? blocked : blocked instanceof Set ? [...blocked] : []).map((b) => lc(typeof b === "object" ? b?.handle ?? b?.user_id : b)));
  const addresses = (Array.isArray(following) ? following : [])
    .filter((f) => f && f.handle && f.status === "accepted" && !blockedSet.has(lc(f.handle)))
    .slice(0, 12);
  const wire = telegramText(raw);
  const words = telegramWords(wire);
  const over = words > TELEGRAM_WORDS;
  const typedOk = HANDLE.test(lc(typed)) && !list.includes(lc(typed));
  const recipients = reply ? [] : [...list, ...(typedOk ? [lc(typed)] : [])].slice(0, TG_MAX_TO);
  const others = reply && Array.isArray(reply.group) ? reply.group.filter(Boolean) : [];
  const addressed = !!reply || recipients.length > 0;
  const canSend = !busy && words > 0 && !over && addressed;
  const toLine = reply
    ? (toAll && others.length ? toLineOf([reply.handle, ...others].filter(Boolean)) : { name: reply.name, handle: reply.handle })
    : recipients.length ? toLineOf(recipients) : null;
  const toggle = (h) => setList((l) => (l.includes(h) ? l.filter((x) => x !== h) : l.length >= TG_MAX_TO ? l : [...l, h]));
  const addTyped = () => { if (typedOk && list.length < TG_MAX_TO) { setList((l) => [...l, lc(typed)]); setTyped(""); } };
  const typedOnly = list.filter((h) => !addresses.some((f) => lc(f.handle) === h));

  const send = async () => {
    if (!canSend) {
      if (!addressed) showToast("Who is it for? Pick a @username.", "error");
      else if (over) showToast(`${TELEGRAM_WORDS} words max. Cut ${words - TELEGRAM_WORDS}.`, "error");
      return;
    }
    setBusy(true);
    const group = !reply && recipients.length > 1 && mode === "group";
    const { data, error } = await sendTelegram({ body: raw, ...(reply ? { reply_to: reply.reply_to, ...(toAll && others.length ? { reply_all: true } : {}) } : { to_handles: recipients, mode: group ? "group" : "each" }) });
    setBusy(false);
    if (error === "age_required") { showToast("Set your birth year in Settings first (one time)", "error"); return; }
    if (error === "finish_passport") return;
    if (error) { showToast(workerMessage(error, "Couldn’t wire it. Try again."), "error"); return; }
    const many = reply ? (toAll && others.length ? others.length + 1 : 1) : recipients.length;
    const who = reply ? (many > 1 ? `everyone on it` : reply.name || "them") : many > 1 ? `${many} people` : `@${recipients[0]}`;
    const waiting = Array.isArray(data?.not_ready) && data.not_ready.length ? ` · ${data.not_ready.map((h) => `@${h}`).join(", ")} hasn’t finished their passport yet` : "";
    showToast(`${group || (reply && many > 1) ? "Group telegram" : "Telegram"} sent to ${who}${waiting}`, "success");
    setRaw("");
    DRAFTS.delete(key);
    askForAlerts();
    if (typeof onSent === "function") onSent();
    if (typeof onClose === "function") onClose();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" style={{ background: rgba(NEUTRAL.ink, 0.55) }} onClick={close}>
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", outline: "none", borderRadius: "22px 22px 0 0", background: `radial-gradient(120% 60% at 50% 0%, #3A2E22, ${DESK} 60%)`, color: "#EADBBE" }}>
        <button type="button" onClick={close} aria-label={raw.trim() ? "Close without sending. Your words wait here." : "Close without sending"}
          style={{ position: "absolute", top: 8, right: 8, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
          <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(201,163,90,.5)", color: BRASS }}>
            <ChevronDown size={20} strokeWidth={2} focusable="false" />
          </span>
        </button>
        <div style={{ padding: "18px 18px calc(24px + env(safe-area-inset-bottom))" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".24em", lineHeight: 1.3, textTransform: "uppercase", color: BRASS, paddingRight: 44 }}>GlobeSkimmers telegraph office</div>
          <h3 id={titleId} style={{ margin: "3px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.1, color: "#FBF3E2" }}>
            {reply ? <>A telegram back to <em style={{ fontStyle: "italic", color: BRASS }}>{toAll && others.length ? "everyone" : reply.name || (reply.handle ? `@${reply.handle}` : "them")}</em></> : <>Send a <em style={{ fontStyle: "italic", color: BRASS }}>telegram</em></>}
          </h3>
          <p style={{ margin: "6px 0 0", fontFamily: MONO, fontSize: fs(13), fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: BRASS }}>{TELEGRAM_WORDS} words max! Make it count.</p>

          {/* the address: a reply is fixed (to the sender, or everyone on a group telegram) */}
          {reply ? (others.length ? (
            <div role="group" aria-label="Reply to" style={{ display: "flex", flexWrap: "wrap", columnGap: 6, marginTop: 6 }}>
              <Chip on={!toAll} onClick={() => setToAll(false)}>Just {reply.name || (reply.handle ? `@${reply.handle}` : "them")}</Chip>
              <Chip on={toAll} onClick={() => setToAll(true)}>Everyone on it ({others.length + 1})</Chip>
            </div>
          ) : null) : fixedTo ? (
            <div style={{ marginTop: 8 }}><Chip on fixed>@{fixedTo}</Chip></div>
          ) : (
            <>
              <div role="group" aria-label="Who it’s for" style={{ display: "flex", flexWrap: "wrap", columnGap: 6, marginTop: 6 }}>
                {addresses.map((f) => (
                  <Chip key={lc(f.handle)} on={list.includes(lc(f.handle))} onClick={() => toggle(lc(f.handle))}>@{lc(f.handle)}</Chip>
                ))}
                {typedOnly.map((h) => (
                  <Chip key={`t-${h}`} on onClick={() => toggle(h)}>@{h} ×</Chip>
                ))}
                <Chip on={typing} onClick={() => setTyping((v) => !v)}>Someone else…</Chip>
              </div>
              {typing ? (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <label style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(201,163,90,.45)", background: "rgba(0,0,0,.18)" }}>
                    <span style={{ fontFamily: MONO, fontSize: fs(14), color: BRASS }}>@</span>
                    <input value={typed} onChange={(e) => setTyped(lc(e.target.value).replace(/[^a-z0-9._]/g, "").slice(0, 30))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }}
                      placeholder="their username" aria-label="Their @username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                      style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, outline: "none", fontFamily: MONO, fontSize: fs(14), color: "#FBF3E2" }} />
                  </label>
                  <button type="button" onClick={addTyped} disabled={!typedOk || list.length >= TG_MAX_TO}
                    style={{ flex: "none", minHeight: 44, padding: "0 14px", borderRadius: 12, border: `1px solid ${BRASS}`, background: "transparent", color: BRASS, fontFamily: MONO, fontSize: fs(12.5), letterSpacing: ".06em", opacity: typedOk ? 1 : 0.45 }}>
                    Add
                  </button>
                </div>
              ) : null}
              {recipients.length > 1 ? (
                <div style={{ marginTop: 10 }}>
                  <div role="group" aria-label="How it goes" style={{ display: "flex", flexWrap: "wrap", columnGap: 6 }}>
                    <Chip on={mode === "each"} onClick={() => setMode("each")}>Separately</Chip>
                    <Chip on={mode === "group"} onClick={() => setMode("group")}>As a group</Chip>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: fs(12), lineHeight: 1.45, color: "#CBB994" }}>
                    {mode === "group"
                      ? `One telegram to all ${recipients.length}. Everyone sees who it went to and can reply to you or to all.`
                      : `${recipients.length} private telegrams. Nobody sees who else got one, and replies come only to you.`}
                  </p>
                </div>
              ) : null}
              {list.length >= TG_MAX_TO ? <p style={{ margin: "6px 0 0", fontSize: fs(12), color: "#CBB994" }}>{TG_MAX_TO} people at most on one telegram.</p> : null}
            </>
          )}

          {/* the blank, typed on directly */}
          <TelegramPaper mode="blank" to={toLine} from={{ name: meName, handle: meHandle }} number="NEW" words={words} maxWords={TELEGRAM_WORDS} style={{ marginTop: 14 }}>
            <textarea value={raw} onChange={(e) => type(e.target.value)} rows={2} aria-label="Your telegram"
              placeholder="Type your telegram"
              autoCapitalize="sentences" spellCheck={false}
              className="resize-none placeholder:text-[color:var(--tg-ph)]"
              style={{
                display: "block", width: "100%", minHeight: 56, padding: "2px 2px 0", border: 0, outline: "none",
                background: `repeating-linear-gradient(transparent 0 25px, rgba(42,34,25,.28) 25px 26px)`,
                fontFamily: TYPE, fontSize: fs(16), lineHeight: "26px", letterSpacing: ".04em", color: TINK,
                "--tg-ph": TINK3,
              }} />
          </TelegramPaper>

          {/* the meter: one box per word */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <div aria-hidden="true" style={{ display: "flex", gap: 3 }}>
              {Array.from({ length: TELEGRAM_WORDS }).map((_, i) => (
                <span key={i} style={{ width: 22, height: 18, borderRadius: 2, border: `1px solid ${over ? TRED : "rgba(201,163,90,.6)"}`, background: i < Math.min(words, TELEGRAM_WORDS) ? (over ? TRED : BRASS) : "transparent" }} />
              ))}
            </div>
            <span role="status" style={{ fontFamily: MONO, fontSize: fs(11.5), letterSpacing: ".06em", color: over || full ? "#F0907C" : "#CBB994" }}>
              {over ? `${words} words · ${TELEGRAM_WORDS} max! Cut ${words - TELEGRAM_WORDS} to wire it`
                : full ? `${TELEGRAM_WORDS} words max!`
                : `${words} of ${TELEGRAM_WORDS} words · ${/[\p{L}\p{N}]{16,}/u.test(wire) ? "a word past 15 letters counts as two" : "punctuation is okay · an emoji is a word"}`}
            </span>
          </div>
          {wire ? (
            <p style={{ margin: "8px 0 0", fontSize: fs(11.5), lineHeight: 1.45, color: "#A8977A" }}>
              On the wire: <span style={{ fontFamily: TYPE, letterSpacing: ".05em", color: "#EADBBE" }}>{wire}</span>
            </p>
          ) : null}

          <button type="button" onClick={send} aria-disabled={!canSend || undefined} aria-busy={busy || undefined}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 50, marginTop: 16, borderRadius: 14, border: 0, background: canSend || busy ? TRED : "rgba(201,163,90,.18)", color: canSend || busy ? "#FFF7EC" : "#A8977A", fontFamily: MONO, fontSize: fs(14), fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", cursor: canSend ? "pointer" : "default" }}>
            {busy ? <Loader2 size={17} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : <Zap size={17} strokeWidth={2} aria-hidden="true" focusable="false" />}
            {busy ? "Wiring…" : "Wire it"}
          </button>
          <p style={{ margin: "8px 0 0", fontFamily: MONO, fontSize: fs(9), letterSpacing: ".08em", lineHeight: 1.45, textAlign: "center", color: "#8E7E62", textTransform: "uppercase" }}>
            Send as many as you like · words are checked before they travel · links don’t go by wire
          </p>
        </div>
      </div>
    </div>
  );
}
