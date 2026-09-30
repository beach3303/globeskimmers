// VirtualLuggage — the interactive collectible travel trunk (founder direction
// + ChatGPT reference boards, 2026-09-30). Six luggage styles, five swipeable
// faces (FRONT → RIGHT → BACK → LEFT, TOP by its own chip), pseudo-3D page
// turn. The luggage artwork is the BACKGROUND layer; earned destination
// stickers are a separate interactive layer: drag, pinch to resize, rotate,
// per-face, saved server-side with NORMALIZED coords so they hold across
// phones. Production face renders live in R2 at
// stamp-art/luggage/<type>/<face>.webp (clean faces, no demo stickers); until
// a render is uploaded, a quiet engraved fallback face keeps the trunk
// respectable — never cartoon.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, PencilLine, Check, Trash2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import { deriveLabels } from "@/lib/labels";
import { luggageGet, luggageSet } from "@/lib/passport";
import LuggageLabel from "@/components/passport/LuggageLabel";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK3 = "#736657", RULE = "rgba(22,17,13,.12)", IVORY = "#FFFCF7";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const ART_BASE = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/luggage";

// The six-piece collection (the boards' palette, kept respectable).
export const LUGGAGE_TYPES = [
  { key: "classic", name: "The Classic", body: "#2C3A57", strap: "#5C4630", edge: "#1E2A42" },
  { key: "cognac", name: "The Cognac", body: "#8A4F26", strap: "#4E301B", edge: "#6E3D1C" },
  { key: "midnight", name: "The Midnight", body: "#26201B", strap: "#171310", edge: "#171310" },
  { key: "expedition", name: "The Expedition", body: "#35472F", strap: "#7A4A26", edge: "#273622" },
  { key: "voyager", name: "The Voyager", body: "#E9E2D0", strap: "#8A4F26", edge: "#CFC6AE" },
  { key: "explorer", name: "The Explorer", body: "#5E2320", strap: "#3B2317", edge: "#471A18" },
];
const SWIPE_ORDER = ["front", "right", "back", "left"];
const FACES = ["front", "right", "back", "left", "top"];
// Per-face canvas aspect (h/w) — sides are tall, the lid is low.
const ASPECT = { front: 0.62, back: 0.62, left: 1.3, right: 1.3, top: 0.34 };
// Sticker-safe region (normalized) — a sticker never half-falls off the trunk.
const BOUNDS = { xMin: 0.08, xMax: 0.92, yMin: 0.14, yMax: 0.88 };

const STICKER_INKS = ["#7A2E1D", "#31465F", "#2F4A33", "#7A5B22", "#4E3A5E"];
const STICKER_SHAPES = ["roundel", "lozenge", "diamond"];
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const ROMAN = { 2024: "MMXXIV", 2025: "MMXXV", 2026: "MMXXVI", 2027: "MMXXVII", 2028: "MMXXVIII" };

// The sticker inventory is EARNED, never bought: the storied labels plus one
// destination sticker per stamped city and one roundel per airport.
export function buildStickers(stamps) {
  const out = [];
  for (const l of deriveLabels(stamps)) out.push({ sid: `label:${l.key}`, label: l, w: 96 });
  const seenCity = new Set(), seenAir = new Set();
  for (const s of stamps || []) {
    if (s.kind === "airport") {
      const iata = String(s.entity_id || "").toUpperCase().slice(0, 4);
      if (!iata || seenAir.has(iata)) continue;
      seenAir.add(iata);
      out.push({ sid: `iata:${iata}`, w: 78, label: { shape: "plane", ink: "#31465F", top: iata, big: null, sub: null, story: `Wings earned at ${s.name || iata}.` } });
    } else if (s.kind === "city") {
      const key = String(s.entity_id || s.name || "").toLowerCase();
      if (!key || key.startsWith("birthday") || seenCity.has(key)) continue;
      seenCity.add(key);
      const name = (s.city || s.name || "").toUpperCase().slice(0, 18);
      const yr = Number(String(s.visited_on || s.created_at || "").slice(0, 4));
      out.push({
        sid: `city:${key.replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`, w: 92,
        label: {
          shape: STICKER_SHAPES[hash(key) % STICKER_SHAPES.length],
          ink: STICKER_INKS[hash(key) % STICKER_INKS.length],
          top: name, big: null,
          sub: (s.country || "").toUpperCase().slice(0, 14) || (ROMAN[yr] || null),
          story: `${s.city || s.name}${s.country ? `, ${s.country}` : ""} — stamped${yr ? ` in ${yr}` : ""}.`,
        },
      });
    }
  }
  return out;
}

// The engraved fallback face — shown only while a face's photo-real render
// isn't in R2 yet. Flat leather, straps, brass corners; lock on the front,
// handle on the lid. Quiet and period-correct, never cartoon.
function FallbackFace({ type, face }) {
  const t = LUGGAGE_TYPES.find((x) => x.key === type) || LUGGAGE_TYPES[0];
  const brass = "#B08D3F", brassDark = "#8A6A25";
  const W = 300, H = Math.round(300 * (ASPECT[face] || 0.62));
  const corner = (x, y, sx, sy) => (
    <g transform={`translate(${x},${y}) scale(${sx},${sy})`}>
      <path d="M0,26 L0,8 Q0,0 8,0 L26,0 L26,7 L11,7 Q7,7 7,11 L7,26 Z" fill={brass} stroke={brassDark} strokeWidth="1" />
    </g>
  );
  const strapX = [0.3, 0.7];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id={`lgb-${type}-${face}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.body} />
          <stop offset="1" stopColor={t.edge} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width={W - 4} height={H - 4} rx="14" fill={`url(#lgb-${type}-${face})`} stroke={t.edge} strokeWidth="2.5" />
      <rect x="10" y="10" width={W - 20} height={H - 20} rx="9" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.2" strokeDasharray="1 3" />
      {face !== "top" && strapX.map((f) => (
        <g key={f}>
          <rect x={W * f - 11} y="0" width="22" height={H} fill={t.strap} />
          <rect x={W * f - 11} y="0" width="22" height={H} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1.5" />
          <rect x={W * f - 8} y={H * 0.42} width="16" height="20" rx="3" fill="none" stroke={brass} strokeWidth="2.5" />
        </g>
      ))}
      {face === "front" && (
        <g transform={`translate(${W / 2 - 15},${H * 0.16})`}>
          <rect width="30" height="24" rx="4" fill={brass} stroke={brassDark} strokeWidth="1.5" />
          <circle cx="15" cy="10" r="3" fill={brassDark} />
          <rect x="13" y="10" width="4" height="8" fill={brassDark} />
        </g>
      )}
      {face === "top" && (
        <g transform={`translate(${W / 2 - 34},${H / 2 - 9})`}>
          <rect x="0" y="4" width="68" height="10" rx="5" fill={t.strap} stroke="rgba(0,0,0,.35)" strokeWidth="1.5" />
          <rect x="-8" y="2" width="12" height="14" rx="3" fill={brass} stroke={brassDark} strokeWidth="1" />
          <rect x="64" y="2" width="12" height="14" rx="3" fill={brass} stroke={brassDark} strokeWidth="1" />
        </g>
      )}
      {corner(4, 4, 1, 1)}{corner(W - 4, 4, -1, 1)}{corner(4, H - 4, 1, -1)}{corner(W - 4, H - 4, -1, -1)}
      {[0.14, 0.86].map((fx) => [0.5].map((fy) => (
        <circle key={`${fx}-${fy}`} cx={W * fx} cy={H * fy} r="3.2" fill={brass} stroke={brassDark} strokeWidth="1" />
      )))}
    </svg>
  );
}

// One placed sticker on a face. Normal mode: tap brings it forward (and tells
// its story). Edit mode: tap selects; drag moves; two fingers pinch/rotate.
function PlacedSticker({ pl, sticker, faceW, edit, selected, onSelect, onTap }) {
  const w = (sticker?.w || 92) * pl.scale * (faceW / 340);
  return (
    <div
      data-sid={pl.sid}
      role={edit ? "button" : undefined}
      onClick={(e) => { e.stopPropagation(); if (edit) onSelect(pl.sid); else onTap(pl); }}
      style={{
        position: "absolute", left: `${pl.x * 100}%`, top: `${pl.y * 100}%`,
        width: w, transform: `translate(-50%,-50%) rotate(${pl.rot}deg)`,
        zIndex: 10 + (pl.z || 0),
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))",
        outline: selected ? "2px dashed rgba(255,255,255,.85)" : "none",
        outlineOffset: 3, borderRadius: 8, touchAction: "none",
      }}
    >
      {sticker ? <LuggageLabel label={sticker.label} uid={pl.sid.replace(/[^a-z0-9]/gi, "")} /> : null}
    </div>
  );
}

export default function VirtualLuggage({ stamps, onClose }) {
  const stickers = useMemo(() => buildStickers(stamps), [stamps]);
  const bySid = useMemo(() => Object.fromEntries(stickers.map((s) => [s.sid, s])), [stickers]);

  const [state, setState] = useState(null); // { active, placements }
  const [faceIdx, setFaceIdx] = useState(0); // index into SWIPE_ORDER, or -1 = top
  const [turn, setTurn] = useState(0);       // -1|0|1 pseudo-3D direction
  const [edit, setEdit] = useState(false);
  const [selected, setSelected] = useState(null);
  const [skinOk, setSkinOk] = useState({});  // `${type}/${face}` -> bool
  const dirty = useRef(false);
  const saveTimer = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => { (async () => setState(await luggageGet()))(); }, []);

  const active = state?.active || "classic";
  const face = faceIdx === -1 ? "top" : SWIPE_ORDER[faceIdx];
  const placements = state?.placements || {};
  const faceList = (placements[active]?.[face] || []);
  const placedSids = useMemo(() => {
    const set = new Set();
    for (const f of Object.values(placements[active] || {})) for (const p of f) set.add(p.sid);
    return set;
  }, [placements, active]);
  const tray = stickers.filter((s) => !placedSids.has(s.sid));

  const scheduleSave = useCallback((next) => {
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      dirty.current = false;
      const { error } = await luggageSet({ active: next.active, placements: next.placements });
      if (error) { dirty.current = true; showToast(error, "error"); }
    }, 900);
  }, []);
  // Flush on close so nothing placed is ever lost.
  const close = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (dirty.current && state) await luggageSet({ active: state.active, placements: state.placements });
    onClose();
  }, [onClose, state]);

  const mutate = useCallback((fn) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(structuredClone(prev));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const setFaceListIn = (draft, list) => {
    draft.placements = draft.placements || {};
    draft.placements[active] = draft.placements[active] || {};
    draft.placements[active][face] = list;
    return draft;
  };

  const placeFromTray = (sid) => {
    if (!edit) setEdit(true);
    mutate((d) => {
      const list = (d.placements?.[active]?.[face] || []).slice();
      const z = list.reduce((m, p) => Math.max(m, p.z || 0), 0) + 1;
      list.push({ sid, x: 0.5, y: 0.5, scale: 1, rot: (hash(sid) % 17) - 8, z });
      return setFaceListIn(d, list);
    });
    setSelected(sid);
  };
  const peelSelected = () => {
    if (!selected) return;
    mutate((d) => setFaceListIn(d, (d.placements?.[active]?.[face] || []).filter((p) => p.sid !== selected)));
    setSelected(null);
  };
  const bringForward = (pl) => {
    mutate((d) => {
      const list = (d.placements?.[active]?.[face] || []).slice();
      const z = list.reduce((m, p) => Math.max(m, p.z || 0), 0) + 1;
      return setFaceListIn(d, list.map((p) => (p.sid === pl.sid ? { ...p, z } : p)));
    });
    const st = bySid[pl.sid];
    if (st?.label?.story) showToast(st.label.story, "success");
  };

  // ── Gestures: swipe to rotate (normal), drag/pinch on selection (edit) ────
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (edit && selected && pts.length <= 2) {
      const pl = faceList.find((p) => p.sid === selected);
      if (!pl) return;
      if (pts.length === 1) gesture.current = { kind: "drag", start: pts[0], pl: { ...pl } };
      else {
        const [a, b] = pts;
        gesture.current = {
          kind: "pinch", pl: { ...pl },
          d0: Math.hypot(a.x - b.x, a.y - b.y),
          a0: Math.atan2(b.y - a.y, b.x - a.x),
        };
      }
    } else if (pts.length === 1) {
      gesture.current = { kind: "swipe", start: pts[0] };
    }
  };
  const applyPl = (upd) => {
    setState((prev) => {
      if (!prev) return prev;
      const d = structuredClone(prev);
      const list = (d.placements?.[active]?.[face] || []).map((p) => (p.sid === selected ? { ...p, ...upd(p) } : p));
      setFaceListIn(d, list);
      return d;
    });
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (g.kind === "drag") {
      const pt = pointers.current.get(e.pointerId);
      const x = Math.min(BOUNDS.xMax, Math.max(BOUNDS.xMin, g.pl.x + (pt.x - g.start.x) / rect.width));
      const y = Math.min(BOUNDS.yMax, Math.max(BOUNDS.yMin, g.pl.y + (pt.y - g.start.y) / rect.height));
      applyPl(() => ({ x, y }));
    } else if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      const a1 = Math.atan2(b.y - a.y, b.x - a.x);
      const scale = Math.min(3, Math.max(0.35, g.pl.scale * (d1 / (g.d0 || 1))));
      const rot = Math.max(-180, Math.min(180, g.pl.rot + ((a1 - g.a0) * 180) / Math.PI));
      applyPl(() => ({ scale, rot }));
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g && (g.kind === "drag" || g.kind === "pinch") && pointers.current.size === 0) {
      gesture.current = null;
      // Commit the gesture as one save.
      setState((prev) => { if (prev) scheduleSave(prev); return prev; });
      return;
    }
    if (g && g.kind === "swipe" && pointers.current.size === 0) {
      gesture.current = null;
      const dx = e.clientX - g.start.x, dy = e.clientY - g.start.y;
      if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        setSelected(null);
        setTurn(dx < 0 ? 1 : -1);
        setTimeout(() => setTurn(0), 330);
        setFaceIdx((i) => {
          const cur = i === -1 ? 0 : i;
          return (cur + (dx < 0 ? 1 : SWIPE_ORDER.length - 1)) % SWIPE_ORDER.length;
        });
      }
    }
    if (pointers.current.size === 0) gesture.current = null;
  };

  const faceW = Math.min(typeof window !== "undefined" ? 0.92 * window.innerWidth : 360, 430);
  const faceH = faceW * (ASPECT[face] || 0.62);
  const skinKey = `${active}/${face}`;
  const showSkin = skinOk[skinKey] !== false;

  if (!state) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: IVORY }}>
        <span style={{ fontFamily: MONO, fontSize: fs(11), color: INK3, letterSpacing: ".14em" }}>OPENING THE LUGGAGE…</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto" style={{ background: IVORY }} role="dialog" aria-modal="true" aria-label="My Virtual Luggage">
      <div className="max-w-md mx-auto px-4 pt-4 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".2em", color: "#8A5410" }}>Virtual Luggage</div>
            <h2 style={{ fontFamily: SERIF, fontSize: fs(24), color: INK, lineHeight: 1.05, margin: 0 }}>
              {(LUGGAGE_TYPES.find((t) => t.key === active) || LUGGAGE_TYPES[0]).name}
            </h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEdit((v) => !v); setSelected(null); }} aria-pressed={edit}
              aria-label={edit ? "Done arranging" : "Arrange stickers"}
              className="rounded-full p-2.5" style={{ background: edit ? "#0E7C86" : "#fff", border: `1px solid ${RULE}` }}>
              {edit ? <Check size={17} color="#fff" /> : <PencilLine size={17} color={INK} />}
            </button>
            <button type="button" onClick={close} aria-label="Close the luggage" className="rounded-full p-2.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
              <X size={17} color={INK} />
            </button>
          </div>
        </div>

        {/* The stage — luggage background + sticker layer, pseudo-3D turn */}
        <div className="mx-auto mt-4" style={{ width: faceW, perspective: 1200 }}>
          <div
            ref={stageRef}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            onClick={() => setSelected(null)}
            style={{
              position: "relative", width: faceW, height: faceH, touchAction: "pan-y",
              transformStyle: "preserve-3d",
              transform: turn ? `rotateY(${turn * -12}deg) scaleX(0.94)` : "rotateY(0deg) scaleX(1)",
              transition: "transform 320ms cubic-bezier(.22,.61,.36,1)",
            }}
          >
            <div style={{ position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden", boxShadow: "0 22px 40px -20px rgba(22,17,13,.5)" }}>
              {showSkin ? (
                <img
                  src={`${ART_BASE}/${active}/${face}.webp`} alt={`${active} luggage, ${face} face`}
                  onError={() => setSkinOk((m) => ({ ...m, [skinKey]: false }))}
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                />
              ) : (
                <FallbackFace type={active} face={face} />
              )}
            </div>
            {/* the sticker layer */}
            {faceList.map((pl) => (
              <PlacedSticker key={pl.sid} pl={pl} sticker={bySid[pl.sid]} faceW={faceW}
                edit={edit} selected={selected === pl.sid}
                onSelect={(sid) => setSelected(sid)} onTap={bringForward} />
            ))}
          </div>
        </div>

        {/* Face word + dots — subtle, like the boards */}
        <div className="text-center mt-3" aria-live="polite">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".3em", color: INK3 }}>{face}</div>
          <div className="flex justify-center gap-2 mt-1.5" aria-hidden="true">
            {FACES.map((f) => (
              <span key={f} className="rounded-full" style={{ width: 6, height: 6, background: f === face ? "#8A5410" : "rgba(22,17,13,.18)" }} />
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-2.5">
            <button type="button" onClick={() => { setSelected(null); setFaceIdx((i) => (i === -1 ? 0 : -1)); }}
              className="rounded-full px-3 py-1" aria-pressed={faceIdx === -1}
              style={{ background: faceIdx === -1 ? "#F3E2C7" : "#fff", border: `1px solid ${RULE}`, fontFamily: MONO, fontSize: fs(9), letterSpacing: ".14em", color: "#8A5410" }}>
              TOP / LID
            </button>
            {edit && selected && (
              <button type="button" onClick={peelSelected}
                className="rounded-full px-3 py-1 inline-flex items-center gap-1.5"
                style={{ background: "#fff", border: "1px solid rgba(176,71,47,.4)", fontFamily: MONO, fontSize: fs(9), letterSpacing: ".1em", color: "#B0472F" }}>
                <Trash2 size={11} /> PEEL OFF
              </button>
            )}
          </div>
          <p style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".05em", color: INK3, marginTop: 8 }}>
            {edit ? "Drag to place · two fingers to resize & rotate · tap ✓ when done" : "Swipe to walk around the trunk · tap ✎ to arrange your stickers"}
          </p>
        </div>

        {/* The sticker tray — everything earned, waiting for a home */}
        <div className="mt-5">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".2em", color: "#8A5410" }}>
            Sticker tray{tray.length ? ` · ${tray.length}` : ""}
          </div>
          {tray.length === 0 ? (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(13.5), color: INK3, marginTop: 4 }}>
              {stickers.length ? "Every sticker is on the trunk." : "Stamp places in your passport — each destination earns a sticker."}
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pt-2 pb-1" style={{ scrollbarWidth: "none" }}>
              {tray.map((s) => (
                <button key={s.sid} type="button" onClick={() => placeFromTray(s.sid)}
                  aria-label={`Place the ${s.label.top || s.label.big} sticker on the ${face} face`}
                  className="flex-none active:scale-95 transition-transform" style={{ width: s.w }}>
                  <LuggageLabel label={s.label} uid={`tray-${s.sid.replace(/[^a-z0-9]/gi, "")}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The collection — six trunks; the Classic is where everyone starts */}
        <div className="mt-5">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".2em", color: "#8A5410" }}>The collection</div>
          <div className="flex gap-2.5 overflow-x-auto pt-2 pb-1" style={{ scrollbarWidth: "none" }}>
            {LUGGAGE_TYPES.map((t) => (
              <button key={t.key} type="button" onClick={() => { setSelected(null); mutate((d) => { d.active = t.key; return d; }); }}
                aria-pressed={t.key === active} aria-label={`Switch to ${t.name}`}
                className="flex-none rounded-xl px-2.5 py-2 active:scale-95 transition-transform"
                style={{ background: "#fff", border: t.key === active ? "2px solid #8A5410" : `1px solid ${RULE}`, minWidth: 86 }}>
                <span className="block rounded-md mx-auto" style={{ width: 52, height: 34, background: t.body, border: `2px solid ${t.edge}`, position: "relative" }}>
                  <span className="absolute inset-y-0" style={{ left: 14, width: 7, background: t.strap }} />
                  <span className="absolute inset-y-0" style={{ right: 14, width: 7, background: t.strap }} />
                </span>
                <span className="block mt-1.5" style={{ fontFamily: MONO, fontSize: fs(8), letterSpacing: ".08em", color: t.key === active ? "#8A5410" : INK3 }}>
                  {t.name.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".05em", color: INK3, marginTop: 6 }}>
            Each trunk keeps its own stickers — your collection grows, nothing is ever lost.
          </p>
        </div>
      </div>
    </div>
  );
}
