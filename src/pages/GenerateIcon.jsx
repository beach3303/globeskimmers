
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GenerateIconPage() {
  const navigate = useNavigate();
  const [downloadSize, setDownloadSize] = useState("1024");
  const svgRef = useRef(null);

  const downloadIcon = () => {
    const svg = svgRef.current;
    const size = parseInt(downloadSize);
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    // Draw to canvas
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      
      // Download
      canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `globeskimmers-icon-${size}.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
    };
    img.src = url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-[#F0F9FA]">
      <div className="bg-gradient-to-r from-[#088395] to-[#05BFDB] text-white p-6 pb-8">
        <button
          onClick={() => navigate(createPageUrl("Home"))}
          className="mb-4 flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Download Your App Icon</h1>
            <p className="text-sm opacity-90">Your custom Globeskimmers icon ready for download</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-[#0A4D68] mb-2">
              ✨ Your Globeskimmers Icon
            </h2>
            <p className="text-sm text-gray-600">
              Refined pilot design with globe and location pins
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <div className="w-full max-w-xs mx-auto" style={{ aspectRatio: "1/1" }}>
              <svg ref={svgRef} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="bgFinal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: "#00BCD4", stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: "#0097A7", stopOpacity: 1 }} />
                  </linearGradient>
                  <radialGradient id="globeFinal">
                    <stop offset="0%" style={{ stopColor: "#00897B", stopOpacity: 1 }} />
                    <stop offset="50%" style={{ stopColor: "#00695C", stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: "#004D40", stopOpacity: 1 }} />
                  </radialGradient>
                  <linearGradient id="wingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: "#FFD54F", stopOpacity: 1 }} />
                    <stop offset="50%" style={{ stopColor: "#FFC107", stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: "#FFB300", stopOpacity: 1 }} />
                  </linearGradient>
                  <filter id="dropShadow">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                    <feOffset dx="0" dy="2" result="offsetblur"/>
                    <feComponentTransfer>
                      <feFuncA type="linear" slope="0.4"/>
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                <rect width="200" height="200" fill="url(#bgFinal)"/>
                
                <g filter="url(#dropShadow)">
                  <circle cx="100" cy="132" r="66" fill="url(#globeFinal)"/>
                  <ellipse cx="100" cy="132" rx="66" ry="22" fill="none" stroke="#00BCD4" strokeWidth="2.5" opacity="0.7"/>
                  <ellipse cx="100" cy="132" rx="66" ry="44" fill="none" stroke="#00BCD4" strokeWidth="2" opacity="0.6"/>
                  <line x1="34" y1="132" x2="166" y2="132" stroke="#00BCD4" strokeWidth="2.5" opacity="0.7"/>
                  <ellipse cx="100" cy="132" rx="33" ry="66" fill="none" stroke="#00BCD4" strokeWidth="2.5" opacity="0.7"/>
                  <ellipse cx="100" cy="132" rx="52" ry="66" fill="none" stroke="#00BCD4" strokeWidth="2" opacity="0.6"/>
                  <ellipse cx="85" cy="110" rx="25" ry="20" fill="white" opacity="0.12"/>
                </g>
                
                <g filter="url(#dropShadow)">
                  <path d="M 68,110 Q 63,100 63,93 Q 63,83 73,83 Q 83,83 83,93 Q 83,100 78,110 Q 73,117 68,110 Z" fill="#FF6B6B"/>
                  <circle cx="73" cy="93" r="5" fill="white" opacity="0.9"/>
                </g>
                
                <g filter="url(#dropShadow)">
                  <path d="M 127,113 Q 122,103 122,96 Q 122,86 132,86 Q 142,86 142,96 Q 142,103 137,113 Q 132,120 127,113 Z" fill="#FF6B6B"/>
                  <circle cx="132" cy="96" r="5" fill="white" opacity="0.9"/>
                </g>
                
                <g filter="url(#dropShadow)">
                  <path d="M 97,118 Q 92,108 92,101 Q 92,91 102,91 Q 112,91 112,101 Q 112,108 107,118 Q 102,125 97,118 Z" fill="#FF6B6B"/>
                  <circle cx="102" cy="101" r="5" fill="white" opacity="0.9"/>
                </g>
                
                <g filter="url(#dropShadow)">
                  <circle cx="100" cy="52" r="24" fill="#FFEAA7"/>
                  <ellipse cx="92" cy="50" rx="4" ry="6" fill="#333"/>
                  <ellipse cx="108" cy="50" rx="4" ry="6" fill="#333"/>
                  <path d="M 90,58 Q 100,64 110,58" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <ellipse cx="87" cy="45" rx="6" ry="4" fill="#FFD700" opacity="0.3"/>
                  <ellipse cx="113" cy="45" rx="6" ry="4" fill="#FFD700" opacity="0.3"/>
                </g>
                
                <g filter="url(#dropShadow)">
                  <ellipse cx="100" cy="26" rx="32" ry="12" fill="#FFB300"/>
                  <ellipse cx="100" cy="23" rx="32" ry="9" fill="#FFC107"/>
                  <rect x="85" y="20" width="30" height="12" fill="#FFD54F" rx="2"/>
                  <ellipse cx="100" cy="24" rx="10" ry="4" fill="url(#wingGradient)"/>
                  <circle cx="100" cy="23" r="3" fill="white" opacity="0.9"/>
                </g>
                
                <g filter="url(#dropShadow)">
                  <path d="M 44,100 L 24,96 L 22,102 L 40,108 Z" fill="url(#wingGradient)"/>
                  <path d="M 44,100 L 30,97 L 28,100 L 42,104 Z" fill="#FFC107"/>
                  <circle cx="42" cy="102" r="3" fill="white" opacity="0.8"/>
                </g>
                
                <g filter="url(#dropShadow)">
                  <path d="M 156,100 L 176,96 L 178,102 L 160,108 Z" fill="url(#wingGradient)"/>
                  <path d="M 156,100 L 170,97 L 172,100 L 158,104 Z" fill="#FFC107"/>
                  <circle cx="158" cy="102" r="3" fill="white" opacity="0.8"/>
                </g>
              </svg>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-[#0A4D68] mb-2 block">
                Select Size:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["192", "512", "1024"].map(size => (
                  <button
                    key={size}
                    onClick={() => setDownloadSize(size)}
                    className={`p-3 rounded-lg border-2 font-semibold transition-colors ${
                      downloadSize === size 
                        ? 'border-[#088395] bg-[#088395]/10 text-[#088395]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={downloadIcon}
              className="w-full h-12 bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white font-semibold"
            >
              <Download className="w-5 h-5 mr-2" />
              Download {downloadSize}x{downloadSize} PNG
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-[#0A4D68] mb-3">📱 Next Steps for App Store:</h3>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
            <li>Download the <strong>1024x1024</strong> version</li>
            <li>Go to <strong>PWABuilder.com</strong></li>
            <li>Enter your app URL: <code className="bg-gray-100 px-2 py-1 rounded text-xs">https://globeskimmers-cacf36e4.base44.app</code></li>
            <li>Click "Package for Stores"</li>
            <li>Select <strong>iOS</strong></li>
            <li>Upload your downloaded icon</li>
            <li>Follow PWABuilder's iOS submission guide</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
