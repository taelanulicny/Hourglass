"use client";

import { useState } from 'react';

export default function AppTransitionScreen({ onNext, onBack, focusAreas = [], sleepHours = 8 }) {
  const [isReady, setIsReady] = useState(false);

  const availableHours = 24 - sleepHours;

  const getRandomColor = () => {
    const colors = ["#8CA4AF", "#BCA88F", "#9ACD32", "#E46C6C", "#7D7ACF", "#F2C94C", "#56CCF2"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const getCategoryForArea = (area) => {
    const areaLower = area.toLowerCase();
    if (areaLower.includes('study') || areaLower.includes('lsat') || areaLower.includes('school')) return 'Study';
    if (areaLower.includes('fitness') || areaLower.includes('gym') || areaLower.includes('workout')) return 'Fitness';
    if (areaLower.includes('business') || areaLower.includes('company') || areaLower.includes('career')) return 'Career';
    if (areaLower.includes('creative') || areaLower.includes('art') || areaLower.includes('music')) return 'Creative';
    return 'Other';
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <div className="w-full py-6 px-4 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Ready to Build Your Dashboard
          </h1>
          <div className="w-6"></div> {/* Spacer for centering */}
        </div>
        <p className="text-lg text-gray-600">
          Now let&apos;s set up your focus areas in Hourglass
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="w-full px-6 mb-6">
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
        <p className="text-center text-sm text-gray-500 mt-2">Step 4 of 4</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-6 pb-20">
        {/* Transition Message */}
        <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Welcome to Hourglass!
              </h3>
              <p className="text-blue-700 mb-3">
                Now that you have an idea of what your focus areas are, it&apos;s time to input them into Hourglass. 
                This will guide you through setting up your dashboard and getting started with time tracking.
              </p>
              <p className="text-blue-700">
                You&apos;ll be setting daily goals for each of your {focusAreas.length} focus areas and learning how to use the app.
              </p>
            </div>
          </div>
        </div>

        {/* What You'll Do Next */}
        <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            What You&apos;ll Do Next
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-sm font-bold">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Set Daily Goals</p>
                <p className="text-sm text-gray-600">
                  Assign specific hour goals to each of your {focusAreas.length} focus areas, 
                  making sure they fit within your {availableHours} available hours.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-sm font-bold">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Learn the Dashboard</p>
                <p className="text-sm text-gray-600">
                  Discover how to track your time, view progress, and use the AI helper for each focus area.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm text-white font-bold">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Start Tracking</p>
                <p className="text-sm text-gray-600">
                  Begin logging your time and see your progress toward your daily goals.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Your Focus Areas Summary */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            Your Focus Areas Summary
          </h3>
          
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {focusAreas.map((area, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                  <div className="text-sm font-medium text-gray-900 mb-1">{area}</div>
                  <div className="text-xs text-gray-500">Daily Goal: ___ hours</div>
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Total available time: <span className="font-semibold text-blue-600">{availableHours} hours</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                You&apos;ll distribute these hours across your focus areas in the next step.
              </p>
            </div>
          </div>
        </div>

        {/* Ready Check */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <input
              type="checkbox"
              id="ready-checkbox"
              checked={isReady}
              onChange={(e) => setIsReady(e.target.checked)}
              className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="ready-checkbox" className="text-sm text-gray-700 font-medium">
              I&apos;m ready to set up my focus areas in Hourglass
            </label>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-auto flex justify-between items-center">
          <button
            onClick={onBack}
            className="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            ← Back
          </button>
          
          <button
            onClick={() => {
              // Save the focus areas to localStorage (your existing app structure)
              const categories = focusAreas.map(area => ({
                label: area,
                goal: 0, // Default goal, user can set later
                color: getRandomColor(),
                days: {},
                timeSpent: 0,
                meta: {
                  category: getCategoryForArea(area)
                }
              }));

              // Save to localStorage (matching your existing app structure)
              localStorage.setItem("focusCategories", JSON.stringify(categories));
              localStorage.setItem("sleepHours", sleepHours.toString());
              
              // Trigger any events your app listens for
              try {
                window.dispatchEvent(new Event("focusCategoriesUpdated"));
              } catch {}

              // Redirect to the actual dashboard page
              window.location.href = '/';
            }}
            disabled={!isReady}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Enter Hourglass →
          </button>
        </div>
      </div>
    </div>
  );
}
