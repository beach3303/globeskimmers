# The United States stamp list (founder, 2026-11-22)

"I want you to create also a list for the top most visited places in United States, tourist, and novelty and local."
Built the same way as `../philippines/` and `../china/`, one list for all fifty states and D.C.

- `places.mjs` — the hand-curated places by region (2,744 on 2026-11-22), each `[name, where, state, kind, category,
  visitors]`. **Kind**: `T` tourist landmark (the most visited places; `visitors` is a published count where one exists —
  NPS recreation visits 2024, TEA/AECOM attendance 2023, or the operator's or city's own estimate — else listed by fame),
  `V` novelty (roadside America, world's-largest things, oddball museums, mystery spots), `L` local favorite (what the
  locals send you to: parks, markets, stadiums, institutions, swimming holes). Within a region the output runs T → V → L.
- `db-us-2026-11-22.json` — every US row of the LIVE attractions D1 (20,787 rows; `wrangler d1 execute
  globeskimmers-attractions --remote --json`, country US / United States), the columns the matcher needs.
- `build.mjs` — matches each place to a database row (exact, containment, meaningful-word overlap; extra words cost;
  a row that says less than the place is penalised; a fuzzy match is dropped when it sits outside the place's city
  (150 km, the city located from the database's own rows) or state (450–1,200 km); a `, XX` city suffix that names
  another state is a hard no), then `NO_MATCH` (hand-reviewed false matches) and `FORCE` (rows the lookup found under
  other names). Art: the place's own file name on the server, else an alias of it, else the file its database row wears
  (the same place when the name match is ≥ 90, otherwise "shares"). Files on the server come from
  `../world/uploaded-inventory.json` plus a GET probe of the worker for every other name (`probe-cache.json`).
  Writes `list-2026-11-22.json` and `review-fuzzy.txt` (every match under 100, for a human read).
- `report.mjs` — the PDF (`Claude outputs/Globeskimmers-United-States-2744-places.pdf`, from HTML via headless Chrome).
- `build_xlsx.py` — the workbook (`Claude outputs/Globeskimmers-United-States-stamp-list.xlsx`: Summary · Tourist ·
  Novelty · Local · All by region · To draw with a ✓ column).

Re-run from the repo root: `node scripts/stamp-art/united-states/build.mjs && node scripts/stamp-art/united-states/report.mjs && python3 scripts/stamp-art/united-states/build_xlsx.py`.

**When the art lands:** build one SQL file from `list-2026-11-22.json` — `UPDATE … founder_scope` for the rows that exist
but are not stampable, `INSERT` rows (Wikidata QID + P625 coordinates, else a hand pin) for the missing ones — the way
`../world/resolve_rows2.py` did it for the world tracker. Art file names must stay exactly as the PDF says; a row whose
name differs from the file gets an alias in `src/lib/stampArt.js`.
