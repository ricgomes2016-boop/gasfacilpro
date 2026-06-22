import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Banknote, CheckCircle2, BarChart3, CreditCard, Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOperatorTheme, operatorGradient } from "@/lib/cartoes/operatorThemes";
import { RecebiveisPipeline } from "@/components/financeiro/RecebiveisPipeline";
import { ConferenciaCartao } from "@/components/financeiro/ConferenciaCartao";
import PagamentosCartaoRelatorio from "@/pages/financeiro/PagamentosCartao";

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
}

export default function OperadoraCartaoDetalhe() {
  const { operadoraId } = useParams();
  const navigate = useNavigate();

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
      <Header title={`Portal • ${op.nome}`} subtitle="Recebíveis, conferência, relatórios e importação" />
      <div className="p-4 md:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/financeiro/cartoes")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />Voltar para operadoras
        </Button>

        {/* Header card no estilo "portal da operadora" */}
        <div
          className="rounded-2xl p-5 md:p-6 shadow-lg"
          style={{ background: operatorGradient(theme), color: theme.textColor }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow"
                style={{ background: "rgba(255,255,255,0.18)" }}
              >
                {theme.initials}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider opacity-80">Operadora de cartão</p>
                <h2 className="text-2xl md:text-3xl font-extrabold truncate">{op.nome}</h2>
                {op.bandeira && (
                  <p className="text-sm opacity-90 mt-0.5">Bandeira: {op.bandeira}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="opacity-80">Taxa Déb</p>
                <p className="text-base font-bold">{Number(op.taxa_debito).toFixed(2)}%</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="opacity-80">Taxa Créd</p>
                <p className="text-base font-bold">{Number(op.taxa_credito_vista).toFixed(2)}%</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="opacity-80">Parcelado</p>
                <p className="text-base font-bold">{Number(op.taxa_credito_parcelado).toFixed(2)}%</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="opacity-80">Prazo Créd</p>
                <p className="text-base font-bold">D+{op.prazo_credito}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs estilo portal */}
        <Tabs defaultValue="recebiveis" className="space-y-4">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="recebiveis" className="gap-1.5">
              <Banknote className="h-4 w-4" />Recebíveis
            </TabsTrigger>
            <TabsTrigger value="conferencia" className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />Conferência
            </TabsTrigger>
            <TabsTrigger value="relatorio" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />Relatório
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recebiveis">
            <RecebiveisPipeline operadoraId={op.id} />
          </TabsContent>

          <TabsContent value="conferencia">
            <ConferenciaCartao operadoraId={op.id} hideOperadorasTab />
          </TabsContent>

          <TabsContent value="relatorio">
            <PagamentosCartaoRelatorio />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
