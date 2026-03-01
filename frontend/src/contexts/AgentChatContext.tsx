import { createContext, useCallback, useContext, useState } from "react";

/** When user has a feedback selected, we pass this so the agent knows which feedback they're asking about. */
export interface FeedbackContextForAgent {
  feedbackExcerpt: string;
  companyName?: string | null;
  featureArea?: string | null;
}

interface AgentChatContextValue {
  initialMessage: string | null;
  openWithMessage: (message: string) => void;
  clearInitialMessage: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openChatWithMessage: (message: string) => void;
  /** Set when user has a feedback detail open so opening the chat pre-fills context. */
  contextFeedback: FeedbackContextForAgent | null;
  setContextFeedback: (f: FeedbackContextForAgent | null) => void;
  /** Open chat; if contextFeedback is set, pre-fills initial message so the agent knows the selected feedback. */
  openChat: () => void;
}

function buildContextMessage(ctx: FeedbackContextForAgent): string {
  const company = ctx.companyName
    ? `I'm viewing this feedback from **${ctx.companyName}**. `
    : "I'm viewing this feedback. ";
  return company + `Feedback: "${ctx.feedbackExcerpt}". `;
}

const AgentChatContext = createContext<AgentChatContextValue | null>(null);

export function AgentChatProvider({ children }: { children: React.ReactNode }) {
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [contextFeedback, setContextFeedback] = useState<FeedbackContextForAgent | null>(null);

  const openWithMessage = useCallback((message: string) => {
    setInitialMessage(message);
  }, []);

  const clearInitialMessage = useCallback(() => {
    setInitialMessage(null);
  }, []);

  const openChatWithMessage = useCallback((message: string) => {
    setInitialMessage(message);
    setIsOpen(true);
  }, []);

  const openChat = useCallback(() => {
    if (contextFeedback) {
      setInitialMessage(buildContextMessage(contextFeedback));
    }
    setIsOpen(true);
  }, [contextFeedback]);

  return (
    <AgentChatContext.Provider
      value={{
        initialMessage,
        openWithMessage,
        clearInitialMessage,
        isOpen,
        setIsOpen,
        openChatWithMessage,
        contextFeedback,
        setContextFeedback,
        openChat,
      }}
    >
      {children}
    </AgentChatContext.Provider>
  );
}

export function useAgentChat() {
  const ctx = useContext(AgentChatContext);
  if (!ctx)
    return {
      initialMessage: null,
      openWithMessage: () => {},
      clearInitialMessage: () => {},
      isOpen: false,
      setIsOpen: () => {},
      openChatWithMessage: () => {},
      contextFeedback: null,
      setContextFeedback: () => {},
      openChat: () => {},
    };
  return ctx;
}
