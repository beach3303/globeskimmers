# The China stamp list (founder, 2026-11-14)

Mainland China only; Hong Kong and Macau get their own lists. Built the same way as `../philippines/`:

- `curate.py` — the hand-curated places by region (611 on 2026-11-14), each with where, province, tier
  (W world-famous / N national favorite / R regional or local favorite) and category; it matches every place to the
  attractions export (`scripts/film-spots/.cache/attractions_export.json`, Sept 28; `country` CN or China) by exact,
  core-token and fuzzy name with a same-city preference, then by `aliases.json` (hand-reviewed: name → row id, or ""
  for "no row"), then by the icon rows in `../art-matches.json` for the 33 Chinese places that already have art.
- `list-2026-11-14.json` — the result: file name per place (`slug(name).png`, the app's slug rules), dbId/dbScope,
  status (Stampable today · Exists — needs promotion · Missing — needs a database row), art on R2.
- The founder's deliverable: `Claude outputs/Globeskimmers-China-611-places.pdf` (also on the Desktop).

Counts on 2026-11-14: 54 W · 196 N · 361 R; 180 stampable today · 148 in the database but not stampable · 283 missing
rows · 33 with art already.

**When the art lands:** build one SQL file from `list-2026-11-14.json` — `UPDATE … founder_scope` for the 148 that
exist, `INSERT` rows (Wikidata QID + P625 coordinates, else a hand pin) for the 283 missing — plus footprint radii for
the big grounds (the Great Wall sections, Zhangjiajie, West Lake, the Bund, Tiananmen/Forbidden City, Chimelong, Disney).
Art file names must stay exactly as the PDF says; a row whose name differs from the file gets an alias in
`src/lib/stampArt.js`.
