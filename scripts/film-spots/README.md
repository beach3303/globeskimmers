# Film-scene stamps: seed data (review copy)

Built 2026-09-28 with the founder's defaults: **400 spots**, **TV series included**, and a place
that already has a top-spot stamp **keeps its stamp and gains a film line** (`action =
film_line_on_existing`). These are review files only. Nothing here has been loaded into any
database. The only database access is the read-only D1 export in `s5_attractions.py`, which runs
`SELECT` and `PRAGMA` statements only.

## Files

| File | What it is |
|---|---|
| `seed_400.csv` | The 400 chosen spots, best score first, one row per spot. `also_in` lists the spot's other works. |
| `review_40.csv` | The 40 seed rows that most need a human look. `why` gives the reasons in plain words. |
| `candidates.csv` | Every candidate (work × spot) from both sources, with flags. 1,488 rows. |
| `curated_evidence.csv` | For each hand-added claim, the Wikipedia sentences that support it. |
| `wikidata_evidence.csv` | For each Wikidata pair, the Wikipedia sentences that name it. This is the starting point for writing scenes. |
| `curated_input.py` | The hand-added claims, plus the `REJECTED` list (claims dropped because nothing sourced them). |
| `curated_scenes.py` | One scene line per curated claim, written only from its evidence. |
| `data/*.json` | Intermediate outputs of each stage (small; kept so a reviewer can trace any row). |
| `.cache/` | Raw HTTP responses and the D1 export. It is git-ignored. Delete it to refetch live data. |

`s9_load_sql.py` was added to this folder separately. It is not part of this build and was not run.

## Re-running

```sh
scripts/film-spots/run_all.sh
```

This uses Python 3.9+ with the standard library only; nothing needs installing. `s5` needs a
logged-in `npx wrangler`. Every response is cached under `.cache/`, so a second run reproduces the
same files offline. The order is s1 → s6 → s2 → s3 → s4 → s5 → s7 → s8. s6 runs before s2 so that
the curated works also get cast.

Every request sends the User-Agent `GlobeSkimmersSeed/1.0 (founder@globeskimmers.io)`. WDQS calls
are spaced at ≥ 1.1 s. HTTP 429 and 5xx responses back off, honouring `Retry-After`.

## Pipeline and counts (run of 2026-09-28)

**Stage 1: Wikidata filming locations** (`s1_wikidata_spots.py`, P915).
- Works are films (`wd:Q11424`, sitelinks ≥ 40) and TV series (`wd:Q5398426`, sitelinks ≥ 30).
  Television miniseries (`wd:Q1259759`) were added too, for Chernobyl and Band of Brothers.
- Each work needs an IMDb ID (P345) or a Rotten Tomatoes ID (P1258).
- Each location needs coordinates (P625). A location is dropped when
  `?loc wdt:P31/wdt:P279* ?coarse` hits the 12 city/country classes in the brief.
- Two extra queries were run:
  1. P915 statements that carry a P625 qualifier (any location class).
  2. P915 on season and episode items of a series (`?part wdt:P179 ?work`). The series item for
     Game of Thrones only lists countries, so this is where its locations are.
- The film query timed out twice (HTTP 504) and then succeeded. A split by decade is coded as the
  fallback but was not needed.

| Query | Rows |
|---|---|
| Film, location has its own coordinates | 1,068 |
| Film, coordinate from a qualifier | 10 |
| TV, location has its own coordinates | 164 |
| TV, coordinate from a qualifier | 10 |
| TV, season/episode level | 180 |
| **Unique total** | **1,407 rows / 511 works / 961 locations** |

The previous run (~1,174 rows, 437 films, 816 locations) had no IMDb/Rotten Tomatoes requirement,
so these numbers are close to it.

The main query:

```sparql
SELECT DISTINCT ?work ?sl ?loc ?coord WHERE {
  VALUES ?cls { wd:Q11424 }            # tv: wd:Q5398426 wd:Q1259759, floor 30
  ?work wdt:P31 ?cls ; wikibase:sitelinks ?sl .
  FILTER(?sl >= 40)
  FILTER EXISTS { { ?work wdt:P345 [] } UNION { ?work wdt:P1258 [] } }
  ?work wdt:P915 ?loc .
  ?loc wdt:P625 ?coord .
  FILTER NOT EXISTS { VALUES ?coarse { wd:Q515 wd:Q6256 wd:Q3957 wd:Q532 wd:Q7930989 wd:Q10864048
      wd:Q56061 wd:Q486972 wd:Q1549591 wd:Q5119 wd:Q35657 wd:Q107390 } ?loc wdt:P31/wdt:P279* ?coarse . }
}
```

**Stage 2: cast** (`s2_cast.py`).
- Source: P161 statements with a P453 character qualifier (or the P4633 string), 50 works per
  `VALUES` batch. Labels use `en,mul`.
- Billing order: P1545 when present. Otherwise the order of the P161 statements on the item, read
  from `wbgetentities`; those lists are mostly the Wikipedia "Starring" order.
- Result: 568 works (511 Wikidata + 57 curated). 417 have two leads with a role. The other 151 are
  flagged `needs_roles`.
- Other cast flags:
  - `lead_without_role`: the top-billed actor has no role.
  - `cast_skips_unroled(...)`: a higher-billed actor with no role was passed over.
  - `large_cast(N)`: a TV series whose "two leads" need picking by hand.

**Stage 3: labels** (`s3_labels.py`).
- Labels in English (with the `mul` fallback).
- City: the first city or town up the P131 chain, with metro names for boroughs (London, NYC, Paris,
  Tokyo and others).
- Country: P17 → P297. Hong Kong and Macau get HK and MO.
- Result: 1,056 spots. 76 have no city and 14 have no country.
- Also collected here: area (P2046), P576 (dissolved/demolished), and the stamp bar's classes
  (airport, highway, corporate HQ, military base, prison, hospital, power station).

**Stage 4: fame** (`s4_pageviews.py`).
- English-Wikipedia pageviews from 2025-09-01 to 2026-08-31 for 903 articles, all non-zero.
- Score = work sitelinks × log10(1 + spot pageviews).
- Three curated spots have no article of their own (Maya Bay, Supertree Grove, Hotel Sidi Driss).
  They use the article they were verified on and are flagged `pageviews_proxy`.

**Stage 5: dedupe** (`s5_attractions.py` exports, `s8_build.py` matches).
- The export has 102,294 attractions, of which 12,916 are stampable (`is_marquee = 1`).
- A candidate matches a stamped attraction, and becomes `film_line_on_existing`, when:
  1. it has the same QID, or
  2. it is within 150 m, or
  3. it has the same normalised name in the same country.
- One deviation from the brief: when both places have different Wikidata items *and* different
  names, being within 150 m is treated as a neighbour, not a match. Café des 2 Moulins is 132 m
  from the Moulin Rouge, and the Rocky Steps are 138 m from the museum's point. Such rows stay
  `new_spot` with the flag `possible_dup:near_stamp_distinct_item(...)`.
- Unstamped attraction rows never change the action. They are noted as `reuses_unstamped_row(id)`
  so the loader can reuse the row instead of adding a duplicate.

**Stage 6: hand-added supplement** (`s6_curated.py`).
- 133 claims were checked. 132 were verified against English Wikipedia. Seopjikoji was dropped
  because its item has no coordinates.
- The verified claims cover **114 spots**. They are in Asia, Africa, Latin America and the
  Caribbean, the Middle East and the Pacific, plus three spots the founder named that Wikidata
  misses: the Rocky Steps, Café des 2 Moulins and the Joker Stairs.
- Coordinates always come from the item's P625, or the article's GeoData in one case. They were
  never typed by hand.
- 18 claims were rejected because no Wikipedia text supports them. They are listed in
  `curated_input.REJECTED`: the Jesuit Stairs in Dubrovnik, the Parasite stairs, Pagsanjan Falls,
  Wallilabou Bay and others.

**Stage 7: radius, plus a Wikipedia check** (`s7_evidence.py`).
- Radius comes from the class labels, using the brief's five bands. The rule is written out in
  `radius_rule`.
- The Wikipedia check: for each of the 1,367 Wikidata pairs, look for a sentence that names the
  work in the spot's article, or names the spot in the work's article, next to a filming word.
  648 pairs have one; they are flagged `wp_mention`, the rest `no_wp_mention`.

**Stage 8: selection** (`s8_build.py`).
- 1,488 candidates group into 1,038 spots.
- Rows marked `not_a_spot`, `studio_backlot`, `class_ban`, `area_too_large` (over 25 km², unless
  it links to an existing stamp), `demolished_or_closed` (since 1950), `needs_spot_name` or
  `no_country` are excluded. That leaves 690 eligible spots, of which 425 are backed by Wikipedia
  text.
- Each spot's primary work is the one with the most sitelinks. A statement on the work itself beats
  one found only on an episode. This stops Doctor Who episodes claiming Central Park.
- Order of selection:
  1. rows backed by Wikipedia text (`wp_mention`, and every curated row), by score;
  2. then, only if still short, the unbacked rows.
- The two floors are then enforced by swapping: at least 100 rows outside the US and UK, and at
  least 60 curated non-Western rows.
- `REQUIRE_WP_MENTION = False` in `s8_build.py` restores pure score order.

**Seed result:**

| Measure | Count |
|---|---|
| Rows | 400 |
| From Wikidata | 301 |
| Curated | 99 (96 of them non-Western) |
| Outside the US/UK | 198 |
| TV | 49 |
| `film_line_on_existing` | 150 |
| `needs_roles` | 65 |
| Scene still to write | 301 (Wikidata rows) + 28 curated rows with a generic line |

Top countries: GB 105, US 97, FR 20, IN 15, DE 14, JP 10, IT 9, TR 8, CA 8, TN 7.

`review_40.csv` spreads its 40 rows across uncertain dedupe (12), missing or odd roles (10, one per
work), city-level or large-area spots (8), weak evidence, animation or prison class (5), and low
score (5), then tops up by weight.

## Flags glossary (the main ones)

| Flag | Meaning |
|---|---|
| `needs_scene` | Wikidata row; the scene is written in the next phase. |
| `scene_generic` | Curated row whose evidence only says "filmed here". |
| `needs_roles` | Fewer than two leads with a role on Wikidata. |
| `lead_without_role` | The top-billed actor has no role. |
| `cast_skips_unroled` | A higher-billed actor with no role was passed over. |
| `large_cast` | A TV series whose two leads need picking by hand. |
| `city_level_suspect` | May be a town or area rather than a spot. |
| `large_area_centroid` | Large area; the coordinate is a centroid. |
| `coord_from_qualifier` | The coordinate comes from a P915 qualifier. |
| `possible_dup:*` | Uncertain dedupe. Covers a name mismatch within 150 m, a similar-named stamp 150–400 m away, a neighbouring distinct item, and two seed spots under 150 m apart. |
| `inside_stamp_footprint` | The spot sits inside an existing stamp's footprint. |
| `evidence_weak` | The source only says "inspired" or "photographed backgrounds". |
| `animated_depiction` | Animated work: the place is depicted, not filmed. |
| `review_class` | A heritage prison, hospital or power station. |
| `via_season_or_episode` | The link is on a season or episode item, not the series. |
| `wp_mention` / `no_wp_mention` | Whether a Wikipedia sentence names the pairing. |

## Licences and sources

- **Wikidata** (labels, P915, cast, IDs): CC0.
- **Wikimedia pageviews REST API**: public, no key, used under the Wikimedia terms.
- **Wikipedia sentences** in the two evidence CSVs are CC BY-SA 4.0 text, quoted for internal
  review. The scene lines in `curated_scenes.py` are our own short wording, not copies.
- IMDb IDs are Wikidata P345 identifiers only.
- No scraping of IMDb, TMDB, movie-locations.com or Atlas of Wonders.
- No stills or posters are collected.

## Known gaps

- **Roles are thin for non-English films.** Sholay, 3 Idiots, In the Mood for Love, Crazy Rich
  Asians and Kong: Skull Island all have fewer than two roled leads. The review sheet or a TMDB
  agreement would fill them.
- **The class filter drops some forts and castles.** The brief's coarse-class closure removes forts
  and castles that Wikidata types under human settlement or administrative entity. Himeji Castle,
  Mehrangarh and Jaisalmer Fort come in only through the curated list.
- **Low film sitelinks sink famous spots.** Nami Island (Winter Sonata), Jaisalmer Fort
  (Sonar Kella), Chapora Fort (Dil Chahta Hai), Jiufen and Betaab Valley are verified but fall
  below the cut. They are in `candidates.csv`.
- **Large areas use a centroid.** 39 seed rows (Wadi Rum, Hạ Long Bay, Lake Como, Martha's Vineyard
  and others) have a centroid as the coordinate. A real scene point needs picking by hand.
- **Some Wikidata spots are not visitor places.** Labs, colleges and stadiums remain. They are
  legitimate P915 values but weak stamps, so they are worth a skim.
- **Some founder examples are still missing.** The Jesuit Stairs in Dubrovnik has no Wikipedia
  sentence tying it to Game of Thrones. The Parasite stairs has no item with coordinates.
- **Live data drifts.** WDQS and pageview results change over time. The `.cache/` directory pins
  this run.
