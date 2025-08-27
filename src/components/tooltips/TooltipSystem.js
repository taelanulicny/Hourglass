"use client";

import { useState, useEffect } from 'react';

// Tooltip component
export function Tooltip({ 
  children, 
  content, 
  position = "bottom", 
  show = false, 
  onShow, 
  onHide,
  className = ""
}) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  const handleMouseEnter = () => {
    if (onShow) onShow();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (onHide) onHide();
    setIsVisible(false);
  };

  const positionClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2"
  };

  const arrowClasses = {
    top: "top-full left-1/2 transform -translate-x-1/2 border-t-gray-800",
    bottom: "bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-800",
    left: "left-full top-1/2 transform -translate-y-1/2 border-l-gray-800",
    right: "right-full top-1/2 transform -translate-y-1/2 border-r-gray-800"
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 max-w-xs shadow-lg">
            {content}
            <div className={`absolute w-0 h-0 border-4 border-transparent ${arrowClasses[position]}`}></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Guided tour component
export function GuidedTour({ 
  steps = [], 
  isActive = false, 
  onComplete, 
  onSkip 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      setCurrentStep(0);
    }
  }, [isActive]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    if (onComplete) onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    if (onSkip) onSkip();
  };

  if (!isVisible || !steps[currentStep]) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md mx-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">{currentStep + 1}</span>
            </div>
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {step.title}
          </h3>
          <p className="text-gray-600 mb-4">
            {step.description}
          </p>
          
          {step.action && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 font-medium">
                {step.action}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          
          <div className="flex gap-2">
            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// First-time user tooltip manager
export function useFirstTimeTooltips() {
  const [hasSeenTooltips, setHasSeenTooltips] = useState({});
  const [currentTooltip, setCurrentTooltip] = useState(null);

  useEffect(() => {
    // Load tooltip state from localStorage
    const saved = localStorage.getItem('hourglassTooltips');
    if (saved) {
      try {
        setHasSeenTooltips(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed to parse tooltip state:', e);
      }
    }
  }, []);

  const markTooltipSeen = (tooltipId) => {
    const updated = { ...hasSeenTooltips, [tooltipId]: true };
    setHasSeenTooltips(updated);
    localStorage.setItem('hourglassTooltips', JSON.stringify(updated));
  };

  const showTooltip = (tooltipId) => {
    if (!hasSeenTooltips[tooltipId]) {
      setCurrentTooltip(tooltipId);
      return true;
    }
    return false;
  };

  const hideTooltip = () => {
    setCurrentTooltip(null);
  };

  const resetAllTooltips = () => {
    setHasSeenTooltips({});
    localStorage.removeItem('hourglassTooltips');
  };

  return {
    hasSeenTooltips,
    currentTooltip,
    markTooltipSeen,
    showTooltip,
    hideTooltip,
    resetAllTooltips
  };
}

// Dashboard tooltip steps
export const dashboardTooltipSteps = [
  {
    id: 'focus-areas-intro',
    title: 'Focus Areas',
    description: 'These are the main areas of your life that need attention and time management.',
    action: 'You can add new focus areas using the + button below.'
  },
  {
    id: 'add-focus-area',
    title: 'Add Focus Areas',
    description: 'Click the + button to create new focus areas for things like study, fitness, career, etc.',
    action: 'Try adding your first focus area now!'
  },
  {
    id: 'focus-area-details',
    title: 'Explore Focus Areas',
    description: 'Click on any focus area to see detailed progress, set goals, and access the AI helper.',
    action: 'Click into one of your focus areas to explore!'
  },
  {
    id: 'ai-helper',
    title: 'AI Helper',
    description: 'Each focus area has an AI assistant that can help you plan sessions, adjust goals, and get productivity tips.',
    action: 'Ask the AI for help with your focus area!'
  },
  {
    id: 'time-tracking',
    title: 'Time Tracking',
    description: 'Use the timer or manually log hours to track your progress toward daily goals.',
    action: 'Start tracking time for your focus areas!'
  }
];

// Calendar tooltip steps
export const calendarTooltipSteps = [
  {
    id: 'calendar-intro',
    title: 'Calendar View',
    description: 'Plan and schedule your focus area sessions here.',
    action: 'This is where you\'ll organize your time.'
  },
  {
    id: 'add-event',
    title: 'Add Events',
    description: 'Click the + button to create new events and schedule your focus area sessions.',
    action: 'Try adding your first scheduled session!'
  },
  {
    id: 'edit-events',
    title: 'Edit Events',
    description: 'Click on any event to edit the time, date, or details.',
    action: 'Click an event to see editing options.'
  },
  {
    id: 'drag-events',
    title: 'Move Events',
    description: 'Drag events to different times or dates to reschedule them.',
    action: 'Try dragging an event to a new time!'
  }
];


