// HomeRows — the "living homepage" carousels.
//
// Photo-forward horizontal rows assembled by the Worker's POST /home/rows from
// OWNED attraction data (D1) — zero Google Places spend. Themed by day-part /
// weather / season so the homepage reshuffles across the day.
//
// Self-contained: resolves the active location itself, fetches once per location
// change, and renders NOTHING when there's no owned coverage (cold-start) so the
// static finder tiles below stand alone — we never show an empty carousel.
//
// Interaction (matches the app): swipe a row SIDEWAYS to browse; "See all" (and
// a card tap) calls onAction(seeAll.action) — the same handleQuickAction the
// tiles use — to open the vertical finder page. Sideways → down/up.
import { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getSeason } from "@/lib/homeContext";
import { trackEvent } from "@/Layout";

function HomeRowCard({ card, onOpen, wide }) {
  const name = card.name || "Explore";
  const meta = [];
  if (card.rating) meta.push(`★ ${card.rating}`);
  if (Number.isFinite(card.distanceMiles)) meta.push(`${card.distanceMiles.toFixed(1)} mi`);
  else if (card.freeToVisit) meta.push("Free");

  return (
    <button
      onClick={onOpen}
      className={`flex-none ${wide ? "w-[190px]" : "w-[150px]"} rounded-2xl overflow-hidden bg-white text-left border`}
      style={{ borderColor: "#E6DFD0", boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}
    >
      <div className="w-full" style={{ aspectRatio: "4 / 3", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}>
        {card.photoUrl ? (
          <img src={card.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[28px]">📍</div>
        )}
      </div>
      <div className="p-2.5">
        <div
          className="font-serif leading-[1.1] text-[calc(15px*var(--fs))]"
          style={{ color: "#16302B", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {name}
        </div>
        {meta.length > 0 && (
          <div className="text-[calc(11px*var(--fs))] mt-1" style={{ color: "#71827D" }}>{meta.join(" · ")}</div>
        )}
        {card.photographer && (
          <div className="text-[calc(9.5px*var(--fs))] mt-1" style={{ color: "#97A6A0" }}>📷 {card.photographer} / Unsplash</div>
        )}
      </div>
    </button>
  );
}

export default function HomeRows({ onAction, wide = false }) {
  const { getActiveLocation, locationMode } = useLocation();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loc = getActiveLocation?.();
    const latitude = loc?.latitude ?? loc?.lat;
    const longitude = loc?.longitude ?? loc?.lng;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setRows([]);
      return;
    }
    // Location objects come in two shapes (GPS = {address:{city,country}}, picked
    // = top-level) — resolve both. Intent: present (live GPS) vs planning (picked).
    const city = loc?.address?.city || loc?.city || "";
    const country = loc?.address?.country || loc?.country || "";
    const intent = locationMode === "current" ? "present" : "planning";

    (async () => {
      try {
        const { data, error } = await callWorker(ROUTE.getHomeRows, {
          latitude,
          longitude,
          localHour: new Date().getHours(),
          season: getSeason(new Date(), latitude),
          cityName: city,
          countryName: country,
        });
        if (cancelled) return;
        const gotRows = !error && Array.isArray(data?.rows) ? data.rows : [];
        setRows(gotRows);
        // Demand signal: this user is active in / planning this city. Origin
        // country is derivable later via user_id → profile.home_country, so we
        // don't duplicate it here. Feeds trending rows + retargeting + B2B.
        trackEvent("home_rows_view", { city, country, intent, row_count: gotRows.length });
      } catch {
        if (!cancelled) setRows([]);
      }
    })();

    return () => { cancelled = true; };
  }, [getActiveLocation, locationMode]);

  if (!rows.length) return null;

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "flex flex-col gap-5" : "max-w-md mx-auto flex flex-col gap-4"}>
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex items-baseline justify-between mb-2 px-0.5 gap-3">
              <div className="min-w-0">
                <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: "#16302B" }}>{row.title}</div>
                {row.subtitle && (
                  <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: "#71827D" }}>{row.subtitle}</div>
                )}
              </div>
              {row.seeAll?.action && (
                <button
                  onClick={() => {
                    trackEvent("home_row_see_all", { row: row.key, action: row.seeAll.action });
                    onAction?.(row.seeAll.action);
                  }}
                  className="flex-none text-[calc(12.5px*var(--fs))] font-semibold"
                  style={{ color: "#17A38F" }}
                >
                  See all →
                </button>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
              {row.cards.map((card) => (
                <HomeRowCard
                  key={card.id}
                  card={card}
                  wide={wide}
                  onOpen={() => {
                    trackEvent("home_row_card_tap", {
                      row: row.key,
                      place_id: card.id,
                      place_name: card.name,
                      category: card.category,
                      city: card.city,
                      country: card.country,
                    });
                    onAction?.(row.seeAll?.action);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
