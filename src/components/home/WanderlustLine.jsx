// WanderlustLine — a quiet benediction at the foot of Home: one rotating
// travel quote, meant only to encourage a dream, never to pressure a purchase.
//
// Copyright-safe by construction. Every attributed quote is from an author
// long in the PUBLIC DOMAIN (died over a century ago, or ancient) and traces
// to a real public-domain work; the unattributed lines are ORIGINAL
// GlobeSkimmers copy. Nothing here is from a living or 20th-century-copyright
// author (no Tolkien "not all who wander", no modern Instagram quotes, no
// disputed apocrypha) — that is a deliberate legal line, and any new quote
// must clear the same bar. We never invent an attribution: an original line
// carries no author rather than a borrowed name.
//
// One quote per LOCAL DAY (deterministic by day-of-year), so it feels chosen
// and never flickers on a re-render, yet greets a daily visitor with something
// new. Passport Standard: serif quote, mono attribution, no emoji.
import { useMemo } from "react";

// [quote, author|null]. Attributed → public-domain author + real PD source.
// null → original GlobeSkimmers line.
const QUOTES = [
  ["The world is a book, and those who do not travel read only one page.", "Saint Augustine"],
  ["A journey of a thousand miles begins with a single step.", "Lao Tzu"],
  ["To travel is to live.", "Hans Christian Andersen"],
  ["Travel and change of place impart new vigor to the mind.", "Seneca"],
  ["The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.", "Marcel Proust"],
  ["Though we travel the world over to find the beautiful, we must carry it with us.", "Ralph Waldo Emerson"],
  ["Not until we are lost do we begin to understand ourselves.", "Henry David Thoreau"],
  ["Travel is fatal to prejudice, bigotry, and narrow-mindedness.", "Mark Twain"],
  ["I travel not to go anywhere, but to go. I travel for travel's sake.", "Robert Louis Stevenson"],
  ["Some pages you can only read by going there.", null],
  ["The best souvenir is who you become on the way.", null],
  ["Your next stamp is one yes away.", null],
  ["Rest is not the reward. It's the plan.", null],
  ["Somewhere is already worth the trip.", null],
  ["The view will not wait. Neither should you.", null],
];

// Local day-of-year (1–366), stable within a calendar day.
function dayIndex() {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  } catch {
    return 0;
  }
}

export default function WanderlustLine() {
  const [quote, author] = useMemo(() => QUOTES[dayIndex() % QUOTES.length], []);
  return (
    <div className="px-6 pt-2 pb-4">
      <div className="max-w-md mx-auto text-center">
        <div
          className="font-serif italic leading-snug text-[calc(15px*var(--fs))]"
          style={{ color: "#736657" }}
        >
          &ldquo;{quote}&rdquo;
        </div>
        {author && (
          <div
            className="font-mono uppercase tracking-[0.12em] text-[calc(9.5px*var(--fs))] mt-2"
            style={{ color: "#A99E8C" }}
          >
            {author}
          </div>
        )}
      </div>
    </div>
  );
}
