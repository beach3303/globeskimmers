// FrozenScreen — the whole app for an account whose birthday is under 13
// (founder, 2026-10-11: freeze at once, purge after 7 days, access-only
// appeal). Rendered by App.jsx in place of every route while the worker's age
// gate answers tier 'blocked'. Nothing on the account is shown to anyone; the
// worker's freezeSweep deletes it after FREEZE_PURGE_DAYS, or the person
// deletes it now. The appeal restores access only — it changes nothing else.
import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { showToast } from '@/components/Toast';

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = '#16110D', INK2 = '#3A3128', INK3 = '#736657', RULE = 'rgba(22,17,13,.12)';
const IVORY = '#FFFCF7', STAMP = '#B0472F';
const fs = (px) => `calc(${px}px * var(--fs, 1))`;
const APPEAL_TO = 'support@globeskimmers.io';

export default function FrozenScreen() {
  const { user, deleteAccount, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // The only address this screen shows is the support one (founder, 2026-10-11).
  // The account's own address rides in the unseen mail body so an appeal can be
  // matched to its account whatever address it is sent from.
  const email = user?.email || '';
  const appealHref = `mailto:${APPEAL_TO}?subject=${encodeURIComponent('Age appeal')}${email ? `&body=${encodeURIComponent(`GlobeSkimmers account: ${email}`)}` : ''}`;

  const erase = async () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    try { await deleteAccount(); showToast('Your account is deleted', 'success'); }
    catch (e) { setBusy(false); setConfirming(false); showToast(e?.message || "Couldn't delete right now — try again", 'error'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: IVORY }}>
      <div className="w-full max-w-md rounded-[18px] px-5 py-6" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
        <div className="uppercase" style={{ fontSize: fs(10), letterSpacing: '.2em', color: STAMP, fontWeight: 700 }}>Globeskimmers</div>
        <h1 style={{ fontFamily: SERIF, fontSize: fs(26), lineHeight: 1.1, color: INK, marginTop: 6 }}>GlobeSkimmers isn&rsquo;t available on this account</h1>
        <p style={{ fontSize: fs(14.5), lineHeight: 1.5, color: INK2, marginTop: 12 }}>
          The birthday on this account is under 13, so the account is frozen. Nothing on it is shown to anyone.
          In 7 days everything on it &mdash; stamps, photos, notes &mdash; is deleted for good. You can delete it now instead.
        </p>
        <button type="button" onClick={erase} disabled={busy}
          className="mt-5 w-full rounded-xl py-3 font-semibold disabled:opacity-60"
          style={{ background: confirming ? STAMP : '#fff', color: confirming ? '#fff' : STAMP, border: `1.5px solid ${STAMP}`, fontSize: fs(15) }}>
          {busy ? 'Deleting…' : confirming ? 'Yes, delete everything now' : 'Delete my account now'}
        </button>
        {confirming && !busy && (
          <button type="button" onClick={() => setConfirming(false)} className="mt-2 w-full py-2" style={{ fontSize: fs(13), color: INK3 }}>Keep it for now</button>
        )}
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${RULE}` }}>
          <p style={{ fontSize: fs(13), lineHeight: 1.5, color: INK2 }}>
            Entered the wrong birthday? Email <a href={appealHref} style={{ color: STAMP, textDecoration: 'underline' }}>{APPEAL_TO}</a> with the subject &ldquo;Age appeal&rdquo;.
            An appeal can only restore access &mdash; nothing else about the account changes.
          </p>
        </div>
        <button type="button" onClick={() => logout()} className="mt-4 w-full py-2" style={{ fontSize: fs(13.5), color: INK3, textDecoration: 'underline' }}>Sign out</button>
      </div>
    </div>
  );
}
