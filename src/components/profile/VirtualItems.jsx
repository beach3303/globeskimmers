// "My virtual items" (founder, 2026-10-05): beside the trunk, a generic laptop
// and a drink container — tumbler, straw bottle or lid bottle — each in the
// founder's colors, each taking the traveler's EARNED stickers (same inventory
// as the luggage; a sticker lives on ONE item at a time, so a flag on the trunk
// can't also ride the laptop). Items enlarge to edit, and the shelf order can
// be dragged. Below them, up to six named travel buddies (virtual pets):
// species → breed → coat → name, pose cycles with a swipe (sitting / standing).
// Pets never take stickers. The founder's photo renders live on R2 at
// stamp-art/pets/<species>/<breed>[/<coat>]/<pose> and replace the drawn
// fallback automatically, like the luggage skins. Every pick logs a gear_select
// / buddy_add event (with city+country) so the admin can report what travelers
// choose, per day/week/month and per place.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "@/components/location/LocationContext";
import { logEvent } from "@/lib/analytics";
import { gearGet, gearSet } from "@/lib/gear";
import { luggageGet } from "@/lib/passport";
import { buildStickers } from "@/components/passport/VirtualLuggage";
import LuggageLabel from "@/components/passport/LuggageLabel";
import { GEAR_SHAPES, GEAR_COLORS, DRINK_VARIANTS, GEAR_BOUNDS, colorOf } from "@/components/profile/gearShapes";
import { PET_SHAPES, POSES } from "@/components/profile/petShapes";
import { SPECIES, BREEDS, breedName } from "@/lib/petCatalog";
import { coatsFor, coatFor } from "@/lib/petCoats";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)", IVORY = "#FFFCF7";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;
const PETS_BASE = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/pets";
const GEAR_BASE = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/gear";

const svgFor = (kind, variant, colorKey) => {
  const c = colorOf(colorKey);
  const fn = kind === "laptop" ? GEAR_SHAPES.laptop : GEAR_SHAPES[variant] || GEAR_SHAPES.tumbler;
  return fn(c.body, c.dark, c.lite);
};

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
        <img src={renderUrl} alt="" onError={() => setArtFail(true)} style={{ width, height: width, objectFit: "contain", display: "block" }} />
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
export function PetArt({ buddy, width }) {
  // Render ladder: coat render in this pose → breed render in this pose → the
  // coat's sitting render (most coats shipped sitting-only) → breed sitting →
  // the drawn chibi. The chibi has no standing drawing, so it maps to sitting.
  const [step, setStep] = useState(0);
  const base = `${PETS_BASE}/${buddy.species}/${buddy.breed || "any"}`;
  const urls = [...new Set([
    buddy.coat ? `${base}/${buddy.coat}/${buddy.pose}.webp` : null,
    `${base}/${buddy.pose}.webp`,
    buddy.coat ? `${base}/${buddy.coat}/sitting.webp` : null,
    `${base}/sitting.webp`,
  ].filter(Boolean))];
  useEffect(() => { setStep(0); }, [buddy.species, buddy.breed, buddy.coat, buddy.pose]);
  if (step < urls.length) {
    return <img src={urls[step]} alt="" onError={() => setStep(step + 1)} style={{ width, height: width, objectFit: "contain", display: "block" }} />;
  }
  const fn = PET_SHAPES[buddy.species] || PET_SHAPES.dog;
  const pose = buddy.pose === "standing" ? "sitting" : buddy.pose;
  return <svg viewBox="0 0 340 340" width={width} height={width} style={{ display: "block" }} aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: fn(pose, coatFor(buddy.species, buddy.breed, buddy.coat)) }} />;
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
            {kind === "laptop" ? "My laptop" : DRINK_VARIANTS.find((v) => v.key === variant)?.name || "My bottle"}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <X size={16} color={INK} />
          </button>
        </div>

        <div className="flex justify-center mt-2" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <GearArt kind={kind} item={item} width={W} stickersBySid={stickersBySid} edit selected={selected} onSelect={setSelected} boxRef={boxRef} />
        </div>

        {/* Colors — the founder's eight. */}
        <div className="flex flex-wrap items-center gap-2 mt-2" role="radiogroup" aria-label="Color">
          {GEAR_COLORS.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={(item?.color || "blue") === c.key} aria-label={c.name}
              onClick={() => patch({ color: c.key })} className="rounded-full"
              style={{ width: 27, height: 27, background: c.body, border: (item?.color || "blue") === c.key ? `3px solid ${INK}` : `2px solid rgba(22,17,13,.18)` }} />
          ))}
        </div>

        {kind === "drink" && (
          <>
            <div className="grid grid-cols-3 gap-1.5 mt-2.5">
              {DRINK_VARIANTS.map((v) => (
                <button key={v.key} type="button" onClick={() => patch({ variant: v.key })}
                  className="rounded-xl px-2 py-2 text-center"
                  style={{ background: variant === v.key ? INK : "#fff", color: variant === v.key ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(11.5), fontWeight: 600, fontFamily: "inherit", lineHeight: 1.2 }}>
                  {v.name}
                </button>
              ))}
            </div>
            {/* Top-3 coffee orders, the traveler's own words (founder, 2026-10-05
                evening) — they print in a small column beside the drink on the shelf. */}
            <div style={{ fontFamily: SERIF, fontSize: fs(16), color: INK, marginTop: 12 }}>How I take my coffee (or tea)</div>
            <p style={{ fontSize: fs(11), color: INK3, margin: "2px 0 6px", lineHeight: 1.4 }}>Your top 3, your words — they print beside your drink.</p>
            {[0, 1, 2].map((i) => (
              <input key={i} value={(item?.coffees || [])[i] || ""} aria-label={`Coffee order ${i + 1}`}
                onChange={(e) => { const next = [0, 1, 2].map((j) => (item?.coffees || [])[j] || ""); next[i] = e.target.value.slice(0, 48); patch({ coffees: next }); }}
                placeholder={["Cold brew, grande, 3 Splendas", "Oat milk latte, extra hot", "Earl Grey, splash of honey"][i]}
                className="w-full rounded-xl px-3 h-10 outline-none" style={{ background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(13), color: INK, marginTop: i ? 6 : 0 }} />
            ))}
          </>
        )}

        {/* Selected sticker: size + turn + remove. */}
        {sel && (
          <div className="rounded-xl px-3 py-2.5 mt-2.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: fs(12), color: INK3, minWidth: 34 }}>Size</span>
              <input type="range" min="0.5" max="2.2" step="0.05" value={sel.scale} aria-label="Sticker size"
                onChange={(e) => patchPl(sel.sid, { scale: Number(e.target.value) })} style={{ flex: 1, accentColor: INK }} />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span style={{ fontSize: fs(12), color: INK3, minWidth: 34 }}>Turn</span>
              <input type="range" min="-45" max="45" step="1" value={sel.rot} aria-label="Sticker rotation"
                onChange={(e) => patchPl(sel.sid, { rot: Number(e.target.value) })} style={{ flex: 1, accentColor: INK }} />
              <button type="button" onClick={removeSel} aria-label="Take the sticker off" className="rounded-lg p-1.5" style={{ background: IVORY, border: `1px solid ${RULE}` }}>
                <Trash2 size={14} color="#B0472F" />
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => setPicking(true)}
          className="w-full mt-2.5 rounded-xl py-2.5 font-semibold" style={{ background: "#fff", color: INK, border: `1.5px dashed rgba(22,17,13,.3)`, fontSize: fs(13.5) }}>
          + Add a sticker
        </button>
        <p className="text-center" style={{ fontSize: fs(10.5), color: INK3, marginTop: 6, fontFamily: MONO, letterSpacing: ".04em" }}>
          Stickers are earned by traveling — and each one lives on one item at a time.
        </p>

        {picking && (
          <div className="rounded-xl p-3 mt-2" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <div className="flex items-center justify-between">
              <span style={{ fontWeight: 700, fontSize: fs(13.5), color: INK }}>Your stickers</span>
              <button type="button" onClick={() => setPicking(false)} style={{ fontSize: fs(12.5), color: INK3, fontFamily: "inherit" }}>Close</button>
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
  const breeds = species ? (BREEDS[species] || []).filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase())) : [];
  const ready = species && breed && name.trim().length > 0;
  const preview = species ? { species, breed: breed || "any", coat, pose: "sitting" } : null;
  return (
    <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={isNew ? "Add a travel buddy" : "Your travel buddy"}
      style={{ background: "rgba(22,17,13,.6)", backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-4 overflow-y-auto" style={{ background: "#F3EEE1", maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate" style={{ fontFamily: SERIF, fontSize: fs(21), color: INK }}>{isNew ? "Add your travel buddy" : name || "Your buddy"}</div>
            {!isNew && species && <div className="truncate" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".06em", color: INK3, textTransform: "uppercase" }}>{breedName(species, breed) || species}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <X size={16} color={INK} />
          </button>
        </div>

        {preview && <div className="flex justify-center my-1"><PetArt key={`${species}-${breed}-${coat}`} buddy={preview} width={150} /></div>}

        <div className="flex flex-wrap gap-1.5 mt-1" role="radiogroup" aria-label="Species">
          {SPECIES.map((s) => (
            <button key={s.key} type="button" role="radio" aria-checked={species === s.key}
              onClick={() => { setSpecies(s.key); setBreed(null); setCoat(null); setQ(""); }}
              className="rounded-full px-3 py-1.5" style={{ background: species === s.key ? INK : "#fff", color: species === s.key ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(12.5), fontWeight: 600, fontFamily: "inherit" }}>
              {s.emoji} {s.name}
            </button>
          ))}
        </div>

        {species && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${breeds.length || (BREEDS[species] || []).length} breeds…`} aria-label="Search breeds"
              className="w-full mt-2.5 rounded-xl px-3 h-10 outline-none" style={{ background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(14), color: INK }} />
            <div className="flex flex-wrap gap-1.5 mt-2" style={{ maxHeight: 132, overflowY: "auto" }}>
              {breeds.slice(0, 60).map((b) => (
                <button key={b.key} type="button" onClick={() => { setBreed(b.key); setCoat(null); }}
                  className="rounded-full px-2.5 py-1" style={{ background: breed === b.key ? INK : "#fff", color: breed === b.key ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(11.5), fontFamily: "inherit" }}>
                  {b.name}
                </button>
              ))}
            </div>
            {/* Coats are per-breed where the founder rendered them (a cavalier offers
                Ruby, a great dane Harlequin); other breeds show the species palette. */}
            {breed && (
              <div className="flex flex-wrap items-center gap-2 mt-2.5" role="radiogroup" aria-label="Coat color">
                {coatsFor(species, breed).map((c) => (
                  <button key={c.key} type="button" role="radio" aria-checked={coat === c.key} aria-label={c.name} title={c.name}
                    onClick={() => setCoat(c.key)} className="rounded-full"
                    style={{ width: 25, height: 25, background: c.body, border: coat === c.key ? `3px solid ${INK}` : `2px solid rgba(22,17,13,.18)` }} />
                ))}
                {coat && <span style={{ fontSize: fs(11), color: INK3 }}>{coatsFor(species, breed).find((c) => c.key === coat)?.name}</span>}
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
            <button type="button" onClick={onRemove} className="rounded-xl px-3 py-3" aria-label="Say goodbye" style={{ background: "#fff", color: "#B0472F", border: `1px solid ${RULE}`, fontSize: fs(13.5), fontWeight: 600 }}>
              <Trash2 size={15} />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14) }}>Cancel</button>
          <button type="button" disabled={!ready}
            onClick={() => onSave({ id: buddy?.id, species, breed, coat: coat || "", name: name.trim(), pose: buddy?.pose || "sitting" })}
            className="flex-1 rounded-xl py-3 font-semibold disabled:opacity-50" style={{ background: INK, color: "#fff", fontSize: fs(14) }}>
            {isNew ? "Add buddy" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The shelf on the profile ────────────────────────────────────────────────
export default function VirtualItems({ stamps }) {
  const { profile } = useAuth();
  const { activeLocation } = useLocation();
  const [state, setState] = useState(null);           // { gear, buddies, layout }
  const [luggageSids, setLuggageSids] = useState(new Set());
  const [open, setOpen] = useState(null);             // 'laptop' | 'drink'
  const [buddyOpen, setBuddyOpen] = useState(null);   // 'new' | buddy object
  const [coffeeOpen, setCoffeeOpen] = useState(null); // string[] — the enlarged coffee card
  const saveTimer = useRef(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      const [g, lug] = await Promise.all([gearGet(), luggageGet()]);
      if (gone) return;
      setState(g);
      const sids = new Set();
      for (const faces of Object.values(lug?.placements || {})) for (const list of Object.values(faces || {})) for (const pl of list || []) sids.add(pl.sid);
      setLuggageSids(sids);
    })();
    return () => { gone = true; };
  }, []);

  const stickers = useMemo(() => buildStickers(stamps, profile), [stamps, profile]);
  const bySid = useMemo(() => Object.fromEntries(stickers.map((x) => [x.sid, x])), [stickers]);

  const gear = state?.gear || {};
  const buddies = state?.buddies || [];
  const order = (state?.layout?.order || []).filter((k) => k === "laptop" || k === "drink");
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

  // Drag a card sideways past its neighbour to swap the shelf order.
  const dragCard = useRef(null);
  const cardDown = (kind) => (e) => { dragCard.current = { kind, x: e.clientX, moved: false }; };
  const cardMove = (e) => {
    const d = dragCard.current;
    if (!d || d.moved) return;
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
    if (d && !d.moved && Math.abs(e.clientX - d.x) < 8) setOpen(kind);
  };

  // Swiping a pet cycles its pose; a tap opens its sheet.
  const petTouch = useRef(null);
  const petDown = (e) => { petTouch.current = { x: e.clientX }; };
  const petUp = (b) => (e) => {
    const t = petTouch.current;
    petTouch.current = null;
    if (!t) return;
    const dx = e.clientX - t.x;
    if (Math.abs(dx) > 34) {
      const i = POSES.indexOf(b.pose);
      const pose = POSES[(i + (dx > 0 ? 1 : POSES.length - 1)) % POSES.length];
      save({ buddies: buddies.map((x) => (x.id === b.id ? { ...x, pose } : x)) });
    } else setBuddyOpen(b);
  };

  const saveBuddy = (b) => {
    const next = b.id ? buddies.map((x) => (x.id === b.id ? { ...x, ...b } : x)) : [...buddies, { ...b, id: `b-${Date.now().toString(36)}` }];
    save({ buddies: next });
    setBuddyOpen(null);
    logEvent(b.id ? "buddy_update" : "buddy_add", { species: b.species, breed: b.breed, coat: b.coat || null, count: next.length, ...here() }, "Profile");
    showToast(b.id ? "Saved" : `${b.name} joined your travels 🧳`, "success");
  };
  const removeBuddy = (b) => {
    save({ buddies: buddies.filter((x) => x.id !== b.id) });
    setBuddyOpen(null);
    logEvent("buddy_remove", { species: b.species, breed: b.breed, ...here() }, "Profile");
    showToast(`${b.name} says goodbye 👋`, "success");
  };

  if (!state) return null;

  const card = (kind) => {
    const item = gear[kind] || (kind === "drink" ? { variant: "tumbler", color: "blue" } : { color: "blue" });
    const n = (item.placements || []).length;
    return (
      <div key={kind} role="button" tabIndex={0} aria-label={kind === "laptop" ? "My laptop" : "My bottle"}
        onPointerDown={cardDown(kind)} onPointerMove={cardMove} onPointerUp={cardUp(kind)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(kind); } }}
        className="flex-1 rounded-2xl p-3 text-center select-none" style={{ background: IVORY, border: `1px solid ${RULE}`, cursor: "pointer", touchAction: "pan-y" }}>
        {(() => {
          // With coffee orders the cup moves LEFT and the list takes the right
          // column, no overlap (founder, 2026-10-05 evening). Tapping the list
          // enlarges it to the center of the screen; × collapses it back.
          const coffees = kind === "drink" ? (item.coffees || []).filter(Boolean).slice(0, 3) : [];
          if (!coffees.length) {
            return <div className="flex justify-center pointer-events-none"><GearArt kind={kind} item={item} width={128} stickersBySid={bySid} /></div>;
          }
          return (
            <div className="flex items-center pointer-events-none" style={{ gap: 2 }}>
              <div style={{ flex: "none" }}><GearArt kind={kind} item={item} width={100} stickersBySid={bySid} /></div>
              <div role="button" tabIndex={0} aria-label="Read my coffee orders"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => { e.stopPropagation(); setCoffeeOpen(coffees); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setCoffeeOpen(coffees); } }}
                style={{ pointerEvents: "auto", flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer" }}>
                {coffees.map((c, i) => (
                  <div key={i} style={{ fontFamily: MONO, fontSize: fs(7.5), lineHeight: 1.8, color: INK2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>☕ {c}</div>
                ))}
              </div>
            </div>
          );
        })()}
        <div style={{ fontFamily: SERIF, fontSize: fs(15.5), color: INK, marginTop: 2 }}>
          {kind === "laptop" ? "My laptop" : DRINK_VARIANTS.find((v) => v.key === (item.variant || "tumbler"))?.name}
        </div>
        <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".08em", color: INK3, textTransform: "uppercase" }}>
          {n ? `${n} sticker${n === 1 ? "" : "s"}` : "Tap to customize"}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto px-4 mt-5">
      <div style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".14em", color: "#B0472F", textTransform: "uppercase" }}>My virtual items</div>
      <div className="flex gap-2.5 mt-2">{shelfOrder.map(card)}</div>
      <p style={{ fontSize: fs(11), color: INK3, marginTop: 6, lineHeight: 1.4 }}>
        Tap an item to color it and place your earned stickers — drag a card sideways to rearrange the shelf.
      </p>

      <div className="flex items-baseline justify-between mt-5">
        <div style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".14em", color: "#B0472F", textTransform: "uppercase" }}>Travel buddies</div>
        <span style={{ fontFamily: MONO, fontSize: fs(10), color: INK3 }}>{buddies.length}/6</span>
      </div>
      <div className="flex gap-2.5 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {buddies.map((b) => (
          <div key={b.id} role="button" tabIndex={0} aria-label={b.name}
            onPointerDown={petDown} onPointerUp={petUp(b)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBuddyOpen(b); } }}
            className="flex-none rounded-2xl p-2.5 text-center select-none" style={{ width: 118, background: IVORY, border: `1px solid ${RULE}`, cursor: "pointer", touchAction: "pan-y" }}>
            <div className="pointer-events-none"><PetArt buddy={b} width={92} /></div>
            {/* Just the name (founder, 2026-10-05 evening: no pose caption) —
                the breed and pose live in the manage sheet. */}
            <div className="truncate" style={{ fontFamily: SERIF, fontSize: fs(16), color: INK }}>{b.name}</div>
          </div>
        ))}
        {buddies.length < 6 && (
          <button type="button" onClick={() => setBuddyOpen("new")} aria-label="Add your travel buddy"
            className="flex-none rounded-2xl flex flex-col items-center justify-center gap-1" style={{ width: 118, minHeight: 148, background: "#fff", border: `1.5px dashed rgba(22,17,13,.3)` }}>
            <Plus size={20} color={INK3} />
            <span style={{ fontSize: fs(11.5), color: INK2, fontWeight: 600 }}>Add your<br />travel buddy</span>
          </button>
        )}
      </div>
      {buddies.length > 0 && (
        <p style={{ fontSize: fs(11), color: INK3, marginTop: 4, lineHeight: 1.4 }}>Swipe a buddy to change its pose — sitting or standing. Tap to rename or say goodbye.</p>
      )}

      {open && (
        <GearModal kind={open} item={gear[open] || (open === "drink" ? { variant: "tumbler", color: "blue" } : { color: "blue" })}
          stamps={stamps} stickersBySid={bySid} usedElsewhere={usedFor(open)}
          onChange={(item) => setItem(open, item)} onClose={() => setOpen(null)} />
      )}
      {buddyOpen && (
        <BuddyModal buddy={buddyOpen === "new" ? null : buddyOpen}
          onSave={saveBuddy} onRemove={() => removeBuddy(buddyOpen)} onClose={() => setBuddyOpen(null)} />
      )}
      {/* The coffee list, enlarged to the center of the screen (tap the tiny
          column to open; × or a tap outside collapses it back). */}
      {coffeeOpen && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="How I take my coffee"
          style={{ background: "rgba(22,17,13,.6)", backdropFilter: "blur(3px)" }} onClick={() => setCoffeeOpen(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "#F3EEE1", position: "relative", boxShadow: "0 24px 60px -20px rgba(0,0,0,.45)" }} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setCoffeeOpen(null)} aria-label="Close" className="rounded-full p-1.5"
              style={{ position: "absolute", top: 10, right: 10, background: "#fff", border: `1px solid ${RULE}` }}>
              <X size={16} color={INK} />
            </button>
            <div style={{ fontFamily: SERIF, fontSize: fs(21), color: INK, marginBottom: 6, paddingRight: 30 }}>How I take my coffee</div>
            {coffeeOpen.map((c, i) => (
              <div key={i} style={{ fontSize: fs(16), color: INK2, lineHeight: 1.5, padding: "9px 0", borderTop: i ? `1px solid ${RULE}` : "none" }}>☕ {c}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
