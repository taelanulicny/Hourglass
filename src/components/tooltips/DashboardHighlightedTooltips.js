"use client";

import { useState, useEffect } from 'react';
import { InteractiveHighlightedTooltip } from './HighlightedTooltip';

export function DashboardHighlightedTooltips({ children }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTooltips, setShowTooltips] = useState(false);
  const [isAddFocusAreaOpen, setIsAddFocusAreaOpen] = useState(false);

  // Check if this is the user's first time and should show tooltips
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const hasCompletedFTUE = localStorage.getItem('hourglassFTUECompleted');
    const hasSeenDashboardHelp = localStorage.getItem('hourglassDashboardTourCompleted');
    const hasSeenHighlightedTour = localStorage.getItem('hourglassHighlightedTourCompleted');
    
    // Don't show tooltips if they've already seen the highlighted tour
    if (hasSeenHighlightedTour) {
      return;
    }
    
    // Show tooltips if they completed FTUE but haven't seen dashboard help
    if (hasCompletedFTUE && !hasSeenDashboardHelp && !showTooltips) {
      // Show tooltips after a short delay
      setTimeout(() => {
        setShowTooltips(true);
      }, 1000);
    }
  }, [showTooltips]);

  const tooltipSteps = [
    {
      title: "Welcome to Your Dashboard!",
      description: "This is where you'll manage your focus areas and track your time. Let's take a quick tour of the key features.",
      action: "Let's start exploring!",
      position: "bottom"
    },
    {
      title: "Focus Areas - Your Life Categories",
      description: "These are the main areas of your life that need attention. You can have areas like Study, Fitness, Career, Family, etc.",
      action: "Click on any focus area to see details and track time",
      position: "bottom"
    },
    {
      title: "Add New Focus Areas",
      description: "Click the + button to create new focus areas for different aspects of your life.",
      action: "Click the + button to add your first focus area",
      position: "bottom"
    },
    {
      title: "AI Helper",
      description: "Get personalized advice and suggestions for your focus areas. The AI can help you set goals and plan your time.",
      action: "Try asking the AI for help with your focus areas",
      position: "bottom"
    },
    {
      title: "Time Tracking",
      description: "Log time spent on each focus area to see your progress and stay accountable to your goals.",
      action: "Click on a focus area to start tracking time",
      position: "bottom"
    },
    {
      title: "Data & Insights",
      description: "View detailed statistics and trends for each focus area to understand your time allocation patterns.",
      action: "Explore your data to see how you're spending time",
      position: "bottom"
    },
    {
      title: "Timeline View",
      description: "See your focus areas in a timeline format to visualize your daily and weekly planning.",
      action: "Switch to timeline view to see your day differently",
      position: "bottom"
    }
  ];

  const handleNext = () => {
    if (currentStep < tooltipSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setShowTooltips(false);
    localStorage.setItem('hourglassHighlightedTourCompleted', 'true');
  };

  const handleAddFocusAreaClick = () => {
    setIsAddFocusAreaOpen(true);
    // This would typically open your add focus area modal
    // For now, we'll just mark it as clicked
  };

  if (!showTooltips) {
    return children;
  }

  const currentTooltip = tooltipSteps[currentStep];

  return (
    <>
      {children}
      
      {/* Tooltip Overlays */}
      {currentStep === 0 && (
        <div className="fixed inset-0 bg-black/20 z-40 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 shadow-xl max-w-md text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Welcome to Hourglass! 🎉</h3>
            <p className="text-gray-700 mb-4">Let's take a quick tour of your dashboard to get you started.</p>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Tour →
            </button>
          </div>
        </div>
      )}

      {currentStep === 1 && (
        <InteractiveHighlightedTooltip
          isActive={true}
          content={currentTooltip}
          onNext={handleNext}
          onComplete={handleComplete}
          position={currentTooltip.position}
        >
          <div className="w-full h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-500 text-sm">Focus Areas will appear here</div>
              <div className="text-gray-400 text-xs">Click to see details and track time</div>
            </div>
          </div>
        </InteractiveHighlightedTooltip>
      )}

      {currentStep === 2 && (
        <InteractiveHighlightedTooltip
          isActive={true}
          content={currentTooltip}
          onNext={handleNext}
          onComplete={handleComplete}
          onElementClick={handleAddFocusAreaClick}
          position={currentTooltip.position}
        >
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold cursor-pointer hover:bg-blue-700 transition-colors">
            +
          </div>
        </InteractiveHighlightedTooltip>
      )}

      {currentStep === 3 && (
        <InteractiveHighlightedTooltip
          isActive={true}
          content={currentTooltip}
          onNext={handleNext}
          onComplete={handleComplete}
          position={currentTooltip.position}
        >
          <div className="w-full h-24 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900">AI Helper</div>
                <div className="text-sm text-gray-600">Ask for advice on your focus areas</div>
              </div>
            </div>
          </div>
        </InteractiveHighlightedTooltip>
      )}

      {currentStep === 4 && (
        <InteractiveHighlightedTooltip
          isActive={true}
          content={currentTooltip}
          onNext={handleNext}
          onComplete={handleComplete}
          position={currentTooltip.position}
        >
          <div className="w-full h-20 bg-green-50 rounded-lg border border-green-200 p-3">
            <div className="text-center">
              <div className="text-green-800 text-sm font-medium">Time Tracking</div>
              <div className="text-green-600 text-xs">Click focus areas to log time</div>
            </div>
          </div>
        </InteractiveHighlightedTooltip>
      )}

      {currentStep === 5 && (
        <InteractiveHighlightedTooltip
          isActive={true}
          content={currentTooltip}
          onNext={handleNext}
          onComplete={handleComplete}
          position={currentTooltip.position}
        >
          <div className="w-full h-20 bg-purple-50 rounded-lg border border-purple-200 p-3">
            <div className="text-center">
              <div className="text-purple-800 text-sm font-medium">Data & Insights</div>
              <div className="text-purple-600 text-xs">View your progress and trends</div>
            </div>
          </div>
        </InteractiveHighlightedTooltip>
      )}

      {currentStep === 6 && (
        <InteractiveHighlightedTooltip
          isActive={true}
          content={currentTooltip}
          onNext={handleNext}
          onComplete={handleComplete}
          position={currentTooltip.position}
        >
          <div className="w-full h-20 bg-orange-50 rounded-lg border border-orange-200 p-3">
            <div className="text-center">
              <div className="text-orange-800 text-sm font-medium">Timeline View</div>
              <div className="text-orange-600 text-xs">Visualize your daily planning</div>
            </div>
          </div>
        </InteractiveHighlightedTooltip>
      )}
    </>
  );
}
