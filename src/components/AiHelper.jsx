import { useEffect, useState } from "react";

function AiHelper({ focusAreaId, focusContext }) {
  // unique storage key per focus area
  const STORAGE_KEY = `aiHistory:${focusAreaId}`;

  const defaultGreeting = {
    role: "assistant",
    content:
      `Hi! I'm your AI assistant. How can I help you in "${focusContext?.name ?? "this focus area"}" today?`
  };

  // load per-area history on mount / focusAreaId change
  const [history, setHistory] = useState([defaultGreeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setHistory(parsed);
          return;
        }
      }
    } catch {}
    // if nothing stored, start fresh for this focus area
    setHistory([defaultGreeting]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAreaId]); // <- critical: change history when switching areas

  // persist this focus area's history only under its own key
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch {}
  }, [STORAGE_KEY, history]);

  async function send() {
    if (!input.trim() || loading) return;
    const next = [...history, { role: "user", content: input.trim() }];
    setHistory(next);
    setInput("");
    setLoading(true);
    
    // Add a temporary "thinking" message to show loading state in chat
    const thinkingMessage = { role: "assistant", content: "Thinking...", isThinking: true };
    setHistory(prev => [...prev, thinkingMessage]);
    
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // only send THIS area's chat history
          messages: next.map(m => ({ role: m.role, content: m.content })),
          // readonly context for better advice
          focusContext: {
            id: focusAreaId,
            name: focusContext?.name,
            goal: focusContext?.goal,
            weekLogged: focusContext?.weekLogged,
            leftToday: focusContext?.leftToday
          }
        })
      });
      const data = await res.json();
      const text = data?.text ?? "Sorry—couldn't generate a reply.";
      
      // Replace the thinking message with the actual response
      setHistory(prev => prev.filter(msg => !msg.isThinking).concat({ role: "assistant", content: text }));
    } catch (e) {
      // Replace the thinking message with error message
      setHistory(prev => prev.filter(msg => !msg.isThinking).concat({ role: "assistant", content: "Error. Try again." }));
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
      
      <div className="ai-messages">
        {history.map((m, i) => (
          <div key={i} className={
            m.isThinking ? "msg thinking" : 
            m.role === "assistant" ? "msg assistant" : "msg user"
          }>
            {m.isThinking ? "Thinking" : m.content}
          </div>
        ))}
      </div>
      <div className="ai-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask AI for advice about ${focusContext?.name ?? "this area"}…`}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={loading}>Send</button>
      </div>
    </div>
  );
}

export default AiHelper;
