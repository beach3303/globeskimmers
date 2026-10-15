// The Blotter (founder concept 2026-09-30, mockup v3) — reactions live AROUND
// a shared passport page, never inside the booklet. Six reaction STICKERS, the
// founder's own word art (2026-10-14; never platform emoji): WOW! · COOL! ·
// TAKE ME! · BEEN THERE! · I WANNA GO! · MORE PICS PLEASE! — plus contextual YUMMY! that
// appears only when a photo on the page has food as its MAIN subject
// (vision-tagged at the public flip). Comments are the Guestbook: signatures
// and finger DOODLES (small in the margin, tap to enlarge); comment-likes are
// CO-SIGNS — you put your name under someone's words, tap again to lift your
// pen, and who-signed is always visible. The owner can sweep anything.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Undo2, Eraser, PencilLine } from "lucide-react";
import { showToast } from "@/components/Toast";
import { blotterMark, blotterSign, blotterCosign, blotterSweep } from "@/lib/passport";
import { useDismissable } from "@/lib/dismissStack";
import { useAuth } from "@/lib/AuthContext";
import TravelerSheet from "@/components/social/TravelerSheet";
import wowArt from "@/assets/blotter/wow.png";
import coolArt from "@/assets/blotter/cool.png";
import takemeArt from "@/assets/blotter/takeme.png";
import beenArt from "@/assets/blotter/been.png";
import wannagoArt from "@/assets/blotter/wannago.png";
import morepicsArt from "@/assets/blotter/morepics.png";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const PAPER = "#FBF6EC", CARD = "#FFFDF6";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// ── YUMMY still wears the drawn ink (no sticker for it yet) ─────────────────
function YummyIcon({ c }) {
  return (
    <svg viewBox="0 0 40 34" width="22" height="19" aria-hidden="true">
      <path d="M13,12 q2,-5 0,-8 M20,12 q2,-5 0,-8 M27,12 q2,-5 0,-8" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M7,17 a13,8 0 0 0 26,0 z" fill="none" stroke={c} strokeWidth="2.2" />
      <path d="M12,28 h16" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const KINDS = [
  { k: "wow", label: "WOW!", color: "#9A6F1E", art: wowArt },
  { k: "cool", label: "COOL!", color: "#2C6E9B", art: coolArt },
  { k: "takeme", label: "TAKE ME!", color: "#2B4A7E", art: takemeArt },
  { k: "been", label: "BEEN THERE!", color: "#2E6B4E", art: beenArt },
  { k: "wannago", label: "I WANNA GO!", color: "#B04A6E", art: wannagoArt },
  { k: "morepics", label: "MORE PICS PLEASE!", color: "#6D3A6E", art: morepicsArt },
];
const YUMMY = { k: "yummy", label: "YUMMY!", color: "#B0472F", Icon: YummyIcon };

const fmtDay = (iso) => {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return ""; }
};

// The stamp on the page's tray: which stamp gets a food-star YUMMY?
function yummyTarget(stamps) {
  const st = (stamps || []).find((s) => (s.photos || []).some((p) => p.food_subject === 1 && p.mod_status !== "blocked"));
  return st ? `st:${st.id}` : null;
}

// ── The strip under a page: press stamps + open the Guestbook ───────────────
// `photoId` points the strip at one photo (its reactions and comments)
// instead of a page's stamps; `food` says that photo's food is the star.
// `postcardId` points it at a postcard on a city board (City Boards, 2026-10-14):
// no slug, as the worker finds the card's sender itself; `food` = it names a dish.
export function BlotterStrip({ slug, stamps, blotter, ownerView, onChanged, photoId = null, postcardId = null, food = false }) {
  const [busy, setBusy] = useState(null);       // kind being pressed/peeled
  const [sheet, setSheet] = useState(false);
  const one = postcardId ? `pc:${postcardId}` : photoId ? `ph:${photoId}` : null;
  const targets = useMemo(() => (one ? [one] : (stamps || []).map((s) => `st:${s.id}`)), [stamps, one]);
  const lead = targets[0] || null;
  const yumTarget = useMemo(() => (one ? (food ? one : null) : yummyTarget(stamps)), [stamps, one, food]);
  const item = postcardId ? "postcard" : photoId ? "photo" : null;

  const agg = useMemo(() => {
    const counts = {}, mine = new Set();
    for (const t of targets) {
      const row = blotter?.targets?.[t];
      if (!row) continue;
      for (const [k, n] of Object.entries(row.marks || {})) counts[k] = (counts[k] || 0) + n;
      for (const k of row.mine || []) mine.add(k);
    }
    return { counts, mine };
  }, [blotter, targets]);

  const pageEntries = useMemo(
    () => (blotter?.entries || []).filter((e) => targets.includes(e.target)),
    [blotter, targets],
  );

  if ((!slug && !postcardId) || !lead) return null;
  const hasAny = Object.keys(agg.counts).length > 0 || pageEntries.length > 0;
  // The owner's own booklet stays quiet until someone reacts.
  if (ownerView && !hasAny) return null;

  const press = async (kind) => {
    if (busy) return;
    const target = kind === "yummy" ? yumTarget : lead;
    if (!target) return;
    const op = agg.mine.has(kind) ? "peel" : "press";
    setBusy(kind);
    const { error } = await blotterMark(slug, target, kind, op);
    setBusy(null);
    if (error) showToast(error, "error");
    else {
      if (op === "press" && kind === "wannago") showToast("Added to your On the Horizon ✈", "success");
      onChanged?.();
    }
  };

  const tray = yumTarget ? [...KINDS, YUMMY] : KINDS;
  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap justify-center rounded-2xl px-2.5 py-2"
        style={{ background: PAPER, border: `1px solid ${RULE}` }}>
        {tray.map(({ k, label, color, art, Icon }) => {
          const on = agg.mine.has(k);
          const n = agg.counts[k] || 0;
          return (
            <button key={k} type="button" onClick={() => press(k)} disabled={busy === k}
              aria-pressed={on} aria-label={`${label} — ${n}`}
              className="flex flex-col items-center rounded-xl px-1 py-1 active:scale-95 transition-transform"
              style={{ background: on ? "#EBF3EE" : "transparent", border: on ? `1.5px solid ${color}` : "1.5px solid transparent", minWidth: 44, opacity: busy && busy !== k ? 0.6 : 1 }}>
              {art
                ? <img src={art} alt="" draggable={false} style={{ width: 46, height: 46, objectFit: "contain" }} />
                : <Icon c={color} />}
              <span style={{ fontFamily: MONO, fontSize: fs(8), fontWeight: 700, letterSpacing: ".04em", color: on ? color : INK3, minHeight: 11 }}>
                {art ? (n > 0 ? n : "") : `${label}${n > 0 ? ` ${n}` : ""}`}
              </span>
            </button>
          );
        })}
        <button type="button" onClick={() => setSheet(true)}
          className="ml-auto rounded-xl px-2.5 py-1.5 active:scale-95 transition-transform"
          style={{ background: CARD, border: `1px solid ${RULE}`, fontFamily: MONO, fontSize: fs(9.5), fontWeight: 700, letterSpacing: ".06em", color: "#8A5410" }}>
          {item ? "💬 COMMENTS" : "✍ GUESTBOOK"}{pageEntries.length ? ` · ${pageEntries.length}` : ""}
        </button>
      </div>
      {sheet && (
        <GuestbookSheet slug={slug} targets={targets} lead={lead} entries={pageEntries}
          ownerView={ownerView} onChanged={onChanged} onClose={() => setSheet(false)} item={item} />
      )}
    </>
  );
}

// ── The Guestbook sheet: signatures, doodles, co-signs ──────────────────────
function GuestbookSheet({ slug, targets, lead, entries, ownerView, onChanged, onClose, item = null }) {
  // item: 'photo' or 'postcard' for one thing's comments, null for a page's guestbook.
  const forPhoto = !!item;
  useDismissable(true, onClose);
  // Rewriting an old signature republishes it under your name, so a held
  // teen or an unconfirmed birthday gets no edit (the worker refuses it
  // too); peeling your own stays open.
  const { socialTier } = useAuth();
  const canEdit = socialTier !== "teen" && socialTier !== "confirm" && socialTier !== "blocked";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pad, setPad] = useState(false);
  const [bigDoodle, setBigDoodle] = useState(null); // enlarged doodle URL
  const [editing, setEditing] = useState(null);     // { id, text }
  const [whoOpen, setWhoOpen] = useState(null);     // entry id with signers shown
  // Report (and Block, where the worker allows it) for someone else's entry —
  // go-live decision 6; until now a visitor couldn't report a signature.
  const [aboutEntry, setAboutEntry] = useState(null);

  const sign = async (doodle) => {
    const body = { slug, target: lead, text: text.trim() || undefined, doodle };
    if (!body.text && !doodle) { showToast("Write or draw something first", "error"); return; }
    setBusy(true);
    const { error } = await blotterSign(body);
    setBusy(false);
    if (error) showToast(error, "error");
    else { setText(""); setPad(false); onChanged?.(); }
  };
  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    const { error } = await blotterSign({ op: "edit", entry_id: editing.id, text: editing.text });
    setBusy(false);
    if (error) showToast(error, "error");
    else { setEditing(null); onChanged?.(); }
  };
  const peel = async (id) => {
    const { error } = await blotterSign({ op: "peel", entry_id: id });
    if (error) showToast(error, "error"); else onChanged?.();
  };
  const sweep = async (id) => {
    const { error } = await blotterSweep({ op: "entry", entry_id: id });
    if (error) showToast(error, "error"); else onChanged?.();
  };
  const cosign = async (e) => {
    const { error } = await blotterCosign(e.id, e.cosigned ? "lift" : "sign");
    if (error) showToast(error, "error"); else onChanged?.();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={forPhoto ? "Comments" : "Guestbook"}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" style={{ background: "rgba(22,17,13,.45)" }} />
      <div className="relative w-full max-w-md rounded-t-3xl px-4 pt-4 pb-6 max-h-[82vh] overflow-y-auto" style={{ background: PAPER }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".2em", color: "#8A5410" }}>{forPhoto ? "Comments" : "The Guestbook"}</div>
            <div style={{ fontFamily: SERIF, fontSize: fs(20), color: INK }}>{item ? `On this ${item}` : "Sign this page"}</div>
          </div>
          <button onClick={onClose} aria-label="Close the guestbook" className="rounded-full p-2" style={{ background: CARD, border: `1px solid ${RULE}` }}>
            <X size={16} color={INK} />
          </button>
        </div>

        <div className="mt-3">
          {entries.length === 0 && (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(14.5), color: INK3 }}>
              {forPhoto ? "No comments yet. Be the first to leave a line or a little drawing." : "No signatures yet. Be the first to leave a line or a little drawing."}
            </p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="py-2.5" style={{ borderTop: `1px dashed ${RULE}` }}>
              {e.doodle ? (
                <div className="flex items-start gap-2.5">
                  <button type="button" onClick={() => setBigDoodle(e.doodle)} aria-label="Enlarge this doodle"
                    className="flex-none active:scale-95 transition-transform"
                    style={{ width: 96, height: 72, borderRadius: 8, overflow: "hidden", border: "1.5px solid #D9CCA9", background: CARD, boxShadow: "0 2px 6px rgba(0,0,0,.12)" }}>
                    <img src={e.doodle} alt={`A doodle by ${e.handle ? "@" + e.handle : e.name || "a traveler"}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </button>
                  {e.body && <p className="min-w-0 flex-1" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), color: INK, margin: 0 }}>{e.body}</p>}
                </div>
              ) : editing?.id === e.id ? (
                <div>
                  <textarea value={editing.text} onChange={(ev) => setEditing({ ...editing, text: ev.target.value })} maxLength={280} rows={2}
                    className="w-full rounded-xl px-3 py-2" style={{ background: CARD, border: `1px solid ${RULE}`, fontFamily: SERIF, fontSize: fs(15), color: INK }} />
                  <div className="flex gap-3 mt-1">
                    <button onClick={saveEdit} disabled={busy} style={{ fontFamily: MONO, fontSize: fs(10), fontWeight: 700, color: "#2E6B4E" }}>save</button>
                    <button onClick={() => setEditing(null)} style={{ fontFamily: MONO, fontSize: fs(10), color: INK3 }}>cancel</button>
                  </div>
                </div>
              ) : (
                <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(16), color: INK, margin: 0 }}>{e.body}</p>
              )}
              <div className="flex items-center gap-2.5 flex-wrap mt-1.5" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".05em", color: INK3 }}>
                <span style={{ color: "#0E7C86", fontWeight: 700 }}>{e.handle ? `@${e.handle}` : e.name || "a traveler"}</span>
                <span>{fmtDay(e.created_at)}{e.edited ? " · edited" : ""}</span>
                <button type="button" onClick={() => cosign(e)} aria-pressed={e.cosigned}
                  aria-label={e.cosigned ? "Lift your pen" : "Co-sign — put your name under this"}
                  className="rounded-full px-2 py-0.5 active:scale-95 transition-transform"
                  style={{ background: e.cosigned ? "#EBF3EE" : CARD, border: `1px solid ${e.cosigned ? "#2E6B4E" : RULE}`, color: "#2E6B4E", fontWeight: 700 }}>
                  ✍ {e.cosigns || ""}
                </button>
                {e.cosigns > 0 && (
                  <button type="button" onClick={() => setWhoOpen(whoOpen === e.id ? null : e.id)} style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
                    who?
                  </button>
                )}
                <span className="ml-auto flex gap-2.5">
                  {e.mine && !e.doodle && canEdit && <button onClick={() => setEditing({ id: e.id, text: e.body || "" })} style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>edit</button>}
                  {e.mine && <button onClick={() => peel(e.id)} style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>peel</button>}
                  {ownerView && !e.mine && <button onClick={() => sweep(e.id)} style={{ textDecoration: "underline", textUnderlineOffset: 2, color: "#B0472F" }}>sweep</button>}
                  {!e.mine && (
                    <button type="button" onClick={() => setAboutEntry(e)} aria-haspopup="dialog" aria-label={`Report ${e.handle ? "@" + e.handle : e.name || "this traveler"}'s ${forPhoto ? "comment" : "signature"}`}
                      style={{ textDecoration: "underline", textUnderlineOffset: 2, padding: "16px 6px", margin: "-16px -6px" }}>report</button>
                  )}
                </span>
              </div>
              {whoOpen === e.id && (
                <div className="mt-1" style={{ fontFamily: MONO, fontSize: fs(9), color: INK3 }}>
                  Signed by {e.signers.map((h) => (h.startsWith("@") ? h : `@${h}`)).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Compose: a line, or a doodle in the margin */}
        <div className="flex items-center gap-2 mt-3">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder={forPhoto ? "Write a comment…" : "Sign the guestbook…"}
            className="flex-1 min-w-0 rounded-xl px-3 py-2.5"
            style={{ background: CARD, border: `1px solid ${RULE}`, fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), color: INK }} />
          <button type="button" onClick={() => setPad(true)} aria-label="Draw a doodle instead"
            className="flex-none rounded-xl px-2.5 py-2 active:scale-95 transition-transform inline-flex items-center gap-1" style={{ background: CARD, border: `1px solid ${RULE}`, color: "#0E7C86", fontSize: fs(12), fontWeight: 600 }}>
            <PencilLine size={16} color="#0E7C86" /> Draw
          </button>
          <button type="button" onClick={() => sign(undefined)} disabled={busy}
            className="flex-none rounded-xl px-3.5 py-2.5 font-semibold active:scale-95 transition-transform"
            style={{ background: "#0E7C86", color: "#fff", fontSize: fs(13), opacity: busy ? 0.6 : 1 }}>
            {forPhoto ? "Post ✍" : "Sign ✍"}
          </button>
        </div>
        <p className="mt-2" style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".06em", color: INK3 }}>
          {item === "postcard" ? "Comments carry your @handle. The postcard’s sender can sweep any comment." : "Signatures carry your @handle. The page’s owner can sweep any entry."}
        </p>
      </div>

      {pad && <DoodlePad onClose={() => setPad(false)} onPost={(dataUrl) => sign(dataUrl)} busy={busy} />}
      {aboutEntry && (
        <TravelerSheet person={{ user_id: aboutEntry.user_id || null, handle: aboutEntry.handle, name: aboutEntry.name, entry_id: aboutEntry.id }}
          report={{ kind: "signature", slug, ref: `bl:${aboutEntry.id}`, note: `${item === "postcard" ? "Board postcard comment" : forPhoto ? "Photo comment" : "Guestbook signature"}${aboutEntry.doodle ? " (a doodle)" : ""}${aboutEntry.body ? `: "${String(aboutEntry.body).slice(0, 300)}"` : ""}` }}
          onClose={() => setAboutEntry(null)} onChanged={() => { setAboutEntry(null); onChanged?.(); }} />
      )}

      {/* Tap a doodle → it grows to full width; tap again → back to the margin. */}
      {bigDoodle && (
        <button type="button" onClick={() => setBigDoodle(null)} aria-label="Shrink the doodle back"
          className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ background: "rgba(22,17,13,.6)" }}>
          <img src={bigDoodle} alt="An enlarged doodle" className="w-full max-w-sm rounded-2xl"
            style={{ background: CARD, border: "1.5px solid #D9CCA9", boxShadow: "0 18px 36px -18px rgba(0,0,0,.6)" }} />
        </button>
      )}
    </div>
  );
}

// ── The doodle pad: four house inks, one undo — constraints make charm ──────
// Rendered on document.body: inside a card whose overlay has a backdrop blur, a
// fixed sheet pins to that card's top instead of the screen (founder, 2026-10-05:
// "the doodle box goes all the way to the top of the page"). It opens over
// wherever the traveler is, near the bottom on a phone.
const INKS = ["#2B4A7E", "#B0472F", "#2E6B4E", "#9A6F1E"];
// A starter line in handwriting, small in the top-left corner (founder,
// 2026-10-05: the guestbook pad opens with "I was here!" so it reads as a
// guestbook and leaves the page for a flower, a name, an "I love this"). It is
// part of the drawing and posts with it; undo and the eraser leave it alone,
// and its little × takes it off the page.
const HAND = '"Caveat", "Bradley Hand", "Noteworthy", cursive';
export function DoodlePad({ onClose, onPost, busy, title = "Draw in the margin", eyebrow = null, note = null, starter = null }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const strokes = useRef([]);       // [{ color, pts: [{x,y},…] }]
  const drawing = useRef(false);
  const [ink, setInk] = useState(INKS[0]);
  const inkRef = useRef(INKS[0]);
  const [nStrokes, setNStrokes] = useState(0);
  const [showStarter, setShowStarter] = useState(!!starter);
  const starterOn = useRef(!!starter);
  const [starterW, setStarterW] = useState(0);   // drawn width, to place its ×
  useEffect(() => { inkRef.current = ink; }, [ink]);

  const redraw = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = CARD;
    ctx.fillRect(0, 0, cv.width / dpr, cv.height / dpr);
    if (starter && starterOn.current) {
      ctx.save();
      ctx.translate(14, 31);
      ctx.rotate(-0.07);
      ctx.fillStyle = INKS[0];
      ctx.font = `600 23px ${HAND}`;
      ctx.fillText(starter, 0, 0);
      const w = ctx.measureText(starter).width;
      setStarterW((prev) => (Math.abs(prev - w) > 1 ? w : prev));
      ctx.strokeStyle = INKS[0]; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(2, 7); ctx.quadraticCurveTo(w * 0.5, 11, w + 2, 5); ctx.stroke();
      ctx.restore();
    }
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 3.5;
    for (const s of strokes.current) {
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0].x + 0.5, s.pts[0].y + 0.5); // a dot
      ctx.stroke();
    }
  };

  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = Math.round(w * 0.75);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    redraw();
    // The handwriting font may still be loading; draw again once it's in.
    if (starter && document.fonts?.load) document.fonts.load(`600 23px ${HAND}`).then(() => redraw()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (ev) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const down = (ev) => {
    ev.preventDefault();
    drawing.current = true;
    strokes.current.push({ color: inkRef.current, pts: [pos(ev)] });
    setNStrokes(strokes.current.length);
    redraw();
  };
  const move = (ev) => {
    if (!drawing.current) return;
    ev.preventDefault();
    strokes.current[strokes.current.length - 1].pts.push(pos(ev));
    redraw();
  };
  const up = () => { drawing.current = false; };
  const undo = () => { strokes.current.pop(); setNStrokes(strokes.current.length); redraw(); };
  const clear = () => { strokes.current = []; setNStrokes(0); redraw(); };
  const post = () => {
    if (!strokes.current.length) { showToast("Draw something first", "error"); return; }
    try { onPost(canvasRef.current.toDataURL("image/png")); }
    catch { showToast("Couldn't save the doodle", "error"); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label={title}
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
      <button aria-label="Cancel" onClick={onClose} className="absolute inset-0" style={{ background: "rgba(22,17,13,.55)" }} />
      <div ref={wrapRef} className="relative w-full max-w-sm rounded-2xl p-3" style={{ background: PAPER }}>
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0">
            {eyebrow && <div className="truncate" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", textTransform: "uppercase", color: INK3 }}>{eyebrow}</div>}
            <div style={{ fontFamily: SERIF, fontSize: fs(19), color: INK, lineHeight: 1.15 }}>{title}</div>
          </div>
          <button onClick={onClose} aria-label="Cancel the doodle" className="flex-none rounded-full p-1.5" style={{ background: CARD, border: `1px solid ${RULE}` }}>
            <X size={15} color={INK} />
          </button>
        </div>
        {note && <p className="mb-2.5" style={{ color: INK3, fontSize: fs(13), lineHeight: 1.4 }}>{note}</p>}
        <div className="relative">
          <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
            className="w-full rounded-xl" style={{ border: "1.5px solid #D9CCA9", background: CARD, touchAction: "none", display: "block" }} />
          {showStarter && starterW > 0 && (
            <button type="button" aria-label={`Remove “${starter}”`}
              onClick={() => { starterOn.current = false; setShowStarter(false); redraw(); }}
              className="absolute flex items-center justify-center rounded-full"
              style={{ left: 14 + starterW + 9, top: Math.max(2, 10 - starterW * 0.07), width: 22, height: 22, background: CARD, border: `1px solid ${RULE}` }}>
              <X size={11} color={INK3} strokeWidth={2.4} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          {INKS.map((c) => (
            <button key={c} type="button" onClick={() => setInk(c)} aria-label={`Ink ${c}`} aria-pressed={ink === c}
              className="rounded-full" style={{ width: 24, height: 24, background: c, border: ink === c ? "2.5px solid #16110D" : "2.5px solid transparent" }} />
          ))}
          <button type="button" onClick={undo} disabled={!nStrokes} aria-label="Undo the last line" className="ml-auto rounded-xl p-2" style={{ background: CARD, border: `1px solid ${RULE}`, opacity: nStrokes ? 1 : 0.4 }}>
            <Undo2 size={15} color={INK} />
          </button>
          <button type="button" onClick={clear} disabled={!nStrokes} aria-label="Clear the doodle" className="rounded-xl p-2" style={{ background: CARD, border: `1px solid ${RULE}`, opacity: nStrokes ? 1 : 0.4 }}>
            <Eraser size={15} color={INK} />
          </button>
          <button type="button" onClick={post} disabled={busy} className="rounded-xl px-3.5 py-2 font-semibold" style={{ background: "#0E7C86", color: "#fff", fontSize: fs(13), opacity: busy ? 0.6 : 1 }}>
            Post it
          </button>
        </div>
        <p className="mt-2" style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".05em", color: INK3 }}>
          Finger-drawn, posts small in the margin — anyone can tap it to enlarge.
        </p>
      </div>
    </div>,
    document.body,
  );
}

export default BlotterStrip;
