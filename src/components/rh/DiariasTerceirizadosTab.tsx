import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, CheckCircle2, Trash2, Loader2, ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Diaria {
  id: string;
  funcionario_id: string;
  data: string;
  valor: number;
  observacoes: string | null;
  status: string;
}

interface FuncionarioTerc {
  id: string;
  nome: string;
  tipo_vinculo: string;
  regime_pagamento: string;
  valor_diaria: number;
}

export function DiariasTerceirizadosTab() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(new Date());
  const [openNovo, setOpenNovo] = useState(false);
  const [novoFuncId, setNovoFuncId] = useState("");
  const [novoData, setNovoData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [novoValor, setNovoValor] = useState("");
  const [novoObs, setNovoObs] = useState("");

  const mesInicio = format(startOfMonth(mes), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(mes), "yyyy-MM-dd");

  // Funcionários terceirizados / freelancers / pj
  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-terceirizados", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase
        .from("funcionarios")
        .select("id, nome, tipo_vinculo, regime_pagamento, valor_diaria")
        .eq("ativo", true)
        .neq("tipo_vinculo", "clt")
        .order("nome");
      if (unidadeAtual?.id) q = q.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      const { data } = await q;
      return (data || []) as FuncionarioTerc[];
    },
  });

  const funcMap = useMemo(() => {
    const m = new Map<string, FuncionarioTerc>();
    funcionarios.forEach((f) => m.set(f.id, f));
    return m;
  }, [funcionarios]);

  const { data: diarias = [], isLoading } = useQuery({
    queryKey: ["funcionario-diarias", unidadeAtual?.id, mesInicio, mesFim],
    queryFn: async () => {
      let q = supabase
        .from("funcionario_diarias")
        .select("*")
        .gte("data", mesInicio)
        .lte("data", mesFim)
        .order("data", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as Diaria[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!novoFuncId || !novoData) throw new Error("Selecione funcionário e data");
      const valor = parseFloat(novoValor.replace(",", ".")) || 0;
      const { error } = await supabase.from("funcionario_diarias").insert({
        funcionario_id: novoFuncId,
        data: novoData,
        valor,
        observacoes: novoObs || null,
        status: "pendente",
        unidade_id: unidadeAtual?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Diária registrada!" });
      queryClient.invalidateQueries({ queryKey: ["funcionario-diarias"] });
      setOpenNovo(false);
      setNovoObs("");
      setNovoValor("");
    },
    onError: (e: any) => {
      const msg = e.message?.includes("duplicate") || e.code === "23505"
        ? "Já existe uma diária para este funcionário nesta data"
        : e.message;
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const togglePagaMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("funcionario_diarias")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionario-diarias"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcionario_diarias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Diária removida" });
      queryClient.invalidateQueries({ queryKey: ["funcionario-diarias"] });
    },
  });

  // Gerar diárias do mês a partir das escalas confirmadas
  const gerarDoMesMutation = useMutation({
    mutationFn: async () => {
      const tercIds = funcionarios.map((f) => f.id);
      if (tercIds.length === 0) return { criadas: 0, ignoradas: 0 };

      // Busca escalas no mês para esses funcionários (via funcionario_id OU via entregadores ligados)
      let q = supabase
        .from("escalas_entregador")
        .select("funcionario_id, entregador_id, data")
        .gte("data", mesInicio)
        .lte("data", mesFim);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data: escalas } = await q;

      // Resolve entregador → funcionario via tabela entregadores
      const { data: ents } = await supabase
        .from("entregadores")
        .select("id, funcionario_id")
        .in("funcionario_id", tercIds);
      const entToFunc = new Map<string, string>();
      (ents || []).forEach((e: any) => {
        if (e.funcionario_id) entToFunc.set(e.id, e.funcionario_id);
      });

      const candidatos: Array<{ funcionario_id: string; data: string; valor: number }> = [];
      (escalas || []).forEach((esc: any) => {
        const fid =
          esc.funcionario_id ||
          (esc.entregador_id ? entToFunc.get(esc.entregador_id) : null);
        if (!fid) return;
        const f = funcMap.get(fid);
        if (!f) return;
        candidatos.push({ funcionario_id: fid, data: esc.data, valor: Number(f.valor_diaria) || 0 });
      });

      // Idempotente: tenta inserir tudo, ON CONFLICT por (funcionario_id, data) nada acontece
      let criadas = 0;
      let ignoradas = 0;
      for (const c of candidatos) {
        const { error } = await supabase.from("funcionario_diarias").insert({
          ...c,
          status: "pendente",
          unidade_id: unidadeAtual?.id || null,
        });
        if (error) {
          if ((error as any).code === "23505") ignoradas++;
          else ignoradas++;
        } else {
          criadas++;
        }
      }
      return { criadas, ignoradas };
    },
    onSuccess: (res) => {
      toast({
        title: "Diárias geradas",
        description: `${res.criadas} criada(s) · ${res.ignoradas} já existiam`,
      });
      queryClient.invalidateQueries({ queryKey: ["funcionario-diarias"] });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao gerar diárias", description: e.message, variant: "destructive" });
    },
  });

  const totalMes = diarias.reduce((s, d) => s + Number(d.valor || 0), 0);
  const totalPendente = diarias.filter((d) => d.status === "pendente").reduce((s, d) => s + Number(d.valor || 0), 0);
  const totalPago = diarias.filter((d) => d.status === "paga").reduce((s, d) => s + Number(d.valor || 0), 0);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const openNovoModal = () => {
    setNovoFuncId(funcionarios[0]?.id || "");
    setNovoData(format(new Date(), "yyyy-MM-dd"));
    setNovoValor(funcionarios[0]?.valor_diaria?.toString() || "");
    setNovoObs("");
    setOpenNovo(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMes((p) => subMonths(p, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold capitalize min-w-[160px] text-center">
            {format(mes, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMes((p) => addMonths(p, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => gerarDoMesMutation.mutate()}
            disabled={gerarDoMesMutation.isPending || funcionarios.length === 0}
            className="gap-2"
          >
            {gerarDoMesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Gerar Diárias do Mês
          </Button>
          <Button onClick={openNovoModal} disabled={funcionarios.length === 0} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Diária
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total do Mês</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">R$ {fmt(totalMes)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendente</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-warning">R$ {fmt(totalPendente)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pago</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">R$ {fmt(totalPago)}</div></CardContent>
        </Card>
      </div>

      {funcionarios.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum funcionário terceirizado cadastrado. Vá em <strong>Cadastros → Funcionários</strong> e
            defina o tipo de vínculo como Terceirizado / Freelancer / PJ.
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diárias do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diarias.map((d) => {
                  const f = funcMap.get(d.funcionario_id);
                  return (
                    <TableRow key={d.id}>
                      <TableCell>{format(new Date(d.data + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{f?.nome || "—"}</TableCell>
                      <TableCell>R$ {fmt(Number(d.valor))}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[280px] truncate">
                        {d.observacoes || "—"}
                      </TableCell>
                      <TableCell>
                        {d.status === "paga" ? (
                          <Badge className="bg-success/15 text-success border-success/30">Paga</Badge>
                        ) : d.status === "cancelada" ? (
                          <Badge variant="secondary">Cancelada</Badge>
                        ) : (
                          <Badge variant="outline" className="border-warning/40 text-warning">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {d.status !== "paga" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => togglePagaMutation.mutate({ id: d.id, status: "paga" })}
                              title="Marcar como paga"
                            >
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(d.id)}
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {diarias.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma diária registrada neste mês.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal nova diária */}
      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Diária</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Funcionário</Label>
              <Select
                value={novoFuncId}
                onValueChange={(v) => {
                  setNovoFuncId(v);
                  const f = funcMap.get(v);
                  if (f) setNovoValor(f.valor_diaria?.toString() || "");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome} <span className="text-muted-foreground text-xs">({f.tipo_vinculo})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={novoData} onChange={(e) => setNovoData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                placeholder="120.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Input
                value={novoObs}
                onChange={(e) => setNovoObs(e.target.value)}
                placeholder="Cobertura turno tarde, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNovo(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
