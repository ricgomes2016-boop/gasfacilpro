import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SidebarProvider, useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";
import { AiFloatingButton } from "@/components/ai/AiFloatingButton";
import { ChatOperador } from "@/components/chat/ChatOperador";
import { MobileBottomBar } from "@/components/layout/MobileBottomBar";
import { TransferenciaPendentePopup } from "@/components/estoque/TransferenciaPendentePopup";

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const { collapsed } = useSidebarContext();
  const location = useLocation();
  const isAiPage = location.pathname === "/assistente-ia";
  const [aiOpen, setAiOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    if (isAiPage) setAiOpen(false);
  }, [isAiPage]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar />
      <main
        className={cn(
          "transition-all duration-300 ml-0 pb-14",
          collapsed ? "md:ml-16" : "md:ml-[260px]"
        )}
      >
        {children}
      </main>
      {!isAiPage && <AiFloatingButton externalOpen={aiOpen} onExternalClose={() => setAiOpen(false)} />}
      <ChatOperador externalOpen={chatOpen} onExternalClose={() => setChatOpen(false)} onUnreadChange={setChatUnread} />
      <MobileBottomBar
        onOpenAi={() => { if (!isAiPage) setAiOpen(true); }}
        onOpenChat={() => setChatOpen(true)}
        chatUnread={chatUnread}
        sidebarCollapsed={collapsed}
      />
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </SidebarProvider>
  );
}
