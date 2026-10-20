// PETS ONLY since 2026-10-19 (founder: "remove virtual items except virtual pets. remove virtual
// laptop and virtual drinking cup/virtual water bottles"): SHOW_GEAR = false hides the laptop and
// the drinks everywhere — the kit is the travel buddies alone. Saved gear stays in profile_gear,
// so flipping SHOW_GEAR back restores it untouched.
//
// "My virtual items" (founder, 2026-10-05): beside the trunk, a generic laptop
// and a drink container — tumbler, straw bottle or lid bottle — each in the
// founder's colors, each taking the traveler's EARNED stickers (same inventory
// as the luggage; a sticker lives on ONE item at a time, so a flag on the trunk
// can't also ride the laptop). Items enlarge to edit, and the shelf order can
// be dragged. Beside them, up to six named travel buddies (virtual pets):
// species → breed → coat → name, pose cycles with a swipe (sitting / standing).
// Pets never take stickers. The founder's photo renders live on R2 at
// stamp-art/pets/<species>/<breed>[/<coat>]/<pose> and replace the drawn
// fallback automatically, like the luggage skins. Every pick logs a gear_select
// / buddy_add event (with city+country) so the admin can report what travelers
// choose, per day/week/month and per place.
//
// The new look files all of it in one MY KIT folder (Profile.dc.html L185-211,
// Profile-Visit L192-218): three columns of white tiles, the two items under
// MY VIRTUAL ITEMS, the buddies under TRAVEL BUDDIES (row one holds the first
// buddy, or the seat 'Room for 6 travel buddies'; the rest wrap three a row),
// each tile 'TAP TO SEE IT'.
//
//   <VirtualItems stamps luggage readOnly gear buddies layout ownerFlags ownerFirst
//                 className style />
//   Owner (default): reads /gear/get itself; luggage ({ active, placements } from
//     the page's one /luggage/get, null while loading; left out, it reads it) tells
//     the sticker picker which stickers already ride the trunk.
//   readOnly: someone else's kit, from their gear, buddies and layout: tab
//     '{FIRST}’S KIT', labels 'VIRTUAL ITEMS' and 'TRAVEL BUDDY' (one) or
//     'TRAVEL BUDDIES'; tiles only enlarge; their coffee orders stay theirs.
//     ownerFlags: whose home flags their stickers may show (never the viewer's).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Coffee, Palette, Pencil, Plus, Trash2, X } from "lucide-react";
import { showToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "@/components/location/LocationContext";
import { logEvent } from "@/lib/analytics";
import { gearGet, gearSet } from "@/lib/gear";
import { luggageGet } from "@/lib/passport";
import { useIsTablet } from "@/lib/useIsTablet";
import { buildStickers } from "@/components/passport/VirtualLuggage";
// The laptop and the drinks (tumbler, straw bottle, water bottle) are off (founder, 2026-10-19).
const SHOW_GEAR = false;
import LuggageLabel from "@/components/passport/LuggageLabel";
import { GEAR_SHAPES, GEAR_COLORS, DRINK_VARIANTS, GEAR_BOUNDS, colorOf } from "@/components/profile/gearShapes";
import { PET_SHAPES, POSES } from "@/components/profile/petShapes";
import { SPECIES, BREEDS, breedName } from "@/lib/petCatalog";
import { BREED_COATS, coatFor } from "@/lib/petCoats";
import { hasPetArt } from "@/lib/petArt";
import { Folder } from "@/components/redesign/Zone";
import { NEUTRAL, ZONE, fs } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)", IVORY = "#FFFCF7";
const KIT = ZONE.kit;
const PETS_BASE = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/pets";
const GEAR_BASE = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/gear";
const MAX_BUDDIES = 6;

const svgFor = (kind, variant, colorKey) => {
  const c = colorOf(colorKey);
  const fn = kind === "laptop" ? GEAR_SHAPES.laptop : GEAR_SHAPES[variant] || GEAR_SHAPES.tumbler;
  return fn(c.body, c.dark, c.lite);
};

// The default item, when the traveler hasn't chosen one.
const itemOf = (gear, kind) => gear?.[kind] || (kind === "drink" ? { variant: "tumbler", color: "blue" } : { color: "blue" });
const drinkName = (item) => DRINK_VARIANTS.find((v) => v.key === (item?.variant || "tumbler"))?.name || "My bottle";

// A 44px round close button for the sheets.
function CloseButton({ onClick, style = undefined }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close" className="rounded-full flex items-center justify-center"
      style={{ width: 44, height: 44, flex: "none", background: "#fff", border: `1px solid ${RULE}`, ...style }}>
      <X size={18} color={INK} />
    </button>
  );
}

// A colour choice: a small swatch inside a 44px target.
function Swatch({ color, name, on, onClick, size = 28 }) {
  return (
    <button type="button" role="radio" aria-checked={on} aria-label={name} title={name} onClick={onClick}
      style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: 0, padding: 0 }}>
      <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: color, border: on ? `3px solid ${INK}` : "2px solid rgba(22,17,13,.18)" }} />
    </button>
  );
}

// The item's art + its placed stickers, at any size. Stickers use the same
// normalized coords as the luggage so they hold across phones.
function GearArt({ kind, item, width, stickersBySid, edit = false, selected = null, onSelect = null, boxRef = null }) {
  const variant = item?.variant || "tumbler";
  const placements = item?.placements || [];
  // The founder's photo-real render wins when one is on R2 (per item, per
  // color: gear/<item>/<color>.png); the drawn shape is the fallback.
  const shapeKey = kind === "laptop" ? "laptop" : variant;
  const renderUrl = `${GEAR_BASE}/${shapeKey}/${item?.color || "blue"}.png`;
  const [artFail, setArtFail] = useState(false);
  useEffect(() => { setArtFail(false); }, [renderUrl]);
  return (
    <div ref={boxRef} style={{ position: "relative", width, height: width, touchAction: edit ? "none" : undefined }}>
      {!artFail ? (
        <img src={renderUrl} alt="" onError={() => setArtFail(true)} style={{ width, height: width, objectFit: "contain", display: "block", borderRadius: Math.round(width * 0.08), mixBlendMode: "multiply" }} />
      ) : (
        <svg viewBox="0 0 340 340" width={width} height={width} style={{ display: "block" }} aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: svgFor(kind, variant, item?.color) }} />
      )}
      {placements.map((pl) => {
        const st = stickersBySid[pl.sid];
        if (!st) return null;
        const w = (st.w || 92) * pl.scale * (width / 340);
        return (
          <div key={pl.sid} data-sid={pl.sid}
            onClick={(e) => { e.stopPropagation(); if (edit && onSelect) onSelect(pl.sid); }}
            style={{
              position: "absolute", left: `${pl.x * 100}%`, top: `${pl.y * 100}%`, width: w,
              transform: `translate(-50%,-50%) rotate(${pl.rot}deg)`, zIndex: 10 + (pl.z || 0),
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))",
              outline: edit && selected === pl.sid ? "2px dashed rgba(22,17,13,.55)" : "none", outlineOffset: 3, borderRadius: 8,
            }}>
            <LuggageLabel label={st.label} uid={pl.sid.replace(/[^a-z0-9]/gi, "")} />
          </div>
        );
      })}
    </div>
  );
}

// A pet: the uploaded breed render when R2 has one, else the drawn chibi.
//   onArt(true | false)  which one showed: the buddy sheet adds a buddy only on a real picture.
//   fallback             shown instead of the chibi when given.
export function PetArt({ buddy, width, alt = "", onArt = undefined, fallback = undefined }) {
  // Render ladder: coat render in this pose → breed render in this pose → the
  // coat's sitting render (most coats shipped sitting-only) → breed sitting →
  // the breed's first rendered coat, sitting (a Siamese has only its points) →
  // the drawn chibi. The chibi has no standing drawing, so it maps to sitting.
  const [step, setStep] = useState(0);
  const base = `${PETS_BASE}/${buddy.species}/${buddy.breed || "any"}`;
  const firstCoat = BREED_COATS[`${buddy.species}/${buddy.breed}`]?.[0]?.key;
  const urls = [...new Set([
    buddy.coat ? `${base}/${buddy.coat}/${buddy.pose}.webp` : null,
    `${base}/${buddy.pose}.webp`,
    buddy.coat ? `${base}/${buddy.coat}/sitting.webp` : null,
    `${base}/sitting.webp`,
    firstCoat ? `${base}/${firstCoat}/sitting.webp` : null,
  ].filter(Boolean))];
  useEffect(() => { setStep(0); }, [buddy.species, buddy.breed, buddy.coat, buddy.pose]);
  const failed = step >= urls.length;
  const onArtRef = useRef(onArt);
  onArtRef.current = onArt;
  useEffect(() => { if (failed) onArtRef.current?.(false); }, [failed]);
  if (!failed) {
    return <img src={urls[step]} alt={alt} onLoad={() => onArt?.(true)} onError={() => setStep(step + 1)} style={{ width, height: width, objectFit: "contain", display: "block" }} />;
  }
  if (fallback !== undefined) return fallback;
  const fn = PET_SHAPES[buddy.species] || PET_SHAPES.dog;
  const pose = buddy.pose === "standing" ? "sitting" : buddy.pose;
  return <svg viewBox="0 0 340 340" width={width} height={width} style={{ display: "block" }} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : "true"}
    dangerouslySetInnerHTML={{ __html: fn(pose, coatFor(buddy.species, buddy.breed, buddy.coat)) }} />;
}

// The buddy sheet's picture spot for a breed that isn't drawn yet.
function ComingSoonArt({ width }) {
  return (
    <div role="img" aria-label="Coming soon"
      style={{ width, height: width, boxSizing: "border-box", padding: 12, borderRadius: Math.round(width * 0.12), border: "1.5px dashed rgba(22,17,13,.3)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: fs(20), color: INK3 }}>
      Coming soon
    </div>
  );
}

// ── The enlarge / edit sheet for one item ───────────────────────────────────
function GearModal({ kind, item, stamps, stickersBySid, usedElsewhere, onChange, onClose }) {
  const [selected, setSelected] = useState(null);
  const [picking, setPicking] = useState(false);
  const boxRef = useRef(null);
  const variant = item?.variant || "tumbler";
  const bounds = GEAR_BOUNDS[kind === "laptop" ? "laptop" : variant];
  const placements = item?.placements || [];
  const W = Math.min(0.92 * (typeof window !== "undefined" ? window.innerWidth : 400), 380);
  const sel = placements.find((p) => p.sid === selected) || null;
  const earned = useMemo(() => Object.values(stickersBySid), [stickersBySid]);

  const patch = (next) => onChange({ ...item, ...next });
  const patchPl = (sid, p) => patch({ placements: placements.map((x) => (x.sid === sid ? { ...x, ...p } : x)) });
  const addSticker = (sid) => {
    if (placements.some((p) => p.sid === sid)) return;
    patch({ placements: [...placements, { sid, x: 0.5, y: (bounds.yMin + bounds.yMax) / 2, scale: 1, rot: ((placements.length * 37) % 17) - 8, z: placements.length }] });
    setPicking(false); setSelected(sid);
  };
  const removeSel = () => { if (sel) { patch({ placements: placements.filter((p) => p.sid !== sel.sid) }); setSelected(null); } };

  // Drag the selected sticker with one finger.
  const dragRef = useRef(null);
  const onPointerDown = (e) => {
    const sid = e.target.closest?.("[data-sid]")?.getAttribute("data-sid");
    if (!sid) return;
    setSelected(sid);
    const box = boxRef.current?.getBoundingClientRect();
    if (box) dragRef.current = { sid, box };
    e.preventDefault();
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const x = Math.min(bounds.xMax, Math.max(bounds.xMin, (e.clientX - d.box.left) / d.box.width));
    const y = Math.min(bounds.yMax, Math.max(bounds.yMin, (e.clientY - d.box.top) / d.box.height));
    patchPl(d.sid, { x, y });
  };
  const endDrag = () => { dragRef.current = null; };

  return (
    <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Edit this item"
      style={{ background: "rgba(22,17,13,.6)", backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-4 overflow-y-auto" style={{ background: "#F3EEE1", maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div style={{ fontFamily: SERIF, fontSize: fs(21), color: INK }}>
            {kind === "laptop" ? "My laptop" : drinkName(item)}
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex justify-center mt-2" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <GearArt kind={kind} item={item} width={W} stickersBySid={stickersBySid} edit selected={selected} onSelect={setSelected} boxRef={boxRef} />
        </div>

        {/* Colors — the founder's eight (and two from the render batches). */}
        <div className="flex flex-wrap items-center mt-2" role="radiogroup" aria-label="Color">
          {GEAR_COLORS.map((c) => (
            <Swatch key={c.key} color={c.body} name={c.name} on={(item?.color || "blue") === c.key} onClick={() => patch({ color: c.key })} />
          ))}
        </div>

        {kind === "drink" && (
          <>
            <div className="grid grid-cols-3 gap-1.5 mt-2.5">
              {DRINK_VARIANTS.map((v) => (
                <button key={v.key} type="button" onClick={() => patch({ variant: v.key })} aria-pressed={variant === v.key}
                  className="rounded-xl px-2 py-2 text-center"
                  style={{ minHeight: 44, background: variant === v.key ? INK : "#fff", color: variant === v.key ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(11.5), fontWeight: 600, fontFamily: "inherit", lineHeight: 1.2 }}>
                  {v.name}
                </button>
              ))}
            </div>
            {/* Top-3 coffee orders, the traveler's own words (founder, 2026-10-05
                evening) — they show when the drink is enlarged. */}
            <div style={{ fontFamily: SERIF, fontSize: fs(16), color: INK, marginTop: 12 }}>How I take my coffee (or tea)</div>
            <p style={{ fontSize: fs(11), color: INK3, margin: "2px 0 6px", lineHeight: 1.4 }}>Your top 3, in your words. They show when your drink is open.</p>
            {[0, 1, 2].map((i) => (
              <input key={i} value={(item?.coffees || [])[i] || ""} aria-label={`Coffee order ${i + 1}`}
                onChange={(e) => { const next = [0, 1, 2].map((j) => (item?.coffees || [])[j] || ""); next[i] = e.target.value.slice(0, 48); patch({ coffees: next }); }}
                placeholder={["Cold brew, grande, 3 Splendas", "Oat milk latte, extra hot", "Earl Grey, splash of honey"][i]}
                className="w-full rounded-xl px-3 outline-none" style={{ height: 44, background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(13), color: INK, marginTop: i ? 6 : 0 }} />
            ))}
          </>
        )}

        {/* Selected sticker: size + turn + remove. */}
        {sel && (
          <div className="rounded-xl px-3 py-2.5 mt-2.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: fs(12), color: INK3, minWidth: 34 }}>Size</span>
              <input type="range" min="0.5" max="2.2" step="0.05" value={sel.scale} aria-label="Sticker size"
                onChange={(e) => patchPl(sel.sid, { scale: Number(e.target.value) })} style={{ flex: 1, minHeight: 44, accentColor: INK }} />
            </div>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: fs(12), color: INK3, minWidth: 34 }}>Turn</span>
              <input type="range" min="-45" max="45" step="1" value={sel.rot} aria-label="Sticker rotation"
                onChange={(e) => patchPl(sel.sid, { rot: Number(e.target.value) })} style={{ flex: 1, minHeight: 44, accentColor: INK }} />
              <button type="button" onClick={removeSel} aria-label="Take the sticker off" className="rounded-lg flex items-center justify-center"
                style={{ width: 44, height: 44, flex: "none", background: IVORY, border: `1px solid ${RULE}` }}>
                <Trash2 size={16} color={NEUTRAL.stamp} />
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => setPicking(true)}
          className="w-full mt-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5"
          style={{ minHeight: 44, background: "#fff", color: INK, border: "1.5px dashed rgba(22,17,13,.3)", fontSize: fs(13.5) }}>
          <Plus size={16} aria-hidden="true" /> Add a sticker
        </button>
        <p className="text-center" style={{ fontSize: fs(10.5), color: INK3, marginTop: 6, fontFamily: MONO, letterSpacing: ".04em" }}>
          Stickers are earned by traveling, and each one lives on one item at a time.
        </p>

        {picking && (
          <div className="rounded-xl p-3 mt-2" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <div className="flex items-center justify-between">
              <span style={{ fontWeight: 700, fontSize: fs(13.5), color: INK }}>Your stickers</span>
              <button type="button" onClick={() => setPicking(false)} style={{ minHeight: 44, padding: "0 6px", fontSize: fs(12.5), color: INK3, fontFamily: "inherit" }}>Close</button>
            </div>
            {earned.length === 0 && <p style={{ fontSize: fs(12.5), color: INK3, marginTop: 6 }}>Stamp places and arrive in countries to earn stickers.</p>}
            <div className="flex flex-wrap gap-2.5 mt-2" style={{ maxHeight: 190, overflowY: "auto" }}>
              {earned.map((st) => {
                const here = placements.some((p) => p.sid === st.sid);
                const away = usedElsewhere.get(st.sid);
                return (
                  <button key={st.sid} type="button" disabled={here || !!away}
                    onClick={() => addSticker(st.sid)}
                    title={away ? `On your ${away}` : here ? "Already on this item" : "Place it"}
                    style={{ width: 64, opacity: here || away ? 0.35 : 1, background: "none", border: "none", padding: 0, position: "relative" }}>
                    <LuggageLabel label={st.label} uid={`pick-${st.sid.replace(/[^a-z0-9]/gi, "")}`} />
                    {away && <span style={{ position: "absolute", bottom: -2, left: 0, right: 0, fontSize: 8.5, fontFamily: MONO, color: INK3 }}>{away}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add / manage a travel buddy ─────────────────────────────────────────────
function BuddyModal({ buddy, onSave, onRemove, onClose }) {
  const isNew = !buddy?.id;
  const [species, setSpecies] = useState(buddy?.species || null);
  const [breed, setBreed] = useState(buddy?.breed || null);
  const [coat, setCoat] = useState(buddy?.coat || null);
  const [name, setName] = useState(buddy?.name || "");
  const [q, setQ] = useState("");
  const found = species ? (BREEDS[species] || []).filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase())) : [];
  // Breeds with the founder's picture come first; the rest are coming soon (founder,
  // 2026-10-14), shown only when searched for.
  const breeds = found.filter((b) => hasPetArt(species, b.key));
  const soon = found.filter((b) => !hasPetArt(species, b.key));
  // A buddy is added only once its picture has loaded. Keyed, so a new breed or coat starts over.
  const artKey = `${species}/${breed}/${coat || ""}`;
  const [art, setArt] = useState({ key: "", ok: null });
  const artOk = art.key === artKey ? art.ok : null;
  // An existing buddy keeps a breed from before this rule (rename it, or say goodbye).
  const kept = !isNew && breed === buddy?.breed && (coat || "") === (buddy?.coat || "");
  const comingSoon = !!breed && artOk === false && !kept;
  const ready = species && breed && name.trim().length > 0 && (artOk === true || kept);
  const preview = species ? { species, breed: breed || "any", coat, pose: "sitting" } : null;
  // Only coats with a picture; a breed drawn in one coat offers no swatches.
  const coats = breed ? BREED_COATS[`${species}/${breed}`] || [] : [];
  return (
    <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={isNew ? "Add a travel buddy" : "Your travel buddy"}
      style={{ background: "rgba(22,17,13,.6)", backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-4 overflow-y-auto" style={{ background: "#F3EEE1", maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate" style={{ fontFamily: SERIF, fontSize: fs(21), color: INK }}>{isNew ? "Add your travel buddy" : name || "Your buddy"}</div>
            {!isNew && species && <div className="truncate" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".06em", color: INK3, textTransform: "uppercase" }}>{breedName(species, breed) || species}</div>}
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {preview && (
          <div className="flex flex-col items-center my-1">
            <PetArt key={artKey} buddy={preview} width={150}
              onArt={breed ? (ok) => setArt({ key: artKey, ok }) : undefined}
              fallback={breed && !kept ? <ComingSoonArt width={150} /> : undefined} />
            {comingSoon && (
              <p role="status" className="text-center" style={{ fontSize: fs(12.5), lineHeight: 1.4, color: INK2, margin: "6px 0 10px", maxWidth: 300 }}>
                {hasPetArt(species, breed)
                  ? "We couldn’t load this picture. Check your connection and try again."
                  : `The ${breedName(species, breed)} is coming soon. We’re still drawing it.`}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mt-1" role="radiogroup" aria-label="Species">
          {SPECIES.map((s) => (
            <button key={s.key} type="button" role="radio" aria-checked={species === s.key}
              onClick={() => { setSpecies(s.key); setBreed(null); setCoat(null); setQ(""); }}
              className="rounded-full px-3.5" style={{ minHeight: 44, background: species === s.key ? INK : "#fff", color: species === s.key ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(12.5), fontWeight: 600, fontFamily: "inherit" }}>
              {s.name}
            </button>
          ))}
        </div>

        {species && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${(BREEDS[species] || []).length} breeds…`} aria-label="Search breeds"
              className="w-full mt-2.5 rounded-xl px-3 outline-none" style={{ height: 44, background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(14), color: INK }} />
            <div className="flex flex-wrap gap-1.5 mt-2" style={{ maxHeight: 196, overflowY: "auto" }}>
              {breeds.map((b) => (
                <button key={b.key} type="button" onClick={() => { setBreed(b.key); setCoat(null); }} aria-pressed={breed === b.key}
                  className="rounded-full px-3" style={{ minHeight: 44, background: breed === b.key ? INK : "#fff", color: breed === b.key ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(11.5), fontFamily: "inherit" }}>
                  {b.name}
                </button>
              ))}
              {q && soon.length > 0 && (
                <>
                  <div className="w-full" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", textTransform: "uppercase", color: INK3, marginTop: breeds.length ? 4 : 0 }}>Coming soon</div>
                  {soon.slice(0, 40).map((b) => (
                    <button key={b.key} type="button" onClick={() => { setBreed(b.key); setCoat(null); }} aria-pressed={breed === b.key}
                      className="rounded-full px-3" style={{ minHeight: 44, background: breed === b.key ? "rgba(22,17,13,.08)" : "transparent", color: INK3, border: "1px dashed rgba(22,17,13,.32)", fontSize: fs(11.5), fontFamily: "inherit" }}>
                      {b.name}
                    </button>
                  ))}
                </>
              )}
              {q && !found.length && <div style={{ fontSize: fs(12.5), color: INK3, padding: "6px 2px" }}>No breed by that name.</div>}
            </div>
            {!q && soon.length > 0 && (
              <div style={{ fontSize: fs(11.5), lineHeight: 1.4, color: INK3, marginTop: 6 }}>
                {soon.length} more {soon.length === 1 ? "breed is" : "breeds are"} coming soon. Search to check yours.
              </div>
            )}
            {/* Coats are per-breed where the founder rendered them (a cavalier offers
                Ruby, a great dane Harlequin). */}
            {coats.length > 0 && (
              <div className="flex flex-wrap items-center mt-2.5" role="radiogroup" aria-label="Coat color">
                {coats.map((c) => (
                  <Swatch key={c.key} color={c.body} name={c.name} on={coat === c.key} onClick={() => setCoat(c.key)} size={26} />
                ))}
                {coat && <span style={{ fontSize: fs(11), color: INK3, marginLeft: 4 }}>{coats.find((c) => c.key === coat)?.name}</span>}
              </div>
            )}
            {/* The name is the identity (founder, 2026-10-05) — the breed is just a pick. */}
            <div style={{ fontFamily: SERIF, fontSize: fs(17), color: INK, marginTop: 14 }}>What&rsquo;s your travel buddy&rsquo;s name?</div>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="Peanut, Luna, Captain Fluff…" aria-label="Your travel buddy's name" autoCapitalize="words"
              className="w-full mt-1.5 rounded-xl px-3 h-12 outline-none" style={{ background: "#fff", border: `1.5px solid rgba(22,17,13,.25)`, fontSize: fs(17), color: INK, fontFamily: SERIF }} />
          </>
        )}

        <div className="flex gap-2 mt-3">
          {!isNew && (
            <button type="button" onClick={onRemove} className="rounded-xl px-3 py-3" aria-label="Say goodbye" style={{ minWidth: 44, background: "#fff", color: NEUTRAL.stamp, border: `1px solid ${RULE}`, fontSize: fs(13.5), fontWeight: 600 }}>
              <Trash2 size={16} />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14) }}>Cancel</button>
          <button type="button" disabled={!ready}
            onClick={() => onSave({ id: buddy?.id, species, breed, coat: coat || "", name: name.trim(), pose: buddy?.pose || "sitting" })}
            className="flex-1 rounded-xl py-3 font-semibold disabled:opacity-50" style={{ background: INK, color: "#fff", fontSize: fs(14) }}>
            {comingSoon ? "Coming soon" : isNew ? "Add buddy" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The kit folder ──────────────────────────────────────────────────────────
const LABEL = { fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.26, fontWeight: 500, letterSpacing: ".12em", color: KIT.tab, margin: 0, overflowWrap: "anywhere" };
const TILE = { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0, boxSizing: "border-box", padding: "8px 6px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 18, cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" };
const TILE_NAME = { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 32, marginTop: 8, maxWidth: "100%", fontFamily: SERIF, fontSize: fs(15), lineHeight: 16 / 15, color: INK, textAlign: "center", overflowWrap: "anywhere" };
const TILE_HINT = { marginTop: 4, fontFamily: MONO, fontSize: fs(9), lineHeight: 12 / 9, fontWeight: 500, letterSpacing: ".12em", color: INK3, textAlign: "center" };

const possessive = (first) => `${first}’S`;
// The sheets render on <body>, clear of any layer the folder sits in.
const onBody = (node) => (typeof document !== "undefined" ? createPortal(node, document.body) : node);

export default function VirtualItems({
  stamps,
  luggage = undefined,
  readOnly = false,
  gear: gearProp = undefined,
  buddies: buddiesProp = undefined,
  layout: layoutProp = undefined,
  ownerFlags = undefined,
  ownerFirst = null,
  className = undefined,
  style = undefined,
}) {
  const { profile } = useAuth();
  const { activeLocation } = useLocation();
  const tablet = useIsTablet();
  const [state, setState] = useState(null);           // { gear, buddies, layout }
  const [ownLug, setOwnLug] = useState(null);
  const [open, setOpen] = useState(null);             // 'laptop' | 'drink'
  const [buddyOpen, setBuddyOpen] = useState(null);   // 'new' | buddy object
  // One tap enlarges an item or a buddy (founder, 2026-10-11); × or a tap
  // outside collapses it. Customizing / renaming moved into the big view.
  const [zoom, setZoom] = useState(null);             // { type: 'item', key } | { type: 'buddy', id }
  const saveTimer = useRef(null);
  const lugGiven = luggage !== undefined;

  useEffect(() => {
    if (readOnly) return undefined;
    let gone = false;
    (async () => {
      const g = await gearGet();
      if (!gone) setState(g);
    })();
    return () => { gone = true; };
  }, [readOnly]);
  useEffect(() => {
    if (readOnly || lugGiven) return undefined;
    let gone = false;
    (async () => { const d = await luggageGet(); if (!gone) setOwnLug(d); })();
    return () => { gone = true; };
  }, [readOnly, lugGiven]);
  const lug = lugGiven ? luggage : ownLug;
  const luggageSids = useMemo(() => {
    const sids = new Set();
    for (const faces of Object.values(lug?.placements || {})) for (const list of Object.values(faces || {})) for (const pl of list || []) sids.add(pl.sid);
    return sids;
  }, [lug]);

  // A visitor's flags never ride someone else's items.
  const flagsOf = readOnly ? (ownerFlags || null) : (ownerFlags || profile);
  const stickers = useMemo(() => buildStickers(Array.isArray(stamps) ? stamps : [], flagsOf), [stamps, flagsOf]);
  const bySid = useMemo(() => Object.fromEntries(stickers.map((x) => [x.sid, x])), [stickers]);

  const data = readOnly ? { gear: gearProp || {}, buddies: buddiesProp || [], layout: layoutProp || {} } : state;
  const gear = data?.gear || {};
  const buddies = (Array.isArray(data?.buddies) ? data.buddies : []).slice(0, MAX_BUDDIES);
  const order = (data?.layout?.order || []).filter((k) => k === "laptop" || k === "drink");
  const shelfOrder = order.length === 2 ? order : ["laptop", "drink"];

  // Where the traveler is right now — rides along on selection events so the
  // admin report can slice picks per city / per country ($.city / $.country,
  // the same payload keys every other located event uses).
  const here = () => ({
    city: activeLocation?.address?.city || null,
    country: activeLocation?.address?.country || null,
  });

  const save = (patch) => {
    setState((s) => ({ ...s, ...patch }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await gearSet(patch);
      if (error) showToast(error, "error");
    }, 700);
  };
  // One gear_select per settled pick (the 700ms debounce above also stops a
  // color-swatch sprint from spamming D1 — only the final choice logs).
  const gearLog = useRef(null);
  const setItem = (kind, item) => {
    save({ gear: { ...gear, [kind]: item } });
    if (gearLog.current) clearTimeout(gearLog.current);
    gearLog.current = setTimeout(() => {
      logEvent("gear_select", {
        item: kind === "laptop" ? "laptop" : item?.variant || "tumbler",
        color: item?.color || "blue", stickers: (item?.placements || []).length, ...here(),
      }, "Profile");
    }, 900);
  };

  // Where each earned sticker already lives — one home per sticker.
  const usedElsewhere = useMemo(() => {
    const m = new Map();
    for (const sid of luggageSids) m.set(sid, "luggage");
    for (const kind of ["laptop", "drink"]) for (const pl of gear[kind]?.placements || []) if (!m.has(pl.sid)) m.set(pl.sid, kind === "laptop" ? "laptop" : "bottle");
    return m;
  }, [luggageSids, gear]);
  const usedFor = (kind) => {
    const m = new Map();
    for (const [sid, where] of usedElsewhere) if (where !== (kind === "laptop" ? "laptop" : "bottle")) m.set(sid, where);
    return m;
  };

  // Drag a tile sideways past its neighbour to swap the shelf order.
  const dragCard = useRef(null);
  const cardDown = (kind) => (e) => { dragCard.current = { kind, x: e.clientX, moved: false }; };
  const cardMove = (e) => {
    const d = dragCard.current;
    if (!d || d.moved || readOnly) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 70) {
      d.moved = true;
      const next = [...shelfOrder].reverse();
      save({ layout: { order: next } });
    }
  };
  const cardUp = (kind) => (e) => {
    const d = dragCard.current;
    dragCard.current = null;
    if (d && !d.moved && Math.abs(e.clientX - d.x) < 8) setZoom({ type: "item", key: kind });
  };

  // Swiping a pet cycles its pose; a tap enlarges it.
  const setPose = (b, pose) => save({ buddies: buddies.map((x) => (x.id === b.id ? { ...x, pose } : x)) });
  const nextPose = (b, dx) => POSES[(POSES.indexOf(b.pose) + (dx > 0 ? 1 : POSES.length - 1)) % POSES.length];
  const petTouch = useRef(null);
  const petDown = (e) => { petTouch.current = { x: e.clientX }; };
  const petUp = (b, onTap) => (e) => {
    const t = petTouch.current;
    petTouch.current = null;
    if (!t) return;
    const dx = e.clientX - t.x;
    if (Math.abs(dx) > 34 && !readOnly) setPose(b, nextPose(b, dx));
    else if (onTap) onTap();
  };

  const saveBuddy = (b) => {
    const next = b.id ? buddies.map((x) => (x.id === b.id ? { ...x, ...b } : x)) : [...buddies, { ...b, id: `b-${Date.now().toString(36)}` }];
    save({ buddies: next });
    setBuddyOpen(null);
    logEvent(b.id ? "buddy_update" : "buddy_add", { species: b.species, breed: b.breed, coat: b.coat || null, count: next.length, ...here() }, "Profile");
    showToast(b.id ? "Saved" : `${b.name} joined your travels`, "success");
  };
  const removeBuddy = (b) => {
    save({ buddies: buddies.filter((x) => x.id !== b.id) });
    setBuddyOpen(null);
    logEvent("buddy_remove", { species: b.species, breed: b.breed, ...here() }, "Profile");
    showToast(`${b.name} said goodbye`, "success");
  };

  const first = String(ownerFirst ?? "").trim();
  const tab = SHOW_GEAR
    ? (readOnly ? (first ? `${possessive(first)} kit` : "Their kit") : "My kit")
    : (readOnly ? (first ? `${possessive(first)} travel buddies` : "Travel buddies") : "My travel buddies");
  const art = tablet ? 120 : 80;
  const keyTap = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  const itemTile = (kind) => {
    const item = itemOf(gear, kind);
    const name = kind === "laptop" ? (readOnly ? "Laptop" : "My laptop") : drinkName(item);
    return (
      <div key={kind} role="button" tabIndex={0} aria-label={name}
        onPointerDown={cardDown(kind)} onPointerMove={cardMove} onPointerUp={cardUp(kind)}
        onKeyDown={keyTap(() => setZoom({ type: "item", key: kind }))}
        style={{ ...TILE, touchAction: "pan-y" }}>
        <div className="pointer-events-none" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <GearArt kind={kind} item={item} width={art} stickersBySid={bySid} />
        </div>
        <span style={TILE_NAME}>{name}</span>
        <span aria-hidden="true" style={TILE_HINT}>TAP TO SEE IT</span>
      </div>
    );
  };

  const buddyTile = (b) => (
    <div key={b.id} role="button" tabIndex={0} aria-label={b.name}
      onPointerDown={petDown} onPointerUp={petUp(b, () => setZoom({ type: "buddy", id: b.id }))}
      onKeyDown={keyTap(() => setZoom({ type: "buddy", id: b.id }))}
      style={{ ...TILE, touchAction: "pan-y" }}>
      <div className="pointer-events-none" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <PetArt buddy={b} width={art} />
      </div>
      <span style={TILE_NAME}>{b.name}</span>
      <span aria-hidden="true" style={TILE_HINT}>TAP TO SEE IT</span>
    </div>
  );

  const room = MAX_BUDDIES - buddies.length;
  const seat = !readOnly && room > 0 ? (
    <button key="seat" type="button" onClick={() => setBuddyOpen("new")}
      style={{ ...TILE, justifyContent: "center", gap: 8, background: "transparent", border: `1.5px dashed ${NEUTRAL.brassRule}`, fontFamily: "inherit", minHeight: 44 }}>
      <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 999, border: `1px solid ${NEUTRAL.brassRule}` }}>
        <Plus size={16} color={KIT.tab} strokeWidth={2} />
      </span>
      <span style={{ fontFamily: SERIF, fontSize: fs(15), lineHeight: 17 / 15, color: INK, textAlign: "center", overflowWrap: "anywhere" }}>
        {buddies.length ? `Room for ${room} more` : `Room for ${MAX_BUDDIES} travel buddies`}
      </span>
      <span style={{ fontSize: fs(12), lineHeight: 15 / 12, fontWeight: 600, color: KIT.tab, textAlign: "center" }}>Add your travel buddy</span>
    </button>
  ) : null;

  const buddyLabel = readOnly
    ? (buddies.length === 1 ? "TRAVEL BUDDY" : buddies.length ? "TRAVEL BUDDIES" : null)
    : "TRAVEL BUDDIES";

  // While the owner's kit loads: the folder and its labels, quiet tiles, no guessed items.
  const loading = !readOnly && !state;
  // Pets only: someone else's page with no travel buddies shows no kit at all.
  if (!SHOW_GEAR && readOnly && !buddies.length) return null;

  return (
    <Folder stock="kit" size="profile" tab={tab} padding="16px" className={className} style={style}>
      {SHOW_GEAR ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, alignItems: "end" }}>
          <h3 style={{ ...LABEL, gridColumn: "span 2 / span 2" }}>{readOnly ? "VIRTUAL ITEMS" : "MY VIRTUAL ITEMS"}</h3>
          {buddyLabel ? <h3 style={LABEL}>{buddyLabel}</h3> : null}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: SHOW_GEAR ? 8 : 0 }}>
        {loading
          ? [0, 1, 2].map((i) => <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none" style={{ ...TILE, cursor: "default", minHeight: art + 64, background: NEUTRAL.white }} />)
          : <>{SHOW_GEAR ? shelfOrder.map(itemTile) : null}{buddies.map(buddyTile)}{seat}</>}
      </div>
      {loading ? <span className="sr-only">Loading your kit</span> : null}

      {/* One tap enlarges an item or a buddy (founder, 2026-10-11): the big
          picture first; × or a tap outside collapses it. Customizing and
          renaming are one button away inside it. */}
      {zoom && onBody((() => {
        const isItem = zoom.type === "item";
        const b = isItem ? null : buddies.find((x) => x.id === zoom.id);
        if (!isItem && !b) return null;
        const item = isItem ? itemOf(gear, zoom.key) : null;
        const n = item ? (item.placements || []).length : 0;
        const coffees = isItem && !readOnly && zoom.key === "drink" ? (item.coffees || []).filter(Boolean).slice(0, 3) : [];
        const vw = (typeof window !== "undefined" && window.innerWidth) || 390;
        const big = Math.max(200, Math.min(320, Math.round(vw - 110)));
        const title = isItem ? (zoom.key === "laptop" ? (readOnly ? "Laptop" : "My laptop") : drinkName(item)) : b.name;
        const sub = isItem
          ? [GEAR_COLORS.find((c) => c.key === (item.color || "blue"))?.name, n ? `${n} sticker${n === 1 ? "" : "s"}` : "No stickers yet"].filter(Boolean).join(" · ")
          : breedName(b.species, b.breed);
        return (
          <div className="fixed inset-0 z-[10010] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label={title || "Enlarged"}
            style={{ background: "rgba(22,17,13,.6)", backdropFilter: "blur(3px)" }} onClick={() => setZoom(null)}>
            <div className="w-full max-w-sm rounded-3xl px-5 pt-5 pb-4 text-center" style={{ background: "#F3EEE1", position: "relative", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }} onClick={(e) => e.stopPropagation()}>
              <CloseButton onClick={() => setZoom(null)} style={{ position: "absolute", top: 10, right: 10, zIndex: 2 }} />
              {isItem ? (
                <div className="flex justify-center" style={{ marginTop: 8 }}><GearArt kind={zoom.key} item={item} width={big} stickersBySid={bySid} /></div>
              ) : (
                // Swipe the big buddy too, to change its pose.
                <div className="flex justify-center select-none" style={{ marginTop: 8, touchAction: "pan-y" }} onPointerDown={petDown} onPointerUp={petUp(b, null)}>
                  <div className="pointer-events-none"><PetArt buddy={b} width={big} /></div>
                </div>
              )}
              <div style={{ fontFamily: SERIF, fontSize: fs(26), color: INK, lineHeight: 1.1, marginTop: 6 }}>{title}</div>
              {sub && <div style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".08em", color: INK3, textTransform: "uppercase", marginTop: 3 }}>{sub}</div>}
              {coffees.length > 0 && (
                <ul className="text-left mt-3" style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }} aria-label="How I take my coffee">
                  {coffees.map((c, i) => (
                    <li key={i} className="flex items-start gap-2" style={{ fontSize: fs(14), color: INK2, lineHeight: 1.45, padding: "6px 0", borderTop: i ? `1px solid ${RULE}` : "none" }}>
                      <Coffee size={15} color={KIT.tab} aria-hidden="true" style={{ flex: "none", marginTop: 3 }} />
                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{c}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!isItem && !readOnly && (
                <div className="flex justify-center gap-2 mt-3">
                  {POSES.map((p) => (
                    <button key={p} type="button" onClick={() => setPose(b, p)} aria-pressed={b.pose === p}
                      className="rounded-full px-4 font-semibold" style={{ minHeight: 44, background: b.pose === p ? INK : "#fff", color: b.pose === p ? "#fff" : INK, border: `1px solid ${RULE}`, fontSize: fs(13) }}>
                      {p === "sitting" ? "Sitting" : "Standing"}
                    </button>
                  ))}
                </div>
              )}
              {!readOnly && (
                <button type="button" onClick={() => { setZoom(null); if (isItem) setOpen(zoom.key); else setBuddyOpen(b); }}
                  className="w-full rounded-xl mt-4 font-semibold flex items-center justify-center gap-2" style={{ minHeight: 48, background: INK, color: "#fff", fontSize: fs(14.5) }}>
                  {isItem ? <Palette size={17} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
                  {isItem ? "Customize color and stickers" : "Rename or say goodbye"}
                </button>
              )}
            </div>
          </div>
        );
      })())}
      {SHOW_GEAR && open && !readOnly && onBody(
        <GearModal kind={open} item={itemOf(gear, open)}
          stamps={stamps} stickersBySid={bySid} usedElsewhere={usedFor(open)}
          onChange={(item) => setItem(open, item)} onClose={() => setOpen(null)} />
      )}
      {buddyOpen && !readOnly && onBody(
        <BuddyModal buddy={buddyOpen === "new" ? null : buddyOpen}
          onSave={saveBuddy} onRemove={() => removeBuddy(buddyOpen)} onClose={() => setBuddyOpen(null)} />
      )}
    </Folder>
  );
}
