// HeardFromStep — one optional tap at onboarding: where did you hear about GlobeSkimmers?
// (growth plan, 2026-10-19: links in TikTok, Instagram and Facebook posts can't be tapped, and
// an iPhone carries nothing from the App Store into the app, so the member's own answer is
// the one honest source-of-install signal). Skip is a first-class answer; nothing is guessed.
import React from "react";
import { Megaphone, ChevronRight } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";

const SOURCES = [
  ["fb", "Facebook"], ["tiktok", "TikTok"], ["ig", "Instagram"], ["yt", "YouTube"],
  ["friend", "A friend or family"], ["group", "A group or an event"], ["other", "Somewhere else"],
];

export default function HeardFromStep({ value = null, onNext, onBack }) {
  const fs = (px) => `calc(${px}px * var(--fs, 1))`;
  return (
    <OnboardingStepLayout
      icon={<Megaphone className="w-8 h-8 text-white" />}
      title="Where did you hear about us?"
      subtitle="One tap, and optional. It helps us know where to say hello next."
      onBack={onBack}
      footer={
        <button type="button" onClick={() => onNext({ heard_from: null })}
          className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 font-semibold"
          style={{ background: "transparent", color: "#3A3128", fontSize: fs(15), border: "1.5px solid rgba(22,17,13,.16)" }}>
          Skip
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      }
    >
      <div role="group" aria-label="Where did you hear about GlobeSkimmers" className="flex flex-wrap gap-2 mt-2">
        {SOURCES.map(([key, label]) => {
          const on = value === key;
          return (
            <button key={key} type="button" onClick={() => onNext({ heard_from: key })} aria-pressed={on}
              className="rounded-full px-4 font-semibold"
              style={{ minHeight: 44, background: on ? "#0E7C86" : "#fff", color: on ? "#fff" : "#16110D", border: `1.5px solid ${on ? "#0E7C86" : "rgba(22,17,13,.16)"}`, fontSize: fs(14) }}>
              {label}
            </button>
          );
        })}
      </div>
    </OnboardingStepLayout>
  );
}
