// The Sent folder (founder, 2026-10-25: "users ask me where their sent messages went"): what I
// sent, read from the worker's /mail/sent, and "Remove from Sent" (/mail/sent/hide), which hides
// an entry for me alone — the recipient keeps theirs.
//
//   sentMail(before?) → { items, next, error }
//     items  newest first; each { kind: 'postcard'|'telegram', from, ids, at, mode, to, status, … }
//            mode   one | each (private copies) | group | board | followers | email | link
//            to     [{ handle, name, opened? }] — opened only on telegrams
//            status delivered | opened | waiting | link | expired
//     next   the cursor for older entries, or null
//   hideSent(item) → { ok, error }
import { callWorker } from "@/lib/callWorker";

export async function sentMail(before = null) {
  const { data, error } = await callWorker("mail/sent", before ? { before } : {});
  return { items: Array.isArray(data?.items) ? data.items : [], next: data?.next || null, error: error || data?.error || null };
}

export async function hideSent(item) {
  const { data, error } = await callWorker("mail/sent/hide", { items: [{ from: item?.from, ids: Array.isArray(item?.ids) ? item.ids : [] }] });
  return { ok: !error && data?.ok === true, error: error || data?.error || null };
}
