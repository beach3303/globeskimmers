// FinderHeader — the shared 3-block finder top (Passport Standard).
//
// Extracts the copy-pasted header row + location card + city disclaimer that
// every finder carries (see Shopping.jsx / PlacesToEat.jsx / CoffeeFinder.jsx),
// pixel-faithful to that pattern, plus the doctrine upgrade: when `count` is
// non-null the CAT pill row gains a right-aligned mono count segment
// ("6 NEAR YOU") so the result count has one consistent home.
//
// The page keeps owning LocationModePicker — this header only calls
// `onChangeLocation` (both from the location card and, when a page routes its
// empty state here too, nothing else). RefreshButton IS rendered here (it is
// part of the extracted row): pass `onRefresh` to get it, omit for the spacer.
//
// Props:
//   catKey           — key into CAT (redesign constants); colors the pill,
//                      "Change" chip and count segment. Unknown keys fall back
//                      to a neutral teal-on-ivory.
//   icon             — lucide icon component for the pill (e.g. ShoppingBag).
//   title            — pill label ("Shopping", "Coffee Finder").
//   count            — number | null. Non-null renders the mono count segment.
//   countNoun        — mono segment noun, rendered uppercase ("near you").
//   onBack           — optional; defaults to window.history.back().
//   onRefresh        — optional; renders RefreshButton when set, else a
//                      40px spacer keeps the pill centered.
//   refreshing       — RefreshButton spinner state.
//   refreshTitle     — accessible label for the refresh button.
//   onChangeLocation — opens the page's LocationModePicker.
//   locationKicker   — mono kicker over the location label; defaults to
//                      "City" / "Location" from isCity (no emoji — doctrine).
//   locationLabel    — the location card's main line (getLocationLabel(...)).
//   isCity           — city-granularity location: shows the CITY_DISCLAIMER
//                      callout and flips the default kicker.
//   cityName         — city name for the disclaimer sentence.
//   children         — rendered below the three blocks, inside the same
//                      column wrap (pages put search / filters here).
import React from 'react';
import { ChevronLeft, MapPin, Lightbulb } from 'lucide-react';
import { CAT, TEAL_DEEP, IVORY_2 } from '@/components/redesign/constants';
import { CITY_DISCLAIMER } from '@/components/location/locationLabel';
import RefreshButton from '@/components/RefreshButton';
import { useIsTablet } from '@/lib/useIsTablet';

const FALLBACK_CAT = { ink: TEAL_DEEP, bg: IVORY_2 };

export default function FinderHeader({
  catKey,
  icon: Icon,
  title,
  count = null,
  countNoun = 'near you',
  onBack,
  onRefresh,
  refreshing = false,
  refreshTitle = 'Refresh',
  onChangeLocation,
  locationKicker,
  locationLabel,
  isCity = false,
  cityName,
  children,
}) {
  const isTablet = useIsTablet();
  const colWrap = isTablet ? 'max-w-[1024px]' : 'max-w-md';
  const cat = CAT[catKey] || FALLBACK_CAT;
  const kicker = locationKicker || (isCity ? 'City' : 'Location');

  return (
    <>
      {/* ── HEADER ROW — back chevron · CAT pill (+ mono count) · refresh/spacer ── */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button
            onClick={onBack || (() => window.history.back())}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]"
            style={{ background: '#FFFFFF', border: '1px solid #F0E9DC' }}
            aria-label="Back"
          >
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-2.5 min-w-0">
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))] flex-none"
              style={{ background: cat.bg, color: cat.ink }}
            >
              {Icon && <Icon size={13} color={cat.ink} strokeWidth={2} />}
              {title}
            </div>
            {count != null && (
              <span
                className="font-mono text-[calc(10.5px*var(--fs))] tracking-[0.12em] uppercase font-semibold whitespace-nowrap"
                style={{ color: cat.ink }}
              >
                {count} {countNoun}
              </span>
            )}
          </div>
          {onRefresh ? (
            <RefreshButton onClick={onRefresh} isRefreshing={refreshing} tone="dark" title={refreshTitle} />
          ) : (
            <div className="w-10 h-10" />
          )}
        </div>
      </div>

      {/* ── LOCATION CARD + CITY DISCLAIMER ── */}
      <div className={`px-4 ${colWrap} mx-auto pb-3`}>
        <button
          onClick={onChangeLocation}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] text-left transition-transform active:scale-[0.99]"
          style={{ background: '#FFFFFF', border: '1px solid #F0E9DC', boxShadow: '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)' }}
        >
          <MapPin size={18} color={TEAL_DEEP} strokeWidth={2} className="flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: '#94A3B8' }}>
              {kicker}
            </div>
            <div className="font-bold text-[calc(14.5px*var(--fs))] text-[#0F1419] mt-0.5 truncate">{locationLabel}</div>
          </div>
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: cat.bg, color: cat.ink }}>
            Change
          </span>
        </button>
        {isCity && (
          <div
            className="mt-2 px-3.5 py-2.5 rounded-[12px] text-[calc(12px*var(--fs))] leading-snug flex items-start gap-2"
            style={{ background: CAT.weather.bg, color: CAT.weather.ink }}
          >
            <Lightbulb size={15} color={CAT.weather.ink} strokeWidth={2} className="flex-none mt-0.5" />
            <span>Showing places across {cityName || 'this city'} — {CITY_DISCLAIMER}</span>
          </div>
        )}
      </div>

      {/* ── PAGE-OWNED BAND (search / filters / toggles) ── */}
      {children != null && <div className={`px-4 ${colWrap} mx-auto pb-2`}>{children}</div>}
    </>
  );
}
