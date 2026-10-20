// Postcards: your postcard box (founder, 2026-10-14: "i want to keep the postcards sent to
// me"). Since 2026-10-19 it holds telegrams too: once read, a postcard or telegram leaves the
// Mailbox and lives here until it's deleted. Every postcard addressed to you, and every card sent to everyone that you kept
// from the Mailbox (its Keep pill), drawn like a postcard (PostcardCard) on the Mailbox's
// airmail stock: newest first, 24 at a time, 'Show older' for the rest. A kept card's
// 'Kept' pill lets it go again. Opened from Mailbox, whose tab stays lit.
//
// It shows nothing untrue: nothing social until the age tier is known; the hold or the
// birthday note for a held account; a skeleton while the first page loads; 'Try again'
// when a read fails (never an empty box); a count only once every card is loaded. Cards
// from people you blocked never show. Each card's '•••' opens TravelerSheet (Report,
// Unfollow, Block). On a worker without /postcards/box the page shows the cards the feed
// holds and says the older ones arrive with the update.
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, Mail } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { postcardBox, keepPostcard, deletePostcard, getHandle, getSocialProfile } from "@/lib/passport";
import PostcardCompose from "@/components/passport/PostcardCompose";
import TelegramCompose from "@/components/telegram/TelegramCompose";
import ReplyWays from "@/components/telegram/ReplyWays";
import { showToast } from "@/components/Toast";
import { workerMessage } from "@/components/social/FollowByHandle";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { whenLabel } from "@/components/social/Envelope";
import PostcardCard from "@/components/social/PostcardCard";
import TelegramCard from "@/components/telegram/TelegramCard";
import { deleteTelegram } from "@/lib/telegram";
import TravelerSheet from "@/components/social/TravelerSheet";
import ConfirmBirthdayNote from "@/components/social/ConfirmBirthdayNote";
import TeenHoldNote from "@/components/social/TeenHoldNote";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const BLUE = NEUTRAL.airmailBlue;

const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const clip = (t, n) => { const v = String(t || "").replace(/\s+/g, " ").trim(); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };

/** @type {import('react').CSSProperties} */
const KICKER = { margin: 0, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.2, textTransform: "uppercase", color: BLUE };
/** @type {import('react').CSSProperties} */
const OUTLINE = { minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, font: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" };

function useBack() {
  const navigate = useNavigate();
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate(createPageUrl("Mailbox"));
  };
}

// The Mailbox masthead's sibling: the stamp-red kicker, the serif line, the full-bleed chevron.
function Masthead({ onBack }) {
  return (
    <>
      <div aria-hidden="true" style={{ height: 12 }} />
      <header className={COLUMN} style={{ paddingTop: 4, paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" onClick={onBack} aria-label="Back to Mailbox"
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "0 0 0 -12px", padding: 0, borderRadius: 999, background: "transparent", border: 0, color: BLUE, cursor: "pointer" }}>
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
          <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".2em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.stamp }}>Globeskimmers · Postcard box</div>
        </div>
        <h1 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 1.04, color: NEUTRAL.ink }}>
          Postcards & telegrams <em style={{ fontStyle: "italic", color: BLUE }}>sent to you</em>
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>Once you’ve read them, they move here from your Mailbox and stay until you delete them. So do the postcards you keep.</p>
      </header>
      <AirmailChevron height={5} />
    </>
  );
}

function PostcardBox({ onBack }) {
  const { profile } = useAuth();
  const circle = useCircle();
  const [box, setBox] = useState(null);           // { rows, next, held, error, partial } once read
  const [older, setOlder] = useState("idle");     // reading an older page: 'idle' | 'busy' | 'failed'
  const [me, setMe] = useState({ handle: null, name: null });
  const [traveler, setTraveler] = useState(null); // { person, report } in the TravelerSheet
  const live = useRef(0);
  // ?pc=<id> (a tapped alert, 2026-10-19): that card scrolls into view, ringed.
  const params = new URLSearchParams(useLocation().search);
  const wanted = params.get("pc") || params.get("tg");
  useEffect(() => {
    if (!wanted) return undefined;
    const t = setTimeout(() => { document.getElementById(`pc-${wanted}`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }, 300);
    return () => clearTimeout(t);
  }, [wanted, box]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let gone = false;
    getHandle().then((h) => { if (!gone) setMe((m) => ({ ...m, handle: h.handle || null })); });
    getSocialProfile().then((sp) => { if (!gone) setMe((m) => ({ ...m, name: sp.profile?.display_name || null })); });
    return () => { gone = true; };
  }, []);

  const load = async () => {
    const n = ++live.current;
    const r = await postcardBox();
    if (n !== live.current) return;
    setBox(r);
    setOlder("idle");
  };
  useEffect(() => { load(); }, []);
  const retry = () => { setBox(null); load(); };

  const readOlder = async () => {
    if (older === "busy" || !box?.next) return;
    const n = live.current;
    setOlder("busy");
    const r = await postcardBox(box.next);
    if (n !== live.current) return;
    if (r.error || r.held) { setOlder("failed"); return; }
    setOlder("idle");
    setBox((b) => {
      const seen = new Set((b.rows || []).map((x) => x.id));
      return { ...b, rows: [...(b.rows || []), ...(r.rows || []).filter((x) => !seen.has(x.id))], next: r.next };
    });
  };

  // A kept card's 'Kept' pill lets it go: it leaves the box at once and comes back when the
  // worker says no.
  const letGo = async (row) => {
    if (!row?.id) return;
    const snapshot = box;
    setBox((b) => ({ ...b, rows: (b.rows || []).filter((x) => x.id !== row.id) }));
    const res = await keepPostcard(row.id, false);
    if (!res.ok) { setBox(snapshot); showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error"); return; }
    showToast("Removed from your postcard box", "success");
  };

  // Reply and Delete on a card addressed to me (2026-10-19).
  const [replyTo, setReplyTo] = useState(null);
  // Reply asks which way (2026-10-19): a postcard back, or a telegram back (four words, no photo).
  const [replyPick, setReplyPick] = useState(null);
  const [wireTo, setWireTo] = useState(null);
  const nameFor = (by) => by?.name || (by?.handle ? `@${by.handle}` : null);
  const replyFor = (row) => setReplyPick(row);
  const removeCard = async (row) => {
    const tg = row.kind === "telegram";
    const r = tg ? await deleteTelegram(row.id) : await deletePostcard(row.id);
    if (!r.ok) { showToast(workerMessage(r.error, "Couldn’t delete it. Try again."), "error"); return false; }
    setBox((b) => ({ ...b, rows: (b.rows || []).filter((x) => x.id !== row.id) }));
    showToast(tg ? "Telegram deleted" : "Postcard deleted", "success");
    return true;
  };
  const wireBack = (row) => setWireTo({ reply_to: row.id, name: row.by?.name || null, handle: row.by?.handle || null, group: Array.isArray(row.group) ? row.group : null });
  const blocked = circle.blockedHandles || new Set();
  const rows = box && !box.error && !box.held ? (box.rows || []).filter((r) => !blocked.has(lc(r?.by?.handle))) : [];
  const meName = me.name || profile?.first_name || null;
  const report = (row) => (row.type === "telegram" ? setTraveler({
    pc: row.id ? { id: row.id, by: row.by, kind: "telegram" } : null,
    person: { ...(row.by || {}) },
    report: { kind: "telegram", ref: `tg:${row.id}`, note: clip(`Postcard box, telegram, ${whenLabel(row.created_at)}: "${row.body || ""}"`, 480) },
  }) : setTraveler({
    // A postcard sent to me also gets Delete in the sheet (2026-10-19); Reply is on the card.
    pc: row.to_me === true && row.id ? { id: row.id, by: row.by } : null,
    person: { ...(row.by || {}), postcard_id: row.id || null },
    report: { kind: "postcard", ...(row.id ? { ref: `pc:${row.id}` } : {}), note: clip(`Postcard box${row.place ? `, from ${row.place}` : ""}, ${whenLabel(row.created_at)}${row.message ? `: "${row.message}"` : ""}`, 480) },
  }));

  let body;
  if (!box) {
    body = (
      <>
        <span className="sr-only" role="status">Opening your postcard box</span>
        {[0, 1].map((i) => (
          <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none"
            style={{ height: 300, marginTop: i ? 16 : 0, borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }} />
        ))}
      </>
    );
  } else if (box.held) {
    body = box.held === "confirm" ? <ConfirmBirthdayNote /> : box.held === "teen" ? <TeenHoldNote /> : null;
  } else if (box.error) {
    body = (
      <div style={{ padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
        <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Couldn’t open your postcard box.</p>
        <button type="button" onClick={retry} style={{ ...OUTLINE, marginTop: 10 }}>Try again</button>
      </div>
    );
  } else if (!rows.length && !box.next) {
    body = (
      <div style={{ padding: "24px 20px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 18, textAlign: "center" }}>
        <Mail size={36} strokeWidth={1.6} color={BLUE} aria-hidden="true" focusable="false" style={{ display: "block", margin: "0 auto" }} />
        <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>
          Nothing here <em style={{ fontStyle: "italic", color: BLUE }}>yet</em>
        </p>
        <p style={{ margin: "6px auto 0", maxWidth: "34ch", fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
          Once you’ve read a postcard or a telegram sent to you, it moves here from your Mailbox and stays until you delete it. Tap Keep on any other postcard there to add it too.
        </p>
      </div>
    );
  } else {
    const all = !box.next && !box.partial;
    body = (
      <>
        <h2 style={KICKER}>
          {box.partial ? "Your newest postcards" : all ? `Newest first · ${countLine(rows)}` : "Newest first"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16, marginTop: 8, alignItems: "start" }}>
          {rows.map((r, i) => (
            <div key={r.id || `pc-${r.created_at}-${i}`} id={r.id ? `pc-${r.id}` : undefined} style={wanted && r.id === wanted ? { outline: "3px solid #0E7C73", outlineOffset: 4, borderRadius: 16 } : undefined}>
              {r.type === "telegram"
                ? <TelegramCard row={r} me={me.handle} meName={meName} onReply={wireBack} onReport={report} />
                : <PostcardCard row={r} me={me.handle} meName={meName} onReport={report} onKeep={letGo} onReply={replyFor} />}
            </div>
          ))}
        </div>
        {box.partial ? (
          <p style={{ margin: "14px 0 0", fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
            Older postcards appear here with the next app update. None of them are lost.
          </p>
        ) : null}
        {box.next ? (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button type="button" onClick={readOlder} aria-busy={older === "busy" || undefined} aria-disabled={older === "busy" || undefined}
              style={{ ...OUTLINE, background: NEUTRAL.white, cursor: older === "busy" ? "progress" : "pointer" }}>
              {older === "busy" ? "One moment…" : "Show older postcards"}
            </button>
            {older === "failed" ? (
              <p role="status" style={{ margin: "8px 0 0", fontSize: fs(12.5), color: NEUTRAL.ink2 }}>Couldn’t load older postcards. Try again.</p>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <Masthead onBack={onBack} />
      <div className={COLUMN}>
        <section aria-label="Your postcards" style={{ marginTop: 20 }}>{body}</section>
      </div>
      {replyPick ? (
        <ReplyWays name={nameFor(replyPick.by)} onClose={() => setReplyPick(null)}
          onPostcard={() => setReplyTo({ postcard_id: replyPick.id, name: nameFor(replyPick.by) })}
          onTelegram={() => setWireTo({ reply_to: replyPick.id, name: replyPick.by?.name || null, handle: replyPick.by?.handle || null })} />
      ) : null}
      {replyTo ? (
        <PostcardCompose open replyTo={replyTo} onClose={() => setReplyTo(null)} onSent={() => setReplyTo(null)}
          following={circle.acc || []} blocked={circle.blocked} />
      ) : null}
      {wireTo ? (
        <TelegramCompose open replyTo={wireTo} onClose={() => setWireTo(null)} onSent={() => setWireTo(null)}
          following={circle.acc || []} blocked={circle.blocked} meName={meName} meHandle={me.handle} />
      ) : null}
      {traveler ? (
        <TravelerSheet person={traveler.person} report={traveler.report}
          postcard={traveler.pc ? { what: traveler.pc.kind, onDelete: () => removeCard(traveler.pc) } : null}
          onClose={() => setTraveler(null)} onChanged={() => { setTraveler(null); circle.retry(); retry(); }} />
      ) : null}
    </div>
  );
}

// "3 postcards · 2 telegrams" for the box's heading.
const countLine = (rows) => {
  const t = rows.filter((r) => r.type === "telegram").length;
  const p = rows.length - t;
  return [p ? `${p} ${p === 1 ? "postcard" : "postcards"}` : null, t ? `${t} ${t === 1 ? "telegram" : "telegrams"}` : null].filter(Boolean).join(" · ") || "0 postcards";
};

export default function PostcardsPage() {
  const { socialTier, socialTierReady } = useAuth();
  const onBack = useBack();
  // Nothing social until the age tier is known; a held account keeps the masthead with its
  // note, and the box isn't read for it.
  if (!socialTierReady || socialTier === "blocked") return <Masthead onBack={onBack} />;
  if (socialTier === "confirm" || socialTier === "teen") {
    return (
      <div>
        <Masthead onBack={onBack} />
        <div className={COLUMN}><div style={{ marginTop: 16 }}>{socialTier === "confirm" ? <ConfirmBirthdayNote /> : <TeenHoldNote />}</div></div>
      </div>
    );
  }
  return <PostcardBox onBack={onBack} />;
}
