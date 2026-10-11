# GlobeSkimmers — scope for a one-time privacy counsel consult

Prepared October 11, 2026 · Contact: Maiza Simeon, founder (sole operator)

## Who we are

GlobeSkimmers is a free iOS/Android travel app operated by a solo founder from
Arcadia, California (California business). Live on the Apple App Store since
July 2026; Android in closed testing. Pre-revenue; **no advertising** (the ads
SDK was removed October 2026) and no sale of personal data. Users worldwide.

The product is a "virtual passport": users collect stamps at famous places
(GPS-checked in the foreground, with consent, never background tracking), add
their own photos, and share with friends (follows, postcards). Minimum age 13
(16 in Australia); 13–17 accounts get restricted "teen" treatment (never
public, mutual-friends-only contact). Privacy policy:
https://globeskimmers.io/legal/privacy

**Planned next (what this consult de-risks):** a birthday required of every
account at sign-up (presented as an age check); automatic freeze-and-delete of
under-13 accounts; public place photo galleries that minors may contribute to
anonymously; later, aggregate attendance reports for event organizers (totals
and age bands only, groups under 20 suppressed, minors excluded).

## What we are asking you to do

Answer the numbered questions below **in writing**, briefly, and flag anything
in "Planned next" that must change before shipping. We are **not** asking for
a general compliance audit, contract drafting, or review of anything beyond
these questions and the attached documents.

## The questions

**1. Texas SB 2420 and the app-store age frameworks.**
Apple requires its Declared Age Range / significant-change / consent-revocation
APIs for new Texas accounts since June 4, 2026; we are building them now.
(a) May we store only the *derived* age tier and the method of verification,
discarding the raw signal? (b) What are our duties when a parent revokes
consent for a "significant change"? (c) Same questions for Google's Play age
signals, and the developer-side timeline for Utah (May 6, 2027), Louisiana
HB 570 (confirm the amended effective date — we believe July 1, 2027) and
Alabama HB 161 (January 1, 2027).

**2. COPPA — the under-13 freeze.**
When a birthday shows under 13 we freeze the account at once and delete its
content promptly; an appeal can restore access but never deleted content.
(a) How quickly must deletion follow? (b) May any data be held while an appeal
is pending, and how long may the appeal window be? (c) May we keep a minimal
"under minimum age" marker (e.g., a hashed email) to slow re-sign-up?

**3. Keeping every user's full date of birth.**
The founder has decided to keep the full birthdate for adults too (age
assurance plus aggregate demographics). Under CCPA/CPRA and the state minors'
laws: any retention or disclosure problem, and what must the privacy policy
say about purpose and retention?

**4. Aggregate age-band reports (investors now; event organizers later).**
Totals and age bands only; any group under 20 suppressed; minors excluded
entirely; organizers would sign a no-re-identification clause. (a) Does
excluding minors keep us inside New York's Child Data Protection Act
"strictly necessary" rule — and are we within its scope at all? (b) Any other
state limits on this? (c) Must the privacy policy name organizer reports
before the feature ships?

**5. The newer state minors' laws, quickly.**
For an app our size: Connecticut's minors amendments (July 1, 2026 — we have
no targeted ads; foreground precise location is core to stamping), Vermont's
AADC (January 1, 2027 — who it covers; minors already get no streaks or
popularity counts), Mississippi HB 1126 and the FL/GA/TN/VA social-media
laws — do any of their definitions reach a travel-passport app with a social
layer, and is anything required of us *now*?

**6. United Kingdom.**
User-to-user features (guestbooks, dish posts, postcards) likely make us a
"user-to-user service" under the Online Safety Act, and we have not yet done
the dated illegal-content / children's-access / children's-risk assessments.
What is the minimal compliant path for a solo US developer with a small UK
user base, and is an ICO Children's Code DPIA required of us?

**7. European Union.**
We believe DSA Article 28 duties are tempered by the micro-enterprise
exemption (Art. 19) at our size — please confirm. For GDPR Article 8: we do
NOT want to rely on consent as the legal basis for teen processing — is
legitimate interest sound for our teen feature set?

**8. Asia-Pacific and Latin America age rules.**
(a) Australia's under-16 social-media minimum age: the Rules exclude some
service types — does a travel-information app with a social layer fit an
exclusion, or do we keep our under-16 block? (b) Brazil's Digital ECA: is
self-declared age plus the phone's age signal enough, with social off under
16? (c) France's under-15 law: does it cover a US app with no French
establishment? (d) India's DPDP (child = under 18): social off for Indian
minors versus verifiable parental consent — what does the phased timeline
require and when? (e) Philippines DPA: age is sensitive personal information —
is a consent line at collection sufficient (a referral to PH counsel is fine)?

**9. CSAM reporting and the TAKE IT DOWN Act.**
All user photos pass automated review before display. (a) Are we required to
register with NCMEC's CyberTipline at our size, and what does the 1-year
preservation duty require operationally? (b) Does a 48-hour intimate-image
removal form satisfy the TAKE IT DOWN Act for a service like ours?

## What we will send with this brief

1. This document.
2. The live privacy policy (link above).
3. Our internal "Teens & Minors Plan" (age-band table per feature, build
   phases) — the source of these questions.
4. Screenshots of our current Apple "App Privacy" answers and Google Play
   "Data safety" answers.

## Out of scope (so the quote stays small)

General terms-of-service review, trademark questions, contracts other than
the organizer no-re-identification clause concept, and anything not listed
above.
