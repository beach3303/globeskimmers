// FriendsTravels — the Home row that shows other humans (audit P1 #7: Home
// was "socially silent"). Your people's newest verified stamps and postcards,
// reverse-chronological, never ranked — the same feed Mailbox reads. Taps go
// to Mailbox. At zero friends it becomes a small, dismissible invite.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { socialFeed, socialFollow } from "@/lib/passport";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16302B", INK2 = "#3F5A50", INK3 = "#71827D";
const GREEN = "#2E6B4E", STAMP = "#B0472F";
const DISMISS_KEY = "gs_friends_invite_dismissed";

const when = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "today"; if (days === 1) return "yesterday"; if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function FriendsTravels({ wide = false }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);       // null = loading
  const [following, setFollowing] = useState(0);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } });

  useEffect(() => {
    let gone = false;
    (async () => {
      const [f, l] = await Promise.all([socialFeed(), socialFollow("list")]);
      if (gone) return;
      setRows(f.error ? [] : (f.rows || []).slice(0, 10));
      setFollowing((l.data?.following || []).filter((x) => x.status === "accepted").length);
    })();
    return () => { gone = true; };
  }, []);

  if (rows === null) return null;
  const pad = wide ? "pb-3" : "px-4 pb-3";
  const box = wide ? "" : "max-w-md mx-auto";
  const toMailbox = () => navigate(createPageUrl("Mailbox"));

  if (!rows.length) {
    // Friends but a quiet week: stay out of the way. No friends: invite once.
    if (following > 0 || dismissed) return null;
    return (
      <div className={pad}>
        <div className={box}>
          <div className="relative rounded-[16px] px-4 py-3.5" style={{ background: "#FFFBF0", border: "1px solid #EAD9AE" }}>
            <button type="button" aria-label="Hide this" onClick={() => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* fine */ } }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#fff", color: INK, fontSize: 12, fontWeight: 700, border: "1px solid #EAD9AE" }}>✕</button>
            <div style={{ fontFamily: SERIF, fontSize: "calc(17px*var(--fs))", color: INK, lineHeight: 1.2, paddingRight: 24 }}>Travel is better with your people</div>
            <p style={{ fontSize: "calc(12.5px*var(--fs))", color: INK2, lineHeight: 1.45, marginTop: 4 }}>
              Follow friends and their real stamps and postcards land here — where they went, and whether they were really there.
            </p>
            <button type="button" onClick={toMailbox} className="mt-2.5 rounded-full px-3.5 py-2 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: "calc(12.5px*var(--fs))" }}>
              Find or invite a friend →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pad}>
      <div className={box}>
        <div className="flex items-baseline justify-between mb-2 px-0.5 gap-3">
          <div className="min-w-0">
            <div style={{ fontFamily: SERIF, fontSize: "calc(19px*var(--fs))", lineHeight: 1.1, color: INK }}>Friends&rsquo; travels</div>
            <div style={{ fontSize: "calc(12px*var(--fs))", color: INK3, marginTop: 2 }}>Everything here really happened</div>
          </div>
          <button type="button" onClick={toMailbox} className="flex-none font-semibold" style={{ color: "#17A38F", fontSize: "calc(12.5px*var(--fs))" }}>Mailbox →</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {rows.map((r, i) => {
            const who = r.by?.name || (r.by?.handle ? `@${r.by.handle}` : "A traveler");
            return (
              <button key={i} type="button" onClick={toMailbox} className="flex-none text-left rounded-[14px] overflow-hidden"
                style={{ width: "calc(190px*var(--fs))", background: "#fff", border: "1px solid rgba(22,17,13,.12)" }}>
                {r.type === "postcard" && r.photo && (
                  <img src={r.photo} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "3 / 2", objectFit: "cover", display: "block" }} />
                )}
                <div className="px-3 py-2.5">
                  <div className="truncate" style={{ fontFamily: MONO, fontSize: "calc(9.5px*var(--fs))", letterSpacing: ".06em", color: INK3, textTransform: "uppercase" }}>
                    {who} · {when(r.created_at)}
                  </div>
                  {r.type === "postcard" ? (
                    <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "calc(15px*var(--fs))", color: INK, lineHeight: 1.25, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {r.message ? `“${r.message}”` : `A postcard${r.place ? ` from ${r.place}` : ""}`}
                    </div>
                  ) : (
                    <div style={{ fontFamily: SERIF, fontSize: "calc(16px*var(--fs))", color: INK, lineHeight: 1.2, marginTop: 3 }}>
                      {r.kind === "airport" ? "landed at " : "stamped "}<b>{r.name}</b>
                      {r.verified && <span title="Verified visit" style={{ color: GREEN, marginLeft: 5 }}>✓</span>}
                    </div>
                  )}
                  {(r.city || r.country) && (
                    <div className="truncate" style={{ fontFamily: MONO, fontSize: "calc(9.5px*var(--fs))", color: INK3, marginTop: 4, letterSpacing: ".04em" }}>
                      {[r.city, r.country].filter(Boolean).join(", ").toUpperCase()}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
