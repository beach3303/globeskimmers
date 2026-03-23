import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, FileText, Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function SmartTextScannerPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f7fa] to-[#e2e8f0]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-5 py-4 rounded-b-[24px]">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-[24px] font-bold">📄 Smart Text Scanner</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-lg p-8 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center">
            <FileText className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Coming Soon!
          </h2>
          
          <p className="text-gray-600 mb-4 text-lg leading-relaxed">
            Get ready for instant text recognition and translation! 
            Soon you'll be able to scan menus, signs, documents, and more—with automatic translation to help you navigate any language.
          </p>

          <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-2xl p-6 border-2 border-purple-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-purple-600 fill-purple-600" />
              <p className="text-lg font-bold text-gray-900">
                Thank You for Your Patience
              </p>
            </div>
            <p className="text-sm text-gray-700">
              We're so grateful for travelers like you! Your patience inspires us to create even better tools for your adventures.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}