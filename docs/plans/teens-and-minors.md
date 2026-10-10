# GlobeSkimmers: Teens & Minors Plan

*Draft 2, 2026-10-10. This is a working plan, not legal advice. Items marked **(lawyer)** need a short check with counsel before you rely on them. Items marked **(unverified)** are claims I could not confirm.*

---

## 1. The rule in one paragraph

A **minor** is anyone under 18. We learn a user's age from the birthday they enter. Before it locks, the app shows one neutral confirmation ("Is Oct 3, 2008 right?"), and after that it is locked. When the phone gives an age range through Apple or Google, we use that too, and if the two disagree, **the younger one wins**.

There are four bands:

- **Under 13:** no social or public features. The account is frozen and its content is deleted.
- **13–15:** teen protections.
- **16–17:** teen protections. This is a separate band only because the country rules below differ by age.
- **18+:** adult.

Some countries set a higher minimum age for social features:

- **Australia under 16** is blocked from social features today.
- **Brazil under 16**, **France under 15** and **India under 18** are proposed to be blocked the same way (decision 5).

Blocked users keep the finders and a private passport that nobody else can see.

These are the design rules. They are goals the build must meet, not promises we can make to users today:

- A teen's profile and posts are **never public**. Teens never appear in search, suggestions, place lists or "people you may know". Someone who already knows a teen's exact handle can only *request* to follow them.
- A teen's location is **never shown live** to anyone except a mutual friend they chose to send a postcard to.
- Teens are never ranked on leaderboards, never shown streaks or popularity counts, never targeted with ads, and their data is never sold or shared for ads.
- Every protection is enforced **on our server**, through one shared age check. Hiding something in the app does not count.

---

## 2. Age bands by feature

"Mutual friends" means both people follow each other and both follows were accepted.

| Feature | Under 13 | 13–15 | 16–17 | 18+ |
|---|---|---|---|---|
| Private passport | Frozen, content deleted | Mutual friends can view it. Stamps appear to them 24h late | Same as 13–15 | Mutual friends can view it |
| Stamps & GPS | Off | Allowed. We store the place's coordinates, not the phone's. "I'm here" reports keep no phone location | Same as 13–15 | Allowed |
| Memory photos & videos | Off | Mutual friends only, 24h late, place-check required | Same as 13–15 | Allowed |
| Public passport | Off | Off. Checked on save **and** on every view | Off | Opt-in |
| Profile (name, avatar, bio, website, home city, favorites, dreams) | Off | First name and avatar shown to mutual friends only. No website. No home city outside mutual friends. Moderated | Same as 13–15 | Moderated. Shown per the user's privacy setting |
| Handle search / follow requests | Off | Exact-handle match only. Requests show the "no mutual friends" warning plus "Decline and report". Never in suggestions | Same as 13–15 | Allowed. Limited to 5 requests to teens a day |
| Tag a friend | Off | Mutual friends only, held until accepted. The tag shows to others 24h late | Same as 13–15 | Can tag a teen only if they are mutual friends. The teen's name never appears on the adult's public passport |
| Postcards / Mailbox | Off | Sent and received with mutual friends only. Postcard text moderated, and it waits if moderation is down. Their stamps reach friends' feeds 24h late | Same as 13–15 | Can reach a teen only if they are mutual friends |
| City Board (public postcards to a city), if built | Off | Off *(decision 3)* | Off | Allowed, moderated |
| Guestbooks | Off | Shown as "A traveler" (no name, no city, no avatar), 24h late, text moderated | Same as 13–15 | First name shown |
| Dish / coffee / store photos | Off | Anonymous, 24h late, month only, no alcohol, tobacco, vapes or cannabis, no people | Same as 13–15 | Anonymous, no identifiable person as the subject |
| Things to Do photos | Off | Anonymous, 24h late, month only, place only | Same as 13–15 | Anonymous, place only |
| Share memory photos to a place page | Off | Hidden *(decision 3)* | Hidden *(decision 3)* | Opt-in per photo, unticked by default, Delete mine anytime |
| Share to other apps (Instagram etc.) | Off | Image only. No profile link, QR or handle | Same as 13–15 | Allowed |
| Suggest a Place & likes | Off | Anonymous. Likes are counted, but teens never see like counts on their own suggestions and get no like alerts | Same as 13–15 | Allowed |
| Event stamps (future) | Off | Allowed, 24h late, never in any "who's here" list or organizer report | Same as 13–15 | Allowed |
| Push notifications | Off | Safety and friend activity only. Quiet from 10pm to 7am local time | Same as 13–15 | User's choice |
| Leaderboards, streaks, popularity counts | Off | Not ranked, nothing shown | Not ranked, nothing shown | Allowed |
| Ads / monetization *(none in the app today)* | None | If ads return: contextual only, under-age-of-consent tag, no identifiers, no alcohol, gambling or dating ads | Same as 13–15 | Allowed. Unknown age is treated as a minor |
| Demographic reports | Excluded | Excluded *(decision 4)* | Excluded *(decision 4)* | Age bands only. Any group under 20 is hidden |
| **AU <16, BR <16, FR <15, IN <18** | n/a | Every social and public row above is Off. Finders and private passport (seen by no one) stay | Same | n/a |

---

## 3. What happens at sign-up

**Required birthday.** The screen stays neutral: "One thing first: your birthday."

- It gives no hint that 13 is the minimum and has no pre-filled year. If the user goes back, the app does not let them re-enter a different date.
- The full date is required, and it locks after the neutral confirmation.
- On the server, a missing birthday means **"unknown, so no posting."** That applies at every door: photos, follows, tags, likes, reactions, postcards and guestbooks. Older app versions cannot skip it.
  - **Today this is not true for dish, coffee and store photos.** `handlePlaceDishAdd` (`cloudflare-worker-v7.12.js` ~14024) blocks only the `blocked` tier, so an account with no birthday can post publicly.
- All of these checks go through **one shared age check**, which also catches a user who has turned 13, 16 or 18 since the last check. A new feature cannot forget it.
- State on the screen why we ask: "To keep GlobeSkimmers safe and set the right privacy for your age." Investor totals are a secondary use and go in the privacy policy, not on the gate.

**Phone age signals: legally overdue in Texas.**

- **Apple** has required the Declared Age Range API for new Texas accounts since **June 4, 2026**. It also requires the Significant Change API, the StoreKit age rating property and consent-revocation server notifications ([Apple, June 3, 2026](https://developer.apple.com/news/?id=sg176nne)).
- Our iPhone path does not run today:
  - The permission is missing from the build.
  - The plugin is not shipped. `src/lib/ageSignal.js` returns `null` until `AgeRangePlugin.swift` ships.
  - The server rejects the value the app sends.
  - An "under 13" answer is ignored.
- **Android:** there is no connection to Google's Play Age Signals ([developer.android.com/google/play/age-signals](https://developer.android.com/google/play/age-signals)). Google's Texas timing is **(unverified)**; check the Play Console notices.

The fix: the app sends the phone's age band to the server, and the server stores only two things, the **resulting tier** and **how the age was checked** (self / Apple / Google). The raw signal is never kept, logged or used for analytics or reports. The exact use limits under Texas SB 2420 and Apple's and Google's terms are a **(lawyer)** check.

**Under 13.**

1. Freeze the account at once: no stamps, photos, follows, tags or postcards, and no analytics IDs. Show a kind message: "GlobeSkimmers isn't available on this account."
2. Within days, not weeks, delete the stamps, photos and stored files. COPPA does not clearly allow keeping a child's data while an appeal is pending **(lawyer)**.
3. The appeal is for adults who mistyped. It restores access, not deleted content. The neutral confirmation step exists to make that case rare.
4. Whether we may keep a minimal "under minimum age" marker to slow re-sign-up is **(lawyer)**. Don't promise it works: a child can sign up again with another email.
5. Never quietly change an under-13 birthday to 13.

**This must ship before or together with the required birthday.** Once someone tells us they are under 13, we have "actual knowledge" under COPPA ([16 CFR 312](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312)).

**Mistakes and appeals.**

- A correction to a **younger** age is accepted instantly.
- A correction to an **older** age, or an appeal of a freeze, goes to a founder review form, and the account stays at the stricter tier until it is decided.
- Australia's regulator expects an appeal route for deactivated accounts ([eSafety](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions)).

**Adults who claim to be teens.** A self-declared birthday cannot stop an adult from entering a teen's age to reach teens. Teen-to-teen contact therefore follows the same mutual-friends rules as adult-to-teen contact. "Report: I think this person is an adult" is a report reason, and it sets the account to adult-level contact limits until reviewed.

**Turning 18.** An "Approve followers" setting stays on until the user turns it off, so privacy does not loosen silently on their birthday.

---

## 4. Photos and location for teens

- **Place galleries show the place, not people.** Use a stricter check for anything public: reject a photo when a person is the main subject or anyone looks like a child. Private memory photos keep today's check.
  - In the share sheet: "Photos with people stay in your passport."
  - Don't promise users the checker is perfect. Tell them: "If you see a problem, tap Report."
- **If the photo checker is down, the photo waits.** It is never published unchecked. The same applies to **text** that reaches a teen (postcards, tag names, guestbook notes on a teen's passport). Today `gbModerate` lets text through when the checker fails.
- Teen uploads showing alcohol, tobacco, vapes or cannabis are rejected, and teen viewers do not see such photos from adults.
- **Teens' public photos are delayed 24 hours** and show only the month ("Oct 2026"). They never show a name, handle, avatar or home city.
- **Today the 24-hour delay exists in only two places:** the Mailbox feed (worker ~15284) and the who-signed list (~15730).
  - Teen dish photos, postcards, tags, and a friend opening a teen's passport do not use it. Apply it everywhere a teen's place appears, except a postcard the teen chooses to send.
  - I did not fully trace the passport view **(unverified)**.
- **The anonymity promise is broken today.** Dish photo addresses are `dish/<user id>/<uuid>.jpg` (worker ~14063), so one person's "anonymous" photos can be linked across places. Give every public photo a random name, rename the existing ones, and keep the poster-to-photo link only on the server.
- **Location.**
  - GPS is read only at the moment of stamping.
  - For teens, store the place's coordinates. Today `stamp_reports` keeps the phone's location rounded to about 100 m plus a user code (~13131); for teens, drop it.
  - Never add a live map or a "who's here now" list.
- **Remove photo location on the server too.** Today only the app removes it when resizing, and the server accepts any JPEG (~14059), so an old or modified app could publish a photo with its GPS tag. The server should strip that data before storing, for photos now and for future videos.
- **Child abuse material (CSAM) and intimate images:**
  - Lock suspected images away so nobody can view them and alert you. Do not re-open, forward or download them.
  - Report them to NCMEC's CyberTipline once you know ([18 U.S.C. 2258A](https://www.law.cornell.edu/uscode/text/18/2258A)), and keep the report material for 1 year (REPORT Act, [Pub. L. 118-59](https://www.congress.gov/118/plaws/publ59/PLAW-118publ59.pdf)).
  - Look at hash-matching (for example Cloudflare's CSAM Scanning Tool). Whether it works for files served from our storage is **(unverified)**.
  - Separately, a non-consensual intimate image removal form handled within 48 hours (TAKE IT DOWN Act, platform duty since May 19, 2026).
- **Physical safety.** Show a one-time card before the first GPS stamp: "Stay aware, don't enter private areas, never stamp while driving." Block stamping when the phone is moving at driving speed.

---

## 5. Messaging and strangers

- **Postcards.** Today the mutual-friend check runs only when the **sender** is a teen (worker ~14590), so an adult can postcard any teen by handle, and the text is not moderated. **Fix:** if either side is a teen, require mutual friends. Moderate the text (it waits if moderation is down). Teens see only broadcasts from mutual friends.
- **Tags.** Today anyone who knows a teen's email can put a tag invite in their inbox under any display name. **Fix:** teens can be tagged only by mutual friends, the tagger's name is moderated, and a teen's name never appears on an adult's public passport. The tag shows to others 24h late.
- **Handle lookup bug.** `gbHandleToUser` uses `ilike` (~15158), so `_` acts as a wildcard and `____` finds real users. **Fix:** exact match. The same `ilike` pattern in the seal and verify admin writes (~15841, ~15852) can change several rows at once, so fix those too.
- **Follow requests to teens.**
  - Show "Joined Oct 2026 · 2 mutual friends."
  - Warn the teen when there are no mutual friends.
  - Add a "Decline and report" button.
  - Limit adults to 5 teen requests a day, and flag adults whose requests are often declined.
  - Becoming mutual friends unlocks the teen's passport, so the warning comes **before** they accept.
- **Blocking does not fully work.** A blocked person's posts still reach the feed, and the only Block button sits on tag invites. **Fix:** a block removes follows in both directions, filters every feed and list, and is available on every profile, postcard, signature and photo. Apple and Google both require blocking; this is a rejection risk now.
- **Report everywhere.**
  - Teens get a one-tap "Block and report", with reasons including "I think this is an adult."
  - A minor-safety report alerts you immediately.
  - Aim to respond within 24 hours. Keep that as an internal target, not a promise in the app.
- **Profiles.** Moderate display names and bios; today they are not. Teens get no website link. Never build "people you may know" with teens in it.

---

## 6. Data, ads and demographic reports

- **Birthday purposes, stated when we ask for it:** an age check, teen protections, and anonymous totals. Update the privacy policy, Apple's privacy answers and Google's Data safety form the same day the purpose expands.
- **Reports:**
  - Totals only, and any group under 20 people is hidden. One threshold everywhere.
  - Events under 100 attendees get no age breakdown.
  - Organizers sign a "no re-identifying" clause.
  - Phone age signals are never used.
- **Minors in reports.** Leave them out entirely. This keeps us inside New York's Child Data Protection Act "strictly necessary" rule for under-18 data **(lawyer)**. The claim that Strava does the same was removed **(unverified)**.
- **Fix the admin age mix before showing it to anyone.** Today it:
  - uses year-only math,
  - drops under-13s silently,
  - may cut off at 1,000 rows (PostgREST's default limit),
  - counts deleted accounts.
- **Ads.** The app ships no ad SDK today. If ads return, minors and unknown ages get contextual ads only: no identifiers, an under-age-of-consent tag, and blocked alcohol, gambling and dating categories. The tracking (ATT) prompt is never shown to them.
- **Account deletion must remove everything.** Today the birthday, profile, dish photos, postcards, follows and blocks survive a deletion. Every new table joins the deletion list on day one. Google Play also requires a **web** link where users can ask for deletion ([Play policy](https://support.google.com/googleplay/android-developer/answer/13327111)).
- **Analytics.** Check the user ID on the server; today anyone can fake it. Stop analytics for frozen accounts.
- **Written documents:**
  - A data-retention policy and a security program (COPPA amendments).
  - A data protection impact assessment (DPIA) covering teens. The UK Children's Code requires one ([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/)).

---

## 7. Legal and store checklist

| Item | Date | What to do | Source |
|---|---|---|---|
| COPPA amended rule (US) | Compliance date Apr 22, 2026 | Freeze and delete under-13 data. Written retention policy and security program. Keep store art from looking child-directed: animated characters are an FTC factor, so don't lead with cartoon pets | federalregister.gov/documents/2025/04/22/2025-05904 ; ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.2 |
| Texas SB 2420 (app stores) | **In force.** Fifth Circuit stayed the injunction (May 28 administrative stay, June stay pending appeal); the Supreme Court declined to vacate (July 2026). Apple's requirements live since **June 4, 2026** | Declared Age Range, Significant Change API before each significant change (galleries, required birthday, videos), consent-revocation notifications, StoreKit age rating code. **Overdue** | developer.apple.com/news/?id=sg176nne ; ccianet.org/litigation/ccia-v-paxton/ |
| Utah ASAA | Delayed to **May 6, 2027** (HB 498). AG enforcement removed; private lawsuits remain | Same setup as Texas | wileyconnect.com/utah-amends-app-store-accountability-act-asaa-key-obligations-delayed-until-may-6-2027 |
| Alabama ASAA (HB 161) | **Jan 1, 2027** | Same setup as Texas | loeb.com/en/insights/passle/2026/02/alabama-becomes-the-fourth-state-to-enact-an-app-store-accountability-act |
| Louisiana HB 570 | Delayed to **July 1, 2027** | Same setup as Texas | reclaimthenet.org/bill/louisiana-app-store-accountability-act ; legis.la.gov **(lawyer: confirm the amending act)** |
| California AB 1043 | Jan 1, 2027; existing accounts by July 1, 2027 | Request the phone's signal and treat it as the main source; "younger wins" fits | alstonprivacy.com/california-enacts-digital-age-verification-law/ |
| Mississippi HB 1126 and other state social-media laws (FL HB 3, GA, TN, VA SB 854) | Mississippi enforceable since 2025; the others are mixed and often enjoined | Check whether each one's definitions reach us. Options: parental consent, or geo-limit social features **(lawyer)** | NetChoice v. Fitch (Supreme Court denied emergency relief Aug 2025) **(verify)** |
| Vermont AADC | Jan 1, 2027 **(lawyer: who it covers)** | No streaks or popularity counts for minors; high-privacy defaults | hunton.com (Vermont AADC) |
| Connecticut minors' amendments | July 1, 2026 **(lawyer)** | No targeted ads to under-18s. Precise location only when strictly necessary | fpf.org/blog/connecticut-shows-you-can-have-it-all/ |
| New York Child Data Protection Act | Since June 20, 2025 **(lawyer)** | Under-18 data only when strictly necessary, so keep minors out of reports | ag.ny.gov (Child Data Protection Act) |
| UK Online Safety Act | **Overdue.** Guestbooks and dish posts already made us a user-to-user service, before Mailbox (Sept 30) | Three short dated assessments: illegal content, children's access, children's risk. Whether we have enough UK users for the Act to apply is **(lawyer)** | ofcom.org.uk/online-safety ; pinsentmasons.com (children's access assessment) |
| UK Children's Code (ICO) | Now | DPIA. High privacy by default. Location off by default. No nudges | ico.org.uk (Children's code) |
| EU DSA Art. 28 | Exempt while we are a micro or small enterprise (Art. 19). GDPR Art. 8 applies only if we rely on consent | Re-check if we grow. Don't rely on consent as the legal basis for EU teens **(lawyer)** | eur-lex.europa.eu/eli/reg/2022/2065/oj |
| Australia under-16 law | Since Dec 10, 2025 | Keep the block. Short self-assessment: the Rules exclude some service types (for example product and service information); whether we fit is **(lawyer)**. Use home country plus the phone signal, not just IP. Today the country comes from the IP at sign-up (`cf-ipcountry`) | esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions |
| Brazil Digital ECA (Lei 15.211/2025) | Since March 2026 | Social features off under 16. Most protective defaults for all under-18s. Self-declared age may not be enough **(lawyer)** | planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15211.htm |
| France under-15 | Passed July 21, 2026. New accounts Sept 1, 2026; existing Jan 1, 2027. Whether it covers us is **(lawyer)** | Social features off under 15 | ny1.com/nyc/all-boroughs/ap-top-news/2026/07/21/french-lawmakers-adopt-a-sweeping-social-media-ban-for-children-under-15 |
| India DPDP Act and Rules | Child = under 18. Verifiable parental consent; consent duties phased toward ~2027 **(lawyer)** | Social features off for under-18s in India, or build parental consent | meity.gov.in (DPDP Rules 2025) **(verify date)** |
| Philippines Data Privacy Act | Now **(PH counsel)** | Age counts as sensitive data: add a consent line for PH users | lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html |
| CSAM reporting / TAKE IT DOWN Act | Now / since May 19, 2026 | NCMEC CyberTipline reporting; keep material 1 year. 48-hour intimate-image removal form | law.cornell.edu/uscode/text/18/2258A ; congress.gov/118/plaws/publ59 |
| Apple age rating | Next submission | Social Media = Yes. That and Infrequent Alcohol both mean 13+. User-Generated Content = Yes. Messaging = Yes (postcards). Advertising = No while there are no ads. Age Assurance = Yes only once it works. **Unrestricted Web Access: No is defensible only if outside links open just the specific partner or place page, with no URL bar or search. A Yes makes the app 16+** | developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ |
| Apple 1.2 / Google UGC policy | Next submission | Terms accepted before the first post. Filtering, Report, Block, delete-my-post everywhere, published contact info. **Block on every profile is currently missing: rejection risk** | developer.apple.com/app-store/review/guidelines/#user-generated-content ; support.google.com/googleplay/android-developer/answer/9876937 |
| Google Child Safety Standards | Required for Social and Dating category apps. Do it anyway; it's cheap | Public anti-child-exploitation page, in-app reporting, NCMEC process, named child-safety contact in Play Console | support.google.com/googleplay/android-developer/answer/14747720 |
| Google target audience | Next submission | 13+ only. Answer "appeals to children" honestly (cartoon pets and stamps) | Play Console → App content |
| Account deletion (both stores) | Now | Delete shared content too, plus Google's web deletion link | developer.apple.com/support/offering-account-deletion-in-your-app/ ; support.google.com/googleplay/android-developer/answer/13327111 |
| Apple 5.1.2(i), third-party AI | Now | Ask permission before photos and text go to Claude for checking | developer.apple.com/app-store/review/guidelines/#data-use-and-sharing |
| Screenshots | Next submission | Apple needs **both** an iPhone set (6.9" or 6.5") and an iPad 13" set, because the app runs on iPad. iPad images must show the iPad layout, not stretched iPhone frames. Screenshots must show the app in use (2.3.3) and suit all ages (2.3.8) | developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/ |

**Fix in the repo:** `docs/research/teen-safety-platforms-2026-09.md` needs three corrections:

- Texas is **in force**. Apple's requirements have applied since June 4, 2026.
- Utah moved to May 6, 2027.
- Louisiana moved to July 1, 2027.

---

## 8. Build order

S, M and L are rough sizes (small, medium, large). Server and app say where the work happens.

**Phase 0: overdue now (Texas, store rejection risk)**

1. iPhone Declared Age Range, Significant Change API and consent-revocation notifications: app L, server S.
2. Block that really blocks, plus Block and Report on every profile, postcard, signature and photo, plus founder alerts: server M, app M.
3. Birthday check on dish, coffee and store photos (no birthday means no posting): server S.
4. Postcards: check the recipient's age, moderate text with no posting when the checker is down, mutual-only for teens: server S.
5. Exact-match handle lookup, including the admin writes: server S.

**Phase 1: before the required birthday ships and before the next store submission**

1. Under-13 freeze and prompt deletion; appeal restores access only: server M, app S.
2. One shared age check: unknown means no posting, it refuses when unsure, and it recomputes tiers: server M.
3. Tags: mutual friends only for teens, moderated names, 24h delay: server S.
4. Public passport: check age on save **and** on view: server S.
5. Community-rules "I agree" sheet with the AI-check permission (Apple 5.1.2(i)), plus Terms clauses and a public anti-child-exploitation page: app S, site S.
6. Full account deletion, including the birthday, plus Google's web deletion link: server M, site S.
7. Moderate display names and bios. No website link for teens: server S.
8. Strip photo location on the server: server S.
9. Age-rating answers fixed, demo account filled, review notes written, UK assessments and DPIA written: docs S.

**Phase 2: before place galleries, Things to Do photos and memory sharing**

- Random photo names, and rename existing photos: server M.
- Stricter public-photo check (no people as subject; no alcohol etc. for teens): server S.
- 24-hour delay and month-only dates everywhere a teen's place appears (passport view, dishes, tags, guestbooks): server M.
- Yelp-style viewer with Report, Hide this traveler, Delete mine: app M.
- CSAM path, NCMEC registration, intimate-image removal form: server M, site S.
- Android Play Age Signals, before Jan 1, 2027 (California, Alabama): app L.
- Fix the admin age mix: server S.
- Australia, Brazil, France and India age rules, using home country plus the phone signal: server S.
- No phone location in `stamp_reports` for teens: server S.

**Phase 3: alongside later features**

- Suggest a Place:
  - Auto-decline schools and homes.
  - Hide the exact pin while a suggestion is pending.
  - Keep teen suggesters anonymous, and show them no like counts.
  - Limit how often users can suggest.
  - Size: server M.
- Videos with frame moderation, mutual friends only and 24h late for teens, location stripped: L.
- Event stamps without any "who's here" list: M.
- Organizer reports with groups under 20 hidden: M.
- Smarter follow-request cards, daily limits, and the "I think this is an adult" report reason: M.
- "Approve followers" at 18: S.
- First-stamp safety card and driving-speed guard: app S.
- Teen push quiet hours: app S.
- Apple parental approval when parental controls are on: M.

---

## 9. Decisions for you

1. **Under-13 handling.** (a) Freeze, delete quickly, appeal restores access only. (b) Block sign-up entirely. (c) Build parental consent, which is costly. **Recommend (a)**; the appeal window length is **(lawyer)**.
2. **Teen photos in place galleries.** (a) Allowed, delayed 24h, place only. (b) Adults only. (c) 16–17 only. **Recommend (a).**
3. **Teens sharing memory photos to a place page, and posting on City Board.** (a) Hidden for teens. (b) Opt-in, delayed 24h. **Recommend (a) for now.**
4. **Teens in organizer and investor reports.** (a) Exclude them. (b) One "under 18" count, hidden when under 20. **Recommend (a).**
5. **Brazil, France and India.** (a) Social features off for BR under 16, FR under 15, IN under 18. (b) Build a guardian link. **Recommend (a).**
6. **EU, UK and Swiss under-18s in public galleries.** (a) Teen rules as above. (b) Adults only. **Recommend (a), and ask a lawyer.** (The draft's "as Yelp does" was removed as unverified.)
7. **Birthday after 18.** (a) Keep the full date. (b) Reduce it to the birth year. **Recommend (b).**
8. **A lawyer.** (a) One focused consult on Texas and the other app-store laws, Mississippi, Australia, COPPA deletion timing, Brazil, India and the Philippines. (b) Go without. **Recommend (a) before the galleries ship.**

---
