// SendToField — the "Send to" bar of the postcard and telegram composers (founder, 2026-10-24:
// "for telegram and post card, remove pre placed names at send to:, just put a send to blank space
// bar. i love @handle suggestions … username or registered email or like their login email is
// what I meant would be a good way to send to"). One blank bar, nothing pre-filled: type a
// @username or the email someone logs in with, and suggestions drop under it (the worker's
// /social/find, the same search as Find people: a whole email finds the member who signed up with
// it, unless they turned "find me by email" off; a name works too). A tap adds that person as a
// chip inside the bar. × on a chip, or backspace on an empty bar, takes one off. Enter adds a
// typed @username as it stands (the worker checks it at send) or, on a postcard, a typed email
// address nobody shows up for (the card goes to that address: a member gets it in their Mailbox,
// anyone else one email to join — the sender is told the same either way).
//
//   <SendToField value onChange max dark allowEmail needHandle blocked label />
//   value       [{ key, user_id?, handle?, name?, email? }] — who it's for, in order
//   max         how many at most (the worker's cap)
//   dark        the telegraph office's brass-on-dark; otherwise airmail on white
//   allowEmail  an email address may be an address (postcards)
//   needHandle  only people with a @username can be added (telegrams go by @username)
//   blocked     handles or user ids never offered
import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { findPeople } from "@/lib/passport";
import { classify } from "@/components/social/FindPeople";
import { Face } from "@/components/social/SocialMarks";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const HANDLE = /^[a-z0-9._]{2,30}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const lc = (v) => String(v ?? "").trim().replace(/^@+/, "").toLowerCase();
const BRASS = "#C9A35A";

// The two looks: the telegraph office (dark) and the airmail sheet (light).
const LOOK = {
  dark: { bar: "rgba(0,0,0,.18)", line: "rgba(201,163,90,.45)", text: "#FBF3E2", hint: "#CBB994", chip: BRASS, chipInk: "#231C15", list: "#2C241B", listLine: "rgba(201,163,90,.3)", name: "#FBF3E2", sub: "#CBB994", label: BRASS },
  light: { bar: NEUTRAL.white, line: NEUTRAL.airmailLine, text: NEUTRAL.ink, hint: NEUTRAL.ink3, chip: NEUTRAL.airmailBlue, chipInk: NEUTRAL.white, list: NEUTRAL.white, listLine: NEUTRAL.airmailLine, name: NEUTRAL.ink, sub: NEUTRAL.ink3, label: NEUTRAL.ink3 },
};

export const chipLabel = (p) => (p.handle ? `@${p.handle}` : p.email || p.name || "someone");

export default function SendToField({ value = [], onChange, max = 10, dark = false, allowEmail = false, needHandle = false, blocked = undefined, label = "Send to" }) {
  const look = dark ? LOOK.dark : LOOK.light;
  const inputId = `sendto-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const inputRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(/** @type {any[]|null} */ (null));
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const list = Array.isArray(value) ? value : [];
  const full = list.length >= max;
  const what = classify(q);
  const blockedSet = new Set((blocked instanceof Set ? [...blocked] : Array.isArray(blocked) ? blocked : []).map((b) => lc(typeof b === "object" ? b?.handle ?? b?.user_id : b)));
  const chosen = new Set(list.flatMap((p) => [p.user_id, p.handle, p.email].filter(Boolean).map(lc)));

  // Suggestions 300 ms after the last keystroke, once there's enough to search.
  useEffect(() => {
    if (!what.ready || full) { setRows(null); setBusy(false); return undefined; }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const res = await findPeople(q.trim());
      if (my !== seq.current) return;
      setBusy(false);
      setRows(res.error ? [] : res.people);
    }, 300);
    return () => clearTimeout(t);
  }, [q, what.ready, full]);   // eslint-disable-line react-hooks/exhaustive-deps

  const offer = (rows || []).filter((p) => p && p.user_id && !chosen.has(lc(p.user_id)) && !(p.handle && chosen.has(lc(p.handle)))
    && !blockedSet.has(lc(p.user_id)) && !(p.handle && blockedSet.has(lc(p.handle))) && (!needHandle || p.handle)).slice(0, 6);
  const typedHandle = lc(q);
  const typedEmail = q.trim().toLowerCase();
  const canTypeHandle = /^@/.test(q.trim()) && HANDLE.test(typedHandle) && !chosen.has(typedHandle) && !offer.some((p) => lc(p.handle) === typedHandle);
  const canTypeEmail = allowEmail && EMAIL.test(typedEmail) && !chosen.has(typedEmail) && !offer.length && Array.isArray(rows) && !busy;

  const add = (p) => {
    if (full || typeof onChange !== "function") return;
    onChange([...list, { key: p.user_id || p.handle || p.email, ...p }]);
    setQ("");
    setRows(null);
    inputRef.current?.focus();
  };
  const remove = (key) => onChange?.(list.filter((p) => p.key !== key));
  const onKey = (e) => {
    if (e.key === "Backspace" && !q && list.length) { e.preventDefault(); remove(list[list.length - 1].key); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (offer.length) add({ user_id: offer[0].user_id, handle: offer[0].handle || null, name: offer[0].name || null });
    else if (canTypeHandle) add({ handle: typedHandle });
    else if (canTypeEmail) add({ email: typedEmail });
  };

  const hint = full ? `${max} people at most`
    : !q.trim() && !list.length ? "Their @username, or the email they log in with"
    : what.kind === "email" && !what.ready ? "Type the whole email address"
      : what.kind === "name" && q.trim() && !what.ready ? "Type at least 3 letters"
        : what.kind === "handle" && !what.ready ? "Type at least 2 letters of their @username"
          : null;

  return (
    <div style={{ marginTop: 6 }}>
      <label htmlFor={inputId} style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.3, fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: look.label }}>{label}</label>
      {/* The bar: chips, then the blank. A tap anywhere on it puts the cursor in the blank. */}
      <div onClick={() => inputRef.current?.focus()}
        style={{ marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 48, boxSizing: "border-box", padding: "6px 10px", borderRadius: 14, border: `1px solid ${look.line}`, background: look.bar, cursor: "text" }}>
        {list.map((p) => (
          <span key={p.key} style={{ display: "inline-flex", alignItems: "center", gap: 2, maxWidth: "100%", minHeight: 32, padding: "0 4px 0 10px", borderRadius: 999, background: look.chip, color: look.chipInk, fontFamily: p.handle ? MONO : "inherit", fontSize: fs(12.5), fontWeight: 600 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chipLabel(p)}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(p.key); }} aria-label={`Remove ${chipLabel(p)}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, padding: 0, border: 0, borderRadius: 999, background: "transparent", color: look.chipInk, cursor: "pointer" }}>
              <X size={14} strokeWidth={2.4} aria-hidden="true" focusable="false" />
            </button>
          </span>
        ))}
        <input ref={inputRef} id={inputId} type="text" value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} onKeyDown={onKey} disabled={full}
          placeholder={list.length ? (full ? "" : "Add someone else") : "@username or email"}
          autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="done"
          aria-describedby={`${inputId}-hint`} className="placeholder:text-[color:var(--st-ph)]"
          style={/** @type {any} */ ({ flex: "1 1 120px", minWidth: 120, minHeight: 36, padding: "0 4px", border: 0, outline: "none", background: "transparent", fontFamily: "inherit", fontSize: fs(15), color: look.text, "--st-ph": look.hint })} />
        {busy ? <Loader2 size={16} strokeWidth={2} color={look.hint} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : null}
      </div>
      {hint ? <p id={`${inputId}-hint`} style={{ margin: "6px 2px 0", fontSize: fs(11.5), lineHeight: 1.4, color: look.hint }}>{hint}</p> : <span id={`${inputId}-hint`} hidden />}

      {/* The suggestions, under the bar. */}
      {q.trim() && (offer.length || canTypeHandle || canTypeEmail || (Array.isArray(rows) && !busy)) ? (
        <ul role="listbox" aria-label="Suggestions" style={{ listStyle: "none", margin: "6px 0 0", padding: "2px 0", borderRadius: 14, border: `1px solid ${look.listLine}`, background: look.list }}>
          {offer.map((p) => (
            <li key={p.user_id} role="option" aria-selected="false">
              <button type="button" onClick={() => add({ user_id: p.user_id, handle: p.handle || null, name: p.name || null })}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 52, padding: "6px 12px", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>
                <Face name={p.name} handle={p.handle || ""} avatar={p.avatar} cloth={p.cloth} size={32} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: fs(14), fontWeight: 600, color: look.name, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.handle ? `@${p.handle}` : p.name}</span>
                  <span style={{ display: "block", fontSize: fs(12), color: look.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.handle ? p.name : "no @username yet"}</span>
                </span>
              </button>
            </li>
          ))}
          {canTypeHandle ? (
            <li role="option" aria-selected="false">
              <button type="button" onClick={() => add({ handle: typedHandle })}
                style={{ display: "flex", alignItems: "center", width: "100%", minHeight: 48, padding: "6px 14px", border: 0, background: "transparent", textAlign: "left", fontFamily: MONO, fontSize: fs(13.5), color: look.name, cursor: "pointer" }}>
                Send to @{typedHandle}
              </button>
            </li>
          ) : null}
          {canTypeEmail ? (
            <li role="option" aria-selected="false">
              <button type="button" onClick={() => add({ email: typedEmail })}
                style={{ display: "block", width: "100%", minHeight: 48, padding: "8px 14px", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>
                <span style={{ display: "block", fontSize: fs(14), fontWeight: 600, color: look.name }}>Send to {typedEmail}</span>
                <span style={{ display: "block", fontSize: fs(12), lineHeight: 1.4, color: look.sub }}>It goes to whoever logs in with that email. Not on GlobeSkimmers yet? They get one email, and the card opens when they join.</span>
              </button>
            </li>
          ) : null}
          {!offer.length && !canTypeHandle && !canTypeEmail ? (
            <li style={{ padding: "12px 14px", fontSize: fs(13), lineHeight: 1.45, color: look.sub }}>
              {what.kind === "email" ? "No member found with that email. They may have turned off “find me by email.”" : "No one by that @username. Try the email they log in with."}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
