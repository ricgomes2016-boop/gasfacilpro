import { useState, useMemo, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Wallet, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDateString } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { resolveCategoriaDespesaNome, useCategoriasDespesa } from "@/hooks/useCategoriasDespesa";

interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  saldo_atual: number;
  unidade_id: string | null;
  unidades?: { nome: string } | null;
}

interface Props {
  contas: ContaBancaria[];
  toolbarExtra?: ReactNode;
}

export default function ExtratoBancario({ contas, toolbarExtra }: Props) {
  const { user } = useAuth();
  const { categorias: categoriasDespesa } = useCategoriasDespesa();
  const queryClient = useQueryClient();
  const [contaSelecionada, setContaSelecionada] = useState<string>(contas[0]?.id || "");
  const [periodo, setPeriodo] = useState("30");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "entrada" as "entrada" | "saida",
    descricao: "",
    valor: "",
    categoria: "",
    data: getBrasiliaDateString(),
    observacoes: "",
  });

  const dataInicio = useMemo(() => {
    return format(subDays(new Date(), parseInt(periodo)), "yyyy-MM-dd");
  }, [periodo]);

  const conta = contas.find(c => c.id === contaSelecionada);

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes-bancarias", contaSelecionada, dataInicio],
    queryFn: async () => {
      if (!contaSelecionada) return [];
      const { data, error } = await supabase
        .from("movimentacoes_bancarias")
        .select("*")
        .eq("conta_bancaria_id", contaSelecionada)
        .gte("data", dataInicio)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!contaSelecionada,
  });

  const registrarMovimentacao = async () => {
    const valor = parseFloat(form.valor.replace(",", "."));
    if (!form.descricao || !valor || valor <= 0) {
      toast.error("Preencha descrição e valor"); return;
    }
    if (!contaSelecionada) {
      toast.error("Selecione uma conta"); return;
    }
    const categoriaCadastro = form.tipo === "saida"
      ? resolveCategoriaDespesaNome(form.categoria, categoriasDespesa)
      : form.categoria;
    if (!categoriaCadastro) {
      toast.error(form.tipo === "saida" ? "Selecione uma categoria de despesa cadastrada" : "Selecione uma categoria");
      return;
    }

    const saldoAtual = conta?.saldo_atual || 0;
    const novoSaldo = form.tipo === "entrada"
      ? saldoAtual + valor
      : saldoAtual - valor;

    const { error: movError } = await supabase.from("movimentacoes_bancarias").insert({
      conta_bancaria_id: contaSelecionada,
      data: form.data,
      tipo: form.tipo,
      categoria: categoriaCadastro,
      descricao: form.descricao,
      valor: form.tipo === "entrada" ? valor : -valor,
      saldo_apos: novoSaldo,
      observacoes: form.observacoes || null,
      user_id: user?.id,
      unidade_id: conta?.unidade_id || null,
    });
    if (movError) { toast.error("Erro ao registrar"); console.error(movError); return; }

    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", contaSelecionada);

    toast.success(`${form.tipo === "entrada" ? "Entrada" : "Saída"} registrada!`);
    setDialogOpen(false);
    setForm({ tipo: "entrada", descricao: "", valor: "", categoria: "", data: getBrasiliaDateString(), observacoes: "" });
    queryClient.invalidateQueries({ queryKey: ["movimentacoes-bancarias"] });
    queryClient.invalidateQueries({ queryKey: ["contas-bancarias"] });
  };

  // Cálculos
  const totalEntradas = movimentacoes
    .filter((m: any) => Number(m.valor) > 0)
    .reduce((acc: number, m: any) => acc + Number(m.valor), 0);
  const totalSaidas = movimentacoes
    .filter((m: any) => Number(m.valor) < 0)
    .reduce((acc: number, m: any) => acc + Math.abs(Number(m.valor)), 0);

  // Agrupar por dia
  const movsPorDia = useMemo(() => {
    const grouped: Record<string, { movs: any[]; saldoDia: number }> = {};
    for (const m of movimentacoes) {
      const dia = m.data;
      if (!grouped[dia]) grouped[dia] = { movs: [], saldoDia: 0 };
      grouped[dia].movs.push(m);
      grouped[dia].saldoDia += Number(m.valor);
    }
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [movimentacoes]);

  const categoriasEntrada = [
    { value: "manual", label: "Manual" },
    { value: "venda", label: "Venda" },
    { value: "transferencia", label: "Transferência" },
    { value: "deposito", label: "Depósito" },
    { value: "saque", label: "Saque" },
    { value: "recebimento_cliente", label: "Receb. Cliente" },
    { value: "outro", label: "Outro" },
  ];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px]">
          <Label className="text-xs">Conta Bancária</Label>
          <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {contas.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} ({c.banco})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Período</Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={!contaSelecionada}>
          <Plus className="h-4 w-4 mr-2" />Nova Movimentação
        </Button>
        {toolbarExtra && <div className="flex items-end">{toolbarExtra}</div>}
      </div>


      {/* KPIs */}
      {conta && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Saldo Atual</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${Number(conta.saldo_atual) >= 0 ? "text-success" : "text-destructive"}`}>
                R$ {Number(conta.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Entradas ({periodo}d)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <p className="text-xl font-bold text-success">
                  R$ {totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Saídas ({periodo}d)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <p className="text-xl font-bold text-destructive">
                  R$ {totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Movimentações</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{movimentacoes.length}</p>
              <p className="text-xs text-muted-foreground">no período</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Extrato agrupado por dia */}
      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">Carregando...</p>
      ) : movsPorDia.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <EmptyState
              icon={Wallet}
              title="Nenhuma movimentação no período"
              description="Escolha outro período ou registre uma movimentação para acompanhar o extrato."
              action={{ label: "Nova movimentação", onClick: () => setDialogOpen(true), icon: Plus }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {movsPorDia.map(([dia, { movs, saldoDia }]) => (
            <Card key={dia}>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">
                    {format(new Date(dia + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: undefined })}
                  </span>
                </div>
                <Badge variant={saldoDia >= 0 ? "default" : "destructive"} className="text-xs">
                  {saldoDia >= 0 ? "+" : ""}R$ {saldoDia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {movs.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="w-8 pl-4">
                          {Number(m.valor) >= 0 ? (
                            <ArrowUpCircle className="h-4 w-4 text-success" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{m.descricao}</p>
                          {m.observacoes && <p className="text-xs text-muted-foreground">{m.observacoes}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{m.categoria}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${Number(m.valor) >= 0 ? "text-success" : "text-destructive"}`}>
                          {Number(m.valor) >= 0 ? "+" : ""}R$ {Math.abs(Number(m.valor)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground pr-4">
                          {m.saldo_apos != null && `Saldo: R$ ${Number(m.saldo_apos).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Nova Movimentação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />Nova Movimentação</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v: "entrada" | "saida") => setForm({ ...form, tipo: v, categoria: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">↑ Entrada</SelectItem>
                    <SelectItem value="saida">↓ Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {form.tipo === "saida" ? (
                      categoriasDespesa.length === 0 ? (
                        <SelectItem value="__sem_categoria__" disabled>Cadastre categorias em Configurações</SelectItem>
                      ) : (
                        categoriasDespesa.map(c => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)
                      )
                    ) : (
                      categoriasEntrada.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Depósito PIX cliente João" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor *</Label><Input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00" /></div>
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Opcional" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={registrarMovimentacao}>Registrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
