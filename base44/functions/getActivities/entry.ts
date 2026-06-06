/**
 * ============================================================================
 * GLOBESKIMMERS — getActivities v4.0
 * ============================================================================
 * Worldwide: landmarks, museums, parks, tours, nightlife, sports, beaches,
 * cultural experiences, theme parks, historic sites.
 * v3.0 changes:
 *  - safeLower() fix (r.text object crash)
 *  - Nearby search fallback when text search yields < 5 results
 *  - Wikipedia API integration for top 10 results
 *  - Review sentiment: highlights + warnings + bestTime
 *  - editorialSummary passthrough from Google
 *  - Audience detection: couples, seniors, pet-friendly
 * ============================================================================
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";
const TTL    = 60 * 60 * 6; // 6 hours

// Universal queries — run on every search regardless of where the user
// is. Trimmed from 70 -> ~36 by dropping rare/regional terms that
// almost never returned non-duplicate results outside specific
// geographies. Region-specific queries below are layered in
// conditionally to keep coverage without paying the round-trip cost
// in places where they're useless.
//
// Categorization mirrors the way travelers actually think about their
// day:
//   - LANDMARKS & CULTURE: the "must-see" spine of any trip
//   - NATURE & OUTDOORS:   parks, viewpoints, scenic spots
//   - WATER:               anything you do in or on water (universal —
//                          inland lakes/rivers + coastal both apply)
//   - MOUNTAIN/ADVENTURE:  rock climbing, zip line, caves, canyons
//                          (Google returns 0 in flat regions, fine)
//   - WELLNESS:            spa + massage + hot spring — universal per
//                          founder direction (every culture has spas)
//   - TOURS & EXPERIENCES: tour_mode metadata derived from the query
//                          (walking/biking/boating) so the frontend can
//                          show "🚶 Walking tour" without re-parsing
//   - ENTERTAINMENT:       theme parks, theaters, casinos
//   - NIGHTLIFE:           bars, clubs, breweries
//   - FAMILY:              zoo, aquarium, mini golf
const QUERIES = [
  // Landmarks & Culture
  "tourist attraction","historic landmark","monument","heritage site",
  "museum","art gallery","cultural center",
  // Nature & Outdoors
  "national park","nature reserve","botanical garden",
  "scenic viewpoint","hiking trail","beach","waterfall",
  "lighthouse","ancient ruins",
  // Water (universal: inland + coastal)
  "kayaking","canoeing","snorkeling","swimming hole","river swimming",
  // Mountain & Adventure (universal: Google returns 0 in flat regions)
  "rock climbing","zip line","cave","canyon",
  // Wellness (universal per founder direction — every culture has these)
  "spa","massage","hot spring",
  // Tours & Experiences (tour_mode derived from the query name)
  "guided tour","walking tour","bike tour","boat tour","food tour",
  // Entertainment
  "theme park","amusement park","water park","theater",
  // Nightlife
  "rooftop bar","night club","winery","distillery",
  // Family
  "zoo","aquarium",
];

// Country-conditional queries — added on top of the universal list
// when the user is somewhere they actually apply. Cuts ~5 round-trips
// from cold loads outside these regions while preserving coverage
// where it matters. Country names match the values returned by
// Google's reverse geocode (countryName arg).
const REGIONAL_QUERIES: Record<string,string[]> = {
  // East Asian onsen culture — Japan + Korea + Taiwan keep the "onsen"
  // shorthand even when the local word differs (jjimjilbang / wenquan)
  // because that's the term tourists search for.
  Japan:        ['onsen'],
  'South Korea':['onsen','jjimjilbang'],
  Taiwan:       ['onsen','hot spring resort'],
  // Hammam belt — N. Africa + Levant + Turkey. The term reads as
  // a venue type, not a region tag, so even non-Muslim travelers in
  // these countries search for it as the "must-do" spa experience.
  Morocco:      ['hammam','souk'],
  Tunisia:      ['hammam'],
  Egypt:        ['hammam','souk'],
  Turkey:       ['hammam','turkish bath'],
  Jordan:       ['hammam'],
  'United Arab Emirates': ['hammam','souk'],
};

// Tour-mode mapping — each query in QUERIES that's a tour gets a
// transportation mode so the frontend can show "🚶 Walking tour" /
// "🚴 Bike tour" / "⛵ Boat tour" without re-parsing the venue name.
// Generic "guided tour" is left null because the mode is genuinely
// unknown (could be a Segway tour, a bus tour, anything).
const TOUR_MODE_BY_QUERY: Record<string,string> = {
  'walking tour': 'walking',
  'food tour':    'walking',  // food tours are walking 95% of the time
  'bike tour':    'biking',
  'boat tour':    'boating',
};

// Named-landmark seed queries by city / region / country. These run
// inside Stage B (Regional Gems) IN ADDITION TO the generic
// "top attractions in <region>" queries so we GUARANTEE the staple
// attractions surface rather than hoping Google's generic ranker
// picks them. Without this, a Bohol-Philippines user could land on
// the page with NO Chocolate Hills card even though it's the
// region's most iconic landmark — Google's "things to do in Bohol"
// occasionally returns less-iconic spots.
//
// Lookup chain in stage B: city -> region -> country, all OR'd
// together and deduped. So "Tagbilaran, Bohol, Philippines" pulls
// from Tagbilaran (none), Bohol (Chocolate Hills, Tarsier, Loboc),
// AND Philippines (jeepney ride, island hopping). Stage B caps
// the staple-query count to keep per-load wall-clock bounded.
//
// Keys MUST match exactly what Google's reverse-geocode returns for
// address.country / address.state / address.city — case-sensitive
// substring match would be wrong (e.g. "London" in "New London CT").
// Add new keys whenever a user reports a missing staple in their
// region — this is a cheap, focused, no-downside addition.
const STAPLE_LANDMARKS: Record<string, string[]> = {
  // ── East Asia ──────────────────────────────────────────────────
  Japan:       ['cherry blossoms','sakura viewing','Mount Fuji','tea ceremony'],
  Tokyo:       ['Shibuya crossing','Sensoji temple','Tokyo Skytree','Tsukiji outer market','Meiji shrine','teamLab planets'],
  Kyoto:       ['Fushimi Inari shrine','Kinkakuji','Arashiyama bamboo grove','Gion district','Kiyomizu-dera'],
  Osaka:       ['Osaka Castle','Dotonbori','Universal Studios Japan','Shitennoji'],
  'South Korea':['Gyeongbokgung palace','Bukchon hanok village','Nami island'],
  Seoul:       ['Gyeongbokgung palace','Bukchon hanok village','N Seoul Tower','Myeongdong','Insadong'],
  Taiwan:      ['Taipei 101','Taroko gorge','night market','Sun Moon Lake'],
  Taipei:      ['Taipei 101','Shilin night market','Chiang Kai-shek memorial','Longshan temple'],
  China:       ['Great Wall of China','Forbidden City','Terracotta Army'],
  Beijing:     ['Great Wall of China','Forbidden City','Temple of Heaven','Summer Palace'],
  'Hong Kong': ['Victoria Peak','Star Ferry','Tian Tan Buddha','Symphony of Lights'],

  // ── Southeast Asia ─────────────────────────────────────────────
  Philippines: ['jeepney ride','island hopping','halo halo'],
  Bohol:       ['Chocolate Hills','Tarsier sanctuary','Loboc river cruise','Panglao beach','Hinagdanan cave','Sandugo blood compact marker'],
  Cebu:        ['Magellan Cross','Basilica Santo Nino','Kawasan Falls','Oslob whale shark watching','Temple of Leah'],
  Palawan:     ['Puerto Princesa underground river','El Nido island hopping','Coron lagoons','Honda Bay'],
  Manila:      ['Intramuros','Rizal Park','Fort Santiago','National Museum of the Philippines','Binondo Chinatown'],
  Boracay:     ['White Beach','Puka Shell Beach','Mount Luho','Ariels Point cliff jumping'],
  Vietnam:     ['Ha Long Bay','Mekong delta','pho','egg coffee'],
  Hanoi:       ['Hoan Kiem lake','Temple of Literature','Old Quarter','Ho Chi Minh mausoleum'],
  'Ho Chi Minh City': ['Cu Chi tunnels','War Remnants Museum','Notre-Dame Saigon','Ben Thanh market'],
  Thailand:    ['Grand Palace','floating market','Phi Phi Islands','Buddhist temple'],
  Bangkok:     ['Grand Palace','Wat Pho','Wat Arun','Chatuchak market','Khao San road'],
  'Chiang Mai':['Doi Suthep','Old City temples','Night Bazaar','Elephant Nature Park'],
  Indonesia:   ['Borobudur','Komodo dragon','rice terraces'],
  Bali:        ['Tegalalang rice terraces','Tanah Lot','Uluwatu temple','Mount Batur sunrise','Ubud monkey forest','Gili Islands'],
  Singapore:   ['Marina Bay Sands','Gardens by the Bay','Sentosa','Merlion park','Hawker centre'],
  Malaysia:    ['Petronas Towers','Batu Caves','Penang street art'],
  Cambodia:    ['Angkor Wat','Ta Prohm','Bayon temple','Tonle Sap'],
  Laos:        ['Luang Prabang','Kuang Si falls','Plain of Jars'],

  // ── South Asia ─────────────────────────────────────────────────
  India:       ['Taj Mahal','Ganges','Holi festival','tuk tuk ride'],
  Delhi:       ['Red Fort','Qutub Minar','India Gate','Humayuns Tomb'],
  Mumbai:      ['Gateway of India','Marine Drive','Elephanta Caves','Dharavi tour'],
  Jaipur:      ['Amber Fort','Hawa Mahal','City Palace','Jantar Mantar'],
  Agra:        ['Taj Mahal','Agra Fort','Mehtab Bagh'],
  'Sri Lanka': ['Sigiriya','tea plantations','Galle Fort','elephant safari'],
  Nepal:       ['Mount Everest','Annapurna','Pashupatinath','Boudhanath'],

  // ── Middle East ────────────────────────────────────────────────
  'United Arab Emirates': ['Burj Khalifa','Burj Al Arab','desert safari','Dubai Mall'],
  Dubai:       ['Burj Khalifa','Burj Al Arab','Palm Jumeirah','desert safari','Dubai Fountain','Dubai Mall'],
  Turkey:      ['Cappadocia balloon ride','Pamukkale','Bosphorus cruise'],
  Istanbul:    ['Hagia Sophia','Blue Mosque','Grand Bazaar','Topkapi Palace','Bosphorus cruise'],
  Jordan:      ['Petra','Wadi Rum','Dead Sea'],
  Israel:      ['Western Wall','Dead Sea','Masada'],

  // ── North Africa ───────────────────────────────────────────────
  Egypt:       ['Pyramids of Giza','Sphinx','Nile cruise','Karnak temple'],
  Cairo:       ['Pyramids of Giza','Sphinx','Egyptian Museum','Khan el-Khalili'],
  Morocco:     ['Sahara desert tour','Atlas Mountains','medina'],
  Marrakech:   ['Jemaa el-Fnaa','Bahia Palace','Majorelle Garden','Medina souk'],

  // ── Sub-Saharan Africa ─────────────────────────────────────────
  Kenya:       ['Maasai Mara safari','Mount Kenya','Diani Beach'],
  Tanzania:    ['Serengeti safari','Mount Kilimanjaro','Zanzibar','Ngorongoro Crater'],
  'South Africa': ['Table Mountain','Kruger safari','Robben Island'],
  'Cape Town': ['Table Mountain','Cape of Good Hope','Robben Island','V&A Waterfront'],

  // ── Europe ─────────────────────────────────────────────────────
  France:      ['Eiffel Tower','Louvre','Versailles'],
  Paris:       ['Eiffel Tower','Louvre','Notre-Dame','Sacre-Coeur','Champs-Elysees','Seine river cruise','Versailles'],
  Italy:       ['Colosseum','Vatican','gondola ride','Cinque Terre'],
  Rome:        ['Colosseum','Vatican Museums','Trevi Fountain','Pantheon','Roman Forum'],
  Venice:      ['gondola ride','St Marks Square','Doges Palace','Rialto bridge','Murano glass'],
  Florence:    ['Uffizi Gallery','Duomo','Ponte Vecchio','Accademia Galleria'],
  Spain:       ['Sagrada Familia','flamenco','Alhambra','tapas tour'],
  Barcelona:   ['Sagrada Familia','Park Guell','Casa Batllo','Gothic Quarter','La Rambla'],
  Madrid:      ['Prado Museum','Royal Palace','Retiro Park','Plaza Mayor'],
  Granada:     ['Alhambra','Generalife gardens','Albaicin'],
  'United Kingdom':['Stonehenge','Buckingham Palace','Roman Baths'],
  London:      ['Tower of London','Buckingham Palace','British Museum','London Eye','Westminster Abbey','Tower Bridge'],
  Germany:     ['Neuschwanstein Castle','Brandenburg Gate','Christmas market'],
  Berlin:      ['Brandenburg Gate','Reichstag','Berlin Wall memorial','Museum Island'],
  Netherlands: ['canal cruise','tulip fields','windmills'],
  Amsterdam:   ['Anne Frank House','Van Gogh Museum','Rijksmuseum','canal cruise'],
  Greece:      ['Acropolis','Santorini sunset','Mykonos'],
  Athens:      ['Acropolis','Parthenon','Plaka','Ancient Agora'],
  Portugal:    ['Pena Palace','port wine tour','Belem Tower'],
  Lisbon:      ['Belem Tower','Jeronimos Monastery','tram 28','Alfama district'],
  Iceland:     ['Northern Lights','Blue Lagoon','Geysir','Gullfoss waterfall'],
  Reykjavik:   ['Hallgrimskirkja','Blue Lagoon','Golden Circle tour','Northern Lights'],
  Norway:      ['fjord cruise','Northern Lights','Preikestolen','midnight sun'],

  // ── Americas ───────────────────────────────────────────────────
  'United States': [],  // too broad; rely on city-level entries
  'New York':  ['Statue of Liberty','Empire State Building','Central Park','Times Square','9/11 Memorial','Brooklyn Bridge','High Line'],
  'San Francisco': ['Golden Gate Bridge','Alcatraz','Fishermans Wharf','Cable Car','Lombard Street','Painted Ladies'],
  'Los Angeles': ['Hollywood Walk of Fame','Griffith Observatory','Santa Monica Pier','Universal Studios Hollywood'],
  'Las Vegas': ['Las Vegas Strip','Fremont Street','Bellagio fountains','Hoover Dam'],
  Honolulu:    ['Diamond Head','Pearl Harbor','Waikiki Beach','Hanauma Bay'],
  Mexico:      ['Chichen Itza','Teotihuacan','cenote'],
  'Mexico City':['Frida Kahlo Museum','Teotihuacan','Zocalo','Xochimilco'],
  Cancun:      ['Tulum ruins','Chichen Itza day trip','Xcaret','cenote tour'],
  Peru:        ['Machu Picchu','Inca Trail','Rainbow Mountain','Lake Titicaca'],
  Cusco:       ['Machu Picchu','Sacred Valley','Rainbow Mountain','Saksaywaman'],
  Brazil:      ['Christ the Redeemer','Iguazu Falls','Copacabana','Amazon'],
  'Rio de Janeiro':['Christ the Redeemer','Sugarloaf Mountain','Copacabana','Ipanema','Tijuca rainforest'],
  Argentina:   ['Iguazu Falls','Perito Moreno glacier','tango show'],
  'Buenos Aires':['La Boca','Recoleta cemetery','tango show','San Telmo market'],
  Chile:       ['Atacama desert','Easter Island','Patagonia'],
  Cuba:        ['Old Havana','classic car tour','Vinales tobacco farm'],
  Havana:      ['Old Havana','Malecon','classic car tour','Capitolio'],

  // ── Oceania ────────────────────────────────────────────────────
  Australia:   ['Great Barrier Reef','Uluru','Sydney Opera House','Great Ocean Road'],
  Sydney:      ['Sydney Opera House','Sydney Harbour Bridge','Bondi Beach','Taronga Zoo','Manly Beach'],
  Melbourne:   ['Federation Square','Great Ocean Road','Queen Victoria Market','MCG','Royal Botanic Gardens'],
  'New Zealand':['Hobbiton','Milford Sound','glacier hike','Tongariro crossing'],
  Auckland:    ['Sky Tower','Waiheke Island','Auckland Zoo'],
  Queenstown:  ['Bungy jumping','Milford Sound','Lord of the Rings tour','Skyline gondola'],
  Fiji:        ['island hopping','snorkeling','Sigatoka river safari'],

  // ── Eastern Europe & Russia ────────────────────────────────────
  Russia:      ['Red Square','Hermitage Museum','Trans-Siberian','Lake Baikal'],
  Moscow:      ['Red Square','Saint Basil Cathedral','Kremlin','Bolshoi Theatre','Gorky Park'],
  'Saint Petersburg':['Hermitage Museum','Peterhof Palace','Church of the Savior on Spilled Blood'],
  Poland:      ['Wawel Castle','Auschwitz Birkenau','Wieliczka salt mine'],
  Warsaw:      ['Warsaw Old Town','Royal Castle','Wilanow Palace','Lazienki Park'],
  Krakow:      ['Wawel Castle','Auschwitz Birkenau','Wieliczka salt mine','Main Market Square'],
  'Czech Republic':['Prague Castle','Charles Bridge','Cesky Krumlov'],
  Prague:      ['Prague Castle','Charles Bridge','Old Town Square','Astronomical Clock','Petrin Tower'],
  Hungary:     ['Buda Castle','Hungarian Parliament','thermal baths'],
  Budapest:    ['Buda Castle','Hungarian Parliament','Szechenyi thermal bath','Fishermans Bastion','Chain Bridge'],
  Croatia:     ['Plitvice Lakes','Dubrovnik Old Town','Diocletian Palace'],
  Dubrovnik:   ['Dubrovnik Old Town','City Walls','Lokrum island','Game of Thrones tour'],
  Romania:     ['Bran Castle','Peles Castle','Transfagarasan'],
  Bucharest:   ['Palace of the Parliament','Old Town','Romanian Athenaeum'],
  Ukraine:     ['Kyiv Pechersk Lavra','Saint Sophia Cathedral','Lviv Old Town'],

  // ── Scandinavia & Northern Europe ──────────────────────────────
  Sweden:      ['Vasa Museum','ABBA Museum','Gamla Stan','Northern Lights'],
  Stockholm:   ['Vasa Museum','Gamla Stan','Skansen','ABBA Museum','Drottningholm Palace'],
  Denmark:     ['Tivoli Gardens','Nyhavn','Christiansborg Palace'],
  Copenhagen:  ['Tivoli Gardens','Nyhavn','Little Mermaid statue','Christiania','Rosenborg Castle'],
  Finland:     ['Suomenlinna','Northern Lights','Santa Claus Village','Helsinki Cathedral'],
  Helsinki:    ['Suomenlinna','Helsinki Cathedral','Temppeliaukio Church','Market Square'],
  Oslo:        ['Vigeland Park','Viking Ship Museum','Akershus Fortress','Opera House'],
  Bergen:      ['Bryggen wharf','Floyen funicular','fjord cruise','Mount Ulriken'],
  Belgium:     ['Grand Place','Atomium','Bruges canals'],
  Brussels:    ['Grand Place','Atomium','Manneken Pis','Royal Palace'],
  Bruges:      ['Bruges canals','Markt square','Belfry of Bruges','Basilica of the Holy Blood'],
  Ireland:     ['Cliffs of Moher','Ring of Kerry','Guinness Storehouse','Blarney Castle'],
  Dublin:      ['Guinness Storehouse','Trinity College','Temple Bar','Dublin Castle'],
  Switzerland: ['Matterhorn','Jungfraujoch','Lake Geneva','Glacier Express'],
  Zurich:      ['Lake Zurich','Bahnhofstrasse','Old Town','Lindt Home of Chocolate'],
  Austria:     ['Schonbrunn Palace','Hallstatt','Salzburg Old Town'],
  Vienna:      ['Schonbrunn Palace','St Stephens Cathedral','Belvedere Palace','Hofburg','Prater'],

  // ── Central America & Caribbean ────────────────────────────────
  'Costa Rica':['Arenal volcano','Manuel Antonio','Monteverde cloud forest','sloth sanctuary','zip line canopy'],
  Panama:      ['Panama Canal','Casco Viejo','San Blas islands'],
  Guatemala:   ['Tikal','Lake Atitlan','Antigua Guatemala'],
  Belize:      ['Great Blue Hole','barrier reef','Mayan ruins'],
  Nicaragua:   ['Granada','Ometepe island','Mombacho Volcano'],
  Jamaica:     ['Dunns River Falls','Blue Mountains','Bob Marley Museum','Negril beach'],
  'Dominican Republic':['Punta Cana','Saona Island','27 waterfalls','Zona Colonial'],
  Bahamas:     ['Atlantis Paradise Island','swimming pigs','Blue Lagoon','Pink Sand Beach'],
  Barbados:    ['Crane Beach','Harrisons Cave','rum distillery tour'],
  'Puerto Rico':['Old San Juan','El Yunque rainforest','bioluminescent bay'],

  // ── More US & Canada cities ────────────────────────────────────
  Chicago:     ['Millennium Park','Navy Pier','Art Institute of Chicago','Willis Tower','architecture river cruise'],
  Boston:      ['Freedom Trail','Fenway Park','Boston Common','Harvard tour','New England Aquarium'],
  Miami:       ['South Beach','Art Deco district','Wynwood Walls','Everglades airboat','Vizcaya'],
  Seattle:     ['Space Needle','Pike Place Market','Chihuly Garden','Boeing tour'],
  Washington:  ['National Mall','Smithsonian museums','Lincoln Memorial','White House','Capitol'],
  'New Orleans':['French Quarter','Bourbon Street','Garden District','swamp tour','Mardi Gras World'],
  Nashville:   ['Grand Ole Opry','Country Music Hall of Fame','Broadway honky tonks','Parthenon'],
  Orlando:     ['Walt Disney World','Universal Orlando','SeaWorld','Kennedy Space Center'],
  'Grand Canyon':['Grand Canyon South Rim','Skywalk','helicopter tour'],
  Canada:      ['Niagara Falls','CN Tower','Banff','Whistler'],
  Toronto:     ['CN Tower','Niagara Falls day trip','Royal Ontario Museum','Distillery District','Casa Loma'],
  Vancouver:   ['Stanley Park','Capilano Suspension Bridge','Grouse Mountain','Granville Island'],
  Montreal:    ['Old Montreal','Notre-Dame Basilica','Mount Royal','Jean-Talon Market'],

  // ── More European cities ───────────────────────────────────────
  Edinburgh:   ['Edinburgh Castle','Royal Mile','Arthurs Seat','Holyrood Palace','Old Town'],
  Naples:      ['Pompeii','Mount Vesuvius','Naples historic centre','Capri day trip'],
  Milan:       ['Duomo Milano','Last Supper','Galleria Vittorio Emanuele','La Scala','Sforza Castle'],
  Seville:     ['Royal Alcazar','Plaza de Espana','Cathedral of Seville','flamenco show'],
  Munich:      ['Marienplatz','Neuschwanstein day trip','Oktoberfest','BMW Museum','Englischer Garten'],
  Hamburg:     ['Speicherstadt','Miniatur Wunderland','Elbphilharmonie','St Pauli'],
  Frankfurt:   ['Romerberg','Main Tower','Goethe House'],
  Porto:       ['Livraria Lello','Ribeira district','port wine cellar','Douro river cruise','Sao Bento station'],
  Madeira:     ['Funchal cable car','Levada walks','Pico do Areeiro'],
  Malta:       ['Valletta','Blue Lagoon Comino','Mdina','Hagar Qim temples'],

  // ── More Asian destinations ────────────────────────────────────
  Myanmar:     ['Bagan temples','Shwedagon Pagoda','Inle Lake'],
  Bhutan:      ['Tigers Nest Monastery','Punakha Dzong','Thimphu'],
  Mongolia:    ['Gobi Desert','Naadam Festival','Ulaanbaatar'],
  Maldives:    ['overwater bungalow','snorkeling','dolphin cruise','sunset cruise'],

  // ── More Middle East ───────────────────────────────────────────
  'Saudi Arabia':['AlUla','Diriyah','Red Sea diving'],
  Oman:        ['Wadi Shab','Nizwa Fort','Mutrah Souq'],
  Lebanon:     ['Baalbek ruins','Jeita Grotto','Byblos'],

  // ── More African destinations ──────────────────────────────────
  Ethiopia:    ['Lalibela rock churches','Simien Mountains','Danakil Depression'],
  Ghana:       ['Cape Coast Castle','Mole National Park','Kakum canopy walk'],
  Namibia:     ['Sossusvlei dunes','Etosha National Park','Skeleton Coast'],
  Botswana:    ['Okavango Delta safari','Chobe National Park'],
  Madagascar:  ['Avenue of the Baobabs','Tsingy de Bemaraha','lemur watching'],
  Rwanda:      ['gorilla trekking','Volcanoes National Park','Kigali Genocide Memorial'],

  // ── Antarctica / extreme ───────────────────────────────────────
  Antarctica:  ['penguin colonies','iceberg cruise','Antarctic Peninsula'],
};

// Convenience: walk city -> region -> country and gather all
// staple landmarks for the given location. Deduped, capped at 8
// queries to bound per-load cost.
function staplesForLocation(city:string,region:string,country:string):string[]{
  const out:string[]=[];
  if(city    && STAPLE_LANDMARKS[city])    out.push(...STAPLE_LANDMARKS[city]);
  if(region  && STAPLE_LANDMARKS[region])  out.push(...STAPLE_LANDMARKS[region]);
  if(country && STAPLE_LANDMARKS[country]) out.push(...STAPLE_LANDMARKS[country]);
  // Dedupe + cap. Cap is important — without it a city like Tokyo
  // would add ~10 city-staples + 4 country-staples = 14 extra
  // round-trips. 8 is enough to cover the genuine icons.
  return [...new Set(out)].slice(0, 8);
}

// Nearby search types used as fallback when text search yields < 5 results
const NEARBY_TYPES = [
  'tourist_attraction','museum','park','amusement_park','zoo','aquarium',
  'art_gallery','bowling_alley','casino','night_club','spa','stadium',
  'movie_theater','campground',
];

const CATEGORY_NEARBY: Record<string,string[]> = {
  culture:       ['museum','art_gallery','historical_landmark','performing_arts_theater'],
  outdoor:       ['park','national_park','hiking_area','marina','campground'],
  entertainment: ['amusement_center','bowling_alley','movie_theater','casino'],
  nightlife:     ['night_club','bar'],
  family:        ['amusement_park','aquarium','zoo','park'],
  wellness:      ['spa','beauty_salon'],
  adventure:     ['campground','ski_resort','marina','national_park'],
  tours:         ['tourist_attraction','museum'],
};

const SIG = {
  free:        ['free admission','free entry','no charge','no fee','free access','complimentary'],
  family:      ['family','kids','children','all ages','child-friendly','stroller'],
  outdoor:     ['outdoor','outside','open air','nature','trail',
               'hiking','forest','mountain','lake','river','waterfall','canyon','cave',
               'cliff','scenic','campground','wilderness','reef','snorkel','dive',
               'lighthouse','bird watching','wildlife','fishing','volcano'],
  indoor:      ['indoor','inside','air conditioned','museum','gallery','theater'],
  guided:      ['guided','tour guide','expert','led tour','docent','commentary'],
  bucket:      ['bucket list','must see','once in lifetime','world famous','iconic','legendary'],
  hidden:      ['hidden gem','off the beaten','secret','local secret','underrated','undiscovered'],
  photo:       ['photo','instagram','photogenic','beautiful','stunning views','scenic','panoramic'],
  adventure:   ['adventure','thrill','extreme','adrenaline','exciting','challenging'],
  cultural:    ['cultural','traditional','authentic','local','historic','heritage'],
  budget:      ['free','cheap','affordable','budget','inexpensive','worth every penny'],
  accessibility:['wheelchair','accessible','disabled','ada','mobility'],
  couples:     ['romantic','date','couples','honeymoon','anniversary','intimate','perfect for couples'],
  seniors:     ['senior','elderly','easy walk','gentle','leisurely','no stairs','slow pace'],
  petFriendly: ['dog friendly','pet friendly','dogs allowed','pets welcome','bring your dog'],
  // New audience targets per founder direction: surface what's good
  // for groups, solo travelers, and teens.
  //
  // groups: signals that explicitly mention multi-person activities or
  //   the kind of social atmosphere that fits friend groups / bachelor
  //   / bachelorette / coworker outings. NOT 'tour' on its own —
  //   every guided thing has 'tour' in the name, which would over-tag.
  // singles: solo-traveler signals. Includes hostels (where solo
  //   travelers gather) and the "meet people" / "make friends" pattern
  //   from group activities that explicitly welcome solos.
  // teens: teenager-specific activities — high-stimulation,
  //   physical, screen-or-thrill. Distinct from isFamilyFriendly
  //   (which leans toward small kids and strollers) and from
  //   isAdventure (which can be too extreme for teens). Captures
  //   theme parks, arcades, escape rooms, water parks, zip lines,
  //   trampoline parks, go karts, mini golf, and the venue language
  //   that signals "teenagers had a blast here."
  groups:      ['group friendly','perfect for groups','large groups','group activity','team building','party','bachelorette','bachelor party','group rate','group discount'],
  singles:     ['solo traveler','solo travelers','solo friendly','meet people','meet new people','hostel','social hostel','make friends','singles welcome'],
  teens:       ['teen','teenager','teenagers','high school','great for teens','escape room','arcade','theme park','water park','zip line','zipline','trampoline park','go kart','laser tag','mini golf','virtual reality','vr arcade','rope course','ropes course','flow rider','indoor skydiving','bowling','axe throwing','rage room','rock climbing'],
  highlights:  ['amazing','spectacular','breathtaking','incredible','beautiful','must visit','loved it','fantastic','perfect','outstanding','stunning','highly recommend','worth it'],
  warnings:    ['long line','wait time','crowded','expensive','overpriced','disappointing','avoid','rude','dirty','loud','overcrowded','parking issue','too hot','too cold'],
  adultsOnly:  ['shooting range','gun range','clay shooting','skeet shooting','shooting club','axe throwing','rage room','smash room'],
};

const NON_NATURE_TYPES = new Set([
  'museum','art_gallery','historical_landmark','monument','cemetery',
  'church','place_of_worship','city_hall','library','school','university',
  'shopping_mall','store','restaurant','cafe','lodging','hospital',
]);

const NATURE_TYPES = ['park','national_park','campground','natural_feature',
  'hiking_area','state_park','beach','ski_resort','marina'];

function safeLower(v:any):string{
  if(typeof v==='string') return v.toLowerCase();
  if(v==null) return '';
  if(typeof v==='object') return (v.text||'').toLowerCase();
  return String(v).toLowerCase();
}

function sc(t:string,k:string[]){return k.filter(w=>t.includes(w)).length;}
function km(la1:number,lo1:number,la2:number,lo2:number){
  const R=6371,dL=(la2-la1)*Math.PI/180,dN=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dN/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function activityType(name:string,types:string[]){
  const n=name.toLowerCase(); const t=types.join(' ');
  if(/museum|gallery|exhibit/.test(n)||/museum/.test(t))             return {icon:'🏛️',label:'Museum / Gallery',color:'#7C3AED',category:'culture'};
  if(/park|garden|nature|reserve|trail|forest|canyon|cave|waterfall|lake|river|volcano|lighthouse|campground|ruins/.test(n)||/park|natural_feature/.test(t)) return {icon:'🌳',label:'Nature & Outdoors',color:'#059669',category:'outdoor'};
  if(/beach|surf|reef|snorkel|dive|coast/.test(n)||/beach/.test(t))  return {icon:'🏖️',label:'Beach & Water',color:'#0891B2',category:'outdoor'};
  if(/theme park|amusement|water park/.test(n))                      return {icon:'🎢',label:'Theme Park',color:'#DC2626',category:'entertainment'};
  if(/zoo|aquarium|wildlife/.test(n)||/zoo/.test(t))                 return {icon:'🦁',label:'Zoo / Aquarium',color:'#D97706',category:'family'};
  if(/spa|hot spring|onsen|hammam|bath/.test(n))                     return {icon:'♨️',label:'Spa & Wellness',color:'#DB2777',category:'wellness'};
  if(/bar|club|nightlife|brewery|winery|distillery/.test(n))         return {icon:'🍻',label:'Nightlife',color:'#1D4ED8',category:'nightlife'};
  if(/tour|walking|food tour|experience/.test(n))                    return {icon:'🗺️',label:'Tours & Experiences',color:'#F59E0B',category:'tour'};
  if(/historic|heritage|monument|castle|temple|church|cathedral|mosque|shrine/.test(n)||/historical_landmark|place_of_worship/.test(t)) return {icon:'🏰',label:'Historic Site',color:'#92400E',category:'culture'};
  if(/sport|stadium|arena|gym|fitness/.test(n))                      return {icon:'🏟️',label:'Sports & Fitness',color:'#1D4ED8',category:'sport'};
  if(/adventure|climb|zip|surf|dive|skydive/.test(n))                return {icon:'🧗',label:'Adventure',color:'#DC2626',category:'adventure'};
  if(/cooking|class|workshop|lesson/.test(n))                        return {icon:'👨‍🍳',label:'Classes & Workshops',color:'#059669',category:'experience'};
  return {icon:'⭐',label:'Attraction',color:'#F59E0B',category:'attraction'};
}


// ─── D1 attractions integration ──────────────────────────────────────
// Maps the shape D1 returns (clean curated record) into the shape the
// ThingsToDo frontend expects (which was designed around Google
// Places results). Filling these out means the frontend doesn't need
// to know whether a card came from D1 or Places — it just renders.
//
// Category → icon/label/color/parent-category lookup table. Mirrors
// the activityType() heuristics above but is a direct lookup since
// D1 stores a single canonical category string. When a category lands
// outside this table we fall back to the catch-all "Attraction".
const D1_CAT_TABLE: Record<string,{icon:string,label:string,color:string,cat:string}> = {
  museum:        { icon:'🏛️', label:'Museum',          color:'#7C3AED', cat:'culture' },
  landmark:      { icon:'🏛️', label:'Landmark',        color:'#92400E', cat:'culture' },
  viewpoint:     { icon:'📷', label:'Viewpoint',       color:'#059669', cat:'outdoor' },
  beach:         { icon:'🏖️', label:'Beach',           color:'#0891B2', cat:'outdoor' },
  park:          { icon:'🌳', label:'Park',            color:'#059669', cat:'outdoor' },
  national_park: { icon:'🌲', label:'National Park',   color:'#059669', cat:'outdoor' },
  theme_park:    { icon:'🎢', label:'Theme Park',      color:'#DC2626', cat:'entertainment' },
  zoo:           { icon:'🦁', label:'Zoo',             color:'#D97706', cat:'family' },
  aquarium:      { icon:'🐠', label:'Aquarium',        color:'#0891B2', cat:'family' },
  art_gallery:   { icon:'🎨', label:'Art Gallery',     color:'#7C3AED', cat:'culture' },
  historic:      { icon:'🏰', label:'Historic Site',   color:'#92400E', cat:'culture' },
  religious:     { icon:'⛪', label:'Religious Site',  color:'#92400E', cat:'culture' },
  market:        { icon:'🛍️', label:'Market',          color:'#D97706', cat:'culture' },
  monument:      { icon:'🗿', label:'Monument',        color:'#92400E', cat:'culture' },
  nature_reserve:{ icon:'🌿', label:'Nature Reserve',  color:'#059669', cat:'outdoor' },
  waterfall:     { icon:'💧', label:'Waterfall',       color:'#0891B2', cat:'outdoor' },
  garden:        { icon:'🌷', label:'Garden',          color:'#059669', cat:'outdoor' },
  observation_deck:{icon:'🌆',label:'Observation Deck',color:'#7C3AED', cat:'culture' },
  district:      { icon:'🏙️', label:'District',        color:'#1D4ED8', cat:'culture' },
  square:        { icon:'🏛️', label:'Square',          color:'#92400E', cat:'culture' },
  palace:        { icon:'🏰', label:'Palace',          color:'#92400E', cat:'culture' },
  tower:         { icon:'🗼', label:'Tower',           color:'#7C3AED', cat:'culture' },
  cathedral:     { icon:'⛪', label:'Cathedral',       color:'#92400E', cat:'culture' },
  temple:        { icon:'⛩️', label:'Temple',          color:'#92400E', cat:'culture' },
  shrine:        { icon:'⛩️', label:'Shrine',          color:'#92400E', cat:'culture' },
  mosque:        { icon:'🕌', label:'Mosque',          color:'#92400E', cat:'culture' },
  fortress:      { icon:'🏰', label:'Fortress',        color:'#92400E', cat:'culture' },
  wildlife:      { icon:'🦁', label:'Wildlife',        color:'#D97706', cat:'family' },
  experience:    { icon:'🎭', label:'Experience',      color:'#F59E0B', cat:'tour' },
  river:         { icon:'🌊', label:'River',           color:'#0891B2', cat:'outdoor' },
  lake:          { icon:'🏞️', label:'Lake',           color:'#0891B2', cat:'outdoor' },
};

// Map ONE D1 record into the shape ActivityCard renders. Fills in
// empty arrays / nulls for fields the frontend tolerates (badges,
// highlights, etc.) so we don't need any frontend change to start
// serving D1 results.
function mapD1ToActivity(d: any) {
  const distMi = d.distanceMiles ?? 0;
  const ct = D1_CAT_TABLE[d.category] || { icon:'⭐', label:'Attraction', color:'#F59E0B', cat:'attraction' };
  const isOutdoorCat = ['park','national_park','beach','viewpoint','waterfall','nature_reserve','garden','river','lake'].includes(d.category);
  const isIndoorCat = ['museum','art_gallery','observation_deck','cathedral','temple','mosque','shrine','palace','tower','fortress'].includes(d.category);
  const isCulturalCat = ['museum','art_gallery','religious','historic','cathedral','temple','mosque','shrine','monument','palace','fortress'].includes(d.category);
  const isTeenCat = ['theme_park','zoo','aquarium','observation_deck'].includes(d.category);
  return {
    id: d.id,
    placeId: d.id,
    displayName: { text: d.name },
    name: d.name,
    location: { latitude: d.lat, longitude: d.lng },
    lat: d.lat,
    lng: d.lng,
    formattedAddress: [d.city, d.country].filter(Boolean).join(', '),
    shortFormattedAddress: d.city || d.country || '',
    distanceKm: d.distanceKm,
    distanceMiles: distMi,
    distance: `${distMi.toFixed(1)} mi`,
    rating: d.rating ?? null,
    userRatingCount: 0,
    isOpen: null,          // unknown without a Places hit; render leaves the chip in "Hours Unknown" mode
    hours: [],
    currentOpeningHours: { openNow: null, weekdayDescriptions: [] },
    photos: d.photoUrl ? [d.photoUrl] : [],
    photoUrl: d.photoUrl || null,
    photoUrl2: null,
    nationalPhoneNumber: '',
    websiteUri: '',
    googleMapsUri: '',
    activityIcon: ct.icon,
    activityLabel: ct.label,
    activityColor: ct.color,
    activityCategory: ct.cat,
    editorialSummary: d.description || '',
    outdoorContext: null,
    types: [],
    badges: d.isMarquee ? ['🏆 Bucket List'] : [],
    qualityScore: d.isMarquee ? 95 : 80,
    highlights: [],
    warnings: [],
    bestTime: '',
    props: {
      isFree: d.freeToVisit === true,
      isFamilyFriendly: ['zoo','aquarium','theme_park','park','garden'].includes(d.category),
      isOutdoor: isOutdoorCat,
      isIndoor: isIndoorCat,
      hasGuidedTour: false,
      isBucketList: d.isMarquee === true,
      isHiddenGem: false,
      isPhotoWorthy: true,
      isAdventure: false,
      isCultural: isCulturalCat,
      isAccessible: false,
      isBudgetFriendly: d.freeToVisit === true,
      isGoodForCouples: false,
      isSeniorFriendly: false,
      isPetFriendly: false,
      isGoodForGroups: false,
      isGoodForSingles: false,
      isGoodForTeens: isTeenCat,
    },
    tourMode: undefined,
    travelType: distMi > 100 ? '✈️ Flights Required' : distMi > 50 ? '🚗 Drive' : distMi > 15 ? '🚗 Short Drive' : '📍 Nearby',
    // D1-specific extras the frontend can choose to render
    whyVisit: d.whyVisit || '',
    typicalMinutes: d.typicalMinutes || null,
    _source: 'd1',
  };
}

// Fetch the D1 attractions layer. Wraps a network error as a null
// return so the caller falls through to the existing Places-based
// stages. radiusKm is forced to at least 100 km — staple landmarks
// up to ~60 mi out are still relevant (Statue of Liberty when in
// Brooklyn, Versailles when in central Paris, etc.).
//
// Phase B: cityName + countryName are forwarded to the Worker so it
// can trigger a background seed-city task via ctx.waitUntil when D1
// returns sparse. Self-seeding: first user in Boise pays the slow
// Places fallback; the Worker silently seeds Boise into D1; every
// subsequent visitor gets the fast path.
async function fetchD1Attractions(latitude:number, longitude:number, cityName:string, countryName:string) {
  try {
    const r = await fetch(`${WORKER}/attractions/nearby`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        latitude, longitude, radiusKm: 100, limit: 60,
        cityName, countryName,
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data?.attractions) ? data.attractions : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req)=>{
  try {
    const base44=createClientFromRequest(req);
    if(!await base44.auth.me()) return Response.json({error:'Unauthorized'},{status:401});
    const {latitude,longitude,radius=24140,maxResults=30,category='all',smartRadius=false,countryName='',regionName='',cityName='',forceRefresh=false}=await req.json();
    const frParam: Record<string,string> = forceRefresh ? { forceRefresh: 'true' } : {};
    if(!latitude||!longitude) return Response.json({error:'Location required'},{status:400});

    const INNER_RADIUS=40234; // 25 miles in meters
    const useSmartRadius=smartRadius&&radius>INNER_RADIUS;

    // ── STAGE 0 (kicked off immediately): D1 attractions seed ─────────────
    // Single bounding-box query returns the marquee + regional layer for
    // any of the 25 launch cities / 25 launch countries in ~50ms. When
    // it has good coverage (>=8 entries), we skip the slow Stage B
    // Places-based dance entirely. Outside the seeded regions, this
    // returns empty and Stage B picks up the load as before.
    //
    // cityName + countryName forwarded so Phase B auto-seed kicks in for
    // non-launch cities: when the Worker sees sparse D1 coverage, it
    // schedules a background seed task that hand-seeds that region into
    // D1 — the next user who visits the same city gets the fast path.
    const d1Promise = fetchD1Attractions(latitude, longitude, cityName, countryName);

    const map:Record<string,string[]>={
      culture:['museum','gallery','historic','heritage','ancient ruins','cultural center','fine arts'],
      outdoor:['national park','nature','beach','hiking','waterfall','forest','canyon','cave','volcano','river','fishing','reef','lighthouse','ruins','scenic','campground','camping','bird','trail','lake','reserve','sanctuary','botanical','kayaking','canoeing','cliff jumping','swimming hole','parasailing','paragliding','bike rental','fruit picking','bonfire','rafting','white water rafting','island hopping','snowboarding','skiing'],
      entertainment:['theme park','escape room','arcade','live theater','comedy club','virtual reality','live music venue','casino','bowling','cable car','gondola ride','karaoke','batting cage','indoor baseball','go kart','kayaking','canoeing','ice skating','indoor rock climbing','water park','indoor playground','paintball','laser tag','golf range','topgolf','shooting range','clay shooting','trampoline park','beach','axe throwing','rage room','indoor skydiving','skydiving','roller skating','skate park','bumper cars','indoor miniature golf','mini golf','dave and busters','arcade bar','entertainment center','horse racing','racetrack','bullfight','parasailing','paragliding','chocolate making','chocolate factory','fruit picking','bungee jumping','horseshoe toss','billiards','pool hall','ping pong','bonfire','rafting','island hopping','snowboarding','skiing'],
      nightlife:['bar','club','music','brewery','winery','arcade bar','casino','pool hall','billiards','karaoke'],
      family:['zoo','aquarium','childrens museum','family fun center','mini golf','indoor miniature golf','kid friendly activities','interactive exhibits','theme park','cable car','indoor playground','water park','trampoline park','go kart','roller skating','skate park','dave and busters','entertainment center','camping','campground','bike rental','chocolate factory','chocolate making','fruit picking','billiards','ping pong','bonfire'],
      wellness:['spa','hot springs','massage therapy','wellness retreat','onsen','bathhouse'],
      adventure:['rock climbing','zip lining','zipline','ATV trails','atv rental','white water rafting','rafting','scuba diving','bungee jumping','extreme sports','kayaking','indoor skydiving','skydiving','parasailing','paragliding','cliff jumping','island hopping','snowboarding','skiing'],
      tours:['tour','experience','cooking class','chocolate making','island hopping','boat tour'],
    };
    // Universal queries + country-conditional regional queries (e.g.
    // 'onsen' in Japan, 'hammam' in Morocco). The conditional layer
    // only adds 1-3 queries per country so the perf win from the
    // trimmed universal list (~36 vs 70) isn't undone. Category-
    // specific maps stay unchanged — those are filter-specific.
    const regional=REGIONAL_QUERIES[countryName]||[];
    const queries=category==='all'?[...QUERIES,...regional]:(map[category]||[]);

    const seen=new Set<string>(); const places:any[]=[];
    const searchRadius=useSmartRadius?INNER_RADIUS:radius;

    // ── HELPERS (hoisted) ───────────────────────────────────────────────
    // filterJunk + processPlace + popScore are hoisted ABOVE the fetch
    // stages so both the Activity stage (Stages 1+2 below) AND the
    // concurrent National Icons / Regional Gems stage (Stages 3+4 in the
    // IIFE) can use them. Previously these lived between Stage 2 and 3
    // which forced everything to run sequentially.
    const EXCLUDE_TYPES_SET_H = new Set(['cemetery','funeral_home']);
    const EXCLUDE_NAME_RE_H = /\bshrine\b|\bmemorial wall\b|\bplaque\b/i;
    const filterJunkH=(arr:any[])=>arr.filter(p=>{
      const types=p.types||[];
      if(types.some((t:string)=>EXCLUDE_TYPES_SET_H.has(t))) return false;
      if(EXCLUDE_NAME_RE_H.test(p.displayName?.text||p.name||'')) return false;
      return true;
    });
    const processPlaceH=(p:any)=>{
      const lat=p.location?.latitude||0,lng=p.location?.longitude||0;
      const d=km(latitude,longitude,lat,lng);
      const name=p.displayName?.text||p.name||'';
      const revArr=(p.reviews||[]).map((r:any)=>safeLower(r?.text?.text??r?.text??''));
      const rev=revArr.join(' ');
      const txt=`${name.toLowerCase()} ${rev}`;
      const placeTypes=p.types||[];
      const at=activityType(name,placeTypes);
      const isSmallFeature=/waterfall|fountain|pond|stream|creek/.test(name.toLowerCase());
      const isWilderness=placeTypes.some((t:string)=>['national_park','hiking_area','state_park','natural_feature'].includes(t));
      const isInsideManagedPark=placeTypes.some((t:string)=>['botanical_garden','amusement_park','zoo'].includes(t));
      const outdoorContext=isSmallFeature&&!isWilderness?'Walk-through inside a park':isSmallFeature&&isInsideManagedPark?'Managed Park / Walk-through':null;
      // 3 photos per activity card (was 2). Photo references in the search
      // response are free; the actual image fetch via Worker proxy is billed
      // ~$0.005-0.01 each but cached 90 days, and is only loaded when the
      // card is rendered. The user explicitly chose 3 (over 5) for the
      // cost-quality tradeoff (~$54/month at 10K searches vs ~$108).
      const photos=(p.photos||[]).map((ph:any)=>ph.url||ph).filter(Boolean).slice(0,3);
      const hours=p.currentOpeningHours?.weekdayDescriptions||p.regularOpeningHours?.weekdayDescriptions||p.hours||[];
      const editorialSummary=p.editorialSummary?.text||p.editorialSummary||'';
      const highlights=SIG.highlights.filter(w=>rev.includes(w)).slice(0,5);
      const warnings=SIG.warnings.filter(w=>rev.includes(w)).slice(0,4);
      const timeMatches=(rev.match(/\b(morning|afternoon|evening|sunrise|sunset|weekday|weekend|summer|winter|spring|fall|autumn|off.season)\b/gi)||[]);
      const bestTime=timeMatches.length>0?[...new Set(timeMatches.map((s:string)=>s.toLowerCase()))].slice(0,3).join(', '):'';
      const badges:string[]=[];
      if(sc(txt,SIG.bucket)>0)    badges.push('🏆 Bucket List');
      if(sc(txt,SIG.hidden)>0)    badges.push('💎 Hidden Gem');
      if(sc(txt,SIG.photo)>1)     badges.push('📸 Photo Worthy');
      if(sc(txt,SIG.free)>0)      badges.push('🆓 Free Entry');
      if(sc(txt,SIG.family)>0)    badges.push('👨‍👩‍👧 Family Friendly');
      if(sc(txt,SIG.adventure)>0) badges.push('⚡ Adventure');
      if(sc(txt,SIG.cultural)>1)  badges.push('🎭 Authentic Culture');
      if(sc(txt,SIG.adultsOnly)>0||/shooting range|gun club|axe throwing|clay shooting/i.test(name)) badges.push('🔞 Adults Only');
      let qs=50;
      if(p.rating>=4.5) qs+=25; else if(p.rating>=4.0) qs+=15;
      if(p.userRatingCount>1000) qs+=10; else if(p.userRatingCount>200) qs+=5;
      if(sc(txt,SIG.bucket)>0) qs+=10;
      if(sc(txt,SIG.photo)>0)  qs+=5;
      if(sc(txt,SIG.hidden)>0) qs+=5;
      return {
        id:p.id,placeId:p.id,displayName:p.displayName||{text:name},
        name,location:{latitude:lat,longitude:lng},lat,lng,
        formattedAddress:p.formattedAddress||'',shortFormattedAddress:p.shortFormattedAddress||'',
        distanceKm:d,distanceMiles:d*0.621371,distance:`${(d*0.621371).toFixed(1)} mi`,
        rating:p.rating||null,userRatingCount:p.userRatingCount||0,
        isOpen:p.isOpen??null,hours,
        currentOpeningHours:{openNow:p.isOpen,weekdayDescriptions:hours},
        photos,photoUrl:photos[0]||null,photoUrl2:photos[1]||null,
        nationalPhoneNumber:p.nationalPhoneNumber||'',
        websiteUri:p.websiteUri||'',googleMapsUri:p.googleMapsUri||'',
        activityIcon:at.icon,activityLabel:at.label,activityColor:at.color,activityCategory:at.category,
        editorialSummary,outdoorContext,types:placeTypes,
        badges,qualityScore:Math.min(qs,100),highlights,warnings,bestTime,
        props:{
          isFree:sc(txt,SIG.free)>0,isFamilyFriendly:p.goodForChildren===true||sc(txt,SIG.family)>0,
          isOutdoor:(()=>{if(placeTypes.some((t:string)=>NON_NATURE_TYPES.has(t)))return false;return placeTypes.some((t:string)=>NATURE_TYPES.includes(t))||sc(txt,SIG.outdoor)>=2||at.category==='outdoor';})(),
          isIndoor:sc(txt,SIG.indoor)>0,hasGuidedTour:sc(txt,SIG.guided)>0,
          isBucketList:sc(txt,SIG.bucket)>0,isHiddenGem:sc(txt,SIG.hidden)>0,
          isPhotoWorthy:sc(txt,SIG.photo)>1,isAdventure:sc(txt,SIG.adventure)>0,
          isCultural:sc(txt,SIG.cultural)>1,isAccessible:sc(txt,SIG.accessibility)>0,
          isBudgetFriendly:sc(txt,SIG.budget)>0,isGoodForCouples:sc(txt,SIG.couples)>0,
          isSeniorFriendly:sc(txt,SIG.seniors)>0,isPetFriendly:sc(txt,SIG.petFriendly)>0,
          // New audience targets — match the same sc()-on-SIG pattern
          // as couples/seniors so the same review-text mining that
          // surfaces "romantic" for couples surfaces "group friendly"
          // for groups, "solo travelers" for singles, and theme-park-y
          // venue language for teens.
          isGoodForGroups:sc(txt,SIG.groups)>0,
          isGoodForSingles:sc(txt,SIG.singles)>0,
          isGoodForTeens:sc(txt,SIG.teens)>0,
        },
        // tourMode: which way the tour gets around. Derived from the
        // _foundByQuery stamp set in the primary text-search loop.
        // Stays undefined for non-tour results and for generic
        // 'guided tour' results where the mode is genuinely ambiguous.
        // Frontend renders a small "🚶 Walking tour" chip when present.
        tourMode: TOUR_MODE_BY_QUERY[(p as any)._foundByQuery] || undefined,
      };
    };
    const popScoreH=(a:any)=>(a.rating||0)*Math.log10((a.userRatingCount||0)+1);

    // ── STAGE B (concurrent): National Icons → Regional Gems ─────────────
    // Kicked off immediately so it runs in parallel with the Activity
    // stage (Stages 1+2) below. Regional Gems depends on National Icons
    // for dedup, so they remain sequential WITHIN this group. Total wait
    // for the whole function = max(Activity group, Icons+Regional group)
    // instead of the previous sum, cutting ~3-5s off cold loads.
    const iconsAndRegionalPromise = (async ():Promise<{nationalIcons:any[],regionalGems:any[]}>=>{
      // National Icons
      const t1Seen=new Set<string>();
      const t1Places:any[]=[];
      const cn=countryName||'nearby';
      const t1Queries=[`top tourist attractions in ${cn}`,`bucket list landmarks ${cn}`,`famous must see ${cn}`];
      await Promise.all(t1Queries.map(async q=>{
        try{
          const p=new URLSearchParams({query:q,latitude:String(latitude),longitude:String(longitude),radius:'500000',maxResults:'20',cacheTtl:String(TTL),...frParam});
          const r=await fetch(`${WORKER}/places/text-search?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){const id=pl.id;if(id&&!t1Seen.has(id)){t1Seen.add(id);t1Places.push(pl);}}
        }catch{}
      }));
      const t1Processed=filterJunkH(t1Places).map(processPlaceH)
        .filter((a:any)=>(a.rating||0)>=4.0&&(a.userRatingCount||0)>=100)
        .sort((a:any,b:any)=>popScoreH(b)-popScoreH(a))
        .slice(0,40);
      t1Processed.forEach((a:any)=>{
        const mi=a.distanceMiles;
        // >100 mi → "Flights Required" (drops the older "Flight / Ferry
        // Required" wording per user direction; cleaner badge text and
        // covers both the >200 case and the previously-"Long Drive" 100-200
        // case where flights are still the practical option).
        a.travelType=mi>100?'✈️ Flights Required':mi>50?'🚗 Drive':'🚗 Short Drive';
        // Keep all 3 photos (was previously culled to 1 for Tier 1).
      });
      const nationalIcons=t1Processed;

      // Regional Gems (dedup against National Icons).
      //
      // Mixes the generic "top attractions in <region>" queries with
      // named-landmark seed queries from STAPLE_LANDMARKS — that's the
      // guarantee that staples like Chocolate Hills (Bohol), Loboc
      // river cruise (Bohol), cherry blossoms (Japan), Hobbiton (NZ)
      // actually appear in the regional gems strip even when Google's
      // generic ranker doesn't put them at the top for that location.
      //
      // Staple queries are TARGETED — each one names a specific
      // landmark — so Google's text-search reliably returns the
      // exact place card. Together with the generic queries, this
      // gives both breadth (anything in the region) and guaranteed
      // depth (the icons every traveler should see).
      const t2Seen=new Set(nationalIcons.map((a:any)=>a.id));
      const t2Places:any[]=[];
      const rn=regionName||cityName||'nearby';
      const stapleQueries=staplesForLocation(cityName,regionName,countryName);
      const t2Queries=[
        `top attractions in ${rn}`,
        `things to do in ${rn}`,
        `best places to visit ${rn}`,
        ...stapleQueries,
      ];
      await Promise.all(t2Queries.map(async q=>{
        try{
          const p=new URLSearchParams({query:q,latitude:String(latitude),longitude:String(longitude),radius:'160934',maxResults:'20',cacheTtl:String(TTL),...frParam});
          const r=await fetch(`${WORKER}/places/text-search?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){const id=pl.id;if(id&&!t2Seen.has(id)){t2Seen.add(id);t2Places.push(pl);}}
        }catch{}
      }));
      const t2Processed=filterJunkH(t2Places).map(processPlaceH)
        .filter((a:any)=>(a.rating||0)>=3.5)
        .sort((a:any,b:any)=>popScoreH(b)-popScoreH(a))
        .slice(0,20)
        .sort((a:any,b:any)=>(a.distanceMiles||0)-(b.distanceMiles||0));
      t2Processed.forEach((a:any)=>{
        const mi=a.distanceMiles;
        // Match National Icons wording: >100 mi → "Flights Required".
        // Rare for Regional (radius cap ≈ 100mi) but covers the boundary.
        a.travelType=mi>100?'✈️ Flights Required':mi>50?'🚗 Drive':mi>15?'🚗 Short Drive':'📍 Nearby';
        // Keep all 3 photos (was previously culled to 1 for Tier 2).
      });
      return {nationalIcons,regionalGems:t2Processed};
    })();

    // Primary: text search (uses inner radius when smartRadius active).
    //
    // Concurrency bumped from 3 -> 10. The previous batch-of-3 was a
    // throttle from earlier development; the Cloudflare Worker + Google
    // Places API handle 10x+ parallelism without issue and the KV cache
    // makes most repeat calls near-free. With ~36 queries in the
    // universal list, 10-wide concurrency means 4 batches instead of
    // 12 — cuts the Stage A cold-load wall-clock by ~60%.
    //
    // Each pushed place gets `_foundByQuery` stamped on it — the
    // post-processing step (processPlaceH) reads this to derive the
    // `tourMode` field for results that came from a tour-shaped query
    // ("walking tour" -> walking, "bike tour" -> biking, etc).
    const BATCH=10;
    for(let i=0;i<queries.length;i+=BATCH){
      await Promise.all(queries.slice(i,i+BATCH).map(async q=>{
        try{
          const p=new URLSearchParams({query:q,latitude:String(latitude),longitude:String(longitude),radius:String(searchRadius),maxResults:'20',cacheTtl:String(TTL),...frParam});
          const r=await fetch(`${WORKER}/places/text-search?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){
            const id=pl.id;
            if(id&&!seen.has(id)){
              seen.add(id);
              pl._foundByQuery=q;
              places.push(pl);
            }
          }
        }catch{}
      }));
    }

    // Fallback: nearby search when text search yielded < 5 results
    if(places.length<5){
      const nearbyTypes=(CATEGORY_NEARBY[category]||NEARBY_TYPES).slice(0,8);
      await Promise.all(nearbyTypes.map(async t=>{
        try{
          const p=new URLSearchParams({type:t,latitude:String(latitude),longitude:String(longitude),radius:String(searchRadius),maxResults:'10',cacheTtl:String(TTL),...frParam});
          const r=await fetch(`${WORKER}/places/nearby?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){const id=pl.id;if(id&&!seen.has(id)){seen.add(id);places.push(pl);}}
        }catch{}
      }));
    }

    // Smart Radius Pass 2: iconic spots at full radius (25-50mi zone).
    // Same concurrency bump (3 -> 10) as the primary loop above.
    if(useSmartRadius){
      const iconicQueries=['tourist attraction','historic landmark','national park','theme park','amusement park','world heritage site','famous museum','iconic landmark'];
      for(let i=0;i<iconicQueries.length;i+=BATCH){
        await Promise.all(iconicQueries.slice(i,i+BATCH).map(async q=>{
          try{
            const p=new URLSearchParams({query:q,latitude:String(latitude),longitude:String(longitude),radius:String(radius),maxResults:'10',cacheTtl:String(TTL),...frParam});
            const r=await fetch(`${WORKER}/places/text-search?${p}`);
            if(!r.ok) return;
            for(const pl of (await r.json()).places||[]){
              const id=pl.id; if(!id||seen.has(id)) continue;
              // Only include iconic places beyond inner radius with high quality
              const plLat=pl.location?.latitude||0,plLng=pl.location?.longitude||0;
              const dist=km(latitude,longitude,plLat,plLng);
              const distMi=dist*0.621371;
              if(distMi>25&&(pl.rating>=4.5||(pl.rating>=4.0&&(pl.userRatingCount||0)>=500))){
                seen.add(id); places.push(pl);
              }
            }
          }catch{}
        }));
      }
      // Iconic nearby types at full radius
      const iconicNearby=['tourist_attraction','amusement_park','museum'];
      await Promise.all(iconicNearby.map(async t=>{
        try{
          const p=new URLSearchParams({type:t,latitude:String(latitude),longitude:String(longitude),radius:String(radius),maxResults:'10',cacheTtl:String(TTL),...frParam});
          const r=await fetch(`${WORKER}/places/nearby?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){
            const id=pl.id; if(!id||seen.has(id)) continue;
            const plLat=pl.location?.latitude||0,plLng=pl.location?.longitude||0;
            const dist=km(latitude,longitude,plLat,plLng);
            const distMi=dist*0.621371;
            if(distMi>25&&(pl.rating>=4.5||(pl.rating>=4.0&&(pl.userRatingCount||0)>=500))){
              seen.add(id); places.push(pl);
            }
          }
        }catch{}
      }));
    }

    // ── TIER 3: Nearby (uses hoisted helpers) ─────────────────────────
    const nearbyFiltered=filterJunkH(places);
    const nearby=nearbyFiltered.slice(0,60).map(processPlaceH);
    nearby.sort((a:any,b:any)=>b.qualityScore-a.qualityScore||(b.rating||0)-(a.rating||0));

    // ── Merge D1 layer with the existing icons/regional stage ────────────
    //
    // Stage 0 (D1) is the fast path — when it has good coverage for this
    // location, it returns the marquee + regional layer in ~50ms with
    // hand-curated data. Stage B (the existing Places-based icons+regional
    // dance) is slow (~3-5s); we still await it but we treat D1 as the
    // primary source of truth when present.
    //
    // Three cases:
    //   1. D1 has >= 8 results → use D1 entirely; ignore Stage B for the
    //      marquee/regional layer. Stage B already ran (kicked off at
    //      top), so this is "throw away the slow path's result" — saves
    //      no wall-clock but ensures the user sees the curated marquees
    //      at the top instead of whatever Google's generic ranker picked.
    //   2. D1 has 1-7 results → MERGE: D1 marquees at the top, Stage B
    //      results filling in below. Good for partial-coverage cities
    //      like a small Italian town near Rome where D1 has 2 nearby
    //      Rome icons but Stage B finds local gems.
    //   3. D1 returned null/empty → fall back to Stage B entirely
    //      (original behavior preserved).
    const [d1Raw, stageB] = await Promise.all([d1Promise, iconsAndRegionalPromise]);
    const d1Mapped = (d1Raw || []).map(mapD1ToActivity);
    const d1Marquees = d1Mapped.filter((a: any) => a.props?.isBucketList);
    const d1Regulars = d1Mapped.filter((a: any) => !a.props?.isBucketList);

    let nationalIcons: any[];
    let regionalGems: any[];
    if (d1Mapped.length >= 8) {
      // D1 has rich coverage — use it as the authoritative marquee + regional layer.
      nationalIcons = d1Marquees.slice(0, 40);
      regionalGems = d1Regulars.slice(0, 30);
    } else if (d1Mapped.length > 0) {
      // Partial coverage — merge D1 results above Stage B results.
      const stageBIds = new Set(d1Mapped.map((a: any) => a.id));
      nationalIcons = [...d1Marquees, ...stageB.nationalIcons.filter((a: any) => !stageBIds.has(a.id))].slice(0, 40);
      regionalGems = [...d1Regulars, ...stageB.regionalGems.filter((a: any) => !stageBIds.has(a.id))].slice(0, 30);
    } else {
      // No D1 coverage — keep the Stage B Places-based fallback.
      nationalIcons = stageB.nationalIcons;
      regionalGems = stageB.regionalGems;
    }

    // Deduplicate nearby against Tier 1 & 2 (icons get priority)
    const iconIds=new Set([...nationalIcons.map((a:any)=>a.id),...regionalGems.map((a:any)=>a.id)]);
    const dedupedNearby=nearby.filter((a:any)=>!iconIds.has(a.id));

    // ── "About this place" synthesis ─────────────────────────────────────
    // Wikipedia fetch was removed entirely (slow + uneven hit-rate; user
    // direction 2026-05-26). Each activity gets a synthetic aboutText
    // built from already-fetched data (no extra network calls, instant).
    // The frontend reads in this precedence:
    //   1. place.editorialSummary  (Google curated, best quality when present)
    //   2. place.generativeSummary?.overview?.text  (Gemini AI overview,
    //      good for famous places — includes historical context)
    //   3. aboutText  (synthetic fallback, always populated below)
    const allForAbout=[...dedupedNearby,...nationalIcons,...regionalGems];
    for(const a of allForAbout){
      const city=(a.formattedAddress||'').split(',').slice(-3,-1).join(',').trim();
      const cat=a.activityLabel||'attraction';
      const parts:string[]=[`A popular ${cat.toLowerCase()}${city?` in ${city}`:''}.`];
      const tags:string[]=[];
      if(a.props?.isFamilyFriendly) tags.push('Family friendly');
      if(a.props?.isOutdoor) tags.push('Outdoor');
      if(a.props?.isFree) tags.push('Free entry');
      if(a.props?.isAdventure) tags.push('Adventure');
      if(a.props?.isGoodForCouples) tags.push('Great for couples');
      if(tags.length) parts.push(tags.join(' · ')+'.');
      if(a.highlights?.length>0) parts.push(`Visitors love: ${a.highlights.slice(0,3).join(', ')}.`);
      if(a.rating&&a.userRatingCount>0) parts.push(`Rated ${a.rating} by ${a.userRatingCount.toLocaleString()} reviewers.`);
      a.aboutText=parts.join(' ');
    }

    const total=dedupedNearby.length+nationalIcons.length+regionalGems.length;
    // DIAG: photo counts per tier (so user can verify Base44 deploy state in
    // Base44 execution logs). If this line is missing in logs, the deploy
    // hasn't synced and photos will reflect old slice(0,2) + Tier1/2 culling.
    const photoCounts=(arr:any[])=>arr.slice(0,5).map((a:any)=>a.photos?.length||0).join(',');
    console.log(`📷 v6 photos | T1(icons):[${photoCounts(nationalIcons)}] T2(regional):[${photoCounts(regionalGems)}] T3(nearby):[${photoCounts(dedupedNearby)}]`);
    // Diagnostic: how much of the icons/regional layer came from D1 vs
    // Stage B (Places). Lets us verify the D1 seed is actually being
    // hit + which cities still rely on the Places fallback. Visible in
    // Base44 execution logs after each invocation.
    const d1Count = [...nationalIcons, ...regionalGems].filter((a: any) => a._source === 'd1').length;
    console.log(`🗂️ D1 layer: ${d1Count}/${nationalIcons.length + regionalGems.length} from curated D1 seed (rest from Places fallback)`);
    return Response.json({activities:dedupedNearby,nationalIcons,regionalGems,count:total,version:'v6.1-d1'});
  } catch(e:any){
    return Response.json({error:e.message,activities:[]},{status:200});
  }
});
