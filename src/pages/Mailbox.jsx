// Mailbox — the feed (Social P2). Postcards arrive later; v1 delivers what the
// graph already proves: the stamps your people earned, newest first, reverse-
// chronological only (never ranked), never coordinates, never photos yet. Plus
// the follow controls: follow by @handle, and the teen-approval requests.
import React, { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { showToast } from "@/components/Toast";
import OfficialSeal from "@/components/passport/OfficialSeal";
import { socialFollow, socialFeed, getHandle, setHandle, setAgeGate, socialUnread } from "@/lib/passport";
import { readOsAgeRange, birthYearFromRange } from "@/lib/ageSignal";
import InviteButton from "@/components/passport/InviteButton";
import PostcardCompose from "@/components/passport/PostcardCompose";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

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

const when = (iso) => {
  const d = new Date(iso); const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return "today"; if (days === 1) return "yesterday"; if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function MailboxPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);           // my handle (null until claimed)
  const [lists, setLists] = useState({ followers: [], following: [], requests: [] });
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
      const { error: yErr } = await setAgeGate(Number(claimYear));
      if (yErr && yErr !== "age_required") { setClaimBusy(false); showToast(yErr, "error"); return; }
      setClaimNeedYear(false);
    }
    const { handle: h, suggestions, error } = await setHandle(want);
    setClaimBusy(false);
    if (error === "age_required") {
      const osYear = birthYearFromRange(await readOsAgeRange());
      if (osYear) { const { error: aErr } = await setAgeGate(osYear); if (!aErr) { claim(); return; } }
      setClaimNeedYear(true); showToast("One thing first — the year you were born", "success"); return;
    }
    setClaimSugs(error ? (suggestions || []) : []);
    if (error) { showToast(error, "error"); return; }
    setMe(h); setClaimDraft("");
    showToast(`You're @${h} — friends can find you now`, "success");
  };

  const load = async () => {
    const [f, l, h, u] = await Promise.all([socialFeed(), socialFollow("list"), getHandle(), socialUnread({ mark: true })]);
    setRows(f.rows); setMe(h.handle); setActivity(u.activity || []);
    if (l.data) setLists({ followers: l.data.followers || [], following: l.data.following || [], requests: l.data.requests || [] });
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
    showToast(data.status === "pending" ? `Asked to follow @${data.handle} — they approve first` : `Following @${data.handle}`, "success");
    load();
  };
  const respond = async (user_id, op) => { await socialFollow(op, { user_id }); load(); };
  const unfollow = async (user_id) => { await socialFollow("unfollow", { user_id }); load(); };

  return (
    <div className="min-h-screen pb-28" style={{ background: IVORY }}>
      <div className="max-w-md mx-auto px-4 pt-6">
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
              <div className="flex-1 flex items-center rounded-xl px-3 h-11" style={{ border: `1px solid ${RULE}`, background: "#fff" }}>
                <span style={{ color: INK3, fontWeight: 700 }}>@</span>
                <input value={claimDraft} onChange={(e) => setClaimDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  placeholder="yourname" aria-label="Choose your username" autoCapitalize="none" autoCorrect="off"
                  className="flex-1 outline-none bg-transparent pl-1" style={{ fontSize: fs(14) }} onKeyDown={(e) => e.key === "Enter" && claim()} />
              </div>
              {claimNeedYear && (
                <input value={claimYear} onChange={(e) => setClaimYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Born" inputMode="numeric" aria-label="Year you were born"
                  className="w-20 h-11 rounded-xl px-3 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13) }} />
              )}
              <button type="button" onClick={claim} disabled={claimBusy || claimDraft.length < 3 || (claimNeedYear && claimYear.length !== 4)}
                className="h-11 px-4 rounded-xl font-semibold disabled:opacity-50" style={{ background: TEAL, color: "#fff", fontSize: fs(13) }}>
                {claimBusy ? "…" : "Claim"}
              </button>
            </div>
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
                  <button key={i} type="button" onClick={goes ? () => navigate(createPageUrl("Passport")) : undefined} disabled={!goes}
                    className="w-full text-left flex items-start gap-2.5 px-3.5 py-2.5"
                    style={{ borderTop: i ? `1px solid ${RULE}` : "none", background: a.unread ? "#FFFBF0" : "#fff", cursor: goes ? "pointer" : "default" }}>
                    <span aria-label={a.unread ? "new" : undefined} className="flex-none rounded-full" style={{ width: 8, height: 8, marginTop: 6, background: a.unread ? "#E0533C" : "transparent" }} />
                    <span className="flex-1" style={{ fontSize: fs(13), color: INK2, lineHeight: 1.4 }}>
                      <b style={{ color: INK }}>{who}</b>{a.by.verified ? <OfficialSeal size={11} tier={a.by.seal || "burgundy"} /> : null} {text}
                    </span>
                    <span className="flex-none" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, marginTop: 2 }}>{when(a.at)}</span>
                  </button>
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
                  <div className="flex items-baseline gap-2 mt-2">
                    <span style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, letterSpacing: ".04em" }}>
                      FROM {r.by.name || (r.by.handle ? `@${r.by.handle}` : "A TRAVELER")}{r.city ? ` · ${String(r.city).toUpperCase()}` : ""}{r.to_me ? " · TO YOU" : ""}
                    </span>
                    <span className="ml-auto flex-none" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3 }}>{when(r.created_at)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div key={i} className="rounded-[16px] px-4 py-3 mt-2 first:mt-0" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
                <div className="flex items-baseline gap-2">
                  <span className="truncate" style={{ fontWeight: 700, fontSize: fs(13.5), color: INK }}>{r.by.name || (r.by.handle ? `@${r.by.handle}` : "A traveler")}</span>
                  <span className="flex-none ml-auto" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3 }}>{when(r.created_at)}</span>
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

        {lists.following.length > 0 && (
          <div className="mt-7">
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", color: "#8A5410" }}>Following · {lists.following.length}</div>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {lists.following.map((f) => (
                <button key={f.user_id} type="button" onClick={() => unfollow(f.user_id)} title="Tap to unfollow"
                  className="rounded-full px-3 py-1.5" style={{ background: SOFT, border: `1px solid ${RULE}`, fontSize: fs(12), color: INK2, fontWeight: 600 }}>
                  {f.name || (f.handle ? `@${f.handle}` : "traveler")}{f.verified ? <OfficialSeal size={12} tier={f.seal || "burgundy"} /> : null}{f.status === "pending" ? " · pending" : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
