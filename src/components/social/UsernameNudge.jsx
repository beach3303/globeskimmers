import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { IVORY, NEUTRAL, fs } from "@/components/redesign/constants";
import useUsernameClaim from "@/components/social/useUsernameClaim";
import UsernameFields from "@/components/social/UsernameFields";

// Members who joined before sign-up asked for an @username pick one on Home (founder,
// 2026-10-16: "don't give users a not now choice … let them pick a handle already"): a sheet a
// beat after Home settles, never over another sheet (`hold`), that stays until they have one —
// no close, no "Not now". Not for under-18s or a frozen account, and not when the check
// itself failed (a network blip must never lock anyone out).

export default function UsernameNudge({ hold = false }) {
  const { socialTier, socialTierReady } = useAuth();
  const eligible = socialTierReady && !["blocked", "teen"].includes(String(socialTier || ""));
  const [phase, setPhase] = useState("waiting");   // waiting → open → done
  const [settled, setSettled] = useState(false);
  const claim = useUsernameClaim((h) => {
    setPhase("done");
    showToast(`You’re @${h} — your circle can find you now`, "success");
  }, eligible);
  const { checking, failed, mine, minor, ready, busy, submit } = claim;

  useEffect(() => { const t = setTimeout(() => setSettled(true), 1500); return () => clearTimeout(t); }, []);
  const due = eligible && settled && !hold && !checking && !failed && !mine && !minor;
  useEffect(() => {
    if (phase === "waiting" && due) setPhase("open");
  }, [phase, due]);
  useEffect(() => {
    if (phase === "open" && minor) {
      setPhase("done");
      showToast("Usernames open at 18 — until then, your passport stays yours and private", "success");
    }
  }, [phase, minor]);

  const isOpen = phase === "open";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9995]"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="username-nudge-title"
            className="fixed bottom-0 left-0 right-0 z-[9996] rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto max-h-[85vh] overflow-y-auto"
            style={{ background: IVORY, padding: "22px 20px calc(20px + env(safe-area-inset-bottom))" }}
          >
            <h2 id="username-nudge-title" className="font-serif m-0" style={{ fontSize: fs(24), lineHeight: 1.15, color: NEUTRAL.ink }}>
              Pick your <em style={{ color: NEUTRAL.brandTeal }}>@username</em>
            </h2>
            <p style={{ margin: "6px 0 16px", fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              It’s how your circle finds you, follows you and sends you postcards.
            </p>
            <UsernameFields claim={claim} idPrefix="gs-nudge" />
            <button
              type="button"
              onClick={submit}
              disabled={!ready || busy}
              className="w-full h-12 rounded-xl text-white text-[16px] font-semibold disabled:opacity-50"
              style={{ background: NEUTRAL.brandTeal, border: 0, marginTop: 4 }}
            >
              {busy ? "One moment…" : "Save my username"}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
