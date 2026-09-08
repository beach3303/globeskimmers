// flightTime — rough client-side flight-hour estimates for the dream surfaces
// (DreamersCorner cards, DreamShelf header).
//
// estFlightHours turns a straight-line (great-circle) distance in MILES into a
// whole-hour estimate: the distance at a ~500 mph cruise plus one hour of
// overhead (taxi, climb, descent), never less than 1. It is DELIBERATELY rough
// — no real routing, layovers, winds, or airport pairs — which is why every
// rendered use must keep an "(EST)" hint next to it. Inputs come from
// haversineKm (straight-line), the other half of why this is an estimate and
// not a promise.
export function estFlightHours(distMi) {
  return Math.max(1, Math.round(distMi / 500 + 1));
}

// Below ~150 straight-line miles nobody flies — callers hide the flight
// fragment entirely rather than print a silly "~1H FLIGHT (EST)" for the town
// next door.
export const MIN_FLIGHT_MILES = 150;

// km → mi, for callers holding haversineKm output.
export const KM_TO_MI = 0.621371;
