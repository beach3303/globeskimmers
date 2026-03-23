/**
 * ============================================================================
 * GLOBESKIMMERS — getShoppingPlaces v3.0
 * ============================================================================
 * Changes in v3.0:
 * - FULL ARCHITECTURE OVERHAUL: Food Shopping vs General Shopping split
 * - Food Shopping (priority): supermarkets, warehouse clubs, farmers markets,
 *   wet markets, bodegas, butcher shops, fish markets, bakeries
 * - General Shopping: malls, outlets, souks, bazaars, night markets, luxury,
 *   souvenir, crafts, duty-free (rank lower than food)
 * - FIX: safeLower() prevents crash when r.text is object not string
 * - FIX: CATEGORY_QUERIES map replaces broken flat .includes() matching
 * - NEW: detectShoppingKind() classifies each result as food vs general
 * - NEW: traveler-smart ranking (category match + openNow + rating + distance)
 * - Cloudflare KV caching preserved (12hr TTL)
 * ============================================================================
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";
const TTL    = 60 * 60 * 12; // 12 hours

// ─── SAFE TEXT HELPER (prevents crash when r.text is an object) ──────────────
function safeLower(v: any): string {
  if (typeof v === 'string') return v.toLowerCase();
  if (v == null) return '';
  if (typeof v === 'object') return (v.text || '').toLowerCase();
  return String(v).toLowerCase();
}

// ─── CATEGORY QUERIES MAP ────────────────────────────────────────────────────
const CATEGORY_QUERIES: Record<string, string[]> = {
  all: [
    'shopping mall', 'supermarket', 'grocery store', 'farmers market',
    'night market', 'souvenir market', 'outlet mall', 'bazaar', 'souk',
    'warehouse club', 'bodega', 'wet market', 'craft market', 'department store',
    'luxury shopping', 'duty free shop', 'local market', 'butcher shop',
  ],

  // ── FOOD SHOPPING FAMILY ──────────────────────────────────────────────────
  food_shopping: [
    'supermarket', 'grocery store', 'hypermarket', 'food market',
    'farmers market', 'wet market', 'produce market', 'bodega',
    'warehouse club', 'wholesale club', 'neighborhood market',
    'butcher shop', 'fish market', 'bakery specialty', 'natural foods store',
  ],
  supermarkets: [
    'supermarket', 'grocery store', 'hypermarket', 'supercenter',
    'Whole Foods', 'Trader Joes', 'Ralphs', 'Vons', 'Albertsons',
    'Kroger', 'Safeway', 'Publix', 'HEB', 'Aldi', 'Lidl',
    'Food 4 Less', 'Sprouts', 'Wegmans', 'WinCo', 'Meijer',
    'Harris Teeter', 'Giant', 'natural foods grocery', 'organic grocery',
  ],
  warehouse_clubs: [
    'warehouse club', 'wholesale club', 'membership warehouse',
    'Costco', 'Sams Club', 'BJs Wholesale', 'Makro', 'Metro Cash and Carry',
  ],
  farmers_markets: [
    'farmers market', "farmer's market", 'open air produce market',
    'weekend food market', 'fresh produce market', 'community market food',
  ],
  wet_markets: [
    'wet market', 'public market', 'fish market', 'meat market',
    'produce market', 'fresh market', 'municipal market', 'morning market food',
  ],
  bodegas_corner_stores: [
    'bodega', 'corner store', 'mini market', 'neighborhood grocer',
    'convenience food store', 'local food shop', 'alimentari',
    'sari-sari store', 'warung', 'minimarket food',
  ],
  butcher_shops: [
    'butcher shop', 'butcher', 'meat market', 'fish market',
    'fishmonger', 'fish shop', 'bakery specialty food',
  ],

  // ── GENERAL SHOPPING FAMILY (lower priority) ──────────────────────────────
  general_shopping: [
    'shopping mall', 'outlet mall', 'department store', 'souvenir market',
    'boutique district', 'luxury shopping', 'craft market',
    'night market', 'bazaar', 'souk', 'duty free shop',
  ],
  malls: [
    'shopping mall', 'shopping center', 'shopping centre',
    'department store', 'retail mall',
  ],
  outlets: [
    'outlet mall', 'premium outlet', 'factory outlet', 'discount outlet center',
  ],
  souvenir_shopping: [
    'souvenir market', 'souvenir shop', 'gift shop', 'local souvenir shopping',
    'tourist souvenirs', 'handicraft shop',
  ],
  night_markets: [
    'night market', 'pasar malam', 'evening market', 'night bazaar',
  ],
  luxury_shopping: [
    'luxury shopping', 'designer boutique', 'high end shopping',
    'luxury brands', 'designer brands district',
  ],
  local_crafts: [
    'craft market', 'artisan market', 'handmade market',
    'local crafts', 'artisan goods',
  ],
  markets_bazaars: [
    'bazaar', 'souk', 'mercado', 'marché', 'mercato', 'pasar',
    'talaat', 'flea market', 'street market', 'local market',
    'antique market', 'vintage market',
  ],
  duty_free: [
    'duty free shop', 'tax free shopping', 'airport duty free',
  ],
};

// ─── DETECT SHOPPING KIND (food vs general) ──────────────────────────────────
function detectShoppingKind(name: string, types: string[] = [], rev = '') {
  const x = `${name} ${types.join(' ')} ${rev}`.toLowerCase();

  if (/supermarket|grocery|hypermarket|whole foods|trader joe|ralphs|vons|kroger|albertsons|aldi|lidl|publix|safeway|winco|wegmans|sprouts|heb|meijer|food 4 less|natural food/.test(x))
    return { shoppingFamily: 'food_shopping', shoppingSubtype: 'supermarket',     venueIcon: '🛒', venueLabel: 'Supermarket',         venueColor: '#2E7D32' };
  if (/costco|sam'?s club|bj'?s|warehouse club|wholesale club|makro|metro cash/.test(x))
    return { shoppingFamily: 'food_shopping', shoppingSubtype: 'warehouse_club',  venueIcon: '📦', venueLabel: 'Warehouse Club',       venueColor: '#1565C0' };
  if (/farmer'?s? market|open air produce|weekend food market/.test(x))
    return { shoppingFamily: 'food_shopping', shoppingSubtype: 'farmers_market',  venueIcon: '🥕', venueLabel: 'Farmers Market',       venueColor: '#689F38' };
  if (/wet market|fish market|meat market|produce market|public market|municipal market|fishmonger/.test(x))
    return { shoppingFamily: 'food_shopping', shoppingSubtype: 'fresh_market',    venueIcon: '🍎', venueLabel: 'Fresh Food Market',    venueColor: '#D97706' };
  if (/bodega|corner store|mini market|sari.sari|warung|neighbourhood food|neighborhood food|alimentari/.test(x))
    return { shoppingFamily: 'food_shopping', shoppingSubtype: 'bodega',          venueIcon: '🏪', venueLabel: 'Neighborhood Food Shop', venueColor: '#059669' };
  if (/butcher|butcher shop|fishmonger|fish shop/.test(x))
    return { shoppingFamily: 'food_shopping', shoppingSubtype: 'butcher_shop',    venueIcon: '🥩', venueLabel: 'Butcher / Fish Shop',  venueColor: '#B45309' };
  if (/outlet|factory outlet|premium outlet/.test(x))
    return { shoppingFamily: 'general_shopping', shoppingSubtype: 'outlet',       venueIcon: '🏷️', venueLabel: 'Outlet',              venueColor: '#DC2626' };
  if (/night market|pasar malam|night bazaar/.test(x))
    return { shoppingFamily: 'general_shopping', shoppingSubtype: 'night_market', venueIcon: '🌙', venueLabel: 'Night Market',        venueColor: '#1565C0' };
  if (/souk|bazaar|bazar/.test(x))
    return { shoppingFamily: 'general_shopping', shoppingSubtype: 'bazaar',       venueIcon: '🏺', venueLabel: 'Souk / Bazaar',       venueColor: '#B45309' };
  if (/souvenir|handicraft|gift shop|tourist shop/.test(x))
    return { shoppingFamily: 'general_shopping', shoppingSubtype: 'souvenir',     venueIcon: '🎁', venueLabel: 'Souvenir Market',     venueColor: '#7C3AED' };
  if (/craft|artisan|handmade/.test(x))
    return { shoppingFamily: 'general_shopping', shoppingSubtype: 'crafts',       venueIcon: '🧶', venueLabel: 'Craft Market',        venueColor: '#D97706' };
  if (/luxury|designer boutique|high.end shopping/.test(x))
    return { shoppingFamily: 'general_shopping', shoppingSubtype: 'luxury',       venueIcon: '💎', venueLabel: 'Luxury Shopping',     venueColor: '#BE185D' };
  if (/duty.free|tax.free/.test(x))
    return { shoppingFamily: 'general_shopping', shoppingSubtype: 'duty_free',    venueIcon: '✈️', venueLabel: 'Duty Free',           venueColor: '#0891B2' };
  if (/mall|shopping center|shopping centre|department store|nordstrom|macy|saks|selfridge|harrods|galeries/.test(x))
    return { shoppingFamily: 'general_shopping', shoppingSubtype: 'mall',         venueIcon: '🏬', venueLabel: 'Shopping Mall',       venueColor: '#7C3AED' };
  return   { shoppingFamily: 'general_shopping', shoppingSubtype: 'shopping',     venueIcon: '🛍️', venueLabel: 'Shopping',           venueColor: '#7C3AED' };
}

// ─── TRAVELER-SMART SCORE ────────────────────────────────────────────────────
function travelerScore(p: any, category: string): number {
  const kind = p.shoppingKind || {};
  const familyMatch =
    (category === 'food_shopping' || ['supermarkets','warehouse_clubs','farmers_markets','wet_markets','bodegas_corner_stores','butcher_shops'].includes(category))
      ? (kind.shoppingFamily === 'food_shopping' ? 40 : 0)
      : (kind.shoppingFamily === 'general_shopping' ? 30 : 0);
  const openNow     = p.isOpen === true ? 15 : 0;
  const ratingScore = ((p.rating || 0) / 5) * 15;
  const distanceScore = Math.max(0, 12 - (p.distanceMiles || 0) * 2);
  const photoScore  = Math.min((p.photos?.length || 0), 5);
  return familyMatch + openNow + ratingScore + distanceScore + photoScore;
}

// ─── DISTANCE ────────────────────────────────────────────────────────────────
function km(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371, dL = (la2-la1)*Math.PI/180, dN = (lo2-lo1)*Math.PI/180;
  const a = Math.sin(dL/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const SIG = {
  luxury:    ['luxury','designer','gucci','louis vuitton','chanel','prada','hermes','burberry','premium','high-end','upscale'],
  budget:    ['budget','affordable','cheap','bargain','discount','value','sale','clearance','outlet','wholesale'],
  foodCourt: ['food court','dining','restaurants','food hall','hawker','food stalls'],
  parking:   ['free parking','parking available','ample parking','underground parking','valet'],
  outdoor:   ['outdoor','open air','alfresco','street','open-air'],
  indoor:    ['indoor','air conditioned','air-con','covered','climate'],
  local:     ['local','artisan','handmade','craft','traditional','authentic','souvenirs','handicraft'],
  dutyFree:  ['duty free','tax free','duty-free','tax-free'],
  bargain:   ['bargain','haggle','negotiate','wholesale','discount market'],
  tourist:   ['tourist','traveler','popular','iconic','must visit','famous'],
  fresh:     ['fresh produce','fresh food','organic','farm fresh','seasonal'],
};
function sc(t: string, k: string[]): number { return k.filter(w => t.includes(w)).length; }

// ─── MAIN ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!await base44.auth.me()) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { latitude, longitude, radius = 16093, maxResults = 30, category = 'all' } = await req.json();
    if (!latitude || !longitude) return Response.json({ error: 'Location required' }, { status: 400 });

    // ── Select queries from map (not broken .includes() match) ───────────────
    const queries = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.all;
    const seen = new Set<string>();
    const places: any[] = [];

    // ── Fetch in parallel batches of 3 ───────────────────────────────────────
    for (let i = 0; i < queries.length; i += 3) {
      await Promise.all(queries.slice(i, i+3).map(async q => {
        try {
          const p = new URLSearchParams({
            query: q,
            latitude: String(latitude),
            longitude: String(longitude),
            radius: String(radius),
            maxResults: '10',
            cacheTtl: String(TTL),
          });
          const r = await fetch(`${WORKER}/places/text-search?${p}`);
          if (!r.ok) return;
          for (const pl of (await r.json()).places || []) {
            const id = pl.id;
            if (id && !seen.has(id)) { seen.add(id); places.push(pl); }
          }
        } catch { /* swallow per-query errors */ }
      }));
    }

    if (!places.length) return Response.json({ places: [], count: 0, error: 'No shopping found nearby.' });

    const out = places.slice(0, maxResults * 2).map(p => {
      const lat  = p.location?.latitude || 0;
      const lng  = p.location?.longitude || 0;
      const d    = km(latitude, longitude, lat, lng);
      const name = p.displayName?.text || p.name || '';

      // ✅ FIX: safeLower prevents crash when r.text is object
      const rev = (p.reviews || [])
        .map((r: any) => safeLower(r?.text?.text ?? r?.text ?? r?.originalText?.text ?? ''))
        .join(' ');
      const txt = `${name.toLowerCase()} ${(p.types||[]).join(' ')} ${rev}`;

      const photos = (p.photos || []).map((ph: any) => ph.url || ph).filter(Boolean).slice(0, 5);
      const hours  = p.currentOpeningHours?.weekdayDescriptions || p.regularOpeningHours?.weekdayDescriptions || p.hours || [];

      const shoppingKind = detectShoppingKind(name, p.types || [], rev);

      const highlights: string[] = [];
      if (shoppingKind.shoppingFamily === 'food_shopping') {
        if (sc(txt, SIG.fresh) > 0)     highlights.push('Fresh Produce');
        if (/organic/.test(txt))         highlights.push('Organic Options');
        if (/international/.test(txt))   highlights.push('International Foods');
        if (/prepared food/.test(txt))   highlights.push('Prepared Foods');
        if (sc(txt, SIG.budget) > 0)    highlights.push('Budget Friendly');
        if (sc(txt, SIG.tourist) > 0)   highlights.push('Tourist Friendly');
        if (/24 hour|open late/.test(txt)) highlights.push('Open Late');
      } else {
        if (sc(txt, SIG.luxury) > 1)    highlights.push('Luxury Brands');
        if (sc(txt, SIG.dutyFree) > 0)  highlights.push('Duty Free');
        if (sc(txt, SIG.local) > 1)     highlights.push('Local Crafts');
        if (sc(txt, SIG.foodCourt) > 0) highlights.push('Food & Dining');
        if (sc(txt, SIG.bargain) > 0)   highlights.push('Bargain Hunting');
        if (sc(txt, SIG.tourist) > 1)   highlights.push('Tourist Favorite');
        if (sc(txt, SIG.outdoor) > 0)   highlights.push('Open Air');
      }

      const result = {
        id: p.id, placeId: p.id,
        displayName: p.displayName || { text: name },
        name, location: { latitude: lat, longitude: lng }, lat, lng,
        formattedAddress: p.formattedAddress || '',
        shortFormattedAddress: p.shortFormattedAddress || '',
        distanceKm: d, distanceMiles: d * 0.621371,
        distance: `${(d * 0.621371).toFixed(1)} mi`,
        rating: p.rating || null,
        userRatingCount: p.userRatingCount || 0,
        isOpen: p.isOpen ?? null,
        hours,
        currentOpeningHours: { openNow: p.isOpen, weekdayDescriptions: hours },
        photos, photoUrl: photos[0] || null,
        nationalPhoneNumber: p.nationalPhoneNumber || '',
        internationalPhoneNumber: p.internationalPhoneNumber || '',
        websiteUri: p.websiteUri || '',
        googleMapsUri: p.googleMapsUri || '',
        types: p.types || [],
        primaryType: p.primaryType || null,
        // Shopping classification
        shoppingFamily: shoppingKind.shoppingFamily,
        shoppingSubtype: shoppingKind.shoppingSubtype,
        venueIcon: shoppingKind.venueIcon,
        venueLabel: shoppingKind.venueLabel,
        venueColor: shoppingKind.venueColor,
        highlights,
        props: {
          isLuxury:      sc(txt, SIG.luxury) > 1,
          isBudget:      sc(txt, SIG.budget) > 0,
          hasFoodCourt:  sc(txt, SIG.foodCourt) > 0,
          hasFreeParking:sc(txt, SIG.parking) > 0,
          isOutdoor:     sc(txt, SIG.outdoor) > 0,
          isIndoor:      sc(txt, SIG.indoor) > 0,
          hasLocalCrafts:sc(txt, SIG.local) > 1,
          isDutyFree:    sc(txt, SIG.dutyFree) > 0,
          isBargain:     sc(txt, SIG.bargain) > 0,
          isTouristFav:  sc(txt, SIG.tourist) > 1,
          isFoodShopping: shoppingKind.shoppingFamily === 'food_shopping',
          hasFreshProduce: sc(txt, SIG.fresh) > 0,
          isOpenLate:    /24 hour|open late|midnight/.test(txt),
          isBudgetFriendly: sc(txt, SIG.budget) > 0,
        },
        shoppingKind, // for travelerScore
      };
      return result;
    });

    // ── Traveler-smart sort ───────────────────────────────────────────────────
    out.sort((a: any, b: any) => travelerScore(b, category) - travelerScore(a, category));

    // Trim to maxResults after sorting
    const final = out.slice(0, maxResults).map(({ shoppingKind: _, ...rest }) => rest);

    return Response.json({ places: final, count: final.length, version: 'v3.0' });

  } catch (e: any) {
    console.error('getShoppingPlaces error:', e.message);
    return Response.json({ error: e.message, places: [] }, { status: 200 });
  }
});
