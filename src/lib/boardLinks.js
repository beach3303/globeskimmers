// Links into the City Boards (2026-10-14): one city's board, and the list of every board.
// Shared by the doors: Home, Mailbox, search, a postcard's postmark and a city stamp.
import { createPageUrl } from "@/utils";

// A country by name: airport stamps keep ISO codes ('PT') where boards use names
// ('Portugal'); the worker's board key does the same, so both open one board.
export function countryName(v) {
  const s = String(v || "").trim();
  if (!/^[A-Za-z]{2}$/.test(s)) return s;
  try {
    const n = new Intl.DisplayNames(["en"], { type: "region" }).of(s.toUpperCase());
    return n && n.toUpperCase() !== s.toUpperCase() && n !== "Unknown Region" ? n : s;
  } catch { return s; }
}

export const cityBoardUrl = (city, country) =>
  `${createPageUrl("CityBoard")}?city=${encodeURIComponent(String(city || "").trim())}&country=${encodeURIComponent(countryName(country))}`;

export const cityBoardsUrl = () => createPageUrl("CityBoards");

// A US state's board and a country's board (City Billboards, 2026-10-16): rollups of
// everything inside them, on the same page as a city's board.
export const stateBoardUrl = (region, country) =>
  `${createPageUrl("CityBoard")}?kind=state&region=${encodeURIComponent(String(region || "").trim())}&country=${encodeURIComponent(countryName(country))}`;
export const countryBoardUrl = (country) =>
  `${createPageUrl("CityBoard")}?kind=country&country=${encodeURIComponent(countryName(country))}`;
// Any board row the index lists: { kind, city | region | country }.
export const boardUrl = (b) =>
  b?.kind === "state" ? stateBoardUrl(b.region || b.name, b.country) : b?.kind === "country" ? countryBoardUrl(b.country || b.name) : cityBoardUrl(b?.city, b?.country);

// Whether a place names a board: both a city and a country.
export const hasBoard = (city, country) => !!String(city || "").trim() && !!String(country || "").trim();
