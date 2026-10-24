// messageLinks — text or share a postcard or telegram from your own phone (founder, 2026-10-24:
// "can we do send invitation via text message"). The worker keeps the card under a short code and
// hands back a ready message ("Erika (@erikakrista) sent you a postcard on GlobeSkimmers ✈️ Open it
// here: https://globeskimmers.io/m/K7Q2M9PA"); the phone's share sheet sends it — Messages,
// Messenger, WhatsApp, Viber — person to person, so no phone number ever reaches us. Whoever opens
// the link claims their own copy in the app (the page's globeskimmers://message/claim link, or the
// code typed in the Mailbox).
//
//   createLink({ kind: 'postcard', image, message, place_name, city, country, region, meta })
//   createLink({ kind: 'telegram', body, ink })   → { data: { code, url, text }, error }
//   shareText(text)   → 'shared' | 'copied' | 'cancelled' (throws on a real failure)
//   claimLink(code)   → { data: { kind, id, already }, error }
import { Capacitor } from '@capacitor/core';
import { callWorker } from '@/lib/callWorker';
import { requirePassport } from '@/lib/passportGate';

export async function createLink(payload) {
  if (!(await requirePassport())) return { data: null, error: 'finish_passport' };
  const { data, error } = await callWorker('links/create', payload || {});
  return { data, error: error || data?.error || null };
}

export async function shareText(text) {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ text, dialogTitle: 'Text or share it' });
      return 'shared';
    }
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
    if (navigator.clipboard) { await navigator.clipboard.writeText(text); return 'copied'; }
    return 'cancelled';
  } catch (e) {
    // Closing the sheet without picking anyone isn't a failure.
    if (e?.name === 'AbortError' || /cancel/i.test(String(e?.message || ''))) return 'cancelled';
    throw e;
  }
}

export async function claimLink(code) {
  const { data, error } = await callWorker('links/claim', { code: String(code || '') });
  return { data, error: error || data?.error || null };
}

// A code typed by hand (8 letters and numbers; spaces and dashes ignored) or a whole pasted link.
export const linkCodeOf = (v) => {
  const m = /\/m\/([A-Za-z0-9]{8})/.exec(String(v || ''));
  return (m ? m[1] : String(v || '')).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
};
