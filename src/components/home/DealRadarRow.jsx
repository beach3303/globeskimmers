// DealRadarRow — "DEAL RADAR" (sales, straight from the source).
//
// A photo-less rail by design: these are TEXT deals — a sale is a headline and
// a deadline, so typography carries the card (Passport Standard serif/mono, no
// emoji, no stock photos pretending to be the deal). One /deals/list worker
// call on mount; the worker owns sourcing/freshness. Source honesty up front:
// deals are found on official airline / cruise-line / rental pages and the
// details live on THEIRS — tapping a card records an attributed click (partner
// '<kind>-direct' — no commission today; service over commission) then opens
// the brand's own page via openPartner. Building a trip from a deal is NOT this
// row's job — the DREAM-zone hero owns that CTA (Phase 2 may add a trip panel).
// Renders nothing when there are no deals, so the home feed never shows an
// empty shell.
//
// Contract consumed ({ deals }) — v2, read defensively:
//   deals[]: { id, kind, brand, airline, url, headline, detail, destName, ends }
//   `kind`  : 'flight' | 'cruise' | 'car'. Absent (v1 worker) → 'flight'.
//   `brand` : display name. Absent (v1 worker) → `airline`.
//   `airline` is kept by the worker for back-compat; we never require it.
//   `ends` is a verbatim string from the source page — rendered as-is,
//   never reformatted (we don't parse dates we don't own).
import { useEffect, useMemo, useState } from "react";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { trackAffiliateClick } from "@/lib/affiliate";
import { openPartner } from "@/lib/openPartner";
import { logDiscover } from "@/lib/logDiscover";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const CLAMP2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

// Kind registry — the only place a kind's chip label, card tag, and attribution
// strings live. Order here is chip order. Unknown kinds coerce to 'flight'.
const KINDS = {
  flight: { chip: "Flights", tag: "FLIGHT SALE",  partner: "airline-direct", category: "flight-deal" },
  cruise: { chip: "Cruises", tag: "CRUISE OFFER", partner: "cruise-direct",  category: "cruise-deal" },
  car:    { chip: "Cars",    tag: "CAR OFFER",    partner: "car-direct",     category: "car-deal" },
};
const KIND_ORDER = ["flight", "cruise", "car"];

// Normalize one deal from the worker payload — v2 fields with v1 fallbacks.
// Returns null when the card would have nothing to show or nowhere to go.
function normalizeDeal(d) {
  if (!d || !d.headline || !d.url) return null;
  const brand = (typeof d.brand === "string" && d.brand.trim()) || (typeof d.airline === "string" && d.airline.trim()) || "";
  if (!brand) return null;
  const kind = KINDS[d.kind] ? d.kind : "flight";
  return { ...d, brand, kind };
}

export default function DealRadarRow() {
  const [deals, setDeals] = useState([]);
  const [active, setActive] = useState(""); // "" = All

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await callWorker(ROUTE.dealsList, {});
        if (cancelled) return;
        const list = (data?.deals || []).map(normalizeDeal).filter(Boolean);
        setDeals(list);
        if (list.length) {
          const kinds = { flight: 0, cruise: 0, car: 0 };
          for (const d of list) kinds[d.kind] += 1;
          logDiscover("deal_view", { count: list.length, kinds });
        }
      } catch { if (!cancelled) setDeals([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Honest chips: a kind renders ONLY when it has at least one deal — no dead
  // tabs. 'All' leads. Chips are hidden entirely when only one kind is present
  // (a single filter that can't change anything is noise, not navigation).
  const chips = useMemo(() => {
    const present = KIND_ORDER.filter((k) => deals.some((d) => d.kind === k));
    if (present.length < 2) return [];
    return [{ id: "", label: "All" }, ...present.map((k) => ({ id: k, label: KINDS[k].chip }))];
  }, [deals]);

  // Self-hide: no deals → no row at all (never an empty shell).
  if (!deals.length) return null;

  // If the active kind vanished (worker refresh), fall back to All rather than
  // render an empty rail.
  const activeKind = active && deals.some((d) => d.kind === active) ? active : "";
  const shown = activeKind ? deals.filter((d) => d.kind === activeKind) : deals;

  const pickKind = (id) => {
    if (id === active) return;
    setActive(id);
    logDiscover("deal_kind_filter", { kind: id || "all" });
  };

  const openDeal = async (d) => {
    const meta = KINDS[d.kind];
    logDiscover("deal_tap", { kind: d.kind, brand: d.brand, airline: d.airline || d.brand, headline: d.headline });
    let url = d.url;
    try {
      // '<kind>-direct' pays nothing today — the click is tracked for the
      // funnel, and the traveler still gets the deal. Open the RETURNED url.
      url = await trackAffiliateClick({ partner: meta.partner, targetUrl: d.url, category: meta.category, productName: d.headline, destCity: d.destName || "" });
    } catch { /* fall back to raw url */ }
    openPartner(url || d.url);
  };

  return (
    <div className="px-4 pb-3">
      <div className="max-w-md mx-auto">
        <div className="mb-2 px-0.5">
          <div className="text-[calc(10.5px*var(--fs))] font-semibold tracking-[0.08em]" style={{ fontFamily: MONO, color: SUB }}>DEAL RADAR</div>
          <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1] mt-0.5" style={{ color: INK }}>Sales, straight from the source</div>
          <div className="text-[calc(11px*var(--fs))] mt-0.5" style={{ fontFamily: MONO, color: SUB }}>Found on official airline, cruise-line and rental pages — details on theirs</div>
        </div>

        {/* Kind chips — mono small-caps feel; active = teal fill. Only kinds with deals. */}
        {chips.length > 0 && (
          <div className="flex gap-2 overflow-x-auto mb-2.5 pb-1" style={{ scrollbarWidth: "none" }}>
            {chips.map((b) => {
              const on = activeKind === b.id;
              return (
                <button
                  key={b.id || "all"}
                  onClick={() => pickKind(b.id)}
                  aria-pressed={on}
                  className="flex-none rounded-full px-3 py-1.5 font-mono uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold"
                  style={on ? { background: TEAL, color: "#fff" } : { background: "#fff", color: INK, border: `1px solid ${EDGE}` }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {shown.map((d) => (
            <div key={d.id || d.url} className="flex-none w-[280px] rounded-2xl bg-white overflow-hidden" style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}>
              <button onClick={() => openDeal(d)} className="block w-full text-left p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-[calc(10.5px*var(--fs))] font-semibold uppercase tracking-[0.08em] truncate" style={{ fontFamily: MONO, color: TEAL }}>{d.brand}</div>
                  <div className="flex-none text-[calc(9px*var(--fs))] font-semibold tracking-[0.08em] rounded px-1.5 py-0.5" style={{ fontFamily: MONO, color: SUB, border: `1px solid ${EDGE}` }}>{KINDS[d.kind].tag}</div>
                </div>
                <div className="font-serif leading-[1.14] text-[calc(16.5px*var(--fs))] mt-1" style={{ color: INK, ...CLAMP2 }}>{d.headline}</div>
                {d.detail && <div className="text-[calc(12px*var(--fs))] mt-1" style={{ color: SUB, ...CLAMP2 }}>{d.detail}</div>}
                {/* `ends` is the source's own wording, verbatim — never a reformatted date. */}
                {d.ends && <div className="text-[calc(11px*var(--fs))] mt-1 font-semibold" style={{ fontFamily: MONO, color: INK }}>{/^ends?\b/i.test(d.ends) ? d.ends : `Ends ${d.ends}`}</div>}
                <div className="text-[calc(10px*var(--fs))] mt-1.5 font-semibold" style={{ color: SUB }}>See the sale · {d.brand}</div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
