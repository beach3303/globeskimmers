# Stamp merge — the map

Built 2026-10-08 by `node scripts/stamp-merge/build-map.mjs` from a read-only look at the live D1 `attractions` table. Nothing was changed anywhere: this is the plan the merge will follow once Apple approves the app. Re-run the script any time; it rebuilds every file here from the live data.

**Words used here.** A *group* is two or more rows in our places table that are really one place. The *canonical* (or survivor) is the one row we keep showing. An *alias* is a twin that gets hidden and forwards to the canonical, so every stamp, guestbook note, photo and shared link that names it keeps working. A *ghost* is an id that was deleted from the table but that art, film scenes or stamps still name. A *qid* is the place's Wikidata number (for example Q243 is the Eiffel Tower).

## Headline

| | |
|---|---|
| Wikidata ids shared by 2+ rows | 940 (1916 rows) |
| Extra twins found by name (same name, within 1.5 km) | 60 pairs |
| **Groups merged** | **930** |
| **Aliases** (rows that will forward to a survivor) | **972** |
| Ghost ids that will forward too | 44 |
| **Held for a person** (not merged) | **54** |
| Merged, but flagged to confirm | 79 |
| Skipped (every row banned for another reason) | 1 |
| Rows never merged: banned as a wrong Wikidata match | 6 |
| Rows never merged: a secret stamp | 1 |

## What travellers will see change

Compared with the row that is visible today:

- **840** groups: the visible row stays; its hidden twins start forwarding to it.
- **64** groups: two or more rows are visible today (the same place listed twice); one stays.
- **28** places are hidden completely today and come back (one row is un-hidden), 2 of them single rows whose twin was deleted.
- **0** groups: a different row takes over from the visible one.

So **92** survivors differ from what is visible today; the other 840 look exactly the same.

## Groups by id type

| Rows in the group | Groups |
|---|---|
| icon + wikidata | 473 |
| curated + wikidata | 297 |
| wikidata + auto | 68 |
| icon + curated | 30 |
| icon + curated + wikidata | 12 |
| icon×2 | 12 |
| icon×2 + wikidata | 7 |
| curated + wikidata + wv | 6 |
| icon + auto | 6 |
| curated×2 + wikidata | 5 |
| curated×2 | 3 |
| icon + curated×2 + wikidata | 2 |
| wikidata + wv | 2 |
| curated×2 + wikidata + wv | 2 |
| icon + curated + wikidata + wv | 1 |
| icon + wikidata + auto | 1 |
| icon + auto×2 | 1 |
| wv + auto | 1 |
| icon + wv | 1 |

Survivors by id type: icon 546, wikidata 262, curated 121, wv 1.

## What survivors inherit from their twins

Only empty fields are filled; founder choices are never overwritten.

| Field | Survivors | Rule |
|---|---|---|
| place_id | 473 | the twins' link to our own places database, when the survivor has none and the twins agree |
| category | 160 | a specific category (museum, palace…) replaces "landmark" / "experience" |
| footprint_radius_m | 137 | stamp radius grows so anyone standing where a twin could be stamped still can |
| popularity | 99 | the highest of the group |
| rating | 77 | Google rating from a twin |
| free_to_visit | 74 | set to free when a twin says free (never on a hand-curated survivor) |
| why_visit | 36 | "Why visit" text, copied from the twin with the longest one |
| description | 36 | description, same way |
| class_ban | 28 | un-hide a survivor that is hidden today |
| is_marquee | 20 | marquee if any twin is |
| founder_scope | 10 | the founder's scope from a twin, only when the survivor has none and the twins agree |

177 survivors keep a lower scope than one of their hidden twins (the twin's comes from automatic scoring, not the founder). The merge keeps the survivor's own scope; this is noted, not changed.

## The 30 most famous groups

| Survivor | Name | Forwards from | Today | Inherits |
|---|---|---|---|---|
| `curated:france-paris-eiffel-tower` | Eiffel Tower | `wikidata:Q243`, `icon:Q243` (deleted) | un-hidden | category landmark → monument; place link; un-hide |
| `curated:india-taj-mahal` | Taj Mahal | `icon:Q9141` (deleted) | un-hidden | un-hide |
| `curated:france-paris-louvre` | Louvre | `curated:france-paris-louvre-museum`, `wikidata:Q19675`, `wv:paris-the-louvre`, `icon:Q19675` (deleted) | un-hidden | category landmark → museum; place link; why_visit ← curated:france-paris-louvre-museum (148 chars); description ← curated:france-paris-louvre-museum (220 chars); un-hide; radius 250 m → 260 m |
| `icon:Q9202` | Statue of Liberty | `curated:united-states-new-york-city-statue-of-liberty`, `wikidata:Q9202` (deleted) | same row stays | category landmark → monument; why_visit ← curated:united-states-new-york-city-statue-of-liberty (93 chars); description ← curated:united-states-new-york-city-statue-of-liberty (171 chars) |
| `curated:turkey-istanbul-hagia-sophia` | Hagia Sophia | `wikidata:Q12506` | same row stays | place link |
| `icon:Q676203` | Machu Picchu | `wikidata:Q676203` | same row stays | category landmark → historic; place link |
| `curated:italy-rome-colosseum` | Colosseum | `wikidata:Q10285`, `icon:Q10285` (deleted) | un-hidden | un-hide |
| `icon:Q35525` | The White House | `wikidata:Q35525` | same row stays | place link |
| `icon:Q43473` | Angkor Wat | `wikidata:Q43473` | same row stays | place link |
| `icon:Q12512` | St. Peter's Basilica | `curated:italy-rome-st-peter-s-basilica`, `wikidata:Q12512` | same row stays | place link |
| `curated:france-paris-notre-dame-cathedral` | Notre-Dame Cathedral | `curated:france-paris-notre-dame-de-paris`, `wikidata:Q2981`, `wv:paris-notre-dame-cathedral`, `icon:Q63167656` (deleted) | un-hidden | un-hide |
| `curated:france-paris-musee-d-orsay` | Musee d'Orsay | `curated:france-paris-mus-e-d-orsay`, `wikidata:Q23402` | same row stays | place link |
| `icon:Q39054` | Leaning Tower of Pisa | `wikidata:Q39054` | same row stays | category landmark → historic; place link |
| `icon:Q351` | Yellowstone National Park | `curated:united-states-yellowstone-national-park` | same row stays | why_visit ← curated:united-states-yellowstone-national-park (126 chars); description ← curated:united-states-yellowstone-national-park (240 chars); radius 6.0 km → 20 km |
| `curated:united-states-grand-canyon` | Grand Canyon | `wikidata:Q118841` | same row stays | — |
| `icon:Q44440` | Golden Gate Bridge | `auto:united-states-san-francisco-golden-gate-bridge` | same row stays | category landmark → historic; rating ∅ → 4.8 |
| `icon:Q48435` | Sagrada Família | `curated:spain-barcelona-sagrada-familia`, `wikidata:Q48435` | same row stays | place link; why_visit ← curated:spain-barcelona-sagrada-familia (122 chars); description ← curated:spain-barcelona-sagrada-familia (214 chars) |
| `curated:united-kingdom-london-the-british-museum` | The British Museum | `curated:united-kingdom-london-british-museum`, `wikidata:Q6373` | same row stays | place link |
| `curated:saudi-arabia-mecca-masjid-al-haram` | Masjid al-Haram | `wikidata:Q428858` | same row stays | — |
| `curated:france-paris-palace-of-versailles` | Palace of Versailles | `wikidata:Q2946`, `icon:Q2946` (deleted) | un-hidden | place link; un-hide |
| `icon:Q12192963` | Al-Aqsa Mosque | `wikidata:Q425281` | 2+ visible → 1 | is_marquee 0 → 1 |
| `icon:Q41116` | Red Square & the Kremlin | `wikidata:Q41116` | same row stays | — |
| `icon:Q36332` | Iguazu Falls (Brazil side) | `wikidata:Q36332` | same row stays | category landmark → waterfall; place link |
| `icon:Q42798` | Borobudur | `wikidata:Q42798` | same row stays | place link |
| `curated:australia-sydney-sydney-opera-house` | Sydney Opera House | `wikidata:Q45178`, `icon:Q45178` (deleted) | un-hidden | place link; un-hide |
| `curated:united-kingdom-london-buckingham-palace` | Buckingham Palace | `wikidata:Q42182`, `icon:Q42182` (deleted) | un-hidden | place link; un-hide |
| `icon:Q4152` | Neuschwanstein Castle | `wikidata:Q4152` | same row stays | category landmark → historic; place link |
| `icon:Q134140` | Abu Simbel Temples | `wikidata:Q134140` | same row stays | — |
| `curated:united-kingdom-london-westminster-abbey` | Westminster Abbey | `wikidata:Q5933` | un-hidden | category landmark → religious; place link; un-hide; radius 250 m → 510 m |
| `wikidata:Q2943` | Cappella Sistina | `curated:italy-rome-sistine-chapel` | same row stays | — |

## Held for a person (54)

These groups are **not** merged; they stay exactly as they are today. Full rows and suggestions are in `data/needs-human.json`.

**Ban conflict: un-hiding would override a class rule (1)**

- `Q160659` — No row is visible today, and keeping one would override a class ban (banned:ride) that the founder's own scope contradicts.

**Two different places under one Wikidata id (4)**

- `Q18157` — The visible row is a church in Djerba, Tunisia; the hidden twin is St. Nicholas Greek Orthodox Church in New York. Different places.
- `Q186106` — 'South Beach' (icon) and 'Española Way' (a street in South Beach) share one Wikidata id; the icon's own id says it is a different entity.
- `Q841506` — Villa Borghese gardens (visible) and Galleria Borghese museum (hidden, founder said national) are two different places under one Wikidata id.
- `Q913672` — The visible row is 'SFMOMA — Artists Gallery' at Fort Mason, 3.6 km from the real SFMOMA (the hidden auto row). Two different places share one Wikidata id.

**Rows too far apart to be one place (30)**

- `Q1047206` — Rows are 95 km apart (Siavonga, Zambia / Kariba, ZM): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q1109031` — Rows are 739 km apart (Bogotá, Colombia / Santa Marta, CO): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q1137661` — Rows are 28 km apart (Gračanica, Kosovo / Gračanica (Kosovo), XK): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q116761383` — Rows are 2260 km apart (Marshfield, US / Calgary, Canada): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q12597` — Rows are 1303 km apart (Havana, Cuba / Masaya, NI): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q1510436` — Rows are 8.2 km apart (Mulanje, Malawi / Mount Mulanje, MW): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q15523` — Rows are 8385 km apart (Como, Italy / Hamilton (Montana), US): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q157603` — Rows are 167 km apart (Cuiabá, Brazil / Santa Cruz (department, Bolivia), BO): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q187197` — Rows are 8.2 km apart (Te Anau, New Zealand / Fiordland National Park, NZ): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q192721` — Rows are 19 km apart (Ho Chi Minh City, Vietnam / Huyện Củ Chi, VN / XXVW+XJ, Vietnam): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q193325` — Rows are 31 km apart (Mary, Turkmenistan / Mongol Empire, MN): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q1984341` — Rows are 5.6 km apart (Hong Kong, Hong Kong / Hong Kong, HK): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q223726` — Rows are 336 km apart (Šiauliai, Lithuania / Hiiumaa, EE): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q2627029` — Rows are 8889 km apart (Fátima, Portugal / Tacámbaro, MX): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q2663377` — Rows are 1231 km apart (Mexico City, Mexico / Tulum, MX): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q305419` — Rows are 7005 km apart (Mexico City, Mexico / Santa Fe, AR): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q318678` — Rows are 5441 km apart (Gran Roque, Venezuela / San Sebastián de la Gomera, ES): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q3392` — Rows are 1694 km apart (Rutovu, Burundi / Jinja, UG): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q344570` — Rows are 40 km apart (San Ignacio, Belize / San Ignacio (Belize), BZ): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q36034` — Rows are 596 km apart (Huangshan, China / Zoucheng, CN): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q464257` — Rows are 18524 km apart (Normandy, France / Omaha, NZ): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q47141` — Rows are 72 km apart (San Pedro de Atacama, Chile / Biomes and ecosystems, US): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q47476` — Rows are 1591 km apart (Granada, Spain / Calais, FR): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q66085108` — Rows are 1550 km apart (Orlando, FL, US / Addison, US): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q7683479` — Rows are 14186 km apart (Menzies, AU / San Francisco, United States): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q770631` — Rows are 51 km apart (Kraków, Poland / Oświęcim, PL): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q7709620` — Rows are 11507 km apart (Lourdes, France / Iriga, PH): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q775056` — Rows are 16172 km apart (Culebra, Puerto Rico (US territory) / Dasol, PH): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q826551` — Rows are 8.4 km apart (Banaue, Philippines / Banaue, PH): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.
- `Q965776` — Rows are 6.1 km apart (Salento, Colombia / Armenia (Colombia), CO): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.

**A part listed under its parent's id (13)**

- `Q1123180` — A Wikivoyage listing called just 'Cathedral' sits under the Toledo Old City id.
- `Q1133309` — 'The Dubai Mall' (visible) carries the Wikidata id of the Dubai Aquarium inside it; the hidden twin is the aquarium.
- `Q18769666` — 'Castle Keukenhof' is a different building next to Keukenhof Gardens, under the gardens' id.
- `Q220289` — The 'Grand Canyon South Rim' icon carries the national park's Wikidata id; the hidden twin is the whole park. The rims are separate variant stamps.
- `Q2583112` — 'Camp Jurassic' is one area inside Universal Islands of Adventure, listed under the park's Wikidata id.
- `Q3229105` — 'Sea Life Aquarium' is a separate attraction next to Legoland Malaysia, listed under Legoland's Wikidata id.
- `Q338512` — 'Hotel Sidi Driss' (a Star Wars film location, has a film scene) is one building in Matmata, listed under the troglodyte houses' id.
- `Q3630402` — 'Dashashwamedh Ghat' is one ghat; the icon is all the Varanasi ghats.
- `Q423654` — 'Wat Traphang Thong' is one temple inside Sukhothai Historical Park, listed under the park's id.
- `Q487036` — 'Myeong-Dong Cathedral' and the Myeongdong district (icon) share one Wikidata id.
- `Q54495` — 'Bridge Climb' is a tour on the Sydney Harbour Bridge, not the bridge itself.
- `Q870844` — 'Sentosa Island' (hidden) is listed under the id of 'Siloso Beach', one beach on the island.
- `Q990128` — The 'Erawan Falls' icon carries the national park's Wikidata id; the hidden twin is the whole park, 3 km away.

**Two real sides (1)**

- `Q34221` — Niagara Falls: a Canada row, a US row and the US-side icon. Decide whether the two sides stay two stamps.

**Two real sites (2)**

- `Q177567` — The icon is the 'Manaus gateway' to the Amazon, 274 km from the rainforest row; its id (Q155) is Brazil's.
- `Q2266081` — Galleria Nazionale d'Arte Antica has two buildings (Palazzo Barberini and Palazzo Corsini), 2.3 km apart.

**Deleted ids with nothing to forward to (3)**

- `curated:australia-sydney-sydney-harbour-bridge` — curated:australia-sydney-sydney-harbour-bridge was deleted; its id has no Wikidata number to follow, and its art place doesn't point at one survivor. Named by: art-matches #68 Sydney Harbour Bridge.
- `film:Q7300572` — film:Q7300572 was deleted; its id has no Wikidata number to follow, and its art place doesn't point at one survivor. Named by: film_scenes.
- `film:Q852908` — film:Q852908 was deleted; its id has no Wikidata number to follow, and its art place doesn't point at one survivor. Named by: film_scenes.

## Merged, but please confirm (79)

**One row left out (too far); the rest merged (3)**

- `Q1045876` — Left out of the merge: 689 km from the survivor icon:Q1045876 (Chiang Rai, TH). The rest of the group merges. wikidata:Q1045876 — "Wat Phra Kaew" (Chiang Rai, TH) [duplicate]
- `Q181523` — Left out of the merge: 2466 km from the survivor icon:cerro-san-cristobal (San Juan de Lurigancho, PE). The rest of the group merges. wikidata:Q181523 — "Cerro San Cristóbal" (San Juan de Lurigancho, PE) [duplicate]
- `Q5004763` — Left out of the merge: 5.2 km from the survivor icon:Q5004763 (Đà Nẵng, VN). The rest of the group merges. wikidata:Q5004763 — "Ba Na Hill Station" (Đà Nẵng, VN) [duplicate]

**An icon that covers two places; its twin is one of them (28)**

- `Q1045876` — The icon 'Grand Palace & Wat Phra Kaew' covers more than one place; 'Wat Phra Kaew' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q12065255` — The icon 'Paphos Archaeological Park & Tombs of the Kings' covers more than one place; 'Paphos Archaeological Park' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q12244393` — The icon 'Hercules Caves & Cap Spartel' covers more than one place; 'Caves of Hercules' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q130958` — The icon 'Pyramids of Giza & Great Sphinx' covers two places; the twin is only the Sphinx.
- `Q1348507` — The icon 'Zócalo & Metropolitan Cathedral' covers two places; the twin is only the square.
- `Q172988` — The icon 'St. Mark's Square & Basilica' covers two places; the twin is only the basilica.
- `Q1822397` — The icon 'Menin Gate & Flanders Fields' covers more than one place; 'Menin Gate Memorial' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q182955` — The icon 'Vatican Museums & Sistine Chapel' covers more than one place; 'Vatican Museums', 'The Vatican Museum' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q189616` — The icon 'Ajanta & Ellora Caves' covers more than one place; 'Ellora Caves' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q1921137` — The icon 'Ciudad Vieja & Mercado del Puerto' covers more than one place; 'Mercado del Puerto' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q231606` — The icon 'Seville Cathedral & La Giralda' covers more than one place; 'Cathedral' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q2384491` — The icon 'Dubai Mall & Dubai Fountain' covers more than one place; 'The Dubai Fountain', 'Dubai Fountain' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q244952` — The icon 'The Last Supper (Santa Maria delle Grazie)' is the painting's refectory; the twin is the church.
- `Q2709506` — The icon 'Singapore Zoo & Night Safari' covers more than one place; 'Singapore Zoo', 'Singapore Zoo' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q2714250` — The icon 'Luxembourg Old Town & Bock Casemates' covers more than one place; 'The Bock' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q29466` — The icon 'Masjid al-Haram & the Kaaba' covers more than one place; 'Kaaba', 'Kaaba' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q3078443` — The icon 'Prizren Old Town & Fortress' covers more than one place; 'Fortress of Prizren' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q318181` — The icon 'Gobustan Rock Art & Mud Volcanoes' covers more than one place; 'Qobustan National Historical-Artistic Reserve' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q3320132` — The icon 'Christ Church Cathedral & Whalebone Arch' covers more than one place; 'Christ Church Cathedral' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q390306` — The icon 'Independence Hall & Liberty Bell' covers more than one place; 'Liberty Bell Center' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q41116` — The icon 'Red Square & the Kremlin' covers more than one place; 'Red Square' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q41225` — The icon 'Big Ben & Houses of Parliament' covers more than one place; 'Big Ben' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q493117` — The icon 'Fisherman's Bastion & Buda Castle' covers more than one place; 'Fisherman's Bastion' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q511933` — The icon 'Jökulsárlón Glacier Lagoon & Diamond Beach' covers more than one place; 'Jökulsarlon' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q52505` — The icon 'Grand Canal & Rialto Bridge' covers two places; the twin is only the bridge.
- `Q729370` — The icon 'Old Town Square & Astronomical Clock' covers more than one place; 'Prague Astronomical Clock', 'Astronomical Clock' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q74736` — The icon 'Riga Old Town & House of the Blackheads' covers more than one place; 'House of the Blackheads' is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.
- `Q842822` — The icon 'Icherisheher & Maiden Tower' covers the old town and the tower; the twin is only the tower.

**Possibly one place, but names and ids differ (not merged) (1)**

- `Q29247+Q731126` — Getty Center (the hilltop campus) and the J. Paul Getty Museum (the museum on it) both show, about 100 m apart. Names and Wikidata ids differ, so the automatic rules leave them apart; to merge, add the pair to NAME_PAIRS in this script and re-run.

**Founder scopes disagree inside the group (15)**

- `Q113639810` — Founder scopes disagree (icon:Q113639810: national; icon:kawasan-falls: world). The survivor keeps its own 'national'.
- `Q134883` — Founder scopes disagree (icon:Q134883: national; wikidata:Q134883: world). The survivor keeps its own 'national'.
- `Q1381933+Q18588998` — Founder scopes disagree (icon:Q18588998: national; wikidata:Q1381933: world). The survivor keeps its own 'national'.
- `Q15265` — Founder scopes disagree (icon:Q15265: national; wikidata:Q15265: world). The survivor keeps its own 'national'.
- `Q181523` — Founder scopes disagree (icon:cerro-san-cristobal: national; icon:Q181523: regional). The survivor keeps its own 'national'.
- `Q2536763` — Founder scopes disagree (icon:Q2536763: national; wikidata:Q2536763: world). The survivor keeps its own 'national'.
- `Q2709506` — Founder scopes disagree (icon:Q2709506: national; curated:singapore-singapore-singapore-zoo: world; wikidata:Q2709506: world). The survivor keeps its own 'national'.
- `Q271466` — Founder scopes disagree (icon:Q271466: national; wikidata:Q271466: world). The survivor keeps its own 'national'.
- `Q4200637` — Founder scopes disagree (icon:Q4200637: national; icon:tegallalang-rice-terraces: world). The survivor keeps its own 'national'.
- `Q464899` — Founder scopes disagree (icon:Q464899: national; icon:monte-alban: world). The survivor keeps its own 'national'.
- `Q550502` — Founder scopes disagree (icon:Q550502: national; wikidata:Q550502: world). The survivor keeps its own 'national'.
- `Q573558` — Founder scopes disagree (icon:Q573558: national; icon:vallee-de-mai: world). The survivor keeps its own 'national'.
- `Q7479348` — Founder scopes disagree (icon:beau-vallon-beach: national; icon:Q7479348: regional). The survivor keeps its own 'national'.
- `Q828336` — Founder scopes disagree (icon:Q828336: national; icon:sacsayhuaman: world). The survivor keeps its own 'national'.
- `Q851527` — Founder scopes disagree (icon:Q851527: national; icon:oceanographic-museum: world). The survivor keeps its own 'national'.

**Twin under class review (1)**

- `Q490981` — Bukchon Hanok Village: the hidden twin is under class review as a neighbourhood (review:Q123705); the icon row is live and wins. Confirm neighbourhoods stay stamps.

**Twins link to different owned places (2)**

- `Q28785` — The survivor has no owned-place link and its twins name 2 different ones; none was copied.
- `Q2981` — The survivor has no owned-place link and its twins name 2 different ones; none was copied.

**Stamp radius would grow by more than 1 km (15)**

- `Q1136776` — The stamp radius would grow from 250 m to 1.9 km to reach curated:united-states-new-york-cotton-club, 1.9 km away. Check that twin's coordinates.
- `Q1166159` — The stamp radius would grow from 250 m to 3.7 km to reach wikidata:Q1166159, 3.7 km away. Check that twin's coordinates.
- `Q15265` — The stamp radius would grow from 250 m to 1.3 km to reach wikidata:Q15265, 1.3 km away. Check that twin's coordinates.
- `Q179199` — The stamp radius would grow from 250 m to 1.6 km to reach wikidata:Q179199, 1.5 km away. Check that twin's coordinates.
- `Q188905` — The stamp radius would grow from 250 m to 2.3 km to reach wikidata:Q188905, 2.3 km away. Check that twin's coordinates.
- `Q193989` — The stamp radius would grow from 250 m to 3.4 km to reach wikidata:Q193989, 3.4 km away. Check that twin's coordinates.
- `Q2338515` — The stamp radius would grow from 250 m to 1.8 km, taking the footprint set on wikidata:Q2338515. Check that footprint fits this place.
- `Q3304574` — The stamp radius would grow from 250 m to 1.6 km to reach wikidata:Q3304574, 1.6 km away. Check that twin's coordinates.
- `Q3748608` — The stamp radius would grow from 300 m to 6.0 km, taking the footprint set on wikidata:Q3748608. Check that footprint fits this place.
- `Q4116104` — The stamp radius would grow from 250 m to 1.3 km to reach wikidata:Q4116104, 1.3 km away. Check that twin's coordinates.
- `Q511933` — The stamp radius would grow from 3.0 km to 6.0 km, taking the footprint set on wikidata:Q511933. Check that footprint fits this place.
- `Q71719` — The stamp radius would grow from 250 m to 1.7 km to reach curated:united-states-los-angeles-hollywood-walk-of-fame, 1.7 km away. Check that twin's coordinates.
- `Q76122` — The stamp radius would grow from 20 km to 36 km to reach wikidata:Q76122, 36 km away. Check that twin's coordinates.
- `Q860172` — The stamp radius would grow from 250 m to 3.1 km to reach curated:france-paris-canal-saint-martin, 3.1 km away. Check that twin's coordinates.
- `Q9213` — The stamp radius would grow from 2.0 km to 4.9 km to reach wikidata:Q9213, 4.9 km away. Check that twin's coordinates.

**Same name, different Wikidata ids, 500 m–1.5 km apart (not merged) (4)**

- `Q1458032+Q961220` — Same name, different Wikidata ids, 1.0 km apart: not merged. wikidata:Q1458032 — "Viking Ship Museum" (Vikings and the Old Norse, SE) [live]; wikidata:Q961220 — "The Viking Ship Museum" (Skjoldunge trail, DK) [live]
- `Q1701099+Q1063513` — Same name, different Wikidata ids, 1.3 km apart: not merged. icon:Q1701099 — "LEGOLAND Billund" (Billund, Denmark) [live, founder: world]; wikidata:Q1063513 — "Legoland Billund" (Billund, DK) [live]
- `Q473972+Q877538` — Same name, different Wikidata ids, 937 m apart: not merged. wikidata:Q473972 — "Rožok" (Poloniny, PL) [live]; wikidata:Q877538 — "Rožok" (Beech forests of Europe, DE) [live]
- `Q550+Q726531` — Same name, different Wikidata ids, 566 m apart: not merged. curated:france-paris-champs-elysees — "Champs-Elysees" (Paris, France) [live]; icon:Q726531 — "Champs-Élysées" (Paris, France) [live, founder: world]

**Hidden as a duplicate, but no twin survives (not merged) (10)**

- `Q104861311` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km). auto:philippines-cebu-city-heritage-of-cebu-monument — "Heritage of Cebu Monument" (Cebu City, Philippines) [duplicate]
- `Q1101073` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km). wikidata:Q1101073 — "Swedish Parliament" (Stockholm Quay Palaces tour, SE) [duplicate]
- `Q1236511` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km); its scope says national. wikidata:Q1236511 — "Corfe Castle" (Nr Wareham, GB) [duplicate]
- `Q3530881` — Hidden as a duplicate, but no twin survives (its only twin, secret:disneyland-tom-sawyer-island, is a secret stamp and is never merged). wikidata:Q3530881 — "Pirate's Lair on Tom Sawyer Island" (Anaheim, US) [duplicate]
- `Q4290211` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km). wikidata:Q4290211 — "Дом-музей Мажита Гафури" (Ufa, RU) [duplicate]
- `Q5037917` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km). auto:philippines-cebu-city-carbon-market — "Carbon Market" (Cebu City, Philippines) [duplicate]
- `Q56062211` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km). auto:philippines-cebu-city-plaza-independencia — "Plaza Independencia" (Cebu City, Philippines) [duplicate]
- `Q7896231` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km). auto:philippines-cebu-city-university-of-san-carlos-museum — "University of San Carlos Museum" (Cebu City, Philippines) [duplicate]
- `Q85751065` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km). auto:philippines-cebu-city-cebu-ocean-park — "Cebu Ocean Park" (Cebu City, Philippines) [duplicate]
- `name:huntington library art collection and botanical gardens` — Hidden as a duplicate, but no twin survives (no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km). wv:san-marino-california-huntington-library-art-collection-and-botanical-gardens — "Huntington Library, Art Collection, and Botanical Gardens" (San Marino, US) [duplicate]

## Merged although the names differ (181)

Mostly translations and Wikivoyage titles. Worth a glance; anything wrong can be added to `HAND` in the script and the map re-run.

- General Grant National Memorial ← Grant's Tomb (`Q1025105`)
- Khan el-Khalili Bazaar ← Khan El Khalily (`Q1061621`)
- Chengdu Giant Panda Base ← Chengdu Panda Research Base of Giant Panda Breeding (`Q1067861`)
- Choeung Ek Killing Fields Memorial ← The Killing Fields of Choeung Ek (`Q1075734`)
- "I love you" wall ← Wall of Love (`Q10860702`)
- Tokyo Metropolitan Government Center ← Tokyo Metropolitan Government Building (`Q111973`)
- Musée National Du Moyen Âge ← Musée de Cluny, Musée national du Moyen Âge (`Q1124095`)
- Temppeliaukio Rock Church ← The Church in the Rock (`Q1132809`)
- Temple of Divine Julius Caesar ← Temple of Caesar (`Q1133288`)
- 9/11 Memorial & Museum ← 9/11 Memorial & Museum, National September 11 Memorial & Museum, National September 11 Memorial & Museum (`Q1136137`)
- Kawasan Falls ← Kawasan Falls, Kawasan waterfalls (`Q113639810`)
- La Brea Tar Pits and Museum ← Page Museum at the La Brea Tar Pits (`Q1147168`)
- Langkawi Sky Bridge ← Panorama Langkawi: SkyCab Cable Car Ride & Sky Bridge (`Q1164611`)
- Prince's Palace of Monaco ← Palais Princier (`Q1164788`)
- Rugova Canyon ← Rugova Gorge (`Q1166159`)
- Palazzo Doria Pamphilj ← Galleria Doria Pamphilj (`Q1203458`)
- Hercules Caves & Cap Spartel ← Caves of Hercules (`Q12244393`)
- Tayrona National Park ← Tayrona National Natural Park (`Q1225209`)
- Plaza Machado ← Plazuela Machado (`Q123466387`)
- St. Peter's Basilica ← St. Peter's Basilica, Basilica Sancti Petri (`Q12512`)
- St. Basil's Cathedral ← Saint Basil's Cathedral (`Q129846`)
- Pyramids of Giza & Great Sphinx ← Great Sphinx of Giza (`Q130958`)
- Yu Garden ← Yuyuan Garden (`Q1328025`)
- Parco Sempione ← Sempione Park (`Q133963`)
- Abu Simbel Temples ← Great Temple of Ramses II (`Q134140`)
- Zócalo & Metropolitan Cathedral ← Plaza de la Constitución (`Q1348507`)
- Masjid Negara ← National Mosque (`Q1356818`)
- Jesuit Mission of La Santísima Trinidad ← Santísima Trinidad de Paraná (`Q1366015`)
- Bardo National Museum ← Bardo Museum (`Q1429003`)
- Ranthambore National Park ← Ranthambhore National Park (`Q1466242`)
- Pinacoteca di Brera ← Brera Art Gallery (`Q150066`)
- Tjibaou Cultural Centre ← Centre culturel Tjibaou (`Q1521577`)
- Santa Catalina Monastery ← Monasterio de Santa Catalina (`Q1538957`)
- Grand Canyon West Rim (Skywalk) ← Grand Canyon Skywalk (Grand Canyon West) (`Q1542550`)
- Olympic Stadium ← Stadio Olimpico (`Q159884`)
- Prado Museum ← Museo del Prado (`Q160112`)
- Arco di Settimio Severo ← Arch of Septimius Severus (`Q162353`)
- Church of St. John at Kaneo ← Church of Saint John at Kaneo (`Q164664`)
- Topkapi Palace ← Topkapı Palace (`Q170495`)
- Royal Palace of Madrid ← Palacio Real (`Q171517`)
- Gothic Quarter ← Wander the Barri Gotic (`Q17154`)
- St. Mark's Square & Basilica ← Basilica di San Marco (`Q172988`)
- Cinema Museum ← Cinémathèque française (`Q174274`)
- Centre Georges Pompidou ← Centre Pompidou (`Q178065`)
- Musée national Eugène Delacroix ← Musée Delacroix (`Q1782606`)
- Milan Cathedral (Duomo) ← Duomo di Milano, Duomo (`Q18068`)
- Moominworld ← Moomin World (`Q1807595`)
- Menin Gate & Flanders Fields ← Menin Gate Memorial (`Q1822397`)
- Salina Turda ← Salt Mine of Turda (`Q1855800`)
- Horizon 22 ← 22 Bishopsgate (`Q18602`)
- The Chinese Taoist Temple ← Cebu Taoist Temple (`Q1869800`)
- Qutub Minar ← Qutb Minar (`Q187635`)
- Opéra Garnier ← Palais Garnier, Opera Garnier (`Q187840`)
- Wawel Castle ← Wawel Royal Castle (`Q18820`)
- Hôtel des Invalides ← Les Invalides (`Q188977`)
- 30 St. Mary Axe ← The Gherkin (`Q191161`)
- Florence Cathedral (Duomo) ← Santa Maria del Fiore (`Q191739`)
- Itsukushima Floating Torii (Miyajima) ← Itsukushima Shrine (`Q191763`)
- Colonna Traiana ← Trajan's Column (`Q192784`)
- Larco Museum ← Museo Larco (`Q1954240`)
- UBC Museum of Anthropology ← Museum of Anthropology at UBC (`Q1954743`)
- Nasir al-Mulk (Pink Mosque) ← Nasir al-Mulk Mosque (`Q1962312`)
- Cathedral of Brasília ← Brasilia Cathedral (`Q201720`)
- Santiago de Compostela Cathedral ← Catedral de Santiago de Compostela (`Q205136`)
- Erbil Citadel ← Citadel of Erbil (`Q206236`)
- Notre-Dame d'Afrique ← Basilica of Our Lady of Africa (`Q2088381`)
- Sugarloaf Mountain ← Sugar Loaf Mountain (`Q210722`)
- Cebu Provincial Museum ← Museo Sugbo (`Q2110972`)
- The Little Mermaid ← Den lille Havfrue (`Q214619`)
- Mount Nyiragongo ← Climb Nyiragongo Volcano (`Q214696`)
- Rhine Falls ← Rheinfall (`Q214924`)
- Mount Fitz Roy ← Monte Fitz Roy (`Q215138`)
- V&A Waterfront ← Victoria and Alfred Waterfront (`Q2166975`)
- Hidirlik Tower ← Hıdırlık Tower (`Q218118`)
- Tiger's Nest Monastery (Paro Taktsang) ← Taktsang Monastery (`Q2209873`)
- Kiyomizu-dera ← Kiyomizu Temple (`Q221716`)
- Oriental Pearl Tower ← Oriental Pearl TV Tower (`Q223207`)
- FIFA World Football Museum ← FIFA Museum (`Q22984572`)
- Hiroshima Peace Memorial (Atomic Bomb Dome) ← A-Bomb Dome (`Q231140`)
- Grand Bassin (Ganga Talao) ← Ganga Talao - Grand Bassin (`Q2338515`)
- Arashiyama Bamboo Grove ← Bamboo Forest (`Q23579173`)
- Eiffel Tower ← La Tour Eiffel (`Q243`)
- Gorée Island ← Ile de Gorée (`Q244347`)
- The Last Supper (Santa Maria delle Grazie) ← Saint Mary of the Graces (`Q244952`)
- Navagio (Shipwreck) Beach ← Shipwreck on Navagio Beach (`Q2460851`)
- Salt Cathedral of Zipaquirá ← Catedral de Sal (`Q2565876`)
- Kasbah of the Udayas ← Kasbah of the Oudaias (`Q2569036`)
- Jemaa el-Fnaa ← Djemaa El-Fna (`Q258348`)
- Sigiriya Rock Fortress ← Sigiriya Lion Rock Fortress (`Q272153`)
- Jerónimos Monastery ← Mosteiro dos Jerónimos (`Q272781`)
- Warner Bros. Studio Tour London (Harry Potter) ← Warner Bros. Studio Tour London – The Making of Harry Potter (`Q27924395`)
- Sambadrome ← Sambódromo (`Q281521`)
- Sixty Dome Mosque ← Shait Gumbad Mosque (`Q2834259`)
- Meiji Jingu ← Meiji Shrine, Meiji Shrine (`Q287165`)
- Sacré-Cœur Basilica (Montmartre) ← Sacré-Cœur, Paris, Sacré-Cœur, Sacré Coeur (`Q28785`)
- Temple of the Sacred Tooth Relic ← Temple of the Tooth (`Q289175`)
- Catacombs of Paris ← Catacombs of Paris, Catacombes de Paris (`Q28924`)
- Amphitheatre of El Jem ← Amphitheater (`Q2914326`)
- Cappella Sistina ← Sistine Chapel (`Q2943`)
- Palace of Versailles ← Château de Versailles (`Q2946`)
- Eglise de Saint Sulpice ← Saint-Sulpice, Paris (`Q295844`)
- Notre-Dame Cathedral ← Notre-Dame de Paris, Notre-Dame de Paris, Notre Dame Cathedral (`Q2981`)
- Prizren Old Town & Fortress ← Fortress of Prizren (`Q3078443`)
- Luxembourg Gardens ← Jardin du Luxembourg (`Q309458`)
- Medina of Tunis ← Tunis Medina (`Q3106527`)
- Cimetière du Père Lachaise ← Père Lachaise Cemetery, Père-Lachaise Cemetery (`Q311`)
- Gobustan Rock Art & Mud Volcanoes ← Qobustan National Historical-Artistic Reserve (`Q318181`)
- Santa Maria in Aracoeli ← Santa Maria in Ara Coeli (`Q318660`)
- Luxor Temple ← Temple of Luxor (`Q319841`)
- Crystal & Fantasy Caves ← Crystal and Fantasy Caves (`Q3304574`)
- Église de la Madeleine ← La Madeleine, Paris (`Q330564`)
- Acatenango Volcano ← Volcán Acatenango (`Q338192`)
- Agadez Grand Mosque ← Mosque of Agadez (`Q3440333`)
- Hofburg Palace ← Imperial Palace (`Q356289`)
- Chillon Castle ← Château de Chillon (`Q372647`)
- Mandela House ← Nelson Mandela National Museum (`Q3844400`)
- Painted Monasteries of Bucovina (Voroneț) ← Voroneț Monastery (`Q384463`)
- Ancient Olympia ← Archaeological Site of Olympia (`Q38888`)
- Independence Hall & Liberty Bell ← Liberty Bell Center (`Q390306`)
- Leaning Tower of Pisa ← Torre Pendente (`Q39054`)
- Grande Mosquée de Paris ← Grand Mosque of Paris (`Q392564`)
- Jabal Thawr ← Cave Thawr (`Q4116104`)
- Neuschwanstein Castle ← Schloss Neuschwanstein (`Q4152`)
- Cologne Cathedral ← Kölner Dom (`Q4176`)
- Royal Palace & Silver Pagoda ← The Royal Palace and Silver Pagoda (`Q420618`)
- Shwedagon Pagoda ← Shwedagon Paya (`Q464535`)
- Terracotta Army ← Army of Terracotta Warriors and Horses (`Q47672`)
- War Memorial of Korea ← National War Memorial (`Q489764`)
- Cheonggyecheon ← Cheonggye Stream (`Q495437`)
- Royal Alcázar of Seville ← Real Alcázar (`Q498261`)
- Jebel Barkal ← Gebel Barkal (`Q499019`)
- Terme di Caracalla ← Baths of Caracalla (`Q502098`)
- Mount Toubkal ← Jbel Toubkal (`Q503433`)
- Vittorio Emanuele Monument ← Victor Emmanuel II Monument (`Q506234`)
- Phi Phi Islands ← Ko Phi Phi (`Q511957`)
- National Museum of Anthropology ← Museo Nacional de Antropología (`Q524249`)
- Grand Canal & Rialto Bridge ← Ponte di Rialto (`Q52505`)
- AccorHotels Arena ← Accor Arena (`Q537720`)
- U.S. Capitol ← Capitol Building (`Q54109`)
- Royal Botanic Garden Sydney ← Royal Botanical Gardens (`Q54489`)
- Isola Tiberina ← Tiber Island (`Q545404`)
- Pincio ← Pincian Hill (`Q550215`)
- Arco di Constantino ← Arch of Constantine (`Q5786`)
- St. Stephen's Cathedral ← Stephansdom (`Q5943`)
- Masaya Volcano ← Volcan Masaya (`Q613424`)
- Railay Beach ← Rai Leh (`Q664877`)
- Basilica of Santo Niño ← Basilica del Santo Niño (`Q666552`)
- Mapu'a 'a Vaea Blowholes ← Mapu a Vaea (`Q6754225`)
- China Garden ← Chinagarten Zürich (`Q688113`)
- Vaduz Castle ← Schloss Vaduz (`Q694782`)
- Pena Palace ← Pena National Palace (`Q69513`)
- Sumiyoshi Taisha ← Sumiyoshi Grand Shrine (`Q705949`)
- Fushimi Inari Shrine ← Fushimi Inari Taisha (`Q714828`)
- Chiesa del Gesù ← Church of the Gesù (`Q719794`)
- Arco di Tito ← Arch of Titus (`Q723887`)
- Tulum Ruins ← Tulum Archaeological Site (`Q725883`)
- Old Town Square & Astronomical Clock ← Prague Astronomical Clock, Astronomical Clock (`Q729370`)
- KL Tower ← Kuala Lumpur Tower (`Q745016`)
- National Science Museum ← National Museum of Nature and Science (`Q74940`)
- Sri Mahamariamman Temple ← Sri Maha Mariamman Temple (`Q7586152`)
- Mausoleo di Augusto ← Mausoleum of Augustus (`Q770847`)
- Imam Hussein Shrine ← Imam Hussein Holy Shrine (`Q773704`)
- Tundavala Gap ← Fenda da Tundavala (`Q7852875`)
- Baiterek Tower ← Bayterek Tower (`Q804210`)
- Blue Mosque ← Sultanahmet Mosque (`Q80541`)
- Jardin des Tuileries ← Tuileries Garden (`Q818517`)
- São Paulo Museum of Art (MASP) ← Museu de Arte de São Paulo (`Q82941`)
- Triglav National Park (Lake Bohinj) ← Bohinj Lake (`Q831903`)
- Icherisheher & Maiden Tower ← Maiden's Tower (`Q842822`)
- Oceanographic Museum ← Oceanographic Museum, Musée océanographique (`Q851527`)
- Musée d'Art Moderne de la Ville de Paris ← Musée d'Art Moderne de Paris (`Q857276`)
- Tsukiji Outer Market ← Tsukiji Outer Market, Tsukiji fish market (`Q859471`)
- Promenade Canal St. Martin ← Canal Saint-Martin (`Q860172`)
- Shanghai Disneyland ← Disneyland Park (`Q865312`)
- Cathedral Church of St. John the Divine ← Cathedral of St. John the Divine (`Q865655`)
- Saltos del Monday ← Salto del Monday (`Q880046`)
- Boudhanath Stupa ← Boudha Stupa (`Q889902`)
- Te Papa (Museum of New Zealand) ← Museum of New Zealand Te Papa Tongarewa (`Q915603`)
- Museum of London ← London Museum (`Q917820`)
- Sir Seewoosagur Ramgoolam Botanical Garden ← SSR Botanical Garden (`Q931430`)
- Detian Falls ← Detian Waterfall (`Q983252`)

## Twins found by name, not by Wikidata id (60 groups)

- `icon:Q107462441` Magellan's Cross ← `curated:philippines-cebu-city-magellan-s-cross-pavilion`, `wikidata:Q772656`
- `icon:Q113639810` Kawasan Falls ← `icon:kawasan-falls`, `wikidata:Q113639810`
- `icon:Q152073` Monserrate ← `icon:monserrate`, `wikidata:Q152073`
- `icon:cerro-san-cristobal` Cerro San Cristobal ← `icon:Q181523`
- `icon:Q270983` Kinkaku-ji (Golden Pavilion) ← `icon:kinkaku-ji-golden-pavilion`, `wikidata:Q270983`
- `icon:Q4200637` Tegallalang Rice Terraces ← `icon:tegallalang-rice-terraces`, `wikidata:Q4200637`
- `icon:st-vitus-cathedral` St Vitus Cathedral ← `curated:czech-republic-prague-st-vitus-cathedral`, `wikidata:Q5949`
- `icon:Q827401` Teatro Colón ← `icon:teatro-colon`, `wikidata:Q827401`
- `icon:Q828336` Sacsayhuamán ← `icon:sacsayhuaman`, `wikidata:Q828336`
- `icon:Q851527` Oceanographic Museum ← `icon:oceanographic-museum`, `wikidata:Q851527`
- `curated:japan-tokyo-tsukiji-outer-market` Tsukiji Outer Market ← `wikidata:Q859471`, `curated:japan-tokyo-tsukiji-fish-market`
- `icon:Q7698673` Temple Street Night Market ← `curated:hong-kong-hong-kong-temple-street-night-market`
- `icon:Q201013` Grand Central Terminal ← `curated:united-states-new-york-city-grand-central-terminal`
- `icon:magic-fountain-of-montju-c` Magic Fountain of Montjuïc ← `curated:spain-barcelona-magic-fountain-of-montjuic`
- `icon:Q1133087` Griffith Observatory ← `curated:united-states-los-angeles-griffith-observatory`
- `curated:australia-sydney-darling-harbour` Darling Harbour ← `wikidata:Q54488`
- `wv:banff-national-park-banff-gondola` Banff Gondola ← `auto:canada-banff-banff-gondola`
- `wikidata:Q675303` Johnston Canyon ← `auto:canada-banff-johnston-canyon`
- `icon:Q217925` Champ de Mars ← `curated:france-paris-champ-de-mars`
- `curated:united-kingdom-london-regent-s-park` Regent's Park ← `wikidata:Q739341`
- `icon:Q20892` Mont Saint-Michel ← `icon:mont-saint-michel`
- `icon:Q2449634` Windsor Castle ← `wikidata:Q42646`
- `icon:Q338665` St. Stephen's Basilica ← `icon:st-stephen-s-basilica`
- `icon:Q193001` Sighișoara Citadel ← `wikidata:Q1075681`
- `icon:Q18588998` Uluwatu Temple ← `wikidata:Q1381933`
- `icon:Q30590075` Warner Bros. World ← `icon:warner-bros-world`
- `icon:Q1542275` Tree of Life ← `wikidata:Q1651237`
- `icon:Q554947` Tatev Monastery ← `wikidata:Q20512375`
- `icon:Q1503673` Philae Temple ← `wikidata:Q245062`
- `icon:Q55264655` Elmina Castle ← `wikidata:Q1438772`
- `icon:Q849508` Lake Nakuru National Park ← `icon:Q313071`
- `icon:Q573558` Vallée de Mai ← `icon:vallee-de-mai`
- `icon:beau-vallon-beach` Beau Vallon Beach ← `icon:Q7479348`
- `icon:Q675214` Yankee Stadium ← `curated:united-states-new-york-yankee-stadium`
- `icon:Q464899` Monte Albán ← `icon:monte-alban`
- `icon:Q86486` Great Blue Hole ← `icon:great-blue-hole`
- `icon:Q181476` Cotopaxi National Park ← `icon:Q1851352`
- `icon:Q1139689` Wai-O-Tapu Thermal Wonderland ← `wikidata:Q30812454`
- `icon:jordan-museum` Jordan Museum ← `wikidata:Q24521524`
- `wikidata:Q79944673` Joker Stairs ← `curated:united-states-new-york-joker-stairs`
- `icon:hoan-kiem-lake` Hoan Kiem Lake ← `wikidata:Q1151254`
- `icon:welcome-to-fabulous-las-vegas-sign` Welcome to Fabulous Las Vegas Sign ← `wikidata:Q175665`
- `icon:plaza-de-bolivar` Plaza de Bolivar ← `wikidata:Q3090480`
- `wikidata:Q130206` London Bridge ← `curated:united-kingdom-london-london-bridge`
- `icon:lion-monument` Lion Monument ← `wikidata:Q688214`
- `icon:plaza-de-la-revolucion` Plaza de la Revolucion ← `wikidata:Q2099152`
- `icon:stade-olympique` Stade Olympique ← `wikidata:Q285467`
- `icon:the-parthenon` The Parthenon ← `wikidata:Q1467467`
- `icon:hakone-open-air-museum` Hakone Open-Air Museum ← `wikidata:Q1134422`
- `icon:fram-museum` Fram Museum ← `wikidata:Q941250`
- `icon:basilica-del-voto-nacional` Basilica del Voto Nacional ← `wikidata:Q4868435`
- `icon:catedral-da-se` Catedral da Se ← `wikidata:Q1050668`
- `icon:st-lawrence-market` St Lawrence Market ← `wikidata:Q7589489`
- `icon:kata-tjuta` Kata Tjuta ← `wikidata:Q279980`
- `icon:Q890802` Voidokilia beach ← `wv:voidokilia-voidokilia-beach`
- `icon:Q12192963` Al-Aqsa Mosque ← `wikidata:Q425281`
- `icon:castillo-san-cristobal` Castillo San Cristobal ← `wikidata:Q3748608`
- `icon:abba-the-museum` ABBA The Museum ← `wikidata:Q2743819`
- `icon:st-florian-s-gate` St Florian's Gate ← `icon:Q1363724`
- `icon:ben-thanh-market` Ben Thanh Market ← `icon:Q3232879`

## Deleted ids that will forward (44)

These ids were deleted from the table (most on 2026-10-06), but stamp art, film scenes or secret stamps still name them, and travellers' stamps may too. Each forwards to the survivor below. Another option, for the famous ones: re-create the deleted `icon:` id as the survivor itself, since art already uses it; decide after the Supabase count.

| Deleted id | Forwards to | How it was matched |
|---|---|---|
| `curated:australia-sydney-bondi-beach` | `icon:Q673418` Bondi Beach | art place #168 Bondi Beach |
| `curated:china-shanghai-the-bund` | `icon:Q125474` The Bund | art place #45 The Bund |
| `curated:czech-republic-prague-charles-bridge` | `icon:Q204871` Charles Bridge | art place #22 Charles Bridge |
| `curated:czech-republic-prague-prague-castle` | `icon:Q193369` Prague Castle | art place #584 Prague Castle |
| `curated:italy-rome-trevi-fountain` | `icon:Q185382` Trevi Fountain | art place #6 Trevi Fountain |
| `curated:japan-tokyo-senso-ji-temple` | `icon:Q615183` Senso-ji Temple | art place #49 Senso-ji Temple, by name |
| `curated:malaysia-kuala-lumpur-batu-caves` | `icon:Q687629` Batu Caves | art place #147 Batu Caves |
| `curated:malaysia-kuala-lumpur-petronas-twin-towers` | `icon:Q83063` Petronas Twin Towers | art place #56 Petronas Towers |
| `curated:netherlands-amsterdam-anne-frank-house` | `icon:Q165366` Anne Frank House | art place #570 Anne Frank House |
| `curated:netherlands-amsterdam-rijksmuseum` | `icon:Q190804` Rijksmuseum | art place #569 Rijksmuseum |
| `curated:singapore-singapore-gardens-by-the-bay` | `icon:Q630135` Gardens by the Bay | art place #146 Gardens by the Bay |
| `curated:singapore-singapore-merlion-park` | `icon:Q208760` Merlion Park | art place #55 Merlion |
| `curated:south-korea-seoul-bukchon-hanok-village` | `icon:Q490981` Bukchon Hanok Village | art place #256 Bukchon Hanok Village |
| `curated:south-korea-seoul-gyeongbokgung-palace` | `icon:Q482485` Gyeongbokgung Palace | art place #52 Gyeongbokgung Palace |
| `curated:south-korea-seoul-n-seoul-tower` | `icon:Q69134` N Seoul Tower | art place #53 N Seoul Tower |
| `curated:taiwan-taipei-taipei-101` | `icon:Q83101` Taipei 101 | art place #63 Taipei 101 |
| `curated:thailand-bangkok-wat-arun` | `icon:Q724970` Wat Arun | art place #58 Wat Arun |
| `curated:turkey-istanbul-grand-bazaar` | `icon:Q505954` Grand Bazaar | art place #343 Grand Bazaar |
| `curated:turkey-istanbul-topkapi-palace` | `icon:Q170495` Topkapi Palace | art place #619 Topkapı Palace |
| `curated:united-arab-emirates-dubai-burj-khalifa` | `icon:Q12495` Burj Khalifa | art place #29 Burj Khalifa |
| `curated:united-arab-emirates-dubai-museum-of-the-future` | `icon:Q22948398` Museum of the Future | art place #346 Museum of the Future |
| `curated:united-states-new-york-city-brooklyn-bridge` | `curated:united-states-new-york-brooklyn-bridge` Brooklyn Bridge | art place #75 Brooklyn Bridge |
| `curated:united-states-new-york-city-central-park` | `icon:Q160409` Central Park | art place #273 Central Park |
| `curated:united-states-new-york-empire-state-building` | `icon:Q9188` Empire State Building | art place #74 Empire State Building |
| `icon:Q10285` | `curated:italy-rome-colosseum` Colosseum | Wikidata id Q10285 |
| `icon:Q19675` | `curated:france-paris-louvre` Louvre | Wikidata id Q19675 |
| `icon:Q216511` | `curated:turkey-istanbul-basilica-cistern` Basilica Cistern | Wikidata id Q216511 |
| `icon:Q243` | `curated:france-paris-eiffel-tower` Eiffel Tower | Wikidata id Q243 |
| `icon:Q2946` | `curated:france-paris-palace-of-versailles` Palace of Versailles | Wikidata id Q2946 |
| `icon:Q321242` | `curated:japan-osaka-osaka-castle` Osaka Castle | Wikidata id Q321242 |
| `icon:Q42182` | `curated:united-kingdom-london-buckingham-palace` Buckingham Palace | Wikidata id Q42182 |
| `icon:Q45178` | `curated:australia-sydney-sydney-opera-house` Sydney Opera House | Wikidata id Q45178 |
| `icon:Q47672` | `curated:china-terracotta-army` Terracotta Army | Wikidata id Q47672 |
| `icon:Q63167656` | `curated:france-paris-notre-dame-cathedral` Notre-Dame Cathedral | art place #101 Notre-Dame Cathedral |
| `icon:Q64436` | `curated:france-paris-arc-de-triomphe` Arc de Triomphe | Wikidata id Q64436 |
| `icon:Q80541` | `curated:turkey-istanbul-blue-mosque` Blue Mosque | Wikidata id Q80541 |
| `icon:Q828155` | `curated:croatia-krka-national-park` Krka National Park | Wikidata id Q828155 |
| `icon:Q83125` | `curated:united-kingdom-london-tower-bridge` Tower Bridge | Wikidata id Q83125 |
| `icon:Q9141` | `curated:india-taj-mahal` Taj Mahal | Wikidata id Q9141 |
| `wikidata:Q11259` | `icon:Q11259` Times Square | Wikidata id Q11259 |
| `wikidata:Q2636724` | `icon:Q981989` The Alamo | Wikidata id Q2636724 |
| `wikidata:Q415048` | `icon:Q12826048` Lake Louise | art place #86 Lake Louise, by name |
| `wikidata:Q9188` | `icon:Q9188` Empire State Building | Wikidata id Q9188 |
| `wikidata:Q9202` | `icon:Q9202` Statue of Liberty | Wikidata id Q9202 |

## Not merged by these rules: the Getty double

Getty Center (`curated:united-states-los-angeles-getty-center`) and J. Paul Getty Museum (`icon:Q731126`) are both visible about 100 m apart, but their names and Wikidata ids differ, so the automatic rules (same Wikidata id, or the same name within 1.5 km) do not join them. Only the Getty Center's own hidden twin (`wikidata:Q29247`) is in the map. Joining the two needs one confirmed line in `NAME_PAIRS` in the script (it is listed under "please confirm").

## What else the apply step must move

- **Stamp art**: the app's art index (`src/lib/stampArtIndex.js`) names 16 alias or ghost ids (`icon:Q64436`, `wikidata:Q12506`, `icon:Q63167656`, `wv:paris-notre-dame-cathedral`, `curated:france-paris-notre-dame-de-paris`, `wikidata:Q2981`, `wikidata:Q99309`, `icon:Q80541`, `wikidata:Q836531`, `wikidata:Q886946`, `wikidata:Q956018`, `curated:turkey-istanbul-grand-bazaar`, `curated:italy-rome-roman-forum`, `curated:italy-rome-spanish-steps`, `curated:united-kingdom-london-st-paul-s-cathedral`, `wikidata:Q2536763`), and the art review (`scripts/stamp-art/art-matches.json`) names 145. Keep them until stored stamps no longer use them, and make sure each survivor id gets the same art when the index is rebuilt.
- **Film scenes**: 8 `film_scenes.attraction_id` values are aliases or ghosts (`auto:united-states-san-francisco-buena-vista-park`, `curated:united-states-new-york-city-brooklyn-bridge`, `curated:united-states-new-york-joker-stairs`, `icon:Q19675`, `icon:Q216511`, `icon:Q2946`, `icon:Q9141`, `wv:voidokilia-voidokilia-beach`).
- **Secret stamps**: 5 `parent_id` values point at aliases or ghosts (`secret:disneyland-tom-sawyer-island` → `wikidata:Q181185`, `secret:disneyland-club-33-door` → `wikidata:Q181185`, `secret:disneyland-blue-bayou` → `wikidata:Q181185`, `secret:tokyo-disneyland-club-33-door` → `wikidata:Q843997`, `secret:shanghai-disneyland-club-33-door` → `wikidata:Q865312`).
- **Aliases that are visible today**: 64 (they disappear from browse when merged). **Aliases with a founder scope**: 189 (the survivor takes it only when it has none and the twins agree; disagreements are listed above). **Aliases banned for another reason**: 2 (`wikidata:Q244169`, `wikidata:Q850268`).
- **Ghosts with nothing to forward to**: 3 (listed under "Held").
- **Rows hidden as "duplicate" that still won't forward anywhere after this map**: 64 of 998 (held groups, wrong matches and orphans above).

## Before the merge runs

1. The worker learns to follow an old id to its survivor everywhere it looks a place up, saves a stamp, shows a guestbook or counts a city set. That ships first, after Apple approval.
2. Founder runs the read-only Supabase count: `npx supabase db query --linked -f scripts/stamp-merge/preflight-supabase.sql`. It says how many stamps, photos, tags, guestbook notes and owner notes sit on alias ids, and how many travellers hold both twins (those stamps get folded into one, photos moved, never deleted).
3. Then the D1 data step from `data/alias-map.json` + `data/canonical-fills.json` (aliases stay as hidden rows that point at their survivor; nothing is deleted).
