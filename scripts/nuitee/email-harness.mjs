// Nuitée booking-email harness — run: node scripts/nuitee/email-harness.mjs
// Imports the worker (as ESM) with the email functions exported, mocks Resend
// and LiteAPI (fetch) and puts a real SQLite (node:sqlite) behind env.DB so the
// json_set session patches and the one-writer booking claim are exercised for
// real. No network, no secrets. Node ≥ 22.
process.env.S ||= (await import('node:os')).tmpdir(); process.env.W ||= new URL('../../cloudflare-worker-v7.12.js', import.meta.url).pathname;
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const S = process.env.S, W = process.env.W;
const src = fs.readFileSync(W, 'utf8');
fs.writeFileSync(`${S}/worker-email.mjs`, src + '\nexport { sendEmail, nuiteeEmailConfirmation, nuiteeEmailCancellation, nuiteeEmailHotelCode, nuiteeSendBookingEmail, nuiteeEmailRange, nuiteeEmailDate, nuiteeEmailDeadline, nuiteeSessPatch, nuiteeEmailAddressOk };\n');
const m = await import(`${S}/worker-email.mjs`);
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL:', msg); } };
// ── real SQLite behind env.DB (json_set/json_remove exercised for real) ──
const db = new DatabaseSync(':memory:');
db.exec('create table nuitee_sessions (sid text primary key, user_id text, status text, env text, created integer, updated integer, data text)');
const sqlLog = [];
const DB = { prepare: (sql) => ({ bind: (...a) => ({ run: async () => { sqlLog.push({ sql, a, at: Date.now() }); const r = db.prepare(sql).run(...a); return { success: true, meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null }) }) };
const row = (sid) => JSON.parse(db.prepare('select data from nuitee_sessions where sid=?').get(sid).data);
const seed = (s) => { db.prepare("insert or replace into nuitee_sessions values (?,?,?,?,?,?,?)").run(s.sid, s.user_id || null, s.status || "booked", s.env || null, Date.now(), Date.now(), JSON.stringify(s)); return s; };
const kv = new Map();
const calls = [];
let fetchMode = 'ok', duringSend = null;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init, at: Date.now() });
  if (duringSend) { const f = duringSend; duringSend = null; await f(); }
  if (fetchMode === 'timeout') { const e = new Error('t'); e.name = 'TimeoutError'; throw e; }
  if (fetchMode === '429') return new Response(JSON.stringify({ name: 'rate_limit_exceeded', message: 'slow' }), { status: 429 });
  return new Response(JSON.stringify({ id: 'em_123' }), { status: 200 });
};
const env = {
  RESEND_API_KEY: 'k', DB,
  GLOBESKIMMERS_KV: { get: async (k) => (k.startsWith('nuitee:hotel:') ? { name: 'Kawada Hotel', address: '1231 W 8th St', city: 'Los Angeles', country: 'us', phone: '+1 213-555-0100', checkinCheckoutTimes: { checkin_start: '3:00 PM', checkout: '11:00 AM' } } : (kv.get(k) ?? null)), put: async (k, v) => { kv.set(k, v); } },
};
let n = 0;
const sess = (over = {}) => ({ sid: 'sid' + (++n), env: 'production', user_id: 'u' + n, status: 'booked', hotelId: 'lp1f63d', hotelName: 'Kawada <Hotel>', checkin: '2026-12-10', checkout: '2026-12-11', roomName: 'QUEEN ROOM,CITY VIEW', board: 'Room only', price: 117.83, currency: 'USD', refundable: true, cancelBy: '2026-12-08 10:00:00', cancelTz: 'GMT', adults: 2, children: 1, holder: { firstName: 'Maiza', lastName: '<b>Simeon', email: 'guest@example.com', phone: '' }, booking: { bookingId: 'PDdzItYUt', status: 'CONFIRMED', hotelConfirmationCode: null, hotelName: 'Kawada <Hotel>', price: 117.83, currency: 'USD', checkin: '2026-12-10', checkout: '2026-12-11', supplierBookingId: '14729602', createdAt: '2026-09-22T04:13:39Z' }, ...over });
const forbidden = /last 4|last four|ending in|card number|\*\*\*\*|refund processed|refund has been issued|no refund is due/i;

// ── address rule ──
ok(m.nuiteeEmailAddressOk('guest@example.com') && !m.nuiteeEmailAddressOk('a@b.c,evil@x.y') && !m.nuiteeEmailAddressOk('a@b@c.d') && !m.nuiteeEmailAddressOk('a <x@y.z>') && !m.nuiteeEmailAddressOk('x'.repeat(250) + '@a.bc'), 'address rule');

// ── sendEmail transport ──
let r = await m.sendEmail({}, { to: 'a@b.co', subject: 's', html: '<p>h</p>', text: 't' });
ok(r.ok === false && r.error === 'not_configured', 'no key → not_configured');
r = await m.sendEmail(env, { to: 'a@b.c,evil@x.y', subject: 's', html: 'h', text: 't' });
ok(r.ok === false && r.error === 'bad_recipient', 'comma list → bad recipient');
calls.length = 0;
r = await m.sendEmail(env, { to: 'guest@example.com', subject: 'Line1\nLine2', html: '<p>h</p>', text: 't', idempotencyKey: 'nuitee-X-confirmation', tag: 'confirmation', headers: { 'X-Entity-Ref-ID': 'nuitee-X-confirmation' } });
ok(r.ok && r.id === 'em_123', 'success returns id');
let body = JSON.parse(calls[0].init.body);
ok(calls[0].init.headers.Authorization === 'Bearer k' && calls[0].init.headers['Idempotency-Key'] === 'nuitee-X-confirmation', 'bearer + idempotency headers');
ok(body.from === 'GlobeSkimmers <bookings@globeskimmers.io>' && body.reply_to === 'founder@globeskimmers.io' && body.bcc?.[0] === 'founder@globeskimmers.io', 'from / reply_to / bcc');
ok(body.headers?.['X-Entity-Ref-ID'] === 'nuitee-X-confirmation', 'X-Entity-Ref-ID passed');
ok(body.subject === 'Line1 Line2' && calls[0].init.signal instanceof AbortSignal, 'subject newline-safe + timeout signal');
calls.length = 0;
r = await m.sendEmail(env, { to: 'Founder@globeskimmers.io', subject: 's', html: 'h', text: 't' });
ok(!JSON.parse(calls[0].init.body).bcc, 'no bcc when the founder is the recipient');
r = await m.sendEmail({ ...env, EMAIL_BCC: '' }, { to: 'g@x.co', subject: 's', html: 'h', text: 't' });
ok(!JSON.parse(calls[calls.length - 1].init.body).bcc, 'EMAIL_BCC="" switches the copy off');
fetchMode = 'timeout'; r = await m.sendEmail(env, { to: 'g@x.co', subject: 's', html: 'h', text: 't' }); ok(r.error === 'timeout', 'timeout');
fetchMode = '429'; r = await m.sendEmail(env, { to: 'g@x.co', subject: 's', html: 'h', text: 't' }); ok(r.error === 'rate_limit_exceeded' && r.status === 429, '429 named'); fetchMode = 'ok';

// ── dates ──
ok(m.nuiteeEmailRange('2026-12-10', '2026-12-11') === 'Dec 10–11, 2026' && m.nuiteeEmailRange('2026-12-30', '2027-01-02') === 'Dec 30, 2026 – Jan 2, 2027', 'ranges');
ok(m.nuiteeEmailDate('2026-12-10') === 'Thu, Dec 10, 2026', 'date');
ok(m.nuiteeEmailDeadline('2026-12-08 10:00:00', 'GMT') === 'Tue, Dec 8, 2026, 10:00 (GMT)', 'deadline with time+tz: ' + m.nuiteeEmailDeadline('2026-12-08 10:00:00', 'GMT'));
ok(m.nuiteeEmailDeadline('2026-12-08', null) === 'Tue, Dec 8, 2026', 'deadline date-only');
ok(m.nuiteeEmailDeadline('2026-12-08T10:00:00Z', null) === 'Tue, Dec 8, 2026, 10:00 (GMT)', 'deadline ISO no tz → GMT default');

// ── confirmation template ──
const hotel = { name: 'Kawada Hotel', address: '1231 W 8th St', city: 'Los Angeles', country: 'us', phone: '+1 213-555-0100', checkinCheckoutTimes: { checkin_start: '3:00 PM', checkout: '11:00 AM' } };
let t = m.nuiteeEmailConfirmation(sess(), hotel);
ok(t.subject === 'Confirmed: Kawada <Hotel> · Dec 10–11, 2026', 'confirmation subject');
ok(t.html.includes('Your stay is confirmed') && !t.html.includes('not confirmed it yet'), 'confirmed heading');
ok(!t.html.includes('Kawada <Hotel>') && t.html.includes('Kawada &lt;Hotel&gt;') && t.html.includes('&lt;b&gt;Simeon'), 'escaping');
ok(t.html.includes('PDdzItYUt') && t.text.includes('Booking ID: PDdzItYUt'), 'booking id');
ok(t.html.includes('1231 W 8th St, Los Angeles, US') && t.html.includes('tel:+12135550100') && t.html.includes('from 3:00 PM · out by 11:00 AM'), 'hotel record rows');
ok(t.html.includes('Queen Room · City View · Room only') && t.html.includes('2 adults, 1 child'), 'room + guests');
ok(t.html.includes('Free cancellation until Tue, Dec 8, 2026, 10:00 (GMT) — cancel from My Trips'), 'RFN line with deadline');
ok(t.html.includes('Booked on') && t.html.includes('Tue, Sep 22, 2026'), 'booked on row');
ok(t.html.includes('or by supplier reference 14729602') && t.html.includes("isn't in yet"), 'desk line without hotel code names supplier ref');
ok(t.text.includes("isn't in yet") && !/&#39;|&amp;/.test(t.text), 'text twin unescaped');
ok(t.html.includes('The Booking ID is what Nuitée and we use'), 'booking id explainer');
ok(t.html.includes('globeskimmers://trips?booking=PDdzItYUt') && t.html.includes('open the GlobeSkimmers app and go to My Trips'), 'deep link + text fallback');
ok(!forbidden.test(t.html) && !forbidden.test(t.text) && !/<style/.test(t.html), 'no forbidden copy / no style block');
t = m.nuiteeEmailConfirmation(sess(), null);
ok(!t.html.includes('Address') && !t.html.includes('Hotel phone') && !t.html.includes('Check-in / out'), 'no hotel rows without record');
t = m.nuiteeEmailConfirmation(sess({ refundable: false, cancelBy: null, booking: { ...sess().booking, hotelConfirmationCode: 'HC-77' } }), null);
ok(t.html.includes('Non-refundable — cancelling this rate does not refund it') && t.html.includes('hotel confirmation number HC-77') && t.html.includes('>HC-77<'), 'NRFN + hotel code');
t = m.nuiteeEmailConfirmation(sess({ booking: { ...sess().booking, status: 'PENDING' } }), null);
ok(t.subject.startsWith('Booking received:') && t.html.includes('Your booking is received') && t.html.includes('has not confirmed it yet') && !t.html.includes('Your stay is confirmed'), 'PENDING → received, never confirmed');

// ── cancellation template ──
const cx = (c) => m.nuiteeEmailCancellation(sess(), c);
t = cx({ at: '2026-09-22T18:00:00Z', status: 'CANCELLED', refund_amount: 117.83, cancellation_fee: 0, currency: 'USD' });
ok(t.subject === 'Cancelled: Kawada <Hotel> · Dec 10–11, 2026' && t.html.includes('$117.83 goes back to the card Nuitée charged.') && !t.html.includes('Cancellation fee'), 'refund stated');
ok(t.html.includes('Refunds usually show within 5–10 business days') && t.text.includes('reply to this email with your Booking ID'), 'timing line');
t = cx({ status: 'CANCELLED_WITH_CHARGES' });
ok(t.html.includes('Nuitée reports this cancellation carried charges. Any refund is set by Nuitée') && !t.html.includes('goes back'), 'charged, nothing stated');
t = cx({ status: 'CANCELLED_WITH_CHARGES', cancellation_fee: 117.83, currency: 'USD' });
ok(t.html.includes('carried a $117.83 fee. Any refund is set by Nuitée'), 'fee, refund unknown');
t = cx({ status: 'CANCELLED_WITH_CHARGES', refund_amount: 50, cancellation_fee: 67.83, currency: 'USD' });
ok(t.html.includes('carried a $67.83 fee. $50.00 goes back to the card'), 'partial');
t = cx({});
ok(t.html.includes('Nuitée refunds the card it charged; Nuitée confirms the amount.'), 'nothing stated');
ok(!forbidden.test(t.html) && !forbidden.test(t.text), 'cancel: no forbidden copy');

// ── hotel code ──
t = m.nuiteeEmailHotelCode(sess(), 'HC-99');
ok(t && t.subject.startsWith('Hotel confirmation number for') && t.html.includes('>HC-99<') && m.nuiteeEmailHotelCode(sess(), '') === null, 'hotel code email');

// ── nuiteeSessPatch against real SQLite ──
const p0 = seed(sess());
await m.nuiteeSessPatch(env, p0.sid, { '$.emails.confirmation': { id: 'x' }, '$.booking.hotelConfirmationCode': 'HC-1' });
let d = row(p0.sid);
ok(d.emails.confirmation.id === 'x' && d.booking.hotelConfirmationCode === 'HC-1' && d.holder.email === 'guest@example.com', 'patch creates parent + keeps the rest');
await m.nuiteeSessPatch(env, p0.sid, { '$.status': 'cancelled', '$.cancelIntent': null, '$.cancelled': { at: 'n' } }, 'cancelled');
d = row(p0.sid);
ok(d.status === 'cancelled' && d.cancelled.at === 'n' && !('cancelIntent' in d) && db.prepare('select status from nuitee_sessions where sid=?').get(p0.sid).status === 'cancelled', 'status column + json_remove');
await m.nuiteeSessPatch(env, p0.sid, { "$.x'; drop": 1 });
ok(row(p0.sid).x === undefined, 'non-identifier path ignored');

// ── orchestrator ──
calls.length = 0;
let rec = await m.nuiteeSendBookingEmail(env, null, seed(sess({ env: 'sandbox' })), 'confirmation');
ok(rec.skipped === 'sandbox' && calls.length === 0, 'sandbox never sends');
rec = await m.nuiteeSendBookingEmail(env, null, seed(sess({ holder: { email: '' } })), 'confirmation');
ok(rec.skipped === 'no_email' && calls.length === 0, 'no email → skipped');
rec = await m.nuiteeSendBookingEmail(env, null, seed(sess({ holder: { email: 'a@b.c,evil@x.y' } })), 'confirmation');
ok(rec.skipped === 'bad_address' && calls.length === 0, 'comma list → skipped bad_address');
rec = await m.nuiteeSendBookingEmail({ ...env, RESEND_API_KEY: '' }, null, seed(sess()), 'confirmation');
ok(rec.skipped === 'not_configured' && calls.length === 0, 'no key → skipped');
// rate limit
const rl = seed(sess()); kv.set(`nuitee:mail:${rl.user_id}:${new Date().toISOString().slice(0, 10)}`, '6');
rec = await m.nuiteeSendBookingEmail(env, null, rl, 'confirmation');
ok(rec.skipped === 'rate_limited' && calls.length === 0 && row(rl.sid).emails.confirmation.skipped === 'rate_limited', 'per-user cap');
// happy path with the lost-update scenario: a webhook writes the hotel code DURING the send
calls.length = 0; sqlLog.length = 0;
const o3 = seed(sess());
duringSend = async () => { await m.nuiteeSessPatch(env, o3.sid, { '$.booking.hotelConfirmationCode': 'HC-DURING' }); };
rec = await m.nuiteeSendBookingEmail(env, null, o3, 'confirmation');
ok(rec.id === 'em_123' && rec.to === 'guest@example.com' && rec.withCode === false && rec.confirmed === true, 'confirmation sent + recorded: ' + JSON.stringify(rec));
d = row(o3.sid);
ok(d.emails.confirmation.id === 'em_123' && d.booking.hotelConfirmationCode === 'HC-DURING', 'lost-update fixed: webhook write survives the email record');
const claim = sqlLog.find((q) => q.sql.includes('json_set') && /attemptedAt/.test(q.a[0]));
ok(claim && claim.at <= calls[0].at && !/"id"/.test(claim.a[0]), 'claim persisted BEFORE the send');
ok(calls[0].init.headers['Idempotency-Key'] === 'nuitee-PDdzItYUt-confirmation' && JSON.parse(calls[0].init.body).headers['X-Entity-Ref-ID'] === 'nuitee-PDdzItYUt-confirmation', 'idempotency + ref header');
ok(JSON.parse(calls[0].init.body).html.includes('1231 W 8th St'), 'hotel record from KV used');
ok(kv.get(`nuitee:mail:${o3.user_id}:${new Date().toISOString().slice(0, 10)}`) === '1', 'cap counter incremented');
const c0 = calls.length;
rec = await m.nuiteeSendBookingEmail(env, null, o3, 'confirmation');
ok(rec.id === 'em_123' && calls.length === c0, 'second call → prior, no send');
rec = await m.nuiteeSendBookingEmail(env, null, seed(sess({ emails: { confirmation: { attemptedAt: 'x', to: 'guest@example.com' } } })), 'confirmation');
ok(rec.attemptedAt === 'x' && calls.length === c0, 'in-flight claim blocks a duplicate');
// extra.hotel promise honoured, PENDING recorded confirmed:false
rec = await m.nuiteeSendBookingEmail(env, null, seed(sess({ booking: { ...sess().booking, status: 'PENDING' } })), 'confirmation', { hotel: Promise.resolve({ name: 'Prefetched', address: '9 Prefetch Rd' }) });
ok(rec.confirmed === false && JSON.parse(calls[calls.length - 1].init.body).subject.startsWith('Booking received:') && JSON.parse(calls[calls.length - 1].init.body).html.includes('9 Prefetch Rd'), 'PENDING + prefetched hotel');
// failure recorded
fetchMode = '429'; rec = await m.nuiteeSendBookingEmail(env, null, seed(sess()), 'confirmation'); fetchMode = 'ok';
ok(rec.error === 'rate_limit_exceeded' && !rec.id, 'failure recorded as error');
// cancellation + hotel_code kinds
const o6 = seed(sess({ cancelled: { status: 'CANCELLED', refund_amount: 117.83, currency: 'USD', at: '2026-09-22T18:00:00Z' } }));
rec = await m.nuiteeSendBookingEmail(env, null, o6, 'cancellation', { cancel: o6.cancelled });
ok(rec.id && JSON.parse(calls[calls.length - 1].init.body).subject.startsWith('Cancelled:') && row(o6.sid).emails.cancellation.id, 'cancellation via orchestrator');
rec = await m.nuiteeSendBookingEmail(env, null, seed(sess()), 'hotel_code', { code: 'HC-1' });
ok(rec.id && JSON.parse(calls[calls.length - 1].init.body).html.includes('HC-1'), 'hotel_code via orchestrator');


// ═══ Integration: the real handlers over SQLite + mocked LiteAPI/Resend ═══
const m2 = await (async () => {
  const p = `${S}/worker-email2.mjs`;
  fs.writeFileSync(p, src + '\nexport { handleNuiteeReturn, handleNuiteeWebhook, handleNuiteeStatus, nuiteeSessClaimBooking };\n');
  return import(p);
})();
db.exec('create table if not exists affiliate_clicks (subid text primary key, ts integer, user_id text, session_id text, intent text, persona text, partner text, product_id text, product_name text, category text, dest_country text, dest_city text, target_url text, converted integer, commission real, currency text, status text, converted_ts integer, checkin text, checkout text)');
const ienv = { ...env, NUITEE_API_KEY: 'liteapi-key', NUITEE_ENV: 'production', NUITEE_WEBHOOK_TOKEN: 'tok' };
let bookStatus = 'CONFIRMED', bookCalls = 0, bookSeq = 0, resendCalls = 0, bookDelayMs = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  calls.push({ url: u, init, at: Date.now() });
  if (u.includes('/rates/book')) {
    bookCalls++; bookSeq++;
    if (bookDelayMs) await new Promise((r) => setTimeout(r, bookDelayMs));
    const b = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: { bookingId: 'B' + bookSeq, status: bookStatus, hotel: { name: 'Kawada Hotel', hotelId: 'lp1f63d' }, price: 117.83, currency: 'USD', checkin: '2026-12-10', checkout: '2026-12-11', supplierBookingId: 'S1', createdAt: '2026-09-22T04:13:39Z', clientReference: b.clientReference } }), { status: 200 });
  }
  if (u.includes('api.resend.com')) { resendCalls++; return new Response(JSON.stringify({ id: 'em_' + resendCalls }), { status: 200 }); }
  return new Response('{}', { status: 404 });
};
const waits = [];
const ctx = { waitUntil: (p) => waits.push(p) };
const pendingSess = (over = {}) => seed({ sid: 'ab' + (++n), env: 'production', user_id: 'u' + n, status: 'pending', created: Date.now(), prebookId: 'pb1', offerId: 'off', transactionId: 'tx1', secretKey: 'sk', hotelId: 'lp1f63d', hotelName: 'Kawada Hotel', checkin: '2026-12-10', checkout: '2026-12-11', roomName: 'QUEEN ROOM', board: 'Room only', price: 117.83, currency: 'USD', refundable: true, cancelBy: '2026-12-08 10:00:00', cancelTz: 'GMT', adults: 2, children: 0, holder: { firstName: 'Maiza', lastName: 'Simeon', email: 'guest@example.com', phone: '' }, ...over });
const ret = async (sid) => { const r = await m2.handleNuiteeReturn(new Request(`https://w.test/hotels/nuitee/return?sid=${sid}`), ienv, ctx); return { status: r.status, html: await r.text() }; };

// claim semantics
const cl = pendingSess();
ok(await m2.nuiteeSessClaimBooking(ienv, cl.sid) === true, 'claim: pending → claimed');
ok(await m2.nuiteeSessClaimBooking(ienv, cl.sid) === false, 'claim: second claim refused');
db.prepare('update nuitee_sessions set updated=? where sid=?').run(Date.now() - 3 * 60 * 1000, cl.sid);
ok(await m2.nuiteeSessClaimBooking(ienv, cl.sid) === true, 'claim: stale booking claim re-taken');
db.prepare("update nuitee_sessions set status='booked' where sid=?").run(cl.sid);
ok(await m2.nuiteeSessClaimBooking(ienv, cl.sid) === false, 'claim: booked never re-claimed');

// happy path: book → record → email → page states the email
calls.length = 0; bookCalls = 0; resendCalls = 0;
const h1 = pendingSess({ user_id: null });
let pg = await ret(h1.sid);
ok(pg.status === 200 && pg.html.includes('Booking confirmed') && pg.html.includes('Confirmation sent to guest@example.com'), 'return page: booked + emailed line — got: ' + pg.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160));
ok(bookCalls === 1 && resendCalls === 1, 'one book, one email');
let rowH = row(h1.sid);
ok(rowH.status === 'booked' && rowH.emails.confirmation.id === 'em_1' && rowH.emails.confirmation.confirmed === true && db.prepare('select status from affiliate_clicks where product_id=?').get('B1').status === 'confirmed', 'D1: booked + email record + affiliate row');
ok(JSON.parse(calls.find((c) => c.url.includes('resend')).init.body).html.includes('1231 W 8th St'), 'prefetched hotel record reached the email');
// reload: nothing re-sent, line still shown from the record
pg = await ret(h1.sid);
ok(pg.html.includes('Confirmation sent to guest@example.com') && bookCalls === 1 && resendCalls === 1, 'reload: no re-book, no re-send, line from record');
// status endpoint contract
let st = await (await m2.handleNuiteeStatus(new Request('https://w.test/hotels/nuitee/status', { method: 'POST', body: JSON.stringify({ sid: h1.sid }) }), { ...ienv })).json();
ok(st.status === 'booked' && st.emailedTo === 'guest@example.com', 'status: emailedTo when confirmed email sent');

// concurrent double-GET while the book call is in flight
bookCalls = 0; resendCalls = 0; bookDelayMs = 150;
const h2 = pendingSess();
const [a, b] = await Promise.all([ret(h2.sid), new Promise((r) => setTimeout(r, 30)).then(() => ret(h2.sid))]);
ok(bookCalls === 1 && resendCalls === 1, 'double-GET: exactly one book + one email');
ok(row(h2.sid).status === 'booked' && row(h2.sid).emails.confirmation.id, 'double-GET: row stays booked with its email record');
ok(a.html.includes('Booking confirmed') && (b.html.includes('Finishing your booking') || b.html.includes('Booking confirmed')), 'double-GET: winner confirmed, loser waits or sees the result');
bookDelayMs = 0;
// 'booking' claim is reported to the app as pending
const h3 = pendingSess({ user_id: null });
await m2.nuiteeSessClaimBooking(ienv, h3.sid);
st = await (await m2.handleNuiteeStatus(new Request('https://w.test/hotels/nuitee/status', { method: 'POST', body: JSON.stringify({ sid: h3.sid }) }), ienv)).json();
ok(st.status === 'pending' && st.emailedTo === null, "status: 'booking' claim reads as pending");

// PENDING book status → "received" wording everywhere, emailedTo withheld
bookStatus = 'PENDING'; bookCalls = 0; resendCalls = 0; calls.length = 0;
const h4 = pendingSess({ user_id: null });
pg = await ret(h4.sid);
ok(pg.html.includes('Booking email sent to guest@example.com') && !pg.html.includes('Confirmation sent'), 'PENDING: page says booking email, not confirmation');
ok(JSON.parse(calls.find((c) => c.url.includes('resend')).init.body).subject.startsWith('Booking received:'), 'PENDING: email subject received');
st = await (await m2.handleNuiteeStatus(new Request('https://w.test/hotels/nuitee/status', { method: 'POST', body: JSON.stringify({ sid: h4.sid }) }), { ...ienv })).json();
ok(st.emailedTo === null, 'PENDING: status withholds emailedTo');
bookStatus = 'CONFIRMED';

// sandbox session: no email, no line
const h5 = pendingSess({ env: 'sandbox', transactionId: null, secretKey: null });
resendCalls = 0;
pg = await ret(h5.sid);
ok(pg.html.includes('Booking confirmed') && !pg.html.includes('sent to') && resendCalls === 0 && row(h5.sid).emails.confirmation.skipped === 'sandbox', 'sandbox: booked, nothing sent, nothing claimed');

// webhook: hotel number BEFORE our row exists → 503 retry, event not marked seen
const wh = (body, auth = 'Bearer tok') => m2.handleNuiteeWebhook(new Request('https://w.test/hotels/nuitee/webhook', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) }), ienv, ctx);
let wr = await wh({ event_id: 'e1', event_name: 'booking.book.hotelConfirmationNumber', response: JSON.stringify({ data: { bookingId: 'NOROW', hotelConfirmationCode: 'HC-1' } }) });
ok(wr.status === 503 && !kv.has('nuitee:wh:e1'), 'webhook: number before row → 503, not marked seen');
ok((await wh({ event_id: 'e0', event_name: 'booking.cancel' }, 'Bearer wrong')).status === 401, 'webhook: bad token → 401');
// … and after the row exists → applied, session patched, follow-up email once, then duplicate
resendCalls = 0;
wr = await wh({ event_id: 'e2', event_name: 'booking.book.hotelConfirmationNumber', response: JSON.stringify({ data: { bookingId: 'B1', hotelConfirmationCode: 'HC-1' } }) });
await Promise.all(waits.splice(0));
ok(wr.status === 200 && (await wr.json()).applied === 'booking.book.hotelConfirmationNumber', 'webhook: number applied');
rowH = row(h1.sid);
ok(rowH.booking.hotelConfirmationCode === 'HC-1' && rowH.emails.confirmation.id === 'em_1' && rowH.emails.hotel_code?.id && resendCalls === 1, 'webhook: code patched in, confirmation record intact, one follow-up email');
wr = await wh({ event_id: 'e2', event_name: 'booking.book.hotelConfirmationNumber', response: JSON.stringify({ data: { bookingId: 'B1', hotelConfirmationCode: 'HC-1' } }) });
ok((await wr.json()).duplicate === true, 'webhook: replay → duplicate');

// webhook cancel: external cancel emails; in-app intent (fresh) leaves it to the handler
resendCalls = 0;
wr = await wh({ event_id: 'e3', event_name: 'booking.cancel', response: JSON.stringify({ data: { bookingId: 'B1', status: 'CANCELLED', refund_amount: 117.83, currency: 'USD' } }) });
await Promise.all(waits.splice(0));
rowH = row(h1.sid);
ok(rowH.status === 'cancelled' && rowH.cancelled.via === 'booking.cancel' && rowH.emails.cancellation?.id && resendCalls === 1, 'webhook: external cancel → status + one notice');
const h6 = row(h2.sid);
await m.nuiteeSessPatch(ienv, h2.sid, { '$.cancelIntent': { at: new Date().toISOString() } });
resendCalls = 0;
wr = await wh({ event_id: 'e4', event_name: 'booking.cancel', response: JSON.stringify({ data: { bookingId: h6.booking.bookingId, status: 'CANCELLED' } }) });
await Promise.all(waits.splice(0));
ok(row(h2.sid).status === 'cancelled' && !row(h2.sid).emails.cancellation && resendCalls === 0, 'webhook: in-app intent → status synced, notice left to the handler');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
