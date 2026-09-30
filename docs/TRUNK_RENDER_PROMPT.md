# Trunk renders — the locked prompt kit (matches the passport cover)

The bar (founder, 2026-09-29): the passport cover is photo-real — deep navy leather
grain, gold foil serif, soft studio light. The trunk must be its sibling: generated in
the same pipeline (ChatGPT/DALL·E or Ideogram, best of 3–4 takes), NOT app-drawn.
Labels/stickers are never baked in — the app composites them on top so they stay
draggable and keep their stories.

## How to run it
1. Paste the STYLE block + one MATERIAL line into ChatGPT. One image per message.
2. Keep the best of 3–4 takes. Portrait ~1200×1600 or square 2048.
3. Name it `trunk-<material>-front-v1.jpg` and upload:
   `npx wrangler r2 object put globeskimmers-media/stamp-art/trunk-steamer-front-v1.jpg --file=./trunk-steamer-front-v1.jpg --remote`
4. Tell Claude — the profile mockup gets rebuilt around the real image, labels on top.

## STYLE (identical for every trunk)
> A photorealistic vintage steamer trunk, photographed perfectly straight-on, filling
> ~85% of a portrait frame, against a deep neutral charcoal studio backdrop with gentle
> vignette. Soft key light from the upper left — the same warm, dignified lighting as a
> luxury product photograph. Fine visible material grain, aged solid-brass corner caps,
> rivets and a central brass lock plate with keyhole, each with small specular
> highlights; two stitched bridle-leather straps with brass buckles; subtle honest wear
> on the edges. Completely CLEAN surfaces — no labels, no stickers, no text, no logos,
> no monogram, no people. Muted warm color grade, shallow film-like contrast, soft
> realistic ground shadow.

## MATERIALS (swap one line in)
- **Steamer (default):** body of deep navy waxed canvas with two oak wood battens
  across the front — the navy matched to a midnight-blue leather passport cover.
- **Cognac:** body of cognac full-grain leather with saddle stitching, no battens.
- **Midnight:** body of black bridle leather, brass edges, no battens.
- **Expedition:** body of hunter-green canvas with tan leather trim, no battens.

## Later (for the five-face spin)
v1 ships the front face only. When the spin builds, generate per material:
"the same trunk turned to show its left end", "…its lid from slightly above",
same style block — keep the seed/session so the trunk stays identical.
