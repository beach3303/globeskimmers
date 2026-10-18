// FinishPassport — the one required step for every member (founder, 2026-10-18: "everybody who
// logged onto the app now who has an access before has to choose a handle and also enter their
// birthdate … a hard lock … but let's be nice about it"). Over the whole app until the account
// holds its full birthday (year, month and day) and, at 18 and over, a @username:
//   1. the birthday — ConfirmSheet in its required mode: the full date when no year is stored,
//      else the month and day, with the neutral check of the whole date;
//   2. the @username — under 18 there is none yet (useUsernameClaim's `minor`), so it's skipped.
// An under-13 birthday ends at the frozen screen (App.jsx checks the tier before this). Nothing
// to skip and no close: Sign out is the only other way. A read that fails never locks anyone
// out — the screen stays away until the next open. Onboarding asks both itself, so a member
// still in it isn't asked twice. When nothing is missing, ConfirmBirthday keeps its old job: the
// re-ask when a stamp or a post is refused — and the one-time privacy check-up gets its turn.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { getAgeInfo, getHandle } from "@/lib/passport";
import ConfirmBirthday, { ConfirmSheet } from "@/components/auth/ConfirmBirthday";
import useUsernameClaim from "@/components/social/useUsernameClaim";
import UsernameFields from "@/components/social/UsernameFields";
import PrivacyCheckup from "@/components/auth/PrivacyCheckup";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const IVORY = "#FFFCF7", STAMP = "#B0472F";

export default function FinishPassport() {
  const { user, profile, refreshSocialTier, logout } = useAuth();
  const { pathname } = useLocation();
  const [need, setNeed] = useState(null);   // { birthday, handle, steps } while something is missing
  const [clear, setClear] = useState(false); // read, and nothing is missing: the privacy check-up may ask
  const total = useRef(0);                   // the steps counted at the start, so step 2 still reads "2 of 2"
  const firstName = String(profile?.first_name || "").trim() || null;
  const onboarded = profile?.onboarding_completed === true && !/^\/onboarding/i.test(pathname);

  const check = useCallback(async () => {
    const [age, h] = await Promise.all([getAgeInfo(), getHandle()]);
    if (age.error || h.error) { setNeed(null); setClear(false); return; }
    const birthday = !age.set || !age.birth_md;
    const handle = !h.handle && age.tier !== "teen" && age.tier !== "blocked";
    const steps = (birthday ? 1 : 0) + (handle ? 1 : 0);
    if (steps > total.current) total.current = steps;
    setNeed(steps ? { birthday, handle, steps } : null);
    setClear(!steps);
  }, []);
  useEffect(() => {
    if (!user?.id || !onboarded) { setNeed(null); setClear(false); return; }
    check();
  }, [user?.id, onboarded, check]);

  if (!need) return <><ConfirmBirthday /><PrivacyCheckup enabled={clear} /></>;
  const label = (n) => (total.current > 1 ? `Step ${n} of ${total.current}` : null);

  if (need.birthday) {
    return (
      <ConfirmSheet required account={user} firstName={firstName} stepLabel={label(1)} onSignOut={logout}
        onLater={() => {}}
        onNothingToAsk={async () => { await refreshSocialTier(); check(); }}
        onSaved={async () => {
          const tier = await refreshSocialTier();
          if (tier !== "blocked") showToast("Saved privately 🎂", "success");
          check();
        }} />
    );
  }
  return (
    <UsernameStepRequired firstName={firstName} stepLabel={label(total.current)} onSignOut={logout}
      onDone={(h, teen) => {
        showToast(teen ? "Usernames open at 18 — until then, your passport stays yours and private" : `You’re @${h} — welcome back!`, "success");
        check();
      }} />
  );
}

// The @username, full screen and required: the same fields and checks as sign-up's step.
function UsernameStepRequired({ firstName, stepLabel, onDone, onSignOut }) {
  const claim = useUsernameClaim((h) => onDone(h, false), true);
  const { checking, minor, ready, busy, submit } = claim;
  useEffect(() => { if (minor) onDone(null, true); }, [minor]);   // a teen's birthday: no username yet
  return (
    <div className="fixed inset-0 z-[10040] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="gs-finish-h"
      style={{ background: IVORY, padding: "calc(28px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))" }}>
      <div className="max-w-md mx-auto">
        <div className="uppercase" style={{ fontSize: fs(10), letterSpacing: ".2em", color: STAMP, fontWeight: 700 }}>
          Globeskimmers{stepLabel ? ` · ${stepLabel}` : ""}
        </div>
        <h1 id="gs-finish-h" className="font-serif m-0" style={{ fontSize: fs(30), lineHeight: 1.1, color: NEUTRAL.ink, marginTop: 8 }}>
          Pick your <em style={{ color: NEUTRAL.brandTeal }}>@username</em>
        </h1>
        <p style={{ margin: "10px 0 18px", fontSize: fs(15), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
          {`Welcome back${firstName ? `, ${firstName}` : ""}! Everyone on GlobeSkimmers now has a @username — it’s how your circle finds you, follows you and sends you postcards. Pick yours and you’re all set.`}
        </p>
        <UsernameFields claim={claim} idPrefix="gs-finish" />
        <button type="button" onClick={submit} disabled={checking || !ready || busy}
          className="w-full h-12 rounded-xl text-white text-[16px] font-semibold disabled:opacity-50"
          style={{ background: NEUTRAL.brandTeal, border: 0, marginTop: 4 }}>
          {busy ? "One moment…" : "Save and continue"}
        </button>
        <button type="button" onClick={onSignOut} className="mt-3 w-full flex items-center justify-center"
          style={{ minHeight: 44, fontSize: fs(13), color: NEUTRAL.ink3, background: "transparent", border: 0 }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
