"use client";

import { useState } from 'react';
import WelcomeScreen from '../../components/ftue/WelcomeScreen';
import SleepSetupScreen from '../../components/ftue/SleepSetupScreen';

export default function FTUETestPage() {
  const [currentStep, setCurrentStep] = useState(0);


  const steps = [
    { name: 'Welcome', component: WelcomeScreen },
    { name: 'Sleep Setup', component: SleepSetupScreen },
  ];





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
      </div>

      {/* Current FTUE Screen */}
      <CurrentComponent />
    </div>
  );
}
