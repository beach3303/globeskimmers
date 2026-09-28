#!/bin/sh
# Rebuild the film-spots seed review files. Python 3.9+ stdlib only.
# Network: query.wikidata.org (<= 1 req/s), wikidata.org + en.wikipedia.org action
# APIs, wikimedia.org pageviews. s5 needs a logged-in `npx wrangler` (read-only).
# Responses are cached in .cache/ - delete it to refetch live data.
set -e
cd "$(dirname "$0")"
python3 s1_wikidata_spots.py   # stage 1  spot-level P915 filming locations (films + TV)
python3 s6_curated.py          # stage 6  verify the hand-added supplement on Wikipedia
python3 s2_cast.py             # stage 2  two leading cast + roles (all works, incl. curated)
python3 s3_labels.py           # stage 3  labels, city, country, class checks
python3 s4_pageviews.py        # stage 4  enwiki pageviews Sep 2025 - Aug 2026
python3 s5_attractions.py      # stage 5a read-only export of our attractions (D1)
python3 s7_evidence.py         # stage 7a Wikipedia sentences backing each Wikidata pair
python3 s8_build.py            # stages 5b/7/8 dedupe, radius, score, select, write CSVs
