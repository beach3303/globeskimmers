-- Stamp merge — every D1-style place id held in stamps, tags, guestbooks and owner notes. READ-ONLY.
-- Use: compare this list with D1 to find stored ids that no longer exist there (more "ghosts").
--   npx supabase db query --linked -f scripts/stamp-merge/preflight-supabase-held-ids.sql
SELECT src, entity_id, count(*) AS n FROM (
  SELECT 'stamp' AS src, entity_id FROM api.passport_stamps WHERE entity_id ~ '^(icon|curated|wikidata|wv|auto|secret):'
  UNION ALL SELECT 'tag', entity_id FROM api.passport_tags WHERE entity_id ~ '^(icon|curated|wikidata|wv|auto|secret):'
  UNION ALL SELECT 'guestbook', entity_id FROM api.guestbook_entries WHERE entity_id ~ '^(icon|curated|wikidata|wv|auto|secret):'
  UNION ALL SELECT 'owner_note', entity_id FROM api.owner_notes WHERE entity_id ~ '^(icon|curated|wikidata|wv|auto|secret):'
) x GROUP BY src, entity_id ORDER BY n DESC, entity_id;
