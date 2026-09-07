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
import { useNavigate } from "react-router-dom";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getSeason } from "@/lib/homeContext";
import { trackEvent } from "@/Layout";
import { createPageUrl } from "@/utils";
import MapAppSelector from "@/components/MapAppSelector";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import DreamGallery from "@/components/home/DreamGallery";
import useHorizontalSwipe from "@/lib/useHorizontalSwipe";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// whereToNext cards carry country only inside `whyVisit` ("City, Country") —
// the worker sends no `country` field on this row, so derive it client-side.
function parseDreamCountry(whyVisit) {
  const parts = String(whyVisit || "").split(",");
  return parts.length > 1 ? parts.slice(1).join(",").trim() : "";
}

// DREAMER'S CORNER card — EventsRow's dated-card size (photo-led w-[300px]),
// not the small HomeRowCard: this row sells the dream, so the photo is big.
function DreamerCornerCard({ card, country, onOpen, wide }) {
  return (
    <button
      onClick={onOpen}
      className={`flex-none ${wide ? "w-[320px]" : "w-[300px]"} rounded-2xl overflow-hidden bg-white text-left`}
      style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}
    >
      <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}>
        {card.photoUrl ? (
          <img src={card.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-serif text-[calc(34px*var(--fs))]" style={{ color: "rgba(255,255,255,0.85)" }}>
            {(card.name || "?").charAt(0)}
          </div>
        )}
        {card.photoUrl && (card.credit || card.photographer) && (
          <div
            className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[calc(8px*var(--fs))] leading-none"
            style={{ background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)" }}
          >
            {card.credit || card.photographer}
          </div>
        )}
      </div>
      <div className="p-3">
        <div
          className="font-serif leading-[1.14] text-[calc(16px*var(--fs))]"
          style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {card.name || "Explore"}
        </div>
        {country && (
          <div
            className="mt-1 truncate uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold"
            style={{ fontFamily: MONO, color: SUB }}
          >
            {country}
          </div>
        )}
      </div>
    </button>
  );
}

// End-of-rail "Dream anywhere" card — a typed doorway into DreamGallery. No
// fetch here: the gallery's own honest-empty state answers nonsense input.
function DreamAnywhereCard({ wide, value, onChange, onSubmit }) {
  return (
    <div
      className={`flex-none ${wide ? "w-[320px]" : "w-[300px]"} rounded-2xl p-4 flex flex-col justify-center gap-2.5`}
      style={{ border: `1.5px dashed ${EDGE}`, background: "#FBF6EC" }}
    >
      <div className="font-serif text-[calc(18px*var(--fs))] leading-tight" style={{ color: INK }}>
        Dream anywhere
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        placeholder="Type a country…"
        className="w-full rounded-xl px-3 py-2 text-[calc(12px*var(--fs))] bg-white"
        style={{ fontFamily: MONO, color: INK, border: `1px solid ${EDGE}`, outline: "none" }}
      />
      <button
        onClick={onSubmit}
        className="self-start uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold underline underline-offset-2"
        style={{ fontFamily: MONO, color: TEAL }}
      >
        See photos
      </button>
    </div>
  );
}

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
      <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}>
        {card.photoUrl ? (
          <img src={card.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[28px]">📍</div>
        )}
        {card.photoUrl && (card.credit || card.photographer) && (
          <div
            className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[calc(8px*var(--fs))] leading-none"
            style={{ background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)" }}
          >
            {card.credit || card.photographer}
          </div>
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
      </div>
    </button>
  );
}

export default function HomeRows({ onAction, wide = false }) {
  const { getActiveLocation, locationMode } = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);     // attraction opened full-screen
  const [dirsCard, setDirsCard] = useState(null); // attraction to route to (Waze/Apple/Google chooser)
  const [modalPhotos, setModalPhotos] = useState([]); // [{url, credit}] for the quick-look modal
  const [modalIdx, setModalIdx] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false); // fullscreen viewer over the modal
  // DREAMER'S CORNER → DreamGallery. { dest: {name, country, lat, lng}, card|null };
  // card kept so the gallery's "View details" can reopen the quick-look modal.
  const [dream, setDream] = useState(null);
  const [dreamQuery, setDreamQuery] = useState(""); // "Dream anywhere" input — persists across gallery opens

  // Swipe the modal's hero photo left/right through the loaded photos.
  const heroSwipe = useHorizontalSwipe({
    onLeft: () => setModalIdx((i) => (modalPhotos.length ? (i + 1) % modalPhotos.length : i)),
    onRight: () => setModalIdx((i) => (modalPhotos.length ? (i - 1 + modalPhotos.length) % modalPhotos.length : i)),
  });

  // Open the quick-look modal + enrich it with owned Wikimedia photos (swipeable).
  const openDetail = (card) => {
    setDetail(card);
    setModalIdx(0);
    setGalleryOpen(false);
    setModalPhotos(card.photoUrl ? [{ url: card.photoUrl, credit: card.credit || card.photographer || "" }] : []);
    if (card.name && Number.isFinite(card.lat)) {
      callWorker("places/wiki-photos", { name: card.name, lat: card.lat, lng: card.lng })
        .then(({ data }) => {
          const wp = data && Array.isArray(data.photos) ? data.photos : [];
          if (wp.length) setModalPhotos(wp.map((p) => ({ url: p.url, credit: [[p.credit, p.license].filter(Boolean).join(" · "), "Wikimedia"].filter(Boolean).join(" / ") })));
        })
        .catch(() => {});
    }
  };

  // DREAMER'S CORNER card tap → DreamGallery (photo immersion), not the modal.
  // Cards on this row carry no lat/lng/country fields — country is parsed from
  // whyVisit, coords stay undefined (SmartPackages degrades to typed search).
  const openDreamCard = (card) => {
    const country = parseDreamCountry(card.whyVisit);
    trackEvent("home_row_card_tap", { row: "whereToNext", place_id: card.id, place_name: card.name, country });
    setDream({ dest: { name: card.name, country, lat: card.lat, lng: card.lng }, card });
  };

  const openDreamAnywhere = () => {
    const q = dreamQuery.trim();
    if (!q) return;
    trackEvent("dreamer_corner_anywhere", { query: q });
    setDream({ dest: { name: q, country: "" }, card: null });
  };

  // Open the FULL attraction page (address, hours, gallery, directions, map, AI
  // tips) — reuses ActivityDetail, which reads the attraction from sessionStorage.
  const openFullPage = (card) => {
    try {
      const loc = getActiveLocation?.();
      const activity = {
        id: card.id,
        name: card.name,
        category: card.category,
        photos: Array.isArray(card.photos) && card.photos.length ? card.photos : (card.photoUrl ? [card.photoUrl] : []),
        description: card.whyVisit || "",
        address: card.address || "",
        latitude: card.lat,
        longitude: card.lng,
        rating: card.rating,
        free_to_visit: card.freeToVisit,
        distance_km: Number.isFinite(card.distanceMiles) ? +(card.distanceMiles * 1.60934).toFixed(1) : undefined,
        // Stamps earned from this page carry their country (passport "countries"
        // count, GPS-vs-IP check) and the per-row stamp radius override — pass
        // them through whenever the worker card has them.
        city: card.city || undefined,
        region: card.region || card.state || undefined,
        country: card.country || undefined,
        countryCode: card.countryCode || card.cc || undefined,
        footprint_radius_m: card.footprint_radius_m ?? card.footprintRadiusM ?? undefined,
      };
      sessionStorage.setItem("current_activity", JSON.stringify(activity));
      if (loc) sessionStorage.setItem("activity_location", JSON.stringify(loc));
      trackEvent("home_row_open_detail", { place_id: card.id, place_name: card.name });
      setDetail(null);
      // ?id= makes the page deep-linkable/shareable; sessionStorage stays the fast path.
      navigate(createPageUrl("ActivityDetail") + "?id=" + encodeURIComponent(activity.id));
    } catch {
      setDetail(null);
      onAction?.("Things to Do"); // safe fallback to the finder list
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loc = getActiveLocation?.();
    // Active-location shape stores coords NESTED (coordinates.latitude) — same as
    // every finder (PlacesToEat/Coffee/FindAHotel). Keep top-level fallbacks for
    // any picked/search shape that flattens them.
    const latitude = loc?.coordinates?.latitude ?? loc?.latitude ?? loc?.lat;
    const longitude = loc?.coordinates?.longitude ?? loc?.longitude ?? loc?.lng;
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

  // Active location = the directions origin (user's current/selected spot).
  const activeLoc = getActiveLocation?.();
  const activeLat = activeLoc?.coordinates?.latitude ?? activeLoc?.latitude ?? activeLoc?.lat;
  const activeLng = activeLoc?.coordinates?.longitude ?? activeLoc?.longitude ?? activeLoc?.lng;

  return (
    <>
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "flex flex-col gap-5" : "max-w-md mx-auto flex flex-col gap-4"}>
        {rows.map((row) => {
          // whereToNext renders as DREAMER'S CORNER — its own header (the
          // worker-baked title/subtitle strings are ignored), EventsRow-sized
          // photo cards, DreamGallery on tap, and a "Dream anywhere" tail card.
          const isDream = row.key === "whereToNext";
          return (
          <div key={row.key}>
            <div className="flex items-baseline justify-between mb-2 px-0.5 gap-3">
              <div className="min-w-0">
                {isDream ? (
                  <>
                    <div className="uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold" style={{ fontFamily: MONO, color: SUB }}>
                      DREAMER'S CORNER
                    </div>
                    <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1] mt-0.5" style={{ color: INK }}>
                      Places to dream about
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: "#16302B" }}>{row.title}</div>
                    {row.subtitle && (
                      <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: "#71827D" }}>{row.subtitle}</div>
                    )}
                  </>
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
              {isDream ? (
                <>
                  {row.cards.map((card) => (
                    <DreamerCornerCard
                      key={card.id}
                      card={card}
                      country={parseDreamCountry(card.whyVisit)}
                      wide={wide}
                      onOpen={() => openDreamCard(card)}
                    />
                  ))}
                  <DreamAnywhereCard wide={wide} value={dreamQuery} onChange={setDreamQuery} onSubmit={openDreamAnywhere} />
                </>
              ) : (
                row.cards.map((card) => (
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
                      openDetail(card); // open THIS attraction (quick-look modal)
                    }}
                  />
                ))
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>

    {detail && (
      <div
        onClick={() => setDetail(null)}
        className="fixed inset-0 z-[9999] overflow-y-auto"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto my-8 bg-white rounded-3xl overflow-hidden"
          style={{ width: "92%", maxWidth: 480 }}
        >
          <div
            className="relative cursor-pointer"
            style={{ aspectRatio: "16 / 10", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}
            {...heroSwipe}
            onClick={() => { if (modalPhotos[modalIdx]?.url || detail.photoUrl) setGalleryOpen(true); }}
          >
            {(modalPhotos[modalIdx]?.url || detail.photoUrl) ? (
              <img src={modalPhotos[modalIdx]?.url || detail.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[56px]">📍</div>
            )}
            {modalPhotos[modalIdx]?.credit && (
              <div
                className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded text-[calc(9px*var(--fs))] leading-none"
                style={{ background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)" }}
              >
                {modalPhotos[modalIdx].credit}
              </div>
            )}
            {modalPhotos.length > 1 && (
              <div
                className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-full text-[calc(9px*var(--fs))] leading-none"
                style={{ background: "rgba(0,0,0,0.42)", color: "#fff" }}
              >
                {modalIdx + 1} / {modalPhotos.length}
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setDetail(null); }}
              aria-label="Close"
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.95)", color: "#16302B", fontWeight: 800 }}
            >✕</button>
          </div>
          <div className="p-5">
            {detail.category && (
              <div className="text-[calc(12px*var(--fs))] font-semibold mb-1" style={{ color: "#C56B7A" }}>{detail.category}</div>
            )}
            <div className="font-serif text-[calc(24px*var(--fs))] leading-tight" style={{ color: "#16302B" }}>{detail.name}</div>
            <div className="flex items-center gap-3 mt-2 text-[calc(13px*var(--fs))]" style={{ color: "#71827D" }}>
              {detail.rating && <span>★ {detail.rating}</span>}
              {Number.isFinite(detail.distanceMiles) && <span>{detail.distanceMiles.toFixed(1)} mi</span>}
              {detail.freeToVisit && <span>Free</span>}
            </div>
            {detail.whyVisit && (
              <p className="mt-3 text-[calc(14px*var(--fs))] leading-relaxed" style={{ color: "#55635F" }}>{detail.whyVisit}</p>
            )}
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setDirsCard(detail)}
                className="flex-1 py-3 rounded-xl font-semibold text-white text-[calc(14px*var(--fs))]"
                style={{ background: "#17A38F" }}
              >🧭 Directions</button>
              <button
                onClick={() => openFullPage(detail)}
                className="flex-1 py-3 rounded-xl font-semibold text-[calc(14px*var(--fs))]"
                style={{ background: "#F7F3EB", color: "#16302B", border: "1px solid #E6DFD0" }}
              >Explore more</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {galleryOpen && (
      <PhotoGalleryModal
        photos={modalPhotos.map((p) => p.url)}
        initialIndex={modalIdx}
        isOpen
        onClose={() => setGalleryOpen(false)}
      />
    )}

    {dirsCard && (
      <MapAppSelector
        isOpen
        onClose={() => setDirsCard(null)}
        destination={{ name: dirsCard.name, latitude: dirsCard.lat, longitude: dirsCard.lng }}
        userLat={activeLat}
        userLng={activeLng}
      />
    )}

    {/* DREAMER'S CORNER photo immersion. "View details" (curated cards only —
        not the typed "Dream anywhere" path) reopens the quick-look modal the
        row's tap used to open, so the old behavior stays reachable. */}
    <DreamGallery
      open={!!dream}
      onClose={() => setDream(null)}
      dest={dream?.dest || null}
      onView={dream?.card ? () => { const c = dream.card; setDream(null); openDetail(c); } : undefined}
    />
    </>
  );
}
