# Stamp merge — skeptic review (2026-10-08)

Read-only review of docs/plans/stamp-merge.md and scripts/stamp-merge/ before any build. **Every high and medium finding must be resolved before 02_merge.sql is generated.**

## [HIGH] The founder's decisions get overridden without the founder being asked

**What breaks:** The founder's decisions get overridden without the founder being asked. The plan tells the founder that composite icons, founder-scope conflicts and twins 0.5 to 25 km apart wait for the founder's answer ('593 merge, 63 wait'; 'unanswered groups simply stay as they are'). The generator does not do this. It merges 28 composites, 15 founder-scope conflicts, 15 big-footprint groups and 3 partial groups, 79 groups in all, plus 49 non-area twins that sit 0.5 to 36 km apart. Examples: Salar de Uyuni at 36 km, Kangaroo Island Wildlife Park into Kangaroo Island at 6.5 km, Lumbini at 4.9 km, Cape of Good Hope into Cape Point at 1.2 km. Step C3 then sets founder_scope=NULL on every alias, which erases the founder's own 'world' pick on rows such as icon:kawasan-falls, icon:monte-alban and icon:sacsayhuaman, where the survivor keeps 'national'. The plan's counts no longer match the generator's either: 593/63 vs 930/54, 89 vs 177 scope cases, 43 vs 44 ghosts. The plan also names build.mjs and decisions.csv, which do not exist; the script is build-map.mjs.

**Where:** docs/plans/stamp-merge.md:102-109,196 vs scripts/stamp-merge/build-map.mjs:81-87 (HAND composites block:false), :346 (5 km floor in distanceCore), :461-466 (founder-scope conflict only flagged)

**Fix:** Make the generator match C6: hold composites, founder-scope conflicts and non-area twins over 500 m until decisions.csv is answered. Or rewrite C6 and get the founder's explicit yes on the 79 'merged, please confirm' groups before 02_merge.sql is generated. Copy each alias's founder_scope into the undo file and into decisions.csv so the founder's pick is visible, not silently cleared.

## [HIGH] A private trip note can become public without ever being checked

**What breaks:** A private trip note can become public without ever being checked. When two stamps are folded into one, the plan says 'join both notes' but never mentions note_public. Private notes are never moderated, because moderation only runs when a note is shared (worker 13685-13687). If the kept stamp's note is public and the other one is private, the private text goes public. The joined note can also run past the 280-character limit (13683), and the next time the traveler edits it the end is cut off.

**Where:** docs/plans/stamp-merge.md:136 (E step 1); worker handlePassportStampNote 13673-13690

**Fix:** Join notes only when both have the same visibility. Otherwise keep the kept stamp's note and visibility, and store the other note privately in meta.merged_note. Set note_public = kept AND loser. Cap the joined note at 280 characters and put the overflow in meta.

## [MEDIUM] Guestbook notes signed on an alias's page disappear, and the safety check cannot see them

**What breaks:** Guestbook notes signed on an alias's page disappear, and the safety check cannot see them. Most guestbook notes are filed under the place's Google id. B2 deliberately leaves the alias's own Google id out of the merged page's book, and E leaves those rows where they are. Once the alias forwards to the canonical, nothing shows them. Read-only KV today: of 1,902 twin ids only 10 have a Google id cached, and exactly 1 pair disagrees, the Hollywood Walk of Fame. The curated row maps to ChIJXyC7WTu_woARPvVMCHBXd4U and the canonical icon:Q71719 to ChIJjwu2pOa_woARViWxZ-MRAu4. Every note, doodle and photo on the curated Walk of Fame page vanishes after the merge. preflight-supabase.sql only counts notes filed under raw alias D1 ids, so it will report 0.

**Where:** docs/plans/stamp-merge.md:63 and E 'Must NOT move'; worker gbEntityIds 19841-19860; scripts/stamp-merge/preflight-supabase.sql (guestbook_on_alias section)

**Fix:** Add each alias's Google id to the set of ids the guestbook reads from (only when it differs; writes stay on the canonical). Drop one only when the divergence report says it is a different real place. Add a preflight section that counts guestbook_entries and owner_notes filed under alias Google ids taken from KV.

## [MEDIUM] A GPS stamp that works today at the edge of an alias's area will fail after the merge

**What breaks:** A GPS stamp that works today at the edge of an alias's area will fail after the merge. Plan C2 promises the new radius covers 'distance to the alias + the alias's radius'. The code only covers the distance, and it only counts an alias's explicit footprint, ignoring the radius its category gives it. Measured on the build-map cache: 207 stampable aliases have a far edge more than 50 m outside the new canonical radius, 12 of them by more than 500 m. Examples: Yellowstone curated needs 26.4 km and gets 20.4 km. Plitvice needs 9.2 km and gets 6 km. Beau Vallon, where the visible alias icon:Q7479348 has a 1.8 km beach radius, gets 1.02 km. Cape of Good Hope needs 4.2 km and gets 3 km. After canonicalization, handlePassportStamp measures against the canonical's radius (13049-13050), so these travelers get 'not here'.

**Where:** scripts/stamp-merge/build-map.mjs:404-405 (own = explicit footprint only; reach = distance only)

**Fix:** Use own = stampRadius(t) and reach = distM(c,t) + stampRadius(t). Keep the over-1 km growth flag. Fix obviously wrong alias categories first so they don't inflate the radius (for example curated Vittoriano is tagged theme_park).

## [MEDIUM] Stamps that point at ids already deleted from the table stay broken, and the merge won't catch them

**What breaks:** Stamps that point at ids already deleted from the table stay broken, and the merge won't catch them. Plan C5 says signposts are also made for 'Supabase stamp ids that match no D1 row'. But step H puts the Supabase preflight at step 7, after 02_merge.sql runs at step 4, and build-map only looks at art, film scenes and parent links. dedupe_twins.sql deleted about 1,078 icon:<slug> rows on 2026-09-30, for example icon:9-11-memorial-museum and icon:six-flags-magic-mountain. Any traveler stamp on those ids keeps a dead 'See this place' and never makes it into the Supabase map. REPORT.md's 'Before the merge runs' already orders this correctly; plan H contradicts it.

**Where:** docs/plans/stamp-merge.md:95 and H steps 4/7; build-map.mjs refs collection (artMatches/film/parents only)

**Fix:** Have the founder run preflight-supabase-held-ids.sql (read-only) before generating 02_merge.sql. Feed the unknown ids into the ghost pass, using dedupe_twins.sql's name-to-wikidata pairs to find each one's survivor.

## [MEDIUM] Stamps could be moved to the wrong survivor, or not moved at all

**What breaks:** Stamps could be moved to the wrong survivor, or not moved at all. build-map reads live data, and the auto-seed adds rows every day. If the map is regenerated after step 4, for example after the founder answers decisions, the Supabase migration at step 7 can disagree with what D1 actually merged.

**Where:** docs/plans/stamp-merge.md:133 (E step 0: map loaded from a generated VALUES list)

**Fix:** Generate the migration's VALUES from D1 immediately before step 7: SELECT id, merged_into FROM attractions WHERE merged_into IS NOT NULL, plus the signposts. Do not use alias-map.json for this.

## [MEDIUM] Some stamps lose their art

**What breaks:** Some stamps lose their art. Plan F says 'Art and earned status still work, because the server forwards old ids'. That is wrong for art: the app picks art from stamp.entity_id and the art index built into the app (stampArt.js:53-66), and the server takes no part. I simulated it with today's index: once step 7 rewrites entity_id, icon:Q64436 holders lose the Arc de Triomphe art, because ART_ONLY['arc-de-triomphe'] lists only icon:Q64436 (stampArtIndex.js:454). wikidata:Q2536763 holders lose the Lima art: their stamp's saved name is 'Plaza Mayor', which hits ART_ONLY['plaza-mayor'] (Madrid's wikidata:Q1123493), so the 'plaza-mayor-of-lima' alias the plan relies on never applies. Separately, the un-hidden curated Arc de Triomphe shows a plain text stamp instead of art until a new index ships.

**Where:** docs/plans/stamp-merge.md:155-156; src/lib/stampArtIndex.js:444,454

**Fix:** In the regenerated index, add ART_BY_ID['icon:Q2536763']='historic-center-of-lima' and add curated:france-paris-arc-de-triomphe to ART_ONLY['arc-de-triomphe']. Make stampArtSlug also try meta.design_id (the old id). Hold step 7 until Capgo shows the OTA has reached most phones.

## [LOW] The Sydney Harbour Bridge ghost id is left with nothing to point at

**What breaks:** The Sydney Harbour Bridge ghost id is left with nothing to point at. Travelers holding curated:australia-sydney-sydney-harbour-bridge (art place #68) keep a dead 'See this place' and get no guestbook check mark. This happens because the whole Q54495 group is held over the 'Bridge Climb' sub-place, even though icon:Q54495 'Sydney Harbour Bridge' is live and clearly the right target. Other sub-place holds block their real twins the same way.

**Where:** build-map.mjs resolveByArt/canonOf (held groups return null); needs-human.json Q54495

**Fix:** Hold only the sub-place row and leave the rest of the group alone. Or let resolveByArt accept a held group's live row whose name equals the art place's name.

## [LOW] Iguazu has the same two-countries problem that Niagara was held for, but it merges

**What breaks:** Iguazu has the same two-countries problem that Niagara was held for, but it merges. wikidata:Q36332 'Iguazu Falls' is hidden, but its scope is world, so it can be stamped. It merges into icon:Q36332 'Iguazu Falls (Brazil side)'. A traveler who stamped the neutral row from Argentina gets forwarded to a Brazil-side page.

**Where:** alias-map.json wikidata:Q36332; HAND has Q34221 but not Q36332

**Fix:** Hold Q36332 as 'two-sides' like Niagara, or give the canonical a neutral name.

## [LOW] Between the D1 merge (step 4) and the OTA (step 6), places a traveler collected under an alias show as not collected (Dr

**What breaks:** Between the D1 merge (step 4) and the OTA (step 6), places a traveler collected under an alias show as not collected (DreamShelf.jsx:149), and NearbyStampPrompt.jsx:68 offers the stamp again.

**Where:** docs/plans/stamp-merge.md H steps 4-6

**Fix:** Ship the app commit and run the OTA before step 4. Reading canonical_id and design_id does nothing until those fields exist.

## [LOW] Folding two stamps can hide one from the traveler's public passport

**What breaks:** Folding two stamps can hide one from the traveler's public passport. The rule 'hidden if either was hidden' takes a public stamp, with its friends' reactions and photos, off the shared passport.

**Where:** docs/plans/stamp-merge.md:136

**Fix:** Keep the visibility of the stamp that carries the public reactions and photos. Or keep the kept stamp's own setting and list the cases for review.

## [LOW] Folding two stamps can undo the traveler's own choices

**What breaks:** Folding two stamps can undo the traveler's own choices. Filling meta.film from the other stamp brings back a film the traveler removed (removing a film deletes meta.film and leaves no marker, worker 14032). If the traveler had paired the two twins on one booklet page, page_with ends up pointing at the stamp itself, which the layout handler forbids (14022).

**Where:** docs/plans/stamp-merge.md:136-139

**Fix:** Do not copy film into the kept stamp. Remove any page_with that would point at the kept stamp's own id.

## [LOW] Some travelers keep two stamps for one place

**What breaks:** Some travelers keep two stamps for one place. The fold-together step groups by (user, kind, canonical), so a traveler with an 'attraction' stamp and an older 'icon' or 'wonder' stamp (both valid kinds in PP_KINDS) for the same place keeps both. The plan also assumes only two stamps per place.

**Where:** docs/plans/stamp-merge.md:134; preflight-supabase.sql coll CTE

**Fix:** For kinds attraction, icon and wonder, group by (user, canonical) and handle any number of stamps.

## [LOW] Two promised merges won't happen

**What breaks:** Two promised merges won't happen. The founder was told the merge 'removes the Getty Center and Getty Museum double', but NAME_PAIRS is empty and the pair is only flagged. The founder's own 2026-10-08 hand-merge marks the Huntington wv row as a duplicate of icon:Q1400558, but the map lists it as an orphan and does not forward it.

**Where:** build-map.mjs:100 (NAME_PAIRS = []); scripts/attractions-fixes/2026-10-08-la-dream-shelf.sql

**Fix:** Once the founder confirms, add both pairs to NAME_PAIRS. Until then, correct the message about the Getty.

## [LOW] Re-running two old seed scripts would undo the merge

**What breaks:** Re-running two old seed scripts would undo the merge. load_city_icons.sql has about 1,130 UPDATE statements keyed by qid (for example WHERE qid='Q9202') that make signposts stampable again. dedupe_twins.sql deletes rows by id, including signpost ids such as icon:mont-saint-michel (line 744). C7 names dedupe_twins.sql and boost_global_fame.sql but not load_city_icons.sql.

**Where:** docs/plans/stamp-merge.md:111

**Fix:** Add load_city_icons.sql to C7, add 'merged_into IS NULL' guards to all three scripts, and re-run the G invariants after any of them.

## [LOW] The worker rollback doesn't work as the plan describes

**What breaks:** The worker rollback doesn't work as the plan describes. Once step 4 has run, merged_into is no longer empty. Reverting only the worker then serves the hidden signpost rows (scope local, marked duplicate) for old ids on /attractions/get and /activities/one.

**Where:** docs/plans/stamp-merge.md:185

**Fix:** After step 4, a worker rollback must come with 02_undo.sql.

## [LOW] If 02_merge

**What breaks:** If 02_merge.sql fails partway, a place can lose its only visible row. If the alias demotions run before the canonical un-hides, one of the 28 fully hidden places (Eiffel Tower, Louvre and others) has nothing visible. Signpost INSERTs that leave out the NOT NULL columns (name, category, lat, lng, country) will fail.

**Where:** C3/C5 statement order

**Fix:** Put the canonical fills and un-hides first and the demotions last. Fill every NOT NULL column in the signpost rows.

## [LOW] The KV copy can overwrite a newer value

**What breaks:** The KV copy can overwrite a newer value. kv bulk put overwrites without checking, and step 5 runs after step 4, so a Google id resolved for a canonical in between would be replaced. Today this affects nothing: no alias has a Google id where its canonical lacks one.

**Where:** docs/plans/stamp-merge.md:118-124,200

**Fix:** Rebuild kv-copy.json right before applying it, skip keys that now exist, and run it before step 4.

## [LOW] A traveler's city-collector luggage sticker can disappear

**What breaks:** A traveler's city-collector luggage sticker can disappear. Folding two stamps can drop their city count below the 3-stamp threshold (labels.js:66-70), and the sticker they placed goes with it.

**Where:** src/lib/labels.js:66-70

**Fix:** Accept it, or count distinct canonical places when deciding the label.

## [LOW] Composite merges fold two separate visits into one stamp

**What breaks:** Composite merges fold two separate visits into one stamp. For example, wikidata:Q244952 'Saint Mary of the Graces' (the church; scope world, so stampable) merges into 'The Last Supper', which is the separately ticketed refectory. A traveler holding both loses one in the fold. The Sistine Chapel stays doubled: wikidata:Q2943 remains visible next to the icon:Q182955 composite.

**Where:** build-map.mjs HAND composites

**Fix:** Let the founder decide on composites before 02_merge.sql runs (see the first finding).

## Spot checks and notes

```json
{
 "spot_check": [
  {
   "alias": "curated:united-states-new-york-lincoln-center (Lincoln Center, hidden, local)",
   "canonical": "wikidata:Q581044 (Lincoln Center for the Performing Arts, live, national)",
   "distance_m": 53,
   "verdict": "right"
  },
  {
   "alias": "auto:united-states-san-francisco-alcatraz-island (hidden, local)",
   "canonical": "icon:Q131354 (live, founder national, 400 m footprint)",
   "distance_m": 31,
   "verdict": "right"
  },
  {
   "alias": "wikidata:Q145151 The National Monument (hidden, but scope national, so stampable today)",
   "canonical": "icon:Q145151 National Monument (Monas) (live, founder national)",
   "distance_m": 3,
   "verdict": "right"
  },
  {
   "alias": "curated:...monument-to-the-great-fire-of-london (hidden, national, stampable)",
   "canonical": "wikidata:Q607700 (live, national)",
   "distance_m": 7,
   "verdict": "right"
  },
  {
   "alias": "curated:italy-rome-san-pietro-in-montorio (hidden, national)",
   "canonical": "wikidata:Q1258576 (live, national, city 'Roma')",
   "distance_m": 10,
   "verdict": "right"
  },
  {
   "alias": "curated:...grand-central-terminal (VISIBLE, national, qid Q11290)",
   "canonical": "icon:Q201013 (live, founder world, qid Q201013)",
   "distance_m": 0,
   "verdict": "right place. Joined by name because the two rows carry different Wikidata ids, so one id is wrong. The survivor gets the alias's 'why visit' text."
  },
  {
   "alias": "curated:france-paris-cin-math-que-fran-aise Cinémathèque française (hidden, national)",
   "canonical": "wikidata:Q174274 'Cinema Museum' (live, landmark)",
   "distance_m": 1,
   "verdict": "right row, but the weaker name survives. Rename the canonical."
  },
  {
   "alias": "wikidata:Q4116104 Cave Thawr (hidden, local)",
   "canonical": "curated:saudi-arabia-mecca-jabal-thawr (live, regional)",
   "distance_m": 1260,
   "verdict": "right (the cave is on the mountain). The radius grows 250 m to 1.3 km to reach a rounded alias coordinate (21.38333, 39.85)."
  },
  {
   "alias": "curated:spain-barcelona-sagrada-familia (hidden, founder world, 300 m footprint)",
   "canonical": "icon:Q48435 (live, founder world, 300 m footprint)",
   "distance_m": 12,
   "verdict": "right"
  },
  {
   "alias": "curated:...solomon-r-guggenheim-museum (hidden, scope world)",
   "canonical": "wikidata:Q201469 'Guggenheim' (live, national)",
   "distance_m": 21,
   "verdict": "right row, but the survivor's name is ambiguous and its scope is lower than the alias's. Rename it."
  },
  {
   "alias": "wikidata:Q528079 Tian Tan Buddha (hidden, local)",
   "canonical": "curated:hong-kong-...-tian-tan-buddha (live, regional)",
   "distance_m": 19,
   "verdict": "right"
  },
  {
   "alias": "wikidata:Q327265 'Castle' (hidden, national, stampable)",
   "canonical": "icon:Q327265 Heidelberg Castle (live, founder national)",
   "distance_m": 0,
   "verdict": "right"
  },
  {
   "alias": "wikidata:Q392766 Mount Yasur (hidden, local)",
   "canonical": "icon:Q392766 (live, founder world, 2 km footprint)",
   "distance_m": 765,
   "verdict": "right"
  },
  {
   "alias": "curated:turkey-antalya-kaleici (hidden, local, district)",
   "canonical": "icon:Q5994531 Kaleici Old Town (live, founder national)",
   "distance_m": 383,
   "verdict": "right"
  },
  {
   "alias": "wikidata:Q131330 Schönbrunn Palace (hidden, founder world, 800 m footprint)",
   "canonical": "icon:Q131330 (live, founder world, 800 m footprint)",
   "distance_m": 10,
   "verdict": "right"
  }
 ],
 "notes": "Everything here was read-only: D1 SELECTs and one read-only KV bulk get of the twins' d1gid keys. Temporary files are in /private/tmp/claude-501/-Users-lobster-Developer-globeskimmers/f41b1e13-23fd-45ba-9001-00f715adcec6/scratchpad. Checked and found fine: no worker or src file hard-codes an alias id; R2 photo keys are served by key alone, so moving photos keeps them working; blotter photo targets follow photo.stamp_id; none of the 8 film-scene canonicals already has a film, so every film moves; no canonical lacks a photo_url that its alias has; ppUpsertStamp has a single caller (handlePassportStamp), and accepting a tag mints no stamp. The plan's line numbers have drifted slightly: TagClaim is at 15701, TagRespond at 15777, OwnerNote at 13881."
}
```
