import React from "react";
import DistanceUnitToggle from "./DistanceUnitToggle";

// Shared ONE-LINE radius control used by every finder page so they all look
// identical: the distance buttons (e.g. 5 / 10 / 15 / 25) flex to share the
// row, with the mi/km toggle pinned to the right. No "Radius" label. The
// buttons flex-shrink so the row always fits the viewport — no sideways scroll.
//
// Props:
//   options  — array of numbers, e.g. [5, 10, 15, 25] (button labels render as "<n> <unit>")
//   value    — currently-selected number
//   onChange — (n) => void
//   ink      — the page's accent color (selected button bg / border)
//   unit     — 'mi' | 'km'
//   setUnit  — (u) => void
export default function RadiusRow({ options, value, onChange, ink, unit, setUnit }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px", minWidth: 0 }}>
      <div style={{ display: "flex", gap: "5px", flex: 1, minWidth: 0 }}>
        {options.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className="font-sans"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "8px 0",
                borderRadius: "10px",
                border: selected ? `1.5px solid ${ink}` : "1px solid #F0E9DC",
                background: selected ? ink : "#fff",
                color: selected ? "#fff" : "#475569",
                fontWeight: selected ? "800" : "600",
                fontSize: "12.5px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {n} {unit}
            </button>
          );
        })}
      </div>
      <DistanceUnitToggle unit={unit} setUnit={setUnit} variant="light" />
    </div>
  );
}
