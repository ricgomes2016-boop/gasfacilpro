import { Card, CardContent } from "@/components/ui/card";
import { Zap, AlertTriangle } from "lucide-react";

export function SugestoesCard() {
  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 shrink-0">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">💡 Sugestões de integração</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Com base no seu uso, recomendamos configurar estas integrações para aumentar a produtividade:
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <span><strong>NF-e / NFC-e:</strong> Automatize a emissão fiscal e elimine processos manuais no SEFAZ.</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <span><strong>Bina / GoTo:</strong> Identifique clientes ao atender o telefone e ganhe agilidade no atendimento.</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <span><strong>Webhooks:</strong> Conecte com Zapier/Make/N8N para automações externas ilimitadas.</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
