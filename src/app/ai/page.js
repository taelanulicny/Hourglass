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
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <header className="w-full pt-16 pb-3 px-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-gray-900 font-semibold text-lg">AI ASSISTANT</h1>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Focus Area Selector */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <label htmlFor="focus-area-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Focus Area:
          </label>
          <select
            id="focus-area-select"
            value={selectedFocusArea?.label || ''}
            onChange={(e) => {
              const area = focusAreas.find(a => a.label === e.target.value);
              setSelectedFocusArea(area);
            }}
            className="flex-1 p-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        {/* Messages Area */}
        <div 
          ref={messagesRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar"
        >
          {/* Greeting */}
          {showGreeting && selectedFocusArea && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl p-4 max-w-xs">
                <p className="text-gray-700">
                  How can I help you in <strong>"{selectedFocusArea.label}"</strong> right now?
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 019.263 3h4.017c.163 0 .326.02.485.06L17 4m-7 10v-2M7 4H5a2 2 0 00-2 2v6a2 2 0 002 2h2.5" />
                    </svg>
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                    </svg>
                  </button>
                </div>
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
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-3">
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 019.263 3h4.017c.163 0 .326.02.485.06L17 4m-7 10v-2M7 4H5a2 2 0 00-2 2v6a2 2 0 002 2h2.5" />
                      </svg>
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                      </svg>
                    </button>
                  </div>
                )}
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

      {/* Input Area - ChatGPT Style */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="max-w-md mx-auto">
          <div className="flex items-end gap-3">
            <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={selectedFocusArea ? `Ask me anything about ${selectedFocusArea.label}...` : "Select a focus area first..."}
                disabled={!selectedFocusArea || loading}
                className="w-full p-3 pr-12 bg-gray-100 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 text-sm"
                rows="1"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
              <button 
                onClick={send}
                disabled={!input.trim() || !selectedFocusArea || loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M9 8h6m-6 4h6m-6 4h4" />
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
