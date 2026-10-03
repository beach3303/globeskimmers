// Guestbook — public tips-for-the-next-traveler on any place (generic by entity).
// Read by anyone; signing requires sign-in. Guided prompts, edit/delete your own,
// report others (Apple 1.2). Optional ONE crowdsourced photo per note (food / drink /
// place) — resized client-side, moderated + stored server-side. Warm notes, NOT reviews.
import { useEffect, useState, useCallback } from "react";
import { callWorker } from "@/lib/callWorker";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { DoodlePad } from "@/components/passport/Blotter";

const PROMPTS = [
  { key: "tip", label: "💡 Skimmer Tip", hint: "One thing to know before you go…" },
  { key: "musttry", label: "⭐ Must-Try", hint: "The one thing to do / order here…" },
  { key: "shoutout", label: "🙌 Shout-out", hint: "Thank the team or a person…" },
  { key: "story", label: "✍️ My Story", hint: "A memory from your visit…" },
];
const PROMPT_LABEL = Object.fromEntries(PROMPTS.map((p) => [p.key, p.label]));

function timeAgo(iso) {
  try {
    const d = new Date(iso), now = new Date();
    const days = Math.floor((now - d) / 86400000);
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

export default function Guestbook({ entityType = "place", entityId, entityName }) {
  const { user, profile, isAuthenticated } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [prompt, setPrompt] = useState("tip");
  const [body, setBody] = useState("");
  const [showCity, setShowCity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [pad, setPad] = useState(false);                   // the finger-doodle sheet
  const [doodleBusy, setDoodleBusy] = useState(false);
  const [openDoodle, setOpenDoodle] = useState(null);      // entry id expanded full-width
  const [lightbox, setLightbox] = useState(null);          // full-size photo url

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    const { data } = await callWorker("guestbook/list", { entity_id: String(entityId) });
    setEntries(Array.isArray(data?.entries) ? data.entries : []);
    setLoading(false);
  }, [entityId]);

  useEffect(() => { load(); }, [load]);

  const displayName = profile?.first_name || "A traveler";
  const homeCity = profile?.home_city || null;

  const resetCompose = () => {
    setComposing(false); setBody("");
    setPhotoPreview(null); setPhotoData(null); setUploadingPhoto(false);
  };

  const postDoodle = async (dataUrl) => {
    setDoodleBusy(true);
    const up = await callWorker("guestbook/photo-upload", { entity_id: String(entityId), image: dataUrl, doodle: true });
    if (up.error || !up.data?.key) { setDoodleBusy(false); showToast(up.error || "That drawing couldn't be posted", "error"); return; }
    const { data, error } = await callWorker("guestbook/sign", {
      entity_type: entityType, entity_id: String(entityId), entity_name: entityName,
      display_name: displayName, home_city: showCity ? homeCity : null,
      prompt_type: "doodle", is_doodle: true,
      photo_key: up.data.key, photo_url: up.data.url,
      body: body.trim() || undefined,
    });
    setDoodleBusy(false);
    if (error) { showToast(error, "error"); return; }
    if (data?.entry) { setEntries((prev) => [data.entry, ...prev]); setPad(false); resetCompose(); showToast("Doodle signed in ✍️", "success"); }
  };

  
  const submit = async () => {
    const text = body.trim();
    if (text.length < 2) { showToast("Write a short note first", "error"); return; }
    setBusy(true);
    const { data, error } = await callWorker("guestbook/sign", {
      entity_type: entityType, entity_id: String(entityId), entity_name: entityName,
      display_name: displayName, home_city: showCity ? homeCity : null,
      prompt_type: prompt, body: text,
    });
    setBusy(false);
    if (error) { showToast(error, "error"); return; }
    if (data?.entry) {
      setEntries((prev) => [data.entry, ...prev]);
      resetCompose();
      showToast("Thanks for signing the guestbook! ✍️", "success");
    }
  };

  const saveEdit = async (id) => {
    const text = editBody.trim();
    if (!text) return;
    setBusy(true);
    const { data, error } = await callWorker("guestbook/edit", { id, body: text });
    setBusy(false);
    if (error) { showToast(error, "error"); return; }
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, body: text, edited_at: data?.entry?.edited_at } : e)));
    setEditId(null);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete your note?")) return;
    const { error } = await callWorker("guestbook/delete", { id });
    if (error) { showToast(error, "error"); return; }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const report = async (id) => {
    if (!window.confirm("Report this note for review?")) return;
    await callWorker("guestbook/report", { id });
    showToast("Thanks — we'll review it.", "success");
  };

  return (
    <div className="space-y-3">
      {/* Sign CTA */}
      {isAuthenticated ? (
        !composing ? (
          <button
            onClick={() => setComposing(true)}
            className="w-full py-3 rounded-xl font-semibold text-white text-[calc(15px*var(--fs))]"
            style={{ background: "linear-gradient(90deg,#667eea,#764ba2)" }}
          >✍️ Sign our Guestbook</button>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
            {/* Header with an always-visible exit — so you can back out of writing
                even while the keyboard covers the Cancel button below. */}
            <div className="flex items-center justify-between">
              <span className="text-[calc(13.5px*var(--fs))] font-bold text-gray-800">Leave a note</span>
              <button
                onClick={resetCompose}
                aria-label="Close"
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-[calc(18px*var(--fs))] leading-none"
              >✕</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPrompt(p.key)}
                  className={`px-3 py-1.5 rounded-full text-[calc(12.5px*var(--fs))] font-semibold border ${
                    prompt === p.key ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-700 border-gray-300"
                  }`}
                >{p.label}</button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={PROMPTS.find((p) => p.key === prompt)?.hint || "Leave a tip…"}
              className="w-full p-3 rounded-lg border border-gray-300 text-[calc(14px*var(--fs))] resize-none focus:outline-none focus:border-purple-500"
            />

            {/* Doodles instead of photos (founder, 2026-10-02): draw with a
                finger — a note, both, or the doodle alone. Photos belong in
                your own albums, postcards and the city collection. */}
            <button type="button" onClick={() => setPad(true)} disabled={doodleBusy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-[calc(12.5px*var(--fs))] text-gray-600 hover:border-purple-400">
              ✍️ {doodleBusy ? "Posting your doodle…" : "Doodle with your finger instead"}
            </button>

            {homeCity && (
              <label className="flex items-center gap-2 text-[calc(12.5px*var(--fs))] text-gray-600">
                <input type="checkbox" checked={showCity} onChange={(e) => setShowCity(e.target.checked)} />
                Show &ldquo;from {homeCity}&rdquo; on my note
              </label>
            )}
            <p className="text-[calc(10.5px*var(--fs))] text-gray-400 leading-snug">
              Notes &amp; doodles post publicly. By posting you grant Globeskimmers a license to display them.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[calc(11px*var(--fs))] text-gray-400">{body.length}/1000 · posts publicly as {displayName}</span>
              <div className="flex gap-2">
                <button onClick={resetCompose} className="px-4 py-2 rounded-lg text-[calc(13px*var(--fs))] text-gray-600">Cancel</button>
                <button onClick={submit} disabled={busy || uploadingPhoto} className="px-5 py-2 rounded-lg font-semibold text-white text-[calc(13px*var(--fs))] disabled:opacity-50" style={{ background: "#17A38F" }}>
                  {busy ? "Signing…" : uploadingPhoto ? "Photo…" : "Sign"}
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl shadow-md p-5 text-center text-[calc(14px*var(--fs))] text-gray-600">
          Sign in to leave a tip for the next traveler.
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="text-center text-gray-400 text-[calc(13px*var(--fs))] py-6">Loading notes…</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-[calc(15px*var(--fs))] text-gray-600">No notes yet — be the first to sign {entityName ? `${entityName}'s` : "this"} guestbook.</p>
        </div>
      ) : (
        entries.map((e) => {
          const mine = user && e.user_id === user.id;
          return (
            <div key={e.id} className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-[calc(13px*var(--fs))] flex-shrink-0">
                    {(e.display_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[calc(14px*var(--fs))] text-gray-900 truncate">
                      {e.display_name}{e.home_city ? <span className="font-normal text-gray-500"> from {e.home_city}</span> : null}
                    </p>
                    <p className="text-[calc(11px*var(--fs))] text-gray-400">
                      {PROMPT_LABEL[e.prompt_type] || "💡 Tip"} · {timeAgo(e.created_at)}{e.edited_at ? " · edited" : ""}{e.verified_visit ? " · ✓ visited" : ""}
                    </p>
                  </div>
                </div>
              </div>
              {editId === e.id ? (
                <div className="mt-2">
                  <textarea value={editBody} onChange={(ev) => setEditBody(ev.target.value)} rows={3} maxLength={1000}
                    className="w-full p-2 rounded-lg border border-gray-300 text-[calc(14px*var(--fs))] resize-none" />
                  <div className="flex gap-2 justify-end mt-1">
                    <button onClick={() => setEditId(null)} className="px-3 py-1 text-[calc(12px*var(--fs))] text-gray-500">Cancel</button>
                    <button onClick={() => saveEdit(e.id)} disabled={busy} className="px-3 py-1 rounded-lg text-white text-[calc(12px*var(--fs))]" style={{ background: "#17A38F" }}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[calc(14px*var(--fs))] text-gray-700 leading-relaxed mt-1">{e.body}</p>
                  {e.photo_url && e.is_doodle && (
                    <button type="button" onClick={() => setOpenDoodle(openDoodle === e.id ? null : e.id)}
                      aria-label={openDoodle === e.id ? "Shrink the doodle" : "Enlarge the doodle"}
                      className="mt-2 block rounded-lg border border-amber-200 bg-[#FFFDF6] overflow-hidden transition-all"
                      style={{ width: openDoodle === e.id ? "100%" : 112 }}>
                      <img src={e.photo_url} alt={`A doodle by ${e.display_name}`} loading="lazy"
                        className="w-full object-contain" style={{ maxHeight: openDoodle === e.id ? 360 : 84 }} />
                      <span className="block text-[calc(10px*var(--fs))] text-gray-400 py-0.5">
                        {openDoodle === e.id ? "tap to shrink" : "tap to enlarge"}
                      </span>
                    </button>
                  )}
                  {e.photo_url && !e.is_doodle && (
                    <img
                      src={e.photo_url} alt="" loading="lazy"
                      onClick={() => setLightbox(e.photo_url)}
                      className="mt-2 rounded-lg w-full max-h-72 object-cover border border-gray-100 cursor-zoom-in"
                    />
                  )}
                </>
              )}
              <div className="flex gap-4 mt-2 text-[calc(11.5px*var(--fs))]">
                {mine ? (
                  <>
                    <button onClick={() => { setEditId(e.id); setEditBody(e.body); }} className="text-gray-500 hover:text-purple-600">Edit</button>
                    <button onClick={() => remove(e.id)} className="text-gray-500 hover:text-red-600">Delete</button>
                  </>
                ) : (
                  <button onClick={() => report(e.id)} className="text-gray-400 hover:text-red-600">Report</button>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Lightbox */}
      {pad && <DoodlePad busy={doodleBusy} onClose={() => setPad(false)} onPost={postDoodle} />}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
