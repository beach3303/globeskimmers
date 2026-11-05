# Border grace — the entry stamp you can't miss (proposal, 2026-11-03)

**Status:** Phase 1 BUILT 2026-11-05 (commit on stamping-v2; BUILD_TEST_CHECKLIST 2026-11-05), awaiting push + OTA —
the 48-hour window for crossings and airports, the sheet on any page with the mode question, the Entry waiting
card. Left out, the founder's call: the "flight sensed, no gate seen" half. Phases 2 and 3 as proposed below.

## What happened (founder, 2026-11-03, I-10 Los Angeles → Scottsdale)

She mapped the Colorado River crossing, hoped for a notification, crossed, passed the "Welcome to Arizona" sign,
and kept closing and reopening the app. No prompt. Her friend in the passenger seat, app open, got "You crossed into
Arizona!" well past the sign. She never got the stamp.

## Why the app missed it (the code as of main 5dfbd25)

The land-border prompt is `src/components/BorderCrossingPrompt.jsx`. A crossing is offered only when ALL of these hold:

1. **Home only.** It is mounted on `src/pages/Home.jsx` alone. Reopening into the Passport, Boards or Mailbox never runs it.
2. **A live fix.** `isLiveFix`: a GPS fix the phone took in THIS app run, under 30 minutes old. A restored last
   location is not live. On a cold open the app takes a fresh fix only on some paths ('current' open behaviour, or
   the "Where to?" chooser → Current location, or auto-follow 1.5 s after open when the mode is live). With a
   **picked destination** (planning Scottsdale) the mode is 'navigate': auto-follow is skipped and the mismatch
   nudge never writes a live fix, so the prompt cannot run at all.
3. **A previous live fix in the old state, within 8 hours** (`RECENT_MS`). The app has to have "sensed the trip".
   An app last opened yesterday in California gives no baseline: "not a trip the app sensed", no prompt, ever.
4. **A ground-speed check.** Over an hour or more the cap is 130 km/h for a state line. I-10 is signed 70–75 mph
   (113–120 km/h); a clean run between two fixes an hour apart sits right under the cap, and fix noise can tip it
   over — then the drive reads as "a flight" and is dropped.
5. **A confirmation that can swallow the crossing.** The moment the two live fixes disagree, the prompt asks the
   worker for two precise reverse-geocodes. If either fails — and the river crossing on I-10 has thin coverage —
   the code keeps the new fix as the baseline (`keep(fix)`) and returns: "a crossing that can't be confirmed is a
   missed prompt, never a wrong one". **The baseline is now Arizona, so no later open compares Arizona against
   California again. One failed lookup at the line consumes the crossing for good.** Reopening cannot bring it back.
6. **Nothing outside the app.** iOS has only when-in-use location and the plist promises "It never tracks you in
   the background"; Android has foreground permissions only. No background fix, no notification, by design.

Her friend's open app hit the 5-minute poll → auto-follow (≥ 10 km moved) → a live fix and a confirmation that
happened to succeed, minutes down the road. That is the "way past the sign".

## The principle

**A crossing is a window, not a line.** The only hard rule stays: the app must have seen you inside the new
state or country. Everything else is grace. Nothing is stamped until you tap.

## The proposal, in three phases

### Phase 1 — the grace window (OTA, about a day)

- **48 hours of grace.** When a live fix is confirmed in a new state or country, the entry stamp becomes
  *pending* for 48 hours (founder floated "4:59"; 48 h covers a bullet train, a night's sleep, and a phone that
  stayed in a bag). It is offered on every open and every resume until stamped or declined.
- **Any page.** The prompt moves from Home to `src/Layout.jsx`, so it runs wherever the app opens.
- **Any age of baseline.** The 8-hour rule goes. The baseline is "the last place the app saw you"; if that was
  California yesterday and you are in Arizona now, the window opens. The speed check only sets the *default* mode.
- **"How did you get here?"** replaces the speed guess when the app didn't sense the drive: Car · Train · Ship ·
  Plane. Plane = no land stamp (flights are airport-to-airport: the arrival airport's prompt, with the country
  stamp beside it at an international one — unchanged). Car/train/ship = the welcome-sign (state) or checkpoint
  (country) stamp, with the mode's glyph.
- **A failed lookup never consumes a crossing.** The pending window keeps its fixes and retries on the next
  open/tick; the baseline advances only when the stamp is taken, declined, or the window expires.
- **The pick doesn't block the passport.** A planned destination stays the browsing choice; border sensing always
  runs on the live fix.
- **The stamp tells the truth.** Date = the day the app first saw you there. Place = the crossing when the app
  sensed it (two fixes either side within an hour), else "first seen near <town>" — rough to a city block, as now.
- **A pending card in the passport.** "ARIZONA · ENTRY WAITING · 46 h left" sits on the passport page for the
  window, so a dismissed pop-up is never the end of it. Decline = "Not this one" (that window closes); "Later" =
  ask again next open; "Turn off crossing pop-ups" stays.
- **Queue, not overwrite.** CA → AZ → NM in one day keeps two windows; they are offered in order.

### Phase 2 — ports of entry and the line ahead (OTA, two to three days)

- **Named ports of entry.** Real passports name the post. A table of state-line crossings on interstates and US
  highways, and of international road, rail and ferry crossings (built from OpenStreetMap: boundary × highway
  intersections, the nearest named place), lets the stamp read "ENTERED ARIZONA · EHRENBERG · I-10 · COLORADO RIVER"
  when the app sensed the crossing, and "first seen near Quartzsite" when it only caught you inside.
- **The line ahead.** With the app open — a passenger, or a mounted phone — a live strip: "Arizona line in 12.4 mi",
  counting down from simplified on-device state boundaries (≈200 KB, Census 1:5M; countries fetched per trip),
  then a slam of the stamp, a sound and a haptic at the line. The driver hears it; the passenger sees it. Needs
  only when-in-use location.

### Phase 3 — Border Watch: the notification when the app is closed (native builds + store review)

- There is no honest way to notify from a closed app without **background location**: iOS "Always" permission +
  the `location` background mode (significant-change monitoring wakes the app on cell-tower-scale moves, low
  battery; the app checks the state from the on-device boundaries and posts a local notification), Android
  `ACCESS_BACKGROUND_LOCATION` with Play's prominent-disclosure review.
- Proposed as an **opt-in per trip**: "Watch for borders on this trip" switches it on for 24 h and off by itself;
  the permission is asked only then, with plain words; the privacy string changes from "never in the background"
  to "only during a road trip you switch on, and it switches itself off". The notification deep-links to the
  pending window: "You crossed into Arizona 🌵 — your entry stamp is waiting."
- Risk: App Review and Play policy scrutiny of background location; a rejection costs a cycle. Worth it only
  after Phase 1 has removed the pain, since Phase 1 alone makes the stamp impossible to miss for anyone who opens
  the app within two days.

### Flights and ships (unchanged, stated)

- **Domestic flight:** departure airport stamp + arrival airport stamp, inside the airport fence (exists). No state
  entry stamp by air.
- **International flight:** the airport stamps plus the country stamp beside the arrival one (exists).
- **Ship:** the checkpoint stamp with the ship glyph (exists); a ports table (cruise ports, ferry terminals) as
  fences like airports is a later item, so a docking becomes "Port of departure / Port of arrival".

## Mapped out — 2026-11-05 (founder: "i do want the 48 hour window plan. can you map it out to me and also mock up?")

Mock-up canvas: https://claude.ai/artifact/7eFVCpHRPYwmWYwvJiMAJN (six artboards: the crossing caught; the crossing
later; entry waiting in the passport; the airport window; the line ahead; Border Watch).

**The state the app keeps (on the phone, `pp_crossings_v1`):**
- `baseline` — the last CONFIRMED region `{ cc, region, lat, lng, at }`, any age. It moves the moment a new region is
  confirmed, never because a window closed.
- `windows[]` — pending offers, each `{ kind: 'region'|'country'|'airport', key, name, firstSeen: { at, lat, lng, near },
  crossing?: { at, lat, lng, post }, modeGuess, expiresAt: firstSeen.at + 48 h, status: 'open'|'later' }`, oldest first.
- `unconfirmed?` — a live fix whose precise lookup failed; retried on the next tick/open; never promoted to the baseline.

**Sensing (any page — the watcher mounts in `src/Layout.jsx`, not Home):**
1. Every fresh live fix (open, foreground, the 5-minute tick, a stamp fix) is compared with `baseline`. Same region →
   `baseline` updates its spot/time. Different → the precise lookup confirms both ends; failure → `unconfirmed`, retry.
2. Confirmed different → a window opens (`firstSeen` = this fix; `crossing` = this fix + the previous one when they are
   < 1 h and < 80 km apart, the post named from the ports-of-entry table in Phase 2, else "first seen near <town>").
   `modeGuess`: plane if an airport fence was seen since the previous fix or the implied speed > 300 km/h; ship if
   both ends are ports (later); train/car from speed with car the default. `baseline` = the new region.
3. The planning pick never blocks sensing: it only decides what Nearby shows.

**Offering:**
- A window is offered as a sheet on the next render after it opens, and again on every open/foreground while it is
  open, at most once per app session unless the member tapped Later. The sheet: kicker (post or "first seen near"),
  "You crossed into <State>" / "You're in <State>", the mode row (Car · Train · Ship · Plane, guess pre-picked), Entry and
  Exit as the stamp itself in the ink drawn for this window, "Later — it waits 48 hours", "Not this one" (closes the
  window), "Turn off crossing pop-ups" (`pp_city_prompt`).
- Plane → no land stamp; the sheet says "flights are airport to airport" and closes the window.
- The passport page shows every open window as an ENTRY WAITING card above the book (stamp preview, "first seen near…",
  the hours left, Stamp it / Not this one); more than one → the first big, the rest as "Next · New Mexico · 44 h" rows.
- Stamping sends `visited_on` = the day of `firstSeen` (or `crossing`), `lat/lng` = that spot (rough), `verified: gps`,
  `mode`, `direction`, `ink`; the worker already keys directed stamps per visit and keeps mode/ink in meta.
- A window closes on stamp, Not this one, expiry, or when its region is left again without a stamp? No — it stays until
  expiry (a day trip across and back still deserves its entry).

**The airport window (same model, kind 'airport'):**
- Any live fix inside an airport fence opens a 48 h window for that airport (today it prompts once, only while inside).
  The sheet offers Arriving / Departing (the round stamp), and at an international airport the country stamp beside it,
  exactly as now; verified, because the app saw you there.
- A flight the app only inferred (no fence fix; the next fix hundreds of km away at an implied speed > 300 km/h):
  a smaller "Looks like you flew today" card — pick the departure and arrival airports from the nearest candidates,
  "Stamp both" / "I didn't fly". These print WITHOUT the ✓ (sensed, not seen at the gate) and never grant a state or
  country entry stamp. **Founder's call whether to keep this half.**

**Build order / estimate:** Phase 1 (window state, Layout watcher, sheet, passport card, airport window, mode question):
about a day and a half, OTA, no worker change. Phase 2 (ports-of-entry table from OSM, the line ahead with on-device
boundaries): two to three days, OTA. Phase 3 (Border Watch): native plugin both platforms, store builds and review.

## Founder's decisions

**Decided 2026-11-04:** the window is **48 hours** ("I do like the grace. It's 48 hours"). The inks: one per
direction was built 11-04 and REPLACED on 11-05 by the founder's real wish — **eight inks drawn at random when the
stamp is pressed and kept with it (meta.ink)**, so friends crossing together see different colours; plus bigger
flags and a line of the country's own (`src/lib/countryClaims.js`) on the checkpoint stamp. Built 11-05, awaiting
push (worker) + OTA. She also asked how often location is checked (answered: 1.5 s after open, on every
foreground, every 5 min while open, geocode only past 10 km; nothing when closed) and what the closed-app answer
is (Border Watch, Phase 3, or the no-permission timed reminder).

1. ~~Window length~~ — 48 hours.
2. The mode question (Car · Train · Ship · Plane) when the app didn't sense the drive — yes?
3. Phase 2's named ports of entry — US state lines first, international second?
4. Phase 3 Border Watch — build it at all, and if so, opt-in per trip with auto-off (proposed)?
5. Order: Phase 1 now (before Passport Wrapped on 11-24)?
