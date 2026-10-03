# GlobeSkimmers — North Star (brand + monetization)

**Source:** the founder's ChatGPT strategy conversation, shared 2026-10-02
(full transcript: `docs/reference/chatgpt-northstar-transcript-2026-10-02.md`).
This document is the distilled register of that conversation — the agreed
direction, the monetization architecture, and the guardrails — cross-checked
against what the app already has. `docs/PLANS.md` stays the day-to-day queue;
this is the horizon it points at.

---

## 1. The one-sentence company

> **GlobeSkimmers turns real-world presence into verified, collectible,
> shareable digital memories.**

The product is not "a travel app." It is a **verified memory network for real
life**. The emotional core is three words: **"I was there."** A Dodgers fan
ten minutes from the stadium isn't traveling — but they're *there*. That's why
the company outgrows "travel" without abandoning it.

**The internal thesis test** — every feature must pass:

> *Does this help someone remember, prove, collect, or share that they were
> there?*

If yes, it belongs. If not, be careful.

**The loop:** PLACE → EXPERIENCE → STAMP → MEMORY → SHARE → DISCOVERY → NEXT
EXPERIENCE. Sharing is not an accessory — without it this is a scrapbook; with
it, it's a network.

## 2. Brand: GlobeSkimmers stays — working conclusion, exploration open

The naming exploration (WasHere, AmHere, IWasThere, !¡Here!, WasAt, ~75 names
screened across four rounds) did **not** end in a formal decision — the
transcript closes with five fresh finalists awaiting deeper clearance and
GlobeSkimmers held as "the control option." But every screen pointed the
same way:

- Every catchy "here/been/stamp/moment" name is **crowded** — existing apps,
  domains, or a pending "I WAS HERE" US software trademark (filed 2026-08-13).
- **GlobeSkimmers is already a distinctive invented word attached to a live
  App Store product.** That is the hard part, already done.
- The smartest architecture is a **language system**, not a rename:
  - **GlobeSkimmers** — the company and the app
  - **Virtual Passport™** — the collection (ALWAYS "Virtual Passport," never
    bare "passport"; keep the "Not a government document" line)
  - **Verified Stamp™** — the collectible, proof of attendance
  - **"I WAS HERE"** — the stamp/share language (place-level)
  - **"!¡HERE!"** — candidate arrival-moment expression (the notification
    people hope to see)
  - Tagline candidate: **"Collect your world."**
- Partner lockups read: **DODGERS × GLOBESKIMMERS — I WAS HERE!** /
  **DISNEYLAND × GLOBESKIMMERS — Limited Edition Virtual Passport Collection.**
- Naming principle from the screens: **don't name the company after the
  mechanism** (stamp/verify/location) — the company is about *experiences*.
- Open shortlist if the exploration resumes (none committed, all need
  attorney-level clearance first): WentHere ("currently interests me most" —
  ChatGPT), BeenBook, Attndi, BeenTrove, TrueMoment; earlier round: TruHere,
  BeenIn, Happnd. Until the founder decides otherwise, everything ships as
  GlobeSkimmers.

## 3. The three collectible families

Everything lives in the Virtual Passport under three understandable families:

1. **Places** — cities, landmarks, parks, attractions, restaurants, resorts,
   airports, cruises. *(Live today.)*
2. **Events** — games, concerts, festivals, conventions, premieres, races,
   championships. *(The next frontier.)*
3. **Journeys** — flights, road trips, cruises, train routes, multi-city
   trips. *(Later.)*

**Edition rarity comes from reality, not manufacture** (no blockchain):
Standard / Limited / Seasonal / Anniversary / Championship / Premiere /
Opening Night / Final Performance / Historic Event. "World Series Game 7 —
attendance-verified, only obtainable Oct 31, no longer available." The event
itself created the scarcity.

**Two stamp tiers everywhere** (founder doctrine, confirmed 2026-10-02):
- **GlobeSkimmers stamps** — our own graphic design, **no team logos or
  protected marks/art, ever**. Covers the world immediately ("Professional
  Baseball Game — Los Angeles — Oct 18"). Establishes user demand and is the
  permanent interim for any venue/team/artist we have no deal with yet.
- **Official Partner Stamps** — the partner **supplies the stamp's graphic
  design (or approves ours) and grants a term-limited license** to their
  logos, marks, and company assets for the partnership's duration; plus
  animations, links, and the "OFFICIAL PARTNER COLLECTIBLE" badge. This is
  what organizations pay for — and when a deal ends, their assets come out
  and the generic house stamp remains (already-earned collectibles handled
  per the termination clause).

## 4. The moat

The idea **will** be copied (market intel from the naming screens: Stamped,
HereProof, LiveStamp, LivedIt, Beenmark, PlaceTally, MemoryMark, Roamory,
BeenAt, MomentTrail are all circling pieces of it). Do not build on secrecy.
The moat is what can't be reproduced quickly:

> **One traveler. One identity. One Virtual Passport. Every destination.**
> User history + event database + verification system + partner network +
> licensed collectibles + social graph + creator tools + analytics + brand
> relationships.

A Disney-only system ends at Disney. GlobeSkimmers follows the traveler for
life — which also makes the passport **more valuable every year the user owns
it** (the retention/switching-cost engine: at 20, 18 stamps; at 45, 742).

**No stamp without proof** (founder doctrine, 2026-10-03). Every NEW stamp is
earned by corroborated GPS at the place, or by a photo taken there (its
location tag, or the place recognized in it). Page one — the home city — is
stamped by GPS while home. A friend's tag records that you were there
together; the stamp itself takes your own proof. The only exception is the
birthday page (a calendar page, not a place claim). Stamps made before this
rule stay in travelers' passports untouched (grandfathered, shown without ✓).

**GlobeSkimmers Verified Presence** is the technical moat: geofence + event
time + rotating QR + NFC + beacon + ticket + partner API (mix per event).
Verified ✓ vs. added manually. *(The 2026-10-02 verified-stamps doctrine —
GPS-at-the-place or photo proof, honor button removed — is this moat,
already shipping.)*

**Social feature with explosive potential:** "You were there together" — tag
companions on an event stamp, share card says **WE WERE THERE**. *(Passport
tags/co-sign already built; extend to events when events land.)*

## 5. Monetization — the six layers

Architect so all six can coexist; do **not** launch all six.

| # | Layer | What it is |
|---|-------|-----------|
| 1 | **Official event partnership fees** | Teams, parks, artists, venues pay to participate (licensed stamps, seasons, drops) |
| 2 | **Featured sponsorships** | Brands sponsor collections/seasons/positions (luggage slots, "presented by Mastercard" on a game stamp) |
| 3 | **Commerce / affiliate** | Tickets, merch, hotels, luggage — trackable links from collectibles |
| 4 | **Premium collectibles** | Paid visual upgrades / collector experiences where contracts permit |
| 5 | **B2B analytics** | Partner dashboards: collectors/day, editions, share rates, age bands (consented, aggregate), repeat attendance |
| 6 | **Consumer premium membership** | Advanced Virtual Passport features, archival, customization |

The sponsor-inside-a-collectible structure is the signature: the ad is part of
something the user *wanted to collect* — four-way win (venue engagement,
sponsor exposure, GlobeSkimmers revenue, user keepsake).

### 5a. Interactive Luggage Partnerships (nearest-term; rides shipped Virtual Luggage)

Product: a brand's real luggage as an interactive trunk — rotate all six
faces, decorate with earned travel stickers, save, share; "Shop This Luggage"
deep link. Sell as **brand sponsorship, not CPM advertising**.

- **Package:** annual sponsorship + one-time interactive production fee
  ($2.5K–$5K per luggage design) + 5–10% affiliate commission on attributable
  sales.
- **Positions:** two Featured Partner slots above the GlobeSkimmers trunks
  (Classic, Cognac, Midnight, Expedition, Voyager, Explorer stay the house
  line). Externally "Global Featured Luggage Partner #1 / #2" with annual
  minimums — competitive internally, never called an auction to luxury houses.
- **Founding Partner structure:** visible list price with an early-stage
  discount (e.g. list $20K/yr, founding $10–15K yr-1; or $3–5K six-month pilot
  + affiliate with auto-renew options at 25K/50K/100K MAU), **milestone
  pricing escalators written into the contract** — never lock startup pricing
  through 250K MAU. Example schedule: $1,000/mo under 25K MAU → $2,500 →
  $4,500 → $8,500 → renegotiation at 250K+. Founding perk: ~20% below
  published rates for 24 months.
- **Co-Marketing Commitment is a required element** of every founding
  sponsorship: the brand promotes GlobeSkimmers on its own channels
  ("Customize your RIMOWA with your travel history on GlobeSkimmers"). Weigh
  whole offers, not checks — "$75K cash + 8% affiliate + $100K promotional
  support + brand-channel promotion" can beat $100K flat. At this stage their
  distribution may be worth as much as their money.
- **Position floors:** launch minimums $1,500/mo (#1) and $1,000/mo (#2); at
  100K MAU ≈ $12,500/$8,000 per month (≈$150K/$100K per year); at 250K MAU
  $25,000/$15,000 per month.
- **Rate-card ladder (list, per premium sponsor):** pre-launch $15–25K →
  10–25K MAU $25–45K → 25–50K $40–75K → 50–100K $70–125K → 100K w/ proven
  sharing $100–200K+ → 250K $200–350K+.
- **The metric that sells it:** not impressions — *"7,500 travelers
  voluntarily shared luggage featuring your product this month."* Track
  **Sponsored Luggage Share Rate** (sharers ÷ customizers) and
  **share-generated visits** (referral deep links on share cards).
- Targets: RIMOWA, Samsonite, TUMI, Away, Monos, Briggs & Riley, LV.
- **MAU is the pricing variable** — monthly actives, never downloads.
- Pitch-support math: a RIMOWA Check-In L retails ≈ $1,950 (one attributed
  sale matters); a reported 5% RIMOWA affiliate rate exists to verify
  directly; at 100K MAU × 5 luggage views/mo ≈ 6M impressions/yr ≈ $90–150K/yr
  of media value at $15–25 CPM — the floor argument for a $100K+ rate card.

### 5b. Verified Park Collectibles (Disney / Universal)

Pitch: *"GlobeSkimmers turns a physical park visit into a verified digital
collectible that lives in the traveler's Virtual Passport and travels onto
social media."* Disney Corporate Alliances / Universal partner programs are
the real-world doors.

- **Experience (restrained v1, expand after proof):** permanent arrival stamp
  per park → seasonal limited editions (Halloween pumpkin, holidays, Lunar New
  Year, anniversaries) → monthly character/attraction drops (park controls IP
  approval) → verified collection (geofence + optional rotating park QR) →
  shareable 9:16 story edition → referral loop ("Collect yours when you
  visit") → completion psychology ("Disney Collection — 31/74").
- **Deal shape:** start **Disneyland Resort only**; master agreement +
  short addenda per property (DCA seasonals, WDW, Cruise Line, hotels,
  international subject to local rights-holders — Tokyo is Oriental Land,
  Hong Kong is a JV; Universal parks hold third-party IP — never assume).
- **Rate card:** $30K six-month founding pilot (0–5K MAU) → $60–90K/yr
  (<25K) → $100–175K (25–100K) → $200–350K (100–250K) → $400–750K+ (250K+).
- **Weigh cash + distribution + experiences against max cash.** Seriously
  evaluate $30K + in-park QR signage ("YOU WERE HERE. MAKE IT OFFICIAL — only
  on GlobeSkimmers") + Disney social promotion + in-kind experiences against
  a $75K flat offer: **Disney acquiring GlobeSkimmers users is the real
  prize.** (Benchmark for the in-kind column: Disneyland VIP Tours run
  ~$500–800/hour.) Founder also floated a visitor-side sweetener while we're
  small: early stampers could receive an introductory park discount/benefit —
  undeveloped, on record.
- Non-cash asks live under **"Strategic Partner Consideration & Product
  Development Support"**: park admission for product/testing, VIP tour
  allocations, hotel nights, event tickets, content-capture access, cruise
  sailings for building Cruise collections, one hosted premium partner
  experience annually ("could that include Club 33?" is asked in the room —
  never written as a contractual demand).
- **Contract non-negotiables:** GlobeSkimmers owns the platform, tech,
  original art, analytics methodology; partner licenses their IP in, never
  acquires the platform; exclusivity sought is "official third-party Virtual
  Passport collectible partner" for 12–24 months — not "you may never build
  stamps"; termination must address already-earned collectibles; data rights
  explicit.

### 5c. Event stamps (sports / concerts / festivals)

- Sell **seasons, not stamps**: "2028 Dodgers GlobeSkimmers Digital
  Collectible Season" — 81 home editions + Opening Day + rivalry + Jackie
  Robinson Day + playoffs. Same architecture resells to MLB/NBA/NFL/NHL/MLS,
  European football, F1, tennis, golf, college sports, international
  competitions.
- Concerts are the emotional peak ("Taylor Swift — Night 4 — I WAS THERE";
  "Went with Mom ❤️"). Residencies = limited editions.
- Presenting-sponsor layer stacks a brand onto a team stamp.
- B2B report per partner: collectors/night, new vs returning, share rate by
  edition, clicks to tickets/merch, age bands (consented, aggregated), repeat
  attendance. *(The birthday demographic work shipped 2026-10-02 feeds
  exactly this.)*

### 5d. The GlobeSkimmers Seal (verification as a product)

Verification is never a checkmark — it is **the Seal**: a miniature worn-ink
stamp-seal (dashed ring + star), granted only by the founder's admin desk.
The ink is the meaning (founder doctrine, 2026-10-03):

- **Gold — Honored.** Not a category: an act. People *or businesses* the
  founder personally honors. Cannot be bought, applied for, or earned.
  **Never for sale, ever** — its entire value is that it is given.
- **Silver — Founding** (reserved, not yet granted): the first official
  partners who join early, never reissued after — scarcity for outreach.
- **Burgundy — Official**: businesses, partners, public figures. Included
  free with partnership deals; later a vetted business-verification program
  (~$99–199/yr territory) monetizes it without cheapening it.
- **Sapphire navy — Places** (reserved): official city/country tourism
  accounts, matching the 600+ held place names.
- **Teal — House**: GlobeSkimmers' own team accounts.

Ordinary usernames are never marked. We do NOT sell consumer verification
X-style — the Seal's trust is the same asset the partnership lanes sell.

## 6. Growth & credibility plan

- **Apply to YC now** (W2027 batch, Jan–Mar in SF; standard deal $500K =
  $125K for 7% + $375K uncapped MFN SAFE; ~40% of funded companies are
  idea-stage). Don't wait on it to move.
- **Plug and Play Travel & Hospitality now** (350+ travel startups).
- **Comcast NBCUniversal LIFT Labs now** — explicit executive access to
  Universal Destinations & Experiences; pitch the Universal version.
- **Disney Accelerator later** — it's growth-stage; a target to build toward.
- **Techstars** — the broad-network option on the same table.
- Before deep partner talks: IP attorney on ownership of code/designs/art/
  databases/brand **and any potentially patentable technical implementation —
  move quickly; the naming screens showed competitors visibly entering this
  space**; show the experience in meeting #1, never architecture or the
  roadmap.

## 7. Guardrails (compliance & craft)

- **Written brand authorization + approved assets** before any branded
  luggage/stamp ships. Luxury houses will demand approval over logos, imagery,
  animations, and what stickers may cover their product.
- **FTC:** disclose material connections near the link, not just a Buy
  button. Organic user sharing needs no disclosure — so **build organic
  sharing first; never pay/points-incentivize sharing** without adding the
  disclosure machinery.
- **Generic event stamps use no protected marks** — typographic, city + sport
  + date (the house worn-ink aesthetic already does this).
- Sponsor attribution on share cards stays **elegant** — the user's travel
  memory is never turned into a billboard.
- Privacy: park/venue reporting is aggregate and consent-based; age bands,
  never birthdays; verification design prefers on-device geofence + rotating
  QR over storing precise location trails.
- "Virtual Passport," never "passport" alone, in all partner materials.

## 8. What this means for the build (state as of 2026-10-02)

Already in place and pointing the right way:
- Verified-only stamps (GPS/photo proof) = the Verified Presence moat, live.
- Virtual Luggage v2 (six trunks × six faces, stickers, unlock chain) = the
  sponsorship vehicle, live; share-card lane exists.
- Theme-park kingdoms seeded as separate gate-anchored stamps; world icon
  layer (1,130 places) live.
- Tags/co-sign ("were you there together?") built for places.
- Age gate + birthday collection + admin age-mix = the B2B age-band reporting
  substrate.
- `TICKETMASTER_API_KEY` already sits in worker secrets — the events lane has
  a data door waiting.

Nearest gaps the North Star exposes (build-queue candidates, in rough order):
1. **Share-card referral deep links** (share-generated visits are a core
   sales metric for every layer).
2. **Events family v1** — generic (unlicensed) event stamps at
   stadiums/arenas/venues with edition logic; Ticketmaster for detection.
3. **Sponsor-ready analytics counters** — luggage interactions, sticker
   placements, saves, shares, per-stamp collectors/day (most exist as events
   in D1; need the partner-facing rollup).
4. **Luggage "Featured Partner" slot scaffolding** (two slots above the house
   line, behind a flag until a contract exists).
5. **Rate-card one-pagers + pilot pitch decks** per lane (luggage, Disneyland,
   Dodgers) when the founder says go.

---
*Keep this document updated when the founder revises direction in future
strategy sessions. PLANS.md references this file; memory
`google-of-travel-brief` and the Stamp Atlas remain the product/design
companions.*
