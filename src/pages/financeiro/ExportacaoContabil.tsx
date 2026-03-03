import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download, FileText, FileSpreadsheet, Calendar, Building2, Loader2,
  CheckCircle2, AlertTriangle, BarChart3, Receipt, CreditCard, DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import * as XLSX from "xlsx";

const MODULOS_EXPORTACAO = [
  { id: "contas_pagar", label: "Contas a Pagar", icon: CreditCard, tabela: "contas_pagar" },
  { id: "contas_receber", label: "Contas a Receber", icon: DollarSign, tabela: "contas_receber" },
  { id: "movimentacoes_caixa", label: "Movimentações de Caixa", icon: Receipt, tabela: "movimentacoes_caixa" },
  { id: "movimentacoes_bancarias", label: "Movimentações Bancárias", icon: Building2, tabela: "movimentacoes_bancarias" },
];

const SISTEMAS_CONTABEIS = [
  { id: "generico", label: "CSV Genérico" },
  { id: "dominio", label: "Domínio Sistemas" },
  { id: "alterdata", label: "Alterdata Pack" },
  { id: "fortes", label: "Fortes Contábil" },
  { id: "sped", label: "SPED EFD (Layout Fiscal)" },
];

export default function ExportacaoContabil() {
  const { unidadeAtual } = useUnidade();
  const [mesRef, setMesRef] = useState(format(subMonths(new Date(), 1), "yyyy-MM"));
  const [sistema, setSistema] = useState("generico");
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>(["contas_pagar", "contas_receber"]);
  const [exportando, setExportando] = useState(false);
  const [ultimaExportacao, setUltimaExportacao] = useState<string | null>(null);

  const toggleModulo = (id: string) => {
    setModulosSelecionados(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const exportarDados = async () => {
    if (modulosSelecionados.length === 0) {
      toast.error("Selecione ao menos um módulo"); return;
    }

    setExportando(true);
    try {
      const [ano, mes] = mesRef.split("-").map(Number);
      const inicio = format(startOfMonth(new Date(ano, mes - 1)), "yyyy-MM-dd");
      const fim = format(endOfMonth(new Date(ano, mes - 1)), "yyyy-MM-dd");
      const wb = XLSX.utils.book_new();

      for (const modId of modulosSelecionados) {
        const mod = MODULOS_EXPORTACAO.find(m => m.id === modId);
        if (!mod) continue;

        let query = supabase.from(mod.tabela as any).select("*");

        // Date filter based on table
        if (mod.tabela === "contas_pagar" || mod.tabela === "contas_receber") {
          query = query.gte("vencimento", inicio).lte("vencimento", fim);
        } else if (mod.tabela === "movimentacoes_caixa") {
          query = query.gte("created_at", inicio + "T00:00:00").lte("created_at", fim + "T23:59:59");
        } else if (mod.tabela === "movimentacoes_bancarias") {
          query = query.gte("data", inicio).lte("data", fim);
        }

        if (unidadeAtual?.id) {
          query = query.eq("unidade_id", unidadeAtual.id);
        }

        const { data, error } = await query.order("created_at", { ascending: true }).limit(5000);
        if (error) {
          console.error(`Erro ao exportar ${mod.tabela}:`, error);
          continue;
        }

        if (!data || data.length === 0) continue;

        // Format data based on sistema
        let formattedData: any[];
        if (sistema === "dominio" || sistema === "alterdata" || sistema === "fortes") {
          formattedData = formatarParaSistemaContabil(data, mod.tabela, sistema);
        } else if (sistema === "sped") {
          formattedData = formatarParaSPED(data, mod.tabela);
        } else {
          formattedData = data.map((row: any) => ({
            Data: row.vencimento || row.data || format(new Date(row.created_at), "dd/MM/yyyy"),
            Descricao: row.descricao || row.fornecedor || row.cliente || "-",
            Valor: Number(row.valor || 0).toFixed(2),
            Status: row.status || "-",
            Categoria: row.categoria || "-",
            Tipo: row.tipo || "-",
            FormaPagamento: row.forma_pagamento || "-",
          }));
        }

        const ws = XLSX.utils.json_to_sheet(formattedData);
        XLSX.utils.book_append_sheet(wb, ws, mod.label.substring(0, 31));
      }

      if (wb.SheetNames.length === 0) {
        toast.warning("Nenhum dado encontrado para o período selecionado.");
        return;
      }

      const nomeArquivo = `exportacao_contabil_${mesRef}_${sistema}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);
      setUltimaExportacao(new Date().toISOString());
      toast.success(`Exportação concluída! ${wb.SheetNames.length} aba(s) gerada(s).`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err.message || "erro desconhecido"));
    } finally {
      setExportando(false);
    }
  };

  return (
    <MainLayout>
      <Header title="Exportação Contábil" subtitle="Exporte lançamentos para seu sistema contábil" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Config */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> Sistema Contábil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={sistema} onValueChange={setSistema}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SISTEMAS_CONTABEIS.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Unidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {unidadeAtual?.nome || "Todas as unidades"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Módulos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Módulos para exportação</CardTitle>
            <CardDescription>Selecione quais movimentações devem ser incluídas no arquivo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULOS_EXPORTACAO.map(mod => {
                const Icon = mod.icon;
                const checked = modulosSelecionados.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                    onClick={() => toggleModulo(mod.id)}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleModulo(mod.id)} />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{mod.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button onClick={exportarDados} disabled={exportando} className="gap-2">
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exportando ? "Exportando..." : "Exportar XLSX"}
          </Button>

          {ultimaExportacao && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Última exportação: {format(new Date(ultimaExportacao), "dd/MM/yyyy HH:mm")}
            </Badge>
          )}
        </div>

        {/* Info sobre formatos */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Domínio / Alterdata / Fortes:</strong> O arquivo é gerado com colunas padronizadas (Data, Histórico, Débito, Crédito, Conta Contábil) para facilitar a importação.</p>
                <p><strong>SPED EFD:</strong> Layout simplificado baseado nos registros C100/C170. Para SPED completo, consulte seu contador.</p>
                <p><strong>CSV Genérico:</strong> Todas as colunas disponíveis para importação manual em qualquer sistema.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function formatarParaSistemaContabil(data: any[], tabela: string, sistema: string) {
  return data.map((row: any) => ({
    Data: row.vencimento || row.data || "",
    Historico: row.descricao || row.fornecedor || row.cliente || "",
    Debito: tabela === "contas_pagar" ? Number(row.valor || 0).toFixed(2) : "",
    Credito: tabela === "contas_receber" ? Number(row.valor || 0).toFixed(2) : "",
    Valor: Number(row.valor || 0).toFixed(2),
    ContaContabil: row.categoria || "999",
    CentroCusto: row.unidade_id ? row.unidade_id.substring(0, 8) : "",
    Documento: row.id?.substring(0, 8) || "",
    Status: row.status || "",
  }));
}

function formatarParaSPED(data: any[], tabela: string) {
  return data.map((row: any, idx: number) => ({
    REG: tabela === "contas_pagar" ? "C100" : "C100",
    IND_OPER: tabela === "contas_pagar" ? "0" : "1",
    NUM_DOC: row.id?.substring(0, 8) || String(idx + 1),
    DT_DOC: (row.vencimento || row.data || "").replace(/-/g, ""),
    VL_DOC: Number(row.valor || 0).toFixed(2),
    VL_DESC: "0.00",
    VL_MERC: Number(row.valor || 0).toFixed(2),
    IND_PGTO: row.status === "pago" || row.status === "aprovada" ? "0" : "1",
    COD_PART: row.fornecedor || row.cliente || "",
  }));
}
