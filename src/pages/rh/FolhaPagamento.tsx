import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DollarSign, Users, Download, Calendar, Printer, Info, Lock, History, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUnidade } from "@/contexts/UnidadeContext";
import { generateFolhaRecibo } from "@/services/receiptRhService";
import { toast } from "sonner";
import { useState, useMemo } from "react";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function FolhaPagamento() {
  const queryClient = useQueryClient();
  const [mesSelecionado, setMesSelecionado] = useState(new Date());
  const [showHistorico, setShowHistorico] = useState(false);
  const [showConfirmFechar, setShowConfirmFechar] = useState(false);

  const mesAtual = format(mesSelecionado, "MMMM yyyy", { locale: ptBR });
  const mesKey = format(mesSelecionado, "yyyy-MM");
  const mesInicio = startOfMonth(mesSelecionado).toISOString();
  const mesFim = endOfMonth(mesSelecionado).toISOString();
  const { unidadeAtual } = useUnidade();

  const [descontosEdit, setDescontosEdit] = useState<Record<string, { inss: string; ir: string; outros: string }>>({});

  const { data: empresaConfig } = useQuery({
    queryKey: ["empresa-config"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_empresa").select("*").limit(1).single();
      return data;
    },
  });

  // Check if month is already closed
  const { data: folhaFechada } = useQuery({
    queryKey: ["folha-fechada", mesKey, unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("folhas_pagamento").select("*").eq("mes_referencia", mesKey);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query.limit(1).single();
      return data;
    },
  });

  // Fetch closed payrolls history
  const { data: historicoFolhas = [] } = useQuery({
    queryKey: ["folhas-historico", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("folhas_pagamento").select("*").order("mes_referencia", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["folha-pagamento", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("funcionarios").select("*").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: entregadores = [] } = useQuery({
    queryKey: ["folha-entregadores", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("entregadores").select("id, nome").eq("ativo", true);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: bancoHoras = [] } = useQuery({
    queryKey: ["folha-banco-horas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("banco_horas").select("funcionario_id, saldo_positivo");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: valesMes = [] } = useQuery({
    queryKey: ["folha-vales", unidadeAtual?.id, mesKey],
    queryFn: async () => {
      let query = supabase
        .from("vales_funcionario")
        .select("funcionario_id, valor, tipo")
        .eq("status", "pendente")
        .gte("data", format(startOfMonth(mesSelecionado), "yyyy-MM-dd"))
        .lte("data", format(endOfMonth(mesSelecionado), "yyyy-MM-dd"));
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: comissaoConfig = [] } = useQuery({
    queryKey: ["folha-comissao-config", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("comissao_config").select("produto_id, canal_venda, valor");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: pedidosMes = [] } = useQuery({
    queryKey: ["folha-pedidos-comissao", unidadeAtual?.id, mesKey],
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select("id, entregador_id, canal_venda")
        .eq("status", "entregue")
        .not("entregador_id", "is", null)
        .gte("created_at", mesInicio)
        .lte("created_at", mesFim);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: itensMes = [] } = useQuery({
    queryKey: ["folha-itens-comissao", pedidosMes.map((p: any) => p.id).join(",")],
    enabled: pedidosMes.length > 0,
    queryFn: async () => {
      const ids = pedidosMes.map((p: any) => p.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("pedido_itens").select("pedido_id, produto_id, quantidade").in("pedido_id", ids);
      return data || [];
    },
  });

  // Fetch bonus aprovados do mês
  const { data: bonusMes = [] } = useQuery({
    queryKey: ["folha-bonus", unidadeAtual?.id, mesKey],
    queryFn: async () => {
      let query = supabase
        .from("bonus")
        .select("funcionario_id, valor")
        .eq("status", "aprovado")
        .eq("mes_referencia", mesKey);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const comissaoMap = useMemo(() => {
    const map = new Map<string, number>();
    comissaoConfig.forEach((c: any) => map.set(`${c.produto_id}|${c.canal_venda}`, Number(c.valor)));
    return map;
  }, [comissaoConfig]);

  const pedidoMap = useMemo(() => {
    const map = new Map<string, any>();
    pedidosMes.forEach((p: any) => map.set(p.id, p));
    return map;
  }, [pedidosMes]);

  const comissaoPorEntregador = useMemo(() => {
    const totals = new Map<string, number>();
    itensMes.forEach((item: any) => {
      const pedido = pedidoMap.get(item.pedido_id);
      if (!pedido) return;
      const canal = pedido.canal_venda || "portaria";
      const comUnit = comissaoMap.get(`${item.produto_id}|${canal}`) ?? 0;
      const total = (item.quantidade || 1) * comUnit;
      totals.set(pedido.entregador_id, (totals.get(pedido.entregador_id) || 0) + total);
    });
    return totals;
  }, [itensMes, pedidoMap, comissaoMap]);

  const funcToEntregadorId = useMemo(() => {
    const map = new Map<string, string>();
    funcionarios.forEach((f: any) => {
      const match = entregadores.find((e: any) => normalize(e.nome) === normalize(f.nome));
      if (match) map.set(f.id, match.id);
    });
    return map;
  }, [funcionarios, entregadores]);

  const valesPorFunc = useMemo(() => {
    const map = new Map<string, number>();
    valesMes.forEach((v: any) => {
      map.set(v.funcionario_id, (map.get(v.funcionario_id) || 0) + Number(v.valor));
    });
    return map;
  }, [valesMes]);

  const bonusPorFunc = useMemo(() => {
    const map = new Map<string, number>();
    bonusMes.forEach((b: any) => {
      map.set(b.funcionario_id, (map.get(b.funcionario_id) || 0) + Number(b.valor));
    });
    return map;
  }, [bonusMes]);

  const dadosFolha = useMemo(() => {
    return funcionarios.map((f: any) => {
      const salarioBase = Number(f.salario) || 0;
      const periculosidade = Math.round(salarioBase * 0.30 * 100) / 100; // 30% do salário
      const bh = bancoHoras.find((b: any) => b.funcionario_id === f.id);
      const horasExtras = bh ? Math.round(Number(bh.saldo_positivo) * 15) : 0;
      const entId = funcToEntregadorId.get(f.id);
      const comissao = entId ? (comissaoPorEntregador.get(entId) || 0) : 0;
      const valesDesconto = valesPorFunc.get(f.id) || 0;
      const bonusVal = bonusPorFunc.get(f.id) || 0;

      const salContrINSS = salarioBase + periculosidade; // Base de contribuição INSS
      const edit = descontosEdit[f.id] || { inss: "", ir: "", outros: "" };
      const inss = edit.inss !== "" ? parseFloat(edit.inss) || 0 : Math.round(salContrINSS * 0.0809 * 100) / 100; // 8,09%
      const ir = edit.ir !== "" ? parseFloat(edit.ir) || 0 : 0;
      const outros = edit.outros !== "" ? parseFloat(edit.outros) || 0 : 0;

      const bruto = salarioBase + periculosidade + horasExtras + comissao + bonusVal;
      const totalDescontos = inss + ir + outros + valesDesconto;
      const liquido = bruto - totalDescontos;

      return {
        id: f.id,
        funcionario: f.nome,
        cargo: f.cargo || "N/A",
        salarioBase, periculosidade, horasExtras, comissao, valesDesconto, bonusVal,
        inss, ir, outros, bruto, totalDescontos, liquido,
      };
    });
  }, [funcionarios, bancoHoras, funcToEntregadorId, comissaoPorEntregador, valesPorFunc, bonusPorFunc, descontosEdit]);

  const totalBruto = dadosFolha.reduce((acc, f) => acc + f.bruto, 0);
  const totalDescontos = dadosFolha.reduce((acc, f) => acc + f.totalDescontos, 0);
  const totalLiquido = dadosFolha.reduce((acc, f) => acc + f.liquido, 0);
  const totalComissoes = dadosFolha.reduce((acc, f) => acc + f.comissao, 0);

  const updateDesconto = (funcId: string, field: "inss" | "ir" | "outros", value: string) => {
    setDescontosEdit(prev => ({
      ...prev,
      [funcId]: { ...(prev[funcId] || { inss: "", ir: "", outros: "" }), [field]: value },
    }));
  };

  const fecharFolhaMutation = useMutation({
    mutationFn: async () => {
      // Insert folha header
      const { data: folha, error: folhaError } = await supabase.from("folhas_pagamento").insert({
        mes_referencia: mesKey,
        total_bruto: totalBruto,
        total_descontos: totalDescontos,
        total_liquido: totalLiquido,
        total_comissoes: totalComissoes,
        total_funcionarios: dadosFolha.length,
        unidade_id: unidadeAtual?.id || null,
      }).select().single();

      if (folhaError) throw folhaError;

      // Insert line items
      const itens = dadosFolha.map(f => ({
        folha_id: folha.id,
        funcionario_id: f.id,
        funcionario_nome: f.funcionario,
        cargo: f.cargo,
        salario_base: f.salarioBase,
        horas_extras: f.horasExtras,
        comissao: f.comissao,
        bonus: f.bonusVal,
        inss: f.inss,
        ir: f.ir,
        vales_desconto: f.valesDesconto,
        outros_descontos: f.outros,
        bruto: f.bruto,
        total_descontos: f.totalDescontos,
        liquido: f.liquido,
      }));

      const { error: itensError } = await supabase.from("folha_pagamento_itens").insert(itens);
      if (itensError) throw itensError;
    },
    onSuccess: () => {
      toast.success("Folha fechada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["folha-fechada"] });
      queryClient.invalidateQueries({ queryKey: ["folhas-historico"] });
      setShowConfirmFechar(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao fechar folha: " + err.message);
    },
  });

  const handlePrintRecibo = (func: typeof dadosFolha[0]) => {
    if (!empresaConfig) {
      toast.error("Configure os dados da empresa primeiro");
      return;
    }
    generateFolhaRecibo({
      empresa: {
        nome_empresa: empresaConfig.nome_empresa,
        cnpj: empresaConfig.cnpj,
        telefone: empresaConfig.telefone,
        endereco: empresaConfig.endereco,
      },
      funcionario: func.funcionario,
      cargo: func.cargo,
      mesReferencia: mesAtual,
      salarioBase: func.salarioBase,
      horasExtras: func.horasExtras,
      descontos: func.totalDescontos,
      liquido: func.liquido,
    });
    toast.success("Recibo gerado com sucesso!");
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isFechada = !!folhaFechada;

  return (
    <MainLayout>
      <Header title="Folha de Pagamento" subtitle="Gestão de salários, comissões e descontos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Month selector + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMesSelecionado(prev => subMonths(prev, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold capitalize min-w-[160px] text-center">{mesAtual}</span>
            <Button variant="outline" size="icon" onClick={() => setMesSelecionado(prev => addMonths(prev, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowHistorico(true)}>
              <History className="h-4 w-4" />Histórico
            </Button>
            <Button className="gap-2"><Download className="h-4 w-4" />Exportar</Button>
            {!isFechada && dadosFolha.length > 0 && (
              <Button variant="destructive" className="gap-2" onClick={() => setShowConfirmFechar(true)}>
                <Lock className="h-4 w-4" />Fechar Folha
              </Button>
            )}
          </div>
        </div>

        {isFechada && (
          <div className="bg-muted/50 border rounded-lg p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Folha fechada em {format(new Date(folhaFechada.data_fechamento), "dd/MM/yyyy HH:mm")}</p>
              <p className="text-sm text-muted-foreground">Os valores abaixo estão congelados. Para alterações, consulte o histórico.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Bruto</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {fmt(isFechada ? Number(folhaFechada.total_bruto) : totalBruto)}</div>
              <p className="text-xs text-muted-foreground">Salários + extras + comissões + bônus</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Comissões</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">R$ {fmt(isFechada ? Number(folhaFechada.total_comissoes) : totalComissoes)}</div>
              <p className="text-xs text-muted-foreground">Do mês</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Descontos</CardTitle>
              <DollarSign className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">R$ {fmt(isFechada ? Number(folhaFechada.total_descontos) : totalDescontos)}</div>
              <p className="text-xs text-muted-foreground">INSS + IR + Vales + Outros</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Líquido</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">R$ {fmt(isFechada ? Number(folhaFechada.total_liquido) : totalLiquido)}</div>
              <p className="text-xs text-muted-foreground">A pagar</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isFechada ? folhaFechada.total_funcionarios : dadosFolha.length}</div>
              <p className="text-xs text-muted-foreground">Na folha</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <CardTitle>Folha de {mesAtual}</CardTitle>
              </div>
              <Badge variant={isFechada ? "secondary" : "default"}>{isFechada ? "Fechada" : "Em aberto"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : dadosFolha.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum funcionário ativo cadastrado</p>
            ) : (
              <div className="overflow-x-auto">
                <TooltipProvider>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="text-right">Salário</TableHead>
                        <TableHead className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            Periculosidade
                            <Tooltip>
                              <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                              <TooltipContent>30% do salário base</TooltipContent>
                            </Tooltip>
                          </span>
                        </TableHead>
                        <TableHead className="text-right">H. Extras</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead className="text-right">Bônus</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                        <TableHead className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            INSS
                            <Tooltip>
                              <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                              <TooltipContent>Editável. Padrão: 8,09% sobre salário + periculosidade</TooltipContent>
                            </Tooltip>
                          </span>
                        </TableHead>
                        <TableHead className="text-right">IR</TableHead>
                        <TableHead className="text-right">Vales</TableHead>
                        <TableHead className="text-right">Outros</TableHead>
                        <TableHead className="text-right font-bold">Líquido</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosFolha.map((func) => (
                        <TableRow key={func.id}>
                          <TableCell className="font-medium">{func.funcionario}</TableCell>
                          <TableCell>{func.cargo}</TableCell>
                          <TableCell className="text-right">R$ {fmt(func.salarioBase)}</TableCell>
                          <TableCell className="text-right text-success">
                            {func.periculosidade > 0 ? `+ R$ ${fmt(func.periculosidade)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-success">
                            {func.horasExtras > 0 ? `+ R$ ${fmt(func.horasExtras)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-success">
                            {func.comissao > 0 ? `+ R$ ${fmt(func.comissao)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-success">
                            {func.bonusVal > 0 ? `+ R$ ${fmt(func.bonusVal)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">R$ {fmt(func.bruto)}</TableCell>
                          <TableCell className="text-right">
                            {isFechada ? (
                              <span className="text-sm">R$ {fmt(func.inss)}</span>
                            ) : (
                              <Input
                                type="number"
                                className="w-20 h-7 text-xs text-right ml-auto"
                                placeholder={String(Math.round((func.salarioBase + func.periculosidade) * 0.0809 * 100) / 100)}
                                value={descontosEdit[func.id]?.inss ?? ""}
                                onChange={e => updateDesconto(func.id, "inss", e.target.value)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isFechada ? (
                              <span className="text-sm">R$ {fmt(func.ir)}</span>
                            ) : (
                              <Input
                                type="number"
                                className="w-20 h-7 text-xs text-right ml-auto"
                                placeholder="0"
                                value={descontosEdit[func.id]?.ir ?? ""}
                                onChange={e => updateDesconto(func.id, "ir", e.target.value)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {func.valesDesconto > 0 ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="cursor-help underline decoration-dotted">- R$ {fmt(func.valesDesconto)}</span>
                                </TooltipTrigger>
                                <TooltipContent>Vales/adiantamentos pendentes do mês</TooltipContent>
                              </Tooltip>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isFechada ? (
                              <span className="text-sm">R$ {fmt(func.outros)}</span>
                            ) : (
                              <Input
                                type="number"
                                className="w-20 h-7 text-xs text-right ml-auto"
                                placeholder="0"
                                value={descontosEdit[func.id]?.outros ?? ""}
                                onChange={e => updateDesconto(func.id, "outros", e.target.value)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            R$ {fmt(func.liquido)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="gap-1" onClick={() => handlePrintRecibo(func)}>
                              <Printer className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right">R$ {fmt(dadosFolha.reduce((a, f) => a + f.salarioBase, 0))}</TableCell>
                        <TableCell className="text-right text-success">R$ {fmt(dadosFolha.reduce((a, f) => a + f.periculosidade, 0))}</TableCell>
                        <TableCell className="text-right text-success">R$ {fmt(dadosFolha.reduce((a, f) => a + f.horasExtras, 0))}</TableCell>
                        <TableCell className="text-right text-success">R$ {fmt(totalComissoes)}</TableCell>
                        <TableCell className="text-right text-success">R$ {fmt(dadosFolha.reduce((a, f) => a + f.bonusVal, 0))}</TableCell>
                        <TableCell className="text-right">R$ {fmt(totalBruto)}</TableCell>
                        <TableCell className="text-right text-destructive">R$ {fmt(dadosFolha.reduce((a, f) => a + f.inss, 0))}</TableCell>
                        <TableCell className="text-right text-destructive">R$ {fmt(dadosFolha.reduce((a, f) => a + f.ir, 0))}</TableCell>
                        <TableCell className="text-right text-destructive">R$ {fmt(dadosFolha.reduce((a, f) => a + f.valesDesconto, 0))}</TableCell>
                        <TableCell className="text-right text-destructive">R$ {fmt(dadosFolha.reduce((a, f) => a + f.outros, 0))}</TableCell>
                        <TableCell className="text-right text-primary">R$ {fmt(totalLiquido)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TooltipProvider>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirm close dialog */}
        <Dialog open={showConfirmFechar} onOpenChange={setShowConfirmFechar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fechar Folha de {mesAtual}?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Ao fechar a folha, os valores serão congelados e salvos no histórico. 
              Esta ação não pode ser desfeita.
            </p>
            <div className="grid grid-cols-2 gap-4 my-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Total Bruto</p>
                <p className="text-lg font-bold">R$ {fmt(totalBruto)}</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Total Líquido</p>
                <p className="text-lg font-bold text-primary">R$ {fmt(totalLiquido)}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmFechar(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => fecharFolhaMutation.mutate()} disabled={fecharFolhaMutation.isPending}>
                {fecharFolhaMutation.isPending ? "Fechando..." : "Confirmar Fechamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History dialog */}
        <Dialog open={showHistorico} onOpenChange={setShowHistorico}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Histórico de Folhas</DialogTitle>
            </DialogHeader>
            {historicoFolhas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma folha fechada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Funcionários</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Descontos</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Fechado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoFolhas.map((f: any) => (
                    <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                      const [year, month] = f.mes_referencia.split("-");
                      setMesSelecionado(new Date(parseInt(year), parseInt(month) - 1, 1));
                      setShowHistorico(false);
                    }}>
                      <TableCell className="font-medium capitalize">
                        {format(new Date(parseInt(f.mes_referencia.split("-")[0]), parseInt(f.mes_referencia.split("-")[1]) - 1, 1), "MMMM yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">{f.total_funcionarios}</TableCell>
                      <TableCell className="text-right">R$ {fmt(Number(f.total_bruto))}</TableCell>
                      <TableCell className="text-right text-destructive">R$ {fmt(Number(f.total_descontos))}</TableCell>
                      <TableCell className="text-right text-primary font-bold">R$ {fmt(Number(f.total_liquido))}</TableCell>
                      <TableCell>{format(new Date(f.data_fechamento), "dd/MM/yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
