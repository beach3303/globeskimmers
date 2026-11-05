// The crossing stamps' eight pads: navy, oxblood, forest, indigo, sepia, black, violet, teal. One is
// DRAWN AT RANDOM when a crossing is offered (founder, 2026-11-05: "when 6 friends are driving … they
// always check each other's stamp and it would be nice if random colors are stamped") and kept with
// the stamp (meta.ink), so a passport shows the same ink forever.
export const INKS = ["#274268", "#7E1C28", "#2E5A3A", "#24316B", "#5A3A1E", "#232323", "#4B2E62", "#1E5556"];
export const pickInk = () => INKS[Math.floor(Math.random() * INKS.length)];
export const validInk = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v).toUpperCase() : null);
