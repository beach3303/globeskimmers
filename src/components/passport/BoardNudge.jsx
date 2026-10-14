// BoardNudge: after a verified stamp in a city, a small airmail card above the nav offers that
// city's board (founder, 2026-10-14: the after-stamp prompt, "Send the first postcard to
// Lisbon's board"). Only travelers who were really there can post to a board, so the moment
// they stamp is the moment they can. Mounted once in Layout; it listens for 'gs:stamped'
// (addStamp / uploadStampPhoto in passport.js).
//
// It shows only when the worker says you may post there (an adult with a verified stamp in the
// city), never during onboarding, and once per city on this phone. It waits for the stamp's own
// toast, sits above the nav without covering the page, and leaves after 20 s. Tapping it opens
// the postcard to that board; a sent card opens the board.
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cityBoard } from "@/lib/passport";
import { cityBoardUrl, countryName } from "@/lib/boardLinks";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { PostmarkRing } from "@/components/social/Envelope";
import PostcardCompose from "@/components/passport/PostcardCompose";

const SERIF = "'Instrument Serif', Georgia, serif";
const BLUE = NEUTRAL.airmailBlue;
const SEEN_KEY = "gs_board_nudge_v1";

// Cities this phone has been offered already (a short list; storage can be missing).
function offered() {
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function markOffered(key) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([key, ...offered().filter((k) => k !== key)].slice(0, 200))); } catch { /* storage off */ }
}

export default function BoardNudge() {
  const { socialTier, socialTierReady } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [nudge, setNudge] = useState(null);     // { city, country, first }
  const [compose, setCompose] = useState(false);
  const ok = socialTierReady && !["blocked", "teen", "confirm"].includes(String(socialTier || ""));
  const live = useRef({ ok, path: location.pathname });
  live.current = { ok, path: location.pathname };

  useEffect(() => {
    let gone = false;
    const onStamped = async (e) => {
      const city = String(e?.detail?.city || "").trim();
      const country = countryName(e?.detail?.country);
      if (!live.current.ok || !city || !country || /onboarding/i.test(live.current.path)) return;
      const key = `${city}|${country}`.toLowerCase();
      if (offered().includes(key)) return;
      await new Promise((r) => setTimeout(r, 1500)); // after the stamp's own toast
      const board = await cityBoard({ city, country });
      if (gone || !live.current.ok || !board.can_post || board.held || board.unavailable || board.error) return;
      markOffered(key);
      setNudge({ city, country, first: board.rows.length === 0 });
    };
    window.addEventListener("gs:stamped", onStamped);
    return () => { gone = true; window.removeEventListener("gs:stamped", onStamped); };
  }, []);

  // It leaves on its own after 20 s, unless the postcard is open.
  useEffect(() => {
    if (!nudge || compose) return undefined;
    const t = setTimeout(() => setNudge(null), 20000);
    return () => clearTimeout(t);
  }, [nudge, compose]);

  if (!nudge) return null;
  const { city, country, first } = nudge;
  return (
    <>
      {!compose ? (
        <div style={{ position: "fixed", left: 12, right: 12, bottom: "calc(96px + env(safe-area-inset-bottom))", zIndex: 9000, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div role="status" style={{ pointerEvents: "auto", width: "100%", maxWidth: 440, display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box", padding: "8px 4px 8px 12px", background: NEUTRAL.airmail, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16, boxShadow: `0 14px 30px -16px ${rgba(NEUTRAL.ink, 0.5)}` }}>
            <PostmarkRing city={city} date={new Date().toISOString()} color={BLUE} size={40} style={{ flexShrink: 0 }} />
            <button type="button" onClick={() => setCompose(true)}
              style={{ flex: 1, minWidth: 0, minHeight: 44, padding: 0, textAlign: "left", background: "transparent", border: 0, font: "inherit", cursor: "pointer" }}>
              <span style={{ display: "block", fontFamily: SERIF, fontSize: fs(17), lineHeight: 1.15, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>
                {first ? "Send the first postcard to " : "Send a postcard to "}<em style={{ fontStyle: "italic", color: BLUE }}>{city}’s</em> board
              </span>
              <span style={{ display: "block", marginTop: 2, fontSize: fs(12), lineHeight: 1.35, color: NEUTRAL.ink2 }}>You were really there, so you can.</span>
            </button>
            <button type="button" onClick={() => setNudge(null)} aria-label="Not now"
              style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, borderRadius: 999, background: "transparent", border: 0, color: NEUTRAL.ink2, cursor: "pointer" }}>
              <X size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
            </button>
          </div>
        </div>
      ) : null}
      <PostcardCompose open={compose} toCity={{ city, country }}
        onClose={() => { setCompose(false); setNudge(null); }}
        onSent={() => { setCompose(false); setNudge(null); navigate(cityBoardUrl(city, country)); }} />
    </>
  );
}
