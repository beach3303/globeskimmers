// PostcardCompose — write and send a postcard (founder concept: sent, not posted). One
// sheet: the photo (picked file, resized client-side), the message, the place line, optional
// dish-or-topic line (founder, 2026-10-24: "dish or topic optional"), and the address — a blank "Send to" bar with @username suggestions
// (SendToField; founder, 2026-10-24: "remove pre placed names at send to: … i love @handle
// suggestions"), up to PC_MAX_TO people sent SEPARATELY or AS A GROUP ("allow post card to be
// sent to group or individually to multiple people"). No card goes to all your followers at once
// from here any more (founder, 2026-10-24: "remove the one that says everyone that follows"). The
// worker moderates the photo at send, fail-closed.
//
// The new look (bible.word.lines): 'Send a *postcard*' (was 'A postcard to your circle' until the
// broadcast went, 2026-10-24), on ivory with an airmail
// edge; the chosen address in airmail blue, Send in stamp red with a lucide Send. No emoji.
//
//   <PostcardCompose open onClose onSent preset toHandle blocked toCity />
//   preset         { image, place_name, city, country } (a stamp's place).
//   toHandle       a fixed address ('Send a postcard' on someone's page): the sheet shows
//                  only that address.
//   blocked        people you blocked (op:list `blocked` rows, user ids, handles, or a Set):
//                  never suggested as an address. A fixed address you blocked can't be sent to.
//   toCity         { city, country }: a postcard to that city's public board (City Board).
//                  The sheet reads 'A postcard to *Lisbon*', the address is the board alone,
//                  and a line says who can see it. The worker checks you were really there.
import React, { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Info, Loader2, RefreshCw, Send, SlidersHorizontal, X } from "lucide-react";
import { showToast } from "@/components/Toast";
import { resizePhoto } from "@/lib/resizePhoto";
import { sendPostcard } from "@/lib/passport";
import { useDismissable } from "@/lib/dismissStack";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { workerMessage } from "@/components/social/FollowByHandle";
import SendToField, { chipLabel } from "@/components/social/SendToField";
import PhotoEditor from "@/components/passport/PhotoEditor";
import { askForAlerts } from "@/lib/pushAlerts";

/** @typedef {import('react').CSSProperties} CSS */

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

/**
 * A style object that may carry CSS custom properties (--gs-ph).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

const lc = (h) => String(h ?? "").trim().replace(/^@+/, "").toLowerCase();
const PC_MAX_TO = 10;

/**
 * Who you blocked, as user ids and handles, from rows, strings or a Set.
 * @param {any} blocked
 */
export function blockedKeys(blocked) {
  const ids = new Set();
  const handles = new Set();
  const list = blocked instanceof Set ? [...blocked] : Array.isArray(blocked) ? blocked : [];
  for (const b of list) {
    if (b && typeof b === "object") {
      if (b.user_id != null && b.user_id !== "") ids.add(String(b.user_id));
      if (lc(b.handle)) handles.add(lc(b.handle));
    } else if (b != null && String(b).trim()) {
      ids.add(String(b).trim());
      handles.add(lc(b));
    }
  }
  return { ids, handles };
}

/** @type {CSS} */
const FIELD = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${NEUTRAL.airmailLine}`,
  background: NEUTRAL.white,
  fontFamily: "inherit",
  fontSize: fs(13),
  color: NEUTRAL.ink,
};

/**
 * One address: a 44px button around a 32px chip, pressed in airmail blue when chosen.
 * @param {{ on: boolean, onClick?: () => void, children: import('react').ReactNode, fixed?: boolean }} props
 */
function Address({ on, onClick = undefined, children, fixed = false }) {
  const chip = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 32,
        boxSizing: "border-box",
        padding: "4px 12px",
        borderRadius: 999,
        background: on ? NEUTRAL.airmailBlue : NEUTRAL.white,
        border: `1px solid ${on ? NEUTRAL.airmailBlue : NEUTRAL.airmailLine}`,
        fontSize: fs(12),
        fontWeight: 600,
        lineHeight: 1.25,
        overflowWrap: "anywhere",
        color: on ? NEUTRAL.white : NEUTRAL.ink2,
      }}
    >
      {children}
    </span>
  );
  if (fixed) return <span style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>{chip}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{ display: "inline-flex", alignItems: "center", minHeight: 44, maxWidth: "100%", padding: 0, background: "transparent", border: 0, cursor: "pointer" }}
    >
      {chip}
    </button>
  );
}

/**
 * @param {{
 *   open?: boolean, onClose?: () => void, onSent?: () => void, preset?: any,
 *   toHandle?: string|null, blocked?: any, toCity?: { city: string, country: string }|null,
 * }} props
 */
// replyTo (2026-10-19): { postcard_id, name } — the address is the sender of that card, resolved by
// the worker; the To row shows "Reply to Mary".
export default function PostcardCompose({ open = false, onClose = undefined, onSent = undefined, preset = undefined, toHandle = null, blocked = undefined, toCity = null, replyTo = null }) {
  const fileRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const sheetRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const titleId = `pc-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fixedTo = lc(toHandle);
  const [image, setImage] = useState(preset?.image || null);
  const [message, setMessage] = useState("");
  const [place, setPlace] = useState(preset?.place_name || "");
  const [dish, setDish] = useState("");
  // Who it's for (2026-10-24): the people in the Send to bar — { user_id?, handle?, name?, email? }.
  const [list, setList] = useState(/** @type {any[]} */ ([]));
  const [mode, setMode] = useState("each");        // each | group, for two people or more
  const [editing, setEditing] = useState(false);   // our looks on the front (PhotoEditor, 2026-10-19)
  const [busy, setBusy] = useState(false);
  // Board cards sign with your name, or with none at all (founder, 2026-10-15):
  // 'anon' posts as "a local" / "a traveler" — the worker decides which.
  const [sign, setSign] = useState("signed");
  // After a direct send, the worker may offer to pin a copy on that city's
  // board ({ city, country, label }); the card's parts ride along for the pin.
  const [pinOffer, setPinOffer] = useState(/** @type {any} */ (null));
  const [pinBusy, setPinBusy] = useState(false);
  const close = () => { if (typeof onClose === "function") onClose(); };
  // Cancel (founder, 2026-10-19: "place an X if user wants to cancel composing"): with nothing on
  // the card it just closes; with a photo or words it asks once, so nothing is lost by a stray tap.
  const [discarding, setDiscarding] = useState(false);
  const started = (!!image && image !== (preset?.image || null)) || !!message.trim() || !!dish.trim();
  const discard = () => { setDiscarding(false); setImage(preset?.image || null); setMessage(""); setDish(""); setPlace(preset?.place_name || ""); close(); };
  const cancel = () => { if (pinOffer || !started) { setDiscarding(false); close(); } else setDiscarding(true); };
  useDismissable(open, cancel);

  // Focus moves into the sheet when it opens and back to where it was when it closes;
  // Escape closes it.
  useEffect(() => {
    if (!open) return undefined;
    const before = typeof document !== "undefined" ? document.activeElement : null;
    const t = setTimeout(() => { if (sheetRef.current) sheetRef.current.focus(); }, 0);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      if (before && typeof (/** @type {any} */ (before)).focus === "function" && document.contains(before)) (/** @type {any} */ (before)).focus();
    };
  }, [open]);

  if (!open) return null;

  const block = blockedKeys(blocked);
  const board = toCity && String(toCity.city || "").trim() && String(toCity.country || "").trim()
    ? { city: String(toCity.city).trim(), country: String(toCity.country).trim(), region: toCity.region ? String(toCity.region).trim() : null } : null;
  const fixedBlocked = !board && !!fixedTo && block.handles.has(fixedTo);
  const reply = !board && replyTo && replyTo.postcard_id ? replyTo : null;
  const picked = !board && !reply && !fixedTo ? list : [];
  const addressed = !!board || !!reply || !!fixedTo || picked.length > 0;
  const canSend = !busy && !!image && addressed && !fixedBlocked;
  const group = picked.length > 1 && mode === "group";

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setImage(await resizePhoto(f)); } catch (err) { showToast(err?.message || "Couldn't read that photo", "error"); }
  };

  const send = async () => {
    if (busy) return;
    if (!image) { showToast("A postcard needs its photo", "error"); return; }
    if (!addressed) { showToast("Who is it for? Add someone in Send to.", "error"); return; }
    if (fixedBlocked) return;
    setBusy(true);
    const address = board || reply ? "" : fixedTo;
    // The Send to bar: accounts by id (a name found by search), a typed @username, an email.
    const byId = picked.filter((p) => p.user_id).map((p) => p.user_id);
    const byHandle = picked.filter((p) => !p.user_id && p.handle).map((p) => lc(p.handle));
    const byEmail = picked.filter((p) => !p.user_id && !p.handle && p.email).map((p) => p.email);
    const { data, error } = await sendPostcard({
      image, message,
      place_name: place || preset?.place_name, city: board?.city || preset?.city, country: board?.country || preset?.country,
      region: board?.region || preset?.region || undefined,
      meta: dish ? { dish } : undefined,
      to_handle: address || undefined,
      to_user_ids: byId.length ? byId : undefined,
      to_handles: byHandle.length ? byHandle : undefined,
      to_emails: byEmail.length ? byEmail : undefined,
      mode: picked.length > 1 ? (group ? "group" : "each") : undefined,
      to_city: board || undefined,
      anon: board && sign === "anon" ? true : undefined,
      reply_to: reply ? reply.postcard_id : undefined,
    });
    setBusy(false);
    if (error === "age_required") { showToast("Set your birth year in Settings first (one time)", "error"); return; }
    if (error) { showToast(workerMessage(error, "Couldn't send the postcard. Try again."), "error"); return; }
    const one = picked.length === 1 ? picked[0] : null;
    const waiting = Array.isArray(data?.not_ready) && data.not_ready.length ? ` · ${data.not_ready.map((h) => `@${h}`).join(", ")} hasn’t finished their passport yet` : "";
    showToast(board
      ? (sign === "anon" ? `Posted to ${board.city}’s city board, no name on it` : `Posted to ${board.city}’s city board`)
      : reply ? `Reply sent to ${reply.name || "them"}`
      : address ? `Postcard sent to @${address}`
        // An email address reads the same whether or not a member logs in with it.
        : one ? `Postcard sent to ${chipLabel(one)}${waiting}`
            : `${group ? "Group postcard" : "Postcard"} sent to ${picked.length} people${waiting}`, "success");
    // The pin ask (founder, 2026-10-15): a direct card from a city the sender
    // verifiably stamped may hang on that city's board too — their choice,
    // asked now, while the card is in hand. The mail itself is already away.
    const offer = !board && (address || picked.length) && data?.pin && data.pin.city
      ? { city: String(data.pin.city), country: String(data.pin.country || ""), region: data.pin.region ? String(data.pin.region) : null, label: data.pin.label === "local" ? "local" : "traveler", image, message, place: place || preset?.place_name || "", dish,
        sentTo: address ? `@${address}` : one ? chipLabel(one) : `${picked.length} people` }
      : null;
    if (offer) setPinOffer(offer);
    // The next postcard starts blank.
    setImage(preset?.image || null);
    setMessage("");
    setDish("");
    setList([]);
    // The moment to ask for alerts (push, 2026-10-19): a card just went to someone.
    if (!board) askForAlerts();
    if (typeof onSent === "function") onSent();
    if (!offer) close();
  };

  // Pin the just-sent card on its city's board: an ordinary board post of the
  // same photo and words, signed or nameless. Failing never touches the mail.
  const pinIt = async (anon) => {
    if (pinBusy || !pinOffer) return;
    setPinBusy(true);
    const { error } = await sendPostcard({
      image: pinOffer.image, message: pinOffer.message,
      place_name: pinOffer.place || undefined, city: pinOffer.city, country: pinOffer.country, region: pinOffer.region || undefined,
      meta: pinOffer.dish ? { dish: pinOffer.dish } : undefined,
      to_city: { city: pinOffer.city, country: pinOffer.country },
      anon: anon || undefined,
    });
    setPinBusy(false);
    if (error) { showToast(workerMessage(error, "Couldn’t pin it — the postcard itself is already sent."), "error"); return; }
    showToast(anon ? `Pinned on ${pinOffer.city}’s city board as @${pinOffer.label}` : `Pinned on ${pinOffer.city}’s city board`, "success");
    setPinOffer(null);
    close();
  };

  /** @type {CSS} */
  const kicker = { fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.3, fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: NEUTRAL.ink3 };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-center"
      style={{ background: rgba(NEUTRAL.ink, 0.5) }}
      onClick={cancel}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md max-h-[88vh] overflow-y-auto"
        style={{ position: "relative", background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0", outline: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <AirmailChevron height={4} />
        <button type="button" onClick={cancel} aria-label={pinOffer ? "Close" : "Cancel this postcard"}
          style={{ position: "absolute", top: 10, right: 8, zIndex: 3, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, color: NEUTRAL.ink2 }}>
            <X size={18} strokeWidth={2} focusable="false" />
          </span>
        </button>
        {discarding ? (
          <div role="alertdialog" aria-label="Discard this postcard?" style={{ position: "sticky", top: 0, zIndex: 4, margin: "0 12px", padding: "12px 14px", borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, boxShadow: `0 10px 24px -12px ${rgba(NEUTRAL.ink, 0.4)}` }}>
            <div style={{ fontFamily: SERIF, fontSize: fs(19), color: NEUTRAL.ink }}>Discard this postcard?</div>
            <div style={{ fontSize: fs(12.5), lineHeight: 1.4, color: NEUTRAL.ink3, marginTop: 2 }}>The photo and the words you added go away.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => setDiscarding(false)} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, font: "inherit", fontSize: fs(14), fontWeight: 600 }}>Keep writing</button>
              <button type="button" onClick={discard} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 0, background: NEUTRAL.stamp, color: NEUTRAL.white, font: "inherit", fontSize: fs(14), fontWeight: 600 }}>Discard</button>
            </div>
          </div>
        ) : null}
        <div style={{ padding: "16px 20px calc(28px + env(safe-area-inset-bottom))" }}>
          {pinOffer ? (<>
          {/* The ask (founder, 2026-10-15): the mail is away; pinning a copy on the
              city's board is a separate, asked-first choice. Default is no. */}
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.3, letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>Sent to {pinOffer.sentTo} ✓</div>
          <h3 id={titleId} style={{ margin: "2px 0 0", paddingRight: 40, fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
            Pin a copy on <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>{pinOffer.city}</em>&rsquo;s city board?
          </h3>
          <div style={{ marginTop: 12, borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, overflow: "hidden" }}>
            <img src={pinOffer.image} alt="The card, exactly as it would hang" style={{ display: "block", width: "100%", aspectRatio: "3 / 2", objectFit: "cover" }} />
            {pinOffer.message ? (
              <p style={{ margin: 0, padding: "10px 14px 4px", fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), lineHeight: 1.35, color: NEUTRAL.ink2, overflowWrap: "anywhere" }}>&ldquo;{pinOffer.message}&rdquo;</p>
            ) : null}
            <p style={{ margin: 0, padding: `${pinOffer.message ? 0 : 10}px 14px 10px`, fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>To: {pinOffer.place ? `${pinOffer.place} · ` : ""}{pinOffer.city}</p>
          </div>
          <p style={{ display: "flex", alignItems: "flex-start", gap: 6, margin: "10px 0 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
            <Info size={14} strokeWidth={2} color={NEUTRAL.airmailBlue} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Your friend&rsquo;s copy is untouched, and who you mailed it to never shows. Signed shows your @username; @{pinOffer.label} shows no name at all.</span>
          </p>
          <button type="button" onClick={() => pinIt(false)} aria-busy={pinBusy || undefined}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 48, boxSizing: "border-box", marginTop: 14, padding: "8px 16px", borderRadius: 14, background: NEUTRAL.stamp, border: `1px solid ${NEUTRAL.stamp}`, fontFamily: "inherit", fontSize: fs(14.5), fontWeight: 600, color: NEUTRAL.white, cursor: "pointer" }}>
            {pinBusy ? <Loader2 size={16} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : null}
            Pin it — signed
          </button>
          <button type="button" onClick={() => pinIt(true)} aria-busy={pinBusy || undefined}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 48, boxSizing: "border-box", marginTop: 8, padding: "8px 16px", borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailBlue}`, fontFamily: "inherit", fontSize: fs(14.5), fontWeight: 600, color: NEUTRAL.airmailBlue, cursor: "pointer" }}>
            Pin as @{pinOffer.label}
          </button>
          <button type="button" onClick={() => { setPinOffer(null); close(); }}
            style={{ display: "block", width: "100%", minHeight: 44, marginTop: 6, padding: "8px 16px", background: "transparent", border: 0, fontFamily: "inherit", fontSize: fs(13.5), fontWeight: 600, color: NEUTRAL.ink3, cursor: "pointer" }}>
            No thanks — keep it between us
          </button>
          </>) : (<>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.3, letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>Globeskimmers mail</div>
          <h3 id={titleId} style={{ margin: "2px 0 0", paddingRight: 40, fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
            {reply
              ? <>A postcard back to <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>{reply.name || "them"}</em></>
              : board ? <>A postcard to <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>{board.city}</em></> : <>Send a <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>postcard</em></>}
          </h3>

          {/* the front */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={image ? "Change the photo" : "Choose the photo"}
            style={{ position: "relative", display: "block", width: "100%", marginTop: 12, padding: 0, overflow: "hidden", borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, aspectRatio: "3 / 2", cursor: "pointer" }}
          >
            {image ? (
              <>
                <img src={image} alt="The postcard front" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {/* The photo is the button (founder, 2026-10-19): a corner tag says so. */}
                <span aria-hidden="true" style={{ position: "absolute", right: 8, bottom: 8, display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px", borderRadius: 999, background: rgba(NEUTRAL.ink, 0.62), color: NEUTRAL.white, fontSize: fs(12), fontWeight: 600, backdropFilter: "blur(2px)" }}>
                  <RefreshCw size={13} strokeWidth={2.2} focusable="false" /> Change
                </span>
              </>
            ) : (
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", color: NEUTRAL.ink3 }}>
                <ImagePlus size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
                <span style={{ fontSize: fs(12.5) }}>The photo goes on the front</span>
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          {image ? (
            <button type="button" onClick={() => setEditing(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, minHeight: 40, padding: "0 12px", borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.airmailBlue, fontSize: fs(12.5), fontWeight: 600 }}>
              <SlidersHorizontal size={15} strokeWidth={2} aria-hidden="true" focusable="false" />
              Edit the photo — our looks
            </button>
          ) : null}
          <PhotoEditor open={editing} image={image} aspect="3:2" onDone={(u) => { setImage(u); setEditing(false); }} onClose={() => setEditing(false)} />

          {/* the back */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 240))}
            rows={2}
            placeholder="Your message…"
            aria-label="Your message"
            className="resize-none placeholder:text-[color:var(--gs-ph)]"
            style={css({ ...FIELD, display: "block", marginTop: 12, fontFamily: SERIF, fontStyle: "italic", fontSize: fs(16), lineHeight: 1.35, color: NEUTRAL.ink2, "--gs-ph": NEUTRAL.ink3 })}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value.slice(0, 80))}
              placeholder="Where was this taken?"
              aria-label="Where"
              className="placeholder:text-[color:var(--gs-ph)]"
              style={css({ ...FIELD, flex: "1 1 calc(150px * var(--fs, 1))", width: "auto", minWidth: 0, "--gs-ph": NEUTRAL.ink3 })}
            />
            <input
              value={dish}
              onChange={(e) => setDish(e.target.value.slice(0, 60))}
              placeholder="Dish or topic (optional)"
              aria-label="Dish or topic"
              className="placeholder:text-[color:var(--gs-ph)]"
              style={css({ ...FIELD, flex: "1 1 calc(150px * var(--fs, 1))", width: "auto", minWidth: 0, "--gs-ph": NEUTRAL.ink3 })}
            />
          </div>

          {/* the address: fixed (a board, a reply, someone's page), or the blank Send to bar */}
          {board || reply || fixedTo ? <div id={`${titleId}-to`} style={{ ...kicker, marginTop: 16 }}>To</div> : null}
          {board ? (
            <div style={{ marginTop: 2 }}>
              <Address on fixed>{board.city}’s city board</Address>
              {/* Signed, or no name at all (founder, 2026-10-15): "a local" /
                  "a traveler" — the worker decides which of the two it signs. */}
              <div role="group" aria-label="Signed or no name" style={{ display: "flex", flexWrap: "wrap", columnGap: 6, marginTop: 8 }}>
                <Address on={sign === "signed"} onClick={() => setSign("signed")}>Signed — your @username</Address>
                <Address on={sign === "anon"} onClick={() => setSign("anon")}>No name</Address>
              </div>
              <p style={{ display: "flex", alignItems: "flex-start", gap: 6, margin: "6px 0 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
                <Info size={14} strokeWidth={2} color={NEUTRAL.airmailBlue} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{sign === "anon"
                  ? <>Everyone who opens {board.city}’s city board can see the card — signed @local if {board.city} is your home city, otherwise @traveler. Your @username stays off it.</>
                  : <>Everyone who opens {board.city}’s city board can see it, with your @username.</>}</span>
              </p>
            </div>
          ) : reply ? (
            <div style={{ marginTop: 2 }}>
              <Address on fixed>Reply to {reply.name || "them"}</Address>
            </div>
          ) : fixedTo ? (
            <div style={{ marginTop: 2 }}>
              <Address on fixed>@{fixedTo}</Address>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <SendToField value={list} onChange={setList} max={PC_MAX_TO} allowEmail blocked={blocked} />
              {picked.length > 1 ? (
                <div style={{ marginTop: 8 }}>
                  <div role="group" aria-label="How it goes" style={{ display: "flex", flexWrap: "wrap", columnGap: 6 }}>
                    <Address on={mode === "each"} onClick={() => setMode("each")}>Separately</Address>
                    <Address on={mode === "group"} onClick={() => setMode("group")}>As a group</Address>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
                    {mode === "group"
                      ? `One card to all ${picked.length}. Everyone on it sees who else got it; replies come only to you.${picked.some((p) => p.email) ? " Anyone added by email gets their own card." : ""}`
                      : `${picked.length} cards, one each. Nobody sees who else got one.`}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {fixedBlocked ? (
            <p style={{ display: "flex", alignItems: "flex-start", gap: 6, margin: "8px 0 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              <Info size={14} strokeWidth={2} color={NEUTRAL.airmailBlue} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{`You blocked @${fixedTo}, so this postcard can’t be sent to them.`}</span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={send}
            aria-disabled={!canSend || undefined}
            aria-busy={busy || undefined}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              minHeight: 48,
              boxSizing: "border-box",
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 14,
              background: canSend || busy ? NEUTRAL.stamp : NEUTRAL.ivory2,
              border: `1px solid ${canSend || busy ? NEUTRAL.stamp : NEUTRAL.creamRule}`,
              fontFamily: "inherit",
              fontSize: fs(14.5),
              fontWeight: 600,
              color: canSend || busy ? NEUTRAL.white : NEUTRAL.ink3,
              cursor: canSend ? "pointer" : "default",
            }}
          >
            {busy
              ? <Loader2 size={16} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" />
              : <Send size={16} strokeWidth={2} aria-hidden="true" focusable="false" />}
            {busy ? "Sending…" : "Send it"}
          </button>
          <p style={{ margin: "8px 0 0", fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.4, letterSpacing: ".04em", textAlign: "center", color: NEUTRAL.ink3 }}>
            PHOTOS ARE REVIEWED BEFORE THEY TRAVEL · NO LOCATIONS RIDE ALONG
          </p>
          </>)}
        </div>
      </div>
    </div>
  );
}
