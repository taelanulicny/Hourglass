"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

export default function AiAssistantPage() {
  const router = useRouter();
  const messagesRef = useRef(null);
  
  // State for focus areas
  const [focusAreas, setFocusAreas] = useState([]);
  const [selectedFocusArea, setSelectedFocusArea] = useState(null);
  
  // State for AI chat
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // Load focus areas on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("focusCategories");
      const parsed = raw ? JSON.parse(raw) : [];
      const areas = Array.isArray(parsed) ? parsed : [];
      setFocusAreas(areas);
      
      // Set first focus area as default if available
      if (areas.length > 0 && !selectedFocusArea) {
        setSelectedFocusArea(areas[0]);
      }
    } catch (error) {
      console.warn('Failed to load focus areas:', error);
      setFocusAreas([]);
    }
  }, []);

  // Load chat history when focus area changes
  useEffect(() => {
    if (!selectedFocusArea) return;
    
    const STORAGE_KEY = `aiHistory:${selectedFocusArea.label}`;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
          setShowHistory(parsed.length > 0);
        } else {
          setHistory([]);
          setShowHistory(false);
        }
      } else {
        setHistory([]);
        setShowHistory(false);
      }
    } catch (error) {
      console.warn('Failed to load chat history:', error);
      setHistory([]);
      setShowHistory(false);
    }
    
    // Show greeting when switching focus areas
    setShowGreeting(true);
  }, [selectedFocusArea]);

  // Save chat history when it changes
  useEffect(() => {
    if (!selectedFocusArea || history.length === 0) return;
    
    const STORAGE_KEY = `aiHistory:${selectedFocusArea.label}`;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save chat history:', error);
    }
  }, [history, selectedFocusArea]);

  // Scroll to bottom helper
  function scrollToBottom(smooth = false) {
    const el = messagesRef.current;
    if (el) {
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }

  // Scroll when history changes
  useEffect(() => {
    if (history.length > 0 || loading) {
      scrollToBottom(true);
    }
  }, [history, loading, showGreeting]);

  // Handle scroll events
  const handleScroll = () => {
    const el = messagesRef.current;
    if (el) {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setIsAtBottom(atBottom);
    }
  };

  // Check if input is a resource request
  const isResourceRequest = (input) => {
    const lowerInput = input.toLowerCase().trim();
    
    const excludeKeywords = /\b(how to|what is|when|where|why|help me with|advice|tips|guidance|time|schedule|plan|goal|focus|productivity|show me|tell me|explain|can you|please|thanks|thank you|hi|hello|hey)\b/.test(lowerInput);
    
    if (lowerInput.length <= 2) return false;
    
    const nonTopics = /\b(ok|yes|no|maybe|sure|fine|good|bad|great|awesome|cool|nice|wow|oh|ah|um|hmm|well|so|but|and|or|the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall|here|there|this|that|these|those|me|you|him|her|us|them|my|your|his|her|our|their|mine|yours|ours|theirs)\b/.test(lowerInput);
    
    if (excludeKeywords || nonTopics) return false;
    
    const wordCount = lowerInput.split(/\s+/).length;
    if (wordCount <= 3) return true;
    
    const topicIndicators = /\b(about|on|regarding|concerning|related to|in the field of|for|learn|study|research|explore|discover|understand|master|improve|get into|dive into)\b/.test(lowerInput);
    
    return topicIndicators;
  };

  // Send message function
  async function send() {
    if (!input.trim() || loading || !selectedFocusArea) return;
    
    const trimmedInput = input.trim();
    if (trimmedInput.length > 500) {
      setHistory(prev => [...prev, { 
        role: "assistant", 
        content: "Your message is too long. Please keep it under 500 characters for better responses." 
      }]);
      return;
    }
    
    const nextHistory = [...history, { role: "user", content: trimmedInput }];
    setHistory(nextHistory);
    setInput("");
    setLoading(true);
    setShowGreeting(false);
    setShowHistory(true);
    
    // Check if this is a resource request
    if (isResourceRequest(trimmedInput)) {
      try {
        const response = await fetch('/api/ai/resources/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: trimmedInput }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch resources');
        }

        setHistory(prev => [...prev, { 
          role: "assistant", 
          content: `I've found resources for **${trimmedInput}**! Here are 5 books, 5 people, and 5 podcasts to help you dive deep into this topic.`
        }]);
      } catch (error) {
        console.error('Resource request failed:', error);
        
        setHistory(prev => [...prev, { 
          role: "assistant", 
          content: `I'd love to help you find resources about **${trimmedInput}**! Please try searching for "${trimmedInput}" to see books, people, and podcasts on this topic.`
        }]);
      } finally {
        setLoading(false);
      }
    } else {
      // Regular chat request
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: nextHistory,
            focusContext: {
              name: selectedFocusArea.label,
              goal: selectedFocusArea.goal,
              weekLogged: selectedFocusArea.timeSpent || 0,
              leftToday: (selectedFocusArea.goal || 0) - ((selectedFocusArea.days?.[new Date().toLocaleDateString('en-US', { weekday: 'short' })]) || 0)
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        setHistory(prev => [...prev, { 
          role: "assistant", 
          content: data.message 
        }]);
      } catch (error) {
        console.error('AI request failed:', error);
        
        let errorMessage = "I'm having trouble connecting right now. ";
        
        if (error.message.includes('quota') || error.message.includes('429')) {
          errorMessage += "It looks like I've reached my usage limit for today. I can still help you with some general advice though! ";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += "There seems to be a network issue. Please check your connection and try again. ";
        } else {
          errorMessage += "Please try again in a moment. ";
        }
        
        setHistory(prev => [...prev, { 
          role: "assistant", 
          content: errorMessage + "In the meantime, feel free to ask me about your focus area goals, time management, or productivity tips!"
        }]);
      } finally {
        setLoading(false);
      }
    }
  }

  // Handle enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 pb-32 font-sans">
      {/* Header */}
      <header className="w-full pt-16 pb-3 px-4 flex justify-center items-center relative">
        <h1 className="text-gray-900 font-bold text-lg tracking-widest">AI ASSISTANT</h1>
        <div className="absolute right-4">
          <Link
            href="/settings"
            title="Settings"
            aria-label="Settings"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Focus Area Selector */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
          <label htmlFor="focus-area-select" className="block text-sm font-medium text-gray-700 mb-2">
            Focus Area
          </label>
          <select
            id="focus-area-select"
            value={selectedFocusArea?.label || ''}
            onChange={(e) => {
              const area = focusAreas.find(a => a.label === e.target.value);
              setSelectedFocusArea(area);
            }}
            className="w-full p-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {focusAreas.length === 0 ? (
              <option value="">No focus areas found</option>
            ) : (
              focusAreas.map((area) => (
                <option key={area.label} value={area.label}>
                  {area.label}
                </option>
              ))
            )}
          </select>
          {selectedFocusArea && (
            <div className="mt-2 text-sm text-gray-600">
              <div>Daily Goal: {selectedFocusArea.goal || 0} hours</div>
              <div>Time logged this week: {selectedFocusArea.timeSpent || 0} hours</div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface - Direct on Background */}
      <div className="px-4 flex-1 flex flex-col">
        {/* Messages Area */}
        <div 
          ref={messagesRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar min-h-96"
        >
          {/* Greeting */}
          {showGreeting && selectedFocusArea && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl p-4 max-w-xs">
                <p className="text-gray-700">
                  How can I help you in <strong>"{selectedFocusArea.label}"</strong> right now?
                </p>
              </div>
            </div>
          )}

          {/* Chat History */}
          {showHistory && history.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-2xl p-4 max-w-xs ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  className="prose prose-sm max-w-none"
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl p-4 max-w-xs">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span className="text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed above navigation */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="max-w-md mx-auto">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedFocusArea ? `Ask me anything about ${selectedFocusArea.label}...` : "Select a focus area first..."}
              disabled={!selectedFocusArea || loading}
              className="flex-1 p-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              rows="2"
            />
            <button
              onClick={send}
              disabled={!input.trim() || !selectedFocusArea || loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 p-3 pb-7 z-[9999]">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
          <Link
            href="/"
            className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm grid place-items-center"
          >
            Dashboard
          </Link>
          <Link
            href="/calendar"
            className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm grid place-items-center"
          >
            Calendar
          </Link>
          <button
            className="h-12 w-full rounded-2xl bg-gray-900 text-white font-semibold shadow-lg grid place-items-center justify-center"
            aria-current="page"
            disabled
          >
            AI Assistant
          </button>
        </div>
      </nav>

      {/* No-scrollbar utility styles */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
