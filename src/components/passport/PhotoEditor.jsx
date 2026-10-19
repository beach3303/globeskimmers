// PhotoEditor — our own looks on a photo before it travels (founder, 2026-10-18). A sheet
// over the composer or a stamp: the photo with the look applied, six named starting points
// (Airmail, Golden Hour, Film, Ink, Dusk, Postcard), then the dials — Brightness, Contrast,
// Warmth (cooler ↔ warmer), Clarity (crisper), Grain, Fade — and Black & white. The preview
// is rendered small and fast; "Use this look" renders the full photo once and hands it back.
// Only the edited photo leaves here (founder, 2026-10-19): the undo is to upload it again.
//
//   <PhotoEditor open image onDone onClose accent title />
//   image    a data URL (resizePhoto's output).
//   onDone   (dataUrl, look) after the full render; onClose without a change.
import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { useDismissable } from "@/lib/dismissStack";
import { EMPTY_LOOK, LOOKS, isPlain, lookFor, renderLook } from "@/lib/photoLook";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const DIALS = [
  ["brightness", "Brightness", -100, 100, "Darker", "Brighter"],
  ["contrast", "Contrast", -100, 100, "Softer", "Punchier"],
  ["warmth", "Warmth", -100, 100, "Cooler", "Warmer"],
  ["clarity", "Clarity", 0, 100, "", "Crisper"],
  ["grain", "Grain", 0, 100, "", "Grainier"],
  ["fade", "Fade", 0, 100, "", "Matte"],
];

export default function PhotoEditor({ open = false, image = null, onDone = undefined, onClose = undefined, accent = NEUTRAL.airmailBlue, title = "Edit the photo" }) {
  const [look, setLook] = useState({ ...EMPTY_LOOK });
  const [preset, setPreset] = useState("none");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const titleId = `pe-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const seq = useRef(0);
  const close = () => { if (!busy && typeof onClose === "function") onClose(); };
  useDismissable(open, close);

  // A fresh photo starts plain.
  useEffect(() => { if (open) { setLook({ ...EMPTY_LOOK }); setPreset("none"); setPreview(null); } }, [open, image]);

  // The small preview follows the dials; a render that finished late is dropped.
  useEffect(() => {
    if (!open || !image) return undefined;
    const my = ++seq.current;
    let alive = true;
    renderLook(image, look, 560, 0.82).then((u) => { if (alive && my === seq.current) setPreview(u); }).catch(() => {});
    return () => { alive = false; };
  }, [open, image, look]);

  if (!open || !image) return null;

  const pick = (key) => { setPreset(key); setLook(lookFor(key)); };
  const dial = (k, v) => { setPreset("custom"); setLook((l) => ({ ...l, [k]: v })); };
  const done = async () => {
    if (busy) return;
    if (isPlain(look)) { close(); return; }
    setBusy(true);
    try { const out = await renderLook(image, look, 1600, 0.86); if (typeof onDone === "function") onDone(out, look); }
    catch { /* keep the sheet open; the photo is untouched */ }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[10010] flex items-end justify-center" style={{ background: rgba(NEUTRAL.ink, 0.55) }} onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md max-h-[92vh] overflow-y-auto"
        style={{ position: "relative", background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0", outline: "none" }} onClick={(e) => e.stopPropagation()}>
        <AirmailChevron height={4} />
        <div style={{ padding: "14px 20px calc(24px + env(safe-area-inset-bottom))" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>Our looks</div>
          <h3 id={titleId} style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>{title}</h3>

          <div style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, aspectRatio: "4 / 3" }}>
            <img src={preview || image} alt="The photo with the look applied" style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", background: NEUTRAL.white }} />
          </div>

          <div role="group" aria-label="Looks" className="flex gap-2 overflow-x-auto" style={{ marginTop: 10, paddingBottom: 2, scrollbarWidth: "none" }}>
            {LOOKS.map((l) => {
              const on = preset === l.key;
              return (
                <button key={l.key} type="button" onClick={() => pick(l.key)} aria-pressed={on}
                  style={{ flex: "none", minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? accent : NEUTRAL.airmailLine}`, background: on ? accent : NEUTRAL.white, color: on ? NEUTRAL.white : NEUTRAL.ink, fontSize: fs(13), fontWeight: 600, whiteSpace: "nowrap" }}>
                  {l.name}
                </button>
              );
            })}
            <button type="button" onClick={() => { setPreset("custom"); setLook((l) => ({ ...l, mono: !l.mono })); }} aria-pressed={!!look.mono}
              style={{ flex: "none", minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1px solid ${look.mono ? NEUTRAL.ink : NEUTRAL.airmailLine}`, background: look.mono ? NEUTRAL.ink : NEUTRAL.white, color: look.mono ? NEUTRAL.white : NEUTRAL.ink, fontSize: fs(13), fontWeight: 600, whiteSpace: "nowrap" }}>
              Black &amp; white
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {DIALS.map(([k, name, min, max, lo, hi]) => (
              <label key={k} style={{ display: "block" }}>
                <span className="flex items-center justify-between" style={{ fontSize: fs(12.5), color: NEUTRAL.ink2 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span style={{ fontFamily: MONO, fontSize: fs(11), color: NEUTRAL.ink3 }}>{look[k] > 0 && min < 0 ? `+${look[k]}` : look[k]}</span>
                </span>
                <input type="range" min={min} max={max} step={1} value={look[k]} onChange={(e) => dial(k, Number(e.target.value))} aria-label={name}
                  style={{ display: "block", width: "100%", accentColor: accent, marginTop: 2 }} />
                <span className="flex justify-between" style={{ fontSize: fs(10.5), color: NEUTRAL.ink3, marginTop: -2 }}><span>{lo}</span><span>{hi}</span></span>
              </label>
            ))}
          </div>

          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => pick("none")} disabled={busy} aria-label="Back to the original"
              style={{ flex: "none", width: 48, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2 }}>
              <RotateCcw size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
            </button>
            <button type="button" onClick={close} disabled={busy}
              style={{ flex: 1, minHeight: 48, borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, fontSize: fs(14), fontWeight: 600 }}>
              Keep original
            </button>
            <button type="button" onClick={done} aria-busy={busy || undefined}
              style={{ flex: 1.4, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, border: `1px solid ${accent}`, background: accent, color: NEUTRAL.white, fontSize: fs(14), fontWeight: 600 }}>
              {busy ? <Loader2 size={16} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : null}
              Use this look
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>The edited photo is the one that travels. To start over later, add the photo again.</p>
        </div>
      </div>
    </div>
  );
}
