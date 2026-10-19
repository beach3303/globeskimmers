// FindPeople: find a member by name, @username or the email they signed up with, and follow
// them from the result (founder, 2026-10-18: "name and email and handle … findable by
// default for adults"). It replaces FollowByHandle on the Circle screen and in the Mailbox:
// the same label-and-field look, and a short white list of people underneath.
//
//   <FindPeople accent cloth onFollowed label placeholder style className />
//   cloth / accent  as FollowByHandle: a cloth key colours the label, the field line and the
//                   Follow buttons; otherwise airmail blue (the Mailbox).
//   onFollowed      called with { user_id, handle, status } after a follow went through.
//
// The worker (/social/find) decides who can be found: adults only, never anyone in a block
// with you, a name only when they kept "find me by name" on, an email only when they kept
// "find me by email" on, a @username always. A name needs 3 letters, a handle 2, an email
// the whole address — the field says so instead of searching early. Each row: their face,
// name, '@handle' or 'no @username yet' (a member who hasn't opened the app since usernames
// arrived — following them by account works, and the follow waits in their Mailbox), and one
// 44px answer: Follow / Follow back (filled), or Requested / Following / Friends (ivory).
// An email nobody uses offers the invite.
import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { NEUTRAL, fs } from '@/components/redesign/constants';
import useCircle from '@/lib/useCircle';
import { findPeople } from '@/lib/passport';
import { clothRow } from '@/components/profile/CoverBand';
import { Face } from '@/components/social/SocialMarks';
import InviteButton from '@/components/passport/InviteButton';
import { workerMessage } from '@/components/social/FollowByHandle';

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// What the field holds, and whether the worker would search it yet.
const classify = (raw) => {
  const q = raw.trim();
  if (!q) return { kind: 'empty', ready: false };
  if (EMAIL.test(q)) return { kind: 'email', ready: true };
  if (/@/.test(q) && !/^@/.test(q)) return { kind: 'email', ready: false };   // half an address
  const term = q.replace(/^@+/, '');
  if (/^@/.test(raw.trim())) return { kind: 'handle', ready: term.length >= 2 };
  return { kind: 'name', ready: term.length >= 3 || (term.length >= 2 && /^[a-z0-9_]+$/i.test(term)) };
};

const RELATION = { requested: 'Requested', following: 'Following', friends: 'Friends' };

export default function FindPeople({ accent = undefined, cloth = undefined, onFollowed = undefined,
  label = 'Find people', placeholder = 'name, @username or email', style = undefined, className = undefined }) {
  const circle = useCircle();
  const auto = useId();
  const inputId = `find-${auto.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);        // null = nothing searched yet
  const [mode, setMode] = useState('name');
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(null);
  const [focused, setFocused] = useState(false);
  const seq = useRef(0);

  const row = cloth !== undefined && cloth !== null ? clothRow(cloth) : null;
  const color = row ? row.cloth : (typeof accent === 'string' && accent.trim() ? accent : NEUTRAL.airmailBlue);
  const fieldLine = row ? row.fieldLine : NEUTRAL.airmailLine;
  const what = classify(q);

  // Search 350 ms after the last keystroke, once the words are worth sending.
  useEffect(() => {
    if (!what.ready) { setRows(null); setBusy(false); return undefined; }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const res = await findPeople(q.trim());
      if (my !== seq.current) return;
      setBusy(false);
      if (res.error) { setRows([]); showToast(workerMessage(res.error, 'Couldn’t search right now. Try again.'), 'error'); return; }
      setMode(res.mode);
      setRows(res.people);
    }, 350);
    return () => clearTimeout(t);
  }, [q, what.ready]);   // eslint-disable-line react-hooks/exhaustive-deps

  const follow = async (p) => {
    if (following) return;
    setFollowing(p.user_id);
    const res = await circle.follow({ user_id: p.user_id, handle: p.handle || '' });
    setFollowing(null);
    if (!res.ok) { showToast(workerMessage(res.error, 'Couldn’t follow them. Try again.'), 'error'); return; }
    const status = res.data?.status === 'pending' ? 'pending' : 'accepted';
    const who = p.handle ? `@${p.handle}` : p.name;
    setRows((rs) => (rs || []).map((r) => (r.user_id === p.user_id ? { ...r, relation: status === 'pending' ? 'requested' : (r.relation === 'follows_you' ? 'friends' : 'following') } : r)));
    showToast(status === 'pending' ? `Asked to follow ${who} — they approve first` : `Following ${who}`, 'success');
    if (typeof onFollowed === 'function') onFollowed({ user_id: p.user_id, handle: p.handle, status });
  };

  const hint = what.kind === 'email' && !what.ready ? 'Type the whole email address'
    : what.kind === 'name' && !what.ready ? 'Type at least 3 letters of their name'
      : what.kind === 'handle' && !what.ready ? 'Type at least 2 letters of their @username' : null;

  return (
    <div className={className} style={{ margin: 0, ...style }}>
      <label htmlFor={inputId} style={{ display: 'block', fontFamily: MONO, fontSize: fs(10), lineHeight: 1.2, letterSpacing: '.16em', textTransform: 'uppercase', overflowWrap: 'anywhere', color }}>
        {label}
      </label>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, boxSizing: 'border-box', padding: '0 14px', background: NEUTRAL.white, border: `1px solid ${fieldLine}`, borderRadius: 14,
        outline: focused ? `2px solid var(--gs-focus, ${NEUTRAL.tealInk})` : 'none', outlineOffset: 2 }}>
        {busy
          ? <Loader2 size={18} strokeWidth={2} color={NEUTRAL.ink3} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
          : <Search size={18} strokeWidth={2} color={color} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />}
        <input id={inputId} type="text" inputMode="search" value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="search"
          aria-describedby={`${inputId}-help`}
          style={{ flex: 1, minWidth: 0, minHeight: 44, padding: 0, border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: fs(14), color: NEUTRAL.ink }} />
      </div>
      <p id={`${inputId}-help`} style={{ margin: '6px 2px 0', fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>
        {hint || 'A name needs 3 letters; an email, the whole address. People under 18 can’t be found.'}
      </p>

      {Array.isArray(rows) && (
        <div role="status" aria-live="polite" style={{ marginTop: 10 }}>
          {rows.length === 0 ? (
            <div style={{ background: NEUTRAL.white, border: `1px solid ${fieldLine}`, borderRadius: 14, padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
                {mode === 'email' ? 'No member uses that email yet.' : 'No one by that name. Try their @username, or the email they signed up with.'}
              </p>
              {mode === 'email' ? <InviteButton label="Invite them" color={color} style={{ marginTop: 10 }} /> : null}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '2px 0', background: NEUTRAL.white, border: `1px solid ${fieldLine}`, borderRadius: 14 }}>
              {rows.map((p) => {
                const can = !p.relation || p.relation === 'follows_you';
                const isBusy = following === p.user_id;
                return (
                  <li key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '6px 10px 6px 14px' }}>
                    <Face name={p.name} handle={p.handle || ''} avatar={p.avatar} cloth={p.cloth} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fs(14.5), fontWeight: 600, color: NEUTRAL.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontFamily: p.handle ? MONO : 'inherit', fontSize: fs(11.5), color: NEUTRAL.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.handle ? `@${p.handle}` : 'no @username yet'}
                      </div>
                    </div>
                    {can ? (
                      <button type="button" onClick={() => follow(p)} aria-disabled={isBusy || undefined} aria-busy={isBusy || undefined}
                        aria-label={`${p.relation === 'follows_you' ? 'Follow back' : 'Follow'} ${p.name}`}
                        style={{ flex: 'none', minHeight: 44, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, border: `1px solid ${isBusy ? fieldLine : color}`,
                          background: isBusy ? NEUTRAL.ivory : color, color: isBusy ? NEUTRAL.ink3 : NEUTRAL.white, fontSize: fs(13), fontWeight: 600, cursor: isBusy ? 'progress' : 'pointer' }}>
                        {isBusy ? <Loader2 size={16} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : <UserPlus size={16} strokeWidth={2} aria-hidden="true" focusable="false" />}
                        {p.relation === 'follows_you' ? 'Follow back' : 'Follow'}
                      </button>
                    ) : (
                      <span style={{ flex: 'none', minHeight: 44, padding: '0 12px', display: 'flex', alignItems: 'center', borderRadius: 12, border: `1px solid ${fieldLine}`, background: NEUTRAL.ivory, color: NEUTRAL.ink2, fontSize: fs(12.5), fontWeight: 600 }}>
                        {RELATION[p.relation] || 'Following'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
