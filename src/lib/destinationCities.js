// destinationCities — when someone types a COUNTRY or a large region into the
// package composer ("vietnam", "tuscany"), the worker's /search-location
// rightly answers "too broad" (a hotel search needs a point on the map). This
// map turns that dead end into a choice: the handful of cities a traveler
// most likely meant, as chips. Curated, free, instant — no API call until a
// chip is tapped. Names are what Google resolves cleanly as "City, Country".
//
// Coverage: the ~45 countries Dreamer's Corner preseeds, plus regions the
// gallery hands over by name (Tuscany, Lapland, Bali, Hawaii…) and common
// aliases (USA, UK, Holland, Korea…). Unknown → [] and the composer shows
// the worker's own honest message instead.

const CITIES = {
  "france": ["Paris", "Nice", "Lyon", "Bordeaux", "Marseille", "Strasbourg"],
  "spain": ["Barcelona", "Madrid", "Seville", "Malaga", "Valencia", "Palma de Mallorca"],
  "united states": ["New York", "Los Angeles", "Las Vegas", "Miami", "Orlando", "San Francisco"],
  "italy": ["Rome", "Florence", "Venice", "Milan", "Naples", "Amalfi"],
  "japan": ["Tokyo", "Kyoto", "Osaka", "Sapporo", "Fukuoka", "Naha"],
  "mexico": ["Cancun", "Mexico City", "Cabo San Lucas", "Puerto Vallarta", "Tulum", "Oaxaca"],
  "thailand": ["Bangkok", "Phuket", "Chiang Mai", "Krabi", "Koh Samui", "Pattaya"],
  "greece": ["Athens", "Santorini", "Mykonos", "Heraklion", "Rhodes", "Corfu"],
  "turkey": ["Istanbul", "Antalya", "Goreme", "Bodrum", "Izmir"],
  "united kingdom": ["London", "Edinburgh", "Manchester", "Bath", "Liverpool", "Oxford"],
  "germany": ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Dresden"],
  "portugal": ["Lisbon", "Porto", "Lagos", "Funchal", "Sintra", "Albufeira"],
  "united arab emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Ras Al Khaimah"],
  "indonesia": ["Bali", "Jakarta", "Yogyakarta", "Lombok", "Ubud"],
  "vietnam": ["Hanoi", "Ho Chi Minh City", "Da Nang", "Hoi An", "Nha Trang", "Phu Quoc"],
  "morocco": ["Marrakech", "Fes", "Casablanca", "Chefchaouen", "Agadir", "Tangier"],
  "egypt": ["Cairo", "Luxor", "Hurghada", "Sharm El Sheikh", "Aswan", "Alexandria"],
  "brazil": ["Rio de Janeiro", "Sao Paulo", "Salvador", "Florianopolis", "Foz do Iguacu"],
  "peru": ["Lima", "Cusco", "Arequipa", "Aguas Calientes", "Puno"],
  "iceland": ["Reykjavik", "Akureyri", "Vik", "Selfoss"],
  "switzerland": ["Zurich", "Geneva", "Lucerne", "Interlaken", "Zermatt", "Bern"],
  "croatia": ["Dubrovnik", "Split", "Zagreb", "Hvar", "Zadar"],
  "netherlands": ["Amsterdam", "Rotterdam", "Utrecht", "The Hague"],
  "austria": ["Vienna", "Salzburg", "Innsbruck", "Hallstatt", "Graz"],
  "australia": ["Sydney", "Melbourne", "Cairns", "Gold Coast", "Perth", "Brisbane"],
  "new zealand": ["Auckland", "Queenstown", "Wellington", "Rotorua", "Christchurch"],
  "south korea": ["Seoul", "Busan", "Jeju City", "Gyeongju", "Incheon"],
  "india": ["New Delhi", "Mumbai", "Jaipur", "Goa", "Agra", "Kochi"],
  "philippines": ["Manila", "Cebu City", "Boracay", "El Nido", "Tagbilaran", "Davao City"],
  "costa rica": ["San Jose", "La Fortuna", "Manuel Antonio", "Tamarindo", "Monteverde"],
  "colombia": ["Cartagena", "Bogota", "Medellin", "Santa Marta"],
  "argentina": ["Buenos Aires", "Mendoza", "Bariloche", "Ushuaia", "Salta"],
  "canada": ["Toronto", "Vancouver", "Montreal", "Banff", "Quebec City", "Calgary"],
  "ireland": ["Dublin", "Galway", "Killarney", "Cork", "Dingle"],
  "norway": ["Oslo", "Bergen", "Tromso", "Stavanger", "Alesund"],
  "czechia": ["Prague", "Brno", "Cesky Krumlov", "Karlovy Vary"],
  "hungary": ["Budapest", "Eger", "Debrecen"],
  "poland": ["Krakow", "Warsaw", "Gdansk", "Wroclaw", "Zakopane"],
  "south africa": ["Cape Town", "Johannesburg", "Durban", "Stellenbosch", "Mbombela"],
  "kenya": ["Nairobi", "Mombasa", "Diani Beach", "Nanyuki"],
  "tanzania": ["Zanzibar City", "Arusha", "Dar es Salaam", "Moshi"],
  "jordan": ["Amman", "Wadi Musa", "Aqaba", "Sweimeh"],
  "israel": ["Tel Aviv", "Jerusalem", "Eilat", "Haifa"],
  "singapore": ["Singapore"],
  "malaysia": ["Kuala Lumpur", "George Town", "Langkawi", "Malacca", "Kota Kinabalu"],
  "china": ["Beijing", "Shanghai", "Chengdu", "Xi'an", "Guilin", "Hong Kong"],
  "taiwan": ["Taipei", "Kaohsiung", "Taichung", "Hualien"],
  "cambodia": ["Siem Reap", "Phnom Penh"],
  "laos": ["Luang Prabang", "Vientiane"],
  "sri lanka": ["Colombo", "Galle", "Kandy", "Ella"],
  "nepal": ["Kathmandu", "Pokhara"],
  "chile": ["Santiago", "Valparaiso", "San Pedro de Atacama", "Puerto Natales"],
  "ecuador": ["Quito", "Guayaquil", "Cuenca", "Puerto Ayora"],
  "cuba": ["Havana", "Varadero", "Trinidad"],
  "dominican republic": ["Punta Cana", "Santo Domingo", "Puerto Plata"],
  "jamaica": ["Montego Bay", "Negril", "Ocho Rios", "Kingston"],
  "bahamas": ["Nassau", "George Town"],
  "fiji": ["Nadi", "Denarau Island"],
  "belgium": ["Brussels", "Bruges", "Antwerp", "Ghent"],
  "denmark": ["Copenhagen", "Aarhus"],
  "sweden": ["Stockholm", "Gothenburg", "Malmo"],
  "finland": ["Helsinki", "Rovaniemi", "Turku"],
  "cyprus": ["Paphos", "Limassol", "Ayia Napa"],
  "malta": ["Valletta", "Sliema", "St. Julian's"],
  "oman": ["Muscat", "Salalah"],
  "qatar": ["Doha"],
  "saudi arabia": ["Riyadh", "Jeddah", "AlUla"],
  "mauritius": ["Port Louis", "Grand Baie"],
  "seychelles": ["Victoria"],
  "bhutan": ["Thimphu", "Paro"],
  "uzbekistan": ["Samarkand", "Bukhara", "Tashkent"],
  // Regions the gallery and Dreamer's Corner hand over by name
  "tuscany": ["Florence", "Siena", "Pisa", "Lucca"],
  "sicily": ["Palermo", "Taormina", "Catania", "Syracuse"],
  "sardinia": ["Cagliari", "Olbia", "Alghero"],
  "amalfi coast": ["Amalfi", "Positano", "Sorrento"],
  "provence": ["Aix-en-Provence", "Avignon", "Marseille"],
  "lapland": ["Rovaniemi", "Levi", "Saariselka"],
  "scotland": ["Edinburgh", "Glasgow", "Inverness"],
  "wales": ["Cardiff", "Swansea"],
  "crete": ["Chania", "Heraklion", "Rethymno"],
  "bali": ["Ubud", "Seminyak", "Canggu", "Nusa Dua", "Uluwatu"],
  "okinawa": ["Naha", "Ishigaki", "Onna"],
  "cebu": ["Cebu City", "Mactan", "Moalboal"],
  "palawan": ["El Nido", "Puerto Princesa", "Coron"],
  "yucatan": ["Merida", "Valladolid"],
  "quintana roo": ["Cancun", "Tulum", "Playa del Carmen"],
  "catalonia": ["Barcelona", "Girona", "Tarragona"],
  "andalusia": ["Seville", "Granada", "Malaga", "Cordoba"],
  "bavaria": ["Munich", "Nuremberg", "Garmisch-Partenkirchen"],
  "kerala": ["Kochi", "Munnar", "Alleppey"],
  "rajasthan": ["Jaipur", "Udaipur", "Jodhpur", "Jaisalmer"],
  "corsica": ["Ajaccio", "Bastia", "Calvi", "Porto-Vecchio"],
  "mallorca": ["Palma de Mallorca", "Alcudia", "Soller"],
  "tenerife": ["Santa Cruz de Tenerife", "Costa Adeje"],
  "algarve": ["Lagos", "Albufeira", "Faro", "Tavira"],
  "madeira": ["Funchal"],
  "dolomites": ["Cortina d'Ampezzo", "Bolzano", "Ortisei"],
  "swiss alps": ["Zermatt", "Interlaken", "St. Moritz", "Grindelwald"],
  "french riviera": ["Nice", "Cannes", "Antibes", "Saint-Tropez"],
  "cote d'azur": ["Nice", "Cannes", "Antibes", "Saint-Tropez"],
  "riviera maya": ["Playa del Carmen", "Tulum", "Cancun"],
  "baja california": ["Cabo San Lucas", "La Paz", "Ensenada"],
  "new england": ["Boston", "Portland", "Newport", "Stowe"],
  "pacific northwest": ["Seattle", "Portland", "Vancouver"],
  "caribbean": ["Punta Cana", "Nassau", "Montego Bay", "Aruba", "Barbados", "St. Lucia"],
  "patagonia": ["Bariloche", "El Calafate", "Puerto Natales"],
  "maldives": ["Male"],
  "hawaii": ["Honolulu", "Lahaina", "Lihue", "Kailua-Kona"],
  "california": ["Los Angeles", "San Francisco", "San Diego", "Napa"],
  "florida": ["Miami", "Orlando", "Key West", "Tampa"],
  "texas": ["Austin", "Dallas", "Houston", "San Antonio"],
  "alaska": ["Anchorage", "Juneau", "Fairbanks"],
  "vermont": ["Burlington", "Stowe"],
  "colorado": ["Denver", "Aspen", "Vail", "Colorado Springs"],
  "arizona": ["Phoenix", "Scottsdale", "Sedona", "Tucson"],
  "nevada": ["Las Vegas", "Reno"],
  "utah": ["Salt Lake City", "Moab", "Park City"],
};

const ALIASES = {
  "usa": "united states", "us": "united states", "america": "united states", "united states of america": "united states",
  "uk": "united kingdom", "england": "united kingdom", "britain": "united kingdom", "great britain": "united kingdom",
  "holland": "netherlands", "the netherlands": "netherlands",
  "korea": "south korea", "republic of korea": "south korea",
  "uae": "united arab emirates", "emirates": "united arab emirates",
  "czech republic": "czechia", "turkiye": "turkey",
  "the philippines": "philippines", "the bahamas": "bahamas", "the maldives": "maldives",
  "hong kong": "china", "viet nam": "vietnam", "ivory coast": "cote divoire",
};

// "Việt Nam" / "Türkiye" / "USA " all normalise to a map key.
function keyFor(name) {
  const k = String(name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES[k] || k;
}

// Cities to offer for a country / region name; [] when we have no curated list.
export function citiesFor(name) {
  return CITIES[keyFor(name)] || [];
}
