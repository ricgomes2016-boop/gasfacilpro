import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  pix_maquininha: "PIX Maquininha",
  cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito",
  cheque: "Cheque",
  vale_gas: "Vale Gás",
  transferencia: "Transferência",
  boleto: "Boleto",
  fiado: "Fiado",
};

interface Props {
  contaId: string;
  accentColor?: string;
}

export default function FormasVinculadasCard({ contaId, accentColor }: Props) {
  const { data: formas = [] } = useQuery({
    queryKey: ["formas-vinculadas-conta", contaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_destino_pagamento")
        .select("forma_pagamento, ativo")
        .eq("conta_bancaria_id", contaId);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4" style={{ color: accentColor }} />
            <h3 className="font-semibold text-sm">Formas de Pagamento vinculadas</h3>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/financeiro/formas-pagamento">
              Gerenciar <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
        {formas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma forma de pagamento roteia para esta conta.{" "}
            <Link to="/financeiro/formas-pagamento" className="underline">
              Configurar agora
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {formas.map((f: any) => (
              <Badge
                key={f.forma_pagamento}
                variant={f.ativo === false ? "outline" : "secondary"}
                className="text-[11px]"
              >
                {LABELS[f.forma_pagamento] || f.forma_pagamento}
                {f.ativo === false && " (inativo)"}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
