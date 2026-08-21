// MyTripCard — a compact Home banner into the My Trip hub. Renders NOTHING until
// the signed-in user actually has saved bookings (>=1 affiliate tap), so it never
// clutters a fresh home. Taps route to the full MyTrip page.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";

const INK = "#16302B", SUB = "#71827D", EDGE = "#E6DFD0";

function itemEmoji(cat, partner) {
  const c = (cat || "").toLowerCase(), p = (partner || "").toLowerCase();
  if (/hotel|stay/.test(c) || ["stay22", "booking", "agoda"].includes(p)) return "🏨";
  if (/event|concert|ticket|show|theatre|theater|game|sport/.test(c) || ["ticketmaster", "vividseats", "fever", "stubhub"].includes(p)) return "🎫";
  if (/car|rental/.test(c) || p === "discovercars") return "🚗";
  if (/transfer|ride|pickup|shuttle/.test(c) || ["welcomepickups", "kiwitaxi"].includes(p)) return "🚕";
  if (/esim|sim|data|internet/.test(c) || p === "airalo") return "📶";
  if (/storage|luggage|bag/.test(c) || p === "radicalstorage") return "🧳";
  if (/shop/.test(c)) return "🛍️";
  return "🎟️";
}

export default function MyTripCard({ wide = false }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await callWorker(ROUTE.affiliateMine, {});
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : []);
      } catch { if (!cancelled) setItems([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!items.length) return null;

  const n = items.length;
  const chips = Array.from(new Set(items.slice(0, 10).map((it) => itemEmoji(it.category, it.partner)))).slice(0, 5);

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <button
          onClick={() => navigate(createPageUrl("MyTrip"))}
          className="w-full text-left rounded-2xl p-3.5 bg-white flex items-center gap-3 transition-colors hover:bg-black/[0.02]"
          style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-none text-[22px]" style={{ background: "#EAE0FA" }}>🧳</div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-[calc(17px*var(--fs))] leading-tight" style={{ color: INK }}>Your trip</div>
            <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: SUB }}>
              {n} {n === 1 ? "item" : "items"} saved · pick up where you left off
            </div>
          </div>
          <div className="flex-none flex items-center gap-1 text-[16px]" aria-hidden="true">
            {chips.map((c, i) => <span key={i}>{c}</span>)}
          </div>
        </button>
      </div>
    </div>
  );
}
