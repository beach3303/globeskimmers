# Attractions ranking pipeline (Phase 1 — "most popular" curated layer)

Builds Globeskimmers' owned, ranked **attractions** layer per city from **free, storable**
data: Overture Places (permissive license — storable forever) as the owned POI spine,
enriched with **Wikidata + Wikipedia pageviews** as the fame signal. Output loads into the
existing Cloudflare D1 `attractions` table and powers "Where people go" / "Stamps near your stay".

## Why this exists
A mega-city like NYC has ~16k "tourism" POIs in Overture — you can't show them all. This
pipeline ranks them to the ~top-80 *visitable* attractions per city, so the homepage shows the
places people actually travel to see. Cost ≈ $0 (all sources free/cacheable; the score is
computed once and stored, not rented from Google).

## Pipeline (per city)
1. **Extract** — DuckDB reads Overture's cloud parquet directly (no AWS account) for the city
   bbox, filtered to visitable-attraction categories. Cached to `cache/<key>_overture.csv`.
2. **Join** — a per-city Wikidata bounding-box prefetch (coords + enwiki title + sitelinks) is
   matched LOCALLY to POIs (name + geo). Wikidata titles are the clean display-name backbone;
   an Overture POI nearby is the *visitability* confirmation. Trailing-12-month **human**
   pageviews (`agent=user`) give fame. Pageviews cached in `cache/pageviews.json`.
3. **Filter** (7 gates) — category include/exclude · operating_status alive · demolished-title ·
   Wikidata **type gate** (attraction types in; residential/office/hotel out unless also a
   strong attraction; admin/neighborhood/street/event/person/university hard-out) · notability
   floor · dedup · rank+cut.
4. **Score** — `pop_score` (0–100) = 0.55·norm(log pageviews) + 0.20·norm(log sitelinks) +
   0.25·category_prior, normalized within the city. `is_marquee=1` when pop_score ≥ 55.
5. **Emit** — JSON in the shape `scripts/emit_d1_seed.py` consumes, plus pop_score/pageviews/
   sitelinks.

## Run
```bash
python3 scripts/attractions-rank/seed_city.py nyc          # one city
python3 scripts/attractions-rank/seed_city.py --all        # every city in cities.json
```
Outputs to `out/`: `<key>.preview.txt` (human check), `<key>.attractions.json`,
`seed_attractions.curation.json` (combined). Add cities by editing `cities.json`.

## Load into D1 (operator — needs Cloudflare creds)
```bash
# 1. one-time: add ranking columns
npx wrangler d1 execute globeskimmers-attractions --remote --file scripts/attractions-rank/01_alter_pop_score.sql
# 2. generate SQL from the curation JSON
python3 scripts/attractions-rank/emit_ranked_sql.py scripts/attractions-rank/out/seed_attractions.curation.json
# 3. load
npx wrangler d1 execute globeskimmers-attractions --remote --file cloudflare-worker/sql/seed_attractions_ranked.sql
```
The worker already reads `is_marquee DESC` (so seeded rows surface immediately); a follow-up
worker change to `ORDER BY pop_score DESC` uses the finer ranking.

## Honest limits (per the production recipe)
- Deterministic filtering reaches a **strong candidate set (~85–90% precision)**; the last polish
  to ~99% is a **cached LLM visitability + canonical-name pass** (~1¢/place, cached forever) plus a
  light human QA on the top-25 of flagship cities. This is by design, not a gap.
- **Recall** is high but not guaranteed 100% automatically — islands/ferry sites, multi-part
  institutions, and brand-new openings can lag; a quarterly re-seed + our own tap/wishlist data
  fill the tail.
- Pageviews measure *online prominence* (great for icons, weaker for locally-loved spots) — the
  `owned_engagement` term (taps/wishlist), 0 at seed, strengthens the ranking over time.
- English pageviews over-weight anglophone fame; add local-language pageviews per non-English city.
