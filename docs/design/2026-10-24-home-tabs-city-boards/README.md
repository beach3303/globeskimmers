# Home tab colours + Explore City Boards — design options (2026-10-24)

Founder: "Instead of yellow tabs … change it to maybe a shade of blue … make it feel classy" and
"For Explore City Boards… give me 5 mock up design … electric shock … a mural highlighting city/country
names … a billboard design, and you do the 2 other designs". Chose **A Airmail blue** and **City Boards 3,
Billboard** — "save all designs for future change".

Canvas (private to the founder): https://claude.ai/artifact/WcQ5Q1DBPp5ixxzcY4pgHy

## Tab colours (`HOME_TAB` in `src/components/redesign/Zone.jsx`)

| Option | Preview | Tab | Letters |
|---|---|---|---|
| Today (gold, 2026-10-17 → 10-24) | `previews/Main.jpg` | `linear-gradient(180deg, #F7D37C, #E3AE45)`, edge `rgba(178,128,38,.55)` | navy `#0C2B50` |
| **A Airmail blue — SHIPPED** | `previews/Tabs-A.jpg` | `linear-gradient(180deg, #3D62AD, #2B4C8C)`, edge `#22396D`, inset `rgba(255,255,255,.22)` | cream `#FBF6EC` |
| B Harbour slate | `previews/Tabs-B.jpg` | `linear-gradient(180deg, #3A627F, #284B63)`, edge `#1D3A4E` | pale gold `#F2DCA8` |
| C Navy & gold leaf | `previews/Tabs-C.jpg` | `linear-gradient(180deg, #143E6C, #0C2B50)`, edge `rgba(214,166,74,.8)` | gold `#E2BD6B` |

Switching later = change `HOME_TAB` (and the passport tab's `textShadow` in `PassportHero.jsx`: a dark
press on blue/navy, `rgba(255,244,214,.65)` on gold).

## Explore City Boards (`src/components/home/CityBoardRow.jsx`)

| # | Design | Preview | Notes |
|---|---|---|---|
| 1 | Live wire (electric) | `previews/CB-1-LiveWire.jpg` | dark card, cyan neon border `#5EEAFF`, flickering bolt, pulsing LIVE dot, "Plug in"; motion off under reduced motion |
| 2 | Mural | `previews/CB-2-Mural.jpg` | plaster/brick wall, city names in Bungee with hard shadows, Permanent Marker signature |
| 3 | **Billboard — SHIPPED** | `previews/CB-3-Billboard.jpg` | three lamps, `#24201C` frame, sunset sky `#FF9A5A → #FF6F7D → #7A4BD0`, skyline `#2B1D47`, posts + catwalk, black pill |
| 4 | Departures board | `previews/CB-4-Departures.jpg` | split-flap rows, yellow `#F7C948` letters; YOU'RE HERE / GATE OPEN (real boards only) |
| 5 | Corkboard | `previews/CB-5-Corkboard.jpg` | cork texture, pinned snapshots with push pins, Caveat captions |

`source/` holds each artboard's `.dc.html` (the canvas format: static HTML inside `<x-dc>`; opens in a browser
without the canvas runtime) and the canvas index. `shipped/` has the billboard as built in the app.
