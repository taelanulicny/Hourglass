import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

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
    
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // only send THIS area's chat history
          messages: [
            // prepend a light "style hint" as the user's last message context
            { role: "system", content: "Format with ### headings, bullet lists (- item), numbered steps (1.), and checklists (- [ ]). Keep it scannable." },
            ...next.map(m => ({ role: m.role, content: m.content }))
          ],
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
      
      setHistory(prev => [...prev, { role: "assistant", content: text }]);
    } catch (e) {
      setHistory(prev => [...prev, { role: "assistant", content: "Error. Try again." }]);
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
        {loading && (
          <div className="msg assistant typing-indicator">
            Thinking…
          </div>
        )}
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
