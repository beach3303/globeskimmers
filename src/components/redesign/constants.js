// Globeskimmers redesign — design tokens shared across primitives + pages.
// Source: design_handoff_globeskimmers_redesign/README.md (Claude design pass).
// Keep these in sync with tailwind.config.js theme.extend.colors.cat / brand.

// Brand teal gradient — banner, primary brand surfaces, final CTA
export const TEAL_GRADIENT = 'linear-gradient(135deg, #0E8077 0%, #14B5A6 60%, #2DD4BF 100%)';
export const TEAL_DEEP = '#0E7C73';

// Per-category color worlds. ink = saturated solid, bg = soft tint.
// Each tile / pill / icon chip pulls from one of these so every finder
// has its own visual identity (the Claude-design "color world" pattern).
export const CAT = {
  food:        { ink: '#E63946', bg: '#FFE4E0', soft: '#FFCFC5', label: 'Food' },
  money:       { ink: '#0F9A6B', bg: '#D8F4E5', soft: '#A8E5C4', label: 'Money' },
  coffee:      { ink: '#A85A2E', bg: '#F2DDC4', soft: '#E6BC96', label: 'Coffee' },
  transit:     { ink: '#3F49D4', bg: '#DFE2FA', soft: '#BBC2F4', label: 'Transit' },
  restroom:    { ink: '#0F8A82', bg: '#D2EFEC', soft: '#A7DDD7', label: 'Restroom' },
  atm:         { ink: '#1F5BD6', bg: '#DCE6FB', soft: '#B3C7F4', label: 'ATM' },
  weather:     { ink: '#D4861A', bg: '#FCEAC9', soft: '#F4D597', label: 'Weather' },
  todo:        { ink: '#C5197A', bg: '#FBDEEB', soft: '#F2B0D0', label: 'Things to do' },
  shopping:    { ink: '#7C3AED', bg: '#EAE0FA', soft: '#D0B6F4', label: 'Shopping' },
  culture:     { ink: '#8B5A1A', bg: '#F3E2C7', soft: '#E5CA98', label: 'Culture' },
  phrases:     { ink: '#A37013', bg: '#F8ECC4', soft: '#EED890', label: 'Phrases' },
  convenience: { ink: '#15803D', bg: '#D4F0DA', soft: '#A4DCB0', label: 'Convenience' },
};

// Shadows tuned to land between flat-ish and "card pops" without being heavy.
export const SHADOW_CARD_SOFT = '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)';
export const shadowForCat = (catInk) => `0 12px 26px -12px ${catInk}80`;

// Editorial-ivory canvas — the global app background per redesign.
export const IVORY = '#FFFCF7';
export const IVORY_2 = '#F7F4EC';
