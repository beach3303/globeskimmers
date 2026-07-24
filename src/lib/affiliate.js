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
    });
    return data?.url || targetUrl;
  } catch {
    return targetUrl;
  }
}
