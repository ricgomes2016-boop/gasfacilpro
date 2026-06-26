import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SidebarProvider, useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";
import { AiFloatingButton } from "@/components/ai/AiFloatingButton";
import { ChatOperador } from "@/components/chat/ChatOperador";
import { MobileBottomBar } from "@/components/layout/MobileBottomBar";
import { TransferenciaPendentePopup } from "@/components/estoque/TransferenciaPendentePopup";
import { PedidoPendenteAlertProvider } from "@/components/alerts/PedidoPendenteAlertProvider";
import { CalculatorPopover } from "@/components/shared/CalculatorPopover";
import { ErpNotificationBanner } from "@/components/layout/ErpNotificationBanner";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";
import { NovaVendaWindowsProvider } from "@/contexts/NovaVendaWindowsContext";
import { NovaVendaWindowsHost } from "@/components/vendas/NovaVendaWindowsHost";
import { SystemFooter } from "@/components/layout/SystemFooter";

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const { collapsed } = useSidebarContext();
  const { themeClass } = useDashboardTheme();
  const location = useLocation();
  const isAiPage = location.pathname === "/assistente-ia";
  const [aiOpen, setAiOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [footerCenterActive, setFooterCenterActive] = useState(false);
  const [activePreset, setActivePreset] = useState(() =>
    typeof document === "undefined" ? "" : document.documentElement.getAttribute("data-theme-preset") || ""
  );
  const isCleanTheme = activePreset === "operacional-clean";
  const isNovaVendaRoute = location.pathname.startsWith("/vendas/nova");
  const hasFooterCenterActive = footerCenterActive || isNovaVendaRoute;


  useEffect(() => {
    if (isAiPage) setAiOpen(false);
  }, [isAiPage]);

  useEffect(() => {
    const handler = (e: Event) => {
      setFooterCenterActive(Boolean((e as CustomEvent<boolean>).detail));
    };
    window.addEventListener("system-footer:center", handler);
    return () => window.removeEventListener("system-footer:center", handler);
  }, []);


  useEffect(() => {
    const syncPreset = () => setActivePreset(document.documentElement.getAttribute("data-theme-preset") || "");
    syncPreset();
    window.addEventListener("storage", syncPreset);

    const observer = new MutationObserver(syncPreset);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-preset"] });

    return () => {
      window.removeEventListener("storage", syncPreset);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={cn(themeClass, "system-surface min-h-screen overflow-x-hidden")}>
      <Sidebar />
      <main
        className={cn(
          "relative min-h-screen transition-all duration-300 ml-0 pb-16 md:pb-10",
          isCleanTheme
            ? "xl:ml-0"
            : (collapsed ? "xl:ml-16" : "xl:ml-[260px]")
        )}
      >
        <ErpNotificationBanner />
        {children}
      </main>
      {!isAiPage && <AiFloatingButton externalOpen={aiOpen} onExternalClose={() => setAiOpen(false)} />}
      <ChatOperador externalOpen={chatOpen} onExternalClose={() => setChatOpen(false)} onUnreadChange={setChatUnread} />
      <TransferenciaPendentePopup />
      <PedidoPendenteAlertProvider />
      {!hasFooterCenterActive && (
        <MobileBottomBar
          onOpenAi={() => {
            if (isAiPage) {
              const input = document.querySelector<HTMLInputElement>('input[data-ai-chat-input], textarea[data-ai-chat-input]')
                || document.querySelector<HTMLInputElement>('main input[type="text"], main textarea');
              input?.focus();
              window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            } else {
              setAiOpen(true);
            }
          }}
          onOpenChat={() => setChatOpen(true)}
          onOpenCalc={() => setCalcOpen(true)}
          chatUnread={chatUnread}
        />
      )}

      <CalculatorPopover externalOpen={calcOpen} onExternalClose={() => setCalcOpen(false)} />
      <NovaVendaWindowsHost />
      <SystemFooter />
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <NovaVendaWindowsProvider>
        <MainLayoutContent>{children}</MainLayoutContent>
      </NovaVendaWindowsProvider>
    </SidebarProvider>
  );
}
