// FriendsTravels — Home's circle zone on the airmail stock (Home-Boxes L70-118): the
// people you travel with. Your circle's newest stamps and postcards, newest first and
// never ranked, from the same feed Mailbox reads; taps go to Mailbox. With no follows
// yet it is a small invite you can hide.
//
// It shows nothing rather than something untrue:
//   - nothing until AuthContext.socialTierReady, the feed and the circle have all
//     settled, so no social UI flashes before the age tier is known;
//   - nothing for anyone held from social (teen, the under-13 freeze, the birthday
//     check), whether AuthContext or the feed's `held` says so;
//   - nothing on any read error (never an empty or zero circle);
//   - nothing in a quiet week when you already follow people, or once the invite
//     is hidden.
// Rows from people you blocked never show. Every envelope from someone else has the
// door to production's TravelerSheet (one for the zone): Report, and Block once the
// worker advertises block_v2 (go-live decision 6, 2026-10-13). Your own rows have none.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { createPageUrl } from "@/utils";
import { getHandle, socialFeed } from "@/lib/passport";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { HomeZone } from "@/components/redesign/Zone";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import Envelope from "@/components/social/Envelope";
import TravelerSheet from "@/components/social/TravelerSheet";

const DISMISS_KEY = "gs_friends_invite_dismissed";
const HELD_TIERS = new Set(["teen", "blocked", "confirm"]);
const BLUE = NEUTRAL.airmailBlue;

const handleOf = (h) => String(h || "").trim().replace(/^@/, "").toLowerCase();
const timeOf = (r) => Date.parse(r?.created_at) || 0;

export default function FriendsTravels({ wide = false }) {
  const navigate = useNavigate();
  const { socialTier, socialTierReady } = useAuth();
  const circle = useCircle();
  const [feed, setFeed] = useState(null); // null while loading: { rows, held, error }
  const [me, setMe] = useState(null);
  const [traveler, setTraveler] = useState(null); // the row whose options sheet is open
  const [tick, setTick] = useState(0);             // read the feed again after a block
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  const held = HELD_TIERS.has(socialTier);

  useEffect(() => {
    if (!socialTierReady || held) return undefined;
    let gone = false;
    (async () => {
      const [f, h] = await Promise.all([socialFeed(), getHandle().catch(() => ({ handle: null }))]);
      if (gone) return;
      setFeed(f);
      setMe(h?.handle || null);
    })();
    return () => { gone = true; };
  }, [socialTierReady, held, tick]);

  if (!socialTierReady || held) return null;
  if (feed === null || circle.status === "loading") return null;
  if (feed.error || feed.held || circle.status === "error") return null;

  const toMailbox = () => navigate(createPageUrl("Mailbox"));
  const blocked = circle.blockedHandles || new Set();
  const rows = (Array.isArray(feed.rows) ? feed.rows : [])
    .filter((r) => r && !blocked.has(handleOf(r.by?.handle)))
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, 10);

  if (!rows.length) {
    // A quiet week when you already follow people, or the invite was hidden: nothing.
    // Follow counts are null until read, never a guessed 0.
    const youFollow = circle.counts?.youFollow;
    if (dismissed || youFollow == null || youFollow > 0) return null;
    const hide = () => {
      setDismissed(true);
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* fine */ }
    };
    return (
      <HomeZone zone="circle" label="Your circle" wide={wide}>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={hide}
            aria-label="Hide this"
            className="flex items-center justify-center rounded-full"
            style={{ position: "absolute", top: -10, right: -8, width: 44, height: 44, background: "transparent", border: 0, color: NEUTRAL.ink3, cursor: "pointer" }}
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <h3 className="font-serif m-0" style={{ paddingRight: 36, fontWeight: 400, fontSize: fs(22), lineHeight: 1.15, color: NEUTRAL.ink }}>
            Travel is better with your <em style={{ color: BLUE }}>circle</em>
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
            Follow the ones you travel with, and their real stamps and postcards land here: where they went, and whether they were really there. Your feed is yours alone — nobody else can see it.
          </p>
          <button
            type="button"
            onClick={toMailbox}
            className="inline-flex items-center rounded-full"
            style={{ marginTop: 12, minHeight: 44, gap: 8, padding: "0 18px", background: BLUE, border: 0, color: NEUTRAL.white, fontSize: fs(14), fontWeight: 600, cursor: "pointer" }}
          >
            Start your circle
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </HomeZone>
    );
  }

  return (
    <HomeZone zone="circle" label="Your circle" wide={wide}>
      <div className="flex items-center justify-between" style={{ gap: 12, minHeight: 24 }}>
        <h3 className="font-serif m-0 min-w-0" style={{ fontWeight: 400, fontSize: fs(22), lineHeight: 1.1, color: NEUTRAL.ink }}>
          Where your <em style={{ color: BLUE }}>circle</em> has been
        </h3>
        <button
          type="button"
          onClick={toMailbox}
          className="flex-none inline-flex items-center"
          style={{ gap: 4, minHeight: 44, margin: "-10px 0", padding: 0, background: "transparent", border: 0, fontSize: fs(13), fontWeight: 600, color: BLUE, cursor: "pointer" }}
        >
          Mailbox
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <p style={{ margin: "2px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Everything here really happened — and only you see it</p>
      {/* The envelopes bleed to the box's right edge and scroll sideways. */}
      <div className="flex overflow-x-auto" style={{ gap: 12, marginTop: 12, marginRight: -16, paddingRight: 16, paddingBottom: 2, scrollbarWidth: "none" }}>
        {rows.map((r, i) => (
          <Envelope key={`${r.type}-${r.created_at}-${i}`} row={r} variant="compact" me={me} onClick={toMailbox} onReport={setTraveler} />
        ))}
      </div>
      {traveler ? (
        <TravelerSheet
          person={{ ...(traveler.by || {}), postcard_id: traveler.type === "postcard" ? traveler.id || null : null }}
          report={{
            kind: traveler.type === "postcard" ? "postcard" : "stamp",
            ...(traveler.type === "postcard" && traveler.id ? { ref: `pc:${traveler.id}` } : {}),
            note: traveler.type === "postcard"
              ? `Postcard on Home${traveler.place ? ` from ${traveler.place}` : ""}${traveler.message ? `: "${String(traveler.message).slice(0, 300)}"` : ""}`
              : `Stamp on Home: ${traveler.name || ""}${traveler.city ? `, ${traveler.city}` : ""}`,
          }}
          onClose={() => setTraveler(null)}
          onChanged={() => { setTraveler(null); circle.retry(); setTick((t) => t + 1); }} />
      ) : null}
    </HomeZone>
  );
}
