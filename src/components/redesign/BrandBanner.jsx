import React from 'react';
import { TEAL_GRADIENT } from './constants';

// Brand banner — 50px tall teal gradient bar with centered wordmark.
// Used at the top of every finder screen, directly under the iOS status bar
// safe area. Per the Claude-design spec.
export default function BrandBanner() {
  return (
    <div
      style={{
        background: TEAL_GRADIENT,
        // Extend the teal up through the iOS status-bar / notch safe area,
        // but keep the "Globeskimmers" wordmark in the 50px BELOW it so it
        // isn't hidden under the Dynamic Island. env() resolves to 0 on web
        // (and needs viewport-fit=cover on iOS — set in index.html), so this
        // degrades to a plain 50px bar everywhere else.
        height: 'calc(50px + env(safe-area-inset-top))',
        paddingTop: 'env(safe-area-inset-top)',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: '15.5px',
        letterSpacing: '0.02em',
        boxShadow: '0 2px 14px rgba(14,124,115,.25)',
        fontFamily: '"Inter Tight", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      Globeskimmers
    </div>
  );
}
