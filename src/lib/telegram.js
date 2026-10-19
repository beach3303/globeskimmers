// telegram — words by wire, no photo (founder, 2026-10-19). The same rules as the worker's
// tgClean / tgWordCount, so what the blank shows is what arrives: capitals, letters, digits and
// plain punctuation and emoji; a full stop or ! becomes STOP; links don't go by wire. Three
// words at most (founder, 2026-10-19: "spike curiosity"); STOP doesn't count, an emoji counts as
// one word (3️⃣ is one), and a word past 15 letters counts as two, the old telegraph rule.
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

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const graphemes = (x) => (SEG ? [...SEG.segment(x)].map((g) => g.segment) : Array.from(x));

export function telegramText(raw) {
  let t = String(raw == null ? '' : raw).normalize('NFC').replace(/https?:\S+/gi, ' ');
  t = t.replace(/[^\p{L}\p{N}\s.,!?'’&@#\-\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0F\u20E3\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu, ' ');
  t = t.replace(/[.!]+(?=\s|$)/g, ' STOP ');
  t = t.replace(/\s+/g, ' ').trim().toUpperCase().replace(/\bSTOP(\s+STOP\b)+/g, 'STOP').replace(/^STOP\b\s*/, '');
  return Array.from(t).slice(0, MAX_CHARS).join('');
}

// Each emoji is one word; a run of letters is one (two past 15 letters); STOP is none.
export const telegramWords = (text) => String(text || '').split(' ').filter((w) => w && w !== 'STOP').reduce((n, w) => {
  let emoji = 0;
  let rest = '';
  for (const g of graphemes(w)) { if (EMOJI.test(g)) emoji += 1; else rest += g; }
  const letters = rest.replace(/[^\p{L}\p{N}]/gu, '').length;
  return n + emoji + (letters ? Math.ceil(letters / 15) : 0);
}, 0);

// The typed text cut back to the words that fit (founder, 2026-10-19: "only 3 words max!"): a
// fourth word or emoji can't be typed, and a paste keeps its first three. Spaces and punctuation
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

export async function sendTelegram({ to_handle, reply_to, body }) {
  if (!(await requirePassport())) return { data: null, error: 'finish_passport' };
  const { data, error } = await callWorker('telegrams/send', { body, ...(reply_to ? { reply_to } : { to_handle }) });
  return { data, error: error || data?.error || null };
}

export async function deleteTelegram(id) {
  const { data, error } = await callWorker('telegrams/delete', { telegram_id: String(id || '') });
  return { ok: !error && data?.ok === true, error: error || data?.error || null };
}
