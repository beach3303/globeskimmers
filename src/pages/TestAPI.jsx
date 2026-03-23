import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function TestAPIPage() {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);

  const runTest = async () => {
    setTesting(true);
    setResults(null);

    try {
      const { data } = await base44.functions.invoke('testGoogleMapsAPI');
      setResults(data);
    } catch (error) {
      setResults({
        success: false,
        error: 'Failed to run test',
        details: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const StatusIcon = ({ working }) => {
    if (working) {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    }
    return <XCircle className="w-5 h-5 text-red-600" />;
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

        <h1 className="text-2xl font-bold mb-2">Google Maps API Test</h1>
        <p className="text-sm opacity-90">Test if your Google Maps API is configured correctly</p>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <Button
            onClick={runTest}
            disabled={testing}
            className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold"
          >
            {testing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Testing APIs...
              </>
            ) : (
              "Run API Test"
            )}
          </Button>
        </div>

        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Overall Status */}
            <div className={`rounded-2xl shadow-lg p-6 ${
              results.success && results.places_api?.working && results.geocoding_api?.working && results.autocomplete_api?.working
                ? 'bg-green-50 border-2 border-green-200'
                : 'bg-red-50 border-2 border-red-200'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                {results.success && results.places_api?.working && results.geocoding_api?.working && results.autocomplete_api?.working ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <h3 className="font-bold text-lg">{results.overall_status || "Test Complete"}</h3>
                  {results.api_key_found && (
                    <p className="text-sm text-gray-600">API Key: ✓ Found</p>
                  )}
                </div>
              </div>
            </div>

            {/* Places API */}
            {results.places_api && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <StatusIcon working={results.places_api.working} />
                  <h4 className="font-bold text-[#0A4D68]">Places API</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Status:</span> {results.places_api.status}</p>
                  <p><span className="font-semibold">Results:</span> {results.places_api.results_count} locations found</p>
                  {results.places_api.sample_result && (
                    <p><span className="font-semibold">Sample:</span> {results.places_api.sample_result}</p>
                  )}
                  {results.places_api.error_message && (
                    <p className="text-red-600"><span className="font-semibold">Error:</span> {results.places_api.error_message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Geocoding API */}
            {results.geocoding_api && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <StatusIcon working={results.geocoding_api.working} />
                  <h4 className="font-bold text-[#0A4D68]">Geocoding API</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Status:</span> {results.geocoding_api.status}</p>
                  {results.geocoding_api.sample_result && (
                    <p><span className="font-semibold">Sample:</span> {results.geocoding_api.sample_result}</p>
                  )}
                  {results.geocoding_api.error_message && (
                    <p className="text-red-600"><span className="font-semibold">Error:</span> {results.geocoding_api.error_message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Autocomplete API */}
            {results.autocomplete_api && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <StatusIcon working={results.autocomplete_api.working} />
                  <h4 className="font-bold text-[#0A4D68]">Autocomplete API</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Status:</span> {results.autocomplete_api.status}</p>
                  <p><span className="font-semibold">Predictions:</span> {results.autocomplete_api.predictions_count}</p>
                  {results.autocomplete_api.error_message && (
                    <p className="text-red-600"><span className="font-semibold">Error:</span> {results.autocomplete_api.error_message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {results.recommendations && results.recommendations.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl shadow-lg p-6">
                <h4 className="font-bold text-[#0A4D68] mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  Recommendations
                </h4>
                <ul className="space-y-2">
                  {results.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Error Details */}
            {results.error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl shadow-lg p-6">
                <h4 className="font-bold text-red-600 mb-2">Error</h4>
                <p className="text-sm text-gray-700">{results.error}</p>
                {results.details && (
                  <p className="text-xs text-gray-600 mt-2">{results.details}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}