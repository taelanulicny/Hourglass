"use client";

import { useState, useEffect } from 'react';

// Highlighted Tooltip that highlights specific areas and shows explanation at bottom
export function HighlightedTooltip({ 
  children, 
  content, 
  isActive = false, 
  onNext, 
  onComplete,
  position = "bottom" // where the highlight should appear relative to the element
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(isActive);
  }, [isActive]);

  if (!isVisible) {
    return children;
  }

  return (
    <>
      {/* Highlighted Element */}
      <div className="relative">
        {children}
        
        {/* Highlight Overlay */}
        <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 rounded-lg animate-pulse pointer-events-none z-40">
          {/* Position indicator */}
          <div className={`absolute ${position === 'top' ? 'bottom-full right-0' : 'top-full right-0'} bg-blue-500 text-white text-xs px-2 py-1 rounded transform translate-y-1`}>
            👆 Click here
          </div>
        </div>
      </div>

      {/* Bottom Explanation Panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-500 shadow-lg z-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {content.title || 'Learn About This Feature'}
              </h3>
              <p className="text-gray-700 mb-3">
                {content.description || 'This is an important feature you should know about.'}
              </p>
              {content.action && (
                <div className="text-sm text-blue-600 font-medium">
                  💡 {content.action}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {onNext && (
                <button
                  onClick={onNext}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next →
                </button>
              )}
              
              {onComplete && (
                <button
                  onClick={onComplete}
                  className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Got it!
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Interactive Highlighted Tooltip that opens the highlighted element when clicked
export function InteractiveHighlightedTooltip({ 
  children, 
  content, 
  isActive = false, 
  onNext, 
  onComplete,
  onElementClick, // callback when the highlighted element is clicked
  position = "bottom"
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenClicked, setHasBeenClicked] = useState(false);

  useEffect(() => {
    setIsVisible(isActive);
  }, [isActive]);

  const handleElementClick = () => {
    setHasBeenClicked(true);
    if (onElementClick) {
      onElementClick();
    }
  };

  if (!isVisible) {
    return children;
  }

  return (
    <>
      {/* Highlighted Element with Click Handler */}
      <div className="relative">
        <div onClick={handleElementClick} className="cursor-pointer">
          {children}
        </div>
        
        {/* Highlight Overlay */}
        <div className={`absolute inset-0 ${hasBeenClicked ? 'bg-green-500/20 border-green-500' : 'bg-blue-500/20 border-blue-500'} border-2 rounded-lg animate-pulse pointer-events-none z-40`}>
          {/* Position indicator */}
          <div className={`absolute ${position === 'top' ? 'bottom-full right-0' : 'top-full right-0'} ${hasBeenClicked ? 'bg-green-500' : 'bg-blue-500'} text-white text-xs px-2 py-1 rounded transform translate-y-1`}>
            {hasBeenClicked ? '✅ Clicked!' : '👆 Click here'}
          </div>
        </div>
      </div>

      {/* Bottom Explanation Panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-500 shadow-lg z-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {content.title || 'Learn About This Feature'}
              </h3>
              <p className="text-gray-700 mb-3">
                {content.description || 'This is an important feature you should know about.'}
              </p>
              {content.action && (
                <div className={`text-sm font-medium ${hasBeenClicked ? 'text-green-600' : 'text-blue-600'}`}>
                  {hasBeenClicked ? '✅ Great! You clicked it!' : '💡 ' + content.action}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {onNext && (
                <button
                  onClick={onNext}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next →
                </button>
              )}
              
              {onComplete && (
                <button
                  onClick={onComplete}
                  className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Got it!
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

