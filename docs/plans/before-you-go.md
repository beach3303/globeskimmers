# "Before you go" + "Why visit" for attraction pages: design

*2026-10-08. Design only. Nothing is built yet. Building starts after Apple approves build 13
(no worker, `src/` or database changes during review). This is step 3 of the agreed stamp-page order in `docs/PLANS.md`.*

**The need (founder, 2026-10-08):** a friend went to a mosque in Pakistan and wasn't allowed in.
A traveler should know before going who may enter, what to wear, whether photos are allowed,
when the place closes for prayer or ceremonies, whether a booking is needed, what the bag rules
are, and what access is like. They also want to know what's there and whether it's worth the time.

## What we build on (already live)

- **`/attractions/visit-info`** (`cloudflare-worker-v7.12.js` ~6403–6650). Sonnet 5 reads the
  place's **official site** (from our records, Google, or Wikidata). It runs web search
  *only inside that site* and fetches at most 5 pages. **Code** then keeps a price only when the
  page it cites was really fetched and that page's text contains the amount. Results are saved
  for 90 days (`visit:v5:<id>`), or 30 days when nothing was found. Limits: 150 new lookups a
  day across all travelers and 20 a day per traveler, signed-in only. Nothing is ever
  estimated. A missing fact stays empty and the app links to the official site.
- **Measured (25 lookups, Oct 3–7):** on average about 51k tokens read, 1.1k written and 2.1
  searches per lookup, at most 138k. That's about **$0.13 per lookup** (about $0.30 at most).
  12 of the 25 found something.
- **AI-details guard rules:** `/attraction-ai-details` bans a list of words that discourage
  visits. It also says "accessibility not confirmed" unless the place itself states it. The restroom details use
  `"not_confirmed"` / `"unknown"` and never guess. "Before you go" follows the restroom pattern.
- **The page:** `AttractionExtras.jsx` shows the Stamp button, then the **Prices** card, the **Parking**
  card (whose empty state is "Parking details on the official site ↗"), the card's own details and
  the Guestbook. Every card has a "From <site> · checked Oct 8" line and a "Verify on the official website ↗" link.
- **Respect places** (`src/lib/respectPlaces.js`): Masjid al-Haram and the Prophet's Mosque
  already show a respectful message when stamped. "Before you go" must agree with it.
- **"Why visit" is nearly empty:** 111 of the 15,609 world and national stamps have
  `why_visit` text. The worker already sends `whyVisit` to the app.

## 1. The facts we look for

Each fact is **either backed by the place's own words or `unknown`**. A backed fact looks like
`{ value, text, quote, quote_lang, source_url }`. Here `text` is our plain-English line (at most
140 characters) and `quote` is the source's exact words (20–200 characters). An unknown fact is just `{ value: "unknown" }`.

| Fact | Allowed values | Extra detail (only when stated) |
|---|---|---|
| `entry` | `open_to_all` · `restricted` · `closed_to_visitors` · `unknown` | `limits[]`: `faith` · `gender` · `age` · `tour_only` · `permit` · `dress_enforced` · `other`. `text` says who and where, e.g. "Only Muslims may enter the prayer hall; visitors are welcome in the courtyard" |
| `dress` | `stated` · `unknown` | `items[]`: `cover_shoulders` · `cover_knees` · `women_cover_hair` · `men_cover_head` · `remove_shoes` · `wraps_provided` · `other` |
| `photography` | `allowed` · `restricted` · `not_allowed` · `unknown` | `text`, e.g. "No photos inside the main hall; no flash or drones" |
| `closures` | `stated` · `unknown` | `items[]` of `{ kind: prayer · service · ceremony · weekly · seasonal · other, text }`. Times only if the quote contains them |
| `reservation` | `required` · `recommended` · `not_needed` · `unknown` | `text`, e.g. "Timed tickets must be booked online" |
| `security` | `stated` · `unknown` | `items[]`: `bag_check` · `no_large_bags` · `lockers` · `id_required` · `other` |
| `accessibility` | `stated` · `unknown` | `text` only in the place's own terms. Never "fully accessible" (same rule as AI details) |
| `time_needed` | minutes · `unknown` | Only when the site says so ("Allow about 90 minutes") |
| `other_rules` | up to 3 items | e.g. "Silence inside the sanctuary", "No food or drink" |

`time_needed` and "what to expect" from visitors' reviews stay where they are now, in the AI details
(`typicalDurationMin`, `worthIt`, labelled as coming from reviews). "Before you go" reports only what the place itself states.

## 2. Evidence rules (enforced by code, not trusted to the model)

1. **Allowed sources only.** These are the place's official site and its subdomains; the
   website of its operator (from Wikidata: the operator's own official-website entry), e.g. a
   diocese or a heritage authority; and government or official tourism bodies (domains like
   `gov`, `gov.xx`, `gouv`, `gob`, `go.xx`, `govt.nz`, `gc.ca`, plus a short hand-kept
   `BYG_OFFICIAL_BODIES` list for tourism boards outside `.gov`). These are **never** allowed:
   resellers (`VISIT_RESELLERS`), social or profile pages (`VISIT_PLATFORMS`, which includes
   Wikipedia), blogs, forums, review sites or news.
2. **The quote must really be on the page.** Code normalizes both texts (Unicode NFKC, lower case,
   one space between words, straight quotes, one kind of dash, no zero-width characters). It then
   requires the quote to appear in the text of a page that was **actually fetched**, or in the
   API's own `cited_text` for that URL. We turn on `citations` for web fetch so that rules found
   in a PDF (visitor guidelines are often PDFs) can still be checked. A quote that isn't found makes the fact `unknown`. It is never dropped silently.
3. **Every number must come from the quote.** Prayer times, ages and minutes all go through the existing `numsIn` check against the quote.
4. **The quote must support the claim.** A second, cheap model call (Haiku 4.5, one short call per
   fact, about $0.001) gets only the quote and our `text` and answers `supports` / `does_not`.
   A `does_not` answer makes the fact `unknown`. This check also works for quotes that aren't in English, where keyword checks can't.
5. **The highest bar is for `entry: restricted`.** The source must be the official site, its
   operator or a government body (no tourism board), and the support check must pass. If two
   allowed sources disagree about entry, the fact is `unknown`. For photography or dress, the more cautious backed fact wins.
6. **Never infer.** No rule may come from the religion, the category, the country or the model's
   memory. This is stated in the prompt and enforced by rules 2–4. A mosque with no published rules is `unknown`. We don't assume hair covering, and no rule is set by default for any category.
7. **Quotes in other languages:** `quote` stays in its original language and `quote_lang` says
   which one. `text` is the English rendering, and the app can show the original words (see §5).

## 3. How we build it: a separate lookup next to the price lookup

**Recommendation: a separate route, `POST /attractions/before-you-go { id }`, rather than a
bigger visit-info call.** The reasons:
- The price call already reads up to 138k tokens. Rules live on other pages (visitor
  guidelines, FAQ, etiquette, "plan your visit"), so one call doing both would push out pages that one of the two jobs needs.
- Putting both in one call would mean changing visit-info's cache version from `visit:v5` to
  `visit:v6`. That throws away every saved price and pays for each lookup again. A separate route needs no cache bump for prices.
- The Prices card keeps loading fast. The rules card loads on its own, and either one can fail without breaking the other.

**What it reuses:** `visitOfficialSite`, `visitHost`, `visitOnList`, `visitEvidence`, the lock
and daily-limit pattern, `gbLogEvent`. `visitAsk` needs two new arguments (the system prompt and
the fetch limit), which is a small, safe change to the shared function. It keeps the same web tools as visit-info so
evidence parsing stays the same, adds `citations: { enabled: true }` on web fetch, and allows 6 fetches.

**The prompt `BYG_PROMPT`, in outline:** "You find the published visiting rules of ONE place for a
travel app that never guesses. Start from the official site; follow its links to visitor
information, FAQ, plan-your-visit, etiquette or rules pages; when pages fetch empty, search the
site for 'dress code', 'visitor guidelines', 'photography', 'prayer times'/'mass times'. For every
fact, copy the source's exact words (20–200 characters) into `quote` and give the page URL. If a
rule isn't written on a page you read, use "unknown". Never use what places of this kind usually
require. Write `text` in neutral, respectful words, as the place's request, not a judgment."
After that comes the JSON shape from §1.

**Saving and refreshing:** KV `byg:v1:<id>`, 90 days, or 30 days when everything is `unknown`.
Lock key `byg:lock:<id>`. Its own limits are `byg:cap:<day>` (150 a day overall, 20 per traveler). Any future
prompt change bumps the version to `byg:v2`. A "Something's wrong?" link under the card lets a traveler
report a fact as wrong. That clears the saved result, so the next visit to the page checks again, and logs `byg_reported`
so we can review reports. Pre-filling the first places is done by `scripts/before-you-go/prewarm.mjs`
(modelled on `prewarm-dream-galleries.mjs`), which the founder runs signed in as admin
(`requireAdmin` skips the daily limits). One place at a time, about 300 an hour.

## 4. Which places first, and what it costs

Counted in D1 today among **world and national** stamps (15,609 places):

| Wave | What | Places |
|---|---|---|
| 1 | Places of worship by category (`religious`, `cathedral`, `mosque`, `temple`, `monastery`, `church_building`, `synagogue`, `shrine`) | **1,929** (88 world-level) |
| 1b | Places named like places of worship but filed under `landmark`/`historic` (mosque, masjid, temple, mandir, basilica, church, gurdwara, pagoda…). Needs one review pass, because hits like "Temple Bar" slip in | ~864 (50 world-level) |
| 2 | Palaces and castles (`palace`, `castle`), then parliaments and presidential buildings found by name | 448 + about 100 |
| 3 | Stadiums (clear-bag rules), theme parks, big museums | ~600 |

**The first 2,000:** every world-level place from waves 1 and 1b (138), then national-level places of worship by popularity.
**Cost:** one lookup about $0.13–0.20 (based on visit-info's measured average) plus about $0.005 in
support checks. That's **about $300–400 for the first 2,000**, with about $700 as the most it could reach if every place read
as much as the longest lookup so far. After that, a place is only checked again when someone opens it after 90 days. Wave 1b–3 (~2,000 more) costs about the same again.
**Hit rate:** unknown until we test. Prices found something 48% of the time. Rules will be found less often where
a place has no website (common for mosques and temples in South Asia). The honest `unknown` card covers that.
**Before the full run:** test 30 places with known rules (a mix of mosques, Hindu temples,
cathedrals, Buddhist temples, a palace and a stadium) and check every quote by hand. All 30 must have no wrong facts.

## 5. On the page

**Order:** **Why visit** (2 lines under the action buttons) → Stamp → **Before you go** → Prices →
Parking → details → Guestbook. Being turned away at the door costs more than a ticket, so the rules come before prices.

**The card** (new `BeforeYouGoCard` + `useBeforeYouGo(id)` in `AttractionExtras.jsx`, using the same
`Card` / `SourceLine` / `VerifyLink` and the same id choice as `useVisitInfo`):
- Facts that could get you turned away come first: who may enter → what to wear → closures → booking → bags →
  photos → access → other rules. One short sentence per row with a small icon.
- A `restricted` entry is the first row, on a soft amber background (never red), e.g. *"Only Muslims may enter
  the prayer hall. Visitors are welcome in the courtyard outside prayer times."*
- Tapping a row opens the place's own words: *The official site says: "…"*. If the quote isn't in English, the
  original words appear under the English line with "Translated".
- At the bottom: *From badshahimosque.gov.pk · checked Oct 8 · rules can change* and *Confirm on the official website ↗*.

**How "unknown" reads:**
- Some facts known: we don't list each unknown fact. One closing line covers them: *"Not listed online: photography,
  accessibility."*
- Nothing known, but there's an official site: *"Visiting rules aren't listed on the official site. Check before you go ↗"*
- Nothing known and no site: *"Visiting rules aren't published online. Ask at the entrance before going in."*
- Loading: *"Checking the official site for visiting rules…"* with the same shimmer as Prices.

**Wording rules:** describe what the place asks, in its own terms: "Visitors are asked to cover shoulders and
knees; wraps are lent at the door", never "strict dress code". Say who *may* enter ("Hindus only")
rather than who is barred. No adjectives about the faith or the rule. Code rejects `text` containing: strict,
conservative, unfortunately, sadly, banned, forbidden, not welcome, discriminat-, backward, exotic, (and the
existing attraction list). Words like these may appear only inside a quote. Gender and faith rules are reported exactly as the place states them, and nothing is added.

## 6. "Why visit": what it is and why people go

- **Facts in:** the encyclopedia summary (free; from the row's Wikidata id, English, or the
  local language when there's no English article) + **Google's editorial summary**, requested in the
  same Google details call as step 2 (matching every stamp to Google), so it costs no extra call. Plus our category, city, country and heritage status.
- **Writing:** 1–2 sentences, 25–45 words (at most 260 characters): what it is, then why people go or what you see.
  Written in a batch (half price) with Sonnet 5: **about $35 for all 15,609** world and national stamps. Saved once in D1 `why_visit`
  (+ `why_visit_at`) through a SQL file **the founder runs**. The worker already sends it to the app.
- **Code guards:** every number and every capitalized name in the output must appear in the input facts.
  No 8 or more consecutive words copied from the encyclopedia (so the sentences are our own). No prices, hours or rules
  (the existing `MONEY` pattern plus rule words). No marketing words ("must-see", "breathtaking", "hidden gem",
  "bucket list"). "Largest", "oldest" and similar only when the input says so. Not enough facts means no "Why visit"; the line is hidden.
- **Never says "Wikipedia"** (founder rule, 2026-10-07): no label, no source line, no link. Code
  rejects output containing "wiki". Places of worship are described as places of worship first, respectfully.

## 7. Risks

- **Out-of-date rules** (renovations, a change of use as at Hagia Sophia, new booking rules). Covered by: the "checked <date>" line, a 90-day
  check again, "rules can change", the confirm link and the "Something's wrong?" report.
- **A wrong "who may enter" fact is the worst mistake in both directions** (someone wrongly told they may not enter, or let in where they may not go).
  Covered by rule 5: only the strongest sources, a support check, and `unknown` when sources disagree.
- **Same-name places** (many cities have a "Jama Masjid"). The official site comes from the place's own Wikidata id,
  and searches stay inside that site. With no site, a page counts only if it names the place and its city.
- **Translation errors:** the original words are always one tap away.
- **Text planted on a web page to steer the model:** only verbatim quotes from allowed sources survive, `text` length is capped, and only URLs we actually saw are kept.
- **Tone:** neutral, respectful, never judgmental (§5 wording rules). The Mecca and Medina pages must agree with the respect messages.
- **Responsibility:** the card always presents rules as what the official site says, never as our promise.

## Decisions for the founder

1. A separate lookup (recommended) or one bigger price lookup?
2. Pre-fill the first 2,000 (about $300–400) or check only when a traveler opens the page?
3. For a place of worship where nothing is known, add a general line: *"Places of worship often set their own dress and
   entry rules — ask at the entrance."*? It states no rule for this place, but it is a general statement.
4. Is "Why visit" right at the top of the page, above the Stamp button?

## Build steps (after Apple approval)

Worker: `BYG_*` constants + prompt, `bygVerify`, `handleAttractionBeforeYouGo`, route, `visitAsk` arguments →
`node --check`. App: `BeforeYouGoCard` + hook + Why visit line → lint, build, boot-check → OTA. Scripts:
the 30-place test → prewarm → `scripts/why-visit/` (batch + SQL for the founder).
