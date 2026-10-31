// Boards — the bottom bar's first tab (navigation redesign, 2026-10-31): City Boards, full
// screen. Your city's board first, then THE REST OF THE WORLD — the same CityBoardPage that used
// to sit under Home's fifth tab, for the active location (GPS or the picked city).
import React from "react";
import { useLocation } from "@/components/location/LocationContext";
import CityBoardPage from "@/components/home/CityBoardPage";

export default function Boards() {
  const { getActiveLocation, loading } = useLocation();
  const loc = getActiveLocation();
  const address = loc?.address || {};
  return (
    <div style={{ background: "#FFFCF7", minHeight: "60vh", paddingTop: 12 }}>
      {loading && !loc ? null : (
        <CityBoardPage city={address.city || ""} country={address.country || ""} region={address.state || ""} />
      )}
    </div>
  );
}
