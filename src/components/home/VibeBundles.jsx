// VibeBundles — Discover "what's the vibe?" mood combos on Home. Pick a mood →
// its slots expand as chips, each routing to the right finder (real cards there,
// no new API spend) or a free Google-Maps search for local-life types. Mood labels
// only (never demographic). Persona gives a light re-order. Selections are logged
// for the demand loop.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLocation } from "@/components/location/LocationContext";
import { usePersona } from "@/lib/persona";
import { orderedBundles, mapsSearchUrl } from "@/lib/vibeBundles";
import { logDiscover } from "@/lib/logDiscover";
import { openPartner } from "@/lib/openPartner";

const INK = "#16302B", SUB = "#71827D", EDGE = "#E6DFD0", TEAL = "#0E7C73";

// Shared partner opener (in-app sheet on native) — see src/lib/openPartner.js
const openExternal = openPartner;

export default function VibeBundles({ wide = false }) {
  const navigate = useNavigate();
  const persona = usePersona();
  const { getActiveLocation } = useLocation();
  const [open, setOpen] = useState(null);

  const base = getActiveLocation?.() || null;
  const addr = base?.address || {};
  const city = addr.city || base?.city || base?.placeName || "";

  const bundles = orderedBundles(persona);

  const toggle = (b) => {
    const next = open === b.id ? null : b.id;
    setOpen(next);
    if (next) logDiscover("vibe_select", { vibe: b.id });
  };

  const go = (b, slot) => {
    logDiscover("discover_select", { vibe: b.id, slot: slot.label, dest: slot.dest.page || `maps:${slot.dest.maps}` });
    if (slot.dest.page) {
      navigate(createPageUrl(slot.dest.page), slot.dest.query ? { state: { presetQuery: slot.dest.query } } : undefined);
    } else if (slot.dest.maps) {
      openExternal(mapsSearchUrl(slot.dest.maps, city));
    }
  };

  const openBundle = open ? bundles.find((x) => x.id === open) : null;

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="mb-2 px-0.5">
          <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: INK }}>What&rsquo;s the vibe? ✨</div>
          <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: SUB }}>
            {city ? `Pick a mood — we'll map your day in ${city}` : "Pick a mood — we'll map your day"}
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {bundles.map((b) => {
            const on = open === b.id;
            return (
              <button
                key={b.id}
                onClick={() => toggle(b)}
                aria-pressed={on}
                className={`flex-none ${wide ? "w-[150px]" : "w-[132px]"} rounded-2xl p-3 text-left transition-colors`}
                style={{ background: on ? TEAL : "#fff", color: on ? "#fff" : INK, border: `1px solid ${on ? TEAL : EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}
              >
                <div className="text-[24px] leading-none mb-1.5">{b.emoji}</div>
                <div className="font-serif text-[calc(15px*var(--fs))] leading-tight">{b.title}</div>
                <div className="text-[calc(11px*var(--fs))] mt-0.5" style={{ color: on ? "rgba(255,255,255,.85)" : SUB }}>{b.sub}</div>
              </button>
            );
          })}
        </div>

        {openBundle && (
          <div className="mt-2.5 rounded-2xl p-3 bg-white" style={{ border: `1px solid ${EDGE}` }}>
            <div className="text-[calc(12px*var(--fs))] mb-2" style={{ color: SUB }}>{openBundle.emoji} {openBundle.title} — tap to find each nearby</div>
            <div className="flex flex-wrap gap-2">
              {openBundle.slots.map((s, i) => (
                <button
                  key={i}
                  onClick={() => go(openBundle, s)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full transition-colors hover:bg-black/[0.03]"
                  style={{ background: "#F7F4EC", color: INK, border: `1px solid ${EDGE}`, fontSize: "calc(12.5px*var(--fs))", fontWeight: 600 }}
                >
                  <span aria-hidden="true">{s.emoji}</span> {s.label} <span style={{ color: TEAL }} aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
