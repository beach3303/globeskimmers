# Affiliate — Apply-Now Checklist

Approval is the **long pole** (days → weeks), so apply *before* the plumbing is built. Rule of thumb: **apply to each program through ONE channel only** (don't join the same brand both direct AND via Travelpayouts — it creates attribution conflicts).

Derived from the 2026-07-23 market research (see the affiliate memory). Commission figures are directional — confirm in each portal.

---

## 0. Prep once — assets every application asks for
Have these ready before you start (most forms want them):
- [ ] **Live app URL** — iOS: `https://apps.apple.com/us/app/globeskimmers/id6753154199` (Play listing once approved)
- [ ] **Website** — `https://globeskimmers.io` (satisfies "must have a real site/app"; several programs reject social-only applicants)
- [ ] **Privacy Policy URL** — `https://globeskimmers-api.maizasimeon.workers.dev/legal/privacy` (or the branded `globeskimmers.io/legal/privacy` once the Worker route is set up)
- [ ] **Terms URL** — `.../legal/terms`
- [ ] **Payout details** — PayPal email + a bank account (most pay via PayPal ≥$50 or bank)
- [ ] **Tax form** — W-9 (US) or W-8BEN (non-US); several networks require it before first payout
- [ ] **One-paragraph app description** + how you'll promote (e.g. "in-context links on Things-to-Do, ATM/coffee/exchange finders, and a wishlist → offer surface")
- [ ] ⚠️ **COMPLIANCE PRE-REQ — update the Privacy Policy to disclose affiliate tracking** (the SubID/click logging) *before* you drive real clicks. Also declare it in the App Store / Play data labels. (First-party in-app targeting likely needs no ATT prompt, but declare it.)

---

## 1. PHASE 1 — apply TODAY

| # | Program | Vertical | Channel (apply here) | ~Terms | Needs / notes |
|---|---|---|---|---|---|
| 1 | **Travelpayouts** | **the hub** | [travelpayouts.com](https://www.travelpayouts.com/) | — | **✅ ACCOUNT LIVE (confirmed 2026-08-31)** — project "Globeskimmers", partner ID / `marker` **755378** (maizasimeon@gmail.com). Links: `marker=755378` (+ `.subid` for per-click attribution; the Worker already maps TP's `sub_id`). Not yet wired into the app. Payout minimum $400. Still to do in the portal: join the brand programs (Booking, Agoda, Welcome Pickups, Kiwitaxi, Aviasales, Tiqets) + set a payout method under Finance. Skip "Drive" (auto-link injection for websites — wrong for an app). |
| 2 | **Viator** | tours/activities | Direct — [partnerresources.viator.com](https://partnerresources.viator.com/) | 8%, 30-day cookie | **✅ LIVE · pid P00311514 verified · API upgraded to FULL ACCESS 2026-08-31** (granted instantly via Tools → API → "Request additional access"; both keys #57AF sandbox + #AF56 production flipped in place — the Worker's existing VIATOR_API_KEY now reaches availability, pricing schedules and booking questions; checkout stays on Viator). Next build: live prices + availability on tour cards. | ORIGINAL NOTES → **Easiest join anywhere — no traffic/follower minimum.** Needs a Tripadvisor account; English-language site required. 🥇 first revenue surface (Things-to-Do). |
| 3 | **Discover Cars** | car rental | Direct — [discovercars.com affiliate](https://www.discovercars.com/affiliate-program) | ~$20/booking (70% of profit), **365-day cookie** | Go DIRECT (70%) not via TP (56%). Open self-signup. |
| 4 | **Welcome Pickups** | airport transfers | via TP (or Tapfiliate direct) | 8% of order | Purpose-built meet-and-greet; easy. |
| 5 | **Kiwitaxi** | airport transfers | via TP | ~$8/order (50% rev-share) | Wide global airport coverage. |
| 6 | **Booking.com** | hotels | **via TP** (NOT direct) | ~4-5% effective | Direct affiliate uses a **session-only cookie** (kills conversions) — TP gives proper attribution. |
| 7 | **Agoda** | hotels | via TP | ~6% (ex-tax) | Complements Booking; strong in APAC. |
| 8 | **Airalo** | eSIM | [partners.airalo.com](https://partners.airalo.com/) (via **Impact**) | 10%, 30-day | Join Impact network too. High conversion in travel apps. |
| 9 | **Wise** | money transfer | [wise.com/affiliate-program](https://wise.com/affiliate-program) (via **Partnerize**) | flat bounty (~£10), **365-day cookie** | Pairs with the ATM/exchange screens ("skip the bad booth rate"). Manual review. |
| 10 | **GetYourGuide** | tours/activities | Direct in-house or via TP | 8%, 30-day | **✅ APPROVED 2026-08-31 — Affiliate partner ID `LLZRLJO`** (account: founder@globeskimmers.io, site globeskimmers.io). Tracked link = any GYG URL + `?partner_id=LLZRLJO`; add `&cmp=<subid>` for per-click attribution into D1. A/B against Viator. (Widgets/deep-links easy; API is traffic-gated — skip API for now.) Still to do on the portal: payment details, 2-step verification. |

**Phase-1 goal:** get all 10 applications *submitted*. Nos. 1–3 + 8–9 are the highest-value / easiest wins.

### Travelpayouts — actual state on 2026-08-31 (from the portal)
**Already joined (26):** Klook, Yesim, Kiwitaxi, Localrent, Welcome Pickups, Tiqets, Kiwi.com, GigSky, Airalo (12% via TP — beats the Impact plan; keep TP as its one channel), GetTransfer, Drimsim, GetRentacar, AirHelp, Go City, EKTA, Economybookings, BikesBooking, QEEQ, WeGoTrip, AutoEurope, Radical Storage, Aviasales, intui.travel, Compensair, Saily, KKday.
**Booking.com and Agoda: NOT AVAILABLE to this account on TP (checked 2026-08-31).** Decision: don't chase them. **Stay22 is the hotel lane and is already live** — FindAHotel.jsx runs a multi-OTA meta-search over Booking / Expedia / Agoda / Hotels.com with affiliate handoff + D1 click logging, so those inventories are monetized through it already. Rows #6/#7 above are superseded. Optional second hotel lane later, only for A/B: Expedia Group via Impact or Trip.com via Partnerize. The real upgrade remains §3 LiteAPI (own the booking, ~3–5× the affiliate rate).
**Channel corrections:** Klook is joined via TP (not Involve Asia) — leave it there. Viator + GetYourGuide stay DIRECT (not in TP) ✓.
**Integration note:** many programs are "Mobile web only" tracking — the app must open affiliate links in the in-app browser (Capacitor Browser / SFSafariViewController), never hand off to the partner's native app, or attribution is lost. Seven test links exist under Tools → Links (tpx.lt short links); programmatic links use the tp.media/r deep-link format with marker 755378 + sub_id.

---

## 2. PHASE 2 — after the first approvals land
| Program | Vertical | Channel | ~Terms | Notes |
|---|---|---|---|---|
| **Go City** | city passes / "discounts" | [gocity.com/affiliate](https://gocity.com/en/affiliate-program) (Partnerize) | 6%, ~$350-450 AOV → ~$26/sale, 90-day cookie | ⚠️ **$0 commission on in-app purchases — must deep-link to WEB.** |
| **Tiqets** | attraction tickets | via TP | 8% via TP | Museums/attractions; lower AOV (~$73). |
| **Klook** | activities + eSIM | Involve Asia (~2-day approval) | ~5-6.5%, eSIM 20% | Best APAC coverage; eSIM alt to Airalo. |
| **Blacklane** | chauffeur/premium | FlexOffers / CJ | $24 flat/sale, 90-day cookie | Premium airport/city chauffeur. Confirm program is open (some listings show "closed"). |
| **Daytrip** | car-with-driver / day-trips | Direct email (partners@daytrip.com) | 5% | The flagship multi-day/day-trip product; needs a direct deal. |

---

## 3. LATER / EVALUATE (not an application — a build decision)
- **LiteAPI / Nuitée** — [liteapi.travel](https://www.liteapi.travel/) — grab a **free sandbox key anytime** to evaluate. This is the path to **real in-app hotel booking with your own markup (~10-25%, ~3-5× the affiliate rate)** — no contracts, no minimums, 3M+ hotels. It's a Phase 2-3 *product build*, not just a link. Start with affiliate deep-links (Phase 1), upgrade to LiteAPI when you want to own the hotel booking surface.

---

## 4. ⛔ Do NOT apply (from the research)
- **Travelgate / TravelgateX** — B2B connectivity hub; you'd have to bring your own supplier contracts. Overkill at zero volume.
- **Expedia EPS Rapid, Hotelbeds direct, RateHawk, Zentrum Hub, Booking Demand API** — wholesale/in-app booking gated on volume/contracts/deposits. (LiteAPI beats all of them for a startup.)
- **Expedia TAAP** — needs travel-agency credentials (IATA/ARC/CLIA).
- **Flight GDS (Amadeus/Sabre) + Duffel in-app flight booking** — merchant-of-record + IATA + DOT refund-from-own-funds + support burden. Flights are a ~1-3% loss-leader; if ever, do a light **metasearch referral** (Aviasales/Skyscanner via TP) only.
- **Uber/Bolt/Grab "affiliate"** — no per-ride commission exists for 3rd parties. Ship Uber as a free UX deep-link (utility), and separately apply to Uber's Impact program only for the one-time new-user bounty.
- **Honey-style coupon cookie-overwrite** — reputationally toxic + violates the honest-UX rule.

---

## 5. Channel rule (avoid attribution conflicts)
Pick ONE channel per brand:
- **Direct:** Viator, Discover Cars, GetYourGuide (optional), Airalo (Impact), Wise (Partnerize), Go City (Partnerize), Blacklane (FlexOffers/CJ), Daytrip (email).
- **Via Travelpayouts:** Booking, Agoda, Welcome Pickups, Kiwitaxi, Aviasales, Tiqets.
Don't join, e.g., Viator both direct and via TP.
