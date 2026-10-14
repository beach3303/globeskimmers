// FollowByHandle: add someone to your circle by their @username (Mailbox.dc.html L41-51 on
// airmail; Circle.dc.html L347-357 in the owner's cloth). A visible label, a 48px white
// field with '@', and a 48px square Follow button with a white UserPlus.
//
//   <FollowByHandle accent cloth line onFollowed label placeholder id className style />
//   accent      the label and button colour: airmail blue by default (Mailbox). A cloth key
//               or CLOTH row works too, and so does `cloth`: then the field's line is the
//               cloth's fieldLine (the Circle screen). line overrides the field's line.
//   onFollowed  called with { handle, status: 'accepted'|'pending' } after the worker says yes
//               and the circle has been read again for every surface (useCircle.follow).
//   label       'Add someone to your circle' (printed in capitals); placeholder 'follow a
//               friend by @username'.
//
// The field keeps today's rules: lower case, letters, digits, '_' and one '@', 21
// characters, and Enter follows. The toasts keep today's follow verbs: 'Following @aiko', or
// 'Asked to follow @aiko — they approve first'. The button rests in the accent beside the
// empty field, as both boards draw it; pressed before a name is typed, it takes you to the
// field. While a follow is on its way it is disabled the plain way (bible.mailbox): an ivory
// square with a hairline and an ink-3 spinner, never a faded colour, and it keeps focus.
//
// workerMessage(error) is exported: a worker or network error as words for a toast, without
// emoji (principle 6).
import React, { useId, useRef, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { CLOTH, NEUTRAL, fs } from '@/components/redesign/constants';
import useCircle from '@/lib/useCircle';
import { clothRow } from '@/components/profile/CoverBand';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/**
 * A style object that may carry CSS custom properties (--gs-ph).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;

/**
 * A worker or network error as words for a toast: 'timeout' and network failures read as
 * 'Couldn’t reach Globeskimmers. Try again.', and emoji are dropped.
 * @param {any} error
 * @param {string} [fallback]
 */
export function workerMessage(error, fallback = 'Something went wrong. Try again.') {
  const raw = typeof error === 'string' ? error : error && typeof error.message === 'string' ? error.message : '';
  if (!raw) return fallback;
  if (/^(timeout|network error|failed to fetch|load failed)$/i.test(raw.trim()) || /^HTTP 5\d\d$/.test(raw.trim())) {
    return 'Couldn’t reach Globeskimmers. Try again.';
  }
  const words = raw.replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
  return words || fallback;
}

const isCloth = (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(CLOTH, v.trim().toLowerCase()))
  || (!!v && typeof v === 'object' && typeof v.key === 'string' && Object.prototype.hasOwnProperty.call(CLOTH, v.key));

/**
 * @param {{
 *   accent?: any, cloth?: any, line?: string, onFollowed?: (r: { handle: string, status: string }) => void,
 *   label?: string, placeholder?: string, id?: string, className?: string, style?: CSS,
 * }} props
 */
export default function FollowByHandle({
  accent = undefined,
  cloth = undefined,
  line = undefined,
  onFollowed = undefined,
  label = 'Add someone to your circle',
  placeholder = 'follow a friend by @username',
  id = undefined,
  className = undefined,
  style = undefined,
}) {
  const circle = useCircle();
  const auto = useId();
  const inputId = id || `follow-${auto.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(/** @type {HTMLInputElement|null} */ (null));

  const fromCloth = cloth !== undefined && cloth !== null ? clothRow(cloth) : isCloth(accent) ? clothRow(accent) : null;
  const color = fromCloth ? fromCloth.cloth : typeof accent === 'string' && accent.trim() ? accent : NEUTRAL.airmailBlue;
  const fieldLine = line || (fromCloth ? fromCloth.fieldLine : NEUTRAL.airmailLine);
  const handle = draft.trim().replace(/^@+/, '');

  const follow = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (busy) return;
    if (!handle) {
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    setBusy(true);
    const res = await circle.follow(handle);
    setBusy(false);
    if (!res.ok) {
      showToast(workerMessage(res.error, 'Couldn’t follow them. Try again.'), 'error');
      return;
    }
    const who = String(res.data?.handle || handle).replace(/^@+/, '');
    const status = res.data?.status === 'pending' ? 'pending' : 'accepted';
    setDraft('');
    showToast(status === 'pending' ? `Asked to follow @${who} — they approve first` : `Following @${who}`, 'success');
    if (typeof onFollowed === 'function') onFollowed({ handle: who, status });
  };

  return (
    <form onSubmit={follow} className={className} style={{ margin: 0, ...style }}>
      <label
        htmlFor={inputId}
        style={{
          display: 'block',
          fontFamily: MONO,
          fontSize: fs(10),
          lineHeight: 1.2,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          overflowWrap: 'anywhere',
          color,
        }}
      >
        {label}
      </label>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 14px',
            background: NEUTRAL.white,
            border: `1px solid ${fieldLine}`,
            borderRadius: 14,
            outline: focused ? `2px solid var(--gs-focus, ${NEUTRAL.tealInk})` : 'none',
            outlineOffset: 2,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: fs(15), fontWeight: 700, lineHeight: 1, color: NEUTRAL.ink3 }}>@</span>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, '').slice(0, 21))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            className="placeholder:text-[color:var(--gs-ph)]"
            style={css({
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              padding: '0 0 0 2px',
              border: 0,
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: fs(14),
              color: NEUTRAL.ink,
              '--gs-ph': NEUTRAL.ink3,
            })}
          />
        </div>
        <button
          type="submit"
          aria-label="Follow"
          aria-disabled={busy || undefined}
          aria-busy={busy || undefined}
          style={{
            flex: 'none',
            width: 48,
            height: 48,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            boxSizing: 'border-box',
            background: busy ? NEUTRAL.ivory : color,
            border: `1px solid ${busy ? fieldLine : color}`,
            color: busy ? NEUTRAL.ink3 : NEUTRAL.white,
            cursor: busy ? 'progress' : 'pointer',
          }}
        >
          {busy
            ? <Loader2 size={18} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" />
            : <UserPlus size={18} strokeWidth={2} aria-hidden="true" focusable="false" />}
        </button>
      </div>
    </form>
  );
}
