# Stamp merge plan: one place, one row

*Written 2026-10-08, while build 13 is in Apple review. **Nothing here runs until Apple approves.***
*Line numbers are for `cloudflare-worker-v7.12.js` at HEAD `02266d4` (21,156 lines).*

**The problem.** The stamp table (D1 `globeskimmers-attractions`, table `attractions`) often holds one place twice, because it was filled from several sources. The Hollywood Sign is both `curated:united-states-los-angeles-hollywood-sign` and `icon:Q180376`. Twins show up as two cards, split a place's guestbook, take two of the 12 slots in "7 of 12 Los Angeles icons", and a traveler can hold two stamps for one place.

**Words used below.** The *canonical* row is the one row per place that stays. An *alias* is a twin that stays in the table as a signpost ("this place now lives at X") and is never shown or stamped. A *gid* is a Google place id.

**Read from production today (read-only):**

| | |
|---|---|
| Groups of rows sharing one Wikidata id (qid) | 940 groups, 1,916 rows |
| …of which 2+ rows can be stamped (what travelers see doubled) | 656 |
| Rows already marked `class_ban='duplicate'` by Dedup v2 | 998, but **704 of them can still be stamped**, because later bulk passes gave their `scope` back |
| Groups where *every* row is hidden (Eiffel Tower, Louvre, Colosseum, Sydney Opera House…) | 28 |
| Ids deleted on 2026-10-06 that art, film scenes or stamps still name (`icon:Q243`, `icon:Q9141`…) | 43 |
| `film_scenes` rows | 347 |

The mapping behind this plan, with every file:line that stores or reads a stamp id, is in the scratchpad `merge_map.json`. The raw rows are in `dups.json`.

---

## A. Principles

1. **Soft merge only. No row is ever deleted.** An alias keeps its row with `merged_into = <canonical id>`. *Why:* six handlers look a place up by id and fail if the row is gone (3288, 6236, 6338, 6358, 6377, 6603). Also, the background auto-seed (`INSERT OR IGNORE` at 5525) would re-create a deleted `auto:` id as a fresh, visible duplicate. A signpost row blocks that.
2. **Every old id works forever.** Shared links (`/ThingsToDo?focus=`, `/ActivityDetail?id=`), stamps already stored, the art index and old app bundles in the field all keep sending alias ids. The worker quietly forwards each one to the canonical row.
3. **One place = one page, one guestbook, one photo set, one stamp per traveler.**
4. **Code first, then data.** The worker must understand signposts *before* any twin is hidden, so nothing 404s, nothing gets stamped twice, and no guestbook note disappears in between.
5. **Never overwrite your decisions.** `founder_scope` and your art picks win over any automatic rule. Every doubtful group goes on a decision sheet and is left out until you decide.
6. **Every step can be undone.** Each data file ships with an undo file.

## B. Worker changes (built after approval; can be written on a branch now but not pushed, because a push deploys)

**B1. One column, two helpers.**
- D1: `ALTER TABLE attractions ADD COLUMN merged_into TEXT;` plus a partial index on it. It is a column rather than a separate alias table because the alias row already exists and every lookup already reads it.
- `d1Canonical(env, id)` → `{ id, row, from }`. It loads the row by id and follows `merged_into` for up to 3 steps. It stops if it loops, and returns the original if the target is missing. Results are remembered for the rest of the request. While `merged_into` is empty everywhere it returns the id unchanged, so this deploy changes nothing visible on its own.
- `d1AliasIds(env, canonId)` → `SELECT id FROM attractions WHERE merged_into = ?1`.

**B2. Call sites** (all from `merge_map.json`, re-checked against HEAD):

| Where | What changes |
|---|---|
| `resolveStampGid` 3281 (KV 3284, row 3288, stampable test 3303–3304) | Canonicalize *before* the `d1gid:` read, so twins share one Google id. The stampable test also requires `merged_into IS NULL`. Write `gid2d1v4` (see D). |
| `handleAttractionAIDetails` 3322–3326 | Nothing extra: it goes through `resolveStampGid`, so twins share one AI panel. |
| `handleDreamShelf` 5632, `LIVE` at 5637 | Add `AND merged_into IS NULL` to `LIVE`. (The qid de-dupe in its loop stays as a backup.) |
| `handleAttractionsNearby` 5688, filters 5763–5786 | Add `'merged_into IS NULL'` to `wheres`. This one feed serves Things to Do, Stamps near you, home rows, Perfect Day, the nearby stamp prompt and `/activities`. Also fix the comment at 5758–5762, which is false today for 28 groups. |
| parse-search 4872, tourist center 5260, packages 17639 | Add `merged_into IS NULL` next to the existing `class_ban` filter (belt and braces). |
| `handleAttractionsGet` 6228 (SELECT 6236) | Follow the pointer. Return the canonical row and its id, plus `mergedFrom`. |
| `ttdStampFor` 6300 (key 6303, SQL 6312–6314, tie 6326, write 6331) | **Keep aliases as name candidates** (`… OR merged_into IS NOT NULL`), because Google's spelling often matches the alias name. Then turn the winning row into its canonical, and drop it if the canonical can't be stamped. The tie-break compares the canonical's `d1gid` too. Key becomes `gid2d1v4:`. |
| `ttdPlaceTruth` 6335 (6338) | Use the canonical's position and footprint for the GPS check (C2 makes that footprint cover the alias's spot). |
| `handleAttractionLink` 6351 (6358–6359) | Canonicalize. Return the canonical summary and the canonical's gid. |
| `handleActivityOne` 6369 (6377) | Canonicalize, so "See this place" on an old stamp opens the merged page with the canonical stamp. |
| `ttdGidFor` 6287 | Nothing extra (it calls `resolveStampGid`). |
| `handleAttractionVisitInfo` 6576 (id 6580, key 6582, row 6603, locks 6610/6618/6637) | Canonicalize the id before building the cache key and the lock. On a cache miss, check `visit:v5:<alias>` and copy it over before paying for a new lookup. |
| `ownedGidCached` 12573 (`owned2gid3:`/`owned2gid:`) | For a D1 id, canonicalize before the key. (Low risk.) |
| `ppUpsertStamp` 12907 (lookup 12909–12910) | For a D1 id, look up the existing stamp with `entity_id=in.(canonical, …aliases)`. A traveler whose stamp still sits under an alias then gets that stamp upgraded, not a second one. |
| `handlePassportStamp` 12984 | Right after `entityId` is read (12994), canonicalize a D1 id and `b.parent_id`, **before** the GPS check (13049–13050), the "already have it" check (13114, which uses the same alias set) and the upsert (13126). This is the single choke point that stops new alias stamps from old bundles. The upgrade from an "I was here" stamp to the iconic stamp (13059–13060) is canonical through `ttdStampFor`. |
| `ppLoad` 13153 (select at 13154) | Add `canonical_id` to each D1 stamp whose row is an alias, using one D1 query for the traveler's ids. The app uses it in F. |
| `handlePassportSets` 15070 (have 15083, SQL 15090–15095) | Add `merged_into IS NULL` and the live `class_ban` filter to the 12-slot query. Map the traveler's alias ids to canonical ids before counting. |
| `handlePassportTagClaim` 15721, `handlePassportTagRespond` 15868 | Use the alias set in the exact `entity_id` check, so a friend who holds the canonical isn't asked for proof. (Low risk.) |
| `gbEntityIds` 19841 (resolve 19845, linked 19855) | Canonicalize the D1 id, whether it was passed in or linked through the gid. Add the canonical id and **every alias id** to `all`. Read `gid2d1v4`, then v3, then v2. Do **not** add an alias's *own* Google id: that is another listing's guestbook (see E). |
| `handleGuestbookSign` 19887 (✓ check 19933), `handleOwnerNote` 13886 | Nothing extra: they use `gbEntityIds`. |
| `handleGuestbookVisit` 20329 (20334) | Store `gbEntityIds(...).canon` instead of the raw id. |
| `seedCityNow` 5494 / 5525 | No change. Signpost rows block re-inserts. |
| `handlePassportDelete` 14066 | No change, but **never** use it to collapse twins: it deletes R2 photos and blotter marks. |

**B3. Deploy order.** First you add the column (H, step 2), because a query naming a missing column breaks the whole nearby feed. Then I push the worker (no visible change yet). Then you run the data file.

## C. D1 data migration (you run the files; I generate them)

The generator is `scripts/stamp-merge/build.mjs`. It reads D1 read-only, applies the rules below, and writes `01_add_column.sql`, `02_merge.sql`, `02_undo.sql`, `decisions.csv`, the KV files (D) and the Supabase draft (E). The SQL uses written-out values rather than subqueries, so every line can be read and checked.

**C1. Which row stays.** I tested this rule on all 656 groups. In order:
1. A visible row (`class_ban` empty or `review:*`) first.
2. By id prefix: `icon:`, then `curated:`, then `wikidata:`, then `wv:`, then `auto:`.
3. A row with `founder_scope` first.
4. Higher popularity.
5. Higher sitelinks, ignoring the 27 `icon:` rows whose id names a different qid. Their sitelinks belong to another entity; for example `icon:Q817` Kuwait Towers carries 254.
6. Alphabetical id.

Result: in every group that has one visible row today, the row people already see stays canonical. That means the fewest stored ids, caches, film links and art links to move. Hollywood Sign → `icon:Q180376`. The groups are found by the `qid` column, never by reading ids. The generator covers all 940 qid groups, not only the 656, because stored stamps can name any of their rows.

**C2. Fill the canonical from its twins, never overwriting.** It copies `place_id`, `why_visit`, `description`, `free_to_visit` and `rating` when the canonical's is empty. It takes the larger `popularity` and `is_marquee`. A specific `category` replaces a generic `landmark`/`experience`. `founder_scope` is copied only when the twins hold exactly one distinct value. `scope`, lat/lng, city and country stay the canonical's.

**Footprint:** `footprint_radius_m` is set to the largest of the canonical's own radius, each alias's radius, and (distance to the alias + the alias's radius). The radii are computed with the worker's own `ppStampRadius` rules (12958). *Why:* anyone standing where the alias said the place was can still stamp.

**C3. Turn the twins into signposts.** Same convention as Dedup v2 (BUILD_TEST_CHECKLIST.md:572), plus the pointer: `UPDATE attractions SET merged_into='<canon>', class_ban='duplicate', scope='local', founder_scope=NULL, updated_at=datetime('now') WHERE id='<alias>';` Both scope fields must be cleared. *Why:* the stamp checks at 3303, 6314 and 15093 look only at `coalesce(founder_scope, scope)`, so `class_ban` alone does not stop an alias from being stamped. That is how 704 hidden rows are still stampable. In the 28 all-hidden groups, the canonical gets `class_ban=NULL`. **Visible effect:** the Eiffel Tower, Louvre and Colosseum come back to browse.

**C4. Side tables.**
- `UPDATE OR IGNORE film_scenes SET attraction_id='<canon>' WHERE attraction_id='<alias>'`. A follow-up check lists any row that did not move. No group has films on two twins today.
- `UPDATE attractions SET parent_id='<canon>' WHERE parent_id='<alias>'` (5 secret Disney rows).

**C5. Signposts for the 43 deleted ids.** `INSERT OR IGNORE` a minimal row: the canonical's name and position, `source='merge-tombstone'`, demoted as in C3, with `merged_into` set. Their ids are collected from `scripts/stamp-art/art-matches.json`, orphaned `film_scenes`, and Supabase stamp ids that match no D1 row. The 5 orphaned film rows then move as in C4.

**C6. Left out until you decide (`decisions.csv`, in plain words with a suggested answer each):**
- 42 named edge cases from the mapping:
  - mistags 25 km or more apart (for example "Omaha Beach" in New Zealand)
  - a visible row that is the wrong place (Q913672 SFMOMA, Q18157, Q841506)
  - sub-places filed under a parent (Camp Jurassic)
  - composite icons
  - two real sites (Niagara's two sides, Hyde Park)
  - `founder_scope` conflicts (CN Tower and others)
  - London Eye's ban conflict
- 21 more groups whose twins are 0.5–25 km apart and are not parks, lakes or reserves. (18 area-type groups at those distances merge automatically.)
- 89 groups where a hidden twin carries a *higher* scope than the canonical. These merge, but the scope is not raised without your say.

About **593 of the 656 groups merge automatically**, and **63 wait for you**. A mistagged row is never made an alias. It gets `qid=NULL` or `class_ban='wrong-match:qid'` instead, because a stamp there was a visit to a different real place.

**C7. Keeping it merged.** Any later bulk script keyed on qid or name (such as `scripts/city-icons/data/boost_global_fame.sql:698`, `dedupe_twins.sql`) must add `AND merged_into IS NULL`, or it will revive aliases the way it revived Dedup v2's. G gives the invariant check to re-run after every bulk pass.

## D. KV cache clean-up (namespace `68ae9c62099f4834a8c6f0ff3eb57e71`)

| Key | Plan | Why |
|---|---|---|
| `gid2d1v3:<gid>` / legacy `gid2d1v2:` (30 days) | **Bump the version in code to `gid2d1v4:`**, no deletes | They hold alias ids for up to 30 days. Rebuilding a link costs one D1 read and no Google call, so a bump is free and needs no key list. `gbEntityIds` keeps reading v3/v2 as a fallback and canonicalizes what it finds. |
| `d1gid:<id>` (180 days) | **Copy** the alias's gid onto `d1gid:<canonical>` when the canonical has none (`kv bulk put`). Delete nothing. | A missing canonical gid would trigger a new paid Google text search. Keeping the alias keys keeps rollback trivial. |
| `owned2gid:` / `owned2gid3:<id>` | Same copy rule | Same reason. Low risk. |
| `visit:v5:<id>` (90 days) | **Copy** the alias's result onto the canonical when the canonical has none, with a 90-day TTL | Each lookup is a paid Claude web search. Nothing is paid for twice. The code fallback in B2 catches anything missed. |
| `name_info:<id>:<ver>` | Leave | Cheap, and it ages out. |
| `homerows_v4_*` (6 hours), `parse_search:*` (24 hours) | Leave | They expire on their own within a day. |

**How:** `build.mjs` reads the current values with `npx wrangler kv bulk get` (read-only) and writes `kv-copy.json`. You run `npx wrangler kv bulk put … --remote`.

**Gid divergence report.** It also writes `gid-divergence.csv`: groups whose twins resolved to *different* Google ids. Those twins already have split guestbooks. This list is the starting point for step 2 of your order ("match every stamp to its Google listing"). Nothing is moved automatically.

## E. Supabase migration (applies itself on push; refused without the destructive marker)

The draft stays in `scripts/stamp-merge/` and goes into `supabase/migrations/` **only at step 7 of H**, because any push there applies it. Before writing it: run `npm run db:pull` to confirm the live index names (the base tables came from hand-run `scripts/` SQL). Then you run a read-only preflight, pasted into the Supabase SQL editor, and send me the counts. It counts rows holding alias ids in each table below, and lists collisions with `GROUP BY user_id, kind, canon HAVING count(*) > 1`.

The migration is a single transaction:
0. Create `api.stamp_merge_log` (RLS on, `grant all … to service_role`). Load the alias→canonical map as a `VALUES` list, generated from D1, because Postgres can't read D1. The map includes each canonical's guestbook key: its gid from `d1gid:`, otherwise the canonical D1 id.
1. **Collapse the travelers who hold both twins** (`passport_stamps_uniq` on user, kind, entity_id would otherwise block step 2):
   - Keep the row with the strongest proof (gps > photo_loc / photo_ai > photo > self, as `PP_VERIFY_RANK` at 12900). On a tie, keep the one with photos, then the oldest.
   - On the kept row, set `verified` to the strongest value and `visited_on` to the earliest. Join both `note`s. Merge `meta` so the kept row's keys win and `film`, `art` and `page_with` are filled from the other. Set `hidden` to true if either row was hidden (the more private choice). Fill `tagged_by`.
   - Move `passport_stamp_photos.stamp_id` to the kept stamp. R2 keys stay as they are.
   - Blotter: first delete the loser's `blotter_marks` that would collide on (target, user_id, kind). Then re-target `st:<loser>` → `st:<kept>` in `blotter_marks` and `blotter_entries`, for that `owner_user_id`.
   - Rewrite any `meta.page_with` that names the loser.
   - Log the loser's full row, then `DELETE` it. The file carries `-- gs:allow-destructive (reason: removes a traveler's second stamp for the same place after its photos, reactions and page pairing moved to the kept stamp; full row saved in api.stamp_merge_log)`.
2. Update the remaining stamps: set `entity_id` to the canonical for kinds attraction/icon/wonder, and write `meta.design_id = <old id>` when it is not already set (see F). Name, city and country stay as the traveler's snapshot.
3. `passport_tags.entity_id`: alias → canonical (there is no unique key to collide with).
4. `guestbook_entries` and `owner_notes`: re-key **only rows keyed by a raw alias D1 id** to the canonical's guestbook key.
5. `guestbook_visits` (primary key user, entity): insert the merged rows with `ON CONFLICT DO UPDATE` (signed OR, verified OR, earliest `visited_at`). Then delete the alias rows, which are covered by the same marker.

**Must NOT move:**
- Guestbook entries and owner notes keyed by a **Google id**, even an alias's own. That gid is also the guestbook of that Google place's own Things to Do card, and moving it would strip notes from that page. Those wait for the divergence report.
- `place_dishes`, `postcards`, `user_saves`, luggage and profile favorites. None of them holds an attraction id.
- Never collapse through `/passport/stamp/delete`.

## F. App changes (one OTA, shipped **before** the Supabase migration)

- **Earned checks.** `DreamShelf.jsx:149` (exact match) and `NearbyStampPrompt.jsx:68` (lowercased) build their set from both `s.entity_id` and the new `s.canonical_id`. *Why:* until step 2 of E runs, a traveler holding an alias stamp would otherwise see the canonical card as not collected, or be offered the same stamp again.
- **Typographic look.** `PassportBook.jsx:232/277/372`, `Passport.jsx:249` and `RespectPlaceSheet.jsx:84` pass `stamp.meta?.design_id || stamp.entity_id || stamp.id` as the design seed. *Why:* the frame is chosen by a hash of the id (`stampDesign.js:68`), so without this an earned stamp would silently change its look when its id moves.
- **Stamp art.** Regenerate `src/lib/stampArtIndex.js` with `scripts/stamp-art/build-art-index.mjs` from a post-merge export. The diff must only *add* ids. Aliases are still rows, so the script's skip of missing ids (:60–62) no longer drops them, and the 43 signposts now resolve. Check that every canonical of an art-gated alias is in `ART_ONLY`. `icon:Q2536763` is covered by the `plaza-mayor-of-lima` name alias. *Why:* art is chosen by row id first (`stampArt.js:55–62`).
- Native installs that haven't taken the OTA yet might show a different frame on a merged typographic stamp until they update. Art and earned status still work, because the server forwards old ids.

## G. Checks and rollback

**Before** (D1, read-only): the counts table above, plus `SELECT count(*) FROM attractions WHERE merged_into IS NOT NULL` = 0.

**After the D1 file** (each must return 0):
```sql
-- every signpost points at a visible, final row
SELECT count(*) FROM attractions a JOIN attractions c ON c.id = a.merged_into
 WHERE c.merged_into IS NOT NULL OR NOT (c.class_ban IS NULL OR c.class_ban = '' OR c.class_ban LIKE 'review:%');
SELECT count(*) FROM attractions a LEFT JOIN attractions c ON c.id = a.merged_into WHERE a.merged_into IS NOT NULL AND c.id IS NULL;
-- no signpost can be stamped
SELECT count(*) FROM attractions WHERE merged_into IS NOT NULL AND coalesce(founder_scope, scope) IN ('world','national','regional');
-- each merged qid has exactly one canonical (run over the merged qids)
SELECT qid FROM attractions WHERE qid IN (<merged qids>) AND merged_into IS NULL GROUP BY qid HAVING count(*) <> 1;
-- films and secret parents point at canonicals (2 known film:* rows aside)
SELECT count(*) FROM film_scenes f LEFT JOIN attractions a ON a.id = f.attraction_id WHERE a.id IS NULL OR a.merged_into IS NOT NULL;
SELECT count(*) FROM attractions p JOIN attractions a ON a.id = p.parent_id WHERE a.merged_into IS NOT NULL;
```
**Live checks:**
- `/attractions/get {id:"curated:united-states-los-angeles-hollywood-sign"}` returns `id: icon:Q180376`.
- `/attractions/nearby` and `/dream/shelf` at Hollywood show one Hollywood Sign.
- `/passport/sets` for a test account counts 12 distinct places.
- `/activities/one` with an alias id opens the canonical.

**After Supabase** (SQL editor, each must return 0): rows whose `entity_id` is in the alias list; the collision query; photos per user (the total must equal the before count); blotter `st:` targets naming a missing stamp.

**Rollback, cheapest first:**
- Worker: revert the commit. With `merged_into` empty, the old code paths behave as they do today.
- D1: run `02_undo.sql`. It holds each touched row's exact before-values, restores the film and parent links, and deletes only the signpost rows it inserted.
- Last resort, D1 Time Travel: note the bookmark first with `npx wrangler d1 time-travel info globeskimmers-attractions`. This also rewinds any auto-seed rows added since, which re-seed by themselves.
- KV: nothing to undo. Copies only added keys, and the v4 bump reverts with the code.
- Supabase: `api.stamp_merge_log` holds every deleted stamp in full, and every moved photo and changed id (also kept in `meta.design_id`). An undo migration is generated alongside the draft and committed only if needed.

## H. What you do, in order

| # | When | Who | What |
|---|---|---|---|
| 0 | During review (now) | me | Write `scripts/stamp-merge/build.mjs` (read-only), the files it generates, and `decisions.csv`. Write the worker change on a branch, **not pushed**. Nothing users see changes. |
| 1 | Now or later | you | Answer `decisions.csv` (63 groups and 89 scope questions). Unanswered groups simply stay as they are. |
| 2 | After approval | you | `npx wrangler d1 time-travel info globeskimmers-attractions` (note the bookmark), then `npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-merge/01_add_column.sql` |
| 3 | After 2 | me | Push the worker (deploys automatically). I check that nothing changed, because there are no pointers yet. |
| 4 | After 3 | you | `npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-merge/02_merge.sql`. I run the G checks. |
| 5 | After 4 | you | `npx wrangler kv bulk put scripts/stamp-merge/kv-copy.json --namespace-id=68ae9c62099f4834a8c6f0ff3eb57e71 --remote` |
| 6 | After 4 | you | `npm run ota` (earned checks, design seed, new art index), after I push the app commit |
| 7 | After 6 | you, then me | You paste the preflight SELECTs into the Supabase SQL editor and send me the counts. I commit the migration and push it, and CI applies it. |
| 8 | After 7 | you and me | I run the G checks. You open the Hollywood Sign in the app and check: one card, "Collected" if stamped, the guestbook notes all there. |

Later and separate: the 57 same-name twins with different or no qid, and the 650 `icon:` rows with no qid, get a second, name-and-position pass using the same `merged_into` machinery.
