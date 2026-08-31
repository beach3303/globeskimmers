-- ─────────────────────────────────────────────────────────────────────
-- Secret coordinates: replace desk-derived guesses with looked-up fixes.
-- (Founder can't get on-site soon; these sources are good to ~door level.)
--
--   Anaheim Club 33      Wikidata Q258517 (the club's own entity)
--   Blue Bayou           owned Overture row "Blue Bayou" (three variants agree ±25m)
--   Tom Sawyer Island    owned Overture row "Pirate's Lair on Tom Sawyer Island"
--   Shanghai Club 33     owned Overture row "Club 33" (private_association), exact
--   Tokyo Club 33        owned Overture row "ワールドバザール" — the club sits above
--                        World Bazaar; footprint widened to 80m for the proxy
--
-- On-site verification remains worthwhile but is no longer a blocker.
-- ─────────────────────────────────────────────────────────────────────

UPDATE attractions SET lat=33.811122, lng=-117.920993, source_id='wikidata:Q258517'
 WHERE id='secret:disneyland-club-33-door';

UPDATE attractions SET lat=33.811235, lng=-117.920959, source_id='overture:blue-bayou'
 WHERE id='secret:disneyland-blue-bayou';

UPDATE attractions SET lat=33.812147, lng=-117.921165, source_id='overture:pirates-lair'
 WHERE id='secret:disneyland-tom-sawyer-island';

UPDATE attractions SET lat=31.143751, lng=121.656944, source_id='overture:club-33-shanghai'
 WHERE id='secret:shanghai-disneyland-club-33-door';

UPDATE attractions SET lat=35.634363, lng=139.879494, footprint_radius_m=80,
  source_id='overture:world-bazaar-proxy'
 WHERE id='secret:tokyo-disneyland-club-33-door';
