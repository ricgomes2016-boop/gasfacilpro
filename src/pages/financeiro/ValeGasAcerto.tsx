import { MainLayout } from "@/components/layout/MainLayout";
import { parseLocalDate } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useValeGas } from "@/contexts/ValeGasContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, Banknote, Building2, CheckCircle2, Clock, AlertCircle, Plus,
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { LiquidarRecebivelModal } from "@/components/financeiro/LiquidarRecebivelModal";
import type { LinhaLiquidacao, RecebivelParaLiquidar } from "@/services/liquidarRecebivelService";
import { formatFormaPagamentoLabel } from "@/lib/financeiro/formaPagamento";

const defaultVencAcerto = () => {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString().split("T")[0];
};

const acertoMarker = (id: string) => `[acerto:${id}]`;

export default function ValeGasAcerto({ embedded }: { embedded?: boolean } = {}) {
  const { parceiros, vales, lotes, acertos, gerarAcerto, registrarPagamentoAcerto } = useValeGas();
  const { unidadeAtual } = useUnidade();
  
  const [novoAcertoDialog, setNovoAcertoDialog] = useState(false);
  const [parceiroSelecionado, setParceiroSelecionado] = useState<string>("");
  const [vencimentoAcerto, setVencimentoAcerto] = useState<string>(defaultVencAcerto());
  const [acertoRecebimento, setAcertoRecebimento] = useState<{ acerto: any; conta: RecebivelParaLiquidar } | null>(null);

  const parceirosAtivos = parceiros.filter(p => p.ativo);

  const valesPendentes = useMemo(() => {
    const pendentes: Record<string, { quantidade: number; valor: number }> = {};
    const lotesAbertos = new Set(
      lotes
        .filter(l => !l.cancelado && Number(l.valor_pago || 0) < Number(l.valor_total || 0) - 0.01)
        .map(l => l.id)
    );
    parceirosAtivos.forEach(parceiro => {
      const valesNaoAcertados = vales.filter(v => {
        if (v.parceiro_id !== parceiro.id || v.status === "cancelado") return false;
        return parceiro.tipo === "consignado" ? v.status === "utilizado" : lotesAbertos.has(v.lote_id);
      });
      pendentes[parceiro.id] = {
        quantidade: valesNaoAcertados.length,
        valor: valesNaoAcertados.reduce((sum, v) => sum + Number(v.valor), 0),
      };
    });
    return pendentes;
  }, [parceirosAtivos, vales, lotes]);


  const handleGerarAcerto = async () => {
    if (!parceiroSelecionado) { toast.error("Selecione um parceiro"); return; }
    const venc = vencimentoAcerto || defaultVencAcerto();
    try {
      const acerto = await gerarAcerto(parceiroSelecionado);
      if (acerto) {
        const parceiro = parceiros.find(p => p.id === parceiroSelecionado);
        // Gera o título financeiro do acerto em Contas a Receber
        try {
          const { error: crErr } = await supabase.from("contas_receber").insert({
            cliente: acerto.parceiro_nome,
            descricao: `Acerto Vale Gás - ${acerto.parceiro_nome} - ${acerto.quantidade} vales`,
            valor: acerto.valor_total,
            vencimento: venc,
            status: "pendente",
            forma_pagamento: "vale_gas",
            vale_gas_parceiro_id: parceiro?.id,
            origem: "vale_gas_acerto",
            unidade_id: unidadeAtual?.id || null,
            observacoes: `${acertoMarker(acerto.id)} ${parceiro?.tipo === "consignado" ? "Acerto de vales utilizados" : "Acerto integral de lote emitido"}.`,
          });
          if (crErr) throw crErr;
        } catch (e: any) {
          console.error("Erro ao gerar conta a receber do acerto:", e);
          toast.error("Acerto gerado, mas falhou ao criar a conta a receber. Crie manualmente.");
        }
        toast.success(`Acerto gerado! ${acerto.quantidade} vales - R$ ${Number(acerto.valor_total).toFixed(2)}`);
        setNovoAcertoDialog(false);
        setParceiroSelecionado("");
        setVencimentoAcerto(defaultVencAcerto());
      } else {
        toast.error("Não há vales pendentes de acerto");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar acerto");
    }
  };

  const abrirRecebimento = async (acerto: any) => {
    const { data, error } = await supabase
      .from("contas_receber")
      .select("id, cliente, cliente_id, descricao, pedido_id, unidade_id, valor, forma_pagamento, observacoes")
      .eq("origem", "vale_gas_acerto")
      .ilike("observacoes", `%${acertoMarker(acerto.id)}%`)
      .eq("status", "pendente")
      .maybeSingle();
    if (error) { toast.error("Não foi possível carregar o título do acerto: " + error.message); return; }
    if (!data) { toast.error("Título pendente do acerto não encontrado em Contas a Receber."); return; }
    setAcertoRecebimento({ acerto, conta: data as RecebivelParaLiquidar });
  };

  const atualizarFinanceiroDosLotes = async (acertoId: string) => {
    const { data: links } = await (supabase as any).from("vale_gas_acerto_vales").select("vale_id").eq("acerto_id", acertoId);
    const ids = (links || []).map((item: any) => item.vale_id);
    if (!ids.length) return;
    const { data: valesAcerto } = await (supabase as any).from("vale_gas").select("lote_id, valor").in("id", ids);
    const porLote = new Map<string, number>();
    (valesAcerto || []).forEach((vale: any) => porLote.set(vale.lote_id, (porLote.get(vale.lote_id) || 0) + Number(vale.valor || 0)));
    for (const [loteId, valor] of porLote) {
      const { data: lote } = await (supabase as any).from("vale_gas_lotes").select("valor_total, valor_pago").eq("id", loteId).single();
      if (!lote) continue;
      const pago = Math.min(Number(lote.valor_total), Number(lote.valor_pago || 0) + valor);
      await (supabase as any).from("vale_gas_lotes").update({
        valor_pago: pago,
        status_pagamento: pago >= Number(lote.valor_total) - 0.01 ? "pago" : "parcial",
      }).eq("id", loteId);
    }
  };

  const concluirRecebimento = async (detalhes?: { linhas: LinhaLiquidacao[]; dataRecebimento: string }) => {
    if (!acertoRecebimento) return;
    const formas = detalhes?.linhas.map(l => formatFormaPagamentoLabel(l.forma)).join(" + ") || "Recebido";
    await registrarPagamentoAcerto(acertoRecebimento.acerto.id, formas);
    await atualizarFinanceiroDosLotes(acertoRecebimento.acerto.id);
    setAcertoRecebimento(null);
    toast.success("Acerto liquidado e encaminhado para a conta financeira correta.");
  };

  const totais = useMemo(() => ({
    acertosPendentes: acertos.filter(a => a.status_pagamento === "pendente").length,
    valorPendente: acertos.filter(a => a.status_pagamento === "pendente").reduce((s, a) => s + Number(a.valor_total), 0),
    acertosPagos: acertos.filter(a => a.status_pagamento === "pago").length,
    valorPago: acertos.filter(a => a.status_pagamento === "pago").reduce((s, a) => s + Number(a.valor_total), 0),
  }), [acertos]);

  const parceiroInfo = parceiroSelecionado ? parceiros.find(p => p.id === parceiroSelecionado) : null;

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-end">
          <Dialog open={novoAcertoDialog} onOpenChange={setNovoAcertoDialog}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Gerar Acerto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Gerar Novo Acerto</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Parceiro</label>
                  <Select value={parceiroSelecionado} onValueChange={setParceiroSelecionado}>
                    <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                    <SelectContent>{parceirosAtivos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} ({p.tipo === "prepago" ? "Pré-pago" : p.tipo === "empenho" ? "Empenho" : "Consignado"})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {parceiroInfo && valesPendentes[parceiroInfo.id] && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p className="font-medium">{parceiroInfo.nome}</p>
                    <div className="flex justify-between text-sm"><span>{parceiroInfo.tipo === "consignado" ? "Vales utilizados pendentes:" : "Vales emitidos no acerto:"}</span><span className="font-bold">{valesPendentes[parceiroInfo.id].quantidade}</span></div>
                    <p className="text-xs text-muted-foreground">{parceiroInfo.tipo === "consignado" ? "O acerto considera somente os vales validados." : "O acerto considera o lote inteiro; a utilização continua sendo baixada vale a vale."}</p>
                    <div className="flex justify-between text-sm"><span>Valor total:</span><span className="font-bold text-success">R$ {valesPendentes[parceiroInfo.id].valor.toFixed(2)}</span></div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Vencimento do título (Contas a Receber)</Label>
                  <Input
                    type="date"
                    value={vencimentoAcerto}
                    onChange={e => setVencimentoAcerto(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Um título será criado em Contas a Receber conforme a regra do tipo de parceiro.
                  </p>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setNovoAcertoDialog(false)}>Cancelar</Button>
                  <Button onClick={handleGerarAcerto}>Gerar Acerto</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-warning/10"><Clock className="h-6 w-6 text-warning" /></div><div><p className="text-2xl font-bold">{totais.acertosPendentes}</p><p className="text-sm text-muted-foreground">Acertos Pendentes</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-destructive/10"><Banknote className="h-6 w-6 text-destructive" /></div><div><p className="text-2xl font-bold">R$ {totais.valorPendente.toFixed(0)}</p><p className="text-sm text-muted-foreground">Valor Pendente</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-success/10"><CheckCircle2 className="h-6 w-6 text-success" /></div><div><p className="text-2xl font-bold">{totais.acertosPagos}</p><p className="text-sm text-muted-foreground">Acertos Pagos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Banknote className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">R$ {totais.valorPago.toFixed(0)}</p><p className="text-sm text-muted-foreground">Total Recebido</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-warning" /> Parceiros com Vales Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {parceirosAtivos.map(parceiro => {
                const pendente = valesPendentes[parceiro.id];
                if (!pendente || pendente.quantidade === 0) return null;
                return (
                  <Card key={parceiro.id} className="bg-warning border-warning dark:bg-warning/20 dark:border-warning">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div><p className="font-medium">{parceiro.nome}</p><p className="text-sm text-muted-foreground mt-1">{pendente.quantidade} {parceiro.tipo === "consignado" ? "vales utilizados" : "vales emitidos"} · {parceiro.tipo === "prepago" ? "Pré-pago" : parceiro.tipo === "empenho" ? "Empenho" : "Consignado"}</p></div>
                        <Building2 className="h-5 w-5 text-warning" />
                      </div>
                      <p className="text-2xl font-bold text-warning mt-3">R$ {pendente.valor.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                );
              })}
              {Object.values(valesPendentes).every(p => p.quantidade === 0) && (
                <div className="col-span-3 text-center py-8 text-muted-foreground">Não há vales pendentes</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Histórico de Acertos</CardTitle><CardDescription>Acertos realizados</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Parceiro</TableHead><TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead><TableHead className="text-center">Status</TableHead>
                  <TableHead>Pagamento</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acertos.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum acerto registrado</TableCell></TableRow>
                ) : acertos.map(acerto => (
                  <TableRow key={acerto.id}>
                    <TableCell>{format(new Date(acerto.data_acerto), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell className="font-medium">{acerto.parceiro_nome}</TableCell>
                    <TableCell className="text-center">{acerto.quantidade}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(acerto.valor_total).toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={acerto.status_pagamento === "pago" ? "default" : "destructive"}>
                        {acerto.status_pagamento === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {acerto.data_pagamento ? (
                        <div className="text-sm">
                          <p>{format(parseLocalDate(acerto.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}</p>
                          <p className="text-muted-foreground">{acerto.forma_pagamento}</p>
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {acerto.status_pagamento === "pendente" && <Button size="sm" onClick={() => abrirRecebimento(acerto)}>Receber</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <LiquidarRecebivelModal
          open={!!acertoRecebimento}
          onClose={() => setAcertoRecebimento(null)}
          conta={acertoRecebimento?.conta || null}
          onSuccess={concluirRecebimento}
          exigirLiquidacaoTotal
        />
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Acerto de Contas - Vale Gás" subtitle="Consignado por utilização; pré-pago e empenho pelo lote completo" />
      {content}
    </MainLayout>
  );
}
