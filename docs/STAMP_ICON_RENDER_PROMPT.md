# Stamp button render — the prompt kit (matches the passport cover and the trunk)

For option C on the canvas ("3D stamp, flared top"; founder, 2026-11-01): one small photo-real
rubber stamp that stands on the bottom bar by itself, no circle behind it, with a flared,
flat-topped handle (not a round knob). Same pipeline as the trunk renders (ChatGPT/DALL·E or
Ideogram, best of 3–4 takes), NOT app-drawn. (Replaces option B of 2026-10-31, the cream disc with
a red ring; the bar's code changed with it.)

## How to run it
1. Paste the STYLE block into ChatGPT. One image per message.
2. Keep the best of 3–4 takes. Square, 2048 × 2048, **transparent background** (ask for a PNG with
   no background; if it won't, ask for a plain white background and cut it out).
3. Check it small before choosing: shrink it to 64 × 64 px on your phone screen. The flat top, the
   handle and the red rubber must still read as a stamp. If it turns into a blob, pick a take with
   a chunkier silhouette.
4. Export `stamp-button@3x.png` at 192 × 192 px and `stamp-button@2x.png` at 128 × 128 px (it shows
   at 64 × 64 on the bar).
5. Upload it the way the trunk was uploaded and tell Claude Code the file name, so the
   Stamp button uses it, with the flat line stamp kept as the fallback while it loads.

## STYLE
> A single photorealistic vintage rubber stamp, the classic office kind, shown in a gentle
> three-quarter view from slightly above so the flat top of the handle, the turned wooden handle
> (slim at the waist and flaring out to a wide, flat, slightly bevelled top, like a classic office
> stamp; NO round knob or ball),
> a thin polished brass collar and the rectangular wooden block with its red rubber base are
> all visible. Warm walnut wood with fine visible grain and a soft satin finish; the rubber is a
> deep brick red (#B0472F) with a slightly matte, rubbery texture. Soft key light from the upper
> left, the same warm, dignified lighting as a luxury product photograph, small specular
> highlights on the flat top of the handle and the brass. The object is centred and fills about 80% of a square
> frame. Chunky, simple silhouette that still reads when tiny. Completely clean: no text, no
> logo, no ink marks, no paper, no hands, no props. Transparent background, no shadow on a floor.

## Don'ts
- No round knob or ball on top: the handle ends flat.
- No ink pad, no stamped paper, no motion blur (it must read at 64 px).
- No cartoon or clay style; it belongs with the photo-real passport cover and trunk.
- Don't recolor the rubber: it's the house stamp red.

## Where it goes (the wiring, for whoever uploads)

The bar asks the API worker for the render the way the Profile asks for the trunk: the files live in
the `globeskimmers-media` bucket under `stamp-art/ui/`, served at
`https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/ui/…`. The worker refuses `@` in a file
name, so the objects are named with a dash (`stamp-button-2x.png`, `stamp-button-3x.png`) whatever
the exports are called. The two one-liners, from the folder holding the exports:

```bash
npx wrangler r2 object put globeskimmers-media/stamp-art/ui/stamp-button-2x.png --file=./stamp-button@2x.png --content-type=image/png --remote
npx wrangler r2 object put globeskimmers-media/stamp-art/ui/stamp-button-3x.png --file=./stamp-button@3x.png --content-type=image/png --remote
```

No OTA and no store build: the bar probes the @2x file once per launch (`useStampArt` in
`src/components/redesign/FloatingNav.jsx`) and shows the render, 64 × 64 on a transparent slot
raised above the pill, the moment it loads; until then, and whenever the file is missing, the flat
version (the stamp-red disc with the lucide `Stamp` glyph). The worker caches each file for 30 days, so to
redo the art later upload under new names (`stamp-button-v2-2x.png`…) and tell Claude Code, who
points the bar at them.
