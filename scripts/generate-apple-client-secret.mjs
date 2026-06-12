// Generate an Apple "Sign in with Apple" client secret (the JWT that goes in
// Supabase → Authentication → Apple → "Secret Key (for OAuth)"). Apple requires
// this be regenerated at most every 6 months. Runs locally with Node — no deps,
// and your .p8 private key + the generated secret never leave your machine.
//
// You need (all are identifiers except the .p8, which is the secret):
//   APPLE_TEAM_ID    — top-right of developer.apple.com (e.g. 6C6X2RV7CC)
//   APPLE_KEY_ID     — Developer → Keys → your "Sign in with Apple" key's Key ID
//   APPLE_SERVICE_ID — the Apple Services ID (e.g. com.simeon3.globeskimmers.signin)
//   APPLE_P8_PATH    — path to the AuthKey_XXXXXXXXXX.p8 you downloaded for that key
//
// If you no longer have the .p8 (Apple only lets you download it once), create a
// new key: Developer → Keys → (+) → enable "Sign in with Apple" → Continue →
// Register → download the .p8 and copy its Key ID. A new key does NOT break the
// existing one until this generated secret replaces it in Supabase.
//
// RUN (one line, fill in your values):
//   APPLE_TEAM_ID=6C6X2RV7CC \
//   APPLE_KEY_ID=ABCDE12345 \
//   APPLE_SERVICE_ID=com.simeon3.globeskimmers.signin \
//   APPLE_P8_PATH="$HOME/Downloads/AuthKey_ABCDE12345.p8" \
//   node scripts/generate-apple-client-secret.mjs
//
// Then copy the printed JWT into Supabase → Apple → "Secret Key (for OAuth)" → Save.
// Do NOT commit your .p8 file or the generated secret.

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICE_ID, APPLE_P8_PATH } = process.env;

const missing = ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_SERVICE_ID', 'APPLE_P8_PATH']
  .filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Missing env vars: ' + missing.join(', '));
  console.error('See the run instructions at the top of this file.');
  process.exit(1);
}

const privateKey = readFileSync(APPLE_P8_PATH, 'utf8');

const now = Math.floor(Date.now() / 1000);
const exp = now + 180 * 24 * 60 * 60; // 180 days (Apple max is 6 months)

const header = { alg: 'ES256', kid: APPLE_KEY_ID };
const payload = {
  iss: APPLE_TEAM_ID,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: APPLE_SERVICE_ID,
};

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const signingInput = `${b64(header)}.${b64(payload)}`;

// ES256 must be raw R||S (ieee-p1363), not DER — Apple rejects DER signatures.
const signature = createSign('SHA256')
  .update(signingInput)
  .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
  .toString('base64url');

const clientSecret = `${signingInput}.${signature}`;

console.log('\nApple client secret (valid 180 days). Paste into Supabase → Apple → "Secret Key (for OAuth)":\n');
console.log(clientSecret);
console.log(`\nExpires: ${new Date(exp * 1000).toISOString()}\n`);
