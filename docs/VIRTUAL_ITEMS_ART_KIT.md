# Virtual items & travel buddies — the founder's render kit

The app ships with drawn fallback art; every render you upload REPLACES it on all
phones instantly, no release (same pipeline as the 1,000 stamps and luggage skins).
Written 2026-10-05.

## File names (exact — the full list is scripts/stamp-art/virtual-items-filelist.csv)

- Items (32 files, one per color):  `gear/<item>/<color>.png`
  item: laptop · tumbler · straw-bottle · lid-bottle
  color: pink · white · black · yellow · blue · purple · green · orange
- Pets: `pets/<species>/<breed_key>/<pose>.png`
  pose: sitting · laying · belly-up. Breed keys come from src/lib/petCatalog.js —
  copy them from the CSV, don't guess (it's "french-bulldog", not "frenchie").
  Optional later: per-coat renders at pets/<species>/<breed_key>/<coat_key>/<pose>.png
  (the app tries coat-specific first, then the breed file, then the drawn fallback).
- The CSV's starter_set=YES rows (~160 files incl. the 32 items) cover the 40-ish
  most-owned breeds — the best first batch. All 381 breeds × 3 poses ≈ 1,150 files.

## Specs (same as the stamp batches)

- SQUARE PNG (or WebP/JPG — any works), 1024×1024 or larger, subject centered with
  margin on every side (nothing touching the edges), plain WHITE background.
- One subject per image, no text, no watermark, no brand logos — the items must stay
  generic (no Apple/Yeti/Stanley trade dress; that's a legal line, see LAWYER_BRIEF §3).
- Stickers are overlaid by the APP on items, so render items clean. Pets never take
  stickers. Keep one consistent style across the whole batch.

## Delivery

Drop folders in ~/Downloads like the stamp batches (any folder names; files named per
the CSV, or numbered — Claude matches and uploads to R2 with `npx wrangler r2 object put`,
verifies each live, and the app upgrades itself).
