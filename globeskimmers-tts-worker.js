/**
 * Cloudflare Worker: Text-to-Speech with Neural2 Voices
 * URL: https://globeskimmers-tts.maizasimeon.workers.dev
 */

function applyPhoneticTweaks(text, languageCode, city) {
  const code = (languageCode || '').toLowerCase();
  const cityLower = (city || '').toLowerCase();
  
  const isBoholano = code === 'ceb-bohol' || code === 'boholano' ||
                     cityLower.includes('bohol') || cityLower.includes('tagbilaran') || 
                     cityLower.includes('panglao') || cityLower.includes('loboc');
  
  if (isBoholano) {
    let tweaked = text;
    tweaked = tweaked.replace(/y(?=[a-zA-Z])/g, 'j');
    tweaked = tweaked.replace(/Y(?=[a-zA-Z])/g, 'J');
    tweaked = tweaked.replace(/nj/g, 'ny');
    tweaked = tweaked.replace(/Nj/g, 'Ny');
    return tweaked;
  }
  return text;
}

const VOICE_MAP = {
  'en': { languageCode: 'en-US', name: 'en-US-Neural2-J', gender: 'MALE' },
  'en-US': { languageCode: 'en-US', name: 'en-US-Neural2-J', gender: 'MALE' },
  'es': { languageCode: 'es-ES', name: 'es-ES-Neural2-B', gender: 'MALE' },
  'fr': { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B', gender: 'MALE' },
  'de': { languageCode: 'de-DE', name: 'de-DE-Neural2-B', gender: 'MALE' },
  'it': { languageCode: 'it-IT', name: 'it-IT-Neural2-C', gender: 'MALE' },
  'pt': { languageCode: 'pt-BR', name: 'pt-BR-Neural2-B', gender: 'MALE' },
  'ja': { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B', gender: 'MALE' },
  'ko': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B', gender: 'MALE' },
  'zh': { languageCode: 'cmn-CN', name: 'cmn-CN-Neural2-B', gender: 'MALE' },
  'vi': { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A', gender: 'FEMALE' },
  'th': { languageCode: 'th-TH', name: 'th-TH-Neural2-C', gender: 'FEMALE' },
  'tl': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-B', gender: 'MALE' },
  'fil': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-B', gender: 'MALE' },
  'hi': { languageCode: 'hi-IN', name: 'hi-IN-Neural2-B', gender: 'MALE' },
  'ar': { languageCode: 'ar-XA', name: 'ar-XA-Neural2-B', gender: 'MALE' },
  'ru': { languageCode: 'ru-RU', name: 'ru-RU-Neural2-B', gender: 'MALE' },
};

const DIALECT_FALLBACKS = {
  'ceb': 'fil-PH', 'ceb-bohol': 'fil-PH', 'hil': 'fil-PH', 'war': 'fil-PH',
  'ilo': 'fil-PH', 'cbk': 'es-ES', 'jv': 'id-ID', 'su': 'id-ID',
};

function getVoiceConfig(inputCode) {
  const code = (inputCode || 'en').toLowerCase().trim();
  if (VOICE_MAP[inputCode]) return VOICE_MAP[inputCode];
  if (VOICE_MAP[code]) return VOICE_MAP[code];
  if (DIALECT_FALLBACKS[code]) {
    const fallback = DIALECT_FALLBACKS[code];
    if (VOICE_MAP[fallback]) return { ...VOICE_MAP[fallback], isDialectFallback: true };
  }
  const baseCode = code.split('-')[0];
  if (VOICE_MAP[baseCode]) return VOICE_MAP[baseCode];
  return VOICE_MAP['en'];
}

function createHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    const url = new URL(request.url);
    
    if (request.method === 'GET' && url.searchParams.get('action') === 'getTranslation') {
      const key = url.searchParams.get('key');
      if (!key) return jsonResponse({ error: 'Missing key' }, 400);
      try {
        const cached = await env.TTS_CACHE.get(key);
        if (cached) {
          const phrases = JSON.parse(cached);
          return jsonResponse({ phrases, cached: true });
        }
        return jsonResponse({ phrases: null, cached: false });
      } catch (e) {
        return jsonResponse({ phrases: null, error: e.message });
      }
    }
    
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'POST required' }, 405);
    }
    
    try {
      const body = await request.json();
      
      if (body.action === 'saveTranslation') {
        const { key, phrases } = body;
        if (!key || !phrases) return jsonResponse({ error: 'Missing key or phrases' }, 400);
        await env.TTS_CACHE.put(key, JSON.stringify(phrases));
        return jsonResponse({ success: true, key });
      }
      
      const { text, languageCode, city } = body;
      if (!text) return jsonResponse({ error: 'Missing text', useFallback: true }, 400);
      
      const truncatedText = text.length > 500 ? text.substring(0, 500) : text;
      const voiceConfig = getVoiceConfig(languageCode);
      if (!voiceConfig) return jsonResponse({ error: 'No voice for: ' + languageCode, useFallback: true });
      
      const phoneticText = applyPhoneticTweaks(truncatedText, languageCode, city);
      const cacheKey = 'tts_v6_' + voiceConfig.name + '_' + createHash(phoneticText);
      
      if (env.TTS_CACHE) {
        const cached = await env.TTS_CACHE.get(cacheKey);
        if (cached) {
          return jsonResponse({ audioContent: cached, cached: true, voiceUsed: voiceConfig.name });
        }
      }
      
      if (!env.GOOGLE_TTS_API_KEY) {
        return jsonResponse({ error: 'API key not configured', useFallback: true }, 500);
      }
      
      const hasPauseMarkers = phoneticText.includes('...');
      let inputConfig;
      if (hasPauseMarkers) {
        const escapedText = phoneticText.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const ssmlBody = escapedText.replace(/\.\.\./g, '<break time="2s"/>');
        inputConfig = { ssml: '<speak>' + ssmlBody + '</speak>' };
      } else {
        inputConfig = { text: phoneticText };
      }
      
      const response = await fetch(
        'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + env.GOOGLE_TTS_API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: inputConfig,
            voice: { languageCode: voiceConfig.languageCode, name: voiceConfig.name, ssmlGender: voiceConfig.gender },
            audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0.0, volumeGainDb: 3.0, sampleRateHertz: 24000 }
          })
        }
      );
      
      if (!response.ok) {
        return jsonResponse({ error: 'TTS error: ' + response.status, useFallback: true }, 500);
      }
      
      const data = await response.json();
      if (!data.audioContent) return jsonResponse({ error: 'No audio', useFallback: true }, 500);
      
      if (env.TTS_CACHE) {
        ctx.waitUntil(env.TTS_CACHE.put(cacheKey, data.audioContent));
      }
      
      return jsonResponse({ audioContent: data.audioContent, cached: false, voiceUsed: voiceConfig.name });
      
    } catch (error) {
      return jsonResponse({ error: error.message, useFallback: true }, 500);
    }
  }
};
