// Mailbox: where your circle has been (bible.mailbox; Mailbox.dc.html), in the airmail
// stock that Home's circle zone and the profile's circle folder share. Your circle's stamps
// and postcards, newest first and never ranked, never coordinates; what happened on your
// passport (the activity behind the nav dot, cleared on opening); requests; and the ways in:
// follow by @username, the invite, and claiming your own @username.
//
// It shows nothing untrue: nothing social until the age tier is known; the hold note for a
// 13-17 account; a skeleton while the feed loads, 'Try again' when it fails (never 'An
// empty mailbox'); rows from people you blocked never show. The old one-tap unfollow chips
// are gone: 'Your circle · n' opens the Circle screen, where unfollowing asks first. The
// feed holds only the newest cards; 'Your postcard box' keeps every one sent to you. Since
// 2026-10-19 a postcard or telegram to me leaves the feed half an hour after it was read and
// lives in the box until deleted.
// Every person here (a postcard's sender, a stamp, an activity line, a request) has a
// door to TravelerSheet: Report, Unfollow, and Block once the worker advertises
// block_v2 (go-live decision 6, 2026-10-13; Apple 1.2). A 'confirm' account (a birthday
// still to complete) gets the note that lets it finish.
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Globe, Lock, Mail, Mailbox as MailboxIcon, Zap } from "lucide-react";
import { createPageUrl } from "@/utils";
import { cityBoardsUrl } from "@/lib/boardLinks";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { socialFeed, getHandle, getSocialProfile, setHandle, setAgeGate, splitDob, socialUnread, keepPostcard, deletePostcard } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import Envelope, { whenLabel } from "@/components/social/Envelope";
import TravelerSheet from "@/components/social/TravelerSheet";
import ConfirmBirthdayNote from "@/components/social/ConfirmBirthdayNote";
import { Face } from "@/components/social/SocialMarks";
import { workerMessage } from "@/components/social/FollowByHandle";
import FindPeople from "@/components/social/FindPeople";
import Requests from "@/components/social/Requests";
import ActivityList from "@/components/social/ActivityList";
import PostcardCard from "@/components/social/PostcardCard";
import InviteButton from "@/components/passport/InviteButton";
import PostcardCompose from "@/components/passport/PostcardCompose";
import TelegramCard from "@/components/telegram/TelegramCard";
import TelegramCompose from "@/components/telegram/TelegramCompose";
import ReplyWays from "@/components/telegram/ReplyWays";
import { deleteTelegram } from "@/lib/telegram";
import TeenHoldNote from "@/components/social/TeenHoldNote";

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

// The masthead on the page, then the full-bleed chevron (Mailbox L28-41).
function Masthead({ onPostcard = undefined, onTelegram = undefined, addressable = false }) {
  return (
    <>
      <div aria-hidden="true" style={{ height: 12 }} />
      <header className={COLUMN} style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".2em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.stamp }}>Globeskimmers · Mailbox</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
          <h1 style={{ margin: 0, minWidth: 0, flex: "1 1 200px", fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 1.04, color: NEUTRAL.ink }}>
            Where your <em style={{ fontStyle: "italic", color: BLUE }}>circle</em> has been
          </h1>
          {onPostcard ? (
            <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <button type="button" onClick={onPostcard}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 16px", borderRadius: 999, border: addressable ? 0 : `1px solid ${BLUE}`, background: addressable ? NEUTRAL.stamp : "transparent", font: "inherit", fontSize: fs(13), fontWeight: 600, color: addressable ? NEUTRAL.white : BLUE, cursor: "pointer" }}>
                <Mail size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
                Postcard
              </button>
              {/* Telegrams (2026-10-19): four words by wire, no photo. */}
              {onTelegram ? (
                <button type="button" onClick={onTelegram}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 16px", borderRadius: 999, border: "1px solid #2A2219", background: "#F2E4BC", font: "inherit", fontSize: fs(13), fontWeight: 600, color: "#2A2219", cursor: "pointer" }}>
                  <Zap size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
                  Telegram
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {/* The seal (founder, 2026-10-15): say out loud that a mailbox is private — people
            worry that friends can see who writes to them. Nobody can; this line tells them. */}
        <p style={{ display: "flex", alignItems: "flex-start", gap: 6, margin: "8px 0 0", fontSize: fs(12.5), fontWeight: 500, lineHeight: 1.45, color: BLUE }}>
          <Lock size={13} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flex: "none", marginTop: 2 }} />
          <span>Sealed — <b style={{ fontWeight: 750 }}>only you</b> can open and see your mailbox. Nobody else knows what lands here or who it&rsquo;s from, not even your inner circle.</span>
        </p>
      </header>
      <AirmailChevron height={5} />
    </>
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

// 'Your postcard box', above the feed: the feed shows only the newest cards, the box keeps
// every one sent to you and each one you Keep from your circle (Postcards).
function PostcardBoxRow({ style = undefined }) {
  return (
    <Link to={createPageUrl("Postcards")}
      style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, boxSizing: "border-box", padding: "8px 12px 8px 16px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, textDecoration: "none", ...style }}>
      <Mail size={20} strokeWidth={1.8} color={NEUTRAL.stamp} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: fs(15), fontWeight: 600, lineHeight: 1.3, color: NEUTRAL.ink }}>Your postcard box</span>
        <span style={{ display: "block", fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink3 }}>Postcards and telegrams you’ve read, and the ones you keep</span>
      </span>
      <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
    </Link>
  );
}

// 'Postcards and photos from cities & countries': the City Boards, busiest first (2026-10-14;
// wording 2026-10-16). Shown with or
// without a feed, so someone new finds the boards too.
function CityBoardsRow({ style = undefined }) {
  return (
    <Link to={cityBoardsUrl()}
      style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, boxSizing: "border-box", padding: "8px 12px 8px 16px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, textDecoration: "none", ...style }}>
      <Globe size={20} strokeWidth={1.8} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: fs(15), fontWeight: 600, lineHeight: 1.3, color: NEUTRAL.ink }}>Postcards and photos from cities &amp; countries</span>
        <span style={{ display: "block", fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink3 }}>Boards from travelers who were really there</span>
      </span>
      <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
    </Link>
  );
}

function MailboxBody() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const circle = useCircle();
  const [feed, setFeed] = useState(null);        // { rows, held, error } once read
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
  const [compose, setCompose] = useState(false);
  // Reply and Delete on a postcard or telegram addressed to me (2026-10-19). A postcard's Reply
  // asks which way (ReplyWays: a postcard back or a telegram back) once telegrams are open; a
  // telegram's Reply is a telegram back.
  const wires = Array.isArray(feed?.features) && feed.features.includes("telegrams");
  const nameFor = (by) => by?.name || (by?.handle ? `@${by.handle}` : null);
  const [replyTo, setReplyTo] = useState(null);     // the postcard composer, as a reply
  const [wireTo, setWireTo] = useState(null);       // the telegram composer: {} new, { reply_to, … } a reply
  const [replyPick, setReplyPick] = useState(null); // a postcard row: which way to answer it
  const replyFor = (row) => (wires ? setReplyPick(row) : setReplyTo({ postcard_id: row.id, name: nameFor(row.by) }));
  const wireBack = (row) => setWireTo({ reply_to: row.id, name: row.by?.name || null, handle: row.by?.handle || null, group: Array.isArray(row.group) ? row.group : null });
  const removeCard = async (row) => {
    const tg = row.kind === "telegram";
    const r = tg ? await deleteTelegram(row.id) : await deletePostcard(row.id);
    if (!r.ok) { showToast(workerMessage(r.error, "Couldn’t delete it. Try again."), "error"); return false; }
    const type = tg ? "telegram" : "postcard";
    setFeed((f) => (f && Array.isArray(f.rows) ? { ...f, rows: f.rows.filter((x) => !(x?.type === type && x.id === row.id)) } : f));
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
  // A tapped alert (/Mailbox?tg=<id>) or notification row brings its telegram or postcard into view.
  const wanted = new URLSearchParams(useLocation().search).get("tg");
  const bringIntoView = (kind, id) => {
    const el = id ? document.querySelector(`[data-${kind}="${String(id).replace(/[^a-f0-9-]/gi, "")}"]`) : null;
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate?.([{ boxShadow: `0 0 0 3px ${BLUE}` }, { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }], { duration: 1800, easing: "ease-out" });
    return true;
  };
  useEffect(() => {
    if (!wanted || !feed?.rows) return;
    setTimeout(() => { if (!bringIntoView("tg", wanted)) navigate(`${createPageUrl("Postcards")}?tg=${wanted}`, { replace: true }); }, 300);
  }, [wanted, feed]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [myName, setMyName] = useState(null);   // for a postcard's address line

  useEffect(() => {
    let gone = false;
    getSocialProfile().then((sp) => { if (!gone) setMyName(sp.profile?.display_name || null); });
    return () => { gone = true; };
  }, []);

  const load = async () => {
    // Opening the Mailbox marks the activity read, which clears the nav dot.
    const [f, h, u] = await Promise.all([socialFeed(), getHandle(), socialUnread({ mark: true })]);
    setFeed(f);
    setMe({ loaded: true, handle: h.handle || null });
    setActivity(foldBoards(u.activity || []));
  };
  useEffect(() => { load(); }, []);
  const retry = () => { setFeed(null); load(); };

  const blocked = circle.blockedHandles || new Set();
  const rows = feed && !feed.error ? (feed.rows || []).filter((r) => !blocked.has(lc(r?.by?.handle))) : [];
  const counts = circle.counts || {};
  const addressable = (circle.acc || []).some((r) => r.handle) || (counts.followYou || 0) > 0;
  const emptyFeed = !!feed && !feed.error && !feed.held && rows.length === 0;
  const openFrom = (to) => {
    const [k, id] = String(to).split(":");
    // Not in the Mailbox any more (read and filed, 2026-10-19): the postcard box opens at it.
    if (k === "tg" || k === "pc") { if (!bringIntoView(k, id)) navigate(`${createPageUrl("Postcards")}?${k}=${id}`); return; }
    navigate(to === "passport" ? createPageUrl("Passport") : `${createPageUrl("Circle")}?tab=followers`);
  };

  // Keep a card sent to everyone in your postcard box, or let it go: the pill flips at once
  // and flips back when the worker says no.
  const keep = async (row) => {
    if (!row?.id) return;
    const want = !row.kept;
    const flip = (v) => setFeed((f) => (f && Array.isArray(f.rows) ? { ...f, rows: f.rows.map((r) => (r?.type === "postcard" && r.id === row.id ? { ...r, kept: v } : r)) } : f));
    flip(want);
    const res = await keepPostcard(row.id, want);
    if (!res.ok) { flip(!want); showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error"); return; }
    showToast(want ? "Kept in your postcard box" : "Removed from your postcard box", "success");
  };

  const answer = (op) => async (row) => {
    const res = op === "accept" ? await circle.accept(row) : await circle.decline(row);
    if (!res.ok) showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error");
    else if (op === "accept") showToast(row?.handle ? `@${lc(row.handle)} follows you now` : "They follow you now", "success");
    return res;
  };

  // One row of the feed: a postcard, a telegram or a stamp. `fresh`: the "From someone new" shelf.
  const isNew = (r) => (r.type === "postcard" || r.type === "telegram") && r.from_new;
  const meName = myName || profile?.first_name || null;
  const card = (r, i, fresh) => {
    if (r.type === "telegram") {
      return (
        <div key={`tg-${r.id}`} data-tg={r.id} style={{ borderRadius: 4 }}>
          <TelegramCard row={r} me={me.handle} meName={meName} onReply={wireBack}
            onReport={(row) => openTraveler(row.by, { kind: "telegram", ref: `tg:${row.id}`, note: clip(`Telegram${fresh ? " from someone new" : ""}, ${whenLabel(row.created_at)}: "${row.body || ""}"`, 480) }, mine(row, false, "telegram"))} />
        </div>
      );
    }
    if (r.type === "postcard") {
      return (
        <div key={`pc-${r.created_at}-${i}`} data-pc={r.id || undefined} style={{ borderRadius: 14 }}>
          <PostcardCard row={r} onReply={replyFor} me={me.handle} meName={meName} onKeep={keep}
            onReport={(row) => openTraveler({ ...row.by, postcard_id: row.id || null }, { kind: "postcard", ...(row.id ? { ref: `pc:${row.id}` } : {}), note: clip(fresh ? `Postcard from someone new${row.place ? ` from ${row.place}` : ""}, ${whenLabel(row.created_at)}` : `Postcard${row.place ? ` from ${row.place}` : ""}, ${whenLabel(row.created_at)}${row.message ? `: "${row.message}"` : ""}`, 480) }, mine(row))} />
        </div>
      );
    }
    return (
      <Envelope key={`st-${r.created_at}-${i}`} row={r} variant="full" me={me.handle}
        onReport={(row) => openTraveler(row.by, { kind: "stamp", note: clip(`Stamp in my Mailbox, ${whenLabel(row.created_at)}: ${row.name}${row.city ? `, ${row.city}` : ""}`, 480) })} />
    );
  };

  return (
    <div>
      <Masthead onPostcard={() => setCompose(true)} onTelegram={wires ? () => setWireTo({}) : undefined} addressable={addressable} />
      <div className={COLUMN}>
        <FindPeople onFollowed={() => load()} style={{ marginTop: 16 }} />
        {!emptyFeed ? <InviteButton style={{ marginTop: 8 }} /> : null}
        {me.loaded && !me.handle ? <ClaimCard onClaimed={(h) => setMe({ loaded: true, handle: h })} style={{ marginTop: GAP }} /> : null}
        {/* The doors first (founder, 2026-10-19: "quite a scroll"): the postcard box and the boards sit
            above the activity, which collapses to a few rows. */}
        {rows.length ? <PostcardBoxRow style={{ marginTop: GAP }} /> : null}
        <CityBoardsRow style={{ marginTop: rows.length ? 8 : GAP }} />
        <ActivityList items={activity} onOpen={openFrom} style={{ marginTop: GAP }}
          onMore={(a) => openTraveler({ ...a.by, entry_id: a.entry_id || null }, { kind: ACTIVITY_KIND[a.type] || "profile", ...(a.postcard_id ? { ref: `pc:${a.postcard_id}` } : a.telegram_id ? { ref: `tg:${a.telegram_id}` } : {}), note: clip(`Mailbox, ${whenLabel(a.at)}: ${whoOf(a.by)} (${a.type})`, 480) },
            a.type === "postcard" ? mine({ to_me: a.to_me, id: a.postcard_id, by: a.by }, true)
              : a.type === "telegram" ? mine({ to_me: a.to_me, id: a.telegram_id, by: a.by }, true, "telegram") : null)} />
        {circle.status === "ready" && circle.requests?.length ? (
          <Requests rows={circle.requests} onAccept={answer("accept")} onDecline={answer("decline")} style={{ marginTop: GAP }}
            onMore={(r) => openTraveler(r, { kind: "profile", note: "Asked to follow me" })} />
        ) : null}

        <section aria-label="Where your circle has been" style={{ marginTop: GAP }}>
          {!feed ? (
            <>
              <span className="sr-only" role="status">Loading your mailbox</span>
              {[0, 1].map((i) => (
                <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none"
                  style={{ height: 112, marginTop: i ? 12 : 0, borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }} />
              ))}
            </>
          ) : feed.held ? (
            <TeenHoldNote />
          ) : feed.error ? (
            <div style={{ padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
              <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Couldn’t load your mailbox.</p>
              <button type="button" onClick={retry}
                style={{ marginTop: 10, minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, font: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" }}>
                Try again
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "24px 20px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 18, textAlign: "center" }}>
              <MailboxIcon size={40} strokeWidth={1.6} color={BLUE} aria-hidden="true" focusable="false" style={{ display: "block", margin: "0 auto" }} />
              <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>
                An empty mailbox, <em style={{ fontStyle: "italic", color: BLUE }}>for now</em>
              </p>
              <p style={{ margin: "6px auto 0", maxWidth: "34ch", fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
                Follow a friend by their @username and their new stamps land here: where they went, when, and whether it’s verified.
              </p>
              <InviteButton style={{ marginTop: 16 }} />
            </div>
          ) : (
            <>
              {rows.some(isNew) ? (
                <>
                  <h2 style={KICKER}>From someone new</h2>
                  <p style={{ margin: "4px 0 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink3 }}>Postcards and telegrams from people you don’t follow. The ••• reports or blocks the sender.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8, marginBottom: 20 }}>
                    {rows.filter(isNew).map((r, i) => card(r, i, true))}
                  </div>
                </>
              ) : null}
              <h2 style={KICKER}>{(() => { const n = rows.filter((r) => r.type === "telegram" && !r.received_at).length; return n ? `From your circle · ${n} sealed ${n === 1 ? "telegram" : "telegrams"}` : "From your circle · newest first"; })()}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                {rows.filter((r) => !isNew(r)).map((r, i) => card(r, i, false))}
              </div>
            </>
          )}
        </section>

        <CircleRow circle={circle} style={{ marginTop: 16 }} />
      </div>

      {traveler ? (
        <TravelerSheet person={traveler.person} report={traveler.report}
          postcard={traveler.pc ? { what: traveler.pc.kind, onReply: traveler.pc.reply ? () => (traveler.pc.kind === "telegram" ? wireBack(traveler.pc) : replyFor(traveler.pc)) : undefined, onDelete: () => removeCard(traveler.pc) } : null}
          onClose={() => setTraveler(null)} onChanged={() => { setTraveler(null); circle.retry(); load(); }} />
      ) : null}
      <PostcardCompose open={compose} onClose={() => setCompose(false)} onSent={load}
        following={circle.acc || []} followerCount={counts.followYou ?? null} blocked={circle.blocked} />
      {wireTo ? (
        <TelegramCompose open replyTo={wireTo.reply_to ? wireTo : null} onClose={() => setWireTo(null)} onSent={() => { setWireTo(null); load(); }}
          following={circle.acc || []} blocked={circle.blocked} meName={meName} meHandle={me.handle} />
      ) : null}
      {replyPick ? (
        <ReplyWays name={nameFor(replyPick.by)} onClose={() => setReplyPick(null)}
          onPostcard={() => setReplyTo({ postcard_id: replyPick.id, name: nameFor(replyPick.by) })} onTelegram={() => wireBack(replyPick)} />
      ) : null}
      {replyTo ? (
        <PostcardCompose open replyTo={replyTo} onClose={() => setReplyTo(null)} onSent={() => { setReplyTo(null); load(); }}
          following={circle.acc || []} blocked={circle.blocked} />
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
