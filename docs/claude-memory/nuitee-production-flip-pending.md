---
name: nuitee-production-flip-pending
description: Founder asked to be REMINDED about flipping the Nuitée hotel lane from sandbox to production; what the flip needs and what rides with it
metadata:
  type: project
---

The in-app hotel booking lane (Nuitée Connect / LiteAPI) is deployed in **sandbox** as of 2026-09-01
(`NUITEE_ENV = "sandbox"` in wrangler.toml → uses NUITEE_SANDBOX_KEY). Maiza asked (2026-09-01):
"remind me about production flip in future."

**Why:** In sandbox no real reservation or charge can happen, so the lane earns nothing until flipped;
but the flip makes every completed payment a real booking, so it must follow the device test.

**How to apply:** At natural checkpoints (after a sandbox device test passes, before any worker push,
when planning "what's next"), remind Maiza that the flip is pending and what it needs:
1. Sandbox device test passed on the phone (Find a Hotel → dates → "Book in the app · SANDBOX" →
   sheet → pay with 4242 4242 4242 4242 or the simulate link → "You're booked" → My Trips row).
2. Nuitée dashboard: **Commission** default markup set (that is the revenue) + **Payout** method attached.
3. The flip commit = `NUITEE_ENV = "production"` in wrangler.toml (one line) + the "Book a Hotel"
   rename (labels only, keys untouched — awaiting Maiza's yes). The held worker backlog was deployed 2026-09-02 (push-all; incl. stamp bar + Phase B). The FLIP itself is still pending: NUITEE_ENV remains "sandbox" in wrangler.toml — the flip needs the sandbox device test + Nuitée Commission/Payout set + the Book-a-Hotel rename decision, then the one-line env change → push.
4. Delete sandbox test rows first: `delete from affiliate_clicks where partner='nuitee' and intent='sandbox'`.
5. Privacy policy §5: name "Nuitée Travel Ltd (hotel payments, merchant of record)" before public launch.
Related: [[feedback_business_reviews_policy]], [[project_city_prides_stamps]].

**SANDBOX DEVICE TEST PASSED (2026-09-04, founder screenshots):** full chain verified on iPhone — search → prebook → Stripe checkout (Klarna/Affirm/Afterpay visible on Nuitée's sheet — hotel BNPL exists today) → booked wumWlmV9Q → My Trips. **FLIP DELIBERATELY HELD** at founder-work sequencing: founder ordered Hotel-Booking-v2 + My-Trips-v2 redesign of the exact flow; flipping first would make their design re-tests real non-refundable money. Sequence: redesign → one sandbox re-test → flip same hour. Commission/Payout in Nuitée dashboard still on founder.
**Redesign mandate (founder, detailed):** My Trips sorted soonest-due first, past bookings sink to bottom; expandable detail per booking (booked-on date, address + open-in-maps, payment summary — last4 only if API provides, never stored by us); share via email/text. Hotel flow: room-type choice (king / 2 queens / suite+sofa, premium vs standard — requires maxRatesPerHotel > 1), amenity filters (parking, AC, free breakfast, free WiFi, microwave, fridge, gym, airport transfer, town shuttle), real full-width Pay button on the worker-served checkout page (founder: "how come there wasn't a submit button" — the small Stripe Pay pill failed them), professional/trustworthy design end to end.

**BOOKINGS V2 COMPLETE (2026-09-05, f059498):** all five waves shipped, reviewed, gated, deployed, synced — Trips v2 (sort/expand/share/map), checkout redesign, address plumbing (08 migration applied), room choice (6 rates, honest refundable deltas), amenity filters (live smoke: 8/8 applied, 0 dropped). NOW AWAITING: founder's 10-minute sandbox re-test on device → then FLIP (NUITEE_ENV → production + delete intent='sandbox' rows + privacy §5 Nuitée Travel Ltd + carry the Book-a-Hotel rename if blessed). Commission/Payout in Nuitée dashboard still on founder.

**✅ FLIPPED TO PRODUCTION 2026-09-05 (commit 2d293ab), founder-authorized ("go ahead and flip it").** Verified live: env=production, 39 real Anaheim hotels, real rates. Sandbox rows purged (4 affiliate + 6 sessions); privacy.html in R2 names Nuitée Travel Ltd as MoR. REMAINING: founder sets Commission/Payout in Nuitée dashboard; one real low-value booking to verify statement descriptor + cancellation path; "Book a Hotel" rename still an open verdict.
