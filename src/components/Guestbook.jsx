// Guestbook — public tips-for-the-next-traveler on any place (generic by entity).
// Read by anyone; signing requires sign-in. Guided prompts, edit/delete your own,
// report others (Apple 1.2). Warm notes, NOT star reviews.
import { useEffect, useState, useCallback } from "react";
import { callWorker } from "@/lib/callWorker";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";

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
      setBody(""); setComposing(false);
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
            {homeCity && (
              <label className="flex items-center gap-2 text-[calc(12.5px*var(--fs))] text-gray-600">
                <input type="checkbox" checked={showCity} onChange={(e) => setShowCity(e.target.checked)} />
                Show &ldquo;from {homeCity}&rdquo; on my note
              </label>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[calc(11px*var(--fs))] text-gray-400">{body.length}/1000 · posts publicly as {displayName}</span>
              <div className="flex gap-2">
                <button onClick={() => { setComposing(false); setBody(""); }} className="px-4 py-2 rounded-lg text-[calc(13px*var(--fs))] text-gray-600">Cancel</button>
                <button onClick={submit} disabled={busy} className="px-5 py-2 rounded-lg font-semibold text-white text-[calc(13px*var(--fs))] disabled:opacity-50" style={{ background: "#17A38F" }}>
                  {busy ? "Signing…" : "Sign"}
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
                <p className="text-[calc(14px*var(--fs))] text-gray-700 leading-relaxed mt-1">{e.body}</p>
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
    </div>
  );
}
