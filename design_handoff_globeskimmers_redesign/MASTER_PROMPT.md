# MASTER PROMPT — Redesign the whole Globeskimmers app to match the approved design

Paste the block below to Claude Code. It points at the real files, sets global
rules, and lists every screen in build order. Two reference files must be in the repo:
- `iPad App Redesign.html` — the **visual source of truth** (open it, lift exact values)
- `design_handoff_globeskimmers_redesign/CLAUDE_CODE_IPAD_BUILD.md` — tokens + per-screen spec
- `design_handoff_globeskimmers_redesign/FIX_FLAG_AND_PLACES_TO_EAT.md` — the two corrected screens

---

## ► Paste this to Claude Code

> Redesign the Globeskimmers app's UI to match the approved design **exactly**.
> The visual source of truth is `iPad App Redesign.html`. The written spec is
> `design_handoff_globeskimmers_redesign/CLAUDE_CODE_IPAD_BUILD.md`, and corrected
> markup for the flag card and Places to Eat is in `FIX_FLAG_AND_PLACES_TO_EAT.md`.
> Open all three and follow them precisely.
>
> **Scope:** Replace ONLY the presentation layer (HTML/JSX + CSS). Do **not** change
> my app logic, data fetching, Workers/API calls, navigation, or state. Same data
> in — new look out. If a screen's data shape differs from the mockup's sample
> content, keep my real data and just restyle it.
>
> **Global rules — apply to every screen:**
> - Use ONLY these design tokens — no new colors or fonts:
>   ivory `#F6F1E7`, ivory2 `#EFE8D9`, card `#FFFFFF`; ink `#16110D`, ink2 `#3A3128`,
>   ink3 `#736657`; teal `#0E6E66`; category accents transit `#3551D1`, eat `#D8443C`,
>   coffee `#9C5A2C`, atm `#2E6FE0`, restroom `#0E7C73`, store `#2E7D46`, weather `#E0922F`.
> - Fonts: **Instrument Serif** for names/titles/hero (italic + teal or gold for accent
>   words), **Inter Tight** for UI/body, **JetBrains Mono** for kickers/labels (uppercase).
> - Layout: a single centered content column (~1024px on iPad) with generous padding —
>   never a phone-width column stranded on a wide canvas. Cards go full-width in that column.
> - Bottom nav is the floating dark pill (Home / Explore / Scan / Settings). Keep
>   `padding-bottom:170px` on every scroll area so it never covers the last card.
> - Implement the 4-step text scaling exactly as in the spec: every display/title size
>   is `calc(BASE * var(--fs))`, multipliers `[1, 1.18, 1.36, 1.55]`, driven by the 👓
>   button and the Settings text-size control, and persisted.
> - Photos: use real images where I supply them; keep drop-in placeholders for
>   attraction cards until I provide those assets. Home-country flag images come from
>   `https://flagcdn.com/w1280/{iso2}.png` (build the URL from the home country code).
>
> **Build in this order, matching the corresponding frame in `iPad App Redesign.html`:**
> 1. **Home** — greeting card (serif name, city italic+teal), Money Exchange gradient
>    hero, 2-up category tile grid (Transit, Nearby Restaurants, Coffee, ATM, Restroom,
>    Convenience Store; Weather full-width), Explore-More gradient cards.
> 2. **Home · Flag Active** — same as Home but the greeting becomes the flag cover card
>    from `FIX_FLAG_AND_PLACES_TO_EAT.md`. Rectangular flag as `background-size:cover`
>    backdrop + scrim + white serif name. **No flag circle, no blown-up emoji.**
> 3. **Places to Eat** — full-width editorial restaurant cards from
>    `FIX_FLAG_AND_PLACES_TO_EAT.md` (420px photo, rank badge, Dish-Specialist tag,
>    serif name, Say-it/Translate row, green open bar, blue phone bar, 3 buttons).
> 4. **Things to Do** — same finder header; 2-up photo attraction cards (`.agrid/.acard`):
>    serif title, rating, flight/drive travel badge, category badge, Directions/Website.
> 5. **Place / Activity Detail** — 560px hero photo, serif `60px` name, Say-it/Translate,
>    tags, ivory address block, open-hours bar, phone + website rows, action buttons.
> 6. **The finder screens** (reuse the Places-to-Eat header pattern + card styling, swap
>    the category accent color): **Coffee Finder** (coffee `#9C5A2C`), **ATM Finder**
>    (atm `#2E6FE0`), **Restroom Finder** (restroom `#0E7C73`), **Convenience Store**
>    (store `#2E7D46`), **Transit Info** (transit `#3551D1`).
> 7. **Money Exchange** — green gradient hero + conversion calculator + nearby-exchange list.
> 8. **Smart Price Scanner** and **Smart Text Scanner** — the purple-gradient intro
>    screens (icon tile, serif headline with italic accent, bullet list, CTA).
> 9. **Weather** — location card, current-conditions hero, daily forecast rows.
> 10. **Basic Phrases**, **Cultural Info**, **Shopping** — match their spec sections.
> 11. **Onboarding** — teal gradient, glassy globe tile, serif headline, country chips, CTA.
> 12. **Settings** — serif title, teal profile card, grouped rounded lists with mono labels.
>
> After each screen, compare side-by-side with its frame in `iPad App Redesign.html`
> and match spacing, font sizes, radii, and colors pixel-for-pixel. Ask me before
> inventing any content, section, or color that isn't in the spec.

---

### Tips for working with Claude Code on this
- Do it **one screen per message** if the app is large — paste the global rules once,
  then say "now do Home", review, "now do Places to Eat", etc. Smaller diffs = fewer mistakes.
- If a screen comes back wrong, point at the specific frame: *"compare to the
  'Coffee Finder' frame in iPad App Redesign.html — match the header and card exactly."*
- Keep me (the designer) in the loop: when Claude Code asks a design question it
  can't answer from the spec, bring it back to me rather than letting it guess.
