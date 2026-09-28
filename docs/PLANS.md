# Plans — the founder's agreed list

The one place that lists what Maiza and Claude have agreed to build, in order, plus the
decisions still open. **Read this first every session.** Update it the same day a plan
changes; keep dates absolute. Item-level to-dos live in the pinned Launch Ledger
(https://claude.ai/code/artifact/c1a784c9-8694-46df-b0e0-f4bffeb00843); IDs like G11 or N7
point there.

Last updated: 2026-09-26

## Build queue, in order

**Hotel lane, agreed 2026-09-22 — runs now, while item 1 waits on the founder's answers.**
In this order: (a) **booking emails** from GlobeSkimmers via Resend (confirmation, cancellation,
the hotel's own confirmation number when it arrives later) — Nuitée sends none; From
bookings@globeskimmers.io, replies to founder@, a copy to founder@; never card digits; refund
timing stated as "typically 5–10 business days, depending on your bank". (b) **Amenity chips**
in Find a hotel: pool, beachfront/private beach, pets allowed, spa, family rooms, wheelchair
accessible, plus 4★+ and 8+ guest rating. (c) **Board chips**: half board, full board,
all-inclusive (all meals plus drinks and snacks). (d) **Cancel a non-refundable stay with the
penalty shown** — founder, 2026-09-22: "honesty is good". Booking.com's practice: allow it, state
the charge first. The app shows "Cancel anyway — no refund; you'll still be charged X" and an
explicit confirm; an unknown deadline still blocks. (e) **Hotel-type chips** (resort, apartment,
hostel) after a one-off pull of Nuitée's type list. (f) **More than one room** per booking
(fixes a latent price bug first: a two-room offer would show one room's price).
(g) **Hotel and room photos** — founder, 2026-09-26: "all we need is for users to be able to view
room and hotel pictures … from the results, enlarge, scroll right and left, collapse". Built the
same day (results-card lightbox, "N hotel photos" in the booking sheet, room thumbnails in the room
picker); ships with the next push + OTA. Photos come only from the hotel's supplier; a room with no
picture shows none.

**Passport lane, founder asks 2026-09-26/27 (after the Georgia Aquarium stamp).** Built the same
day, awaiting push + OTA + a native build: the booklet's Share button (branded image with
Globeskimmers + "My Virtual Passport", preview, share sheet — the old flow silently failed);
opening the Passport senses the attraction footprint or airport you are in and offers the stamp
(several → pick one or close); tapping a stamp opens its options (add memory photos now or later,
view them full screen with swipe and ×, delete a photo, solo page / shared page, delete the
stamp, close). Solo pages need the passport_stamp_layout migration applied.
**Next in this lane — movie filming-location stamps (founder, 2026-09-27).** Spots people visit
*because of a film* (not landmarks already in the top spots — no Eiffel Tower). Stamp copy: "I was
here!" · date · spot · city, country · "The scene from <Film> (<Year>)" · one line on what happened
· "<Actor> as <Role>" ×2, plus a short brag line for the shared image ("Filmed here: <Film>
(<Year>)"). The traveler's own photo leads: one photo open at a time, the stamp pressed at the top
or the bottom so it never covers the iconic view, a second photo as a thumbnail; move and delete
as for every stamp. **Brief (research 2026-09-27, all counts live from Wikidata):**
- Data: Wikidata "filming location" (P915, CC0) is the only worldwide open source with
  coordinates — 23,449 films, 7,830 locations with coordinates, but mostly cities; the spot-level
  set for famous films (≥40 Wikipedia editions) is **816 spots across 437 films**, skewed US/UK
  (223/203; Asia, Africa, Latin America nearly empty). Several of the founder's own examples are
  missing or city-level there (Rocky Steps, Café des 2 Moulins, Maya Bay, the Dubrovnik stairs),
  so the seed is Wikidata **plus** hand-added spots. Fame = Wikipedia editions of the film ×
  Wikipedia pageviews of the spot (free). Cast and roles from Wikidata (roles present on the
  leads of most famous films); gaps filled from the film's Wikipedia credits in a review sheet.
  TMDB would fill roles automatically but needs a written commercial agreement; IMDb data is
  non-commercial only; movie-locations.com / Atlas of Wonders are read-only cross-checks.
- Legal: titles, years, actor and character names are facts (nominative use — plain text, no
  studio logos, never "official"); **stills and posters never** (copyright, and TMDB grants no
  image rights). Photos = the traveler's own; a Wikimedia Commons photo of the place, credited,
  may preview an unearned stamp.
- Build: a `film_spots` table (D1) keyed to owned attractions (kind `scene`, footprint per spot:
  stairs ~60 m, beach ~300 m) so the nearby prompt, Stamps near you and "I was here" work
  unchanged; a movie layout of the typographic stamp; the photo-first page (automatic top/bottom
  placement by which third of the photo is emptier, manual override in the stamp options); the
  curation sheet. ≈ 8 working days after the seed: pipeline + curation 3, worker/D1 1, stamp +
  page 3, QA 1.
- **Decisions for the founder (defaults in bold):** seed size **400** (300–500, ceiling 800);
  famous TV series included (**yes** — Game of Thrones, Breaking Bad); UNESCO-grade places that
  already carry a top-spot stamp (Skellig Michael, Aït Benhaddou) **stay top-spot stamps** with a
  film line added, not duplicated; TMDB commercial agreement **apply in parallel, don't wait**;
  stamp placement **automatic with manual override**. "Go with the defaults" starts the seed.
  **Mockup 2026-09-28:** https://claude.ai/artifact/XBYyx5YZvfGfA8nxsFU7gs — the "scene" stamp
  (film strip top and bottom, ★ FILMED HERE ★, the place in solid ink, FILM · YEAR, city · country
  · date, solid red "I was here!"), the photo-first page (stamp touches only the photo's edge,
  below or above; second photo as a tap-to-swap thumbnail; scene line and the two leads under
  it), Story and carousel with the film line, and the to-do list (founder: the defaults, design
  approval, optional TMDB application, a ~40-spot review, one data-load command + OTA; Claude:
  ~8 working days). **2026-09-28: founder said "go with the defaults" and approved the design
  ("beautiful work"). Built: slices 1–3 (data plumbing, Scene stamp, "Filmed here" surfaces;
  82f645a) and slice 4 (photo-first page with auto/above/below placement, film line on share
  photo slides). Waiting on: the seed list (agent running), the founder's ~40-spot review, then
  one data-load command + `npm run ota`.**
**Share destinations + counts (founder, 2026-09-28):** share images sized for Instagram,
Facebook, TikTok, Snapchat and X, story and post, every component inside each platform's safe
area, text sized to Instagram's current look; also send by Facebook, WhatsApp, Messages and
Instagram message. Counts per month: stamped vs shared per platform, and story vs post vs
message, stored and shown to admins — **built and live 2026-09-28** (Admin Analytics table;
platform names on iPhone need the store build). Platform presets: research on current sizes and
safe zones running, then the preview gets a "where" picker. Film scenes are sensed on Passport
open like any stampable place (they join the owned attractions data).
**Tabled 2026-09-28 — "who you were with" bubbles** (founder: "table the idea, hold the build"):
small circles on a stamp with each friend's face, or first name + last initial; tap to see who
you were there with. Only friends who accepted the tag appear. Data exists today: passport_tags
(from_user_id, to_user_id, status accepted) on the tagger's side, passport_stamps.tagged_by on
the friend's. Tags today copy the place and visit date only — the friend's stamp is self-verified
and starts with no photos; they add their own. Needs profile photos before faces can show.
1. **New phone Home, built to the Home canvas** (G115). Founder, 2026-09-14: "first is the new home."
   Canvas: https://claude.ai/code/artifact/06c2973f-3e2e-47d2-a4c1-b1a7510706ec
   - Three states: I'm here at home, I'm here on a trip, Plan it. The mode picks itself; "on a trip" means away with a stay booked, not a third mode.
   - A collapsed Your-trip card (at most 4 rows by start time, read-only expand, See all opens My Trips), a services directory, one photo row (Stamps near your stay), and Step-free / Accessible chips that read only Google or LiteAPI data.
   - Hold "Be my guide" until a real multi-day planner exists; no coming-soon doors. Log home_mode, home_door_tap, service_chip_tap, guide_start. Keep the flag badge. The tablet Home stays tabled (G108).
   - **Founder direction, 2026-09-20 (supersedes the canvas where they differ):** Home is too
     cluttered. Make it simple like the iPhone, organized, not everything in one place, and
     built for a first-time user who may be random, exploring, in another country, or booking.
     Keep: nearby services, events (thoughtfully organized), Stamps near your stay, Dream and
     plan, Places to dream about. Remove: Worth the drive, Trips and escapes. Move off Home:
     Near you now, Around the city today, In the city recommendations. Your trip lives only in
     the Your Trip page. Home gets a smart search bar that interviews people about what they
     need, a Nearby services button, and probably an Explore button. Claude audits everything
     first, then proposes. Navan comparison requested the same day.
   - **Slice 0 shipped 2026-09-20** (0655a8e + 9a324f0, update 1.0.2609210442): Worth the drive, Trips and escapes, the spot rows, the Your trip zone and the Perfect Day card left Home; the stay setter and saved items moved to My Trip.
   - **Proposal delivered 2026-09-21:** https://claude.ai/code/artifact/cd56623a-c57f-42a2-a291-36541dace4cd — one bar that asks (five questions at most), two doors (Nearby services = the existing sheet retitled and mode-ordered; Explore = a thin new page for the moved rows), four blocks (Build a full trip, Places to dream about, Stamps near your stay, Events compact). Eight slices, none touching the worker; slices 1 to 3 about six working days. **Waiting on the founder's 18 answers** (each has a recommended default; “go with the defaults” starts slices 1 to 3). Built by the home-simplify workflow (wf_beff322a-5e6): 4 research agents, 3 designs, 2 judges, 2 writers, 3 skeptics; the skeptics' corrections are applied on the page.
   - Earlier status, kept for the record: plan drafted against the canvas. Reviewers found blockers, so **revise before writing code**: compute "away" from the stay itself (keyed on locationMode, the mode flips when "Around my hotel" switches to navigate); every slice must ship on its own (no empty Plan it toggle); keep DestinationStrip; keep a way to set and clear the primary stay; don't gate the body on bookings loading; the Your-trip card drops past stays.
2. **My Trips Ledger A** (G116): one record per booking (trip_items), Add a booking (form plus paste), a prompt when the traveler returns from a partner site, per-partner manage links, hotel phone. Spec: https://claude.ai/code/artifact/50256292-130d-4c34-ab35-cf2436dad91e. Then Ledger B (G118): on-trip Home reads the ledger, trip grouping and timeline, forward-your-email. Later: calendar export and the what's-missing nudge (N6).
3. **Mobility profile** (G119 with N2). Label **"Mobility needs"**, awaiting the founder's OK (G110). Helper: "Wheelchair, mobility scooter, walker, limited walking, or help with transfers." Choices: None · Walks short distances, avoids stairs · Uses a cane or walker · Uses a manual wheelchair · Uses a power wheelchair · Uses a mobility scooter. A separate "Needs help with transfers" checkbox and a caregiver toggle, "I'm traveling as a caregiver or companion." Avoid special needs, handicapped, wheelchair-bound, differently abled. "PWD" only in Philippines tips and as a search synonym. Same wave: accessible-hotel rung, child ages, two rooms, Ask-the-hotel email. Then tours that tell the truth (G120, N3), the step-free chip and briefs (N4), the accessible van concierge (N5). Brief: Car-to-Door, https://claude.ai/code/artifact/0b957900-b0e4-44d0-9f01-09d0c1a935c3
4. **Flights inside Smart Packages, test mode first** (N11). Founder spec, 2026-09-14:
   - Round trip timed to land in time to check in and rest; nonstop first.
   - Two checked bags included; seat selection; economy or business.
   - Travelers pay up front; GlobeSkimmers never fronts a fare ("I cannot cover the flights").
   - Proposed, **awaiting founder OK (N9)**: Duffel with card payments, where the airline is merchant of record and no markup is allowed ($3 per order + 1% + $2 per paid bag or seat). Flights sell at cost and the hotel commission covers the fees.
5. **Ground leg in packages** (N12): an airport transfer, or a rental car only where a car makes sense, or a driver with a van for one or several days, sized to the party (two or three vans for families), rated operators only. Today's partners: Welcome Pickups, Discover Cars, Viator private drivers (link-outs).
6. **Real flight booking**: after Duffel approves card payments and the Nuitée commission is set (G11).
7. **Payments** (G17, G18): travelers add their own payment methods with a **default and a backup card**; **Apple Pay** to pay whole trips; **Klarna** (the Stripe test lane is built). Charging whole trips ourselves needs a float, a supplier credit line, or supplier-side installments first, so it stays deferred under the zero-float rule. Needs an Apple Merchant ID and pay.globeskimmers.io (G19).
8. **Best time to go, from real weather records** (N13): rank every month (best, second, third) with the reasons in numbers from 10-year averages; label hot or rainy months with what to expect, never "avoid"; keep weather and price as separate facts. Tested on Manila with 2015–2024 records: best Jan–Feb, hottest Apr–May, rainy Jun–Oct. Needs a weather source licensed for commercial use (N10).
9. **Honest flight prices** (N14): say "Lowest fare seen this week", never "cheapest month". Start recording flight prices daily per route so "usually lowest in …" becomes true after a year.

Suggested by Claude, not yet agreed: a "See all hotels" link from a package into Find a Hotel with the same dates.

## Website (globeskimmers.io)

- Deployed 2026-09-14 (48e1c81, 1d1e3b0, a3cdab8) to the globeskimmers-site Worker. **Live on https://globeskimmers.io since 2026-09-21**: the founder attached globeskimmers.io and www in Cloudflare; pages, redirects, app-ads.txt and security headers verified on the real domain. Test addresses switched off (9d766af). www serves the same site; the platform rejects host redirects in _redirects, so a www→plain 301 would be a Cloudflare Redirect Rule if ever wanted.
- Redirects for old addresses and the security headers failed at first because the GitHub action installed Wrangler 3.90.0. Fixed 2026-09-20 by pinning Wrangler 4.131.2 (9412e93); verified live on the test address.
- Phone layout (founder request, 2026-09-14, live 2026-09-20): on phones the four sections become a menu under the logo (Inside the app, Virtual Passport, Partners & investors, Contact); the headline stacks so each teal phrase gets its own line; the App Store and Android badges are the same size; cards use a short color marker instead of a bent top edge.
- Copy decisions: headline "Find what you need abroad. Plan the whole trip from home." Hotels: "Two great hotels, side by side" (never "pick" or "rules"). Flights: "Flights aren't included yet. You book those separately." Quote: Helen Keller (the Jackie Chan line couldn't be verified). Always "Virtual Passport".
- Follow-ups (N15): real app screenshots after the new Home ships; update the flights lines in site/index.html when flights join packages; show the founder's real passport once shared; upload the updated privacy page to R2 after `npx wrangler login`.

## Waiting on the founder

- globeskimmers.com (M1): never ours. The founder owns globeskimmers.io only (confirmed 2026-09-14). The .com sits in the registry redemption period at Domain Esta Aqui, LLC (Network Solutions / SnapNames group) and likely deletes around 2026-09-20. Decide whether to backorder it at a drop-catch service (DropCatch, SnapNames, GoDaddy) before then, or let it go. Nothing in the app, website or store listing depends on it.
- Approve "Mobility needs" and its choices (G110).
- Flights (N9): **approved in principle 2026-09-24** — founder: "let's allow flight booking." Founder's hard requirements, same day: **GlobeSkimmers must earn on every flight** (so "at cost" is out), the traveler gets a **confirmation email** from bookings@globeskimmers.io, and the booking **lands in My Trips** with cancel — "mimic hotel booking". **Brief delivered the same day (Claude memory: flights-in-app-brief): recommended supplier is Nuitée's flights product** — Nuitée is merchant of record and charges the card through the same Stripe SDK as hotels, the markup is set in the dashboard (Flights → Commission; start 3–5%, not 12%, penalties 0), fees are 1% of ticket value (min €2, max €10) plus €25 per voluntary change, and the email, My Trips row and cancel copy the hotel lane. Duffel is out for now: its card path forbids any markup, needs pre-approval plus a written fraud procedure, puts chargebacks on us and asks for a deposit. Awaiting the founder: confirm Nuitée + the markup %, submit "Request Flights API Access" (sandbox and production, answers drafted), decide the support model (First Line recommended) and the seller-of-travel question. Build ≈ 15 working days, sandbox first. No flight booking code exists yet; the Duffel test token on the worker is unused.
- One real low-value booking with free cancellation, then cancel it in the Nuitée dashboard (G12): **done 2026-09-22** — Kawada Hotel, Dec 10–11, $117.83, booking PDdzItYUt, cancelled in the dashboard. No confirmation email arrived (Nuitée sends none; that is why the email build is first). Still to check: the refund on the card statement, and that the My Trips row reads Cancelled after one open. The commission (G11) was set 2026-09-21: 12% default markup, which is 10.71% of what the guest pays. Nuitée's live check on 92 rates put the selling price at $364.72 against a $374.50 market reference. Payout goes weekly to the attached bank account, after each guest checks out.
- Pick a weather source licensed for commercial use (N10): a paid Open-Meteo plan (the free plan is non-commercial, and the app already uses it for live temperatures) or Copernicus ERA5 records with attribution.
- Email records for founder@globeskimmers.io (N8): **partly done 2026-09-22** — Resend's sending records are live (DKIM at resend._domainkey, the send/rsend CNAMEs, DMARC `p=none`) and the domain is Verified in Resend; Resend's "Enable Receiving" stays off (it would replace Google's mail record). Still open for Google's own mail: no DKIM at Google's selector, and the root SPF lists IONOS but not Google.
- AdMob test mode at launch (G77); the "Book a Hotel" rename; share the Virtual Passport link.
- **Saved cards / Settings → Methods to pay** (founder ask, 2026-09-26: save the card at checkout,
  add / delete / default / optional backup card in Settings, add a card before any purchase).
  Researched the same day (Claude memory: saved-cards-research). What the docs allow:
  **hotels cannot use a card we save.** The hotel card form is Nuitée's own Stripe Elements page on
  Nuitée's Stripe account; it has no "save my card" and accepts no token from us. The traveller's
  saved card there is Apple Pay / Google Pay (already in the form; Apple Pay still needs Nuitée to
  register our domain, ticket drafted 2026-09-21) and Stripe Link if Nuitée has it on. The one
  documented way to put the charge on **our** Stripe (prebook `payment.useOwnSecretKey`) makes
  GlobeSkimmers the merchant of record: refunds, chargebacks, Stripe fees, Stripe Tax and how we
  then pay Nuitée are all ours, and the settlement side is undocumented. **Our own Stripe products**
  (packages) can save cards the standard way (checkbox at pay, add via SetupIntent, list, delete,
  default; "backup" is our own bookkeeping; card data stays in Stripe's iframe). Decision for the
  founder: (1) ask Nuitée three questions (Apple Pay domain, is Link on, what useOwnSecretKey needs
  and how settlement works) — **sent 2026-09-27**, awaiting Nuitée's reply; (2) build Methods to pay for our own Stripe checkout
  when packages go live (≈4 days), not before, so the screen never lists cards that cannot pay for a
  hotel; (3) only if the founder wants to be merchant of record for hotels, plan that as its own
  project after Nuitée answers. Nothing built yet.

## Dated reminders

- ~2026-12-09: regenerate the Sign in with Apple client secret (M3, 6-month limit).
- ~2026-12-10: re-apply for Viator Full + Booking access (G34).
- Stripe Tax and an accountant conversation (G21) — **triggered 2026-09-27** (the Homewood
  commission locks after checkout 09-28). Stripe → Settings → Tax reviewed with the founder:
  head office address set (California); preset product category "General - Electronically
  Supplied Services" (set at application, wrong for travel packages, left until the accountant
  picks); Locations "No live transactions" (Stripe never monitors the home state — California is
  the accountant's call; hotel commissions arrive via Nuitée's own Stripe platform and never appear
  on this page — use Nuitée → Payments → Earnings and the bank deposits instead); no registration;
  automatic collection OFF and it must stay off — that toggle covers
  Dashboard invoices/payment links only, the app's package checkout (PaymentIntents via API)
  needs Stripe's Tax Calculation API wired in before the first sale (build item, Claude). Next:
  the founder books the accountant with the brief (revenue streams, seven questions; California
  Seller of Travel law added). Answers that change code/plans come back here.
- Before 2,000 monthly users: upgrade the Capgo plan (G10).

## Where the plans live

- Launch Ledger (pinned; item to-dos and ticks): https://claude.ai/code/artifact/c1a784c9-8694-46df-b0e0-f4bffeb00843
- Home canvas: https://claude.ai/code/artifact/06c2973f-3e2e-47d2-a4c1-b1a7510706ec
- Car-to-Door: https://claude.ai/code/artifact/0b957900-b0e4-44d0-9f01-09d0c1a935c3
- Who We Can Serve: https://claude.ai/code/artifact/3550974b-a863-4f4e-a0f5-f7848739594f
- My Trips Ledger: https://claude.ai/code/artifact/50256292-130d-4c34-ab35-cf2436dad91e
- The Google of Travel brief: https://claude.ai/code/artifact/7b3b4221-403e-457b-9d65-838879a0d4a9
- Global Stamp Atlas: https://claude.ai/code/artifact/d49af076-9c43-4742-b0ba-5c44b1a40e8e
- The Passport Standard: https://claude.ai/code/artifact/d501e554-4e86-4b1a-be4c-ae5f43c97328
- Landing page preview: https://claude.ai/code/artifact/a8854364-b319-4e45-bdf7-2fb96c874a86
- Home, simplified (the Home proposal, 2026-09-21): https://claude.ai/code/artifact/cd56623a-c57f-42a2-a291-36541dace4cd
- Founder kit for Launchhouse Atlanta (pitches, prep-app answers, LinkedIn; fact-checked): docs/FOUNDER_KIT_2026-09.md
- Traveler scenarios, what real trips demand: docs/TRAVELER_SCENARIOS.md
- Shipped receipts: the bottom of docs/BUILD_TEST_CHECKLIST.md
