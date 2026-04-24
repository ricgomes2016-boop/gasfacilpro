import { MainLayout } from "@/components/layout/MainLayout";
import { WhatsAppInbox } from "@/components/atendimento/WhatsAppInbox";

export default function CaixaDeEntrada() {
  return (
    <MainLayout>
      <div className="h-[calc(100vh-3.5rem)] p-0">
        <WhatsAppInbox className="h-full rounded-none border-0" />
      </div>
    </MainLayout>
  );
}
