# Lawyer brief — questions and risk inventory

A living file (founder asked 2026-10-05: "collect things that you'd like for me to take to your
lawyer"). Claude adds to it as decisions come up; take it to the consultation as-is.
Last updated: 2026-10-05.

## The app, for the lawyer, in one paragraph

GlobeSkimmers (California, solo founder) is an iOS/Android travel app. Travelers collect a
fictional "Virtual Passport" of illustrated stamps earned by being at a place (GPS-verified;
labeled "Not a government document · A keepsake travel journal"). Nearby finders (restaurants,
cafés, convenience stores, attractions) carry user content: short public "kind notes" and
finger doodles in per-place guestbooks, photos of dishes/drinks/purchases, and — new — private
messages to the business owner that are never published, are screened by AI for threats and
abuse, and are stored for delivery once the owner later claims and verifies the business.
Negative-reading public notes are held for human review before posting; the app says kind notes
post and other feedback goes privately to the owner. No bookings, no payments from travelers
today. Planned: paid tools for verified business owners ($20–100/mo) and a "verified owner"
seal. Users are 13+ with an age gate; under-18s post without city and can't sign private
messages by name.

## The one big ask

**An app-wide legal audit: "where could I get in trouble?"** — walk the lawyer through the app
and this inventory, and have them rank the real exposure. Everything below feeds that.

## Questions to ask, by topic

### 1. Reviews and the private-feedback channel (FTC)
- The guestbook shows kind notes publicly; notes that read as negative are held for our review;
  unhappy feedback is invited into a private channel to the owner. Under the FTC's 2024 Rule on
  Consumer Reviews and Testimonials (review suppression/curation), is this structure OK for
  something framed as a guestbook, not reviews? What exact disclosure wording should the
  guestbook and the private-message sheet carry?
- Private messages: screened by AI, with a middle "held for our team" tier. Any duty once we
  KNOW of a complaint (e.g. a message alleging food poisoning)? Retention period? Must we
  deliver, or may we discard spam/abuse silently?
- When an owner claims the business: may we show them messages sent BEFORE they claimed?
  (Senders were told: "Sent privately to the owner when they join GlobeSkimmers.")

### 2. Owner claiming, verification and monetization
- Structure check: claiming + reading private feedback = free once verified; money is charged
  only for extra tools (reports, trends). Confirm this avoids the "pay to see complaints"
  extortion optics (Yelp-style accusations), and that the seal ("Owner verified") wording is
  safe if only paying owners keep extra features.
- Verification documents (EIN / business registration / domain email / listed-number callback /
  postcard-to-address): what may we collect, how must we store it, and what's the minimum
  acceptable evidence tier for tiny businesses abroad with no EIN equivalent?
- Liability if we verify the WRONG person and hand them private messages. What process +
  terms language limits that?
- A business demands the private messages about it WITHOUT paying/claiming ("that's our
  restaurant — release them"). What's our obligation? (Founder's worry, 2026-10-05.)

### 3. Stamp art (IP)
- ~1,000 illustrated landmark stamps, drawn in-house in one engraving style. Buildings are
  drawn from public viewpoints. Six are held back as typographic pending permission (Hollywood
  Sign, Walt Disney World castle, Graceland, Fenway Park, Dotonbori's Glico sign, Naoshima
  pumpkin). What's the right clearance standard for the rest — e.g. stadium names/trade dress,
  museum interiors, sculptures (sculptures ≠ buildings under copyright), branded storefronts
  inside skyline drawings?
- The app SELLS nothing with the art today (stamps are earned, app is free). Does planned
  monetization elsewhere in the app change the analysis?
- Register "GlobeSkimmers" as a trademark; anything to clear on "Virtual Passport"?
- Insurance disclosure: we knowingly hold back six risky stamps — how do we describe that to a
  carrier without poisoning coverage (prior-knowledge exclusions)?

### 4. User content generally (guestbooks, doodles, dish photos)
- CDA §230 posture; our moderation (AI screen + human hold queue) and §230(c)(2).
- Register a DMCA agent with the Copyright Office (cheap, online) — confirm and do it.
- Terms of service: the license users grant for notes/doodles/photos; add the private-message
  terms; if owner-facing printing/exports ever ship, the license must cover that use.
- Bystanders and staff in users' photos; photos of menus/prices; anything to add to review?
- Apple App Store 1.2 UGC duties (report/block exist) — anything missing?

### 5. Minors and privacy
- Age gate is 13+ (birth-year, self-declared); under-13 excluded (COPPA). Teens: no city shown,
  no signed private messages, GPS used for stamping. Is self-declared birth year enough at our
  size? Any teen-specific GPS/photo concerns (CCPA/CPRA sensitive data, EU users → GDPR)?
- Our privacy policy draft (docs/PRIVACY_POLICY_DRAFT.md) — review against what the app
  actually collects: GPS fixes, photo EXIF location (used as visit proof), photos processed by
  an AI vision model for moderation/recognition, analytics events.
- Mecca/Medina and other sensitive-place stamps: any liability angle, or purely reputational?

### 6. Formation and money
- LLC (or current structure) adequacy for the above; CA specifics.
- Stripe Tax questions are with the accountant (2026-09-27) — ask the lawyer only where tax
  touches terms (e.g. owner subscriptions).

## Risk inventory Claude would flag for the audit (app-wide)

| Area | What exists today | Why it could bite |
|---|---|---|
| Review curation | Kind notes public, negatives held/private | FTC 2024 review rule |
| Private owner messages | Stored complaints about named businesses | demands for release; knowledge of allegations |
| Owner verification (planned) | Docs/EIN collection | KYB, doc storage, wrong-person delivery |
| Stamp art | 994 live illustrations, 6 held | trademark/trade-dress claims by large rightsholders |
| Dish/guestbook photos | AI-moderated, proof-gated | IP in photos, bystanders, §230 limits |
| GPS + EXIF proof | Location verifies visits | sensitive-data rules (CPRA/GDPR), teen data |
| AI moderation | Claude screens text + photos | over/under-blocking; FTC unfairness if advertised wrong |
| Age gate | Self-declared 13+ | COPPA if under-13s slip through |
| "Virtual Passport" | Fictional document + disclaimer | impersonation/official-document rules (likely fine) |
| Airport prompts | GPS detection at airports | nothing obvious; confirm |
| Price/visit info | AI-extracted from official sites | accuracy claims; "verify on official site" link exists |

## Insurance (preliminary — a sourced 2026 research pass is running and will update this)

Claude's working view, 2026-10-05; verify with a broker:
- **Tech E&O bundled with media liability** is the core policy — media liability is the part
  that defends copyright/trademark/defamation claims arising from content (stamps, UGC).
  Patent claims are excluded everywhere; true patent-defense insurance exists but is not
  practical at this size.
- **Cyber liability** (user data: GPS, photos) — often bundled with the above.
- **General liability** — cheap, required by some partners/landlords.
- Startup-focused carriers to quote: **Vouch**, **Embroker**, **Hiscox**, **Coalition**
  (cyber-led), **Chubb** via broker. Ask each: does media liability cover user-generated
  content, and is there a UGC or "failure to moderate" exclusion? Disclose the six held
  stamps plainly; concealing a known risk voids coverage faster than the risk itself.
- Realistic budget: a small app can usually get Tech E&O + media + cyber at $1M limits for
  roughly $100–250/mo total; $20–100/mo buys partial cover (GL + thin cyber) but usually not
  meaningful media liability. Pending the research file for exact 2026 figures.
