// Mailbox — the feed (Social P2+). Friends' stamps AND postcards, newest
// first, reverse-chronological only (never ranked), never coordinates. Plus
// the follow controls: follow by @handle, and the teen-approval requests.
// Every person here — a postcard's sender, a stamp, an activity line, a
// request, a follower, someone you follow — has a ⋯ (or a tap) that opens
// TravelerSheet: Report, Unfollow, and "Block this traveler" once the worker
// advertises block_v2 (go-live decision 6, 2026-10-13; Apple 1.2).
// (The old "postcards arrive later" note here outlived the postcard launch
// and misled a 2026-10-10 bug hunt — postcards render below at ~222.)
import React, { useEffect, useState } from "react";
import { Loader2, UserPlus, MoreHorizontal } from "lucide-react";
import { showToast } from "@/components/Toast";
import OfficialSeal from "@/components/passport/OfficialSeal";
import { socialFollow, socialFeed, getHandle, setHandle, setAgeGate, splitDob, socialUnread } from "@/lib/passport";
import { readOsAgeRange, birthYearFromRange } from "@/lib/ageSignal";
import InviteButton from "@/components/passport/InviteButton";
import PostcardCompose from "@/components/passport/PostcardCompose";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import TravelerSheet from "@/components/social/TravelerSheet";
import ConfirmBirthdayNote from "@/components/social/ConfirmBirthdayNote";

// One line per thing that happened to you — the activity the dot announces.
function activityLine(a) {
  const who = a.by.name || (a.by.handle ? `@${a.by.handle}` : "A traveler");
  switch (a.type) {
    case "follow_request": return { who, text: "asked to follow you" };
    case "follow": return { who, text: "started following you" };
    case "postcard": return { who, text: a.to_me ? `sent you a postcard${a.place ? ` from ${a.place}` : ""}` : `mailed a postcard${a.place ? ` from ${a.place}` : ""}` };
    case "reaction": return { who, text: `stamped ${a.reactions.join(" · ")}${a.photo ? ` on your photo${a.stamp ? ` from ${a.stamp}` : ""}` : a.stamp ? ` on ${a.stamp}` : " on your passport"}` };
    case "signature": return { who, text: a.photo
      ? `${a.doodle && !a.body ? "doodled on" : "commented on"} your photo${a.stamp ? ` from ${a.stamp}` : ""}${a.body ? `: “${a.body}”` : ""}`
      : `${a.doodle && !a.body ? "left a doodle" : "signed"}${a.stamp ? ` your ${a.stamp} page` : " your passport"}${a.body ? `: “${a.body}”` : ""}` };
    case "tag": return { who, text: `tagged you${a.place ? ` at ${a.place}` : ""} — were you there together?` };
    default: return { who, text: "" };
  }
}

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const TEAL = "#0E7C86", STAMP = "#B0472F", IVORY = "#FFFCF7", SOFT = "#F6F0E4", GREEN = "#2E6B4E";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// The ⋯ beside a person: a 44px target that opens their TravelerSheet.
function MoreBtn({ label, onClick, className = "" }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Options for ${label}`} aria-haspopup="dialog"
      className={`flex-none w-11 h-11 rounded-full flex items-center justify-center ${className}`} style={{ color: INK3 }}>
      <MoreHorizontal size={18} aria-hidden="true" />
    </button>
  );
}
// What a report from an activity line is about (the report queue's kinds).
const ACTIVITY_KIND = { follow_request: "profile", follow: "profile", postcard: "postcard", reaction: "profile", signature: "signature", tag: "tag" };
const clip = (t, n) => { const v = String(t || "").replace(/\s+/g, " ").trim(); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };

const when = (iso) => {
  const d = new Date(iso); const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return "today"; if (days === 1) return "yesterday"; if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function MailboxPage() {
  const navigate = useNavigate();
  const { socialTier, refreshSocialTier } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);           // my handle (null until claimed)
  // social/follow op:'list' as it came: followers, requests, following,
  // blocked, and features (block_v2 turns Block on).
  const [lists, setLists] = useState({ followers: [], following: [], requests: [], blocked: [], features: [] });
  const [traveler, setTraveler] = useState(null); // { person, report } in the TravelerSheet
  const openTraveler = (person, report = null) => setTraveler({ person: person || {}, report });
  const [handleDraft, setHandleDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState(false);
  const [activity, setActivity] = useState([]);
  // Claim-your-@username, right here (it used to live two taps away).
  const [claimDraft, setClaimDraft] = useState("");
  const [claimSugs, setClaimSugs] = useState([]);
  const [claimNeedYear, setClaimNeedYear] = useState(false);
  const [claimYear, setClaimYear] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);

  const claim = async () => {
    const want = claimDraft.trim().toLowerCase();
    if (!want) return;
    setClaimBusy(true);
    if (claimNeedYear) {
      const dob = splitDob(claimYear);
      if (!dob) { setClaimBusy(false); showToast("Enter your full birthday", "error"); return; }
      const { error: yErr } = await setAgeGate(dob.year, dob.md);
      if (yErr && yErr !== "age_required") { setClaimBusy(false); showToast(yErr, "error"); return; }
      setClaimNeedYear(false);
      refreshSocialTier(); // a teen sees the hold, an under-13 the freeze, right away
    }
    const { handle: h, suggestions, error } = await setHandle(want);
    setClaimBusy(false);
    if (error === "age_required") {
      const osYear = birthYearFromRange(await readOsAgeRange());
      if (osYear) { const { error: aErr } = await setAgeGate(osYear); if (!aErr) { refreshSocialTier(); claim(); return; } }
      setClaimNeedYear(true); showToast("One thing first — your birthday", "success"); return;
    }
    setClaimSugs(error ? (suggestions || []) : []);
    if (error) { showToast(error, "error"); return; }
    setMe(h); setClaimDraft("");
    showToast(`You're @${h} — friends can find you now`, "success");
  };

  const load = async () => {
    const [f, l, h, u] = await Promise.all([socialFeed(), socialFollow("list"), getHandle(), socialUnread({ mark: true })]);
    setRows(f.rows); setMe(h.handle); setActivity(u.activity || []);
    if (l.data) setLists({ followers: l.data.followers || [], following: l.data.following || [], requests: l.data.requests || [], blocked: l.data.blocked || [], features: Array.isArray(l.data.features) ? l.data.features : [] });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const follow = async () => {
    const h = handleDraft.trim().replace(/^@/, "");
    if (!h) return;
    setBusy(true);
    const { data, error } = await socialFollow("follow", { handle: h });
    setBusy(false);
    if (error) { showToast(error, "error"); return; }
    setHandleDraft("");
    // The worker names the handle (a muted answer included); what was typed is the fallback.
    const who = data?.handle || h;
    showToast(data?.status === "pending" ? `Asked to follow @${who} — they approve first` : `Following @${who}`, "success");
    load();
  };
  const respond = async (user_id, op) => { await socialFollow(op, { user_id }); load(); };

  // 13–17: the whole social page is the hold note (founder, 2026-10-11).
  // An account whose birthday isn't complete ('confirm') gets the same
  // treatment with a way to finish it: the worker holds the same doors.
  if (socialTier === "teen" || socialTier === "confirm") {
    return (
      <div className="min-h-screen pb-28" style={{ background: IVORY }}>
        <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: STAMP }}>Globeskimmers · Mailbox</div>
          <h1 style={{ fontFamily: SERIF, fontSize: fs(28), color: INK, lineHeight: 1.05, marginTop: 4 }}>Where your people went</h1>
          {socialTier === "confirm" ? <ConfirmBirthdayNote className="mt-4" /> : <TeenHoldNote className="mt-4" />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: IVORY }}>
      {/* md:max-w-2xl (2026-10-10): on iPad this page sat in a phone-width
          column with empty cream on both sides — Apple's 13" screenshots
          made it look unfinished. Phones are untouched. */}
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: STAMP }}>Globeskimmers · Mailbox</div>
        <div className="flex items-end justify-between gap-3">
          <h1 style={{ fontFamily: SERIF, fontSize: fs(28), color: INK, lineHeight: 1.05, marginTop: 4 }}>Where your people went</h1>
          <button type="button" onClick={() => setCompose(true)} className="flex-none rounded-full px-4 py-2 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(12.5) }}>
            ✉️ Postcard
          </button>
        </div>

        {/* Follow by handle */}
        <div className="flex gap-2 mt-4">
          <div className="flex-1 flex items-center rounded-xl px-3 h-12" style={{ border: `1px solid ${RULE}`, background: "#fff" }}>
            <span style={{ color: INK3, fontWeight: 700 }}>@</span>
            <input value={handleDraft} onChange={(e) => setHandleDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, "").slice(0, 21))}
              placeholder="follow a friend by username" aria-label="Follow by username" autoCapitalize="none" autoCorrect="off"
              className="flex-1 outline-none bg-transparent pl-1" style={{ fontSize: fs(14) }} onKeyDown={(e) => e.key === "Enter" && follow()} />
          </div>
          <button type="button" onClick={follow} disabled={busy || !handleDraft.trim()} aria-label="Follow"
            className="h-12 w-12 rounded-xl flex items-center justify-center disabled:opacity-50" style={{ background: TEAL, color: "#fff" }}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}
          </button>
        </div>
        {!me && !loading && (
          <div className="mt-4 rounded-[16px] p-3.5" style={{ background: "#FFFBF0", border: "1px solid #EAD9AE" }}>
            <p style={{ fontSize: fs(13.5), color: INK, fontWeight: 700 }}>Claim your @username</p>
            <p style={{ fontSize: fs(12), color: INK2, marginTop: 2 }}>It&rsquo;s how friends find you, follow you, and send you postcards.</p>
            <div className="flex gap-2 mt-2.5 items-center">
              <div className="flex-1 min-w-0 flex items-center rounded-xl px-3 h-11" style={{ border: `1px solid ${RULE}`, background: "#fff" }}>
                <span style={{ color: INK3, fontWeight: 700 }}>@</span>
                <input value={claimDraft} onChange={(e) => setClaimDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  placeholder="yourname" aria-label="Choose your username" autoCapitalize="none" autoCorrect="off"
                  className="flex-1 min-w-0 outline-none bg-transparent pl-1" style={{ fontSize: fs(14) }} onKeyDown={(e) => e.key === "Enter" && claim()} />
              </div>
              <button type="button" onClick={claim} disabled={claimBusy || claimDraft.length < 3 || (claimNeedYear && !splitDob(claimYear))}
                className="flex-none h-11 px-4 rounded-xl font-semibold disabled:opacity-50" style={{ background: TEAL, color: "#fff", fontSize: fs(13) }}>
                {claimBusy ? "…" : "Claim"}
              </button>
            </div>
            {claimNeedYear && (
              <div className="mt-2.5">
                <label htmlFor="gs-mb-birth-year" style={{ display: "block", fontSize: fs(12.5), color: INK, fontWeight: 600 }}>One thing first — your birthday</label>
                <p style={{ fontSize: fs(11.5), color: INK3, marginTop: 1 }}>Asked once, never shown.</p>
                <input id="gs-mb-birth-year" type="date" value={claimYear} onChange={(e) => setClaimYear(e.target.value)} autoComplete="bday"
                  min="1900-01-01" max={new Date().toISOString().slice(0, 10)}
                  className="mt-1.5 w-44 h-11 rounded-xl px-3 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(14) }} />
              </div>
            )}
            {claimSugs.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                <span style={{ color: INK3, fontSize: fs(11.5) }}>Free right now:</span>
                {claimSugs.map((sug) => (
                  <button key={sug} type="button" onClick={() => { setClaimDraft(sug); setClaimSugs([]); }} className="rounded-full px-3 py-1"
                    style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(12.5), fontWeight: 600, color: INK }}>@{sug}</button>
                ))}
              </div>
            )}
          </div>
        )}
        <InviteButton compact />

        {/* What happened to you — the activity behind the Mailbox dot */}
        {activity.length > 0 && (
          <div className="mt-5">
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", color: "#8A5410" }}>
              On your passport{activity.some((a) => a.unread) ? ` · ${activity.filter((a) => a.unread).length} new` : ""}
            </div>
            <div className="mt-2 rounded-[16px] overflow-hidden" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
              {activity.slice(0, 12).map((a, i) => {
                const { who, text } = activityLine(a);
                const goes = a.type === "reaction" || a.type === "signature" || a.type === "tag";
                return (
                  <div key={i} className="flex items-start" style={{ borderTop: i ? `1px solid ${RULE}` : "none", background: a.unread ? "#FFFBF0" : "#fff" }}>
                    <button type="button" onClick={goes ? () => navigate(createPageUrl("Passport")) : undefined} disabled={!goes}
                      className="flex-1 min-w-0 text-left flex items-start gap-2.5 pl-3.5 pr-1 py-2.5"
                      style={{ background: "transparent", cursor: goes ? "pointer" : "default" }}>
                      <span aria-label={a.unread ? "new" : undefined} className="flex-none rounded-full" style={{ width: 8, height: 8, marginTop: 6, background: a.unread ? "#E0533C" : "transparent" }} />
                      <span className="flex-1" style={{ fontSize: fs(13), color: INK2, lineHeight: 1.4 }}>
                        <b style={{ color: INK }}>{who}</b>{a.by.verified ? <OfficialSeal size={11} tier={a.by.seal || "burgundy"} /> : null} {text}
                      </span>
                      <span className="flex-none" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, marginTop: 2 }}>{when(a.at)}</span>
                    </button>
                    <MoreBtn label={who} className="mt-0.5 mr-1" onClick={() => openTraveler({ ...a.by, entry_id: a.entry_id || null }, { kind: ACTIVITY_KIND[a.type] || "profile", note: clip(`Mailbox, ${when(a.at)}: ${who} ${text}`, 480) })} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Requests (teen approval) */}
        {lists.requests.length > 0 && (
          <div className="mt-5">
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", color: "#8A5410" }}>Wants to follow you</div>
            {lists.requests.map((r) => (
              <div key={r.user_id} className="flex items-center gap-2 rounded-[14px] px-3 py-2.5 mt-2" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
                <span className="flex-1 truncate" style={{ fontSize: fs(13.5), color: INK, fontWeight: 600 }}>{r.name || (r.handle ? `@${r.handle}` : "A traveler")}{r.verified ? <OfficialSeal size={12} tier={r.seal || "burgundy"} /> : null}</span>
                <button type="button" onClick={() => respond(r.user_id, "accept")} className="rounded-lg px-3 py-1.5 font-semibold" style={{ background: GREEN, color: "#fff", fontSize: fs(12) }}>Allow</button>
                <button type="button" onClick={() => respond(r.user_id, "decline")} className="rounded-lg px-3 py-1.5 font-semibold" style={{ background: SOFT, color: INK2, fontSize: fs(12) }}>Not now</button>
                <MoreBtn label={r.name || (r.handle ? `@${r.handle}` : "this traveler")} className="-mr-1.5 -my-1" onClick={() => openTraveler(r, { kind: "profile", note: "Asked to follow me" })} />
              </div>
            ))}
          </div>
        )}

        {/* The feed */}
        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: STAMP }} /></div>
          ) : rows.length === 0 ? (
            <div className="rounded-[18px] p-6 text-center" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
              <div style={{ fontSize: 40 }}>📬</div>
              <p style={{ fontFamily: SERIF, fontSize: fs(19), color: INK, marginTop: 6 }}>An empty mailbox, for now</p>
              <p style={{ color: INK2, fontSize: fs(13), lineHeight: 1.5, marginTop: 6, maxWidth: "34ch", marginInline: "auto" }}>
                Follow a friend by their @username and their new stamps land here — where they went, when, and whether it&apos;s verified.
              </p>
            </div>
          ) : (
            rows.map((r, i) => r.type === "postcard" ? (
              <div key={i} className="rounded-[14px] overflow-hidden mt-3 first:mt-0" style={{ background: "#FFFDF6", border: "1px solid #E4DAC4", boxShadow: "0 8px 18px -14px rgba(22,17,13,.4)" }}>
                <img src={r.photo} alt={r.place ? `Postcard from ${r.place}` : "A postcard"} loading="lazy" style={{ width: "100%", aspectRatio: "3 / 2", objectFit: "cover", display: "block" }} />
                <div className="px-4 py-3">
                  {r.message && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(17), color: INK, lineHeight: 1.3 }}>&ldquo;{r.message}&rdquo;</div>}
                  {(r.dish || r.place) && (
                    <div style={{ fontSize: fs(12.5), color: INK2, marginTop: r.message ? 5 : 0 }}>
                      {r.dish ? <b>{r.dish}</b> : null}{r.dish && r.place ? " · " : ""}{r.place || ""}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="min-w-0" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, letterSpacing: ".04em" }}>
                      FROM {r.by.name || (r.by.handle ? `@${r.by.handle}` : "A TRAVELER")}{r.city ? ` · ${String(r.city).toUpperCase()}` : ""}{r.to_me ? " · TO YOU" : ""}
                    </span>
                    <span className="ml-auto flex-none" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3 }}>{when(r.created_at)}</span>
                    <MoreBtn label={r.by.name || (r.by.handle ? `@${r.by.handle}` : "the sender")} className="-mr-2"
                      onClick={() => openTraveler({ ...r.by, postcard_id: r.id || null }, { kind: "postcard", ...(r.id ? { ref: `pc:${r.id}` } : {}), note: clip(`Postcard${r.place ? ` from ${r.place}` : ""}, ${when(r.created_at)}${r.message ? `: "${r.message}"` : ""}`, 480) })} />
                  </div>
                </div>
              </div>
            ) : (
              <div key={i} className="rounded-[16px] px-4 py-3 mt-2 first:mt-0" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
                <div className="flex items-center gap-2 -mt-1.5 -mb-1">
                  <span className="truncate" style={{ fontWeight: 700, fontSize: fs(13.5), color: INK }}>{r.by.name || (r.by.handle ? `@${r.by.handle}` : "A traveler")}</span>
                  <span className="flex-none ml-auto" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3 }}>{when(r.created_at)}</span>
                  <MoreBtn label={r.by.name || (r.by.handle ? `@${r.by.handle}` : "this traveler")} className="-mr-2.5"
                    onClick={() => openTraveler(r.by, { kind: "stamp", note: clip(`Stamp in my Mailbox, ${when(r.created_at)}: ${r.name}${r.city ? `, ${r.city}` : ""}`, 480) })} />
                </div>
                <div style={{ fontFamily: SERIF, fontSize: fs(18), color: INK, lineHeight: 1.2, marginTop: 3 }}>
                  {r.kind === "airport" ? "landed at " : "stamped "}<b>{r.name}</b>
                  {r.verified && <span title="Verified visit" style={{ color: GREEN, marginLeft: 6, fontSize: fs(14) }}>✓</span>}
                </div>
                <div style={{ fontFamily: MONO, fontSize: fs(10.5), color: INK3, marginTop: 3, letterSpacing: ".03em" }}>
                  {[r.city, r.country].filter(Boolean).join(", ").toUpperCase()}
                  {r.film ? `  ·  FILMED HERE: ${String(r.film.title || "").toUpperCase()}` : ""}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Following list */}
        <PostcardCompose open={compose} onClose={() => setCompose(false)} onSent={load} following={lists.following} followerCount={lists.followers.length} />

        {/* Following and followers: tap a name for Unfollow, Report and Block. */}
        {lists.following.length > 0 && (
          <div className="mt-7">
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", color: "#8A5410" }}>Following · {lists.following.length}</div>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {lists.following.map((f) => (
                <button key={f.user_id} type="button" onClick={() => openTraveler(f, { kind: "profile", note: "Someone I follow" })} aria-haspopup="dialog"
                  className="rounded-full px-3" style={{ minHeight: 44, background: SOFT, border: `1px solid ${RULE}`, fontSize: fs(12), color: INK2, fontWeight: 600 }}>
                  {f.name || (f.handle ? `@${f.handle}` : "traveler")}{f.verified ? <OfficialSeal size={12} tier={f.seal || "burgundy"} /> : null}{f.status === "pending" ? " · pending" : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {lists.followers.length > 0 && (
          <div className="mt-5">
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", color: "#8A5410" }}>Followers · {lists.followers.length}</div>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {lists.followers.map((f) => (
                <button key={f.user_id} type="button" onClick={() => openTraveler(f, { kind: "profile", note: "Follows me" })} aria-haspopup="dialog"
                  className="rounded-full px-3" style={{ minHeight: 44, background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(12), color: INK2, fontWeight: 600 }}>
                  {f.name || (f.handle ? `@${f.handle}` : "traveler")}{f.verified ? <OfficialSeal size={12} tier={f.seal || "burgundy"} /> : null}
                </button>
              ))}
            </div>
          </div>
        )}
        {traveler && (
          <TravelerSheet person={traveler.person} list={lists} report={traveler.report}
            onClose={() => setTraveler(null)} onChanged={load} />
        )}
      </div>
    </div>
  );
}
