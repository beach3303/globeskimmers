// CityBoard: a city's board (founder, 2026-10-03: "i love the city board"; built
// 2026-10-14). Postcards addressed to a city by travelers who were really there (the
// worker requires a verified stamp of theirs in that city), drawn like the Mailbox
// postcards on airmail stock: newest first, 24 at a time, 'Show older' for the rest.
// /CityBoard?city=Lisbon&country=Portugal, opened from Home's 'Postcards from Lisbon'.
//
// 'Post to this board' shows only when the worker says you can (can_post: an adult with a
// verified stamp there); otherwise one line says how to earn it. It shows nothing untrue:
// nothing social until the age tier is known; the hold or birthday note for a held
// account; a skeleton while the first page loads; 'Try again' when a read fails; an empty
// board only when the read worked; and before the worker has boards, a line saying the
// board opens with the next update. Each card's '•••' opens TravelerSheet (Report,
// Unfollow, Block); cards from people you blocked never show.
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, Mail, Stamp } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { cityBoard, getHandle, getSocialProfile } from "@/lib/passport";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { whenLabel } from "@/components/social/Envelope";
import PostcardCard from "@/components/social/PostcardCard";
import PostcardCompose from "@/components/passport/PostcardCompose";
import TravelerSheet from "@/components/social/TravelerSheet";
import ConfirmBirthdayNote from "@/components/social/ConfirmBirthdayNote";
import TeenHoldNote from "@/components/social/TeenHoldNote";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const BLUE = NEUTRAL.airmailBlue;

const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const clip = (t, n) => { const v = String(t || "").replace(/\s+/g, " ").trim(); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };
const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/** @type {import('react').CSSProperties} */
const KICKER = { margin: 0, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.2, textTransform: "uppercase", color: BLUE };
/** @type {import('react').CSSProperties} */
const OUTLINE = { minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, font: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" };

function useBack() {
  const navigate = useNavigate();
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate(createPageUrl("Home"));
  };
}

// The Mailbox masthead's sibling, with 'Post to this board' where Mailbox has 'Postcard'.
function Masthead({ city, onBack, onPost = undefined }) {
  return (
    <>
      <div aria-hidden="true" style={{ height: 12 }} />
      <header className={COLUMN} style={{ paddingTop: 4, paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" onClick={onBack} aria-label="Back"
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "0 0 0 -12px", padding: 0, borderRadius: 999, background: "transparent", border: 0, color: BLUE, cursor: "pointer" }}>
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
          <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".2em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.stamp }}>Globeskimmers · City board</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 2 }}>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 1.04, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>
              Postcards from <em style={{ fontStyle: "italic", color: BLUE }}>{city || "this city"}</em>
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>From travelers who were really there.</p>
          </div>
          {onPost ? (
            <button type="button" onClick={onPost}
              style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 16px", borderRadius: 999, border: 0, background: NEUTRAL.stamp, font: "inherit", fontSize: fs(13), fontWeight: 600, color: NEUTRAL.white, cursor: "pointer" }}>
              <Mail size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
              Post to this board
            </button>
          ) : null}
        </div>
      </header>
      <AirmailChevron height={5} />
    </>
  );
}

function Board({ city, country, onBack }) {
  const { profile } = useAuth();
  const circle = useCircle();
  const [board, setBoard] = useState(null);       // { rows, next, can_post, held, unavailable, error } once read
  const [older, setOlder] = useState("idle");     // 'idle' | 'busy' | 'failed'
  const [me, setMe] = useState({ handle: null, name: null });
  const [traveler, setTraveler] = useState(null);
  const [compose, setCompose] = useState(false);
  const live = useRef(0);

  useEffect(() => {
    let gone = false;
    getHandle().then((h) => { if (!gone) setMe((m) => ({ ...m, handle: h.handle || null })); });
    getSocialProfile().then((sp) => { if (!gone) setMe((m) => ({ ...m, name: sp.profile?.display_name || null })); });
    return () => { gone = true; };
  }, []);

  const load = async () => {
    const n = ++live.current;
    const r = await cityBoard({ city, country });
    if (n !== live.current) return;
    setBoard(r);
    setOlder("idle");
  };
  useEffect(() => { load(); }, [city, country]);
  const retry = () => { setBoard(null); load(); };

  const readOlder = async () => {
    if (older === "busy" || !board?.next) return;
    const n = live.current;
    setOlder("busy");
    const r = await cityBoard({ city, country, before: board.next });
    if (n !== live.current) return;
    if (r.error || r.held || r.unavailable) { setOlder("failed"); return; }
    setOlder("idle");
    setBoard((b) => {
      const seen = new Set((b.rows || []).map((x) => x.id));
      return { ...b, rows: [...(b.rows || []), ...(r.rows || []).filter((x) => !seen.has(x.id))], next: r.next };
    });
  };

  const blocked = circle.blockedHandles || new Set();
  const rows = board && !board.error && !board.held && !board.unavailable ? (board.rows || []).filter((r) => !blocked.has(lc(r?.by?.handle))) : [];
  const canPost = !!board && board.can_post === true && !board.held && !board.unavailable;
  const report = (row) => setTraveler({
    person: { ...(row.by || {}), postcard_id: row.id || null },
    report: { kind: "postcard", ...(row.id ? { ref: `pc:${row.id}` } : {}), note: clip(`City board ${city}${row.place ? `, ${row.place}` : ""}, ${whenLabel(row.created_at)}${row.message ? `: "${row.message}"` : ""}`, 480) },
  });

  let body;
  if (!board) {
    body = (
      <>
        <span className="sr-only" role="status">{`Opening ${city}’s board`}</span>
        {[0, 1].map((i) => (
          <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none"
            style={{ height: 300, marginTop: i ? 16 : 0, borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }} />
        ))}
      </>
    );
  } else if (board.held) {
    body = board.held === "confirm" ? <ConfirmBirthdayNote /> : <TeenHoldNote />;
  } else if (board.unavailable) {
    body = (
      <div style={{ padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
        <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>{city}’s board opens with the next app update.</p>
      </div>
    );
  } else if (board.error) {
    body = (
      <div style={{ padding: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
        <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Couldn’t open {city}’s board.</p>
        <button type="button" onClick={retry} style={{ ...OUTLINE, marginTop: 10 }}>Try again</button>
      </div>
    );
  } else if (!rows.length && !board.next) {
    body = (
      <div style={{ padding: "24px 20px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 18, textAlign: "center" }}>
        <Mail size={36} strokeWidth={1.6} color={BLUE} aria-hidden="true" focusable="false" style={{ display: "block", margin: "0 auto" }} />
        <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>
          No postcards from {city} <em style={{ fontStyle: "italic", color: BLUE }}>yet</em>
        </p>
        <p style={{ margin: "6px auto 0", maxWidth: "34ch", fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
          {canPost ? "You were here, so the first one can be yours." : `Travelers who stamp ${city}, verified, can post here.`}
        </p>
      </div>
    );
  } else {
    body = (
      <>
        <h2 style={KICKER}>Newest first</h2>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16, marginTop: 8, alignItems: "start" }}>
          {rows.map((r, i) => (
            <PostcardCard key={r.id || `bc-${r.created_at}-${i}`} row={r} me={me.handle} meName={me.name || profile?.first_name || null} onReport={report} />
          ))}
        </div>
        {board.next ? (
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
      <Masthead city={city} onBack={onBack} onPost={canPost ? () => setCompose(true) : undefined} />
      <div className={COLUMN}>
        {board && !board.held && !board.unavailable && !board.error && !canPost ? (
          <p style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "16px 0 0", fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
            <Stamp size={15} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Stamp {city} with GPS or a photo taken there, and you can post here too.</span>
          </p>
        ) : null}
        <section aria-label={`Postcards from ${city}`} style={{ marginTop: 16 }}>{body}</section>
      </div>
      {traveler ? (
        <TravelerSheet person={traveler.person} report={traveler.report}
          onClose={() => setTraveler(null)} onChanged={() => { setTraveler(null); circle.retry(); retry(); }} />
      ) : null}
      <PostcardCompose open={compose} onClose={() => setCompose(false)} onSent={() => { setCompose(false); retry(); }}
        toCity={{ city, country }} blocked={circle.blocked} />
    </div>
  );
}

export default function CityBoardPage() {
  const { socialTier, socialTierReady } = useAuth();
  const location = useLocation();
  const onBack = useBack();
  const params = new URLSearchParams(location.search);
  const city = clean(params.get("city"));
  const country = clean(params.get("country"));
  // Nothing social until the age tier is known; a held account keeps the masthead with its
  // note, and the board isn't read for it.
  if (!socialTierReady || socialTier === "blocked") return <Masthead city={city} onBack={onBack} />;
  if (socialTier === "confirm" || socialTier === "teen") {
    return (
      <div>
        <Masthead city={city} onBack={onBack} />
        <div className={COLUMN}><div style={{ marginTop: 16 }}>{socialTier === "confirm" ? <ConfirmBirthdayNote /> : <TeenHoldNote />}</div></div>
      </div>
    );
  }
  if (!city || !country) {
    return (
      <div>
        <Masthead city={city} onBack={onBack} />
        <div className={COLUMN}>
          <p style={{ margin: "16px 0 0", fontSize: fs(14), color: NEUTRAL.ink2 }}>This board needs a city. Open it from Home.</p>
        </div>
      </div>
    );
  }
  return <Board city={city} country={country} onBack={onBack} />;
}
