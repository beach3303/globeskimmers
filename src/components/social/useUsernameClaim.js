import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getAgeGate, getHandle, heldForMe, setAgeGate, setHandle, splitDob } from "@/lib/passport";
import { workerMessage } from "@/components/social/FollowByHandle";

// Picking an @username, shared by sign-up's step and Home's ask for members who still have
// none (founder, 2026-10-16: everyone has one). The worker takes a username only once it has
// the birthday, so the birthday is asked on the same form when it is missing. Under 18 there
// is no username yet (`minor`); an under-13 meets the frozen screen (App.jsx) once the
// birthday is saved. A name held for this person (their claim link, or their sign-in email)
// comes filled in. With `enabled` false nothing is read until it turns true.
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export default function useUsernameClaim(onDone, enabled = true) {
  const { refreshSocialTier } = useAuth();
  const [token] = useState(() => { try { return sessionStorage.getItem("gs_held_token") || null; } catch { return null; } });
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mine, setMine] = useState(null);
  const [held, setHeld] = useState(null);
  const [minor, setMinor] = useState(false);
  const [askBirthday, setAskBirthday] = useState(true);
  const [draft, setDraftRaw] = useState("");
  const [dob, setDobRaw] = useState("");
  const [sugs, setSugs] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let gone = false;
    (async () => {
      const [h, gate, hf] = await Promise.all([getHandle(), getAgeGate(), heldForMe(token)]);
      if (gone) return;
      if (h.handle) setMine(h.handle);
      setFailed(!!h.error);
      if (gate.tier === "teen") setMinor(true);
      setAskBirthday(!gate.set || gate.tier === "confirm");
      if (hf.held?.handle) { setHeld(hf.held); setDraftRaw(hf.held.handle); }
      setChecking(false);
    })();
    return () => { gone = true; };
  }, [token, enabled]);

  const want = draft.trim().toLowerCase();
  const ready = HANDLE_RE.test(want) && (!askBirthday || !!splitDob(dob));
  const setDraft = (v) => { setDraftRaw(String(v || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20)); setError(null); };
  const setDob = (v) => { setDobRaw(v); setError(null); };
  const pick = (sug) => { setDraftRaw(sug); setSugs([]); setError(null); };

  const submit = async () => {
    if (busy || checking) return;
    setError(null);
    if (!HANDLE_RE.test(want)) { setError("Use 3–20 letters, numbers or _"); return; }
    const born = askBirthday ? splitDob(dob) : null;
    if (askBirthday && !born) { setError("Enter your full birthday"); return; }
    setBusy(true);
    if (born) {
      const { tier, error: yErr } = await setAgeGate(born.year, born.md);
      if (yErr && yErr !== "age_required") { setBusy(false); setError(workerMessage(yErr, "Couldn’t save your birthday. Try again.")); return; }
      setAskBirthday(false);
      await refreshSocialTier();
      if (tier === "blocked") { setBusy(false); return; }
      if (tier === "teen") { setBusy(false); setMinor(true); return; }
    }
    const res = await setHandle(want, held && want === held.handle ? token : undefined);
    setBusy(false);
    if (res.error === "age_required") { setAskBirthday(true); setError("One thing first — your birthday"); return; }
    if (res.code === "teen_hold") { setMinor(true); return; }
    if (res.error || !res.handle) {
      setSugs(res.suggestions || []);
      setError(workerMessage(res.error, "That username didn’t work. Try another."));
      return;
    }
    if (res.heldClaim) { try { sessionStorage.removeItem("gs_held_token"); } catch { /* fine */ } }
    setMine(res.handle);
    onDone?.(res.handle);
  };

  return { checking, failed, mine, held, minor, askBirthday, draft, setDraft, dob, setDob, sugs, pick, error, busy, ready, submit };
}
