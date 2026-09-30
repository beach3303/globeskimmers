# Teen & Child Safety on the Big Platforms — State of the Art, Late 2026

**Research date: 2026-09-29.** How Meta (Instagram + Facebook/Messenger), TikTok,
Snapchat and YouTube protect minors today, what regulators now force, and the
delta against GlobeSkimmers' own social-layer spec
(`docs/research/social-architecture-2026-09.md` §4,
`docs/research/home-onboarding-restructure-2026-09.md` Part 4).
Every load-bearing claim carries a URL; platform-own pages and regulator
documents preferred. This is research, not a build order — the build queue
stays in `docs/PLANS.md`.

---

## Executive summary — 10 bullets

1. **Every major platform now defaults minors into a locked, server-enforced
   restricted mode.** Meta Teen Accounts run globally across Instagram,
   Facebook and Messenger ([TechCrunch](https://techcrunch.com/2025/09/25/meta-rolls-out-teen-accounts-on-facebook-and-messenger-globally/));
   TikTok and Snapchat tier 13–15 vs 16–17. Under-16s cannot loosen settings
   without a supervising parent ([Meta](https://about.fb.com/news/2025/04/introducing-new-built-in-restrictions-instagram-teen-accounts-expanding-facebook-messenger/)).
   The defining property is **server-side and not teen-reversible** — exactly
   the architecture our spec chose (`birth_year`-keyed worker enforcement).
2. **The age tiers have been standardized by law**: under 13 / 13–15 / 16–17 /
   18+. The Texas, Utah and Louisiana app-store laws use these categories, and
   Apple (Declared Age Range API) and Google (Play age-signals API) now hand
   apps the user's age range and parental-supervision status
   ([Loeb](https://www.loeb.com/en/insights/publications/2025/12/app-store-age-verification-laws-trigger-new-federal-and-state-childrens-privacy-requirements),
   [FKKS](https://technologylaw.fkks.com/post/102lxsp/countdown-to-jan-1-2026-mobile-developers-must-adopt-apple-google-apis-to-com)).
   Texas enforcement is currently suspended by a district-court injunction
   ([Apple developer news](https://developer.apple.com/news/?id=8jzbigf4)); Utah
   (2026-05-07) and Louisiana (2026-07-01) are in effect.
3. **Self-declared birthdays are dead as the sole mechanism.** Meta profiles
   age with AI (contextual clues, and since June 2026 visual analysis of
   photos/videos) and forces Yoti face-estimation or ID upload on suspicious
   age-up changes ([Meta](https://about.fb.com/news/2026/06/strengthening-teen-accounts-with-new-safety-updates-on-instagram-and-facebook/),
   [Biometric Update](https://www.biometricupdate.com/202605/meta-uses-ai-profiling-to-infer-user-age-enforce-teen-restrictions));
   YouTube runs ML age estimation in the US ([Variety](https://variety.com/2025/digital/news/youtube-ai-age-verification-automatically-restrict-under-18-users-1236488309/));
   Ofcom wrote to the major platforms in March 2026 demanding they enforce
   their minimum ages with *highly effective age assurance*
   ([Ofcom bulletin](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/online-safety-industry-bulletins/online-safety-industry-bulletin-march-2026));
   the EU preliminarily found TikTok's minor-account safety in breach of the
   DSA in July 2026 ([European Commission](https://digital-strategy.ec.europa.eu/en/news/commission-preliminary-finds-tiktok-breach-digital-services-act-failing-ensure-safe-accounts-minors)).
4. **Content defaults went PG-13.** Instagram's 13+ setting (Oct 2025, global
   by mid-2026) hides strong language, risky stunts, drug paraphernalia and
   blocks teens from even following accounts flagged for mature content;
   parents can tighten further with "Limited Content" (no comments at all)
   ([Meta PG-13](https://about.fb.com/news/2025/10/instagram-teen-accounts-pg-13-ratings/),
   [global rollout](https://about.fb.com/news/2026/06/new-13-plus-content-settings-for-teen-accounts-expanding-globally-on-instagram-facebook-messenger/)).
5. **Stranger contact is the surface everyone cut.** Instagram: DMs only from
   people the teen follows; TikTok: **no DMs at all under 16**, hard-off;
   Snapchat: mutual friends only, and adults cannot reach under-17s they
   aren't already friends with ([Snap](https://values.snap.com/privacy/teens),
   [Internet Matters](https://www.internetmatters.org/parental-controls/social-media/tiktok-privacy-and-safety-settings/)).
   Our v1 "no DMs for anyone" is stronger than all three.
6. **Night-time and screen-time controls are now table stakes** — and about to
   be law. TikTok: push silenced from 9pm (13–15) / 10pm (16–17), 60-minute
   daily default, full-screen "wind down" after 10pm for under-16s
   ([9to5Mac](https://9to5mac.com/2021/08/12/new-tiktok-teen-protections/),
   [MediaPost](https://www.mediapost.com/publications/article/404074/tiktok-reminds-teens-to-wind-down-at-10-pm.html)).
   Instagram: sleep mode 10pm–7am, 60-minute nudge
   ([Meta](https://about.fb.com/news/2024/09/instagram-teen-accounts/)). New
   York's SAFE for Kids Act final rules (July 2026, effective 2027-01-25)
   require parental consent for addictive feeds and restrict overnight
   notifications to minors ([Covington](https://www.insideprivacy.com/childrens-privacy/new-york-publishes-final-safe-for-kids-act-rules/),
   [NY AG](https://ag.ny.gov/press-release/2026/attorney-general-james-and-governor-hochul-release-final-safe-kids-act-rules)).
7. **Minor location data is treated as radioactive.** Snap Map location is off
   by default for *everyone*, with no way for parents to force Ghost Mode
   ([Snap](https://values.snap.com/privacy/teens)); Instagram's opt-in Map
   (Aug 2025) still drew a letter from 37 state AGs calling it a predator
   risk ([Consumer Affairs](https://www.consumeraffairs.com/news/instagrams-new-map-feature-sparks-safety-fears-what-parents-should-know-081825.html)).
   Our doctrine — real-time location never on any social surface, 24h forced
   delay on minors' stamps — is stricter than every platform surveyed.
8. **Parental supervision sees metadata, never content**, deliberately:
   Meta shows who the teen messaged and the *topics* asked of Meta AI, not the
   messages ([Meta help](https://www.meta.com/help/supervision/1443011347000662/),
   [TechCrunch](https://techcrunch.com/2026/04/23/meta-will-now-allow-parents-to-see-the-topics-their-child-discussed-with-meta-ai/));
   Snap's Family Center shows who the teen talked to in the last 7 days, not
   what was said ([Snap](https://values.snap.com/privacy/teens)); TikTok's
   Family Pairing notifies on uploads and reports without showing the content
   ([TikTok newsroom](https://newsroom.tiktok.com/en-us/supporting-families-with-new-family-pairing-features)).
9. **The penalties are no longer theoretical.** Meta settled with 29 states
   for **$16.7B** (Aug 2026), agreeing to teen daily time limits,
   algorithmic-feed off-switches and limits on beauty filters/like counts
   ([CNN](https://www.cnn.com/2026/08/26/tech/meta-states-settle-trial-children),
   [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/court-approves-meta-settlement-with-29-states-over-alleged-harms-to-children-and-teens));
   TikTok settled the DOJ COPPA suit for **$400M**
   ([Variety](https://variety.com/2026/digital/news/tiktok-doj-lawsuit-coppa-child-safety-lawsuit-settlement-1236840365/));
   a New Mexico jury hit Meta for **$375M** over child exploitation (Mar 2026)
   ([Social Media Victims Law Center](https://socialmediavictims.org/snapchat-lawsuit/));
   Disney paid **$10M** for COPPA violations on YouTube content
   ([Deadline](https://deadline.com/2025/12/disney-ftc-settlement-1236504226/));
   the amended COPPA Rule is in full effect since 2026-04-22
   ([Latham](https://www.lw.com/en/insights/ftc-publishes-updates-to-coppa-rule)).
10. **A large share of the platform tooling is PR, not substance.** Independent
    testing (Béjar/Fairplay/Molly Rose/NYU/Northeastern, Sept 2025) rated
    **64% of 47 Instagram teen-safety tools ineffective or discontinued**
    ([report PDF](https://fairplayforkids.org/wp-content/uploads/2025/09/Teen-Accounts-Broken-Promises-How-Instagram-is-failing-to-protect-minors.pdf),
    [TIME](https://time.com/7324544/instagram-teen-accounts-flawed/)); six
    months into Australia's under-16 ban, 92% of 14–15-year-olds still used a
    banned platform weekly ([Cato](https://www.cato.org/research-briefs-economic-policy/australias-social-media-ban-did-not-change-norms),
    [Al Jazeera](https://www.aljazeera.com/news/2026/8/3/australias-under-16-social-media-ban-failing-study-shows-what-it-means)).
    What actually works is the boring layer: hard server-side defaults keyed
    to an age signal the teen can't trivially forge. Copy that, skip the
    dashboards.

---

## Meta — Instagram Teen Accounts (and Facebook/Messenger)

### Age tiers and defaults

| | Under 13 | 13–15 | 16–17 |
|---|---|---|---|
| Account | Not allowed; removed when detected | Teen Account, **settings locked** — any loosening requires a supervising parent | Teen Account, teen may change settings alone |
| Visibility | — | Private by default | Private by default |
| DMs | — | Only from people they follow / are connected to | Same |
| Content | — | 13+/PG-13 setting, cannot opt out without parent | 13+ setting, cannot opt out without parent |
| Live | — | **Blocked without parental permission** | Allowed |
| Night | — | Sleep mode 10pm–7am (notifications muted, DM auto-replies) | Same |
| Screen time | — | 60-min daily nudge; parent permission needed to change | 60-min nudge, self-serve |

Sources: [Teen Accounts launch](https://about.fb.com/news/2024/09/instagram-teen-accounts/),
[April 2025 restrictions (Live, nudity-blur opt-out gated on parents; expansion to Facebook/Messenger)](https://about.fb.com/news/2025/04/introducing-new-built-in-restrictions-instagram-teen-accounts-expanding-facebook-messenger/),
[global FB/Messenger rollout Sept 2025](https://www.engadget.com/social-media/meta-rolls-out-teen-accounts-for-facebook-and-messenger-across-the-world-120000352.html),
[Instagram help: Teen Account settings](https://help.instagram.com/455298907304715).

### Content protections
- **PG-13 by default (Oct 2025 → global 2026):** hides sexually suggestive
  content, graphic imagery, strong profanity, drug paraphernalia, risky
  stunts; blocks sensitive search terms (self-harm, eating disorders,
  alcohol, gore) *including misspellings*; teens can't follow accounts
  flagged for mature content, and those accounts can't follow, DM or comment
  on teens; DM'd links to prohibited content won't open. AI chat experiences
  are also held to PG-13 ([Meta](https://about.fb.com/news/2025/10/instagram-teen-accounts-pg-13-ratings/),
  [April 2026 expansion](https://about.fb.com/news/2026/04/instagram-expands-teen-accounts-inspired-by-13-content-ratings/)).
- **Limited Content** (parent-set, stricter): filters more, and removes the
  teen's ability to see, leave or receive comments entirely
  ([Meta](https://about.fb.com/news/2025/10/instagram-teen-accounts-pg-13-ratings/)).
- **DM nudity protection:** suspected nude images in DMs are blurred
  on-device, on by default for all under-18s; under-16s need parental
  permission to turn it off ([Meta](https://about.fb.com/news/2025/04/introducing-new-built-in-restrictions-instagram-teen-accounts-expanding-facebook-messenger/),
  [The Hill](https://thehill.com/policy/technology/4587967-instagram-automatically-blurring-nudity-in-direct-messages-to-teens/)).
- **Self-harm search alerts to parents** (June 2026, EU/Brazil/India first):
  repeated suicide/self-harm searches in a short window trigger a parental
  alert; the teen is told an alert is going out
  ([Meta](https://about.fb.com/news/2026/06/strengthening-teen-accounts-with-new-safety-updates-on-instagram-and-facebook/)).
- **Facebook-side:** 13+ setting hides inappropriate content in Feed/Reels and
  limits interaction with Pages/Groups/Events that mostly post it; Messenger
  limits links to inappropriate FB content
  ([Meta](https://about.fb.com/news/2026/06/new-13-plus-content-settings-for-teen-accounts-expanding-globally-on-instagram-facebook-messenger/)).

### Age assurance
Self-declared DOB at signup, backed by: AI age-profiling from contextual
clues (birthday posts, school-grade mentions) and — since June 2026 — visual
analysis of photos/videos (explicitly framed as *not* facial recognition);
suspicious under-18→over-18 birthday edits force verification via **Yoti
facial age estimation or government ID**
([Meta](https://about.fb.com/news/2026/06/strengthening-teen-accounts-with-new-safety-updates-on-instagram-and-facebook/),
[Biometric Update](https://www.biometricupdate.com/202605/meta-uses-ai-profiling-to-infer-user-age-enforce-teen-restrictions),
[ABC](https://abcnews.com/GMA/Family/teen-safety-updates-coming-facebook-instagram-messenger/story?id=133509506)).

### Parental supervision (Family Center)
One dashboard now spans Instagram, Facebook, Messenger and Horizon
([familycenter.meta.com/supervision](https://familycenter.meta.com/supervision/),
[Meta June 2026](https://about.fb.com/news/2026/06/strengthening-teen-accounts-with-new-safety-updates-on-instagram-and-facebook/)).
Parents **can**: approve/deny setting changes for under-16s, set daily time
limits and scheduled breaks, see time spent, see who the teen follows /
is followed by / has blocked, see messaging *settings* and who the teen
messaged recently, see topic-level summaries of Meta AI conversations
(last 7 days), be notified when the teen reports something or starts sharing
location on Instagram Map — and can shut Map access off
([Meta help](https://www.meta.com/help/supervision/1443011347000662/),
[TechCrunch](https://techcrunch.com/2026/04/23/meta-will-now-allow-parents-to-see-the-topics-their-child-discussed-with-meta-ai/),
[TechSafety.org on Map](https://www.techsafety.org/blog/2025/10/15/safety-privacy-and-instagrams-location-sharing-features)).
Parents **cannot**: read messages or AI chat transcripts. That line is
deliberate and consistent across the industry.

### Location
Instagram Map (Aug 2025): sharing **off by default, opt-in**, parent-visible
and parent-revocable — and it *still* drew a protest letter from 37 state AGs
([Consumer Affairs](https://www.consumeraffairs.com/news/instagrams-new-map-feature-sparks-safety-fears-what-parents-should-know-081825.html)).
Lesson for us: even opt-in live location on a social surface is a
regulatory lightning rod. Our "never live, 24h delay for minors" stance
avoids the entire category.

---

## TikTok

### Age tiers and defaults

| | Under 13 (US) | 13–15 | 16–17 | 18+ |
|---|---|---|---|---|
| Account | "Younger Users" walled mode (curated feed, no posting) | Private by default | Public possible | — |
| DMs | None | **None — hard off, cannot be enabled** | Available, restricted (friends-type defaults) | Full |
| For You | — | Their content **ineligible** for For You | Eligible | — |
| Duet/Stitch/Downloads | — | **Permanently off, cannot be changed** | Available (settings visible to paired parents) | — |
| Comments on their posts | — | Friends-only max, even if account made public | Configurable | — |
| LIVE | — | No | **No — hosting is 18+** (raised from 16 in Nov 2022; 1,000-follower floor) | Yes |
| Push notifications | — | **Silenced from 9pm** (not changeable) | **Silenced from 10pm** | — |
| Screen time | — | 60-min daily default | 60-min daily default | — |
| Night | — | After 10pm the For You feed is interrupted by a full-screen "wind down" (calming music/meditation); a second, harder-to-dismiss prompt follows | — | — |

Sources: [Internet Matters TikTok guide](https://www.internetmatters.org/parental-controls/social-media/tiktok-privacy-and-safety-settings/),
[TikTok Guardian's Guide](https://www.tiktok.com/safety/en/tools-and-guides/guardians-guide),
[TikTok LIVE age requirements](https://www.tiktok.com/en/safety-hc/account-and-user-safety/age-requirements-for-tiktok-live),
[CBS on LIVE 18+](https://www.cbsnews.com/news/tiktok-raises-age-requirements-for-livestream-creates-adult-only-streams/),
[9to5Mac on notification curfews](https://9to5mac.com/2021/08/12/new-tiktok-teen-protections/),
[MediaPost on wind down](https://www.mediapost.com/publications/article/404074/tiktok-reminds-teens-to-wind-down-at-10-pm.html),
[TikTok newsroom on balanced habits](https://newsroom.tiktok.com/en-us/new-ways-we-are-supporting-parents-and-helping-teens-build-balanced-digital-habits).

### Family Pairing (parent link)
Parents can: set/adjust screen time (including **Time Away** scheduled
blocks), filter/restrict content, see the teen's selected topic interests,
**block specific accounts** from the teen's experience, get notified when the
teen uploads or when the teen files a report (without seeing the reported
content), and — for 16–17s — see whether downloads/Duet/Stitch are enabled
([TikTok newsroom, July 2025](https://newsroom.tiktok.com/en-us/supporting-families-with-new-family-pairing-features)).
Parents cannot read DMs or see watched-video history.

### Age assurance and the EU case
Signup is self-declared, backed by moderation signals and ML flags — and the
European Commission **preliminarily found TikTok in breach of the DSA (July
2026) for failing to ensure safe accounts for minors**, targeting exactly
this: unreliable self-declaration, the "rabbit hole" recommender risk for
minors whose age is misrepresented
([European Commission](https://digital-strategy.ec.europa.eu/en/news/commission-preliminary-finds-tiktok-breach-digital-services-act-failing-ensure-safe-accounts-minors),
[Verfassungsblog analysis](https://verfassungsblog.de/tiktok-dsa/)). The
Commission's direction of travel is that acceptable age estimation must be
independently provided or audited
([complexdiscovery](https://complexdiscovery.com/eus-preliminary-dsa-findings-put-tiktoks-engagement-design-in-the-regulatory-crosshairs/)).

---

## Snapchat

### Age tiers and defaults
- **13 minimum**, self-declared — and Snap does not verify; a child who
  enters an adult birthdate gets **zero** teen protections and Family Center
  can't even attach to the account ([Canopy guide](https://canopy.us/blog/is-snapchat-safe-for-kids/)).
  This "cliff edge" is the standing critique of Snap's model.
- **All teens (13–17):** private by default; friend lists private;
  communication only with **mutually accepted friends** or saved phone
  contacts; in-chat warnings when messaging someone without mutual friends;
  adults (18+) cannot search for or contact under-17s they aren't already
  friends with; teens don't see counts of who "favorited" their
  Stories/Spotlight ([Snap: values.snap.com/privacy/teens](https://values.snap.com/privacy/teens)).
- **13–15:** no access to public profiles at all.
- **16–17:** public profile possible but **off by default**, with stricter
  reply filtering on public stories ([Snap](https://values.snap.com/privacy/teens)).
- 2026 updates keep 13–15-year-olds' content inside their existing friend
  network ([Canopy](https://canopy.us/blog/is-snapchat-safe-for-kids/)).

### Location (Snap Map)
**Location sharing is off by default for all Snapchatters** (Ghost Mode is
the resting state); sharing is per-friend and precise only to chosen friends
([Snap](https://values.snap.com/privacy/teens)). Parents can *request* live
location via Family Center but **cannot force Ghost Mode** and get no alert
when a teen enables sharing
([UnderstandTech guide](https://www.understandtech.co.uk/snapchat-map-safety-and-ghost-mode-for-parents-in-2026-the-complete-guide-to-location-sharing-live-location-and-family-safety/),
[Timily](https://timily.app/guides/snapchat-parental-controls/)).

### Family Center
Parents can see: who the teen chatted with in the **last 7 days (never
message content)**, current friend list with trust signals, daily time spent
broken down by feature (Chat/Camera/Map/Spotlight/Stories — added 2026),
the teen's birthday setting; parents can set content-sensitivity controls
for Stories/Spotlight and **disable My AI** for the teen
([Snap](https://values.snap.com/privacy/teens),
[AirDroid overview](https://www.airdroid.com/parent-control/snapchat-family-center/)).
Notably missing: screen-time limits and remote Ghost Mode — Family Center is
the lightest-touch of the three supervision suites.

### Enforcement context
New Mexico's AG sued Snap in Sept 2024 over design choices allegedly
enabling sextortion; the motion to dismiss was denied in April 2025 and the
case is in discovery ([NM DOJ](https://nmdoj.gov/press-release/attorney-general-raul-torrez-files-lawsuit-against-snap-inc-to-protect-children-from-sextortion-sexual-exploitation-and-other-harms/),
[Social Media Victims Law Center](https://socialmediavictims.org/snapchat-lawsuit/)).

---

## YouTube (brief)

- **ML age estimation, US rollout since mid-2025**: signals include search
  and watch categories and account age; inferred under-18s get teen defaults
  regardless of the declared birthday; adults misclassified must verify via
  ID, credit card or selfie ([YouTube blog](https://blog.youtube/news-and-events/extending-our-built-in-protections-to-more-teens-on-youtube/),
  [Google support](https://support.google.com/youtube/answer/16422785?hl=en),
  [Variety](https://variety.com/2025/digital/news/youtube-ai-age-verification-automatically-restrict-under-18-users-1236488309/)).
- **Teen defaults:** personalized ads off; repetitive-viewing limits on
  body-image-adjacent content; take-a-break and **bedtime reminders** on;
  uploads default private for 13–17s; age-restricted content only for
  verified/inferred 18+ ([YouTube blog](https://blog.youtube/news-and-events/extending-our-built-in-protections-to-more-teens-on-youtube/)).
- Under-13s live in YouTube Kids / supervised accounts.

---

## The regulatory floor, late 2026

| Regime | Status | What it forces |
|---|---|---|
| **US app-store age laws (TX/UT/LA)** | TX effective 2026-01-01 but **enforcement enjoined**; UT 2026-05-07 and LA 2026-07-01 in effect | App stores verify age category (under-13 / 13–15 / 16–17 / 18+) and obtain parental consent for minors; **apps must consume the signal** (Apple Declared Age Range API, Google Play age-signals) and apply age-appropriate/most-restrictive defaults; UT explicitly requires most-restrictive privacy defaults for under-18s ([Loeb](https://www.loeb.com/en/insights/publications/2025/12/app-store-age-verification-laws-trigger-new-federal-and-state-childrens-privacy-requirements), [Apple](https://developer.apple.com/news/?id=btkirlj8), [Apple TX update](https://developer.apple.com/news/?id=8jzbigf4), [FKKS](https://technologylaw.fkks.com/post/102lxsp/countdown-to-jan-1-2026-mobile-developers-must-adopt-apple-google-apis-to-com)) |
| **UK Online Safety Act** | Children's codes in force since 2025-07-25 | Services likely accessed by UK children need a **children's access assessment + children's risk assessment**, and "highly effective age assurance" where children must be kept from harmful content; Ofcom is actively enforcing (fines issued; March 2026 letters demanding minimum-age enforcement; July 2026 age-assurance report) ([White & Case](https://www.whitecase.com/insight-alert/uk-online-safety-act-protection-children-codes-come-force), [Ofcom bulletin](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/online-safety-industry-bulletins/online-safety-industry-bulletin-march-2026), [Ofcom report](https://www.ofcom.org.uk/online-safety/protecting-children/use-of-age-assurance-report-2026)) |
| **EU DSA Art. 28 minors guidelines** | Published 2025-07-14; not binding but the compliance yardstick | Minors' accounts **private by default**; interactions (likes/comments) limited to approved contacts; **location sharing off unless explicitly enabled**; minors invisible to unknown users; scrutiny of addictive design ([Commission](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors), [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:C_202505519), [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2025/07/rd-european-commission-guidelines-on-protection-of-minors-under-the-digital-services-act)) |
| **Australia under-16 ban** | Live since 2025-12-10; 4.7M under-16 accounts removed; up to A$50M fines | "Age-restricted social media platforms" must take reasonable steps to prevent under-16 accounts (FB, IG, TikTok, Snap, YouTube, X, Reddit, Twitch, Kick named) ([eSafety](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions), [Sydney Uni explainer](https://www.sydney.edu.au/news-opinion/news/2025/12/05/what-is-australias-under-16-social-media-ban-the-world-first-law-explained.html)). Independent surveys show it leaking badly (92% of 14–15s still on banned platforms weekly by June 2026) ([Cato](https://www.cato.org/research-briefs-economic-policy/australias-social-media-ban-did-not-change-norms)) |
| **NY SAFE for Kids Act** | Final rules 2026-07-28, **effective 2027-01-25** | Parental consent before serving under-18s "addictive feeds" (personalized recommendation feeds; **reverse-chron / search / explicit-request feeds are excluded**) and before overnight notifications; annual-certified age assurance with a no-government-ID option; 5–10 year recordkeeping ([Covington](https://www.insideprivacy.com/childrens-privacy/new-york-publishes-final-safe-for-kids-act-rules/), [NY AG](https://ag.ny.gov/press-release/2026/attorney-general-james-and-governor-hochul-release-final-safe-kids-act-rules)) |
| **COPPA (amended)** | Full effect 2026-04-22 | Separate verifiable parental consent for third-party disclosures, written retention policies, broader "personal information"; FTC signaling continued enforcement priority ([Latham](https://www.lw.com/en/insights/ftc-publishes-updates-to-coppa-rule), [Womble 2026 outlook](https://www.womblebonddickinson.com/us/insights/alerts/overview-ftcs-2026-childrens-privacy-focus-expect-ongoing-if-not-more-attention)) |

### What regulators actually punished (the money trail)
- **Meta, $16.7B, 29 states (approved 2026-08-26)** — addictive design +
  misrepresenting safety to teens; remedies include teen time limits,
  algorithmic-feed off-switch, limits on beauty filters and like counts
  ([CNN](https://www.cnn.com/2026/08/26/tech/meta-states-settle-trial-children),
  [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/court-approves-meta-settlement-with-29-states-over-alleged-harms-to-children-and-teens),
  [CNBC](https://www.cnbc.com/2026/08/26/meta-social-media-trial-settlement.html)).
- **TikTok, $400M DOJ/FTC COPPA settlement (2026)** — collecting kids' data /
  failing to delete child accounts ([Variety](https://variety.com/2026/digital/news/tiktok-doj-lawsuit-coppa-child-safety-lawsuit-settlement-1236840365/)).
- **NM v. Meta, $375M jury verdict (2026-03-24)** — first state trial win
  holding a platform liable for child exploitation; a roadmap for the pending
  Snap case ([SMVLC](https://socialmediavictims.org/snapchat-lawsuit/)).
- **Disney, $10M FTC COPPA settlement (Dec 2025)** — mislabeled "Made for
  Kids" YouTube content ([Deadline](https://deadline.com/2025/12/disney-ftc-settlement-1236504226/)).
- **Ofcom fines** for missing age assurance (£1.35M 8579 LLC; £800K Kick)
  ([Ofcom via Lewis Silkin](https://www.lewissilkin.com/insights/2026/04/17/age-assurance-in-2026-what-do-digital-businesses-operating-in-the-uk-and-eu-need-to-know)).
- Pattern: regulators punish **(a)** knowingly serving minors while
  pretending not to know, **(b)** addictive-by-design engagement mechanics
  aimed at teens, **(c)** unsafe defaults (public accounts, open DMs), and
  **(d)** safety claims that testing disproves. They have *not* punished
  anyone for being too small to run a Family Center.

### PR vs substance — the honest read
- The **Fairplay/Béjar audit** rated 30 of 47 Instagram teen tools
  red (ineffective/discontinued), 9 yellow; adults could still reach teens
  via follow-suggestion loops, and time-management tools were largely
  ineffective ([report](https://fairplayforkids.org/wp-content/uploads/2025/09/Teen-Accounts-Broken-Promises-How-Instagram-is-failing-to-protect-minors.pdf),
  [Tech Policy Press](https://www.techpolicy.press/evaluating-instagrams-promises-to-protect-teens/)).
  The tools that *worked* were the hard defaults (private account, DM
  restrictions); the ones that didn't were nudges and dashboards.
- **Dismissible ≠ protective**: TikTok's wind-down is a full-screen prompt a
  teen can skip; its substantive siblings — the 9pm push cutoff and the
  under-16 DM hard-off — cannot be skipped, and that's the difference to
  copy ([Dataconomy on the meditation-as-PR question](https://dataconomy.com/2025/05/16/is-tiktoks-new-meditation-push-a-real-safety-play-or-just-good-pr-optics/)).
- **The self-declared-age cliff**: on Snapchat one fake birthdate strips every
  protection ([Canopy](https://canopy.us/blog/is-snapchat-safe-for-kids/));
  Australia's ban leaks at 92% ([Cato](https://www.cato.org/research-briefs-economic-policy/australias-social-media-ban-did-not-change-norms)).
  Any protection keyed to an unverified self-declaration inherits this. The
  emerging fix — and the only one that fits our size — is the **OS-level age
  signal** (Apple Declared Age Range / Google Play age-signals), which is
  parent-attested at the device level and free to consume.
- Behavioral/biometric age *estimation* (Meta, YouTube) is the expensive
  path and is itself under GDPR fire as profiling
  ([Oxford IDPL](https://academic.oup.com/idpl/advance-article/doi/10.1093/idpl/ipaf012/8327959)).
  Not for us.

---

## The delta: GlobeSkimmers spec vs the state of the art

Baseline: `social-architecture-2026-09.md` §4 (neutral age gate at social
opt-in; <13 no social; 13–17 minor defaults — private/friends-only forced,
pending follows, friends-only tags, 24h delayed visibility, no live location
ever, no DMs, no comments; fail-closed photo moderation; report+block with
`minor_safety` priority; 13+/Teen store ratings) and
`home-onboarding-restructure-2026-09.md` Part 4 (birthday as neutral age
screen; band-only retention; no ads personalization under 18 anywhere;
Declared Age Range API planned in Phase 5).

### Already planned — and validated by the 2026 state of the art
| Ours | Platform / regulator analogue | Verdict |
|---|---|---|
| Minors: private/friends-only forced, public option absent, server-enforced | The one category the Fairplay audit found effective; DSA guidelines' first ask | Keep — this is the substantive layer |
| Incoming follows `pending` for minors; no discovery surfaces | IG private-account model; DSA "invisible to unknown users" | Keep |
| **No DMs for anyone (v1)** | TikTok bans DMs <16; Snap mutual-friends-only; DMs are where the NM sextortion cases live | Keep, emphatically — stronger than all three platforms |
| Tags = consent cards; minors' tag policy forced to friends | IG tag/mention limits | Keep — ours is already a "tag review queue" (nothing to add) |
| **24h delayed visibility + never-live location on social surfaces** | Snap Map off-by-default; IG Map opt-in still drew 37 AGs; DSA: location off unless explicit | Keep — stricter than every platform; say so in store/privacy copy |
| Photo moderation fails closed when visible beyond owner; avatars always | Platform nudity classifiers; our postcards/shared photos pass through `gbModeratePhoto` | Keep — this *is* our "nudity detection on postcards"; add the courtesy pre-check below |
| Report + block + published contact; `minor_safety` sorts first | Apple 1.2 / Play UGC baseline | Keep |
| Reverse-chron follow feed (P2) | **Now a legal safe harbor**: NY SAFE excludes non-personalized/reverse-chron feeds from "addictive feed" consent machinery | Keep — record as a compliance invariant, not a taste choice |
| No like counts / follower leaderboards / long bios | Meta's $16.7B settlement obliges like-count limits for teens | Keep — parity by design |
| No ads personalization under 18, anywhere | YouTube/Meta already forced there; MODPA flat ban | Keep |
| Birthday band-only retention; neutral gate | Amended COPPA posture | Keep |

### Add (ordered; S/M/L effort)
| # | What | Why now | Effort |
|---|---|---|---|
| A1 | **Consume OS age signals before social ships**: Apple Declared Age Range API + Google Play age-signals; prefer the OS category over self-declared birth year; honor the parental-consent status they carry (UT/LA live, TX enjoined but API shipped) | Already sketched as Phase 5 (2.5d) in home-onboarding — this research confirms it's the single highest-leverage item; it's the only real answer to the fake-birthday cliff at our size | **M** (2.5d, native, store build — already budgeted) |
| A2 | **Lock `birth_year` after first entry**; any minor→adult edit requires the OS signal or a support ticket, never a free re-pick | Meta forces Yoti/ID on exactly this edit; Ofcom's March 2026 letters target minimum-age gates that don't gate; our COPPA "actual knowledge" logic collapses if the year is freely editable | **S** (one worker check + UI copy) |
| A3 | **Australia rule: no social opt-in under 16 for AU users** (extend the <13 branch to <16 when country = AU), documented "reasonable steps" | The under-16 ban is law with A$50M fines; scope turns on whether social interaction is a "significant purpose" — a cheap region rule removes the question entirely for a travel-journal app | **S** (region check on the existing server-side gate) |
| A4 | **UK OSA paperwork before P2**: children's access assessment + illegal-content and children's risk assessments, written and dated | The OSA duties bind user-to-user services with UK links regardless of size; Ofcom is fining; our spec covers COPPA/GDPR-K but never mentions OSA | **M** (documents, not code — a founder+Claude afternoon each) |
| A5 | **Notification curfew invariant, written into PLANS now**: when push ever ships, no push to under-18s 21:00–07:00 local (NY floor is overnight), server-enforced, not user-disableable for minors | TikTok's unskippable 9/10pm cutoff is the proven substantive control; NY SAFE regulates overnight notifications from 2027-01-25; costs nothing to lock in as a rule today (v1 has no push at all) | **S** (a paragraph in PLANS/push spec) |
| A6 | **24h triage SLA for `minor_safety` reports** (and a stated 48h for the rest) | Apple 1.2 requires "timely" response; the sorting exists, the SLA doesn't | **S** (process + one line in admin docs) |
| A7 | **NSFWJS client-side courtesy pre-check** on postcard/shared-photo upload ("this may not be shareable") before the server-side Haiku gate | Already half-specced in §4; saves round trips and mirrors the platforms' on-device blur pattern; never the gate | **S** |
| A8 | **Age-assurance audit record**: log method (os_signal / self_declared) + date alongside the band | NY SAFE-shaped recordkeeping (5yr) if we ever cross its thresholds; near-free if added with A1, painful to backfill | **S** (one column) |
| A9 | **Store + privacy copy states the doctrine**: "never live location; minors' passports private by default; a minor's stamp appears at least 24h later; no DMs" | The platforms' location features keep drawing AG fire that our design pre-empts — claiming the high ground is free trust; privacy policy needs the UGC section same-day at P1 anyway | **S** (copy) |

### Skip at our size (with the reason on record)
| What | Why skip | Effort avoided |
|---|---|---|
| Full parental-supervision suite (Family Center clone) | Platforms built these under settlement pressure at 100M-teen scale; the Fairplay audit found dashboards among the *least* effective tools; the OS parental-consent signal (A1) covers the legal need in UT/LA | **L** |
| Behavioral/facial AI age estimation, Yoti integration | GDPR-profiling risk, new vendor, biometric baggage — regulators are ambivalent about it even for the giants; OS signals give us a cleaner answer free | **L** |
| Screen-time limits / 60-min nudges / wind-down screens | We are a utility-journal, not an infinite feed; no autoplay, no recommender feed for minors; revisit only if an engagement loop ever appears | **M** |
| PG-13-style content-taxonomy tiers ("Limited Content" modes) | Our shareable surface is moderated travel photos + fixed-vocabulary reactions; the fail-closed pipeline is the right-sized control | **L** |
| DM nudity blur | Moot: no DMs — the decision that deletes the entire grooming/sextortion surface the NM cases are about. Guard the "no DMs in v1" line hard | — |
| In-app verifiable parental consent (<13 COPPA machinery) | <13 = no social, full stop (planned); VPC only becomes relevant if that ever changes | **L** |

**One-line doctrine to carry forward:** copy the platforms' *hard server-side
defaults keyed to an OS-attested age signal*; skip their dashboards, nudges
and estimation AI — the audits show the first category works and the second
is mostly PR.

---

## Sources

**Meta / Instagram**
- https://about.fb.com/news/2024/09/instagram-teen-accounts/
- https://about.fb.com/news/2025/04/introducing-new-built-in-restrictions-instagram-teen-accounts-expanding-facebook-messenger/
- https://techcrunch.com/2025/09/25/meta-rolls-out-teen-accounts-on-facebook-and-messenger-globally/
- https://about.fb.com/news/2025/10/instagram-teen-accounts-pg-13-ratings/
- https://about.fb.com/news/2026/04/instagram-expands-teen-accounts-inspired-by-13-content-ratings/
- https://about.fb.com/news/2026/06/new-13-plus-content-settings-for-teen-accounts-expanding-globally-on-instagram-facebook-messenger/
- https://about.fb.com/news/2026/06/strengthening-teen-accounts-with-new-safety-updates-on-instagram-and-facebook/
- https://about.fb.com/news/2026/04/helping-parents-understand-conversations-their-teens-are-having-with-ai/
- https://www.meta.com/help/supervision/1443011347000662/ · https://familycenter.meta.com/supervision/
- https://help.instagram.com/455298907304715
- https://www.biometricupdate.com/202605/meta-uses-ai-profiling-to-infer-user-age-enforce-teen-restrictions
- https://thehill.com/policy/technology/4587967-instagram-automatically-blurring-nudity-in-direct-messages-to-teens/
- https://techcrunch.com/2026/04/23/meta-will-now-allow-parents-to-see-the-topics-their-child-discussed-with-meta-ai/
- https://www.techsafety.org/blog/2025/10/15/safety-privacy-and-instagrams-location-sharing-features
- https://www.consumeraffairs.com/news/instagrams-new-map-feature-sparks-safety-fears-what-parents-should-know-081825.html

**TikTok**
- https://www.tiktok.com/safety/en/tools-and-guides/guardians-guide
- https://www.tiktok.com/en/safety-hc/account-and-user-safety/age-requirements-for-tiktok-live
- https://newsroom.tiktok.com/en-us/supporting-families-with-new-family-pairing-features
- https://newsroom.tiktok.com/en-us/new-ways-we-are-supporting-parents-and-helping-teens-build-balanced-digital-habits
- https://www.internetmatters.org/parental-controls/social-media/tiktok-privacy-and-safety-settings/
- https://www.cbsnews.com/news/tiktok-raises-age-requirements-for-livestream-creates-adult-only-streams/
- https://9to5mac.com/2021/08/12/new-tiktok-teen-protections/
- https://www.mediapost.com/publications/article/404074/tiktok-reminds-teens-to-wind-down-at-10-pm.html
- https://digital-strategy.ec.europa.eu/en/news/commission-preliminary-finds-tiktok-breach-digital-services-act-failing-ensure-safe-accounts-minors
- https://verfassungsblog.de/tiktok-dsa/
- https://variety.com/2026/digital/news/tiktok-doj-lawsuit-coppa-child-safety-lawsuit-settlement-1236840365/

**Snapchat**
- https://values.snap.com/privacy/teens
- https://www.understandtech.co.uk/snapchat-map-safety-and-ghost-mode-for-parents-in-2026-the-complete-guide-to-location-sharing-live-location-and-family-safety/
- https://timily.app/guides/snapchat-parental-controls/ · https://www.airdroid.com/parent-control/snapchat-family-center/
- https://canopy.us/blog/is-snapchat-safe-for-kids/
- https://nmdoj.gov/press-release/attorney-general-raul-torrez-files-lawsuit-against-snap-inc-to-protect-children-from-sextortion-sexual-exploitation-and-other-harms/
- https://socialmediavictims.org/snapchat-lawsuit/

**YouTube**
- https://blog.youtube/news-and-events/extending-our-built-in-protections-to-more-teens-on-youtube/
- https://support.google.com/youtube/answer/16422785?hl=en
- https://variety.com/2025/digital/news/youtube-ai-age-verification-automatically-restrict-under-18-users-1236488309/

**Regulators & enforcement**
- https://www.loeb.com/en/insights/publications/2025/12/app-store-age-verification-laws-trigger-new-federal-and-state-childrens-privacy-requirements
- https://technologylaw.fkks.com/post/102lxsp/countdown-to-jan-1-2026-mobile-developers-must-adopt-apple-google-apis-to-com
- https://developer.apple.com/news/?id=btkirlj8 · https://developer.apple.com/news/?id=8jzbigf4
- https://www.whitecase.com/insight-alert/uk-online-safety-act-protection-children-codes-come-force
- https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/online-safety-industry-bulletins/online-safety-industry-bulletin-march-2026
- https://www.ofcom.org.uk/online-safety/protecting-children/use-of-age-assurance-report-2026
- https://www.lewissilkin.com/insights/2026/04/17/age-assurance-in-2026-what-do-digital-businesses-operating-in-the-uk-and-eu-need-to-know
- https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors
- https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:C_202505519
- https://www.taylorwessing.com/en/insights-and-events/insights/2025/07/rd-european-commission-guidelines-on-protection-of-minors-under-the-digital-services-act
- https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions
- https://www.sydney.edu.au/news-opinion/news/2025/12/05/what-is-australias-under-16-social-media-ban-the-world-first-law-explained.html
- https://www.cato.org/research-briefs-economic-policy/australias-social-media-ban-did-not-change-norms
- https://www.aljazeera.com/news/2026/8/3/australias-under-16-social-media-ban-failing-study-shows-what-it-means
- https://www.insideprivacy.com/childrens-privacy/new-york-publishes-final-safe-for-kids-act-rules/
- https://ag.ny.gov/press-release/2026/attorney-general-james-and-governor-hochul-release-final-safe-kids-act-rules
- https://www.lw.com/en/insights/ftc-publishes-updates-to-coppa-rule
- https://www.womblebonddickinson.com/us/insights/alerts/overview-ftcs-2026-childrens-privacy-focus-expect-ongoing-if-not-more-attention
- https://www.cnn.com/2026/08/26/tech/meta-states-settle-trial-children
- https://www.hunton.com/privacy-and-cybersecurity-law-blog/court-approves-meta-settlement-with-29-states-over-alleged-harms-to-children-and-teens
- https://www.cnbc.com/2026/08/26/meta-social-media-trial-settlement.html
- https://deadline.com/2025/12/disney-ftc-settlement-1236504226/

**Researcher critiques**
- https://fairplayforkids.org/wp-content/uploads/2025/09/Teen-Accounts-Broken-Promises-How-Instagram-is-failing-to-protect-minors.pdf
- https://time.com/7324544/instagram-teen-accounts-flawed/
- https://www.techpolicy.press/evaluating-instagrams-promises-to-protect-teens/
- https://dataconomy.com/2025/05/16/is-tiktoks-new-meditation-push-a-real-safety-play-or-just-good-pr-optics/
- https://academic.oup.com/idpl/advance-article/doi/10.1093/idpl/ipaf012/8327959
