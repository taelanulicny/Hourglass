"use client";

import { useState } from 'react';

export default function WelcomeScreen({ onNext }) {
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);

  // Prevent scroll interference with inputs
  const handleCheckboxChange = (e) => {
    e.preventDefault();
    setHasReadPrivacy(e.target.checked);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <div className="w-full py-6 px-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Time Macros
        </h1>
        <p className="text-lg text-gray-600">
          Privacy-first time tracking for your life
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 overflow-y-auto">
        {/* App Icon/Logo Placeholder */}
        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center mb-8">
          <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Privacy Commitment */}
        <div className="max-w-md text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Your Privacy, Our Promise
          </h2>
          <p className="text-gray-600 mb-6">
            Before we help you set up your focus areas, we want to be completely transparent:
          </p>
          
          <div className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-700">We don&apos;t collect, store, or access your personal information</span>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-700">Your focus areas, time logs, and goals stay on your device only</span>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-700">We can&apos;t see your data unless you explicitly choose to share it</span>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-700">Sharing with friends is completely optional and under your control</span>
            </div>
          </div>
        </div>

        {/* Focus Areas Introduction */}
        <div className="max-w-md text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            What are Focus Areas?
          </h2>
          <p className="text-gray-600 mb-4">
            Focus areas are the main areas of your life that need attention and time management.
          </p>
          

          
          <p className="text-sm text-gray-600">
            Hourglass helps you track time spent on each area, set daily goals, and see your progress over time.
          </p>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <p className="text-gray-600 mb-6">
            Ready to start building your productive life with complete privacy?
          </p>
          
          <div className="flex items-center justify-center gap-3 mb-6">
            <input
              type="checkbox"
              id="privacy-checkbox"
              checked={hasReadPrivacy}
              onChange={handleCheckboxChange}
              className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="privacy-checkbox" className="text-sm text-gray-700 font-medium">
              I understand and agree to continue
            </label>
          </div>
        </div>

        {/* Enter App Button (only shown after reading privacy) */}
        {hasReadPrivacy && (
          <div className="mt-8 text-center animate-fade-in">
            <p className="text-gray-500 text-sm mb-3">Great! Let&apos;s get started</p>
            <button
              onClick={onNext}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              Continue to Sleep Setup →
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full py-4 px-4 text-center text-sm text-gray-500">
        <p>Your data, your device, your control</p>
      </div>
    </div>
  );
}
