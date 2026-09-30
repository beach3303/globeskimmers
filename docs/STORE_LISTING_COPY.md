# Store listing copy — drafts for App Store + Play Store

All copy below is drafted to your character limits. Edit anything before submission. The same body description works for both stores.

---

## App name (both stores, ≤30 chars)

```
Globeskimmers
```
*12 / 30 chars ✅*

---

## App Store subtitle (≤30 chars)

Apple shows this directly under the app name in the store. The job: tell someone in 3 seconds what they're buying.

**Option A (recommended — the product):**
```
Your Virtual Passport
```
*21 / 30 chars ✅*

**Option B (action-forward):**
```
Stamp every place you go
```
*24 / 30 chars ✅*

**Option C (warmth-forward):**
```
Collect the world
```
*17 / 30 chars ✅*

---

## App Store promotional text (≤170 chars)

This is the only text Apple lets you change WITHOUT submitting a new app version. Use it for time-sensitive things (a holiday push, "Now with X feature", etc.). Default copy:

```
Your Virtual Passport stamps every place you go. Collect memories, share pages with friends, send postcards — and let your trunk wear the stickers every trip earns.
```
*164 / 170 chars ✅*

---

## Google Play short description (≤80 chars)

Shows above the screenshots on the Play Store listing.

```
Your Virtual Passport — collect stamps, memories & postcards everywhere you go.
```
*79 / 80 chars ✅*

---

## Long description (both stores, ≤4000 chars)

The main pitch. Used identically on App Store description + Play Store full description.

```
Globeskimmers is your Virtual Passport — a beautiful, realistic travel booklet that stamps every place you go, and keeps the memories that prove it.

Arrive somewhere worth remembering and your passport senses it: the Georgia Aquarium, the Eiffel Tower, a Las Vegas layover, even the exact steps where Rocky raised his arms. Tap once and the place is stamped forever — hand-engraved, dated, yours.

YOUR PASSPORT
• Verified stamps — GPS and your own photos prove you were really there
• Memory photos — every stamp holds an album; each city gathers its prints into photo packets
• Iconic stamps — hundreds of hand-engraved artworks for the world's most famous places
• Movie-scene stamps — stand where famous scenes were filmed and earn the film strip to show it

SHARE IT, YOUR WAY
• Share your passport — friends react with collectible stamps: WOW, TAKE ME, BEEN HERE ♥, I WANNA GO, MORE PICS PLEASE
• The Guestbook — friends leave a signature or a little finger-drawn doodle on your pages
• Postcards — send a moment straight to a friend, never into a feed
• Profiles, @usernames & following — and text invites for friends & family
• Virtual Luggage — a photoreal trunk that wears the stickers every destination earns

THE TRAVEL TOOLKIT
Everything you need the moment you land: nearby restaurants ranked for authenticity, coffee, ATMs, restrooms, convenience stores, live exchange-rate comparisons, weather, cultural know-how, and a camera scanner that translates signs and converts prices.

PRIVATE BY DEFAULT
Your passport is yours alone until you choose to share it. Photos you add stay in your private journal; anything made public passes automated review first. Every profile can be blocked, every item reported. Travelers under 18 get extra protections: their passports can't be made public and new followers need their approval. We never sell your data and never track you across other apps.

Free to use, supported by ads. Built with care by travelers, for travelers — collect the world, stamp by stamp.
```
*~2,015 / 4000 chars ✅*

---

## App Store keywords (≤100 chars, comma-separated)

Apple counts every character including commas. Pick the ones that real searchers actually use — not what sounds good in marketing.

```
travel,passport,stamps,journal,memories,postcards,trip diary,scrapbook,friends,places
```
*85 / 100 chars ✅*

Reasoning on each:
- **travel** — the highest-volume term in your category
- **currency converter** — competitive but you ARE one
- **translator** — same
- **scanner** — captures camera-scan searchers
- **price** — captures shopping-trip searchers
- **exchange** — Money Exchange feature
- **ATM** — high-intent searchers
- **restaurant finder** — PlacesToEat feature
- **phrases** — BasicPhrases feature
- **abroad** — explicit travel intent

---

## Category

| Store | Primary | Secondary (optional) |
|---|---|---|
| App Store | **Travel** | Lifestyle |
| Play Store | **Travel & Local** | (no secondary) |

---

## Support URL

```
mailto:founder@globeskimmers.io
```
*Apple/Google accept either a `mailto:` link or a real support page.*

---

## Marketing URL (optional but recommended)

```
https://globeskimmers.io
```
*The landing page lives in `site/` and serves globeskimmers.io once the domain is attached in Cloudflare. Globeskimmers owns globeskimmers.io only: globeskimmers.com belongs to someone else, so don't use it.*

---

## Privacy policy URL

```
https://pacific-bandana-537.notion.site/Privacy-Policy-Globeskimmers-3776cbd3ba6b805c8775ffcdecafbd4f
```

✅ Live and publicly accessible (verified). Hosted on Notion's published-page CDN — no login required for App Store / Play Store reviewers.

To edit the policy later: open the page in Notion (you're signed in as the owner), make edits, they auto-save and are immediately live at the same URL. The "Last updated" date at the top should be bumped whenever the substantive content changes. The URL itself stays stable — that's the URL the store listings will reference, so don't change the page title or republish from scratch.

---

## Age rating

Both stores ask a questionnaire. Suggested answers based on what the app actually contains:

| Question | Answer |
|---|---|
| Violence | None |
| Sexuality / nudity | None |
| Profanity | None |
| Alcohol / tobacco / drugs | None |
| Mature themes | None |
| Gambling | None |
| Unrestricted web access | **Yes** (the app loads camera-scan results and place info that come from third-party APIs — be safe and disclose) |
| User-generated content | None (no chat, no posts, no comments yet) |
| Personalized ads | **Yes** (AdMob banner) |
| Location collection | **Yes**, only when user grants permission |

Result: should land at **4+ / Everyone**.

---

## Pricing

| Field | Value |
|---|---|
| Price | Free |
| In-app purchases | None (Globeskimmers Premium launches as a separate update — not in v1) |

---

## Available regions

Recommend launching **globally** unless you have a specific reason to start narrower. The app's content (currency, translation, place finders) works in any country with Google Places coverage, which is nearly all of them.

---

## Pre-submission checklist

| ✅ | Item |
|---|---|
| ✅ | Legal name in privacy policy → Globeskimmers |
| ✅ | Contact email in privacy policy + store listing → founder@globeskimmers.io |
| ✅ | Privacy policy effective + last-updated date set |
| ✅ | Privacy policy hosted at a public URL (Notion) |
| ⏳ | Set up the marketing URL OR mark optional |
| ⏳ | Capture 6.7" iPhone screenshots (1290×2796) — minimum 3, ideally 5-7 |
| ⏳ | Capture Android phone screenshots (1080×1920+) — minimum 2, ideally 5-7 |
| ⏳ | Bump CFBundleVersion / android versionCode if resubmitting |

## Social P1 questionnaire flips (prepare WITH the next native build — do not submit before)
The moment profiles/visibility ship (Social P1+P2), both stores' questionnaires change:
- Apple: UGC = YES (report ✓ /social/report, block ✓ /social/block, filter ✓ fail-closed photo
  moderation, contact ✓ founder email). Expect the age rating to move 4+ → 13+ (Apple's
  2025 tiers: 4/9/13/16/18). Adopt the Declared Age Range API entitlement in the same build.
- Google Play: "Users can interact" = YES, UGC = YES; target audience must NOT include
  children (keeps AdMob out of Families policy). Data-safety form adds: user IDs (handles),
  photos (user-shared), coarse "places visited" (user content, optional, not sold).
- Both: privacy policy gains the social section + the one-line promise ("Your stamps and
  photos are yours — we never sell your photos or your location history, and we never show
  ads to kids").

## What's New — v1.0.3 (iOS) / 1.0.7 (Android), 2026-09-30

App Store "What's New" / Play "Release notes" (≤4000, aim short):

> Your Virtual Passport just became a place to meet fellow travelers.
>
> • Share your passport — friends react with collectible stamps: WOW, TAKE ME, BEEN HERE ♥, I WANNA GO, MORE PICS PLEASE
> • The Guestbook — leave a signature or a little finger-drawn doodle on someone's page
> • Postcards — send a moment straight to a friend, never a feed
> • Profiles, usernames & following — with strong privacy defaults and extra protections for teens
> • Virtual Luggage — walk around your trunk and place the stickers every destination earns
> • Photo packets, city sets, a birthday stamp, and dozens of polish fixes

Reviewer notes (App Review / Play "App access"):
> Social features require an account. Passports are PRIVATE BY DEFAULT; all user
> photos/drawings pass automated review before public display; every item can be
> reported in-app; blocking is available on every profile; under-18 accounts cannot
> go public and require follower approval. Test account available on request.
