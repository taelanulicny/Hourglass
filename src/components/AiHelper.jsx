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

  // Debug function to check localStorage (remove in production)
  const debugLocalStorage = () => {
    console.log('=== LocalStorage Debug ===');
    console.log('Current STORAGE_KEY:', STORAGE_KEY);
    console.log('Current history:', history);
    console.log('Stored data:', localStorage.getItem(STORAGE_KEY));
    console.log('All localStorage keys:', Object.keys(localStorage).filter(key => key.startsWith('aiHistory:')));
  };

  async function send() {
    if (!input.trim() || loading) return;
    const nextHistory = [...history, { role: "user", content: input.trim() }];
    setHistory(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map(m => ({ role: m.role, content: m.content })),
          focusContext
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHistory(prev => [...prev, { role: "assistant", content: `Sorry—${data?.error || `Server error ${res.status}`}` }]);
      } else {
        setHistory(prev => [...prev, { role: "assistant", content: data.text || "…" }]);
      }
    } catch {
      setHistory(prev => [...prev, { role: "assistant", content: "Sorry—there was an error. Try again." }]);
    } finally {
      setLoading(false);
      setShowGreeting(false); // hide the ephemeral greeting after first send
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
        {/* Debug button - remove in production */}
        <button 
          onClick={debugLocalStorage}
          className="text-xs text-gray-500 hover:text-gray-700 mt-1"
        >
          Debug localStorage
        </button>
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

        {/* Optional typing indicator */}
        {loading && <div className="msg assistant typing-indicator">Thinking…</div>}
      </div>
      
      <div className="ai-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask for advice about ${focusContext?.name ?? "this area"}…`}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={loading}>Send</button>
      </div>
    </div>
  );
}

export default AiHelper;
