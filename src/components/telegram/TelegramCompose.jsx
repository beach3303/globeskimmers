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
// Who it's for is one blank "Send to" bar with @username suggestions (SendToField; founder,
// 2026-10-24: "remove pre placed names at send to: … i love @handle suggestions").
//
//   <TelegramCompose open onClose onSent blocked replyTo toHandle meName meHandle />
//   blocked    op:list `blocked` rows / ids / handles: never suggested
//   replyTo    { reply_to, name, handle, group? } — a reply; group = the other @usernames on it
//   toHandle   a fixed @username
import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, MessageCircle, Zap } from "lucide-react";
import { showToast } from "@/components/Toast";
import { useDismissable } from "@/lib/dismissStack";
import { askForAlerts } from "@/lib/pushAlerts";
import { workerMessage } from "@/components/social/FollowByHandle";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { TELEGRAM_INKS, TELEGRAM_WORDS, inkColor, sendTelegram, telegramFit, telegramText, telegramWords } from "@/lib/telegram";
import TelegramPaper, { TINK3, TRED, TYPE } from "@/components/telegram/TelegramPaper";
import SendToField from "@/components/social/SendToField";
import { createLink, shareText } from "@/lib/messageLinks";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const DESK = "#231C15";
const BRASS = "#C9A35A";
const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const TG_MAX_TO = 10;
// "@a, @b, @c" or "@a, @b +3" for the blank's TO line.
const toLineOf = (handles, emails = []) => {
  const all = [...handles.map((h) => `@${h}`), ...emails];
  return all.length <= 3 ? all.join(", ") : `${all.slice(0, 2).join(", ")} +${all.length - 2}`;
};
// Drafts kept while the app is open, one per reply (or one for a new telegram).
const DRAFTS = new Map();
const draftKey = (replyTo, toHandle) => (replyTo && replyTo.reply_to ? `re:${replyTo.reply_to}` : toHandle ? `to:${lc(toHandle)}` : "new");

function Chip({ on = false, fixed = false, onClick = undefined, children }) {
  const style = { minHeight: 36, padding: "0 12px", marginTop: 6, borderRadius: 999, border: `1px solid ${on ? BRASS : "rgba(201,163,90,.4)"}`, background: on ? BRASS : "transparent", color: on ? DESK : "#EADBBE", fontFamily: MONO, fontSize: fs(12), letterSpacing: ".04em", fontWeight: 500 };
  if (fixed) return <span style={{ ...style, display: "inline-flex", alignItems: "center" }}>{children}</span>;
  return <button type="button" onClick={onClick} aria-pressed={on} style={{ ...style, cursor: "pointer" }}>{children}</button>;
}

export default function TelegramCompose({ open = false, onClose = undefined, onSent = undefined, blocked = undefined, replyTo = null, toHandle = null, meName = null, meHandle = null }) {
  const sheetRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const titleId = `tg-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fixedTo = lc(toHandle);
  const key = draftKey(replyTo, toHandle);
  const [raw, setRaw] = useState(() => DRAFTS.get(key)?.raw || "");
  // Who it's for: the people added in the Send to bar (a kept draft keeps them).
  const [list, setList] = useState(() => (Array.isArray(DRAFTS.get(key)?.list) ? DRAFTS.get(key).list : []));
  const [mode, setMode] = useState(() => DRAFTS.get(key)?.mode || "each");   // each | group
  const [toAll, setToAll] = useState(false);     // a reply to a group telegram: everyone on it
  const [ink, setInk] = useState(() => DRAFTS.get(key)?.ink || "black");   // black | red | green
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);       // a fourth word was refused just now
  const type = (v) => {
    const fit = telegramFit(String(v).slice(0, 200));
    setFull(fit.length < String(v).length && telegramWords(telegramText(v)) > TELEGRAM_WORDS);
    setRaw(fit);
  };
  const close = () => {
    if (busy) return;
    if (raw.trim() || (!fixedTo && list.length)) DRAFTS.set(key, { raw, list, mode, ink }); else DRAFTS.delete(key);
    if (typeof onClose === "function") onClose();
  };
  useDismissable(open, close);
  // Text or share it (founder, 2026-10-24): the telegram as a link the sender's own phone texts or
  // shares; kept while the words and ink are unchanged, so a second tap shares the same link.
  const [linking, setLinking] = useState(false);
  const [made, setMade] = useState(/** @type {any} */ (null));
  useEffect(() => { setMade(null); }, [raw, ink]);
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    const t = setTimeout(() => sheetRef.current?.focus(), 0);
    return () => { clearTimeout(t); if (before && typeof (/** @type {any} */ (before)).focus === "function" && document.contains(before)) (/** @type {any} */ (before)).focus(); };
  }, [open]);
  if (!open) return null;

  const reply = replyTo && replyTo.reply_to ? replyTo : null;
  const wire = telegramText(raw);
  const words = telegramWords(wire);
  const over = words > TELEGRAM_WORDS;
  const recipients = reply ? [] : fixedTo ? [fixedTo] : list.map((p) => lc(p.handle)).filter(Boolean).slice(0, TG_MAX_TO);
  // A login email (2026-10-24): a member's reaches them; anyone else's waits, with one invitation email.
  const emailsTo = reply || fixedTo ? [] : list.filter((p) => !p.handle && p.email).map((p) => p.email);
  const total = recipients.length + emailsTo.length;
  const others = reply && Array.isArray(reply.group) ? reply.group.filter(Boolean) : [];
  const addressed = !!reply || total > 0;
  const canSend = !busy && words > 0 && !over && addressed;
  const toLine = reply
    ? (toAll && others.length ? toLineOf([reply.handle, ...others].filter(Boolean)) : { name: reply.name, handle: reply.handle })
    : total ? toLineOf(recipients, emailsTo) : null;

  const send = async () => {
    if (!canSend) {
      if (!addressed) showToast("Who is it for? Add a @username or email in Send to.", "error");
      else if (over) showToast(`${TELEGRAM_WORDS} words max. Cut ${words - TELEGRAM_WORDS}.`, "error");
      return;
    }
    setBusy(true);
    const group = !reply && total > 1 && mode === "group";
    const { data, error } = await sendTelegram({ body: raw, ink, ...(reply ? { reply_to: reply.reply_to, ...(toAll && others.length ? { reply_all: true } : {}) } : { to_handles: recipients, to_emails: emailsTo, mode: group ? "group" : "each" }) });
    setBusy(false);
    if (error === "age_required") { showToast("Set your birth year in Settings first (one time)", "error"); return; }
    if (error === "finish_passport") return;
    if (error) { showToast(workerMessage(error, "Couldn’t wire it. Try again."), "error"); return; }
    const many = reply ? (toAll && others.length ? others.length + 1 : 1) : total;
    // An email address reads the same whether or not a member logs in with it.
    const who = reply ? (many > 1 ? `everyone on it` : reply.name || "them") : many > 1 ? `${many} people` : recipients[0] ? `@${recipients[0]}` : emailsTo[0];
    const waiting = Array.isArray(data?.not_ready) && data.not_ready.length ? ` · ${data.not_ready.map((h) => `@${h}`).join(", ")} hasn’t finished their passport yet` : "";
    showToast(`${group || (reply && many > 1) ? "Group telegram" : "Telegram"} sent to ${who}${waiting}`, "success");
    setRaw("");
    DRAFTS.delete(key);
    askForAlerts();
    if (typeof onSent === "function") onSent();
    if (typeof onClose === "function") onClose();
  };

  const textIt = async () => {
    if (linking || busy) return;
    if (!words) { showToast("Write your telegram first", "error"); return; }
    if (over) { showToast(`${TELEGRAM_WORDS} words max. Cut ${words - TELEGRAM_WORDS}.`, "error"); return; }
    setLinking(true);
    let link = made;
    if (!link) {
      const { data, error } = await createLink({ kind: "telegram", body: raw, ink });
      if (error || !data?.text) {
        setLinking(false);
        if (error === "age_required") showToast("Set your birth year in Settings first (one time)", "error");
        else if (error !== "finish_passport") showToast(workerMessage(error, "Couldn’t make the link. Try again."), "error");
        return;
      }
      link = data;
      setMade(data);
    }
    let how = "cancelled";
    try { how = await shareText(link.text); } catch { showToast("Couldn’t open sharing. Try again.", "error"); }
    setLinking(false);
    if (how === "cancelled") return;
    showToast(how === "copied" ? "Link copied — paste it in a text" : "Sent. Whoever you sent it to opens it in GlobeSkimmers.", "success");
    setRaw("");
    DRAFTS.delete(key);
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
              <SendToField value={list} onChange={setList} max={TG_MAX_TO} dark needHandle allowEmail blocked={blocked} />
              {total > 1 ? (
                <div style={{ marginTop: 10 }}>
                  <div role="group" aria-label="How it goes" style={{ display: "flex", flexWrap: "wrap", columnGap: 6 }}>
                    <Chip on={mode === "each"} onClick={() => setMode("each")}>Separately</Chip>
                    <Chip on={mode === "group"} onClick={() => setMode("group")}>As a group</Chip>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: fs(12), lineHeight: 1.45, color: "#CBB994" }}>
                    {mode === "group"
                      ? `One telegram to all ${total}. Everyone sees who it went to and can reply to you or to all.${emailsTo.length ? " Anyone added by email gets their own." : ""}`
                      : `${total} private telegrams. Nobody sees who else got one, and replies come only to you.`}
                  </p>
                </div>
              ) : null}
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
                fontFamily: TYPE, fontSize: fs(16), lineHeight: "26px", letterSpacing: ".04em", color: inkColor(ink),
                "--tg-ph": TINK3,
              }} />
          </TelegramPaper>

          {/* the ink (2026-10-19): black, red or green — all dark enough to read */}
          <div role="radiogroup" aria-label="Ink" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".18em", textTransform: "uppercase", color: "#CBB994" }}>Ink</span>
            {TELEGRAM_INKS.map((i) => (
              <button key={i.key} type="button" role="radio" aria-checked={ink === i.key} aria-label={`${i.name} ink`} onClick={() => setInk(i.key)}
                style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 10px 0 6px", borderRadius: 999, border: `1px solid ${ink === i.key ? BRASS : "rgba(201,163,90,.35)"}`, background: ink === i.key ? "rgba(201,163,90,.16)" : "transparent", cursor: "pointer" }}>
                <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 999, background: i.color, boxShadow: `0 0 0 2px #F2E4BC${ink === i.key ? `, 0 0 0 3.5px ${BRASS}` : ""}` }} />
                <span style={{ fontFamily: MONO, fontSize: fs(11.5), color: ink === i.key ? "#FBF3E2" : "#CBB994" }}>{i.name}</span>
              </button>
            ))}
          </div>

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
          {!reply && !fixedTo ? (
            <>
              <button type="button" onClick={textIt} aria-busy={linking || undefined}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 46, marginTop: 8, borderRadius: 14, border: `1px solid ${BRASS}`, background: "transparent", color: BRASS, fontFamily: MONO, fontSize: fs(12.5), fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>
                {linking ? <Loader2 size={16} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : <MessageCircle size={16} strokeWidth={2} aria-hidden="true" focusable="false" />}
                Or text or share it
              </button>
              <p style={{ margin: "6px 2px 0", fontSize: fs(12), lineHeight: 1.45, color: "#A8977A", textAlign: "center" }}>
                Friends not on GlobeSkimmers yet? Send a link from your phone — Messages, Messenger, WhatsApp. It opens in the app.
              </p>
            </>
          ) : null}
          <p style={{ margin: "8px 0 0", fontFamily: MONO, fontSize: fs(9), letterSpacing: ".08em", lineHeight: 1.45, textAlign: "center", color: "#8E7E62", textTransform: "uppercase" }}>
            Send as many as you like · words are checked before they travel · links don’t go by wire
          </p>
        </div>
      </div>
    </div>
  );
}
