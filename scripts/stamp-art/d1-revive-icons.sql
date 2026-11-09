-- Revive the world icons the dedup silenced (audit 2026-11-08). The 2026-10-10 dedup pass marked EVERY row
-- of these places class_ban = 'duplicate' (the curated row and its wikidata twin), so no row survived, the
-- app found no official stamp for them, and the miss was cached for 30 days. One row per place comes back:
-- the founder's curated row (world scope), or the only national/regional row where no curated one exists.
-- Places that already have another stampable row nearby (Louvre, Dolmabahçe, Windsor, St. Stephen's, Hong Kong
-- Disneyland, Joker Stairs, Magellan's Cross) are left alone so no place gets two stamps. Safe to re-run.
-- Run once (the founder):
--   npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-art/d1-revive-icons.sql
UPDATE attractions SET class_ban = NULL, updated_at = datetime('now')
WHERE class_ban = 'duplicate' AND id IN (
  'curated:italy-rome-colosseum', -- Colosseum, Rome, Italy
  'wikidata:Q1156726', -- Rodeo Drive, Beverly Hills, US
  'wikidata:Q1236511', -- Corfe Castle, Nr Wareham, GB
  'curated:united-states-new-york-brooklyn-bridge', -- Brooklyn Bridge, New York, United States
  'curated:spain-barcelona-camp-nou', -- Camp Nou, Barcelona, Spain
  'curated:turkey-istanbul-basilica-cistern', -- Basilica Cistern, Istanbul, Turkey
  'curated:united-states-new-york-american-museum-of-natural-history', -- American Museum of Natural History, New York, United States
  'curated:france-paris-eiffel-tower', -- Eiffel Tower, Paris, France
  'curated:france-paris-palace-of-versailles', -- Palace of Versailles, Paris, France
  'curated:france-paris-notre-dame-cathedral', -- Notre-Dame Cathedral, Paris, France
  'curated:japan-osaka-osaka-castle', -- Osaka Castle, Osaka, Japan
  'curated:united-kingdom-london-buckingham-palace', -- Buckingham Palace, London, United Kingdom
  'curated:australia-sydney-sydney-opera-house', -- Sydney Opera House, Sydney, Australia
  'curated:china-terracotta-army', -- Terracotta Army, China
  'curated:taiwan-taipei-national-palace-museum', -- National Palace Museum, Taipei, Taiwan
  'curated:japan-tokyo-tokyo-skytree', -- Tokyo Skytree, Tokyo, Japan
  'curated:united-kingdom-london-westminster-abbey', -- Westminster Abbey, London, United Kingdom
  'curated:france-paris-arc-de-triomphe', -- Arc de Triomphe, Paris, France
  'curated:turkey-istanbul-blue-mosque', -- Blue Mosque, Istanbul, Turkey
  'curated:croatia-krka-national-park', -- Krka National Park, Croatia
  'curated:united-kingdom-london-tower-bridge', -- Tower Bridge, London, United Kingdom
  'icon:Q843997', -- Tokyo Disneyland, Tokyo, Japan
  'curated:china-shanghai-shanghai-disneyland', -- Shanghai Disneyland, Shanghai, China
  'curated:turkey-istanbul-galata-tower', -- Galata Tower, Istanbul, Turkey
  'curated:india-taj-mahal', -- Taj Mahal, India
  '__end__'
);
