// Guestbook — kind notes for the next traveler on any place (generic by entity).
// Read by anyone; signing requires sign-in. Guided prompts (a tip, your favorite
// part, a shout-out, a memory), edit/delete your own, report others (Apple 1.2).
// Warm notes, NOT reviews: the worker posts kind notes right away and holds any
// note that reads as negative for an admin to read first (only its author sees
// it meanwhile, marked as waiting).
import { useEffect, useState, useCallback } from "react";
import { callWorker } from "@/lib/callWorker";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { DoodlePad } from "@/components/passport/Blotter";

const PROMPTS = [
  { key: "tip", label: "💡 Tip for visitors", hint: "One thing you wish you'd known before you came…" },
  { key: "favorite", label: "❤️ Favorite part", hint: "What did you love most about it?" },
  { key: "musttry", label: "⭐ Don't miss", hint: "The one thing every visitor should see or do…" },
  { key: "shoutout", label: "🙌 Shout-out", hint: "Thank someone who made your visit special…" },
  { key: "story", label: "✍️ My memory", hint: "A moment from your visit you'll remember…" },
];
const PROMPT_LABEL = { ...Object.fromEntries(PROMPTS.map((p) => [p.key, p.label])), doodle: "✍️ Doodle" };

const HELD_TOAST = "Thank you! Our team takes a quick look before it posts 💛";
// The worker's age gate answers 428 { error: "age_required", message }.
const errText = (data, error) => (data?.error === "age_required" ? (data.message || "Add your birth year in Settings to sign guestbooks.") : error);

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

export default function Guestbook({ entityType = "place", entityId, entityName, onCount, startComposing = false }) {
  const { user, profile, isAuthenticated } = useAuth();
  const [entries, setEntries] = useState([]);
  const publicCount = entries.filter((e) => !e.review_status || e.review_status === "ok").length;
  useEffect(() => { onCount?.(publicCount); }, [publicCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(startComposing);
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
    });
    setDoodleBusy(false);
    if (error) { showToast(errText(data, error), "error"); return; }
    if (data?.entry) {
      setEntries((prev) => [{ ...data.entry, review_status: data.held ? "held" : "ok" }, ...prev]);
      setPad(false); resetCompose();
      showToast(data.held ? HELD_TOAST : "Doodle signed in ✍️", "success");
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
    });
    setBusy(false);
    if (error) { showToast(errText(data, error), "error"); return; }
    if (data?.entry) {
      setEntries((prev) => [{ ...data.entry, review_status: data.held ? "held" : "ok" }, ...prev]);
      resetCompose();
      showToast(data.held ? HELD_TOAST : "Thank you for helping the next visitor 💛", "success");
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

  return (
    <div className="space-y-3">
      {/* Sign CTA */}
      {isAuthenticated ? (
        !composing ? (
          <div className="flex gap-2">
            <button
              onClick={() => setComposing(true)}
              className="flex-1 py-3 rounded-xl font-semibold text-white text-[calc(15px*var(--fs))]"
              style={{ background: "linear-gradient(90deg,#667eea,#764ba2)" }}
            >✍️ Sign the guestbook</button>
            {/* Every guestbook takes a doodle too (founder, 2026-10-03). */}
            <button
              onClick={() => setPad(true)} disabled={doodleBusy}
              className="flex-none px-4 py-3 rounded-xl font-semibold text-[calc(15px*var(--fs))] border border-purple-300 bg-white text-purple-700 disabled:opacity-60"
            >{doodleBusy ? "Posting…" : "🎨 Doodle"}</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
            {/* Header with an always-visible exit — so you can back out of writing
                even while the keyboard covers the Cancel button below. */}
            <div className="flex items-center justify-between">
              <span className="text-[calc(13.5px*var(--fs))] font-bold text-gray-800">Leave a kind note</span>
              <button
                onClick={resetCompose}
                aria-label="Close"
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-[calc(18px*var(--fs))] leading-none"
              >✕</button>
            </div>
            <p className="text-[calc(13px*var(--fs))] text-gray-600 leading-snug -mt-1">
              Help future visitors — share a tip, or tell us your favorite part{entityName ? ` of ${entityName}` : ""} 💛
            </p>
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
              Kind notes post right away; if a note sounds like a complaint, our team reads it first.
              Notes &amp; doodles post publicly. By posting you grant Globeskimmers a license to display them.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[calc(11px*var(--fs))] text-gray-400">{body.length}/1000 · posts publicly as {displayName}</span>
              <div className="flex gap-2">
                <button onClick={resetCompose} className="px-4 py-2 rounded-lg text-[calc(13px*var(--fs))] text-gray-600">Cancel</button>
                <button onClick={submit} disabled={busy} className="px-5 py-2 rounded-lg font-semibold text-white text-[calc(13px*var(--fs))] disabled:opacity-50" style={{ background: "#17A38F" }}>
                  {busy ? "Signing…" : "Sign"}
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl shadow-md p-5 text-center text-[calc(14px*var(--fs))] text-gray-600">
          Sign in to leave a tip or your favorite part for the next traveler.
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="text-center text-gray-400 text-[calc(13px*var(--fs))] py-6">Loading notes…</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-[calc(15px*var(--fs))] text-gray-600">No notes yet — be the first to share a tip or your favorite part{entityName ? ` of ${entityName}` : ""} 💛</p>
        </div>
      ) : (
        entries.map((e) => {
          const mine = !!e.mine || (!!user && e.user_id === user.id);
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
              {mine && e.review_status === "held" && (
                <p className="mt-1 mb-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[calc(11.5px*var(--fs))] text-amber-900">
                  ⏳ Waiting for a quick look from our team — only you can see this for now.
                </p>
              )}
              {mine && e.review_status === "rejected" && (
                <p className="mt-1 mb-1 rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1.5 text-[calc(11.5px*var(--fs))] text-gray-600">
                  Our team kept this note private — only you can see it. You can edit or delete it.
                </p>
              )}
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
      {pad && (
        <DoodlePad busy={doodleBusy} onClose={() => setPad(false)} onPost={postDoodle}
          title="Sign the guestbook" eyebrow={entityName ? `Guestbook · ${entityName}` : "Guestbook"}
          note="Draw your name, a little art, or a hello for the next visitor." />
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
