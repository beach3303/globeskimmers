# Globeskimmers — iPad Redesign Build Spec (for Claude Code)

This document tells Claude Code how to reproduce the **exact** iPad redesign in
`iPad App Redesign.html`. That HTML is the source of truth — open it and lift
values directly. This file summarizes the system so you can wire it into the app.

> **Reference file:** `iPad App Redesign.html` (design canvas, 7 frames).
> Each frame is a 1024 px-wide iPad screen. Match these pixel-for-pixel.

---

## 0. Paste-ready kickoff command

> Build the iPad layouts for Globeskimmers to match `iPad App Redesign.html`
> exactly. Use the design tokens in section 1, the shared chrome in section 2,
> and the per-screen specs in section 3. Keep my existing app logic, data, and
> navigation — only replace the presentation layer. Implement the 4-step text
> scaling from section 4 as a real setting bound to the 👓 button and the
> Settings "Text size" control. Don't invent new colors or fonts; use only the
> tokens below. Photos: use real images where I supply them; keep drop-in image
> placeholders for attraction cards until I provide those assets.

---

## 1. Design tokens

```css
:root{
  /* surfaces */
  --ivory:#F6F1E7; --ivory2:#EFE8D9; --card:#FFFFFF;
  /* ink */
  --ink:#16110D; --ink2:#3A3128; --ink3:#736657;
  --rule:rgba(22,17,13,.10);
  /* brand */
  --teal:#0E6E66; --teal-d:#0A554E;
  /* category accents (one world per finder) */
  --c-transit:#3551D1; --c-eat:#D8443C; --c-coffee:#9C5A2C;
  --c-atm:#2E6FE0;    --c-rest:#0E7C73; --c-store:#2E7D46; --c-weather:#E0922F;
}
```

**Fonts** (Google Fonts):
- Display / headings: **Instrument Serif** (400 + italic). Used for names, titles, hero text. Italic + `--teal`/gold for accent words.
- UI / body: **Inter Tight** (400/500/600/700).
- Labels / kickers / mono bits: **JetBrains Mono** (400/500), uppercase, `letter-spacing:.04–.16em`.

**Page background:** `#E7E2D6` (canvas), screens sit on `--ivory`.

---

## 2. Shared chrome

**Status + app header** (teal gradient top):
```css
.tealtop{background:linear-gradient(180deg,#13877C 0%,#0E6E66 100%)}
/* statusbar 34px, apphead 64px, brand centered "Globeskimmers", 👓 at right */
```

**Floating pill nav** (bottom, 4 items: Home / Explore / Scan / Settings):
```css
.navpill{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);
  display:flex;gap:6px;background:rgba(20,16,12,.84);backdrop-filter:blur(22px) saturate(140%);
  border:1px solid rgba(255,255,255,.10);border-radius:999px;padding:10px 12px;
  box-shadow:0 26px 60px -18px rgba(0,0,0,.55)}
.navpill .ni{min-width:76px;padding:12px 10px 10px;border-radius:22px;
  display:flex;flex-direction:column;align-items:center;gap:4px;
  color:rgba(255,255,255,.66);font-size:14px;font-weight:600}
.navpill .ni .nicon{font-size:26px}
.navpill .ni.on{background:linear-gradient(180deg,#1AA093,#0E6E66);color:#fff}
```
**Critical:** give scroll content `padding-bottom:170px` (or a 170px spacer) so the
floating nav never covers the last card.

---

## 3. Per-screen specs

### Home
- **Greeting card** (white, radius 30): mono kicker "Hello 👋"; serif name
  `96px` "Oliver, in *Arcadia*" (city italic + `--teal`); divider rule; bottom row =
  date/time/weather on left, frosted location pill on right.
- **Money Exchange hero**: full-width green gradient `linear-gradient(110deg,#15A06A,#0C7B50)`,
  `$€¥` glyph tile, serif `48px` title, chevron.
- **Tile grid** `grid-template-columns:1fr 1fr; gap:24px`. Each tile: category bg color,
  74px rounded glyph (emoji icon), serif `34px` title, `19px` subtitle. Weather tile spans full width.
  Tiles: Transit(`--c-transit`🚌) · Nearby Restaurants(`--c-eat`🍽️) · Coffee(`--c-coffee`☕) ·
  ATM(`--c-atm`🏧) · Restroom(`--c-rest`🚻) · Convenience Store(`--c-store`🏪) · Weather(`--c-weather`☀️, wide).
- **Explore More**: 3-col grid, gradient cards — Things to do🎡, Shopping🛍️, Cultural Info🏛️,
  Basic Phrases💬, Price Scanner💵, Text Scanner📷.

### Home · Flag Active
- Same as Home but greeting card becomes a **flag cover**: flag image as `background-size:cover`
  backdrop, dual-gradient scrim for contrast, white serif name with gold (`#FFD9A0`) italic accent,
  frosted location pill, "Home flag · {Country}" chip. **Never stretch the flag** — always cover.

### Things to Do / Places to Eat (finder pattern)
- Pill header (`.fpill`, `white-space:nowrap`): pink for Things to Do, red for Eat.
- **City card** (white): "📍 CITY" kicker + serif `38px` city name + Change pill.
- Optional amber **note** banner ("Showing places across…").
- **Distance chips** row (5/10/15/25) + MI/KM unit toggle.
- **Toolbar**: Advanced Filters bar + List/Map toggle.
- **Things to Do** = 2-up photo cards (`.agrid`): photo, serif `34px` title, rating, travel
  badge (✈ flight / 🚗 drive distance), category badge, Directions/Website buttons.
- **Places to Eat** = full-width restaurant cards (`.rcard`): 420px photo with rank badge +
  "Dish Specialist" tag, kicker, serif `42px` name, Say it / Translate / rating row, dine-in tags,
  green "Open" bar, phone bar, Directions/Map/More.

### Place Detail
- 560px hero photo (rank + "Open Now"), serif `60px` name, Say it/Translate/rating,
  tags, ivory address block, open-hours bar, phone + website rows, Directions/Map/Details CTAs.

### Onboarding
- Teal gradient (`#0E6E66→#08433D`), radial sheens, 150px glassy globe tile (🌎✈️),
  mono kicker, serif `88px` headline "Travel like you've *been there* before.",
  `26px` subhead. Bottom ivory sheet: "Choose your home country" + flag option chips +
  teal CTA "Start exploring free →" + skip + 3 progress dots.

### Settings
- Serif `64px` "Settings" + sub. **Profile card** (teal gradient, avatar, name, email, Edit).
- Grouped lists (`.setlist`, rounded white, mono group labels): Travel preferences
  (Home country, Language *(may change this in settings)*, Distance units MI/KM),
  Display (Text size A·A·A·A, Notifications toggle, Location toggle), About.
- Floating nav present → keep 170px bottom clearance.

---

## 4. Text scaling (4 steps) — REQUIRED

Bind a single multiplier to `body` and drive sized text off it:
```css
body{--fs:1}
.kick{font-size:calc(18px * var(--fs))}
.gname{font-size:calc(96px * var(--fs))}
.money h2{font-size:calc(48px * var(--fs))}
.tile h3,.tile.wide h3{font-size:calc(34px * var(--fs))}
.tile span{font-size:calc(19px * var(--fs))}
.ecard h4{font-size:calc(28px * var(--fs))}
.secthead{font-size:calc(26px * var(--fs))}
.acard .ac-title{font-size:calc(34px * var(--fs))}
.rcard .rname{font-size:calc(42px * var(--fs))}
/* …convert every display/title size to calc(BASE * var(--fs)) */
```
**Multipliers:** `[1, 1.18, 1.36, 1.55]` for levels 1–4.

**Wire it:** 👓 button cycles 1→2→3→4→1; Settings "Text size" A-A-A-A jumps to a level;
persist the choice. On iPad the 2-col tile grid keeps every label ("Nearby Restaurants",
"Convenience Store") on one line at all 4 sizes — **do not** drop to 1 col, and **do not**
let titles wrap awkwardly; keep boxes growing in pairs for visual balance.

---

## 5. Photos

- **Have real images** (in `assets/photos/`): food + market — used on Eat cards & Detail.
- **Need from you:** attraction/landmark photos (Statue of Liberty, Disneyland, etc.) and
  any city imagery. Until supplied, keep the drop-in `<image-slot>` placeholders so the
  layout is complete and the real photo just drops in later.
