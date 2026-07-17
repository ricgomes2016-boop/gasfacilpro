import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import ExtratoTabela from "./ExtratoTabela";

interface Props {
  contaId: string;
  accentColor: string;
  isCaixa?: boolean;
  saldoAtual?: number;
}

export default function VisaoGeralPanel({ contaId, accentColor, isCaixa, saldoAtual = 0 }: Props) {

  const { data: movs = [] } = useQuery({
    queryKey: ["visao-geral-movs", contaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_bancarias")
        .select("*")
        .eq("conta_bancaria_id", contaId)
        .order("data", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: aPagar = 0 } = useQuery({
    queryKey: ["visao-geral-apagar", contaId],
    queryFn: async () => {
      const { count } = await supabase
        .from("contas_pagar")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      return count || 0;
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">
              {isCaixa ? "Últimas movimentações em dinheiro" : "Últimas movimentações"}
            </h3>
            {movs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem movimentações ainda.</p>
            ) : (
              <div className="space-y-2">
                {movs.map((m: any) => (
                  <div key={m.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{m.descricao}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(m.data), "dd/MM/yyyy")} • {m.categoria}</p>
                    </div>
                    <span className={`text-sm font-bold ${m.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {m.tipo === "entrada" ? "+" : "-"}R$ {Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">Resumo</h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg" style={{ background: `${accentColor}10` }}>
                <p className="text-xs text-muted-foreground">Contas a pagar pendentes</p>
                <p className="text-2xl font-bold" style={{ color: accentColor }}>{aPagar}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

