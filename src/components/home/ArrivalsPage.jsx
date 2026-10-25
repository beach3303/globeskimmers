// ArrivalsPage — Home's Arrivals page (founder's decision sheet, 2026-10-25: the circle page is called
// "Arrivals"; "i like … being able to see who my friend circles are"). Who you follow and who follows
// you (each opens that list on the Circle screen), then where your circle has been lately
// (FriendsTravels: their newest stamps and postcards), then + Add friends. New arrivals — who just
// joined, by @username and city only — joins this page with its own build.
//
// Nothing social shows until the age tier is known, and nothing for a held account; counts only once
// they've loaded (never a fake 0).
import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, UserPlus } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import useCircle from "@/lib/useCircle";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { Face } from "@/components/social/SocialMarks";
import FriendsTravels from "@/components/home/FriendsTravels";
import TeenHoldNote from "@/components/social/TeenHoldNote";

const SERIF = "'Instrument Serif', Georgia, serif";
const BLUE = NEUTRAL.airmailBlue;
const HELD = new Set(["teen", "blocked", "confirm"]);

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
  return (
    <div className="max-w-md md:max-w-2xl mx-auto" style={{ padding: "16px 16px 0" }}>
      <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(28), fontWeight: 400, lineHeight: 1.05, color: NEUTRAL.ink }}>
        Arrivals <em style={{ fontStyle: "italic", color: BLUE }}>from your circle</em>
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
          <button type="button" onClick={() => navigate(createPageUrl("Circle"))}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 48, marginTop: 14, borderRadius: 999, border: 0, background: BLUE, color: NEUTRAL.white, font: "inherit", fontSize: fs(14.5), fontWeight: 650, cursor: "pointer" }}>
            <UserPlus size={17} strokeWidth={2} aria-hidden="true" focusable="false" /> Add friends
          </button>
        </>
      )}
    </div>
  );
}
