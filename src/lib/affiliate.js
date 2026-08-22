// Affiliate click-ownership helper.
// Records the outbound tap (SubID → D1, user attached via JWT) and returns the
// partner URL with the SubID appended. Open the RETURNED url (not the raw one) so
// the click is attributable. Falls back to the raw target if logging fails, so a
// tracking hiccup never blocks the user from reaching the partner.
//
// Usage:
//   const url = await trackAffiliateClick({ partner: 'viator', targetUrl, category: 'tour', productName, destCity, destCountry });
//   openExternal(url);   // window.open / Capacitor Browser
import { callWorker } from "@/lib/callWorker";

// Attach the SAME session id trackEvent uses (analytics.js key 'gs_session_id'),
// plus intent + persona, so a click JOINS to the view/tap events by session — the
// view→tap→click→book funnel works even for anonymous (not-signed-in) users.
function readClickCtx() {
  let session_id = null, intent = null, persona = null;
  try { session_id = sessionStorage.getItem("gs_session_id") || null; } catch { /* ignore */ }
  try { persona = localStorage.getItem("gs_persona_v1") || null; } catch { /* ignore */ }
  try {
    const loc = JSON.parse(localStorage.getItem("gs_last_location_v1") || "null");
    intent = loc?.placeType === "current_location" ? "present" : "planning";
  } catch { /* ignore */ }
  return { session_id, intent, persona };
}

export async function trackAffiliateClick({
  partner,
  targetUrl,
  productId,
  productName,
  category,
  destCountry,
  destCity,
}) {
  if (!partner || !targetUrl) return targetUrl || null;
  try {
    const { data } = await callWorker("aff/click", {
      partner,
      target_url: targetUrl,
      product_id: productId,
      product_name: productName,
      category,
      dest_country: destCountry,
      dest_city: destCity,
      ...readClickCtx(),
    });
    return data?.url || targetUrl;
  } catch {
    return targetUrl;
  }
}
