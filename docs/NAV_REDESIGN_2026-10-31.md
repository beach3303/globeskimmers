# Navigation redesign — one bar, the stamp in the middle

Founder decision, 2026-10-31. Design canvas: "Globeskimmers architecture review" (claude.ai, private).
Claude Code can't open that link, so this file carries everything needed to build it.

**This replaces the 2026-10-25 decision "Bottom bar stays as it is."** Record it in `docs/PLANS.md` the same day.

## Why

A new Skimmer comes to do three things: **stamp a photo, look at City Boards, and find their own page.**
Today those sit behind 11 doors in two menus: the bottom bar (Home · Mailbox · Passport · Profile · Settings)
and Home's six tabs (Nearby · Stamps · Virtual Passport / Arrivals · City Board · City Cards). The upload
sits under the booklet on Passport, City Board is the fifth Home tab, and "my stuff" is split across
Passport, Profile, Arrivals and Mailbox.

## The new map

**Bottom bar, five items, left to right:** Boards · Nearby · **Stamp** (raised, centre) · Passport · Profile

**One rule:** Passport is what you've collected. Profile is who you are and who you know.

| Tab | What's there | Moved from |
|---|---|---|
| **Boards** | Your city's board first (billboard + newest photos, *Open the board*, *Post to this board*), then THE REST OF THE WORLD (boards with something new first), *All boards*, a search box. | Home › City Board (`CityBoardPage`), `CityBoards` page, Mailbox link |
| **Nearby** | "Hello {name} in *{city}*", the date, temperature, location pill with Change; `SmartSearchBar`; Events & festivals; **Nearby services** (all 11 finders, 3 across, as today's `NearbyServices compact`); "Be there, and it's *yours*" (`StampsNearYou`). | Home lobby, Home › Nearby, Home › Stamps |
| **Stamp** | Opens a bottom sheet: *Upload photos* · *Stamp where I am* · "Just sharing photos? Post them to a City Board". | "Upload photo to get a stamp" under the booklet |
| **Passport** | Kicker MY VIRTUAL PASSPORT, title "Everywhere you've *been*", counts; the book; tabs **Stamps · Photos · Cards**. Photos = the owner's photo albums (`PhotoPackets`). Cards = `CityCardsPage embedded`. | Passport, Profile's photo albums, Home › City Cards |
| **Profile** | Cloth cover "MY WORLD" with the pencil (edit) and a **gear (Settings)**; bookplate (photo, name, @handle, about) with a "4 stamps · 2 countries · My passport ›" link; YOUR CIRCLE (Inner circle · You follow · Follow you, **Friends' news**, + Add friends); ON MY MAP; "Who sees my passport"; invite; My kit. | Profile, Home › Arrivals, Mailbox › News, Settings tab |
| **Mail** (not a tab) | An envelope at the **top-left of the banner** with a red dot for new mail. Opens Mailbox. | Bottom bar |

Retired: Home's six-tab `HomePager`, the Virtual Passport Home tab, the Settings tab, the Mailbox tab,
Profile's MY VIRTUAL PASSPORT folder and its photo packets (they now live on Passport).

## Visual spec (Globeskimmers design system)

**Bottom bar** (`src/components/redesign/FloatingNav.jsx`) — keep the pill, swap emoji for lucide icons:
- Pill: `rgba(22,17,13,0.92)`, text `#FAF7EE`, padding 6, gap 2, radius 9999, `shadow-nav`. Fixed, centred, `bottom: calc(22px + env(safe-area-inset-bottom))` (unchanged).
- Items: 62px wide, min-height 52, radius 18, icon 22px stroke 2, label 10.5px/700, letter-spacing 0.2px. Inactive opacity 0.62. Active: `linear-gradient(180deg,#1AA093,#0E6E66)`, opacity 1 (unchanged).
- Icons: Boards `LayoutGrid` · Nearby `MapPin` · Passport `BookOpen` · Profile `CircleUserRound`.
- **Stamp** (centre): 70px slot; a 58px circle raised 30px above the pill (`margin-top: -30px`), fill stamp red `#B0472F`, 3px `#FAF7EE` ring, shadow `0 10px 22px -8px rgba(176,71,47,0.7)`, white `Camera` icon 26px; label "Stamp" under it. `aria-label="Stamp: upload photos or stamp where you are"`.
- Active tab by route: Boards → Boards; Home → Nearby; Passport → Passport; Profile/Circle/Settings → Profile. Others light nothing.
- Track taps: `trackEvent('nav_tab', { tab })`.

**Banner envelope** (`src/Layout.jsx`, beside the existing `FontScaleButton`):
- Mirror the glasses button on the left: 44px hit area at `top: calc(env(safe-area-inset-top) + 3px)`, `left: 10px`; 40px white disc, 1px `rule` (#F0E9DC) border, lucide `Mail` 19px in `ink`.
- Red dot `#E0533C`, 10px, 2px white ring, top-right of the disc, when `socialUnread()` mail > 0 (move the polling FloatingNav does today here). `aria-label`: "Mail" / "Mail, new messages". Hidden on Onboarding.

**Stamp sheet** (new, e.g. `src/components/passport/StampSheet.jsx`):
- Bottom sheet, white, radius 24 24 0 0, grabber 38×5 `#E5DDC8`; title serif "Add a *stamp*" (stamp red italic), line "Stamps are earned by being there: right now, or in a photo from the trip.", a 44px close.
- Row 1 (primary): cream `#FBF6EC` card, `#EADFC9` border, radius 18; 52px stamp-red chip with white `ImagePlus`; "Upload photos" / "One photo or many, from any trip. We find where and when each was taken."
- Row 2: white card, `#E5DDC8` border; 52px teal-soft chip with teal `MapPin`; "Stamp where I am" / "At a place right now? Your phone's location proves it."
- Row 3: text button in airmail blue `#2B4C8C`: "Just sharing photos? Post them to a City Board ›" (the Contribute sheet).
- **Gotcha:** the photo picker must open from the tap itself (iOS WebView blocks a file input clicked after navigation). Put the real `<input type="file" accept="image/*" multiple>` in the sheet, then hand the files to the Passport the way gallery shares already arrive (`src/lib/sharedPhotos.js` → Passport's PhotoSorter / Stamp a place). *Stamp where I am* can navigate to `/Passport?stamp=here` and open `showStampPlace`.

**Passport page** (`src/pages/Passport.jsx`):
- New member (no stamps): the upload comes **first**, above the book: kicker, serif "Your first page is *waiting*", "Stamps are earned by being there. Start with a trip you've already taken.", then a cream card with *Upload photos* (stamp red, 54px, radius 14) and *Stamp where I am* (white, 48px). Below: "Meanwhile, on the {city} board" row → Boards.
- Returning: header + the book + tabs Stamps · Photos · Cards (44px, active = ink 700 with a 2px `#0E7C73` underline).
- Remove the "Your photo albums are on your Profile ›" line.

**Profile page** (`src/pages/Profile.jsx`): drop the MY VIRTUAL PASSPORT folder and photo packets; add the gear (Settings) next to the pencil on the cloth cover (44px discs, `rgba(255,255,255,0.14)` with a `rgba(255,255,255,0.3)` border); put **Friends' news** (Mailbox › News + `FriendsTravels` + New arrivals) and **+ Add friends** inside YOUR CIRCLE.

**Stamp earned:** after a verified stamp, the sheet says "Your photo is on the {city} board too" with *See the board* (teal `#0E7C73`, 54px) and *Stamp another photo*. This takes over from BoardNudge's "Send a postcard" prompt (keep the postcard as a secondary action if wanted).

## Build order — one logical change per commit

1. **Bar + banner envelope.** New FloatingNav items and icons; envelope + unread dot in Layout; Settings reachable from Profile's gear. Add a `Boards` page that renders `CityBoardPage` full-screen (register it in `src/pages.config.js`). Home shows only the Nearby content (lobby + search + Events + `NearbyServices compact` + `StampsNearYou`); keep the `/Home` route so deep links still work.
2. **Stamp sheet** wired to the existing upload / Stamp a place / Contribute flows.
3. **Passport:** upload above the book for new members; Stamps · Photos · Cards tabs.
4. **Profile:** remove the passport folder and albums; Friends' news and + Add friends in YOUR CIRCLE.
5. **Clean-up:** retire `HomePager`'s six tabs; onboarding's "Not now" lands on Boards instead of Home; Stamp earned links to the board.
6. **Later, optional:** Mailbox tabs become Inbox (postcards + telegrams) · Sent; the location chooser stops asking on every cold start by default.

Before each commit (from CLAUDE.md): `npx eslint --quiet <changed files>`, `npm run build`, `npm run boot-check`. Show the diff before committing and ask before pushing. Check the bar on iPhone **and** iPad (`useIsTablet`, `HomeTablet`), and at the largest text size (the eyeglass `--fs` multiplier).
