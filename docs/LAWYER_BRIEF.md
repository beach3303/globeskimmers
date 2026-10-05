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

### 5b. Activity records, audits and legal requests (added 2026-10-05)
- The founder wants the ability to reconstruct a traveler's activity — e.g. the airport
  sequence of a round trip (LAX in → ATL → LAX out), stamps/posts per year — "in case a court
  would request it." Built as an ON-DEMAND admin pull (computed from existing product data
  when asked; airport stamps now record arrival/departure). Claude's position, for the lawyer
  to confirm: do NOT keep standing per-user dossiers — CPRA data minimization disfavors
  retention without an operational purpose, a standing profile raises breach and discovery
  exposure, and nothing requires pre-building what a subpoena could ask for. Questions:
  - Is the on-demand model the right posture? Any duty to pre-preserve more?
  - The privacy policy now discloses legal-process disclosure (draft updated 2026-10-05) —
    is the wording sufficient? Does an on-demand activity view trigger CPRA/GDPR "profiling"
    disclosures, and must aggregate analytics ("travelers stamp N times a year") stay
    de-identified to avoid them?
  - Process for a solo founder receiving a subpoena: who validates it, minimum response,
    user notification policy (warrant canary-type questions), retention schedule to adopt.
  - The privacy draft is stale in spots (names Base44; says camera images are never stored,
    but dish/guestbook photos now are) — have the lawyer review the rewrite.

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

## Insurance (researched 2026-10-05 — full sourced version: docs/INSURANCE_RESEARCH_2026-10.md)

- **Buy one bundled policy: Tech E&O + cyber with media liability, $1M limits.** Media
  liability is what defends trademark/trade-dress/copyright and defamation claims arising
  from content — the stamp art and user feedback. Patent is excluded everywhere (irrelevant
  here). Plain general liability does NOT cover IP ("advertising injury" is endorsed away);
  umbrella doesn't extend E&O/media/cyber, so skip it.
- **Quotes:** Hiscox direct first (tech E&O includes cyber at no extra cost; from ~$22.50/mo —
  the only real fit for a $20–100/mo budget), then Vouch (startup-native, Hiscox-backed,
  broader wording at the ~$3–7k/yr tier) and Embroker as the comparison.
- **Realistic cost:** ~$600–1,200/yr for a $1M bundled E&O/cyber with a media component plus
  cheap GL (~$180/yr). Standalone IP-defense insurance runs ~1–2% of the limit
  ($10–20k/yr) — not practical now. Context for the stakes: defending even a small
  trademark suit averages ~$327k, which is why the media-liability route matters.
- **Two must-dos on the application:**
  1. Disclose the stamp hold-back practice as a risk control ("we review stamp art for
     protected designs and withhold matches"). Hiding a known circumstance triggers the
     prior-knowledge exclusion and can void coverage — courts enforce this, including on a
     known trademark dispute. Insure BEFORE any demand letter ever arrives; a known dispute
     gets excluded.
  2. Get written confirmation that hosted user content (guestbook notes, doodles, dish
     photos, private feedback) is inside the policy's "media content" definition — base
     forms often cover only content the insured created; platforms need the expanded-UGC
     endorsement.
- **Not insurable:** FTC Consumer Reviews Rule penalties ($53,088/violation; first warning
  letters Dec 2025). The kind-notes-public / negatives-private design is a lawyer question,
  not a policy question (see topic 1). Cyber's regulatory sublimit does cover privacy
  regulators — relevant to COPPA (amended rule in force since June 2025; the 13+ age gate
  helps underwriting, and carriers are scrutinizing children's-data sublimits post-TikTok).
