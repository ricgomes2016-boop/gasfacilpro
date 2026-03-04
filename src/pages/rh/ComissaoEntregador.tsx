import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Package, Calculator, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
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
      const { data } = await supabase.from("configuracoes_empresa").select("*").limit(1).single();
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

  const mesesDisponiveis = useMemo(() => {
    const meses = [];
    for (let i = 0; i < 12; i++) {
      const mes = subMonths(now, i);
      meses.push({ value: format(mes, "yyyy-MM"), label: format(mes, "MMMM yyyy", { locale: ptBR }) });
    }
    return meses;
  }, []);

  // Buscar config de comissões do banco
  const { data: comissaoConfig = [] } = useQuery({
    queryKey: ["comissao-config", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("comissao_config").select("produto_id, canal_venda, valor, unidade_id");
      if (unidadeAtual?.id) {
        query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      }
      const { data } = await query;
      return data || [];
    },
  });

  // Normalize canal name: lowercase, remove accents
  const normalizeCanal = (canal: string) =>
    canal?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";

  // Map config for fast lookup: key = "produto_id|normalized_canal"
  const comissaoMap = useMemo(() => {
    const map = new Map<string, number>();
    // First add global (null unidade) configs, then override with unit-specific
    const sorted = [...comissaoConfig].sort((a: any, b: any) => (a.unidade_id ? 1 : 0) - (b.unidade_id ? 1 : 0));
    sorted.forEach((c: any) => {
      map.set(`${c.produto_id}|${normalizeCanal(c.canal_venda)}`, Number(c.valor));
    });
    return map;
  }, [comissaoConfig]);

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
      produtos: Map<string, { nome: string; canais: Map<string, { qtd: number; comissaoUnit: number }> }>;
    }>();

    pedidosDetalhados.forEach((item: any) => {
      if (!item.entregador_id) return;
      const eId = item.entregador_id;
      const canal = item.canal_venda || "portaria";
      const prodNome = item.produtos?.nome || "Produto";
      const comissaoUnit = comissaoMap.get(`${item.produto_id}|${normalizeCanal(canal)}`) ?? 0;

      if (!porEntregador.has(eId)) {
        porEntregador.set(eId, { nome: item.entregador_nome, produtos: new Map() });
      }
      const ent = porEntregador.get(eId)!;

      if (!ent.produtos.has(prodNome)) {
        ent.produtos.set(prodNome, { nome: prodNome, canais: new Map() });
      }
      const prod = ent.produtos.get(prodNome)!;

      const canalExistente = prod.canais.get(canal) || { qtd: 0, comissaoUnit };
      canalExistente.qtd += item.quantidade || 1;
      prod.canais.set(canal, canalExistente);
    });

    return Array.from(porEntregador.entries()).map(([id, ent]) => {
      const linhas: { produto: string; canal: string; quantidade: number; comissaoUnit: number; total: number }[] = [];
      let totalQtd = 0;
      let totalComissao = 0;

      ent.produtos.forEach((prod) => {
        prod.canais.forEach((canalData, canal) => {
          const total = canalData.qtd * canalData.comissaoUnit;
          linhas.push({
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
          </div>
        </div>

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
                        <TableCell>{linha.canal}</TableCell>
                        <TableCell className="text-center">{linha.quantidade}</TableCell>
                        <TableCell className="text-right">R$ {linha.comissaoUnit.toFixed(2)}</TableCell>
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
      </div>
    </MainLayout>
  );
}
