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
        height: 50,
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
