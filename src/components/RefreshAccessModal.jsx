import React, { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ADMIN_EMAILS } from "@/lib/admins";

// Admin-only modal to manage who sees the global refresh button. Reads/writes the
// Supabase `refresh_access` table (RLS lets only admins write). Admins always
// have refresh access and are shown for reference but can't be removed here.
export default function RefreshAccessModal({ isOpen, onClose }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: e } = await supabase.from("refresh_access").select("email").order("email");
      if (e) throw e;
      setEmails((data || []).map((r) => r.email));
    } catch (e) {
      setError(e?.message || "Could not load the list.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  if (!isOpen) return null;

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { setError("Enter a valid email address."); return; }
    if (emails.includes(email) || ADMIN_EMAILS.includes(email)) { setError("That email already has access."); return; }
    setBusy(true); setError("");
    try {
      const { error: e } = await supabase.from("refresh_access").insert({ email });
      if (e) throw e;
      setNewEmail("");
      await load();
    } catch (e) { setError(e?.message || "Could not add (admins only)."); }
    setBusy(false);
  };

  const removeEmail = async (email) => {
    setBusy(true); setError("");
    try {
      const { error: e } = await supabase.from("refresh_access").delete().eq("email", email);
      if (e) throw e;
      await load();
    } catch (e) { setError(e?.message || "Could not remove."); }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 20, padding: 20, maxHeight: "82vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-indigo-600" /> Refresh Access</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">These users get the refresh button in the nav. Changes apply on their next sign-in. (Admins always have it.)</p>

        <div className="flex gap-2 mb-2">
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addEmail(); }} placeholder="email@example.com" autoCapitalize="none" className="flex-1 h-11 px-3 rounded-xl border border-gray-300 outline-none text-gray-900" />
          <button onClick={addEmail} disabled={busy} className="h-11 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold flex items-center gap-1 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add</button>
        </div>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mt-4 mb-1">Admins (always)</p>
        <div className="space-y-1 mb-3">
          {ADMIN_EMAILS.map((e) => (<div key={e} className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-lg">{e}</div>))}
        </div>

        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Granted</p>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : emails.length === 0 ? (
          <p className="text-sm text-gray-400 px-3 py-2">No granted users yet.</p>
        ) : (
          <div className="space-y-1">
            {emails.map((e) => (
              <div key={e} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-800 break-all">{e}</span>
                <button onClick={() => removeEmail(e)} disabled={busy} aria-label={`Remove ${e}`} className="text-red-500 disabled:opacity-50 flex-none ml-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
