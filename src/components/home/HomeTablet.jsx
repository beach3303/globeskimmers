import React from 'react';
import { MapPin, Cloud } from 'lucide-react';
import { motion } from 'framer-motion';
import { CAT, TEAL_DEEP } from '@/components/redesign/constants';
import FontScaleButton from '@/components/a11y/FontScaleButton';
import HomeRows from '@/components/home/HomeRows';
import StampsNearYou from '@/components/home/StampsNearYou';
import StayAnchor from '@/components/home/StayAnchor';
import EscapesRow from '@/components/home/EscapesRow';
import RightNowStrip from '@/components/home/RightNowStrip';
import WhereToStay from '@/components/home/WhereToStay';
import EventsRow from '@/components/home/EventsRow';
import { getPrimaryStay } from '@/lib/savedLocations';

// iPad / tablet Home layout — implements CLAUDE_CODE_IPAD_BUILD.md §3 "Home".
// Rendered ONLY at tablet width (HomePage branches on useIsTablet); the phone
// layout is left entirely untouched. Every display size is calc(BASE * var(--fs))
// so the 4-step text-scaling control applies here exactly like the spec wants.

const RULE = 'rgba(22,17,13,.10)';

// The greeting/flag card is pinned to its largest-text-scale height (measured
// at --fs 1.45, the 3-line headline case) so the flag always reads at full
// size — it no longer shrinks when text is minimized. Content is distributed
// top/bottom (flex justify-between) so the date + location row stays at the
// card's base like the max-scale layout. iPad-only (this component is tablet-only).
const TABLET_HERO_MIN = 440;

// Feature tiles — 2-up grid, serif title + subtitle, 74px emoji chip.
const FEATURES = [
  { cat: CAT.transit,     emoji: '🚌', title: 'Transit Info',       sub: 'Routes & times',   action: 'Transportation' },
  { cat: CAT.food,        emoji: '🍽️', title: 'Nearby Restaurants', sub: 'Where locals eat', action: 'Places to Eat' },
  { cat: CAT.coffee,      emoji: '☕', title: 'Coffee Shop Finder', sub: 'Cafés near you',   action: 'Coffee' },
  { cat: CAT.atm,         emoji: '🏧', title: 'ATM Finder',         sub: 'Skip the fees',    action: 'ATM' },
  { cat: CAT.restroom,    emoji: '🚻', title: 'Restroom Finder',    sub: 'Clean & rated',    action: 'Restroom' },
  { cat: CAT.convenience, emoji: '🏪', title: 'Convenience Store',  sub: '24/7 essentials',  action: 'Convenience Store' },
];

// Explore More — 3-up gradient cards (same gradients as the phone GradCards).
const EXPLORE = [
  { grad: `linear-gradient(135deg, ${CAT.todo.ink} 0%, #E84393 60%, #FF7DB1 100%)`,     emoji: '🎟️', title: 'Things to do',         sub: 'Sights · tours',         action: 'Things to Do' },
  { grad: 'linear-gradient(135deg, #8B3A1E 0%, #B0472F 60%, #D98A6A 100%)',             emoji: '🛂', title: 'Virtual Passport',       sub: 'Stamps · memories',      action: 'Passport' },
  { grad: 'linear-gradient(135deg, #4338CA 0%, #6366F1 60%, #A5B4FC 100%)',             emoji: '💡', title: 'Insight',               sub: 'Plan it like a pro',     action: 'Insight' },
  { grad: 'linear-gradient(135deg, #0E7C66 0%, #14B8A6 60%, #5EEAD4 100%)',             emoji: '🧳', title: 'Travel essentials',      sub: 'eSIM · bags · stays',    action: 'Travel Essentials' },
  { grad: `linear-gradient(135deg, ${CAT.shopping.ink} 0%, #A855F7 60%, #C084FC 100%)`, emoji: '🛍️', title: 'Shopping',             sub: 'Markets · malls',        action: 'Shopping' },
  { grad: `linear-gradient(135deg, ${CAT.culture.ink} 0%, #D97706 60%, #FBBF24 100%)`,  emoji: '🏛️', title: 'Cultural Info',        sub: 'Museums · sights',       action: 'Culture Information' },
  { grad: `linear-gradient(135deg, ${CAT.phrases.ink} 0%, #CA8A04 60%, #EAB308 100%)`,  emoji: '💬', title: 'Basic Language Phrases', sub: '50 essentials',        action: 'Basic Phrases' },
  { grad: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 60%, #2DD4BF 100%)',             emoji: '💲', title: 'Price scanner',        sub: 'Convert any price',      action: 'Smart Price Scanner' },
  { grad: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 60%, #A78BFA 100%)',             emoji: '🔤', title: 'Text scanner',         sub: 'Menus · signs · labels', action: 'Smart Text Scanner' },
];

export default function HomeTablet({
  firstName, cityName, placeText, localGreeting,
  weatherInfo, tempUnit, toggleTempUnit, dateText, timeText,
  flagActive, homeFlagUrl, onLocation, onAction, clockRows = [], journeyMode = "discovery",
}) {
  const ORDER = {
    home: ["escapes", "rows", "stamps"], discovery: ["rows", "escapes", "stamps"],
    domestic: ["stamps", "rows", "escapes"], international: ["stamps", "rows", "escapes"],
    planning: ["rows", "escapes", "stamps"],
  };
  const SEC = {
    rows: <HomeRows key="rows" wide onAction={onAction} />,
    stamps: <StampsNearYou key="stamps" wide onAction={onAction} />,
    escapes: <EscapesRow key="escapes" wide onAction={onAction} />,
  };
  const discoverOrder = ORDER[journeyMode] || ["rows", "stamps", "escapes"];
  return (
    <div className="mx-auto px-8 pt-6" style={{ maxWidth: 1024 }}>
      {/* ── GREETING CARD ─────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[30px]"
        style={{
          background: '#fff',
          border: `1px solid ${RULE}`,
          boxShadow: '0 1px 0 rgba(15,20,25,.04), 0 18px 50px -24px rgba(15,20,25,.14)',
        }}
      >
        {flagActive && (
          <>
            {/* Blurred fill covers the card behind the contained flag (no empty
                bars). Oversized backgroundSize hides the blur seam WITHOUT a
                transform — a scaled child escapes the page overflow-clip on iOS
                WKWebView and makes the whole app pannable sideways. */}
            <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${homeFlagUrl})`, backgroundSize: '170%', backgroundPosition: 'center', filter: 'blur(26px) saturate(1.2)' }} />
            {/* The whole flag — uncropped and undistorted (contain). */}
            <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${homeFlagUrl})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', filter: 'saturate(1.05)' }} />
            {/* Scrim keeps the flag vibrant through the middle, darkening only at
                the very top (Hello kicker) and toward the base (date·location). */}
            <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(180deg, rgba(8,10,14,0.42) 0%, rgba(8,10,14,0.12) 28%, rgba(8,10,14,0.08) 52%, rgba(8,10,14,0.5) 82%, rgba(8,10,14,0.8) 100%)' }} />
          </>
        )}
        {/* Flag cards are pinned to TABLET_HERO_MIN so the flag never shrinks
            with text scale; flex justify-between keeps the greeting at the top
            and the date/location row at the base (matching the spec). */}
        <div className="relative z-10 p-8 flex flex-col justify-between" style={{ minHeight: flagActive ? TABLET_HERO_MIN : undefined }}>
          {/* TOP LINE — "Hello 👋" (left) · first name CENTERED in the gap
              (flex-1 + text-center) · glasses (right). The city headline sits
              below, right-aligned over the plain fly side of the flag. Mirrors
              the phone Home layout. */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono uppercase tracking-[0.16em] text-[calc(15px*var(--fs))] flex items-center gap-2 leading-none flex-shrink-0" style={{ color: flagActive ? 'rgba(255,255,255,.92)' : '#736657' }}>
                <span>Hello 👋</span>
                {localGreeting && (
                  <span className="font-serif italic normal-case tracking-normal" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP }}>
                    {localGreeting.charAt(0).toUpperCase() + localGreeting.slice(1)}
                  </span>
                )}
              </p>
              {firstName && (
                // First name centered between "Hello 👋" and the glasses;
                // whitespace-nowrap so it never splits its letters.
                <span className="flex-1 min-w-0 text-center font-serif italic text-[calc(38px*var(--fs))] whitespace-nowrap" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP, textShadow: flagActive ? '0 1px 10px rgba(0,0,0,0.55)' : 'none', overflowWrap: 'normal', wordBreak: 'keep-all' }}>
                  {firstName}
                </span>
              )}
              <div className="flex-none"><FontScaleButton /></div>
            </div>

            {cityName && (
              <h1 className="text-right mt-3 font-serif leading-[1.04] text-[calc(72px*var(--fs))]" style={{ color: flagActive ? '#fff' : '#16110D', textShadow: flagActive ? '0 2px 18px rgba(0,0,0,0.55)' : 'none' }}>
                <span style={{ color: flagActive ? 'rgba(255,255,255,.85)' : '#3A3128' }}>in </span>
                <span className="italic" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP }}>{cityName}</span>
              </h1>
            )}
          </div>

          <div>
            <div className="my-6 border-t" style={{ borderColor: flagActive ? 'rgba(255,255,255,.25)' : RULE }} />

            {/* date·time·weather, plus location pill pinned bottom-RIGHT (ml-auto)
                so it stays right even when enlarged text wraps it to a new line. */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5 text-[calc(16px*var(--fs))] font-medium" style={{ color: flagActive ? '#fff' : '#3A3128', textShadow: flagActive ? '0 1px 8px rgba(0,0,0,0.5)' : 'none' }}>
                <span>{dateText}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{timeText}</span>
                {weatherInfo && Number.isFinite(weatherInfo.celsius) && (
                  <>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <button onClick={toggleTempUnit} className="inline-flex items-center gap-1.5">
                      <Cloud size={17} color={flagActive ? '#FFD9A0' : TEAL_DEEP} strokeWidth={2} />
                      {tempUnit === 'C' ? `${weatherInfo.celsius}°C` : `${weatherInfo.fahrenheit}°F`}
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={onLocation}
                className="ml-auto inline-flex items-center gap-2.5 rounded-full px-5 py-3"
                style={{ background: flagActive ? 'rgba(0,0,0,0.42)' : '#F6F1E7', backdropFilter: flagActive ? 'blur(10px)' : 'none', WebkitBackdropFilter: flagActive ? 'blur(10px)' : 'none' }}
              >
                <MapPin size={17} color={flagActive ? '#FFD9A0' : TEAL_DEEP} strokeWidth={2} />
                <span className="font-semibold text-[calc(16px*var(--fs))]" style={{ color: flagActive ? '#fff' : '#16110D' }}>{placeText}</span>
                <span className="underline underline-offset-2 text-[calc(13px*var(--fs))]" style={{ color: flagActive ? 'rgba(255,255,255,.85)' : TEAL_DEEP }}>Change</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CLOCK STACK ───────────────────────────────────────────────────
          Subtle labeled rows under the hero, mirroring the phone layout: 📍 your
          physical location (when you've navigated elsewhere) and 🏠 home (when
          toggled). Each: place · day,date · time · temp. Only timezones that
          differ from the hero (and each other) are passed in. */}
      {clockRows.length > 0 && (
        <div className="mt-4 flex flex-col items-center gap-1.5">
          {clockRows.map((r) => (
            <div key={r.key} className="flex items-center justify-center gap-2.5 flex-wrap text-[calc(14px*var(--fs))] font-medium" style={{ color: '#8A93A6' }}>
              <span className="flex items-center gap-1.5"><span>{r.icon}</span><span className="uppercase tracking-wide">{r.label}</span></span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{r.dateText}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{r.timeText}</span>
              {r.tempText && (<><span style={{ opacity: 0.4 }}>·</span><span>{r.tempText}</span></>)}
            </div>
          ))}
        </div>
      )}

      {/* ── FEATURE TILES — 3-up COMPACT grid (same footprint as Explore More).
          Real-iPad feedback: the old 2-up tiles read far too large. These now
          match the Explore-More tile size — the default (and largest) size on
          iPad — and only grow a little in height as the text scale increases.
          Weather rides along as a 7th small tile (no longer full-width). ──── */}
      <div className="grid grid-cols-3 gap-5 mt-6">
        {/* Book a Ride + Money Exchange lead the grid (Money Exchange is no longer a hero) */}
        <TabletTile cat={{ ink: '#2563EB' }} emoji="🚗" title="Book a Ride" sub="Cars · transfers · rides" onClick={() => onAction('Get A Ride')} />
        <TabletTile cat={CAT.money} emoji="💱" title="Money Exchange" sub="Compare rates near you" onClick={() => onAction('Money Exchange')} />
        {FEATURES.map((f) => (
          <TabletTile key={f.title} cat={f.cat} emoji={f.emoji} title={f.title} sub={f.sub} onClick={() => onAction(f.action)} />
        ))}
        <TabletTile cat={CAT.weather} emoji="☀️" title="Weather" sub="Today's forecast" onClick={() => onAction('Weather')} />
      </div>

      {/* ── DISCOVER — living sections below the tiles (renders nothing on
             cold-start; re-centers as the user moves) ─────────────────── */}
      <div className="mt-9">
        {journeyMode !== "planning" && <RightNowStrip wide onAction={onAction} />}
        <StayAnchor />
        {!getPrimaryStay() && ["planning", "international", "domestic"].includes(journeyMode) && <WhereToStay wide />}
        {discoverOrder.map((k) => SEC[k])}
        <EventsRow wide onAction={onAction} />
      </div>

      {/* ── EXPLORE MORE — 3-col gradient cards ───────────────────────── */}
      <div className="mt-9">
        <div className="font-mono uppercase tracking-[0.16em] text-[calc(14px*var(--fs))] font-semibold mb-4" style={{ color: '#736657' }}>
          Explore more
        </div>
        <div className="grid grid-cols-3 gap-5">
          {EXPLORE.map((e) => (
            <TabletGrad key={e.title} grad={e.grad} emoji={e.emoji} title={e.title} sub={e.sub} onClick={() => onAction(e.action)} />
          ))}
        </div>
      </div>

      {/* Bottom clearance so the floating nav + ad banner never cover the last row. */}
      <div aria-hidden style={{ height: 170 }} />
    </div>
  );
}

// Compact feature tile — same footprint as TabletGrad (the Explore-More size),
// solid category color + matching colored glow. Chip on top, title/sub pinned to
// the base; height grows only modestly as the text scale increases.
function TabletTile({ cat, emoji, title, sub, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[24px] text-left text-white p-6"
      style={{ background: cat.ink, minHeight: 178, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: `0 14px 32px -16px ${cat.ink}80` }}
    >
      <div className="absolute -top-3 -right-3 rounded-full pointer-events-none" style={{ width: 90, height: 90, background: 'rgba(255,255,255,0.12)' }} />
      <div className="relative flex items-center justify-center rounded-2xl flex-none" style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)' }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
      </div>
      <div className="relative">
        <h3 className="font-serif leading-tight tracking-tight text-[calc(27px*var(--fs))]">{title}</h3>
        <p className="text-[calc(14px*var(--fs))] opacity-85 mt-0.5">{sub}</p>
      </div>
    </motion.button>
  );
}

function TabletGrad({ grad, emoji, title, sub, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[24px] text-left text-white p-6"
      style={{ background: grad, minHeight: 178, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 14px 32px -16px rgba(15,20,25,0.42)' }}
    >
      <div className="absolute -top-3 -right-3 rounded-full pointer-events-none" style={{ width: 90, height: 90, background: 'rgba(255,255,255,0.14)' }} />
      <div className="relative flex items-center justify-center rounded-2xl flex-none" style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.22)' }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
      </div>
      <div className="relative">
        <div className="font-serif text-[calc(27px*var(--fs))] leading-tight tracking-tight">{title}</div>
        <div className="text-[calc(14px*var(--fs))] opacity-90 mt-0.5">{sub}</div>
      </div>
    </motion.button>
  );
}
