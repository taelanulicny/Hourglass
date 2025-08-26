"use client";

import { useState, useEffect } from 'react';
import { Tooltip, GuidedTour, useFirstTimeTooltips, dashboardTooltipSteps } from './TooltipSystem';

export function DashboardTooltips({ children }) {
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [showHelpButton, setShowHelpButton] = useState(false);
  
  const {
    hasSeenTooltips,
    currentTooltip,
    markTooltipSeen,
    showTooltip,
    hideTooltip,
    resetAllTooltips
  } = useFirstTimeTooltips();

  // Check if this is the user's first time
  useEffect(() => {
    const hasCompletedFTUE = localStorage.getItem('hourglassFTUECompleted');
    const hasSeenDashboardHelp = hasSeenTooltips['dashboard-intro'];
    const hasCompletedTour = localStorage.getItem('hourglassDashboardTourCompleted');
    
    // Only show tour if they completed FTUE AND haven't seen dashboard help AND haven't completed tour
    if (hasCompletedFTUE && !hasSeenDashboardHelp && !hasCompletedTour) {
      // Show welcome tour after a short delay
      setTimeout(() => {
        setShowWelcomeTour(true);
      }, 1000);
    }
    
    // Only show help button if they've completed FTUE (not for brand new users)
    setShowHelpButton(!!hasCompletedFTUE);
  }, [hasSeenTooltips]);

  const handleTourComplete = () => {
    setShowWelcomeTour(false);
    markTooltipSeen('dashboard-intro');
    // Also mark in localStorage to ensure it persists
    localStorage.setItem('hourglassDashboardTourCompleted', 'true');
  };

  const handleTourSkip = () => {
    setShowWelcomeTour(false);
    markTooltipSeen('dashboard-intro');
    // Also mark in localStorage to ensure it persists
    localStorage.setItem('hourglassDashboardTourCompleted', 'true');
  };

  const startTour = () => {
    setShowWelcomeTour(true);
  };

  return (
    <div className="relative">
      {/* Help Button */}
      {showHelpButton && (
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={startTour}
            className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200"
            title="Get help with the dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      )}

      {/* Welcome Tour */}
      <GuidedTour
        steps={dashboardTooltipSteps}
        isActive={showWelcomeTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
      />

      {/* Render children with tooltip context */}
      {children}
    </div>
  );
}

// Individual tooltip components for specific dashboard elements
export function FocusAreasIntroTooltip({ children }) {
  const { showTooltip, hideTooltip, currentTooltip } = useFirstTimeTooltips();
  
  return (
    <Tooltip
      content="These are your focus areas - the main areas of your life that need attention and time management."
      position="bottom"
      show={currentTooltip === 'focus-areas-intro'}
      onShow={() => showTooltip('focus-areas-intro')}
      onHide={hideTooltip}
    >
      {children}
    </Tooltip>
  );
}

export function AddFocusAreaTooltip({ children }) {
  const { showTooltip, hideTooltip, currentTooltip } = useFirstTimeTooltips();
  
  return (
    <Tooltip
      content="Click here to add new focus areas for things like study, fitness, career, etc."
      position="bottom"
      show={currentTooltip === 'add-focus-area'}
      onShow={() => showTooltip('add-focus-area')}
      onHide={hideTooltip}
    >
      {children}
    </Tooltip>
  );
}

export function FocusAreaClickTooltip({ children }) {
  const { showTooltip, hideTooltip, currentTooltip } = useFirstTimeTooltips();
  
  return (
    <Tooltip
      content="Click on any focus area to see detailed progress, set goals, and access the AI helper."
      position="bottom"
      show={currentTooltip === 'focus-area-details'}
      onShow={() => showTooltip('focus-area-details')}
      onHide={hideTooltip}
    >
      {children}
    </Tooltip>
  );
}

export function AIHelperTooltip({ children }) {
  const { showTooltip, hideTooltip, currentTooltip } = useFirstTimeTooltips();
  
  return (
    <Tooltip
      content="Each focus area has an AI assistant that can help you plan sessions, adjust goals, and get productivity tips."
      position="bottom"
      show={currentTooltip === 'ai-helper'}
      onShow={() => showTooltip('ai-helper')}
      onHide={hideTooltip}
    >
      {children}
    </Tooltip>
  );
}

export function TimeTrackingTooltip({ children }) {
  const { showTooltip, hideTooltip, currentTooltip } = useFirstTimeTooltips();
  
  return (
    <Tooltip
      content="Use the timer or manually log hours to track your progress toward daily goals."
      position="bottom"
      show={currentTooltip === 'time-tracking'}
      onShow={() => showTooltip('time-tracking')}
      onHide={hideTooltip}
    >
      {children}
    </Tooltip>
  );
}
