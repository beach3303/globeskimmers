// WishlistButton — a drop-in heart toggle any card can render to capture intent.
// Optimistic + localStorage-backed (see src/lib/wishlist.js); stays in sync with
// every other instance via the CHANGE_EVENT. stopPropagation so it never triggers
// the parent card's onClick.
//
//   <WishlistButton item={{ kind:'attraction', id, title, city, country, image }} />
//   variant="overlay" (default, white circle for on-photo) | "inline" (text + heart)
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { isWishlisted, toggleWishlist, CHANGE_EVENT } from "@/lib/wishlist";

export default function WishlistButton({ item, variant = "overlay", size = 18, className = "", style = {} }) {
  const [on, setOn] = useState(() => isWishlisted(item));

  useEffect(() => {
    const sync = () => setOn(isWishlisted(item));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
    // re-subscribe if the item identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key, item?.id, item?.title, item?.kind]);

  const onClick = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setOn(toggleWishlist(item));
  };

  if (variant === "inline") {
    return (
      <button onClick={onClick} aria-pressed={on} className={`inline-flex items-center gap-1.5 ${className}`} style={style}>
        <Heart size={size} className={on ? "fill-red-500 text-red-500" : "text-current"} strokeWidth={2.2} />
        {on ? "Wishlisted" : "Wishlist"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={on ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={on}
      className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-lg ${on ? "bg-red-500 hover:bg-red-600" : "bg-white/90 hover:bg-white"} ${className}`}
      style={style}
    >
      <Heart size={size} className={on ? "fill-white text-white" : "text-gray-800"} strokeWidth={2.2} />
    </button>
  );
}
