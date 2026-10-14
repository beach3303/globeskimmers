# The new look: build status

Branch `new-look` (worktree `gs-new-look`). Updated 2026-10-14. **Nothing on this branch is pushed;
`main` and the live app are untouched.** The spec is the README beside this file.

## What is built

| Slice | What | Commits |
|---|---|---|
| F0–F8 | Foundation: tokens, the nav, zone folders and ornaments, the finder kit, the cloth, circle data, deep links | everything before `431a118` |
| S1–S2 | Home: option B folders (A as an admin-only preview), Your circle, Stamps near you, the shelf | `431a118`…`acd5e69` |
| S19 | The location chooser, B "Kraft Folder" | `64a1681` |
| S7–S17 | All eleven finder worlds: Eat, Coffee, Things to Do, Restrooms, ATMs, Money, Weather, Phrases, Culture, Convenience, Shopping | `062067d`…`d178a2b` |
| S3 | Profile: your world bound in your cloth; luggage card, MY KIT, circle and map folders, privacy card | `70d0d7b`…`87a62ca` |
| S4 | Traveler (visiting someone's world) and the Circle screen | `9ba522a`…`57bd89a` |
| S5 | Mailbox in airmail stock; postcards drawn like postcards | `32812d3`…`3e88bc7` |
| S6 | "Your circle" wording across Passport, Settings and stamps; trunk on your own passport only | `18a0ff3`…`b608e75` |
| S18 | Integration: `stamping-v2` merged in, checked, fixed | `d642f95`, `e8dc0b4`, `1199f05` |
| Box | The postcard box: every postcard sent to you, kept (founder, 2026-10-14) | `53d4d5f`, `7650530`, `e747556` |
| Keep | Keep a card sent to everyone in the box (founder, 2026-10-14) | `18ee82b` migration, `aa8cb97`, `019c361` |
| Shelf | Home's circle shelf: a stamp on a cream plate (founder picked B, 2026-10-14) | `cca31d5` |

## S18: what the merge brought, and what changed after it

`d642f95` merges `stamping-v2` (the go-live safety rounds, 2026-10-13): Block everywhere through
production's `TravelerSheet`, the confirm-birthday tier, Blocked travelers in Settings, dish-photo
reports, Block beside Report in place guestbooks. Conflicts resolved in `AuthContext.jsx`,
`Settings.jsx`, `Guestbook.jsx`, `TravelerDishes.jsx`, `FriendsTravels.jsx` and `Mailbox.jsx`.
Every person in Mailbox and Home now has a ••• to that sheet (go-live decision 6).

- `e8dc0b4`: a follow request's ••• had pushed Allow / Not now onto a second line; one line again
  from 375px up (320 wraps by design). Circle's requests get the same •••. The card door reads
  "Options for Theo", as production's does.
- `1199f05`: until the worker has `social/world` (B3), a visit by slug can't name the account, so
  the Traveler ••• offered Report only. It now offers Block by the share link, through the same
  sheet, as production's friend view does.

## Gates at `1199f05`

- `node --check cloudflare-worker-v7.12.js`: OK
- `npm run lint`: clean. `no-undef` over `src/pages`, `src/components`, `src/lib`, `Layout.jsx`, `App.jsx`: clean
- `npm run build`: OK. `npm run boot-check`: PASS
- `npm run typecheck`: 590 errors (`stamping-v2` has 652; it was never a clean gate)
- `scripts/ios-launch-check.sh` on the iOS 27.0 runtime: running on iPad Air 11-inch (M4) and iPhone 18 Pro
- Android: not run on this branch (the emulator image needs Google's licence, the founder's call)

Screens checked after the merge: phone 402×874 @3x, iPad 1032×1376 @2x, the largest text size,
375 and 320 wide; Home, Mailbox, Circle, Traveler (full world and today's slug fallback), Profile,
Settings, own Passport, Eat, Coffee, Things to Do and its place sheet, Convenience; the teen hold
(Mailbox, Circle, Profile, Traveler) and the confirm-birthday tier (Home, Mailbox).

## Decided since S18 (2026-10-14)

- Home's circle shelf: **B**, the stamp on a cream plate where a postcard has its photo (`cca31d5`).
- The postcard box keeps every card sent to you, and **Keep** saves a card sent to everyone into it.

## How it reaches phones, in order

1. Not while a store build is in review: iOS 1.0.4, and Play 1.0.8 if it has been submitted.
2. On the founder's go, merge `new-look` into `stamping-v2`, then `main`. The push deploys the
   worker, which carries this branch's worker commits: three for B10, finder honesty fields
   (`244ebee` money rows, `a77322a` weather fetch time and dates, `5cf7d8d` convenience 24 h),
   then `53d4d5f` and `aa8cb97`, the postcard box and Keep. Probe the worker, including
   `/postcards/box` and `/postcards/keep`.
3. The same push carries `supabase/migrations/20261014160000_postcard_keeps.sql`, which
   `deploy-migrations.yml` applies after the founder approves the `production` environment run.
   Until it runs, the worker hides Keep and the box shows the cards addressed to you; nothing breaks.
4. Then the OTA (`npm run ota`, run by the founder). Never before the worker deploy and probe.

Backend items, each on the founder's go. The new look already works without them, with honest
fallbacks:

| Item | What | State |
|---|---|---|
| B1 | Cloth column on the owner's prefs row (Supabase migration) | Not written. The cloth picker stays hidden until it ships |
| B2 | Faces carry cloth and avatar | Not built |
| B3 | `POST /social/world` for visits, and the `world` flag (with B4, B5) | Not built. Visits work by slug through `/passport/public` |
| B4 | Blotter read gate mirrors the write gate | Not built (ships with B3) |
| B5 | Moderate profile text before visitors see it | Not built (before or with B3) |
| B6 | Feed fields for envelope art and verification method | Not built. Envelopes print "Verified" alone |
| B7 | Latest stamp per person in the follow list | Waits on the founder's privacy decision |
| B8 | Blocking ends follows, filters feeds, advertises `block_v2` | **Live** since the go-live, 2026-10-13 |
| B9 | Follow back by user_id | Not built |
| B10 | Finder honesty fields | Three commits on this branch (above); the rest optional |
| B11 | Teen postcard errors in circle wording | Not built |

The Android 1.0.8 fixes (status bar through Capacitor's SystemBars, code shrinking) are on branch
`android-1.0.8` (`6fb7fef`), not here; they reach this branch through `stamping-v2`.
