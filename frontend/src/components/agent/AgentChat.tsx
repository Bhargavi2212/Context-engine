import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Minus, Plus, Send } from "lucide-react";
import {
  deleteConversation,
  getConversation,
  getConversations,
  postChat,
  type ConversationListItem,
  type Message,
} from "../../services/agentApi";

const SUGGESTED_PROMPTS = [
  "What are the top issues?",
  "Which customers are at risk?",
  "How's sentiment trending?",
  "Compare enterprise vs SMB",
];

interface AgentChatProps {
  onMinimize: () => void;
  initialMessage?: string | null;
  clearInitialMessage?: () => void;
}

export default function AgentChat({
  onMinimize,
  initialMessage,
  clearInitialMessage,
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [slowWarning, setSlowWarning] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastAssistant = messages.length > 0
    ? [...messages].reverse().find((m) => m.role === "assistant")
    : null;
  const lastAnalystReply =
    (lastAssistant as Message & { intent?: string })?.intent === "analyst";

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (initialMessage) {
      setInput(initialMessage);
      clearInitialMessage?.();
    }
  }, [initialMessage, clearInitialMessage]);

  const loadConversations = useCallback(async () => {
    try {
      const list = await getConversations();
      setConversations(list);
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, conversationId]);

  useEffect(() => {
    if (loading) {
      setSlowWarning(false);
      slowTimerRef.current = setTimeout(() => setSlowWarning(true), 10000);
    } else {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
      setSlowWarning(false);
    }
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, [loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      const msg = text.trim();
      setInput("");
      setLoading(true);

      const userMsg: Message = {
        role: "user",
        content: msg,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await postChat(msg, conversationId ?? undefined);
        setConversationId(res.conversation_id);
        const assistantMsg: Message = {
          role: "assistant",
          content: res.response,
          timestamp: new Date().toISOString(),
          intent: res.intent,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        loadConversations();
      } catch (err: unknown) {
        let content = "Sorry, something went wrong. Please try again.";
        if (err && typeof err === "object" && "response" in err) {
          const res = (err as { response?: { data?: { detail?: string | unknown[] } } }).response;
          const detail = res?.data?.detail;
          if (typeof detail === "string") content = detail;
          else if (Array.isArray(detail) && detail.length > 0) {
            const first = detail[0] as { msg?: string };
            if (first?.msg) content = first.msg;
          }
        }
        const errMsg: Message = {
          role: "assistant",
          content,
          timestamp: new Date().toISOString(),
          intent: "general",
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading, loadConversations]
  );

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setShowConversations(false);
  }, []);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      try {
        const conv = await getConversation(id);
        setConversationId(conv.id);
        setMessages(conv.messages);
      } catch {
        setMessages([]);
      }
      setShowConversations(false);
    },
    []
  );

  const intentLabel = (intent?: string) => {
    if (!intent) return "";
    const labels: Record<string, string> = {
      analyst: "Analyst",
      customer: "Customer",
      spec_generation: "Spec",
      general: "General",
    };
    return labels[intent] ?? intent;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between p-3 border-b border-gray-700 shrink-0">
        <h3 className="font-semibold text-gray-100">Context Engine Agent</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleNewConversation}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400"
            aria-label="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {conversations.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-700 shrink-0">
          <button
            onClick={() => setShowConversations(!showConversations)}
            className="text-xs font-medium text-gray-400 hover:text-gray-300"
          >
            {showConversations ? "Hide" : "Show"} past conversations
          </button>
          {showConversations && (
            <div className="mt-2 max-h-40 overflow-auto space-y-0.5">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectConversation(c.id)}
                  className={`block w-full text-left text-sm rounded px-2 py-1.5 truncate ${
                    c.id === conversationId
                      ? "bg-gray-700 text-gray-100"
                      : "text-gray-400 hover:bg-gray-700/50 hover:text-gray-300"
                  }`}
                  title={c.title}
                >
                  {c.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div>
            <p className="text-gray-400 mb-4">What would you like to know?</p>
            <p className="text-sm text-gray-500 mb-2">Add feedback and customers to get better answers.</p>
            <p className="text-sm text-gray-500 mb-2">Suggested:</p>
            <ul className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <button
                    onClick={() => sendMessage(prompt)}
                    className="text-left text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    • {prompt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "flex justify-end"
                : "flex justify-start"
            }
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-lg px-3 py-2 bg-indigo-600 text-white text-sm"
                  : "max-w-[85%] rounded-lg px-3 py-2 bg-gray-700 text-gray-200 text-sm"
              }
            >
              {m.role === "assistant" && (m as Message & { intent?: string }).intent && (
                <span className="text-xs text-gray-500 block mb-1">
                  {intentLabel((m as Message & { intent?: string }).intent)}
                </span>
              )}
              {m.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 bg-gray-700 text-gray-400 text-sm flex items-center gap-1">
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
            {slowWarning && (
              <p className="text-xs text-gray-500">This is taking longer than usual. The agent may still respond.</p>
            )}
          </div>
        )}

        {lastAnalystReply && messages.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => sendMessage("Generate specs for the top issue")}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              [Generate Specs for #1]
            </button>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-700 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your feedback"
            className="flex-1 rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
