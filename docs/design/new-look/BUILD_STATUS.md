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
| Cloth | Your cloth saved (B1) and every face carrying its cloth and photo (B2) | `eca1c73` migration, `5ae3dc8` |
| Visits | Someone's whole world on a visit (B3), with B4 and B5 | `c6d3c2a` |
| City Board | Postcards to a city's public board, from travelers who were really there | `a5b2184` migration, `bb22e10`, `8d283f5` |
| Home city | A visit shows the home country; the city only with the owner's switch (founder: A plus a switch) | `63f6860` migration, `76b8c50`, `398fa1a` |

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

1. The founder chose on 2026-10-14 to ship to everyone now, while iOS 1.0.4 is in review
   ("ship to everyone now"). A rejection would hold only that build; the new look reaches
   phones by OTA either way.
2. On the founder's go, merge `new-look` into `stamping-v2`, then `main`. The push deploys the
   worker, which carries this branch's worker commits: three for B10, finder honesty fields
   (`244ebee` money rows, `a77322a` weather fetch time and dates, `5cf7d8d` convenience 24 h),
   then the postcard box and Keep (`53d4d5f`, `aa8cb97`), faces (`5ae3dc8`), visits with B4 and
   B5 (`c6d3c2a`) and City Board (`bb22e10`). Probe the worker, including `/postcards/box`,
   `/postcards/keep`, `/social/world` and `/city/board`.
3. The same push carries four migrations, which `deploy-migrations.yml` applies together about
   20 seconds after the push, with no approval step (GitHub's reviewer gate isn't on this plan;
   an automated check refuses destructive statements instead): `20261014160000_postcard_keeps.sql`,
   `20261014170000_profile_cloth.sql`, `20261014180000_city_board.sql` and
   `20261014190000_profile_show_home_city.sql`. Until they run, nothing breaks: Keep, the cloth
   picker and the home-city switch stay hidden, and boards say they open with the next update. Each was tested on Postgres 17 (PGlite); the worker routes were tested by running
   the worker file against a fake Supabase (visits 21 cases, postcards 17, City Board 14).
4. Then the OTA (`npm run ota`, run by the founder). Never before the worker deploy and probe.

Backend items, each on the founder's go. The new look already works without them, with honest
fallbacks:

| Item | What | State |
|---|---|---|
| B1 | Cloth column on the owner's prefs row (Supabase migration) | **Written** (`eca1c73`); applies with the push. The picker appears then |
| B2 | Faces carry cloth and avatar | **Built** (`5ae3dc8`): only where a name already shows |
| B3 | `POST /social/world` for visits, and the `world` flag (with B4, B5) | **Built** (`c6d3c2a`). Home country always, the city only with the owner's switch (`76b8c50`) |
| B4 | Blotter read gate mirrors the write gate | **Built** (`c6d3c2a`) |
| B5 | Moderate profile text before visitors see it | **Built** (`c6d3c2a`). Older bios, places and coffee orders stay out of visits |
| B6 | Feed fields for envelope art and verification method | Not built. Envelopes print "Verified" alone |
| B7 | Latest stamp per person in the follow list | Waits on the founder's privacy decision |
| B8 | Blocking ends follows, filters feeds, advertises `block_v2` | **Live** since the go-live, 2026-10-13 |
| B9 | Follow back by user_id | Not built |
| B10 | Finder honesty fields | Three commits on this branch (above); the rest optional |
| B11 | Teen postcard errors in circle wording | Not built |

The Android 1.0.8 fixes (status bar through Capacitor's SystemBars, code shrinking) are on branch
`android-1.0.8` (`6fb7fef`), not here; they reach this branch through `stamping-v2`.
