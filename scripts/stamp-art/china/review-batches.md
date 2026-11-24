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

## Batch 5 — Shanghai — 2026-11-22 21:25 — 11 stamps (077–087)
Squared and matched. No concerns.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| — | — | none | 079 M50: the mural is an invented swirl, not a real artist's work — fine. 086 Haichang: orca + dolphin, no park logo. 087 Thames Town: a British phone box is a generic object. 085 Science & Tech Museum: the orange ring is her frame, not a logo. |

Rows still needed from this batch: 1933 Old Millfun, Fuxing Park, M50, Haichang, Wild Animal Park, Thames Town, Wukang Mansion (all in d1-world-rows.sql).

## Batch 6 — Jiangsu (Nanjing, Suzhou, Yangzhou) — 2026-11-22 21:40 — 20 stamps (088–098, 100–103, 105–110; 099 and 104 not in this batch)
Squared and matched. No concerns.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| — | — | none | 098 Nanjing Massacre Memorial Hall: the "Family Ruined" sculpture is drawn, but a stamp of a memorial is a depiction of a public monument, not a reproduction sold as the artwork — fine; keep the tone sober as it is. 103 Jinji Lake: the Gate to the East is a building. 109 Niushou: the Usnisa Palace domes are architecture. |

Rows still needed from this batch: Shantang Street (hand pin); Jinji Lake, Niushou Mountain, Purple Mountain, Tongli, Zhouzhuang (all in d1-world-rows.sql).
Cosmetic: 096 Confucius Temple of Nanjing — the "Art 2026" at the foot sits on a dark smudge; 102 Tongli — "Art 2026" is in a pale box bottom-right. Optional redraws only.

## Batch 7 — Jiangsu + Hangzhou — 2026-11-22 21:55 — 10 stamps (111–116, 118, 120–122; 117 and 119 not in this batch)
Squared and matched. No concerns.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| — | — | none | 116 Changzhou Dinosaur Park: generic dinosaurs and the dome, no park mascot/logo. 113 Three Kingdoms City: a film set, drawn as a generic walled gate. 118 Lingyin: the laughing Buddha is traditional iconography. |

Rows still needed from this batch: Ge Garden, Hefang Street, Longjing Tea Plantations, Three Kingdoms City (hand pins); Changzhou Dinosaur Park, Jinshan Temple, Taihu Lake, Yuantouzhu (all in d1-world-rows.sql).
Cosmetic: 111 Yuantouzhu — "Art 2026" in a pale box bottom-right (same as 102 Tongli). Optional.

## Batch 8 — Zhejiang — 2026-11-22 22:05 — 10 stamps (123, 125–133; 124 not in this batch). 13 files pasted, 3 were exact repeats (Songcheng, Xitang, Qiandao Lake).
Squared and matched. No concerns.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| — | — | none | 127 Songcheng: the park's buildings and a generic costumed show, no park logo. 128 Hengdian World Studios: a clapperboard and a generic camera, no studio mark. 126 Putuoshan: the Guanyin statue is a public religious monument. |

Rows still needed from this batch: Lu Xun's Hometown (hand pin); Hangzhou Grand Canal, Putuoshan, Qiandao Lake, Six Harmonies Pagoda, Songcheng, Xitang (all in d1-world-rows.sql).
Cosmetic: 131 Hangzhou Grand Canal — "Art 2026" in a pale box. Optional.

## Batch 9 — Zhejiang, Anhui, Xi'an — 2026-11-22 22:20 — 20 stamps (135–141, 144–152, 154, 156–158; 134, 142, 143, 153, 155 not in this batch)
Squared and matched. No concerns.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| — | — | none | 157 Muslim Quarter: shop signboards are blank colour blocks, no legible brands — fine. 156 Big Wild Goose Pagoda: a Canada goose, not the local species — accuracy only, optional. 148 Mount Qiyun: a seated figure in a shrine niche, generic religious statue. |

Rows still needed from this batch: Baohe Park, Huizhou Ancient City, Tangyue Memorial Archways, Tunxi Old Street (hand pins); Langya Mountain, Mount Jiuhua, Shenxianju, South Lake, Tiantai Mountain, Xidi, Zhujiajian (all in d1-world-rows.sql).
Cosmetic: 148 Mount Qiyun — "Art 2026" is broken ("Art 2  026"). Optional.

## Batch 10 — the zip drop (everything) — 2026-11-23 — 562 stamps
The founder exported the whole run from Grok as zips in ~/Downloads: `subtle_fixes_01…46.zip` (inner folders batch01–batch46,
re-renders of 001–489 with small fixes — the 19:51 `subtle_fixes_01 (3)` supersedes the 11:58 copies) and
`china_stamps_batch47…58.zip` (490–611). 562 PNGs, every file already named with the list's own file name, transparent
background (~850–1150 px). They replace the 140 pasted stamps (batches 1–9, kept in the session scratchpad). Squared with
sharp (`square.mjs`, background stays clear), all 562 matched exactly; contact sheets (`contact-sheets.mjs`, 47 sheets) read
end to end.

**Not in the drop (49):** 31 famous places that already have art from the world set (Great Wall, Forbidden City, Temple of
Heaven, Summer Palace, The Bund, Oriental Pearl Tower, West Lake, Huangshan, Hongcun, Terracotta Army, Mount Hua, Pingyao,
Yungang, Hanging Temple, Longmen, Mount Tai, Chengdu Panda Base, Leshan, Jiuzhaigou, Mount Emei, Lijiang, Stone Forest,
Yuanyang, Li River, Reed Flute Cave, Detian Falls, Mount Wuyi, Fenghuang, Mogao, Zhangye Danxia, Zhangjiajie NFP);
**batch 53 (552–561, Tibet: Drepung, Tashilhunpo, Everest Base Camp, Mount Kailash, Norbulingka, Ganden, Samye, Lulang,
Basum Tso, Yarlung Tsangpo) has no zip in Downloads**; and 8 never came out of Grok (066 People's Square, 090 Lingering
Garden, 099 Lingshan Grand Buddha, 104 Hanshan Temple, 119 Leifeng Pagoda, 124 Wuzhen, 134 Yandang Mountain, 343 Danxia
Mountain — their batch folders hold 8–9 files).

**Already live from the world set, redrawn here:** 546 Potala Palace, 547 Jokhang Temple. The live files are backed up in
`replaced-live/`; the new ones sit in `hold.json` until the founder picks (comparison sheet shown 11-23). If she takes the
new ones: remove them from hold.json, add both to REDRAWN "2026-11-22" in src/lib/stampArt.js, re-run intake.

| No. | Stamp | Concern | Note |
|---|---|---|---|
| 017 | Universal Beijing Resort | **trademark** — still the Universal globe (the zip version is a re-render, same centrepiece) | redraw without the globe: the gate, the Jurassic gate, the skyline of the park |
| 060 | Shanghai Disneyland | **trademark** — still the Enchanted Storybook Castle silhouette with fireworks | redraw: the lakeside, the Mickey-less gardens, a parade float without characters, or the park's gate |
| 602 | Discoveryland (Dalian) | **castle silhouette, softer case** — the park's own castle copies the Disney one; the stamp's blue-turreted castle reads as the same shape | optional redraw: the ferris wheel and carousel without the castle |
| 429 | Orange Isle (Changsha) | **political portrait — founder's call, not copyright** — the 32 m Young Mao Zedong sculpture (2009) is the island's landmark; outdoor public art may be reproduced under PRC copyright law, but the stamp is a political portrait | keep (it is what the place is) or redraw: the island tip, the orange groves, the fireworks |

Not concerns, noted: 373 Fisher Girl Statue (1982 public sculpture, the city's own emblem — outdoor art, fine); 348 Window of
the World (replicas of the Eiffel Tower, Arc de Triomphe, pyramids — the park's real exhibits, public-domain monuments);
350 / 344 / 345 Chimelong (the park name only, no logo); 212 Tsingtao Beer Museum (a generic mug, no Tsingtao mark);
411 Atlantis Sanya (the building silhouette only); 262 Jianmen Pass (a torch shape, not the Olympic torch); 356 Sun Yat-sen
Memorial Hall and 438 Shaoshan (buildings only, no portraits); 399 Meizhou Island (the Mazu statue, religious monument).

Cosmetic, optional: 156 Big Wild Goose Pagoda still a Canada goose; a run of shapes are animals that do not live in China
(475 toucan, 479 bulldog, 481 kiwi, 433 kangaroo, 445 raccoon, 450 armadillo, 440 skunk, 439 walrus, 411 sea otter,
448 anteater, 435 crocodile, 608 puffin) — the founder chose varied shapes for China, so these stay unless she minds.

Rows: see `d1-china-stamps.sql` + `review-rows.txt` (resolve_rows.py, 11-23) — one SQL for every promotion and insert,
hand pins listed at its head.

## The concerns list (for the founder, 2026-11-23)
1. **017 Universal Beijing Resort** — the Universal globe. Redraw without it.
2. **060 Shanghai Disneyland** — the castle. Redraw without it.
3. **602 Discoveryland, Dalian** — a Disney-shaped castle. Softer case; redraw if you want to be safe.
4. **429 Orange Isle, Changsha** — the Young Mao sculpture. Not a copyright problem; a political portrait, your call.
Everything else is clear.

## Running totals
Batches 10 · stamps 562 (the zip drop replaces the 140 pasted) · concerns 2 firm + 1 soft + 1 founder's call
