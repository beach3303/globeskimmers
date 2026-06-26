import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Locate, X } from "lucide-react";
import { useLocation } from "../components/location/LocationContext";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Red pin for current location
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Bright yellow/gold pin for selected location
const yellowIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to recenter map
function RecenterButton({ center, onRecenter }) {
  const map = useMap();
  
  const handleRecenter = () => {
    map.setView(center, 14, { animate: true });
    onRecenter();
  };

  return (
    <button
      onClick={handleRecenter}
      className="absolute bottom-20 right-4 z-[1000] w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
      title="Recenter to location"
    >
      <Locate className="w-5 h-5 text-[#088395]" />
    </button>
  );
}

export default function MapPage() {
  const navigate = useNavigate();
  const { locationMode, selectedLocation, currentGpsLocation, getActiveLocation } = useLocation();
  const [mapCenter, setMapCenter] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [markerIcon, setMarkerIcon] = useState(redIcon);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  useEffect(() => {
    const activeLocation = getActiveLocation();
    
    if (activeLocation && activeLocation.coordinates) {
      const { latitude, longitude } = activeLocation.coordinates;
      setMapCenter([latitude, longitude]);
      setMarkerPosition([latitude, longitude]);
      
      // Determine location name and icon
      if (locationMode === 'current') {
        setLocationName(activeLocation.address?.city || activeLocation.placeName || "Current Location");
        setMarkerIcon(redIcon);
      } else {
        setLocationName(activeLocation.placeName || activeLocation.address?.city || "Selected Location");
        setMarkerIcon(yellowIcon);
      }
    }
  }, [locationMode, selectedLocation, currentGpsLocation, getActiveLocation]);

  if (!mapCenter || !markerPosition) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#D8F3FF] to-[#FFFFFF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#088395] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#0A4D68] font-semibold">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col font-sans">
      {/* Header — brand teal gradient per Claude-design BoldMap spec.
          Sits above the global BrandBanner since the Map takes the full
          viewport (fixed inset-0). */}
      <div
        className="text-white px-4 py-3 flex-shrink-0"
        style={{
          background: 'linear-gradient(90deg, #0E8077 0%, #14B5A6 60%, #06B6D4 100%)',
          boxShadow: '0 2px 14px rgba(14,124,115,.25)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[calc(18px*var(--fs))] font-extrabold tracking-tight leading-tight">
              <span className="font-serif italic font-normal">{locationName}</span>
            </h1>
            <p className="text-[calc(11.5px*var(--fs))] opacity-90 mt-0.5">
              {locationMode === 'current' ? 'Your current location' : 'Selected location'}
            </p>
          </div>
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Close map"
          >
            <X size={18} color="#fff" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Map - Full size minus header and bottom nav */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={markerPosition} icon={markerIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-bold">{locationName}</p>
                <p className="text-xs text-gray-600">
                  {locationMode === 'current' ? 'Your current location' : 'Selected location'}
                </p>
              </div>
            </Popup>
          </Marker>
          <RecenterButton 
            center={mapCenter} 
            onRecenter={() => setRecenterTrigger(prev => prev + 1)}
          />
        </MapContainer>
      </div>
    </div>
  );
}