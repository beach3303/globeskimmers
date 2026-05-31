import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ScanLine, Languages, Star, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { CAT, IVORY } from "@/components/redesign/constants";

// Per the redesign spec (BoldTextScanner): violet gradient header,
// hero icon, "Coming soon", 3 capability rows, dark Notify CTA, and a
// magenta thank-you note. Page bg is warm-ivory like the rest of the
// redesigned finders.
export default function SmartTextScannerPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen font-sans" style={{ background: IVORY }}>
      {/* Violet gradient header per spec */}
      <div
        className="text-white px-5 pt-6 pb-7 rounded-b-[24px]"
        style={{
          background: "linear-gradient(135deg, #6D28D9 0%, #7C3AED 55%, #A855F7 100%)",
          boxShadow: "0 14px 30px -16px rgba(124,58,237,.55)",
        }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity mb-3 font-semibold text-[14px]"
          >
            <ChevronLeft size={18} color="#fff" strokeWidth={2.2} />
            <span>Back</span>
          </button>
          <div className="text-[26px] font-extrabold tracking-tight leading-tight">
            Smart <span className="font-serif italic font-normal">Text Scanner</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-5 pt-6 pb-12">
        {/* Hero icon */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div
            className="w-[88px] h-[88px] mx-auto rounded-[26px] flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #C5197A 100%)",
              boxShadow: "0 16px 34px -14px rgba(124,58,237,.6)",
            }}
          >
            <ScanLine size={42} color="#fff" strokeWidth={1.8} />
          </div>
          <div className="mt-[18px] text-[28px] font-extrabold text-[#0F1419] tracking-tight">
            Coming soon
          </div>
          <div className="mt-2 text-[15px] text-[#475569] leading-relaxed max-w-[320px] mx-auto">
            Point your camera at a menu, sign, or document — and read it in your
            language, instantly.
          </div>
        </motion.div>

        {/* Capability rows */}
        <div className="mt-6 flex flex-col gap-2.5">
          {[
            { ico: ScanLine, c: CAT.shopping, t: "Scan any text", s: "Menus, signs, labels, documents" },
            { ico: Languages, c: CAT.transit, t: "Auto-translate", s: "100+ languages, on-device fast" },
            { ico: Star, c: CAT.todo, t: "Save & speak it", s: "Hear pronunciation, save phrases" },
          ].map((row, i) => {
            const Icon = row.ico;
            return (
              <div
                key={i}
                className="px-4 py-3.5 rounded-[16px] flex items-center gap-3.5"
                style={{ background: "#fff", border: "1px solid #F0E9DC" }}
              >
                <div
                  className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center flex-none"
                  style={{ background: row.c.bg, color: row.c.ink }}
                >
                  <Icon size={20} color={row.c.ink} strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-[15px] text-[#0F1419]">{row.t}</div>
                  <div className="text-[12.5px] text-[#6B7280] mt-0.5">{row.s}</div>
                </div>
                <span
                  className="font-mono font-bold uppercase tracking-[0.12em] text-[9px] px-1.5 py-0.5 rounded-full flex-none"
                  style={{ background: row.c.bg, color: row.c.ink }}
                >
                  Soon
                </span>
              </div>
            );
          })}
        </div>

        {/* Notify CTA */}
        <div className="mt-5">
          <button
            className="w-full h-[54px] rounded-[16px] text-white flex items-center justify-center gap-2 font-bold text-[15.5px]"
            style={{
              background: "#0F1419",
              boxShadow: "0 12px 28px -14px rgba(15,20,25,.4)",
            }}
          >
            Notify me when it's ready
            <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
          </button>
          <div
            className="mt-3.5 px-4 py-3.5 rounded-[14px] text-[13px] leading-relaxed font-semibold text-center"
            style={{ background: CAT.todo.bg, color: CAT.todo.ink }}
          >
            💜 Thanks for your patience — travelers like you make Globeskimmers
            better.
          </div>
        </div>
      </div>
    </div>
  );
}
