import React from "react";
import { AtSign, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "./OnboardingStepLayout";
import useUsernameClaim from "@/components/social/useUsernameClaim";
import UsernameFields from "@/components/social/UsernameFields";

// Everyone who joins picks an @username (founder, 2026-10-16), right after the first name; the
// form and its rules live in useUsernameClaim. Under 18 reads why and goes on; an account that
// already has a username just goes on.
const continueCls =
  "w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold disabled:opacity-50";

export default function UsernameStep({ onNext, onBack }) {
  const claim = useUsernameClaim(() => onNext());
  const { checking, mine, minor, ready, busy, submit } = claim;

  const icon = <AtSign className="w-8 h-8 text-white" />;
  const goOn = (
    <Button onClick={() => onNext()} className={continueCls}>
      Continue
      <ChevronRight className="w-5 h-5 ml-2" />
    </Button>
  );

  if (mine) {
    return <OnboardingStepLayout icon={icon} title={`You’re @${mine}`} subtitle="That’s how your circle finds you, follows you and sends you postcards." onBack={onBack} footer={goOn} />;
  }
  if (minor) {
    return <OnboardingStepLayout icon={icon} title="Usernames open at 18" subtitle="Until then, your passport stays yours and private." onBack={onBack} footer={goOn} />;
  }

  return (
    <OnboardingStepLayout
      icon={icon}
      title="Pick your @username"
      subtitle="It’s how your circle finds you, follows you and sends you postcards."
      onBack={onBack}
      footer={
        <Button onClick={submit} disabled={!ready || busy || checking} className={continueCls}>
          {busy ? "One moment…" : "Continue"}
          {busy ? null : <ChevronRight className="w-5 h-5 ml-2" />}
        </Button>
      }
    >
      <UsernameFields claim={claim} idPrefix="gs-onb" />
    </OnboardingStepLayout>
  );
}
