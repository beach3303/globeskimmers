// One-time generator for placeholder app icon + splash screen images.
//
// Output (writes into ./resources/, which @capacitor/assets reads):
//   icon-only.png        1024x1024  app icon master
//   icon-foreground.png  1024x1024  Android adaptive icon foreground (padded)
//   icon-background.png  1024x1024  Android adaptive icon background (solid ivory)
//   splash.png           2732x2732  splash screen master
//   splash-dark.png      2732x2732  dark-mode splash
//
// After running this script, generate every platform-specific size with:
//   npm run assets
// Then sync to native projects:
//   npm run cap:sync
//
// To replace these placeholders with a real designed icon, just drop the
// final 1024x1024 PNG over resources/icon-only.png (and likewise for the
// others) and re-run the two commands above. Do NOT modify the generated
// files inside ios/App/.../AppIcon.appiconset/ or android/.../mipmap-*/
// directly — those get clobbered on the next `npm run assets`.
//
// Brand palette (matches src/components/redesign/constants):
//   IVORY      #FFFCF7
//   TEAL_DEEP  #0F7C73
//   TEAL_BRIGHT #05BFDB
//   INK        #0F1419

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'resources');
mkdirSync(OUT, { recursive: true });

const IVORY     = '#FFFCF7';
const TEAL_DEEP = '#0F7C73';
const INK       = '#0F1419';

// ─── SVG designs ─────────────────────────────────────────────────────
// Icon mark — italic serif "G" centered on ivory. The mark reads as
// "Globeskimmers" without the full wordmark needing to fit at 60px
// (the smallest size Apple/Google actually render). The serif italic
// also matches the in-app accent typography (e.g. "anywhere." on the
// Price Scanner intro, "instantly." on the Text Scanner intro).
//
// Why a single letter vs a full wordmark: at 60-180px (the home screen
// sizes), full wordmarks are illegible. Single bold letters are the
// industry-standard pattern (Gmail M, Notion N, Pinterest P, etc.).
const iconSvg = (size, padding = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${IVORY}"/>
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="Georgia, Times New Roman, serif"
    font-style="italic"
    font-weight="bold"
    font-size="${(size - padding * 2) * 0.7}"
    fill="${TEAL_DEEP}"
  >G</text>
</svg>
`;

// Splash — same G but smaller (fits in center 30% so it survives the
// per-device center-crop), with a faint "Globeskimmers" wordmark below
// for brand recognition while the JS bundle parses.
const splashSvg = (bgColor, fgColor, accentColor) => `
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="${bgColor}"/>
  <g>
    <text
      x="50%"
      y="48%"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="Georgia, Times New Roman, serif"
      font-style="italic"
      font-weight="bold"
      font-size="540"
      fill="${accentColor}"
    >G</text>
    <text
      x="50%"
      y="62%"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
      font-weight="600"
      font-size="120"
      letter-spacing="6"
      fill="${fgColor}"
    >Globeskimmers</text>
  </g>
</svg>
`;

async function renderToPng(svg, outPath) {
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

async function solidColor(color, size, outPath) {
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: color,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

(async () => {
  console.log('Generating placeholder assets in', OUT);

  // 1) icon-only.png — primary icon master (square, opaque). Apple uses
  //    this on iOS, Google uses this for the legacy launcher.
  await renderToPng(iconSvg(1024, 0), join(OUT, 'icon-only.png'));

  // 2) icon-foreground.png — Android adaptive icon foreground layer.
  //    Same mark but with ~22% padding around all sides so the system
  //    mask (which can be circle, squircle, teardrop, or rounded
  //    square depending on the user's launcher theme) doesn't clip
  //    the G. Apple ignores this file.
  await renderToPng(iconSvg(1024, 220), join(OUT, 'icon-foreground.png'));

  // 3) icon-background.png — solid IVORY layer Android composites
  //    BEHIND the foreground. Keeping it flat (not a gradient) means
  //    the mask never produces awkward color seams.
  await solidColor(IVORY, 1024, join(OUT, 'icon-background.png'));

  // 4) splash.png — light-mode splash master (2732x2732).
  await renderToPng(splashSvg(IVORY, INK, TEAL_DEEP), join(OUT, 'splash.png'));

  // 5) splash-dark.png — dark-mode splash master. Inverted palette so
  //    the splash is readable when the device is set to dark mode at
  //    launch. The runtime app doesn't have a dark-mode design yet,
  //    so this only affects the launch frame.
  await renderToPng(splashSvg(INK, IVORY, '#05BFDB'), join(OUT, 'splash-dark.png'));

  console.log('Done. Next:');
  console.log('  npm run assets    # generates all iOS/Android variants');
  console.log('  npm run cap:sync  # pushes them to native projects');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
