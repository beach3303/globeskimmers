// ClothPicker: the cloth your world is bound in (bible.profile.personalisation;
// Palettes.dc.html L495-506). Eight woven swatches, each on its own paper with its name in
// mono beneath: Harbour (the default), Forest, Saddle, Plum, Slate, Ochre, Lapis and
// Graphite. These eight only: no custom colours, no photos. Choosing one previews it on
// the whole page at once; the page saves it, or puts the old one back on Cancel.
//
//   <ClothPicker value onChange initial className style />
//   value      the cloth key on show (the live preview).
//   onChange   receives the chosen key.
//   initial    the owner's initial, woven into each swatch as on the board.
//
// The page renders it only when the profile row has the cloth column (useMyCloth().supported).
import React, { useId } from "react";
import { Check } from "lucide-react";
import { CLOTH, CLOTH_ORDER, FOIL, NEUTRAL, clothOf, fs } from "@/components/redesign/constants";
import { SWATCH_WEAVE } from "@/components/profile/CoverBand";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/**
 * @param {{ value?: string, onChange?: (key: string) => void, initial?: string, className?: string, style?: import('react').CSSProperties }} props
 */
export default function ClothPicker({ value = undefined, onChange = undefined, initial = "", className = undefined, style = undefined }) {
  const titleId = `cloth-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const shown = clothOf(value);
  return (
    <section aria-labelledby={titleId} className={className}
      style={{ boxSizing: "border-box", padding: 16, background: NEUTRAL.white, border: `1px solid ${shown.line}`, borderRadius: 16, ...style }}>
      <h3 id={titleId} style={{ margin: 0, fontFamily: SERIF, fontSize: fs(17), lineHeight: 20 / 17, fontWeight: 400, color: NEUTRAL.ink }}>
        Bound in your own <em style={{ fontStyle: "italic", color: shown.cloth }}>cloth</em>
      </h3>
      <div role="radiogroup" aria-labelledby={titleId}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(76px, calc(62px * var(--fs, 1))), 1fr))", gap: 8, marginTop: 12 }}>
        {CLOTH_ORDER.map((k) => {
          const c = CLOTH[k];
          const on = shown.key === k;
          return (
            <button key={k} type="button" role="radio" aria-checked={on} aria-label={c.name} onClick={() => onChange?.(k)}
              style={{ display: "block", minWidth: 0, boxSizing: "border-box", padding: "6px 6px 7px", borderRadius: 10, background: c.paper, border: `2px solid ${on ? c.cloth : "transparent"}`, textAlign: "left", cursor: "pointer", "--gs-focus": c.cloth }}>
              <span aria-hidden="true"
                style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 44, borderRadius: 6, backgroundColor: c.cloth, backgroundImage: SWATCH_WEAVE, fontFamily: SERIF, fontSize: `min(${fs(18)}, 26px)`, lineHeight: 1, color: NEUTRAL.white }}>
                {initial || null}
                {on ? (
                  <span style={{ position: "absolute", top: 4, right: 4, display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 999, background: FOIL, color: c.cloth }}>
                    <Check size={11} strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span aria-hidden="true" style={{ display: "block", marginTop: 5, fontFamily: MONO, fontSize: fs(9), lineHeight: 1.3, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: c.cloth }}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
