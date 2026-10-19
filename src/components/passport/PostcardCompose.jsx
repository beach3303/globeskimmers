// PostcardCompose — write and send a postcard (founder concept: sent, not posted). One
// sheet: the photo (picked file, resized client-side), the message, the place line, optional
// dish lines for food cards, and the address — someone you follow by @handle, or everyone who
// follows you. The worker moderates the photo at send, fail-closed.
//
// The new look (bible.word.lines): 'A postcard to your *circle*', on ivory with an airmail
// edge; the chosen address in airmail blue, Send in stamp red with a lucide Send. No emoji.
//
//   <PostcardCompose open onClose onSent following followerCount preset toHandle blocked toCity />
//   following      op:list `following` rows (or useCircle().acc): accepted people you follow
//                  who have a handle become addresses, 12 at most.
//   followerCount  how many follow you; at 0 'Everyone who follows me' has nowhere to go.
//   preset         { image, place_name, city, country } (a stamp's place).
//   toHandle       a fixed address ('Send a postcard' on someone's page): the sheet shows
//                  only that address.
//   blocked        people you blocked (op:list `blocked` rows, user ids, handles, or a Set):
//                  never offered as an address. A fixed address you blocked can't be sent to.
//   toCity         { city, country }: a postcard to that city's public board (City Board).
//                  The sheet reads 'A postcard to *Lisbon*', the address is the board alone,
//                  and a line says who can see it. The worker checks you were really there.
//
// Sending keeps today's call and errors; the toasts use the circle wording ('Postcard sent to
// everyone who follows you').
import React, { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Info, Loader2, Send, SlidersHorizontal } from "lucide-react";
import { showToast } from "@/components/Toast";
import { resizePhoto } from "@/lib/resizePhoto";
import { sendPostcard } from "@/lib/passport";
import { useDismissable } from "@/lib/dismissStack";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { workerMessage } from "@/components/social/FollowByHandle";
import FindPeople from "@/components/social/FindPeople";
import PhotoEditor from "@/components/passport/PhotoEditor";

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
 *   open?: boolean, onClose?: () => void, onSent?: () => void, following?: any[], preset?: any,
 *   followerCount?: number|null, toHandle?: string|null, blocked?: any, toCity?: { city: string, country: string }|null,
 * }} props
 */
export default function PostcardCompose({ open = false, onClose = undefined, onSent = undefined, following = [], preset = undefined, followerCount = null, toHandle = null, blocked = undefined, toCity = null }) {
  const fileRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const sheetRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const titleId = `pc-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fixedTo = lc(toHandle);
  const [image, setImage] = useState(preset?.image || null);
  const [message, setMessage] = useState("");
  const [place, setPlace] = useState(preset?.place_name || "");
  const [dish, setDish] = useState("");
  const [to, setTo] = useState(fixedTo);       // '' = everyone who follows me
  // Someone outside the circle, chosen through Find people (2026-10-18): { user_id, handle, name }.
  const [other, setOther] = useState(/** @type {any} */ (null));
  const [picking, setPicking] = useState(false);
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
  useDismissable(open, close);

  // A fixed address set, changed or cleared while the sheet is mounted is the address.
  useEffect(() => { setTo(fixedTo); }, [fixedTo]);

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
  const isBlocked = (r) => block.ids.has(String(r?.user_id ?? "")) || block.handles.has(lc(r?.handle));
  const addresses = (Array.isArray(following) ? following : [])
    .filter((f) => f && f.handle && f.status === "accepted" && !isBlocked(f))
    .slice(0, 12);
  const board = toCity && String(toCity.city || "").trim() && String(toCity.country || "").trim()
    ? { city: String(toCity.city).trim(), country: String(toCity.country).trim(), region: toCity.region ? String(toCity.region).trim() : null } : null;
  const fixedBlocked = !board && !!fixedTo && block.handles.has(fixedTo);
  const nowhere = !board && !fixedTo && !other && to === "" && followerCount === 0;
  const canSend = !busy && !!image && !nowhere && !fixedBlocked;

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setImage(await resizePhoto(f)); } catch (err) { showToast(err?.message || "Couldn't read that photo", "error"); }
  };

  const send = async () => {
    if (busy) return;
    if (!image) { showToast("A postcard needs its photo", "error"); return; }
    if (nowhere || fixedBlocked) return;
    setBusy(true);
    const address = board ? "" : fixedTo || (other ? "" : to);
    const toOther = !board && !fixedTo && other ? other : null;
    const { data, error } = await sendPostcard({
      image, message,
      place_name: place || preset?.place_name, city: board?.city || preset?.city, country: board?.country || preset?.country,
      region: board?.region || preset?.region || undefined,
      meta: dish ? { dish } : undefined,
      to_handle: address || undefined,
      to_user_id: toOther && !toOther.email ? toOther.user_id : undefined,
      to_email: toOther && toOther.email ? toOther.email : undefined,
      to_city: board || undefined,
      anon: board && sign === "anon" ? true : undefined,
    });
    setBusy(false);
    if (error === "age_required") { showToast("Set your birth year in Settings first (one time)", "error"); return; }
    if (error === "no_followers") { showToast("No one follows you yet. Address it to someone you follow, or invite someone to your circle first", "error"); return; }
    if (error) { showToast(workerMessage(error, "Couldn't send the postcard. Try again."), "error"); return; }
    showToast(board
      ? (sign === "anon" ? `Posted to ${board.city}’s city board, no name on it` : `Posted to ${board.city}’s city board`)
      : address ? `Postcard sent to @${address}`
        : toOther && data?.waiting ? (data.emailed ? `Saved for ${toOther.email} — we emailed them a link to join` : `Saved for ${toOther.email} — it opens when they join`)
          : toOther ? `Postcard sent to ${toOther.handle ? `@${toOther.handle}` : toOther.name}` : "Postcard sent to everyone who follows you", "success");
    // The pin ask (founder, 2026-10-15): a direct card from a city the sender
    // verifiably stamped may hang on that city's board too — their choice,
    // asked now, while the card is in hand. The mail itself is already away.
    const offer = !board && (address || toOther) && data?.pin && data.pin.city
      ? { city: String(data.pin.city), country: String(data.pin.country || ""), region: data.pin.region ? String(data.pin.region) : null, label: data.pin.label === "local" ? "local" : "traveler", image, message, place: place || preset?.place_name || "", dish, addr: address }
      : null;
    if (offer) setPinOffer(offer);
    // The next postcard starts blank.
    setImage(preset?.image || null);
    setMessage("");
    setDish("");
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
      onClick={close}
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
        <div style={{ padding: "16px 20px calc(28px + env(safe-area-inset-bottom))" }}>
          {pinOffer ? (<>
          {/* The ask (founder, 2026-10-15): the mail is away; pinning a copy on the
              city's board is a separate, asked-first choice. Default is no. */}
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.3, letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>Sent to @{pinOffer.addr} ✓</div>
          <h3 id={titleId} style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
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
          <h3 id={titleId} style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
            A postcard to {board ? <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>{board.city}</em> : <>your <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>circle</em></>}
          </h3>

          {/* the front */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={image ? "Change the photo" : "Choose the photo"}
            style={{ display: "block", width: "100%", marginTop: 12, padding: 0, overflow: "hidden", borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, aspectRatio: "3 / 2", cursor: "pointer" }}
          >
            {image ? (
              <img src={image} alt="The postcard front" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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
            placeholder="Say something about the photo…"
            aria-label="Your message"
            className="resize-none placeholder:text-[color:var(--gs-ph)]"
            style={css({ ...FIELD, display: "block", marginTop: 12, fontFamily: SERIF, fontStyle: "italic", fontSize: fs(16), lineHeight: 1.35, color: NEUTRAL.ink2, "--gs-ph": NEUTRAL.ink3 })}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value.slice(0, 80))}
              placeholder="Where (South City Kitchen)"
              aria-label="Where"
              className="placeholder:text-[color:var(--gs-ph)]"
              style={css({ ...FIELD, flex: "1 1 calc(150px * var(--fs, 1))", width: "auto", minWidth: 0, "--gs-ph": NEUTRAL.ink3 })}
            />
            <input
              value={dish}
              onChange={(e) => setDish(e.target.value.slice(0, 60))}
              placeholder="Dish (optional)"
              aria-label="Dish"
              className="placeholder:text-[color:var(--gs-ph)]"
              style={css({ ...FIELD, flex: "1 1 calc(150px * var(--fs, 1))", width: "auto", minWidth: 0, "--gs-ph": NEUTRAL.ink3 })}
            />
          </div>

          {/* the address */}
          <div id={`${titleId}-to`} style={{ ...kicker, marginTop: 16 }}>To</div>
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
          ) : fixedTo ? (
            <div style={{ marginTop: 2 }}>
              <Address on fixed>@{fixedTo}</Address>
            </div>
          ) : (
            <div role="group" aria-labelledby={`${titleId}-to`} style={{ display: "flex", flexWrap: "wrap", columnGap: 6, marginTop: 2 }}>
              <Address on={to === "" && !other} onClick={() => { setTo(""); setOther(null); setPicking(false); }}>Everyone who follows me</Address>
              {addresses.map((f) => (
                <Address key={String(f.user_id ?? f.handle)} on={!other && to === lc(f.handle)} onClick={() => { setTo(lc(f.handle)); setOther(null); setPicking(false); }}>
                  @{lc(f.handle)}
                </Address>
              ))}
              <Address on={!!other} onClick={() => setPicking((v) => !v)}>
                {other ? (other.handle ? `@${other.handle}` : other.name) : "Someone else…"}
              </Address>
            </div>
          )}
          {!board && !fixedTo && picking ? (
            <FindPeople label="Send to someone else" onPick={(p) => { setOther(p); setTo(""); setPicking(false); }}
              onPickEmail={(email) => { setOther({ email, name: email, handle: null, user_id: null }); setTo(""); setPicking(false); }} style={{ marginTop: 10 }} />
          ) : null}

          {nowhere || fixedBlocked ? (
            <p style={{ display: "flex", alignItems: "flex-start", gap: 6, margin: "8px 0 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              <Info size={14} strokeWidth={2} color={NEUTRAL.airmailBlue} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {fixedBlocked
                  ? `You blocked @${fixedTo}, so this postcard can’t be sent to them.`
                  : "No one follows you yet, so this postcard has nowhere to go. Pick someone above, or invite someone to your circle first."}
              </span>
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
