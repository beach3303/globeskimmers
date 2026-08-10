# Passport Icon Art — Top 100 Global Icons (starter set)

The curated first batch for bespoke stamp art. Generate each in **one consistent
style** (Ideogram or DALL·E), keep the best of 3–4 tries, save as a square
PNG (transparent or white bg). Grow beyond this list **demand-driven** using the
admin Passport analytics (which attractions/countries actually get stamped).

## Locked prompt template (swap only the **bold** parts)
> A vintage passport stamp of the **{LANDMARK}**. **{INK}** ink line-engraving,
> square double rounded-rectangle border, distressed rubber-stamp texture, clean
> transparent/white background, detailed iconic landmark centered, top text
> "**{CITY} · {COUNTRY}**", bottom text "**{LANDMARK NAME}**" with two small stars,
> flat 2D, high contrast, **no date**, no photorealism.

**Rules:** no baked-in date (the app adds the real date + ✓). Keep style words
identical across all 100 — only the landmark/city/country/name/ink change.

## How to wire a stamp into the app (art-loading layer — BUILT)
1. Generate the stamp (locked template above), export a **square PNG** (transparent or white bg).
2. **Name it by the clean slug** of the landmark: lowercase, spaces→hyphens, no punctuation.
   `Eiffel Tower` → `eiffel-tower.png` · `Statue of Liberty` → `statue-of-liberty.png` · `Christ the Redeemer` → `christ-the-redeemer.png`
3. **Upload to R2** (bucket `globeskimmers-media`, prefix `stamp-art/`):
   ```
   cd "/Users/globeskimmers/Desktop/CODES PROTECT/globeskimmers-cacf36e4-10" && wrangler r2 object put globeskimmers-media/stamp-art/eiffel-tower.png --file=./eiffel-tower.png --remote
   ```
4. Done — the passport shows it automatically for matching stamps (no app release).
   The Worker serves it at `/stamp-art/<slug>.png`; the card tries that URL and
   falls back to the category emoji if it 404s. Name variants (Tour Eiffel, etc.)
   are handled by the alias map in `src/lib/stampArt.js` — add to it if a landmark
   isn't matching. (Tip: name each file to match this list's **Landmark** column slug.)

## Ink by region (variety + cohesion)
- Europe → **navy** `#2B4A7E`
- Middle East & Africa → **amber** `#A9741F`
- Asia → **crimson** `#B0472F`
- Oceania → **teal** `#1F6E6A`
- North America → **forest green** `#2E6B4E`
- South America → **plum** `#6D3A6E`

*(Or keep everything navy for a single-ink classic set — your call.)*

---

## 🌍 Europe — navy `#2B4A7E`
| # | Landmark | City | Country |
|---|---|---|---|
| 1 | Eiffel Tower | Paris | France |
| 2 | Arc de Triomphe | Paris | France |
| 3 | Louvre Pyramid | Paris | France |
| 4 | Mont-Saint-Michel | Normandy | France |
| 5 | Colosseum | Rome | Italy |
| 6 | Trevi Fountain | Rome | Italy |
| 7 | Leaning Tower of Pisa | Pisa | Italy |
| 8 | St. Mark's Basilica | Venice | Italy |
| 9 | Florence Duomo | Florence | Italy |
| 10 | Big Ben (Elizabeth Tower) | London | United Kingdom |
| 11 | Tower Bridge | London | United Kingdom |
| 12 | London Eye | London | United Kingdom |
| 13 | Stonehenge | Wiltshire | United Kingdom |
| 14 | Edinburgh Castle | Edinburgh | United Kingdom |
| 15 | Sagrada Família | Barcelona | Spain |
| 16 | Alhambra | Granada | Spain |
| 17 | Parthenon (Acropolis) | Athens | Greece |
| 18 | Santorini | Santorini | Greece |
| 19 | Brandenburg Gate | Berlin | Germany |
| 20 | Neuschwanstein Castle | Bavaria | Germany |
| 21 | Amsterdam Canals | Amsterdam | Netherlands |
| 22 | Charles Bridge | Prague | Czech Republic |
| 23 | St. Basil's Cathedral | Moscow | Russia |
| 24 | Belém Tower | Lisbon | Portugal |
| 25 | Matterhorn | Zermatt | Switzerland |

## 🕌 Middle East & Africa — amber `#A9741F`
| # | Landmark | City | Country |
|---|---|---|---|
| 26 | Pyramids of Giza | Giza | Egypt |
| 27 | Abu Simbel | Aswan | Egypt |
| 28 | Petra | Petra | Jordan |
| 29 | Burj Khalifa | Dubai | United Arab Emirates |
| 30 | Sheikh Zayed Grand Mosque | Abu Dhabi | United Arab Emirates |
| 31 | Hagia Sophia | Istanbul | Turkey |
| 32 | Cappadocia | Cappadocia | Turkey |
| 33 | Dome of the Rock | Jerusalem | Israel |
| 34 | Table Mountain | Cape Town | South Africa |
| 35 | Victoria Falls | Livingstone | Zambia |
| 36 | Mount Kilimanjaro | Kilimanjaro | Tanzania |
| 37 | Koutoubia Mosque | Marrakech | Morocco |
| 38 | Serengeti | Serengeti | Tanzania |

## 🏯 Asia — crimson `#B0472F`
| # | Landmark | City | Country |
|---|---|---|---|
| 39 | Taj Mahal | Agra | India |
| 40 | Golden Temple | Amritsar | India |
| 41 | Gateway of India | Mumbai | India |
| 42 | Great Wall of China | Beijing | China |
| 43 | Forbidden City | Beijing | China |
| 44 | Terracotta Army | Xi'an | China |
| 45 | The Bund | Shanghai | China |
| 46 | Victoria Harbour | Hong Kong | Hong Kong |
| 47 | Mount Fuji | Fujinomiya | Japan |
| 48 | Tokyo Tower | Tokyo | Japan |
| 49 | Senso-ji Temple | Tokyo | Japan |
| 50 | Fushimi Inari Shrine | Kyoto | Japan |
| 51 | Kinkaku-ji (Golden Pavilion) | Kyoto | Japan |
| 52 | Gyeongbokgung Palace | Seoul | South Korea |
| 53 | N Seoul Tower | Seoul | South Korea |
| 54 | Marina Bay Sands | Singapore | Singapore |
| 55 | Merlion | Singapore | Singapore |
| 56 | Petronas Towers | Kuala Lumpur | Malaysia |
| 57 | Grand Palace | Bangkok | Thailand |
| 58 | Wat Arun | Bangkok | Thailand |
| 59 | Angkor Wat | Siem Reap | Cambodia |
| 60 | Ha Long Bay | Quảng Ninh | Vietnam |
| 61 | Borobudur | Magelang | Indonesia |
| 62 | Tanah Lot | Bali | Indonesia |
| 63 | Taipei 101 | Taipei | Taiwan |
| 64 | Chocolate Hills | Bohol | Philippines |
| 65 | Mayon Volcano | Albay | Philippines |
| 66 | Banaue Rice Terraces | Ifugao | Philippines |

## 🏝️ Oceania — teal `#1F6E6A`
| # | Landmark | City | Country |
|---|---|---|---|
| 67 | Sydney Opera House | Sydney | Australia |
| 68 | Sydney Harbour Bridge | Sydney | Australia |
| 69 | Uluru | Northern Territory | Australia |
| 70 | Great Barrier Reef | Queensland | Australia |
| 71 | Milford Sound | Fiordland | New Zealand |
| 72 | Hobbiton | Matamata | New Zealand |

## 🗽 North America — forest green `#2E6B4E`
| # | Landmark | City | Country |
|---|---|---|---|
| 73 | Statue of Liberty | New York | United States |
| 74 | Empire State Building | New York | United States |
| 75 | Brooklyn Bridge | New York | United States |
| 76 | Golden Gate Bridge | San Francisco | United States |
| 77 | Hollywood Sign | Los Angeles | United States |
| 78 | Grand Canyon | Arizona | United States |
| 79 | Las Vegas Strip | Las Vegas | United States |
| 80 | Space Needle | Seattle | United States |
| 81 | Mount Rushmore | South Dakota | United States |
| 82 | The White House | Washington, D.C. | United States |
| 83 | Grand Prismatic (Yellowstone) | Wyoming | United States |
| 84 | Niagara Falls | Ontario | Canada |
| 85 | CN Tower | Toronto | Canada |
| 86 | Lake Louise | Banff | Canada |
| 87 | Chichén Itzá | Yucatán | Mexico |
| 88 | Tulum Ruins | Quintana Roo | Mexico |
| 89 | Cabo Arch | Cabo San Lucas | Mexico |

## ⛰️ South America — plum `#6D3A6E`
| # | Landmark | City | Country |
|---|---|---|---|
| 90 | Christ the Redeemer | Rio de Janeiro | Brazil |
| 91 | Sugarloaf Mountain | Rio de Janeiro | Brazil |
| 92 | Iguazú Falls | Misiones | Argentina |
| 93 | Machu Picchu | Cusco | Peru |
| 94 | Rainbow Mountain | Cusco | Peru |
| 95 | Easter Island Moai | Rapa Nui | Chile |
| 96 | Torres del Paine | Patagonia | Chile |
| 97 | Salar de Uyuni | Uyuni | Bolivia |
| 98 | Galápagos Islands | Galápagos | Ecuador |
| 99 | Cartagena Old Town | Cartagena | Colombia |
| 100 | Angel Falls | Canaima | Venezuela |

# Batch 2 — icons #101–200 (same ink-by-region scheme)

## 🌍 Europe — navy `#2B4A7E`
| # | Landmark | City | Country |
|---|---|---|---|
| 101 | Notre-Dame Cathedral | Paris | France |
| 102 | Palace of Versailles | Versailles | France |
| 103 | Sacré-Cœur | Paris | France |
| 104 | St. Peter's Basilica | Vatican City | Vatican |
| 105 | Pantheon | Rome | Italy |
| 106 | Cinque Terre | Liguria | Italy |
| 107 | Pompeii | Naples | Italy |
| 108 | Milan Cathedral | Milan | Italy |
| 109 | Buckingham Palace | London | United Kingdom |
| 110 | Roman Baths | Bath | United Kingdom |
| 111 | Giant's Causeway | Antrim | United Kingdom |
| 112 | Park Güell | Barcelona | Spain |
| 113 | Plaza Mayor | Madrid | Spain |
| 114 | Cologne Cathedral | Cologne | Germany |
| 115 | Hallstatt | Hallstatt | Austria |
| 116 | Schönbrunn Palace | Vienna | Austria |
| 117 | Bruges Canals | Bruges | Belgium |
| 118 | Nyhavn | Copenhagen | Denmark |
| 119 | Geirangerfjord | Geiranger | Norway |
| 120 | Pena Palace | Sintra | Portugal |
| 121 | Plitvice Lakes | Plitvice | Croatia |
| 122 | Dubrovnik Old Town | Dubrovnik | Croatia |

## 🕌 Middle East & Africa — amber `#A9741F`
| # | Landmark | City | Country |
|---|---|---|---|
| 123 | Karnak Temple | Luxor | Egypt |
| 124 | Wadi Rum | Wadi Rum | Jordan |
| 125 | Palm Jumeirah | Dubai | United Arab Emirates |
| 126 | Blue Mosque | Istanbul | Turkey |
| 127 | Pamukkale | Pamukkale | Turkey |
| 128 | Chefchaouen | Chefchaouen | Morocco |
| 129 | Fez Medina | Fez | Morocco |
| 130 | Registan | Samarkand | Uzbekistan |
| 131 | Lalibela | Lalibela | Ethiopia |
| 132 | Zanzibar Stone Town | Zanzibar | Tanzania |
| 133 | Masai Mara | Masai Mara | Kenya |
| 134 | Sossusvlei | Namib Desert | Namibia |
| 135 | Cape of Good Hope | Cape Town | South Africa |
| 136 | Dead Sea | Dead Sea | Jordan |

## 🏯 Asia — crimson `#B0472F`
| # | Landmark | City | Country |
|---|---|---|---|
| 137 | Shwedagon Pagoda | Yangon | Myanmar |
| 138 | Bagan Temples | Bagan | Myanmar |
| 139 | Hoi An | Hoi An | Vietnam |
| 140 | Arashiyama Bamboo Grove | Kyoto | Japan |
| 141 | Great Buddha of Kamakura | Kamakura | Japan |
| 142 | Himeji Castle | Himeji | Japan |
| 143 | Osaka Castle | Osaka | Japan |
| 144 | Todai-ji | Nara | Japan |
| 145 | Shibuya Crossing | Tokyo | Japan |
| 146 | Gardens by the Bay | Singapore | Singapore |
| 147 | Batu Caves | Kuala Lumpur | Malaysia |
| 148 | Phi Phi Islands | Krabi | Thailand |
| 149 | White Temple (Wat Rong Khun) | Chiang Rai | Thailand |
| 150 | Ubud Rice Terraces | Bali | Indonesia |
| 151 | Komodo Island | Komodo | Indonesia |
| 152 | El Nido | Palawan | Philippines |
| 153 | Boracay | Aklan | Philippines |
| 154 | Intramuros | Manila | Philippines |
| 155 | Sigiriya | Sigiriya | Sri Lanka |
| 156 | Tiger's Nest Monastery | Paro | Bhutan |
| 157 | Boudhanath Stupa | Kathmandu | Nepal |
| 158 | Mount Everest | Solukhumbu | Nepal |
| 159 | Amber Fort | Jaipur | India |
| 160 | Hawa Mahal | Jaipur | India |
| 161 | Varanasi Ghats | Varanasi | India |
| 162 | Kerala Backwaters | Kerala | India |
| 163 | Potala Palace | Lhasa | Tibet |
| 164 | Zhangjiajie | Zhangjiajie | China |
| 165 | Li River | Guilin | China |
| 166 | Leshan Giant Buddha | Leshan | China |

## 🏝️ Oceania — teal `#1F6E6A`
| # | Landmark | City | Country |
|---|---|---|---|
| 167 | Twelve Apostles | Great Ocean Road | Australia |
| 168 | Bondi Beach | Sydney | Australia |
| 169 | Whitsunday Islands | Queensland | Australia |
| 170 | Blue Mountains | New South Wales | Australia |
| 171 | Bora Bora | Bora Bora | French Polynesia |
| 172 | Queenstown | Queenstown | New Zealand |
| 173 | Franz Josef Glacier | Westland | New Zealand |

## 🗽 North America — forest green `#2E6B4E`
| # | Landmark | City | Country |
|---|---|---|---|
| 174 | Yosemite (Half Dome) | California | United States |
| 175 | Antelope Canyon | Arizona | United States |
| 176 | Monument Valley | Utah | United States |
| 177 | Zion National Park | Utah | United States |
| 178 | Cloud Gate (The Bean) | Chicago | United States |
| 179 | French Quarter | New Orleans | United States |
| 180 | Diamond Head | Honolulu | United States |
| 181 | Gateway Arch | St. Louis | United States |
| 182 | Château Frontenac | Quebec City | Canada |
| 183 | Stanley Park | Vancouver | Canada |
| 184 | Teotihuacán | Mexico City | Mexico |
| 185 | Cancún | Quintana Roo | Mexico |
| 186 | Old Havana | Havana | Cuba |
| 187 | Tikal | Petén | Guatemala |
| 188 | Arenal Volcano | La Fortuna | Costa Rica |

## ⛰️ South America — plum `#6D3A6E`
| # | Landmark | City | Country |
|---|---|---|---|
| 189 | Copacabana Beach | Rio de Janeiro | Brazil |
| 190 | Amazon Rainforest | Manaus | Brazil |
| 191 | Perito Moreno Glacier | Santa Cruz | Argentina |
| 192 | La Boca | Buenos Aires | Argentina |
| 193 | Atacama Desert | Atacama | Chile |
| 194 | Valparaíso | Valparaíso | Chile |
| 195 | Nazca Lines | Nazca | Peru |
| 196 | Lake Titicaca | Puno | Peru |
| 197 | Guatapé | Antioquia | Colombia |
| 198 | Cocora Valley | Quindío | Colombia |
| 199 | Quito Old Town | Quito | Ecuador |
| 200 | Mount Roraima | Gran Sabana | Venezuela |

# Batch 3 — icons #201–300 (same ink-by-region scheme)

## 🌍 Europe — navy `#2B4A7E`
| # | Landmark | City | Country |
|---|---|---|---|
| 201 | Trolltunga | Odda | Norway |
| 202 | Blue Lagoon | Grindavík | Iceland |
| 203 | Gullfoss | Selfoss | Iceland |
| 204 | Hallgrímskirkja | Reykjavík | Iceland |
| 205 | Meteora | Kalambaka | Greece |
| 206 | Mykonos Windmills | Mykonos | Greece |
| 207 | Amalfi Coast | Amalfi | Italy |
| 208 | Lake Como | Como | Italy |
| 209 | Rialto Bridge | Venice | Italy |
| 210 | Sistine Chapel | Vatican City | Vatican |
| 211 | Hungarian Parliament | Budapest | Hungary |
| 212 | Fisherman's Bastion | Budapest | Hungary |
| 213 | Wawel Castle | Kraków | Poland |
| 214 | Bran Castle | Transylvania | Romania |
| 215 | Red Square & Kremlin | Moscow | Russia |
| 216 | Church of the Savior on Blood | St. Petersburg | Russia |
| 217 | Hermitage Museum | St. Petersburg | Russia |
| 218 | Château de Chambord | Loire Valley | France |
| 219 | Carcassonne | Carcassonne | France |
| 220 | Guggenheim Bilbao | Bilbao | Spain |
| 221 | Plaza de España | Seville | Spain |
| 222 | Grand Place | Brussels | Belgium |

## 🕌 Middle East & Africa — amber `#A9741F`
| # | Landmark | City | Country |
|---|---|---|---|
| 223 | Valley of the Kings | Luxor | Egypt |
| 224 | Great Sphinx of Giza | Giza | Egypt |
| 225 | Ephesus | İzmir | Turkey |
| 226 | Mount Nemrut | Adıyaman | Turkey |
| 227 | Persepolis | Shiraz | Iran |
| 228 | Nasir al-Mulk Mosque | Shiraz | Iran |
| 229 | Hassan II Mosque | Casablanca | Morocco |
| 230 | Aït Benhaddou | Ouarzazate | Morocco |
| 231 | Museum of Islamic Art | Doha | Qatar |
| 232 | Louvre Abu Dhabi | Abu Dhabi | United Arab Emirates |
| 233 | Jerash | Jerash | Jordan |
| 234 | Ngorongoro Crater | Ngorongoro | Tanzania |
| 235 | Okavango Delta | Okavango | Botswana |
| 236 | Bwindi Gorilla Forest | Bwindi | Uganda |
| 237 | Kruger National Park | Mpumalanga | South Africa |

## 🏯 Asia — crimson `#B0472F`
| # | Landmark | City | Country |
|---|---|---|---|
| 238 | Temple of Heaven | Beijing | China |
| 239 | Summer Palace | Beijing | China |
| 240 | Huangshan (Yellow Mountains) | Anhui | China |
| 241 | West Lake | Hangzhou | China |
| 242 | Jiuzhaigou Valley | Sichuan | China |
| 243 | Chengdu Panda Base | Chengdu | China |
| 244 | Golden Bridge (Ba Na Hills) | Da Nang | Vietnam |
| 245 | Sapa Rice Terraces | Lào Cai | Vietnam |
| 246 | Luang Prabang | Luang Prabang | Laos |
| 247 | Temple of the Tooth | Kandy | Sri Lanka |
| 248 | Maldives Overwater Villas | Malé | Maldives |
| 249 | Red Fort | Delhi | India |
| 250 | India Gate | Delhi | India |
| 251 | City Palace | Udaipur | India |
| 252 | Ellora Caves | Aurangabad | India |
| 253 | Itsukushima Shrine (Miyajima) | Hiroshima | Japan |
| 254 | Kiyomizu-dera | Kyoto | Japan |
| 255 | Shirakawa-go | Gifu | Japan |
| 256 | Bukchon Hanok Village | Seoul | South Korea |
| 257 | Jeju Island | Jeju | South Korea |
| 258 | Ayutthaya | Ayutthaya | Thailand |
| 259 | Wat Pho (Reclining Buddha) | Bangkok | Thailand |
| 260 | Mount Bromo | East Java | Indonesia |
| 261 | Prambanan | Yogyakarta | Indonesia |
| 262 | Puerto Princesa Underground River | Palawan | Philippines |
| 263 | Taal Volcano | Batangas | Philippines |

## 🏝️ Oceania — teal `#1F6E6A`
| # | Landmark | City | Country |
|---|---|---|---|
| 264 | Waitomo Glowworm Caves | Waitomo | New Zealand |
| 265 | Aoraki / Mount Cook | Canterbury | New Zealand |
| 266 | Lake Tekapo | Canterbury | New Zealand |
| 267 | Cradle Mountain | Tasmania | Australia |
| 268 | Kangaroo Island | South Australia | Australia |
| 269 | Ningaloo Reef | Western Australia | Australia |
| 270 | Fiji Islands | Nadi | Fiji |
| 271 | Tahiti | Papeete | French Polynesia |

## 🗽 North America — forest green `#2E6B4E`
| # | Landmark | City | Country |
|---|---|---|---|
| 272 | Times Square | New York | United States |
| 273 | Central Park | New York | United States |
| 274 | Old Faithful (Yellowstone) | Wyoming | United States |
| 275 | Bryce Canyon | Utah | United States |
| 276 | Delicate Arch (Arches) | Utah | United States |
| 277 | Denali | Alaska | United States |
| 278 | Sedona Red Rocks | Arizona | United States |
| 279 | Alcatraz | San Francisco | United States |
| 280 | Kennedy Space Center | Cape Canaveral | United States |
| 281 | Willis Tower Skydeck | Chicago | United States |
| 282 | Moraine Lake | Banff | Canada |
| 283 | Peggy's Cove | Nova Scotia | Canada |
| 284 | Butchart Gardens | Victoria | Canada |
| 285 | Palenque | Chiapas | Mexico |
| 286 | Copper Canyon | Chihuahua | Mexico |
| 287 | Panama Canal | Panama City | Panama |
| 288 | Great Blue Hole | Lighthouse Reef | Belize |

## ⛰️ South America — plum `#6D3A6E`
| # | Landmark | City | Country |
|---|---|---|---|
| 289 | Ipanema Beach | Rio de Janeiro | Brazil |
| 290 | Pantanal | Mato Grosso | Brazil |
| 291 | Lençóis Maranhenses | Maranhão | Brazil |
| 292 | Ushuaia (End of the World) | Tierra del Fuego | Argentina |
| 293 | Fitz Roy (Los Glaciares) | El Chaltén | Argentina |
| 294 | Mendoza Vineyards | Mendoza | Argentina |
| 295 | Colca Canyon | Arequipa | Peru |
| 296 | Sacsayhuamán | Cusco | Peru |
| 297 | Chan Chan | Trujillo | Peru |
| 298 | Tayrona National Park | Magdalena | Colombia |
| 299 | Cotopaxi | Latacunga | Ecuador |
| 300 | Kaieteur Falls | Potaro-Siparuni | Guyana |

# Batch 4 — icons #301–500 (national parks + natural wonders + more · same ink-by-region scheme)

## 🌍 Europe — navy `#2B4A7E`
| # | Landmark | City | Country |
|---|---|---|---|
| 301 | Windsor Castle | Windsor | United Kingdom |
| 302 | Loch Ness | Scottish Highlands | United Kingdom |
| 303 | Cliffs of Moher | County Clare | Ireland |
| 304 | Keukenhof Gardens | Lisse | Netherlands |
| 305 | Kinderdijk Windmills | Kinderdijk | Netherlands |
| 306 | Atomium | Brussels | Belgium |
| 307 | The Little Mermaid | Copenhagen | Denmark |
| 308 | Tivoli Gardens | Copenhagen | Denmark |
| 309 | Gamla Stan | Stockholm | Sweden |
| 310 | Lofoten Islands | Lofoten | Norway |
| 311 | Jökulsárlón Glacier Lagoon | Vatnajökull | Iceland |
| 312 | Reynisfjara Black Sand Beach | Vík | Iceland |
| 313 | Jungfraujoch | Bernese Alps | Switzerland |
| 314 | Chapel Bridge | Lucerne | Switzerland |
| 315 | Zugspitze | Bavaria | Germany |
| 316 | Black Forest | Baden-Württemberg | Germany |
| 317 | Rhine Valley (Lorelei) | Rhine Gorge | Germany |
| 318 | Sanssouci Palace | Potsdam | Germany |
| 319 | Château de Chenonceau | Loire Valley | France |
| 320 | Mont Blanc | Chamonix | France |
| 321 | Verdon Gorge | Provence | France |
| 322 | Seville Cathedral & Giralda | Seville | Spain |
| 323 | Mezquita of Córdoba | Córdoba | Spain |
| 324 | Montserrat | Catalonia | Spain |
| 325 | City of Arts and Sciences | Valencia | Spain |
| 326 | Douro Valley | Douro | Portugal |
| 327 | Sete Cidades | Azores | Portugal |
| 328 | Delphi | Delphi | Greece |
| 329 | Lindos Acropolis | Rhodes | Greece |
| 330 | Lake Bled | Bled | Slovenia |
| 331 | Postojna Cave | Postojna | Slovenia |
| 332 | Peleș Castle | Sinaia | Romania |
| 333 | Český Krumlov | Český Krumlov | Czech Republic |
| 334 | Trakai Island Castle | Trakai | Lithuania |
| 335 | Tallinn Old Town | Tallinn | Estonia |

## 🕌 Middle East & Africa — amber `#A9741F`
| # | Landmark | City | Country |
|---|---|---|---|
| 336 | Sahara Desert (Erg Chebbi) | Merzouga | Morocco |
| 337 | Jemaa el-Fnaa | Marrakech | Morocco |
| 338 | White Desert | Farafra | Egypt |
| 339 | Luxor Temple | Luxor | Egypt |
| 340 | Sheikh Lotfollah Mosque | Isfahan | Iran |
| 341 | Naqsh-e Jahan Square | Isfahan | Iran |
| 342 | Sumela Monastery | Trabzon | Turkey |
| 343 | Grand Bazaar | Istanbul | Turkey |
| 344 | Masada | Dead Sea | Israel |
| 345 | Western Wall | Jerusalem | Israel |
| 346 | Museum of the Future | Dubai | United Arab Emirates |
| 347 | Baalbek | Baalbek | Lebanon |
| 348 | Jeita Grotto | Jeita | Lebanon |
| 349 | Great Mosque of Djenné | Djenné | Mali |
| 350 | Pyramids of Meroë | Meroë | Sudan |
| 351 | Mount Kenya | Mount Kenya | Kenya |
| 352 | Lake Nakuru | Nakuru | Kenya |
| 353 | Etosha Pan | Etosha | Namibia |
| 354 | Fish River Canyon | Fish River | Namibia |
| 355 | Chobe National Park | Chobe | Botswana |
| 356 | Blyde River Canyon | Mpumalanga | South Africa |
| 357 | Robben Island | Cape Town | South Africa |
| 358 | Garden Route | Western Cape | South Africa |
| 359 | Volcanoes National Park | Musanze | Rwanda |
| 360 | Sultan Qaboos Grand Mosque | Muscat | Oman |
| 361 | Wahiba Sands | Sharqiya | Oman |
| 362 | Qal'at al-Bahrain Fort | Manama | Bahrain |
| 363 | Dana Biosphere Reserve | Dana | Jordan |

## 🏯 Asia — crimson `#B0472F`
| # | Landmark | City | Country |
|---|---|---|---|
| 364 | Zhangye Danxia (Rainbow Mountains) | Gansu | China |
| 365 | Wulingyuan | Hunan | China |
| 366 | Reed Flute Cave | Guilin | China |
| 367 | Mogao Caves | Dunhuang | China |
| 368 | Mount Tai | Shandong | China |
| 369 | Hongcun Village | Anhui | China |
| 370 | Tian Tan Big Buddha | Hong Kong | Hong Kong |
| 371 | Sun Moon Lake | Nantou | Taiwan |
| 372 | Taroko Gorge | Hualien | Taiwan |
| 373 | Nikkō Tōshōgū | Nikkō | Japan |
| 374 | Hakone & Lake Ashi | Hakone | Japan |
| 375 | Nachi Falls | Wakayama | Japan |
| 376 | Shurijō Castle | Okinawa | Japan |
| 377 | Otaru Canal | Hokkaido | Japan |
| 378 | Haeinsa Temple | Gyeongsang | South Korea |
| 379 | Gamcheon Culture Village | Busan | South Korea |
| 380 | Son Doong / Phong Nha Caves | Quảng Bình | Vietnam |
| 381 | Trang An | Ninh Bình | Vietnam |
| 382 | Mekong Delta | Cần Thơ | Vietnam |
| 383 | Bayon Temple | Siem Reap | Cambodia |
| 384 | Kuang Si Falls | Luang Prabang | Laos |
| 385 | Plain of Jars | Xiangkhoang | Laos |
| 386 | Inle Lake | Shan | Myanmar |
| 387 | Golden Rock (Kyaiktiyo) | Mon State | Myanmar |
| 388 | Cameron Highlands | Pahang | Malaysia |
| 389 | Langkawi Sky Bridge | Langkawi | Malaysia |
| 390 | Sentosa | Singapore | Singapore |
| 391 | Mount Rinjani | Lombok | Indonesia |
| 392 | Lake Toba | Sumatra | Indonesia |
| 393 | Gili Islands | Lombok | Indonesia |
| 394 | Kawasan Falls | Cebu | Philippines |
| 395 | Vigan | Ilocos Sur | Philippines |
| 396 | Sagada | Mountain Province | Philippines |
| 397 | Lotus Temple | Delhi | India |
| 398 | Mysore Palace | Mysore | India |
| 399 | Hampi | Karnataka | India |
| 400 | Ajanta Caves | Aurangabad | India |
| 401 | Jaisalmer Fort | Jaisalmer | India |
| 402 | Ranthambore National Park | Rajasthan | India |
| 403 | Munnar Tea Gardens | Munnar | India |
| 404 | Nine Arch Bridge, Ella | Ella | Sri Lanka |
| 405 | Punakha Dzong | Punakha | Bhutan |
| 406 | Annapurna Circuit | Annapurna | Nepal |
| 407 | Chitwan National Park | Chitwan | Nepal |
| 408 | Charyn Canyon | Almaty | Kazakhstan |

## 🏝️ Oceania — teal `#1F6E6A`
| # | Landmark | City | Country |
|---|---|---|---|
| 409 | Kakadu National Park | Northern Territory | Australia |
| 410 | Daintree Rainforest | Queensland | Australia |
| 411 | K'gari (Fraser Island) | Queensland | Australia |
| 412 | Bungle Bungles (Purnululu) | Western Australia | Australia |
| 413 | The Grampians | Victoria | Australia |
| 414 | Rottnest Island | Western Australia | Australia |
| 415 | Wineglass Bay | Tasmania | Australia |
| 416 | Rotorua Geothermal | Rotorua | New Zealand |
| 417 | Tongariro Alpine Crossing | Tongariro | New Zealand |
| 418 | Abel Tasman | Nelson | New Zealand |
| 419 | Bay of Islands | Northland | New Zealand |
| 420 | Aitutaki Lagoon | Aitutaki | Cook Islands |
| 421 | Jellyfish Lake | Koror | Palau |
| 422 | To Sua Ocean Trench | Upolu | Samoa |
| 423 | Mount Yasur | Tanna | Vanuatu |

## 🗽 North America — forest green `#2E6B4E`
| # | Landmark | City | Country |
|---|---|---|---|
| 424 | Glacier National Park | Montana | United States |
| 425 | Rocky Mountain National Park | Colorado | United States |
| 426 | Great Smoky Mountains | Tennessee | United States |
| 427 | Acadia National Park | Maine | United States |
| 428 | Olympic National Park | Washington | United States |
| 429 | Mount Rainier | Washington | United States |
| 430 | Crater Lake | Oregon | United States |
| 431 | Redwood National Park | California | United States |
| 432 | Sequoia National Park | California | United States |
| 433 | Joshua Tree National Park | California | United States |
| 434 | Death Valley | California | United States |
| 435 | Everglades | Florida | United States |
| 436 | Hawaiʻi Volcanoes | Hawaii | United States |
| 437 | Haleakalā | Maui | United States |
| 438 | Nā Pali Coast | Kauai | United States |
| 439 | Grand Teton | Wyoming | United States |
| 440 | Badlands | South Dakota | United States |
| 441 | Mesa Verde | Colorado | United States |
| 442 | Carlsbad Caverns | New Mexico | United States |
| 443 | Big Bend | Texas | United States |
| 444 | Shenandoah | Virginia | United States |
| 445 | Kenai Fjords | Alaska | United States |
| 446 | Horseshoe Bend | Arizona | United States |
| 447 | White Sands | New Mexico | United States |
| 448 | Mammoth Cave | Kentucky | United States |
| 449 | Lincoln Memorial | Washington, D.C. | United States |
| 450 | Washington Monument | Washington, D.C. | United States |
| 451 | The Alamo | San Antonio | United States |
| 452 | South Beach (Art Deco) | Miami | United States |
| 453 | Savannah Historic District | Savannah | United States |
| 454 | Mackinac Island | Michigan | United States |
| 455 | Napa Valley | California | United States |
| 456 | Jasper National Park | Alberta | Canada |
| 457 | Gros Morne | Newfoundland | Canada |
| 458 | Bay of Fundy | New Brunswick | Canada |
| 459 | Old Montreal | Montreal | Canada |
| 460 | Parliament Hill | Ottawa | Canada |
| 461 | Whistler | British Columbia | Canada |
| 462 | Cabot Trail | Nova Scotia | Canada |
| 463 | Zócalo & Metropolitan Cathedral | Mexico City | Mexico |
| 464 | Guanajuato | Guanajuato | Mexico |
| 465 | San Miguel de Allende | Guanajuato | Mexico |
| 466 | Ik Kil Cenote | Yucatán | Mexico |
| 467 | Monte Albán | Oaxaca | Mexico |
| 468 | Sumidero Canyon | Chiapas | Mexico |
| 469 | Antigua Guatemala | Antigua | Guatemala |
| 470 | Lake Atitlán | Sololá | Guatemala |
| 471 | Monteverde Cloud Forest | Monteverde | Costa Rica |
| 472 | Manuel Antonio | Quepos | Costa Rica |
| 473 | Dunn's River Falls | Ocho Rios | Jamaica |
| 474 | The Pitons | Soufrière | Saint Lucia |
| 475 | Harbour Island Pink Sands | Harbour Island | Bahamas |

## ⛰️ South America — plum `#6D3A6E`
| # | Landmark | City | Country |
|---|---|---|---|
| 476 | Selarón Steps | Rio de Janeiro | Brazil |
| 477 | Fernando de Noronha | Pernambuco | Brazil |
| 478 | Chapada Diamantina | Bahia | Brazil |
| 479 | Bonito | Mato Grosso do Sul | Brazil |
| 480 | Ouro Preto | Minas Gerais | Brazil |
| 481 | Marble Caves | General Carrera Lake | Chile |
| 482 | Chiloé Churches | Chiloé | Chile |
| 483 | Elqui Valley | Coquimbo | Chile |
| 484 | Bariloche | Río Negro | Argentina |
| 485 | Quebrada de Humahuaca | Jujuy | Argentina |
| 486 | Sacred Valley | Cusco | Peru |
| 487 | Huacachina Oasis | Ica | Peru |
| 488 | Gocta Falls | Amazonas | Peru |
| 489 | Ciudad Perdida | Santa Marta | Colombia |
| 490 | Caño Cristales | Meta | Colombia |
| 491 | Comuna 13 | Medellín | Colombia |
| 492 | Baños de Agua Santa | Tungurahua | Ecuador |
| 493 | Quilotoa Lagoon | Cotopaxi | Ecuador |
| 494 | Cuenca Historic Center | Cuenca | Ecuador |
| 495 | Isla del Sol | Lake Titicaca | Bolivia |
| 496 | Madidi National Park | La Paz | Bolivia |
| 497 | Jesuit Missions of Trinidad | Trinidad | Paraguay |
| 498 | Montevideo Rambla | Montevideo | Uruguay |
| 499 | Punta del Este | Maldonado | Uruguay |
| 500 | Los Roques | Los Roques | Venezuela |

---

# 🌟 Batch 2 — Icons #501–1000 (natural wonders, deeper cuts, underrepresented countries)

*Same locked prompt template + per-region ink as above. Deduplicated against #1–500.*

## 🌍 Europe — navy `#2B4A7E`
| # | Landmark | City | Country |
|---|---|---|---|
| 501 | Palace of the Popes | Avignon | France |
| 502 | Pont du Gard | Nîmes | France |
| 503 | Étretat Cliffs | Étretat | France |
| 504 | Dune du Pilat | Arcachon | France |
| 505 | Colmar Old Town | Colmar | France |
| 506 | Strasbourg Cathedral | Strasbourg | France |
| 507 | Rocamadour | Rocamadour | France |
| 508 | Annecy Old Town | Annecy | France |
| 509 | Fontainebleau Palace | Fontainebleau | France |
| 510 | Calanques de Cassis | Cassis | France |
| 511 | Reims Cathedral | Reims | France |
| 512 | Palais Garnier | Paris | France |
| 513 | Blue Grotto | Capri | Italy |
| 514 | Valley of the Temples | Agrigento | Italy |
| 515 | Sassi di Matera | Matera | Italy |
| 516 | Trulli of Alberobello | Alberobello | Italy |
| 517 | Tre Cime di Lavaredo | Dolomites | Italy |
| 518 | Lake Garda | Garda | Italy |
| 519 | Roman Forum | Rome | Italy |
| 520 | Spanish Steps | Rome | Italy |
| 521 | Doge's Palace | Venice | Italy |
| 522 | Verona Arena | Verona | Italy |
| 523 | Mount Etna | Catania | Italy |
| 524 | Val d'Orcia | Tuscany | Italy |
| 525 | Royal Palace of Madrid | Madrid | Spain |
| 526 | Aqueduct of Segovia | Segovia | Spain |
| 527 | Santiago de Compostela Cathedral | Santiago de Compostela | Spain |
| 528 | Toledo Old City | Toledo | Spain |
| 529 | Teide Volcano | Tenerife | Spain |
| 530 | Ronda | Ronda | Spain |
| 531 | La Concha Beach | San Sebastián | Spain |
| 532 | Caminito del Rey | Málaga | Spain |
| 533 | Royal Alcázar of Seville | Seville | Spain |
| 534 | York Minster | York | United Kingdom |
| 535 | Old Man of Storr | Isle of Skye | United Kingdom |
| 536 | Snowdon | Snowdonia | United Kingdom |
| 537 | Lake Windermere | Cumbria | United Kingdom |
| 538 | Hadrian's Wall | Northumberland | United Kingdom |
| 539 | The Shard | London | United Kingdom |
| 540 | St Paul's Cathedral | London | United Kingdom |
| 541 | Rock of Cashel | Cashel | Ireland |
| 542 | Ring of Kerry | County Kerry | Ireland |
| 543 | Blarney Castle | Cork | Ireland |
| 544 | Trinity College Old Library | Dublin | Ireland |
| 545 | Berlin Cathedral | Berlin | Germany |
| 546 | East Side Gallery | Berlin | Germany |
| 547 | Heidelberg Castle | Heidelberg | Germany |
| 548 | Hohenzollern Castle | Hechingen | Germany |
| 549 | Marienplatz | Munich | Germany |
| 550 | Königssee | Berchtesgaden | Germany |
| 551 | Bastei Bridge | Saxon Switzerland | Germany |
| 552 | Jerónimos Monastery | Lisbon | Portugal |
| 553 | São Jorge Castle | Lisbon | Portugal |
| 554 | Benagil Cave | Algarve | Portugal |
| 555 | University of Coimbra | Coimbra | Portugal |
| 556 | Bom Jesus do Monte | Braga | Portugal |
| 557 | Palace of Knossos | Crete | Greece |
| 558 | Navagio Beach | Zakynthos | Greece |
| 559 | Corinth Canal | Corinth | Greece |
| 560 | Mount Olympus | Thessaly | Greece |
| 561 | Samaria Gorge | Crete | Greece |
| 562 | Jet d'Eau | Geneva | Switzerland |
| 563 | Chillon Castle | Montreux | Switzerland |
| 564 | Rhine Falls | Schaffhausen | Switzerland |
| 565 | Lauterbrunnen Valley | Lauterbrunnen | Switzerland |
| 566 | Grossglockner | Hohe Tauern | Austria |
| 567 | Salzburg Old Town | Salzburg | Austria |
| 568 | Golden Roof | Innsbruck | Austria |
| 569 | Rijksmuseum | Amsterdam | Netherlands |
| 570 | Anne Frank House | Amsterdam | Netherlands |
| 571 | Gravensteen Castle | Ghent | Belgium |
| 572 | Cathedral of Our Lady | Antwerp | Belgium |
| 573 | Vigeland Park | Oslo | Norway |
| 574 | Preikestolen | Ryfylke | Norway |
| 575 | Bryggen | Bergen | Norway |
| 576 | Nærøyfjord | Aurland | Norway |
| 577 | Icehotel | Jukkasjärvi | Sweden |
| 578 | Vasa Museum | Stockholm | Sweden |
| 579 | Suomenlinna | Helsinki | Finland |
| 580 | Santa Claus Village | Rovaniemi | Finland |
| 581 | Skógafoss | Skógar | Iceland |
| 582 | Þingvellir National Park | Þingvellir | Iceland |
| 583 | Seljalandsfoss | Seljalandsfoss | Iceland |
| 584 | Prague Castle | Prague | Czech Republic |
| 585 | Sedlec Ossuary | Kutná Hora | Czech Republic |
| 586 | Auschwitz-Birkenau | Oświęcim | Poland |
| 587 | Wieliczka Salt Mine | Wieliczka | Poland |
| 588 | Old Town Market Square | Warsaw | Poland |
| 589 | Malbork Castle | Malbork | Poland |
| 590 | Bratislava Castle | Bratislava | Slovakia |
| 591 | Széchenyi Thermal Bath | Budapest | Hungary |
| 592 | Rila Monastery | Rila | Bulgaria |
| 593 | Kotor Old Town | Kotor | Montenegro |
| 594 | Stari Most | Mostar | Bosnia and Herzegovina |
| 595 | Lake Ohrid | Ohrid | North Macedonia |
| 596 | Berat Old Town | Berat | Albania |
| 597 | Butrint | Sarandë | Albania |
| 598 | Sighișoara Historic Center | Sighișoara | Romania |
| 599 | Transfăgărășan | Făgăraș | Romania |
| 600 | Belgrade Fortress | Belgrade | Serbia |
| 601 | Diocletian's Palace | Split | Croatia |
| 602 | Krka Waterfalls | Šibenik | Croatia |
| 603 | Predjama Castle | Predjama | Slovenia |
| 604 | Hill of Crosses | Šiauliai | Lithuania |
| 605 | House of the Blackheads | Riga | Latvia |
| 606 | Kyiv Pechersk Lavra | Kyiv | Ukraine |
| 607 | Peterhof Palace | St. Petersburg | Russia |
| 608 | Lake Baikal | Irkutsk | Russia |
| 609 | Mount Elbrus | Caucasus | Russia |
| 610 | Kizhi Pogost | Karelia | Russia |
| 611 | Valletta Old City | Valletta | Malta |
| 612 | Monte Carlo Casino | Monte Carlo | Monaco |
| 613 | Aphrodite's Rock | Paphos | Cyprus |

## 🕌 Middle East & Africa — amber `#A9741F`
| # | Landmark | City | Country |
|---|---|---|---|
| 614 | Citadel of Saladin | Cairo | Egypt |
| 615 | Egyptian Museum | Cairo | Egypt |
| 616 | Siwa Oasis | Siwa | Egypt |
| 617 | St. Catherine's Monastery | Sinai | Egypt |
| 618 | Ras Muhammad | Sharm El Sheikh | Egypt |
| 619 | Topkapı Palace | Istanbul | Turkey |
| 620 | Bosphorus Strait | Istanbul | Turkey |
| 621 | Göbekli Tepe | Şanlıurfa | Turkey |
| 622 | Aspendos Theatre | Antalya | Turkey |
| 623 | Ölüdeniz | Fethiye | Turkey |
| 624 | Ani Ruins | Kars | Turkey |
| 625 | Golestan Palace | Tehran | Iran |
| 626 | Tomb of Cyrus (Pasargadae) | Pasargadae | Iran |
| 627 | Yazd Old City | Yazd | Iran |
| 628 | Chogha Zanbil | Khuzestan | Iran |
| 629 | Church of the Holy Sepulchre | Jerusalem | Israel |
| 630 | Bahá'í Gardens | Haifa | Israel |
| 631 | Church of the Nativity | Bethlehem | Palestine |
| 632 | Amman Citadel | Amman | Jordan |
| 633 | Umm Qais | Umm Qais | Jordan |
| 634 | Byblos | Byblos | Lebanon |
| 635 | Al Masmak Fortress | Riyadh | Saudi Arabia |
| 636 | Hegra (Al-Hijr) | AlUla | Saudi Arabia |
| 637 | Masjid al-Haram | Mecca | Saudi Arabia |
| 638 | Al-Masjid an-Nabawi | Medina | Saudi Arabia |
| 639 | Kuwait Towers | Kuwait City | Kuwait |
| 640 | Nizwa Fort | Nizwa | Oman |
| 641 | Tree of Life | Sakhir | Bahrain |
| 642 | Jebel Shams | Al Hamra | Oman |
| 643 | Wadi Shab | Tiwi | Oman |
| 644 | Dubai Frame | Dubai | United Arab Emirates |
| 645 | Jebel Jais | Ras Al Khaimah | United Arab Emirates |
| 646 | Socotra Dragon Blood Trees | Socotra | Yemen |
| 647 | Old City of Sana'a | Sana'a | Yemen |
| 648 | Great Ziggurat of Ur | Nasiriyah | Iraq |
| 649 | Erbil Citadel | Erbil | Iraq |
| 650 | Umayyad Mosque | Damascus | Syria |
| 651 | Palmyra | Palmyra | Syria |
| 652 | Krak des Chevaliers | Homs | Syria |
| 653 | Volubilis | Meknes | Morocco |
| 654 | Todra Gorge | Tinghir | Morocco |
| 655 | Legzira Beach | Sidi Ifni | Morocco |
| 656 | Sidi Bou Said | Tunis | Tunisia |
| 657 | El Djem Amphitheatre | El Djem | Tunisia |
| 658 | Carthage | Tunis | Tunisia |
| 659 | Timgad | Batna | Algeria |
| 660 | Leptis Magna | Khoms | Libya |
| 661 | Simien Mountains | Amhara | Ethiopia |
| 662 | Danakil Depression | Afar | Ethiopia |
| 663 | Blue Nile Falls | Bahir Dar | Ethiopia |
| 664 | Bale Mountains | Oromia | Ethiopia |
| 665 | Murchison Falls | Murchison | Uganda |
| 666 | Nyiragongo Volcano | Virunga | DR Congo |
| 667 | Nyungwe Forest | Nyungwe | Rwanda |
| 668 | Lake Malawi | Cape Maclear | Malawi |
| 669 | Loango National Park | Loango | Gabon |
| 670 | Lake Tanganyika | Kigoma | Tanzania |
| 671 | Amboseli National Park | Amboseli | Kenya |
| 672 | Lamu Old Town | Lamu | Kenya |
| 673 | Tarangire National Park | Manyara | Tanzania |
| 674 | Lake Manyara | Manyara | Tanzania |
| 675 | Great Zimbabwe | Masvingo | Zimbabwe |
| 676 | Hwange National Park | Hwange | Zimbabwe |
| 677 | Matobo Hills | Bulawayo | Zimbabwe |
| 678 | Makgadikgadi Pans | Makgadikgadi | Botswana |
| 679 | Tsodilo Hills | Tsodilo | Botswana |
| 680 | Boulders Beach | Simon's Town | South Africa |
| 681 | Drakensberg | KwaZulu-Natal | South Africa |
| 682 | Kirstenbosch Gardens | Cape Town | South Africa |
| 683 | Spitzkoppe | Damaraland | Namibia |
| 684 | Kolmanskop | Lüderitz | Namibia |
| 685 | South Luangwa National Park | Mfuwe | Zambia |
| 686 | Bazaruto Archipelago | Inhambane | Mozambique |
| 687 | Ilha de Moçambique | Nampula | Mozambique |
| 688 | Kalandula Falls | Malanje | Angola |
| 689 | Maletsunyane Falls | Semonkong | Lesotho |
| 690 | Elmina Castle | Elmina | Ghana |
| 691 | Cape Coast Castle | Cape Coast | Ghana |
| 692 | Lake Retba | Dakar | Senegal |
| 693 | Gorée Island | Dakar | Senegal |
| 694 | Grand Mosque of Touba | Touba | Senegal |
| 695 | Ganvié | Cotonou | Benin |
| 696 | Osun-Osogbo Sacred Grove | Osogbo | Nigeria |
| 697 | Zuma Rock | Abuja | Nigeria |
| 698 | Avenue of the Baobabs | Morondava | Madagascar |
| 699 | Tsingy de Bemaraha | Melaky | Madagascar |
| 700 | Anse Source d'Argent | La Digue | Seychelles |
| 701 | Le Morne Brabant | Le Morne | Mauritius |
| 702 | Chamarel Seven Coloured Earths | Chamarel | Mauritius |

## 🏯 Asia — crimson `#B0472F`
| # | Landmark | City | Country |
|---|---|---|---|
| 703 | Yungang Grottoes | Datong | China |
| 704 | Longmen Grottoes | Luoyang | China |
| 705 | Hanging Temple | Datong | China |
| 706 | Mount Emei | Sichuan | China |
| 707 | Mount Hua | Shaanxi | China |
| 708 | Mount Wuyi | Fujian | China |
| 709 | Lijiang Old Town | Yunnan | China |
| 710 | Yuanyang Rice Terraces | Yunnan | China |
| 711 | Stone Forest | Kunming | China |
| 712 | Fenghuang Ancient Town | Hunan | China |
| 713 | Pingyao Ancient City | Shanxi | China |
| 714 | Suzhou Classical Gardens | Suzhou | China |
| 715 | Oriental Pearl Tower | Shanghai | China |
| 716 | Detian Falls | Guangxi | China |
| 717 | Mount Kailash | Ngari | Tibet |
| 718 | Jokhang Temple | Lhasa | Tibet |
| 719 | Matsumoto Castle | Matsumoto | Japan |
| 720 | Kenroku-en Garden | Kanazawa | Japan |
| 721 | Kumano Kodo | Wakayama | Japan |
| 722 | Mount Koya | Wakayama | Japan |
| 723 | Dotonbori | Osaka | Japan |
| 724 | Furano Lavender Fields | Furano | Japan |
| 725 | Blue Pond | Biei | Japan |
| 726 | Tottori Sand Dunes | Tottori | Japan |
| 727 | Naoshima Art Island | Naoshima | Japan |
| 728 | Ise Grand Shrine | Ise | Japan |
| 729 | Chureito Pagoda | Fujiyoshida | Japan |
| 730 | Ginzan Onsen | Obanazawa | Japan |
| 731 | Bulguksa Temple | Gyeongju | South Korea |
| 732 | Changdeokgung Palace | Seoul | South Korea |
| 733 | Lotte World Tower | Seoul | South Korea |
| 734 | Nami Island | Chuncheon | South Korea |
| 735 | Boseong Tea Fields | Boseong | South Korea |
| 736 | Jiufen Old Street | New Taipei | Taiwan |
| 737 | Alishan | Chiayi | Taiwan |
| 738 | Kenting National Park | Pingtung | Taiwan |
| 739 | Railay Beach | Krabi | Thailand |
| 740 | Sukhothai Historical Park | Sukhothai | Thailand |
| 741 | Doi Suthep | Chiang Mai | Thailand |
| 742 | Erawan Falls | Kanchanaburi | Thailand |
| 743 | Similan Islands | Phang Nga | Thailand |
| 744 | Cu Chi Tunnels | Ho Chi Minh City | Vietnam |
| 745 | Fansipan | Lào Cai | Vietnam |
| 746 | My Son Sanctuary | Quảng Nam | Vietnam |
| 747 | Imperial City | Huế | Vietnam |
| 748 | Marble Mountains | Da Nang | Vietnam |
| 749 | Ban Gioc Falls | Cao Bằng | Vietnam |
| 750 | Ta Prohm | Siem Reap | Cambodia |
| 751 | Koh Rong | Sihanoukville | Cambodia |
| 752 | Pha That Luang | Vientiane | Laos |
| 753 | Wat Phou | Champasak | Laos |
| 754 | Vang Vieng | Vang Vieng | Laos |
| 755 | U Bein Bridge | Mandalay | Myanmar |
| 756 | Mrauk U | Rakhine | Myanmar |
| 757 | Nusa Penida | Bali | Indonesia |
| 758 | Raja Ampat | West Papua | Indonesia |
| 759 | Kawah Ijen | East Java | Indonesia |
| 760 | Tana Toraja | Sulawesi | Indonesia |
| 761 | Kelimutu | Flores | Indonesia |
| 762 | Kraton Yogyakarta | Yogyakarta | Indonesia |
| 763 | George Town | Penang | Malaysia |
| 764 | Mount Kinabalu | Sabah | Malaysia |
| 765 | Sipadan Island | Sabah | Malaysia |
| 766 | Melaka Old Town | Malacca | Malaysia |
| 767 | Taman Negara | Pahang | Malaysia |
| 768 | Coron | Palawan | Philippines |
| 769 | Mount Pinatubo | Zambales | Philippines |
| 770 | Siargao | Surigao del Norte | Philippines |
| 771 | Panglao Island | Bohol | Philippines |
| 772 | Singapore Flyer | Singapore | Singapore |
| 773 | Sultan Omar Ali Saifuddien Mosque | Bandar Seri Begawan | Brunei |
| 774 | Cristo Rei of Dili | Dili | Timor-Leste |
| 775 | Konark Sun Temple | Konark | India |
| 776 | Meenakshi Temple | Madurai | India |
| 777 | Khajuraho Temples | Khajuraho | India |
| 778 | Qutub Minar | Delhi | India |
| 779 | Fatehpur Sikri | Agra | India |
| 780 | Mehrangarh Fort | Jodhpur | India |
| 781 | Rann of Kutch | Gujarat | India |
| 782 | Valley of Flowers | Uttarakhand | India |
| 783 | Dal Lake | Srinagar | India |
| 784 | Pangong Lake | Ladakh | India |
| 785 | Charminar | Hyderabad | India |
| 786 | Victoria Memorial | Kolkata | India |
| 787 | Darjeeling Himalayan Railway | Darjeeling | India |
| 788 | Galle Fort | Galle | Sri Lanka |
| 789 | Adam's Peak | Ratnapura | Sri Lanka |
| 790 | Yala National Park | Yala | Sri Lanka |
| 791 | Dambulla Cave Temple | Dambulla | Sri Lanka |
| 792 | Polonnaruwa | Polonnaruwa | Sri Lanka |
| 793 | Swayambhunath | Kathmandu | Nepal |
| 794 | Pashupatinath Temple | Kathmandu | Nepal |
| 795 | Phewa Lake | Pokhara | Nepal |
| 796 | Lumbini | Lumbini | Nepal |
| 797 | Dochula Pass | Thimphu | Bhutan |
| 798 | Sixty Dome Mosque | Bagerhat | Bangladesh |
| 799 | Somapura Mahavihara | Paharpur | Bangladesh |
| 800 | Cox's Bazar Beach | Cox's Bazar | Bangladesh |
| 801 | Badshahi Mosque | Lahore | Pakistan |
| 802 | Mohenjo-daro | Sindh | Pakistan |
| 803 | Hunza Valley | Gilgit-Baltistan | Pakistan |
| 804 | Faisal Mosque | Islamabad | Pakistan |
| 805 | Deosai National Park | Gilgit-Baltistan | Pakistan |
| 806 | Band-e Amir Lakes | Bamyan | Afghanistan |
| 807 | Minaret of Jam | Ghor | Afghanistan |
| 808 | Shrine of Ali | Mazar-i-Sharif | Afghanistan |
| 809 | Sea of Stars | Vaadhoo | Maldives |
| 810 | Itchan Kala | Khiva | Uzbekistan |
| 811 | Bukhara Old City | Bukhara | Uzbekistan |
| 812 | Shah-i-Zinda | Samarkand | Uzbekistan |
| 813 | Bayterek Tower | Astana | Kazakhstan |
| 814 | Kaindy Lake | Almaty | Kazakhstan |
| 815 | Issyk-Kul Lake | Issyk-Kul | Kyrgyzstan |
| 816 | Pamir Highway | Gorno-Badakhshan | Tajikistan |
| 817 | Iskanderkul Lake | Sughd | Tajikistan |
| 818 | Darvaza Gas Crater | Derweze | Turkmenistan |
| 819 | Ancient Merv | Mary | Turkmenistan |
| 820 | Khongoryn Els | Ömnögovi | Mongolia |
| 821 | Genghis Khan Statue | Töv | Mongolia |
| 822 | Erdene Zuu Monastery | Kharkhorin | Mongolia |
| 823 | Lake Khövsgöl | Khövsgöl | Mongolia |
| 824 | Gergeti Trinity Church | Kazbegi | Georgia |
| 825 | Narikala Fortress | Tbilisi | Georgia |
| 826 | Vardzia | Aspindza | Georgia |
| 827 | Uplistsikhe | Gori | Georgia |
| 828 | Khor Virap Monastery | Ararat | Armenia |
| 829 | Geghard Monastery | Kotayk | Armenia |
| 830 | Lake Sevan | Sevan | Armenia |
| 831 | Flame Towers | Baku | Azerbaijan |
| 832 | Gobustan Petroglyphs | Gobustan | Azerbaijan |

## 🏝️ Oceania — teal `#1F6E6A`
| # | Landmark | City | Country |
|---|---|---|---|
| 833 | Wave Rock | Hyden | Australia |
| 834 | Pinnacles Desert | Cervantes | Australia |
| 835 | Kata Tjuta | Northern Territory | Australia |
| 836 | Kings Canyon | Watarrka | Australia |
| 837 | Litchfield National Park | Northern Territory | Australia |
| 838 | Lord Howe Island | Lord Howe Island | Australia |
| 839 | Flinders Ranges | South Australia | Australia |
| 840 | Byron Bay Lighthouse | Byron Bay | Australia |
| 841 | Karijini National Park | Western Australia | Australia |
| 842 | Coober Pedy | South Australia | Australia |
| 843 | Lake Hillier | Middle Island | Australia |
| 844 | Port Arthur | Tasmania | Australia |
| 845 | Surfers Paradise | Gold Coast | Australia |
| 846 | kunanyi / Mount Wellington | Hobart | Australia |
| 847 | Cathedral Cove | Coromandel | New Zealand |
| 848 | Pancake Rocks | Punakaiki | New Zealand |
| 849 | Mount Taranaki | Taranaki | New Zealand |
| 850 | That Wanaka Tree | Wanaka | New Zealand |
| 851 | Fox Glacier | Westland | New Zealand |
| 852 | Cape Reinga | Northland | New Zealand |
| 853 | Doubtful Sound | Fiordland | New Zealand |
| 854 | Sky Tower | Auckland | New Zealand |
| 855 | Moeraki Boulders | Otago | New Zealand |
| 856 | Nan Madol | Pohnpei | Micronesia |
| 857 | Chuuk Lagoon | Chuuk | Micronesia |
| 858 | Rock Islands | Koror | Palau |
| 859 | Rarotonga | Rarotonga | Cook Islands |
| 860 | Alofaaga Blowholes | Savai'i | Samoa |
| 861 | Haʻamonga ʻa Maui Trilithon | Tongatapu | Tonga |
| 862 | Champagne Beach | Espiritu Santo | Vanuatu |
| 863 | Mamanuca Islands | Mamanuca | Fiji |
| 864 | Isle of Pines | Isle of Pines | New Caledonia |
| 865 | Kokoda Track | Oro | Papua New Guinea |
| 866 | Marovo Lagoon | Western Province | Solomon Islands |
| 867 | Moorea | Moorea | French Polynesia |

## 🗽 North America — forest green `#2E6B4E`
| # | Landmark | City | Country |
|---|---|---|---|
| 868 | One World Trade Center | New York | United States |
| 869 | Independence Hall | Philadelphia | United States |
| 870 | Freedom Trail | Boston | United States |
| 871 | Fenway Park | Boston | United States |
| 872 | U.S. Capitol | Washington, D.C. | United States |
| 873 | Jefferson Memorial | Washington, D.C. | United States |
| 874 | Walt Disney World | Orlando | United States |
| 875 | Southernmost Point | Key West | United States |
| 876 | Lombard Street | San Francisco | United States |
| 877 | Bixby Bridge | Big Sur | United States |
| 878 | Lake Tahoe | California | United States |
| 879 | Devils Tower | Wyoming | United States |
| 880 | Canyonlands National Park | Utah | United States |
| 881 | Capitol Reef National Park | Utah | United States |
| 882 | The Wave (Coyote Buttes) | Arizona | United States |
| 883 | Saguaro National Park | Arizona | United States |
| 884 | Meteor Crater | Arizona | United States |
| 885 | Garden of the Gods | Colorado Springs | United States |
| 886 | Great Sand Dunes | Colorado | United States |
| 887 | Mount Hood | Oregon | United States |
| 888 | Multnomah Falls | Oregon | United States |
| 889 | Palouse Falls | Washington | United States |
| 890 | Glacier Bay | Alaska | United States |
| 891 | Pearl Harbor | Honolulu | United States |
| 892 | Waikiki Beach | Honolulu | United States |
| 893 | Navy Pier | Chicago | United States |
| 894 | Graceland | Memphis | United States |
| 895 | Hoover Dam | Nevada | United States |
| 896 | Biltmore Estate | Asheville | United States |
| 897 | Cape Hatteras Lighthouse | Outer Banks | United States |
| 898 | Columbia Icefield | Alberta | Canada |
| 899 | Capilano Suspension Bridge | Vancouver | Canada |
| 900 | Virginia Falls (Nahanni) | Northwest Territories | Canada |
| 901 | Thousand Islands | Ontario | Canada |
| 902 | Percé Rock | Quebec | Canada |
| 903 | Montmorency Falls | Quebec City | Canada |
| 904 | Signal Hill | St. John's | Canada |
| 905 | Dinosaur Provincial Park | Alberta | Canada |
| 906 | Pacific Rim National Park | Vancouver Island | Canada |
| 907 | Drumheller Badlands | Drumheller | Canada |
| 908 | Cenote Dos Ojos | Quintana Roo | Mexico |
| 909 | Hierve el Agua | Oaxaca | Mexico |
| 910 | Uxmal | Yucatán | Mexico |
| 911 | Isla Holbox | Quintana Roo | Mexico |
| 912 | Puerto Vallarta Malecón | Puerto Vallarta | Mexico |
| 913 | Cascadas de Agua Azul | Chiapas | Mexico |
| 914 | Xochimilco | Mexico City | Mexico |
| 915 | Basilica of Guadalupe | Mexico City | Mexico |
| 916 | Marietas Islands | Nayarit | Mexico |
| 917 | El Tajín | Veracruz | Mexico |
| 918 | Semuc Champey | Alta Verapaz | Guatemala |
| 919 | Pacaya Volcano | Escuintla | Guatemala |
| 920 | Copán Ruins | Copán | Honduras |
| 921 | Roatán | Bay Islands | Honduras |
| 922 | Santa Ana Volcano | Santa Ana | El Salvador |
| 923 | Granada | Granada | Nicaragua |
| 924 | Ometepe Island | Rivas | Nicaragua |
| 925 | Masaya Volcano | Masaya | Nicaragua |
| 926 | Poás Volcano | Alajuela | Costa Rica |
| 927 | Tortuguero National Park | Limón | Costa Rica |
| 928 | Casco Viejo | Panama City | Panama |
| 929 | San Blas Islands | Guna Yala | Panama |
| 930 | Caracol | Cayo | Belize |
| 931 | Viñales Valley | Pinar del Río | Cuba |
| 932 | Zona Colonial | Santo Domingo | Dominican Republic |
| 933 | El Morro (Old San Juan) | San Juan | Puerto Rico |
| 934 | El Yunque Rainforest | Río Grande | Puerto Rico |
| 935 | Exuma Swimming Pigs | Exuma | Bahamas |
| 936 | Willemstad | Willemstad | Curaçao |
| 937 | Eagle Beach | Oranjestad | Aruba |
| 938 | Brimstone Hill Fortress | St. Kitts | Saint Kitts and Nevis |
| 939 | Boiling Lake | Roseau | Dominica |
| 940 | Nelson's Dockyard | English Harbour | Antigua and Barbuda |
| 941 | The Baths | Virgin Gorda | British Virgin Islands |
| 942 | Grace Bay | Providenciales | Turks and Caicos |

## ⛰️ South America — plum `#6D3A6E`
| # | Landmark | City | Country |
|---|---|---|---|
| 943 | Avenida Paulista (MASP) | São Paulo | Brazil |
| 944 | Pelourinho | Salvador | Brazil |
| 945 | Chapada dos Veadeiros | Goiás | Brazil |
| 946 | Jericoacoara | Ceará | Brazil |
| 947 | Ilha Grande | Rio de Janeiro | Brazil |
| 948 | Paraty Historic Center | Rio de Janeiro | Brazil |
| 949 | Meeting of Waters | Manaus | Brazil |
| 950 | Olinda Historic Center | Pernambuco | Brazil |
| 951 | Brasília Cathedral | Brasília | Brazil |
| 952 | Aparados da Serra (Itaimbezinho) | Rio Grande do Sul | Brazil |
| 953 | Recoleta Cemetery | Buenos Aires | Argentina |
| 954 | Casa Rosada | Buenos Aires | Argentina |
| 955 | Aconcagua | Mendoza | Argentina |
| 956 | Talampaya National Park | La Rioja | Argentina |
| 957 | Ischigualasto | San Juan | Argentina |
| 958 | Salinas Grandes | Jujuy | Argentina |
| 959 | Península Valdés | Chubut | Argentina |
| 960 | Cueva de las Manos | Santa Cruz | Argentina |
| 961 | Mar del Plata | Buenos Aires Province | Argentina |
| 962 | Valle de la Luna | Atacama | Chile |
| 963 | Laguna San Rafael | Aysén | Chile |
| 964 | Osorno Volcano | Los Lagos | Chile |
| 965 | Lake Chungará | Arica | Chile |
| 966 | Robinson Crusoe Island | Juan Fernández | Chile |
| 967 | San Cristóbal Hill | Santiago | Chile |
| 968 | Cochamó Valley | Los Lagos | Chile |
| 969 | Villarrica Volcano | Pucón | Chile |
| 970 | Kuélap | Amazonas | Peru |
| 971 | Ballestas Islands | Paracas | Peru |
| 972 | Máncora Beach | Piura | Peru |
| 973 | Historic Center of Lima | Lima | Peru |
| 974 | Manú National Park | Madre de Dios | Peru |
| 975 | Huascarán (Cordillera Blanca) | Áncash | Peru |
| 976 | Tambopata National Reserve | Madre de Dios | Peru |
| 977 | Las Lajas Sanctuary | Ipiales | Colombia |
| 978 | Salt Cathedral of Zipaquirá | Zipaquirá | Colombia |
| 979 | San Andrés Island | San Andrés | Colombia |
| 980 | Villa de Leyva | Boyacá | Colombia |
| 981 | Monserrate | Bogotá | Colombia |
| 982 | Rosario Islands | Cartagena | Colombia |
| 983 | Mitad del Mundo | Quito | Ecuador |
| 984 | Chimborazo | Riobamba | Ecuador |
| 985 | Nariz del Diablo | Alausí | Ecuador |
| 986 | Yasuní National Park | Orellana | Ecuador |
| 987 | Yungas Road (Death Road) | La Paz | Bolivia |
| 988 | Tiwanaku | La Paz | Bolivia |
| 989 | Laguna Colorada | Potosí | Bolivia |
| 990 | Cerro Rico | Potosí | Bolivia |
| 991 | Sucre Historic City | Sucre | Bolivia |
| 992 | Médanos de Coro | Coro | Venezuela |
| 993 | Morrocoy National Park | Falcón | Venezuela |
| 994 | Iwokrama Forest | Iwokrama | Guyana |
| 995 | Paramaribo Historic Inner City | Paramaribo | Suriname |
| 996 | Central Suriname Nature Reserve | Sipaliwini | Suriname |
| 997 | Colonia del Sacramento | Colonia | Uruguay |
| 998 | Casapueblo | Punta Ballena | Uruguay |
| 999 | Ybycuí National Park | Paraguarí | Paraguay |
| 1000 | Devil's Island (Îles du Salut) | Kourou | French Guiana |
