import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import WelcomeStep from "../components/onboarding/WelcomeStep";
import ReferralSourceStep from "../components/onboarding/ReferralSourceStep";
import LocationStep from "../components/onboarding/LocationStep";
import HomeCountryStep from "../components/onboarding/HomeCountryStep";
import CurrencyStep from "../components/onboarding/CurrencyStep";
import LanguageStep from "../components/onboarding/LanguageStep";
import TemperatureStep from "../components/onboarding/TemperatureStep";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const authenticated = await base44.auth.isAuthenticated();
    setIsAuthenticated(authenticated);
    
    if (authenticated) {
      setCurrentStep(1); // Start at referral source step for authenticated users
    }
    
    setLoading(false);
  };

  const handleReferralSourceNext = async (data) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
    
    // Save referral source immediately
    await base44.auth.updateMe({
      referral_source: data.referral_source
    });
    
    setCurrentStep(2); // Move to location step
  };

  const handleLocationGranted = (location) => {
    setOnboardingData(prev => ({ ...prev, location_enabled: true }));
    setCurrentStep(3); // Move to home country step
  };

  const handleHomeCountryNext = (data) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
    setCurrentStep(4); // Move to currency step
  };

  const handleCurrencyNext = (data) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
    setCurrentStep(5); // Move to language step
  };

  const handleLanguageNext = (data) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
    setCurrentStep(6); // Move to temperature step
  };

  const handleTemperatureNext = async (data) => {
    const finalData = { ...onboardingData, ...data, onboarding_completed: true };
    
    // Save all preferences
    await base44.auth.updateMe(finalData);
    
    // Navigate to home
    navigate(createPageUrl("Home"));
  };

  const handleSkip = async () => {
    // Skip current step and save what we have
    await base44.auth.updateMe({
      ...onboardingData,
      onboarding_completed: true
    });
    
    navigate(createPageUrl("Home"));
  };

  const handleExitToLogin = async () => {
    await base44.auth.logout();
    setCurrentStep(0);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-[#F0F9FA] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#088395] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-[#F0F9FA]">
      {currentStep === 0 && !isAuthenticated && (
        <WelcomeStep onNext={() => setCurrentStep(1)} />
      )}
      {currentStep === 1 && isAuthenticated && (
        <ReferralSourceStep onNext={handleReferralSourceNext} />
      )}
      {currentStep === 2 && (
        <LocationStep 
          onNext={() => setCurrentStep(3)}
          onLocationGranted={handleLocationGranted}
          onExit={handleExitToLogin}
        />
      )}
      {currentStep === 3 && (
        <HomeCountryStep 
          onNext={handleHomeCountryNext}
          onSkip={handleSkip}
        />
      )}
      {currentStep === 4 && (
        <CurrencyStep 
          onNext={handleCurrencyNext}
          onSkip={handleSkip}
        />
      )}
      {currentStep === 5 && (
        <LanguageStep 
          onNext={handleLanguageNext}
          onSkip={handleSkip}
        />
      )}
      {currentStep === 6 && (
        <TemperatureStep 
          onNext={handleTemperatureNext}
          onSkip={handleSkip}
        />
      )}
    </div>
  );
}