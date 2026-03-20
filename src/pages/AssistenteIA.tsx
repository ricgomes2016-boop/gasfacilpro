import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { AiAssistantChat } from "@/components/ai/AiAssistantChat";

export default function AssistenteIA() {
  return (
    <MainLayout>
      <Header title="Assistente IA" subtitle="Consulte dados do sistema em linguagem natural" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <AiAssistantChat fullPage enableVoice />
      </div>
    </MainLayout>
  );
}
