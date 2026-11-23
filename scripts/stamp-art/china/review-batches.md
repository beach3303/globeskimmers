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

## Running totals
Batches 9 · stamps 140 · concerns 2
