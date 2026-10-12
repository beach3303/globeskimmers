// TeenHoldNote — what a 13–17 account sees where a social feature would be
// (founder, 2026-10-11: social off under 18; the passport itself is untouched).
// The worker refuses the same doors with 403 teen_hold, so this is the honest
// front of a server rule, not the rule itself.
import React from 'react';

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = '#16110D', INK2 = '#3A3128';
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

export default function TeenHoldNote({ className = '' }) {
  return (
    <div className={`rounded-[16px] px-4 py-3.5 ${className}`} style={{ background: '#FFFBF0', border: '1px solid #EAD9AE' }}>
      <div style={{ fontFamily: SERIF, fontSize: fs(17), color: INK, lineHeight: 1.2 }}>Social features open at 18</div>
      <p style={{ fontSize: fs(12.5), color: INK2, lineHeight: 1.45, marginTop: 4 }}>
        Your passport stays yours, private &mdash; every stamp, photo and note is only ever yours.
        Following, postcards, public pages and guestbook posts unlock on your 18th birthday.
      </p>
    </div>
  );
}
