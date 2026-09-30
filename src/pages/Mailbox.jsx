// Mailbox — the feed (Social P2). Postcards arrive later; v1 delivers what the
// graph already proves: the stamps your people earned, newest first, reverse-
// chronological only (never ranked), never coordinates, never photos yet. Plus
// the follow controls: follow by @handle, and the teen-approval requests.
import React, { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { showToast } from "@/components/Toast";
import { socialFollow, socialFeed, getHandle } from "@/lib/passport";
import PostcardCompose from "@/components/passport/PostcardCompose";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

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

  const load = async () => {
    const [f, l, h] = await Promise.all([socialFeed(), socialFollow("list"), getHandle()]);
    setRows(f.rows); setMe(h.handle);
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
          <button type="button" onClick={() => navigate(createPageUrl("Settings"))} className="mt-2 text-left" style={{ background: "none", border: 0, padding: 0, color: INK3, fontSize: fs(11.5) }}>
            Friends find you by your @username — <span style={{ color: TEAL, textDecoration: "underline", textUnderlineOffset: 2 }}>claim yours in Settings</span>
          </button>
        )}

        {/* Requests (teen approval) */}
        {lists.requests.length > 0 && (
          <div className="mt-5">
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", color: "#8A5410" }}>Wants to follow you</div>
            {lists.requests.map((r) => (
              <div key={r.user_id} className="flex items-center gap-2 rounded-[14px] px-3 py-2.5 mt-2" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
                <span className="flex-1 truncate" style={{ fontSize: fs(13.5), color: INK, fontWeight: 600 }}>{r.name || (r.handle ? `@${r.handle}` : "A traveler")}</span>
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
        <PostcardCompose open={compose} onClose={() => setCompose(false)} onSent={load} following={lists.following} />

        {lists.following.length > 0 && (
          <div className="mt-7">
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", color: "#8A5410" }}>Following · {lists.following.length}</div>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {lists.following.map((f) => (
                <button key={f.user_id} type="button" onClick={() => unfollow(f.user_id)} title="Tap to unfollow"
                  className="rounded-full px-3 py-1.5" style={{ background: SOFT, border: `1px solid ${RULE}`, fontSize: fs(12), color: INK2, fontWeight: 600 }}>
                  {f.name || (f.handle ? `@${f.handle}` : "traveler")}{f.status === "pending" ? " · pending" : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
