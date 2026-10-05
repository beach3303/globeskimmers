# Stamp art — which art each stamp gets

The app picks a stamp's bespoke art in `src/lib/stampArt.js` (`stampArtSlug`):

1. **Row id** — `ART_BY_ID[entity_id]` (rows whose name can't carry the art, and the
   Grand Canyon / Niagara variants).
2. **Name** — the stamp name's slug, through the hand-kept `ALIAS` in `stampArt.js`, then
   the generated `ART_ALIAS` (every other name the attractions DB uses for a list place).
3. **Guards** — `ART_ONLY[art]`: when other places share the name (Notre-Dame in Lausanne,
   the Parthenon in Nashville), only the reviewed rows show the art. `ART_CC[art]`: a stamp in
   another country never borrows it.

`src/lib/stampArtIndex.js` is generated — don't edit it by hand.

## Files

- `art-matches.json` — the reviewed match of all 1,000 places in `docs/PASSPORT_ICON_LIST.md`
  to attractions rows (2026-10-04): `same` (rows that are the place), `not` (rows that only
  share its name), `promote` (an existing row to make stampable), `missing` (no row at all),
  `big` + `radius_hint_m` (area places that need a wider "you are here" circle).
- `build-art-index.mjs` — turns it into `src/lib/stampArtIndex.js` and `d1-art-fixes.sql`, and
  fails if any stampable row would get the wrong art.
- `d1-art-fixes.sql` — makes the list places that exist but weren't stampable stampable, and
  widens the circle of big places (never narrows, capped at 20 km). Run it once:
  `npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-art/d1-art-fixes.sql`
  Re-running it is harmless (same values; inserts are `INSERT OR IGNORE`).
- `kv-stale-links.json` — the Google-place links cached for rows the SQL re-pins or renames;
  delete them once after the SQL:
  `npx wrangler kv bulk delete scripts/stamp-art/kv-stale-links.json --namespace-id=68ae9c62099f4834a8c6f0ff3eb57e71 --remote`

## Rebuild

```bash
# 1. Export every attractions row (8,000 per page; 103k rows on 2026-10-04)
for off in $(seq 0 8000 104000); do
  npx wrangler d1 execute globeskimmers-attractions --remote --json \
    --command "SELECT id,name,city,country,lat,lng,qid,tier,scope,founder_scope,category,footprint_radius_m FROM attractions ORDER BY id LIMIT 8000 OFFSET $off" > /tmp/attr_$off.json
done
python3 -c "import json,glob; print(json.dumps([r for f in sorted(glob.glob('/tmp/attr_*.json')) for r in json.load(open(f))[0]['results']]))" > /tmp/attractions.json
# 2. Build
node scripts/stamp-art/build-art-index.mjs /tmp/attractions.json
```

Adding art for a new place: upload `stamp-art/<slug>.png` (slug of the list name), add the
place to `art-matches.json` with its `same` rows, rebuild.
