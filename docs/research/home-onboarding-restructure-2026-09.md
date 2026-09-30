# Home + Onboarding restructure — passport-first (2026-09-29)

Audit + proposal for the post-pivot app (commit 99a2dd8: **Virtual Passport + nearby
finders only**). Read against `docs/PLANS.md` (the pivot + new build queue),
`docs/PASSPORT_MEANING_MODEL.md` (the locked meaning model, incl. the no-streak-loss
rule), `docs/PRODUCT_AUDIT_2026-08.md`, and the live code: `src/pages/Home.jsx`,
`src/pages/Onboarding.jsx`, `src/components/home/*`, `src/lib/homeContext.js`,
`src/Layout.jsx`, `src/components/redesign/FloatingNav.jsx`. No code was changed.

---

## PART 1 — WHAT HOME RENDERS TODAY

### Phone Home, top to bottom (Home.jsx at 99a2dd8)

| # | Surface | What it is | Passport-first verdict |
|---|---|---|---|
| 0a | **WelcomeSplash** (overlay, ≤10 sign-ins) | Teal hero "Search here, there, or before you arrive" + 5 display-only starters | **Rewrite.** 100% finder-centric, 0% passport. Starter #05 still advertises "Public transportation info & options" — a surface the pivot deleted. This is the natural home of the Atlanta-story explainer. |
| 0b | Cold-open location chooser / AirportArrivalPrompt / BorderCrossingPrompt | Location picker + the arrival-stamp prompts | **Keep.** The arrival prompts are already passport-first behavior. |
| 1 | **Masthead** | "Hello {hola} *Maiza* in Atlanta" · quiet mono `PASSPORT · N` link · glasses · date · temp · folded clocks · location pill | **Keep, promote the passport line.** The only passport presence on Home above the fold is a 10.5px mono link. That is the hero slot in a passport-first app. |
| 2 | **SmartSearchBar** (+ DestinationStrip) | One search that routes into finders | **Keep** — it is the front door to hero (b), the finders. |
| 3 | ZoneKicker "NEARBY NOW" + **finder chip row** | Eat · Coffee · Things to do · **Hotels** · All services | **Keep, fix.** The **Hotels chip is dead**: `FINDER_CHIPS` still maps to `'Find a Hotel'` (Home.jsx:91) but `handleQuickAction` has no such route and the page was deleted — tapping it silently does nothing. |
| 4 | **StampsNearYou** | Owned-D1 stamp chips within 40 km, marquee-first, distance labels, secrets only inside footprint, → ActivityDetail to earn | **Promote to hero.** This IS the product now. Header still says "Stamps near your **stay**" — the stay anchor concept died with My Trip; retitle "Stamps near you". |
| 5 | ZoneKicker "DREAM & PLAN" + **DreamersCorner** | Worker `whereToNext` photo rail + "Dream anywhere" typed doorway → DreamGallery | **Keep, reframe.** Dreaming = future stamps = the wishlist = the best intent signal we will ever have (Part 4). |
| 6 | **DreamShelf** (dream-stack only) | Stampable places in the dreamed city, "{CITY} · X OF N" endowed progress, collected marks | **Keep.** Already passport-native — this is what the whole Home should feel like. |
| 7 | **DealRadarRow** | Flight / cruise / car sale link-outs, zero commission | **Cut** (below). |
| 8 | **WanderlustLine** | One public-domain quote per day | **Keep.** Three lines, no fetch, no guilt, on-brand closer. Cheapest delight on the page. |

Not mounted on phone: HomeRows, RightNowStrip, ExperiencesRow, WishlistCard (all
tablet-only since the 2026-09-20 clutter cut). Home mounts no ad banner.

### Tablet Home (HomeTablet.jsx — tabled per G108, but now broken)

The tablet is a pre-pivot museum: 440px flag greeting card with "Hello 👋" (the
phone masthead went emoji-free), Cloud glyph temp, a 3-up emoji tile grid, then
RightNowStrip (emoji gradients + AI dish picks) → HomeRows → DreamersCorner →
ExperiencesRow (Viator link-outs) → StampsNearYou (dead last) → WishlistCard →
a 7-card "Explore more" gradient grid.

**Bug:** the tile grid still **leads with "Book a Ride" → `onAction('Get A Ride')`**
(HomeTablet.jsx:199). The route is gone — the flagship tile of the iPad Home is a
silent no-op. The pivot commit removed the Transit tile and the Insight/Essentials
gradient cards but missed this one.

### Dead controls the pivot missed (fix in slice 0)

1. `src/pages/Home.jsx:91` — Hotels finder chip → `'Find a Hotel'`, silent no-op.
2. `src/components/home/HomeTablet.jsx:198-199` — "Book a Ride" tablet tile, silent no-op.
3. `src/components/onboarding/WelcomeSplash.jsx` starter #05 — "Public transportation
   info & options" (display-only, but advertises a deleted feature).
4. `StampsNearYou` header "Stamps near your **stay**" — the stay anchor is gone.
5. Cosmetic: `FloatingNav.detectActive()` still returns `'trips'` for
   wishlist/savedlocations paths; no `trips` item exists, so those pages show no
   active tab (harmless, but the comment block describing 4 anchors is stale — the
   pill is Home / Passport / Settings).

### Onboarding today (Onboarding.jsx)

Two-to-three steps, ~30 seconds: first name (skipped when the provider gives it) →
location permission (LocationStep) → home city (HomeCityField → country, coords,
exact timezone). Currency / language / temp / distance are inferred
(`inferProfileDefaults`), everything else deferred (14 step components still exist
for Settings/in-context use). It is admirably fast — and **teaches nothing**. A new
user lands on Home never having heard the word "passport", never having seen a
stamp, with the app's whole thesis carried by a 10.5px mono link.

The meaning model already prescribes the fix (PASSPORT_MEANING_MODEL.md §
"Onboarding = page one"): reframe onboarding as **make your passport**, home city
= page one, and it explicitly bans "member since" framing and streak-loss guilt.

---

## PART 2 — THE PASSPORT-FIRST HOME (proposal)

### Principles

- Two heroes, in this order: **(a) the passport** (what you've earned + what's
  earnable right here), **(b) the finders** (what you need right now). Everything
  else is a guest and must self-hide when empty.
- The Atlanta story is the frame: *stamps near you = the places actually worth
  going*. Stamps are not a reward layer on top of a travel app; they ARE the
  top-destinations list.
- Founder's standing rules hold: clean, space-efficient, honest, no emoji in the
  editorial register, never a fake count, never a bare zero, no streaks, no guilt
  (celebrate presence, never punish absence).

### New phone order

```
0  Overlays (unchanged): splash → location chooser → arrival-stamp prompts
1  Masthead (unchanged line 1+2, minus the mono passport link — it moves down)
2  PASSPORT HERO (new, ~72px)
     "12 stamps · 3 countries"        ← real counts; zero-state below
     "Next stamp: Stone Mountain · 9.2 mi"  ← nearest unearned from StampsNearYou data
     [tap anywhere → Passport; tap the next-stamp line → that ActivityDetail]
3  STAMPS NEAR YOU (retitled; the existing rail, now directly under its hero)
4  Smart-search bar  ← the hinge into hero (b)
5  ZONE "NEARBY NOW": finder chips (Eat · Coffee · Things to do · Restrooms · All services)
6  ZONE "DREAM": DreamersCorner → DreamShelf (dream stack)
7  WanderlustLine
```

**The passport hero, concretely.** One quiet card in the house register (serif
count, mono kicker), built entirely from data Home already fetches: `passportTotal`
(the existing `/passport/list` read — extend it to surface `stats.countries`) and
the first unearned item of the StampsNearYou payload. No new worker route needed.
Three states:

- **Has stamps:** count + countries + next-stamp-nearby line.
- **Zero stamps, coverage nearby:** no bare zero — lead with the endowment:
  "3 stamps waiting near you · Stone Mountain is 9.2 mi away". (Same endowed-progress
  trick DreamShelf already uses.)
- **Zero stamps, no coverage:** the hero collapses to the current quiet
  `PASSPORT →` line. Never an empty shell.

**Friend activity** (public passports / following, build-queue item 1) slots in
later as a third line on this same card ("Ana stamped the Louvre yesterday") —
design the card with a reserved third row so the social layer needs no re-layout.

**First-run explainer** (once, dismissible, stored per-account like
`welcome_splash_count`): a one-time banner above the Stamps rail —

> **Stamps near you are the places actually worth going.**
> We stamp the icons — the aquarium-class, mountain-class places. If it earns a
> stamp, it earns your afternoon. Be there, and it's yours for life.

That is the Atlanta story in three sentences, and it doubles as the honest answer
to "why is this list so short" (quality over quantity, a stated preference).

### Cut / demote, with reasons

- **DealRadarRow — cut from Home.** Two of its three kinds (flights, cars) are
  booking lanes the pivot shelved; it pays no commission ("service over
  commission"); it is the only Home surface pointing OUT of the product's new
  thesis. If the founder wants to keep the goodwill feature, park it behind
  All services as a row ("Deals" → a thin page), not on the spine. My
  recommendation: remove entirely, revisit only if monetization research (build
  queue #3) gives deals a job.
- **Hotels chip — remove** (dead already). Replace with **Restrooms** (the finder
  with the highest urgency-per-tap) so the row stays at five.
- **RightNowStrip — do not bring to phone; retire from tablet at convergence.**
  Its job (time-of-day meal routing + AI dish hype) is finder marketing in the old
  emoji-gradient register, with an "(AI estimate)" caveat doing load-bearing work.
  The finder chips + smart search already cover the intent. If dish-hype ever
  returns, it belongs inside PlacesToEat, not on Home.
- **WanderlustLine — keep.** It is the cheapest on-brand thing on the page and the
  only no-ask, no-sell moment. (If the founder wants one more cut, this is the
  only defensible one — but I'd argue for it.)
- **DreamersCorner + DreamShelf — keep, one "DREAM" zone.** They are the intent
  engine (Part 4) and DreamShelf is already stamped-shaped. Longer term the two
  rails should merge (one dream surface: city cards → that city's stamp shelf),
  but that's a later slice, not this one.
- **WishlistCard — phone stays without it** (wishlist is reachable from saves);
  tablet keeps it until convergence.

### Tablet

Officially tabled (G108), but two things can't wait: kill the dead "Book a Ride"
tile (slice 0) and stop leading the Discover stack with RightNowStrip. Real fix =
converge on the phone spine at tablet width (the phone layout is already
max-w-md-agnostic in its components — `wide` props exist on every rail). Until
then the tablet ships the pre-pivot worldview to every iPad user.

---

## PART 3 — ONBOARDING V2: teach the passport in ≤3 screens

Keep the friction-cut discipline (nothing below adds a wall a user can't skip),
keep the existing steps' machinery (`advance`/`finish`/profiles write), change
what the screens SAY and add one render.

**Screen 1 — "Make your passport."**
First name (prefilled from provider when known) + home city (HomeCityField), one
screen. As the user types, a live passport cover renders beside the fields — their
name embossed, home flag on the cover. Copy: *"Your passport starts where you do.
Every place you go adds a stamp."* On continue: profiles write exactly as today
(first_name, home_country/city/lat/lng/timezone + inferred defaults), **plus issue
the page-one home-city stamp** — the meaning model's locked design: visually
distinct origin stamp, not an achievement.
*Data yielded: name, origin country/city (the demographic backbone), language +
currency + units inferred.*

**Screen 2 — "Stamps are places worth going."**
The beautiful-stamp moment. Show their freshly-stamped page one, then, centered on
their home coords, the 3 nearest real stamps from `attractions/nearby`
(StampsNearYou's exact call — zero new backend). Copy:

> *"These are stamps waiting near {home city}. We only stamp the places actually
> worth going — the icons. Be there with GlobeSkimmers open, and the stamp is
> yours: your date, your photos, verified because you were really there."*

No coverage near home → a marquee world set (Eiffel-class stamp art) with the same
copy minus distances. This screen asks for nothing; it exists to make screen 3's
permission ask self-evident.

**Screen 3 — Location permission, passport-framed.**
Existing LocationStep, new copy: *"Stamps are earned by being there. Allow
location so your passport knows when you arrive — we check where you are when the
app is open, and we never track you in the background."* (True: foreground-only is
a locked constraint.) Below the button, the one-line privacy promise (Part 4) with
a "How we use this →" link into Settings → Privacy. Skippable as today.

What onboarding does **not** ask: birthday, traveler type, dream destinations,
gender — all deferred to in-context moments (Part 4). Three screens, one of which
is pure show — the wall got shorter AND it finally teaches the product.

The WelcomeSplash then either retires (Onboarding v2 covers its job) or is rewritten
to the same two heroes; running both explainers would violate the clutter rule.
Recommendation: retire the splash for new users, keep it (rewritten) only as the
returning-user sign-in greeting if the founder values it.

---

## PART 4 — SUBTLE, LEGAL DEMOGRAPHICS: the first-party data strategy

### Doctrine

**Every question is a feature, or it isn't asked.** The user should never meet a
form that exists for our ad business; they meet a birthday stamp, a passport
cover, a "what kind of traveler are you" that visibly re-ranks their Dream rows.
The data exhaust of delight features is exactly the first-party set a
Meta/TikTok-style ad model runs on: **age band · coarse location · language ·
interests · intent**. Gender is optional in that model and we simply don't ask it
in v1.

### What to collect, when

| Signal | How it's asked | When | Ad-model value |
|---|---|---|---|
| Home country + city | "Where's home?" → passport cover + flag + home clock (already built) | Onboarding S1 | Origin / coarse geo — table stakes |
| Language | Device-derived (`inferProfileDefaults`), never asked | Silent | Locale targeting |
| First name | Passport cover (already built) | Onboarding S1 | None (personalization only) |
| **Birthday** | "When's your birthday? You get a birthday stamp wherever you are that day" — an automatic, dated, city-of-the-day stamp + a passport-page confetti moment | **Later, in-context**: a Settings "Passport extras" card + a one-time quiet prompt after the ~3rd stamp. Optional forever. | **Age band** — the #1 required field of every ad platform. Store DOB (needed to fire the stamp), expose only the band (18–24/25–34/…) to any ad system. Doubles as the age screen (below). |
| **Traveler type** | "What kind of traveler are you?" chips — the existing `TravelerTypeStep` (solo / partner / family / friends / varies) + taste chips (foodie, museums, outdoors, nightlife) — visibly re-ranks Dream rows and stamp suggestions | Later: first Dream-zone interaction, or Settings | Psychographics / interests |
| **Dream destinations** | Already built: DreamersCorner taps, "Dream anywhere" queries, DreamShelf city, wishlist saves | Passive, already flowing | **Intent — the most valuable signal in travel.** Needs only server-side capture: wishlist syncs via cloudSync; add dream-tap events to the existing D1 `logDiscover` stream keyed to user id. |
| Travel cadence / purpose | Existing deferred steps (`TravelFrequencyStep`, `TravelPurposeStep`) | Only if a feature needs it (e.g. "plan my year" surface). Don't ask on spec. | Frequency segmentation |
| Gender | — | **Not asked in v1.** Optional in every ad model; the cost/creepiness ratio is bad. Revisit only with a real feature reason. | Optional |
| Current city | GPS while app open (already) | Already | Live geo for own-inventory ads |

**Never (stated policy, put it in the privacy page):**
- Precise home **address** (city + coords of the city center only — the meaning
  model already bans home-doxxing on the map).
- **Contacts upload** in v1 (the social layer launches with in-app
  search/QR/link invites only).
- Background location, ever (foreground-only is locked).
- And never **monetized**, even later: minors' data of any kind, precise location
  trails, passport photos, stamp-level location history tied to identity. Ads may
  use: age band, home country/city, current city, language, interest chips,
  wishlist destinations. Nothing else leaves the profile.

### Where consent lives

1. **At each collection point** — one honest line under the control ("Your
   birthday stays private; we use your age range to keep the app age-appropriate
   and, one day, to pick better ads inside GlobeSkimmers").
2. **Settings → "Privacy & your data"** (new section): what we have (view it),
   the promise (below), a **"Personalized recommendations & ads" toggle** —
   default ON for personalization, but the *ads* half ships default-consistent
   with region (EU: off until asked; US: on with opt-out; honor GPC on web).
   Every field individually clearable. Account deletion already exists
   (site/delete-account).
3. **EU users**: when first-party ads actually ship, a one-time consent sheet
   (plain language, equal-weight buttons, no dark patterns) BEFORE the first
   personalized ad — consent is the lawful basis for ad personalization, not
   legitimate interest (below). Region-detect via home country + store locale.

### The privacy promise (draft copy — short, human, honest)

> **Your passport is yours.**
> We ask a few things — your name, where home is, your birthday if you want the
> birthday stamp — to make GlobeSkimmers feel like yours. Here's the deal:
> we don't follow you around other apps. We never sell your photos, your location
> history, or anything about your kids. If we ever show you ads, we'll pick them
> ourselves, inside GlobeSkimmers, from what you've chosen to tell us — and you
> can turn that off with one switch. Every question is optional. Skip them all
> and the passport still works.

### Legal grounding (2026 state, verified 2026-09-29)

**Apple ATT.** The prompt is required only for *tracking*: linking user/device
data with **other companies'** apps/sites data for advertising or ad measurement,
or sharing with data brokers. First-party data collected in our app, used to
personalize our app and to target/measure **ads on our own inventory**, requires
no ATT prompt — explicitly including data joined across apps owned by the same
company ([Apple's ATT policy analysis](https://www.apple.com/privacy/docs/Mobile_Advertising_and_the_Impact_of_Apples_App_Tracking_Transparency_Policy_April_2022.pdf),
[Pandectes 2026 ATT guide](https://pandectes.io/blog/apple-app-tracking-transparency-att-in-2026-key-business-impacts/)).
In Aug 2026 Apple agreed with Germany's Bundeskartellamt to soften the EU prompt
(neutral wording, no "track" scare-word) — the *rule* is unchanged
([9to5mac](https://9to5mac.com/2026/08/17/apple-will-comply-with-fairer-app-tracking-transparency-rules-in-the-eu/),
[the eight changes](https://9to5mac.com/2026/08/18/the-eight-changes-apple-is-making-to-app-tracking-transparency-in-europe/)).
**Consequences for us:** (1) the whole Part-4 collection plan needs no ATT prompt;
(2) today's **AdMob** banners are third-party — keep them **non-personalized**
(no ATT prompt needed) and never flip AdMob to personalized without shipping ATT +
Google UMP consent; (3) the day we upload hashed emails to Meta/TikTok for custom
audiences, **that is tracking** and requires ATT opt-in — a first-party ad product
sold directly to travel advertisers avoids that entirely.

**Apple privacy nutrition labels.** Self-declared in App Store Connect; must stay
accurate; can be edited any time without an app release. Adding birthday and
traveler-type collection means updating the label (Contact Info → not tracking;
"Data linked to you": name, coarse location, user content, identifiers) and, when
first-party ads ship, adding the "Advertising Data / Third-Party Advertising →
no; Developer's Advertising → yes" purposes. SDK privacy manifests apply to any
new SDK ([Apple: App privacy details](https://developer.apple.com/app-store/app-privacy-details/),
[Apple: privacy updates](https://developer.apple.com/news/?id=3d8a9yyh)).

**GDPR (EU users).** CJEU *Meta v Bundeskartellamt* (2023) + the EDPB's
legitimate-interest guidelines (Oct 2024) settle it: behavioral/personalized
**advertising needs consent** (Art 6(1)(a)); legitimate interest does not stretch
to ad profiling ([EDPB Guidelines 1/2024](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf),
[IAPP on pay-or-consent](https://iapp.org/news/a/pay-or-consent-personalized-ads-the-rules-and-whats-next)).
App **personalization** (re-ranking Dream rows by traveler type the user set) can
rest on contract/legitimate interest with the direct-relationship factor in our
favor (Recital 47) — but the clean architecture is: personalization = product
feature, ads = separate consented purpose, never bundled. Consent must be
granular, as easy to withdraw as to give. Age of digital consent is 13–16 by
member state — under it, parental consent, so EU minors get the same no-ads
default as US minors.

**COPPA (US, minors).** The amended Rule is in **full effect since 2026-04-22**:
separate verifiable parental consent for third-party disclosures, mandatory
written data-retention policies with time limits, broader "personal information"
(biometrics etc.), and the FTC rejected a carve-out for collecting sensitive data
solely for age verification ([Latham & Watkins](https://www.lw.com/en/insights/ftc-publishes-updates-to-coppa-rule),
[Davis Polk on enforcement](https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect),
[BBB Programs](https://bbbprograms.org/media/insights/blog/coppa-amended)).
GlobeSkimmers is general-audience, not child-directed — keep it that way. The
birthday ask doubles as a **neutral age screen** (no nudging, no defaults): DOB
under 13 → no ads personalization, no public passport, no friend tagging, no
photo sharing beyond the device, and don't retain the DOB beyond the band + a
minor flag. This is also the hook for the social layer's minor-safety defaults
(passports of minors private by default, tag-invites from confirmed friends only).

**CCPA/CPRA + the state patchwork.** ~20 comprehensive state laws. CPRA:
notice-at-collection, opt-out of sale/**share** (share = cross-context behavioral
advertising — first-party-only ads avoid it, document that stance), right to
limit **sensitive PI** (precise geolocation is sensitive — another reason
location trails never feed ads), honor GPC on web. The high-water mark is
**Maryland MODPA** (live 2025-10-01, enforced since 2026-04-01): flat **ban on
selling sensitive data** and a flat **ban on targeted advertising to, and sale of
data of, under-18s** ([Enzuzo MODPA guide](https://www.enzuzo.com/blog/maryland-online-data-privacy-act),
[Osano](https://www.osano.com/articles/maryland-online-data-privacy-act-modpa),
[Baker Donelson](https://www.bakerdonelson.com/practical-next-steps-for-businesses-as-marylands-updated-consumer-data-privacy-laws-take-effect-in-october)).
Simplest global policy, adopt it outright: **no ads personalization for anyone
under 18, anywhere.** One rule, satisfies MODPA, COPPA, GDPR-minor rules, and the
app-store laws below.

**Apple age assurance.** The Declared Age Range API now feeds state laws: age
categories (under 13 / 13–15 / 16–17 / 18+) shared with apps for new accounts in
**Texas since 2026-01-01**, Utah 2026-05-06, Louisiana 2026-07-01; 18+ download
blocks in Australia/Brazil/Singapore ([Apple: Texas](https://developer.apple.com/news/?id=2ezb6jhj),
[9to5mac](https://9to5mac.com/2026/02/24/apple-expands-age-assurance-tools-as-new-app-store-requirements-roll-out-in-several-regions/),
[Biometric Update](https://www.biometricupdate.com/202602/apple-updates-declared-age-range-api-for-national-state-level-age-assurance-laws)).
Adopt the API before the social layer ships (it's a native capability → store
build): where the OS hands us an age category, prefer it over the self-declared
birthday for the minor flag.

**What a first-party ad product actually needs** (the Meta/TikTok core-audience
model: demographics = age, gender, location, language; plus interests/behaviors;
plus intent; [Meta targeting 2026](https://adlibrary.com/posts/meta-ads-targeting-options-explained),
[Jon Loomer 2026](https://www.jonloomer.com/meta-ads-targeting-2026/)): our
collection plan yields **age band** (birthday stamp), **location** (home +
current city), **language** (device), **interests** (traveler chips + finder
usage), **intent** (dream destinations / wishlist — in travel the equivalent of a
retail media buy-signal). Gender optional → skipped. That is a complete,
sellable, ATT-free targeting set for ads **on our own inventory**.

---

## PART 5 — BUILD PLAN (slices, sized, review-path flagged)

Capgo OTA covers JS-only changes; a store build is needed only for native
API/plist changes. Supabase migrations deploy via the existing Action.

| # | Slice | Contents | Size | Ships via |
|---|---|---|---|---|
| 0 | **Dead-control cleanup** | Remove Hotels chip (+ add Restrooms), remove "Book a Ride" tile, fix splash starter #05, retitle "Stamps near you", FloatingNav comment/trips cleanup | **0.5 d** | OTA |
| 1 | **Onboarding v2** | 3 screens per Part 3: passport-cover S1, stamp-explainer S2 (reuses `attractions/nearby`), reframed LocationStep; page-one home-city stamp write; retire/rewrite WelcomeSplash | **4 d** | OTA (permission *flow* unchanged; if the Info.plist location purpose string is reworded → store build) |
| 2 | **Home v2 (phone)** | Passport hero card (3 states + reserved friend row), reorder per Part 2, cut DealRadarRow, first-run Atlanta banner, `listPassport` stats surfacing | **3 d** | OTA |
| 3 | **Consent & privacy page** | Settings "Privacy & your data" section, promise copy, personalization/ads toggle (stored on profile), region-aware default, site privacy-policy update, nutrition-label edit | **2.5 d** | OTA + App Store Connect label edit + site auto-deploy |
| 4 | **Profile enrichment** | Birthday → birthday stamp (migration: `profiles.birth_date`, `age_band` derived, minor flag; the stamp fires on app-open on the day), traveler-type chips wired to Dream re-ranking, dream-intent event capture to D1 | **3 d** | OTA + 1 Supabase migration (needs the production-environment approval) |
| 5 | **Minor-safety + age assurance** | Under-18 defaults (no ads personalization, private passport, restricted tagging), Declared Age Range API adoption, neutral age screen polish | **2.5 d** | **Store build** (native API) — bundle with the next native release |
| 6 | **Tablet convergence** | Phone spine at tablet width; retire RightNowStrip/HomeRows/ExperiencesRow or fold survivors into the spine | **2 d** | OTA (or stays tabled; slice 0 already removed its dead tile) |

Total: ~17.5 working days; slices 0–2 (~7.5 d) deliver the founder's build-queue
item 1 prerequisite (Stamps Near You with the first-run explainer) and can ship
independently, in order, each behind `npm run build` + `boot-check` + the founder's
`npm run ota`. Nothing here touches the worker except optionally surfacing
`stats.countries` on `/passport/list` (it may already send it — verify before
assuming a worker change; a worker push is a production deploy).

Open decisions for the founder:
1. Cut DealRadarRow entirely, or park it behind All services? (Recommend: cut.)
2. Keep WanderlustLine? (Recommend: keep.)
3. Retire WelcomeSplash for new users once Onboarding v2 teaches the passport? (Recommend: yes.)
4. Adopt the flat "no ad personalization under 18, anywhere" policy? (Recommend: yes — one rule satisfies every regime.)
5. Birthday prompt timing: after 3rd stamp, or Settings-only? (Recommend: both, prompt once.)
