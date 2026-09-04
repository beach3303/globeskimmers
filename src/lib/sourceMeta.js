// sourceMeta — the honest-source vocabulary, promoted verbatim from the
// STAMP_STYLES table + sourceFor() in src/components/AtmAIDetails.jsx (the two
// existing consumers, AtmAIDetails and AttractionAIDetails, still carry their
// local copies — a later pass migrates them onto this module; do not edit them
// from here).
//
// One entry per tier the Worker's `_sources` maps can return. 'estimated' is
// pattern-based model output, so it is labelled as an AI estimate — never as
// review-derived (honest UX). 'forecast' is AttractionAIDetails' extra tier,
// folded in so this module covers both vocabularies.

export const SOURCE_META = {
  verified:  { label: 'Verified',           bg: '#DCFCE7', color: '#166534' },
  confirmed: { label: 'operator-confirmed', bg: '#DCFCE7', color: '#166534' },
  reported:  { label: 'reported',           bg: '#E0E7FF', color: '#3730A3' },
  reviews:   { label: 'from reviews',       bg: '#FEF3C7', color: '#92400E' },
  forecast:  { label: 'from forecast',      bg: '#FEF3C7', color: '#92400E' },
  estimated: { label: 'AI estimate',        bg: '#FEF3C7', color: '#92400E' },
  call:      { label: 'call to confirm',    bg: '#DBEAFE', color: '#1E40AF' },
};

// The Worker tags each field's provenance in `details._sources`. Anything it
// did NOT tag (older cache entries, fields the model left unmarked) is still
// model-written copy, so default to 'estimated' ("AI estimate") — only the
// Worker may claim a field came "from reviews".
//
// Direct form — pass the sources map each call:
export const sourceFor = (sourcesMap, key, fallback = 'estimated') =>
  (sourcesMap && sourcesMap[key]) || fallback;

// Bound form — matches the consumers' local closure shape exactly:
//   const sourceFor = makeSourceFor(details);
//   sourceFor('gsVerdict')  // -> tier key for SOURCE_META
export const makeSourceFor = (details) => {
  const sourcesMap = (details && typeof details._sources === 'object' && details._sources) || {};
  return (key, fallback = 'estimated') => sourcesMap[key] || fallback;
};
