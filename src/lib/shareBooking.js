// shareBooking — the one way a booking leaves the app as text. Mirrors the
// PassportBook share path (navigator.share when the platform has it, else
// clipboard + "Copied — paste it anywhere" toast; PassportBook.jsx ~:368).
//
// REDACTED BY CONSTRUCTION: the share text carries only what a travel
// companion needs — place name, stay dates, city, the address (plus a maps
// link) when the booking payload actually has one, and party size. It NEVER
// includes a confirmation code / booking id, any amount paid, or the holder's
// contact details. Callers must build the payload from those display fields
// only; this module has no access to the raw booking row on purpose.
import { showToast } from "@/components/Toast";

// Same maps-link shape the app already uses (see src/lib/vibeBundles.js).
const mapsLink = (q) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

// payload: { name, dates, city, address, partySize } — every field optional;
// absent fields are simply left out (honest UX — never fabricate a line).
export function buildBookingShareText({ name, dates, city, address, partySize } = {}) {
  const lines = [];
  if (name) lines.push(String(name));
  if (dates) lines.push(String(dates));
  if (city) lines.push(String(city));
  if (partySize) lines.push(String(partySize));
  if (address) {
    lines.push(String(address));
    lines.push(mapsLink(String(address)));
  }
  return lines.join("\n");
}

export async function shareBooking(payload) {
  const text = buildBookingShareText(payload);
  if (!text) {
    showToast("Nothing to share for this booking", "error");
    return;
  }
  if (navigator.share) {
    // Native/web share sheet. A rejected promise here is the traveler
    // cancelling the sheet — no-op, no toast (same as PassportBook).
    try { await navigator.share({ title: payload?.name || "Trip details", text }); } catch { /* cancelled */ }
    return;
  }
  try {
    if (!navigator.clipboard) {
      showToast("Sharing isn't available on this device", "error");
      return;
    }
    await navigator.clipboard.writeText(text);
    showToast("Copied — paste it anywhere", "success");
  } catch {
    showToast("Sharing isn't available on this device", "error");
  }
}
