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
import { refusal } from '@/lib/ageGate';

const WORKER_BASE = 'https://globeskimmers-api.maizasimeon.workers.dev';
const isNative = Capacitor.isNativePlatform();

async function getToken() {
  // getSession() returns the cached session and silently refreshes near expiry.
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function callWorker(path, body = {}, opts = {}) {
  const token = await getToken();
  const url = `${WORKER_BASE}/${String(path).replace(/^\//, '')}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  // Finite timeout backstop: without this, a cold-start / slow / dead Worker (or a
  // stalled Google call) leaves the finder spinning FOREVER and the error UI
  // (Retry / Expand radius) — which lives in the error branch — never renders.
  // On abort we return { error:'timeout' } so that UI shows. The default is
  // generous (25s) so legitimately-slow AI endpoints (invoke-llm/culture/parse)
  // aren't cut off; callers can pass opts.timeoutMs to tighten fast finder calls.
  const timeoutMs = opts.timeoutMs ?? 25000;

  try {
    if (isNative) {
      // CapacitorHttp parses JSON and bypasses WebView CORS. connect/readTimeout
      // are in ms; the native layer rejects on timeout so it can't hang.
      const res = await CapacitorHttp.post({ url, headers, data: body, connectTimeout: timeoutMs, readTimeout: timeoutMs });
      if (res.status >= 400) return refusal(res.status, res.data); // keeps the body; age refusals are announced (src/lib/ageGate.js)
      return { data: res.data, error: null };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return refusal(res.status, json); // keeps the body; age refusals are announced (src/lib/ageGate.js)
      return { data: json, error: null };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    if (e?.name === 'AbortError') return { data: null, error: 'timeout' };
    return { data: null, error: e?.message || 'Network error' };
  }
}

// A raw upload (2026-10-30, clips): PUT a file's bytes as they are, with the member's token. Plain
// fetch on every platform — a 20 MB clip has no business inside a JSON envelope — and the worker
// answers the CORS preflight for PUT. → { data, error } like callWorker.
export async function workerUpload(path, body, contentType, opts = {}) {
  const token = await getToken();
  const url = `${WORKER_BASE}/${String(path).replace(/^\//, '')}`;
  const timeoutMs = opts.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType || 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body, signal: controller.signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return refusal(res.status, json);
    return { data: json, error: null };
  } catch (e) {
    if (e?.name === 'AbortError') return { data: null, error: 'timeout' };
    return { data: null, error: e?.message || 'Network error' };
  } finally {
    clearTimeout(timer);
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
