// CircleFolder: YOUR CIRCLE on your own profile (Profile.dc.html L77-125;
// bible.profile.circle and word.lines). The airmail folder holds 'Your *circle*' with
// 'See all', the orbit (you at the centre, your inner circle, the people you follow and
// the people who follow you on three rings) and its legend, one row per ring that opens
// the Circle screen on that tab.
//
//   <CircleFolder owner cloth teenNote className style />
//   owner     { name, handle, avatar, cloth }: the centre face.
//   cloth     the owner's cloth: the rings and the legend glyphs.
//   teenNote  a 13-17 account sees TeenHoldNote in the folder's place (true by default;
//             the page turns it off while its edit mode already shows the note).
//
// Honest states, never a guess: nothing until the age tier is known (no social UI flashes
// before the hold applies); while the circle loads, the rings and '—' figures; when the
// read fails, 'Couldn’t load your circle' with 'Try again', never the empty circle; with
// nobody yet, 'Your circle starts with *one*' and 'Invite someone by text'. The legend's
// figures are inclusive (the inner circle counts in both other rows), a row at zero is
// left out, and blocked people are in no list. Faces open someone's world only where the
// worker says visits work (useCircle().canVisit).
import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { Folder } from "@/components/redesign/Zone";
import CircleOrbit, { CircleLegend } from "@/components/social/CircleOrbit";
import InviteButton from "@/components/passport/InviteButton";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const SERIF = "'Instrument Serif', Georgia, serif";
const BLUE = NEUTRAL.airmailBlue;

function Title({ pre, italic, post = "" }) {
  return (
    <h3 style={{ margin: 0, minWidth: 0, fontFamily: SERIF, fontSize: fs(22), lineHeight: 28 / 22, fontWeight: 400, overflowWrap: "anywhere", color: NEUTRAL.ink }}>
      {pre}<em style={{ fontStyle: "italic", color: BLUE }}>{italic}</em>{post}
    </h3>
  );
}

const handleOf = (p) => String(p?.handle ?? "").trim().replace(/^@+/, "");

function CircleBody({ owner, cloth, className, style }) {
  const navigate = useNavigate();
  const circle = useCircle();
  const ready = circle.status === "ready";
  const counts = ready && circle.counts ? circle.counts : {};
  const requests = ready && Array.isArray(circle.requests) ? circle.requests : [];
  const anyone = !!(counts.inner || counts.youFollow || counts.followYou);
  const empty = ready && !anyone && !requests.length;

  const openCircle = (tab) => () => navigate(`${createPageUrl("Circle")}${tab ? `?tab=${tab}` : ""}`);
  const visit = circle.canVisit
    ? (p) => { const h = handleOf(p); if (h) navigate(`${createPageUrl("Traveler")}?h=${encodeURIComponent(h)}`); }
    : undefined;

  const rows = [
    { key: "inner", label: "INNER CIRCLE", value: ready ? counts.inner ?? null : null, onClick: openCircle("inner") },
    { key: "following", label: "YOU FOLLOW", value: ready ? counts.youFollow ?? null : null, onClick: openCircle("following") },
    // Nobody accepted yet but someone is asking: the outer ring's row says so.
    ready && !anyone && requests.length
      ? { key: "followers", label: "WANTS TO FOLLOW YOU", value: requests.length, onClick: openCircle("followers") }
      : { key: "followers", label: "FOLLOW YOU", value: ready ? counts.followYou ?? null : null, onClick: openCircle("followers") },
  ];

  return (
    <Folder stock="circle" size="profile" tab="Your circle" className={className} style={style}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 8, minHeight: 28 }}>
        {empty ? <Title pre="Your circle starts with " italic="one" /> : <Title pre="Your " italic="circle" />}
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
          <p style={{ margin: 0, fontSize: fs(14), lineHeight: 20 / 14, color: NEUTRAL.ink2 }}>Couldn’t load your circle.</p>
          <button type="button" onClick={() => circle.retry()}
            style={{ marginTop: 10, minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${BLUE}`, fontFamily: "inherit", fontSize: fs(14), fontWeight: 600, color: BLUE, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: empty ? "center" : "flex-start", gap: 12, marginTop: 16 }}>
          <CircleOrbit
            size={168}
            mode="own"
            ringCloth={cloth}
            owner={owner || undefined}
            groups={ready ? { inner: circle.mutual, following: circle.followingOnly, followers: circle.followersOnly, requests } : undefined}
            totals={ready ? { inner: counts.inner, youFollow: counts.youFollow, followYou: counts.followYou } : undefined}
            onFace={ready ? visit : undefined}
            style={{ flex: "none" }}
          />
          {!empty ? <CircleLegend rows={rows} interactive={ready} cloth={cloth} style={{ flex: "1 1 140px" }} /> : null}
          {!ready ? <span className="sr-only" role="status">Loading your circle</span> : null}
        </div>
      )}

      {empty ? <InviteButton label="Invite someone by text" style={{ marginTop: 16 }} /> : null}
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
  return <CircleBody owner={owner} cloth={cloth} className={className} style={style} />;
}
