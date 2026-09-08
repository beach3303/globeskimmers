---
name: stamp-worthiness-philosophy
description: Founder's rule for which places earn passport stamps — absolute fame bar (world/national/regional icons, natural wonders, event-gated venues), never top-N per city; local parks never stamp
metadata:
  type: feedback
---

Maiza (2026-09-01, standing in Valencia CA seeing neighborhood parks in "Stamps near your stay"):
stamps must be MEANINGFUL. The old model ranked top-N per city, which guarantees junk in
untouristy cities; the Google background auto-seed added local parks/churches with no fame filter.

**Why:** A stamp is a trophy of travel. Duane R Harte Park as a stamp destroys the value of the
Eiffel Tower stamp. A city may legitimately have ONE stamp (Valencia → Six Flags Magic Mountain)
or ZERO — nearby cities' icons fill the rail because stamp-hunters drive.

**How to apply:**
- A place earns a stamp by clearing an ABSOLUTE bar, not by being a city's best. Scopes:
  world icon → national icon / pride-of-nation (Rizal Park, Intramuros, Banaue, Magellan's Cross) →
  regional icon (people cross a county/state line: Six Flags, Huntington, Santa Monica Pier) →
  natural wonders always in (Niagara, Grand Canyon rims, Twelve Apostles, reef).
- Event venues (stadiums/arenas: Dodger Stadium, Rose Bowl, Crypto.com) stamp ONLY with a
  same-day game/show — "Watched a game at" + matchup + date, our typography, NO team logos
  (copyright). See [[project_city_prides_stamps]] and ROADMAP #24b.
- LOCAL spots (neighborhood parks, churches, Arboretum-tier, generic Chinatowns) NEVER stamp,
  even if they top the city's list — they stay browsable in Things To Do only.
- Signals (free): Wikipedia pageviews + Wikidata sitelink count (+ heritage P1435); thresholds
  calibrated 2026-09-01 against Maiza's own yes/no examples (LA basket, NYC, DC, Manila, Sydney).
- STATUS 2026-09-02: the bar is LIVE in D1 (65 world · 424 national · 299 regional · 918 local · 95 dupes retired); worker stampsOnly filter DEPLOYED 2026-09-02 (push-all). Founder-review queue: Sorbonne, La Bastille, Gothic Quarter, Nanjing Road.
- The GLOBAL seed (22.8k cities) must ship WITH this bar — do not seed the world on the old model.
- Existing D1 rows get re-scored: local rows demoted out of the stamps rail, kept for browse.

**Atlas applied (2026-09-03):** the Global Stamp Atlas is live in production D1 — 1,317 `source='icons'` rows (id `icon:<qid>`), founder_scope = founder's blessing, scope = measured fame bar. Dedup priority: founder > icons > curated > wikivoyage > ranked > auto; demotion clears founder_scope (double-stamp hole closed). Browse filters `class_ban` rows (review:* stay browsable). 23 places had no confident enwiki/Wikidata identity → `scripts/attractions-seed/data/atlas-founder-manual.json` awaits the founder's coords-or-drop call.

**PLANET LIVE (2026-09-04):** global seed loaded+scored+deduped — 102294 rows, **18654 stampable worldwide**. Valencia = Six Flags only at planet scale. Remediation architecture: P625 dup-repair → class demotions (mall/city/work) → P279-closure subclass sweep; caches in scratchpad global-score/ make re-passes ~free. Review-lane residuals for founder: stadiums (await event-gated stamping), Shinjuku Station, NYSE, Harrods/Galleria (demoted as malls — founder-lane can promote).

**Stamp ART mechanics (audited 2026-09-08):** art is NOT a data field — stampArtUrl(name) looks up R2 stamp-art/<slug>.png; 404 → TypographicStamp fallback. Adding art for any place = upload the PNG (no release); optional ALIAS in src/lib/stampArt.js. Lake Louise = curated #86 (has PNG); "Banff" city has none → typographic. GPS NEVER gates art — it only sets verified:'gps' (the ✓ badge) + picks multi-viewpoint variants. "Stamp a place" search modal always mints kind:'city', verified:'self' (founder wants searched/remote stamps to still get the full "I was here" treatment — YES, art is not gated). BUG FIXED 2026-09-08: PassportBook.jsx StampToken isCity branch was text-only and dropped the engraved art/TypographicStamp on the keepsake page; now city stamps render art-or-typographic + "Visited / I was here @" caption.
