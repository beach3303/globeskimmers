// Circle: your circle (bible.profile.circle_screen; Circle.dc.html). Opened from the
// profile's circle folder ('See all' and the legend rows, ?tab=inner|following|followers)
// and from Mailbox. On your paper: the 112px cover in your cloth, 'Your *circle*' with a
// back circle; the orbit at 240 on an airmail card; three tabs (Inner circle, You follow,
// Follow you) with mono counts; a search; requests first when there are any; the address
// book (CircleList); add someone by @username; the invite; and the people you blocked.
//
// It shows nothing untrue: nothing until the age tier is known, the hold note for a 13-17
// account, a skeleton while the circle loads (never 'No one here yet'), and 'Try again' when
// the read fails. Tab counts are the circle's own figures, inclusive, and a tab at zero shows
// its name alone. Faces and names open someone's world only where the worker supports
// visits (useCircle().canVisit).
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { useMyCloth } from "@/lib/cloth";
import { getHandle, getSocialProfile, socialFeed } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { usePageGround } from "@/components/redesign/PageGround";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import CoverBand from "@/components/profile/CoverBand";
import CircleOrbit from "@/components/social/CircleOrbit";
import CircleList from "@/components/social/CircleList";
import BlockedList from "@/components/social/BlockedList";
import Requests from "@/components/social/Requests";
import FollowByHandle, { workerMessage } from "@/components/social/FollowByHandle";
import InviteButton from "@/components/passport/InviteButton";
import TeenHoldNote from "@/components/social/TeenHoldNote";

const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const TABS = [
  { key: "inner", label: "Inner circle" },
  { key: "following", label: "You follow" },
  { key: "followers", label: "Follow you" },
];

const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const stampTime = (r) => { const t = Date.parse(String(r?.created_at ?? r?.visited_on ?? "")); return Number.isFinite(t) ? t : 0; };

function Cover({ cloth, onBack }) {
  return (
    <>
      <div aria-hidden="true" style={{ height: 12 }} />
      <CoverBand height={112} cloth={cloth} kicker="Your circle" title="Your *circle*" leading="back" onLeading={onBack} contentMaxWidth={672} />
    </>
  );
}

function useBack() {
  const navigate = useNavigate();
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate(createPageUrl("Profile"));
  };
}

export default function CirclePage() {
  const { socialTier, socialTierReady } = useAuth();
  const mine = useMyCloth();
  usePageGround(mine.paper, { ink: mine.cloth });
  const goBack = useBack();
  // Nothing social until the age tier is known; a 13-17 account meets the hold, and the
  // circle isn't even read for them.
  if (!socialTierReady || socialTier === "blocked" || socialTier === "confirm") return null;
  if (socialTier === "teen") {
    return (
      <div>
        <Cover cloth={mine.key} onBack={goBack} />
        <div className={COLUMN}><div style={{ marginTop: 16 }}><TeenHoldNote /></div></div>
      </div>
    );
  }
  return <CircleScreen mine={mine} onBack={goBack} />;
}

function CircleScreen({ mine, onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const circle = useCircle();
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tabRefs = useRef({});

  const [me, setMe] = useState({ handle: null, name: "", avatar: null });
  const [latest, setLatest] = useState(/** @type {Map<string, any>|null} */ (null));
  const [q, setQ] = useState("");

  useEffect(() => {
    let gone = false;
    getHandle().then((h) => { if (!gone) setMe((m) => ({ ...m, handle: h.handle || null })); });
    getSocialProfile().then((sp) => { if (!gone) setMe((m) => ({ ...m, name: sp.profile?.display_name || "", avatar: sp.profile?.avatar || null })); });
    // Their newest stamp in your feed, by handle: the only latest-stamp line that is real today.
    socialFeed().then((f) => {
      if (gone || f.error) return;
      const m = new Map();
      for (const r of f.rows || []) {
        if (r?.type !== "stamp" || !r.by?.handle || !String(r.name ?? "").trim()) continue;
        const k = lc(r.by.handle);
        if (!m.has(k) || stampTime(r) > stampTime(m.get(k))) m.set(k, r);
      }
      setLatest(m);
    });
    return () => { gone = true; };
  }, []);

  const ready = circle.status === "ready";
  const counts = ready && circle.counts ? circle.counts : {};
  const lists = useMemo(() => ({
    inner: circle.mutual || [],
    following: [...(circle.acc || []), ...(circle.pendingOut || [])],
    followers: circle.fol || [],
  }), [circle.mutual, circle.acc, circle.pendingOut, circle.fol]);
  const tabCount = { inner: counts.inner, following: counts.youFollow, followers: counts.followYou };

  const want = new URLSearchParams(location.search).get("tab");
  const fallbackTab = counts.inner ? "inner" : counts.youFollow ? "following" : counts.followYou ? "followers" : "inner";
  const tab = TABS.some((t) => t.key === want) ? want : fallbackTab;
  const setTab = (key) => navigate(`${location.pathname}?tab=${key}`, { replace: true });
  const onTabKey = (e) => {
    const i = TABS.findIndex((t) => t.key === tab);
    let j = null;
    if (e.key === "ArrowRight") j = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") j = (i + TABS.length - 1) % TABS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABS.length - 1;
    if (j === null) return;
    e.preventDefault();
    setTab(TABS[j].key);
    tabRefs.current[TABS[j].key]?.focus();
  };

  const query = fold(q.trim());
  const shown = query
    ? lists[tab].filter((p) => fold(p?.name).includes(query) || fold(p?.handle).includes(query.replace(/^@/, "")))
    : lists[tab];

  const visit = circle.canVisit
    ? (p) => { const h = lc(p?.handle); if (h) navigate(`${createPageUrl("Traveler")}?h=${encodeURIComponent(h)}`); }
    : undefined;

  const answer = (op) => async (row) => {
    const res = op === "accept" ? await circle.accept(row) : await circle.decline(row);
    if (!res.ok) { showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error"); return res; }
    if (op === "accept") showToast(row?.handle ? `@${lc(row.handle)} follows you now` : "They follow you now", "success");
    return res;
  };

  const fieldLine = mine.fieldLine;
  return (
    <div style={{ "--gs-focus": mine.cloth }}>
      <Cover cloth={mine.key} onBack={onBack} />
      {/* 56px at the end: the floating Back-to-top (44px, 12px above the nav) never covers
          the last row's buttons. */}
      <div className={COLUMN} style={{ paddingBottom: 56 }}>
        {/* The orbit at 240 on an airmail card (Circle.dc.html L42-131). */}
        <div style={{ marginTop: 16, background: NEUTRAL.airmail, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 18, overflow: "hidden" }}>
          <AirmailChevron height={4} />
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: circle.canVisit && ready ? 0 : 14 }}>
            <CircleOrbit
              size={240}
              mode="screen"
              ringCloth={mine.key}
              owner={{ name: me.name || profile?.first_name || "", handle: me.handle, avatar: me.avatar, cloth: mine.key }}
              groups={ready ? { inner: circle.mutual, following: circle.followingOnly, followers: circle.followersOnly, requests: circle.requests } : undefined}
              totals={ready ? { inner: counts.inner, youFollow: counts.youFollow, followYou: counts.followYou } : undefined}
              onFace={ready ? visit : undefined}
            />
          </div>
          {circle.canVisit && ready ? (
            <p style={{ margin: "8px 0 0", padding: "0 16px 14px", textAlign: "center", fontSize: fs(12.5), lineHeight: 16 / 12.5, color: NEUTRAL.ink2 }}>
              Tap a face to step into their world.
            </p>
          ) : null}
        </div>

        {circle.status === "error" ? (
          <div style={{ marginTop: 16, padding: 16, background: NEUTRAL.white, border: `1px solid ${mine.line}`, borderRadius: 16 }}>
            <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Couldn’t load your circle.</p>
            <button type="button" onClick={() => circle.retry()}
              style={{ marginTop: 10, minHeight: 44, padding: "0 16px", borderRadius: 14, background: "transparent", border: `1px solid ${mine.cloth}`, font: "inherit", fontSize: fs(14), fontWeight: 600, color: mine.cloth, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Your circle" onKeyDown={onTabKey}
              style={{ display: "flex", marginTop: 16, minHeight: 44, background: NEUTRAL.white, border: `1px solid ${mine.cloth}`, borderRadius: 14, overflow: "hidden" }}>
              {TABS.map((t) => {
                const on = t.key === tab;
                const n = tabCount[t.key];
                return (
                  <button key={t.key} ref={(el) => { tabRefs.current[t.key] = el; }} type="button" role="tab" id={`${ids}-tab-${t.key}`}
                    aria-selected={on} aria-controls={`${ids}-panel`} tabIndex={on ? 0 : -1} onClick={() => setTab(t.key)}
                    style={{ flex: "1 1 0", minWidth: 0, minHeight: 44, padding: "4px 6px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 5, borderRadius: 13, border: 0, background: on ? mine.cloth : "transparent", boxShadow: on ? `inset 0 0 0 3px ${NEUTRAL.white}` : "none", font: "inherit", fontSize: fs(13), lineHeight: 1.2, fontWeight: 600, textAlign: "center", color: on ? NEUTRAL.white : NEUTRAL.ink2, cursor: "pointer" }}>
                    <span>{t.label}</span>
                    {ready && n ? <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: fs(11), fontWeight: 500, color: on ? NEUTRAL.white : NEUTRAL.ink3 }}>{n}</span> : null}
                  </button>
                );
              })}
            </div>

            <label htmlFor={`${ids}-find`} className="sr-only">Find someone in your circle</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, minHeight: 48, padding: "0 14px", background: NEUTRAL.white, border: `1px solid ${fieldLine}`, borderRadius: 14 }}>
              <Search size={18} strokeWidth={2} color={mine.cloth} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
              <input id={`${ids}-find`} type="text" inputMode="search" value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))}
                placeholder="Find someone in your circle" autoComplete="off" autoCapitalize="none" spellCheck={false}
                style={{ flex: 1, minWidth: 0, height: 44, padding: 0, border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: fs(14), color: NEUTRAL.ink }} />
            </div>

            {ready && circle.requests?.length ? (
              <Requests rows={circle.requests} onAccept={answer("accept")} onDecline={answer("decline")} style={{ marginTop: 16 }} />
            ) : null}

            <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${tab}`} style={{ marginTop: 16 }}>
              {ready ? (
                <CircleList rows={shown} circle={circle} latest={latest} cloth={mine.key} canVisit={circle.canVisit}
                  emptyLabel={query ? "No one by that name here" : "No one here yet"} emptyInvite={!query} />
              ) : (
                <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none"
                  style={{ height: 220, borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${mine.line}` }} />
              )}
              {!ready ? <span className="sr-only" role="status">Loading your circle</span> : null}
            </div>
          </>
        )}

        <FollowByHandle cloth={mine.key} style={{ marginTop: 24 }} />
        {/* An empty tab already carries the invite ('No one here yet'). */}
        {ready && shown.length ? (
          <>
            <p style={{ margin: "16px 0 0", fontSize: fs(13), lineHeight: 16 / 13, color: NEUTRAL.ink2 }}>Not everyone you travel with is here yet.</p>
            <InviteButton color={mine.key} style={{ marginTop: 8 }} />
          </>
        ) : null}

        {ready ? <BlockedList circle={circle} cloth={mine.key} style={{ marginTop: 24 }} /> : null}
      </div>
    </div>
  );
}
