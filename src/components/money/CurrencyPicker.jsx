// CurrencyPicker: Money's currency pill and its sheet (the new look, Money.dc.html L64-77;
// it replaces the shadcn Select the converter used).
//
// The pill: the currency code in mono 13 with a chevron, white with the world line, 36px
// tall inside a 44px hit area, PILL_WIDTH wide so the FROM and TO pills line up. Its name
// for screen readers says which side it is and the currency ('From currency: US Dollar').
//
// The sheet (the shared FilterSheet on the world's paper): a search field matching code,
// name or country ('japan', 'yen', 'jp'), then Suggested (the local and your own currency,
// when known) and every currency A–Z by name. Codes, never flags or emoji. Picking one
// closes the sheet; Enter in the search picks the first match.
//
// Props: world (a WORLD row or key; Money by default), label ('From' | 'To'), value (a
// code, or '' for none), onChange(code), suggested ([{ code, note }], e.g. 'Local').
import React, { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import FilterSheet, { FilterGroupLabel } from '@/components/finder/FilterSheet';
import { worldRow } from '@/components/finder/FinderControls';
import { NEUTRAL, fs } from '@/components/redesign/constants';
import { CURRENCIES, currencyByCode, searchCurrencies } from './currencies';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/** The pill's width: both pills share it, and the converter's swap circle sits beside it. */
export const PILL_WIDTH = 'calc(76px * var(--fs, 1))';

function Row({ c, note, selected, onPick, w }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(c.code)}
        aria-current={selected ? 'true' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          minHeight: 48,
          padding: '6px 4px',
          boxSizing: 'border-box',
          background: 'transparent',
          border: 0,
          borderBottom: `1px solid ${w.line}`,
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span style={{ flexShrink: 0, minWidth: 44, fontFamily: MONO, fontSize: fs(13), fontWeight: 500, letterSpacing: '.06em', color: w.ink }}>{c.code}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: fs(15), lineHeight: 1.3, color: NEUTRAL.ink }}>
          {c.name}
          {note ? <span style={{ display: 'block', fontSize: fs(12), color: NEUTRAL.ink3 }}>{note}</span> : null}
        </span>
        {selected ? <Check size={18} color={w.ink} strokeWidth={2.4} aria-hidden="true" style={{ flexShrink: 0 }} /> : null}
      </button>
    </li>
  );
}

/**
 * @param {{ world?: any, label?: string, value?: string, onChange?: (code: string) => void, suggested?: { code: string, note?: string }[] }} props
 */
export default function CurrencyPicker({ world = 'money', label = 'From', value = '', onChange = undefined, suggested = [] }) {
  const w = worldRow(world);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const searchId = useId();
  const current = currencyByCode(value);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const results = useMemo(() => (q.trim() ? searchCurrencies(q) : CURRENCIES), [q]);
  const picks = useMemo(() => {
    const seen = new Map();
    suggested.forEach((s) => {
      const c = currencyByCode(s.code);
      if (!c) return;
      const prev = seen.get(c.code);
      seen.set(c.code, { c, notes: [...(prev ? prev.notes : []), s.note].filter(Boolean) });
    });
    return [...seen.values()];
  }, [suggested]);

  const pick = (code) => {
    setOpen(false);
    if (code && code !== value) onChange?.(code);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${label} currency: ${current ? current.name : 'none chosen'}`}
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', minHeight: 44, padding: 0, background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: PILL_WIDTH,
            minHeight: 36,
            boxSizing: 'border-box',
            padding: '0 8px 0 10px',
            borderRadius: 999,
            background: NEUTRAL.white,
            border: `1px solid ${w.line}`,
            fontFamily: MONO,
            fontSize: fs(13),
            fontWeight: 500,
            letterSpacing: '.06em',
            color: current ? w.ink : NEUTRAL.ink3,
          }}
        >
          {current ? current.code : 'Pick'}
          <ChevronDown size={14} color={w.ink} strokeWidth={2.2} aria-hidden="true" style={{ flexShrink: 0 }} />
        </span>
      </button>

      <FilterSheet world={w} open={open} onClose={() => setOpen(false)} title={`${label} currency`}>
        {/* The search stays in view under the sheet's header while the list scrolls. */}
        <div style={{ position: 'sticky', top: 60, zIndex: 1, margin: '-12px -20px 0', padding: '12px 20px 8px', background: w.paper }}>
          <label htmlFor={searchId} className="sr-only">Search currencies</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 12px', boxSizing: 'border-box', borderRadius: 12, background: NEUTRAL.white, border: `1px solid ${w.line}` }}>
            <Search size={16} color={w.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
            <input
              id={searchId}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results.length) {
                  e.preventDefault();
                  pick(results[0].code);
                }
              }}
              placeholder="Currency, code or country"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              style={{ flex: 1, minWidth: 0, minHeight: 42, padding: 0, border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: fs(15), color: NEUTRAL.ink }}
            />
          </div>
        </div>

        {!q.trim() && picks.length > 0 && (
          <section aria-label="Suggested" style={{ marginTop: 8 }}>
            <FilterGroupLabel>Suggested</FilterGroupLabel>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {picks.map(({ c, notes }) => (
                <Row key={c.code} c={c} note={notes.join(' · ')} selected={c.code === value} onPick={pick} w={w} />
              ))}
            </ul>
          </section>
        )}

        <section aria-label={q.trim() ? 'Matches' : 'All currencies'} style={{ marginTop: 12 }}>
          {!q.trim() && <FilterGroupLabel>All currencies</FilterGroupLabel>}
          {results.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {results.map((c) => (
                <Row key={c.code} c={c} selected={c.code === value} onPick={pick} w={w} />
              ))}
            </ul>
          ) : (
            <p role="status" style={{ margin: '12px 0', fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              No currency matches &ldquo;{q.trim()}&rdquo;.
            </p>
          )}
        </section>
      </FilterSheet>
    </>
  );
}
