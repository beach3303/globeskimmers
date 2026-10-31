// Traveler: someone else's world (bible.profile.visiting; Profile-Visit.dc.html). Opened as
// /Traveler?h=<handle> from a face or a row in your circle, or /Traveler?slug=<slug> from a
// shared passport link (the deep link pushes it). Their journal opens in their cloth: the
// cover with '{FIRST}’S WORLD' and a back circle, their trunk resting on it, their bookplate,
// one action, then their circle, their passport (the newest page with its Blotter, more pages
// and the door), their kit and their map, each only when the worker sends it.
//
// It works on today's worker too (world.js): a slug falls back to the public passport, which
// gives a first name, stamps and stats and nothing more, so there is no Follow and no folder
// the worker didn't send; Report is always there. Every other outcome is honest and names
// nobody it can't: 'private or no longer available' (today's one reply for five cases), 'This
// page isn’t available' (no such person, blocked, unavailable), 'Couldn’t open this page' (the
// network). Your own handle or slug opens your Profile instead. Nothing renders until the age
// tier is known, and a 13-17 viewer sees the hold note.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { getWorld, reportTraveler } from "@/lib/world";
import { getHandle, getShareLink, blotterRead, sortStamps } from "@/lib/passport";
import { clothOf } from "@/lib/cloth";
import { usePageGround } from "@/components/redesign/PageGround";
import { Folder } from "@/components/redesign/Zone";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import CoverBand from "@/components/profile/CoverBand";
import Bookplate from "@/components/profile/Bookplate";
import MapFolder from "@/components/profile/MapFolder";
import VirtualItems from "@/components/profile/VirtualItems";
import Luggage, { SHOW_LUGGAGE } from "@/components/passport/Luggage";
import PassportFolder from "@/components/passport/PassportFolder";
import PhotoPackets from "@/components/passport/PhotoPackets";
import CityCardsPage from "@/components/citycards/CityCardsPage";
import CircleOrbit, { CircleLegend, groupsFromKnown } from "@/components/social/CircleOrbit";
import { TwoRingMark } from "@/components/social/SocialMarks";
import TravelerActions from "@/components/social/TravelerActions";
import { ReportSheet } from "@/components/social/Envelope";
import TeenHoldNote from "@/components/social/TeenHoldNote";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const GAP = 12;
const BLUE = NEUTRAL.airmailBlue;

const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const cleanSlug = (v) => String(v ?? "").trim().replace(/[^a-z0-9]/gi, "").slice(0, 24);
const firstOf = (name) => String(name ?? "").trim().split(/\s+/)[0] || null;
const caps = (s) => String(s).toUpperCase();

// The relation the worker reported, as useCircle names it.
function relationFromWorld(r) {
  if (!r) return null;
  if (r.inner) return "inner";
  if (r.i_follow === "accepted") return "following";
  if (r.i_follow === "pending") return "requested";
  if (r.follows_me) return "follower";
  return null;
}

// The white card that rests on the cover when there is no world to show.
function Notice({ title, body = null, children = null }) {
  return (
    <section style={{ position: "relative", zIndex: 1, marginTop: -72, padding: 20, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 18, boxShadow: `0 14px 28px -20px ${rgba(NEUTRAL.trunkShadow, 0.5)}` }}>
      <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.15, color: NEUTRAL.ink }}>{title}</h1>
      {body ? <p style={{ margin: "6px 0 0", fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>{body}</p> : null}
      {children ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>{children}</div> : null}
    </section>
  );
}

function TheirCircle({ world, first, cloth, inner, style }) {
  const c = world.circle;
  const p = world.person;
  const FIRST = first ? caps(first) : null;
  const groups = groupsFromKnown(c.known);
  const totals = { inner: c.inner, following: c.following, followers: c.followers };
  const rows = [
    { key: "inner", label: "FRIENDS", value: c.inner },
    { key: "following", label: FIRST ? `${FIRST} FOLLOWS` : "THEY FOLLOW", value: c.following },
    { key: "followers", label: FIRST ? `FOLLOW ${FIRST}` : "FOLLOW THEM", value: c.followers },
  ];
  const known = c.known_count || 0;
  return (
    <Folder stock="circle" size="profile" tab={first ? `${first}’s friends` : "Their friends"} style={style}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 8, minHeight: 28 }}>
        <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(22), lineHeight: 28 / 22, fontWeight: 400, color: NEUTRAL.ink }}>
          {first ? `${first}’s ` : "Their "}<em style={{ fontStyle: "italic", color: BLUE }}>friends &amp; followers</em>
        </h3>
        {inner ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: fs(10), lineHeight: 1.2, fontWeight: 500, letterSpacing: ".14em", color: BLUE }}>
            <TwoRingMark color={BLUE} strokeWidth={1.5} />FRIENDS
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 16 }}>
        <CircleOrbit size={168} mode="visit" ringCloth={cloth} owner={{ name: p.name, handle: p.handle, avatar: p.avatar, cloth }}
          groups={groups} totals={totals} style={{ flex: "none" }} />
        <CircleLegend rows={rows} cloth={cloth} style={{ flex: "1 1 140px" }} />
      </div>
      {known > 0 ? (
        <p style={{ margin: "12px 0 0", fontSize: fs(13), lineHeight: 16 / 13, color: NEUTRAL.ink2 }}>
          {known === 1 ? "1 person you know knows" : `${known} people you know know`} {first || "them"}
        </p>
      ) : null}
    </Folder>
  );
}

// Back to wherever you came from; the session's first page — a cold start, a notification, a
// shared link — has nothing behind it (founder, 2026-10-30: "the back button is not working"),
// so it goes Home instead of asking the browser for a page that isn't there.
function useBack() {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1 && key !== "default") navigate(-1);
    else navigate(createPageUrl("Home"), { replace: true });
  };
}

export default function Traveler() {
  const { socialTier, socialTierReady } = useAuth();
  const goBack = useBack();
  // Nothing social until the age tier is known; a 13-17 viewer meets the hold, and the
  // circle isn't even read for them.
  if (!socialTierReady || socialTier === "blocked" || socialTier === "confirm") return null;
  if (socialTier === "teen") return <HeldPage onBack={goBack} />;
  return <TravelerWorld />;
}

function HeldPage({ onBack }) {
  return (
    <div>
      <div aria-hidden="true" style={{ height: 12 }} />
      <CoverBand cloth="harbour" kicker="A virtual passport" leading="back" onLeading={onBack} contentMaxWidth={672} />
      <div className={COLUMN}><div style={{ position: "relative", zIndex: 1, marginTop: -72 }}><TeenHoldNote /></div></div>
    </div>
  );
}

function TravelerWorld() {
  const navigate = useNavigate();
  const location = useLocation();
  const circle = useCircle();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const h = lc(params.get("h"));
  const slug = cleanSlug(params.get("slug"));

  const [res, setRes] = useState(null); // null while loading
  const [tick, setTick] = useState(0);
  const [blotter, setBlotter] = useState(null);
  const [reporting, setReporting] = useState(false);
  const live = useRef(0);

  const toProfile = useCallback(() => navigate(createPageUrl("Profile"), { replace: true }), [navigate]);
  const goBack = useBack();

  useEffect(() => {
    const n = ++live.current;
    setRes(null);
    (async () => {
      // Your own page opens as your profile.
      if (h) {
        const mine = await getHandle();
        if (n !== live.current) return;
        if (mine.handle && lc(mine.handle) === h) { toProfile(); return; }
      } else if (slug) {
        const { data } = await getShareLink();
        if (n !== live.current) return;
        if (data?.slug && cleanSlug(data.slug) === slug) { toProfile(); return; }
      }
      const r = await getWorld({ handle: h, slug });
      if (n !== live.current) return;
      if (r.state === "world" && r.relation?.self) { toProfile(); return; }
      setRes(r);
    })();
    return () => { live.current += 1; };
  }, [h, slug, tick, toProfile]);

  // Read the world again after an action, without blanking the page.
  const reread = async () => {
    const n = ++live.current;
    const r = await getWorld({ handle: h, slug });
    if (n === live.current) setRes(r);
  };
  const onChanged = (what) => {
    if (what === "block") { live.current += 1; setRes({ state: "gone" }); return; }
    reread();
  };

  const world = res && res.state === "world" ? res : null;
  const worldSlug = world?.slug || null;
  useEffect(() => {
    if (!worldSlug || !world?.stamps) { setBlotter(null); return undefined; }
    let gone = false;
    blotterRead(worldSlug).then((b) => { if (!gone) setBlotter(b); });
    return () => { gone = true; };
  }, [worldSlug, world?.stamps]);
  const refreshBlotter = () => { if (worldSlug) blotterRead(worldSlug).then(setBlotter); };

  // The owner's chosen page order (newest / chrono / shuffle / their hand) holds here too.
  const orderedStamps = world?.stamps ? sortStamps(world.stamps, world.booklet) : null;
  const cloth = clothOf(world?.person?.cloth);
  usePageGround(cloth.paper);

  if (res?.state === "held") return <HeldPage onBack={goBack} />;

  const person = world?.person || null;
  const first = firstOf(person?.name);
  const kicker = world && first ? `${first}’s world` : "A virtual passport";
  const report = reportTraveler(world || { slug });
  // Your own circle knows the edge best once it has loaded; the world's relation covers the
  // rest (it is read for this person, and again after every action).
  const rel = world && !world.fallback
    ? (circle.status === "ready" ? circle.relationOf({ user_id: person.user_id, handle: person.handle }) : null) ?? relationFromWorld(world.relation)
    : null;

  const outline = { minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1.5px solid ${cloth.cloth}`, fontFamily: "inherit", fontSize: fs(14), fontWeight: 600, color: cloth.cloth, cursor: "pointer" };
  const solid = { ...outline, background: cloth.cloth, border: 0, color: NEUTRAL.white };

  let body;
  if (!res) {
    body = (
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none"
        style={{ position: "relative", zIndex: 1, marginTop: -72, height: 280, borderRadius: 18, background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}` }} />
    );
  } else if (res.state === "error") {
    body = (
      <Notice title="Couldn’t open this page" body="Check your connection and try again.">
        <button type="button" onClick={() => setTick((t) => t + 1)} style={solid}>Try again</button>
        <button type="button" onClick={goBack} style={outline}>Back</button>
      </Notice>
    );
  } else if (res.state === "private") {
    body = (
      <Notice title="This passport is private or no longer available.">
        <button type="button" onClick={goBack} style={solid}>Back</button>
        {report ? <button type="button" onClick={() => setReporting(true)} style={outline}>Report</button> : null}
      </Notice>
    );
  } else if (!world) {
    body = (
      <Notice title="This page isn’t available.">
        <button type="button" onClick={goBack} style={solid}>Back</button>
      </Notice>
    );
  } else {
    const firstCard = { marginTop: -72, position: "relative", zIndex: 1 };
    body = (
      <>
        {SHOW_LUGGAGE && world.luggage ? (
          <Luggage variant="card" readOnly cloth={cloth.key} stamps={orderedStamps} luggage={world.luggage}
            ownerFlags={world.flags || {}} ownerFirst={first} style={firstCard} />
        ) : null}
        <Bookplate
          mode="visit"
          cloth={cloth.key}
          avatar={person.avatar}
          name={person.name}
          handle={person.handle}
          seal={person.verified ? person.seal || true : null}
          // Home country always; the city only when they turned it on (Settings → Privacy).
          place={person.city || person.country ? [person.city, person.country].filter(Boolean) : null}
          stats={world.stats}
          bio={world.bio || null}
          website={world.website || null}
          style={SHOW_LUGGAGE && world.luggage ? { marginTop: GAP } : firstCard}
        />
        <TravelerActions person={person} relation={rel} cloth={cloth.key} fallback={world.fallback} slug={worldSlug} report={report}
          onChanged={onChanged} style={{ marginTop: GAP }} />
        {world.private ? (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: GAP, padding: 16, background: NEUTRAL.white, border: `1px solid ${cloth.line}`, borderRadius: 16 }}>
            <Lock size={16} strokeWidth={2} color={cloth.cloth} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              {world.audience === "me"
                ? `${first ? `${first}’s` : "This"} passport is private for now.`
                : world.audience === "followers"
                ? `${first ? `${first}’s` : "This"} passport is for followers. Follow ${first || "them"} to see it.`
                : `${first ? `${first}’s` : "This"} passport is for friends — people ${first || "they"} follow${first ? "s" : ""} back. You can still send a postcard or a telegram.`}
            </p>
          </div>
        ) : null}
        {world.circle ? <TheirCircle world={world} first={first} cloth={cloth.key} inner={rel === "inner"} style={{ marginTop: GAP }} /> : null}
        {world.stamps ? (
          <PassportFolder mode="visit" cloth={cloth.key} ownerFirst={first} stamps={orderedStamps} slug={worldSlug}
            blotter={blotter} onBlotterChanged={refreshBlotter}
            onOpenDoor={worldSlug ? () => navigate(`${createPageUrl("Passport")}?view_slug=${encodeURIComponent(worldSlug)}`) : undefined}
            style={{ marginTop: GAP }} />
        ) : null}
        {/* Their City Cards at my level (2026-10-28): the cards the worker sent, none when none. */}
        {Array.isArray(world.city_cards) && world.city_cards.length ? (
          <CityCardsPage cards={world.city_cards} owner={false} first={first} style={{ marginTop: GAP }} openId={params.get("card")} openStamp={params.get("stamp")} />
        ) : null}
        {world.gear ? (
          <VirtualItems readOnly gear={world.gear.gear} buddies={world.gear.buddies} layout={world.gear.layout}
            stamps={orderedStamps} ownerFlags={world.flags || {}} ownerFirst={first} style={{ marginTop: GAP }} />
        ) : null}
        <MapFolder readOnly ownerFirst={first} favorites={world.favorites || []} dreams={world.dreams || []} cloth={cloth.key} style={{ marginTop: GAP }} />
        {/* Their albums, last as on your own profile (founder, 2026-10-14: friends saw no
            albums). The server sends only reviewed photos, so no packet means none yet. */}
        {world.stamps ? (
          <PhotoPackets stamps={orderedStamps} title={first ? `${first}’s photo packets` : "Their photo packets"} className="mt-8" openPhoto={params.get("photo")}
            social={worldSlug ? { slug: worldSlug, blotter, onBlotterChanged: refreshBlotter } : null} />
        ) : null}
      </>
    );
  }

  return (
    <div style={{ "--gs-focus": cloth.cloth }}>
      <div aria-hidden="true" style={{ height: 12 }} />
      <CoverBand cloth={cloth.key} kicker={kicker} leading="back" onLeading={goBack} contentMaxWidth={672} />
      <div className={COLUMN}>
        {body}
        {!res ? <span className="sr-only" role="status">Opening this page</span> : null}
      </div>
      <ReportSheet payload={reporting ? report?.payload : undefined} subject={report?.subject} onClose={() => setReporting(false)} />
    </div>
  );
}
