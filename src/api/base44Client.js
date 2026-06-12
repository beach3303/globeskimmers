import { createClient } from '@base44/sdk';
import { Capacitor } from '@capacitor/core';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// On the web the app runs ON the Base44 domain, so a relative `/api` base is
// correct (same-origin, no CORS). In the NATIVE app the page is served from
// capacitor://localhost, so a relative `/api` resolves to the local Capacitor
// server and returns index.html instead of reaching the backend. On native we
// therefore point at an ABSOLUTE Base44 API host. base44.app is the SDK's own
// default backend host and is confirmed to serve /api/apps/{appId}/... .
// Exported so other SDK call sites (e.g. AuthContext's public-settings client)
// use the same host.
export const API_HOST = Capacitor.isNativePlatform() ? 'https://base44.app' : '';

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: API_HOST,
  requiresAuth: false,
  appBaseUrl
});
