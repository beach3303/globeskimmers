#!/usr/bin/env node
// prewarm-dream-galleries.mjs — pre-warm the /destination/gallery KV cache for Dreamer's Corner countries
//
//   node scripts/prewarm-dream-galleries.mjs                      # full run (~45 countries × 2 buckets, ~2 min)
//   node scripts/prewarm-dream-galleries.mjs --smoke              # first 3 countries only (verification run)
//   node scripts/prewarm-dream-galleries.mjs --countries "France,Japan,Peru"
//
// What it does: POSTs {name, limit: 30} (and again with bucket: 'food') to the live worker's
// /destination/gallery for each curated country. On a cache miss the worker searches Wikimedia
// Commons server-side, quality-gates the results (≥800px, no maps/flags/SVGs/panoramas), and
// stores the FULL set in KV under `dreamgal:v1:<slug(name)>:<bucket|all>` for 30 days — `limit`
// only slices the response, it never narrows what gets cached. So one pass here means every
// Dreamer's Corner country opens its DreamGallery instantly, photos already waiting.
//
// Cost: $0. The gallery endpoint touches ONLY Wikimedia Commons (free) and KV — no Google
// Places, no paid API anywhere on this path. Re-running is equally free: warm cache hits
// return in ~50ms and rewrite nothing.
//
// KV TTL is 30 days, so RE-RUN THIS MONTHLY (a few days before expiry is ideal):
//
//   node scripts/prewarm-dream-galleries.mjs
//
// Two things to keep in mind:
// - The KV key is a slug of `name + ' ' + country` — BOTH fields. The curated Dreamer's
//   Corner cards tap through as {name: "Santorini", country: "Greece"}, so DESTINATIONS
//   below must be warmed as the same {name, country} PAIRS (a bare "Greece" warm does not
//   help a "Santorini"+"Greece" open). The typed "Dream anywhere" path sends name only —
//   that's what COUNTRIES warms. Honest empties are never cached, so an EMPTY here just
//   means that cell stays a lazy fetch.
// - Calls run sequentially with a ~400ms gap to be polite to Commons (the worker fans each
//   miss out to the Commons search API). Don't parallelize this.

const WORKER_URL = 'https://globeskimmers-api.maizasimeon.workers.dev/destination/gallery';
const DELAY_MS = 400;        // gap between calls — politeness to Commons
const RETRY_DELAY_MS = 1500; // backoff before the single retry
const TIMEOUT_MS = 30000;    // per-request abort
const LIMIT = 30;
const BUCKETS = [null, 'food']; // null = 'all' (the view every open starts on); 'food' warms the founder's viral-eats chip for its first tap

// ~45 top tourist countries, in rough order of visitor volume. Full names on purpose —
// they slug into the KV keys AND search better on Commons than "USA"/"UK"/"UAE".
const COUNTRIES = [
  'France', 'Spain', 'United States', 'Italy', 'Japan',
  'Mexico', 'Thailand', 'Greece', 'Turkey', 'United Kingdom',
  'Germany', 'Portugal', 'United Arab Emirates', 'Indonesia', 'Vietnam',
  'Morocco', 'Egypt', 'Brazil', 'Peru', 'Iceland',
  'Switzerland', 'Croatia', 'Netherlands', 'Austria', 'Australia',
  'New Zealand', 'South Korea', 'India', 'Philippines', 'Costa Rica',
  'Colombia', 'Argentina', 'Canada', 'Ireland', 'Norway',
  'Czechia', 'Hungary', 'Poland', 'South Africa', 'Kenya',
  'Tanzania', 'Jordan', 'Israel', 'Singapore', 'Malaysia',
];

// The curated cards the Dreamer's Corner row actually renders (worker
// HOME_SEASONAL_DESTINATIONS, all four seasons, deduped) — these tap through as
// {name, country} pairs, which is a DIFFERENT cache key than the bare country.
const DESTINATIONS = [
  { name: 'Santorini', country: 'Greece' }, { name: 'Amalfi Coast', country: 'Italy' },
  { name: 'Barcelona', country: 'Spain' }, { name: 'Maui', country: 'Hawaii' },
  { name: 'Nice', country: 'France' }, { name: 'Dubrovnik', country: 'Croatia' },
  { name: 'Zermatt', country: 'Switzerland' }, { name: 'Kyoto', country: 'Japan' },
  { name: 'Vienna', country: 'Austria' }, { name: 'Reykjavik', country: 'Iceland' },
  { name: 'Quebec City', country: 'Canada' }, { name: 'Lapland', country: 'Finland' },
  { name: 'Amsterdam', country: 'Netherlands' }, { name: 'Paris', country: 'France' },
  { name: 'Marrakech', country: 'Morocco' }, { name: 'Lisbon', country: 'Portugal' },
  { name: 'Charleston', country: 'USA' }, { name: 'Munich', country: 'Germany' },
  { name: 'Tuscany', country: 'Italy' }, { name: 'Seoul', country: 'South Korea' },
  { name: 'Vermont', country: 'USA' }, { name: 'Bali', country: 'Indonesia' },
  { name: 'Phuket', country: 'Thailand' }, { name: 'Tulum', country: 'Mexico' },
  { name: 'Maldives', country: '' }, { name: 'Boracay', country: 'Philippines' },
  { name: 'Cairns', country: 'Australia' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function warmOnce(target, bucket) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: target.name, limit: LIMIT, ...(target.country ? { country: target.country } : {}), ...(bucket ? { bucket } : {}) }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.error) throw new Error(String(data.error));
    return Array.isArray(data?.photos) ? data.photos.length : 0;
  } finally {
    clearTimeout(timer);
  }
}

// Retry once on failure (network hiccup, worker 5xx, Commons timeout).
async function warm(target, bucket) {
  try {
    return await warmOnce(target, bucket);
  } catch {
    await sleep(RETRY_DELAY_MS);
    return await warmOnce(target, bucket); // second throw propagates → FAIL
  }
}

async function main() {
  const args = process.argv.slice(2);
  let countries = COUNTRIES;

  const ci = args.indexOf('--countries');
  if (ci !== -1) {
    const raw = args[ci + 1];
    if (!raw) {
      console.error('usage: node scripts/prewarm-dream-galleries.mjs [--smoke] [--countries "France,Japan,Peru"]');
      process.exit(1);
    }
    countries = raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (args.includes('--smoke')) countries = countries.slice(0, 3);

  // Typed-path country warms + the curated card pairs. A --countries/--smoke run
  // stays countries-only (fast verification); the full run covers both.
  const custom = ci !== -1 || args.includes('--smoke');
  const targets = [
    ...countries.map((name) => ({ name, country: '' })),
    ...(custom ? [] : DESTINATIONS),
  ];

  console.log(`Prewarming ${targets.length} targets (${countries.length} countries${custom ? '' : ` + ${DESTINATIONS.length} curated destinations`}) × ${BUCKETS.length} buckets against ${WORKER_URL}\n`);

  let warmed = 0;      // countries with ≥1 non-empty bucket
  let totalPhotos = 0;
  let empties = 0;     // country×bucket cells that returned 0 photos (honest empty, not cached)
  let failures = 0;    // country×bucket cells that failed even after the retry

  for (const target of targets) {
    const display = target.country ? `${target.name}, ${target.country}` : target.name;
    const parts = [];
    let countryPhotos = 0;
    for (const bucket of BUCKETS) {
      const label = bucket || 'all';
      try {
        const n = await warm(target, bucket);
        if (n > 0) {
          parts.push(`${label} ${n}`);
          countryPhotos += n;
        } else {
          parts.push(`${label} EMPTY`);
          empties++;
        }
      } catch (e) {
        parts.push(`${label} FAIL(${e.message})`);
        failures++;
      }
      await sleep(DELAY_MS);
    }
    if (countryPhotos > 0) warmed++;
    totalPhotos += countryPhotos;
    console.log(`${display}: ${parts.join(' · ')}`);
  }

  console.log(`\nDone. ${warmed}/${targets.length} targets warmed · ${totalPhotos} photos cached · ${empties} empty buckets · ${failures} failures`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`fatal: ${e.message}`);
  process.exit(1);
});
