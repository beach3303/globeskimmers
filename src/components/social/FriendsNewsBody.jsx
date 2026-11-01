// FriendsNewsBody — Friends' news (navigation redesign, 2026-10-31, step 6): the Mailbox's old News
// tab, now on its own page under the Profile's YOUR CIRCLE (src/pages/FriendsNews.jsx). In order:
// follow requests first (Allow / Not now), then "On your passport" (reactions, signatures, tags —
// each line opens that page of the book), then where your friends have been (FriendsTravels), what
// they added (cards, album photos, board items → deep links), New arrivals with Follow, and
// + Add friends. It grew out of Home's Arrivals page (2026-10-25: "i like … being able to see who my
// friend circles are"); the counts moved to YOUR CIRCLE's buttons on the Profile.
//
// Opening it marks the news seen (socialUnread mark:true → gs:unread clears the bar's Profile dot);
// mail stays unread until the Mailbox shows it. Nothing social shows until the age tier is known, and
// nothing for a held account; nothing is ever a guessed 0. Every person here has a door to
// TravelerSheet (Report, Unfollow, Block) through the '•••' beside their row.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import FriendsTravels from "@/components/home/FriendsTravels";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import AddFriendsSheet from "@/components/social/AddFriendsSheet";
import Requests from "@/components/social/Requests";
import ActivityList from "@/components/social/ActivityList";
import TravelerSheet from "@/components/social/TravelerSheet";
import UnfollowConfirm from "@/components/social/UnfollowConfirm";
import { newArrivals } from "@/lib/newArrivals";
import { friendsAdded, socialUnread } from "@/lib/passport";
import { artFor } from "@/lib/cityCards";
import { cityBoardUrl } from "@/lib/boardLinks";
import { foldBoards, newsDestination, passportNewsOf } from "@/lib/newsLinks";
import { whenLabel } from "@/components/social/Envelope";
import { showToast } from "@/components/Toast";
import { workerMessage } from "@/components/social/FollowByHandle";
import { askForAlerts } from "@/lib/pushAlerts";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BLUE = NEUTRAL.airmailBlue;
const HELD = new Set(["teen", "blocked", "confirm"]);
const GAP = 18;
/** @type {import('react').CSSProperties} */
const KICKER = { margin: 0, fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.2, textTransform: "uppercase", color: BLUE };
const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const clip = (t, n) => { const v = String(t || "").replace(/\s+/g, " ").trim(); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };
const whoOf = (by) => String(by?.name ?? "").trim() || (by?.handle ? `@${lc(by.handle)}` : "A traveler");
// What a report from a news line is about (the report queue's kinds).
const ACTIVITY_KIND = { follow_request: "profile", follow: "profile", postcard: "postcard", telegram: "telegram", reaction: "profile", signature: "signature", tag: "tag" };
// "joined from the Philippines" (the same rule as the arrival and border prompts).
const withThe = (name) => (/^(United |Czech Republic|Dominican Republic|Central African Republic)|Islands$|^(Philippines|Netherlands|Bahamas|Maldives|Gambia|Comoros|Seychelles)$/.test(String(name || "")) ? `the ${name}` : name);

// One line per thing a friend added (founder, 2026-10-30), and where it opens: their card at that
// stamp, the photo big on their page, or the board on that photo or clip.
function addedRow(r) {
  const who = r.by?.handle ? `@${r.by.handle}` : (r.by?.name || "A friend");
  const h = r.by?.handle ? `h=${encodeURIComponent(r.by.handle)}` : "";
  if (r.kind === "card") return { art: artFor(r.stamp?.category, r.stamp?.design), text: <><b style={{ fontWeight: 650 }}>{who}</b> stamped {r.stamp?.name} on the {r.card?.city} {r.card?.year} card</>, to: `${createPageUrl("Traveler")}?${h}&card=${r.card?.id}&stamp=${r.stamp?.id}` };
  if (r.kind === "album") return { thumb: r.photo?.url, text: <><b style={{ fontWeight: 650 }}>{who}</b> added a photo to {r.stamp?.name}{r.stamp?.city ? `, ${r.stamp.city}` : ""}</>, to: `${createPageUrl("Traveler")}?${h}&photo=${r.photo?.id}` };
  return { thumb: r.item?.photo, text: <><b style={{ fontWeight: 650 }}>{who}</b> added a {r.item?.video ? "clip" : "photo"} to {r.board_at?.city}’s city board</>, to: `${cityBoardUrl(r.board_at?.city, r.board_at?.country, r.board_at?.region)}&open=bcp:${r.item?.id}` };
}

// A cream sheet with a mono tab on its top-left (the lists below share it).
function Sheet({ tab, tabStyle = undefined, label, children }) {
  return (
    <section aria-label={label} style={{ marginTop: GAP }}>
      <div style={{ display: "flex" }}>
        <span style={{ marginLeft: 12, padding: "5px 12px 4px", borderRadius: "8px 8px 0 0", fontFamily: MONO, fontSize: fs(9.5), fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, borderBottom: 0, color: BLUE, ...tabStyle }}>{tab}</span>
      </div>
      <div style={{ padding: "4px 12px 10px", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 16 }}>{children}</div>
    </section>
  );
}

export default function FriendsNewsBody({ wide = false }) {
  const navigate = useNavigate();
  const { socialTier, socialTierReady } = useAuth();
  const circle = useCircle();
  const held = socialTierReady && HELD.has(String(socialTier || ""));
  const live = socialTierReady && !held;
  const requests = circle.status === "ready" ? circle.requests || [] : [];

  // The news on my passport: read with mark:true, which also clears the Profile dot.
  const [activity, setActivity] = useState(null);   // null until read; [] when nothing
  useEffect(() => {
    if (!live) return undefined;
    let gone = false;
    socialUnread({ mark: true }).then((r) => { if (!gone) setActivity(r.error ? [] : foldBoards(r.activity || [])); });
    return () => { gone = true; };
  }, [live]);
  const news = passportNewsOf(activity);
  const fresh = news.filter((a) => a.unread).length;

  const [adding, setAdding] = useState(false);
  const [arrivals, setArrivals] = useState(null);   // { rows, … } once read
  const [added, setAdded] = useState({});          // user_id -> "Following" | "Requested" | "busy"
  const [confirm, setConfirm] = useState(null);    // { person, mode } — a Following / Requested pill was tapped
  const [undoing, setUndoing] = useState(false);
  const [traveler, setTraveler] = useState(null);  // { person, report } in the TravelerSheet
  useEffect(() => {
    if (!live) return undefined;
    let gone = false;
    newArrivals().then((r) => { if (!gone) setArrivals(r); });
    return () => { gone = true; };
  }, [live]);
  // What the people I follow added lately (founder, 2026-10-30).
  const [finds, setFinds] = useState(null);
  useEffect(() => {
    if (!live) return undefined;
    let gone = false;
    friendsAdded().then((r) => { if (!gone) setFinds(r); });
    return () => { gone = true; };
  }, [live]);

  const openTraveler = (person, report = null) => setTraveler({ person: person || {}, report });
  const answer = (op) => async (row) => {
    const res = op === "accept" ? await circle.accept(row) : await circle.decline(row);
    if (!res.ok) showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error");
    else if (op === "accept") showToast(row?.handle ? `@${lc(row.handle)} follows you now` : "They follow you now", "success");
    return res;
  };
  const addToCircle = async (p) => {
    if (added[p.user_id]) return;
    setAdded((a) => ({ ...a, [p.user_id]: "busy" }));
    const res = await circle.follow({ user_id: p.user_id, handle: p.handle });
    if (!res.ok) { setAdded((a) => ({ ...a, [p.user_id]: undefined })); showToast(workerMessage(res.error, "Couldn’t follow them. Try again."), "error"); return; }
    const pending = res.data?.status === "pending";
    setAdded((a) => ({ ...a, [p.user_id]: pending ? "Requested" : "Following" }));
    askForAlerts();
    showToast(pending ? `Asked to follow @${p.handle} — they approve first` : `Following @${p.handle}`, "success");
  };
  // Tapping the pill undoes it (founder, 2026-10-30): the request is withdrawn, or the follow ends.
  const undo = async () => {
    if (!confirm || undoing) return;
    const { person: p, mode } = confirm;
    setUndoing(true);
    const res = await circle.unfollow({ user_id: p.user_id, handle: p.handle });
    setUndoing(false);
    if (!res.ok) { showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error"); return; }
    setConfirm(null);
    setAdded((a) => ({ ...a, [p.user_id]: undefined }));
    showToast(mode === "cancel" ? "Request cancelled" : `Unfollowed @${p.handle}`, "success");
  };

  if (!socialTierReady) return null;
  if (held) return <div style={{ marginTop: 16 }}><TeenHoldNote /></div>;
  const arrived = arrivals && !arrivals.off && !arrivals.held ? arrivals.rows : [];
  return (
    <div>
      {requests.length ? (
        <section aria-label="Follow requests">
          <Requests rows={requests} title={requests.length === 1 ? "1 person asked to follow you" : `${requests.length} people asked to follow you`}
            onAccept={answer("accept")} onDecline={answer("decline")}
            onMore={(r) => openTraveler(r, { kind: "profile", note: "Asked to follow me" })} />
        </section>
      ) : null}

      {activity === null ? (
        <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none" style={{ height: 72, marginTop: requests.length ? GAP : 0, borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}` }} />
      ) : news.length ? (
        <section aria-label="On your passport" style={{ marginTop: requests.length ? GAP : 0 }}>
          <h2 style={KICKER}>On your passport{fresh ? ` · ${fresh} new` : ""}</h2>
          <ActivityList items={news} limit={8} heading={false} style={{ marginTop: 6 }}
            onOpen={(to, a) => navigate(newsDestination(to, a))}
            onMore={(a) => openTraveler({ ...a.by, entry_id: a.entry_id || null }, { kind: ACTIVITY_KIND[a.type] || "profile", note: clip(`Friends’ news, ${whenLabel(a.at)}: ${whoOf(a.by)} (${a.type})`, 480) })} />
        </section>
      ) : null}
      {activity === null ? <span className="sr-only" role="status">Loading your news</span> : null}

      <section aria-label="Where your friends have been" style={{ marginTop: requests.length || activity === null || news.length ? GAP : 0 }}>
        <h2 style={KICKER}>Where your friends have been</h2>
        <div style={{ marginTop: 2 }}><FriendsTravels wide={wide} /></div>
      </section>

      {finds && finds.rows.length ? (
        <Sheet tab="What your friends added" label="What your friends added">
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {finds.rows.slice(0, 12).map((r) => {
              const { thumb, art, text, to } = addedRow(r);
              return (
                <li key={`${r.kind}-${r.at}-${r.by?.user_id}`} style={{ borderBottom: `1px solid ${NEUTRAL.rule}` }}>
                  <button type="button" onClick={() => navigate(to)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 56, padding: "6px 0", border: 0, background: "transparent", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}>
                    <span aria-hidden="true" style={{ flex: "none", width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: NEUTRAL.airmailHair, display: "grid", placeItems: "center" }}>
                      {thumb ? <img src={thumb} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : art ? <img src={art} alt="" style={{ width: 34, height: 34, objectFit: "contain", mixBlendMode: "multiply" }} /> : null}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: fs(14), lineHeight: 1.3, color: NEUTRAL.ink }}>{text}</span>
                      <span style={{ display: "block", marginTop: 2, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".04em", color: NEUTRAL.ink3 }}>{whenLabel(r.at)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p style={{ margin: "8px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Only what they chose to share with you. Tap one to see it.</p>
        </Sheet>
      ) : null}

      {arrived.length ? (
        <Sheet tab="New arrivals" label="New arrivals" tabStyle={{ background: `linear-gradient(180deg, #3D62AD, ${BLUE})`, border: 0, color: "#FBF6EC", letterSpacing: ".18em" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {arrived.map((p) => {
              const state = added[p.user_id];
              return (
                <li key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, borderBottom: `1px solid ${NEUTRAL.rule}` }}>
                  <span aria-hidden="true" style={{ flex: "none", width: 32, height: 32, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: BLUE, fontWeight: 800, fontSize: fs(14) }}>@</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: fs(14.5), fontWeight: 650, color: NEUTRAL.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>@{p.handle}</span>
                    <span style={{ display: "block", fontSize: fs(12.5), color: NEUTRAL.ink3 }}>{p.from ? `joined from ${withThe(p.from)} · ` : "joined "}{p.days === 0 ? "today" : p.days === 1 ? "yesterday" : `${p.days} days ago`}</span>
                  </span>
                  {state === "Following" || state === "Requested" ? (
                    <button type="button" onClick={() => setConfirm({ person: { user_id: p.user_id, handle: p.handle, name: `@${p.handle}` }, mode: state === "Requested" ? "cancel" : "unfollow" })}
                      aria-label={state === "Requested" ? `You asked to follow @${p.handle}. Cancel the request?` : `Following @${p.handle}. Unfollow?`}
                      style={{ flex: "none", minHeight: 34, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 999, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, font: "inherit", fontSize: fs(12.5), fontWeight: 600, cursor: "pointer" }}>{state}</button>
                  ) : (
                    <button type="button" onClick={() => addToCircle(p)} aria-busy={state === "busy" || undefined} aria-label={`Follow @${p.handle}`}
                      style={{ flex: "none", minHeight: 34, padding: "0 12px", borderRadius: 999, border: 0, background: BLUE, color: NEUTRAL.white, font: "inherit", fontSize: fs(12.5), fontWeight: 650, cursor: "pointer" }}>{state === "busy" ? "…" : "Follow"}</button>
                  )}
                </li>
              );
            })}
          </ul>
          <p style={{ margin: "8px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Only the @username and the city. Adults only. Anyone can turn this off in Settings.</p>
        </Sheet>
      ) : null}

      <button type="button" onClick={() => setAdding(true)}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 48, marginTop: GAP, borderRadius: 999, border: 0, background: BLUE, color: NEUTRAL.white, font: "inherit", fontSize: fs(14.5), fontWeight: 650, cursor: "pointer" }}>
        <UserPlus size={17} strokeWidth={2} aria-hidden="true" focusable="false" /> Add friends
      </button>
      {adding ? <AddFriendsSheet onClose={() => setAdding(false)} onFollowed={() => circle.retry()} /> : null}
      <UnfollowConfirm person={confirm?.person || null} mode={confirm?.mode || "unfollow"} busy={undoing} onConfirm={undo} onClose={() => setConfirm(null)} />
      {traveler ? (
        <TravelerSheet person={traveler.person} report={traveler.report} onClose={() => setTraveler(null)}
          onChanged={() => { setTraveler(null); circle.retry(); }} />
      ) : null}
    </div>
  );
}
