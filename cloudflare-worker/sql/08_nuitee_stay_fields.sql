-- 08_nuitee_stay_fields.sql — real stay dates on the booking row, so My Trips
-- sorts by check-in without regexing "<hotel> · <checkin> → <checkout>" back out
-- of product_name (Wave 3 address/date plumbing).
-- Run once against the EVENTS database (globeskimmers-events, binding `DB`):
--   npx wrangler d1 execute globeskimmers-events --file=cloudflare-worker/sql/08_nuitee_stay_fields.sql --remote
-- "duplicate column name" on re-run = already applied.

-- Written by nuiteeRecordBooking for NEW bookings only (with a pre-migration
-- try/catch fallback in the worker, so deploy order never breaks a booking).
-- Legacy rows keep NULL — the app falls back to its product_name parse.
-- ISO 'YYYY-MM-DD' strings, straight from the prebook-confirmed session.
ALTER TABLE affiliate_clicks ADD COLUMN checkin  TEXT;
ALTER TABLE affiliate_clicks ADD COLUMN checkout TEXT;
