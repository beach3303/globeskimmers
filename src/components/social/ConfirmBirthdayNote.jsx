// ConfirmBirthdayNote — what a 'confirm' account sees where a social feature
// would be (go-live decision 2, 2026-10-13): the worker holds those doors
// (403 confirm_birthday) until the birthday's month and day are in. Like
// TeenHoldNote, the honest front of a server rule; its button opens the
// one-time Confirm your birthday sheet (src/components/auth/ConfirmBirthday).
import React from 'react';
import { openConfirmBirthday } from '@/lib/ageGate';

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = '#16110D', INK2 = '#3A3128';
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

export default function ConfirmBirthdayNote({ className = '' }) {
  return (
    <div className={`rounded-[16px] px-4 py-3.5 ${className}`} style={{ background: '#FFFBF0', border: '1px solid #EAD9AE' }}>
      <div style={{ fontFamily: SERIF, fontSize: fs(17), color: INK, lineHeight: 1.2 }}>One thing first: your birthday</div>
      <p style={{ fontSize: fs(12.5), color: INK2, lineHeight: 1.45, marginTop: 4 }}>
        Following, postcards and stamps wait until we have the month and day of your birthday. Everything else works as usual.
      </p>
      <button type="button" onClick={openConfirmBirthday} aria-haspopup="dialog"
        className="mt-2.5 rounded-full px-4 font-semibold" style={{ minHeight: 44, background: INK, color: '#fff', fontSize: fs(13) }}>
        Confirm your birthday
      </button>
    </div>
  );
}
