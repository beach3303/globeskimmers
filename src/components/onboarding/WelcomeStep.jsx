// WelcomeStep — the one screen after sign-in (founder, 2026-11-08: "as simple as possible: email,
// birthday, handle, and they're in"). First name, birthday, @username, Continue. The birthday and the
// username go through useUsernameClaim, the same rules as Settings and the passport gate, so nothing
// here is asked twice later; an account that already has a username keeps it, and a minor's birthday
// means no username and straight on. The username starts as the first name, until they type their own.
import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "./OnboardingStepLayout";
import useUsernameClaim from "@/components/social/useUsernameClaim";
import UsernameFields from "@/components/social/UsernameFields";

const continueCls =
  "w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold disabled:opacity-50";
const inputCls =
  "w-full h-12 px-4 rounded-xl border-2 border-gray-300 focus:border-[#088395] bg-white outline-none text-[16px] text-[#0F1419] placeholder:text-black/35";

export default function WelcomeStep({ firstName: given = "", onDone }) {
  const [first, setFirst] = useState(given || "");
  const [nameError, setNameError] = useState(null);
  // Who sees your passport (founder decision 4B, 2026-11-20): asked ONCE, here. Friends is the
  // default; every stamp and album follows it; the per-stamp controls stay under More. A minor
  // can pick Only me or Friends (the wider levels open at 18, as everywhere).
  const [audience, setAudience] = useState("inner");
  const done = useRef(false);
  const finish = (handle) => {
    if (done.current) return;
    done.current = true;
    onDone({ first_name: first.trim(), audience, ...(handle ? { handle } : {}) });
  };
  const claim = useUsernameClaim((h) => finish(h));
  const { checking, mine, minor, ready, busy, submit, draft, setDraft } = claim;
  const name = first.trim();

  // A minor's birthday: no username yet, and nothing else to ask here.
  useEffect(() => { if (minor && name) finish(null); }, [minor, name]);   // eslint-disable-line react-hooks/exhaustive-deps
  // The username starts as the first name, until they type their own.
  useEffect(() => {
    if (!draft && name) setDraft(name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
  }, [name]);   // eslint-disable-line react-hooks/exhaustive-deps

  const go = () => {
    if (!name) { setNameError("What should we call you?"); return; }
    setNameError(null);
    if (mine) { finish(mine); return; }   // already has a username (claimed elsewhere): done
    submit();                              // saves the birthday and the username, then finish(handle)
  };

  const icon = <UserRound className="w-8 h-8 text-white" />;
  return (
    <OnboardingStepLayout
      icon={icon}
      title="Welcome aboard"
      subtitle={mine ? `You’re @${mine}. Just your name, and you’re in.` : "Your name, your birthday and your @username. That’s all."}
      footer={
        <Button onClick={go} disabled={busy || checking || (!mine && !ready)} className={continueCls}>
          {busy ? "One moment…" : "Continue"}
          {busy ? null : <ChevronRight className="w-5 h-5 ml-2" />}
        </Button>
      }
    >
      <label htmlFor="gs-welcome-first" className="block text-[14px] font-semibold text-[#0F1419]">First name</label>
      <input
        id="gs-welcome-first"
        className={inputCls + " mt-1 mb-4"}
        type="text" autoComplete="given-name" placeholder="First name" autoCapitalize="words"
        value={first} onChange={(e) => { setFirst(e.target.value); setNameError(null); }}
      />
      {nameError ? <p role="alert" className="-mt-2 mb-3 px-1 text-[13px] font-medium text-red-600">{nameError}</p> : null}
      {!mine ? <UsernameFields claim={claim} idPrefix="gs-welcome" /> : null}

      <fieldset className="mt-5" style={{ border: 0, padding: 0, margin: "20px 0 0" }}>
        <legend className="block text-[14px] font-semibold text-[#0F1419]">Who sees your passport?</legend>
        <p className="mt-0.5 mb-2 text-[12.5px] text-[#736657]">Every stamp and photo follows this. Change it any time in Settings.</p>
        <div role="radiogroup" aria-label="Who sees your passport" className="flex flex-col gap-2">
          {[
            ["inner", "Friends", "People you follow who follow you back", true],
            ...(minor ? [] : [["public", "Everyone", "Anyone with your link, like a public profile", false]]),
            ["me", "Only me", "A private journal; share single stamps when you want", false],
          ].map(([key, label, line, recommended]) => (
            <button key={key} type="button" role="radio" aria-checked={audience === key} onClick={() => setAudience(key)}
              className="w-full text-left flex items-start gap-3 rounded-xl px-3 py-2.5"
              style={{ background: audience === key ? "rgba(14,124,115,.06)" : "#fff", border: `1px solid ${audience === key ? "#0E7C73" : "rgba(22,17,13,.14)"}`, boxShadow: audience === key ? "inset 0 0 0 1px #0E7C73" : "none", fontFamily: "inherit" }}>
              <span aria-hidden="true" style={{ flex: "none", width: 18, height: 18, marginTop: 2, borderRadius: 999, border: audience === key ? "5px solid #0E7C73" : "1.5px solid #A8997F", boxSizing: "border-box" }} />
              <span style={{ minWidth: 0 }}>
                <span className="block text-[14px] font-semibold text-[#0F1419]">{label}{recommended ? <span className="ml-2 text-[10px] font-semibold tracking-[.12em] uppercase" style={{ color: "#0E7C73" }}>Recommended</span> : null}</span>
                <span className="block text-[12px] text-[#736657] mt-0.5">{line}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    </OnboardingStepLayout>
  );
}
