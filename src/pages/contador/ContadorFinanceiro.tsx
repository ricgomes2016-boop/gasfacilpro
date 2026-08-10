import { useState, useEffect, useRef, useMemo } from "react";
import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Loader2,
  FileText,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { BotaoExportar } from "@/components/contador/BotaoExportar";
import { ImportacaoInteligente } from "@/components/contador/ImportacaoInteligente";
import { DialogImportarOFX, type ImportOFXResult } from "@/components/contador/DialogImportarOFX";
import { fmt } from "@/services/contadorExportService";
import {
  PlanilhaExtratos,
  type ExtratoLinha,
} from "@/components/contador/PlanilhaExtratos";

interface ExtratoRow extends ExtratoLinha {
  created_at: string;
}

interface ContaBancariaInfo {
  id: string;
  unidade_id: string | null;
  banco: string | null;
  conta: string | null;
  agencia: string | null;
  nome: string | null;
}

const TODAS = "__todas__";
const SEM_CONTA = "__sem_conta__";
const FILTROS_KEY = "extratos-filtros-v1";

type TipoFiltro = "todos" | "debito" | "credito";

interface FiltrosLocais {
  busca: string;
  tipo: TipoFiltro;
  categorias: string[];
  valorMin: string;
  valorMax: string;
}

const FILTROS_DEFAULT: FiltrosLocais = {
  busca: "",
  tipo: "todos",
  categorias: [],
  valorMin: "",
  valorMax: "",
};

export default function ContadorFinanceiro() {
  const { empresaAtiva, unidadeAtiva, unidades } = useContador();
  const { range, setCustom } = usePeriodo();
  const [extratos, setExtratos] = useState<ExtratoRow[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState<string[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tabAtiva, setTabAtiva] = useState<string>(TODAS);
  const [tabPagina, setTabPagina] = useState<string>("extratos");
  const [foraDoPeriodo, setForaDoPeriodo] = useState<{ total: number; min: string; max: string } | null>(null);
  const [ultimaImportacao, setUltimaImportacao] = useState<ImportOFXResult & { quando: Date } | null>(null);
  const [filtros, setFiltros] = useState<FiltrosLocais>(() => {
    try {
      const raw = localStorage.getItem(FILTROS_KEY);
      return raw ? { ...FILTROS_DEFAULT, ...JSON.parse(raw) } : FILTROS_DEFAULT;
    } catch {
      return FILTROS_DEFAULT;
    }
  });
  const pdfRef = useRef<HTMLInputElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(FILTROS_KEY, JSON.stringify(filtros));
    } catch {}
  }, [filtros]);

  const fetchExtratos = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    try {
      const unidadeIds = unidadeAtiva ? [unidadeAtiva.id] : unidades.map((u) => u.id);
      if (unidadeIds.length === 0) {
        setExtratos([]);
        setContasBancarias([]);
        setForaDoPeriodo(null);
        return;
      }
      const [extRes, ctaRes, foraRes] = await Promise.all([
        supabase
          .from("extrato_bancario" as any)
          .select("*")
          .in("unidade_id", unidadeIds)
          .gte("data", range.inicioISO)
          .lte("data", range.fimISO)
          .order("data", { ascending: false })
          .limit(5000),
        supabase
          .from("contas_bancarias" as any)
          .select("id, unidade_id, banco, conta, agencia, nome")
          .in("unidade_id", unidadeIds),
        // Contagem total fora do período para alertar o usuário
        supabase
          .from("extrato_bancario" as any)
          .select("data", { count: "exact", head: false })
          .in("unidade_id", unidadeIds)
          .or(`data.lt.${range.inicioISO},data.gt.${range.fimISO}`)
          .order("data", { ascending: false })
          .limit(1),
      ]);
      if (extRes.error) throw extRes.error;
      if (ctaRes.error) throw ctaRes.error;
      setExtratos((extRes.data ?? []) as any);
      setContasBancarias((ctaRes.data ?? []) as any);

      // Se não há nada no período mas existem registros fora, busca min/max p/ sugerir
      if ((extRes.data ?? []).length === 0 && (foraRes.count ?? 0) > 0) {
        const { data: rangeData } = await supabase
          .from("extrato_bancario" as any)
          .select("data")
          .in("unidade_id", unidadeIds)
          .order("data", { ascending: false })
          .limit(1);
        const { data: rangeDataMin } = await supabase
          .from("extrato_bancario" as any)
          .select("data")
          .in("unidade_id", unidadeIds)
          .order("data", { ascending: true })
          .limit(1);
        setForaDoPeriodo({
          total: foraRes.count ?? 0,
          min: (rangeDataMin?.[0] as any)?.data ?? "",
          max: (rangeData?.[0] as any)?.data ?? "",
        });
      } else {
        setForaDoPeriodo(null);
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriasDespesa = async () => {
    const unidadeIds = unidadeAtiva ? [unidadeAtiva.id] : unidades.map((u) => u.id);
    let query = supabase
      .from("categorias_despesa")
      .select("nome,ordem,grupo,unidade_id")
      .eq("ativo", true)
      .order("grupo", { ascending: true })
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (unidadeIds.length > 0) query = query.or(`unidade_id.is.null,unidade_id.in.(${unidadeIds.join(",")})`);

    const { data, error } = await query;
    if (error) {
      console.error("[ContadorFinanceiro] erro ao carregar categorias de despesa:", error);
      setCategoriasDespesa([]);
      return;
    }

    const seen = new Set<string>();
    setCategoriasDespesa((data || []).map((c: any) => String(c.nome || "").trim()).filter((nome) => {
      const key = nome.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  };

  const ampliarPeriodo = () => {
    if (!foraDoPeriodo) return;
    const inicio = new Date(foraDoPeriodo.min + "T00:00:00");
    const fim = new Date(foraDoPeriodo.max + "T23:59:59");
    setCustom(inicio, fim);
    toast.success("Período ampliado para abranger todos os extratos importados");
  };

  const handleImportConcluida = (result?: ImportOFXResult) => {
    // 1. Sempre vai para a aba Extratos
    setTabPagina("extratos");

    if (result && result.totalInseridos > 0) {
      // 2. Ajusta período para cobrir o intervalo importado (com folga)
      if (result.periodo) {
        const inicio = new Date(result.periodo.inicio + "T00:00:00");
        const fim = new Date(result.periodo.fim + "T23:59:59");
        // Só amplia se o período atual não cobre
        const rangeIni = new Date(range.inicioISO + "T00:00:00");
        const rangeFim = new Date(range.fimISO + "T23:59:59");
        if (inicio < rangeIni || fim > rangeFim) {
          const novoIni = inicio < rangeIni ? inicio : rangeIni;
          const novoFim = fim > rangeFim ? fim : rangeFim;
          setCustom(novoIni, novoFim);
        }
      }

      // 3. Reseta tab da conta para "Todas" (vamos focar depois que carregar)
      setTabAtiva(TODAS);

      // 4. Limpa filtros locais que possam esconder dados
      setFiltros(FILTROS_DEFAULT);

      // 5. Memoriza última importação para o banner
      setUltimaImportacao({ ...result, quando: new Date() });

      // 6. Se uma única conta bancária foi afetada, foca nela após reload
      setTimeout(() => {
        if (result.contasBancariasIds.length === 1) {
          setTabAtiva(result.contasBancariasIds[0]);
        }
      }, 600);
    }

    // 7. Recarrega
    fetchExtratos();
  };

  useEffect(() => {
    fetchExtratos();
    fetchCategoriasDespesa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva, unidadeAtiva, range.inicioISO, range.fimISO]);

  // Aplicar filtros locais
  const extratosFiltrados = useMemo(() => {
    const buscaLower = filtros.busca.trim().toLowerCase();
    const min = filtros.valorMin === "" ? null : parseFloat(filtros.valorMin.replace(",", "."));
    const max = filtros.valorMax === "" ? null : parseFloat(filtros.valorMax.replace(",", "."));
    return extratos.filter((e) => {
      const v = Number(e.valor ?? 0);
      if (buscaLower && !(e.descricao ?? "").toLowerCase().includes(buscaLower)) return false;
      if (filtros.tipo === "debito" && v >= 0) return false;
      if (filtros.tipo === "credito" && v < 0) return false;
      if (filtros.categorias.length > 0) {
        const cat = e.categoria ?? "—";
        if (!filtros.categorias.includes(cat)) return false;
      }
      const abs = Math.abs(v);
      if (min !== null && !isNaN(min) && abs < min) return false;
      if (max !== null && !isNaN(max) && abs > max) return false;
      return true;
    });
  }, [extratos, filtros]);

  // Agrupar por conta para gerar tabs
  const tabs = useMemo(() => {
    const map = new Map<string, ExtratoRow[]>();
    for (const e of extratosFiltrados) {
      const k = e.conta_bancaria_id ?? SEM_CONTA;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries()).map(([key, linhas]) => {
      const conta = contasBancarias.find((c) => c.id === key);
      const unidade = conta ? unidades.find((u) => u.id === conta.unidade_id) : null;
      let label = "Sem conta vinculada";
      if (conta) {
        const last4 = (conta.conta ?? "").replace(/\D/g, "").slice(-4) || "----";
        const banco = conta.banco ?? conta.nome ?? "Banco";
        const uni = unidade?.nome ?? "—";
        label = `${uni} · ${banco} ····${last4}`;
      }
      return { key, label, linhas, count: linhas.length };
    });
  }, [extratosFiltrados, contasBancarias, unidades]);

  // Garantir que a tab ativa exista; senão volta para "Todas"
  useEffect(() => {
    if (tabAtiva !== TODAS && !tabs.find((t) => t.key === tabAtiva)) {
      setTabAtiva(TODAS);
    }
  }, [tabs, tabAtiva]);

  const linhasDaTabAtiva = tabAtiva === TODAS ? extratosFiltrados : tabs.find((t) => t.key === tabAtiva)?.linhas ?? [];

  const handleCategoriaChange = (id: string, categoria: string | null) => {
    setExtratos((prev) => prev.map((e) => (e.id === id ? { ...e, categoria } : e)));
  };

  const handleNavTab = (dir: "prev" | "next") => {
    const todas = [{ key: TODAS, label: "Todas as contas" }, ...tabs];
    const idx = todas.findIndex((t) => t.key === tabAtiva);
    if (idx === -1) return;
    const next = dir === "next" ? Math.min(todas.length - 1, idx + 1) : Math.max(0, idx - 1);
    setTabAtiva(todas[next].key);
  };

  const handlePDF = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!empresaAtiva) {
      toast.error("Selecione uma empresa");
      return;
    }
    const targetUnidade = unidadeAtiva ?? unidades[0];
    if (!targetUnidade) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        if (file.size > 15 * 1024 * 1024) {
          toast.error("PDF maior que 15MB");
          continue;
        }
        const buf = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

        const path = `${empresaAtiva.empresa_id}/${targetUnidade.id}/pdf-${Date.now()}-${file.name}`;
        await supabase.storage
          .from("contabil-extratos")
          .upload(path, file, { contentType: "application/pdf" });

        const { data, error } = await supabase.functions.invoke("parse-extrato-pdf", {
          body: { pdf_base64: b64, filename: file.name },
        });
        if (error) throw error;

        const txns = (data?.transacoes ?? []) as Array<{
          data: string;
          descricao: string;
          valor: number;
        }>;
        let inserted = 0;
        for (const t of txns) {
          const { error: insErr } = await (supabase.from("extrato_bancario" as any) as any).insert({
            data: t.data,
            descricao: t.descricao,
            valor: t.valor,
            tipo: t.valor >= 0 ? "credito" : "debito",
            unidade_id: targetUnidade.id,
            conciliado: false,
          });
          if (!insErr) inserted++;
        }
        toast.success(`${inserted} transação(ões) extraída(s) do PDF`);
      } catch (e: any) {
        toast.error(`${file.name}: ${e.message}`);
      }
    }
    setUploading(false);
    fetchExtratos();
    if (pdfRef.current) pdfRef.current.value = "";
  };

  const limparFiltros = () => setFiltros(FILTROS_DEFAULT);
  const filtrosAtivos =
    filtros.busca !== "" ||
    filtros.tipo !== "todos" ||
    filtros.categorias.length > 0 ||
    filtros.valorMin !== "" ||
    filtros.valorMax !== "";

  return (
    <ContadorPortalLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(0,0%,95%)]">Financeiro</h1>
            <p className="text-sm text-[hsl(220,10%,60%)]">
              Importação de OFX e PDF de extratos bancários
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {empresaAtiva && (
              <ImportacaoInteligente
                empresa_id={empresaAtiva.empresa_id}
                unidade_id_padrao={unidadeAtiva?.id}
                destino="financeiro"
                onConcluido={handleImportConcluida}
                label="IA: OFX/CSV/PDF"
              />
            )}
            <BotaoExportar
              relatorio="extratos"
              titulo="Relatório de Extratos Bancários"
              empresa={empresaAtiva?.empresa_nome ?? "—"}
              escopo={
                unidadeAtiva ? unidadeAtiva.nome : `Todas as lojas — ${unidades.length} unidades`
              }
              periodoLabel={range.label}
              colunas={[
                { header: "Data", key: "data", format: (v) => fmt.date(v) },
                { header: "Descrição", key: "descricao" },
                { header: "Tipo", key: "tipo" },
                { header: "Categoria", key: "categoria" },
                {
                  header: "Valor",
                  key: "valor",
                  align: "right",
                  format: (v) => fmt.brl(Number(v ?? 0)),
                },
                {
                  header: "Conciliado",
                  key: "conciliado",
                  format: (v) => (v ? "Sim" : "Não"),
                },
                { header: "Loja", key: "_loja_nome" },
              ]}
              linhas={extratosFiltrados.map((e) => ({
                ...e,
                _loja_nome: unidades.find((u) => u.id === e.unidade_id)?.nome ?? "—",
              }))}
              totais={[
                {
                  label: "Entradas",
                  value: fmt.brl(
                    extratosFiltrados
                      .filter((e) => Number(e.valor) >= 0)
                      .reduce((s, e) => s + Number(e.valor ?? 0), 0),
                  ),
                },
                {
                  label: "Saídas",
                  value: fmt.brl(
                    extratosFiltrados
                      .filter((e) => Number(e.valor) < 0)
                      .reduce((s, e) => s + Number(e.valor ?? 0), 0),
                  ),
                },
                {
                  label: "Saldo do período",
                  value: fmt.brl(
                    extratosFiltrados.reduce((s, e) => s + Number(e.valor ?? 0), 0),
                  ),
                },
              ]}
              groupByPDF={!unidadeAtiva ? "_loja_nome" : undefined}
            />
          </div>
        </div>

        <Tabs value={tabPagina} onValueChange={setTabPagina} className="w-full">
          <TabsList className="bg-[hsl(220,18%,13%)] border border-[hsl(220,15%,20%)]">
            <TabsTrigger value="importar">Importar</TabsTrigger>
            <TabsTrigger value="extratos">Extratos</TabsTrigger>
          </TabsList>

          <TabsContent value="importar" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
                <CardContent className="p-6">
                  <Banknote className="h-8 w-8 text-[hsl(165,60%,55%)] mb-3" />
                  <h3 className="font-semibold text-[hsl(0,0%,95%)] mb-1">
                    Importar OFX (multi-conta)
                  </h3>
                  <p className="text-sm text-[hsl(220,10%,60%)] mb-4">
                    Detecta filiais, agrupa por conta bancária e mostra resumo
                  </p>
                  {empresaAtiva ? (
                    <DialogImportarOFX
                      empresaId={empresaAtiva.empresa_id}
                      unidades={unidades.map((u) => ({
                        id: u.id,
                        nome: u.nome,
                        cnpj: (u as any).cnpj,
                      }))}
                      unidadeAtivaId={unidadeAtiva?.id ?? null}
                      onConcluido={handleImportConcluida}
                    />
                  ) : (
                    <Button disabled className="bg-[hsl(165,60%,40%)] text-white">
                      <Upload className="h-4 w-4 mr-2" /> Selecione uma empresa
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
                <CardContent className="p-6">
                  <FileText className="h-8 w-8 text-[hsl(280,60%,65%)] mb-3" />
                  <h3 className="font-semibold text-[hsl(0,0%,95%)] mb-1">Importar PDF</h3>
                  <p className="text-sm text-[hsl(220,10%,60%)] mb-4">
                    PDF do extrato — extração via IA
                  </p>
                  <input
                    ref={pdfRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handlePDF(e.target.files)}
                  />
                  <Button
                    onClick={() => pdfRef.current?.click()}
                    disabled={uploading || !empresaAtiva}
                    className="bg-[hsl(280,60%,55%)] hover:bg-[hsl(280,60%,60%)] text-white"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Selecionar PDF
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="extratos" className="mt-4 space-y-3">
            {/* Banner: última importação */}
            {ultimaImportacao && ultimaImportacao.totalInseridos > 0 && (
              <Card className="bg-[hsl(165,60%,12%)] border-[hsl(165,60%,30%)]">
                <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-[hsl(165,60%,40%)]/20 flex items-center justify-center">
                      <Banknote className="h-4 w-4 text-[hsl(165,70%,60%)]" />
                    </div>
                    <div>
                      <p className="text-[hsl(0,0%,95%)] font-medium">
                        Última importação: {ultimaImportacao.totalInseridos} lançamento(s) em{" "}
                        {ultimaImportacao.contas} conta(s)
                        {ultimaImportacao.contasCriadas > 0 &&
                          ` · ${ultimaImportacao.contasCriadas} conta(s) bancária(s) criada(s)`}
                      </p>
                      <p className="text-xs text-[hsl(220,10%,65%)]">
                        {ultimaImportacao.periodo
                          ? `Período: ${ultimaImportacao.periodo.inicio.split("-").reverse().join("/")} → ${ultimaImportacao.periodo.fim.split("-").reverse().join("/")}`
                          : "—"}
                        {" · "}
                        {ultimaImportacao.unidadesIds.length} unidade(s) afetada(s)
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUltimaImportacao(null)}
                    className="text-[hsl(220,10%,60%)] hover:text-[hsl(0,0%,90%)] h-8"
                  >
                    <X className="h-3 w-3 mr-1" /> Dispensar
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Filtros locais */}
            <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
              <CardContent className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <div className="md:col-span-4 relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      placeholder="Buscar descrição…"
                      value={filtros.busca}
                      onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                      className="pl-8 h-9 bg-[hsl(220,18%,13%)] border-[hsl(220,15%,22%)] text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Select
                      value={filtros.tipo}
                      onValueChange={(v: TipoFiltro) => setFiltros({ ...filtros, tipo: v })}
                    >
                      <SelectTrigger className="h-9 bg-[hsl(220,18%,13%)] border-[hsl(220,15%,22%)] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="debito">Apenas débitos</SelectItem>
                        <SelectItem value="credito">Apenas créditos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Select
                      value={filtros.categorias[0] ?? "__all__"}
                      onValueChange={(v) =>
                        setFiltros({
                          ...filtros,
                          categorias: v === "__all__" ? [] : [v],
                        })
                      }
                    >
                      <SelectTrigger className="h-9 bg-[hsl(220,18%,13%)] border-[hsl(220,15%,22%)] text-sm">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
                        <SelectItem value="__all__">Todas categorias</SelectItem>
                        <SelectItem value="—">(sem categoria)</SelectItem>
                        {categoriasDespesa.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={filtros.valorMin}
                      onChange={(e) => setFiltros({ ...filtros, valorMin: e.target.value })}
                      className="h-9 bg-[hsl(220,18%,13%)] border-[hsl(220,15%,22%)] text-sm"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={filtros.valorMax}
                      onChange={(e) => setFiltros({ ...filtros, valorMax: e.target.value })}
                      className="h-9 bg-[hsl(220,18%,13%)] border-[hsl(220,15%,22%)] text-sm"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    {filtrosAtivos && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={limparFiltros}
                        className="h-9 text-xs text-[hsl(220,10%,60%)] hover:text-[hsl(0,0%,90%)]"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[hsl(165,60%,55%)]" />
                  </div>
                ) : extratos.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Banknote className="h-12 w-12 mx-auto mb-3 text-[hsl(220,10%,30%)]" />
                    {foraDoPeriodo && foraDoPeriodo.total > 0 ? (
                      <>
                        <p className="text-sm text-[hsl(0,0%,90%)] mb-1 font-medium">
                          Existem <strong>{foraDoPeriodo.total}</strong> lançamento(s) importados
                          fora do período selecionado.
                        </p>
                        <p className="text-xs text-[hsl(220,10%,55%)] mb-4">
                          Período dos dados: {foraDoPeriodo.min.split("-").reverse().join("/")} →{" "}
                          {foraDoPeriodo.max.split("-").reverse().join("/")}. Período atual:{" "}
                          {range.label}.
                        </p>
                        <Button
                          onClick={ampliarPeriodo}
                          className="bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white"
                        >
                          Ampliar período para ver os dados
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-[hsl(220,10%,55%)] mb-4">
                          Nenhum extrato importado neste período. Use a aba{" "}
                          <strong>Importar</strong> para começar.
                        </p>
                        {empresaAtiva && (
                          <DialogImportarOFX
                            empresaId={empresaAtiva.empresa_id}
                            unidades={unidades.map((u) => ({
                              id: u.id,
                              nome: u.nome,
                              cnpj: (u as any).cnpj,
                            }))}
                            unidadeAtivaId={unidadeAtiva?.id ?? null}
                            onConcluido={handleImportConcluida}
                          />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
                    <div className="flex items-center gap-1 px-2 pt-2 border-b border-[hsl(220,15%,18%)]">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-[hsl(220,10%,60%)]"
                        onClick={() => handleNavTab("prev")}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div ref={tabsScrollRef} className="overflow-x-auto flex-1">
                        <TabsList className="bg-transparent border-0 h-auto p-0 inline-flex gap-1">
                          <TabsTrigger
                            value={TODAS}
                            className="data-[state=active]:bg-[hsl(220,18%,15%)] data-[state=active]:text-[hsl(0,0%,95%)] text-xs h-8 px-3"
                          >
                            <Banknote className="h-3.5 w-3.5 mr-1.5" />
                            Todas as contas
                            <span className="ml-1.5 text-[hsl(220,10%,55%)]">
                              ({extratosFiltrados.length})
                            </span>
                          </TabsTrigger>
                          {tabs.map((t) => (
                            <TabsTrigger
                              key={t.key}
                              value={t.key}
                              className="data-[state=active]:bg-[hsl(220,18%,15%)] data-[state=active]:text-[hsl(0,0%,95%)] text-xs h-8 px-3 whitespace-nowrap"
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1.5" />
                              {t.label}
                              <span className="ml-1.5 text-[hsl(220,10%,55%)]">({t.count})</span>
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-[hsl(220,10%,60%)]"
                        onClick={() => handleNavTab("next")}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <TabsContent value={tabAtiva} className="mt-0">
                      <PlanilhaExtratos
                        linhas={linhasDaTabAtiva}
                        categorias={categoriasDespesa}
                        onCategoriaChange={handleCategoriaChange}
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ContadorPortalLayout>
  );
}
