# The morning digest — getting the two store keys

One-time setup (founder only — these are your store accounts). When the secrets exist,
the 8am digest starts by itself: "☀️ Downloads: 14 App Store (10-04) · 9 Google Play
(10-03) · 37 stamps in 24h". Each store works independently — do Apple first if you
only do one. Written 2026-10-05.

## Apple (App Store Connect) — ~5 minutes

1. appstoreconnect.apple.com → **Users and Access** → **Integrations** tab →
   **App Store Connect API** → Team Keys → **(+) Generate API Key**.
   Name: `GlobeSkimmers digest` · Access: **Sales and Reports**.
2. Copy the **Issuer ID** (shown above the key list) and the new key's **Key ID**.
   Click **Download API Key** — the `.p8` file downloads ONCE; keep it.
3. Your **Vendor Number**: App Store Connect → **Payments and Financial Reports** —
   the 8-digit number by your legal name.
4. In Terminal, in the globeskimmers folder:
   ```
   npx wrangler secret put ASC_ISSUER_ID        # paste the Issuer ID
   npx wrangler secret put ASC_KEY_ID           # paste the Key ID
   npx wrangler secret put ASC_VENDOR_NUMBER    # paste the vendor number
   npx wrangler secret put ASC_PRIVATE_KEY < ~/Downloads/AuthKey_XXXXXXXXXX.p8
   ```
   (Use the real file name of the .p8 you downloaded.)

## Google Play — ~15 minutes (fiddlier)

1. **Play Console** → (left menu) **Download reports → Statistics** → click
   **Copy Cloud Storage URI**. It looks like `gs://pubsite_prod_XXXXXXXX`.
   The part after `gs://` is your bucket id.
2. **console.cloud.google.com** → create a project (any name) → **IAM & Admin →
   Service Accounts → Create service account**. Name: `gs-digest`. No roles needed
   on the project. After it's created: **Keys → Add key → Create new key → JSON** —
   a .json file downloads.
3. Back in **Play Console** → **Users and permissions → Invite new users** → paste the
   service account's email (ends in `.iam.gserviceaccount.com`) → under Account
   permissions tick **View app information and download bulk reports** → Invite.
4. In Terminal (replace the path with your downloaded .json):
   ```
   npx wrangler secret put GPLAY_BUCKET         # paste: pubsite_prod_XXXXXXXX
   python3 -c "import json;print(json.load(open('/Users/lobster/Downloads/YOURKEY.json'))['client_email'])" | npx wrangler secret put GPLAY_SA_EMAIL
   python3 -c "import json;print(json.load(open('/Users/lobster/Downloads/YOURKEY.json'))['private_key'])" | npx wrangler secret put GPLAY_SA_KEY
   ```

## Notes

- Apple's daily report appears ~5–8am PT for yesterday; Play's runs a day or two
  behind — the digest labels each number with its date, and skips a store whose
  report isn't ready (it tries again next morning).
- The keys can only READ sales/stats reports — they can't touch the app, pricing
  or releases. Delete them anytime in the same screens.
