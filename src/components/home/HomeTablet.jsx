import React from 'react';
import { MapPin, Cloud, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { CAT, TEAL_DEEP } from '@/components/redesign/constants';
import FontScaleButton from '@/components/a11y/FontScaleButton';

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
  { grad: `linear-gradient(135deg, ${CAT.shopping.ink} 0%, #A855F7 60%, #C084FC 100%)`, emoji: '🛍️', title: 'Shopping',             sub: 'Markets · malls',        action: 'Shopping' },
  { grad: `linear-gradient(135deg, ${CAT.culture.ink} 0%, #D97706 60%, #FBBF24 100%)`,  emoji: '🏛️', title: 'Cultural Info',        sub: 'Museums · sights',       action: 'Culture Information' },
  { grad: `linear-gradient(135deg, ${CAT.phrases.ink} 0%, #CA8A04 60%, #EAB308 100%)`,  emoji: '💬', title: 'Basic Language Phrases', sub: '50 essentials',        action: 'Basic Phrases' },
  { grad: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 60%, #2DD4BF 100%)',             emoji: '💲', title: 'Price scanner',        sub: 'Convert any price',      action: 'Smart Price Scanner' },
  { grad: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 60%, #A78BFA 100%)',             emoji: '🔤', title: 'Text scanner',         sub: 'Menus · signs · labels', action: 'Smart Text Scanner' },
];

export default function HomeTablet({
  firstName, cityName, placeText, localGreeting,
  weatherInfo, tempUnit, toggleTempUnit, dateText, timeText,
  flagActive, homeFlagUrl, onLocation, onAction,
}) {
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
            <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${homeFlagUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'saturate(1.1)' }} />
            <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.46) 100%)' }} />
          </>
        )}
        {/* Flag cards are pinned to TABLET_HERO_MIN so the flag never shrinks
            with text scale; flex justify-between keeps the greeting at the top
            and the date/location row at the base (matching the spec). */}
        <div className="relative z-10 p-8 flex flex-col justify-between" style={{ minHeight: flagActive ? TABLET_HERO_MIN : undefined }}>
          <div>
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono uppercase tracking-[0.16em] text-[calc(15px*var(--fs))] flex items-center gap-2" style={{ color: flagActive ? 'rgba(255,255,255,.92)' : '#736657' }}>
                <span>Hello 👋</span>
                {localGreeting && (
                  <span className="font-serif italic normal-case tracking-normal" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP }}>
                    {localGreeting.charAt(0).toUpperCase() + localGreeting.slice(1)}
                  </span>
                )}
              </p>
              <div className="flex-none"><FontScaleButton /></div>
            </div>

            <h1 className="mt-3 font-serif leading-[1.04] text-[calc(72px*var(--fs))]" style={{ color: flagActive ? '#fff' : '#16110D', textShadow: flagActive ? '0 2px 18px rgba(0,0,0,0.5)' : 'none' }}>
              {firstName}
              {cityName && (
                <>
                  <span>, in </span>
                  <span className="italic" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP }}>{cityName}</span>
                </>
              )}
            </h1>
          </div>

          <div>
            <div className="my-6 border-t" style={{ borderColor: flagActive ? 'rgba(255,255,255,.25)' : RULE }} />

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5 text-[calc(16px*var(--fs))] font-medium" style={{ color: flagActive ? '#fff' : '#3A3128' }}>
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
                className="inline-flex items-center gap-2.5 rounded-full px-5 py-3"
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

      {/* ── MONEY EXCHANGE HERO ───────────────────────────────────────── */}
      <motion.button
        whileTap={{ scale: 0.99 }}
        onClick={() => onAction('Money Exchange')}
        className="w-full mt-6 rounded-[28px] p-7 flex items-center gap-5 text-left relative overflow-hidden"
        style={{ background: 'linear-gradient(110deg,#15A06A,#0C7B50)', boxShadow: '0 18px 44px -18px rgba(12,123,80,.55)' }}
      >
        <div className="flex-none flex items-center justify-center rounded-2xl font-serif italic text-white" style={{ width: 74, height: 74, fontSize: 'calc(28px*var(--fs))', background: 'rgba(255,255,255,0.18)' }}>$€¥</div>
        <div className="flex-1 text-white">
          <div className="font-serif text-[calc(42px*var(--fs))] leading-tight">Money Exchange</div>
          <div className="text-[calc(17px*var(--fs))] opacity-90 mt-1">Compare rates near you</div>
        </div>
        <ChevronRight size={30} color="#fff" strokeWidth={2.2} className="flex-none" />
      </motion.button>

      {/* ── FEATURE TILES — 2-col grid; Weather spans full width ──────── */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        {FEATURES.map((f) => (
          <TabletTile key={f.title} cat={f.cat} emoji={f.emoji} title={f.title} sub={f.sub} onClick={() => onAction(f.action)} />
        ))}
        <TabletTile cat={CAT.weather} emoji="☀️" title="Weather" sub="Today's forecast" wide onClick={() => onAction('Weather')} />
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

function TabletTile({ cat, emoji, title, sub, wide = false, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[26px] text-left text-white p-7"
      style={{ background: cat.ink, gridColumn: wide ? 'span 2' : undefined, minHeight: 156, boxShadow: `0 16px 36px -18px ${cat.ink}90` }}
    >
      <div className="absolute -top-5 -right-5 rounded-full pointer-events-none" style={{ width: 120, height: 120, background: 'rgba(255,255,255,0.12)' }} />
      <div className="relative flex items-center justify-center rounded-2xl flex-none" style={{ width: 74, height: 74, background: 'rgba(255,255,255,0.2)' }}>
        <span style={{ fontSize: 38, lineHeight: 1 }}>{emoji}</span>
      </div>
      <h3 className="font-serif mt-4 leading-tight tracking-tight text-[calc(34px*var(--fs))]">{title}</h3>
      <p className="text-[calc(18px*var(--fs))] opacity-85 mt-1">{sub}</p>
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
