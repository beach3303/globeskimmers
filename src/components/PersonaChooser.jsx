// PersonaChooser — a compact "Who's traveling?" chip row. Sets the party-composition
// persona (solo/couple/family/friends), which re-ranks attractions live and feeds the
// demand signal. Tap a chip to select; tap it again (or Clear) to reset. Party
// composition only — never age/life-stage labels.
import { PERSONAS, setPersona, usePersona } from "@/lib/persona";

const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK3 = "#736657", ED_RULE = "rgba(22,17,13,.10)";
const TEAL_DEEP = "#0E7C73";

export default function PersonaChooser() {
  const persona = usePersona();
  const pick = (id) => setPersona(persona === id ? null : id);

  return (
    <div className="px-1 mb-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span style={{ fontFamily: ED_MONO, fontSize: "calc(10.5px*var(--fs))", letterSpacing: ".08em", color: ED_INK3, textTransform: "uppercase", fontWeight: 600 }}>
          Who&rsquo;s traveling?
        </span>
        {persona && (
          <button onClick={() => setPersona(null)} style={{ fontFamily: ED_MONO, fontSize: "calc(10px*var(--fs))", color: TEAL_DEEP, fontWeight: 600 }}>
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {PERSONAS.map((p) => {
          const on = persona === p.id;
          return (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              aria-pressed={on}
              className="flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: on ? TEAL_DEEP : "#FFFFFF",
                color: on ? "#FFFFFF" : ED_INK,
                border: `1px solid ${on ? TEAL_DEEP : ED_RULE}`,
                fontFamily: ED_MONO,
                fontSize: "calc(11.5px*var(--fs))",
                fontWeight: 600,
              }}
            >
              <span aria-hidden="true">{p.emoji}</span> {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
