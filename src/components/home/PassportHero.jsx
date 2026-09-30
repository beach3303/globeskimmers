// PassportHero — the passport-first doorway at the top of Home (phone AND
// tablet since the 2026-09-30 convergence). Endowed progress, no guilt: a
// count when there is one, the nearest stamp when known, a warm zero state.
import React from "react";

export default function PassportHero({ total, nearest, onOpen, wide = false }) {
  const has = Number.isFinite(total) && total > 0;
  const miles = nearest && Number.isFinite(nearest.miles) ? (nearest.miles < 10 ? nearest.miles.toFixed(1) : Math.round(nearest.miles)) : null;
  return (
    <div className={wide ? "pb-4" : "px-4 pb-4"}>
      <button type="button" onClick={onOpen} aria-label="Open your Virtual Passport"
        className={(wide ? "w-full" : "w-full max-w-md mx-auto") + " block text-left rounded-2xl px-5 py-4"}
        style={{ background: '#FBF6EC', border: '1px solid #EADFC9', boxShadow: '0 10px 24px -20px rgba(22,17,13,.5)' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono uppercase text-[calc(9.5px*var(--fs))] font-semibold" style={{ letterSpacing: '.2em', color: '#B0472F' }}>My Virtual Passport</div>
            <div className="font-serif text-[calc(24px*var(--fs))] leading-[1.1] mt-1" style={{ color: '#16110D' }}>
              {has ? `${total} stamp${total === 1 ? '' : 's'} collected` : 'Your first page is waiting'}
            </div>
            <div className="font-mono text-[calc(10.5px*var(--fs))] mt-1.5 truncate" style={{ letterSpacing: '.05em', color: '#736657' }}>
              {nearest && nearest.name
                ? `NEXT STAMP: ${String(nearest.name).toUpperCase()}${miles != null ? ` · ${miles} MI` : ''}`
                : has ? 'OPEN THE BOOKLET · SHARE A PAGE' : 'STAMP YOUR HOME CITY TO BEGIN'}
            </div>
          </div>
          <div aria-hidden className="flex-none w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: '#0C2B50', border: '1px solid #D6A64A', color: '#D6A64A', fontSize: 22 }}>🛂</div>
        </div>
      </button>
    </div>
  );
}
