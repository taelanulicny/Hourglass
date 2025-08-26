"use client";

import { useState, useEffect } from 'react';

export default function LifeReflectionScreen({ onNext, onBack, focusAreas: initialFocusAreas = [] }) {
  const [focusAreas, setFocusAreas] = useState(initialFocusAreas);
  const [currentInput, setCurrentInput] = useState('');
  const [showExamples, setShowExamples] = useState(false);

  // Common focus area suggestions
  const suggestions = [
    'Study', 'LSAT', 'Fitness', 'Career', 'Business', 'Creative', 
    'Health', 'Family', 'Finance', 'Language', 'Music', 'Writing',
    'Coding', 'Design', 'Marketing', 'Sales', 'Research', 'Teaching'
  ];

  const handleAddFocusArea = () => {
    if (currentInput.trim() && focusAreas.length < 6) {
      setFocusAreas([...focusAreas, currentInput.trim()]);
      setCurrentInput('');
    }
  };

  const handleRemoveFocusArea = (index) => {
    setFocusAreas(focusAreas.filter((_, i) => i !== index));
  };

  const handleSuggestionClick = (suggestion) => {
    if (!focusAreas.includes(suggestion) && focusAreas.length < 6) {
      setFocusAreas([...focusAreas, suggestion]);
    }
  };

  // Update local state when prop changes (e.g., when going back from later steps)
  useEffect(() => {
    setFocusAreas(initialFocusAreas);
  }, [initialFocusAreas]);

  const canContinue = focusAreas.length >= 1;

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
            Life Reflection
          </h1>
          <div className="w-6"></div> {/* Spacer for centering */}
        </div>
        <p className="text-lg text-gray-600">
          What are the main areas of your life that need attention?
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="w-full px-6 mb-6">
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
        <p className="text-center text-sm text-gray-500 mt-2">Step 2 of 5</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-6 pb-20">


        {/* Focus Areas Input */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-gray-900 mb-3">
            What are your main focus areas?
          </label>
          <p className="text-gray-600 mb-4">
            Think about what you want to improve or spend time on daily. 
            You can add 1-6 focus areas.
          </p>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddFocusArea()}
              placeholder="e.g., Study, Fitness, Career..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={focusAreas.length >= 6}
            />
            <button
              onClick={handleAddFocusArea}
              disabled={!currentInput.trim() || focusAreas.length >= 6}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Add
            </button>
          </div>

          {/* Current Focus Areas */}
          {focusAreas.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Your focus areas:</p>
              <div className="flex flex-wrap gap-2">
                {focusAreas.map((area, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg"
                  >
                    <span className="text-sm font-medium">{area}</span>
                    <button
                      onClick={() => handleRemoveFocusArea(index)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="mb-4">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
            >
              {showExamples ? 'Hide' : 'Show'} common examples
            </button>
            
            {showExamples && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-3">Click to add:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={focusAreas.includes(suggestion) || focusAreas.length >= 6}
                      className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
            onClick={() => onNext({ focusAreas })}
            disabled={!canContinue}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Next: Sleep Foundation →
          </button>
        </div>
      </div>
    </div>
  );
}
