// Shared text folding for client-side search matching, so a typed query matches
// regardless of accents, composed-vs-decomposed characters, full-width/compat
// forms, or case — globally, not just for English/ASCII.
//
//   foldText("Café")        -> "cafe"        (Latin diacritics stripped)
//   "sao"    matches "São Paulo"             (Portuguese)
//   "muller" matches "Müller"                (German)
//   "creme"  matches "crème brûlée"          (French)
//   "resume" matches "Résumé"                (accent-insensitive both ways)
//   full-width "ｃｏｆｆｅｅ" folds to "coffee"  (NFKD compatibility fold)
//
// Non-Latin scripts (CJK 中文/日本語/한국어, Arabic العربية, Thai ไทย, Cyrillic,
// Greek) pass through intact, so exact-character substring matching still works;
// Arabic/Thai combining marks (harakat / tone marks) are folded away so a query
// without them still matches. Case-folding uses toLowerCase (locale-agnostic —
// the niche Turkish dotless-i edge case is accepted rather than mis-locale other
// scripts). Cross-SCRIPT matching (a Latin query against Thai-script data) is
// inherently impossible client-side; the live Google search layer covers that
// server-side, since Google matches multilingually.

export function foldText(s) {
  if (s == null) return '';
  let out = String(s);
  try {
    // NFKD decomposes accents + compatibility forms; strip the combining marks.
    out = out.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
  } catch {
    // Very old JS engine without Unicode property escapes — fall back to the
    // common Latin combining-mark range so we still fold é→e, ü→u, etc.
    try { out = out.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch { /* no normalize: use as-is */ }
  }
  return out.toLowerCase().trim();
}

// True when `needle` (folded) appears anywhere in `haystack` (folded).
// Empty/whitespace-only needle → false (don't match everything).
export function matchesQuery(haystack, needle) {
  const n = foldText(needle);
  if (!n) return false;
  return foldText(haystack).includes(n);
}
