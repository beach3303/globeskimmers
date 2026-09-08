// DealRadarRow — "DEAL RADAR" (airline fare sales, straight from the source).
//
// A photo-less rail by design: these are TEXT deals — a fare sale is a headline
// and a deadline, so typography carries the card (Passport Standard serif/mono,
// no emoji, no stock photos pretending to be the deal). One /deals/list worker
// call on mount; the worker owns sourcing/freshness. Source honesty up front:
// deals are found on official airline pages and the details live on THEIRS —
// tapping a card records an attributed click (partner 'airline-direct' — no
// commission today; service over commission) then opens the airline's own page
// via openPartner. Building a trip from a deal is NOT this row's job — the
// DREAM-zone hero owns that CTA. Renders nothing when there are no deals, so
// the home feed never shows an empty shell.
//
// Contract consumed ({ deals }):
//   deals[]: { id, airline, url, headline, detail, destName, ends }
//   `ends` is a verbatim string from the airline's page — rendered as-is,
//   never reformatted (we don't parse dates we don't own).
import { useEffect, useState } from "react";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { trackAffiliateClick } from "@/lib/affiliate";
import { openPartner } from "@/lib/openPartner";
import { logDiscover } from "@/lib/logDiscover";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const CLAMP2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

export default function DealRadarRow() {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await callWorker(ROUTE.dealsList, {});
        if (cancelled) return;
        // Defensive: a card needs an airline, a headline, and somewhere to go.
        const list = (data?.deals || []).filter((d) => d && d.airline && d.headline && d.url);
        setDeals(list);
        if (list.length) logDiscover("deal_view", { count: list.length });
      } catch { if (!cancelled) setDeals([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Self-hide: no deals → no row at all (never an empty shell).
  if (!deals.length) return null;

  const openDeal = async (d) => {
    logDiscover("deal_tap", { airline: d.airline, headline: d.headline });
    let url = d.url;
    try {
      // 'airline-direct' pays nothing today — the click is tracked for the
      // funnel, and the traveler still gets the deal. Open the RETURNED url.
      url = await trackAffiliateClick({ partner: "airline-direct", targetUrl: d.url, category: "flight-deal", productName: d.headline, destCity: d.destName || "" });
    } catch { /* fall back to raw url */ }
    openPartner(url || d.url);
  };

  return (
    <div className="px-4 pb-3">
      <div className="max-w-md mx-auto">
        <div className="mb-2 px-0.5">
          <div className="text-[calc(10.5px*var(--fs))] font-semibold tracking-[0.08em]" style={{ fontFamily: MONO, color: SUB }}>DEAL RADAR</div>
          <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1] mt-0.5" style={{ color: INK }}>Fare sales, straight from the airlines</div>
          <div className="text-[calc(11px*var(--fs))] mt-0.5" style={{ fontFamily: MONO, color: SUB }}>Found on official airline pages — details on theirs</div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {deals.map((d) => (
            <div key={d.id || d.url} className="flex-none w-[280px] rounded-2xl bg-white overflow-hidden" style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}>
              <button onClick={() => openDeal(d)} className="block w-full text-left p-3">
                <div className="text-[calc(10.5px*var(--fs))] font-semibold uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: TEAL }}>{d.airline}</div>
                <div className="font-serif leading-[1.14] text-[calc(16.5px*var(--fs))] mt-1" style={{ color: INK, ...CLAMP2 }}>{d.headline}</div>
                {d.detail && <div className="text-[calc(12px*var(--fs))] mt-1" style={{ color: SUB, ...CLAMP2 }}>{d.detail}</div>}
                {/* `ends` is the airline's own wording, verbatim — never a reformatted date. */}
                {d.ends && <div className="text-[calc(11px*var(--fs))] mt-1 font-semibold" style={{ fontFamily: MONO, color: INK }}>{/^ends?\b/i.test(d.ends) ? d.ends : `Ends ${d.ends}`}</div>}
                <div className="text-[calc(10px*var(--fs))] mt-1.5 font-semibold" style={{ color: SUB }}>See the sale · {d.airline}</div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
