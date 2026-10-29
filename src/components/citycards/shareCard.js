// A picture of a City Card for the phone's share sheet (founder, 2026-10-28: cards are
// shareable). The card's own element is drawn at 2×, the way a passport page is, and offered as
// a JPEG with the member's words; a browser without file sharing gets the words alone.
import html2canvas from "html2canvas";
import { showToast } from "@/components/Toast";
import { logEvent } from "@/lib/analytics";

export async function shareCardElement(el, card) {
  if (!el || !card) return false;
  const text = `My ${card.city} ${card.year} city card on GlobeSkimmers: ${card.count || 0} of ${card.slots || 10} local finds stamped 📇 https://globeskimmers.io/get?src=share-citycard`;
  try {
    const canvas = await html2canvas(el, { useCORS: true, backgroundColor: "#FBF6EC", scale: 2, logging: false, imageTimeout: 8000 });
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    const files = blob ? [new File([blob], `globeskimmers-${String(card.city || "city").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${card.year}-card.jpg`, { type: "image/jpeg" })] : [];
    if (files.length && navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, title: "My City Card", text });
      logEvent("citycard_share", { how: "card" }, "CityCards");
    } else if (navigator.share) {
      await navigator.share({ title: "My City Card", text });
      logEvent("citycard_share", { how: "text" }, "CityCards");
    } else {
      await navigator.clipboard?.writeText(text);
      showToast("Copied — paste it anywhere", "success");
      logEvent("citycard_share", { how: "copy" }, "CityCards");
    }
    return true;
  } catch (e) {
    if (e && e.name === "AbortError") return false;   // the member closed the share sheet
    showToast("Couldn’t open sharing. Try again.", "error");
    return false;
  }
}
