// PersonaChooser: "Who's traveling?" (ThingsToDo.dc.html L80-89), a 44px segmented
// control in the page's world (Things to Do's lapis by default). It sets the party-
// composition persona (solo / couple / family / friends), which re-ranks attractions
// live and feeds the demand signal. Tapping the chosen one again clears it. Party
// composition only, never age or life-stage labels; words, no emoji.
import { useId } from "react";
import { PERSONAS, setPersona, usePersona } from "@/lib/persona";
import { worldRow } from "@/components/finder/FinderControls";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

export default function PersonaChooser({ world = "todo", style = undefined }) {
  const w = worldRow(world);
  const persona = usePersona();
  const labelId = useId();

  return (
    <div style={style}>
      <div id={labelId} style={{ fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.35, fontWeight: 500, letterSpacing: ".12em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>
        Who&rsquo;s traveling?
      </div>
      <div role="group" aria-labelledby={labelId} style={{ position: "relative", display: "flex", minHeight: 44, marginTop: 4 }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 4, bottom: 4, boxSizing: "border-box", background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 12 }} />
        {PERSONAS.map((p, i) => {
          const on = persona === p.id;
          // The hairline between two options, hidden beside the chosen one.
          const rule = i > 0 && !on && persona !== PERSONAS[i - 1].id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPersona(on ? null : p.id)}
              style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 44, padding: "0 1px", background: "transparent", border: 0, fontFamily: "inherit", cursor: "pointer", outlineOffset: -2 }}
            >
              {rule && <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 14, bottom: 14, width: 1, background: w.line }} />}
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 30, margin: "0 4px", padding: "0 4px", borderRadius: 9, background: on ? w.chipOn : "transparent", color: on ? w.chipOnInk : NEUTRAL.ink2, fontSize: fs(13), lineHeight: 1.15, fontWeight: 600 }}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
