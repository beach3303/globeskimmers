// DreamAnswerCard — the Smart-Search "dream destination" answer card.
//
// Rendered by SmartSearchOverlay when /parse-search returns a non-null
// `destination` (a dream query like "see bears catch fish"). Grounded answers
// (matched to an owned world/national attraction row, with real coordinates)
// get the full card: kicker, serif name, mono place line, and actions —
// including "Build my vacation", the Smart-Package composer entry (coords-
// dependent, so grounded only). An ungrounded suggestion is honest about
// itself — quieter styling, a "Suggested — unverified" kicker, no
// coordinate-dependent actions, and only a Things-to-Do search as the
// fallback. One teal action max. Grounded answers also get a quiet
// "See photos" line that opens the DreamGallery photo sheet (the dream
// browser) for the destination — dreaming in pictures before committing.
import { useState } from "react";
import DreamGallery from "@/components/home/DreamGallery";
import { TEAL_DEEP, IVORY_2 } from "@/components/redesign/constants";

const INK = "#16302B", SUB = "#71827D", EDGE = "#E6DFD0";

export default function DreamAnswerCard({ destination, onView, onPerfectDay, onSearchThings }) {
  const [showGallery, setShowGallery] = useState(false);
  if (!destination?.name) return null;
  const grounded = !!destination.grounded;
  const placeLine = [destination.city, destination.country].filter(Boolean).join(" · ");

  return (
    <div
      className="mt-4 rounded-2xl p-4"
      style={grounded
        ? { background: "#fff", border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }
        : { background: IVORY_2, border: `1px solid ${EDGE}` }}
    >
      <div className="font-mono uppercase tracking-[0.14em] text-[calc(10px*var(--fs))] font-semibold" style={{ color: SUB }}>
        {grounded ? "Dream destination" : "Suggested — unverified"}
      </div>
      <div className="font-serif text-[calc(22px*var(--fs))] leading-tight mt-1" style={{ color: INK }}>{destination.name}</div>
      {placeLine && (
        <div className="font-mono text-[calc(11.5px*var(--fs))] mt-1" style={{ color: SUB }}>{placeLine}</div>
      )}
      {grounded ? (
        <div className="mt-3.5">
          <div className="flex items-center gap-2">
            <button
              onClick={onView}
              className="flex-1 min-w-0 h-11 rounded-xl font-semibold text-white text-[calc(13.5px*var(--fs))] px-3 flex items-center justify-center"
              style={{ background: TEAL_DEEP }}
            >
              <span className="truncate">View {destination.name}</span>
            </button>
            <button
              onClick={onPerfectDay}
              className="flex-none h-11 rounded-xl font-semibold text-[calc(13.5px*var(--fs))] px-3.5"
              style={{ background: IVORY_2, color: INK, border: `1px solid ${EDGE}` }}
            >
              Plan a perfect day
            </button>
          </div>
          {/* Quiet secondary: browse real photos of the place first. */}
          <button
            onClick={() => setShowGallery(true)}
            className="mt-2 w-full text-center font-mono uppercase tracking-[0.08em] text-[calc(10px*var(--fs))] font-semibold underline underline-offset-2"
            style={{ color: SUB }}
          >
            See photos
          </button>
        </div>
      ) : (
        <button
          onClick={onSearchThings}
          className="mt-3.5 w-full h-11 rounded-xl font-semibold text-[calc(13.5px*var(--fs))]"
          style={{ background: "#fff", color: INK, border: `1px solid ${EDGE}` }}
        >
          Search Things to Do
        </button>
      )}
      {grounded && (
        <DreamGallery
          open={showGallery}
          onClose={() => setShowGallery(false)}
          dest={{ name: destination.name, city: destination.city, country: destination.country, lat: destination.lat, lng: destination.lng }}
        />
      )}
    </div>
  );
}
