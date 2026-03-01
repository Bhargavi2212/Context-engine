import { MessageCircle } from "lucide-react";
import { useAgentChat } from "../../contexts/AgentChatContext";

export default function AgentChatBubble() {
  const { isOpen, setIsOpen, openChat } = useAgentChat();

  return (
    <button
      onClick={() => (isOpen ? setIsOpen(false) : openChat())}
      className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center z-40 transition-all ${
        isOpen ? "pointer-events-none opacity-0" : ""
      }`}
      aria-label={isOpen ? "Close agent chat" : "Open agent chat"}
      aria-hidden={isOpen}
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
}
