import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, PlusCircle, AlertTriangle, Printer, Users, Umbrella, Search, CalendarRange, Pencil, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { format, differenceInDays, differenceInMonths, addYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  agendada: { label: "Agendada", variant: "default" },
  em_gozo: { label: "Em Gozo", variant: "outline" },
  concluida: { label: "Concluída", variant: "default" },
  vencida: { label: "Vencida", variant: "destructive" },
};

export default function Ferias() {
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "",
    periodo_aquisitivo_inicio: "",
    data_inicio: "",
    data_fim: "",
    dias_vendidos: 0,
    observacoes: "",
  });

  const { data: empresaConfig } = useQuery({
    queryKey: ["empresa-config"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_empresa").select("id, nome_empresa, cnpj, telefone, endereco, mensagem_cupom, created_at, updated_at, empresa_id, regras_bia, regras_cadastro, asaas_sandbox").limit(1).single();
      return data;
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-ferias", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("funcionarios").select("id, nome, cargo, data_admissao, salario, unidade_id").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: unidadesList = [] } = useQuery({
    queryKey: ["unidades-ferias-prog"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: ferias = [], isLoading } = useQuery({
    queryKey: ["ferias", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("ferias").select("*, funcionarios(nome, cargo, salario)").order("periodo_aquisitivo_fim", { ascending: true });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Programação: funcionários da unidade selecionada, agrupados por loja
  const { data: funcionariosTodos = [], isLoading: loadingProg } = useQuery({
    queryKey: ["funcionarios-todos-ferias-prog", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      let q = supabase
        .from("funcionarios")
        .select("id, nome, cargo, data_admissao, salario, unidade_id, data_vencimento_ferias_override")
        .eq("ativo", true)
        .order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: feriasTodos = [] } = useQuery({
    queryKey: ["ferias-todos-prog", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      let q = supabase
        .from("ferias")
        .select("funcionario_id, periodo_aquisitivo_inicio, data_inicio, dias_gozados, dias_vendidos, unidade_id");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const criarFerias = useMutation({
    mutationFn: async () => {
      const inicio = parseISO(form.periodo_aquisitivo_inicio);
      const fim = addYears(inicio, 1);
      const func = funcionarios.find(f => f.id === form.funcionario_id);
      const salario = Number(func?.salario) || 0;
      const diasGozados = form.data_inicio && form.data_fim
        ? differenceInDays(parseISO(form.data_fim), parseISO(form.data_inicio)) + 1
        : 0;
      const diasVendidos = form.dias_vendidos || 0;
      const valorDiario = salario / 30;
      const valorFerias = diasGozados * valorDiario * (4 / 3); // salário + 1/3
      const valorAbono = diasVendidos * valorDiario;

      const { error } = await supabase.from("ferias").insert({
        funcionario_id: form.funcionario_id,
        unidade_id: unidadeAtual?.id,
        periodo_aquisitivo_inicio: form.periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim: format(fim, "yyyy-MM-dd"),
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        dias_direito: 30,
        dias_gozados: diasGozados,
        dias_vendidos: diasVendidos,
        valor_ferias: valorFerias,
        valor_abono: valorAbono,
        status: form.data_inicio ? "agendada" : "pendente",
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias"] });
      toast.success("Férias registradas com sucesso!");
      setOpen(false);
      setForm({ funcionario_id: "", periodo_aquisitivo_inicio: "", data_inicio: "", data_fim: "", dias_vendidos: 0, observacoes: "" });
    },
    onError: () => toast.error("Erro ao registrar férias"),
  });

  // Detectar férias vencidas (período concessivo = 12 meses após período aquisitivo)
  const feriasVencidas = ferias.filter((f: any) => {
    if (f.status === "concluida" || f.status === "em_gozo") return false;
    const limiteConcessivo = addYears(parseISO(f.periodo_aquisitivo_fim), 1);
    return new Date() > limiteConcessivo;
  });

  const handlePrintRecibo = (f: any) => {
    if (!empresaConfig) { toast.error("Configure os dados da empresa primeiro"); return; }
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = 210; const ml = 15; let y = 20;

    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text(empresaConfig.nome_empresa.toUpperCase(), pw / 2, y, { align: "center" }); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    if (empresaConfig.cnpj) { doc.text(`CNPJ: ${empresaConfig.cnpj}`, pw / 2, y, { align: "center" }); y += 4; }
    if (empresaConfig.endereco) { doc.text(empresaConfig.endereco, pw / 2, y, { align: "center" }); y += 4; }
    y += 4; doc.line(ml, y, pw - ml, y); y += 8;

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("AVISO / RECIBO DE FÉRIAS", pw / 2, y, { align: "center" }); y += 10;

    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    const nome = f.funcionarios?.nome || "—";
    const cargo = f.funcionarios?.cargo || "—";
    doc.text(`Funcionário: ${nome}`, ml, y); doc.text(`Cargo: ${cargo}`, pw / 2, y); y += 6;
    doc.text(`Período Aquisitivo: ${format(parseISO(f.periodo_aquisitivo_inicio), "dd/MM/yyyy")} a ${format(parseISO(f.periodo_aquisitivo_fim), "dd/MM/yyyy")}`, ml, y); y += 6;
    if (f.data_inicio && f.data_fim) {
      doc.text(`Período de Gozo: ${format(parseISO(f.data_inicio), "dd/MM/yyyy")} a ${format(parseISO(f.data_fim), "dd/MM/yyyy")}`, ml, y); y += 6;
    }
    doc.text(`Dias de Direito: ${f.dias_direito}`, ml, y);
    doc.text(`Dias Gozados: ${f.dias_gozados}`, pw / 2, y); y += 6;
    doc.text(`Dias Vendidos (Abono): ${f.dias_vendidos}`, ml, y); y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("DESCRIÇÃO", ml, y); doc.text("VALOR", pw - ml, y, { align: "right" }); y += 2;
    doc.line(ml, y, pw - ml, y); y += 6;

    doc.setFont("helvetica", "normal");
    doc.text("Férias (salário + 1/3)", ml, y);
    doc.text(`R$ ${Number(f.valor_ferias).toFixed(2).replace(".", ",")}`, pw - ml, y, { align: "right" }); y += 6;
    if (f.dias_vendidos > 0) {
      doc.text("Abono Pecuniário", ml, y);
      doc.text(`R$ ${Number(f.valor_abono).toFixed(2).replace(".", ",")}`, pw - ml, y, { align: "right" }); y += 6;
    }
    y += 2; doc.line(ml, y, pw - ml, y); y += 6;
    const total = Number(f.valor_ferias) + Number(f.valor_abono);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("TOTAL:", ml, y);
    doc.text(`R$ ${total.toFixed(2).replace(".", ",")}`, pw - ml, y, { align: "right" }); y += 20;

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.line(ml, y, 90, y); doc.line(120, y, pw - ml, y); y += 4;
    doc.text("Empregador", ml + 20, y); doc.text("Funcionário", 145, y);

    doc.save(`recibo-ferias-${nome.replace(/\s/g, "-").toLowerCase()}.pdf`);
    toast.success("Recibo de férias gerado!");
  };

  // ===== Programação de Férias =====
  const [filtroNome, setFiltroNome] = useState("");
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [editandoVencto, setEditandoVencto] = useState<string | null>(null);
  const [novoVencto, setNovoVencto] = useState("");

  const updateVencimento = useMutation({
    mutationFn: async ({ funcionarioId, data }: { funcionarioId: string; data: string | null }) => {
      const { error } = await supabase
        .from("funcionarios")
        .update({ data_vencimento_ferias_override: data })
        .eq("id", funcionarioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vencimento de férias atualizado");
      queryClient.invalidateQueries({ queryKey: ["funcionarios-todos-ferias-prog"] });
      setEditandoVencto(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const programacao = useMemo(() => {
    const hoje = new Date();
    return funcionariosTodos
      .filter((f: any) => f.data_admissao)
      .map((f: any) => {
        const admissao = parseISO(f.data_admissao);
        const anosCompletos = Math.floor(differenceInDays(hoje, admissao) / 365.25);
        const inicioAquisitivo = addYears(admissao, anosCompletos);
        const fimAquisitivoCalc = addYears(inicioAquisitivo, 1);
        const fimAquisitivo = f.data_vencimento_ferias_override
          ? parseISO(f.data_vencimento_ferias_override)
          : fimAquisitivoCalc;
        const limiteConcessivo = addYears(fimAquisitivo, 1);

        const mesesNoCiclo = Math.min(12, Math.max(0, differenceInMonths(hoje, inicioAquisitivo)));
        const proporcional = (mesesNoCiclo / 12) * 30;

        const regsCiclo = feriasTodos.filter((r: any) =>
          r.funcionario_id === f.id &&
          r.periodo_aquisitivo_inicio &&
          Math.abs(differenceInDays(parseISO(r.periodo_aquisitivo_inicio), inicioAquisitivo)) <= 30
        );
        const regAtual: any = regsCiclo[0];
        const totalGozo = regsCiclo.reduce((s: number, r: any) => s + (Number(r.dias_gozados) || 0), 0);
        const totalAbono = regsCiclo.reduce((s: number, r: any) => s + (Number(r.dias_vendidos) || 0), 0);

        const inicioAno = new Date(hoje.getFullYear(), 0, 1);
        const baseInicio13 = admissao > inicioAno ? admissao : inicioAno;
        const meses13 = Math.min(12, Math.max(0, differenceInMonths(hoje, baseInicio13) + 1));
        const salario = Number(f.salario) || 0;
        const decimoTerceiro = (meses13 / 12) * salario;

        const vencidas = hoje > limiteConcessivo && totalGozo < 30;
        const diasParaLimite = differenceInDays(limiteConcessivo, hoje);

        return {
          id: f.id,
          nome: f.nome,
          unidade_id: f.unidade_id,
          admissao,
          inicioAquisitivo,
          fimAquisitivo,
          fimAquisitivoCalc,
          vencimentoOverride: f.data_vencimento_ferias_override as string | null,
          limiteConcessivo,
          proporcional,
          regAtual,
          totalGozo,
          totalAbono,
          decimoTerceiro,
          vencidas,
          diasParaLimite,
          diasRestantes: Math.max(0, 30 - totalGozo - totalAbono),
        };
      })
      .filter((p) => !filtroNome || p.nome.toLowerCase().includes(filtroNome.toLowerCase()))
      .filter((p) => !apenasPendentes || p.vencidas || p.diasParaLimite < 60)
      .sort((a, b) => a.limiteConcessivo.getTime() - b.limiteConcessivo.getTime());
  }, [funcionariosTodos, feriasTodos, filtroNome, apenasPendentes]);

  // Agrupa programação por unidade (loja)
  const programacaoPorUnidade = useMemo(() => {
    const grupos = new Map<string, { unidadeNome: string; itens: typeof programacao }>();
    for (const p of programacao) {
      const uid = p.unidade_id || "sem-unidade";
      const nomeUnidade = unidadesList.find((u: any) => u.id === p.unidade_id)?.nome || "Sem unidade";
      if (!grupos.has(uid)) grupos.set(uid, { unidadeNome: nomeUnidade, itens: [] });
      grupos.get(uid)!.itens.push(p);
    }
    return Array.from(grupos.entries()).sort((a, b) => a[1].unidadeNome.localeCompare(b[1].unidadeNome));
  }, [programacao, unidadesList]);

  const corLimite = (dias: number, vencidas: boolean): "default" | "secondary" | "destructive" | "outline" => {
    if (vencidas) return "destructive";
    if (dias < 60) return "secondary";
    return "outline";
  };

  return (
    <MainLayout>
      <Header title="Controle de Férias" subtitle="Período aquisitivo, agendamento e alertas" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <Tabs defaultValue="registros" className="space-y-4">
          <TabsList>
            <TabsTrigger value="registros" className="gap-2"><CalendarDays className="h-4 w-4" />Registros</TabsTrigger>
            <TabsTrigger value="programacao" className="gap-2"><CalendarRange className="h-4 w-4" />Programação</TabsTrigger>
          </TabsList>

          <TabsContent value="registros" className="space-y-4 md:space-y-6">
            <div className="flex items-center justify-between">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><PlusCircle className="h-4 w-4" />Registrar Férias</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Registrar Férias</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Funcionário</Label>
                      <Select value={form.funcionario_id} onValueChange={v => setForm(p => ({ ...p, funcionario_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Início Período Aquisitivo</Label>
                      <Input type="date" value={form.periodo_aquisitivo_inicio} onChange={e => setForm(p => ({ ...p, periodo_aquisitivo_inicio: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Início Gozo</Label><Input type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} /></div>
                      <div><Label>Fim Gozo</Label><Input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} /></div>
                    </div>
                    <div>
                      <Label>Dias Vendidos (Abono Pecuniário)</Label>
                      <Input type="number" min={0} max={10} value={form.dias_vendidos} onChange={e => setForm(p => ({ ...p, dias_vendidos: Number(e.target.value) }))} />
                    </div>
                    <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} /></div>
                    <Button className="w-full" onClick={() => criarFerias.mutate()} disabled={!form.funcionario_id || !form.periodo_aquisitivo_inicio}>
                      Salvar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {feriasVencidas.length > 0 && (
              <Card className="border-destructive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Férias Vencidas — Atenção!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {feriasVencidas.map((f: any) => (
                      <li key={f.id}>
                        <span className="font-medium">{f.funcionarios?.nome}</span> — período aquisitivo encerrado em {format(parseISO(f.periodo_aquisitivo_fim), "dd/MM/yyyy")}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{ferias.length}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Férias Vencidas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-destructive">{feriasVencidas.length}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Em Gozo</CardTitle>
                  <Umbrella className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-primary">{ferias.filter((f: any) => f.status === "em_gozo").length}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Férias dos Funcionários</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : ferias.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum registro de férias</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Período Aquisitivo</TableHead>
                        <TableHead>Gozo</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ferias.map((f: any) => {
                        const st = statusMap[f.status] || statusMap.pendente;
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium">{f.funcionarios?.nome || "—"}</TableCell>
                            <TableCell className="text-xs">
                              {format(parseISO(f.periodo_aquisitivo_inicio), "dd/MM/yy")} — {format(parseISO(f.periodo_aquisitivo_fim), "dd/MM/yy")}
                            </TableCell>
                            <TableCell className="text-xs">
                              {f.data_inicio && f.data_fim
                                ? `${format(parseISO(f.data_inicio), "dd/MM/yy")} — ${format(parseISO(f.data_fim), "dd/MM/yy")}`
                                : "Não agendado"}
                            </TableCell>
                            <TableCell>{f.dias_gozados}{f.dias_vendidos > 0 && ` + ${f.dias_vendidos} vendidos`}</TableCell>
                            <TableCell>R$ {(Number(f.valor_ferias) + Number(f.valor_abono)).toLocaleString("pt-BR")}</TableCell>
                            <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="gap-1" onClick={() => handlePrintRecibo(f)}>
                                <Printer className="h-3 w-3" /> Recibo
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="programacao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5" />Programação de Férias
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar funcionário..."
                      value={filtroNome}
                      onChange={e => setFiltroNome(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant={apenasPendentes ? "default" : "outline"}
                    onClick={() => setApenasPendentes(v => !v)}
                    className="gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {apenasPendentes ? "Mostrando pendentes" : "Apenas pendentes/vencidas"}
                  </Button>
                </div>

                {loadingProg ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : funcionariosTodos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum funcionário ativo cadastrado</p>
                ) : programacao.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum funcionário com data de admissão preenchida. Edite o cadastro em RH/Funcionários.
                  </p>
                ) : (
                  <div className="space-y-8">
                    {programacaoPorUnidade.map(([uid, grupo]) => (
                      <div key={uid} className="space-y-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="font-semibold text-base flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            {grupo.unidadeNome}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            Total de empregados: <strong>{grupo.itens.length}</strong>
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[160px]">Empregado</TableHead>
                                <TableHead>Admissão</TableHead>
                                <TableHead>Vencto. férias</TableHead>
                                <TableHead>Fer. venc.</TableHead>
                                <TableHead>Fer. pro.</TableHead>
                                <TableHead>Início aquis.</TableHead>
                                <TableHead>Fim aquis.</TableHead>
                                <TableHead>Início gozo</TableHead>
                                <TableHead>Dias</TableHead>
                                <TableHead>Abono</TableHead>
                                <TableHead>13º</TableHead>
                                <TableHead>Dias dir.</TableHead>
                                <TableHead>Dias goz.</TableHead>
                                <TableHead>Dias rest.</TableHead>
                                <TableHead>Limite p/ gozo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {grupo.itens.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium whitespace-nowrap">{p.nome}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{format(p.admissao, "dd/MM/yyyy")}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    <Popover
                                      open={editandoVencto === p.id}
                                      onOpenChange={(o) => {
                                        if (o) {
                                          setEditandoVencto(p.id);
                                          setNovoVencto(format(p.fimAquisitivo, "yyyy-MM-dd"));
                                        } else {
                                          setEditandoVencto(null);
                                        }
                                      }}
                                    >
                                      <PopoverTrigger asChild>
                                        <button className="inline-flex items-center gap-1 hover:underline group">
                                          <span className={p.vencimentoOverride ? "font-semibold text-primary" : ""}>
                                            {format(p.fimAquisitivo, "dd/MM/yyyy")}
                                          </span>
                                          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64 p-3 space-y-2" align="start">
                                        <Label className="text-xs">Vencimento das férias</Label>
                                        <Input
                                          type="date"
                                          value={novoVencto}
                                          onChange={(e) => setNovoVencto(e.target.value)}
                                          className="h-8"
                                        />
                                        <div className="flex gap-1 justify-between pt-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-xs"
                                            onClick={() => updateVencimento.mutate({ funcionarioId: p.id, data: null })}
                                            disabled={updateVencimento.isPending || !p.vencimentoOverride}
                                          >
                                            <X className="h-3 w-3 mr-1" /> Resetar
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => updateVencimento.mutate({ funcionarioId: p.id, data: novoVencto })}
                                            disabled={updateVencimento.isPending || !novoVencto}
                                          >
                                            <Check className="h-3 w-3 mr-1" /> Salvar
                                          </Button>
                                        </div>
                                        {p.vencimentoOverride && (
                                          <p className="text-[10px] text-muted-foreground">
                                            Calc. automático: {format(p.fimAquisitivoCalc, "dd/MM/yyyy")}
                                          </p>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  </TableCell>
                                  <TableCell>
                                    {p.vencidas
                                      ? <Badge variant="destructive">Sim</Badge>
                                      : <Badge variant="outline">Não</Badge>}
                                  </TableCell>
                                  <TableCell className="text-xs">{p.proporcional.toFixed(1)}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{format(p.inicioAquisitivo, "dd/MM/yyyy")}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{format(p.fimAquisitivo, "dd/MM/yyyy")}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {p.regAtual?.data_inicio ? format(parseISO(p.regAtual.data_inicio), "dd/MM/yyyy") : "—"}
                                  </TableCell>
                                  <TableCell>{p.regAtual?.dias_gozados ?? 0}</TableCell>
                                  <TableCell>{p.regAtual?.dias_vendidos ?? 0}</TableCell>
                                  <TableCell className="text-xs">R$ {p.decimoTerceiro.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</TableCell>
                                  <TableCell>30</TableCell>
                                  <TableCell>{p.totalGozo}</TableCell>
                                  <TableCell>
                                    <span className={p.diasRestantes > 0 ? "font-semibold text-primary" : "text-muted-foreground"}>
                                      {p.diasRestantes}
                                    </span>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Badge variant={corLimite(p.diasParaLimite, p.vencidas)}>
                                      {format(p.limiteConcessivo, "dd/MM/yyyy")}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
