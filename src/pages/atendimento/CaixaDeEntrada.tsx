import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { WhatsAppInbox } from "@/components/atendimento/WhatsAppInbox";

export default function CaixaDeEntrada() {
  return (
    <MainLayout>
      <Header title="Chat" subtitle="Conversas do WhatsApp" />
      <div className="h-[calc(100vh-11rem)] sm:h-[calc(100vh-7rem)] md:h-[calc(100vh-7.75rem)] p-0">
        <WhatsAppInbox className="h-full rounded-none border-0" />
      </div>
    </MainLayout>
  );
}
