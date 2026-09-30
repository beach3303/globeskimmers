// PostcardCompose — write and send a postcard (founder concept: sent, not
// posted). One sheet: the photo (picked file, resized client-side), the
// message, the place line, optional dish lines for food cards, and the
// address — a follower's @handle or everyone who follows you. The worker
// moderates the photo at send, fail-closed.
import React, { useRef, useState } from "react";
import { Loader2, ImagePlus } from "lucide-react";
import { showToast } from "@/components/Toast";
import { resizePhoto } from "@/lib/resizePhoto";
import { sendPostcard } from "@/lib/passport";
import { useDismissable } from "@/lib/dismissStack";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const TEAL = "#0E7C86", IVORY = "#FFFCF7", SOFT = "#F6F0E4";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

export default function PostcardCompose({ open, onClose, onSent, following = [], preset }) {
  const fileRef = useRef(null);
  const [image, setImage] = useState(preset?.image || null);
  const [message, setMessage] = useState("");
  const [place, setPlace] = useState(preset?.place_name || "");
  const [dish, setDish] = useState("");
  const [to, setTo] = useState("");           // '' = everyone who follows me
  const [busy, setBusy] = useState(false);
  useDismissable(open, onClose);
  if (!open) return null;

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setImage(await resizePhoto(f)); } catch (err) { showToast(err?.message || "Couldn't read that photo", "error"); }
  };

  const send = async () => {
    if (!image) { showToast("A postcard needs its photo", "error"); return; }
    setBusy(true);
    const { error } = await sendPostcard({
      image, message,
      place_name: place || preset?.place_name, city: preset?.city, country: preset?.country,
      meta: dish ? { dish } : undefined,
      to_handle: to || undefined,
    });
    setBusy(false);
    if (error === "age_required") { showToast("Set your birth year in Settings first (one time)", "error"); return; }
    if (error) { showToast(error, "error"); return; }
    showToast(to ? `Postcard sent to @${to} ✉️` : "Postcard sent to your followers ✉️", "success");
    onSent?.(); onClose();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Send a postcard"
      style={{ background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[22px] p-5 pb-8 max-h-[88vh] overflow-y-auto" style={{ background: IVORY }} onClick={(e) => e.stopPropagation()}>
        <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#B0472F" }}>Globeskimmers mail</div>
        <h3 style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, lineHeight: 1.1, marginTop: 2 }}>Send a postcard</h3>

        {/* the front */}
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full mt-3 rounded-[14px] overflow-hidden"
          style={{ border: `1px solid ${RULE}`, background: "#fff", aspectRatio: "3 / 2" }} aria-label={image ? "Change the photo" : "Choose the photo"}>
          {image ? (
            <img src={image} alt="The postcard front" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <span className="flex flex-col items-center justify-center h-full gap-2" style={{ color: INK3 }}>
              <ImagePlus size={22} />
              <span style={{ fontSize: fs(12.5) }}>The photo goes on the front</span>
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />

        {/* the back */}
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 240))} rows={2}
          placeholder="Best shrimp & grits of my life — Southern cooking is no joke."
          aria-label="Your message"
          className="w-full mt-3 rounded-xl px-3 py-2 outline-none resize-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontFamily: SERIF, fontStyle: "italic", fontSize: fs(16), color: INK2 }} />
        <div className="flex gap-2 mt-2">
          <input value={place} onChange={(e) => setPlace(e.target.value.slice(0, 80))} placeholder="Where (South City Kitchen)" aria-label="Where"
            className="flex-1 rounded-xl px-3 py-2.5 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13) }} />
          <input value={dish} onChange={(e) => setDish(e.target.value.slice(0, 60))} placeholder="Dish (optional)" aria-label="Dish"
            className="flex-1 rounded-xl px-3 py-2.5 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13) }} />
        </div>

        {/* the address */}
        <div className="uppercase mt-4" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".16em", color: INK3 }}>To</div>
        <div className="flex gap-1.5 flex-wrap mt-1.5">
          <button type="button" onClick={() => setTo("")} className="rounded-full px-3 py-1.5"
            style={{ background: to === "" ? TEAL : SOFT, color: to === "" ? "#fff" : INK2, border: `1px solid ${to === "" ? TEAL : RULE}`, fontSize: fs(12), fontWeight: 600 }}>
            Everyone who follows me
          </button>
          {following.filter((f) => f.handle && f.status === "accepted").slice(0, 12).map((f) => (
            <button key={f.user_id} type="button" onClick={() => setTo(f.handle)} className="rounded-full px-3 py-1.5"
              style={{ background: to === f.handle ? TEAL : SOFT, color: to === f.handle ? "#fff" : INK2, border: `1px solid ${to === f.handle ? TEAL : RULE}`, fontSize: fs(12), fontWeight: 600 }}>
              @{f.handle}
            </button>
          ))}
        </div>

        <button type="button" onClick={send} disabled={busy || !image} className="w-full rounded-[14px] py-3 font-semibold mt-4 disabled:opacity-60"
          style={{ background: TEAL, color: "#fff", fontSize: fs(14.5) }}>
          {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Sending…</span> : "Send it ✉️"}
        </button>
        <p style={{ fontFamily: MONO, fontSize: fs(9.5), color: INK3, marginTop: 8, letterSpacing: ".04em", textAlign: "center" }}>
          PHOTOS ARE REVIEWED BEFORE THEY TRAVEL · NO LOCATIONS RIDE ALONG
        </p>
      </div>
    </div>
  );
}
