import React, { useState, useEffect } from "react";
import { heldForMe, setHandle, setAgeGate } from "@/lib/passport";
import { readOsAgeRange, birthYearFromRange } from "@/lib/ageSignal";
import { showToast } from "@/components/Toast";

// The held-username ceremony (founder, 2026-10-03). When the founder has
// saved a username for this account's email, this card appears on the
// Passport: "Hello {name} — Maiza, in partnership with GlobeSkimmers, has
// saved @{handle} for you." Claiming swaps any current username (stated
// plainly before the tap), then celebrates — short, sweet, poppers, one
// travel quote. "Not now" hides it for the session; it returns until claimed.
const MONO = "'Courier Prime', 'Courier New', monospace";
const SERIF = "'Playfair Display', Georgia, serif";
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657";
const RULE = "rgba(22,17,13,.14)", STAMP = "#0E7C86";

export default function HeldHandleClaim({ fs = (n) => n }) {
  const [held, setHeld] = useState(null);     // { handle, name }
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [needYear, setNeedYear] = useState(false);
  const [year, setYear] = useState("");

  useEffect(() => {
    let gone = false;
    try { if (sessionStorage.getItem("gsk_held_snooze") === "1") return; } catch { /* fine */ }
    (async () => {
      const { held: h, current: c, error } = await heldForMe();
      if (gone || error || !h) return;
      setHeld(h); setCurrent(c);
    })();
    return () => { gone = true; };
  }, []);

  if (!held) return null;

  const claim = async () => {
    setBusy(true);
    if (needYear) {
      const { error: yErr } = await setAgeGate(Number(year));
      if (yErr && yErr !== "age_required") { setBusy(false); showToast(yErr, "error"); return; }
      setNeedYear(false);
    }
    const { handle, heldClaim, error } = await setHandle(held.handle);
    setBusy(false);
    if (error === "age_required") {
      // Prefer the OS age assertion; fall back to one inline question.
      const os = await readOsAgeRange();
      const osYear = birthYearFromRange(os);
      if (osYear) {
        const { error: aErr } = await setAgeGate(osYear);
        if (!aErr) { claim(); return; }
      }
      setNeedYear(true);
      return;
    }
    if (error) { showToast(error, "error"); return; }
    if (handle || heldClaim) setClaimed(true);
  };

  if (claimed) {
    return (
      <div className="mb-4 rounded-[18px] p-4 text-center" style={{ background: "#FFFBF0", border: "2px solid #EAD9AE" }}>
        <div style={{ fontSize: fs(34), lineHeight: 1 }}>🎉🎊</div>
        <p style={{ fontFamily: SERIF, fontSize: fs(20), color: INK, marginTop: 6 }}>@{held.handle} is yours!</p>
        <p style={{ color: INK2, fontSize: fs(13), lineHeight: 1.5, marginTop: 6 }}>
          Thank you — from Maiza &amp; GlobeSkimmers.
        </p>
        <p style={{ color: INK3, fontSize: fs(12), fontStyle: "italic", lineHeight: 1.5, marginTop: 8 }}>
          &ldquo;The world is a book, and those who do not travel read only one page.&rdquo;
          <span style={{ display: "block", fontStyle: "normal", fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", marginTop: 3 }}>— SAINT AUGUSTINE</span>
        </p>
        <p style={{ color: INK2, fontSize: fs(13), fontWeight: 600, marginTop: 8 }}>
          Enjoy stamping your world and making memories. ✈️
        </p>
        <button type="button" onClick={() => setHeld(null)} className="mt-3 rounded-xl px-5 py-2 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(13) }}>
          Let&rsquo;s go
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-[18px] p-4" style={{ background: "#FFFBF0", border: "2px solid #EAD9AE" }}>
      <p className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>💌 A username, saved for you</p>
      <p style={{ fontFamily: SERIF, fontSize: fs(19), color: INK, marginTop: 6, lineHeight: 1.25 }}>
        Hello{held.name ? ` ${held.name}` : ""},
      </p>
      <p style={{ color: INK2, fontSize: fs(13.5), lineHeight: 1.5, marginTop: 4 }}>
        Maiza, in partnership with GlobeSkimmers, has saved <b>@{held.handle}</b> — just for you.
      </p>
      {current && current !== held.handle && (
        <p style={{ color: "#8A5410", fontSize: fs(12), lineHeight: 1.45, marginTop: 6 }}>
          Claiming will change your current username <b>@{current}</b> to <b>@{held.handle}</b>.
        </p>
      )}
      <div className="flex gap-2 mt-3 items-center flex-wrap">
        {needYear && (
          <input value={year} onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="Born (e.g. 1990)" inputMode="numeric" aria-label="Year you were born"
            className="w-32 h-11 rounded-xl px-3 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13) }} />
        )}
        <button type="button" onClick={claim} disabled={busy || (needYear && year.length !== 4)}
          className="h-11 px-5 rounded-xl font-semibold disabled:opacity-50" style={{ background: STAMP, color: "#fff", fontSize: fs(13.5) }}>
          {busy ? "Claiming…" : `Claim @${held.handle}`}
        </button>
        <button type="button" onClick={() => { try { sessionStorage.setItem("gsk_held_snooze", "1"); } catch { /* fine */ } setHeld(null); }}
          style={{ color: INK3, fontSize: fs(12) }}>
          Not now
        </button>
      </div>
      {needYear && (
        <p style={{ color: INK3, fontSize: fs(10.5), marginTop: 6 }}>One thing first — usernames need the year you were born (asked once, never shown).</p>
      )}
    </div>
  );
}
