import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileText, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Props {
  contaId: string;
  saldoAtual: number;
  unidadeId: string | null;
  accentColor: string;
  onPago: () => void;
}

export default function BoletosPanel({ contaId, saldoAtual, unidadeId, accentColor, onPago }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [pagandoId, setPagandoId] = useState<string | null>(null);

  const { data: boletos = [] } = useQuery({
    queryKey: ["contas-pagar-boletos", contaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*")
        .eq("status", "pendente")
        .or("forma_pagamento.eq.boleto,boleto_linha_digitavel.not.is.null,boleto_codigo_barras.not.is.null")
        .order("vencimento", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const pagarBoleto = async (titulo: any) => {
    const valor = Number(titulo.valor);
    if (valor > saldoAtual) { toast.error("Saldo insuficiente"); return; }
    setPagandoId(titulo.id);
    const hoje = format(new Date(), "yyyy-MM-dd");
    const novoSaldo = saldoAtual - valor;

    const { error: e1 } = await supabase.from("contas_pagar").update({
      status: "pago",
      data_pagamento: hoje,
      conta_bancaria_id: contaId,
      forma_pagamento: "boleto",
    }).eq("id", titulo.id);

    if (e1) { toast.error("Erro ao baixar boleto"); setPagandoId(null); return; }

    await supabase.from("movimentacoes_bancarias").insert({
      conta_bancaria_id: contaId,
      data: hoje,
      tipo: "saida",
      categoria: "Pagamento boleto",
      descricao: `Boleto ${titulo.fornecedor} - ${titulo.descricao}`,
      valor,
      saldo_apos: novoSaldo,
      referencia_id: titulo.id,
      referencia_tipo: "contas_pagar",
      user_id: user?.id,
      unidade_id: unidadeId,
    });

    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", contaId);

    toast.success("Boleto pago!");
    setPagandoId(null);
    qc.invalidateQueries({ queryKey: ["contas-pagar-boletos", contaId] });
    onPago();
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: accentColor }} />
            <h3 className="font-semibold">Boletos a pagar</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Saldo: <span className="font-bold text-foreground">R$ {saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </p>
        </div>

        {boletos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum boleto pendente.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boletos.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-xs">{format(new Date(b.vencimento), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-sm font-medium">{b.fornecedor}</TableCell>
                    <TableCell className="text-sm">{b.descricao}</TableCell>
                    <TableCell className="text-right font-bold">R$ {Number(b.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={pagandoId === b.id}
                        onClick={() => pagarBoleto(b)}
                        style={{ background: accentColor }}
                        className="text-white"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {pagandoId === b.id ? "Pagando..." : "Pagar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
