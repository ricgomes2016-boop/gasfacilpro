import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Package, Calculator, Printer, Edit2, Save, X, AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { ComissaoConfigEditor } from "@/components/rh/ComissaoConfigEditor";
import { generateComissaoRecibo } from "@/services/receiptRhService";
import { toast } from "sonner";

export default function ComissaoEntregador() {
  const { unidadeAtual } = useUnidade();
  const now = new Date();

  const { data: empresaConfig } = useQuery({
    queryKey: ["empresa-config"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_empresa").select("id, nome_empresa, cnpj, telefone, endereco, mensagem_cupom, created_at, updated_at, empresa_id, regras_bia, regras_cadastro, asaas_sandbox").limit(1).single();
      return data;
    },
  });

  const handlePrintComissao = (entregador: any) => {
    if (!empresaConfig) { toast.error("Configure os dados da empresa primeiro"); return; }
    generateComissaoRecibo({
      empresa: { nome_empresa: empresaConfig.nome_empresa, cnpj: empresaConfig.cnpj, telefone: empresaConfig.telefone, endereco: empresaConfig.endereco },
      entregador: entregador.nome,
      mesReferencia: mesesDisponiveis.find(m => m.value === mesSelecionado)?.label || mesSelecionado,
      linhas: entregador.linhas,
      totalComissao: entregador.totalComissao,
    });
    toast.success("Recibo de comissão gerado!");
  };

  // Filtros
  const [mesSelecionado, setMesSelecionado] = useState(format(now, "yyyy-MM"));
  const [entregadorSelecionado, setEntregadorSelecionado] = useState<string>("todos");
  const [editingConfig, setEditingConfig] = useState<{
    produtoId: string;
    produtoNome: string;
    canal: string;
    valor: number;
  } | null>(null);
  const queryClient = useQueryClient();

  const mesesDisponiveis = useMemo(() => {
    const meses = [];
    for (let i = 0; i < 12; i++) {
      const mes = subMonths(now, i);
      meses.push({ value: format(mes, "yyyy-MM"), label: format(mes, "MMMM yyyy", { locale: ptBR }) });
    }
    return meses;
  }, []);

  // Buscar TODAS as configs de comissão (cross-unit) para permitir fallback automático entre lojas
  const { data: comissaoConfig = [] } = useQuery({
    queryKey: ["comissao-config", unidadeAtual?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissao_config")
        .select("produto_id, canal_venda, valor, unidade_id, produtos(nome)");
      return data || [];
    },
  });

  // Detecta se a unidade atual NÃO tem nenhuma config própria (vai usar fallback)
  const unidadeUsandoFallback = useMemo(() => {
    if (!unidadeAtual?.id || comissaoConfig.length === 0) return false;
    return !comissaoConfig.some((c: any) => c.unidade_id === unidadeAtual.id);
  }, [comissaoConfig, unidadeAtual?.id]);

  // Normalize: lowercase, remove accents, trim
  const normalize = (s: string) =>
    s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
  const normalizeCanal = normalize;

  // Map config: prioridade unidade atual > null (global) > outras unidades.
  // Iteramos do MENOR para MAIOR prioridade — o último set "vence".
  const comissaoMap = useMemo(() => {
    const byId = new Map<string, number>();
    const byName = new Map<string, number>();
    const prio = (c: any) => {
      if (unidadeAtual?.id && c.unidade_id === unidadeAtual.id) return 3;
      if (!c.unidade_id) return 2;
      return 1; // outras unidades (fallback)
    };
    const sorted = [...comissaoConfig].sort((a: any, b: any) => prio(a) - prio(b));
    sorted.forEach((c: any) => {
      const canal = normalizeCanal(c.canal_venda);
      const valor = Number(c.valor) || 0;
      byId.set(`${c.produto_id}|${canal}`, valor);
      const nome = (c as any).produtos?.nome ? normalize((c as any).produtos.nome) : null;
      if (nome && valor > 0) byName.set(`${nome}|${canal}`, valor);
    });
    return { byId, byName };
  }, [comissaoConfig, unidadeAtual?.id]);

  const lookupComissao = (produtoId: string, produtoNome: string, canal: string) => {
    const c = normalizeCanal(canal);
    const direct = comissaoMap.byId.get(`${produtoId}|${c}`);
    if (direct !== undefined && direct > 0) return direct;
    const byName = comissaoMap.byName.get(`${normalize(produtoNome)}|${c}`);
    if (byName !== undefined) return byName;
    return direct ?? 0;
  };

  // Buscar entregadores
  const { data: entregadores = [] } = useQuery({
    queryKey: ["entregadores-comissao", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("entregadores").select("id, nome").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  // Buscar pedidos detalhados do mês
  const { data: pedidosDetalhados = [], isLoading } = useQuery({
    queryKey: ["comissao-detalhada", unidadeAtual?.id, mesSelecionado, entregadorSelecionado],
    queryFn: async () => {
      const [ano, mes] = mesSelecionado.split("-").map(Number);
      const dataRef = new Date(ano, mes - 1, 1);
      const mesInicio = startOfMonth(dataRef).toISOString();
      const mesFim = endOfMonth(dataRef).toISOString();

      let query = supabase
        .from("pedidos")
        .select("id, entregador_id, valor_total, canal_venda, entregadores(nome)")
        .eq("status", "entregue")
        .gte("created_at", mesInicio)
        .lte("created_at", mesFim);

      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      if (entregadorSelecionado !== "todos") query = query.eq("entregador_id", entregadorSelecionado);

      const { data: pedidosData, error } = await query;
      if (error) throw error;

      // Buscar itens de todos os pedidos
      const pedidoIds = (pedidosData || []).map((p: any) => p.id);
      if (pedidoIds.length === 0) return [];

      const { data: itensData } = await supabase
        .from("pedido_itens")
        .select("pedido_id, produto_id, quantidade, preco_unitario, produtos(nome, categoria, tipo_botijao)")
        .in("pedido_id", pedidoIds);

      // Mapear pedidos para acesso rápido
      const pedidoMap = new Map<string, any>();
      (pedidosData || []).forEach((p: any) => pedidoMap.set(p.id, p));

      return (itensData || []).map((item: any) => {
        const pedido = pedidoMap.get(item.pedido_id);
        return {
          ...item,
          entregador_id: pedido?.entregador_id,
          entregador_nome: pedido?.entregadores?.nome || "N/A",
          canal_venda: pedido?.canal_venda || "portaria",
        };
      });
    },
  });

  // Agrupar dados para a tabela detalhada por entregador
  const dadosAgrupados = useMemo(() => {
    const porEntregador = new Map<string, {
      nome: string;
      produtos: Map<string, { 
        id: string; // Adicionado ID do produto
        nome: string; 
        canais: Map<string, { qtd: number; comissaoUnit: number }> 
      }>;
    }>();

    pedidosDetalhados.forEach((item: any) => {
      if (!item.entregador_id) return;
      const eId = item.entregador_id;
      const canal = item.canal_venda || "portaria";
      const prodNome = item.produtos?.nome || "Produto";
      const comissaoUnit = lookupComissao(item.produto_id, prodNome, canal);

      if (!porEntregador.has(eId)) {
        porEntregador.set(eId, { nome: item.entregador_nome, produtos: new Map() });
      }
      const ent = porEntregador.get(eId)!;

      if (!ent.produtos.has(prodNome)) {
        ent.produtos.set(prodNome, { id: item.produto_id, nome: prodNome, canais: new Map() });
      }
      const prod = ent.produtos.get(prodNome)!;

      const canalExistente = prod.canais.get(canal) || { qtd: 0, comissaoUnit };
      canalExistente.qtd += item.quantidade || 1;
      prod.canais.set(canal, canalExistente);
    });

    return Array.from(porEntregador.entries()).map(([id, ent]) => {
      const linhas: { produtoId: string; produto: string; canal: string; quantidade: number; comissaoUnit: number; total: number }[] = [];
      let totalQtd = 0;
      let totalComissao = 0;

      ent.produtos.forEach((prod) => {
        prod.canais.forEach((canalData, canal) => {
          const total = canalData.qtd * canalData.comissaoUnit;
          linhas.push({
            produtoId: prod.id,
            produto: prod.nome,
            canal,
            quantidade: canalData.qtd,
            comissaoUnit: canalData.comissaoUnit,
            total,
          });
          totalQtd += canalData.qtd;
          totalComissao += total;
        });
      });

      return { id, nome: ent.nome, linhas, totalQtd, totalComissao };
    }).sort((a, b) => b.totalComissao - a.totalComissao);
  }, [pedidosDetalhados, comissaoMap]);

  // Itens (produto/canal) sem regra de comissão configurada (comissão = 0)
  const itensSemRegra = useMemo(() => {
    const set = new Map<string, { produto: string; canal: string; quantidade: number; entregadores: Set<string> }>();
    dadosAgrupados.forEach((ent) => {
      ent.linhas.forEach((l) => {
        if (l.comissaoUnit === 0) {
          const key = `${normalize(l.produto)}|${normalizeCanal(l.canal)}`;
          const existing = set.get(key);
          if (existing) {
            existing.quantidade += l.quantidade;
            existing.entregadores.add(ent.nome);
          } else {
            set.set(key, {
              produto: l.produto,
              canal: l.canal,
              quantidade: l.quantidade,
              entregadores: new Set([ent.nome]),
            });
          }
        }
      });
    });
    return Array.from(set.values()).sort((a, b) => b.quantidade - a.quantidade);
  }, [dadosAgrupados]);

  const handleSaveQuickConfig = async () => {
    if (!editingConfig || !unidadeAtual?.id) return;
    try {
      // Buscar TODOS os produtos com o mesmo nome (cobre duplicatas entre unidades da mesma empresa)
      const { data: prodsMesmoNome } = await supabase
        .from("produtos")
        .select("id")
        .eq("nome", editingConfig.produtoNome);

      const ids = Array.from(
        new Set([editingConfig.produtoId, ...((prodsMesmoNome || []).map((p: any) => p.id))])
      );

      const rows = ids.map((produto_id) => ({
        unidade_id: unidadeAtual.id,
        produto_id,
        canal_venda: editingConfig.canal,
        valor: editingConfig.valor,
      }));

      const { error } = await supabase
        .from("comissao_config")
        .upsert(rows, { onConflict: "unidade_id,produto_id,canal_venda" });

      if (error) throw error;

      toast.success(`Comissão atualizada (${ids.length} variações do produto)`);
      setEditingConfig(null);
      queryClient.invalidateQueries({ queryKey: ["comissao-config"] });
      queryClient.invalidateQueries({ queryKey: ["comissao-detalhada"] });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar comissão");
    }
  };

  // Resumo por entregador (para cards)
  const totalComissao = dadosAgrupados.reduce((acc, e) => acc + e.totalComissao, 0);
  const totalEntregas = dadosAgrupados.reduce((acc, e) => acc + e.totalQtd, 0);

  // Comparativo mensal (últimos 6 meses)
  const { data: comparativo = [] } = useQuery({
    queryKey: ["comissao-comparativo", unidadeAtual?.id],
    queryFn: async () => {
      const meses = [];
      for (let i = 5; i >= 0; i--) {
        const mes = subMonths(now, i);
        const inicio = startOfMonth(mes).toISOString();
        const fim = endOfMonth(mes).toISOString();

        let query = supabase
          .from("pedidos")
          .select("valor_total")
          .eq("status", "entregue")
          .not("entregador_id", "is", null)
          .gte("created_at", inicio)
          .lte("created_at", fim);

        if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);

        const { data } = await query;
        const totalQtd = (data || []).length;
        meses.push({ mes: format(mes, "MMM", { locale: ptBR }), comissao: totalQtd });
      }
      return meses;
    },
  });

  return (
    <MainLayout>
      <Header title="Comissão do Entregador" subtitle="Relatório de comissões por produto e canal" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[180px] max-w-[250px]">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Mês</label>
            <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {mesesDisponiveis.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px] max-w-[250px]">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Entregador</label>
            <Select value={entregadorSelecionado} onValueChange={setEntregadorSelecionado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Entregadores</SelectItem>
                {entregadores.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end pt-5 gap-2">
            <ComissaoConfigEditor />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["comissao-config"] });
                queryClient.invalidateQueries({ queryKey: ["comissao-detalhada"] });
                queryClient.invalidateQueries({ queryKey: ["entregadores-comissao"] });
                queryClient.invalidateQueries({ queryKey: ["comissao-comparativo"] });
                toast.success("Comissões recalculadas com base na configuração atual");
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Recalcular
            </Button>
          </div>
        </div>

        {/* Banner de fallback cross-unit */}
        {unidadeUsandoFallback && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Usando configuração de outra loja</AlertTitle>
            <AlertDescription>
              A unidade <strong>{unidadeAtual?.nome}</strong> não tem comissões cadastradas próprias.
              Estamos usando como fallback automático a configuração das demais lojas da empresa.
              Recomenda-se cadastrar valores específicos em <strong>Configurar Comissões</strong>.
            </AlertDescription>
          </Alert>
        )}

        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Comissões</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Mês selecionado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Entregas</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalEntregas}</div>
              <p className="text-xs text-muted-foreground">Unidades entregues</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Média/Entregador</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">R$ {dadosAgrupados.length > 0 ? (totalComissao / dadosAgrupados.length).toFixed(2) : "0.00"}</div>
              <p className="text-xs text-muted-foreground">Por entregador</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Entregadores</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dadosAgrupados.length}</div>
              <p className="text-xs text-muted-foreground">Com entregas no mês</p>
            </CardContent>
          </Card>
        </div>

        {/* Aviso: itens sem regra de comissão configurada */}
        {!isLoading && itensSemRegra.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {itensSemRegra.length} {itensSemRegra.length === 1 ? "combinação está" : "combinações estão"} sem regra de comissão
            </AlertTitle>
            <AlertDescription>
              <p className="mb-2 text-sm">
                Os itens abaixo ficaram com comissão R$ 0,00 porque não há configuração em <strong>Configurar Comissões</strong> para o produto/canal:
              </p>
              <div className="rounded-md border border-destructive/30 bg-destructive/5 max-h-56 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs">Produto</TableHead>
                      <TableHead className="h-8 text-xs">Canal</TableHead>
                      <TableHead className="h-8 text-xs text-center">Qtd</TableHead>
                      <TableHead className="h-8 text-xs">Entregador(es)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensSemRegra.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1.5 text-xs font-medium">{item.produto}</TableCell>
                        <TableCell className="py-1.5 text-xs capitalize">{item.canal}</TableCell>
                        <TableCell className="py-1.5 text-xs text-center">{item.quantidade}</TableCell>
                        <TableCell className="py-1.5 text-xs">{Array.from(item.entregadores).join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs">
                Configure em <strong>Configurar Comissões</strong> ou clique no ícone de edição ao lado do valor R$ 0,00 nas tabelas abaixo.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabelas detalhadas por entregador */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : dadosAgrupados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma entrega encontrada no período selecionado.
            </CardContent>
          </Card>
        ) : (
          dadosAgrupados.map((entregador) => (
            <Card key={entregador.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{entregador.nome}</CardTitle>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => handlePrintComissao(entregador)}>
                  <Printer className="h-3 w-3" />Recibo
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Produto</TableHead>
                      <TableHead className="font-bold">Canal</TableHead>
                      <TableHead className="font-bold text-center">Quantidade</TableHead>
                      <TableHead className="font-bold text-right">Comissão</TableHead>
                      <TableHead className="font-bold text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entregador.linhas.map((linha, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{linha.produto}</TableCell>
                        <TableCell className="capitalize">{linha.canal}</TableCell>
                        <TableCell className="text-center">{linha.quantidade}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2 group">
                            <span>R$ {linha.comissaoUnit.toFixed(2)}</span>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-7 w-7 text-primary hover:bg-primary hover:text-white transition-colors"
                              title="Editar comissão"
                              onClick={() => setEditingConfig({
                                produtoId: linha.produtoId,
                                produtoNome: linha.produto,
                                canal: linha.canal,
                                valor: linha.comissaoUnit
                              })}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">R$ {linha.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-primary/10 font-bold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-center">{entregador.totalQtd}</TableCell>
                      <TableCell />
                      <TableCell className="text-right">R$ {entregador.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          ))
        )}

        {/* Gráfico comparativo */}
        <Card>
          <CardHeader><CardTitle>Comparativo Mensal (Entregas)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparativo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="comissao" fill="hsl(var(--primary))" name="Entregas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        {/* Modal de Edição Rápida */}
        <Dialog open={!!editingConfig} onOpenChange={(open) => !open && setEditingConfig(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Comissão: {editingConfig?.produtoNome}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Canal</label>
                <div className="col-span-3 capitalize py-2 px-3 bg-muted rounded-md text-sm">
                  {editingConfig?.canal}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="valor" className="text-right text-sm font-medium">Valor (R$)</label>
                <div className="col-span-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={editingConfig?.valor ?? 0}
                    onChange={(e) => setEditingConfig(prev => prev ? { ...prev, valor: parseFloat(e.target.value) || 0 } : null)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEditingConfig(null)} className="gap-2">
                <X className="h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={handleSaveQuickConfig} className="gap-2">
                <Save className="h-4 w-4" /> Salvar Alteração
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
