import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, ChevronRight, CreditCard } from "lucide-react";
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

  const { data: operadoras = [] } = useQuery({
    queryKey: ["operadoras-vinculadas-conta", contaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("operadoras_cartao")
        .select("id,nome,ativo")
        .eq("conta_bancaria_id", contaId);
      return data || [];
    },
  });

  const { data: terminais = [] } = useQuery({
    queryKey: ["maquininhas-vinculadas-conta", contaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("terminais_cartao")
        .select("id,nome,operadora,status")
        .eq("conta_bancaria_id", contaId);
      return data || [];
    },
  });

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4" style={{ color: accentColor }} />
            <h3 className="font-semibold text-sm">Recebimentos roteados para esta conta</h3>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/financeiro/formas-pagamento">
              Gerenciar <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Formas de pagamento</p>
          {formas.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma forma direta vinculada.{" "}
              <Link to="/financeiro/formas-pagamento" className="underline">Configurar</Link>.
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
        </div>

        {(operadoras.length > 0 || terminais.length > 0) && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <CreditCard className="h-3 w-3" /> Maquininhas / Operadoras
            </p>
            <div className="flex flex-wrap gap-1.5">
              {operadoras.map((o: any) => (
                <Badge key={o.id} variant="secondary" className="text-[11px] bg-primary/10 text-primary">
                  {o.nome} <span className="opacity-60 ml-1">(operadora)</span>
                </Badge>
              ))}
              {terminais.map((t: any) => (
                <Badge key={t.id} variant="outline" className="text-[11px]">
                  {t.nome} <span className="opacity-60 ml-1">({t.operadora})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
