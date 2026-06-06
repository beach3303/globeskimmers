# App icon + splash screen masters

`@capacitor/assets` reads master images from this folder and auto-generates every iOS / Android icon and splash variant required by Xcode and Android Studio. **Don't edit the generated files directly** — they get overwritten on every regeneration.

## What to put here

| File | Size | Purpose |
|---|---|---|
| `icon-only.png` | **1024×1024** | App icon (the square Apple shows on the App Store, Google shows on the Play Store, and that ends up on the user's home screen). Should look readable down to ~60px — no thin text. |
| `icon-foreground.png` | **1024×1024** | Android adaptive icon foreground layer. The visual centerpiece (logo), centered with ~33% safe-area padding around it. |
| `icon-background.png` | **1024×1024** | Android adaptive icon background layer. A solid color or a soft gradient — NOT a detailed image. The system clips this with various mask shapes. |
| `splash.png` | **2732×2732** | Splash screen master. Image gets center-cropped per device aspect ratio. Put the brand mark in the center 30% — the edges WILL get cut off on tall phones. |
| `splash-dark.png` | **2732×2732** (optional) | Dark-mode splash. If absent, `splash.png` is used in both modes. |

## How to regenerate every icon + splash variant

After replacing any master file:

```bash
npm run assets
```

This runs `npx @capacitor/assets generate --iconBackgroundColor "#FFFCF7" --iconBackgroundColorDark "#0F1419"` against this folder and rewrites:

- `ios/App/App/Assets.xcassets/AppIcon.appiconset/*`
- `ios/App/App/Assets.xcassets/Splash.imageset/*`
- `android/app/src/main/res/mipmap-*/ic_launcher.*`
- `android/app/src/main/res/mipmap-*/ic_launcher_round.*`
- `android/app/src/main/res/mipmap-anydpi-v26/*`
- `android/app/src/main/res/drawable*/splash.png`

After regenerating, run `npx cap sync` to make sure both native projects pick up the new files.

## Current state (Phase 3, pre-launch)

The icons + splash currently shipping are the **default Capacitor placeholder** (purple Capacitor logo on grey). They MUST be replaced before App Store / Play Store submission — Apple and Google both reject default placeholder icons in app review.

## Design constraints (don't skip these — they're store-rejection causes)

- **Icon must NOT include the word "icon" or the App Store / Play Store badge.** Apple rejects.
- **Icon must NOT mimic native iOS / Android system icons** (Settings gear, Maps app, etc.). Apple rejects.
- **Icon must NOT use transparent backgrounds for iOS.** iOS renders icons with no alpha — anywhere transparent becomes black. Make the background opaque.
- **Android adaptive icon foreground needs ~33% padding** around the visual centerpiece. Otherwise the system mask can clip your logo on circle/squircle device themes.
- **Splash centerpiece must be inside the center 30%** of the 2732×2732 canvas — anything outside that gets cropped on at least one device aspect ratio.

## Recommended brand palette (already in use)

| Token | Hex | Where it shows up |
|---|---|---|
| IVORY | `#FFFCF7` | App background, splash background |
| TEAL_DEEP | `#0F7C73` | Brand accent, links |
| INK | `#0F1419` | Primary text |
| PURPLE | `#7C3AED` | Scanner accent, "anywhere" italic |

For consistency, the splash background should be IVORY (already configured in `capacitor.config.ts`).
