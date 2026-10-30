// ArrivalsPage — Home's Arrivals page (founder's decision sheet, 2026-10-25: the circle page is called
// "Arrivals"; "i like … being able to see who my friend circles are"). Who you follow and who follows
// you (each opens that list on the Circle screen), then where your circle has been lately
// (FriendsTravels: their newest stamps and postcards), then New arrivals — who joined in the last 14
// days, by @username and the city they joined from only, with Add to circle (founder: "nothing else abt
// their stuff should be seen") — then + Add friends.
//
// Nothing social shows until the age tier is known, and nothing for a held account; counts only once
// they've loaded (never a fake 0).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, UserPlus } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { Face } from "@/components/social/SocialMarks";
import FriendsTravels from "@/components/home/FriendsTravels";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import AddFriendsSheet from "@/components/social/AddFriendsSheet";
import { newArrivals } from "@/lib/newArrivals";
import { friendsAdded } from "@/lib/passport";
import { artFor } from "@/lib/cityCards";
import { cityBoardUrl } from "@/lib/boardLinks";
import { whenLabel } from "@/components/social/Envelope";

// One line per thing a friend added (founder, 2026-10-30), and where it opens: their card at that
// stamp, the photo big on their page, or the board on that photo or clip.
function addedRow(r) {
  const who = r.by?.handle ? `@${r.by.handle}` : (r.by?.name || "A friend");
  const h = r.by?.handle ? `h=${encodeURIComponent(r.by.handle)}` : "";
  if (r.kind === "card") return { art: artFor(r.stamp?.category, r.stamp?.design), text: <><b style={{ fontWeight: 650 }}>{who}</b> stamped {r.stamp?.name} on the {r.card?.city} {r.card?.year} card</>, to: `${createPageUrl("Traveler")}?${h}&card=${r.card?.id}&stamp=${r.stamp?.id}` };
  if (r.kind === "album") return { thumb: r.photo?.url, text: <><b style={{ fontWeight: 650 }}>{who}</b> added a photo to {r.stamp?.name}{r.stamp?.city ? `, ${r.stamp.city}` : ""}</>, to: `${createPageUrl("Traveler")}?${h}&photo=${r.photo?.id}` };
  return { thumb: r.item?.photo, text: <><b style={{ fontWeight: 650 }}>{who}</b> added a {r.item?.video ? "clip" : "photo"} to {r.board_at?.city}’s city board</>, to: `${cityBoardUrl(r.board_at?.city, r.board_at?.country, r.board_at?.region)}&open=bcp:${r.item?.id}` };
}
import { showToast } from "@/components/Toast";
import { workerMessage } from "@/components/social/FollowByHandle";
import { askForAlerts } from "@/lib/pushAlerts";

const SERIF = "'Instrument Serif', Georgia, serif";
const BLUE = NEUTRAL.airmailBlue;
const HELD = new Set(["teen", "blocked", "confirm"]);
// "joined from the Philippines" (the same rule as the arrival and border prompts).
const withThe = (name) => (/^(United |Czech Republic|Dominican Republic|Central African Republic)|Islands$|^(Philippines|Netherlands|Bahamas|Maldives|Gambia|Comoros|Seychelles)$/.test(String(name || "")) ? `the ${name}` : name);

function CountTile({ n, label, people, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minHeight: 92, padding: "10px 12px", borderRadius: 16, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, font: "inherit", textAlign: "left", cursor: "pointer" }}>
      <span aria-hidden="true" style={{ display: "flex", minHeight: 24 }}>
        {(people || []).slice(0, 4).map((p, i) => (
          <Face key={String(p.user_id ?? p.handle ?? i)} name={p.name} handle={p.handle} avatar={p.avatar} cloth={p.cloth} size={24} style={{ marginLeft: i ? -7 : 0 }} />
        ))}
      </span>
      <span style={{ fontFamily: SERIF, fontSize: fs(28), lineHeight: 1, color: NEUTRAL.ink }}>{n}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: fs(13), fontWeight: 600, color: NEUTRAL.ink2 }}>{label}<ChevronRight size={15} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" /></span>
    </button>
  );
}

export default function ArrivalsPage({ wide = false }) {
  const navigate = useNavigate();
  const { socialTier, socialTierReady } = useAuth();
  const circle = useCircle();
  const held = socialTierReady && HELD.has(String(socialTier || ""));
  const counts = circle.counts || {};
  const ready = socialTierReady && circle.status === "ready" && counts.youFollow != null;
  const [adding, setAdding] = useState(false);
  const [arrivals, setArrivals] = useState(null);   // { rows, … } once read
  const [added, setAdded] = useState({});          // user_id -> "Following" | "Requested" | "busy"
  useEffect(() => {
    if (!socialTierReady || held) return undefined;
    let gone = false;
    newArrivals().then((r) => { if (!gone) setArrivals(r); });
    return () => { gone = true; };
  }, [socialTierReady, held]);
  // What the people I follow added lately (founder, 2026-10-30).
  const [finds, setFinds] = useState(null);
  useEffect(() => {
    if (!socialTierReady || held) return undefined;
    let gone = false;
    friendsAdded().then((r) => { if (!gone) setFinds(r); });
    return () => { gone = true; };
  }, [socialTierReady, held]);
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
  const fresh = arrivals && !arrivals.off && !arrivals.held ? arrivals.rows : [];
  return (
    <div className="max-w-md md:max-w-2xl mx-auto" style={{ padding: "16px 16px 0" }}>
      <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(28), fontWeight: 400, lineHeight: 1.05, color: NEUTRAL.ink }}>
        Arrivals <em style={{ fontStyle: "italic", color: BLUE }}>from your friends</em>
      </h2>
      <p style={{ margin: "4px 0 0", fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink2 }}>Where your people have been, and who you travel with.</p>
      {held ? <div style={{ marginTop: 16 }}><TeenHoldNote /></div> : (
        <>
          {ready ? (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <CountTile n={counts.youFollow} label="I follow" people={circle.acc} onClick={() => navigate(`${createPageUrl("Circle")}?tab=following`)} />
              <CountTile n={counts.followYou} label="Follow me" people={circle.fol} onClick={() => navigate(`${createPageUrl("Circle")}?tab=followers`)} />
            </div>
          ) : null}
          <div style={{ marginTop: 6 }}><FriendsTravels wide={wide} /></div>
          {finds && finds.rows.length ? (
            <section aria-label="What your friends added" style={{ marginTop: 18 }}>
              <div style={{ display: "flex" }}>
                <span style={{ marginLeft: 12, padding: "5px 12px 4px", borderRadius: "8px 8px 0 0", fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: fs(9.5), fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, borderBottom: 0, color: BLUE }}>What your friends added</span>
              </div>
              <div style={{ padding: "4px 12px 10px", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 16 }}>
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
                            <span style={{ display: "block", marginTop: 2, fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: fs(10), letterSpacing: ".04em", color: NEUTRAL.ink3 }}>{whenLabel(r.at)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p style={{ margin: "8px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Only what they chose to share with you. Tap one to see it.</p>
              </div>
            </section>
          ) : null}
          {fresh.length ? (
            <section aria-label="New arrivals" style={{ marginTop: 18 }}>
              <div style={{ display: "flex" }}>
                <span style={{ marginLeft: 12, padding: "5px 12px 4px", borderRadius: "8px 8px 0 0", fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: fs(9.5), fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", background: `linear-gradient(180deg, #3D62AD, ${BLUE})`, color: "#FBF6EC" }}>New arrivals</span>
              </div>
              <div style={{ padding: "4px 12px 10px", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 16 }}>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {fresh.map((p) => {
                    const state = added[p.user_id];
                    return (
                      <li key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, borderBottom: `1px solid ${NEUTRAL.rule}` }}>
                        <span aria-hidden="true" style={{ flex: "none", width: 32, height: 32, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: BLUE, fontWeight: 800, fontSize: fs(14) }}>@</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: fs(14.5), fontWeight: 650, color: NEUTRAL.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>@{p.handle}</span>
                          <span style={{ display: "block", fontSize: fs(12.5), color: NEUTRAL.ink3 }}>{p.from ? `joined from ${withThe(p.from)} · ` : "joined "}{p.days === 0 ? "today" : p.days === 1 ? "yesterday" : `${p.days} days ago`}</span>
                        </span>
                        {state === "Following" || state === "Requested" ? (
                          <span style={{ flex: "none", minHeight: 34, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 999, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, fontSize: fs(12.5), fontWeight: 600 }}>{state}</span>
                        ) : (
                          <button type="button" onClick={() => addToCircle(p)} aria-busy={state === "busy" || undefined} aria-label={`Follow @${p.handle}`}
                            style={{ flex: "none", minHeight: 34, padding: "0 12px", borderRadius: 999, border: 0, background: BLUE, color: NEUTRAL.white, font: "inherit", fontSize: fs(12.5), fontWeight: 650, cursor: "pointer" }}>{state === "busy" ? "…" : "Follow"}</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p style={{ margin: "8px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Only the @username and the city. Adults only. Anyone can turn this off in Settings.</p>
              </div>
            </section>
          ) : null}
          <button type="button" onClick={() => setAdding(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 48, marginTop: 14, borderRadius: 999, border: 0, background: BLUE, color: NEUTRAL.white, font: "inherit", fontSize: fs(14.5), fontWeight: 650, cursor: "pointer" }}>
            <UserPlus size={17} strokeWidth={2} aria-hidden="true" focusable="false" /> Add friends
          </button>
          {adding ? <AddFriendsSheet onClose={() => setAdding(false)} /> : null}
        </>
      )}
    </div>
  );
}
