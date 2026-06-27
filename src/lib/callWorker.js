// src/lib/callWorker.js
//
// Single entry point for calling the GlobeSkimmers Cloudflare Worker DIRECTLY
// (the Phase 7 data path — replaces base44.functions.invoke). It:
//   - attaches the live Supabase access token as `Authorization: Bearer <jwt>`
//     (the Worker validates it once JWT enforcement is switched on; until then
//     the token is sent but routes stay open during the migration window)
//   - uses CapacitorHttp on NATIVE (native HTTP — no WebView CORS / capacitor://
//     localhost origin issues) and fetch on WEB (Worker CORS is already '*')
//   - returns { data, error } mirroring base44.functions.invoke's { data }
//     envelope, so call sites change by ~one token.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { supabase } from '@/lib/supabaseClient';

const WORKER_BASE = 'https://globeskimmers-api.maizasimeon.workers.dev';
const isNative = Capacitor.isNativePlatform();

async function getToken() {
  // getSession() returns the cached session and silently refreshes near expiry.
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function callWorker(path, body = {}) {
  const token = await getToken();
  const url = `${WORKER_BASE}/${String(path).replace(/^\//, '')}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    if (isNative) {
      // CapacitorHttp parses JSON and bypasses WebView CORS.
      const res = await CapacitorHttp.post({ url, headers, data: body });
      if (res.status >= 400) return { data: null, error: res.data?.error || `HTTP ${res.status}` };
      return { data: res.data, error: null };
    }
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: json?.error || `HTTP ${res.status}` };
    return { data: json, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'Network error' };
  }
}

// Thin wrapper for the generic LLM endpoint (Chunk 4). base44's InvokeLLM
// returned the parsed object UNWRAPPED, so this returns data directly.
export async function invokeLLM(params) {
  const { data } = await callWorker('invoke-llm', params);
  return data;
}

// Cultural Info section fetch — see Worker handleCulture. The Worker caches each
// bundle in shared KV with per-section TTL + stale-while-revalidate and returns
// { data, meta } where meta carries server-stamped last_verified_at / expires_at
// / stale. We unwrap to { data, meta, error } for call sites.
// params: { cacheKey, ttlDays, prompt, response_json_schema, forceRefresh }
export async function fetchCulture(params) {
  const { data, error } = await callWorker('culture', params);
  if (error) return { data: null, meta: null, error };
  return { data: data?.data ?? null, meta: data?.meta ?? null, error: null };
}
