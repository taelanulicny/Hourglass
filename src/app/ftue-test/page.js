"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import WelcomeScreen from '../../components/ftue/WelcomeScreen';
import SleepSetupScreen from '../../components/ftue/SleepSetupScreen';

export default function FTUETestPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const steps = [
    { name: 'Welcome', component: WelcomeScreen },
    { name: 'Sleep Setup', component: SleepSetupScreen },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // FTUE completed, redirect to dashboard
      // Mark FTUE as completed and save user data
      localStorage.setItem('hourglassFTUECompleted', 'true');
      // Note: sleepHours and miscHours are already saved by SleepSetupScreen
      router.push('/');
    }
  };

  // Handle FTUE completion from SleepSetupScreen
  const handleFTUEComplete = () => {
    // FTUE completed, redirect to dashboard
    localStorage.setItem('hourglassFTUECompleted', 'true');
    router.push('/');
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const CurrentComponent = steps[currentStep].component;

  return (
    <div>
      {/* Step Navigation for Testing */}
      <div className="fixed top-4 left-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-50">
        <p className="text-sm font-medium text-gray-700 mb-2">FTUE Test Navigation</p>
        <div className="flex gap-2">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`px-3 py-1 text-xs rounded ${
                currentStep === index
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Current: {steps[currentStep].name}
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`px-2 py-1 text-xs rounded ${
              currentStep === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {currentStep === steps.length - 1 ? 'Complete →' : 'Next →'}
          </button>
        </div>

      </div>

      {/* Current FTUE Screen */}
      <CurrentComponent 
        onNext={currentStep === steps.length - 1 ? handleFTUEComplete : handleNext} 
        onBack={handleBack} 
      />
    </div>
  );
}
