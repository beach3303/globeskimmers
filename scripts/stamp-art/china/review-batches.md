# China stamps — batch log and the concerns list (started 2026-11-22)

The founder draws the China list (611 places) in Grok and pastes the stamps here in batches; 500+ to come. Her instruction
2026-11-22: process every batch, hold the review, and when she says she is done give ONE list of the stamps with
copyright / trademark concerns, which she then asks Grok to modify. Each batch: trim the baked-in black frame, copy to
~/Desktop/Stamp inbox named after the place, `python3 scripts/stamp-art/intake.py --country China --pad`, add the rows
here. Nothing is uploaded until she runs upload.sh.

What counts as a concern (the rule she set for the Olympic venues — "let's not copy the logo so we don't get a lawsuit"):
a company or event logo or wordmark drawn in (Universal globe, Disney castle silhouette / Mickey ears, Chimelong, Tsingtao,
Olympic rings, team crests), a character or mascot (Minions, Harry Potter, Bing Dwen Dwen, pandas are fine), a recognizable
living person or a political portrait, a copyrighted artwork reproduced as the whole stamp (a specific sculpture, mural,
poster), brand signage legible in the scene. Buildings, landscapes, generic signs and the place's own name are fine.

## Batch 1 — Beijing — 2026-11-22 20:00 — 19 stamps (list 005–018, 020–024; 019 Wangfujing Street not drawn)
Squared and matched; upload.sh + d1-batch-1-beijing.sql handed to the founder.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| 017 | Universal Beijing Resort | **trademark** — the Universal globe is the whole centrepiece | the entrance globe is a real landmark, but it is their mark; a redraw could show the resort gate / Jurassic gate / the skyline of the park without the globe |

Not concerns, cosmetic only (optional redraws): 008 Lama Temple and 023 Beijing Zoo — faint ghost digits behind the number.
Resolution: this batch came in at ≈800 px and was scaled up to 1254²; larger originals would be crisper.

## Batch 2 — Beijing — 2026-11-22 20:30 — 11 stamps (019, 025–034)
Squared and matched (paste-batch.py → intake). No concerns.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| — | — | none | 019 Wangfujing: the department store's own name sign (王府井百货大楼) and the rickshaw-puller bronze are the street's real fixtures, not a brand mark — no action. 034 Happy Valley: themed areas (Maya pyramid, Aegean temple), no park logo. 030 Water Cube: building only, no rings. |

Rows still needed from this batch (into the end-of-run SQL): Juyongguan, Wangfujing, Panjiayuan, Huanghuacheng (all in d1-world-rows.sql), Marco Polo Bridge (hand pin).

## Batch 3 — Beijing outskirts, Tianjin, Hebei — 2026-11-22 20:50 — 20 stamps (035–054)
Squared and matched. No concerns.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| — | — | none | 036 CCTV Headquarters: the building only, no broadcaster logo (the place's name is the building's name). 035 Sanlitun: no shop signs. 053 Zhaozhou Bridge: a small lattice tower in the far background that isn't there in life — accuracy only, optional. |

Rows still needed from this batch: Beidaihe Beach, Shanhaiguan Old Dragon's Head, Tianjin Porcelain House (hand pins);
CCTV HQ, Chengde, Five Great Avenues, Jinshanling, Longqing Gorge, NCPA, Puning, Putuo Zongcheng, Sanlitun, Tianjin Eye,
Zhaozhou Bridge, Zhengding Longxing (all in d1-world-rows.sql).

## Batch 4 — Shanghai (+ 055 Xibaipo, Hebei) — 2026-11-22 21:10 — 19 stamps (055, 058–076; 056–057 and 066 not in this batch)
Squared and matched. ONE concern.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| 060 | Shanghai Disneyland | **trademark** — the Enchanted Storybook Castle is the centrepiece; Disney treats the castle silhouette as its mark (it is their logo) | a redraw could show the resort entrance gates, the lake and gardens with the castle small and far, or the Mickey Avenue streetscape without characters — the park's name alone is fine |

Not concerns: 074 Shanghai Ocean Aquarium (generic tunnel, no logo); 062 Lujiazui and 058 Shanghai Tower (skyline only); 072 Jing'an Temple (the skyline behind is fine).
Rows still needed from this batch: Qibao Ancient Town, Zhujiajiao Water Town (hand pins); Former French Concession, Lujiazui, Nanjing Road, Shanghai Disneyland, Shanghai Ocean Aquarium, Tianzifang, Xibaipo, Xintiandi (all in d1-world-rows.sql).

## Running totals
Batches 4 · stamps 69 · concerns 2
