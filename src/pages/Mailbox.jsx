// Mailbox: your mail in folder tabs (founder, 2026-10-25, decision sheet: "Tabs: Postcards ·
// Telegrams · Sent · News"; it replaced one long page and the separate postcard box). The masthead
// (Postcard, Telegram, + Add friends), then four tabs in the Home tabs' airmail blue:
//   Postcards  new cards to me first (the feed), then every one I've read (the box), as compact
//              rows that open into the full card;
//   Telegrams  the same, sealed ones first — each still waits to be tapped open;
//   Sent       everything I sent (SentList);
//   News       follow requests, what happened on my passport, and my circle's new stamps.
// The tab comes from ?tab=, else the one used last; a tapped notification (?tg= / ?pc=) opens its
// tab and brings that message into view, opened. /Postcards and /Sent now land here.
//
// It shows nothing untrue: nothing social until the age tier is known; the hold note for a
// 13-17 account; a skeleton while mail loads, 'Try again' when it fails (never an empty tab);
// rows from people you blocked never show. Every person here (a sender, a stamp, an activity
// line, a request) has a door to TravelerSheet: Report, Unfollow, Block. A 'confirm' account
// (a birthday still to complete) gets the note that lets it finish.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Globe, Lock, Mail, Mailbox as MailboxIcon, UserPlus, X, Zap } from "lucide-react";
import { createPageUrl } from "@/utils";
import { cityBoardsUrl } from "@/lib/boardLinks";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { socialFeed, getHandle, getSocialProfile, setHandle, setAgeGate, splitDob, socialUnread, keepPostcard, deletePostcard, postcardBox } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { HOME_TAB } from "@/components/redesign/Zone";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import Envelope, { whenLabel } from "@/components/social/Envelope";
import TravelerSheet from "@/components/social/TravelerSheet";
import ConfirmBirthdayNote from "@/components/social/ConfirmBirthdayNote";
import { Face } from "@/components/social/SocialMarks";
import { workerMessage } from "@/components/social/FollowByHandle";
import { claimLink, linkCodeOf } from "@/lib/messageLinks";
import FindPeople from "@/components/social/FindPeople";
import Requests from "@/components/social/Requests";
import ActivityList from "@/components/social/ActivityList";
import { useDismissable } from "@/lib/dismissStack";
import PostcardCard from "@/components/social/PostcardCard";
import InviteButton from "@/components/passport/InviteButton";
import PostcardCompose from "@/components/passport/PostcardCompose";
import TelegramCard from "@/components/telegram/TelegramCard";
import TelegramCompose from "@/components/telegram/TelegramCompose";
import ReplyWays from "@/components/telegram/ReplyWays";
import { deleteTelegram } from "@/lib/telegram";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import SentList from "@/components/mail/SentList";
import { TINK, TYPE } from "@/components/telegram/TelegramPaper";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const BLUE = NEUTRAL.airmailBlue;
const GAP = 20;

const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
// What a report from an activity line is about (the report queue's kinds), and a short note.
const ACTIVITY_KIND = { follow_request: "profile", follow: "profile", postcard: "postcard", telegram: "telegram", reaction: "profile", signature: "signature", tag: "tag" };
const clip = (t, n) => { const v = String(t || "").replace(/\s+/g, " ").trim(); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };
const whoOf = (by) => String(by?.name ?? "").trim() || (by?.handle ? `@${lc(by.handle)}` : "A traveler");

/** @type {import('react').CSSProperties} */
const KICKER = { margin: 0, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.2, textTransform: "uppercase", color: BLUE };

// The masthead on the page, then the full-bleed chevron (Mailbox L28-41): the seal, then the ways
// to write and "+ Add friends", which wraps under them at large text sizes.
function Masthead({ onPostcard = undefined, onTelegram = undefined, onFind = undefined, addressable = false }) {
  const write = { flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, padding: "0 14px", borderRadius: 999, font: "inherit", fontSize: fs(13.5), fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
  return (
    <>
      <div aria-hidden="true" style={{ height: 8 }} />
      <header className={COLUMN} style={{ paddingTop: 10, paddingBottom: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".2em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.stamp }}>Globeskimmers · Mailbox</div>
        <h1 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 1.04, color: NEUTRAL.ink }}>
          Mail from your <em style={{ fontStyle: "italic", color: BLUE }}>circle</em>
        </h1>
        {/* The seal (founder, 2026-10-15): a mailbox is private — one line says so. */}
        <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0 0", fontSize: fs(12.5), fontWeight: 500, lineHeight: 1.4, color: BLUE }}>
          <Lock size={13} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flex: "none" }} />
          <span>Sealed — <b style={{ fontWeight: 750 }}>only you</b> can see your mailbox.</span>
        </p>
        {onPostcard ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onPostcard}
              style={{ ...write, border: addressable ? 0 : `1px solid ${BLUE}`, background: addressable ? NEUTRAL.stamp : "transparent", color: addressable ? NEUTRAL.white : BLUE }}>
              <Mail size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> Postcard
            </button>
            {/* Telegrams (2026-10-19): four words by wire, no photo. */}
            {onTelegram ? (
              <button type="button" onClick={onTelegram} style={{ ...write, border: "1px solid #2A2219", background: "#F2E4BC", color: "#2A2219" }}>
                <Zap size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> Telegram
              </button>
            ) : null}
            {/* A labeled door to Find people (founder, 2026-10-25: it hid behind a bare magnifier). */}
            {onFind ? (
              <button type="button" onClick={onFind} style={{ ...write, flex: "0 1 auto", border: 0, background: BLUE, color: NEUTRAL.white }}>
                <UserPlus size={16} strokeWidth={2} aria-hidden="true" focusable="false" /> Add friends
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      <AirmailChevron height={5} />
    </>
  );
}

// The four folder tabs, in the Home tabs' airmail blue on one baseline. Postcards and Telegrams
// carry how many are new; News a dot when something waits.
const MAIL_TABS = ["postcards", "telegrams", "sent", "news"];
const TAB_KEY = "gs_mailbox_tab_v1";
function MailTabs({ tab, onTab, counts }) {
  const tabs = [
    { id: "postcards", label: "Postcards", n: counts.postcards },
    { id: "telegrams", label: "Telegrams", n: counts.telegrams },
    { id: "sent", label: "Sent" },
    { id: "news", label: "News", dot: counts.news },
  ];
  return (
    <div role="tablist" aria-label="Your mail" style={{ display: "flex", gap: 4, marginTop: 16, borderBottom: `2px solid ${BLUE}` }}>
      {tabs.map((t) => {
        const on = tab === t.id;
        return (
          <button key={t.id} type="button" role="tab" id={`mail-tab-${t.id}`} aria-selected={on} aria-controls={`mail-panel-${t.id}`} onClick={() => onTab(t.id)}
            style={{
              flex: "1 1 auto", minWidth: 0, minHeight: 42, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "0 8px",
              borderRadius: "11px 11px 0 0", font: "inherit", fontSize: fs(13), fontWeight: on ? 700 : 600, cursor: "pointer", whiteSpace: "nowrap",
              ...(on ? HOME_TAB : { background: NEUTRAL.airmailHair, color: BLUE, border: "1px solid transparent", borderBottom: 0 }),
            }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
            {t.n ? <span aria-label={`${t.n} new`} style={{ flex: "none", minWidth: 18, height: 18, padding: "0 5px", boxSizing: "border-box", borderRadius: 999, background: NEUTRAL.stamp, color: NEUTRAL.white, fontSize: fs(10.5), fontWeight: 700, lineHeight: "18px", textAlign: "center" }}>{t.n}</span> : null}
            {t.dot ? <span aria-label="something new" style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: NEUTRAL.stamp }} /> : null}
          </button>
        );
      })}
    </div>
  );
}

// A message I've read, folded to one line (its front, who sent it, the start of it, when); a tap
// opens the full card, and "Fold it away" closes it again.
function ReadRow({ r, open, onToggle, children }) {
  const tg = r.type === "telegram";
  const from = r.by?.name || (r.by?.handle ? `@${r.by.handle}` : "Someone");
  const others = (tg ? r.group : r.also_to) || [];
  const when = whenLabel(r.created_at);
  const what = tg ? r.body : r.message || r.place;
  return (
    <div data-tg={tg ? r.id : undefined} data-pc={!tg ? r.id : undefined} style={{ borderRadius: 14 }}>
      {open ? (
        <div>
          <button type="button" onClick={onToggle} aria-expanded="true"
            style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 36, margin: "0 0 4px", padding: "0 4px", border: 0, background: "transparent", font: "inherit", fontSize: fs(12.5), fontWeight: 600, color: BLUE, cursor: "pointer" }}>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" focusable="false" style={{ transform: "rotate(180deg)" }} /> Fold it away
          </button>
          {children}
        </div>
      ) : (
        <button type="button" onClick={onToggle} aria-expanded="false" aria-label={`${tg ? "Telegram" : "Postcard"} from ${from}${what ? `: ${what}` : ""}, ${when}`}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 60, boxSizing: "border-box", padding: "8px 12px 8px 10px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 14, textAlign: "left", font: "inherit", cursor: "pointer" }}>
          {tg ? (
            <span aria-hidden="true" style={{ flex: "none", width: 52, height: 38, padding: "4px 5px", boxSizing: "border-box", background: "linear-gradient(180deg, #F6ECCF, #EFE1BC)", boxShadow: "inset 0 0 0 1px rgba(120,85,25,.18)", overflow: "hidden", fontFamily: TYPE, fontSize: 8, lineHeight: 1.2, color: TINK, textTransform: "uppercase" }}>{r.body}</span>
          ) : (
            <span aria-hidden="true" style={{ flex: "none", width: 56, height: 38, borderRadius: 3, overflow: "hidden", background: NEUTRAL.airmailHair, border: `2px solid ${NEUTRAL.white}`, boxShadow: "0 2px 5px -2px rgba(22,17,13,.45)" }}>
              {r.photo ? <img src={r.photo} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            </span>
          )}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: fs(14), lineHeight: 1.3, color: NEUTRAL.ink }}>
              <b style={{ fontWeight: 650 }}>{from}</b>{what ? <span style={{ color: NEUTRAL.ink2 }}> · {tg ? String(what).toUpperCase() : what}</span> : null}
            </span>
            <span style={{ display: "block", marginTop: 2, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".04em", color: NEUTRAL.ink3 }}>
              {when}{others.length ? ` · group, ${others.length + 1} people` : ""}{r.kept ? " · kept" : ""}{tg && !r.received_at ? " · sealed" : ""}
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        </button>
      )}
    </div>
  );
}

// A bottom sheet for what one line opens (2026-10-19): Find people, passport activity, requests.
function Sheet({ title, onClose, children }) {
  useDismissable(true, onClose);
  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-end justify-center" style={{ background: "rgba(22,17,13,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md max-h-[86vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
        style={{ background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0" }}>
        <AirmailChevron height={4} />
        <div style={{ padding: "12px 16px calc(22px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, color: NEUTRAL.ink }}>{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 -8px 0 0", padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
              <X size={20} strokeWidth={2} color={NEUTRAL.ink2} aria-hidden="true" focusable="false" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Claim your @username, right here (it used to live two taps away). Today's flow: the age
// gate first when the worker asks (the OS age range, else the birthday), suggestions when the
// name is taken.
function ClaimCard({ onClaimed, style = undefined }) {
  const { refreshSocialTier } = useAuth();
  const [draft, setDraft] = useState("");
  const [sugs, setSugs] = useState([]);
  const [needYear, setNeedYear] = useState(false);
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);

  const claim = async () => {
    const want = draft.trim().toLowerCase();
    if (!want || busy) return;
    setBusy(true);
    if (needYear) {
      const dob = splitDob(year);
      if (!dob) { setBusy(false); showToast("Enter your full birthday", "error"); return; }
      const { error: yErr } = await setAgeGate(dob.year, dob.md);
      if (yErr && yErr !== "age_required") { setBusy(false); showToast(yErr, "error"); return; }
      setNeedYear(false);
      refreshSocialTier(); // a teen sees the hold, an under-13 the freeze, right away
    }
    const { handle: h, suggestions, error } = await setHandle(want);
    setBusy(false);
    if (error === "age_required") {
      setNeedYear(true); showToast("One thing first — your birthday", "success"); return;
    }
    setSugs(error ? (suggestions || []) : []);
    if (error) { showToast(workerMessage(error, "That username didn’t work. Try another."), "error"); return; }
    setDraft("");
    showToast(`You’re @${h} — your circle can find you now`, "success");
    onClaimed(h);
  };

  const field = { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4, minHeight: 44, padding: "0 12px", borderRadius: 12, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` };
  const ready = draft.length >= 3 && (!needYear || !!splitDob(year));
  return (
    <section aria-label="Claim your @username" style={{ padding: 16, background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 16, ...style }}>
      <h2 style={{ margin: 0, fontSize: fs(14), fontWeight: 700, lineHeight: 1.3, color: NEUTRAL.ink }}>Claim your @username</h2>
      <p style={{ margin: "2px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>It’s how your circle finds you, follows you, and sends you postcards.</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <label style={field}>
          <span aria-hidden="true" style={{ fontWeight: 700, color: NEUTRAL.ink3 }}>@</span>
          <span className="sr-only">Choose your username</span>
          <input value={draft} onChange={(e) => setDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            placeholder="yourname" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            onKeyDown={(e) => { if (e.key === "Enter") claim(); }}
            style={{ flex: 1, minWidth: 0, height: 42, border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: fs(14), color: NEUTRAL.ink }} />
        </label>
        <button type="button" onClick={claim} aria-disabled={!ready || busy || undefined} aria-busy={busy || undefined}
          style={{ flex: "none", minHeight: 44, padding: "0 16px", borderRadius: 12, border: 0, background: BLUE, font: "inherit", fontSize: fs(13.5), fontWeight: 600, color: NEUTRAL.white, opacity: ready && !busy ? 1 : 0.55, cursor: ready && !busy ? "pointer" : "default" }}>
          {busy ? "One moment…" : "Claim"}
        </button>
      </div>
      {needYear ? (
        <div style={{ marginTop: 10 }}>
          <label htmlFor="gs-mb-birth-year" style={{ display: "block", fontSize: fs(12.5), fontWeight: 600, color: NEUTRAL.ink }}>One thing first — your birthday</label>
          <p style={{ margin: "1px 0 0", fontSize: fs(11.5), color: NEUTRAL.ink3 }}>Asked once, never shown.</p>
          <input id="gs-mb-birth-year" type="date" value={year} onChange={(e) => setYear(e.target.value)} autoComplete="bday"
            min="1900-01-01" max={new Date().toISOString().slice(0, 10)}
            style={{ marginTop: 6, width: 190, maxWidth: "100%", height: 44, boxSizing: "border-box", padding: "0 12px", borderRadius: 12, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, fontSize: fs(14), outline: "none" }} />
        </div>
      ) : null}
      {sugs.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: fs(11.5), color: NEUTRAL.ink3 }}>Free right now:</span>
          {sugs.map((sug) => (
            <button key={sug} type="button" onClick={() => { setDraft(sug); setSugs([]); }}
              style={{ minHeight: 44, padding: "0 12px", borderRadius: 999, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, font: "inherit", fontSize: fs(12.5), fontWeight: 600, color: NEUTRAL.ink, cursor: "pointer" }}>
              @{sug}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// 'Your circle · 18' with up to five faces (your inner circle first, then the newest),
// opening the Circle screen (Mailbox L211-221). Hidden while nobody is on either side.
function CircleRow({ circle, style = undefined }) {
  const counts = circle.counts || {};
  if (circle.status !== "ready" || (!counts.youFollow && !counts.followYou)) return null;
  const seen = new Set();
  const faces = [...(circle.mutual || []), ...(circle.acc || []), ...(circle.fol || [])].filter((p) => {
    const k = String(p.user_id ?? p.handle ?? "");
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 5);
  return (
    <Link to={createPageUrl("Circle")}
      style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, boxSizing: "border-box", padding: "0 12px 0 16px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, textDecoration: "none", ...style }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: fs(15), fontWeight: 600, lineHeight: 1.3, color: NEUTRAL.ink }}>
        Your circle{counts.youFollow ? <span style={{ fontFamily: MONO, fontSize: fs(11), fontWeight: 500, letterSpacing: ".06em", color: NEUTRAL.ink3 }}> · {counts.youFollow}</span> : null}
      </span>
      <span aria-hidden="true" style={{ flex: "none", display: "flex", alignItems: "center" }}>
        {faces.map((p, i) => (
          <Face key={String(p.user_id ?? p.handle)} name={p.name} handle={p.handle} avatar={p.avatar} cloth={p.cloth} size={24} style={{ marginLeft: i ? -7 : 0 }} />
        ))}
      </span>
      <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
    </Link>
  );
}

function MailboxBody() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const circle = useCircle();
  const [feed, setFeed] = useState(null);        // { rows, held, error } once read
  const [box, setBox] = useState(null);          // every card and telegram to me: { rows, next, held, error, partial }
  const [older, setOlder] = useState("idle");    // reading an older page of the box: 'idle' | 'busy' | 'failed'
  const [me, setMe] = useState({ loaded: false, handle: null });
  const [activity, setActivity] = useState([]);
  // Several "city board now shows…" lines fold into one (founder, 2026-10-19: "quite a scroll");
  // the Find people heads-up and a single board line stay as they are.
  const foldBoards = (items) => {
    const boards = items.filter((a) => a?.type === "board" && a.board_kind !== "find" && a.board_kind !== "many");
    if (boards.length < 2) return items;
    const first = items.findIndex((a) => a?.type === "board" && a.board_kind !== "find");
    const folded = { type: "board", board_kind: "many", boards: boards.map((b) => b.board_name).filter(Boolean), photos: boards.reduce((n, b) => n + (b.photos || 0), 0),
      at: boards.map((b) => b.at).sort().pop(), unread: boards.some((b) => b.unread) };
    const rest = items.filter((a) => !(a?.type === "board" && a.board_kind !== "find"));
    const at = Math.min(Math.max(first, 0), rest.length);
    return [...rest.slice(0, at), folded, ...rest.slice(at)];
  };

  // The tab: ?tab=, else the tab of a tapped notification (?tg= / ?pc=), else the one used last.
  const params = new URLSearchParams(location.search);
  const tabParam = params.get("tab");
  const wantedTg = params.get("tg");
  const wantedPc = params.get("pc");
  const [tab, setTabState] = useState(() => {
    if (MAIL_TABS.includes(tabParam)) return tabParam;
    if (wantedTg) return "telegrams";
    if (wantedPc) return "postcards";
    try { const v = localStorage.getItem(TAB_KEY); return MAIL_TABS.includes(v) ? v : "postcards"; } catch { return "postcards"; }
  });
  const setTab = (t) => {
    setTabState(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* storage off */ }
    if (tabParam || wantedTg || wantedPc) navigate(createPageUrl("Mailbox"), { replace: true });
  };
  // Mail I've read opens on a tap; a tapped notification's message opens by itself.
  const [openIds, setOpenIds] = useState(() => new Set([wantedTg, wantedPc].filter(Boolean)));
  const toggleOpen = (id) => setOpenIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [compose, setCompose] = useState(false);
  const [sheet, setSheet] = useState(null);   // 'find'
  // Reply and Delete on a postcard or telegram addressed to me (2026-10-19). A postcard's Reply
  // asks which way (ReplyWays: a postcard back or a telegram back) once telegrams are open; a
  // telegram's Reply is a telegram back.
  const wires = Array.isArray(feed?.features) && feed.features.includes("telegrams");
  const nameFor = (by) => by?.name || (by?.handle ? `@${by.handle}` : null);
  const [replyTo, setReplyTo] = useState(null);     // the postcard composer, as a reply
  const [wireTo, setWireTo] = useState(null);       // the telegram composer: {} new, { reply_to, … } a reply
  const [replyPick, setReplyPick] = useState(null); // a postcard row: which way to answer it
  // all (2026-10-25): a group telegram's or group postcard's "Reply to all"; the others ride along so
  // the composer can offer either way.
  const othersOf = (row) => (Array.isArray(row?.group) ? row.group : Array.isArray(row?.also_to) ? row.also_to : []).filter(Boolean);
  const replyFor = (row, all = false) => (wires ? setReplyPick({ ...row, all: !!all }) : setReplyTo({ postcard_id: row.id, name: nameFor(row.by), group: othersOf(row), all: !!all }));
  const wireBack = (row, all = false) => setWireTo({ reply_to: row.id, name: row.by?.name || null, handle: row.by?.handle || null, group: othersOf(row), all: !!all });
  const removeCard = async (row) => {
    const tg = row.kind === "telegram";
    const r = tg ? await deleteTelegram(row.id) : await deletePostcard(row.id);
    if (!r.ok) { showToast(workerMessage(r.error, "Couldn’t delete it. Try again."), "error"); return false; }
    const type = tg ? "telegram" : "postcard";
    setFeed((f) => (f && Array.isArray(f.rows) ? { ...f, rows: f.rows.filter((x) => !(x?.type === type && x.id === row.id)) } : f));
    setBox((b) => (b && Array.isArray(b.rows) ? { ...b, rows: b.rows.filter((x) => x.id !== row.id) } : b));
    setActivity((list) => list.filter((a) => (tg ? a.telegram_id : a.postcard_id) !== row.id));
    showToast(tg ? "Telegram deleted" : "Postcard deleted", "success");
    load();
    return true;
  };
  const [traveler, setTraveler] = useState(null); // { person, report, pc } in the TravelerSheet
  // pc: a postcard or telegram sent to me ({ id, by, reply, kind }), so the sheet also offers
  // Delete, and Reply when the place it opened from has no Reply button of its own (a row).
  const openTraveler = (person, report = null, pc = null) => setTraveler({ person: person || {}, report, pc });
  const mine = (row, reply = false, kind = "postcard") => (row && row.to_me === true && row.id ? { id: row.id, by: row.by, reply, kind } : null);
  const bringIntoView = (kind, id) => {
    const el = id ? document.querySelector(`[data-${kind}="${String(id).replace(/[^a-f0-9-]/gi, "")}"]`) : null;
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate?.([{ boxShadow: `0 0 0 3px ${BLUE}` }, { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }], { duration: 1800, easing: "ease-out" });
    return true;
  };
  // A tapped notification (/Mailbox?tg=<id>, ?pc=<id>) brings its message into view once mail is in.
  useEffect(() => {
    const id = wantedTg || wantedPc;
    if (!id || !feed?.rows || !box) return undefined;
    const t = setTimeout(() => { bringIntoView(wantedTg ? "tg" : "pc", id); }, 300);
    return () => clearTimeout(t);
  }, [wantedTg, wantedPc, feed, box]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [myName, setMyName] = useState(null);   // for a postcard's address line

  useEffect(() => {
    let gone = false;
    getSocialProfile().then((sp) => { if (!gone) setMyName(sp.profile?.display_name || null); });
    return () => { gone = true; };
  }, []);

  const loadBox = async () => {
    const r = await postcardBox();
    setBox(r);
    setOlder("idle");
  };
  const load = async () => {
    // Opening the Mailbox marks the activity read, which clears the nav dot.
    loadBox();
    const [f, h, u] = await Promise.all([socialFeed(), getHandle(), socialUnread({ mark: true })]);
    setFeed(f);
    setMe({ loaded: true, handle: h.handle || null });
    setActivity(foldBoards(u.activity || []));
  };
  useEffect(() => { load(); }, []);
  const retry = () => { setFeed(null); setBox(null); load(); };
  const readOlder = async () => {
    if (older === "busy" || !box?.next) return;
    setOlder("busy");
    const r = await postcardBox(box.next);
    if (r.error || r.held) { setOlder("failed"); return; }
    setOlder("idle");
    setBox((b) => {
      const seen = new Set((b.rows || []).map((x) => x.id));
      return { ...b, rows: [...(b.rows || []), ...(r.rows || []).filter((x) => !seen.has(x.id))], next: r.next };
    });
  };
  // With no tab asked for, the first mail decides: new telegrams and no new postcards open
  // Telegrams (and the other way round).
  const autoTab = useRef(!tabParam && !wantedTg && !wantedPc);
  useEffect(() => {
    if (!autoTab.current || !feed || feed.error || feed.held) return;
    autoTab.current = false;
    const r = feed.rows || [];
    const pcNew = r.some((x) => x.type === "postcard" && x.to_me);
    const tgNew = r.some((x) => x.type === "telegram");
    if (tab === "postcards" && !pcNew && tgNew) setTabState("telegrams");
    else if (tab === "telegrams" && !tgNew && pcNew) setTabState("postcards");
  }, [feed]);   // eslint-disable-line react-hooks/exhaustive-deps

  // A texted postcard or telegram (2026-10-24): /Mailbox?claim=<code> from the link's page (the
  // globeskimmers:// link), or the code typed under "Have a code from a text?". The worker
  // delivers the reader's own copy, and the mail reloads with it.
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeText, setCodeText] = useState("");
  const [claiming, setClaiming] = useState(false);
  const claim = async (raw) => {
    const code = linkCodeOf(raw);
    if (code.length !== 8) { showToast("That code doesn’t look right — it’s 8 letters and numbers", "error"); return; }
    if (claiming) return;
    setClaiming(true);
    const { data, error } = await claimLink(code);
    setClaiming(false);
    if (error === "age_required") { showToast("Set your birth year in Settings first (one time)", "error"); return; }
    if (error) { showToast(workerMessage(error, "Couldn’t open it. Try again."), "error"); return; }
    setCodeOpen(false);
    setCodeText("");
    const tg = data?.kind === "telegram";
    setTab(tg ? "telegrams" : "postcards");
    showToast(data?.already ? "You opened this one already — it’s in your Mailbox" : `Your ${tg ? "telegram" : "postcard"} is here, under New`, "success");
    load();
  };
  const claimParam = params.get("claim");
  useEffect(() => {
    if (!claimParam) return;
    navigate(createPageUrl("Mailbox"), { replace: true });
    claim(claimParam);
  }, [claimParam]);   // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = circle.blockedHandles || new Set();
  const rows = feed && !feed.error ? (feed.rows || []).filter((r) => !blocked.has(lc(r?.by?.handle))) : [];
  const counts = circle.counts || {};
  const addressable = (circle.acc || []).some((r) => r.handle) || (counts.followYou || 0) > 0;
  // A passport-activity line that points at a message: its tab, opened.
  const openFrom = (to) => {
    const [k, id] = String(to).split(":");
    if (k === "tg" || k === "pc") {
      setTab(k === "tg" ? "telegrams" : "postcards");
      setOpenIds((s) => new Set([...s, id]));
      setTimeout(() => bringIntoView(k, id), 350);
      return;
    }
    navigate(to === "passport" ? createPageUrl("Passport") : `${createPageUrl("Circle")}?tab=followers`);
  };

  // Keep a card sent to everyone in your postcard box, or let it go: the pill flips at once
  // and flips back when the worker says no; let go from the box, it leaves the box.
  const keep = async (row) => {
    if (!row?.id) return;
    const want = !row.kept;
    const flip = (v) => {
      setFeed((f) => (f && Array.isArray(f.rows) ? { ...f, rows: f.rows.map((r) => (r?.type === "postcard" && r.id === row.id ? { ...r, kept: v } : r)) } : f));
      setBox((b) => (b && Array.isArray(b.rows) ? { ...b, rows: v ? b.rows.map((r) => (r.id === row.id ? { ...r, kept: true } : r)) : b.rows.filter((r) => r.id !== row.id) } : b));
    };
    flip(want);
    const res = await keepPostcard(row.id, want);
    if (!res.ok) { flip(!want); showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error"); return; }
    showToast(want ? "Kept under Postcards" : "Removed from your postcards", "success");
    if (want) loadBox();
  };

  const answer = (op) => async (row) => {
    const res = op === "accept" ? await circle.accept(row) : await circle.decline(row);
    if (!res.ok) showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error");
    else if (op === "accept") showToast(row?.handle ? `@${lc(row.handle)} follows you now` : "They follow you now", "success");
    return res;
  };

  // Mail to me (the feed's new postcards and telegrams) vs the circle's news; postcards and
  // telegrams leave the passport's activity — the card is the notification, and the tab counts it.
  const mailRows = rows.filter((r) => r.type === "telegram" || (r.type === "postcard" && r.to_me));
  const circleRows = rows.filter((r) => !(r.type === "telegram" || (r.type === "postcard" && r.to_me)));
  const passportNews = (activity || []).filter((a) => a && a.type !== "postcard" && a.type !== "telegram");
  const newsFresh = passportNews.filter((a) => a.unread).length;
  const meName = myName || profile?.first_name || null;
  // What I've read: everything in the box that isn't new in the feed.
  const fresh = new Set(mailRows.map((r) => r.id));
  const boxRows = box && !box.error && !box.held ? (box.rows || []).filter((r) => !blocked.has(lc(r?.by?.handle)) && !fresh.has(r.id)) : [];
  const newPc = mailRows.filter((r) => r.type === "postcard");
  const newTg = mailRows.filter((r) => r.type === "telegram");
  const readPc = boxRows.filter((r) => r.type !== "telegram");
  const readTg = boxRows.filter((r) => r.type === "telegram");
  const requests = circle.status === "ready" ? circle.requests || [] : [];
  const tabCounts = { postcards: newPc.length, telegrams: newTg.filter((r) => !r.received_at).length, news: newsFresh > 0 || requests.length > 0 };

  const isNew = (r) => (r.type === "postcard" || r.type === "telegram") && r.from_new;
  // One message or stamp, in full. `fresh`: from someone you don't follow.
  const card = (r, i, fromNew) => {
    if (r.type === "telegram") {
      return (
        <div key={`tg-${r.id}`} data-tg={r.id} style={{ borderRadius: 4 }}>
          <TelegramCard row={r} me={me.handle} meName={meName} onReply={wireBack}
            onReport={(row) => openTraveler(row.by, { kind: "telegram", ref: `tg:${row.id}`, note: clip(`Telegram${fromNew ? " from someone new" : ""}, ${whenLabel(row.created_at)}: "${row.body || ""}"`, 480) }, mine(row, false, "telegram"))} />
        </div>
      );
    }
    if (r.type === "postcard" || r.photo) {
      return (
        <div key={`pc-${r.id || r.created_at}-${i}`} data-pc={r.id || undefined} style={{ borderRadius: 14 }}>
          <PostcardCard row={r} onReply={replyFor} me={me.handle} meName={meName} onKeep={keep}
            onReport={(row) => openTraveler({ ...row.by, postcard_id: row.id || null }, { kind: "postcard", ...(row.id ? { ref: `pc:${row.id}` } : {}), note: clip(fromNew ? `Postcard from someone new${row.place ? ` from ${row.place}` : ""}, ${whenLabel(row.created_at)}` : `Postcard${row.place ? ` from ${row.place}` : ""}, ${whenLabel(row.created_at)}${row.message ? `: "${row.message}"` : ""}`, 480) }, mine(row))} />
        </div>
      );
    }
    return (
      <Envelope key={`st-${r.created_at}-${i}`} row={r} variant="full" me={me.handle}
        onReport={(row) => openTraveler(row.by, { kind: "stamp", note: clip(`Stamp in my Mailbox, ${whenLabel(row.created_at)}: ${row.name}${row.city ? `, ${row.city}` : ""}`, 480) })} />
    );
  };

  const skeleton = (label) => (
    <>
      <span className="sr-only" role="status">{label}</span>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none"
          style={{ height: 112, marginTop: i ? 12 : 0, borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }} />
      ))}
    </>
  );
  const failed = (
    <div style={{ padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
      <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Couldn’t load your mailbox.</p>
      <button type="button" onClick={retry}
        style={{ marginTop: 10, minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, font: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" }}>
        Try again
      </button>
    </div>
  );
  const empty = (title, line, action = null) => (
    <div style={{ padding: "24px 20px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 18, textAlign: "center" }}>
      <MailboxIcon size={36} strokeWidth={1.6} color={BLUE} aria-hidden="true" focusable="false" style={{ display: "block", margin: "0 auto" }} />
      <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>{title}</p>
      <p style={{ margin: "6px auto 0", maxWidth: "34ch", fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>{line}</p>
      {action}
    </div>
  );
  const outline = { marginTop: 14, minHeight: 44, padding: "0 18px", borderRadius: 999, border: `1px solid ${BLUE}`, background: NEUTRAL.white, font: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" };

  // A mail tab: new first (full), then what I've read (folded rows that open), then older pages.
  const mailTab = (kind) => {
    const tg = kind === "telegrams";
    const fresh2 = tg ? newTg : newPc;
    const read = tg ? readTg : readPc;
    if (!feed) return skeleton(tg ? "Loading your telegrams" : "Loading your postcards");
    if (feed.held) return <TeenHoldNote />;
    if (feed.error) return failed;
    const boxReady = !!box && !box.error;
    if (!fresh2.length && boxReady && !read.length && !box.next) {
      return tg
        ? empty(<>No telegrams <em style={{ fontStyle: "italic", color: BLUE }}>yet</em></>, "Telegrams sent to you arrive here sealed. Tap one to open it.", wires ? <button type="button" onClick={() => setWireTo({})} style={outline}>Send a telegram</button> : null)
        : empty(<>No postcards <em style={{ fontStyle: "italic", color: BLUE }}>yet</em></>, "Postcards sent to you land here and stay until you delete them.", <button type="button" onClick={() => setCompose(true)} style={outline}>Send a postcard</button>);
    }
    return (
      <>
        {fresh2.length ? (
          <section aria-label={tg ? "New telegrams" : "New postcards"}>
            <h2 style={KICKER}>{tg ? "New" : "New"} · {fresh2.length}</h2>
            {fresh2.some(isNew) ? (
              <p style={{ margin: "4px 0 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink3 }}>Some are from people you don’t follow. The ••• reports or blocks the sender.</p>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {fresh2.map((r, i) => card(r, i, !!r.from_new))}
            </div>
          </section>
        ) : (
          <p style={{ margin: 0, fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>Nothing new. {tg ? "Telegrams you’ve opened are below." : "Postcards you’ve read are below."}</p>
        )}
        <section aria-label={tg ? "Telegrams you’ve opened" : "Postcards you’ve read"} style={{ marginTop: GAP }}>
          {!box ? skeleton("Loading what you’ve read") : box.error ? (
            <p style={{ margin: 0, fontSize: fs(13), color: NEUTRAL.ink2 }}>Couldn’t load the older ones. <button type="button" onClick={loadBox} style={{ border: 0, background: "transparent", padding: 0, font: "inherit", fontWeight: 600, color: BLUE, textDecoration: "underline", cursor: "pointer" }}>Try again</button></p>
          ) : read.length ? (
            <>
              <h2 style={KICKER}>{tg ? "Opened" : "Read"}{!box.next && !box.partial ? ` · ${read.length}` : ""}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {read.map((r, i) => (
                  <ReadRow key={r.id || `r-${i}`} r={r} open={openIds.has(r.id)} onToggle={() => toggleOpen(r.id)}>
                    {card(r, i, false)}
                  </ReadRow>
                ))}
              </div>
            </>
          ) : null}
          {box?.next ? (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <button type="button" onClick={readOlder} aria-busy={older === "busy" || undefined} style={{ ...outline, marginTop: 0 }}>
                {older === "busy" ? "One moment…" : older === "failed" ? "Couldn’t load older ones. Try again" : `Show older ${tg ? "telegrams" : "postcards"}`}
              </button>
            </div>
          ) : null}
        </section>
      </>
    );
  };

  const newsTab = () => {
    if (!feed) return skeleton("Loading your news");
    if (feed.held) return <TeenHoldNote />;
    const nothing = !requests.length && !passportNews.length && !(feed && !feed.error && circleRows.length);
    return (
      <>
        {requests.length ? (
          <section aria-label="Follow requests">
            <h2 style={KICKER}>{requests.length === 1 ? "1 person asked to follow you" : `${requests.length} people asked to follow you`}</h2>
            <Requests rows={requests} onAccept={answer("accept")} onDecline={answer("decline")} style={{ marginTop: 8 }}
              onMore={(r) => openTraveler(r, { kind: "profile", note: "Asked to follow me" })} />
          </section>
        ) : null}
        {passportNews.length ? (
          <section aria-label="On your passport" style={{ marginTop: requests.length ? GAP : 0 }}>
            <h2 style={KICKER}>On your passport{newsFresh ? ` · ${newsFresh} new` : ""}</h2>
            <ActivityList items={passportNews} limit={8} heading={false} onOpen={openFrom} style={{ marginTop: 6 }}
              onMore={(a) => openTraveler({ ...a.by, entry_id: a.entry_id || null }, { kind: ACTIVITY_KIND[a.type] || "profile", note: clip(`Mailbox, ${whenLabel(a.at)}: ${whoOf(a.by)} (${a.type})`, 480) })} />
          </section>
        ) : null}
        {feed.error ? <div style={{ marginTop: requests.length || passportNews.length ? GAP : 0 }}>{failed}</div> : circleRows.length ? (
          <section aria-label="Where your circle has been" style={{ marginTop: requests.length || passportNews.length ? GAP : 0 }}>
            <h2 style={KICKER}>Where your circle has been · newest first</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {circleRows.map((r, i) => card(r, i, false))}
            </div>
          </section>
        ) : null}
        {nothing && !feed.error ? empty(<>Nothing new, <em style={{ fontStyle: "italic", color: BLUE }}>for now</em></>, "Follow requests, news about your passport, and your circle’s new stamps land here.", <InviteButton style={{ marginTop: 16 }} />) : null}
        <CircleRow circle={circle} style={{ marginTop: 16 }} />
        <Link to={cityBoardsUrl()} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52, marginTop: 8, padding: "0 12px 0 14px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 14, textDecoration: "none" }}>
          <Globe size={18} strokeWidth={1.8} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: fs(14), color: NEUTRAL.ink2 }}><b style={{ fontWeight: 650, color: NEUTRAL.ink }}>City boards</b> — photos from real travelers</span>
          <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        </Link>
      </>
    );
  };

  return (
    <div>
      <Masthead onPostcard={() => setCompose(true)} onTelegram={wires ? () => setWireTo({}) : undefined} onFind={() => setSheet("find")} addressable={addressable} />
      <div className={COLUMN}>
        {me.loaded && !me.handle ? <ClaimCard onClaimed={(h) => setMe({ loaded: true, handle: h })} style={{ marginTop: 16 }} /> : null}
        <MailTabs tab={tab} onTab={setTab} counts={tabCounts} />
        <div role="tabpanel" id={`mail-panel-${tab}`} aria-labelledby={`mail-tab-${tab}`} style={{ paddingTop: 16 }}>
          {tab === "sent" ? <SentList /> : tab === "news" ? newsTab() : mailTab(tab)}
        </div>

        {/* A friend texted a postcard or telegram (2026-10-24): the link's code opens it here. */}
        {tab === "postcards" || tab === "telegrams" ? (
          codeOpen ? (
            <form onSubmit={(e) => { e.preventDefault(); claim(codeText); }}
              style={{ marginTop: GAP, padding: "12px 14px", borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }}>
              <label htmlFor="gs-claim-code" style={{ display: "block", fontFamily: MONO, fontSize: fs(10), letterSpacing: ".16em", textTransform: "uppercase", color: BLUE }}>The link or code from the text</label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input id="gs-claim-code" value={codeText} onChange={(e) => setCodeText(e.target.value.slice(0, 80))} placeholder="K7Q2 M9PA"
                  autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="go"
                  style={{ flex: 1, minWidth: 0, minHeight: 44, padding: "0 12px", borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, fontFamily: MONO, fontSize: fs(16), letterSpacing: ".1em", color: NEUTRAL.ink }} />
                <button type="submit" aria-busy={claiming || undefined}
                  style={{ flex: "none", minHeight: 44, padding: "0 18px", borderRadius: 12, border: 0, background: NEUTRAL.stamp, color: NEUTRAL.white, font: "inherit", fontSize: fs(14), fontWeight: 600 }}>
                  {claiming ? "Opening…" : "Open"}
                </button>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Paste the whole link, or type the 8 letters and numbers at its end (globeskimmers.io/m/K7Q2M9PA).</p>
            </form>
          ) : (
            <button type="button" onClick={() => setCodeOpen(true)}
              style={{ display: "block", margin: `${GAP}px auto 0`, minHeight: 40, padding: "0 4px", border: 0, background: "transparent", font: "inherit", fontSize: fs(12.5), fontWeight: 600, color: BLUE, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>
              Have a code from a text? Open it
            </button>
          )
        ) : null}
      </div>

      {sheet === "find" ? (
        <Sheet title="Add friends" onClose={() => setSheet(null)}>
          <FindPeople onFollowed={() => load()} labelHidden style={{ marginTop: 6 }} />
          <InviteButton style={{ marginTop: 12 }} />
        </Sheet>
      ) : null}
      {traveler ? (
        <TravelerSheet person={traveler.person} report={traveler.report}
          postcard={traveler.pc ? { what: traveler.pc.kind, onReply: traveler.pc.reply ? () => (traveler.pc.kind === "telegram" ? wireBack(traveler.pc) : replyFor(traveler.pc)) : undefined, onDelete: () => removeCard(traveler.pc) } : null}
          onClose={() => setTraveler(null)} onChanged={() => { setTraveler(null); circle.retry(); load(); }} />
      ) : null}
      <PostcardCompose open={compose} onClose={() => setCompose(false)} onSent={load}
        blocked={circle.blocked} />
      {wireTo ? (
        <TelegramCompose open replyTo={wireTo.reply_to ? wireTo : null} onClose={() => setWireTo(null)} onSent={() => { setWireTo(null); load(); }}
          blocked={circle.blocked} meName={meName} meHandle={me.handle} />
      ) : null}
      {replyPick ? (
        <ReplyWays name={nameFor(replyPick.by)} onClose={() => setReplyPick(null)}
          onPostcard={() => setReplyTo({ postcard_id: replyPick.id, name: nameFor(replyPick.by), group: othersOf(replyPick), all: !!replyPick.all })} onTelegram={() => wireBack(replyPick, !!replyPick.all)} />
      ) : null}
      {replyTo ? (
        <PostcardCompose open replyTo={replyTo} onClose={() => setReplyTo(null)} onSent={() => { setReplyTo(null); load(); }}
          blocked={circle.blocked} />
      ) : null}
    </div>
  );
}

export default function MailboxPage() {
  const { socialTier, socialTierReady } = useAuth();
  // Nothing social until the age tier is known; a 13-17 account keeps the masthead and the
  // chevron with the hold note, and the circle isn't read for them.
  if (!socialTierReady || socialTier === "blocked") return <Masthead />;
  if (socialTier === "confirm") {
    return (
      <div>
        <Masthead />
        <div className={COLUMN}><div style={{ marginTop: 16 }}><ConfirmBirthdayNote /></div></div>
      </div>
    );
  }
  if (socialTier === "teen") {
    return (
      <div>
        <Masthead />
        <div className={COLUMN}><div style={{ marginTop: 16 }}><TeenHoldNote /></div></div>
      </div>
    );
  }
  return <MailboxBody />;
}
