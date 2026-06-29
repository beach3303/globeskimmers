import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { useDismissable } from '@/lib/dismissStack';

export default function ContactUsModal({ isOpen, onClose }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Inline error replaces the prior `alert("Failed to send...")` —
  // alerts look like a browser dialog inside a glass / gradient
  // modal, which breaks the polished feel. Inline rendering keeps
  // the user inside the modal so they can edit + retry without
  // re-typing.
  const [errorMessage, setErrorMessage] = useState("");

  useDismissable(isOpen, onClose);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSubmitting(true);
    setErrorMessage("");
    try {
      const user = await base44.auth.me();

      await base44.entities.ContactMessage.create({
        subject: subject,
        message: message,
        user_email: user.email,
        user_name: user.full_name || user.email,
        status: "unread"
      });

      setSubmitted(true);
      setSubject("");
      setMessage("");

      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error sending message:", error);
      setErrorMessage("We couldn't send your message right now. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Contact Us</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-white/90 mt-2">
              We'd love to hear from you!
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Subject
              </label>
              <Input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?"
                className="h-12 text-base border-2 border-gray-200 focus:border-purple-400"
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                className="min-h-[150px] text-base border-2 border-gray-200 focus:border-purple-400"
                disabled={submitting}
                required
              />
            </div>

            {submitted && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-green-50 border-2 border-green-200 rounded-xl"
              >
                <p className="text-green-800 font-semibold text-center">
                  ✓ Message sent! We'll get back to you soon.
                </p>
              </motion.div>
            )}

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border-2 border-red-200 rounded-xl"
              >
                <p className="text-red-800 text-sm">
                  {errorMessage}
                </p>
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={!subject.trim() || !message.trim() || submitting}
              className="w-full h-12 bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:opacity-90 text-white font-bold text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : submitted ? (
                <>
                  ✓ Sent!
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}