# The new look: the approved spec, pinned for the build

Approved by the founder on 2026-10-13 ("I say approve on this design"). Design canvas:
https://claude.ai/artifact/AArKJHwntKyYgLj5mfYsmn

- **Home is option B, boxed zones** (`Home-Boxes.dc.html`), and B ships for everyone. Option A, colour
  bands (`Main.dc.html`), is built only as an admin-only preview behind the same switch.
- **"Your circle"** is approved as the house word for the people you follow and who follow you.
- **Weather is Bluebird and ATMs is Carbon Copy** (founder, 2026-10-13). `Weather.dc.html` and
  `ATMs.dc.html` are those picks. The boards not chosen are not pinned and must not be used. Their final
  colours are in `bible.json` (finders `weather` and `atm`, and their WORLD tuples in
  `shared_finder_frame`) and in the Palettes board's 05 · ATMS and 07 · WEATHER blocks.

## What is here
- 18 artboards (`*.dc.html`), copied byte for byte from the canvas source so the line numbers the build
  plan cites still hold. They load the canvas runtime (`support.js`, `ds/`) and `/_blob/` images that
  exist only inside the canvas: open the canvas to see them drawn, and read these files for exact values.
- `bible.json`: the design bible (finder worlds, zones, cloths, contrast pairs, states the boards don't draw).
- `sample-data.md`: the story the artboards tell. **It is mock data only**: nothing in it goes into the app.
- The canvas's `canvas.json` is not copied, because it also lists the options not chosen.

## How to build from it
- Precedence: the build plan first, then the artboard, then the bible.
- Artboards are 390px mocks in fixed px. Build sizes as `fs(N)` = `calc(Npx * var(--fs, 1))` and use
  min-height, never height, on anything that holds text, so text wraps at `--fs` 1.45.
- Colours come only from the tokens in `src/components/redesign/` (`worlds.json`, `constants.js`), whose
  values are taken from these files. No hex literals in page code.

## Artboard elements that are not built, and why
- Restrooms: the "From Skimmer reports" line (no such data) and the "Baby changing" chip (no signal).
- ATMs: the PLUS/CIRRUS pills and the "Visa Plus", "Mastercard Cirrus" and "No-fee for my bank" chips
  (no list data, and we don't know the traveler's bank).
- Weather: the "Updated 2:10 PM" time (the forecast carries no timestamp until backend item B10).
- Convenience: the search field and the Snacks and SIM cards chips. Shopping: the search field, the
  Boutiques and Books chips (the real categories, such as Bazaars and Night markets, stand in for the
  board's Markets chip) and the neighbourhood kicker. Neither worker takes a query, and these chips have no data.
- Culture: the sample sections Emergency 911, Electrical, Tipping table and Dress (not in the real
  catalog), and the "Listen" speaker (culture phrases carry no language code).
- Money: the "Best rate" sort (no office sends a rate).

## Pages that keep today's look in this phase
The Passport booklet, Settings (except helper text and the admin row), SavedLocations, LocalFavorite,
SuggestPlace, Suggestions, Onboarding, AdminAnalytics, the search overlay, the location picker and the
welcome splash.
