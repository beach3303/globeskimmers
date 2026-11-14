# The Philippines stamp list (founder, 2026-11-13)

"All I need is the top 300 most popular tourist and locally visited destinations in the Philippines … if more than
that, tell me whether it is 500 or more, and I'll generate stamps and upload them."

- `curated-list.mjs` — the hand-curated places by region (374 drafted; 74 demoted to the next tier), each with
  where, province, tier (W world-famous / N national favorite / R regional favorite) and category.
- `build-report.mjs` — trims to the Top 300, splits the rest into Next 139 and Beyond 209, matches every place to
  the attractions database (`country` 'PH' or 'Philippines'; name match with extra-word penalties; a NO_MATCH list
  for the hand-read mistakes) and to the stamp art on R2, and writes `list-2026-11-13.json`.
- The founder's deliverable: `~/Desktop/Globeskimmers-Philippines-stamp-list.xlsx` (Summary · Top 300 · Next 139
  · Beyond 209) with the exact file name per place (`slug(name).png`, the app's own slug rules).
- Counts at the time of writing: Top 300 = 59 stampable today · 59 in the database but not stampable · 182 missing
  rows · 11 with art already. Realistic ceiling of nationally recognizable places ≈ 440; the 209 beyond are local
  spots the fame bar keeps off the passport (region cards instead).

**When the art lands:** build one SQL file from `list-2026-11-13.json` — `UPDATE … founder_scope` for the 59 that
exist, `INSERT` rows (Wikidata QID + P625 coordinates, else a hand pin) for the 182 missing — so every one of the
300 is stampable with its art the day it is uploaded. Art file names must stay exactly as the sheet says; a row
whose name differs from the file gets an alias in `src/lib/stampArt.js`.
