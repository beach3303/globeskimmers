// BlockedTravelers: the people you've blocked, each with Unblock (go-live
// decision 6, 2026-10-13). It lives in Settings → Privacy, which shows it
// only when the worker advertises block_v2. Unblock asks once and says what
// it does and doesn't undo: the follows a block ended don't come back.
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import OfficialSeal from "@/components/passport/OfficialSeal";
import { unblockTraveler } from "@/lib/passport";
import { travelerLabel } from "@/lib/blocks";

const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const STAMP = "#B0472F", SOFT = "#F6F0E4";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// blocked: social/follow op:'list' blocked[] ({ user_id, handle, name, verified, seal }).
// onChanged(): reload the list after an unblock.
export default function BlockedTravelers({ blocked, onChanged }) {
  const [asking, setAsking] = useState(null); // user_id whose Unblock is being confirmed
  const [busy, setBusy] = useState(null);     // user_id being unblocked
  const [err, setErr] = useState(null);
  const people = Array.isArray(blocked) ? blocked.filter((p) => p?.user_id) : [];

  const unblock = async (p) => {
    if (busy) return;
    setBusy(p.user_id); setErr(null);
    const { ok, error } = await unblockTraveler(p.user_id);
    setBusy(null);
    if (!ok) { setErr(error); return; }
    setAsking(null);
    showToast(`${travelerLabel(p)} is unblocked`, "success");
    onChanged?.();
  };

  if (!people.length) {
    return <p style={{ fontSize: fs(13), color: INK3, lineHeight: 1.45 }}>No one. Anyone you block from the Mailbox or a shared passport is listed here.</p>;
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${RULE}`, background: "#fff" }}>
      <ul aria-label="Blocked travelers">
        {people.map((p, i) => {
          const name = travelerLabel(p);
          const open = asking === p.user_id;
          return (
            <li key={p.user_id} className="px-3 py-2" style={{ borderTop: i ? `1px solid ${RULE}` : "none" }}>
              <div className="flex items-center gap-2" style={{ minHeight: 44 }}>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-semibold" style={{ fontSize: fs(14), color: INK }}>
                    {name}{p.verified ? <OfficialSeal size={12} tier={p.seal || "burgundy"} /> : null}
                  </span>
                  {p.name && p.handle && <span className="block truncate" style={{ fontSize: fs(12), color: INK3 }}>@{p.handle}</span>}
                </span>
                {!open && (
                  <button type="button" onClick={() => { setAsking(p.user_id); setErr(null); }} aria-label={`Unblock ${name}`}
                    className="flex-none rounded-xl px-3.5 font-semibold" style={{ minHeight: 44, background: SOFT, color: INK2, fontSize: fs(13) }}>
                    Unblock
                  </button>
                )}
              </div>
              {open && (
                <div role="group" aria-label={`Unblock ${name}?`} className="mt-1 mb-1">
                  <p style={{ fontSize: fs(12.5), color: INK2, lineHeight: 1.45 }}>
                    Unblock {name}? They&rsquo;ll be able to follow you and send you postcards again. The follows the block ended don&rsquo;t come back on their own.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => setAsking(null)} disabled={busy === p.user_id}
                      className="flex-1 rounded-xl font-semibold" style={{ minHeight: 44, background: SOFT, color: INK2, fontSize: fs(13) }}>Keep blocked</button>
                    <button type="button" onClick={() => unblock(p)} disabled={busy === p.user_id}
                      className="flex-1 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ minHeight: 44, background: INK, color: "#fff", fontSize: fs(13) }}>
                      {busy === p.user_id && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}Unblock
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {err && <p role="alert" className="px-3 pb-2" style={{ fontSize: fs(12.5), color: STAMP }}>{err}</p>}
    </div>
  );
}
