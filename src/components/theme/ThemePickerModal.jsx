// ============================================================================
// GLOBESKIMMERS THEME PICKER MODAL v2.0
// ============================================================================
// Updated: Light Traveler → Original
// ============================================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sun, Moon, Sparkles, Briefcase } from 'lucide-react';
import { useTheme, THEMES } from './ThemeContext';

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  space: Sparkles,
  executive: Briefcase,
};

const THEME_PREVIEWS = {
  light: {
    headerBg: 'bg-gradient-to-r from-teal-500 to-cyan-500',
    cardBg: 'bg-white',
    pageBg: 'bg-slate-100',
    textColor: 'text-slate-800',
    btnColors: ['bg-amber-900', 'bg-blue-600', 'bg-red-500'],
  },
  dark: {
    headerBg: 'bg-gradient-to-r from-slate-700 to-slate-900',
    cardBg: 'bg-slate-800',
    pageBg: 'bg-slate-900',
    textColor: 'text-white',
    btnColors: ['bg-amber-700', 'bg-blue-700', 'bg-red-700'],
  },
  space: {
    headerBg: 'bg-gradient-to-r from-violet-600 to-pink-500',
    cardBg: 'bg-slate-800/80',
    pageBg: 'bg-[#0a0a1f]',
    textColor: 'text-white',
    btnColors: ['bg-amber-600', 'bg-violet-600', 'bg-pink-600'],
  },
  executive: {
    headerBg: 'bg-gradient-to-r from-sky-600 to-cyan-500',
    cardBg: 'bg-sky-700',
    pageBg: 'bg-sky-900',
    textColor: 'text-white',
    btnColors: ['bg-orange-500', 'bg-sky-500', 'bg-emerald-500'],
  },
};

function ThemePreviewMini({ themeId, isSelected }) {
  const preview = THEME_PREVIEWS[themeId];
  const themeData = THEMES[themeId];
  const Icon = THEME_ICONS[themeId];
  
  return (
    <div className={`relative rounded-xl overflow-hidden border-2 transition-all
      ${isSelected ? 'border-green-500 ring-2 ring-green-500/30' : 'border-transparent'}`}>
      
      {/* Mini preview */}
      <div className={`w-full aspect-[3/4] p-2 ${preview.pageBg}`}>
        {/* Mini header */}
        <div className={`h-6 rounded-t-lg ${preview.headerBg}`} />
        
        {/* Mini card */}
        <div className={`${preview.cardBg} p-1.5 rounded-b-lg`}>
          <div className={`h-1.5 w-12 rounded mb-1.5 ${themeId === 'light' ? 'bg-slate-200' : 'bg-slate-600'}`} />
          <div className={`h-1 w-8 rounded mb-2 ${themeId === 'light' ? 'bg-slate-300' : 'bg-slate-700'}`} />
          
          {/* Mini buttons */}
          <div className="flex gap-1">
            {preview.btnColors.map((bg, i) => (
              <div key={i} className={`h-3 w-6 rounded ${bg}`} />
            ))}
          </div>
        </div>
      </div>
      
      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <Check size={12} className="text-white" strokeWidth={3} />
        </div>
      )}
      
      {/* Theme name */}
      <div className={`text-center py-2 text-xs font-medium
        ${themeId === 'light' ? 'bg-white text-slate-700' : 'bg-slate-800 text-white'}`}>
        <Icon size={12} className="inline mr-1" />
        {themeData.name}
      </div>
    </div>
  );
}

export default function ThemePickerModal({ isOpen, onClose }) {
  const { theme, themeId, setTheme, themes } = useTheme();
  
  const handleSelectTheme = (id) => {
    setTheme(id);
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 z-50" />
          
          {/* Modal */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.2 }}
            onDragEnd={(e, info) => { if (info.offset.y > 150) onClose(); }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-y-auto"
            style={{ background: theme.colors.surface, maxHeight: '95vh' }}>
            
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full" style={{ background: theme.colors.textMuted }} />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4">
              <div>
                <h2 className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>Choose Theme</h2>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>Personalize your experience</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full transition-colors"
                style={{ background: theme.colors.surfaceMuted, color: theme.colors.textSecondary }}>
                <X size={20} />
              </button>
            </div>
            
            {/* Theme grid */}
            <div className="px-5 pb-8 grid grid-cols-2 gap-4">
              {Object.keys(themes).map((id) => (
                <button key={id} onClick={() => handleSelectTheme(id)}
                  className="text-left transition-transform active:scale-95">
                  <ThemePreviewMini themeId={id} isSelected={themeId === id} />
                </button>
              ))}
            </div>
            
            {/* Current theme info */}
            <div className="px-5 py-4 border-t"
              style={{ borderColor: theme.colors.cardBorder, background: theme.colors.surfaceMuted }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: theme.colors.primary }}>
                  {React.createElement(THEME_ICONS[themeId], { size: 20, color: 'white' })}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: theme.colors.textPrimary }}>{theme.name}</p>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{theme.description}</p>
                </div>
              </div>
            </div>
            
            {/* Safe area padding */}
            <div className="h-6" style={{ background: theme.colors.surfaceMuted }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
