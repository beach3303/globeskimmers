import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, ChevronLeft, MapPin, Trash2, Check, Loader2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from '../components/location/LocationContext';
import AddLocationDialog from '../components/location/AddLocationDialog';
import { showToast } from '../components/Toast';
import { CAT, TEAL_DEEP, IVORY } from '@/components/redesign/constants';
import { useIsTablet } from '@/lib/useIsTablet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// iPad editorial design tokens (copied from PlacesToEat / CultureInformation
// so this page can render the shipped editorial treatment on tablet without
// touching the phone layout). The phone path below is byte-identical.
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO  = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK   = '#16110D', ED_INK2 = '#3A3128', ED_INK3 = '#736657';
const ED_IVORY2 = '#EFE8D9', ED_RULE = 'rgba(22,17,13,.10)';

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
  const isTablet = useIsTablet();
  // Text-scaling helper (mirrors PlacesToEat): every editorial text size flows
  // through fs() so the iPad layout honors the app-wide --fs accessibility scale.
  const fs = (n) => `calc(${n}px*var(--fs))`;
  const { switchToNavigateMode, deleteLocation: contextDeleteLocation, saveLocation } = useLocation();
  const [loading, setLoading] = useState(true);
  const [savedLocations, setSavedLocations] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Replaces the prior browser confirm() — keeps the user inside the
  // app's styled modal layer instead of breaking flow with a system
  // dialog. The location to delete is stashed here; render shows a
  // confirmation AlertDialog when it's truthy.
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    loadSavedLocations();
  }, []);

  const loadSavedLocations = async () => {
    try {
      // Auth is guaranteed by the app-wide sign-in gate; never redirect here.
      // Saved locations still live in Base44 (not yet migrated) → degrade to
      // an empty list rather than throwing the user out.
      const user = await base44.auth.me();
      setSavedLocations(user.saved_locations || []);
    } catch {
      setSavedLocations([]);
    } finally {
      setLoading(false);
    }
  };

  // Called only AFTER the user confirms in the AlertDialog. The
  // confirm-or-cancel decision now lives in the modal, so this just
  // runs the actual delete.
  const handleDelete = async (location) => {
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
        showToast('Location removed', 'success');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      showToast('Couldn\'t delete this location. Please try again.', 'error');
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
      showToast('Couldn\'t save this location. Please try again.', 'error');
    }
  };

  if (loading) {
    if (isTablet) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: TEAL_DEEP }} />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f5f7fa] to-[#e2e8f0] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#3A6EA5] animate-spin" />
      </div>
    );
  }

  // ── iPad editorial layout (tablet-only). Same data + handlers as the phone
  //    path below; only the presentation differs. Phone stays byte-identical. ──
  if (isTablet) {
    const colWrap = 'max-w-[1024px]';
    return (
      <div className="min-h-screen" style={{ background: IVORY }}>
        {/* HEADER — chevron back + Saved pill (redesign) */}
        <div className="px-4 pt-2 pb-3">
          <div className={`${colWrap} mx-auto flex items-center justify-between`}>
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/5"
              style={{ background: '#FFFFFF', border: `1px solid ${ED_RULE}` }}
              aria-label="Back"
            >
              <ChevronLeft size={18} color={ED_INK} strokeWidth={2.2} />
            </button>
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full uppercase font-medium"
              style={{ background: CAT.restroom.bg, color: TEAL_DEEP, fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: '.08em' }}
            >
              <MapPin size={13} color={TEAL_DEEP} strokeWidth={2} /> Saved
            </div>
            <div className="w-10 h-10" aria-hidden="true" />
          </div>
        </div>

        {/* TITLE — serif headline + mono kicker */}
        <div className={`px-4 ${colWrap} mx-auto pb-2 text-center`}>
          <h1 className="italic leading-none" style={{ fontFamily: ED_SERIF, fontSize: fs(38), color: TEAL_DEEP }}>
            Saved Locations
          </h1>
          <p className="uppercase mt-2 font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: '0.16em', color: ED_INK3 }}>
            Your frequently visited places
          </p>
        </div>

        <div className={`${colWrap} mx-auto px-4 pb-10 pt-4`}>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-5 p-4 rounded-[18px] flex items-center gap-3"
              style={{ background: '#FFFFFF', border: `1px solid ${ED_RULE}`, boxShadow: '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)' }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-none" style={{ background: TEAL_DEEP }}>
                <Check className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(18), color: ED_INK }}>Location saved</p>
                <p style={{ color: ED_INK3, fontSize: fs(13) }}>You can now quickly navigate to this location anytime</p>
              </div>
            </motion.div>
          )}

          <button
            onClick={() => setShowAddDialog(true)}
            className="w-full mb-6 p-4 rounded-[18px] flex items-center justify-center gap-3 transition-colors hover:bg-black/[0.02]"
            style={{ background: '#FFFFFF', border: `1.5px dashed ${TEAL_DEEP}` }}
          >
            <Plus className="w-5 h-5" style={{ color: TEAL_DEEP }} />
            <span className="font-semibold uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(11.5), letterSpacing: '.08em', color: TEAL_DEEP }}>Add New Location</span>
          </button>

          {savedLocations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: ED_IVORY2 }}>
                <MapPin className="w-10 h-10" style={{ color: ED_INK3 }} />
              </div>
              <p className="mb-1" style={{ fontFamily: ED_SERIF, fontSize: fs(22), color: ED_INK }}>No saved locations yet</p>
              <p style={{ color: ED_INK3, fontSize: fs(13.5) }}>
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
                    className="rounded-[18px] overflow-hidden"
                    style={{ background: '#FFFFFF', border: `1px solid ${ED_RULE}`, boxShadow: '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)' }}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-3xl flex-shrink-0 leading-none">
                          {PLACE_TYPE_ICONS[location.placeType] || '📍'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="leading-tight" style={{ fontFamily: ED_SERIF, fontSize: fs(23), color: ED_INK }}>
                            {location.nickname || location.placeName}
                          </h3>
                          <p className="mt-1" style={{ color: ED_INK2, fontFamily: ED_MONO, fontSize: fs(12), lineHeight: 1.45 }}>
                            {location.address.formatted}
                          </p>
                          {location.savedAt && (
                            <p className="mt-1.5 uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: '.06em' }}>
                              Saved {new Date(location.savedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-1" style={{ borderTop: `1px solid ${ED_RULE}` }}>
                        <button
                          onClick={() => handleSelect(location)}
                          className="flex items-center justify-center gap-2 py-2.5 mt-3 rounded-[12px] font-semibold transition-transform active:scale-[0.98]"
                          style={{ background: TEAL_DEEP, color: '#FFFFFF', fontSize: fs(13.5), boxShadow: `0 6px 18px -6px ${TEAL_DEEP}80` }}
                        >
                          <MapPin className="w-4 h-4" />
                          Navigate Here
                        </button>

                        <button
                          onClick={() => setPendingDelete(location)}
                          disabled={deleting === location}
                          className="flex items-center justify-center gap-2 py-2.5 mt-3 rounded-[12px] font-semibold transition-colors hover:bg-black/[0.02] disabled:opacity-50"
                          style={{ background: '#FFFFFF', border: `1px solid ${ED_RULE}`, color: ED_INK2, fontSize: fs(13.5) }}
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

        <AlertDialog
          open={!!pendingDelete}
          onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from saved locations?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{pendingDelete?.nickname || pendingDelete?.placeName}</strong> will be removed from your list. You can save it again anytime by searching for it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const target = pendingDelete;
                  setPendingDelete(null);
                  if (target) handleDelete(target);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          <h1 className="text-[calc(24px*var(--fs))] font-bold mb-1">📍 Saved Locations</h1>
          <p className="text-[calc(14px*var(--fs))] opacity-90">Manage your frequently visited places</p>
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
                        onClick={() => setPendingDelete(location)}
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

      {/* Delete confirmation — replaces a system confirm() call.
          Naming the place inside the body makes the consequence
          concrete ("Empire State Building will be removed" vs the
          old generic "Delete?"). Cancel + Delete actions wired so
          either dismisses the dialog; only Delete runs the side
          effect. */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from saved locations?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.nickname || pendingDelete?.placeName}</strong> will be removed from your list. You can save it again anytime by searching for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target) handleDelete(target);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}