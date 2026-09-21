# Traveler scenarios — what real trips demand of GlobeSkimmers

The founder is dictating real traveler scenarios. Each is recorded here in substance, then
turned into product demands. **Do not design the whole system from one scenario** — the
founder is sending eight to ten. Append each, then look at the set.

Standing rule from the founder (2026-09-17): the app must **ask questions to narrow down what
the traveler truly needs**, and the questions must feel natural. "I don't necessarily want
people to know how we are thinking."

Last updated: 2026-09-20

## Scenario 1 — the founder's own trip to the Philippines

Traveler: Maiza. Home base: a house in Manila. Flies Philippine Airlines only, at a family
discount, so the international airfare is already handled.

- **International airfare: not needed.** Never push it at a traveler who already has it.
- **Arrival buffer.** Does not want to fly onward the same day she lands. Wants one to seven
  days at the Manila house for family and jet lag before any domestic trip.
- **Manila as a stop in its own right.** Events, tours, shows, concerts, games. Other
  travelers arriving in Manila may also need a hotel; she does not.
- **Domestic legs.** Wants ideas for other islands as a round trip from Manila. Named:
  El Nido, Palawan, Cebu, Siargao, Busuanga, Coron, Davao, Boracay.
- **Interests.** Island hopping, snorkelling, kayaking, canoeing, swimming with turtles,
  whale sharks, the sardine run, starfish, white sand, clear water, not crowded. Nature trips.
- **Local tours are the point.** The Cebu whale shark trip is a 6am hotel pickup and a two to
  three hour drive each way. That kind of operator is not on a big ticketing site.
- **The access chain has to be solved end to end.** Boracay: flight Manila to Caticlan, boat
  from Caticlan to the island, then a land transfer to the hotel, and the same in reverse.
  Her hotel there is the Savoy Hotel Boracay, one of several on that strip.
- **Already has the hotel.** Then sell what is around it: transfers, tours, the boat leg.

### What this demands of the product

1. **Ask, don't assume.** A short set of natural questions that establishes home base, whether
   airfare is already handled, how many buffer days before moving on, and what the traveler
   is into.
2. **Trip legs, not one flight.** Model "already in the country" plus a domestic round trip.
3. **An access chain per destination:** flight, boat or ferry, land transfer, each round trip.
   Only offer a destination when the whole chain can be answered.
4. **Interest-led destination picks,** matched on water, quiet and activity, not a generic list.
5. **Local tour supply** for these activities, with pickup time and drive time stated.
6. **City stop mode** for Manila: events, shows, concerts, games, hotel only if wanted.
7. **Already-booked path:** hotel known, so sell the legs and the days, not another hotel.

### What exists today (verified 2026-09-17)

- **Flights:** `/flights/months` returns cached monthly fares between curated hubs and links
  out to Aviasales with our marker. `FLIGHT_HUBS` holds exactly one Philippine hub, Manila,
  so Manila to Caticlan, Cebu, Palawan, Siargao or Busuanga answers `no_hub`. No booking.
- **Hotels:** bookable in the app through Nuitée, plus Stay22 link-outs.
- **Tours:** Viator link-outs. Viator booking access is closed until about Dec 10.
  GetYourGuide appears only in partner tracking, not as a supply source. Klook, the main
  marketplace for Philippine local operators, is not integrated.
- **Ground:** Welcome Pickups, Kiwitaxi and Discover Cars as tracked link-outs.
- **Boats and ferries: nothing at all.** No multi-leg trip model, no buffer days.

### Gaps this scenario opens (candidates, not yet plans)

- Domestic hub coverage in `FLIGHT_HUBS`, or a different fare source for Philippine domestic routes.
- A boat or ferry leg: Caticlan to Boracay, Coron, El Nido. Possible supply: 12Go, Barkota,
  Bookaway. Needs research.
- Island packages priced as one thing: flight, boat, transfer, hotel, tours.
- Local activity supply beyond Viator, most likely Klook for the Philippines.
- The buffer-day question inside the package composer.

## Scenario 2 — the founder's parents, Manila based, one power scooter

Travelers: Mom and Dad, elderly, in their seventies and eighties (dictation unclear, confirm).
Mom walks. Dad uses a **power scooter**, longer than a wheelchair. Neither of them drives, and
they cannot carry their own luggage. Philippine Airlines is free or discounted for them, so
**no airfare is needed** on those routes.

**Trip A, Manila to Los Angeles.** They land at LAX and have to reach Arcadia, California,
about 25 miles away, just the two of them.
- Ride options as the founder ranks them: a private van; any service where someone handles the
  luggage; Uber is viable but the walk to the pickup point is the problem; an airport van
  shuttle with pickup seems the most doable.
- What matters: a short walk from the curb, luggage carried for them, a vehicle that takes the
  power scooter.

**Trip B, Manila to Vietnam, Cambodia or Laos, three travelers.** A 20-year-old woman travels
with them. The parents fly free; the third traveler may or may not need a ticket, so airfare is
per person, not per party.
- A hotel in a **safe area**, with an airport-to-hotel transfer, or another safe way in for two
  elderly travelers and a young woman.
- The most-visited places in the city they are in, and how they would get to them.
- Tours that do not involve getting in and out repeatedly, and that take a power scooter.
- Ideally a hotel they can walk out of, with a mall across the street.
- A **driver for the whole day** with a van or SUV who helps with the scooter, or a round trip
  to each tour.
- A room that accommodates a disabled traveler, and rooms for three: one room that fits three,
  a suite, or two rooms.

### What it demands
1. Airfare is a **per-traveler, per-leg** question. Two people covered, one not.
2. A mobility profile that knows a power scooter is longer than a wheelchair, and that feeds
   vehicle choice, tour choice and room choice.
3. Curb-to-door transfers with luggage help, not just "an airport transfer".
4. Safety as a filter on neighbourhoods and on transport.
5. A full-day driver as a product, not a link-out.
6. Room configuration for a party of three, including an accessible room.

### What is missing today
- We cannot filter hotels for accessible rooms: the LiteAPI facility id is still unknown (G67).
- No transfer partner exposes luggage help or a meet-at-the-curb attribute.
- No full-day driver product; Viator private drivers are only a link-out.
- The composer has no mobility profile (G119, and G110 is waiting on the label).
- Fares for Manila to Ho Chi Minh, Phnom Penh or Vientiane would resolve to Bangkok, the
  nearest curated hub, so the answer would name the wrong airport.

## Scenario 3 — Triston and Ann, two pilots and two children

Travelers: married, 48 and 49, both pilots, with children aged 10 and 8. Free or discounted
Philippine Airlines flights cover Manila to Los Angeles, Manila to San Francisco, Manila to
anywhere in Asia on PAL, and the US to Australia and Japan. **No international airfare needed**
on those routes.

- **In the US they want a rental car.** In Asia they use public transport, without knowing what
  is available, and without knowing whether a destination is worth hiring a driver for the day.
- **The paid leg is domestic:** Los Angeles to New York or New Jersey, where Ann's parents live.
- **No hotel in New York or New Jersey:** they have a home there. They want what to do, for
  adults and children together: parks, theme parks, shopping, restaurants, iconic places. They
  went to Legoland in New Jersey and the Empire State Building (confirm which Legoland).
- Destinations today: Japan, South Korea, Singapore, Hong Kong, Los Angeles.
- Later, when the children are older: Europe. London first, then Switzerland and Germany, with
  sights, markets, grocery stores, accommodation and transport.

### What it demands
1. A traveler who needs **no flight but a car**. In the US the rental car is the product.
2. **Public transport guidance** in Asian cities, and a straight answer to "is this a day worth
   hiring a driver?"
3. **Domestic legs are the paid part** of an otherwise free trip.
4. A **staying-with-family mode**: no hotel, all things to do, for two adults and two children.
5. **Child-suitable picks** beside adult ones, shaped by ages 8 and 10.

### What exists today
- The fare lane covers their routes. LAX, SFO, JFK, EWR, HND, NRT, ICN, HKG, SIN, MNL, LHR and
  FRA are all curated hubs, so Los Angeles to Newark returns cached monthly fares with a link
  out to book.
- Rental cars are a tracked Discover Cars link-out.
- Things to do exist, but children's ages are in no profile yet (G119).
- Nothing answers "is a driver worth it here", and there is no public transport guidance.
  Transit feeds were parked earlier as not a priority.

## Scenario 4 — Francis and Katie, a family of four who pay full fare

Travelers: married, both in their mid-forties, with a five-year-old and a three-year-old.
US citizens. They live in Coeur d'Alene, Idaho, and fly out of Spokane. **They pay for every
ticket.** This trip is real: **February 2027**, the first concrete end-to-end case the product
can be measured against.

**Flights.**
- They take the cheapest fare to the Philippines, airline immaterial, even with a stopover in
  Asia. A direct flight is preferred with two small children, but a good deal with a bit of
  comfort beats a marginal saving. Price decides.
- Route: dropped off in Coeur d'Alene and driven to Spokane; Spokane to Los Angeles or San
  Francisco; then to Manila, possibly changing planes there. Most likely straight to Manila
  from LAX or SFO. Domestic and international airfare both needed.
- A ride from Coeur d'Alene to the airport would be welcome, but two car seats make it hard,
  so they drive or get dropped off by grandparents.

**In Manila.** One to five days at the founder's parents' house. The wider family gathers
there, and that is where the plans get made.
- Plans are **not definite before arrival.** Cebu or Bohol, or Cebu for a few days and then
  Bohol, or even somewhere else in Asia. They decide in Manila.
- Flying between islands is preferred because of the children. Local boats are loved where they
  fit. Favourites: Palawan, Cebu, Siargao.
- They want a **preview of resorts** reachable in one to two hours by air, so the decision in
  Manila is easy.
- Manila itself: activities and places for a big family, things the children would love, going
  out to eat.
- **Day trips they have done by van with a driver,** two to three hours each way: Villa
  Escudero, Bato Springs, Lipa City, Lucena (the restaurant Palaisdaan), an Airbnb in San Pablo,
  and the hot springs in Laguna as a one or two night stay to hang out with family.
- The Cebu whale shark tour before: pickup in the city, a one to three hour van drive with a
  driver, and back.

**The resort they want.** Air conditioning, beachside, big, safe. Island hopping and
snorkelling nearby, good food. Not difficult for the founder's dad, who joins on a wheelchair
or power scooter. Rooms for two or three families, four to five, ideally two queen beds each.

**What they said matters most.** "The logistics of how a person gets from one place to
another." Round-trip rides may not be bookable online, but the app should **have the
information to be smart about what it offers, and give the reasons why.** "We don't want to
think about booking so much. We want to know what to book."

**On the way home.** Francis's family once stopped in South Korea for a couple of days. A
stopover on the way back is something they do.

**If Asia instead.** Same story: a nice resort, transfers they can book, tour spots, good food.

### What it demands
1. A **cheapest-fare search** for two adults and two children, direct preferred, stopover
   accepted, comfort as the tiebreaker.
2. **Multi-airport routing from a home airport that is not a hub:** Spokane to LAX or SFO to
   Manila, possibly on separate tickets.
3. A **decide-later mode:** preview and save island options from Manila, then book with days
   of lead time, not months.
4. A **resort shortlist by criteria:** air conditioning, beachside, size, safety, manageable
   with a wheelchair, snorkelling and island hopping nearby, four to five rooms with two queens.
5. **Logistics cards even when nothing is bookable:** how to get there, the round trip, what
   can be booked, what cannot, and why we suggest it.
6. **Day trips from Manila** as a product: a van with a driver, two to three hours each way.
7. **Big-family things to do in Manila**, good for children, and where to eat.
8. A **stopover on the way home**, a two-day stop in Korea or similar, as part of the itinerary.
9. **Car seats** on any ride, and the **Cebu to Bohol boat**.

### What exists today (verified 2026-09-19)
- Flights: cached monthly fares between curated hubs only. Spokane is not a hub, so the lane
  substitutes Seattle, 230 miles away: a confidently wrong answer for this family. No fare
  search, no booking, no stopover routing.
- Hotels: the search filters for air conditioning, pool and airport shuttle. It has no
  beachfront attribute, no resort type and no safety signal. The composer caps rooms at four
  and never lets rooms exceed adults, so five rooms across three families do not fit.
- Tours: Viator link-outs. No day-trip-with-driver product from Manila. No ferry for Cebu to
  Bohol.
- Nothing supports deciding later, holding options for a short-lead booking, or a stopover leg.

**Child fares, to verify per airline at quote time:** on international tickets a child aged 2
to 11 usually pays a child fare, often around three quarters of the adult fare, and an infant
under 2 without a seat pays roughly a tenth. Their children are 5 and 3, so both need seats and
both pay child fares. Domestic US tickets normally charge children the adult fare.

## Scenario 5 — Gela and Miguel, from Medellín with a four-year-old

Travelers: Gela, the founder's sister, just turned 40; her husband Miguel, mid-thirties; a son
of about four (name unclear in dictation, confirm). They live in Medellín, Colombia. Trip
planned for **July 2027**, to the Philippines for the family reunion.

**Flights.**
- From Medellín they usually enter the US at Miami, sometimes Atlanta. Then to the Philippines
  through San Francisco, Los Angeles, or possibly Seattle, which the founder believes now has a
  Manila flight (not yet verified; an option for Francis and Katie too). Everything depends on
  the fare.
- Colombia to the US in one hit, the same day if possible, then the US to the Philippines. Any
  airline, not necessarily Philippine Airlines, on a good fare for the three of them.
- Founder on this family: "they're not all about convenience, but sometimes they will pay the
  price if it's really convenient for them and their family."

**In Manila.** The reunion again, and the same open plan as Francis and Katie: undecided until
they are there.
- Local: any resort in the Philippines.
- Regional: Asia or Australia, any country around the Philippines, nothing too far. The
  founder's dad dreams of Vietnam, Laos, Cambodia, Thailand and Hong Kong, just to be with the
  family.
- The open question is which destinations are **easily attainable** for a party with little
  kids, one disabled member on a power scooter, and **8 to 12 adults**.
- If they rent a place: **many rooms in one place.**

**What they like.** Nature and breathtaking natural wonders, lakes, rivers, hot springs,
seafood, walks, seeing animals, fun things, karaoke, and air conditioning.

### What it demands
1. **Three-country routing from a home airport that is not a hub:** Medellín to Miami or
   Atlanta, on to the US West Coast, then Manila, priced for two adults and a child, same-day
   connections preferred.
2. **Convenience as a priced option, not a default:** the cheap way and the easy way side by
   side, with what the extra buys.
3. **Destination attainability for the whole party:** direct flights from Manila, a group of
   8 to 12 adults plus children, one power scooter, and the interests list. Rank regional
   destinations by what this group can actually do there.
4. **Group lodging:** a villa, house or resort block with many rooms in one place.
5. A **shared decide-later mode** across households arriving from Idaho, Colombia and Manila.
6. **Interest matching beyond beaches:** hot springs, lakes and rivers, animals, seafood,
   karaoke.

### What exists today (verified 2026-09-19)
- Flights: Miami, Atlanta, Los Angeles, San Francisco and Seattle are curated hubs, so those US
  legs return cached fares. Medellín is not, and the lane would substitute Bogotá, about 150
  miles away. No multi-leg pricing.
- Lodging: hotels only, through Nuitée and Stay22. No villa or house rental supply, and the
  composer caps a party at four rooms.
- Nothing scores a destination for a group's attainability, and there is no group-size input.
- Things to do can find hot springs, lakes, animals and seafood as places, but not as a
  trip-level interest profile.

## Scenario 6 — the founder alone, Los Angeles to Atlanta, next week

Traveler: Maiza, on her own. Home airports: Burbank and LAX; LAX has more flights. Leaves
**September 24, 2026**, stays at the **Loews Atlanta** on the 25th, 26th and 27th, already
booked. Flies back to LAX or Burbank, airline and date not settled. No car. Recorded on
2026-09-20, four days before departure: **the first scenario the app can serve for real, this
week.**

- **The airline pass sets the timing.** A Frontier summer season pass, ending at the end of
  September, lets her buy discounted tickets only the day before departure. So she buys on the
  23rd for the 24th, if a Frontier flight fits. Otherwise any airline.
- **One night to fill.** She needs a hotel for the night of the 24th; the Loews covers the 25th
  to the 27th. Same hotel or somewhere nearby.
- **Getting around without a car:** airport to the hotel in Midtown, then three days in the city.

### What it demands
1. **Two home airports**, chosen by which airline and pass works on the day.
2. **Pass and credit constraints as inputs:** the app cannot buy a pass fare, but it can hold
   the plan, remind on the 23rd that the booking window opened, and price the fallback.
3. **A gap night beside an existing booking:** take the Loews reservation as given and fill the
   24th, ideally at the same property.
4. **Car-free city logistics:** train, rideshare, transfer, and walking distances for a
   Midtown stay.
5. **A return leg left open** until the pass decides it.

### What exists today (verified 2026-09-20)
- **Bookable now:** Find a Hotel with exact dates shows Atlanta rooms through Nuitée, so the
  24th can be booked in the app this week. It would double as the real booking test on the
  ledger (G12), though nothing is earned on it until the commission is set (G11).
- Flights: Los Angeles to Atlanta returns cached monthly fares with a link to book. Burbank is
  not a hub, so it is silently replaced by LAX. Nothing knows about airline passes or booking
  windows.
- Ground: a same-day ride opens the traveler's own Uber app; an airport transfer is a Welcome
  Pickups link-out; rental cars go to Discover Cars. A transit directions page exists.
- My Trips cannot hold the Loews reservation: there is no way to add a booking made elsewhere
  (G116).

## Scenario 7 — a past trip: three to Pensacola, flights, hotel and a car

Travelers: the founder plus two, three tickets from LAX to Pensacola. A rental car from the
airport, "awesome". A hotel at Pensacola Beach, very near the beach, driven to daily.
Continental breakfast, no fridge, a microwave. They toured the naval aviation museum with the
aircraft and the Blue Angels jets, swam at Pensacola Beach, and visited the founder's college,
Pensacola Christian College. "There wasn't much to do except go to the beach."

**What they needed: airfare, hotel, car.** The plain three-piece package.

### What it demands
1. **Three paid seats, a hotel and a car at the airport**, priced as one trip.
2. **The hotel facts that mattered:** near the beach, breakfast included, fridge or not,
   microwave or not, said plainly.
3. **What is there:** the museum, the beach, a personal place to visit, and an honest "not
   much else".

### What exists today (verified 2026-09-20)
- Hotels: the search filters for free breakfast, fridge and microwave, and package cards
  already say when breakfast or A/C is missing. Beachfront is still not an attribute.
- Rental cars: Discover Cars link-out.
- Flights: Pensacola is not a hub and sits about 300 miles from Atlanta, so the fare lane would
  quote Los Angeles to Atlanta for a Pensacola trip. Wrong airport, again. No booking.
- Things to do finds the museum and the beach as places.

## Scenario 8 — a past trip: two to New York, booked too late

Travelers: two, LAX to JFK, three or four days in New York.

- **Booked the hotel too late.** Manhattan had climbed to $300 to $400 a night, so the only
  cheap room was in the Bronx.
- **The commute was the bad part.** From JFK they took the train with their luggage all the
  way to the Bronx. "We wish we had a transfer instead." Large luggage on trains is hard.
- **The return cost almost $100 by Uber,** because something was left in the car and they had
  to go back to the hotel and out to JFK again.
- **What they did:** the Empire State Building to the top; Central Park; the Statue of Liberty
  with the pedestal tour, crown tickets already sold out; Times Square on foot; the 9/11
  Memorial. Subway and walking for everything else.
- **Food:** ate wherever they were hungry. Bagels, Italian pasta, Carlo's Bakery, Jollibee,
  the M&M's store in Times Square.

### What it demands
1. **Book-early warnings with a reason:** city hotel prices climb toward the date. Say so, and
   show what waiting costs.
2. **Total trip cost, not room rate:** a cheap outer-borough room plus two transfers and an
   hour each way is often not the cheap option. Show the comparison honestly.
3. **A transfer offered at hotel booking time**, priced, with the reason: large luggage, a
   long train ride.
4. **Timed tickets at planning time:** the Statue of Liberty crown sells out; the Empire State
   Building and the 9/11 Museum are ticketed. Sell them early, and say what is sold out.
5. **Subway-first city guidance**, then walking, then food wherever they are.

### What exists today (verified 2026-09-20)
- Flights: Los Angeles to New York returns cached fares with a link to book.
- Hotels: New York rooms with exact dates through Nuitée and Stay22, but no price-climb
  warning and no room-plus-commute comparison.
- Transfers: Welcome Pickups link-out, not offered at hotel booking time.
- Tickets: Viator link-outs for the big sights; nothing shows what is sold out.
- Places to Eat finds bagels, Italian and Jollibee nearby; a transit directions page exists.

## Patterns after eight scenarios (observations, not yet a design)

1. **Airfare is often already handled.** Three of the four parties fly free or discounted on
   Philippine Airlines. The first question is "do you already have your flights", asked per
   traveler and per leg, not per trip.
2. **The money is in the ground and the stay.** Transfers, drivers, vans, ferries, tours,
   resorts and rooms are what these travelers actually need bought.
3. **Ferries are load-bearing.** Caticlan to Boracay, Cebu to Bohol. Nothing in the product
   answers them.
4. **A party is rarely two adults.** Three travelers with a power scooter, two adults with two
   children, three families needing five rooms.
5. **The home airport is not always a hub.** Spokane, Caticlan, Coron, Siargao. The 600-mile
   substitution produces a confidently wrong airport.
6. **Access, not just accessibility.** Luggage help, short curb walks, a vehicle that fits a
   power scooter, car seats, and how many times a tour makes you get in and out.
7. **Plans are made on arrival.** Two of four parties decide the next leg after they land,
   among family. The product should preview and hold options, then book on short notice.
8. **Information beats inventory.** The founder's words: even when a ride cannot be booked
   online, know how to get there and say why. An honest logistics card is a product.
9. **Day trips by van with a driver** from a family base recur: Laguna hot springs, Villa
   Escudero, Lucena, and the Cebu whale shark run.
10. **A stopover on the way home** is a normal part of the trip.
11. **Large multigenerational groups.** Eight to twelve adults, small children and one power
    scooter, wanting many rooms in one place. The destination is chosen by what the least
    mobile member and the youngest can do.
12. **The reunion is the hub.** Households converge on Manila from Idaho, Colombia and Manila
    itself, then decide together. The product serves the group, not one booker.
13. **Convenience is an upsell, not a default.** Show the cheap route and the easy route, the
    price difference, and what it buys.
14. **Passes and credits set the booking clock.** Frontier's pass opens the day before
    departure; the app should hold the plan and remind, not try to buy.
15. **Partial trips are normal.** A hotel held for some nights with a gap night open; a pass
    that may or may not produce a flight. What is already booked is an input, not a conflict.
16. **The plain US package: flights, hotel, car.** Pensacola is the shape most US trips take,
    and where flights inside the package matter most, because every seat is paid.
17. **Late booking has a price, and so does the far-away cheap room.** Warn early, and compare
    the total cost with transfers and time, not the room rate alone.
18. **Ticketed sights sell out.** Timed tickets belong in the plan weeks ahead, with sold-out
    states shown honestly.

## Research list this opens (not yet plans)

- Ferry supply for the Philippines: 12Go, Barkota, Bookaway.
- Local activity supply: Klook for Asia, GetYourGuide as a second source.
- Private driver and van supply, with vehicle type, scooter space and car seats.
- Whether any transfer partner exposes car seats or luggage help as a filter.
- Group and multi-room booking through Nuitée, and bed-type filters.
- Domestic Philippine fares: a source beyond the curated-hub cache.
- Airport assistance and meet-and-greet services for travelers who cannot carry luggage.
- Day-trip supply from Manila with a driver: Klook, Viator, local van operators.
- A source for beachfront and resort attributes: the LiteAPI facility list (with G67) or Google
  place types.
- Short-lead domestic fares and same-week resort availability, for the decide-later mode.
- Multi-city fare search with a stopover leg, for the way-home stop.
- Group lodging supply: villas and houses for 8 to 12 adults. Airbnb has no affiliate
  programme; check whether Stay22 reaches Vrbo.
- Destination attainability scoring for groups with children and mobility needs.
- Routes to confirm when the founder wants: Seattle to Manila nonstop; Medellín to Miami and
  Atlanta nonstops; which US airports fly nonstop to Manila.
- Frontier's pass rules (likely the GoWild pass): booking window, blackout dates, end date,
  and which of Burbank and LAX it serves to Atlanta.
- Adding a booking made elsewhere to My Trips is already queued as G116; the Loews stay is
  its first real use.
- Ticket supply for sights that sell out: Statue of Liberty crown and pedestal, Empire State
  Building, 9/11 Museum, through Viator, GetYourGuide or Tiqets, with affiliate terms.
- A hotel price-climb signal from the D1 price_history table, which already records hotels.

## Locked at eight scenarios (2026-09-20)

The founder said "let's lock up those scenarios for now and focus on building." Eight scenarios
are on file. Add more only when the founder dictates them; the study across the set is still
owed and starts when the founder asks for it.

## Where the money can come from (first pass, revisit with the full set)

Hotel and resort commission through Nuitée, tour commission through Viator or another
marketplace, transfer, van and rental-car link-outs, ferry booking if a partner exists, flight
referral through Travelpayouts today, and possibly flights at cost inside packages later
(Launch Ledger N9 and N11).
