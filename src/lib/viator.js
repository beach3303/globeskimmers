// Viator affiliate deep-links.
//
// pid   = our Partner ID — this is what pays us; NEVER change or drop it.
// mcid  = Viator's standard text-link media id; medium=link = link attribution.
// Our own per-click sub-id is appended by the Worker's /aff/click into `campaign`
// (Viator passes it through for reporting; it does NOT affect payout).
//
// ⚠️ VERIFY pid + mcid against a link generated in the Viator dashboard
// (Tools → Create links). If the builder shows a different mcid for this account,
// update VIATOR_MCID below — payout attribution depends on pid + mcid being right.
const VIATOR_PID = "P00311514";
const VIATOR_MCID = "42383";

const withTracking = (url) => {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}pid=${VIATOR_PID}&mcid=${VIATOR_MCID}&medium=link`;
};

// Deep-link to Viator search for a place/attraction — high intent ("book a tour
// where I'm looking"), works with just the affiliate pid (no Viator API needed).
export function viatorSearchLink(query) {
  const q = encodeURIComponent((query || "").toString().trim());
  return withTracking(`https://www.viator.com/searchResults/all?text=${q}`);
}

// Add affiliate tracking (pid+mcid) to a specific Viator product URL returned by
// the /activities/search API, so booking a searched tour pays out correctly.
export function viatorProductLink(url) {
  if (!url) return null;
  return withTracking(String(url));
}
