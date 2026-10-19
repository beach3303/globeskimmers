// telegram — words by wire, no photo (founder, 2026-10-19). The same rules as the worker's
// tgClean / tgWordCount, so what the blank shows is what arrives: capitals, letters, digits and
// plain punctuation; a full stop or ! becomes STOP; links and emoji don't go by wire. Three
// words at most (founder, 2026-10-19: "spike curiosity"; a real telegram's base rate covered
// ten); STOP doesn't count, and a word past 15 letters counts as two, the old telegraph rule.
//
//   telegramText(raw)          the wire text, e.g. "Safe in Manila. Miss you!" → "SAFE IN MANILA STOP MISS YOU STOP"
//   telegramWords(text)        how many words count (STOP doesn't)
//   sendTelegram({ to_handle, reply_to, body })   → { data, error }
//   deleteTelegram(id)         the recipient takes it out of their Mailbox → { ok, error }
//   telegramNumber(id)         a four-digit form number from the id, for the blank's NO. box
import { callWorker } from '@/lib/callWorker';
import { requirePassport } from '@/lib/passportGate';

export const TELEGRAM_WORDS = 3;
const MAX_CHARS = 120;
export const WORD_NAMES = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function telegramText(raw) {
  let t = String(raw == null ? '' : raw).normalize('NFC').replace(/https?:\S+/gi, ' ');
  t = t.replace(/[^\p{L}\p{N}\s.,!?'’&@#-]/gu, ' ');
  t = t.replace(/[.!]+(?=\s|$)/g, ' STOP ');
  t = t.replace(/\s+/g, ' ').trim().toUpperCase().replace(/\bSTOP(\s+STOP\b)+/g, 'STOP').replace(/^STOP\b\s*/, '');
  return t.slice(0, MAX_CHARS);
}

export const telegramWords = (text) => String(text || '').split(' ').filter((w) => w && w !== 'STOP' && /[\p{L}\p{N}]/u.test(w)).reduce((n, w) => n + Math.ceil(w.replace(/[^\p{L}\p{N}]/gu, '').length / 15), 0);

// The typed text cut back to the words that fit (founder, 2026-10-19: "only 3 words max!"): a
// fourth word can't be typed, and a paste keeps its first three. Spaces and punctuation as typed.
export function telegramFit(raw, max = TELEGRAM_WORDS) {
  const s = String(raw == null ? '' : raw);
  if (telegramWords(telegramText(s)) <= max) return s;
  const parts = s.match(/\S+\s*/g) || [];
  let out = '';
  for (const p of parts) {
    if (telegramWords(telegramText(out + p)) > max) break;
    out += p;
  }
  return out;
}

export function telegramNumber(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(1000 + (h % 9000));
}

export async function sendTelegram({ to_handle, reply_to, body }) {
  if (!(await requirePassport())) return { data: null, error: 'finish_passport' };
  const { data, error } = await callWorker('telegrams/send', { body, ...(reply_to ? { reply_to } : { to_handle }) });
  return { data, error: error || data?.error || null };
}

export async function deleteTelegram(id) {
  const { data, error } = await callWorker('telegrams/delete', { telegram_id: String(id || '') });
  return { ok: !error && data?.ok === true, error: error || data?.error || null };
}
