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
import { CalendarDays, PlusCircle, AlertTriangle, Printer, Users, Umbrella } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { useState } from "react";
import { format, differenceInDays, addYears, parseISO } from "date-fns";
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
      const { data } = await supabase.from("configuracoes_empresa").select("*").limit(1).single();
      return data;
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-ferias", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("funcionarios").select("id, nome, cargo, data_admissao, salario").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
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

  return (
    <MainLayout>
      <Header title="Controle de Férias" subtitle="Período aquisitivo, agendamento e alertas" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
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

        {/* Alertas de férias vencidas */}
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
      </div>
    </MainLayout>
  );
}
