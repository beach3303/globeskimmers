// DestinationStrip — the "everything <place>" affordance. When a bare place is
// searched from the Smart-Search spine (no category), Home re-centers on it AND
// shows this strip: a clear "Exploring <place>" header + quick-jumps into each
// world for that destination. Turns a silent re-center into an intentional
// destination hub. Dismissible; reappears on the next place search.
import React from "react";
import { X } from "lucide-react";

const JUMPS = [
  { emoji: "🍽️", label: "Eat", action: "Places to Eat" },
  { emoji: "☕", label: "Coffee", action: "Coffee" },
  { emoji: "🎭", label: "Things to do", action: "Things to Do" },
  { emoji: "🛍️", label: "Shopping", action: "Shopping" },
];

export default function DestinationStrip({ place, onAction, onDismiss, wide = false }) {
  if (!place) return null;
  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="rounded-2xl p-3.5" style={{ background: "linear-gradient(135deg,#0E7C73,#17A38F)", boxShadow: "0 10px 26px -14px rgba(14,124,115,.55)" }}>
          <div className="flex items-start gap-2.5">
            <span style={{ fontSize: 20, lineHeight: 1 }}>🌍</span>
            <div className="min-w-0 flex-1">
              <div className="text-[calc(10.5px*var(--fs))] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,.82)" }}>Exploring</div>
              <div className="font-serif text-[calc(20px*var(--fs))] leading-tight text-white truncate">{place}</div>
            </div>
            <button onClick={onDismiss} aria-label="Dismiss" className="flex-none -mt-1 -mr-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ color: "rgba(255,255,255,.9)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            {JUMPS.map((j) => (
              <button
                key={j.label}
                onClick={() => onAction?.(j.action)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[calc(12.5px*var(--fs))] font-semibold transition-transform active:scale-95"
                style={{ background: "rgba(255,255,255,0.92)", color: "#0E5A54" }}
              >
                <span>{j.emoji}</span>{j.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
