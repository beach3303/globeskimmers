// PassportStep — Onboarding v2's heart (founder queue #1, 2026-09-29): the
// traveler SEES their passport before they finish signing up. Their home-city
// stamp renders live (page one = where the story starts, per the meaning
// model: an origin mark, not an achievement — no red "I was here!"), over the
// Atlanta-story explainer and the one-sentence privacy promise. The actual
// mint happens in Onboarding's finish() so a dropped connection here never
// strands the account.
import React from "react";
import OnboardingStepLayout from "@/components/onboarding/OnboardingStepLayout";
import TypographicStamp from "@/components/passport/TypographicStamp";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

export default function PassportStep({ homeCity, homeCountry, firstName, onNext, onBack }) {
  const city = homeCity || homeCountry || "Home";
  return (
    <OnboardingStepLayout
      icon="🛂"
      title={firstName ? `${firstName}, your passport is ready` : "Your passport is ready"}
      subtitle="Page one is where your story starts."
      onBack={onBack}
      footer={
        <button
          type="button"
          onClick={onNext}
          className="w-full rounded-full py-3.5 font-semibold text-white"
          style={{ background: "#0E7C86", fontSize: "calc(15px * var(--fs, 1))" }}
        >
          Stamp my first page
        </button>
      }
    >
      <div className="flex flex-col items-center">
        <div style={{ background: "#FBF6EC", border: "1px solid #EADFC9", borderRadius: 16, padding: "22px 26px", boxShadow: "inset 10px 0 18px -16px rgba(0,0,0,.35)", transform: "rotate(-2deg)" }}>
          <TypographicStamp
            name={city}
            city={homeCity ? null : undefined}
            country={homeCountry}
            date={new Date().toISOString().slice(0, 10)}
            entityId={`origin-${city}`}
            width={210}
            overprint={false}
            strength={STAMP_INK_STRENGTH}
          />
          <div className="text-center" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".14em", color: "#8A5410", textTransform: "uppercase", marginTop: 10 }}>
            Page one · Home
          </div>
        </div>

        <p className="text-center" style={{ fontFamily: SERIF, fontSize: fs(19), color: "#16110D", lineHeight: 1.3, marginTop: 22, maxWidth: "26ch" }}>
          Stamps near you are the places actually worth going.
        </p>
        <p className="text-center" style={{ fontSize: fs(13.5), color: "#3A3128", lineHeight: 1.5, marginTop: 8, maxWidth: "34ch" }}>
          Be at one — the aquarium, the mountain, the famous steps — and its stamp is yours for life, dated the day you were there. Add your photos and every page becomes a memory.
        </p>
        <p className="text-center" style={{ fontSize: fs(11.5), color: "#736657", lineHeight: 1.5, marginTop: 14, maxWidth: "36ch" }}>
          Your stamps and photos are yours. We never sell your photos or your location history, and we never show ads to kids.
        </p>
      </div>
    </OnboardingStepLayout>
  );
}
