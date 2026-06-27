# Handoff: Globeskimmers App Redesign — "Bold / Vibrant" Direction

## Overview
This package contains a full visual redesign of the Globeskimmers mobile app (international travel companion). The redesign keeps the app's brand DNA (teal gradient, honest UX, source labels, "Updated Mar 15" text, no freshness color dots) but turns up the energy: a **per-category color system**, **photo-led cards**, **chunky CTAs**, **bold type with serif-italic accents**, and a **floating pill bottom nav**. A matching marketing **landing page** and a **clickable prototype** are included.

The design owner is **Maiza** (repo: `beach3303/globeskimmers`). The traveler shown in mockups is named "Oliver" (placeholder display name only).

---

## About the Design Files
**The files in this bundle are design references created in HTML/React (via Babel in the browser).** They are prototypes that demonstrate the intended look, layout, color, type, and behavior — **not production code to copy directly.**

The task is to **recreate these designs inside the existing Globeskimmers codebase**, using its established stack and patterns:
- **React 18** (functional components + hooks)
- **Tailwind CSS** (+ `tailwind.config.js` theme tokens)
- **Radix / shadcn-ui** components (`components.json` present)
- **Base44** backend (`base44.functions.invoke`, `base44.auth`) + **Cloudflare Worker** (`globeskimmers-api.maizasimeon.workers.dev`) for cached Google Places / exchange-rate / scan calls
- **react-leaflet** for the Map
- **framer-motion** for animation
- **lucide-react** for icons (the prototype uses inline SVGs that map 1:1 to lucide names — see Assets)

Do **not** introduce the in-browser Babel setup, the `<script>` loaders, or the design-canvas/iOS-frame scaffolding into the real app — those are presentation tools for this prototype only. Lift the **visual specs** (color, type, spacing, layout, component structure) into real `.jsx` page components under `src/pages/`.

---

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, and interactions are specified. Recreate the UI pixel-faithfully using the codebase's existing Tailwind tokens + shadcn components. Where a value below isn't in the current `tailwind.config.js`, add it as a token rather than hard-coding inline.

---

## Design Tokens

### Brand
| Token | Value | Use |
|---|---|---|
| Teal gradient | `linear-gradient(135deg, #0E8077 0%, #14B5A6 60%, #2DD4BF 100%)` | Brand banner, primary brand surfaces, final CTA |
| Teal deep | `#0E7C73` | Brand text accent, links, active nav |
| Teal mid | `#14B5A6` | Gradient midpoint |
| Teal light | `#2DD4BF` | Gradient end |

### Category color system
Each finder/feature gets its own "world." `ink` = saturated solid (tile bg / icon bg), `bg` = soft tint (chips, soft cards), `soft` = mid tint (borders/hover).

| Category | ink | bg (soft tint) | Used by |
|---|---|---|---|
| Food | `#E63946` | `#FFE4E0` | Places to Eat |
| Money | `#0F9A6B` | `#D8F4E5` | Money Exchange |
| Coffee | `#A85A2E` | `#F2DDC4` | Coffee Finder |
| Transit | `#3F49D4` | `#DFE2FA` | Transportation |
| Restroom | `#0F8A82` | `#D2EFEC` | Restroom Finder |
| ATM | `#1F5BD6` | `#DCE6FB` | ATM Finder |
| Weather | `#D4861A` | `#FCEAC9` | Weather |
| Things to do | `#C5197A` | `#FBDEEB` | Things to Do |
| Shopping | `#7C3AED` | `#EAE0FA` | Shopping |
| Culture | `#8B5A1A` | `#F3E2C7` | Culture |
| Phrases | `#A37013` | `#F8ECC4` | Basic Phrases |
| Convenience | `#15803D` | `#D4F0DA` | Convenience Store |

Saturated tiles use a white icon on `ink`, a soft white circle deco (`rgba(255,255,255,.12)`) bleeding off the top-right corner, and shadow `0 8–12px 22–26px -10/-12px {ink}80`.

### Neutrals / surfaces
| Token | Value |
|---|---|
| App background | `#FFFCF7` (warm off-white) |
| Secondary surface | `#F7F4EC` |
| Card white | `#FFFFFF` |
| Hairline border | `#F0E9DC` |
| Strong border | `#E5DDC8` |
| Ink (text) | `#0F1419` |
| Ink-2 | `#3A3128` |
| Ink-3 (muted) | `#475569` / `#6B7280` |
| Ink-4 (faint) | `#94A3B8` |
| Dark surface (cinematic/gallery) | `#0E1518` / `#161E22` |

### Typography
| Role | Family | Notes |
|---|---|---|
| UI / body | **Inter Tight** (400/500/600/700/800) | Default. Headlines use 800, tight `letter-spacing: -.014em to -.022em` |
| Editorial accent | **Instrument Serif**, italic, weight 400 | Used for the emphasized word in a title (e.g. "in *Lisbon*", "*Liberty*", time/rate numbers) |
| Micro labels / data | **JetBrains Mono** (400/500) | Eyebrows, "UPDATED MAR 15", tiers, statuses. ~10–11px, `letter-spacing: .12–.16em`, uppercase |

Type scale (mobile): screen title 28–34px/800; card title 15–22px/700–800; body 13.5–15px; meta 11.5–13px; mono label 9.5–11px.

### Radius / shadow / spacing
| Token | Value |
|---|---|
| Card radius | 16px (small), 18–22px (medium/feature), 24px (hero/sheet) |
| Pill radius | 999px |
| Icon chip radius | 10–13px |
| Soft card shadow | `0 1px 0 rgba(15,20,25,.04), 0 6–8px 16–24px -8/-12px rgba(15,20,25,.08)` |
| Colored card shadow | `0 8–14px 22–32px -10/-16px {categoryInk}80` |
| Screen padding | 18–22px horizontal |
| Card inner padding | 14–22px |
| Grid gap | 10px |
| Phone safe-area top spacer | 54px (status bar) |
| Bottom space for floating nav | 110px |

---

## Global Components

### Brand banner (`BrandBanner`)
Full-width 50px bar, teal gradient, centered white wordmark "Globeskimmers" (Inter Tight 800, 15.5px, `letter-spacing: .02em`), shadow `0 2px 14px rgba(14,124,115,.25)`. Sits directly under the status bar on most finder screens.

### Floating pill nav (`FloatingNav`)
Fixed, centered, 22px above bottom safe area. Pill: `background: rgba(15,20,25,.92)`, `backdrop-filter: blur(20px) saturate(160%)`, radius 999, padding 5–6px, shadow `0 18px 40px -10px rgba(0,0,0,.3)`. **3 anchors only: Home, Saved, Settings** (the Search icon was removed per owner request). Each item 46–52×38–44px; active state = `rgba(255,255,255,.14)` wash, full opacity; inactive 0.7 opacity. Icons white. Behavior: hides on scroll-down, reappears on scroll-up. Dark-surface variant uses `rgba(255,255,255,.06)` bg + `1px solid rgba(255,255,255,.1)`.
**Settings icon = gear** (lucide `settings`/`Settings`), NOT a sun/brightness icon.

### Chunky button (`ChunkyBtn`)
Height 44 (md) / 54 (lg), radius 14–16, weight 600, `box-shadow: 0 6px 18px -6px rgba(0,0,0,.25), 0 1px 0 rgba(255,255,255,.18) inset`. Primary = ink `#0F1419` bg / white text. Category CTA = category `ink` bg / white. Secondary = soft category `bg` / category `ink`.

### Pill / badge (`Pill`)
`padding: 6px 12px`, radius 999, weight 600, ~12.5px. Tinted by category (`bg` + `ink`) or neutral (`#F3F4F6` + `#374151`).

### Photo placeholder
Real app uses Google Places photos. In mockups these are diagonal-stripe gradient blocks tinted by category `ink`. **Replace with actual `place.photos[0]` image URLs.**

---

## Screens / Views

> Layout note: every finder screen = StatusBar spacer (54px) → BrandBanner (50px) → header row (back ◦ / title pill / map or filter ◦, all 40px circles) → scrollable content (18px padding) → FloatingNav. Back/utility buttons are 40px white circles with `1px solid #F0E9DC`.

### 1. Home (`Home.jsx`) — FINAL CHOSEN DIRECTION
**Purpose:** Hub. Greeting + featured Money Exchange + all feature tiles.
**Layout (top→bottom):**
1. **Greeting card** — white, radius 22, border `#F0E9DC`. "Hello 👋" (muted 14px) + "Oliver, in *Lisbon*" (30px/800, "Lisbon" in Instrument Serif italic teal-deep). Sub-cards: location row (pin + "Praça do Comércio" + teal "Change location") and a date/time/weather row (`Wed, May 27` · `10:57 AM` · cloud icon `61°F`), each on `#F7F4EC` rounded 14.
   - **NOTE:** The "Modern" pill button that used to sit top-right of the greeting was **removed** — do not re-add.
2. **Featured Money Exchange card** — green gradient `linear-gradient(135deg,#0F9A6B,#10B981 60%,#16E27A)`, white text, "$€¥" glyph chip, title + "Compare rates near you · 4 booths live", chevron. Shadow `0 14px 30px -14px rgba(15,154,107,.5)`.
3. **3-col category grid** (Transit, Food, Coffee) — square saturated tiles.
4. **4-col category grid** (ATM, Restroom, 24h store, Weather) — smaller square tiles.
5. **"Explore more" row** — 2×2 **gradient** cards (Things to do magenta→pink w/ ✦✧ deco, Shopping violet w/ floating-square deco, Culture sienna→amber w/ ring deco, Phrases gold w/ giant "あ" glyph). These are deliberately vibrant — NOT pale pastel tiles.

**Flag-activated greeting (`HomeFlagOverlay` feature):** When a home country is set, the **greeting card only** (not the whole screen) becomes a **landscape 3:2 card with the country's full flag as background**. Flag image from `https://flagcdn.com/w640/{cc}.png`, `object-fit: cover`, `object-position: left center` (or `center` for no-fade countries like Japan). Three contrast treatments — ship **Medium** as default, optionally expose Subtle/Bold in Settings:
- **Subtle:** flag opacity 0.35, white-glass cards, dark text.
- **Medium (default):** flag opacity 0.70 + bottom scrim `linear-gradient(180deg, rgba(0,0,0,.22), rgba(0,0,0,.55))`, white text w/ `text-shadow: 0 2px 12px rgba(0,0,0,.25)`.
- **Bold:** flag opacity 1.0 + stronger scrim (.38→.70), white text.
Country pill top-right shows a flag-accent swatch + "US · home". Japan special case: `noFade` — full circle stays centered, no horizontal mask.

### 2. Places to Eat — List (`PlacesToEat.jsx`)
Header pill "Places to Eat". Title "The locals' *list*" (serif italic, food coral) + "Alfama · 12 within 1 km". Filter chip row (All / Portuguese / Seafood / Vegetarian / Brunch / Late night), active chip = ink-filled. Cards: white, radius 16, border; tier dot (Authentic green / Specialist teal / Has It gold), serif-ish bold name, "cuisine · €€ · 4.8 ★ · walk", mono status line in food-ink, optional small photo (64×64) right. "⭐ Locals' #1" badge for top pick. Three list philosophies exist in canvas (editorial divider list, bordered cards w/ photo, map-led dark) — **ship the bordered-card variant**.

### 3. Places to Eat — Detail (Domino's example)
Photo carousel (radius 22) with floating gold "#1" medal (44px circle, `#FFC93C`, 3px white border), "✓ Namesake/Authentic" white pill top-right, dot indicators + "📷 5/10" counter. Title block: category subtitle (e.g. "Pizza Delivery" in ATM blue), big name with serif-italic accent, address, rating·distance·price row. Service pills (Takeout/Delivery/Dine-in, color-coded). Green "Open · 10:00 AM–1:00 AM" band. Parking card (blue "P", "✓ Confirmed" badge, Free lot/street pills). Phone card (blue circle, tap-to-call). Action row: amber **Directions** (lg) + violet Map. Reviews show **source badge** (GlobeSkimmers teal vs Google gray) — keep this.

### 4. Money Exchange (`MoneyExchange.jsx`)
Hero rate panel: green gradient, "MID-MARKET RATE" mono label, big "€1.00 = $1.08" in serif italic 44px, "Updated 2 min ago · live" mono, "EUR→USD" pill toggle. List "4 booths within *1 km*". Each booth row: numbered serif-italic chip, name, fee+distance, serif-italic rate right. **#1 best-rate booth** rendered in green gradient w/ "BEST RATE" mono caption. Amber honest-tip box: "Skip airport exchanges — you'd lose ~€4.80 on a $100 swap." Currency list + symbols + flags come from the repo `CURRENCIES` array.

### 5. Transportation (`Transportation.jsx`) — route planner
This replaces the 159KB screen. Structure:
1. **Route card** (white, radius 20): timeline rail (green ring "From" → red pin "To"), "Praça do Comércio" → "Castelo de São Jorge", a transit-blue navigate chip right. Meta row: "📍 2.4 km" pill + **traffic badge** + "🕐 Now · 14:08".
2. **Quick shortcuts** row: Airport (blue) / Hotel (coral) / Saved (magenta) — maps to repo's airport-picker, hotel, saved-locations.
3. **Ways to get there** — sorted by traveler-pick. Each row: category-colored icon chip, mode + tag, serif-italic time + fare right. Best pick (Tram 28) rendered solid transit-indigo w/ white text + "· best". Modes & fares come from repo `FARE_RATES` (per-country base+perKm, low/high) and `calculateTravelTime` (time-of-day × city-traffic × holiday multipliers).
4. **Book a ride** — region-aware rideshare apps from repo `RIDESHARE_PROVIDERS` (Grab/Uber/Lyft/Bolt/Gojek/DiDi/Kakao/Careem filtered by country code). Each: provider glyph chip, name, ETA/price note, serif-italic estimate, colored "Open" button (deep-links via provider `deepLink(origin,dest)`).
5. **Call a taxi** — amber card, country hotline from repo `TAXI_SERVICES`.
6. **Honest tip** — transit-tint info box.
**Traffic badge:** light=green `#15803D`/`#D4F0DA` 🟢, moderate=amber 🟡, heavy=orange 🟠 — driven by existing `getTrafficStatus`.

### 6. Coffee Finder (`CoffeeFinder.jsx`)
Coffee-rust hero card (gradient, giant ☕ deco), filter chips (All/Pour-over/Espresso/Cold brew/Work-friendly/Late night), shop cards with 68px photo, "⭐ Locals' #1" badge, vibe line, green open-status dot, star rating + count right.

### 7. Restroom Finder (`RestroomFinder.jsx`)
Teal hero "5 clean spots within *1 km*" + "Rated by people who actually checked". Filter pills (Free only / ♿ Accessible / 👶 Baby change / ⭐ Clean 4+). Each result: rest icon chip, name + "· top pick", type, **clean rating as filled/empty dots** (the repo's 0–10 score → 5 dots), Free/Purchase-req chip, ♿ chip, italic note ("Buy a coffee · gorgeous tile"), walk time + distance right. Top pick = teal gradient. (Note repo bug: restroom search infers `hasRestroom` from venues — design assumes results exist.)

### 8. Things to Do — List (`ThingsToDo.jsx`)
Title "Things *to do*" (serif italic magenta). Colorful emoji filter chips (All / 🎨 Culture / 🌳 Outdoors / 🌃 Nightlife / 👨‍👩‍👧 Family / 🆓 Free), active = filled category color. **Sectioned** horizontal-scroll rails with emoji section headers ("⭐ National Icons · USA (40)", "💎 Regional Must-See · CA (20)"). Activity cards (260px wide): photo, title, red "✈️ Flight/Ferry · 2454 mi" travel badge, rating+count, type, 📍 location, amber Directions + outline Site buttons.

### 9. Activity Detail (Statue of Liberty example)
Full-bleed photo hero (380px) with floating gold "#1" medal, white "🏛 Historic Site" pill, "● Open Now" green pill bottom-left, "📍 2451.2 mi" dark pill bottom-right. Sheet pulls up (radius 24, -22 margin): big name w/ serif-italic accent, 5-star rating + count, **Score bar** (green gradient fill, "Great" label) — maps to repo "Worth It %". Tag pills (Family Friendly amber / Photo Op magenta / Free transit blue). Location/Open-hours/Phone/Website cards, each in its own category color. Three chunky CTAs: amber Directions / violet Map / gray Hours.

### 10. Map (`Map.jsx`)
Full-screen react-leaflet. Teal gradient header (location name 18px/800 + "Your current location" + close X). Map fills remaining space. Markers: **red pin = current location, gold pin = selected** (matches repo's `redIcon`/`yellowIcon`). Info popup card (white, rounded, name + sublabel). **Recenter FAB** bottom-right, 48px white circle, teal navigate icon. OSM tile attribution. (Mockup fakes the tiles with an SVG street grid; real screen uses `<TileLayer>` OSM.)

### 11. Smart Text Scanner (`SmartTextScanner.jsx`)
Currently a "Coming soon" page. Redesign: violet gradient header (radius-b 24) with Back + "Smart *Text Scanner*". Body: big violet→magenta scan-icon hero (88px rounded-26), "Coming soon", description, 3 capability rows (Scan any text / Auto-translate / Save & speak — each category-colored icon chip + "Soon" pill), ink "Notify me when it's ready" CTA, magenta thank-you note. (Sibling `SmartPriceScanner.jsx` is fully built — camera + auto-scan every 3s + currency convert; not redesigned here.)

### 12. Onboarding (`Onboarding.jsx`) — 3 steps
- **1/3 Welcome:** progress bar (3 segments), big "Travel like *you've been* there before." (serif italic transit-indigo), subcopy ("food, money exchange rates, ATMs, restrooms, and ride options"), indigo gradient visual card (🌍 + "194 countries · 63 cities"), ink "Get started →" pinned bottom.
- **2/3 Home country:** "Where are *you from?*" (serif italic coral). Subcopy ends: "…to your home language. *(may change this in settings)*" — the parenthetical is small (11.5px) faint `#94A3B8`. Search bar + 3×3 flag grid (flagcdn `w320`), first (USA) selected with coral 3px border + ✓ badge. "See all 194 countries" link. Ink "Continue with USA →".
- **3/3 Location:** "Find *nearby* things." (serif italic green). Green gradient permission card (📍 + "One tap. Six tiles. Anywhere."), 3 benefit rows (Locally relevant / Open right now / Updated weekly), green "Allow location & finish →" + "Maybe later".

---

## Interactions & Behavior
- **Navigation:** tapping a Home tile → that finder screen; back button → Home (or previous). Prototype uses a simple route stack.
- **Onboarding:** Welcome → Home country → Location → Home. "Maybe later" skips permission.
- **Filter chips:** horizontal scroll, single-select (finders) — selecting re-queries (server-side filters via Worker v7.12: openNow, minRating, priceLevels).
- **Cards:** tap → detail screen. Save/heart toggles optimistic.
- **Photo carousel:** horizontal swipe, dot indicator, "n/total" counter.
- **Map↔list toggle**, **pull-to-refresh**, **sticky filter bar**, **subtle page transitions** were requested — implement with framer-motion (the prototype uses CSS/state).
- **FloatingNav:** hide on scroll-down, show on scroll-up.
- **Landing page** "Send me the link" widget: SMS/email segmented toggle → on submit, send a deep link / smart-banner URL (wire to Twilio / mailer in production; mockup is UI-only). App Store + Google Play buttons link to store listings.

## State Management
Per finder: `loading`, `results[]`, active `filter`, `searchQuery`, selected item, `savedLocations[]`, `activeLocation` (from `LocationContext`), exchange `rate`, modal flags (destination search, airport picker, saved locations, location picker). Data via `base44.functions.invoke(...)` → Cloudflare Worker (KV-cached). Home-country/flag preference persisted on user (`base44.auth.updateMe`) + Settings. Keep all existing localStorage caches (route info 6h, location search 24h, exchange rates 1h/24h).

## Assets
- **Icons:** lucide-react (the prototype's inline `<I name=.../>` SVGs map to: pin→MapPin, cup→Coffee, cash→DollarSign, atm→CreditCard, rest→(custom), bus→Bus, sun→Sun, star→Star, bag→ShoppingBag, lang→Languages, compass→Compass, store→Store, scan→ScanLine, navs→Navigation, phone→Phone, mail→Mail, chev→ChevronRight, arrow→ArrowRight, home→Home, saved→Bookmark, settings→Settings(gear), x→X). Use lucide equivalents.
- **Flags:** `https://flagcdn.com/w640/{cc}.png` (greeting) and `w320` (onboarding grid). Already used by repo's `HomeFlagOverlay`.
- **Photos:** Google Places photos via your Worker — replace the striped placeholder blocks.
- **Fonts:** Google Fonts — Inter Tight, Instrument Serif (ital), JetBrains Mono. Self-host or `@import` per your setup.
- **Store badges:** use official Apple/Google badge assets in production (mockup draws simplified versions).

## Files (in this bundle)
- `README.md` — this document (self-sufficient spec).
- `screens/` — rendered PNG of every screen (01–14), true phone width.
- `design_source/` — the HTML/JSX design references. Open `design_source/App Redesign.html` for the full canvas of every screen; `design_source/Globeskimmers Prototype.html` for the clickable flow; `design_source/index.html` for the landing page.

| File (in `design_source/`) | Contains |
|---|---|
| `App Redesign.html` | Design canvas host (loads all screen modules) |
| `Globeskimmers Prototype.html` | Clickable prototype host |
| `index.html` | Marketing landing page host |
| `redesign-system.jsx` | Category palette (`BC`/`CAT`), icon set (`I`), shared atoms (Screen, Kicker, FloatingNav, etc.) |
| `redesign-bold.jsx` | Bold Home, Place detail, Things to Do, Activity detail, Money Exchange |
| `redesign-home-variations.jsx` | Equal-weight Home grid explorations |
| `redesign-home-final.jsx` | **Final Home** + flag-activated landscape greeting (Subtle/Medium/Bold) |
| `redesign-more-screens.jsx` | Coffee, Restroom, Transportation (v1), Onboarding 1–3 |
| `redesign-screens-2.jsx` | Map, Smart Text Scanner, Transportation route planner (final) |
| `redesign-canvas.jsx` | Canvas composition (which artboards show where) |
| `redesign-proto.jsx` | Prototype router / navigation stack |
| `landing.jsx`, `landing-phone.jsx` | Landing page sections + phone mockup |
| `design-canvas.jsx`, `ios-frame.jsx` | Presentation scaffolding only — **do not port to the app** |

> Reminder: recreate the **visual + interaction specs** above in `src/pages/*.jsx` using React + Tailwind + shadcn + Base44. The HTML/Babel/canvas scaffolding is for previewing this handoff only.
