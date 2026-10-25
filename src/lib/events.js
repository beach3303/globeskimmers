// What's on (founder, 2026-10-25: Events & festivals in Nearby services). The worker's
// /events/whats-on, the time windows the Events page asks for, and the ticket-tap count.
//
//   EV_KINDS                       the nine kinds, in the founder's order
//   eventWindow(when)              { from, to } local days: today | weekend | week | month
//   whatsOn({ lat, lng, city, country, cc, when, q })  → { from, to, events, festivals, holidays,
//                                  markets, family, error }
//   trackEventTap(item, link)      logs event_ticket_click (link: tickets | official | search | maps)
import { callWorker } from "@/lib/callWorker";
import { logEvent } from "@/lib/analytics";

export const EV_KINDS = [
  { id: "festivals", label: "Festivals" },
  { id: "fairs", label: "Fairs" },
  { id: "kids", label: "Kids & families" },
  { id: "music", label: "Music" },
  { id: "stage", label: "Stage" },
  { id: "games", label: "Games" },
  { id: "free", label: "Free" },
  { id: "markets", label: "Markets" },
  { id: "holidays", label: "Holidays" },
];
export const EV_WHEN = [
  { id: "today", label: "Today" },
  { id: "weekend", label: "This weekend" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// "This weekend" on a Friday includes Friday; Monday to Thursday it's the coming Saturday and Sunday.
export function eventWindow(when, now = new Date()) {
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const wd = d0.getDay();
  if (when === "today") return { from: iso(d0), to: iso(d0) };
  if (when === "weekend") {
    if (wd === 0) return { from: iso(d0), to: iso(d0) };
    if (wd === 5 || wd === 6) return { from: iso(d0), to: iso(add(d0, 7 - wd)) };
    return { from: iso(add(d0, 6 - wd)), to: iso(add(d0, 7 - wd)) };
  }
  if (when === "week") return { from: iso(d0), to: iso(add(d0, 6)) };
  return { from: iso(d0), to: iso(add(d0, 29)) };
}

export async function whatsOn({ lat, lng, city = null, country = null, cc = null, when = "weekend", q = "" }) {
  const w = q ? eventWindow("month") : eventWindow(when);
  const { data, error } = await callWorker("events/whats-on", { lat, lng, city, country, cc, ...w, ...(q ? { q } : {}) });
  const list = (k) => (Array.isArray(data?.[k]) ? data[k] : []);
  return { from: data?.from || w.from, to: data?.to || w.to, events: list("events"), festivals: list("festivals"), holidays: list("holidays"), markets: list("markets"), family: list("family"), error: error || data?.error || null };
}

export function trackEventTap(item, link) {
  logEvent("event_ticket_click", {
    event_id: item?.id || null, name: item?.name || null, kind: Array.isArray(item?.kinds) ? item.kinds[0] : null, link,
    source: item?.source || null, city: item?.city || null, state: item?.state || null, country: item?.country || null,
  }, "Events");
}
