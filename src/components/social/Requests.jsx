// Requests: people asking to follow you (bible.mailbox, .circle_screen). Shared by Mailbox
// and the Circle screen, where it comes first when there are any. A mono kicker 'WANTS TO
// FOLLOW YOU', then one white sheet with a row per person: their face ringed in their cloth,
// their name (and seal, when the row carries one), '@handle', and two answers at 44px:
// 'Allow' (the open green with white, 6.31:1) and 'Not now' (ivory with ink).
//
//   <Requests rows onAccept onDecline accent title headingAs className style />
//   rows        op:list `requests` rows ({ user_id, handle, name, verified, seal, cloth?,
//               avatar? }), e.g. useCircle().requests. None: renders nothing.
//   onAccept    (row) => promise; onDecline (row) => promise. While one runs, that row's
//               answers are busy (aria-disabled, so focus stays) and both wait for it.
//               useCircle's accept / decline re-read the circle, and the row leaves when the
//               list does.
//   accent      the kicker's colour: airmail blue by default.
//   title       the kicker's words, 'Wants to follow you' (printed in capitals).
//   headingAs   the kicker's element, 'h2' by default.
//   onMore      (row) => void: a 44px '•••' after the answers ('Options for {name}'),
//               e.g. to open TravelerSheet for Report and Block (go-live decision 6).
//
// A follow is only ever pending when the person followed is a teen, and teens are held today
// (TEEN_SOCIAL_ENABLED=false), so this list is empty for every account until that changes.
import React, { useId, useState } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { NEUTRAL, fs } from '@/components/redesign/constants';
import OfficialSeal from '@/components/passport/OfficialSeal';
import { Face } from './SocialMarks';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

const idOf = (r) => String(r?.user_id ?? r?.handle ?? '');
const handleOf = (r) => String(r?.handle ?? '').trim().replace(/^@+/, '');
const nameOf = (r) => String(r?.name ?? '').trim() || (handleOf(r) ? `@${handleOf(r)}` : 'A traveler');

/**
 * @param {{ busy: boolean, waiting: boolean, solid: boolean, onClick: () => void, label: string, children: import('react').ReactNode }} props
 */
function Answer({ busy, waiting, solid, onClick, label, children }) {
  const off = busy || waiting;
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      aria-label={label}
      aria-disabled={off || undefined}
      aria-busy={busy || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 44,
        padding: 0,
        background: 'transparent',
        border: 0,
        cursor: off ? 'default' : 'pointer',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 36,
          boxSizing: 'border-box',
          padding: '4px 14px',
          borderRadius: 999,
          background: solid ? NEUTRAL.open : NEUTRAL.ivory,
          border: `1px solid ${solid ? NEUTRAL.open : NEUTRAL.creamRule}`,
          fontSize: fs(13),
          fontWeight: 600,
          lineHeight: 1.2,
          color: solid ? NEUTRAL.white : NEUTRAL.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {busy ? <Loader2 size={14} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : null}
        {children}
      </span>
    </button>
  );
}

/**
 * @param {{
 *   rows?: any[], onAccept?: (row: any) => any, onDecline?: (row: any) => any, accent?: string,
 *   title?: string, headingAs?: any, className?: string, style?: CSS,
 * }} props
 */
export default function Requests({
  rows = [],
  onAccept = undefined,
  onDecline = undefined,
  accent = undefined,
  title = 'Wants to follow you',
  headingAs: Heading = 'h2',
  onMore = undefined,
  className = undefined,
  style = undefined,
}) {
  const headId = `requests-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [busy, setBusy] = useState(/** @type {{ id: string, op: 'accept'|'decline' } | null} */ (null));
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object' && idOf(r));
  if (!list.length) return null;

  const answer = async (row, op) => {
    const fn = op === 'accept' ? onAccept : onDecline;
    if (busy || typeof fn !== 'function') return;
    setBusy({ id: idOf(row), op });
    try {
      await fn(row);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby={headId} className={className} style={style}>
      <Heading
        id={headId}
        style={{
          margin: 0,
          fontFamily: MONO,
          fontSize: fs(10),
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: accent || NEUTRAL.airmailBlue,
        }}
      >
        {title}
      </Heading>
      <ul
        style={{
          margin: '8px 0 0',
          padding: 0,
          listStyle: 'none',
          background: NEUTRAL.white,
          border: `1px solid ${NEUTRAL.airmailLine}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {list.map((r, i) => {
          const who = nameOf(r);
          const h = handleOf(r);
          const mine = busy && busy.id === idOf(r);
          return (
            <li
              key={idOf(r)}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: 10,
                rowGap: 0,
                padding: '6px 10px 6px 14px',
                borderTop: i ? `1px solid ${NEUTRAL.airmailHair}` : 0,
              }}
            >
              {/* 120px: the name, both answers and the '•••' share one line from 375px up (measured; 320 wraps). */}
              <span style={{ flex: '1 1 120px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <Face name={r.name} handle={h} avatar={r.avatar} cloth={r.cloth} size={32} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: fs(14), fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere', color: NEUTRAL.ink }}>
                    {who}
                    {r.verified === true ? <OfficialSeal size={12} tier={r.seal || 'burgundy'} style={undefined} /> : null}
                  </span>
                  {h && String(r.name ?? '').trim() ? (
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.35, overflowWrap: 'anywhere', color: NEUTRAL.ink3 }}>@{h}</span>
                  ) : null}
                </span>
              </span>
              <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <Answer busy={!!mine && busy.op === 'accept'} waiting={!!busy && !(mine && busy.op === 'accept')} solid onClick={() => answer(r, 'accept')} label={`Allow ${who} to follow you`}>
                  Allow
                </Answer>
                <Answer busy={!!mine && busy.op === 'decline'} waiting={!!busy && !(mine && busy.op === 'decline')} solid={false} onClick={() => answer(r, 'decline')} label={`Not now for ${who}`}>
                  Not now
                </Answer>
                {typeof onMore === 'function' ? (
                  <button type="button" onClick={() => onMore(r)} aria-label={`Options for ${who}`} aria-haspopup="dialog"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, margin: '0 -8px 0 -4px', padding: 0, background: 'transparent', border: 0, borderRadius: 999, color: NEUTRAL.ink3, cursor: 'pointer' }}>
                    <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
