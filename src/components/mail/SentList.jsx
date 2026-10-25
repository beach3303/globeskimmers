// SentList — the Sent folder's list (founder, 2026-10-25: "users ask me where their sent messages
// went … sent messages"). Everything you sent, newest first, one entry per send: a group card or
// telegram, or private copies, names everyone it went to. Each entry: a small front (the card's
// photo, or a telegram slip with its words), what kind and how it went, the words, who it went to,
// when, and where it stands — a telegram says who opened it (founder's decision: "Opened" on
// telegrams only), a postcard only that it was delivered; mail to an email address waits for them
// to join; a text link says so. A tap opens the entry: the photo or the words in full and everyone
// it went to (with Opened per person on a telegram). The ••• deletes it from your Sent only, after one
// confirm, and "Delete all" clears the whole list at once (founder, 2026-10-25); recipients keep theirs.
//
//   <SentList style />
import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock, Link2, Loader2, Mail, MoreHorizontal, Zap } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { whenLabel } from "@/components/social/Envelope";
import { showToast } from "@/components/Toast";
import { workerMessage } from "@/components/social/FollowByHandle";
import { TINK, TINK3, TYPE } from "@/components/telegram/TelegramPaper";
import { inkColor } from "@/lib/telegram";
import { hideAllSent, hideSent, sentMail } from "@/lib/sentMail";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BLUE = NEUTRAL.airmailBlue;
const SLIP = "linear-gradient(180deg, #F6ECCF, #EFE1BC)";

const personOf = (p) => (p?.handle ? `@${p.handle}` : p?.name || "someone");
const toLine = (to) => {
  const all = (to || []).map(personOf);
  return all.length <= 3 ? all.join(", ") : `${all.slice(0, 2).join(", ")} +${all.length - 2}`;
};
const timeOf = (iso) => {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return "";
  const day = whenLabel(iso);
  const clock = new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${clock}`;
};
// How it went, in a few words, for the kicker.
const MODE = { one: "", each: "Private copies", group: "Group", board: "City Board", followers: "Everyone who followed you", email: "By email", link: "Text link" };

// Where it stands: one short line and its tone.
function statusOf(it) {
  const tg = it.kind === "telegram";
  if (it.status === "waiting") return { tone: "wait", icon: Clock, text: "Waiting for them to join · invite emailed" };
  if (it.status === "expired") return { tone: "plain", icon: Link2, text: "Link expired" };
  if (it.mode === "link") {
    if (tg && it.opened > 0) return { tone: "ok", icon: Check, text: `Opened in the app by ${it.opened}` };
    return { tone: "plain", icon: Link2, text: tg ? "Shared as a link · not opened yet" : "Shared as a link" };
  }
  if (it.mode === "board") return { tone: "plain", icon: Mail, text: it.board?.city ? `On ${it.board.city}’s City Board` : "On a City Board" };
  if (tg) {
    const n = (it.to || []).length;
    if (n <= 1) return it.opened ? { tone: "ok", icon: Check, text: "Opened" } : { tone: "plain", icon: Check, text: "Delivered" };
    return it.opened ? { tone: "ok", icon: Check, text: `Opened by ${it.opened} of ${n}` } : { tone: "plain", icon: Check, text: `Delivered to all ${n}` };
  }
  return { tone: "plain", icon: Check, text: (it.to || []).length > 1 ? `Delivered to all ${it.to.length}` : "Delivered" };
}
const TONE = {
  ok: { bg: "#DDEDE3", ink: NEUTRAL.open },
  wait: { bg: "#F6EBCF", ink: "#7A5A12" },
  plain: { bg: NEUTRAL.airmailHair, ink: BLUE },
};

// The small front: the card's photo, or a telegram slip with its first words.
function Front({ it, big = false }) {
  if (it.kind === "telegram") {
    return (
      <div aria-hidden="true" style={{ flex: "none", width: big ? "100%" : 64, minHeight: big ? 0 : 46, padding: big ? "14px 16px" : "5px 6px", boxSizing: "border-box", background: SLIP, boxShadow: "inset 0 0 0 1px rgba(120,85,25,.18), 0 3px 6px -4px rgba(70,45,10,.4)", color: TINK }}>
        <div style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontWeight: 800, fontSize: big ? fs(13) : 7, letterSpacing: ".14em" }}>TELEGRAM</div>
        <div style={{ marginTop: big ? 8 : 3, fontFamily: TYPE, fontSize: big ? fs(18) : 8.5, lineHeight: 1.25, letterSpacing: ".03em", color: inkColor(it.ink) || TINK, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: big ? 6 : 2, WebkitBoxOrient: "vertical", textTransform: "uppercase", overflowWrap: "anywhere" }}>{it.body || ""}</div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={{ flex: "none", width: big ? "100%" : 64, aspectRatio: "3 / 2", borderRadius: big ? 10 : 3, overflow: "hidden", background: NEUTRAL.airmailHair, border: big ? 0 : `2px solid ${NEUTRAL.white}`, boxShadow: big ? "none" : "0 3px 6px -3px rgba(22,17,13,.45)" }}>
      {it.photo ? <img src={it.photo} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} /> : null}
    </div>
  );
}

function SentItem({ it, onRemoved }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = statusOf(it);
  const tone = TONE[st.tone];
  const tg = it.kind === "telegram";
  const mode = MODE[it.mode] || "";
  const words = tg ? it.body : it.message;
  const to = it.mode === "email" ? "an email address" : it.mode === "link" ? "whoever you sent the link to" : it.mode === "board" ? null : it.mode === "followers" ? "everyone who followed you" : toLine(it.to);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const r = await hideSent(it);
    setBusy(false);
    if (!r.ok) { showToast(workerMessage(r.error, "Couldn’t delete it. Try again."), "error"); return; }
    showToast("Deleted from your Sent", "success");
    onRemoved(it);
  };
  const Icon = st.icon;
  return (
    <article aria-label={`${tg ? "Telegram" : "Postcard"}${to ? ` to ${to}` : ""}, ${timeOf(it.at)}`}
      style={{ background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, padding: 10, boxShadow: "0 8px 18px -16px rgba(22,17,13,.4)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 12, padding: 0, margin: 0, border: 0, background: "transparent", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}>
          <Front it={it} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", textTransform: "uppercase", color: tg ? TINK3 : NEUTRAL.stamp }}>
              {tg ? <Zap size={11} strokeWidth={2.2} aria-hidden="true" focusable="false" /> : <Mail size={11} strokeWidth={2.2} aria-hidden="true" focusable="false" />}
              {tg ? "Telegram" : "Postcard"}{mode ? ` · ${mode}` : ""}{it.reply ? " · a reply" : ""}
            </span>
            {words ? (
              <span style={{ marginTop: 3, fontFamily: tg ? TYPE : SERIF, fontStyle: tg ? "normal" : "italic", fontSize: tg ? fs(14) : fs(16), lineHeight: 1.25, letterSpacing: tg ? ".03em" : 0, textTransform: tg ? "uppercase" : "none", color: NEUTRAL.ink, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }}>{tg ? words : `“${words}”`}</span>
            ) : it.place ? <span style={{ display: "block", marginTop: 3, fontFamily: SERIF, fontSize: fs(16), color: NEUTRAL.ink }}>{it.place}</span> : null}
            {to ? <span style={{ display: "block", marginTop: 3, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink2, overflowWrap: "anywhere" }}>To {to}</span> : null}
            <span style={{ display: "block", marginTop: 2, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".04em", color: NEUTRAL.ink3 }}>{timeOf(it.at)}</span>
          </span>
        </button>
        <button type="button" onClick={() => setAsking((v) => !v)} aria-label="More" aria-expanded={asking}
          style={{ flex: "none", width: 44, height: 44, margin: "-6px -6px 0 0", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, border: 0, background: "transparent", color: NEUTRAL.ink3, cursor: "pointer" }}>
          <MoreHorizontal size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 26, padding: "0 10px", borderRadius: 999, background: tone.bg, color: tone.ink, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".04em" }}>
          <Icon size={12} strokeWidth={2.4} aria-hidden="true" focusable="false" /> {st.text}
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-hidden="true" tabIndex={-1}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: 0, border: 0, background: "transparent", color: BLUE, cursor: "pointer" }}>
          <ChevronDown size={18} strokeWidth={2} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} focusable="false" />
        </button>
      </div>

      {asking ? (
        <div role="group" aria-label="Delete from Sent" style={{ marginTop: 10, padding: 10, borderRadius: 12, background: NEUTRAL.airmail, border: `1px solid ${NEUTRAL.airmailLine}` }}>
          <p style={{ margin: 0, fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}><b style={{ color: NEUTRAL.ink }}>Delete it from your Sent?</b> {it.mode === "board" ? "It stays on the City Board." : it.mode === "link" ? "The link still works." : "They keep theirs."}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={remove} aria-busy={busy || undefined}
              style={{ minHeight: 40, padding: "0 16px", borderRadius: 12, border: 0, background: NEUTRAL.stamp, color: NEUTRAL.white, font: "inherit", fontSize: fs(13.5), fontWeight: 600, cursor: "pointer" }}>{busy ? "Deleting…" : "Delete"}</button>
            <button type="button" onClick={() => setAsking(false)}
              style={{ minHeight: 40, padding: "0 16px", borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, font: "inherit", fontSize: fs(13.5), fontWeight: 600, cursor: "pointer" }}>Keep it</button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${NEUTRAL.airmailHair}` }}>
          <Front it={it} big />
          {!tg && (it.message || it.place || it.dish) ? (
            <div style={{ marginTop: 8 }}>
              {it.message ? <p style={{ margin: 0, fontFamily: SERIF, fontStyle: "italic", fontSize: fs(17), lineHeight: 1.3, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>“{it.message}”</p> : null}
              {it.dish || it.place ? <p style={{ margin: "4px 0 0", fontSize: fs(12.5), color: NEUTRAL.ink2 }}>{it.dish ? <b style={{ fontWeight: 600 }}>{it.dish}</b> : null}{it.dish && it.place ? " · " : ""}{it.place}</p> : null}
            </div>
          ) : null}
          {(it.to || []).length ? (
            <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
              {it.to.map((p, i) => (
                <li key={`${personOf(p)}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34, borderBottom: i < it.to.length - 1 ? `1px solid ${NEUTRAL.airmailHair}` : 0 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: fs(13.5), color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{personOf(p)}{p.handle && p.name ? <span style={{ color: NEUTRAL.ink3 }}> · {p.name}</span> : null}</span>
                  {tg ? (
                    <span style={{ fontFamily: MONO, fontSize: fs(10.5), color: p.opened ? NEUTRAL.open : NEUTRAL.ink3 }}>{p.opened ? "✓ Opened" : "Not opened yet"}</span>
                  ) : <span style={{ fontFamily: MONO, fontSize: fs(10.5), color: NEUTRAL.ink3 }}>Delivered</span>}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function SentList({ style = undefined }) {
  const [state, setState] = useState(null);      // { items, next, error } once read
  const [older, setOlder] = useState("idle");    // 'idle' | 'busy' | 'failed'
  const live = useRef(0);
  const load = async () => {
    const n = ++live.current;
    const r = await sentMail();
    if (n !== live.current) return;
    setState(r);
    setOlder("idle");
  };
  useEffect(() => { load(); }, []);

  const readOlder = async () => {
    if (older === "busy" || !state?.next) return;
    const n = live.current;
    setOlder("busy");
    const r = await sentMail(state.next);
    if (n !== live.current) return;
    if (r.error) { setOlder("failed"); return; }
    setOlder("idle");
    setState((s) => {
      const seen = new Set((s.items || []).map((x) => `${x.from}:${x.ids[0]}`));
      return { ...s, items: [...(s.items || []), ...r.items.filter((x) => !seen.has(`${x.from}:${x.ids[0]}`))], next: r.next };
    });
  };
  const removed = (it) => setState((s) => ({ ...s, items: (s.items || []).filter((x) => x !== it) }));
  const [clearing, setClearing] = useState(null);   // null | 'ask' | 'busy'
  const deleteAll = async () => {
    if (clearing === "busy") return;
    setClearing("busy");
    const r = await hideAllSent();
    if (!r.ok) { setClearing("ask"); showToast(workerMessage(r.error, "Couldn’t delete them. Try again."), "error"); return; }
    setClearing(null);
    setState({ items: [], next: null, error: null });
    showToast("Your Sent is empty", "success");
  };

  if (!state) {
    return (
      <div style={style}>
        <span className="sr-only" role="status">Loading what you sent</span>
        {[0, 1, 2].map((i) => (
          <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none"
            style={{ height: 96, marginTop: i ? 10 : 0, borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }} />
        ))}
      </div>
    );
  }
  if (state.error && !state.items.length) {
    return (
      <div style={{ padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, ...style }}>
        <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Couldn’t load what you sent.</p>
        <button type="button" onClick={() => { setState(null); load(); }}
          style={{ marginTop: 10, minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, font: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" }}>Try again</button>
      </div>
    );
  }
  if (!state.items.length) {
    return (
      <div style={{ padding: "24px 20px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 18, textAlign: "center", ...style }}>
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>Nothing sent <em style={{ fontStyle: "italic", color: BLUE }}>yet</em></p>
        <p style={{ margin: "6px auto 0", maxWidth: "34ch", fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>Postcards and telegrams you send show up here, with who they went to.</p>
      </div>
    );
  }
  return (
    <div style={style}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button type="button" onClick={() => setClearing((c) => (c ? null : "ask"))} aria-expanded={!!clearing}
          style={{ minHeight: 36, padding: "0 4px", border: 0, background: "transparent", font: "inherit", fontSize: fs(13), fontWeight: 650, color: NEUTRAL.stamp, cursor: "pointer" }}>Delete all</button>
      </div>
      {clearing ? (
        <div role="group" aria-label="Delete all sent" style={{ marginBottom: 10, padding: 12, borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }}>
          <p style={{ margin: 0, fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}><b style={{ color: NEUTRAL.ink }}>Delete everything in your Sent?</b> This only clears your list. Everyone you wrote to keeps what you sent, and links you shared still work.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={deleteAll} aria-busy={clearing === "busy" || undefined}
              style={{ minHeight: 40, padding: "0 16px", borderRadius: 12, border: 0, background: NEUTRAL.stamp, color: NEUTRAL.white, font: "inherit", fontSize: fs(13.5), fontWeight: 600, cursor: "pointer" }}>{clearing === "busy" ? "Deleting…" : "Delete all"}</button>
            <button type="button" onClick={() => setClearing(null)}
              style={{ minHeight: 40, padding: "0 16px", borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, font: "inherit", fontSize: fs(13.5), fontWeight: 600, cursor: "pointer" }}>Keep them</button>
          </div>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {state.items.map((it) => <SentItem key={`${it.from}:${it.ids[0]}`} it={it} onRemoved={removed} />)}
      </div>
      {state.next ? (
        <button type="button" onClick={readOlder} aria-busy={older === "busy" || undefined}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 44, marginTop: 12, borderRadius: 14, border: `1px solid ${BLUE}`, background: "transparent", color: BLUE, font: "inherit", fontSize: fs(14), fontWeight: 600, cursor: "pointer" }}>
          {older === "busy" ? <Loader2 size={16} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : null}
          {older === "failed" ? "Couldn’t load older ones. Try again" : "Show older"}
        </button>
      ) : null}
    </div>
  );
}
