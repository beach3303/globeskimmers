"""Hand-added supplement: famous filming spots outside the US/UK-heavy Wikidata set
(Asia, Africa, Latin America & Caribbean, Middle East, Pacific), plus three
founder-named Western spots Wikidata misses.

Every entry is only a CLAIM TO VERIFY. s6_curated.py keeps an entry only when an
English Wikipedia article states it: the spot's article mentions the work
(`ft` terms, case-sensitive), or the work's article mentions the spot (`st`
terms), or one of the `extra` articles does. Matching sentences become the
evidence (curated_evidence.csv); the scene lines in curated_scenes.py are
written from that evidence only. Coordinates always come from the spot's
Wikidata item (P625) or the article's GeoData point - never typed by hand.

Fields
  article  spot's enwiki article (optional when qid is given)
  qid      explicit Wikidata item for the spot (used when the article is about
           something larger, e.g. Maya Bay's article redirects to the island)
  name     display name override
  work     the work's enwiki article
  cls      spot class -> radius_m (see RADIUS in s8_build.py)
  ft / st  evidence terms (see above);  extra: more articles to search
  flags    reviewer flags carried to the CSV
Rejected during verification (no Wikipedia statement found) - kept here as a
record so nobody re-adds them unsourced: see REJECTED at the bottom.
"""

def E(article, work, cls, ft, st, region, **kw):
    d = {"article": article, "work": work, "cls": cls, "ft": ft, "st": st, "region": region}
    d.update(kw)
    return d

TOWN = ["city_level_suspect"]
BIG = ["large_area_centroid"]

C = [
    # ---------------- Southeast Asia ----------------
    E("Ko Phi Phi Le", "The Beach (film)", "beach", ["The Beach"], ["Maya Bay"], "asia", qid="Q13024284", name="Maya Bay"),
    E("Khao Phing Kan", "The Man with the Golden Gun (film)", "natural", ["Golden Gun"], ["Khao Phing Kan"], "asia", name="Khao Phing Kan (James Bond Island)"),
    E("Ta Prohm", "Lara Croft: Tomb Raider", "building", ["Tomb Raider"], ["Ta Prohm"], "asia"),
    E("Angkor Wat", "In the Mood for Love", "building", ["In the Mood for Love"], ["Angkor Wat"], "asia"),
    E("Hạ Long Bay", "Kong: Skull Island", "natural", ["Kong: Skull Island"], ["Hạ Long"], "asia", flags=BIG),
    E("Hạ Long Bay", "Indochine (film)", "natural", ["Indochine"], ["Ha Long"], "asia", flags=BIG),
    E("Tràng An", "Kong: Skull Island", "natural", ["Kong: Skull Island"], ["Tràng An"], "asia", flags=BIG),
    E("Tú Làn Caves System", "Kong: Skull Island", "natural", ["Kong"], ["Tú Làn"], "asia"),
    E("Padang Padang Beach", "Eat Pray Love", "beach", ["Eat Pray Love"], ["Padang Padang"], "asia"),
    E("Petronas Towers", "Entrapment (film)", "building", ["Entrapment"], ["Petronas"], "asia"),
    E("Marina Bay Sands", "Crazy Rich Asians (film)", "building", ["Crazy Rich Asians"], ["Marina Bay Sands"], "asia"),
    E("Gardens by the Bay", "Crazy Rich Asians (film)", "park", ["Crazy Rich Asians"], ["Supertree Grove"], "asia", qid="Q120450702", name="Supertree Grove, Gardens by the Bay"),
    E("Newton Food Centre", "Crazy Rich Asians (film)", "cafe", ["Crazy Rich Asians"], ["Newton Food Centre"], "asia"),
    E("Raffles Hotel", "Crazy Rich Asians (film)", "building", ["Crazy Rich Asians"], ["Raffles Hotel"], "asia"),
    E("CHIJMES", "Crazy Rich Asians (film)", "building", ["Crazy Rich Asians"], ["CHIJMES"], "asia"),
    E("Cheong Fatt Tze Mansion", "Indochine (film)", "building", ["Indochine", "Crazy Rich Asians"], ["Cheong Fatt Tze"], "asia"),
    E("Cheong Fatt Tze Mansion", "Crazy Rich Asians (film)", "building", ["Crazy Rich Asians"], ["Cheong Fatt Tze"], "asia"),
    E("Kellie's Castle", "Anna and the King", "castle", ["Anna and the King"], ["Kellie"], "asia"),
    E("Hotel Continental Saigon", "The Quiet American (2002 film)", "building", ["Quiet American"], ["Continental"], "asia"),
    E("Hotel Continental Saigon", "Indochine (film)", "building", ["Indochine"], ["Continental"], "asia"),
    # ---------------- South Asia ----------------
    E("Kitulgala", "The Bridge on the River Kwai", "natural", ["River Kwai"], ["Kitulgala"], "asia", flags=TOWN, name="Kelani River at Kitulgala"),
    E("Chhatrapati Shivaji Terminus", "Slumdog Millionaire", "station", ["Slumdog"], ["Chhatrapati Shivaji"], "asia"),
    E("Lake Palace", "Octopussy", "building", ["Octopussy"], ["Lake Palace"], "asia"),
    E("Jag Mandir", "Octopussy", "building", ["Octopussy"], ["Jag Mandir"], "asia"),
    E("Monsoon Palace", "Octopussy", "building", ["Octopussy"], ["Monsoon Palace"], "asia"),
    E("City Palace, Udaipur", "Octopussy", "castle", ["Octopussy"], ["Shiv Niwas"], "asia"),
    E("Mehrangarh", "The Dark Knight Rises", "castle", ["Dark Knight"], ["Mehrangarh"], "asia"),
    E("Mehrangarh", "The Jungle Book (1994 film)", "castle", ["Jungle Book"], ["Mehrangarh"], "asia"),
    E("Pangong Tso", "3 Idiots", "natural", ["3 Idiots"], ["Pangong"], "asia", flags=BIG, cc="IN"),
    E("Druk White Lotus School", "3 Idiots", "building", ["3 Idiots"], ["Druk White Lotus"], "asia"),
    E("Ramanagara", "Sholay", "mountain", ["Sholay"], ["Ramanagara"], "asia", flags=TOWN, name="Ramagiri (Sholay) hills, Ramanagara"),
    E("Jaisalmer Fort", "Sonar Kella", "castle", ["Sonar Kella"], ["Jaisalmer"], "asia"),
    E("Nahargarh Fort", "Rang De Basanti", "castle", ["Rang De Basanti"], ["Nahargarh"], "asia"),
    E("Dudhsagar Falls", "Chennai Express", "natural", ["Chennai Express"], ["Dudhsagar"], "asia"),
    E("Athirappilly Falls", "Baahubali: The Beginning", "natural", ["Baahubali"], ["Athirappilly"], "asia"),
    E("Ramoji Film City", "Baahubali: The Beginning", "set", ["Baahubali"], ["Ramoji"], "asia"),
    E("Betaab Valley", "Betaab", "natural", ["Betaab"], ["Betaab Valley"], "asia"),
    E("Chapora Fort", "Dil Chahta Hai", "castle", ["Dil Chahta Hai"], ["Chapora"], "asia"),
    E("Howrah Bridge", "Lion (2016 film)", "bridge", ["Lion"], ["Howrah"], "asia"),
    E("Howrah Bridge", "Howrah Bridge (film)", "bridge", ["Howrah Bridge (1958)"], ["Howrah Bridge"], "asia"),
    E("Rinpung Dzong", "Little Buddha", "castle", ["Little Buddha"], ["Paro"], "asia"),
    # ---------------- East Asia ----------------
    E("Forbidden City", "The Last Emperor", "castle", ["The Last Emperor"], ["Forbidden City"], "asia"),
    E("Jiuzhaigou", "Hero (2002 film)", "natural", ["film Hero"], ["Jiuzhaigou"], "asia", flags=BIG),
    E("Hongcun", "Crouching Tiger, Hidden Dragon", "village", ["Crouching Tiger"], ["Hongcun"], "asia", flags=TOWN),
    E("Xitang", "Mission: Impossible III", "village", ["Mission: Impossible"], ["Xitang"], "asia", flags=TOWN),
    E("Hengdian World Studios", "Hero (2002 film)", "set", ["movie Hero"], ["Hengdian"], "asia"),
    E("Chungking Mansions", "Chungking Express", "building", ["Chungking Express"], ["Chungking Mansions"], "asia"),
    E("Central–Mid-Levels escalator", "Chungking Express", "street", ["Chungking Express"], ["Mid-Levels"], "asia"),
    E("Central–Mid-Levels escalator", "The Dark Knight", "street", ["Dark Knight"], ["Mid-Levels escalator"], "asia"),
    E("Yick Cheong Building", "Transformers: Age of Extinction", "building", ["Transformers"], ["Yick Cheong", "Quarry Bay"], "asia", flags=["evidence_weak"]),
    E("Two International Finance Centre", "The Dark Knight", "building", ["Dark Knight"], ["International Finance Centre"], "asia"),
    E("The Peninsula Hong Kong", "The Dark Knight", "building", ["Dark Knight"], ["Peninsula"], "asia"),
    E("Jiufen", "A City of Sadness", "village", ["City of Sadness"], ["Jiufen"], "asia", flags=TOWN),
    E("Park Hyatt Tokyo", "Lost in Translation (film)", "building", ["Lost in Translation"], ["Park Hyatt"], "asia", name="Park Hyatt Tokyo (Shinjuku Park Tower)"),
    E("Shibuya Crossing", "Lost in Translation (film)", "square", ["Lost in Translation"], ["Shibuya Crossing"], "asia"),
    E("Fushimi Inari-taisha", "Memoirs of a Geisha (film)", "park", ["Memoirs of a Geisha"], ["Fushimi Inari"], "asia"),
    E("Kiyomizu-dera", "Memoirs of a Geisha (film)", "building", ["Memoirs of a Geisha"], ["Kiyomizu"], "asia"),
    E("Himeji Castle", "You Only Live Twice (film)", "castle", ["You Only Live Twice"], ["Himeji"], "asia"),
    E("Engyō-ji", "The Last Samurai", "building", ["Last Samurai"], ["Engyō-ji"], "asia"),
    E("Shinmoedake", "You Only Live Twice (film)", "mountain", ["You Only Live Twice"], ["Shinmoe"], "asia"),
    E("Suga Shrine (Shinjuku)", "Your Name", "stairs", ["Your Name"], ["Suga Shrine"], "asia", name="Suga Shrine stairs", flags=["animated_depiction"]),
    E("Shinjuku Gyoen", "The Garden of Words", "park", ["Garden of Words"], ["Shinjuku Gyoen"], "asia", flags=["animated_depiction"]),
    E("Kamakurakōkōmae Station", "Slam Dunk (manga)", "street", ["Slam Dunk"], ["Kamakurakōkōmae"], "asia", qid="Q119693119",
      name="Kamakurakōkōmae railway crossing", work_type="tv", flags=["animated_depiction", "work_qid_is_manga"]),
    E("Namiseom", "Winter Sonata", "park", ["Winter Sonata"], ["Namiseom"], "asia", name="Nami Island"),
    E("Mona Yongpyong", "Winter Sonata", "park", ["Winter Sonata"], ["Yongpyong"], "asia"),
    E("Mona Yongpyong", "Guardian: The Lonely and Great God", "park", ["Goblin"], ["Yongpyong"], "asia"),
    E(None, "All In (TV series)", "natural", [], ["Seopjikoji"], "asia", qid="Q12601839", name="Seopjikoji"),
    # ---------------- Middle East ----------------
    E("Wadi Rum", "Lawrence of Arabia (film)", "natural", ["Lawrence of Arabia"], ["Wadi Rum"], "me", flags=BIG),
    E("Wadi Rum", "The Martian (film)", "natural", ["The Martian"], ["Wadi Rum"], "me", flags=BIG),
    E("Wadi Rum", "Rogue One", "natural", ["Rogue One"], ["Wadi Rum"], "me", flags=BIG),
    E("Wadi Rum", "Prometheus (2012 film)", "natural", ["Prometheus"], ["Wadi Rum"], "me", flags=BIG),
    E("Al-Khazneh", "Indiana Jones and the Last Crusade", "building", ["Last Crusade"], ["Khazneh"], "me"),
    E("Burj Khalifa", "Mission: Impossible – Ghost Protocol", "building", ["Ghost Protocol"], ["Burj Khalifa"], "me"),
    E("Emirates Palace", "Furious 7", "building", ["Fast and Furious 7", "Furious 7"], ["Emirates Palace"], "me"),
    E("Liwa Oasis", "Star Wars: The Force Awakens", "natural", ["Force Awakens"], ["Liwa"], "me", flags=BIG),
    E("Grand Bazaar, Istanbul", "Skyfall", "building", ["Skyfall"], ["Grand Bazaar"], "me"),
    E("Spice Bazaar", "Skyfall", "building", ["Skyfall"], ["Spice Bazaar"], "me"),
    E("Varda Viaduct", "Skyfall", "viaduct", ["Skyfall"], ["Varda"], "me"),
    E("Basilica Cistern", "From Russia with Love (film)", "building", ["From Russia with Love"], ["Basilica Cistern"], "me"),
    E("Basilica Cistern", "Inferno (2016 film)", "building", ["Inferno"], ["Basilica Cistern", "cistern"], "me"),
    E("Hagia Sophia", "From Russia with Love (film)", "building", ["From Russia with Love"], ["Hagia Sophia"], "me"),
    E("Sirkeci railway station", "From Russia with Love (film)", "station", ["From Russia with Love"], ["Sirkeci"], "me"),
    E("Maiden's Tower", "The World Is Not Enough", "building", ["The World Is Not Enough"], ["Maiden's Tower"], "me"),
    E("Küçüksu Palace", "The World Is Not Enough", "building", ["The World Is Not Enough"], ["Küçüksu"], "me"),
    E("Avdat", "Jesus Christ Superstar (film)", "building", ["Jesus Christ Superstar"], ["Avdat"], "me"),
    # ---------------- Africa ----------------
    E("Aït Benhaddou", "Gladiator (2000 film)", "castle", ["Gladiator"], ["Aït Benhaddou"], "africa"),
    E("Aït Benhaddou", "Lawrence of Arabia (film)", "castle", ["Lawrence of Arabia"], ["Aït Benhaddou"], "africa"),
    E("Aït Benhaddou", "Game of Thrones", "castle", ["Game of Thrones"], ["Aït Benhaddou"], "africa"),
    E("Atlas Studios", "Kingdom of Heaven (film)", "set", ["Kingdom of Heaven", "Gladiator", "Kundun", "Asterix"], ["Atlas Studios"], "africa",
      extra=["Ouarzazate"], flags=["evidence_weak"]),
    E("Matmata, Tunisia", "Star Wars (film)", "building", ["Star Wars"], ["Sidi Driss"], "africa", qid="Q131315947", name="Hotel Sidi Driss"),
    E("Ksar Ouled Soltane", "Star Wars: Episode I – The Phantom Menace", "castle", ["Phantom Menace"], ["Ouled Soltane"], "africa"),
    E("Ksar Hadada", "Star Wars: Episode I – The Phantom Menace", "castle", ["Phantom Menace"], ["Hadada"], "africa"),
    E("Chott el Djerid", "Star Wars (film)", "natural", ["Star Wars"], ["Chott el Djerid"], "africa", flags=BIG),
    E("Ajim", "Star Wars (film)", "village", ["Star Wars"], ["Ajim"], "africa", flags=TOWN),
    E("Ribat of Monastir", "Monty Python's Life of Brian", "castle", ["Life of Brian"], ["Monastir"], "africa"),
    E("Amphitheatre of El Jem", "Monty Python's Life of Brian", "building", ["Life of Brian"], ["El Jem"], "africa"),
    E("Karnak", "The Spy Who Loved Me (film)", "building", ["Spy Who Loved Me"], ["Karnak"], "africa"),
    E("Karnak", "Death on the Nile (1978 film)", "building", ["Death on the Nile"], ["Karnak"], "africa"),
    E("Abu Simbel temples", "Death on the Nile (1978 film)", "building", ["Death on the Nile"], ["Abu Simbel"], "africa"),
    E("Abu Simbel temples", "The Spy Who Loved Me (film)", "building", ["Spy Who Loved Me"], ["Abu Simbel"], "africa"),
    E("Great Sphinx of Giza", "The Spy Who Loved Me (film)", "building", ["Spy Who Loved Me"], ["Sphinx"], "africa"),
    E("Mosque of Ibn Tulun", "The Spy Who Loved Me (film)", "building", ["Spy Who Loved Me"], ["Ibn Tulun"], "africa"),
    E("Gayer-Anderson Museum", "The Spy Who Loved Me (film)", "building", ["Spy Who Loved Me"], ["Gayer-Anderson"], "africa"),
    E("Deadvlei", "The Cell (film)", "natural", ["The Cell"], ["Deadvlei"], "africa"),
    E("Deadvlei", "The Fall (2006 film)", "natural", ["The Fall"], ["Deadvlei"], "africa"),
    E("Kolmanskop", "Dust Devil (film)", "village", ["Dust Devil"], ["Kolmanskop"], "africa"),
    E("Spitzkoppe", "2001: A Space Odyssey", "mountain", ["Space Odyssey"], ["Spitzkoppe"], "africa", flags=["evidence_weak"]),
    E("Essaouira", "Game of Thrones", "village", ["Game of Thrones"], ["Essaouira"], "africa", flags=TOWN, extra=["Valar Dohaeris"],
      name="Skala (fortified harbour), Essaouira"),
    E("Essaouira", "Othello (1951 film)", "village", ["Othello"], ["Essaouira", "Mogador"], "africa", flags=TOWN,
      name="Skala (fortified harbour), Essaouira"),
    # ---------------- Latin America & Caribbean ----------------
    E("Mismaloya", "The Night of the Iguana (film)", "beach", ["Night of the Iguana"], ["Mismaloya"], "latam"),
    E("Zócalo", "Spectre (2015 film)", "square", ["Spectre"], ["Zócalo"], "latam"),
    E("Gran Hotel Ciudad de México", "Spectre (2015 film)", "building", ["Spectre"], ["Gran Hotel"], "latam"),
    # no P17 on the item; the article and the Titanic article place it at Rosarito, Mexico
    E("Baja Studios", "Titanic (1997 film)", "set", ["Titanic"], ["Baja Studios"], "latam", cc="MX"),
    E("Real de Catorce", "The Mexican", "village", ["The Mexican"], ["Real de Catorce"], "latam", flags=TOWN),
    E("Eyipantla Falls", "Apocalypto", "natural", ["Apocalypto"], ["Eyipantla"], "latam"),
    E("Tikal Temple IV", "Star Wars (film)", "building", ["Star Wars"], ["Tikal"], "latam"),
    E("Sugarloaf Mountain", "Moonraker (film)", "mountain", ["Moonraker"], ["Sugarloaf"], "latam"),
    E("Iguazu Falls", "The Mission (1986 film)", "natural", ["The Mission"], ["Iguazu Falls"], "latam", flags=BIG),
    E("Iguazu Falls", "Moonraker (film)", "natural", ["Moonraker"], ["Iguazu"], "latam", flags=BIG),
    E("Casa Rosada", "Evita (1996 film)", "building", ["Evita"], ["Casa Rosada"], "latam"),
    E("ESO Hotel", "Quantum of Solace", "building", ["Quantum of Solace"], ["ESO Hotel"], "latam"),
    E("Salar de Uyuni", "Star Wars: The Last Jedi", "natural", ["Last Jedi"], ["Uyuni"], "latam", flags=BIG),
    E("Machu Picchu", "Transformers: Rise of the Beasts", "building", ["Rise of the Beasts"], ["Machu Picchu"], "latam"),
    E("Angel Falls", "Point Break (2015 film)", "natural", ["Point Break"], ["Angel Falls"], "latam"),
    E("Paraty", "The Twilight Saga: Breaking Dawn – Part 1", "village", ["Breaking Dawn"], ["Paraty"], "latam", flags=TOWN),
    E("Staniel Cay", "Thunderball (film)", "natural", ["Thunderball"], ["Thunderball Grotto", "Staniel Cay"], "latam",
      name="Thunderball Grotto, Staniel Cay", flags=["coord_is_island_not_grotto"]),
    E("Indian River (Dominica)", "Pirates of the Caribbean: Dead Man's Chest", "natural", ["Pirates of the Caribbean"], ["Indian River"], "latam"),
    E("Marigot Bay", "Doctor Dolittle (1967 film)", "beach", ["Doctor Dolittle"], ["Marigot Bay"], "latam"),
    # ---------------- Pacific ----------------
    E("Monuriki", "Cast Away", "natural", ["Cast Away"], ["Monuriki"], "pacific"),
    E("Nanuya Levu", "The Blue Lagoon (1980 film)", "natural", ["Blue Lagoon"], ["Nanuya Levu"], "pacific"),
    # -------- founder-named Western spots missing or city-level in Wikidata --------
    E("Rocky Steps", "Rocky", "stairs", ["Rocky"], ["Rocky Steps"], "west"),
    E("Café des 2 Moulins", "Amélie", "cafe", ["Amélie"], ["Café des 2 Moulins"], "west"),
    E("Joker Stairs", "Joker (2019 film)", "stairs", ["Joker"], ["Joker Stairs"], "west"),
]

REJECTED = {
    # claim: why it was dropped (no English-Wikipedia statement found on 2026-09-28)
    "Haew Suwat Waterfall / The Beach": "no enwiki article; park article silent",
    "State Tower (Lebua Sky Bar) / The Hangover Part II": "neither article mentions the other",
    "Bayon / Lara Croft: Tomb Raider": "not stated",
    "Pagsanjan Falls / Apocalypse Now": "not stated in either article",
    "Galle Fort / Midnight's Children": "not stated",
    "Wulong Karst / Transformers: Age of Extinction": "not stated",
    "Jumunjin breakwater / Goblin": "no article or Wikidata item",
    "Parasite stairs (Jahamun-ro) / Parasite": "no Wikipedia statement; only a road item",
    "Amer Fort / Jodhaa Akbar": "article only mentions the Amber kingdom in the plot, not filming",
    "Old Cataract Hotel / Death on the Nile (1978)": "article mentions the novel, not the film",
    "Karen Blixen Museum / Out of Africa": "no statement that filming happened at the museum",
    "Dunn's River Falls / Dr. No": "already in the Wikidata set (P915 with a spot qualifier)",
    "Escadaria Selarón / The Incredible Hulk": "not stated",
    "Ong Jemel (Mos Espa set) / The Phantom Menace": "no article or Wikidata item with coordinates",
    "Wallilabou Bay / Pirates of the Caribbean": "Wikidata item exists but no Wikipedia text names the bay",
    "Jesuit Stairs, Dubrovnik / Game of Thrones": "no Wikipedia text ties the stairs to the walk of atonement",
    "Zhangjiajie 'Avatar Hallelujah Mountain' / Avatar": "inspiration only - not a filming location",
    "Sirkeci station / Murder on the Orient Express (1974)": "article is about the real train, not the film",
}
