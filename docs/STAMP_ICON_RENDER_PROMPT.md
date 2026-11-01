# Stamp button render — the 3D rubber stamp in the bar

Founder decision, 2026-10-31 (navigation redesign, option B): the raised centre button of the bottom bar
shows a photo-real rubber stamp, not a camera, because the button doesn't open the camera. Until the
render exists the app shows the flat version (a stamp-red disc with the lucide `Stamp` glyph), and it
switches to the render on its own the moment the files are on the website.

## The files

| File | Size | Notes |
|---|---|---|
| `site/img/stamp-button@2x.png` | 80 × 80 px | transparent background |
| `site/img/stamp-button@3x.png` | 120 × 120 px | transparent background |

Both are the same picture at two pixel densities. Commit them under `site/img/` and push: the website
Action ships them, and every phone picks them up on its next launch — no OTA and no store build. The bar
tries `https://globeskimmers.io/img/stamp-button@2x.png` once per launch; a 404 means "flat version".

The stamp sits inside a 58 px cream disc (`#FBF6EC`) with a 3 px stamp-red ring (`#B0472F`), drawn at
40 × 40 CSS px. Leave about 4 px of empty margin inside the image on every side so the handle never
touches the ring.

## The prompt (ChatGPT image generation, or any image model)

> A single photo-realistic rubber stamp, the kind used on a passport page, seen from a three-quarter
> angle slightly above. A turned wooden handle in warm natural oak with a soft satin finish, a thin
> black rubber-mount base, and a deep red (#B0472F) rubber die on the bottom with a faint ink sheen.
> No text, no logo, no paper, no ink mark, no shadow on the ground. Soft studio lighting from the top
> left, gentle highlights on the handle, crisp edges. Centered, filling about 80% of the frame,
> isolated on a fully transparent background (PNG with alpha). Square image. Style: product photo,
> true to life, not a cartoon, no outline strokes.

Ask for a 1024 × 1024 PNG with a transparent background, then scale it to 120 × 120 (the @3x file) and
80 × 80 (the @2x file) with a quality resampler (Preview → Tools → Adjust Size, or `sips -z 120 120`).
Check both against the dark bar: the handle should read as wood, the die as the app's stamp red, and
nothing should be clipped by the round disc.

## Why not bundle it in the app

The render is art that may be redrawn; serving it from the website lets it change without an OTA. The
code path is in `src/components/redesign/FloatingNav.jsx` (`useStampArt`).
