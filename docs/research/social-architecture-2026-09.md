# Passport Social Layer — Architecture (2026-09-29)

Design for build-queue item 1 of the pivot (docs/PLANS.md): friend tagging → stamp
offers, per-destination albums, public/private passports + following + traveler
profiles, with the founder's explicit requirement that children and teens are
shielded. Grounded in the code and schema as of commit 7597358. **No code changed
by this document.**

---

## 0. Ground truth — what exists today (read from the code, not the docs)

**Schema** (`scripts/passport/01_schema.sql`, applied by hand; grants in
`supabase/migrations/20260831155723_passport_table_grants.sql`; columns added by
`20260927200000_passport_stamp_layout.sql` and `20260928160000_passport_stamp_meta.sql`).
All four tables live in the `api` schema, RLS enabled, **zero client policies** —
every read/write goes through the Worker with the service key, scoped to the
user_id it resolves from the caller's Supabase JWT (`gbUser`). This is the house
pattern and everything below keeps it.

- `api.passport_stamps` — id, user_id, kind (country|city|airport|icon|wonder|attraction),
  tier (page|mark), entity_type, entity_id, name, city, region, country, lat, lng,
  visited_on, `verified` text, `tagged_by uuid`, `layout` ('auto'|'solo'),
  `meta jsonb` (meta.film, meta.stamp_pos today), created_at, updated_at.
  Unique per (user_id, kind, entity_id) where entity_id not null.
- `api.passport_stamp_photos` — id, stamp_id (fk cascade), user_id,
  photo_key (`pp/<user>/<stamp>/<uuid>.jpg` on R2), photo_url (`/pp-photo/<key>`),
  caption, created_at. Client caps at 4 per stamp; the worker does not.
- `api.passport_tags` — from_user_id, from_name (snapshot), to_user_id (nullable),
  to_email (nullable), `token` (unique, 32-hex), a full snapshot of the stamp's
  fields, status ('pending'|'accepted'|'declined'), created_at, responded_at.
- `api.passport_shares` — user_id pk, slug (12-hex, unguessable), is_public
  boolean default false. One row per user, get-or-create in `handlePassportShare`.
- `public.profiles` (supabase/crm-schema.sql) — client-writable own row (RLS
  select/insert/update own): first_name, home_country, traveler_type[],
  travel_purpose[], next_destination, etc. **No handle, no avatar, no birth date.**

**Verification ranks** (worker `PP_VERIFY_RANK`, ~line 13008):
`{ self:0, photo:1, photo_ai:2, photo_loc:3, gps:4 }`; the ✓ set is
`{gps, photo_loc, photo_ai}`. Rule enforced in `ppUpsertStamp` and the photo
handler: **a re-stamp or new photo never lowers a stamp's rank.**

**The buddy-tag claim flow today** (worker ~13565–13740, `src/lib/passport.js`,
`src/pages/Passport.jsx`):
1. `POST /passport/tag` — owner of a stamp mints a pending `passport_tags` row
   with an unguessable token. Rate limit 30 tags/user/day. Optional email is
   resolved to a user id via the service-role-only RPC `api.user_id_by_email`
   (clients can never enumerate users).
2. The app shares `https://<worker>/t/<token>` through the native share sheet.
   The landing page deep-links `globeskimmers://passport/claim?token=…`;
   `AuthContext.jsx` stashes the token in sessionStorage and routes to /Passport,
   which shows the claim card.
3. `POST /passport/tag/claim` (signed in; can't claim your own) — **accept mints
   a stamp with `verified:'self'` + `tagged_by`**, decline just closes the tag.
   A parallel passive path exists: `/passport/tags` inbox + `/passport/tag/respond`
   for tags addressed by email to an existing user.
4. One consent today, not two: "Allow ✓" both confirms the tag and takes the stamp.

**Public passport today**: binary. `passport_shares.is_public` → `/passport/public`
returns holder first name + **the full stamp rows (`select=*`: exact lat/lng,
visited_on, layout, meta) + all photos**. The web landing `/p/<slug>` shows a
teaser. Finding: this is all-or-nothing and leaks full-precision coordinates and
every photo, which the meaning model (docs/PASSPORT_MEANING_MODEL.md, "city-level
pins only; no home-doxxing") never intended for a public surface. §3 fixes it.

**Moderation infrastructure already wired** (worker ~12838–12885):
- `gbModerate(text)` — slur regex + Claude Haiku, all languages, fails **open**.
- `gbModeratePhoto(image)` — Claude Haiku vision, fails **closed** (used for
  guestbook photos, which are public). ~0.2¢/photo (the repo's own cost note).
- Passport memory photos are deliberately **not** moderated today — they're a
  private journal. That assumption breaks the moment a photo is visible to
  anyone but its owner (§4).
- `handleGuestbookReport` + an Admin Portal queue already exist — the report
  pattern to copy.

**Photo privacy pipeline**: the client resizes to ~1280px JPEG (strips EXIF)
and reads `{lat,lng,taken_at}` from the original separately for the photo_loc
proof — sent transiently, never stored. R2 keys are unguessable; `/pp-photo/<key>`
serves with no auth (private-by-obscurity, same as the guestbook).

**Account deletion** (worker ~932–954) already purges photos (R2 + rows), stamps,
tags in both directions, and the share row. Every new table below must join that
purge list.

**No push notifications** — `@capacitor/push-notifications` is not in
package.json. Everything notification-shaped in v1 is in-app inbox + poll on
foreground.

**Store posture** (docs/STORE_LISTING_COPY.md, "Age rating"): the questionnaire
was answered **UGC: None ("no chat, no posts, no comments yet")** → 4+/Everyone.
The social layer flips that answer. §4 covers the consequences.

---

## 1. Friend tagging → stamp offers

### The founder's flow, mapped to what exists

> I tag a friend on my stamp → my friend gets "you were tagged — want this stamp
> from Sep 26?" → they consent to the tag AND separately accept/decline the stamp.

Today's flow is 90% of this; the gaps are (a) one consent instead of two,
(b) `verified:'self'` instead of a tag-specific rank, (c) tags are addressed by
link or email only — no in-app identity, (d) no revoke, no permissions, no blocks.

### 1a. Two consents, one card

Split the claim card into two questions, answered in sequence:

1. **"Were you at {name} with {from_name}?"** — Yes / No.
   - Yes → `presence = 'confirmed'`. This is the co-presence edge: the tagger's
     stamp may now show "with {your display name}", and it is the raw material
     for combined albums (§2).
   - No → `presence = 'denied'`, tag closed, nothing else asked. The tagger sees
     nothing beyond "not accepted" (don't advertise a denial).
2. Only after Yes: **"Add this stamp to your passport?"** — Add / Not now.
   - Add → mint the stamp (see 1b). "Not now" leaves presence confirmed with no
     stamp; the tag stays claimable from the inbox for 30 days.

Schema (one migration, additive — the deploy-migrations workflow refuses drops
anyway):

```sql
alter table api.passport_tags
  add column if not exists presence text not null default 'pending'
    check (presence in ('pending','confirmed','denied')),
  add column if not exists to_handle text,          -- handle-addressed tags (1c)
  add column if not exists revoked_at timestamptz;  -- 1d
-- status keeps today's meaning: the STAMP decision (pending|accepted|declined).
```

Backward compatible: existing rows read `presence='pending'`; the old one-tap
"Allow" path maps to presence='confirmed' + status='accepted' in one call, so the
worker change is an extension of `handlePassportTagClaim` / `handlePassportTagRespond`
bodies (`{ presence: 'yes'|'no', stamp: 'accept'|'decline'|'later' }`), not a new
endpoint.

### 1b. `verified:'tagged'`

A tag-derived stamp is a friend's vouch — stronger than pure self-declaration,
weaker than any photo. Insert it into the rank map; the ✓ set is unchanged
(tagged never shows the green ✓):

```js
const PP_VERIFY_RANK = { self:0, tagged:1, photo:2, photo_ai:3, photo_loc:4, gps:5 };
// PP_VERIFIED stays {gps, photo_loc, photo_ai}
```

`verified` is free text in Postgres (no check constraint), so this is worker +
client only — no migration. The claim mints
`verified:'tagged'`, keeps `tagged_by` (already written today), and adds
provenance to meta so the booklet can render it without a join:

```js
meta.tag = { tag_id, from_user_id, from_name }   // written at claim time
```

Booklet copy: a small "with {from_name}" chip on the stamp instead of the ✓.
The never-lower rule already in `ppUpsertStamp` means a tagged stamp upgrades
normally when the recipient later adds a photo or re-stamps on site with GPS.
The ~handful of historical claimed stamps (`verified='self'` with `tagged_by`
set) can be backfilled with one UPDATE or simply left — cosmetic either way.

### 1c. Usernames / handles

Needed the moment tagging is in-app ("tag @maiza") rather than link-out. Rules:

- `^[a-z0-9_]{3,20}$`, stored lowercase, unique, plus a reserved list
  (admin, globeskimmers, support, help, official, moderator, …).
- **Where**: on `api.passport_shares` — NOT on `public.profiles`. profiles is
  client-writable under its own RLS, so a handle there could skip server-side
  uniqueness/reservation/moderation. passport_shares is already the
  one-row-per-user, worker-only "public identity" row (it owns the slug); it
  becomes the social profile row (§3). Handle set/changed only via the worker.
- **Changes**: allowed, max 2 per 30 days (`handle_changed_at`); the old handle
  is released immediately (network is small; don't build a redirect table —
  `from_name`/`meta.tag.from_name` are snapshots, so old references don't break).
- Display name and handle both pass `gbModerate` before save.
- Tag-by-handle: `POST /passport/tag` gains optional `handle`; the worker
  resolves it to a user id server-side (mirror of the email path — the resolved
  id is never returned to the caller, so no enumeration; a tag to a nonexistent
  handle returns the same "invite created" shape with an inbox no-op, or a plain
  validation error — pick the validation error: handles are public identifiers,
  unlike emails, so confirming existence is fine and better UX).

### 1d. Tag permissions, revoking, blocking

- **Who may tag me** (`passport_shares.tag_policy`): `everyone | friends | none`.
  Default **everyone** for adults — a tag is only an offer behind a consent card,
  already rate-limited (30/day global; add max 3 pending per recipient-pair).
  Forced **friends** (mutuals, §3) for minors. Policy applies to handle/email
  addressed tags; the share-link path is unchanged (a link sent over WhatsApp is
  out-of-band by design — the claim card is the consent, and the recipient's
  block list still applies at claim time).
- **Revoking**: the tagger can revoke a pending tag (sets `revoked_at`; the
  token dies — landing shows "already handled"). The recipient can later revoke
  a confirmed presence (Settings → "Tags about me"): the co-presence edge is
  removed, the tagger's "with {name}" display disappears, and any combined album
  pairing dissolves. The recipient's own stamp is theirs — revoke never deletes
  it (they can delete the stamp themselves; existing `/passport/stamp/delete`).
- **Blocking** — new table, the enforcement point for everything social:

```sql
create table api.user_blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table api.user_blocks enable row level security;  -- worker-only, as always
grant all privileges on api.user_blocks to service_role;
```

  Enforced in the worker at: tag create (addressed), tag claim (a token from a
  blocked user → generic "invite expired", never "you are blocked"), follow
  create, feed assembly, profile/passport view of friends-tier content, and
  combined albums. Blocks are silent and bidirectional in effect.

---

## 2. Per-destination albums

### v1 (owner + friend view): derived, zero new tables

An album is "all my photos at one destination". The data already supports it:
photos hang off stamps, stamps carry (kind, entity_id, name, city, country).
Group client-side over the existing `ppLoad` payload:

- **Album key**: `(country, city)` for the city album; a single attraction's
  photos are already "the stamp's photos" in the lightbox. The album page is a
  grid of that city's photos, captioned by stamp name + visited_on, opening in
  the existing `PhotoLightbox`.
- **Friend view** rides passport visibility (§3): a friends/public passport's
  non-owner serializer includes photos, so the same grouping renders for a
  viewer. Two per-item controls make this safe:

```sql
alter table api.passport_stamps       add column if not exists hidden  boolean not null default false;
alter table api.passport_stamp_photos add column if not exists is_private boolean not null default false;
alter table api.passport_stamp_photos add column if not exists mod_status text; -- null|'ok'|'blocked' (§4)
```

  Hidden stamps and private photos never leave the owner's own view.
- **Serving**: photo URLs are already unguessable R2 keys behind `/pp-photo/` —
  no new serving infra. Accept that anyone holding a URL can fetch the bytes
  (same trade the guestbook makes); the visibility gate is on the listing, and
  photo deletion removes the R2 object (already does).

No album table until users ask for custom albums. A `passport_albums` table
(cover photo, custom title, per-album visibility override) is a later nicety,
not architecture.

### v2 (P4): combined albums — "Together at the Georgia Aquarium"

The co-presence edge from §1a is the join key. When
`passport_tags.presence='confirmed'` and not revoked, the pair
(from_user_id, to_user_id, kind, entity_id) is a "we were there together" fact.
Combined album = both users' photos on their own stamps of that entity, merged,
newest first, labeled by who shot what.

Consent model: it only renders when **each** viewer is allowed each side —
i.e. both passports are ≥ friends for the other, neither photo is private,
neither user blocks the other, and the presence edge stands. Revoke (§1d)
dissolves it. Worker endpoint `POST /passport/album/combined
{ with_user, entity_id }` assembles it; no new table — the tags table IS the
edge store (add index `(from_user_id, to_user_id, presence)`).

---

## 3. Public/private passports, following, profiles

### Visibility: three states, and fix the current over-share

`passport_shares` grows into the social profile row:

```sql
alter table api.passport_shares
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private','friends','public')),
  add column if not exists handle text unique,
  add column if not exists display_name text,
  add column if not exists avatar_key text,
  add column if not exists bio text,
  add column if not exists tag_policy text not null default 'everyone'
    check (tag_policy in ('everyone','friends','none')),
  add column if not exists birth_year int,           -- neutral age gate, §4
  add column if not exists handle_changed_at timestamptz;
-- transition: keep is_public in sync (is_public := visibility = 'public')
-- until the old clients are OTA'd, then stop writing it.
create unique index if not exists passport_shares_handle_idx
  on api.passport_shares (lower(handle)) where handle is not null;
```

- **private** — today's default; owner only. Unchanged.
- **friends** — mutual follows (below) can open the booklet.
- **public** — anyone with the slug/handle; listed on the profile.

**Non-owner serializer** (the important fix): `/passport/public` and every new
viewer endpoint must stop returning `select=*`. For any viewer ≠ owner:
- exact `lat/lng` dropped (the meaning model's "city-level pins only" rule —
  today's endpoint leaks full precision);
- `hidden` stamps and `is_private`/`mod_status='blocked'` photos excluded;
- `meta` reduced to the display bits (film, tag from_name);
- **delayed visibility**: a stamp created < 24h ago is excluded unless the owner
  tapped "Share now" (`meta.share_now=true`). Default ON for everyone — a stamp
  is inherently location+time, and "I am at X right now" broadcast to followers
  is the one genuinely dangerous primitive in this product. For minors it is
  forced on (no Share-now button). 24h is enough to have left the place.

### Follow model: asymmetric follow, mutuals = friends

Recommendation: **asymmetric follow** (Instagram model), with approval required
when the target's visibility is friends-tier or the target is a minor.

Why asymmetric for a travel brag network:
- The content is broadcast-shaped. The share loop that already exists — booklet
  image → Instagram story → `/p/<slug>` landing — ends with a stranger, a cousin,
  or a non-traveling parent who wants to *watch*, not to be mutually befriended.
  "Follow" converts that click; "send a friend request" kills it.
- Mutual-only caps everyone's audience at people who reciprocate, which is
  exactly wrong for bragging, and wrong for the future attraction-partnership
  lane (an aquarium's account wants followers, not 40,000 friends).
- Friends-tier trust still exists without a second system: **friends = mutual
  follows**. Tags default, combined albums, and friends-visibility all key off
  mutuals. One table, both semantics.

```sql
create table api.follows (
  follower_id uuid not null,
  followee_id uuid not null,
  state text not null default 'accepted' check (state in ('pending','accepted')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  primary key (follower_id, followee_id)
);
create index follows_followee_idx on api.follows (followee_id, state);
alter table api.follows enable row level security;
grant all privileges on api.follows to service_role;
```

State rules in the worker: target public → `accepted` immediately; target
friends/private or minor → `pending` until approved; blocks forbid the row both
ways; unfollow = delete. Follower/following counts are two cheap PostgREST
count queries, cached in KV for the profile card.

### Traveler profile — minimal lovable v1

One screen, everything either already collected or picked from structured data
(no free-text essay fields — they're the moderation tarpit):

| Element | Source | Moderation |
|---|---|---|
| Handle + display name | new, §1c | gbModerate + reserved list |
| Avatar | new upload → R2 `av/<user>/<uuid>.jpg` | gbModeratePhoto, fails closed |
| Home country flag | `profiles.home_country` (exists) | — |
| One-line bio (≤140) | new | gbModerate |
| Traveler-type chips | `profiles.traveler_type[]` (exists, from onboarding) | fixed vocabulary |
| Stats row | `ppLoad` stats (countries / stamps / ✓ verified) | — |
| Favorite places (≤3) | **picked from the user's own stamps** | inherently grounded |
| Dream destinations (≤3) | picked from the owned attractions search | fixed vocabulary |

Favorites/dreams as stamp/attraction references (store as
`jsonb [{entity_id, name, country}]` on passport_shares) — not free text — keeps
them renderable as mini-stamps and un-abusable. Explicitly **not** in v1: links
(URL spam), age/birthday display, gender, follower leaderboards, long bios.

Profile endpoints: `POST /profile/get` (by handle or slug, visibility-aware),
`POST /profile/set` (owner, moderated), `POST /profile/handle-check`. Web landing
`/u/<handle>` mirroring the `/p/<slug>` pattern (same HTML style, deep link
`globeskimmers://passport/view?u=<slug>` already exists and is reused).

---

## 4. Safety — and minors especially

### Age gate

Today there is no age question anywhere (profiles has no birth field; the ToS
floor is unstated). Plan:

- **Neutral gate at social opt-in**, not at app signup: the journal (private
  passport) stays exactly as it is for everyone; the first social act (set a
  handle, change visibility, follow someone, tag by handle) asks birth year
  once, neutrally (a year picker defaulting to no year, no "you must be 13"
  pre-warning, no retry-until-you-pass — the standard COPPA-defensible gate).
  Stored as `passport_shares.birth_year`.
- **< 13**: social features unavailable, full stop. The passport remains the
  private journal (which is the product's core anyway) with link-tag claiming
  intact — that's a consent card, not a social surface. This avoids COPPA's
  verifiable-parental-consent machinery entirely for v1: we do not knowingly
  offer the social layer to under-13s, and the ToS should state 13+ for social
  features. (COPPA turns on *actual knowledge* — once the gate says 2015, we
  have it, so the gate must actually gate.)
- **13–17 (minors)**: social available with hard defaults — see below.
- **GDPR-K**: the age of digital consent is 13–16 depending on member state
  (16 in Germany/Netherlands/Hungary, 13 in the UK, etc.). For consent-based
  processing of a 14-year-old German user we technically need parental consent.
  Practical v1 posture: apply the **minor defaults to all under-16 in the EU**
  (they're protective enough that the processing story is legitimate-interest
  shaped, not consent shaped), and flag this for real counsel before any EU
  marketing push. Do not fake certainty here.

### Minor defaults (13–17), all enforced server-side off `birth_year`

- Passport visibility: **private or friends only — the public option is absent**
  from the UI and rejected by the worker.
- Follow: every incoming follow is `pending` (approval required); minors do not
  appear in any future search/discovery surface.
- Tags: `tag_policy` forced to `friends`; link-tags still claimable (consent
  card) but the claim card never shows the minor's identity back to the tagger
  beyond the accept/decline outcome.
- **Delayed visibility forced on** (no "Share now"): a minor's stamp is never
  visible to anyone, including friends, until 24h after creation. Stamps are
  inherently location+time; this is the line that makes "friends can see my
  passport" safe — it is always *where I was*, never *where I am*. Real-time
  location is never on any social surface for anyone, minor or not (the app's
  LocationContext never leaves the device except inside finder queries — keep
  it that way).
- No DMs — see below (true for everyone in v1).

### No DMs in v1 — recommendation: yes, emphatically

Recommended and cheap: the product doesn't need them. Every interaction in this
design is either an offer with a consent card (tags) or passive viewing
(follow/albums). DMs would: (a) create the one surface where grooming happens,
(b) drag in real-time abuse moderation obligations, (c) likely push the age
rating and Play's "users can interact" answers into stricter territory, and
(d) require notification infra we don't have (no push plugin). If "message your
travel buddy" ever matters, it's a P5+ decision with its own safety review.
Reactions/comments on stamps are also out of v1 — the guestbook already covers
public notes on *places*, with moderation; comments on *people's stamps* are the
next biggest moderation surface after DMs. A single fixed "🛂" reaction is the
most that should be considered for P2, and even that can wait.

### Photo moderation pipeline

The boundary rule: **a photo is moderated when it can be seen by anyone but its
owner.** The private journal stays unmoderated (frictionless, and the meaning
model's promise), which is exactly today's split (guestbook moderated, passport
not).

Options, honestly costed at our scale (thousands of photos/month, not millions):

| Option | Cost | Verdict |
|---|---|---|
| **Claude Haiku vision — `gbModeratePhoto`, already wired** | ~0.2¢/photo (repo's own note); 10k shared photos/mo ≈ $20 | **Use this.** Fails closed, multilingual/context-aware, zero new vendors or secrets, one prompt tweak (travel-photo allowlist already written) |
| NSFWJS client-side | free, on-device (~4MB TF.js) | Not a control — it ships in client code, so it's bypassable by definition, and it only sees porn, not gore/hate/doxx. Acceptable as a pre-upload courtesy check ("this photo may not be shareable") to save a round trip; never the gate |
| OpenAI omni-moderation | free tier | A second AI vendor + secret + new failure mode to save ~$20/mo. No |
| AWS Rekognition | $1/1k images | New vendor + IAM for the same money as Haiku. No |

Mechanics:
- **Upload-time**: if the uploader's passport visibility is friends/public, run
  `gbModeratePhoto` inline (it already fails closed) and set
  `passport_stamp_photos.mod_status`. Private-passport uploads skip it
  (mod_status null).
- **Flip-time**: switching visibility private → friends/public triggers a
  backlog sweep of the user's null-mod_status photos in `ctx.waitUntil` batches
  (no cron exists in this worker; flip-time + a lazy check on first non-owner
  serve covers the gap). Blocked photos stay visible to the owner with a
  "not shareable" badge, are excluded from every non-owner view, and are
  reportable/appealable via the contact form.
- Avatars: always moderated (they're public by nature).
- Text (bio, display name, handle, captions when shared): `gbModerate` — note it
  fails **open** by design; the report queue is the backstop, same trade the
  guestbook already made.

### Reporting and blocking — launch requirements, not phase-2 polish

Apple guideline 1.2 makes four things mandatory for any app with UGC, at review
time, not eventually: (1) a method for **filtering** objectionable material
(the moderation pipeline above), (2) a mechanism to **report** offensive content
with timely responses, (3) the ability to **block** abusive users, (4) published
**contact information**. (4) exists (contact form → Admin Portal, support page).
(1) is above. (2) and (3):

```sql
create table api.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  subject_type text not null check (subject_type in ('profile','photo','stamp','passport')),
  subject_user_id uuid not null,     -- whose content
  subject_id text,                   -- photo id / stamp id / null for profile
  reason text not null,              -- fixed vocabulary: nudity|harassment|impersonation|minor_safety|other
  note text,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);
```

Worker `POST /social/report`; Admin Portal gets a "Passport reports" queue
cloned from the guestbook one (`handleGuestbookReport` is the pattern). A
report button sits on every non-owner surface: profile, public booklet, album
photo lightbox. `minor_safety` reports sort to the top. Blocking is §1d's
`user_blocks`, surfaced next to Report everywhere Report appears.

### Store ratings and questionnaires — what actually changes

Current answers (docs/STORE_LISTING_COPY.md): UGC **None** → 4+/Everyone. Note
Apple **retired 12+/17+ in 2025**; the tiers are now 4+/9+/13+/16+/18+, with new
required questions covering UGC, user communication, and in-app controls — so
the founder's "4+ vs 12+ vs 17+" framing maps to "4+ vs 13+" in practice.

- The moment public profiles/passports ship (P1), the honest questionnaire
  answers become: UGC **Yes** (with moderation, reporting, blocking declared);
  at P2 (follow/feed), "users can interact" **Yes**.
- Realistic outcome: **Apple 13+, Google Play Teen** (Play's UGC policy also
  independently requires in-app report + block + moderation — same checklist as
  Apple 1.2). Declaring the controls can keep ratings lower, but plan for 13+
  and be pleasantly surprised, not the reverse.
- Implication accepted knowingly: 13+ costs a little family-market
  discoverability and is the honest rating for a social travel app. The
  alternative — keeping 4+ by never shipping public UGC — contradicts the pivot.
  Do **not** try to keep "Everyone incl. children" as the Play target audience:
  that pulls the app into Play's Families policy (ad restrictions on the AdMob
  banner, teacher-approval review) for no benefit.
- Questionnaire edits happen in the store consoles and take effect with the
  **next native submission** — they are not OTA. Time P1's store build to carry
  them (see §5's OTA vs store-review column).
- Privacy policy (Notion page, editable in place per STORE_LISTING_COPY.md) and
  docs/PRIVACY_POLICY_DRAFT.md need a UGC + social section the same day P1
  ships: what's visible to whom, moderation, reports, the 13+ social floor,
  data deleted on account deletion (already true in code).

---

## 5. Build plan

House rules baked in: every new table follows the worker-only pattern (api
schema, RLS on, no client policies, service_role grants, migration via
`npm run db:new` → auto-applied by deploy-migrations.yml); worker changes deploy
on push (nothing gates — never push mid-phase); client changes ship by founder-run
`npm run ota` to both platforms; new tables join the account-deletion purge and
`gbLogEvent` gets an event per new social action (tag_presence, follow,
report, visibility_change) so Admin Analytics keeps seeing the product.

| Phase | Scope | Schema | Worker endpoints (new/changed) | Days | Ship path |
|---|---|---|---|---|---|
| **P0 — tag + claim polish** | Two-consent claim card; `verified:'tagged'` + `meta.tag`; revoke pending invite; "Tags about me" list + presence revoke; `user_blocks` + enforcement in tag paths; per-pair pending cap | `passport_tags` +presence/+to_handle/+revoked_at; `user_blocks` | changed: `/passport/tag`, `/tag/claim`, `/tag/respond`; new: `/passport/tag/revoke`, `/social/block`, `/social/blocks` | **4** (0.5 SQL, 1.5 worker, 2 client) | OTA + worker push. No store change (tagging already exists, still link/consent-gated) |
| **P1 — identity + visibility** | Handles, display name, avatar, bio, traveler profile card; 3-state visibility; non-owner serializer (coord stripping, hidden stamps, private photos, delayed visibility); per-stamp hide + per-photo private; moderation at upload/flip; age gate + minor defaults; report queue + UI | `passport_shares` +8 cols; `passport_stamps.hidden`; `passport_stamp_photos.is_private/.mod_status`; `content_reports` | new: `/profile/get`, `/profile/set`, `/profile/handle-check`, `/social/report`, `/u/<handle>` landing; changed: `/passport/share`, `/passport/public` (serializer), `/passport/photo` (moderation branch); admin: reports queue | **7** (0.5 SQL, 3 worker, 3 client, 0.5 admin) | OTA-able code — **but ship the native build here anyway**: store questionnaires flip to UGC=Yes and must ride a submission. Privacy policy update same day |
| **P2 — follow + feed** | Follow/unfollow/approve; mutuals = friends powering friends-visibility + tag_policy; follower/following lists + request inbox; reverse-chron feed of followed users' newly *visible* stamps (delayed-visibility respected), keyset-paged; foreground-poll badge (no push infra) | `follows` | new: `/social/follow`, `/social/unfollow`, `/social/follow/respond`, `/social/followers`, `/social/following`, `/social/feed` | **7** (0.25 SQL, 3 worker, 3.75 client) | Store build + review: "users can interact" flips; expect the 13+/Teen rating to land here if it didn't at P1 |
| **P3 — destination albums** | City album view (derived grouping, owner + viewer), album entry points from booklet + profile; flip-time moderation sweep; photo report from lightbox | none (uses P1 columns) | changed: `/passport/public` (photo grouping already in payload); new: `/passport/album` (viewer fetch, visibility-aware); optional `/a/<slug>` web landing | **5** | OTA + worker push only |
| **P4 — combined albums** | Co-presence pairs from confirmed tags; "Together at X" merged view; both-sides consent + block + revoke handling | index on `passport_tags (from_user_id,to_user_id,presence)` | new: `/passport/album/combined` | **4** | OTA + worker push only |

**Total ≈ 27 working days**, each phase independently shippable and each leaving
the app consistent (P0 improves what exists; P1 is the first new surface and
carries the store paperwork; P2 is the network; P3/P4 are the payoff features).

Sequencing notes:
- P0 before anything: it's the founder's named flow, touches no store posture,
  and `user_blocks` + the two-consent tag are prerequisites for every later
  phase.
- The P1 native build is the one hard calendar dependency (App Review latency);
  everything after P1 that is pure worker+JSX can OTA between store builds.
- "Stamps Near You" (build-queue item 1's first bullet) is orthogonal to this
  document — it's discovery over owned attractions, no social schema — and can
  run in parallel with P0/P1.
- Deliberately not in any phase: DMs, comments, likes/leaderboards, discovery
  search of people, custom album tables, push notifications. Each is a separate
  founder decision with its own safety/story cost.
