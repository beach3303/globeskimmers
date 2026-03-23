import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, MapPin, Trash2, Check, Loader2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from '../components/location/LocationContext';
import AddLocationDialog from '../components/location/AddLocationDialog';

const PLACE_TYPE_ICONS = {
  airport: '✈️',
  hotel: '🏨',
  restaurant: '🍽️',
  shopping: '🛍️',
  attraction: '🎭',
  park: '🌳',
  transit: '🚉',
  current_location: '📍',
  location: '📍'
};

export default function SavedLocationsPage() {
  const navigate = useNavigate();
  const { switchToNavigateMode, deleteLocation: contextDeleteLocation, saveLocation } = useLocation();
  const [loading, setLoading] = useState(true);
  const [savedLocations, setSavedLocations] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadSavedLocations();
  }, []);

  const loadSavedLocations = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }

      const user = await base44.auth.me();
      setSavedLocations(user.saved_locations || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading saved locations:', error);
      setLoading(false);
    }
  };

  const handleDelete = async (location) => {
    if (!confirm(`Delete ${location.nickname || location.placeName}?`)) {
      return;
    }

    setDeleting(location);
    try {
      const success = await contextDeleteLocation(location);
      if (success) {
        setSavedLocations(prev => 
          prev.filter(loc => 
            !(loc.coordinates.latitude === location.coordinates.latitude &&
              loc.coordinates.longitude === location.coordinates.longitude)
          )
        );
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    }
    setDeleting(null);
  };

  const handleSelect = async (location) => {
    await switchToNavigateMode(location);
    navigate(createPageUrl('Home'));
  };

  const handleAddLocation = async (location) => {
    try {
      const success = await saveLocation(location);
      if (success) {
        setShowAddDialog(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await loadSavedLocations();
      }
    } catch (error) {
      console.error('Failed to save location:', error);
      alert('Failed to save location. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f5f7fa] to-[#e2e8f0] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#3A6EA5] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f7fa] to-[#e2e8f0]">
      <div className="bg-gradient-to-r from-[#3A6EA5] to-[#1E3150] text-white px-5 py-4 rounded-b-[24px]">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-[24px] font-bold mb-1">📍 Saved Locations</h1>
          <p className="text-[14px] opacity-90">Manage your frequently visited places</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-6">
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-2xl flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-green-900">Location saved!</p>
              <p className="text-sm text-green-700">You can now quickly navigate to this location anytime</p>
            </div>
          </motion.div>
        )}
        
        <button
          onClick={() => setShowAddDialog(true)}
          className="w-full mb-6 p-4 bg-white hover:bg-gray-50 border-2 border-dashed border-[#3A6EA5] rounded-2xl flex items-center justify-center gap-3 transition-colors"
        >
          <Plus className="w-5 h-5 text-[#3A6EA5]" />
          <span className="font-semibold text-[#3A6EA5]">Add New Location</span>
        </button>

        {savedLocations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <MapPin className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-600 mb-2">No saved locations yet</p>
            <p className="text-sm text-gray-500">
              Save locations to quickly navigate to them anytime
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {savedLocations.map((location, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl flex-shrink-0">
                        {PLACE_TYPE_ICONS[location.placeType] || '📍'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {location.nickname || location.placeName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {location.address.formatted}
                        </p>
                        {location.savedAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Saved {new Date(location.savedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleSelect(location)}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#3A6EA5] to-[#4A7EBA] text-white py-2.5 rounded-xl font-semibold hover:shadow-lg transition-shadow"
                      >
                        <MapPin className="w-4 h-4" />
                        Navigate Here
                      </button>
                      
                      <button
                        onClick={() => handleDelete(location)}
                        disabled={deleting === location}
                        className="flex items-center justify-center gap-2 bg-white border-2 border-red-300 text-red-600 py-2.5 rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deleting === location ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AddLocationDialog
        isOpen={showAddDialog}
        onAdd={handleAddLocation}
        onClose={() => setShowAddDialog(false)}
      />
    </div>
  );
}