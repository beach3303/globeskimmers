import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { IVORY } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import { useDismissable } from "@/lib/dismissStack";

// Editorial fonts (already loaded in index.html).
const SERIF = '"Instrument Serif", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INK = "#16110D";
const INK3 = "#736657";
const RULE = "rgba(22,17,13,.10)";
const GOLD = "#F0D49A";

// AUTO_MS — if the user does nothing, the splash auto-dismisses to HOME after
// this long (30s — long enough to read it comfortably).
const AUTO_MS = 30000;

// The five "where should we start?" starters — DISPLAY ONLY (not clickable, no
// chevron). They illustrate what the app does; only Start exploring / Skip / ✕
// advance the flow.
const STARTERS = [
  { n: "01", emoji: "📍", title: "Use my current location", sub: "Find what’s around you right now.", bg: "#2D6BE0" },
  { n: "02", emoji: "🏨", title: "Search near my hotel or address", sub: "Measure everything from where you’re staying.", bg: "#0F8A82" },
  { n: "03", emoji: "✈️", title: "Plan around an airport or destination", sub: "Scout essentials before you even land.", bg: "#3F49D4" },
  { n: "04", emoji: "🍽️", title: "Find food, coffee, ATMs & restrooms nearby", sub: "The daily essentials, wherever you point the map.", bg: "#D8443C" },
  { n: "05", emoji: "🛂", title: "Your Virtual Passport", sub: "Collect beautiful stamps where you go — verified.", bg: "#D4861A" },
];

// First-launch welcome splash, shown BEFORE the location selector.
//  • onProceed — Start exploring, Skip (×2), or the ✕ → opens the location selector.
//  • onTimeout — 30s with no interaction → goes straight home.
// Tapping anywhere else (incl. the starter rows) does nothing.
export default function WelcomeSplash({ onProceed, onTimeout }) {
  const isTablet = useIsTablet();
  const t = (tab, phone) => (isTablet ? tab : phone);
  const fs = (n) => `calc(${n}px * var(--fs, 1))`;

  // Swipe-down dismiss → same as the ✕ / Skip buttons (opens location selector).
  useDismissable(true, onProceed);

  useEffect(() => {
    const timer = setTimeout(onTimeout, AUTO_MS); // no interaction → home
    return () => clearTimeout(timer);
  }, [onTimeout]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[120] overflow-y-auto"
      style={{ background: IVORY }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Globeskimmers"
    >
      <div className="min-h-full flex flex-col">
        {/* ── HERO (teal) ─────────────────────────────────────────────── */}
        <div
          className="relative px-6 text-center"
          style={{
            background: "radial-gradient(125% 85% at 72% 0%, #3A7A70 0%, #245A53 55%, #1B453F 100%)",
            paddingTop: "calc(env(safe-area-inset-top) + 22px)",
            paddingBottom: t(40, 30),
          }}
        >
          {/* ✕ → same as skipping (opens the location selector) */}
          <button
            onClick={onProceed}
            aria-label="Close and choose a location"
            className="absolute flex items-center justify-center rounded-full active:scale-95 transition-transform"
            style={{ top: "calc(env(safe-area-inset-top) + 14px)", right: 16, width: t(40, 36), height: t(40, 36), background: "rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.18)" }}
          >
            <X size={t(20, 18)} color="rgba(255,255,255,.92)" strokeWidth={2.2} />
          </button>

          <div className={`mx-auto ${isTablet ? "max-w-[760px]" : "max-w-md"}`}>
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{ background: "rgba(12,28,26,.5)", border: "1px solid rgba(255,255,255,.14)" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: "#54E0A6", boxShadow: "0 0 8px #54E0A6" }} />
              <span className="font-semibold" style={{ color: "#EAF5F1", fontSize: fs(t(14, 13)) }}>Ready when you are</span>
            </div>

            <p className="uppercase mt-5" style={{ fontFamily: MONO, color: GOLD, fontSize: fs(t(13, 11)), letterSpacing: ".22em" }}>
              Welcome to Globeskimmers
            </p>

            <h1 className="mt-3 leading-[1.04]" style={{ fontFamily: SERIF, color: "#FFFFFF", fontSize: fs(t(54, 32)) }}>
              Search here, there, or{" "}
              <span className="italic" style={{ color: GOLD }}>before you arrive.</span>
            </h1>

            <p className="mx-auto mt-4" style={{ color: "rgba(255,255,255,.85)", fontSize: fs(t(17.5, 14.5)), lineHeight: 1.5, maxWidth: t(620, 360) }}>
              Find essentials near your current location, your hotel, an airport, a landmark, or anywhere in the world — even while you’re still on the way.
            </p>
          </div>
        </div>

        {/* ── STARTERS (ivory card) ───────────────────────────────────── */}
        <div className="flex-1 px-5" style={{ background: IVORY }}>
          <div className={`mx-auto ${isTablet ? "max-w-[760px]" : "max-w-md"}`} style={{ paddingTop: t(28, 22), paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}>
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="uppercase" style={{ fontFamily: MONO, color: INK3, fontSize: fs(t(12, 11)), letterSpacing: ".16em" }}>
                Where should we start?
              </p>
              <button onClick={onProceed} className="font-semibold" style={{ color: "#1F6F61", fontSize: fs(t(13.5, 12.5)) }}>
                or <span className="underline underline-offset-2">skip for now</span>
              </button>
            </div>

            {/* Display-only rows (not clickable, no chevron). */}
            <div className="space-y-3">
              {STARTERS.map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i + 0.1, duration: 0.25 }}
                  className="w-full flex items-center gap-3.5 rounded-2xl"
                  style={{ background: "#FFFFFF", border: `1px solid ${RULE}`, boxShadow: "0 6px 20px -14px rgba(22,17,13,.22)", padding: t(18, 14) }}
                >
                  <span className="flex-none font-semibold" style={{ fontFamily: MONO, color: INK3, fontSize: fs(t(15, 13)) }}>{s.n}</span>
                  <span
                    className="flex-none rounded-xl flex items-center justify-center"
                    style={{ background: s.bg, width: t(52, 44), height: t(52, 44), fontSize: fs(t(24, 20)), boxShadow: `0 8px 18px -10px ${s.bg}` }}
                  >
                    {s.emoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block" style={{ fontFamily: SERIF, color: INK, fontSize: fs(t(20.5, 16.5)), lineHeight: 1.15 }}>{s.title}</span>
                    <span className="block mt-0.5" style={{ color: INK3, fontSize: fs(t(13.5, 12)), lineHeight: 1.35 }}>{s.sub}</span>
                  </span>
                </motion.div>
              ))}
            </div>

            <button
              onClick={onProceed}
              className="w-full mt-6 rounded-full font-semibold active:scale-[.99] transition-transform"
              style={{ background: "linear-gradient(180deg, #2F8472 0%, #226B5C 100%)", color: "#fff", fontSize: fs(t(18, 16)), paddingTop: t(18, 15), paddingBottom: t(18, 15), boxShadow: "0 16px 34px -16px rgba(34,107,92,.6)" }}
            >
              Start exploring →
            </button>

            <button onClick={onProceed} className="w-full mt-3 text-center" style={{ color: INK3, fontSize: fs(t(14, 13.5)) }}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
