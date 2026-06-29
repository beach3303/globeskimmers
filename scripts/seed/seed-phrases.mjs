// ============================================================================
// Basic Phrases — one-time SEED into Supabase (text + optional audio).
//
// Pre-generates dialect-accurate translations (Gemini 2.5 Pro) and, optionally,
// audio (Gemini TTS) for every target language, and writes them to the
// `phrase_translations` table (+ `phrase-audio` Storage bucket). Users then load
// instantly from the DB — nobody ever waits on a live AI call.
//
// SECRETS — never in chat or code. Put them in a gitignored .env.seed at repo root:
//   GEMINI_API_KEY=AIza...
//   SUPABASE_URL=https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=<service_role secret>   (Supabase → Settings → API)
//
// USAGE (run from repo root):
//   node scripts/seed/seed-phrases.mjs --languages=ceb            # one dialect, text only
//   node scripts/seed/seed-phrases.mjs --languages=ceb --audio    # + audio
//   node scripts/seed/seed-phrases.mjs --all                      # every dialect, text only
//   node scripts/seed/seed-phrases.mjs --all --audio              # everything
//   node scripts/seed/seed-phrases.mjs --languages=ceb --limit=5  # smoke test: 5 phrases/category
//   Flags: --voice=Charon  --concurrency=3  --only-missing  --dry-run
//
// ⚠️ Preview-model note: Gemini TTS is a preview model whose name/shape can change.
// Verify GEMINI_TTS_MODEL against https://ai.google.dev/gemini-api/docs/speech-generation
// before a big audio run; do a --limit=2 --audio smoke test first.
// ============================================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { PRESET_PHRASES, REGIONAL_DIALECT_MAP } from './data.mjs';

// ---- config ---------------------------------------------------------------
const GEMINI_TEXT_MODEL = 'gemini-2.5-pro';
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const AUDIO_BUCKET = 'phrase-audio';

// ---- tiny .env.seed loader (no dependency) --------------------------------
function loadEnv() {
  const out = {};
  try {
    for (const line of readFileSync(new URL('../../.env.seed', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* fall through to process.env */ }
  return { ...out, ...process.env };
}
const ENV = loadEnv();
const GEMINI_API_KEY = ENV.GEMINI_API_KEY;
const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing secrets. Create .env.seed with GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ---- CLI args -------------------------------------------------------------
const ARGV = process.argv.slice(2);
const arg = (k, d) => { const a = ARGV.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const flag = (k) => ARGV.includes(`--${k}`);
const OPT = {
  all: flag('all'),
  languages: (arg('languages', '') || '').split(',').filter(Boolean),
  audio: flag('audio'),
  voice: arg('voice', 'Charon'),
  concurrency: parseInt(arg('concurrency', '3'), 10),
  langConcurrency: parseInt(arg('lang-concurrency', '4'), 10),
  limit: parseInt(arg('limit', '0'), 10) || 0,
  onlyMissing: flag('only-missing'),
  dryRun: flag('dry-run'),
};

// ---- derive the target list from the dialect map --------------------------
// One entry per UNIQUE language code per country (a dialect shared by several
// cities is seeded once). national_* drives the dialect⇄national toggle.
function buildTargets() {
  const seen = new Set();
  const targets = [];
  for (const [country, c] of Object.entries(REGIONAL_DIALECT_MAP)) {
    // the national language itself
    if (!seen.has(c.default_code)) {
      seen.add(c.default_code);
      targets.push({ language_code: c.default_code, dialect_name: c.default_language, country, national_code: c.default_code, national_language: c.default_language, is_national: true });
    }
    for (const r of Object.values(c.regions || {})) {
      const key = r.code;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ language_code: r.code, dialect_name: r.dialect, country, national_code: c.default_code, national_language: c.default_language, is_national: !!r.same_as_default });
    }
  }
  return targets;
}

// ---- Gemini text: translate one category for one target -------------------
const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    phrases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          english: { type: 'string' },
          formal: { type: 'string' },
          casual: { type: 'string' },
          formal_phonetic: { type: 'string' },
          casual_phonetic: { type: 'string' },
          romanization: { type: 'string' },
          same_formality: { type: 'boolean' },
        },
        required: ['english', 'formal', 'casual', 'same_formality'],
      },
    },
  },
  required: ['phrases'],
};

function translatePrompt(target, phrases) {
  const isBoholano = target.language_code === 'ceb-bohol';
  const dialectNote = isBoholano
    ? `This is BOHOLANO — the Cebuano (Bisaya) of Bohol. Translate in authentic Cebuano/Bisaya as a Bohol local speaks it. Boholano pronounces the Cebuano "y" sound as "j" (e.g. "iya"→"ija", "siya"→"sija"); reflect that in the PHONETIC guides, but keep the written translation in standard Cebuano spelling.`
    : '';
  return `You are a NATIVE speaker and professional translator of ${target.dialect_name} as actually spoken by locals in ${target.country}. Translate each English phrase into authentic, everyday ${target.dialect_name}.

CRITICAL ACCURACY RULES:
- Use REAL ${target.dialect_name} vocabulary and grammar — NOT the national language. (e.g. for Cebuano/Bisaya do NOT substitute Tagalog words.) If a word is genuinely borrowed in everyday speech, that's fine, but do not default to the national language.
- Do NOT borrow politeness particles or honorifics from the national language. Philippine languages other than Tagalog (Cebuano/Bisaya, Boholano, Hiligaynon, Waray, Ilocano, Bicolano, Kapampangan) do NOT use the Tagalog particles "po"/"opo" — NEVER output "po" or "opo". Convey politeness through the dialect's own phrasing, word choice, and tone, exactly as a local elder would actually speak.
- Natural, conversational register a traveler would actually hear and that a local would understand instantly.
- Keep placeholders like [Name], [Destination], [Allergen] and _____ blanks unchanged inside the translation.
${dialectNote}

For EACH phrase return:
- formal: polite/respectful version (for strangers, elders, staff, officials)
- casual: informal version (friends/peers). If there is no meaningful difference, set casual = formal and same_formality = true.
- formal_phonetic / casual_phonetic: how to SAY it, written with English letters (e.g. "sah-LAH-mat"). For non-Latin scripts also fill romanization.
- romanization: Latin-script transliteration if the script is non-Latin, else "".

Return EXACTLY one object per input phrase, in the SAME ORDER.

PHRASES:
${phrases.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
}

async function geminiTranslate(target, phrases) {
  const res = await fetch(`${GEMINI_BASE}/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: translatePrompt(target, phrases) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: TRANSLATE_SCHEMA, temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini text ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini text: empty response');
  const parsed = JSON.parse(text);
  return parsed.phrases || [];
}

// ---- Gemini TTS: text -> WAV bytes -----------------------------------------
function boholanoTweak(text) {
  return text.replace(/y(?=[a-zA-Z])/g, 'j').replace(/Y(?=[a-zA-Z])/g, 'J').replace(/nj/g, 'ny').replace(/Nj/g, 'Ny');
}
function pcmToWav(pcm, sampleRate = 24000) {
  const numCh = 1, bps = 16;
  const blockAlign = numCh * bps / 8, byteRate = sampleRate * blockAlign;
  const buf = Buffer.alloc(44 + pcm.length);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + pcm.length, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numCh, 22); buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32); buf.writeUInt16LE(bps, 34);
  buf.write('data', 36); buf.writeUInt32LE(pcm.length, 40); pcm.copy(buf, 44);
  return buf;
}
async function geminiTTS(text, target) {
  const speakText = target.language_code === 'ceb-bohol' ? boholanoTweak(text) : text;
  // Gemini TTS intermittently returns an empty response on short inputs — retry
  // a few times before giving up (the caller then leaves audio_url null, so the
  // app falls back to the live TTS voice for that one phrase).
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${GEMINI_BASE}/${GEMINI_TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: speakText }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: OPT.voice } } } },
        }),
      });
      if (!res.ok) { lastErr = new Error(`Gemini TTS ${res.status}: ${(await res.text()).slice(0, 160)}`); continue; }
      const json = await res.json();
      const b64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) { lastErr = new Error('Gemini TTS: no audio'); continue; }
      return pcmToWav(Buffer.from(b64, 'base64'));
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Gemini TTS failed');
}
async function uploadAudio(path, wav) {
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, wav, { contentType: 'audio/wav', upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---- concurrency helper ----------------------------------------------------
async function pool(items, n, worker) {
  const q = [...items.entries()]; let active = 0; let i = 0;
  return new Promise((resolve) => {
    const next = () => {
      if (i >= q.length && active === 0) return resolve();
      while (active < n && i < q.length) {
        const [idx, item] = q[i++]; active++;
        Promise.resolve(worker(item, idx)).catch(e => console.error('  ✗', e.message)).finally(() => { active--; next(); });
      }
    };
    next();
  });
}

// ---- main ------------------------------------------------------------------
async function seedTarget(target) {
  const categories = Object.entries(PRESET_PHRASES);
  let textRows = 0, audioClips = 0;
  for (const [category, allPhrases] of categories) {
    const phrases = OPT.limit ? allPhrases.slice(0, OPT.limit) : allPhrases;
    if (OPT.onlyMissing) {
      const { count } = await supabase.from('phrase_translations').select('id', { count: 'exact', head: true })
        .eq('language_code', target.language_code).eq('category', category);
      if (count && count >= phrases.length) { console.log(`  • ${category}: already seeded (${count}) — skip`); continue; }
    }
    let translated;
    try { translated = await geminiTranslate(target, phrases); }
    catch (e) { console.error(`  ✗ ${category} translate:`, e.message); continue; }

    const rows = phrases.map((english, idx) => {
      const t = translated[idx] || {};
      return {
        language_code: target.language_code, dialect_name: target.dialect_name, country: target.country,
        category, phrase_index: idx, english,
        formal: t.formal || '', casual: t.casual || t.formal || '',
        formal_phonetic: t.formal_phonetic || '', casual_phonetic: t.casual_phonetic || '',
        romanization: t.romanization || '', same_formality: t.same_formality ?? true,
        source: GEMINI_TEXT_MODEL, verified: false, updated_at: new Date().toISOString(),
      };
    });

    if (OPT.audio) {
      await pool(rows, OPT.concurrency, async (row) => {
        const speak = row.formal || row.casual; if (!speak) return;
        try {
          const wav = await geminiTTS(speak, target);
          row.audio_formal_url = await uploadAudio(`${target.language_code}/${category}/${row.phrase_index}.wav`, wav);
          audioClips++;
        } catch (e) { console.error(`    ✗ audio ${category}#${row.phrase_index}:`, e.message); }
      });
    }

    if (!OPT.dryRun) {
      const { error } = await supabase.from('phrase_translations').upsert(rows, { onConflict: 'language_code,category,phrase_index' });
      if (error) { console.error(`  ✗ ${category} upsert:`, error.message); continue; }
    }
    textRows += rows.length;
    console.log(`  ✓ ${category}: ${rows.length} phrases${OPT.audio ? ` + audio` : ''}`);
  }
  return { textRows, audioClips };
}

async function main() {
  const targets = buildTargets().filter(t => OPT.all || OPT.languages.includes(t.language_code));
  if (!targets.length) {
    console.error('No targets. Use --all or --languages=ceb,tl,... Available codes:');
    console.error('  ' + buildTargets().map(t => `${t.language_code} (${t.dialect_name})`).join(', '));
    process.exit(1);
  }
  console.log(`Seeding ${targets.length} language(s)${OPT.audio ? ' WITH audio' : ' (text only)'}${OPT.limit ? `, ${OPT.limit} phrases/category` : ''}${OPT.dryRun ? ' [DRY RUN]' : ''}\n`);
  let totalText = 0, totalAudio = 0;
  // Languages run in parallel (each language still does its categories in order);
  // audio runs are kept gentler on the API, so force serial languages with --audio.
  const langN = OPT.audio ? 1 : OPT.langConcurrency;
  await pool(targets, langN, async (t) => {
    console.log(`▶ ${t.dialect_name} [${t.language_code}] — ${t.country}`);
    const { textRows, audioClips } = await seedTarget(t);
    totalText += textRows; totalAudio += audioClips;
    console.log(`  ✔ finished ${t.language_code} (+${textRows} rows)`);
  });
  console.log(`\nDone. ${totalText} phrase rows${OPT.audio ? `, ${totalAudio} audio clips` : ''} across ${targets.length} language(s).`);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
