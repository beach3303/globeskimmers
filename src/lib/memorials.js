// Memorial sites (founder, 2026-10-04): places of mass atrocity, where an
// illustrated collectible stamp may not feel right to everyone. The traveler
// still earns the stamp, reads a short message that honors the victims, and
// chooses how it appears: the illustration, or text only (the typographic
// stamp). The choice lives in the stamp's meta.art ('art' | 'plain'); until it
// is made, the stamp shows its illustration and the Passport asks once.
export const MEMORIALS = [
  {
    key: "auschwitz",
    match: /auschwitz|birkenau/i,
    title: "Auschwitz-Birkenau",
    message: "At least 1.1 million people were murdered here, about one million of them Jews. We honor their memory, and we're grateful you came to remember.",
  },
];

export function memorialFor(stamp) {
  if (!stamp || stamp.kind === "country" || stamp.kind === "airport") return null;
  return MEMORIALS.find((m) => m.match.test(stamp.name || "")) || null;
}

// A memorial stamp whose owner hasn't chosen illustrated or text only yet.
export const needsArtChoice = (stamp) => !!memorialFor(stamp) && stamp.meta?.art !== "art" && stamp.meta?.art !== "plain";

// True when the stamp should print as text only.
export const isPlainArt = (stamp) => stamp?.meta?.art === "plain";
