// US state nicknames (founder, 2026-10-05: "the claim of each US state —
// the Sunshine State!") for the state border-crossing stamps. Official or
// best-known nickname per state + DC, keyed by the name the reverse geocoder
// returns in address.state.
export const STATE_INFO = {
  "Alabama": { abbr: "AL", nickname: "The Heart of Dixie" },
  "Alaska": { abbr: "AK", nickname: "The Last Frontier" },
  "Arizona": { abbr: "AZ", nickname: "The Grand Canyon State" },
  "Arkansas": { abbr: "AR", nickname: "The Natural State" },
  "California": { abbr: "CA", nickname: "The Golden State" },
  "Colorado": { abbr: "CO", nickname: "The Centennial State" },
  "Connecticut": { abbr: "CT", nickname: "The Constitution State" },
  "Delaware": { abbr: "DE", nickname: "The First State" },
  "Florida": { abbr: "FL", nickname: "The Sunshine State" },
  "Georgia": { abbr: "GA", nickname: "The Peach State" },
  "Hawaii": { abbr: "HI", nickname: "The Aloha State" },
  "Idaho": { abbr: "ID", nickname: "The Gem State" },
  "Illinois": { abbr: "IL", nickname: "The Prairie State" },
  "Indiana": { abbr: "IN", nickname: "The Hoosier State" },
  "Iowa": { abbr: "IA", nickname: "The Hawkeye State" },
  "Kansas": { abbr: "KS", nickname: "The Sunflower State" },
  "Kentucky": { abbr: "KY", nickname: "The Bluegrass State" },
  "Louisiana": { abbr: "LA", nickname: "The Pelican State" },
  "Maine": { abbr: "ME", nickname: "The Pine Tree State" },
  "Maryland": { abbr: "MD", nickname: "The Old Line State" },
  "Massachusetts": { abbr: "MA", nickname: "The Bay State" },
  "Michigan": { abbr: "MI", nickname: "The Great Lakes State" },
  "Minnesota": { abbr: "MN", nickname: "The Land of 10,000 Lakes" },
  "Mississippi": { abbr: "MS", nickname: "The Magnolia State" },
  "Missouri": { abbr: "MO", nickname: "The Show-Me State" },
  "Montana": { abbr: "MT", nickname: "Big Sky Country" },
  "Nebraska": { abbr: "NE", nickname: "The Cornhusker State" },
  "Nevada": { abbr: "NV", nickname: "The Silver State" },
  "New Hampshire": { abbr: "NH", nickname: "The Granite State" },
  "New Jersey": { abbr: "NJ", nickname: "The Garden State" },
  "New Mexico": { abbr: "NM", nickname: "The Land of Enchantment" },
  "New York": { abbr: "NY", nickname: "The Empire State" },
  "North Carolina": { abbr: "NC", nickname: "The Tar Heel State" },
  "North Dakota": { abbr: "ND", nickname: "The Peace Garden State" },
  "Ohio": { abbr: "OH", nickname: "The Buckeye State" },
  "Oklahoma": { abbr: "OK", nickname: "The Sooner State" },
  "Oregon": { abbr: "OR", nickname: "The Beaver State" },
  "Pennsylvania": { abbr: "PA", nickname: "The Keystone State" },
  "Rhode Island": { abbr: "RI", nickname: "The Ocean State" },
  "South Carolina": { abbr: "SC", nickname: "The Palmetto State" },
  "South Dakota": { abbr: "SD", nickname: "The Mount Rushmore State" },
  "Tennessee": { abbr: "TN", nickname: "The Volunteer State" },
  "Texas": { abbr: "TX", nickname: "The Lone Star State" },
  "Utah": { abbr: "UT", nickname: "The Beehive State" },
  "Vermont": { abbr: "VT", nickname: "The Green Mountain State" },
  "Virginia": { abbr: "VA", nickname: "Old Dominion" },
  "Washington": { abbr: "WA", nickname: "The Evergreen State" },
  "West Virginia": { abbr: "WV", nickname: "The Mountain State" },
  "Wisconsin": { abbr: "WI", nickname: "America's Dairyland" },
  "Wyoming": { abbr: "WY", nickname: "The Equality State" },
  "District of Columbia": { abbr: "DC", nickname: "The Nation's Capital" },
};
export const stateInfo = (name) => STATE_INFO[String(name || "").trim()] || null;

// UK home nations (founder, 2026-10-05): crossing between England, Scotland,
// Wales and Northern Ireland prompts a stamp too. The claim is the native name
// where one is beloved; England and Northern Ireland print without one.
export const UK_NATIONS = {
  "England": { abbr: "ENG", nickname: null },
  "Scotland": { abbr: "SCT", nickname: "Alba" },
  "Wales": { abbr: "WLS", nickname: "Cymru" },
  "Northern Ireland": { abbr: "NIR", nickname: null },
};
// Sub-national border info by country: cc → (region name → { abbr, nickname }).
export const SUBREGIONS = { US: STATE_INFO, GB: UK_NATIONS };
export const regionInfo = (cc, name) => (SUBREGIONS[String(cc || "").toUpperCase()] || {})[String(name || "").trim()] || null;
