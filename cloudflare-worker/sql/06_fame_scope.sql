-- Fame scope — the stamp-worthiness bar (founder philosophy, 2026-09-01):
-- a place earns a stamp by clearing an ABSOLUTE fame bar, never by being the
-- best of a boring bunch. Calibrated against 58 founder-labeled places
-- (binary stamp/no-stamp: 58/58; zero locals clear the bar) + 2 adversarial
-- attack passes (class bans; QID-keyed signals).
--
--   scope: computed by scripts/attractions-seed/score-fame.mjs
--     'world' | 'national' | 'regional'  → stamp-worthy
--     'local'                            → browse only, NEVER a stamp
--     NULL                               → unscored (auto-seeded rows land here;
--                                          excluded from stamps until scored)
--   founder_scope: manual override lane — ALWAYS wins over scope.
--   class_ban: 'banned:<root-qid>' (airport/road/prison/HQ/hospital/military/
--     power-station — never stampable) or 'review:<root-qid>' (cemetery,
--     university, neighborhood — local until the founder promotes).
--   qid / sitelinks: the measured identity + signal, kept for re-scoring.
--
--   npx wrangler d1 execute globeskimmers-attractions --file=cloudflare-worker/sql/06_fame_scope.sql --remote
ALTER TABLE attractions ADD COLUMN scope TEXT;
ALTER TABLE attractions ADD COLUMN founder_scope TEXT;
ALTER TABLE attractions ADD COLUMN class_ban TEXT;
ALTER TABLE attractions ADD COLUMN qid TEXT;
ALTER TABLE attractions ADD COLUMN sitelinks INTEGER;
CREATE INDEX IF NOT EXISTS attractions_scope_idx ON attractions(scope);
