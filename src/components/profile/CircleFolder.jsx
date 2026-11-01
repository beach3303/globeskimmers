// CircleFolder: YOUR CIRCLE on your own profile (navigation redesign, 2026-10-31: "Friends ·
// You follow · Follow you, each a button with its count on top … Friends' news … shown on Profile
// as a preview card … and + Add friends"). The airmail folder holds 'Friends & *followers*' with
// 'See all', three count buttons (the circle's own figures from useCircle(), shown only once
// loaded; a zero shows the name alone, never a bare 0; the word is "Friends", never "Inner
// circle"), the Friends' news card ("FRIENDS' NEWS · N NEW", See all › to the page, the newest
// two lines, a follow request answerable in place), and + Add friends.
//
//   <CircleFolder owner cloth teenNote className style />
//   owner, cloth   accepted for the page's sake; the folder's paper comes from its stock.
//   teenNote  a 13-17 account sees TeenHoldNote in the folder's place (true by default;
//             the page turns it off while its edit mode already shows the note).
//
// Honest states, never a guess: nothing until the age tier is known (no social UI flashes
// before the hold applies); while the circle loads, three quiet tiles and a spoken status;
// when the read fails, 'Couldn't load your friends and followers' with 'Try again'. Blocked
// people are in no list. The news card reads the activity without marking it seen (the dot
// clears when the Friends' news page opens), so a glance at the Profile never hides news.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, UserPlus } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { socialUnread } from "@/lib/passport";
import { foldBoards, newsDestination, passportNewsOf } from "@/lib/newsLinks";
import { Folder } from "@/components/redesign/Zone";
import { Face } from "@/components/social/SocialMarks";
import Requests from "@/components/social/Requests";
import ActivityList from "@/components/social/ActivityList";
import AddFriendsSheet from "@/components/social/AddFriendsSheet";
import InviteButton from "@/components/passport/InviteButton";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import { showToast } from "@/components/Toast";
import { workerMessage } from "@/components/social/FollowByHandle";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BLUE = NEUTRAL.airmailBlue;
/** @type {import('react').CSSProperties} */
const KICKER = { margin: 0, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.2, textTransform: "uppercase", color: BLUE };
const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();

function Title({ pre, italic, post = "" }) {
  return (
    <h3 style={{ margin: 0, minWidth: 0, fontFamily: SERIF, fontSize: fs(22), lineHeight: 28 / 22, fontWeight: 400, overflowWrap: "anywhere", color: NEUTRAL.ink }}>
      {pre}<em style={{ fontStyle: "italic", color: BLUE }}>{italic}</em>{post}
    </h3>
  );
}

// One of the three: a few faces, the count on top (only when there is one), the name.
function CountButton({ label, n, people, onClick, ready }) {
  const faces = (people || []).slice(0, 3);
  return (
    <button type="button" onClick={ready ? onClick : undefined} aria-disabled={!ready || undefined}
      aria-label={ready ? `${label}${n ? `: ${n}` : ""}. See the list` : `${label}, loading`}
      style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-end", gap: 3, minHeight: 86, padding: "10px 10px 9px", borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, font: "inherit", textAlign: "left", cursor: ready ? "pointer" : "default" }}>
      <span aria-hidden="true" style={{ display: "flex", minHeight: 22, marginBottom: "auto" }}>
        {faces.map((p, i) => (
          <Face key={String(p.user_id ?? p.handle ?? i)} name={p.name} handle={p.handle} avatar={p.avatar} cloth={p.cloth} size={22} style={{ marginLeft: i ? -6 : 0 }} />
        ))}
      </span>
      {ready && n ? <span aria-hidden="true" style={{ fontFamily: SERIF, fontSize: fs(26), lineHeight: 1, color: NEUTRAL.ink }}>{n}</span> : null}
      {/* The name wraps at the largest text sizes (the tiles are a third of the column). */}
      <span aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: 1, fontFamily: MONO, fontSize: fs(9.5), fontWeight: 600, letterSpacing: ".1em", lineHeight: 1.25, textTransform: "uppercase", color: NEUTRAL.ink2, overflowWrap: "anywhere" }}>
        <span style={{ minWidth: 0 }}>{label}</span>{ready ? <ChevronRight size={13} strokeWidth={2.2} color={BLUE} aria-hidden="true" focusable="false" style={{ flex: "none", marginBottom: 1 }} /> : null}
      </span>
    </button>
  );
}

// The Friends' news card: the newest two lines, a request answerable here, See all › to the page.
function NewsCard({ circle, requests }) {
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);   // null until read; [] when nothing
  useEffect(() => {
    let gone = false;
    socialUnread({ activity: true }).then((r) => { if (!gone) setActivity(r.error ? [] : foldBoards(r.activity || [])); });
    return () => { gone = true; };
  }, []);
  const news = passportNewsOf(activity);
  const fresh = news.filter((a) => a.unread).length + requests.length;
  const request = requests[0] || null;
  const lines = news.slice(0, request ? 1 : 2);
  const answer = (op) => async (row) => {
    const res = op === "accept" ? await circle.accept(row) : await circle.decline(row);
    if (!res.ok) showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error");
    else if (op === "accept") showToast(row?.handle ? `@${lc(row.handle)} follows you now` : "They follow you now", "success");
    return res;
  };
  const seeAll = () => navigate(createPageUrl("FriendsNews"));
  return (
    <section aria-label="Friends’ news" style={{ marginTop: 12, padding: "10px 12px 12px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h4 style={KICKER}>Friends’ news{fresh ? ` · ${fresh} new` : ""}</h4>
        <button type="button" onClick={seeAll}
          style={{ display: "inline-flex", alignItems: "center", gap: 2, minHeight: 36, margin: "-8px -6px -8px 0", padding: "0 6px", background: "transparent", border: 0, font: "inherit", fontSize: fs(13), fontWeight: 600, color: BLUE, cursor: "pointer" }}>
          See all<ChevronRight size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
        </button>
      </div>
      {request ? (
        <Requests rows={[request]} title="Wants to follow you" headingAs="h5" onAccept={answer("accept")} onDecline={answer("decline")} style={{ marginTop: 8 }} />
      ) : null}
      {lines.length ? (
        <ActivityList items={lines} limit={lines.length} heading={false} style={{ marginTop: request ? 8 : 6 }}
          onOpen={(to, a) => navigate(newsDestination(to, a))} />
      ) : null}
      {activity === null && !request ? <span className="sr-only" role="status">Loading your news</span> : null}
      {activity !== null && !request && !lines.length ? (
        <p style={{ margin: "6px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Nothing new, <em style={{ fontStyle: "italic", color: BLUE }}>for now</em>. Follow requests, news about your passport and your friends’ new stamps land here.</p>
      ) : null}
    </section>
  );
}

function CircleBody({ className, style }) {
  const navigate = useNavigate();
  const circle = useCircle();
  const ready = circle.status === "ready";
  const counts = ready && circle.counts ? circle.counts : {};
  const requests = ready && Array.isArray(circle.requests) ? circle.requests : [];
  const anyone = !!(counts.inner || counts.youFollow || counts.followYou);
  const empty = ready && !anyone && !requests.length;
  const [adding, setAdding] = useState(false);
  const openCircle = (tab) => () => navigate(`${createPageUrl("Circle")}${tab ? `?tab=${tab}` : ""}`);

  return (
    <Folder stock="circle" size="profile" tab="Friends & followers" className={className} style={style}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 8, minHeight: 28 }}>
        {empty ? <Title pre="Friends start with " italic="one" /> : <Title pre="Friends & " italic="followers" />}
        {ready && !empty ? (
          <button type="button" onClick={openCircle(null)}
            style={{ display: "inline-flex", alignItems: "center", gap: 2, minHeight: 44, margin: "-8px -6px -8px 0", padding: "0 6px", background: "transparent", border: 0, fontFamily: "inherit", fontSize: fs(13), fontWeight: 600, color: BLUE, cursor: "pointer" }}>
            See all
            <ChevronRight size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        ) : null}
      </div>

      {circle.status === "error" ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: fs(14), lineHeight: 20 / 14, color: NEUTRAL.ink2 }}>Couldn’t load your friends and followers.</p>
          <button type="button" onClick={() => circle.retry()}
            style={{ marginTop: 10, minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, fontFamily: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* The three buttons, each with its count on top. The orbit art of 2026-10 gave way to them. */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <CountButton label="Friends" n={counts.inner} people={circle.mutual} onClick={openCircle("inner")} ready={ready} />
            <CountButton label="You follow" n={counts.youFollow} people={circle.followingOnly} onClick={openCircle("following")} ready={ready} />
            <CountButton label="Follow you" n={counts.followYou} people={circle.followersOnly} onClick={openCircle("followers")} ready={ready} />
          </div>
          {!ready ? <span className="sr-only" role="status">Loading your friends and followers</span> : null}
          <NewsCard circle={circle} requests={requests} />
          <button type="button" onClick={() => setAdding(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 46, marginTop: 12, borderRadius: 999, border: 0, background: BLUE, color: NEUTRAL.white, font: "inherit", fontSize: fs(14.5), fontWeight: 650, cursor: "pointer" }}>
            <UserPlus size={17} strokeWidth={2} aria-hidden="true" focusable="false" /> Add friends
          </button>
          {empty ? <InviteButton label="Invite someone by text" style={{ marginTop: 10 }} /> : null}
          {adding ? <AddFriendsSheet onClose={() => setAdding(false)} onFollowed={() => circle.retry()} /> : null}
        </>
      )}
    </Folder>
  );
}

/**
 * @param {{ owner?: any, cloth?: any, teenNote?: boolean, className?: string, style?: import('react').CSSProperties }} props
 */
export default function CircleFolder({ owner = null, cloth = undefined, teenNote = true, className = undefined, style = undefined }) {
  const { socialTier, socialTierReady } = useAuth();
  if (!socialTierReady) return null;
  if (socialTier === "teen") {
    return teenNote ? <div className={className} style={style}><TeenHoldNote /></div> : null;
  }
  // Under 13 the app is frozen; 'confirm' is the birthday check: no circle to show.
  if (socialTier === "blocked" || socialTier === "confirm") return null;
  return <CircleBody className={className} style={style} />;
}
