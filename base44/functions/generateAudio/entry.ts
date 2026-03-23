/**
 * BACKEND FUNCTION: generateAudio (v3)
 * 
 * Native-sounding Text-to-Speech with Neural2 voices
 * 
 * V3 IMPROVEMENTS (Based on Gemini's suggestions):
 * 1. Boholano phonetic preprocessing (y→j sound shift)
 * 2. Regional phonetic adjustments for better dialect pronunciation
 * 3. Improved caching strategy
 * 4. Intelligent dialect fallbacks to Neural2 voices
 * 
 * SETUP:
 * 1. Create function in Base44 called "generateAudio"
 * 2. Set environment variable: GOOGLE_TTS_API_KEY
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GOOGLE_TTS_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');

// In-memory cache for hot requests
const memoryCache = new Map();
const MEMORY_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// ============================================================================
// PHONETIC PREPROCESSING: Make dialects sound more native
// This is the KEY improvement suggested by Gemini!
// ============================================================================
function applyPhoneticTweaks(text, languageCode) {
  const code = languageCode.toLowerCase();
  
  // ==========================================================================
  // BOHOLANO: Famous "Y to J" sound shift
  // "Maayo" (Cebuano) becomes "Maajo" (Boholano)
  // This tricks the Filipino Neural voice into pronouncing it correctly!
  // ==========================================================================
  if (code === 'ceb-bohol' || code === 'boholano') {
    let tweaked = text;
    // Y → J conversion (the signature Boholano sound)
    tweaked = tweaked.replace(/y/g, 'j');
    tweaked = tweaked.replace(/Y/g, 'J');
    // Keep "ny" combinations intact (like "kanyang" → should stay as ñ sound)
    tweaked = tweaked.replace(/nj/g, 'ny');
    tweaked = tweaked.replace(/Nj/g, 'Ny');
    console.log(`🗣️ Boholano phonetic: "${text}" → "${tweaked}"`);
    return tweaked;
  }
  
  // CHAVACANO: Spanish-based creole - already mapped to Spanish voice
  if (code === 'cbk' || code === 'chavacano') {
    return text;
  }
  
  // No changes for other languages
  return text;
}

// ============================================================================
// VOICE MAPPING: Language code → Google TTS Neural2/WaveNet voice
// ============================================================================
const VOICE_MAP = {
  // European Languages
  'en': { languageCode: 'en-US', name: 'en-US-Neural2-J', gender: 'MALE' },
  'en-US': { languageCode: 'en-US', name: 'en-US-Neural2-J', gender: 'MALE' },
  'en-GB': { languageCode: 'en-GB', name: 'en-GB-Neural2-B', gender: 'MALE' },
  'en-AU': { languageCode: 'en-AU', name: 'en-AU-Neural2-B', gender: 'MALE' },
  'en-CA': { languageCode: 'en-CA', name: 'en-CA-Neural2-A', gender: 'FEMALE' },
  
  'es': { languageCode: 'es-ES', name: 'es-ES-Neural2-B', gender: 'MALE' },
  'es-ES': { languageCode: 'es-ES', name: 'es-ES-Neural2-B', gender: 'MALE' },
  'es-MX': { languageCode: 'es-US', name: 'es-US-Neural2-A', gender: 'FEMALE' },
  'es-US': { languageCode: 'es-US', name: 'es-US-Neural2-A', gender: 'FEMALE' },
  
  'fr': { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B', gender: 'MALE' },
  'fr-FR': { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B', gender: 'MALE' },
  'fr-CA': { languageCode: 'fr-CA', name: 'fr-CA-Neural2-B', gender: 'MALE' },
  
  'de': { languageCode: 'de-DE', name: 'de-DE-Neural2-B', gender: 'MALE' },
  'de-DE': { languageCode: 'de-DE', name: 'de-DE-Neural2-B', gender: 'MALE' },
  
  'it': { languageCode: 'it-IT', name: 'it-IT-Neural2-C', gender: 'MALE' },
  'it-IT': { languageCode: 'it-IT', name: 'it-IT-Neural2-C', gender: 'MALE' },
  
  'pt': { languageCode: 'pt-BR', name: 'pt-BR-Neural2-B', gender: 'MALE' },
  'pt-BR': { languageCode: 'pt-BR', name: 'pt-BR-Neural2-B', gender: 'MALE' },
  'pt-PT': { languageCode: 'pt-PT', name: 'pt-PT-Neural2-B', gender: 'MALE' },
  
  'nl': { languageCode: 'nl-NL', name: 'nl-NL-Neural2-B', gender: 'MALE' },
  'pl': { languageCode: 'pl-PL', name: 'pl-PL-Neural2-B', gender: 'MALE' },
  'ru': { languageCode: 'ru-RU', name: 'ru-RU-Neural2-B', gender: 'MALE' },
  'uk': { languageCode: 'uk-UA', name: 'uk-UA-Neural2-A', gender: 'FEMALE' },
  'cs': { languageCode: 'cs-CZ', name: 'cs-CZ-Neural2-A', gender: 'FEMALE' },
  'hu': { languageCode: 'hu-HU', name: 'hu-HU-Neural2-A', gender: 'FEMALE' },
  'el': { languageCode: 'el-GR', name: 'el-GR-Neural2-A', gender: 'FEMALE' },
  'tr': { languageCode: 'tr-TR', name: 'tr-TR-Neural2-B', gender: 'MALE' },
  'sv': { languageCode: 'sv-SE', name: 'sv-SE-Neural2-A', gender: 'FEMALE' },
  'da': { languageCode: 'da-DK', name: 'da-DK-Neural2-D', gender: 'FEMALE' },
  'no': { languageCode: 'nb-NO', name: 'nb-NO-Neural2-B', gender: 'MALE' },
  'nb': { languageCode: 'nb-NO', name: 'nb-NO-Neural2-B', gender: 'MALE' },
  'fi': { languageCode: 'fi-FI', name: 'fi-FI-Neural2-A', gender: 'FEMALE' },
  'ro': { languageCode: 'ro-RO', name: 'ro-RO-Neural2-A', gender: 'FEMALE' },
  'sk': { languageCode: 'sk-SK', name: 'sk-SK-Neural2-A', gender: 'FEMALE' },
  'bg': { languageCode: 'bg-BG', name: 'bg-BG-Neural2-A', gender: 'FEMALE' },
  'hr': { languageCode: 'hr-HR', name: 'hr-HR-Wavenet-A', gender: 'FEMALE' },
  'sr': { languageCode: 'sr-RS', name: 'sr-RS-Neural2-A', gender: 'FEMALE' },
  
  // Asian Languages
  'zh': { languageCode: 'cmn-CN', name: 'cmn-CN-Neural2-B', gender: 'MALE' },
  'zh-CN': { languageCode: 'cmn-CN', name: 'cmn-CN-Neural2-B', gender: 'MALE' },
  'cmn': { languageCode: 'cmn-CN', name: 'cmn-CN-Neural2-B', gender: 'MALE' },
  'cmn-CN': { languageCode: 'cmn-CN', name: 'cmn-CN-Neural2-B', gender: 'MALE' },
  'zh-TW': { languageCode: 'cmn-TW', name: 'cmn-TW-Neural2-A', gender: 'FEMALE' },
  'cmn-TW': { languageCode: 'cmn-TW', name: 'cmn-TW-Neural2-A', gender: 'FEMALE' },
  'yue': { languageCode: 'yue-HK', name: 'yue-HK-Neural2-A', gender: 'FEMALE' },
  'yue-HK': { languageCode: 'yue-HK', name: 'yue-HK-Neural2-A', gender: 'FEMALE' },
  'zh-HK': { languageCode: 'yue-HK', name: 'yue-HK-Neural2-A', gender: 'FEMALE' },
  
  'ja': { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B', gender: 'MALE' },
  'ja-JP': { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B', gender: 'MALE' },
  'ko': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B', gender: 'MALE' },
  'ko-KR': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B', gender: 'MALE' },
  'vi': { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A', gender: 'FEMALE' },
  'th': { languageCode: 'th-TH', name: 'th-TH-Neural2-C', gender: 'FEMALE' },
  'id': { languageCode: 'id-ID', name: 'id-ID-Neural2-B', gender: 'MALE' },
  'ms': { languageCode: 'ms-MY', name: 'ms-MY-Neural2-A', gender: 'FEMALE' },
  
  // Filipino/Tagalog - Primary voice for ALL Philippine languages
  'tl': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-B', gender: 'MALE' },
  'fil': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-B', gender: 'MALE' },
  'fil-PH': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-B', gender: 'MALE' },
  
  // South Asian Languages
  'hi': { languageCode: 'hi-IN', name: 'hi-IN-Neural2-B', gender: 'MALE' },
  'bn': { languageCode: 'bn-IN', name: 'bn-IN-Neural2-B', gender: 'MALE' },
  'ta': { languageCode: 'ta-IN', name: 'ta-IN-Neural2-B', gender: 'MALE' },
  'te': { languageCode: 'te-IN', name: 'te-IN-Neural2-B', gender: 'MALE' },
  'mr': { languageCode: 'mr-IN', name: 'mr-IN-Neural2-B', gender: 'MALE' },
  'gu': { languageCode: 'gu-IN', name: 'gu-IN-Neural2-B', gender: 'MALE' },
  'kn': { languageCode: 'kn-IN', name: 'kn-IN-Neural2-B', gender: 'MALE' },
  'ml': { languageCode: 'ml-IN', name: 'ml-IN-Neural2-B', gender: 'MALE' },
  'pa': { languageCode: 'pa-IN', name: 'pa-IN-Neural2-B', gender: 'MALE' },
  
  // Middle Eastern Languages
  'ar': { languageCode: 'ar-XA', name: 'ar-XA-Neural2-B', gender: 'MALE' },
  'he': { languageCode: 'he-IL', name: 'he-IL-Neural2-B', gender: 'MALE' },
  'iw': { languageCode: 'he-IL', name: 'he-IL-Neural2-B', gender: 'MALE' },
  
  // African Languages
  'sw': { languageCode: 'sw-KE', name: 'sw-KE-Neural2-A', gender: 'FEMALE' },
  'af': { languageCode: 'af-ZA', name: 'af-ZA-Neural2-A', gender: 'FEMALE' },
  
  // Other European
  'ca': { languageCode: 'ca-ES', name: 'ca-ES-Neural2-A', gender: 'FEMALE' },
  'eu': { languageCode: 'eu-ES', name: 'eu-ES-Neural2-A', gender: 'FEMALE' },
  'gl': { languageCode: 'gl-ES', name: 'gl-ES-Neural2-A', gender: 'FEMALE' },
  'is': { languageCode: 'is-IS', name: 'is-IS-Neural2-A', gender: 'FEMALE' },
  'lv': { languageCode: 'lv-LV', name: 'lv-LV-Neural2-B', gender: 'MALE' },
  'lt': { languageCode: 'lt-LT', name: 'lt-LT-Neural2-B', gender: 'MALE' },
};

// ============================================================================
// DIALECT FALLBACKS: Map unsupported dialects to closest Neural2 voice
// ============================================================================
const DIALECT_FALLBACKS = {
  // Philippine languages → Filipino (with phonetic preprocessing for Boholano!)
  'ceb': 'fil-PH',           // Cebuano
  'ceb-bohol': 'fil-PH',     // Boholano (with y→j preprocessing!)
  'ceb-davao': 'fil-PH',     // Davao Cebuano
  'hil': 'fil-PH',           // Hiligaynon/Ilonggo
  'war': 'fil-PH',           // Waray
  'ilo': 'fil-PH',           // Ilocano
  'bik': 'fil-PH',           // Bicolano
  'pam': 'fil-PH',           // Kapampangan
  'pag': 'fil-PH',           // Pangasinan
  'akl': 'fil-PH',           // Aklanon
  'krj': 'fil-PH',           // Kinaray-a
  'tsg': 'fil-PH',           // Tausug
  'mrw': 'fil-PH',           // Maranao
  'mdh': 'fil-PH',           // Maguindanaon
  'cbk': 'es-ES',            // Chavacano → Spanish (it's a Spanish creole!)
  
  // Common spellings
  'cebuano': 'fil-PH',
  'bisaya': 'fil-PH',
  'visayan': 'fil-PH',
  'boholano': 'fil-PH',
  'hiligaynon': 'fil-PH',
  'ilonggo': 'fil-PH',
  'waray': 'fil-PH',
  'ilocano': 'fil-PH',
  'bicolano': 'fil-PH',
  'kapampangan': 'fil-PH',
  'chavacano': 'es-ES',
  
  // Chinese dialects → Mandarin or Cantonese
  'wuu': 'cmn-CN',           // Shanghainese
  'nan': 'cmn-CN',           // Hokkien
  'hak': 'cmn-CN',           // Hakka
  'gan': 'cmn-CN',           // Gan
  'hsn': 'cmn-CN',           // Xiang
  'cdo': 'cmn-CN',           // Min Dong
  
  // Indonesian languages → Indonesian
  'jv': 'id-ID',             // Javanese
  'su': 'id-ID',             // Sundanese
  'ban': 'id-ID',            // Balinese
  'min': 'id-ID',            // Minangkabau
  'bug': 'id-ID',            // Bugis
  'mak': 'id-ID',            // Makassarese
  
  // Italian dialects → Italian
  'nap': 'it-IT',            // Neapolitan
  'scn': 'it-IT',            // Sicilian
  'vec': 'it-IT',            // Venetian
  
  // German dialects → German
  'bar': 'de-DE',            // Bavarian
  'gsw': 'de-DE',            // Swiss German
  'nds': 'de-DE',            // Low German
  
  // French dialects → French
  'oc': 'fr-FR',             // Occitan
  'br': 'fr-FR',             // Breton
  'co': 'fr-FR',             // Corsican
  
  // Japanese dialects → Japanese
  'ryu': 'ja-JP',            // Okinawan
  
  // Indian languages
  'kok': 'hi-IN',            // Konkani → Hindi
  'bho': 'hi-IN',            // Bhojpuri → Hindi
  'as': 'bn-IN',             // Assamese → Bengali
  'or': 'hi-IN',             // Odia → Hindi
  'ne': 'hi-IN',             // Nepali → Hindi
  
  // Others
  'rm': 'de-DE',             // Romansh → German
  'cy': 'en-GB',             // Welsh → British English
};

// Languages that need browser TTS (no good alternative)
const BROWSER_FALLBACK_ONLY = [
  'nah', 'nahuatl', 'quechua', 'que', 'guarani', 'grn',
  'maya', 'mayan', 'navajo', 'nav', 'cherokee', 'chr',
  'hawaiian', 'haw', 'maori', 'mri', 'samoan', 'smo',
  'tibetan', 'bod', 'burmese', 'mya', 'lao', 'khmer', 'khm'
];

// ISO 639-2 to 639-1 conversion
const ISO_639_2_TO_1 = {
  'spa': 'es', 'eng': 'en', 'fra': 'fr', 'deu': 'de', 'ita': 'it', 'por': 'pt',
  'rus': 'ru', 'jpn': 'ja', 'kor': 'ko', 'zho': 'zh', 'ara': 'ar', 'hin': 'hi',
  'nld': 'nl', 'pol': 'pl', 'tur': 'tr', 'vie': 'vi', 'tha': 'th', 'ind': 'id',
  'heb': 'he', 'swe': 'sv', 'nor': 'no', 'dan': 'da', 'fin': 'fi', 'ces': 'cs',
  'hun': 'hu', 'ron': 'ro', 'ukr': 'uk', 'ell': 'el', 'cat': 'ca', 'ben': 'bn',
  'tam': 'ta', 'tel': 'te', 'mar': 'mr', 'guj': 'gu', 'kan': 'kn', 'mal': 'ml',
  'pan': 'pa', 'swa': 'sw', 'afr': 'af', 'isl': 'is', 'lav': 'lv', 'lit': 'lt',
  'slk': 'sk', 'bul': 'bg', 'hrv': 'hr', 'srp': 'sr', 'msa': 'ms', 'fil': 'tl',
  'eus': 'eu', 'glg': 'gl'
};

function getVoiceConfig(inputCode) {
  const normalizedInput = inputCode.toLowerCase().trim();
  
  // Check browser fallback only
  if (BROWSER_FALLBACK_ONLY.includes(normalizedInput)) {
    console.log(`⚠️ ${inputCode} not supported - browser fallback`);
    return null;
  }
  
  // Check dialect fallback
  if (DIALECT_FALLBACKS[normalizedInput]) {
    const fallbackCode = DIALECT_FALLBACKS[normalizedInput];
    console.log(`🔄 Dialect fallback: ${inputCode} → ${fallbackCode}`);
    if (VOICE_MAP[fallbackCode]) {
      return { 
        ...VOICE_MAP[fallbackCode], 
        isDialectFallback: true, 
        originalCode: inputCode 
      };
    }
  }
  
  // ISO conversion
  let processedCode = inputCode;
  if (inputCode.length === 3 && ISO_639_2_TO_1[normalizedInput]) {
    processedCode = ISO_639_2_TO_1[normalizedInput];
    console.log(`🔄 ISO: ${inputCode} → ${processedCode}`);
  }
  
  // Direct match
  if (VOICE_MAP[processedCode]) return VOICE_MAP[processedCode];
  if (VOICE_MAP[processedCode.toLowerCase()]) return VOICE_MAP[processedCode.toLowerCase()];
  
  // Base code
  const baseCode = processedCode.split('-')[0].toLowerCase();
  if (VOICE_MAP[baseCode]) {
    console.log(`🔄 Base: ${processedCode} → ${baseCode}`);
    return VOICE_MAP[baseCode];
  }
  
  // Base code dialect fallback
  if (DIALECT_FALLBACKS[baseCode]) {
    const fallbackCode = DIALECT_FALLBACKS[baseCode];
    if (VOICE_MAP[fallbackCode]) {
      return { ...VOICE_MAP[fallbackCode], isDialectFallback: true, originalCode: inputCode };
    }
  }
  
  console.warn(`⚠️ No voice for: ${inputCode}`);
  return null;
}

function createHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, languageCode, city } = await req.json();
    
    if (!text || !languageCode) {
      return Response.json({ error: 'Missing text or languageCode' });
    }
    
    const maxLength = 500;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
    
    const voiceConfig = getVoiceConfig(languageCode);
    
    if (!voiceConfig) {
      return Response.json({
        error: `No voice for: ${languageCode}`,
        useFallback: true,
        fallbackLanguageCode: languageCode
      });
    }
    
    // ========================================================================
    // APPLY PHONETIC PREPROCESSING (Boholano y→j, etc.)
    // ========================================================================
    // Detect if user is in a Bisaya region that uses the "y→j" sound
const bisayaJRegions = ['Tagbilaran', 'Bohol', 'Davao'];
const isBoholanoStyle = bisayaJRegions.some(r => city?.toLowerCase().includes(r.toLowerCase()));

// If in those regions AND speaking Cebuano/Bisaya, apply the native pronunciation
const effectiveDialect = (isBoholanoStyle && ['ceb', 'bisaya', 'cebuano'].includes(languageCode.toLowerCase())) 
  ? 'ceb-bohol' 
  : languageCode;

const phoneticText = applyPhoneticTweaks(truncatedText, effectiveDialect);
    
    // Cache key uses phonetic text
    const cacheKey = `tts_v3_${voiceConfig.name}_${createHash(phoneticText)}`;
    
    // Check memory cache
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_DURATION) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      return Response.json({
        audioContent: cached.audioContent,
        cached: true,
        voiceUsed: voiceConfig.name,
        isDialectFallback: voiceConfig.isDialectFallback || false,
        phoneticApplied: phoneticText !== truncatedText
      });
    }
    
    console.log(`❌ Cache MISS: ${cacheKey} - Voice: ${voiceConfig.name}`);
    if (phoneticText !== truncatedText) {
      console.log(`🗣️ Phonetic: "${truncatedText}" → "${phoneticText}"`);
    }
    
    if (!GOOGLE_TTS_API_KEY) {
      return Response.json({ error: 'TTS API key not configured', useFallback: true });
    }
    
    // Call Google TTS API
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: phoneticText },
          voice: {
            languageCode: voiceConfig.languageCode,
            name: voiceConfig.name,
            ssmlGender: voiceConfig.gender
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.95,
            pitch: 1.5,
            volumeGainDb: 3.0,
            sampleRateHertz: 48000
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS error:', response.status, errorText);
      
      if (response.status === 400) {
        // Try auto-select
        const fallbackResponse = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text: phoneticText },
              voice: { languageCode: voiceConfig.languageCode, ssmlGender: 'NEUTRAL' },
              audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, pitch: 1.5, volumeGainDb: 3.0, sampleRateHertz: 48000 }
            })
          }
        );
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.audioContent) {
            memoryCache.set(cacheKey, { audioContent: fallbackData.audioContent, timestamp: Date.now() });
            return Response.json({
              audioContent: fallbackData.audioContent,
              cached: false,
              voiceUsed: 'auto-selected',
              isDialectFallback: true
            });
          }
        }
        return Response.json({ error: `Voice error`, useFallback: true });
      }
      
      return Response.json({ error: `TTS error: ${response.status}`, useFallback: true });
    }
    
    const data = await response.json();
    
    if (!data.audioContent) {
      return Response.json({ error: 'No audio', useFallback: true });
    }
    
    const charCount = phoneticText.length;
    const cost = (charCount / 1000000) * 16;
    console.log(`💰 Generated: ${voiceConfig.name}, ${charCount} chars, $${cost.toFixed(6)}`);
    
    memoryCache.set(cacheKey, { audioContent: data.audioContent, timestamp: Date.now() });
    
    return Response.json({
      audioContent: data.audioContent,
      cached: false,
      cacheKey,
      charCount,
      estimatedCost: cost,
      voiceUsed: voiceConfig.name,
      isDialectFallback: voiceConfig.isDialectFallback || false,
      phoneticApplied: phoneticText !== truncatedText
    });
    
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, useFallback: true }, { status: 500 });
  }
});