import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

const Toast = ({ message, type = "success", duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  // The latest onClose without restarting the timer: the container re-renders
  // whenever another toast comes or goes.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => closeRef.current?.(), 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => closeRef.current?.(), 300);
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />
  };

  const colors = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    warning: "bg-yellow-500"
  };

  // Laid out by the container — top centre, stacked one under another — so
  // two messages at once both show (2026-10-11). The animation moves only y
  // and scale; nothing here may set its own fixed position or x.
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`${colors[type]} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[320px] max-w-[90vw]`}
        >
          {icons[type]}
          <span className="flex-1 text-sm font-medium">{message}</span>
          <button
            onClick={handleClose}
            aria-label="Dismiss"
            className="hover:bg-white/20 rounded-lg p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// One id per toast, ever: two toasts fired in the same millisecond used to
// share a Date.now() id, and one could stick on screen for good.
let toastSeq = 0;

// Toast Container Component
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleShowToast = (event) => {
      const { message, type, duration, silent } = event.detail;
      const id = ++toastSeq;

      setToasts(prev => [...prev, { id, message, type, duration, silent: silent === true }]);
    };

    window.addEventListener('globeskimmers:showToast', handleShowToast);

    return () => {
      window.removeEventListener('globeskimmers:showToast', handleShowToast);
    };
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[10050] pointer-events-none">
      <div className="flex flex-col items-center gap-2 pt-20">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.message}
              type={toast.type || "success"}
              duration={toast.duration || 3000}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
      {/* What VoiceOver and TalkBack hear (2026-10-12): each new message once,
          as it lands — never the Dismiss buttons or the toasts still on screen.
          Always mounted, or the first message would be missed. A silent toast
          (its words are already spoken elsewhere, e.g. an inline alert) only
          shows. */}
      <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
        {toasts.filter(toast => !toast.silent).map(toast => <div key={toast.id}>{toast.message}</div>)}
      </div>
    </div>
  );
};

// Helper function to show toast from anywhere. opts.silent: show it, but don't
// have screen readers read it (the same words are already spoken elsewhere).
export const showToast = (message, type = "success", duration = 3000, opts = {}) => {
  window.dispatchEvent(new CustomEvent('globeskimmers:showToast', {
    detail: { message, type, duration, silent: opts?.silent === true }
  }));
};

export default Toast;
