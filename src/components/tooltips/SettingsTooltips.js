"use client";

import { useState } from 'react';
import { GuidedTour, dashboardTooltipSteps, calendarTooltipSteps } from './TooltipSystem';

export function SettingsTooltips() {
  const [showDashboardTour, setShowDashboardTour] = useState(false);
  const [showCalendarTour, setShowCalendarTour] = useState(false);
  const [currentTour, setCurrentTour] = useState(null);

  const handleStartDashboardTour = () => {
    setCurrentTour('dashboard');
    setShowDashboardTour(true);
  };

  const handleStartCalendarTour = () => {
    setCurrentTour('calendar');
    setShowCalendarTour(true);
  };

  const handleTourComplete = () => {
    setShowDashboardTour(false);
    setShowCalendarTour(false);
    setCurrentTour(null);
  };

  const handleTourSkip = () => {
    setShowDashboardTour(false);
    setShowCalendarTour(false);
    setCurrentTour(null);
  };

  return (
    <>
      {/* Help Section in Settings */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Help & Tutorials</h3>
        
        <div className="space-y-3">
          <button
            onClick={handleStartDashboardTour}
            className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Dashboard Tutorial</div>
                <div className="text-sm text-gray-600">Learn how to use focus areas, track time, and get AI help</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={handleStartCalendarTour}
            className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Calendar Tutorial</div>
                <div className="text-sm text-gray-600">Learn how to add, edit, and manage your scheduled sessions</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => {
              // Reset all FTUE and tooltip states so user can see them again
              localStorage.removeItem('hourglassFTUECompleted');
              localStorage.removeItem('hourglassTooltips');
              localStorage.removeItem('hourglassDashboardTourCompleted');
              localStorage.removeItem('hourglassCalendarTourCompleted');
              
              // Show confirmation
              alert('All tutorials have been reset! You will now see the welcome experience again.');
              
              // Redirect to FTUE page directly
              window.location.href = '/ftue-test';
            }}
            className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Reset All Tutorials</div>
                <div className="text-sm text-gray-600">Show all tooltips and tutorials again from the beginning</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Dashboard Tour */}
      <GuidedTour
        steps={dashboardTooltipSteps}
        isActive={showDashboardTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
      />

      {/* Calendar Tour */}
      <GuidedTour
        steps={calendarTooltipSteps}
        isActive={showCalendarTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
      />
    </>
  );
}
