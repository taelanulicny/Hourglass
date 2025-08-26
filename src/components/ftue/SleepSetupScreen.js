"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SleepSetupScreen() {
  const router = useRouter();
  const [sleepHours, setSleepHours] = useState('');
  const [miscHours, setMiscHours] = useState('');
  const [hasReadAboutSleep, setHasReadAboutSleep] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMiscInputFocused, setIsMiscInputFocused] = useState(false);

  // Load existing sleep and misc hours if available
  useEffect(() => {
    const savedSleepHours = localStorage.getItem('sleepHours');
    const savedMiscHours = localStorage.getItem('miscHours');
    if (savedSleepHours) {
      setSleepHours(savedSleepHours);
    }
    if (savedMiscHours) {
      setMiscHours(savedMiscHours);
    }
  }, []);

  const handleSleepHoursChange = (value) => {
    // Allow any input, we'll validate on continue
    setSleepHours(value);
  };

  // Calculate available hours
  const sleepHoursNum = parseFloat(sleepHours || 8);
  const miscHoursNum = parseFloat(miscHours || 0);
  const availableHours = 24 - sleepHoursNum - miscHoursNum;
  const weeklyHours = availableHours * 7;

  const handleContinue = () => {
    // Validate sleep hours before continuing
    const numSleepHours = parseFloat(sleepHours);
    if (isNaN(numSleepHours) || numSleepHours < 5 || numSleepHours > 12) {
      alert('Please enter a valid sleep goal between 5 and 12 hours.');
      return;
    }

    // Validate misc hours (optional, but if entered must be valid)
    const numMiscHours = parseFloat(miscHours);
    if (miscHours && (isNaN(numMiscHours) || numMiscHours < 0 || numMiscHours > 8)) {
      alert('Please enter a valid miscellaneous time between 0 and 8 hours, or leave it empty.');
      return;
    }

    // Validate total time doesn't exceed 24 hours
    const totalTime = numSleepHours + (numMiscHours || 0);
    if (totalTime > 24) {
      alert('Total time (sleep + miscellaneous) cannot exceed 24 hours. Please adjust your values.');
      return;
    }

    // Save sleep and misc hours to localStorage
    localStorage.setItem('sleepHours', sleepHours);
    if (miscHours) {
      localStorage.setItem('miscHours', miscHours);
    } else {
      localStorage.removeItem('miscHours');
    }
    
    // Mark FTUE as completed
    localStorage.setItem('hourglassFTUECompleted', 'true');
    
    // Call onNext to proceed to next step (which will redirect to dashboard)
    if (onNext) {
      onNext();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sleep is Your Foundation</h1>
          <p className="text-lg text-gray-600">Quality sleep powers everything else in your life</p>
        </div>

        {/* Sleep Importance Section */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Why Sleep Matters</h2>
          
          <div className="space-y-4 text-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900">Cognitive Performance</div>
                <div className="text-sm">Better focus, memory, and decision-making</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900">Physical Recovery</div>
                <div className="text-sm">Muscle repair and immune system support</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900">Emotional Balance</div>
                <div className="text-sm">Improved mood and stress management</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900">Productivity</div>
                <div className="text-sm">More effective use of your waking hours</div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <strong>Pro Tip:</strong> Your sleep hours determine how many productive hours are available for planning each day. 
                Setting realistic sleep goals helps you plan your focus areas more effectively.
              </div>
            </div>
          </div>
        </div>

        {/* Sleep Hours Setup */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Set Your Daily Goal</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                How many hours will you commit to sleeping every night? <span className="text-blue-600">(recommended: 6 to 9 hours)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={isInputFocused ? sleepHours : ''}
                  onChange={(e) => {
                    console.log('Input changed:', e.target.value, 'Type:', typeof e.target.value);
                    handleSleepHoursChange(e.target.value);
                  }}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => {
                    if (sleepHours === '') {
                      setIsInputFocused(false);
                    }
                  }}
                  className={`flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-center text-lg font-medium ${
                    isInputFocused ? 'text-black' : 'text-gray-400'
                  }`}
                  min="5"
                  max="12"
                  step="0.25"
                  placeholder="0.0"
                />
                <span className="text-gray-600 font-medium">hours</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-sm text-gray-700">
                With <strong className="text-blue-600">{sleepHours}</strong> hours of sleep a day, you will have <strong className="text-blue-600">{availableHours}</strong> hours to be productive.
                <br />
                <br />
                That is <strong className="text-blue-600">{weeklyHours}</strong> hours a week.
              </div>
            </div>
          </div>
        </div>

        {/* Miscellaneous Time Setup */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Optional: Unaccounted Time</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Do you want to reserve time for leisure, breaks, or other activities? <span className="text-gray-500">(optional)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={isMiscInputFocused ? miscHours : ''}
                  onChange={(e) => setMiscHours(e.target.value)}
                  onFocus={() => setIsMiscInputFocused(true)}
                  onBlur={() => {
                    if (miscHours === '') {
                      setIsMiscInputFocused(false);
                    }
                  }}
                  className={`flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-center text-lg font-medium ${
                    isMiscInputFocused ? 'text-black' : 'text-gray-400'
                  }`}
                  min="0"
                  max="8"
                  step="0.25"
                  placeholder="0.0"
                />
                <span className="text-gray-600 font-medium">hours</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                This time will be subtracted from your available productive hours each day.
              </p>
            </div>

            {miscHours && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="text-sm text-gray-700">
                  With <strong className="text-green-600">{miscHours}</strong> hours of miscellaneous time, your daily productive hours are now <strong className="text-green-600">{availableHours}</strong>.
                  <br />
                  <br />
                  That gives you <strong className="text-green-600">{weeklyHours}</strong> productive hours per week.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <div className="text-center">
          <button
            onClick={handleContinue}
            className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Continue to Hourglass →
          </button>
          <p className="text-sm text-gray-500 mt-3">
            Your sleep hours will be saved and you can adjust them anytime in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
