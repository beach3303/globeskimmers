# Passport — Meaning Model (build spec)

Status: **meaning model LOCKED 2026-07-28** (decisions below), build not started.
This is the authoritative reference for what the passport *means* and how a stamp
is earned. Extends the fuller concept in memory `project-passport-guestbook-vision`.

---

## The one principle
> **A stamp is a memory you *earned* by actually being somewhere — kept for life, with your own photos.**

Meaning comes from the accumulating record of **real places you've been**, not a
badge for signing up or for using the app.

---

## Locked decisions (the three forks)

### 1. Feeling: **Memory journal first** (not a points game)
The passport leads with the **emotional** layer — your photos, your caption
(*"I was here — Lake Louise, Banff · Aug 2026"*), a life of travel you keep.
Stats, milestones and the map are **secondary and quiet** — present, celebratory,
never the headline, never punitive. (Brand rule: celebrate consistency, never
punish absence — no streak-loss.)

### 2. Granularity: **Tiered** (keeps stamps prestigious)
- **PAGE STAMPS** (big, prestigious, the "passport pages"): **countries · cities ·
  airports** (boarding-pass style w/ 3-letter code) **· national icons** (Empire
  State, Christ the Redeemer…) **· natural wonders** (Grand Canyon, Niagara…).
- **Light "visited" marks** (small, sub-entries — NOT full page stamps):
  individual attractions you visit. They enrich a city's page without inflating
  the passport. A city with 6 visited attractions shows one city page-stamp + 6
  small marks, not 7 equal stamps.

### 3. Earning: **three paths to a stamp; two of them earn the ✓**
A stamp always records the visit; the **✓ Verified** badge is the trust signal.
| Path | How | Result |
|---|---|---|
| **GPS-verified** | App open within ~100–200 m of an owned place during the trip (foreground only) | Stamp **+ ✓ Verified** (auto, strongest) |
| **Photo-proof** | Upload *your own* photo of the landmark, then set/confirm the visit **date** | Stamp **+ ✓ Verified** — **this is how you backfill past trips** |
| **Self-declared** | Tap "📍 I was here", no photo/GPS | Stamp, **no ✓** (lighter, honest) |

**Why photo-proof matters most:** people travelled long before they had the app,
and often didn't have it open on-site. Letting them upload a real photo + set the
real date turns the passport into their **whole life of travel**, not just trips
taken after install. The photo does double duty: it's the **memory** AND the
**proof**.

> Honest note: a photo isn't hard proof (someone *could* upload another's shot).
> We accept this because (a) the passport is the user's own private keepsake — the
> incentive to fake your own memories is ~zero, and (b) the ✓ here means "I proved
> it with my photo," a softer, clearly-personal claim vs the auto GPS ✓. Both show
> a ✓; wording can distinguish subtly ("Verified" vs "Verified · photo") if we want.

---

## Anti-dilution rules (hold this line)
- **Travel/exploration ONLY.** No stamps for restaurants, food photos, or app
  actions (using the ATM finder, saving a place). Those get a **separate,
  lightweight "foodie contributor" nod** — never a passport stamp. Diluting the
  passport with "uploaded a food pic" kills the meaning.
- **Home-city onboarding stamp is page ONE, not an achievement** (see below).

---

## The memory layer (the heart)
- Each stamp holds **2–4 of the user's own photos** (add/remove anytime).
- Thumbnails sit under the stamp; tap → enlarges with the stamp in a corner +
  caption **"I was here! {City}, {Region}, {Country} · {Date}"**.
- **Photos persist forever — never auto-erased** (durable on Cloudflare R2,
  zero-egress; thumbnails in feed, full-res on tap). This is a private **visual
  travel journal** = the emotional retention core. The user can always
  remove/export their own; "don't erase" = the app never silently deletes.
- **Strip EXIF/GPS on upload** (privacy).

---

## The collection (secondary, quiet)
- **A filling map** — city-level pins only (never exact address; no home-doxxing).
- **Quiet stats**: countries · cities · airports · icons · natural wonders.
- **Milestones** (gentle, celebratory): 1st country, a new continent, 10th city,
  your airport-code set. Never a scold for gaps.
- **Shareable "My Passport" card** (opt-in): Spotify-Wrapped-style branded image
  (map + stats + wordmark) → native share sheet → viral growth. City-level pins
  only.

---

## Onboarding = page one (fix the "member since" cosmetic)
- Reframe onboarding as **"make your passport"**: display name + home city → issue
  the passport, stamp **page one** = your home city.
- Honest copy: *"Your first page — where your story starts. Every place you go
  adds a stamp."* NOT "member since {date}" (that reads like a loyalty card).
- The home stamp is clearly your **origin**, visually distinct from earned travel
  stamps — it is not an achievement, it's the cover page.
- This is also the lever to **cut the 14-step onboarding form** (people are eager
  to start collecting, not fill a form). Infer currency/language/units from
  device; defer trip prefs.

---

## Honest constraints (don't lose)
1. **Auto-stamps = FOREGROUND GPS only** (fire when app opened somewhere new). No
   background/always-on location (battery + privacy + App-Store minefield).
2. **Share card = city-level pins, sharing opt-in** (no exact-spot doxxing).
3. **Photos persist, but account deletion** still lets the user remove/export
   their own; anonymize any public-facing derivatives.
4. **Strip EXIF/GPS** from every uploaded photo.
5. Public **guestbook** (a later phase that the verified-visit gates) triggers
   Apple 1.2 (report/flag/block/act-fast) + anonymize-on-delete — out of scope for
   the passport core but the `visits` table is the shared foundation.

---

## Data model (build-ready)
Supabase (Postgres); images on R2.

```
stamps
  id            uuid pk
  user_id       uuid
  kind          text   -- country | city | airport | icon | wonder | attraction
  tier          text   -- 'page' (country/city/airport/icon/wonder) | 'mark' (attraction)
  entity_type   text   -- place | city | country | airport
  entity_id     text   -- owned place id / IATA code / city slug / ISO-2
  name          text
  city          text
  region        text
  country       text   -- ISO-2
  lat           double precision   -- nullable for country/airport
  lng           double precision
  visited_on    date   -- the REAL date (editable; set by user for photo-proof/self)
  verified      text   -- gps | photo | self
  trip_id       uuid   -- nullable (grouping)
  tagged_by     uuid   -- nullable (buddy-tag, future)
  created_at    timestamptz default now()

stamp_photos           -- 2–4 per stamp; the memory + (for verified='photo') the proof
  id          uuid pk
  stamp_id    uuid fk
  user_id     uuid
  r2_key      text
  caption     text
  created_at  timestamptz default now()
```
- Uniqueness: one **page** stamp per (user, kind, entity_id); attraction **marks**
  can repeat across trips (or dedupe per user+place — TBD, low stakes).
- The same `stamps` row (kind≠attraction, verified in gps|photo) later gates the
  guestbook ("only travelers who've been here can sign").

---

## Phasing
- **P1 — The meaningful core (build first):**
  "📍 I was here" on place cards → a stamp (GPS ✓ when near) → **Passport view**
  (page stamps + quiet map + stats) → **photos on a stamp** (R2, permanent) +
  **photo-proof flow** (upload → set date → ✓) → onboarding page-one reframe.
- **P2 — Share card** (Spotify-Wrapped style, opt-in).
- **P3 — Guestbook** (verified-visit gated) + 1.2 safety tooling.
- **P4 — Buddy tagging / group stamps** (consent-gated social graph).
