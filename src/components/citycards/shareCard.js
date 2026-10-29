// A picture of a City Card — or of one stamp on it — for the phone's share sheet (founder,
// 2026-10-28: cards are shareable). The element is drawn at 2×, the way a passport page is, and
// offered as a JPEG with the member's words; a browser without file sharing gets the words alone.
import html2canvas from "html2canvas";
import { showToast } from "@/components/Toast";
import { logEvent } from "@/lib/analytics";

const slug = (s) => String(s || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "city";

export async function shareCardElement(el, card) {
  if (!el || !card) return false;
  return shareElement(el, {
    what: "card", title: "My City Card",
    text: `My ${card.city} ${card.year} city card on GlobeSkimmers: ${card.count || 0} of ${card.slots || 10} local finds stamped 📇 https://globeskimmers.io/get?src=share-citycard`,
    filename: `globeskimmers-${slug(card.city)}-${card.year}-card.jpg`,
  });
}

// One stamp, big: the business's type-only stamp from the card's stamp sheet (founder, 2026-10-29).
export async function shareStampElement(el, card, stamp) {
  if (!el || !card || !stamp) return false;
  const n = Math.max(1, Number(stamp.visits) || 1);
  return shareElement(el, {
    what: "stamp", title: "My stamp",
    text: `I was here: ${stamp.name}, ${card.city} — on my ${card.year} city card${n > 1 ? ` (${n} visits)` : ""} on GlobeSkimmers 📇 https://globeskimmers.io/get?src=share-citystamp`,
    filename: `globeskimmers-${slug(stamp.name)}-stamp.jpg`,
  });
}

async function shareElement(el, { what, title, text, filename }) {
  try {
    const canvas = await html2canvas(el, { useCORS: true, backgroundColor: "#FBF6EC", scale: 2, logging: false, imageTimeout: 8000 });
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    const files = blob ? [new File([blob], filename, { type: "image/jpeg" })] : [];
    if (files.length && navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, title, text });
      logEvent("citycard_share", { how: "card", what }, "CityCards");
    } else if (navigator.share) {
      await navigator.share({ title, text });
      logEvent("citycard_share", { how: "text", what }, "CityCards");
    } else {
      await navigator.clipboard?.writeText(text);
      showToast("Copied — paste it anywhere", "success");
      logEvent("citycard_share", { how: "copy", what }, "CityCards");
    }
    return true;
  } catch (e) {
    if (e && e.name === "AbortError") return false;   // the member closed the share sheet
    showToast("Couldn’t open sharing. Try again.", "error");
    return false;
  }
}
