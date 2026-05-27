/**
 * DishSearchGallery — Phase 4 scaffold (P5)
 *
 * Goal: surface a grid of dish photos across many places near the user,
 * answering "show me <dish> everywhere within X mi". Tapping a photo
 * jumps to the place detail card. Different from PlacesToEat's "places
 * that serve this dish" listing because this view is DISH-FIRST (rows
 * of photos, places are secondary), versus PLACE-FIRST (rows of place
 * cards, photos are decoration).
 *
 * This file is a SCAFFOLD — not a complete implementation. It includes:
 *   - the route entry (auto-registered via pages.config because the file
 *     exists in src/pages/)
 *   - the basic UI skeleton (search box, dish suggestions, photo grid
 *     placeholder)
 *   - state for the search query + results
 *   - the call signature for a future backend `getDishGallery` function
 *     (not yet built; backend integration is the next increment)
 *
 * Next work to ship this feature:
 *   1. Backend: new Deno function `base44/functions/getDishGallery/entry.ts`
 *      that calls Worker `/places/text-search` for the dish + location,
 *      collects all photos[] across results, returns a flat array sorted
 *      by place rating × photo position.
 *   2. Frontend: wire `base44.functions.invoke('getDishGallery', {...})`
 *      to populate the gallery state. Hook up dish suggestion chips
 *      from a curated list (pancakes, sushi, ramen, pho, tacos, pizza,
 *      etc.) so the user has 1-tap entry points.
 *   3. Photo tap → open expanded place modal (reuse PlacesToEat's
 *      RestaurantCard component).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '@/components/location/LocationContext';
import { getLocationLabel } from '@/components/location/locationLabel';
import { ArrowLeft } from 'lucide-react';

const SUGGESTED_DISHES = [
  { emoji: '🥞', label: 'Pancakes' },
  { emoji: '🍣', label: 'Sushi' },
  { emoji: '🍜', label: 'Ramen' },
  { emoji: '🍕', label: 'Pizza' },
  { emoji: '🌮', label: 'Tacos' },
  { emoji: '🍔', label: 'Burgers' },
  { emoji: '🍦', label: 'Ice cream' },
  { emoji: '☕', label: 'Coffee' },
];

export default function DishSearchGallery() {
  const navigate = useNavigate();
  const { activeLocation } = useLocation();
  const locationLabel = getLocationLabel(activeLocation);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (dishQuery) => {
    if (!dishQuery?.trim()) return;
    setQuery(dishQuery);
    setLoading(true);
    setResults([]);
    // TODO: when getDishGallery backend is live:
    //   const { data } = await base44.functions.invoke('getDishGallery', {
    //     query: dishQuery,
    //     latitude: activeLocation?.coordinates?.latitude,
    //     longitude: activeLocation?.coordinates?.longitude,
    //     radius: 10,
    //   });
    //   setResults(data?.photos || []);
    // For now, surface a placeholder so the UI is testable.
    setTimeout(() => {
      setResults([]); // backend not wired yet
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{ fontFamily: "'DM Sans',-apple-system,sans-serif", background: '#F0F4F8', minHeight: '100vh' }}>
      <div style={{ background: 'linear-gradient(160deg,#0F172A 0%,#1E293B 40%,#D97706 100%)', padding: '16px 16px 24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.9)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '12px', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600 }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>📸 Dish Gallery</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>{locationLabel || 'Browse dishes near you'}</div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search a dish (pancakes, sushi, ramen…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', border: 'none', fontSize: '14px', fontFamily: 'inherit' }}
          />
          <button
            onClick={() => handleSearch(query)}
            style={{ padding: '12px 18px', borderRadius: '10px', border: 'none', background: '#fff', color: '#D97706', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}
          >
            Search
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          Suggested
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
          {SUGGESTED_DISHES.map((dish) => (
            <button
              key={dish.label}
              onClick={() => handleSearch(dish.label.toLowerCase())}
              style={{ flexShrink: 0, padding: '10px 14px', borderRadius: '20px', background: '#fff', border: '1px solid #E2E8F0', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#1A2332' }}
            >
              <span style={{ fontSize: '15px' }}>{dish.emoji}</span> {dish.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>📸</div>
            <div>Loading dishes…</div>
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B', background: '#fff', borderRadius: '14px', marginTop: '16px' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🍽️</div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1A2332', marginBottom: '6px' }}>Dish Gallery is in development</div>
            <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
              The backend that aggregates photos for "{query}" across nearby
              places isn't live yet. The frontend and routing are ready —
              wire <code>getDishGallery</code> in the next session to populate
              this view.
            </div>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
            {results.map((photo, i) => (
              <div key={i} style={{ aspectRatio: '1', background: '#E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                {/* TODO: render photo + place attribution */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
