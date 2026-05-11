import React from 'react';

// RefreshButton — circular header button that triggers a force-refresh of the
// current feature's data (bypasses Cloudflare KV + Base44 caches for one call).
// Sits in the top-right of each feature page's hero header, mirroring the
// "← Back" button on the top-left.
//
// Props:
//   onClick       — called when user taps the button. Page handler should set a
//                   "force next fetch" flag, then trigger its existing fetch.
//   isRefreshing  — boolean. When true, the icon spins and the button is
//                   disabled to prevent duplicate calls.
//   tone          — 'light' (default) for dark/colored gradient headers (white
//                   button on translucent white background, like the Back btn)
//                   or 'dark' for plain white headers (dark icon on light bg).
//   title         — accessible label / tooltip. Defaults to 'Refresh data'.
export default function RefreshButton({ onClick, isRefreshing = false, tone = 'light', title = 'Refresh data' }) {
  const isLight = tone === 'light';
  const bg = isLight ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)';
  const fg = isLight ? '#fff' : '#1f2937';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRefreshing}
      aria-label={title}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        border: 'none',
        borderRadius: 10,
        background: bg,
        color: fg,
        cursor: isRefreshing ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        padding: 0,
        opacity: isRefreshing ? 0.7 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: isRefreshing ? 'gs-refresh-spin 0.9s linear infinite' : 'none',
        }}
        aria-hidden="true"
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
        <path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14" />
      </svg>
      <style>{`@keyframes gs-refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
