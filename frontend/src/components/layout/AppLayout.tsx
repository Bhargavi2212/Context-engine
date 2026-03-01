import { Outlet, useLocation } from "react-router-dom";
import { AgentChatProvider, useAgentChat } from "../../contexts/AgentChatContext";
import Sidebar from "./Sidebar";
import AgentChatBubble from "../agent/AgentChatBubble";
import AgentChat from "../agent/AgentChat";

function AppLayoutContent() {
  const location = useLocation();
  const { isOpen, setIsOpen, initialMessage, clearInitialMessage } = useAgentChat();
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
        <main className="flex-1 min-w-0 min-h-0 overflow-auto flex flex-col">
          <div key={location.pathname} className="animate-fade-in flex flex-col flex-1 min-h-0">
            <Outlet />
          </div>
        </main>
        {isOpen && (
          <aside
            className="w-full max-w-md shrink-0 flex flex-col bg-gray-800 border-l border-gray-700 min-h-0 overflow-hidden lg:min-w-[400px] min-w-0"
            role="dialog"
            aria-label="Context Engine Agent"
          >
            <AgentChat
              onMinimize={() => setIsOpen(false)}
              initialMessage={initialMessage}
              clearInitialMessage={clearInitialMessage}
            />
          </aside>
        )}
      </div>
      <AgentChatBubble />
    </div>
  );
}

export default function AppLayout() {
  return (
    <AgentChatProvider>
      <AppLayoutContent />
    </AgentChatProvider>
  );
}
