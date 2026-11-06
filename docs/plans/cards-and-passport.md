# Cards and the passport — what goes where, and how big a card is (proposal, 2026-11-06)

**Status:** DECIDED 2026-11-06 ("yes to all except Passport wrap") and **BUILT the same day** (stamping-v2 7ce51ee
worker + migration, 2dc428a app; Border Watch with it): Greater cards by metro (US counties → Census CSA/CBSA,
73 world metro circles, else the city), twenty numbered never-expiring stamps, Stay + Do, stays private by default
with "Show the hotel's name" and a private note, `POST /admin/city-cards/remap` to fold the old city cards once.
Awaiting push (migration + worker) → the remap → OTA → store builds. Open: the Stay and Do stamp art (word stamps
until then), night lodging sensing, Passport Wrapped (waits).

## The problem (founder, 2026-11-06)

One card per city per year is unrealistic for a traveler. She lives in Arcadia, eats in Santa Clarita and Van
Nuys — three cities, one life in Southern California. She visits Arizona twice a year, stays in Scottsdale, stops
once at a Waffle House in Mesa on the way home — and gets a "Mesa 2026" card she will never fill. A New York trip
would scatter across Manhattan and Brooklyn cards. Cards should be realistic to fill for a visitor and still
meaningful; stays and activities should be collectible; and the passport must keep its integrity.

## 1. The unit: a "Greater" card, not a city card

**Recommendation: one card per metro area ("Greater Phoenix", "Greater Los Angeles", "New York", "Bay Area"),
every stamp still naming its own city small ("Waffle House · Mesa").**

- **United States:** the Census combined statistical area (CSA) where one exists, else the metropolitan area
  (MSA), else the county. The CSA is the trip-sized region: Greater Los Angeles = LA + Orange + Riverside + San
  Bernardino + Ventura (her "SoCal"); the Bay Area = San Francisco + Oakland + San Jose; Greater Phoenix =
  Maricopa + Pinal (Scottsdale, Mesa, Tempe, Chandler). The county → CSA/MSA table is a Census delineation file;
  the worker already learns the county from the geocoder.
- **Everywhere else:** the city as the geocoder names it (Paris is Paris; Brooklyn already comes back as New
  York), plus a curated list of the world's big metros so their parts fold in: Greater London, Tokyo, Metro
  Manila, Greater Toronto, Greater Vancouver, Sydney, Mexico City, São Paulo, Seoul, Bangkok, Kuala Lumpur,
  Hong Kong, Dubai, Istanbul… (≈100 rows, a one-day curation).
- **Friendly names:** "Greater" + the lead city for CSAs/MSAs named for two or three cities; a short override
  list for the handful with their own names (Bay Area, Inland Empire, Twin Cities, Tri-Cities, DFW).
- **Why not the state:** a "California" card with Los Angeles and San Francisco on it is not a place anyone
  collected; and states mean nothing abroad. The state (or country) is the **shelf** the cards sit on.

## 2. Size and life: 20 stamps, numbered, never expiring

**Recommendation: 20 stamps per card; cards are numbered (No. 1, No. 2, …) and never reset by the year.**

- A visitor's Greater Phoenix No. 1 fills across visits over years — four days of eating is ~10 stamps, two
  visits a year fills it. The year shows on each stamp's date and the card shows its span ("Mar 2026 – Nov 2027").
- A local's home metro fills a card in weeks, then No. 2, No. 7… — that is the regular's loop, and the repeat
  counts (×N) on those stamps are exactly what a café partnership measures.
- A full card earns its **completed seal** and a place on the profile shelf; nothing crosses into the passport.
- Repeat visits keep stamping the same slot ×N (as today).

## 3. What a card collects: Eat · Coffee · Shop · Market · Stay · Do

Today: restaurant, coffee, shopping, convenience, market. Add two:

- **Stay** (accommodation): hotels, motels, inns, hostels, rentals. **Private by default:** the card shows "A stay
  in Scottsdale · Nov 3" to everyone else; the hotel's name is stored and shown only to its owner, with a
  per-stamp switch "Show the hotel's name" (the founder would flip it; many won't). A private note ("here for
  Mom's birthday") on any card stamp, never shown. Sensing: at night, a live fix inside a lodging place offers
  "Staying at the Hilton Scottsdale? Add it to your Greater Phoenix card — private unless you say otherwise", in
  the app only, with the privacy line; never an auto-stamp; never on a board or a feed.
- **Do** (activities): ATV, rock climbing, bungee, skydiving, escape rooms, boat and bus tours, classes, local
  museums and galleries, aquariums and zoos without the fame bar, concerts at ordinary venues.

## 4. Passport or card: the one rule

**Would you brag about having been there, or just remember it?** Brag → the passport. Remember → a card.

Operationally: a place in the stampable catalog (the fame bar: world / national / regional / event-gated, as
`stamp-worthiness-philosophy` says) is a **passport** stamp, verified. Any other business a finder shows is a
**card** stamp, by its type. Nothing moves between the two.

| The passport (verified presence, worth a brag) | A card (where you went, worth remembering) |
|---|---|
| Iconic landmarks and natural wonders: Eiffel Tower, Niagara Falls, Empire State, Grand Canyon | Restaurants, cafés, shops, markets, convenience |
| Theme parks (Disneyland), national and state parks | Stays: hotels, motels, inns, rentals (private by default) |
| World-famous museums: the Louvre, the Met, the Uffizi, the British Museum | Local museums, galleries, aquariums, zoos without the fame bar |
| Major events and concerts at major venues, event-gated: Coachella, a stadium tour | Activities and tours: ATV, climbing, bungee, skydiving, escape rooms, boat tours, classes |
| Airports, state and country crossings, the home city | Concerts and shows at ordinary venues |
| Local favorites approved by the community (as today) | Viewpoints and spots without the fame bar |

The founder's own calls, kept: concerts → passport when the event is big enough to be event-gated (Coachella,
a stadium tour), card otherwise; museums → the famous ones in the passport, the rest on cards; theme parks and
Disneyland → passport; skydiving, ATV, bungee, rock climbing → cards.

## 5. Quiet monetization: the ledger is the card

Every card stamp carries the business's stable id (the Google place id or the owned id), the metro, the date and
the repeat count — the hotel's id too, even when the name is hidden. That is the counts-only, anonymous ledger
the North Star's partnerships read from: which restaurants, cafés and hotels get stamped most, by metro and by
month, how many come back. Nothing a member sees changes; no per-member data ever leaves; the privacy rules for
sensing apply. Later: a partner's own stamp art on its card slot (the "official partner stamp").

## 6. What it takes

- **Data:** the county → CSA/MSA table (Census), the world-metro curation (~100 rows), the two new categories'
  stamp art (4 designs each, as the others have).
- **Worker + migration:** `api.city_cards` becomes area cards (`area_key`, no `year`, 20 slots, `stamps` up to 20);
  `city_card_stamps` gains `category` 'stay' and 'do', `name_hidden` (stays), `note` (private); existing city cards
  fold into their metro's card No. 1, 2… in date order (a stamp keeps its city for the small line).
- **App:** the card page (20 slots, the city line, the completed seal, the shelf by state/country), the Stay and
  Do stamping doors on the place pages and in sensing, the privacy switch and the note.
- Three to four days, one push with a migration, one OTA.

## Stays: the privacy spec (founder, 2026-11-06: "privacy by not posting the name of the accommodation, and an
optional way to post the name of the hotel if they want to")

**Two promises.** The hotel's name is yours: stored for you, shown to others only when you say so, stamp by
stamp. Nobody is told where you sleep: by default a stay reads as a kind and a place, never a name.

1. **What others see by default:** "Accommodation · Scottsdale · Nov 3" on the card, with the Stay art (founder, 2026-11-06: "people can disclose the name of their hotel if they'd like or just make it Accommodation - city"). The city shows
   (the card is a metro, and the same card already says which city you ate in that day); the name never.
2. **What you see:** the hotel's name on your own card, with a small lock glyph meaning "hidden from others".
   Tap the stamp → the switch.
3. **The switch, per stamp:** "Show the hotel's name" — Off: others see "A stay in Scottsdale". On: they see
   "Hilton Scottsdale". Off by default. In Settings, under Virtual Passport: "Show my hotel names by default"
   (off), for the founder's kind of traveler who never minds.
4. **A private note** on any card stamp — "here for Mom's birthday" — never shown to anyone, ever.
5. **Where a stay never appears, switch or no switch:** City Boards and Billboards (no photo, no card), the
   friends' feed "What your friends added" (restaurants and cafés do appear there; stays do not), the card's
   share preview page beyond "Accommodation · Scottsdale", Arrivals, postcards. The card's own visibility (Only me ·
   Friends · Friends & followers · Everyone) still gates the card as a whole.
6. **Minors:** a minor's stay is never shown to others regardless of the switch, and there is no night sensing for
   minors (the teen rails).
7. **Sensing a stay** (in the app only, under the privacy line): between 9 PM and 7 AM local, a live fix inside or
   within 60 m of a lodging place offers "Staying nearby? Add the Hilton Scottsdale to your Greater Phoenix card
   — others see 'Accommodation · Scottsdale' unless you show the name." Once per place per night; "Not this one";
   the one switch covers it. Never an auto-stamp.
8. **The ledger:** every stay stamp keeps the lodging's stable id, the metro and the date, hidden or not; counts
   per hotel are aggregate and anonymous, the same promise as the sensing rules — "counts only, never who". The
   privacy policy says so in one sentence.
9. **Deleting the stamp deletes the name** (and the row); there is no partial "forget the hotel", since the name
   is private already and a stamp without its place is not a stamp.
10. **Data:** `city_card_stamps.category` gains 'stay' and 'do'; `name_hidden boolean not null default true`
    (meaningful for stays; false for the rest); `note text` (private, owner-only in every read). The card read
    returns `name` for the owner always, and for others only when `name_hidden` is false; the share renderer
    follows the same rule. A Settings flag `pp_show_hotel_names` seeds `name_hidden` at stamping time.

**Decided 2026-11-06:** 1–6 yes ("yes to all"); the cards rebuild goes next; Passport Wrapped waits ("except
Passport wrap"); Border Watch rides with the next store builds.

**Built 2026-11-06 — how the area is found:** the worker asks Nominatim for the county of the stamped place (zoom
10, cached a month in KV) and looks it up in `CC_US_METROS` ("AZ|maricopa county" → `csa:429` "Greater Phoenix";
1,915 counties from the Census July 2023 delineations, built by `scratchpad/ports-tools/build-metros.mjs`; names
checked against the Census titles — Baltimore and Providence keep their own cards; "Bay Area", "Twin Cities",
"Dallas–Fort Worth", "South Florida", "Raleigh–Durham"). Abroad, `CC_WORLD_METROS` (73 circles: Greater London 35 km,
Metro Manila 35 km, Bali 60 km, Cancún & the Riviera Maya 70 km …); outside every circle the city stays the area.
The card row carries `area_key` + `area_name`; stamps carry their own `city`. Stays: `name_hidden` (default true;
Settings "Show my hotel names by default" seeds it), masked to "Accommodation" with `place_id: null` for everyone
but the owner, never in the friends' feeds, `note` owner-only (≤ 280 chars). "Where I'm staying" on the Stamp sheet
lists lodging within 400 m of the phone (`places/nearby?types=lodging`).

## Founder's decisions

1. The unit: a "Greater" card by metro (CSA → MSA → county; city abroad with a curated metro list) — yes?
2. Twenty stamps per card — or fifteen?
3. Numbered cards that never expire (No. 1, No. 2 …) instead of a card per year — yes?
4. Stay and Do join the card's categories — yes?
5. Stays private by default, with a per-stamp "Show the hotel's name" and a private note — yes?
6. The passport-or-card table above — anything to move?
7. Order: before or after Border Watch (phase 3) and Passport Wrapped (11-24)?
