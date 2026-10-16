// Guestbook — kind notes for the next traveler on any place (generic by entity).
// Read by anyone; signing requires sign-in. Guided prompts (a tip, your favorite
// part, a shout-out, a memory), edit/delete your own, report others (Apple 1.2),
// and Block a note's author once the worker advertises block_v2: their notes
// (and yours, to them) stop showing here (go-live review, 2026-10-13).
// Warm notes, NOT reviews: the worker posts kind notes right away and holds any
// note that reads as negative for an admin to read first (only its author sees
// it meanwhile, marked as waiting).
//
// The new look (plan F6): lucide line icons and no emoji in the prompts, the
// entry lines and the toasts; people's own words are untouched. Its buttons are
// outlines, never a solid (a card's one solid is its Directions). world, optional
// (a WORLD row or key), prints the lines, icons and ink in that world; without it
// the guestbook stays neutral (the shared inks). A list that fails to load says so
// and offers a retry: it never reads as an empty guestbook. Signing waits for the
// age read when AuthContext reports it (socialTierReady false), so a teen never
// glimpses the sign button.
import { useEffect, useState, useCallback, useId } from "react";
import { Binoculars, Brush, EyeOff, HandHeart, Heart, Hourglass, Lightbulb, Lock, MapPin, PenLine, Trees, UtensilsCrossed, X } from "lucide-react";
import DoodleThumb, { DoodlesAllToggle } from "@/components/DoodleThumb";
import { callWorker } from "@/lib/callWorker";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { DoodlePad } from "@/components/passport/Blotter";
import OwnerNoteSheet from "@/components/OwnerNoteSheet";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { ChipRow, WorldChip, worldRow } from "@/components/finder/FinderControls";
import TravelerSheet from "@/components/social/TravelerSheet";
import { socialFollow } from "@/lib/passport";
import { blockReady } from "@/lib/blocks";

/** @typedef {import('react').CSSProperties} CSS */

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';

const PROMPTS = [
  { key: "tip", label: "Tip for visitors", icon: Lightbulb, hint: "One thing you wish you'd known before you came…" },
  { key: "favorite", label: "Favorite part", icon: Heart, hint: "What did you love most about it?" },
  { key: "musttry", label: "Don't miss", icon: Binoculars, hint: "The one thing every visitor should see or do…" },
  { key: "shoutout", label: "Shout-out", icon: HandHeart, hint: "Thank someone who made your visit special…" },
  { key: "story", label: "My memory", icon: PenLine, hint: "A moment from your visit you'll remember…" },
];
// A board's guestbook asks for what helps the next visitor most (founder, 2026-10-16: "leave
// tips, recommendations, your fave part … best spots, best nature, best food").
export const BOARD_PROMPTS = [
  { key: "tip", label: "Tip", icon: Lightbulb, hint: "One thing you wish you'd known before you came…" },
  { key: "spot", label: "Best spot", icon: MapPin, hint: "The place you'd send a friend first…" },
  { key: "food", label: "Best food", icon: UtensilsCrossed, hint: "The dish you'd come back for — and where to find it…" },
  { key: "nature", label: "Best nature", icon: Trees, hint: "A park, a trail, a view worth the walk…" },
  { key: "favorite", label: "Favorite part", icon: Heart, hint: "What did you love most here?" },
];
const PROMPT_LABEL = { ...Object.fromEntries([...PROMPTS, ...BOARD_PROMPTS].map((p) => [p.key, p.label])), favorite: "Favorite part", doodle: "Doodle" };

const HELD_TOAST = "Thank you! Our team takes a quick look before it posts";
// The worker's age gate answers 428 { error: "age_required", message }.
const errText = (data, error) => (data?.error === "age_required" ? (data.message || "Add your birth year in Settings to sign guestbooks.") : error);

function timeAgo(iso) {
  try {
    const d = new Date(iso), now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch { return ""; }
}

// Downscale to a max edge + re-encode JPEG so uploads stay small (keeps R2 + moderation cheap).
function resizePhoto(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality), w: width, h: height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

// ── Looks ────────────────────────────────────────────────────────────────
// A white box with the world line: the composer, the list, the empty and error states.
/** @param {any} w @returns {CSS} */
const box = (w) => ({ boxSizing: "border-box", background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 16 });
// The one strong action: an outline in the world ink (FinderEmptyState's action).
/** @param {any} w @returns {CSS} */
const outline = (w) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, boxSizing: "border-box",
  padding: "0 16px", borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${w.ink}`, color: w.ink,
  fontFamily: "inherit", fontSize: fs(14), lineHeight: 1.2, fontWeight: 600, textAlign: "center", cursor: "pointer",
});
// A quieter button: white with the world line and an ink-2 label.
/** @param {any} w @returns {CSS} */
const quiet = (w) => ({ ...outline(w), border: `1px solid ${w.line}`, color: NEUTRAL.ink2 });
// A text button with a 44px target (Cancel, Edit, Delete, Report).
/** @type {CSS} */
const textButton = {
  display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44, padding: 0, background: "transparent", border: 0,
  fontFamily: "inherit", fontSize: fs(12.5), lineHeight: 1.2, fontWeight: 600, color: NEUTRAL.ink3, textAlign: "left", cursor: "pointer",
};
// A button's label led by a 16px line icon that travels with its first word, so a label that
// wraps at a large text size stays one block led by the icon.
function Labelled({ icon: Icon, color, children }) {
  const text = String(children);
  const cut = text.indexOf(" ");
  return (
    <span style={{ minWidth: 0 }}>
      <span style={{ whiteSpace: "nowrap" }}>
        <Icon size={16} strokeWidth={2} color={color} aria-hidden="true" focusable="false" style={{ display: "inline", verticalAlign: "-3px", marginRight: 8 }} />
        {cut > 0 ? text.slice(0, cut) : text}
      </span>
      {cut > 0 ? text.slice(cut) : null}
    </span>
  );
}

/**
 * @param {{
 *   entityType?: string, entityId: any, entityName?: string, onCount?: (n: number) => void,
 *   startComposing?: boolean, world?: any, prompts?: any[], intro?: string, signExtra?: any,
 *   canSign?: boolean, cantSignNote?: string,
 * }} props
 *
 * A board's guestbook (2026-10-16) passes its own prompts and intro, the board itself in
 * signExtra (the worker checks the board and that the signer was really there), canSign
 * from the board read (else cantSignNote shows instead of the pen), and drops the
 * owner's private note — a board has no owner.
 */
export default function Guestbook({ entityType = "place", entityId, entityName = undefined, onCount = undefined, startComposing = false, world = undefined, prompts = PROMPTS, intro = undefined, signExtra = undefined, canSign = true, cantSignNote = undefined }) {
  const board = entityType === "board";
  const { user, profile, isAuthenticated, socialTier, socialTierReady } = useAuth();
  // Without a world: NEUTRAL_WORLD, the shared inks on white.
  const w = worldRow(world);
  const composeId = useId();
  // Today's AuthContext has no socialTierReady (undefined): the tier is treated as read.
  const tierReady = socialTierReady !== false;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const publicCount = entries.filter((e) => !e.review_status || e.review_status === "ok").length;
  // Only a count that was read: never a 0 while loading or after a failed read.
  useEffect(() => { if (!loading && !loadError) onCount?.(publicCount); }, [publicCount, loading, loadError]);
  const [composing, setComposing] = useState(startComposing);
  const [prompt, setPrompt] = useState("tip");
  const [body, setBody] = useState("");
  const [showCity, setShowCity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [pad, setPad] = useState(false);                   // the finger-doodle sheet
  const [ownerNote, setOwnerNote] = useState(false);       // the private message to the owner
  const [doodleBusy, setDoodleBusy] = useState(false);
  // Doodles open and close in place; "Enlarge all" opens every one (founder, 2026-10-16).
  const [openDoodles, setOpenDoodles] = useState(() => new Set());
  const toggleDoodle = (id) => setOpenDoodles((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [lightbox, setLightbox] = useState(null);          // full-size photo url
  // Block: the follow list says whether the worker has block_v2; read once,
  // only when someone else's note is on screen.
  const [followList, setFollowList] = useState(null);
  const [blocking, setBlocking] = useState(null);          // the note whose author is being blocked

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setLoadError(false);
    const { data, error } = await callWorker("guestbook/list", { entity_id: String(entityId) });
    // A failed read is not an empty guestbook.
    if (error && !Array.isArray(data?.entries)) { setLoadError(true); setLoading(false); return; }
    setEntries(Array.isArray(data?.entries) ? data.entries : []);
    setLoading(false);
  }, [entityId]);

  useEffect(() => { load(); }, [load]);
  const othersHere = isAuthenticated && entries.some((e) => !e.mine);
  useEffect(() => {
    if (!othersHere || followList) return undefined;
    let gone = false;
    (async () => { const { data } = await socialFollow("list"); if (!gone) setFollowList(data || {}); })();
    return () => { gone = true; };
  }, [othersHere, followList]);
  const canBlock = blockReady(followList);

  const displayName = profile?.first_name || "A traveler";
  const homeCity = profile?.home_city || null;

  const resetCompose = () => {
    setComposing(false); setBody("");
  };

  const postDoodle = async (dataUrl) => {
    setDoodleBusy(true);
    const up = await callWorker("guestbook/photo-upload", { entity_id: String(entityId), image: dataUrl, doodle: true });
    if (up.error || !up.data?.key) { setDoodleBusy(false); showToast(up.error || "That drawing couldn't be posted", "error"); return; }
    const { data, error } = await callWorker("guestbook/sign", {
      entity_type: entityType, entity_id: String(entityId), entity_name: entityName,
      display_name: displayName, home_city: showCity ? homeCity : null, show_city: showCity,
      prompt_type: "doodle", is_doodle: true,
      photo_key: up.data.key, photo_url: up.data.url,
      body: body.trim() || undefined,
      ...(signExtra || {}),
    });
    setDoodleBusy(false);
    if (error) { showToast(errText(data, error), "error"); return; }
    if (data?.entry) {
      setEntries((prev) => [{ ...data.entry, review_status: data.held ? "held" : "ok" }, ...prev]);
      setPad(false); resetCompose();
      showToast(data.held ? HELD_TOAST : "Doodle signed in", "success");
    }
  };

  const submit = async () => {
    const text = body.trim();
    if (text.length < 2) { showToast("Write a short note first", "error"); return; }
    setBusy(true);
    const { data, error } = await callWorker("guestbook/sign", {
      entity_type: entityType, entity_id: String(entityId), entity_name: entityName,
      display_name: displayName, home_city: showCity ? homeCity : null, show_city: showCity,
      prompt_type: prompt, body: text,
      ...(signExtra || {}),
    });
    setBusy(false);
    if (error) { showToast(errText(data, error), "error"); return; }
    if (data?.entry) {
      setEntries((prev) => [{ ...data.entry, review_status: data.held ? "held" : "ok" }, ...prev]);
      resetCompose();
      showToast(data.held ? HELD_TOAST : "Thank you for helping the next visitor", "success");
    }
  };

  const saveEdit = async (id) => {
    const text = editBody.trim();
    if (!text) return;
    setBusy(true);
    const { data, error } = await callWorker("guestbook/edit", { id, body: text });
    setBusy(false);
    if (error) { showToast(errText(data, error), "error"); return; }
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, body: text, edited_at: data?.entry?.edited_at, review_status: data?.entry?.review_status || (data?.held ? "held" : "ok") } : e)));
    setEditId(null);
    if (data?.held) showToast(HELD_TOAST, "success");
  };

  const remove = async (id) => {
    if (!window.confirm("Delete your note?")) return;
    const { error } = await callWorker("guestbook/delete", { id });
    if (error) { showToast(error, "error"); return; }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const report = async (id) => {
    if (!window.confirm("Report this note to our team?")) return;
    const { error } = await callWorker("guestbook/report", { id });
    if (error) { showToast(error, "error"); return; }
    showToast("Thank you — our team will take a look.", "success");
  };

  /** @type {CSS} */
  const field = /** @type {CSS} */ ({
    "--gs-ph": NEUTRAL.ink3, display: "block", width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12,
    border: `1px solid ${w.line}`, background: NEUTRAL.white, fontFamily: "inherit", fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink, resize: "none",
  });

  return (
    <div style={/** @type {CSS} */ ({ display: "flex", flexDirection: "column", gap: 12, ...(world ? { "--gs-focus": w.ink } : {}) })}>
      {/* Sign CTA — a 13–17 account reads, never posts (founder, 2026-10-11) */}
      {isAuthenticated && !tierReady ? null : isAuthenticated && socialTier === "teen" ? (
        <TeenHoldNote />
      ) : isAuthenticated && !canSign ? (
        <div style={{ ...box(w), padding: "14px 16px", fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
          {cantSignNote || "Only travelers who were really there can write here."}
        </div>
      ) : isAuthenticated ? (
        !composing ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setComposing(true)} style={{ ...outline(w), flex: "1 1 auto" }}>
              <Labelled icon={PenLine} color={w.ink}>Sign the guestbook</Labelled>
            </button>
            {/* Every guestbook takes a doodle too (founder, 2026-10-03). */}
            <button type="button" onClick={() => setPad(true)} disabled={doodleBusy}
              style={{ ...quiet(w), flex: "none", opacity: doodleBusy ? 0.6 : 1 }}>
              <Labelled icon={Brush} color={w.iconInk}>{doodleBusy ? "Posting…" : "Doodle"}</Labelled>
            </button>
          </div>
        ) : (
          <div role="group" aria-labelledby={composeId} style={{ ...box(w), padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Header with an always-visible exit — so you can back out of writing
                even while the keyboard covers the Cancel button below. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span id={composeId} style={{ fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>Leave a kind note</span>
              <button type="button" onClick={resetCompose} aria-label="Close"
                style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "-10px -12px -10px 0", padding: 0, borderRadius: 999, background: "transparent", border: 0, cursor: "pointer" }}>
                <X size={18} strokeWidth={2} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" />
              </button>
            </div>
            <p style={{ marginTop: -6, fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              {intro || <>Help future visitors — share a tip, or tell us your favorite part{entityName ? ` of ${entityName}` : ""}</>}
            </p>
            <ChipRow wrap label="Kind of note">
              {prompts.map((p) => (
                <WorldChip key={p.key} world={w} icon={p.icon} label={p.label} active={prompt === p.key} clearable={false} onClick={() => setPrompt(p.key)} />
              ))}
            </ChipRow>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={3}
              aria-label="Your note"
              placeholder={prompts.find((p) => p.key === prompt)?.hint || "Leave a tip…"}
              className="placeholder:text-[color:var(--gs-ph)]"
              style={field}
            />

            {/* Doodles instead of photos (founder, 2026-10-02): draw with a
                finger — a note, both, or the doodle alone. Photos belong in
                your own albums, postcards and the city collection. */}
            <button type="button" onClick={() => setPad(true)} disabled={doodleBusy}
              style={{ ...quiet(w), alignSelf: "flex-start", justifyContent: "flex-start", textAlign: "left", border: `1px dashed ${w.line}`, padding: "0 12px", fontSize: fs(12.5), opacity: doodleBusy ? 0.6 : 1 }}>
              <Labelled icon={Brush} color={w.iconInk}>{doodleBusy ? "Posting your doodle…" : "Doodle with your finger instead"}</Labelled>
            </button>

            {homeCity && !board && (
              <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink2, cursor: "pointer" }}>
                <input type="checkbox" checked={showCity} onChange={(e) => setShowCity(e.target.checked)}
                  style={{ width: 18, height: 18, margin: 0, flexShrink: 0, accentColor: w.ink }} />
                Show &ldquo;from {homeCity}&rdquo; on my note
              </label>
            )}
            <p style={{ fontSize: fs(11), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
              Kind notes post right away; if a note sounds like a complaint, our team reads it first.
              Notes &amp; doodles post publicly. By posting you grant Globeskimmers a license to display them.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: 12 }}>
              <span style={{ fontSize: fs(11), lineHeight: 1.35, color: NEUTRAL.ink3 }}>{body.length}/1000 · posts publicly as {board ? "your @username (or @local / @traveler if you have none)" : displayName}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                <button type="button" onClick={resetCompose} style={{ ...textButton, justifyContent: "center", padding: "0 8px", fontSize: fs(13), color: NEUTRAL.ink2 }}>Cancel</button>
                <button type="button" onClick={submit} disabled={busy} style={{ ...outline(w), padding: "0 20px", opacity: busy ? 0.5 : 1 }}>
                  {busy ? "Signing…" : "Sign"}
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <div style={{ ...box(w), padding: "16px 20px", textAlign: "center", fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
          Sign in to leave a tip or your favorite part for the next traveler.
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <p role="status" style={{ padding: "20px 0", textAlign: "center", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Loading notes…</p>
      ) : loadError ? (
        <div role="status" style={{ ...box(w), padding: "20px", textAlign: "center" }}>
          <p style={{ fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>We couldn&rsquo;t load this guestbook.</p>
          <button type="button" onClick={load} style={{ ...outline(w), marginTop: 12 }}>Try again</button>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ ...box(w), padding: "24px 20px", textAlign: "center" }}>
          <p style={{ fontSize: fs(14.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>{board ? `No tips yet — be the first to help the next traveler in ${entityName || "this place"}` : <>No notes yet — be the first to share a tip or your favorite part{entityName ? ` of ${entityName}` : ""}</>}</p>
        </div>
      ) : (
        <>
        {(() => {
          const ids = entries.filter((x) => x.photo_url && x.is_doodle).map((x) => x.id);
          const allOpen = ids.length > 1 && ids.every((id) => openDoodles.has(id));
          return ids.length > 1 ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <DoodlesAllToggle count={ids.length} allOpen={allOpen} color={w.ink}
                onToggle={() => setOpenDoodles(allOpen ? new Set() : new Set(ids))} />
            </div>
          ) : null;
        })()}
        <ul style={{ ...box(w), padding: "0 16px" }}>
          {entries.map((e, i) => {
            const mine = !!e.mine || (!!user && e.user_id === user.id);
            const doodleOpen = openDoodles.has(e.id);
            return (
              <li key={e.id} style={{ padding: "14px 0", borderTop: i ? `1px solid ${w.line}` : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* The disc grows with the text size, so the initial never outgrows it. */}
                  <span aria-hidden="true" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: fs(32), height: fs(32), borderRadius: 999, background: w.wash, color: w.washInk, fontFamily: SERIF, fontSize: fs(16), lineHeight: 1 }}>
                    {(String(e.display_name || "?").replace(/^@+/, "") || "?").charAt(0).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: fs(14), lineHeight: 1.3, fontWeight: 700, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>
                      {e.display_name}{e.home_city ? <span style={{ fontWeight: 400, color: NEUTRAL.ink3 }}> from {e.home_city}</span> : null}
                    </p>
                    <p style={{ marginTop: 1, fontSize: fs(11.5), lineHeight: 1.35, color: NEUTRAL.ink3 }}>
                      {PROMPT_LABEL[e.prompt_type] || "Tip"} · {timeAgo(e.created_at)}{e.edited_at ? " · edited" : ""}{e.verified_visit ? " · visited" : ""}
                    </p>
                  </div>
                </div>
                {mine && e.review_status === "held" && (
                  <p style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, borderRadius: 10, background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, padding: "6px 10px", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
                    <Hourglass size={13} strokeWidth={2} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>Waiting for a quick look from our team — only you can see this for now.</span>
                  </p>
                )}
                {mine && e.review_status === "rejected" && (
                  <p style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, borderRadius: 10, background: NEUTRAL.ivory2, border: `1px solid ${NEUTRAL.lobbyLine}`, padding: "6px 10px", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
                    <EyeOff size={13} strokeWidth={2} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>Our team kept this note private — only you can see it. You can edit or delete it.</span>
                  </p>
                )}
                {editId === e.id ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={editBody} onChange={(ev) => setEditBody(ev.target.value)} rows={3} maxLength={1000} aria-label="Edit your note"
                      className="placeholder:text-[color:var(--gs-ph)]" style={field} />
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <button type="button" onClick={() => setEditId(null)} style={{ ...textButton, justifyContent: "center", padding: "0 8px", color: NEUTRAL.ink2 }}>Cancel</button>
                      <button type="button" onClick={() => saveEdit(e.id)} disabled={busy} style={{ ...outline(w), opacity: busy ? 0.5 : 1 }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ marginTop: 8, fontSize: fs(14), lineHeight: 1.55, color: NEUTRAL.ink2, overflowWrap: "anywhere" }}>{e.body}</p>
                    {e.photo_url && e.is_doodle && (
                      <div style={{ marginTop: 8 }}>
                        <DoodleThumb src={e.photo_url} alt={`A doodle by ${e.display_name}`} open={doodleOpen} onToggle={() => toggleDoodle(e.id)} line={w.line} />
                      </div>
                    )}
                    {e.photo_url && !e.is_doodle && (
                      <button type="button" onClick={() => setLightbox(e.photo_url)} aria-label="Open the photo"
                        style={{ display: "block", width: "100%", marginTop: 8, padding: 0, background: "transparent", border: 0, cursor: "zoom-in" }}>
                        <img src={e.photo_url} alt="" loading="lazy"
                          style={{ display: "block", width: "100%", maxHeight: 288, objectFit: "cover", borderRadius: 12, border: `1px solid ${w.line}` }} />
                      </button>
                    )}
                  </>
                )}
                <div style={{ display: "flex", gap: 8, margin: "-2px 0 -12px" }}>
                  {mine ? (
                    <>
                      <button type="button" onClick={() => { setEditId(e.id); setEditBody(e.body); }} aria-label="Edit your note" style={textButton}>Edit</button>
                      <button type="button" onClick={() => remove(e.id)} aria-label="Delete your note" style={textButton}>Delete</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => report(e.id)} aria-label={`Report the note by ${e.display_name || "a traveler"}`} style={textButton}>Report</button>
                      {canBlock && (
                        <button type="button" onClick={() => setBlocking(e)} aria-haspopup="dialog"
                          aria-label={`Block ${e.display_name || "this traveler"}`} style={textButton}>Block</button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}

      {/* The quiet door for anything not kind (founder, 2026-10-05): a private
          message to the owner — never posted; screened before delivery. */}
      {isAuthenticated && tierReady && !composing && socialTier !== "teen" && !board && (
        <button type="button" onClick={() => setOwnerNote(true)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 44, padding: "4px 0", background: "transparent", border: 0, fontFamily: "inherit", fontSize: fs(12), lineHeight: 1.4, color: NEUTRAL.ink3, textAlign: "center", cursor: "pointer" }}>
          <span>
            <Lock size={13} strokeWidth={2} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
            Something for the owner&rsquo;s ears? Send a private message
          </span>
        </button>
      )}
      {ownerNote && (
        <OwnerNoteSheet entityType={entityType} entityId={entityId} entityName={entityName} onClose={() => setOwnerNote(false)} />
      )}
      {blocking && (
        <TravelerSheet person={{ guestbook_entry_id: blocking.id, name: blocking.display_name || null }} list={followList} start="block"
          report={{ kind: "profile", note: `Guestbook note${entityName ? ` at ${entityName}` : ""}: "${String(blocking.body || "").slice(0, 300)}"` }}
          onClose={() => setBlocking(null)} onChanged={() => { setBlocking(null); load(); }} />
      )}
      {pad && (
        <DoodlePad busy={doodleBusy} onClose={() => setPad(false)} onPost={postDoodle}
          title="Sign the guestbook" eyebrow={entityName ? `Guestbook · ${entityName}` : "Guestbook"}
          note="Draw your name, a little art, or something you loved about this place."
          starter="I was here!" />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: rgba(NEUTRAL.black, 0.85) }}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
          <button type="button" autoFocus onClick={() => setLightbox(null)} aria-label="Close the photo"
            style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 8px)", right: 8, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, borderRadius: 999, background: rgba(NEUTRAL.black, 0.4), border: 0, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} color={NEUTRAL.white} aria-hidden="true" focusable="false" />
          </button>
        </div>
      )}
    </div>
  );
}
