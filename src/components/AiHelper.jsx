import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

function AiHelper({ focusAreaId, focusContext, onResourceClick, onPersonClick, onSearchResources }) {
  // unique storage key per focus area
  const STORAGE_KEY = `aiHistory:${focusAreaId}`;
  const messagesRef = useRef(null);

  // your existing state:
  const [history, setHistory] = useState([]);   // per-area chat history (already keyed per area)
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResourceData, setLastResourceData] = useState(null); // Store resource data for vault integration
  const [showResources, setShowResources] = useState(false); // Show resources in AI helper

  // --- NEW: ephemeral greeting shown on each open, NOT saved in history ---
  const [showGreeting, setShowGreeting] = useState(true);
  const [showHistory, setShowHistory] = useState(false); // Hide history initially
  const [isAtBottom, setIsAtBottom] = useState(true);
  const greetingText = `How can I help you in "${focusContext?.name ?? "this focus area"}" right now?`;

  // jump to bottom helper with smooth scrolling
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

  // When switching focus areas: show greeting again and hide history initially
  useEffect(() => {
    setShowGreeting(true);       // show greeting every time you open a focus area
    setShowHistory(false);       // hide history initially
    setShowResources(false);     // hide resources when switching areas
    setLastResourceData(null);   // clear resource data
    // defer scroll until content paints, then scroll smoothly
    const id = setTimeout(() => scrollToBottom(true), 100);
    return () => clearTimeout(id);
  }, [focusAreaId]);

  // Also scroll when history changes (new messages) - smooth scroll for new messages
  useEffect(() => {
    if (history.length > 0 || loading) {
      scrollToBottom(true);
    }
  }, [history, loading, showGreeting]);

  // Handle scroll detection with clean view logic
  const handleScroll = () => {
    const el = messagesRef.current;
    if (el) {
      const isAtBottomNow = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
      setIsAtBottom(isAtBottomNow);
      
      // If scrolled into the extra space at the bottom, return to clean view
      if (showHistory && el.scrollTop > el.scrollHeight - el.clientHeight + 20) {
        setShowHistory(false);
        setShowGreeting(true);
        setTimeout(() => scrollToBottom(true), 100);
      }
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out any old greeting messages that say "today" instead of "right now"
          const filteredHistory = parsed.filter(msg => 
            !(msg.role === "assistant" && 
              (msg.content.includes("today") || msg.content.includes("Hi! I'm your AI assistant")))
          );
          setHistory(filteredHistory);
          return;
        }
      }
    } catch {}
    // if nothing stored, start fresh for this focus area
    setHistory([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAreaId]); // <- critical: change history when switching areas

  // persist this focus area's history only under its own key
  useEffect(() => {
    // Only save if we have actual conversation content
    if (history.length > 0) {
      try { 
        console.log(`Saving ${history.length} messages for ${focusAreaId}:`, history);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); 
      } catch (error) {
        console.warn('Error saving chat history:', error);
      }
    } else {
      console.log(`Not saving - no conversation content for ${focusAreaId}`);
    }
  }, [STORAGE_KEY, history, focusAreaId]);


  // Check if the input is a topic/subject that should get resources
  const isResourceRequest = (input) => {
    const lowerInput = input.toLowerCase().trim();
    
    // Exclude obvious non-topic requests (advice, questions, commands)
    const excludeKeywords = /\b(how to|what is|when|where|why|help me with|advice|tips|guidance|time|schedule|plan|goal|focus|productivity|show me|tell me|explain|can you|please|thanks|thank you|hi|hello|hey)\b/.test(lowerInput);
    
    // Exclude very short non-words (1-2 characters)
    if (lowerInput.length <= 2) return false;
    
    // Exclude common non-topic words
    const nonTopics = /\b(ok|yes|no|maybe|sure|fine|good|bad|great|awesome|cool|nice|wow|oh|ah|um|hmm|well|so|but|and|or|the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall|here|there|this|that|these|those|me|you|him|her|us|them|my|your|his|her|our|their|mine|yours|ours|theirs)\b/.test(lowerInput);
    
    // If it's a clear non-topic request, don't treat as resource request
    if (excludeKeywords || nonTopics) return false;
    
    // If it's a single word or short phrase (1-3 words), likely a topic
    const wordCount = lowerInput.split(/\s+/).length;
    if (wordCount <= 3) return true;
    
    // For longer phrases, check if it contains topic-like words
    const topicIndicators = /\b(about|on|regarding|concerning|related to|in the field of|for|learn|study|research|explore|discover|understand|master|improve|get into|dive into)\b/.test(lowerInput);
    
    return topicIndicators;
  };

  async function send() {
    if (!input.trim() || loading) return;
    
    // Input validation
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
    setShowHistory(true); // Show history when user starts conversation
    
    // Check if this is a structured resource request
    if (isResourceRequest(trimmedInput)) {
      // Fetch resources directly and display them
      try {
        const response = await fetch('/api/ai/resources/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: trimmedInput }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        // Store resource data and show resources
        setLastResourceData(data);
        setShowResources(true);
        
        // Show confirmation message
        setHistory(prev => [...prev, { 
          role: "assistant", 
          content: `I've found resources for **${trimmedInput}**! Here are 5 books, 5 people, and 5 podcasts to help you dive deep into this topic.`
        }]);
      } catch (error) {
        console.error('Resource request failed:', error);
        
        // Fallback message
        setHistory(prev => [...prev, { 
          role: "assistant", 
          content: `I'd love to help you find resources about **${trimmedInput}**! Please go to the Discover page and search for "${trimmedInput}" to see books, people, and podcasts on this topic.`
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
            focusContext: focusContext
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
        
        // Provide user-friendly error messages based on error type
        let errorMessage = "I'm having trouble connecting right now. ";
        
        if (error.message.includes('quota') || error.message.includes('429')) {
          errorMessage += "It looks like I've reached my usage limit for today. I can still help you with some general advice though! ";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += "There seems to be a network issue. Please check your connection and try again. ";
        } else {
          errorMessage += "Please try again in a moment. ";
        }
        
        // Add helpful fallback advice
        const focusArea = focusContext?.name || 'your focus area';
        const dailyGoal = focusContext?.goal || 'your daily goal';
        
        errorMessage += `\n\nHere's some quick advice for "${focusArea}":\n\n`;
        errorMessage += `• Focus on progress over perfection\n`;
        errorMessage += `• Break your ${dailyGoal}-hour goal into smaller chunks\n`;
        errorMessage += `• Take breaks to maintain energy\n`;
        errorMessage += `• Track what works and what doesn't\n\n`;
        errorMessage += `Try asking me again in a few minutes, or let me know what specific help you need!`;
        
        setHistory(prev => [...prev, { 
          role: "assistant", 
          content: errorMessage
        }]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="ai-helper">
      {/* AI Helper Header */}
      <div className="ai-header">
        <div className="ai-title">
          <span className="ai-text">Focus Area Specific AI Assistant</span>
        </div>
      </div>
      
      <div className="relative">
        <div
          ref={messagesRef}
          className="ai-messages scrollbar-hide"
          style={{ 
            maxHeight: 320, 
            overflowY: "auto", 
            display: "flex", 
            flexDirection: "column", 
            gap: 6
          }}
          onScroll={handleScroll}
        >
        {/* Render saved conversation - only show when user has started conversation */}
        {showHistory && history.map((m, i) => (
          <div key={i} className={m.role === "assistant" ? "msg assistant" : "msg user"}>
            {m.role === "assistant" ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  h1: ({node, ...props}) => <h3 {...props} />,
                  h2: ({node, ...props}) => <h4 {...props} />,
                  h3: ({node, ...props}) => <h5 {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 my-1" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-1" {...props} />,
                  li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                }}
              >
                {m.content}
              </ReactMarkdown>
            ) : (
              m.content
            )}
          </div>
        ))}

        {/* Ephemeral greeting bubble (not saved) shows on every open */}
        {showGreeting && (
          <div className="msg assistant greeting">
            {greetingText}
          </div>
        )}

        {/* Enhanced loading indicator */}
        {loading && (
          <div className="msg assistant typing-indicator flex items-center gap-2">
            <div className="ai-loading"></div>
            <span>Thinking…</span>
          </div>
        )}
        
        {/* Extra scrollable space to trigger clean view */}
        {showHistory && (
          <div className="h-32"></div>
        )}
        </div>

        {/* Resource Display */}
        {showResources && lastResourceData && (
          <div className="mt-4 space-y-4">
            {/* Books Section */}
            {lastResourceData.books && lastResourceData.books.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-lg font-semibold mb-3">📚 Books</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {lastResourceData.books.map((book, index) => (
                    <div key={index} className="flex-shrink-0 w-64">
                      <div 
                        className="block rounded-xl border hover:shadow-sm bg-white p-4 cursor-pointer h-24 relative"
                        onClick={() => onResourceClick && onResourceClick({
                          title: book.title,
                          desc: book.desc,
                          url: book.url,
                          type: 'book',
                          author: book.author
                        })}
                      >
                        <div className="flex items-start gap-3 h-full">
                          <div className="text-2xl flex-shrink-0 mt-0.5">📖</div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="font-semibold leading-snug text-base line-clamp-1 mb-1">{book.title}</div>
                            <div className="text-sm text-gray-600 line-clamp-2">by {book.author}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* People Section */}
            {lastResourceData.social && lastResourceData.social.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-lg font-semibold mb-3">👥 People & Influencers</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {lastResourceData.social.map((person, index) => (
                    <div key={index} className="flex-shrink-0 w-64">
                      <div 
                        className="block rounded-xl border hover:shadow-sm bg-white p-4 cursor-pointer h-24 relative"
                        onClick={() => onPersonClick && onPersonClick({
                          name: person.name,
                          desc: person.desc,
                          socialLinks: person.socialLinks,
                          type: 'person'
                        })}
                      >
                        <div className="flex items-start gap-3 h-full">
                          <div className="text-2xl flex-shrink-0 mt-0.5">👤</div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="font-semibold leading-snug text-base line-clamp-1 mb-1">{person.name}</div>
                            <div className="text-sm text-gray-500 line-clamp-2">{person.desc}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Podcasts Section */}
            {lastResourceData.podcasts && lastResourceData.podcasts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-lg font-semibold mb-3">🎧 Podcasts</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {lastResourceData.podcasts.map((podcast, index) => (
                    <div key={index} className="flex-shrink-0 w-64">
                      <div 
                        className="block rounded-xl border hover:shadow-sm bg-white p-4 cursor-pointer h-24 relative"
                        onClick={() => onResourceClick && onResourceClick({
                          title: podcast.title,
                          desc: podcast.desc,
                          url: podcast.url,
                          type: 'podcast',
                          spotifyUrl: podcast.spotifyUrl
                        })}
                      >
                        <div className="flex items-start gap-3 h-full">
                          <div className="text-2xl flex-shrink-0 mt-0.5">🎧</div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="font-semibold leading-snug text-base line-clamp-1 mb-1">{podcast.title}</div>
                            <div className="text-sm text-gray-500 line-clamp-2">{podcast.desc}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Action buttons - show when there's content */}
        {((showHistory && history.length > 0) || showGreeting) && (
          <div className="absolute bottom-2 right-2 flex gap-2 z-10">
            {/* View history button - show when there's history but not currently visible */}
            {history.length > 0 && !showHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="bg-gray-400 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-gray-500 transition-colors"
                aria-label="View previous conversation"
                title={`View previous conversation (${history.length} messages)`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
            
            {/* Scroll to bottom button - only show when not at bottom */}
            {!isAtBottom && (
              <button
                onClick={() => scrollToBottom(true)}
                className="bg-[#8CA4AF] text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-[#7A939F] transition-colors"
                aria-label="Scroll to bottom"
                title="Scroll to bottom"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="ai-input">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask for advice about ${focusContext?.name ?? "this area"}…`}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
            maxLength={500}
          />
          {input.length > 400 && (
            <div className="absolute -top-6 right-0 text-xs text-gray-500">
              {input.length}/500
            </div>
          )}
        </div>
        <button 
          onClick={send} 
          disabled={loading || !input.trim()}
          className="flex items-center gap-1"
        >
          {loading ? (
            <div className="ai-loading w-3 h-3"></div>
          ) : (
            <>
              <span>Send</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default AiHelper;
