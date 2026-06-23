import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Home, ShoppingCart, Banknote, Percent, BarChart3, CheckCircle2, CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { getOperatorTheme, operatorGradient } from "@/lib/cartoes/operatorThemes";
import { ConferenciaCartao } from "@/components/financeiro/ConferenciaCartao";
import { QuickAccessGrid } from "@/components/financeiro/operadora-detalhe/QuickAccessGrid";
import { VendasOperadoraTab } from "@/components/financeiro/operadora-detalhe/VendasOperadoraTab";
import { RecebiveisOperadoraTab } from "@/components/financeiro/operadora-detalhe/RecebiveisOperadoraTab";
import { TaxasOperadoraTab } from "@/components/financeiro/operadora-detalhe/TaxasOperadoraTab";
import { RelatoriosOperadoraTab } from "@/components/financeiro/operadora-detalhe/RelatoriosOperadoraTab";
import { MaquininhasOperadoraTab } from "@/components/financeiro/operadora-detalhe/MaquininhasOperadoraTab";
import { ContaRecebimentoCard } from "@/components/financeiro/operadora-detalhe/ContaRecebimentoCard";

interface Operadora {
  id: string;
  nome: string;
  bandeira: string | null;
  taxa_debito: number;
  taxa_credito_vista: number;
  taxa_credito_parcelado: number;
  taxa_pix: number | null;
  prazo_debito: number;
  prazo_credito: number;
  prazo_pix: number | null;
  conta_bancaria_id: string | null;
}

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OperadoraCartaoDetalhe() {
  const { operadoraId } = useParams();
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const [tab, setTab] = useState("inicio");

  const { data: op, isLoading } = useQuery({
    queryKey: ["operadora-cartao", operadoraId],
    enabled: !!operadoraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operadoras_cartao")
        .select("*")
        .eq("id", operadoraId!)
        .maybeSingle();
      if (error) throw error;
      return data as Operadora | null;
    },
  });

  // Métricas do mês para os quick cards
  const inicioMes = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);

  const { data: metricsRaw } = useQuery({
    queryKey: ["operadora-metrics", operadoraId, unidadeAtual?.id, inicioMes],
    enabled: !!op,
    queryFn: async () => {
      let q = supabase
        .from("conferencia_cartao")
        .select("valor_bruto,valor_liquido_esperado,valor_liquido_recebido,data_venda,data_deposito_real,status")
        .eq("operadora_id", operadoraId!)
        .gte("data_venda", inicioMes);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;

      let maq = supabase.from("terminais_cartao").select("id", { count: "exact", head: true })
        .eq("operadora_id", operadoraId!).eq("status", "ativo");
      if (unidadeAtual?.id) maq = maq.eq("unidade_id", unidadeAtual.id);
      const { count } = await maq;

      return { rows: data || [], maquininhas: count || 0 };
    },
  });

  const metrics = useMemo(() => {
    const rows = metricsRaw?.rows || [];
    const vendasMes = rows.reduce((s: number, r: any) => s + Number(r.valor_bruto || 0), 0);
    const recebido = rows
      .filter((r: any) => r.data_deposito_real)
      .reduce((s: number, r: any) => s + Number(r.valor_liquido_recebido || r.valor_liquido_esperado || 0), 0);
    const aReceber = rows
      .filter((r: any) => !r.data_deposito_real)
      .reduce((s: number, r: any) => s + Number(r.valor_liquido_esperado || 0), 0);
    const conferencias = rows.filter((r: any) => r.status !== "confirmado").length;
    return {
      vendasMes,
      recebido,
      aReceber,
      taxaDebito: Number(op?.taxa_debito || 0),
      maquininhas: metricsRaw?.maquininhas || 0,
      conferencias,
    };
  }, [metricsRaw, op]);

  if (isLoading) {
    return (
      <MainLayout>
        <Header title="Carregando..." />
        <div className="p-6 text-muted-foreground">Carregando operadora...</div>
      </MainLayout>
    );
  }
  if (!op) {
    return (
      <MainLayout>
        <Header title="Operadora não encontrada" />
        <div className="p-6">
          <Button variant="outline" onClick={() => navigate("/financeiro/cartoes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
        </div>
      </MainLayout>
    );
  }

  const theme = getOperatorTheme(op.nome);

  return (
    <MainLayout>
      <Header title={`Portal • ${op.nome}`} subtitle="Vendas, recebíveis, taxas, relatórios e maquininhas" />
      <div className="p-4 md:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/financeiro/cartoes")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />Voltar para operadoras
        </Button>

        {/* Header branded */}
        <div
          className="rounded-2xl p-5 md:p-6 shadow-lg"
          style={{ background: operatorGradient(theme), color: theme.textColor }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow"
                style={{ background: "rgba(255,255,255,0.18)" }}>
                {theme.initials}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider opacity-80">Operadora de cartão</p>
                <h2 className="text-2xl md:text-3xl font-extrabold truncate">{op.nome}</h2>
                {op.bandeira && <p className="text-sm opacity-90 mt-0.5">Bandeira: {op.bandeira}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="opacity-80">Vendas (mês)</p>
                <p className="text-base font-bold">{fmt(metrics.vendasMes)}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="opacity-80">A receber</p>
                <p className="text-base font-bold">{fmt(metrics.aReceber)}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="opacity-80">Recebido</p>
                <p className="text-base font-bold">{fmt(metrics.recebido)}</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <div className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm p-1.5 -mx-1 sm:mx-0">
            <TabsList className="w-full h-auto bg-transparent p-0 gap-1 grid grid-cols-4 lg:grid-cols-7">
              {[
                { v: "inicio", Icon: Home, label: "Início" },
                { v: "vendas", Icon: ShoppingCart, label: "Vendas" },
                { v: "recebiveis", Icon: Banknote, label: "Recebíveis" },
                { v: "taxas", Icon: Percent, label: "Taxas" },
                { v: "relatorios", Icon: BarChart3, label: "Relatórios" },
                { v: "conferencia", Icon: CheckCircle2, label: "Conferência" },
                { v: "maquininhas", Icon: CreditCard, label: "Maquininhas" },
              ].map(({ v, Icon, label }) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="flex-col sm:flex-row justify-center gap-1 sm:gap-1.5 rounded-xl px-2 py-2 text-[11px] sm:text-sm font-medium data-[state=active]:shadow-md data-[state=active]:text-white transition-all min-w-0"
                  style={tab === v ? { background: operatorGradient(theme) } : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="inicio" className="space-y-4">
            <ContaRecebimentoCard operadoraId={op.id} contaBancariaId={op.conta_bancaria_id} />
            <QuickAccessGrid theme={theme} metrics={metrics} onSelect={setTab} />
          </TabsContent>

          <TabsContent value="vendas">
            <VendasOperadoraTab operadoraId={op.id} />
          </TabsContent>

          <TabsContent value="recebiveis">
            <RecebiveisOperadoraTab operadoraId={op.id} />
          </TabsContent>

          <TabsContent value="taxas">
            <TaxasOperadoraTab
              operadoraId={op.id}
              initial={{
                taxa_debito: op.taxa_debito,
                taxa_credito_vista: op.taxa_credito_vista,
                taxa_credito_parcelado: op.taxa_credito_parcelado,
                taxa_pix: op.taxa_pix,
                prazo_debito: op.prazo_debito,
                prazo_credito: op.prazo_credito,
                prazo_pix: op.prazo_pix,
              }}
            />
          </TabsContent>

          <TabsContent value="relatorios">
            <RelatoriosOperadoraTab operadoraId={op.id} />
          </TabsContent>

          <TabsContent value="conferencia">
            <ConferenciaCartao operadoraId={op.id} hideOperadorasTab />
          </TabsContent>

          <TabsContent value="maquininhas">
            <MaquininhasOperadoraTab operadoraId={op.id} operadoraNome={op.nome} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
