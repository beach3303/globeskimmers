-- Parks pass 2 (2026-09-30): umbrellas demote BY NAME whatever their row id;
-- rides inside park fences stop competing with the parks; one spelling twin.
UPDATE attractions SET founder_scope='local', updated_at=datetime('now')
 WHERE name IN ('Walt Disney World','Universal Orlando','Disneyland Paris','Disneyland Resort',
                'Universal Studios Florida & Islands of Adventure','Tokyo Disney Resort')
   AND id NOT LIKE 'icon:%';
UPDATE attractions SET founder_scope='local', updated_at=datetime('now') WHERE name='The World of Coca-Cola' AND id NOT LIKE 'icon:%';
-- Anything non-icon sitting INSIDE a park's fence is a ride, not a destination.
UPDATE attractions SET founder_scope='local', updated_at=datetime('now') WHERE id NOT LIKE 'icon:%' AND coalesce(founder_scope,scope) IN ('regional','national','world') AND abs(lat-28.4177)<0.011 AND abs(lng+81.5812)<0.012 AND name<>'Magic Kingdom';
UPDATE attractions SET founder_scope='local', updated_at=datetime('now') WHERE id NOT LIKE 'icon:%' AND coalesce(founder_scope,scope) IN ('regional','national','world') AND abs(lat-28.3747)<0.011 AND abs(lng+81.5494)<0.012 AND name<>'EPCOT';
UPDATE attractions SET founder_scope='local', updated_at=datetime('now') WHERE id NOT LIKE 'icon:%' AND coalesce(founder_scope,scope) IN ('regional','national','world') AND abs(lat-28.3575)<0.011 AND abs(lng+81.5600)<0.012 AND name NOT LIKE 'Disney''s Hollywood%';
UPDATE attractions SET founder_scope='local', updated_at=datetime('now') WHERE id NOT LIKE 'icon:%' AND coalesce(founder_scope,scope) IN ('regional','national','world') AND abs(lat-28.3580)<0.011 AND abs(lng+81.5900)<0.012 AND name NOT LIKE 'Disney''s Animal%';
UPDATE attractions SET founder_scope='local', updated_at=datetime('now') WHERE id NOT LIKE 'icon:%' AND coalesce(founder_scope,scope) IN ('regional','national','world') AND abs(lat-28.4720)<0.014 AND abs(lng+81.4710)<0.015 AND name NOT LIKE 'Universal%';
UPDATE attractions SET founder_scope='local', updated_at=datetime('now') WHERE id NOT LIKE 'icon:%' AND coalesce(founder_scope,scope) IN ('regional','national','world') AND abs(lat-33.8090)<0.011 AND abs(lng+117.9190)<0.012 AND name NOT IN ('Disneyland Park','Disney California Adventure');
UPDATE attractions SET founder_scope='local', updated_at=datetime('now') WHERE id NOT LIKE 'icon:%' AND coalesce(founder_scope,scope) IN ('regional','national','world') AND abs(lat-48.8700)<0.011 AND abs(lng-2.7780)<0.017 AND name NOT LIKE '%Disney%Park%';
