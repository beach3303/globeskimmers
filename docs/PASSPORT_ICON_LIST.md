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
