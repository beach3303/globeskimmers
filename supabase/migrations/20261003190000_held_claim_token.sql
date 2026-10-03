-- Personal claim links for held usernames (2026-10-03). Matching by email
-- fails when a relative signs in with Apple's Hide My Email (a random
-- privaterelay address), so each invitation carries an unguessable one-time
-- token: whoever opens it, signed in on any account, can claim that name.
alter table api.held_handles add column if not exists claim_token text;
create unique index if not exists held_handles_claim_token_idx on api.held_handles (claim_token) where claim_token is not null;
notify pgrst, 'reload schema';
