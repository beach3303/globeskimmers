import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useDismissable } from "@/lib/dismissStack";
import { showToast } from "@/components/Toast";
import { IVORY, NEUTRAL, fs } from "@/components/redesign/constants";
import useUsernameClaim from "@/components/social/useUsernameClaim";
import UsernameFields from "@/components/social/UsernameFields";

// Members who joined before sign-up asked for an @username get a gentle ask on Home (founder,
// 2026-10-16: "subtly require current users to choose a handle"): a sheet once per app launch,
// a beat after Home settles and never over another sheet (`hold`). "Not now" lets it go until
// the next launch; once they have one it never shows again. Not for under-18s or a frozen account.
const SEEN = "gs_username_nudge_v1";

export default function UsernameNudge({ hold = false }) {
  const { socialTier, socialTierReady } = useAuth();
  const eligible = socialTierReady && !["blocked", "teen"].includes(String(socialTier || ""));
  const [seen] = useState(() => { try { return sessionStorage.getItem(SEEN) === "1"; } catch { return false; } });
  const [phase, setPhase] = useState("waiting");   // waiting → open → done
  const [settled, setSettled] = useState(false);
  const claim = useUsernameClaim((h) => {
    setPhase("done");
    showToast(`You’re @${h} — your circle can find you now`, "success");
  }, eligible && !seen);
  const { checking, failed, mine, minor, ready, busy, submit } = claim;

  useEffect(() => { const t = setTimeout(() => setSettled(true), 1500); return () => clearTimeout(t); }, []);
  const due = eligible && !seen && settled && !hold && !checking && !failed && !mine && !minor;
  useEffect(() => {
    if (phase !== "waiting" || !due) return;
    setPhase("open");
    try { sessionStorage.setItem(SEEN, "1"); } catch { /* fine */ }
  }, [phase, due]);
  useEffect(() => {
    if (phase === "open" && minor) {
      setPhase("done");
      showToast("Usernames open at 18 — until then, your passport stays yours and private", "success");
    }
  }, [phase, minor]);

  const isOpen = phase === "open";
  const close = () => setPhase("done");
  useDismissable(isOpen, close);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close}
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
            <button
              type="button"
              onClick={close}
              className="block mx-auto mt-2"
              style={{ minHeight: 44, padding: "0 16px", background: "transparent", border: 0, fontSize: fs(14), fontWeight: 600, color: NEUTRAL.ink3, cursor: "pointer" }}
            >
              Not now
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
