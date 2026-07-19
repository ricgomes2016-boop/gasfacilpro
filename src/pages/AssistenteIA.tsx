import { MainLayout } from "@/components/layout/MainLayout";
import { AiAssistantChat } from "@/components/ai/AiAssistantChat";
import { Bot, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AssistenteIA() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background">
        <div className="mx-auto max-w-5xl px-3 pt-4 pb-6 sm:px-6 sm:pt-6">
          {/* Premium Hero */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 sm:p-6 shadow-sm mb-4">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-3 sm:gap-4">
              <div className="relative shrink-0">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Bot className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
                </div>
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-success ring-2 ring-background flex items-center justify-center">
                  <Sparkles className="h-2.5 w-2.5 text-success-foreground" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">GásBot Assistente</h1>
                  <Badge variant="secondary" className="h-5 gap-1 px-2 text-[10px] font-medium">
                    <Zap className="h-3 w-3" /> IA Premium
                  </Badge>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Consulte dados, gere relatórios e execute ações em linguagem natural.
                </p>
              </div>
            </div>
          </div>

          {/* Chat card */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <AiAssistantChat fullPage enableVoice />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
