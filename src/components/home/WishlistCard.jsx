// WishlistCard — a compact Home banner into the Wishlist. Renders NOTHING until
// the traveler has saved at least one item, so it never clutters a fresh home.
// Pure on-device read (no network); stays in sync via the wishlist CHANGE_EVENT.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getWishlist, CHANGE_EVENT } from "@/lib/wishlist";

const INK = "#16302B", SUB = "#71827D", EDGE = "#E6DFD0";

const KIND_EMOJI = { city: "🌆", attraction: "📍", tour: "🎟️", event: "🎫", food: "🍜", hotel: "🏨", other: "📌" };

export default function WishlistCard({ wide = false }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(() => getWishlist());

  useEffect(() => {
    const sync = () => setItems(getWishlist());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  if (!items.length) return null;

  const n = items.length;
  const chips = Array.from(new Set(items.slice(0, 12).map((it) => KIND_EMOJI[it.kind] || "📌"))).slice(0, 5);

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <button
          onClick={() => navigate(createPageUrl("Wishlist"))}
          className="w-full text-left rounded-2xl p-3.5 bg-white flex items-center gap-3 transition-colors hover:bg-black/[0.02]"
          style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-none text-[22px]" style={{ background: "#FFE4E0" }}>❤️</div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-[calc(17px*var(--fs))] leading-tight" style={{ color: INK }}>Your wishlist</div>
            <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: SUB }}>
              {n} {n === 1 ? "place" : "places"} saved · ready when you are
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
