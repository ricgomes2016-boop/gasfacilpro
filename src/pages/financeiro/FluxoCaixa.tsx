import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const CAIXA_LOJA = "__caixa_loja__";

interface Linha {
  data: string; // yyyy-MM-dd
  historico: string;
  entrada: number;
  saida: number;
  aReceber: number;
}

const fmtBR = (n: number) =>
  n === 0 ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSaldo = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (iso: string) => {
  try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso; }
};

export default function FluxoCaixa({ embedded }: { embedded?: boolean } = {}) {
  const { unidadeAtual } = useUnidade();
  const qc = useQueryClient();

  const hoje = new Date();
  const [contaId, setContaId] = useState<string>(CAIXA_LOJA);
  const [dataIni, setDataIni] = useState<string>(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState<string>(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "entrada", descricao: "", valor: "", categoria: "" });

  // Contas bancárias
  const { data: contas = [] } = useQuery({
    queryKey: ["fc_contas", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id,nome,banco,saldo_inicial").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const contaSelecionada = contas.find((c) => c.id === contaId);
  const isCaixa = contaId === CAIXA_LOJA;

  // Extrato
  const { data: extrato, isLoading } = useQuery({
    queryKey: ["fc_extrato", contaId, dataIni, dataFim, unidadeAtual?.id],
    queryFn: async () => {
      let saldoInicial = 0;
      const linhas: Linha[] = [];

      if (isCaixa) {
        // Saldo anterior — movimentacoes_caixa antes de dataIni
        let qa = supabase.from("movimentacoes_caixa")
          .select("tipo,valor")
          .eq("status", "aprovada")
          .lt("created_at", dataIni);
        if (unidadeAtual?.id) qa = qa.eq("unidade_id", unidadeAtual.id);
        const { data: ant } = await qa;
        saldoInicial = (ant || []).reduce(
          (s, m) => s + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor)), 0,
        );

        // Movimentos no período
        let qp = supabase.from("movimentacoes_caixa")
          .select("tipo,valor,descricao,categoria,created_at")
          .eq("status", "aprovada")
          .gte("created_at", dataIni)
          .lte("created_at", `${dataFim}T23:59:59`)
          .order("created_at", { ascending: true });
        if (unidadeAtual?.id) qp = qp.eq("unidade_id", unidadeAtual.id);
        const { data: movs } = await qp;
        (movs || []).forEach((m: any) => {
          linhas.push({
            data: m.created_at.substring(0, 10),
            historico: m.descricao + (m.categoria ? ` (${m.categoria})` : ""),
            entrada: m.tipo === "entrada" ? Number(m.valor) : 0,
            saida: m.tipo === "saida" ? Number(m.valor) : 0,
            aReceber: 0,
          });
        });
      } else if (contaSelecionada) {
        // Saldo anterior — saldo_inicial + movimentações antes
        const { data: ant } = await supabase.from("movimentacoes_bancarias")
          .select("tipo,valor")
          .eq("conta_bancaria_id", contaId)
          .lt("data", dataIni);
        saldoInicial = Number(contaSelecionada.saldo_inicial || 0) +
          (ant || []).reduce(
            (s, m) => s + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor)), 0,
          );

        const { data: movs } = await supabase.from("movimentacoes_bancarias")
          .select("data,tipo,valor,descricao,categoria")
          .eq("conta_bancaria_id", contaId)
          .gte("data", dataIni)
          .lte("data", dataFim)
          .order("data", { ascending: true })
          .order("created_at", { ascending: true });
        (movs || []).forEach((m: any) => {
          linhas.push({
            data: m.data,
            historico: m.descricao + (m.categoria && m.categoria !== "manual" ? ` (${m.categoria})` : ""),
            entrada: m.tipo === "entrada" ? Number(m.valor) : 0,
            saida: m.tipo === "saida" ? Number(m.valor) : 0,
            aReceber: 0,
          });
        });
      }

      // A Receber pendente no período (apenas no caixa para não duplicar)
      if (isCaixa) {
        let qr = supabase.from("contas_receber")
          .select("cliente,descricao,valor,vencimento")
          .eq("status", "pendente")
          .gte("vencimento", dataIni)
          .lte("vencimento", dataFim)
          .order("vencimento", { ascending: true });
        if (unidadeAtual?.id) qr = qr.eq("unidade_id", unidadeAtual.id);
        const { data: rec } = await qr;
        (rec || []).forEach((r: any) => {
          linhas.push({
            data: r.vencimento,
            historico: `A receber: ${r.cliente} — ${r.descricao}`,
            entrada: 0,
            saida: 0,
            aReceber: Number(r.valor),
          });
        });
      }

      // Ordenar por data
      linhas.sort((a, b) => a.data.localeCompare(b.data));

      return { saldoInicial, linhas };
    },
    enabled: !!unidadeAtual?.id || isCaixa,
  });

  const linhasFiltradas = useMemo(() => {
    if (!extrato) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return extrato.linhas;
    return extrato.linhas.filter((l) => l.historico.toLowerCase().includes(q));
  }, [extrato, busca]);

  // Saldo corrido (não conta A Receber)
  const linhasComSaldo = useMemo(() => {
    let saldo = extrato?.saldoInicial ?? 0;
    return linhasFiltradas.map((l) => {
      saldo += l.entrada - l.saida;
      return { ...l, saldo };
    });
  }, [linhasFiltradas, extrato?.saldoInicial]);

  const totais = useMemo(() => {
    return linhasFiltradas.reduce(
      (acc, l) => ({
        entrada: acc.entrada + l.entrada,
        saida: acc.saida + l.saida,
        aReceber: acc.aReceber + l.aReceber,
      }),
      { entrada: 0, saida: 0, aReceber: 0 },
    );
  }, [linhasFiltradas]);

  const saldoFinal = (extrato?.saldoInicial ?? 0) + totais.entrada - totais.saida;
  const tituloConta = isCaixa ? "CAIXA DA LOJA" : (contaSelecionada?.nome?.toUpperCase() ?? "—");

  const handleSubmit = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha os campos obrigatórios"); return; }
    const { error } = await supabase.from("movimentacoes_caixa").insert({
      tipo: form.tipo, descricao: form.descricao,
      valor: parseFloat(form.valor), categoria: form.categoria || null,
      unidade_id: unidadeAtual?.id || null,
    });
    if (error) { toast.error("Erro ao registrar"); return; }
    toast.success("Movimentação registrada!");
    setDialogOpen(false);
    setForm({ tipo: "entrada", descricao: "", valor: "", categoria: "" });
    qc.invalidateQueries({ queryKey: ["fc_extrato"] });
  };

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_auto_auto_auto] gap-3 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Caixa / Banco</Label>
                <Select value={contaId} onValueChange={setContaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CAIXA_LOJA}>Caixa da Loja</SelectItem>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} {c.banco ? `· ${c.banco}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  placeholder="Faça uma busca no histórico..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Nova Mov.</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div><Label>Tipo</Label>
                      <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">Entrada</SelectItem>
                          <SelectItem value="saida">Saída</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Descrição *</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                    <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
                    <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Opcional" /></div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSubmit}>Salvar</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Saldo atual card */}
            <Card className="bg-primary/5 border-primary/20 min-w-[220px]">
              <CardContent className="p-4 text-right">
                <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> Saldo Atual
                </div>
                <div className="text-sm font-semibold mt-1">{tituloConta}</div>
                <div className={cn("text-2xl font-bold tabular-nums", saldoFinal < 0 ? "text-destructive" : "text-primary")}>
                  R$ {fmtSaldo(saldoFinal)}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Fluxo de Caixa</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead className="text-right w-[130px]">Entradas (R$)</TableHead>
                  <TableHead className="text-right w-[130px]">Saídas (R$)</TableHead>
                  <TableHead className="text-right w-[130px]">A Receber (R$)</TableHead>
                  <TableHead className="text-right w-[140px]">Saldo Atual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                <TableRow className="bg-muted/30">
                  <TableCell>{fmtData(dataIni)}</TableCell>
                  <TableCell className="font-semibold">SALDO INICIAL</TableCell>
                  <TableCell className="text-right" />
                  <TableCell className="text-right" />
                  <TableCell className="text-right" />
                  <TableCell className="text-right font-semibold">{fmtSaldo(extrato?.saldoInicial ?? 0)}</TableCell>
                </TableRow>

                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
                )}

                {!isLoading && linhasComSaldo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="p-4">
                      <EmptyState
                        compact
                        icon={Wallet}
                        title="Sem movimentações no período"
                        description="Ajuste o intervalo, selecione outra conta ou registre uma nova movimentação."
                        action={{ label: "Nova movimentação", onClick: () => setDialogOpen(true), icon: Plus }}
                      />
                    </TableCell>
                  </TableRow>
                )}

                {linhasComSaldo.map((l, i) => (
                  <TableRow key={i} className="hover:bg-muted/40">
                    <TableCell>{fmtData(l.data)}</TableCell>
                    <TableCell className="max-w-[420px] truncate">{l.historico}</TableCell>
                    <TableCell className="text-right text-success">{fmtBR(l.entrada)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmtBR(l.saida)}</TableCell>
                    <TableCell className="text-right text-blue-600 dark:text-blue-400">{fmtBR(l.aReceber)}</TableCell>
                    <TableCell className={cn("text-right font-medium", l.saldo < 0 && "text-destructive")}>{fmtSaldo(l.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/60 font-semibold tabular-nums">
                  <TableCell colSpan={2}>TOTAL GERAL (Entradas, Saídas, A Receber)</TableCell>
                  <TableCell className="text-right text-success">{fmtSaldo(totais.entrada)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmtSaldo(totais.saida)}</TableCell>
                  <TableCell className="text-right text-blue-600 dark:text-blue-400">{fmtSaldo(totais.aReceber)}</TableCell>
                  <TableCell className={cn("text-right", saldoFinal < 0 && "text-destructive")}>{fmtSaldo(saldoFinal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Fluxo de Caixa" subtitle="Extrato de caixas e contas bancárias" />
      {content}
    </MainLayout>
  );
}
