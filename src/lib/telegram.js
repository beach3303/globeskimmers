// telegram — words by wire, no photo (founder, 2026-10-19). The same rules as the worker's
// tgClean / tgWordCount, so what the blank shows is what arrives: capitals, letters, digits and
// plain punctuation (kept as typed) and emoji; links don't go by wire. Four
// words at most (founder, 2026-10-19: "spike curiosity"; three at first, then four); punctuation doesn't count, an emoji counts as
// one word (3️⃣ is one), and a word past 15 letters counts as two, the old telegraph rule.
//
//   telegramText(raw)          the wire text, e.g. "Safe in Manila. Miss you!" → "SAFE IN MANILA. MISS YOU!"
//   telegramWords(text)        how many words count (punctuation doesn't)
//   sendTelegram({ to_handles, mode, reply_to, reply_all, body }) → { data: { count, not_ready }, error }
//                              mode 'each' (private copies) | 'group' (one telegram naming everyone)
//   openTelegram(id)           the recipient breaks the seal; RECEIVED is stamped → { receivedAt, error }
//   deleteTelegram(id)         the recipient takes it out of their Mailbox → { ok, error }
//   telegramNumber(id)         a four-digit form number from the id, for the blank's NO. box
import { callWorker } from '@/lib/callWorker';
import { requirePassport } from '@/lib/passportGate';

export const TELEGRAM_WORDS = 4;   // founder, 2026-10-19 (was 3)
const MAX_CHARS = 120;
export const WORD_NAMES = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const graphemes = (x) => (SEG ? [...SEG.segment(x)].map((g) => g.segment) : Array.from(x));

export function telegramText(raw) {
  let t = String(raw == null ? '' : raw).normalize('NFC').replace(/https?:\S+/gi, ' ');
  t = t.replace(/[^\p{L}\p{N}\s.,!?'’&@#\-\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0F\u20E3\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu, ' ');
  // Punctuation stays as typed (founder, 2026-10-19: "use period instead" of STOP).
  t = t.replace(/\s+/g, ' ').trim().toUpperCase();
  return Array.from(t).slice(0, MAX_CHARS).join('');
}

// Each emoji is one word; a run of letters is one (two past 15 letters); punctuation is none.
export const telegramWords = (text) => String(text || '').split(' ').filter(Boolean).reduce((n, w) => {
  let emoji = 0;
  let rest = '';
  for (const g of graphemes(w)) { if (EMOJI.test(g)) emoji += 1; else rest += g; }
  const letters = rest.replace(/[^\p{L}\p{N}]/gu, '').length;
  return n + emoji + (letters ? Math.ceil(letters / 15) : 0);
}, 0);

// The typed text cut back to the words that fit (founder, 2026-10-19: "4 words max"): a fifth
// word or emoji can't be typed, and a paste keeps its first three. Spaces and punctuation
// as typed; cut a character (a whole emoji) at a time.
export function telegramFit(raw, max = TELEGRAM_WORDS) {
  const s = String(raw == null ? '' : raw);
  if (telegramWords(telegramText(s)) <= max) return s;
  let out = '';
  for (const g of graphemes(s)) {
    if (telegramWords(telegramText(out + g)) > max) break;
    out += g;
  }
  return out;
}

export function telegramNumber(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(1000 + (h % 9000));
}

export async function sendTelegram({ to_handle, to_handles, mode, reply_to, reply_all, body }) {
  if (!(await requirePassport())) return { data: null, error: 'finish_passport' };
  const to = Array.isArray(to_handles) ? to_handles : to_handle ? [to_handle] : [];
  const { data, error } = await callWorker('telegrams/send', { body, ...(reply_to ? { reply_to, ...(reply_all ? { reply_all: true } : {}) } : { to_handles: to, mode: mode === 'group' ? 'group' : 'each' }) });
  return { data, error: error || data?.error || null };
}

// The recipient broke the seal (2026-10-19): the worker stamps RECEIVED now → { received_at }.
export async function openTelegram(id) {
  const { data, error } = await callWorker('telegrams/open', { telegram_id: String(id || '') });
  return { receivedAt: data?.received_at || null, error: error || data?.error || null };
}

export async function deleteTelegram(id) {
  const { data, error } = await callWorker('telegrams/delete', { telegram_id: String(id || '') });
  return { ok: !error && data?.ok === true, error: error || data?.error || null };
}
