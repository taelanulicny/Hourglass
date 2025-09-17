import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

function AiHelper({ focusAreaId, focusContext }) {
  // unique storage key per focus area
  const STORAGE_KEY = `aiHistory:${focusAreaId}`;
  const messagesRef = useRef(null);

  // your existing state:
  const [history, setHistory] = useState([]);   // per-area chat history (already keyed per area)
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // --- NEW: ephemeral greeting shown on each open, NOT saved in history ---
  const [showGreeting, setShowGreeting] = useState(true);
  const greetingText = `How can I help you in "${focusContext?.name ?? "this focus area"}" right now?`;

  // jump to bottom helper
  function scrollToBottom() {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // When switching focus areas: show greeting again and jump to bottom
  useEffect(() => {
    setShowGreeting(true);       // show greeting every time you open a focus area
    // defer scroll until content paints
    const id = setTimeout(scrollToBottom, 0);
    return () => clearTimeout(id);
  }, [focusAreaId]);

  // Also scroll when history changes (new messages)
  useEffect(() => {
    scrollToBottom();
  }, [history, loading, showGreeting]);

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

  return (
    <div className="ai-helper">
      {/* AI Helper Header */}
      <div className="ai-header">
        <div className="ai-title">
          <span className="ai-text">Focus Area Specific AI Assistant</span>
        </div>
        <div className="ai-subtitle">Get personalized advice for "{focusContext?.name ?? "this focus area"}"</div>
      </div>
      
      <div
        ref={messagesRef}
        className="ai-messages"
        style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}
      >
        {/* Render saved conversation */}
        {history.map((m, i) => (
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
            <>
              <div className="ai-loading w-3 h-3"></div>
              <span>Sending...</span>
            </>
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
