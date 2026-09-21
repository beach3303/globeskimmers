# Plans — the founder's agreed list

The one place that lists what Maiza and Claude have agreed to build, in order, plus the
decisions still open. **Read this first every session.** Update it the same day a plan
changes; keep dates absolute. Item-level to-dos live in the pinned Launch Ledger
(https://claude.ai/code/artifact/c1a784c9-8694-46df-b0e0-f4bffeb00843); IDs like G11 or N7
point there.

Last updated: 2026-09-20

## Build queue, in order

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
   - Status: plan drafted. Reviewers found blockers, so **revise the plan before writing code**: compute "away" from the stay itself (keyed on locationMode, the mode flips when "Around my hotel" switches to navigate); every slice must ship on its own (no empty Plan it toggle); keep DestinationStrip; keep a way to set and clear the primary stay; don't gate the body on bookings loading; the Your-trip card drops past stays.
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

- Deployed 2026-09-14 (48e1c81, 1d1e3b0, a3cdab8) to the globeskimmers-site Worker, live at https://globeskimmers-site.maizasimeon.workers.dev. Pages, app-ads.txt and the contact route verified.
- Found after deploy: redirects for old addresses and the security headers don't apply, because the GitHub action installed Wrangler 3.90.0. Fix on disk: pin Wrangler 4.131.2 in deploy-site.yml. **Waiting on the founder's OK to push.**
- Phone layout pass on disk (founder request, 2026-09-14): on phones the four sections become a menu under the logo (Inside the app, Virtual Passport, Partners & investors, Contact); the headline stacks so each teal phrase gets its own line; the App Store and Android badges are the same size; cards use a short color marker instead of a bent top edge. Ships with the same push.
- The founder attaches globeskimmers.io and www in Cloudflare (N7). Then set `workers_dev = false` in wrangler-site.toml.
- Copy decisions: headline "Find what you need abroad. Plan the whole trip from home." Hotels: "Two great hotels, side by side" (never "pick" or "rules"). Flights: "Flights aren't included yet. You book those separately." Quote: Helen Keller (the Jackie Chan line couldn't be verified). Always "Virtual Passport".
- Follow-ups (N15): real app screenshots after the new Home ships; update the flights lines in site/index.html when flights join packages; show the founder's real passport once shared; upload the updated privacy page to R2 after `npx wrangler login`.

## Waiting on the founder

- globeskimmers.com (M1): never ours. The founder owns globeskimmers.io only (confirmed 2026-09-14). The .com sits in the registry redemption period at Domain Esta Aqui, LLC (Network Solutions / SnapNames group) and likely deletes around 2026-09-20. Decide whether to backorder it at a drop-catch service (DropCatch, SnapNames, GoDaddy) before then, or let it go. Nothing in the app, website or store listing depends on it.
- Approve "Mobility needs" and its choices (G110).
- Approve flights sold at cost, covered by the hotel commission (N9).
- Set the Nuitée commission and payout (G11); hotel bookings earn nothing until then. Then one real low-value booking and cancel (G12).
- Pick a weather source licensed for commercial use (N10): a paid Open-Meteo plan (the free plan is non-commercial, and the app already uses it for live temperatures) or Copernicus ERA5 records with attribution.
- OK the push of the website fix; attach globeskimmers.io in Cloudflare (N7); run `npx wrangler login` on the laptop (G70).
- Email records for founder@globeskimmers.io (N8): no DMARC record, no DKIM record at Google's default selector, and SPF lists IONOS but not Google.
- AdMob test mode at launch (G77); the "Book a Hotel" rename; share the Virtual Passport link.

## Dated reminders

- ~2026-12-09: regenerate the Sign in with Apple client secret (M3, 6-month limit).
- ~2026-12-10: re-apply for Viator Full + Booking access (G34).
- At first real revenue: Stripe Tax and an accountant conversation (G21).
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
- Traveler scenarios, what real trips demand: docs/TRAVELER_SCENARIOS.md
- Shipped receipts: the bottom of docs/BUILD_TEST_CHECKLIST.md
