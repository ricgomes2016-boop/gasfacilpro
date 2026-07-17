import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload, Loader2, FileText, Banknote, ChevronLeft, ChevronRight,
  Download, RefreshCw, AlertTriangle, CheckCircle2, History,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  parseOFXMultiConta, isOFX, bancoNome, type OFXConta, type OFXTxn,
} from "@/services/ofxParser";

type Unidade = { id: string; nome: string; cnpj?: string | null };

type LinhaPreview = OFXTxn & {
  selecionada: boolean;
  duplicado: boolean;
  suspeito: boolean;
  saldoAcumulado: number;
};

type AbaConta = {
  id: string;                    // bankId::acctId
  conta: OFXConta;
  unidadeId: string | null;      // detectada ou escolhida
  detectadaPor: "conta_bancaria" | "cnpj" | "manual" | "nao_identificada";
  contaBancariaId: string | null;
  criarContaBancaria: boolean;   // se conta bancária não existe
  linhas: LinhaPreview[];
  filtroDataIni: string;
  filtroDataFim: string;
  filtroValorMin: string;
  filtroValorMax: string;
};

type Importacao = {
  id: string;
  arquivo: string;
  quando: Date;
  contas: number;
  lancamentos: number;
  status: "ok" | "erro";
};

export interface ImportOFXResult {
  totalInseridos: number;
  contas: number;
  contasCriadas: number;
  contasBancariasIds: string[];
  unidadesIds: string[];
  periodo: { inicio: string; fim: string } | null;
}

interface Props {
  empresaId: string;
  unidades: Unidade[];
  unidadeAtivaId?: string | null;
  onConcluido?: (result?: ImportOFXResult) => void;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export function DialogImportarOFX({ empresaId, unidades, unidadeAtivaId, onConcluido }: Props) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoOFX, setTextoOFX] = useState<string>("");
  const [progresso, setProgresso] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [importando, setImportando] = useState(false);

  const [abas, setAbas] = useState<AbaConta[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<string>("");
  const [historico, setHistorico] = useState<Importacao[]>([]);
  const [resumoFinal, setResumoFinal] = useState<{
    contas: number; lancamentos: number; periodo: string; saldos: { nome: string; valor: number }[];
  } | null>(null);
  const [confirmarDup, setConfirmarDup] = useState(false);
  const [contasBancariasCache, setContasBancariasCache] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const resetAll = () => {
    setArquivo(null);
    setTextoOFX("");
    setAbas([]);
    setAbaAtiva("");
    setProgresso(0);
    setResumoFinal(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Carrega contas bancárias da empresa para detecção
  const carregarContasBancarias = useCallback(async () => {
    const unidadeIds = unidades.map((u) => u.id);
    if (unidadeIds.length === 0) return [];
    const { data } = await supabase
      .from("contas_bancarias")
      .select("id, banco, agencia, conta, unidade_id, nome")
      .in("unidade_id", unidadeIds);
    const list = data ?? [];
    setContasBancariasCache(list);
    return list;
  }, [unidades]);

  useEffect(() => {
    if (open) carregarContasBancarias();
  }, [open, carregarContasBancarias]);

  // Detecta unidade em cascata: conta bancária -> CNPJ -> manual
  const detectarUnidade = (
    conta: OFXConta,
    contasBanc: any[],
  ): { unidadeId: string | null; via: AbaConta["detectadaPor"]; contaBancariaId: string | null } => {
    const acctNorm = (conta.acctId || "").replace(/\D/g, "");
    // 1. Match por número da conta
    if (acctNorm) {
      const match = contasBanc.find((cb) => {
        const cbConta = (cb.conta || "").replace(/\D/g, "");
        return cbConta && (cbConta === acctNorm || cbConta.endsWith(acctNorm) || acctNorm.endsWith(cbConta));
      });
      if (match) return { unidadeId: match.unidade_id, via: "conta_bancaria", contaBancariaId: match.id };
    }
    // 2. Match por CNPJ
    if (conta.cnpj) {
      const cnpjNorm = conta.cnpj.replace(/\D/g, "");
      const u = unidades.find((u) => (u.cnpj || "").replace(/\D/g, "") === cnpjNorm);
      if (u) return { unidadeId: u.id, via: "cnpj", contaBancariaId: null };
    }
    // 3. Não identificado — sugere a unidade ativa se houver
    if (unidadeAtivaId) return { unidadeId: unidadeAtivaId, via: "nao_identificada", contaBancariaId: null };
    return { unidadeId: null, via: "nao_identificada", contaBancariaId: null };
  };

  // Calcula saldo acumulado retroativo a partir do saldo final
  const calcularSaldos = (txns: OFXTxn[], saldoFinal: number): number[] => {
    const ordenadas = [...txns].map((t, i) => ({ t, i }));
    ordenadas.sort((a, b) => (a.t.date > b.t.date ? 1 : a.t.date < b.t.date ? -1 : a.i - b.i));
    const saldos = new Array(txns.length).fill(0);
    let acc = saldoFinal;
    for (let k = ordenadas.length - 1; k >= 0; k--) {
      saldos[ordenadas[k].i] = acc;
      acc = acc - ordenadas[k].t.amount;
    }
    // recalcula crescente: saldoAcumulado = saldo após a transação
    // já calculamos isso retroativamente acima; saldos[i] = saldo após txn i
    return saldos;
  };

  const processarArquivo = async (file: File) => {
    setParsing(true);
    setProgresso(10);
    try {
      const text = await file.text();
      setProgresso(30);
      if (!isOFX(text)) {
        toast.error("Arquivo OFX inválido. Verifique o formato e tente novamente.");
        setParsing(false);
        return;
      }
      const { contas } = parseOFXMultiConta(text);
      setProgresso(55);
      if (contas.length === 0) {
        toast.error("Nenhuma conta bancária encontrada no arquivo.");
        setParsing(false);
        return;
      }

      const contasBanc = await carregarContasBancarias();
      setProgresso(70);

      // Verifica duplicados em batch por conta
      const novasAbas: AbaConta[] = [];
      for (const conta of contas) {
        const det = detectarUnidade(conta, contasBanc);

        // dedup contra extrato_bancario da unidade detectada (se existir)
        let duplicadosKeys = new Set<string>();
        if (det.unidadeId && conta.txns.length > 0) {
          const datas = conta.txns.map((t) => t.date);
          const dataMin = datas.reduce((a, b) => (a < b ? a : b));
          const dataMax = datas.reduce((a, b) => (a > b ? a : b));
          const { data: existentes } = await supabase
            .from("extrato_bancario" as any)
            .select("data, valor, descricao")
            .eq("unidade_id", det.unidadeId)
            .gte("data", dataMin)
            .lte("data", dataMax)
            .limit(2000);
          duplicadosKeys = new Set(
            (existentes ?? []).map((e: any) => `${e.data}|${Number(e.valor)}|${(e.descricao || "").slice(0, 80)}`),
          );
        }

        const saldos = calcularSaldos(conta.txns, conta.saldoFinal);
        const linhas: LinhaPreview[] = conta.txns.map((t, i) => {
          const memo80 = (t.memo || "").slice(0, 80);
          const key = `${t.date}|${Number(t.amount)}|${memo80}`;
          const dup = duplicadosKeys.has(key);
          const susp = t.amount === 0 || Math.abs(t.amount) > 100000;
          return {
            ...t,
            selecionada: !dup,
            duplicado: dup,
            suspeito: susp,
            saldoAcumulado: saldos[i],
          };
        });

        novasAbas.push({
          id: `${conta.bankId}::${conta.acctId}`,
          conta,
          unidadeId: det.unidadeId,
          detectadaPor: det.via,
          contaBancariaId: det.contaBancariaId,
          criarContaBancaria: det.contaBancariaId === null,
          linhas,
          filtroDataIni: "",
          filtroDataFim: "",
          filtroValorMin: "",
          filtroValorMax: "",
        });
      }

      setProgresso(100);
      setArquivo(file);
      setTextoOFX(text);
      setAbas(novasAbas);
      setAbaAtiva(novasAbas[0]?.id ?? "");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao processar OFX: " + e.message);
    } finally {
      setParsing(false);
    }
  };

  const onSelectFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Selecione um arquivo .ofx");
      return;
    }
    processarArquivo(f);
  };

  const updateAba = (id: string, patch: Partial<AbaConta>) => {
    setAbas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const toggleLinha = (abaId: string, idx: number) => {
    setAbas((prev) =>
      prev.map((a) =>
        a.id === abaId
          ? { ...a, linhas: a.linhas.map((l, i) => (i === idx ? { ...l, selecionada: !l.selecionada } : l)) }
          : a,
      ),
    );
  };

  const linhasFiltradas = (a: AbaConta) => {
    return a.linhas.filter((l) => {
      if (a.filtroDataIni && l.date < a.filtroDataIni) return false;
      if (a.filtroDataFim && l.date > a.filtroDataFim) return false;
      if (a.filtroValorMin && Math.abs(l.amount) < Number(a.filtroValorMin)) return false;
      if (a.filtroValorMax && Math.abs(l.amount) > Number(a.filtroValorMax)) return false;
      return true;
    });
  };

  // Resumo global
  const resumo = useMemo(() => {
    const total = abas.reduce((s, a) => s + a.linhas.length, 0);
    const sel = abas.reduce((s, a) => s + a.linhas.filter((l) => l.selecionada).length, 0);
    const dup = abas.reduce((s, a) => s + a.linhas.filter((l) => l.duplicado && l.selecionada).length, 0);
    const datas = abas.flatMap((a) => a.linhas.map((l) => l.date)).filter(Boolean);
    const dMin = datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : "";
    const dMax = datas.length ? datas.reduce((a, b) => (a > b ? a : b)) : "";
    const unidadesDistintas = new Set(abas.map((a) => a.unidadeId).filter(Boolean));
    const todasComUnidade = abas.every((a) => !!a.unidadeId);
    return { total, sel, dup, dMin, dMax, unidadesDistintas: unidadesDistintas.size, todasComUnidade };
  }, [abas]);

  const podeImportar = abas.length > 0 && resumo.sel > 0 && resumo.todasComUnidade && !importando;

  const fazerImport = async () => {
    if (!arquivo) return;
    setImportando(true);
    try {
      let contasCriadas = 0;
      let totalInseridos = 0;
      const saldosResumo: { nome: string; valor: number }[] = [];
      const contasBancariasIds: string[] = [];
      const unidadesIds = new Set<string>();
      const erros: string[] = [];

      for (const aba of abas) {
        if (!aba.unidadeId) continue;
        const linhasParaImportar = aba.linhas.filter((l) => l.selecionada);
        if (linhasParaImportar.length === 0) continue;

        const unidade = unidades.find((u) => u.id === aba.unidadeId);
        const last4 = (aba.conta.acctId || "").slice(-4);
        const labelConta = `${unidade?.nome ?? "—"} · ${aba.conta.bankName ?? bancoNome(aba.conta.bankId)} ····${last4}`;

        // Cria conta bancária se necessário e captura o ID
        let contaBancariaId: string | null = aba.contaBancariaId;
        if (aba.criarContaBancaria && !contaBancariaId) {
          const { data: cbData, error: cbErr } = await supabase
            .from("contas_bancarias")
            .insert({
              nome: `${aba.conta.bankName ?? bancoNome(aba.conta.bankId)} ${last4}`,
              banco: aba.conta.bankName ?? bancoNome(aba.conta.bankId),
              agencia: null,
              conta: aba.conta.acctId || null,
              unidade_id: aba.unidadeId,
              tipo: aba.conta.acctType?.toLowerCase().includes("sav") ? "poupanca" : "corrente",
              saldo_inicial: aba.conta.saldoFinal,
              saldo_atual: aba.conta.saldoFinal,
              ativo: true,
            })
            .select("id")
            .single();
          if (cbErr) {
            console.error("Erro criar conta bancária:", cbErr);
            erros.push(`Conta ${labelConta}: ${cbErr.message}`);
          } else if (cbData) {
            contaBancariaId = (cbData as any).id;
            contasCriadas++;
          }
        }

        if (contaBancariaId) contasBancariasIds.push(contaBancariaId);
        unidadesIds.add(aba.unidadeId);

        // Insere lançamentos em batches, validando erros reais
        const rows = linhasParaImportar.map((l) => ({
          data: l.date,
          descricao: (l.memo || l.fitid || "OFX").slice(0, 200),
          valor: l.amount,
          tipo: l.amount >= 0 ? "credito" : "debito",
          unidade_id: aba.unidadeId!,
          conta_bancaria_id: contaBancariaId,
          conciliado: false,
        }));

        let inseridosNaAba = 0;
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          const { error: insErr } = await (supabase.from("extrato_bancario" as any) as any).insert(batch);
          if (insErr) {
            console.error("Erro insert extrato_bancario:", insErr);
            erros.push(`Lote ${labelConta}: ${insErr.message}`);
          } else {
            inseridosNaAba += batch.length;
          }
        }
        totalInseridos += inseridosNaAba;
        saldosResumo.push({ nome: labelConta, valor: aba.conta.saldoFinal });
      }

      // Upload do arquivo original (uma vez)
      try {
        const tsPath = `${empresaId}/ofx-${Date.now()}-${arquivo.name}`;
        await supabase.storage.from("contabil-extratos").upload(tsPath, arquivo, {
          contentType: "application/x-ofx",
        });
      } catch (e) {
        console.warn("Falha no upload do OFX original:", e);
      }

      // Se nada foi inserido e houve erros, falhou
      if (totalInseridos === 0 && erros.length > 0) {
        toast.error("Falha na importação: " + erros[0]);
        const erroEntry: Importacao = {
          id: crypto.randomUUID(), arquivo: arquivo.name, quando: new Date(),
          contas: abas.length, lancamentos: 0, status: "erro",
        };
        setHistorico((prev) => [erroEntry, ...prev].slice(0, 5));
        return;
      }

      // Histórico em memória
      const okEntry: Importacao = {
        id: crypto.randomUUID(),
        arquivo: arquivo.name,
        quando: new Date(),
        contas: abas.length,
        lancamentos: totalInseridos,
        status: erros.length > 0 ? "erro" : "ok",
      };
      setHistorico((prev) => [okEntry, ...prev].slice(0, 5));

      setResumoFinal({
        contas: abas.length,
        lancamentos: totalInseridos,
        periodo: `${fmtData(resumo.dMin)} → ${fmtData(resumo.dMax)}`,
        saldos: saldosResumo,
      });

      if (erros.length > 0) {
        toast.warning(
          `Importação parcial: ${totalInseridos} gravado(s), ${erros.length} erro(s). Veja o console.`,
        );
      } else {
        toast.success(
          `Importação concluída: ${totalInseridos} lançamento(s) em ${abas.length} conta(s).` +
            (contasCriadas > 0 ? ` ${contasCriadas} conta(s) bancária(s) criada(s).` : ""),
        );
      }

      // Limpa input mantendo o resumo final visível
      if (inputRef.current) inputRef.current.value = "";

      const result: ImportOFXResult = {
        totalInseridos,
        contas: abas.length,
        contasCriadas,
        contasBancariasIds,
        unidadesIds: Array.from(unidadesIds),
        periodo: resumo.dMin && resumo.dMax ? { inicio: resumo.dMin, fim: resumo.dMax } : null,
      };
      onConcluido?.(result);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro na importação: " + e.message);
      const erroEntry: Importacao = {
        id: crypto.randomUUID(), arquivo: arquivo.name, quando: new Date(),
        contas: abas.length, lancamentos: 0, status: "erro",
      };
      setHistorico((prev) => [erroEntry, ...prev].slice(0, 5));
    } finally {
      setImportando(false);
    }
  };

  const tentarImportar = () => {
    if (resumo.dup > 0) setConfirmarDup(true);
    else fazerImport();
  };

  const exportarResumoCSV = () => {
    const linhas: string[] = [];
    linhas.push("Conta;Banco;Unidade;Lançamentos;Saldo Final;Período");
    abas.forEach((a) => {
      const u = unidades.find((x) => x.id === a.unidadeId);
      linhas.push(
        [
          a.conta.acctId, a.conta.bankName ?? bancoNome(a.conta.bankId), u?.nome ?? "—",
          a.linhas.length, a.conta.saldoFinal.toFixed(2),
          `${fmtData(a.conta.dataInicio)} a ${fmtData(a.conta.dataFim)}`,
        ].join(";"),
      );
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `resumo-ofx-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const navegarAba = (dir: -1 | 1) => {
    const idx = abas.findIndex((a) => a.id === abaAtiva);
    const novo = (idx + dir + abas.length) % abas.length;
    setAbaAtiva(abas[novo].id);
  };

  // ----- RENDER -----
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetAll(); } }}>
      <DialogTrigger asChild>
        <Button className="bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white">
          <Upload className="h-4 w-4 mr-2" /> Importar OFX
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-[min(98vw,1200px)] !w-[min(98vw,1200px)] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-[hsl(165,60%,55%)]" /> Importar Extrato OFX
          </DialogTitle>
          <DialogDescription>
            Importação multi-conta com detecção automática de filial, preview por aba e resumo final.
          </DialogDescription>
        </DialogHeader>

        {/* ETAPA 1: Upload */}
        {abas.length === 0 && !resumoFinal && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                onSelectFile(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-[hsl(165,60%,55%)] bg-[hsl(165,60%,55%)]/5"
                  : "border-border hover:border-[hsl(165,60%,55%)]/60"
              }`}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Arraste o arquivo OFX aqui</p>
              <p className="text-xs text-muted-foreground">ou clique para selecionar (suporta OFX 1.x e 2.x)</p>
              <input
                ref={inputRef} type="file" accept=".ofx,.OFX" className="hidden"
                onChange={(e) => onSelectFile(e.target.files)}
              />
            </div>

            {parsing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando arquivo...
                </div>
                <Progress value={progresso} />
              </div>
            )}

            {historico.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <History className="h-4 w-4" /> Últimas importações (sessão)
                  </div>
                  <div className="space-y-1 text-xs">
                    {historico.map((h) => (
                      <div key={h.id} className="flex items-center justify-between border-b border-border/50 py-1">
                        <span className="truncate">{h.arquivo}</span>
                        <span className="text-muted-foreground whitespace-nowrap ml-2">
                          {h.contas} conta(s) · {h.lancamentos} lanç. ·{" "}
                          {h.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                          {h.status === "ok" ? "✓" : "✗"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ETAPA 2: Preview */}
        {abas.length > 0 && !resumoFinal && (
          <div className="space-y-4">
            {/* Painel de resumo */}
            <Card>
              <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                <div><div className="text-muted-foreground text-xs">Contas</div><div className="font-semibold">{abas.length}</div></div>
                <div><div className="text-muted-foreground text-xs">Lançamentos</div><div className="font-semibold">{resumo.total}</div></div>
                <div><div className="text-muted-foreground text-xs">Selecionados</div><div className="font-semibold">{resumo.sel}</div></div>
                <div><div className="text-muted-foreground text-xs">Período</div><div className="font-semibold">{fmtData(resumo.dMin)} → {fmtData(resumo.dMax)}</div></div>
                <div><div className="text-muted-foreground text-xs">Filiais</div><div className="font-semibold">{resumo.unidadesDistintas}</div></div>
              </CardContent>
            </Card>

            {/* Tabs por conta */}
            <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => navegarAba(-1)} disabled={abas.length < 2}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 overflow-x-auto">
                  <TabsList className="inline-flex h-auto flex-nowrap">
                    {abas.map((a) => {
                      const u = unidades.find((x) => x.id === a.unidadeId);
                      const last4 = (a.conta.acctId || "").slice(-4);
                      return (
                        <TabsTrigger key={a.id} value={a.id} className="whitespace-nowrap">
                          {(u?.nome ?? "?")} · {a.conta.bankName ?? bancoNome(a.conta.bankId)} ····{last4}
                          {!a.unidadeId && <AlertTriangle className="h-3 w-3 ml-1 text-warning" />}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
                <Button variant="outline" size="icon" onClick={() => navegarAba(1)} disabled={abas.length < 2}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {abas.map((a) => {
                const u = unidades.find((x) => x.id === a.unidadeId);
                const linhasF = linhasFiltradas(a);
                return (
                  <TabsContent key={a.id} value={a.id} className="space-y-3 mt-4">
                    {/* Cabeçalho da aba */}
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div><div className="text-xs text-muted-foreground">Banco</div><div className="font-medium">{a.conta.bankName ?? bancoNome(a.conta.bankId)}</div></div>
                          <div><div className="text-xs text-muted-foreground">Conta</div><div className="font-medium tabular-nums">····{(a.conta.acctId || "").slice(-4)}</div></div>
                          <div><div className="text-xs text-muted-foreground">Período</div><div className="font-medium">{fmtData(a.conta.dataInicio)} → {fmtData(a.conta.dataFim)}</div></div>
                          <div><div className="text-xs text-muted-foreground">Saldo final</div><div className="font-medium tabular-nums">{fmtBRL(a.conta.saldoFinal)}</div></div>
                        </div>

                        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-border/50">
                          <div className="flex-1 min-w-[200px]">
                            <Label className="text-xs">Filial</Label>
                            <Select
                              value={a.unidadeId ?? ""}
                              onValueChange={(v) => updateAba(a.id, { unidadeId: v, detectadaPor: "manual" })}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione a filial..." /></SelectTrigger>
                              <SelectContent>
                                {unidades.map((un) => (
                                  <SelectItem key={un.id} value={un.id}>{un.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Detectada via: <Badge variant="outline" className="text-[10px]">{a.detectadaPor.replace("_", " ")}</Badge>
                            </div>
                          </div>
                          {a.contaBancariaId === null && a.unidadeId && (
                            <div className="flex items-center gap-2 pb-2">
                              <Checkbox
                                id={`criar-${a.id}`}
                                checked={a.criarContaBancaria}
                                onCheckedChange={(v) => updateAba(a.id, { criarContaBancaria: !!v })}
                              />
                              <Label htmlFor={`criar-${a.id}`} className="text-xs cursor-pointer">
                                Criar conta bancária automaticamente
                              </Label>
                            </div>
                          )}
                        </div>

                        {/* Filtros */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/50">
                          <div>
                            <Label className="text-[10px]">Data início</Label>
                            <Input type="date" className="h-8 text-xs" value={a.filtroDataIni}
                              onChange={(e) => updateAba(a.id, { filtroDataIni: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Data fim</Label>
                            <Input type="date" className="h-8 text-xs" value={a.filtroDataFim}
                              onChange={(e) => updateAba(a.id, { filtroDataFim: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Valor mín. (abs)</Label>
                            <Input type="number" step="0.01" className="h-8 text-xs" value={a.filtroValorMin}
                              onChange={(e) => updateAba(a.id, { filtroValorMin: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Valor máx. (abs)</Label>
                            <Input type="number" step="0.01" className="h-8 text-xs" value={a.filtroValorMax}
                              onChange={(e) => updateAba(a.id, { filtroValorMax: e.target.value })} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Tabela */}
                    <div className="overflow-x-auto border border-border rounded-lg">
                      <table className="w-full text-xs min-w-[800px]">
                        <thead className="bg-muted text-muted-foreground uppercase text-[10px]">
                          <tr>
                            <th className="px-2 py-2 w-8"></th>
                            <th className="px-2 py-2 text-left whitespace-nowrap w-[90px]">Data</th>
                            <th className="px-2 py-2 text-left">Descrição</th>
                            <th className="px-2 py-2 text-right whitespace-nowrap w-[120px]">Valor</th>
                            <th className="px-2 py-2 text-left whitespace-nowrap w-[80px]">Tipo</th>
                            <th className="px-2 py-2 text-right whitespace-nowrap w-[120px]">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {linhasF.map((l) => {
                            const realIdx = a.linhas.indexOf(l);
                            return (
                              <tr key={realIdx} className={l.duplicado ? "bg-warning/5" : ""}>
                                <td className="px-2 py-1.5">
                                  <Checkbox checked={l.selecionada} onCheckedChange={() => toggleLinha(a.id, realIdx)} />
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{fmtData(l.date)}</td>
                                <td className="px-2 py-1.5 max-w-[300px] truncate" title={l.memo}>
                                  {l.memo || l.fitid}
                                  {l.duplicado && <Badge variant="outline" className="ml-1 text-[9px] border-warning/40 text-warning">duplicado</Badge>}
                                  {l.suspeito && <Badge variant="outline" className="ml-1 text-[9px] border-warning/40 text-warning">revisar</Badge>}
                                </td>
                                <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${l.amount >= 0 ? "text-success dark:text-success" : "text-destructive dark:text-destructive"}`}>
                                  {fmtBRL(l.amount)}
                                </td>
                                <td className="px-2 py-1.5">
                                  <Badge variant="outline" className={l.amount >= 0 ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}>
                                    {l.amount >= 0 ? "Crédito" : "Débito"}
                                  </Badge>
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtBRL(l.saldoAcumulado)}</td>
                              </tr>
                            );
                          })}
                          {linhasF.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum lançamento com os filtros aplicados.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>

            {/* Ações finais */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportarResumoCSV}>
                  <Download className="h-4 w-4 mr-2" /> Exportar Resumo
                </Button>
                <Button variant="outline" size="sm" onClick={() => arquivo && processarArquivo(arquivo)} disabled={!arquivo || parsing}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
                </Button>
                <Button variant="ghost" size="sm" onClick={resetAll}>Cancelar</Button>
              </div>
              <Button onClick={tentarImportar} disabled={!podeImportar}
                className="bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white">
                {importando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Importar {resumo.sel} lançamento(s)
              </Button>
            </div>
            {!resumo.todasComUnidade && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Selecione a filial em todas as abas para habilitar a importação.
              </p>
            )}
          </div>
        )}

        {/* ETAPA 3: Resumo final */}
        {resumoFinal && (
          <div className="space-y-4">
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-6 text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 mx-auto text-success" />
                <h3 className="text-lg font-semibold">Importação concluída com sucesso</h3>
                <p className="text-sm text-muted-foreground">
                  {resumoFinal.lancamentos} lançamento(s) em {resumoFinal.contas} conta(s) · Período: {resumoFinal.periodo}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium mb-2">Saldos finais por conta</div>
                <div className="space-y-1 text-sm">
                  {resumoFinal.saldos.map((s, i) => (
                    <div key={i} className="flex justify-between border-b border-border/50 py-1">
                      <span>{s.nome}</span>
                      <span className="tabular-nums font-medium">{fmtBRL(s.valor)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAll}>Nova Importação</Button>
              <Button onClick={() => setOpen(false)}>Fechar</Button>
            </div>
          </div>
        )}

        <AlertDialog open={confirmarDup} onOpenChange={setConfirmarDup}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Lançamentos duplicados detectados</AlertDialogTitle>
              <AlertDialogDescription>
                {resumo.dup} lançamento(s) duplicado(s) estão marcados para importação. Deseja importar mesmo assim?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmarDup(false); fazerImport(); }}>Importar mesmo assim</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
