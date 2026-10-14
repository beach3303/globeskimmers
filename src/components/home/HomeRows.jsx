// HomeRows — the "living homepage" carousels, iPad only, in Home's white
// "Around you" folder (ZONE.rows; plan-authored, no artboard).
//
// Photo-forward horizontal rows assembled by the Worker's POST /home/rows from
// OWNED attraction data (D1) — zero Google Places spend. Themed by day-part /
// weather / season so the homepage reshuffles across the day.
//
// Self-contained: resolves the active location itself, fetches once per location
// change, and renders NOTHING when there's no owned coverage (cold-start), so the
// zone never shows an empty folder.
//
// Interaction: swipe a row SIDEWAYS to browse; "See all" calls
// onAction(seeAll.action) — the same handleQuickAction the services use — to open
// the vertical finder page; a card opens a quick look with Directions and
// "Explore more" (the attraction's Things to Do card).
//
// Honesty: no "★ rating" — these are D1 attraction ratings with no recorded
// source. Distances follow the traveler's unit. The worker's `whereToNext`
// (dream) row is skipped here.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, X } from "lucide-react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { fetchHomeRows } from "@/lib/homeRows";
import { trackEvent } from "@/Layout";
import { KM_PER_MI, distanceLabel } from "@/lib/units";
import MapAppSelector from "@/components/MapAppSelector";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import useHorizontalSwipe from "@/lib/useHorizontalSwipe";
import { openAttraction } from "@/lib/openAttraction";
import { HomeZone } from "@/components/redesign/Zone";
import { NEUTRAL, ZONE, fs } from "@/components/redesign/constants";

const Z = ZONE.rows;

// "0.4 KM" / "0.3 MI", or "FREE" when there's no distance but the place is free.
function metaLine(card, unit) {
  const km = Number.isFinite(card.distanceMiles) ? card.distanceMiles * KM_PER_MI : NaN;
  const dist = distanceLabel(km, unit);
  if (dist) return dist;
  return card.freeToVisit ? "FREE" : "";
}

// No photo: a quiet ivory tile with a map pin, never an emoji.
function NoPhoto({ size = 28 }) {
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: NEUTRAL.ivory2 }}>
      <MapPin size={size} color={NEUTRAL.ink3} strokeWidth={2} aria-hidden="true" />
    </div>
  );
}

function HomeRowCard({ card, unit, onOpen }) {
  const name = card.name || "Explore";
  const meta = metaLine(card, unit);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={meta ? `${name}, ${meta.toLowerCase()}` : name}
      className="flex-none overflow-hidden text-left"
      style={{ width: 190, borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.creamRule}`, padding: 0, cursor: "pointer" }}
    >
      <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: NEUTRAL.ivory2 }}>
        {card.photoUrl ? (
          <img src={card.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <NoPhoto />
        )}
        {card.photoUrl && (card.credit || card.photographer) && (
          <div
            className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded leading-none"
            style={{ fontSize: fs(8), background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)" }}
          >
            {card.credit || card.photographer}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div
          className="font-serif"
          style={{ fontSize: fs(15), lineHeight: 1.15, color: NEUTRAL.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {name}
        </div>
        {meta && (
          <div className="font-mono uppercase" style={{ marginTop: 4, fontSize: fs(10), letterSpacing: ".08em", color: Z.meta }}>{meta}</div>
        )}
      </div>
    </button>
  );
}

export default function HomeRows({ onAction, unit = "mi" }) {
  const { getActiveLocation, locationMode } = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);     // attraction opened in the quick look
  const [dirsCard, setDirsCard] = useState(null); // attraction to route to (Waze/Apple/Google chooser)
  const [modalPhotos, setModalPhotos] = useState([]); // [{url, credit}] for the quick look
  const [modalIdx, setModalIdx] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false); // fullscreen viewer over the quick look

  // Swipe the quick look's hero photo left/right through the loaded photos.
  const heroSwipe = useHorizontalSwipe({
    onLeft: () => setModalIdx((i) => (modalPhotos.length ? (i + 1) % modalPhotos.length : i)),
    onRight: () => setModalIdx((i) => (modalPhotos.length ? (i - 1 + modalPhotos.length) % modalPhotos.length : i)),
  });

  // Open the quick look + enrich it with owned Wikimedia photos (swipeable).
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

  // Open the attraction's Things to Do card (the one page for an attraction).
  const openFullPage = (card) => {
    trackEvent("home_row_open_detail", { place_id: card.id, place_name: card.name });
    setDetail(null);
    if (!openAttraction(navigate, card, "Picked for you")) onAction?.("Things to Do");
  };

  useEffect(() => {
    let cancelled = false;
    const loc = getActiveLocation?.();
    // Active-location shape stores coords NESTED (coordinates.latitude) — same as
    // every finder. Keep top-level fallbacks for any picked/search shape that
    // flattens them.
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
        // Shared client cache (src/lib/homeRows.js) — one /home/rows call per location.
        const { data, error } = await fetchHomeRows({ latitude, longitude, cityName: city, countryName: country });
        if (cancelled) return;
        // whereToNext (the old dream row) is skipped.
        const gotRows = (!error && Array.isArray(data?.rows) ? data.rows : []).filter((r) => r?.key !== "whereToNext");
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
  const detailMeta = detail ? metaLine(detail, unit) : "";

  return (
    <>
      <HomeZone zone="rows" label="Around you">
        <div className="flex flex-col" style={{ gap: 20 }}>
          {rows.map((row) => (
            <div key={row.key}>
              <div className="flex items-baseline justify-between" style={{ gap: 12, marginBottom: 8 }}>
                <div className="min-w-0">
                  <h3 className="font-serif m-0" style={{ fontSize: fs(19), lineHeight: 1.1, fontWeight: 400, color: Z.title }}>{row.title}</h3>
                  {row.subtitle && (
                    <div style={{ marginTop: 2, fontSize: fs(12), color: Z.meta }}>{row.subtitle}</div>
                  )}
                </div>
                {row.seeAll?.action && (
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent("home_row_see_all", { row: row.key, action: row.seeAll.action });
                      onAction?.(row.seeAll.action);
                    }}
                    aria-label={`See all: ${row.title}`}
                    className="flex-none"
                    style={{ minHeight: 44, margin: "-12px 0", padding: "0 2px", background: "transparent", border: 0, fontSize: fs(13), fontWeight: 600, color: NEUTRAL.pine, cursor: "pointer" }}
                  >
                    See all
                  </button>
                )}
              </div>
              <div className="flex overflow-x-auto" style={{ gap: 12, paddingBottom: 4, scrollbarWidth: "none" }}>
                {row.cards.map((card) => (
                  <HomeRowCard
                    key={card.id}
                    card={card}
                    unit={unit}
                    onOpen={() => {
                      trackEvent("home_row_card_tap", {
                        row: row.key,
                        place_id: card.id,
                        place_name: card.name,
                        category: card.category,
                        city: card.city,
                        country: card.country,
                      });
                      openDetail(card); // open THIS attraction (quick look)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </HomeZone>

      {detail && (
        <div
          onClick={() => setDetail(null)}
          className="fixed inset-0 z-[9999] overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={detail.name || "Place"}
            className="mx-auto my-8 overflow-hidden"
            style={{ width: "92%", maxWidth: 480, borderRadius: 24, background: NEUTRAL.white }}
          >
            <div
              className="relative cursor-pointer"
              style={{ aspectRatio: "16 / 10", background: NEUTRAL.ivory2 }}
              {...heroSwipe}
              onClick={() => { if (modalPhotos[modalIdx]?.url || detail.photoUrl) setGalleryOpen(true); }}
            >
              {(modalPhotos[modalIdx]?.url || detail.photoUrl) ? (
                <img src={modalPhotos[modalIdx]?.url || detail.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <NoPhoto size={48} />
              )}
              {modalPhotos[modalIdx]?.credit && (
                <div
                  className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded leading-none"
                  style={{ fontSize: fs(9), background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)" }}
                >
                  {modalPhotos[modalIdx].credit}
                </div>
              )}
              {modalPhotos.length > 1 && (
                <div
                  className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-full leading-none"
                  style={{ fontSize: fs(9), background: "rgba(0,0,0,0.42)", color: "#fff" }}
                >
                  {modalIdx + 1} / {modalPhotos.length}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDetail(null); }}
                aria-label="Close"
                className="absolute flex items-center justify-center rounded-full"
                style={{ top: 10, right: 10, width: 44, height: 44, background: "rgba(255,255,255,0.95)", border: 0, color: NEUTRAL.ink, cursor: "pointer" }}
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              {detail.category && (
                <div className="font-mono uppercase" style={{ marginBottom: 4, fontSize: fs(10.5), letterSpacing: ".1em", color: Z.meta }}>{detail.category}</div>
              )}
              <div className="font-serif" style={{ fontSize: fs(24), lineHeight: 1.15, color: NEUTRAL.ink }}>{detail.name}</div>
              {detailMeta && (
                <div className="font-mono uppercase" style={{ marginTop: 6, fontSize: fs(11), letterSpacing: ".08em", color: Z.meta }}>{detailMeta}</div>
              )}
              {detail.whyVisit && (
                <p style={{ margin: "12px 0 0", fontSize: fs(14), lineHeight: 1.55, color: NEUTRAL.ink2 }}>{detail.whyVisit}</p>
              )}
              <div className="flex" style={{ gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setDirsCard(detail)}
                  className="flex-1 flex items-center justify-center"
                  style={{ gap: 8, minHeight: 48, borderRadius: 12, border: 0, background: NEUTRAL.tealInk, color: NEUTRAL.white, fontSize: fs(14), fontWeight: 600, cursor: "pointer" }}
                >
                  <Navigation size={16} strokeWidth={2} aria-hidden="true" />
                  Directions
                </button>
                <button
                  type="button"
                  onClick={() => openFullPage(detail)}
                  className="flex-1"
                  style={{ minHeight: 48, borderRadius: 12, background: NEUTRAL.ivory2, color: NEUTRAL.ink, border: `1px solid ${NEUTRAL.lobbyLine}`, fontSize: fs(14), fontWeight: 600, cursor: "pointer" }}
                >
                  Explore more
                </button>
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
    </>
  );
}
