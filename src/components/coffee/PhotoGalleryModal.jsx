import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useDismissable } from '@/lib/dismissStack';
import useHorizontalSwipe from '@/lib/useHorizontalSwipe';

export default function PhotoGalleryModal({ photos, initialIndex = 0, isOpen, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Re-seed from the tapped photo on EVERY open. Some callers (ActivityDetail)
  // keep the modal mounted while closed, so useState's seed is read only once
  // and a later tap on photo 3 would reopen on whatever index was left behind.
  useEffect(() => {
    if (isOpen) setCurrentIndex(initialIndex);
  }, [isOpen, initialIndex]);

  useDismissable(isOpen, onClose);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const swipe = useHorizontalSwipe({ onLeft: goToNext, onRight: goToPrevious });

  if (!isOpen || !photos || photos.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10005] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative z-10 w-full h-full max-w-6xl max-h-screen p-4 flex flex-col"
          >
            <button
              onClick={onClose}
              className="absolute right-4 z-20 w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md flex items-center justify-center transition-colors"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <X className="w-6 h-6 text-white" />
            </button>

            <div className="flex-1 flex items-center justify-center relative" {...swipe}>
              {photos.length > 1 && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="absolute left-4 z-20 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>

                  <button
                    onClick={goToNext}
                    className="absolute right-4 z-20 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                </>
              )}

              <img
                src={photos[currentIndex]}
                alt={`Photo ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>

            {photos.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentIndex
                        ? "w-8 bg-white"
                        : "w-2 bg-white/50 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}

            {photos.length > 1 && (
              <div className="text-center text-white/80 text-sm mt-2">
                {currentIndex + 1} / {photos.length}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}