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
  
  // State for file uploads
  const [attachedFiles, setAttachedFiles] = useState([]);
  const fileInputRef = useRef(null);
  
  // Load focus areas on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("focusCategories");
      const parsed = raw ? JSON.parse(raw) : [];
      const areas = Array.isArray(parsed) ? parsed : [];
      setFocusAreas(areas);
      
      // Try to restore last selected focus area
      if (areas.length > 0 && !selectedFocusArea) {
        try {
          const lastFocusAreaLabel = localStorage.getItem("aiLastFocusArea");
          if (lastFocusAreaLabel) {
            const lastArea = areas.find(area => area.label === lastFocusAreaLabel);
            if (lastArea) {
              setSelectedFocusArea(lastArea);
              return;
            }
          }
        } catch (error) {
          console.warn('Failed to load last focus area:', error);
        }
        
        // Fallback to first focus area if no last one found
        setSelectedFocusArea(areas[0]);
      }
    } catch (error) {
      console.warn('Failed to load focus areas:', error);
      setFocusAreas([]);
    }
  }, []);

  // Save selected focus area to localStorage
  useEffect(() => {
    if (selectedFocusArea) {
      try {
        localStorage.setItem("aiLastFocusArea", selectedFocusArea.label);
      } catch (error) {
        console.warn('Failed to save last focus area:', error);
      }
    }
  }, [selectedFocusArea]);

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

  // Disable resource requests - focus on conversation about focus area
  const isResourceRequest = (input) => {
    return false; // Always treat as regular conversation
  };

  // Send message function
  async function send() {
    if ((!input.trim() && attachedFiles.length === 0) || loading || !selectedFocusArea) return;
    
    const trimmedInput = input.trim();
    if (trimmedInput.length > 500) {
      setHistory(prev => [...prev, { 
        role: "assistant", 
        content: "Your message is too long. Please keep it under 500 characters for better responses." 
      }]);
      return;
    }
    
    // Create user message with file attachments
    const userMessage = {
      role: "user", 
      content: trimmedInput,
      attachments: attachedFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }))
    };
    
    const nextHistory = [...history, userMessage];
    setHistory(nextHistory);
    setInput("");
    setAttachedFiles([]); // Clear attached files after sending
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

  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      file: file,
      name: file.name,
      size: file.size,
      type: file.type
    }));
    setAttachedFiles(prev => [...prev, ...newFiles]);
  };

  // Remove attached file
  const removeFile = (fileId) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <header className="w-full pt-16 pb-3 px-4 flex items-center justify-center border-b border-gray-100">
        <h1 className="text-gray-900 font-bold text-lg tracking-widest">AI ASSISTANT</h1>
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
          className="flex-1 overflow-y-auto p-4 pb-56 space-y-6 no-scrollbar"
        >
          {/* Greeting */}
          {showGreeting && selectedFocusArea && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-2xl p-4 max-w-xs">
                <p className="text-white">
                  Hi! I'm here to help you with <strong>"{selectedFocusArea.label}"</strong>. What would you like to work on or discuss today?
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
                  : 'bg-gray-700 text-white'
              }`}>
                {message.content && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    className={`prose prose-sm max-w-none ${message.role === 'assistant' ? 'prose-invert' : ''}`}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.attachments.map((attachment, attIndex) => (
                      <div key={attIndex} className={`text-xs p-2 rounded ${
                        message.role === 'user' 
                          ? 'bg-blue-400 text-white' 
                          : 'bg-gray-600 text-white'
                      }`}>
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="truncate">{attachment.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-2xl p-4 max-w-xs">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="text-white">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area - ChatGPT Style */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="max-w-md mx-auto">
          {/* Attached Files Display */}
          {attachedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {attachedFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-end gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-3 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors flex items-center justify-center"
              style={{ minHeight: '44px' }}
            >
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
                className="w-full p-3 pr-12 bg-gray-100 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 text-base"
                rows="1"
                style={{ minHeight: '44px', maxHeight: '120px', fontSize: '16px' }}
              />
              <button 
                onClick={send}
                disabled={(!input.trim() && attachedFiles.length === 0) || !selectedFocusArea || loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 p-3 pb-7 bg-white border-t border-gray-100 z-[9999]">
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
