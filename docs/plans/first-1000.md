# The first thousand — plan, 2026-11-26

Founder 2026-11-20: "after we update the look of the app, let's start customer acquisition and find a way to find our first 1000 customers who are into the type of stuff we built." Founder 2026-11-26: "Let me know if there's anything we need to do to reach our next 1000." The long plan (docs/STRATEGY_AUDIT_2026-11-26.md) prices every rung off retention, and this is rung 0.

## Where we stand (read from our own data, 2026-11-26)

| Number | Today | Source |
|---|---|---|
| Accounts | 96 | member_numbers |
| New accounts, last 30 days | about 16 (4 a week) | signed_up events, 16 distinct users |
| Active, last 30 days | 29 signed in | events |
| Active, last 7 days | 5 | events |
| Members who stamped a City Card, last 30 days | 3 | citycard_stamp |
| Passport stamps, last 30 days | 165 events, but logged without a user id | passport_stamp |

Target: **1,000 accounts by 2027-03-31**, about 55 new a week for 17 weeks, a fourteen-fold step up from today. Milestones: 200 by Dec 31 (Wrapped and the balikbayan season), 500 by Feb 14, 1,000 by Mar 31. The number that matters more than the count is activation: a first stamp with a photo within a day of signing up. In October 74 of 80 accounts had never stamped. We measure that before we spend a dollar on reach.

## The rule from October

Lead with the single-player value: count your countries and famous places from your camera roll; the stamps feed Instagram instead of competing with it. Never say "social network". Onboard people in person when you can ("do it for them" with their own last trip). Share your own passport link instead of an ad. No paid ads until the pitch passes a five-second test with strangers.

## Four engines, about 55 a week together

### 1. Filipino travelers, starting now (target 20 a week)
Why now: December is balikbayan season and Simbang Gabi runs Dec 16–24; the Philippine series is the hook ("your province has a stamp"), with the Top 10 art live and the rest landing as you draw it.
- Channels: Filipino-American and OFW Facebook groups; TikTok and Instagram travel creators in the Philippines with 5,000 to 50,000 followers; the FB Page, @globeskimmers.io on Instagram, @GlobeSkimmersHQ on X; in person at SoCal Filipino events and churches with the ph card.
- The gift that opens doors: the drawn stamp of a creator's hometown or favourite place, sent as an image with one line: "We drew your place. It's in the passport now."
- Founder: 10 creator messages a week; one community event with cards in December.
- Claude: the Philippine SQL the day the art lands, a "country launch kit" (five images, the message sheet lines, the card) per series.

### 2. Los Angeles, in person (target 10 a week)
- Cards at Griffith, the Hollywood Sign trail, Santa Monica Pier, Pink's: the kit and stamps cards, placed where the owner allows.
- One Saturday "do it for them" table a month at a busy spot: open the app with a stranger's last trip and stamp it with them. This is also the five-second test.
- The first three official-stamp partners (a museum, a café, a destination) each get a window QR. Partners recruit for you.

### 3. China series, 562 drawn stamps (target 10 a week)
- Audience: English-speaking travelers to China and Chinese-Americans. The channel for both is RedNote (Xiaohongshu), plus Instagram and Pinterest carousels.
- A "stamp of the day" carousel from the China art, five a week, with the place's one-line story. The art is the content; nothing new to make.

### 4. The product's own loops (target 15 a week by January, compounding)
- Passport Wrapped by Dec 15: every member gets a share card, the one December moment people already share.
- Postcards to non-members already land in email; the landing page is the invitation. Add "Stamp with a friend": both members earn a collectible when a referred friend makes a first stamp.
- The profile QR ("scan a friend") exists; put it on the Wrapped card.
- Product Hunt on a December weekend; an Apple featuring nomination three weeks before the next release; App Store keywords (travel passport, stamps, I was here, countries visited); a rating prompt after the first stamp.

## The weekly numbers (a Monday report, built by Claude)

Installs by source (the card and campaign tags already count in App Store Connect and Play), sign-ups, activation (first stamp with photo within 24 hours), week-two return, stamps per active member, D7 and D30 retention, postcards sent to non-members, top sources. First fix: passport_stamp events must carry the user id, or activation cannot be measured.

## The first two weeks, Nov 27 to Dec 10

Claude
1. Weekly growth report from D1 and Supabase, first edition Monday Dec 1.
2. Stamp events carry user ids; activation and week-two return computed.
3. Passport Wrapped built Dec 1–12, shipped by Dec 15 (OTA).
4. "Stamp with a friend" referral collectible by Dec 10.
5. App Store keyword set and featuring-nomination text by Dec 2.
6. The Philippine launch kit and SQL the day the art lands; the China carousel set this week.
7. Official-stamp flag, partner art upload and the counts-only report the day the first partner says yes.

Founder
1. Order 200 cards (ph and kit) by Nov 28; 16 pt matte, matte back.
2. The fastest fifty: people you already know, onboarded one-on-one with their own last trip. This is also where the five-second test gets its first honest answers.
3. 10 creator messages a week with the hometown-stamp gift.
4. Three partner emails this week: one museum, one café, one destination office, at any price.
5. Five posts a week: stamp of the day (China now, Philippines as the art lands), one Wrapped teaser in December.
6. Simbang Gabi presence Dec 16–24 with the ph card.
7. Tell me your hours per week for this, so the plan fits the hospital schedule instead of fighting it.

## Honest risks
- Fourteen times today's pace. If January ends under 300 accounts, the plan changes, not the target.
- The app is English only; fine for Filipino and Chinese-American audiences, a limit for mainland China.
- Activation is unmeasured until the stamp events carry user ids; the first report may be uncomfortable.
- No ads until the five-second test passes; money cannot fix a pitch strangers do not get.
