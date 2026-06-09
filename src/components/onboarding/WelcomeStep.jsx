import React from "react";
import { Plane, MapPin, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
export default function WelcomeStep({ onNext }) {
  // This screen is no longer in the onboarding flow — the app-wide AuthGate
  // handles sign in / sign up. Kept for reference; both CTAs just advance.
  const handleLogin = () => onNext?.();
  const handleSignUp = () => onNext?.();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="relative mb-8"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-full flex items-center justify-center shadow-lg">
          <Globe className="w-12 h-12 text-white" />
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-2 -right-2"
        >
          <Plane className="w-8 h-8 text-[#FF6B6B]" />
        </motion.div>
      </motion.div>

      <h1 className="text-4xl font-bold text-[#1e293b] mb-4">
        Welcome to Globeskimmers
      </h1>
      
      <p className="text-lg text-gray-600 mb-8 max-w-md">
        Your personal travel companion for exploring the world with confidence and ease
      </p>

      <div className="space-y-4 mb-12 max-w-md">
        <div className="flex items-start gap-3 text-left">
          <MapPin className="w-5 h-5 text-[#667eea] mt-1 flex-shrink-0" />
          <div>
            <p className="font-semibold text-[#1e293b]">Location-Based Features</p>
            <p className="text-sm text-gray-600">Discover places and experiences near you</p>
          </div>
        </div>
        <div className="flex items-start gap-3 text-left">
          <Globe className="w-5 h-5 text-[#667eea] mt-1 flex-shrink-0" />
          <div>
            <p className="font-semibold text-[#1e293b]">Multi-Currency Support</p>
            <p className="text-sm text-gray-600">Track expenses in your preferred currencies</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-3">
        <Button
          onClick={handleSignUp}
          className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:opacity-90 text-white h-12 text-lg font-semibold shadow-lg"
        >
          Get Started
        </Button>
        
        <Button
          onClick={handleLogin}
          variant="outline"
          className="w-full h-12 text-lg font-semibold border-2 border-[#667eea] text-[#667eea] hover:bg-[#667eea] hover:text-white"
        >
          I Already Have an Account
        </Button>
      </div>
    </motion.div>
  );
}