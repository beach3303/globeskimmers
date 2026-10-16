# City Board art kits — the template

A board (a city, a US state, a country, or a destination like Siargao) wears a **kit**: one painted
header, six margin icons, and a palette. The app lays them into the same frame every time, so every
board feels like one family and a new kit needs no code. Boards without a kit wear the plain airmail
frame until theirs arrives.

This document is the brief for whoever paints the kits (ChatGPT image models, an illustrator, or us).
Decided with the founder 2026-10-16.

## What a kit is

```
kits/<key>/
  header.png      1206 × 690 px  (the app shows it at 402 × 230 points, 3×)
  icon-1.png … icon-6.png   360 × 360 px, transparent background
  palette.json    { "plate": "#0C2B50", "accent": "#D6A64A", "ink": "#FFFCF7" }   (optional)
  meta.json       { "name": "Los Angeles", "kind": "city", "icons": 6,
                    "country": "United States", "state": "California" }
```

Folders are named by kind, then the place and its country, lowercase and hyphenated — exactly how
the app looks them up: `city/los-angeles--united-states`, `state/texas--united-states`,
`country/ghana`, `city/paris--france`, `city/siargao--philippines` (a destination is a city board),
`city/cairo--egypt`. Accents dropped (`city/sao-paulo--brazil`). `meta.json` may add
`"icons": 8` when a kit ships more than six.

## The header (1206 × 690)

The header is the painting. It is the only element that is different for every board.

- **Subject:** the board's signature view — the one picture a traveler already has in their head.
  Los Angeles: white blocks of a sign on dry hills, palms, a pier wheel at dusk. Paris: the tower in
  the day, mansard rooftops, café chairs. Cairo: the pyramids with the city's haze. Texas: a big sky,
  a windmill, a longhorn, a smoker trailing smoke. Ghana: kente stripes, the Black Star, a fishing
  boat on gold sand.
- **Composition:** the interest sits in the **upper two thirds**. The lower third stays calm (a
  horizon, a flat field, a sky) — the app prints the board's name over it in white serif, with a
  gradient to dark underneath. Never bake text into the painting.
- **Style:** flat shapes and limited palettes in the vintage travel-poster / art-deco spirit — the
  same family as our stamp artworks and the WOW!/COOL! stickers. Bold silhouettes, soft grain is
  welcome, no photo-realism, no outlines thinner than ~2 px at full size.
- **Light:** golden hour or clean daylight. One sun or one moon at most.
- **Safe area:** nothing important within 60 px of the left and right edges (the deco frame
  overlaps slightly).

## The six margin icons (360 × 360, transparent)

Stickers that scatter around the board: the sign, the pier wheel, a clapperboard, a palm, a taco, a
walk-of-fame star for Los Angeles; a cowboy hat, a boot, a barbecue plate, a longhorn, a bluebonnet,
the Alamo silhouette for Texas; a kente pattern, a cocoa pod, a talking drum, the Black Star, a
fishing boat, a jollof pot for Ghana.

- One subject per icon, centred, filling ~80% of the square.
- Flat, 2–3 colours from the kit's palette plus white and the ink; a 3–4 px darker outline; a tiny
  paper-white sticker edge is fine (see the sticker set).
- No text in icons.
- Icons must read at 40 px — if it needs detail to be understood, pick a different subject.

## Palette

Default plate is deco navy `#0C2B50` with gold `#D6A64A` and ivory `#FFFCF7`. A kit may override
to suit its painting (Texas: a burnt sienna plate; Ghana: a deep green plate with gold). Keep the
accent warm (golds, brass, cream) so the frame stays one family across boards.

## Rules that are not negotiable

- **No real people.** No likeness of anyone, living or dead — no Marilyn, no Elvis, no athletes.
  Glamour is an *anonymous* starlet in a scarf and sunglasses; music is a guitar, not a singer.
- **No logos, brands, team marks, or film titles.** A studio water tower, yes; its name, no.
- **Landmarks are painted as shapes, not reproduced.** Some landmark images are licensed for
  commercial use (the Hollywood Sign's lettering, the Eiffel Tower's night lighting, some modern
  buildings and sculptures). Paint the *idea* — white blocks on a hill, the tower by day, a bridge's
  silhouette — never a photographic copy.
- **Respect places.** Nothing that mocks a country, a culture or a faith. Religious buildings are
  painted with care and never as novelty.
- **Nothing that implies a sponsor or an official tourism board.**

## Deliverables per kit

One folder named by key, holding the files above, zipped. Also a one-line description of the header
("Golden-hour view of the sign from the Griffith trail, palms in the foreground") for our records.

## Wave 1 (~450 kits)

1. **US states** — all 50 + DC. Kind `state`. Each state's signature pride (not its seal or flag).
2. **US cities — top 100** by visitors and icon value, at least one per state.
3. **World cities — top 100**, with destinations that aren't cities (Santorini, Bali, Banff,
   Palawan, Boracay, Siargao, Zanzibar) counted as boards.
4. **Countries — all 195.** Kind `country`. Food, textiles, art, a scene, a national animal —
   anything that is the country's pride, never its politics.

## Wave 2 (~500 kits)

The next 200 US cities and the next 300 world cities and destinations.

## Quality check before a kit ships

1. The header reads as the place in one second, at phone width.
2. The lower third is calm enough for a white title.
3. All six icons read at 40 px.
4. No people, logos, text, or reproduced trademarked landmarks.
5. The palette file (if any) keeps a warm accent.
