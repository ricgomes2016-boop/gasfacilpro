import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, CheckCircle2, Download, Eye, FileText, Inbox, Loader2, Plug, PlugZap,
  RefreshCw, Search, Settings2, ShieldQuestion, ShoppingBasket, Upload, XCircle,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { AppPage } from "@/components/ui-kit/AppPage";
import { EstoqueKpiCard } from "@/components/estoque/EstoqueKpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import { formatCNPJ } from "@/hooks/useInputMasks";
import { formatarChave, formatarNumeroSerie } from "@/lib/fiscal/chaveNfe";
import { parseDfeItens, type DfeItemParsed } from "@/lib/fiscal/dfeXml";
import {
  ROTULO_MANIFESTACAO, manifestacoesPermitidas, exigeJustificativa, validarJustificativa,
  type ManifestacaoTipo,
} from "@/lib/fiscal/manifestacao";
import {
  AGENTE_URL_PADRAO, agenteDistribuicao, agenteManifestar, getAgenteConfig, setAgenteConfig, verificarAgente,
  type AgenteConfig, type AgenteStatus, type DocumentoAgente,
} from "@/lib/fiscal/agenteLocal";
import { ErroSincronizacaoAgente, sincronizarDfeComAgente } from "@/lib/fiscal/dfeSync";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";


interface DfeDocumento {
  id: string;
  chave: string;
  nsu: number | null;
  tipo_documento: string;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  numero: string | null;
  serie: string | null;
  valor_total: number;
  data_emissao: string | null;
  situacao_nfe: string | null;
  manifestacao: ManifestacaoTipo | null;
  manifestacao_em: string | null;
  xml_path: string | null;
  xml_completo: boolean;
  compra_id: string | null;
  created_at: string;
}

interface DfeEvento {
  id: string;
  tipo_evento: string;
  descricao: string | null;
  protocolo: string | null;
  cstat: string | null;
  xmotivo: string | null;
  justificativa: string | null;
  sucesso: boolean;
  created_at: string;
}

const PAGE_SIZE = 25;

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

const dataBR = (iso?: string | null) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return "—"; }
};

function BadgeManifestacao({ m }: { m: ManifestacaoTipo | null }) {
  if (!m) return <Badge variant="outline" className="text-warning border-warning/40">Pendente</Badge>;
  const map: Record<ManifestacaoTipo, string> = {
    ciencia: "border-info/40 text-info",
    confirmada: "border-success/40 text-success",
    desconhecida: "border-destructive/40 text-destructive",
    nao_realizada: "border-destructive/40 text-destructive",
  };
  return <Badge variant="outline" className={map[m]}>{ROTULO_MANIFESTACAO[m]}</Badge>;
}

export default function DFeRecebidos() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [documentos, setDocumentos] = useState<DfeDocumento[]>([]);
  const [estado, setEstado] = useState<{ ultimo_nsu: number; max_nsu: number; ultima_sincronizacao: string | null } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroManifestacao, setFiltroManifestacao] = useState("todas");
  const [filtroSituacao, setFiltroSituacao] = useState("todas");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [pagina, setPagina] = useState(1);

  const [detalhe, setDetalhe] = useState<DfeDocumento | null>(null);
  const [eventos, setEventos] = useState<DfeEvento[]>([]);
  const [itens, setItens] = useState<DfeItemParsed[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const [confirmacao, setConfirmacao] = useState<{ doc: DfeDocumento; tipo: ManifestacaoTipo } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [manifestando, setManifestando] = useState(false);

  // Agente local (fiscal-bridge no PC do escritório, com o certificado A1)
  const [agenteCfg, setAgenteCfgState] = useState<AgenteConfig>(() => getAgenteConfig());
  const [agente, setAgente] = useState<AgenteStatus>({ online: false });
  const [checandoAgente, setChecandoAgente] = useState(true);
  const [configAberta, setConfigAberta] = useState(false);
  const [rascunhoCfg, setRascunhoCfg] = useState<AgenteConfig>(() => getAgenteConfig());
  const [tokenVisivel, setTokenVisivel] = useState(false);
  const [progresso, setProgresso] = useState("");
  const inputXmlRef = useRef<HTMLInputElement>(null);

  const checarAgente = useCallback(async (cfg?: AgenteConfig) => {
    setChecandoAgente(true);
    const status = await verificarAgente(cfg ?? agenteCfg);
    setAgente(status);
    setChecandoAgente(false);
    return status;
  }, [agenteCfg]);

  useEffect(() => { void checarAgente(); }, [checarAgente]);


  const carregar = useCallback(async () => {
    if (!unidadeAtual?.id) { setDocumentos([]); setCarregando(false); return; }
    setCarregando(true);
    const [{ data: docs, error }, { data: est }] = await Promise.all([
      (supabase as any).from("dfe_documentos").select("*")
        .eq("unidade_id", unidadeAtual.id)
        .order("data_emissao", { ascending: false, nullsFirst: false })
        .limit(1000),
      (supabase as any).from("dfe_nsu_estado").select("ultimo_nsu, max_nsu, ultima_sincronizacao")
        .eq("unidade_id", unidadeAtual.id).maybeSingle(),
    ]);
    if (error) {
      toast({ title: "Erro ao carregar DF-e", description: error.message, variant: "destructive" });
    }
    setDocumentos((docs ?? []) as DfeDocumento[]);
    setEstado(est ?? null);
    setCarregando(false);
  }, [unidadeAtual?.id, toast]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setPagina(1); }, [busca, filtroManifestacao, filtroSituacao, dataInicial, dataFinal]);

  /** Envia XMLs brutos para a edge function que valida e persiste com RLS. */
  const ingerir = async (
    documentosXml: DocumentoAgente[],
    ultimoNSU?: number,
    maxNSU?: number,
    registrarEstado = false,
    cStat?: string,
  ) => {
    const { data, error } = await supabase.functions.invoke("dfe-ingerir", {
      body: { unidadeId: unidadeAtual!.id, documentos: documentosXml, ultimoNSU, maxNSU, registrarEstado, cStat },
    });
    if (error) throw error;
    return data as { ok: boolean; novos?: number; atualizados?: number; eventos?: number; mensagem?: string };
  };

  /** Sincroniza pela SEFAZ usando o agente local (lotes de NSU). */
  const sincronizarComAgente = async () => {
    const cnpj = (unidadeAtual as any)?.cnpj ?? null;
    const resultado = await sincronizarDfeComAgente({
      ultimoNSU: Number(estado?.ultimo_nsu ?? 0),
      maxNSU: Number(estado?.max_nsu ?? 0),
      distribuir: (ultNSU) => agenteDistribuicao({ unidadeId: unidadeAtual!.id, cnpj, ultNSU }, agenteCfg),
      ingerir: (docs, ultimoNSU, maxNSU, cStat) => ingerir(docs, ultimoNSU, maxNSU, docs.length === 0, cStat),
      progresso: setProgresso,
    });

    toast({
      title: "Sincronização concluída",
      description: resultado.novos + resultado.atualizados === 0
        ? "Nenhum documento novo na SEFAZ."
        : `${resultado.novos} novo(s) e ${resultado.atualizados} atualizado(s).`,
    });
  };

  const sincronizar = async () => {
    if (!unidadeAtual?.id) {
      toast({ title: "Selecione uma unidade", description: "A consulta usa o certificado digital da unidade.", variant: "destructive" });
      return;
    }
    setSincronizando(true);
    try {
      const status = agente.autenticado ? agente : await checarAgente();
      if (status.autenticado) {
        await sincronizarComAgente();
      } else {
        const { data, error } = await supabase.functions.invoke("dfe-sincronizar", {
          body: { unidadeId: unidadeAtual.id },
        });
        if (error) throw error;
        if (!data?.ok) {
          const semBridge = data?.motivo === "bridge_nao_configurado";
          toast({
            title: semBridge
              ? "Agente local desligado"
              : data?.motivo === "cert_nao_cadastrado" ? "Certificado digital não configurado" : "Sincronização não concluída",
            description: semBridge
              ? "Ligue o agente local no computador do escritório (instalar-agente.bat) ou importe o XML manualmente."
              : (data?.mensagem || "A SEFAZ não respondeu à consulta."),
            variant: "destructive",
          });
        } else {
          toast({ title: "Sincronização concluída", description: data.mensagem });
        }
      }
      await carregar();
    } catch (e: any) {
      toast({
        title: e instanceof ErroSincronizacaoAgente && e.motivo === "token_invalido" ? "Token do agente inválido" : "Erro ao sincronizar",
        description: e?.message || "A sincronização não foi concluída.",
        variant: "destructive",
      });
    } finally {
      setSincronizando(false);
      setProgresso("");
    }
  };

  /** Importação manual de arquivos XML (fallback quando o agente está desligado). */
  const importarXmls = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    if (!unidadeAtual?.id) {
      toast({ title: "Selecione uma unidade", variant: "destructive" });
      return;
    }
    setSincronizando(true);
    try {
      const docs: DocumentoAgente[] = [];
      for (const arq of Array.from(arquivos)) {
        const texto = await arq.text();
        if (texto.trim()) docs.push({ nsu: 0, schema: null, xml: texto });
      }
      if (!docs.length) {
        toast({ title: "Nenhum XML válido", variant: "destructive" });
        return;
      }
      setProgresso(`Importando ${docs.length} arquivo(s)...`);
      const ing = await ingerir(docs);
      toast({
        title: ing?.ok ? "Importação concluída" : "Importação não concluída",
        description: ing?.mensagem,
        variant: ing?.ok ? undefined : "destructive",
      });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao importar XML", description: e?.message, variant: "destructive" });
    } finally {
      setSincronizando(false);
      setProgresso("");
      if (inputXmlRef.current) inputXmlRef.current.value = "";
    }
  };

  const salvarConfigAgente = async () => {
    const cfg = { url: (rascunhoCfg.url || AGENTE_URL_PADRAO).replace(/\/+$/, ""), token: rascunhoCfg.token.trim() };
    const status = await checarAgente(cfg);
    if (status.autenticado) {
      setAgenteConfig(cfg);
      setAgenteCfgState(cfg);
    }
    toast({
      title: status.autenticado ? "Agente local conectado" : status.online ? "Pareamento não autorizado" : "Agente local não respondeu",
      description: status.autenticado
        ? `Modo ${status.modo ?? "local"}${status.ambiente ? ` — ${status.ambiente}` : ""}.`
        : status.erro === "token_vazio"
          ? "Informe o token de pareamento do agente."
          : status.erro === "token_invalido"
            ? "O token informado não corresponde ao agente local."
            : "Verifique se o agente está em execução no computador do escritório.",
      variant: status.autenticado ? undefined : "destructive",
    });
    if (status.autenticado) setConfigAberta(false);
  };


  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase().replace(/[.\-/]/g, "");
    return documentos.filter((d) => {
      if (termo) {
        const alvo = [d.chave, d.cnpj_emitente, d.nome_emitente, d.numero]
          .filter(Boolean).join(" ").toLowerCase().replace(/[.\-/]/g, "");
        if (!alvo.includes(termo)) return false;
      }
      if (filtroManifestacao !== "todas") {
        if (filtroManifestacao === "pendente" ? d.manifestacao !== null : d.manifestacao !== filtroManifestacao) return false;
      }
      if (filtroSituacao !== "todas" && (d.situacao_nfe ?? "") !== filtroSituacao) return false;
      const emissao = d.data_emissao ?? d.created_at;
      if (dataInicial && emissao < dataInicial) return false;
      if (dataFinal && emissao > `${dataFinal}T23:59:59`) return false;
      return true;
    });
  }, [documentos, busca, filtroManifestacao, filtroSituacao, dataInicial, dataFinal]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginados = filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const kpis = useMemo(() => {
    const desde = estado?.ultima_sincronizacao ? new Date(estado.ultima_sincronizacao).getTime() - 60 * 60 * 1000 : 0;
    return {
      pendentes: documentos.filter((d) => !d.manifestacao).length,
      ciencia: documentos.filter((d) => d.manifestacao === "ciencia").length,
      confirmadas: documentos.filter((d) => d.manifestacao === "confirmada").length,
      recusadas: documentos.filter((d) => d.manifestacao === "desconhecida" || d.manifestacao === "nao_realizada").length,
      novas: desde ? documentos.filter((d) => new Date(d.created_at).getTime() >= desde).length : 0,
    };
  }, [documentos, estado]);

  const abrirDetalhe = async (doc: DfeDocumento) => {
    setDetalhe(doc);
    setItens([]);
    setEventos([]);
    setCarregandoDetalhe(true);
    const { data: evs } = await (supabase as any).from("dfe_eventos")
      .select("id, tipo_evento, descricao, protocolo, cstat, xmotivo, justificativa, sucesso, created_at")
      .eq("documento_id", doc.id).order("created_at", { ascending: false });
    setEventos((evs ?? []) as DfeEvento[]);
    if (doc.xml_path) {
      const { data: file } = await supabase.storage.from("contabil-xmls").download(doc.xml_path);
      if (file) setItens(parseDfeItens(await file.text()));
    }
    setCarregandoDetalhe(false);
  };

  const baixarXml = async (doc: DfeDocumento) => {
    if (!doc.xml_path) {
      toast({
        title: "XML completo indisponível",
        description: "A SEFAZ libera o XML completo após a Manifestação do Destinatário. Registre a Ciência da Emissão e sincronize novamente.",
        variant: "destructive",
      });
      return;
    }
    const { data, error } = await supabase.storage.from("contabil-xmls").download(doc.xml_path);
    if (error || !data) {
      toast({ title: "Falha ao baixar XML", description: error?.message, variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = `${doc.chave}.xml`; a.click();
    URL.revokeObjectURL(url);
  };

  const pedirManifestacao = (doc: DfeDocumento, tipo: ManifestacaoTipo) => {
    setJustificativa("");
    setConfirmacao({ doc, tipo });
  };

  const executarManifestacao = async () => {
    if (!confirmacao || !unidadeAtual?.id) return;
    const { doc, tipo } = confirmacao;
    const check = validarJustificativa(tipo, justificativa);
    if (!check.valido) {
      toast({ title: "Justificativa inválida", description: check.erro, variant: "destructive" });
      return;
    }
    setManifestando(true);
    try {
      // 1) Preferência: agente local (o certificado A1 nunca sai do PC).
      const status = agente.online ? agente : await checarAgente();
      let data: any = null;

      if (status.online) {
        const resp: any = await agenteManifestar(
          { unidadeId: unidadeAtual.id, chave: doc.chave, tipo, justificativa },
          agenteCfg,
        );
        if (!resp.ok) {
          toast({ title: "Manifestação não registrada", description: resp.mensagem, variant: "destructive" });
          return;
        }


        // 2) A nuvem confere a assinatura do evento antes de gravar.
        const ingest = await supabase.functions.invoke("dfe-evento-ingerir", {
          body: {
            unidadeId: unidadeAtual.id, chave: doc.chave, tipo, justificativa,
            eventoXml: resp.dados.eventoXml, retornoXml: resp.dados.retornoXml,
            cStat: resp.dados.cStat, xMotivo: resp.dados.xMotivo, protocolo: resp.dados.protocolo,
          },
        });
        if (ingest.error) throw ingest.error;
        data = ingest.data;
      } else {
        const resp = await supabase.functions.invoke("dfe-manifestar", {
          body: { unidadeId: unidadeAtual.id, chave: doc.chave, tipo, justificativa },
        });
        if (resp.error) throw resp.error;
        data = resp.data;
      }

      if (!data?.ok) {
        toast({
          title: "Manifestação não registrada",
          description: [data?.mensagem, data?.cStat ? `cStat ${data.cStat}` : null].filter(Boolean).join(" — "),
          variant: "destructive",
        });
      } else {
        toast({ title: ROTULO_MANIFESTACAO[tipo], description: data.mensagem });
        setConfirmacao(null);
        await carregar();
        if (detalhe?.id === doc.id) {
          const atualizado = { ...doc, manifestacao: tipo, manifestacao_em: new Date().toISOString() };
          setDetalhe(atualizado);
          void abrirDetalhe(atualizado);
        }
      }
    } catch (e: any) {
      toast({ title: "Erro na manifestação", description: e?.message, variant: "destructive" });
    } finally {
      setManifestando(false);
    }
  };


  const criarCompra = (doc: DfeDocumento) => {
    navigate(`/estoque/compras?chave=${doc.chave}`);
  };

  const acoesManifestacao = (doc: DfeDocumento) => manifestacoesPermitidas(doc.manifestacao);

  return (
    <MainLayout>
      <Header title="DF-e Recebidos" subtitle="Gestão de Estoque" />
      <AppPage>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
          <EstoqueKpiCard icon={Inbox} label="Pendentes de manifestação" value={kpis.pendentes} tone="warning" />
          <EstoqueKpiCard icon={Eye} label="Com ciência" value={kpis.ciencia} tone="info" />
          <EstoqueKpiCard icon={CheckCircle2} label="Confirmadas" value={kpis.confirmadas} tone="success" />
          <EstoqueKpiCard icon={XCircle} label="Desconhecidas / não realizadas" value={kpis.recusadas} tone="destructive" />
          <EstoqueKpiCard
            icon={RefreshCw}
            label="Novas na última sincronização"
            value={kpis.novas}
            tone="secondary"
            hint={estado?.ultima_sincronizacao ? dataBR(estado.ultima_sincronizacao) : "nunca sincronizado"}
          />
        </div>

        <Card>
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                {checandoAgente ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : agente.autenticado ? (
                  <PlugZap className="h-4 w-4 text-success" />
                ) : (
                  <Plug className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">
                   {checandoAgente
                     ? "Procurando o agente local..."
                     : agente.autenticado
                       ? "Agente local conectado"
                       : agente.online
                         ? "Agente local sem pareamento"
                         : "Agente local desligado"}
                </span>
                <span className="text-xs text-muted-foreground">
                   {agente.autenticado
                    ? `${agenteCfg.url}${agente.ambiente ? ` — ${agente.ambiente}` : ""}`
                     : agente.online
                       ? agente.erro === "token_vazio" ? "Informe o token para autenticar." : "Token inválido; configure novamente o pareamento."
                       : "Ligue o agente no computador do escritório (instalar-agente.bat) ou importe o XML manualmente."}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { setRascunhoCfg(agenteCfg); setConfigAberta(true); }}>
                  <Settings2 className="h-4 w-4" /> Configurar agente
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void checarAgente()} disabled={checandoAgente}>
                  <RefreshCw className={`h-4 w-4 ${checandoAgente ? "animate-spin" : ""}`} /> Testar conexão
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por chave, CNPJ, emitente ou número"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <input
                ref={inputXmlRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple
                className="hidden"
                onChange={(e) => void importarXmls(e.target.files)}
              />
              <Button variant="outline" onClick={() => inputXmlRef.current?.click()} disabled={sincronizando} className="gap-2">
                <Upload className="h-4 w-4" /> Importar XML
              </Button>
              <Button onClick={sincronizar} disabled={sincronizando} className="gap-2">
                {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sincronizar agora
              </Button>
            </div>

            {progresso && <p className="text-xs text-muted-foreground">{progresso}</p>}


            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div>
                <Label className="text-xs">Manifestação</Label>
                <Select value={filtroManifestacao} onValueChange={setFiltroManifestacao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="ciencia">Ciência da Emissão</SelectItem>
                    <SelectItem value="confirmada">Confirmação da Operação</SelectItem>
                    <SelectItem value="desconhecida">Desconhecimento da Operação</SelectItem>
                    <SelectItem value="nao_realizada">Operação não Realizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Situação na SEFAZ</Label>
                <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="autorizada">Autorizada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                    <SelectItem value="denegada">Denegada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Emissão de</Label>
                <Input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">até</Label>
                <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
              </div>
            </div>

            {estado && (
              <p className="text-xs text-muted-foreground">
                Consulta incremental por NSU — último NSU lido {estado.ultimo_nsu} de {estado.max_nsu || "?"} disponíveis na SEFAZ.
                A sincronização é manual e respeita os limites do Ambiente Nacional.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Nº/Série</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Manifestação</TableHead>
                    <TableHead className="text-right">NSU</TableHead>
                    <TableHead>XML</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregando && (
                    <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell></TableRow>
                  )}
                  {!carregando && paginados.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      Nenhum documento fiscal encontrado. Use “Sincronizar agora” para consultar a SEFAZ.
                    </TableCell></TableRow>
                  )}
                  {paginados.map((d) => (
                    <TableRow key={d.id} className="cursor-pointer" onClick={() => abrirDetalhe(d)}>
                      <TableCell className="whitespace-nowrap text-sm">{dataBR(d.data_emissao)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatarNumeroSerie(d.numero, d.serie)}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <p className="truncate text-sm font-medium">{d.nome_emitente || "—"}</p>
                        <p className="text-xs text-muted-foreground">{d.cnpj_emitente ? formatCNPJ(d.cnpj_emitente) : "—"}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-semibold">{brl(d.valor_total)}</TableCell>
                      <TableCell className="text-sm capitalize">{d.situacao_nfe ?? "—"}</TableCell>
                      <TableCell><BadgeManifestacao m={d.manifestacao} /></TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{d.nsu ?? "—"}</TableCell>
                      <TableCell>
                        {d.xml_completo
                          ? <Badge variant="outline" className="border-success/40 text-success">Completo</Badge>
                          : <Badge variant="outline" className="text-muted-foreground">Resumo</Badge>}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Baixar XML" onClick={() => baixarXml(d)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Criar compra" onClick={() => criarCompra(d)}>
                            <ShoppingBasket className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Detalhes" onClick={() => abrirDetalhe(d)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filtrados.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 border-t border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {filtrados.length} documento(s) — página {pagina} de {totalPaginas}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </AppPage>

      <Sheet open={!!detalhe} onOpenChange={(v) => { if (!v) setDetalhe(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {detalhe && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">
                  NF-e {formatarNumeroSerie(detalhe.numero, detalhe.serie)} — {detalhe.nome_emitente || "Emitente não informado"}
                </SheetTitle>
                <SheetDescription className="break-all font-mono text-[11px]">
                  {formatarChave(detalhe.chave)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">CNPJ</p><p>{detalhe.cnpj_emitente ? formatCNPJ(detalhe.cnpj_emitente) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Emissão</p><p>{dataBR(detalhe.data_emissao)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Valor total</p><p className="font-semibold">{brl(detalhe.valor_total)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Situação</p><p className="capitalize">{detalhe.situacao_nfe ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">NSU</p><p>{detalhe.nsu ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Manifestação</p><BadgeManifestacao m={detalhe.manifestacao} /></div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => baixarXml(detalhe)}>
                    <Download className="h-4 w-4" /> Baixar XML
                  </Button>
                  <Button size="sm" className="gap-2" onClick={() => criarCompra(detalhe)}>
                    <ShoppingBasket className="h-4 w-4" /> Criar compra
                  </Button>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Manifestação do Destinatário</h4>
                  {acoesManifestacao(detalhe).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Já existe manifestação conclusiva registrada para esta nota — nenhuma nova manifestação é permitida.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {acoesManifestacao(detalhe).map((tipo) => (
                        <Button key={tipo} size="sm" variant={tipo === "confirmada" ? "default" : "outline"}
                          onClick={() => pedirManifestacao(detalhe, tipo)}>
                          {ROTULO_MANIFESTACAO[tipo]}
                        </Button>
                      ))}
                    </div>
                  )}
                  {!detalhe.xml_completo && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Apenas o resumo foi disponibilizado pela SEFAZ. O XML completo costuma ser liberado após a manifestação e nova sincronização.
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Itens</h4>
                  {carregandoDetalhe && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!carregandoDetalhe && itens.length === 0 && (
                    <p className="text-xs text-muted-foreground">Itens disponíveis somente com o XML completo.</p>
                  )}
                  {itens.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Unit.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itens.map((i) => (
                            <TableRow key={i.numero}>
                              <TableCell className="text-xs">{i.descricao}</TableCell>
                              <TableCell className="text-right text-xs">{i.quantidade}</TableCell>
                              <TableCell className="text-right text-xs">{brl(i.valorUnitario)}</TableCell>
                              <TableCell className="text-right text-xs">{brl(i.valorTotal)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Histórico de eventos</h4>
                  {eventos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>}
                  <ul className="space-y-2">
                    {eventos.map((ev) => (
                      <li key={ev.id} className="rounded-lg border border-border p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{ev.descricao || ev.tipo_evento}</span>
                          <span className="text-muted-foreground">{dataBR(ev.created_at)}</span>
                        </div>
                        <p className="text-muted-foreground">
                          {ev.sucesso
                            ? <><CheckCircle2 className="mr-1 inline h-3 w-3 text-success" />Registrado</>
                            : <><AlertTriangle className="mr-1 inline h-3 w-3 text-destructive" />Não registrado</>}
                          {ev.cstat ? ` · cStat ${ev.cstat}` : ""}{ev.xmotivo ? ` — ${ev.xmotivo}` : ""}
                          {ev.protocolo ? ` · protocolo ${ev.protocolo}` : ""}
                        </p>
                        {ev.justificativa && <p className="mt-1 italic text-muted-foreground">“{ev.justificativa}”</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmacao} onOpenChange={(v) => { if (!v) setConfirmacao(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {confirmacao ? ROTULO_MANIFESTACAO[confirmacao.tipo] : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === "ciencia" &&
                "A Ciência da Emissão não é manifestação conclusiva: apenas informa à SEFAZ que você tomou conhecimento da nota."}
              {confirmacao?.tipo === "confirmada" &&
                "A Confirmação da Operação é definitiva e pode impedir o cancelamento da nota pelo emitente."}
              {(confirmacao?.tipo === "desconhecida" || confirmacao?.tipo === "nao_realizada") &&
                "Esta manifestação é definitiva e exige justificativa. Ela será enviada e registrada na SEFAZ."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmacao && exigeJustificativa(confirmacao.tipo) && (
            <div className="space-y-1">
              <Label className="text-xs">Justificativa (15 a 255 caracteres)</Label>
              <Textarea
                value={justificativa}
                maxLength={255}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Descreva o motivo da manifestação"
              />
              <p className="text-[11px] text-muted-foreground">{justificativa.trim().length}/255</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={manifestando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void executarManifestacao(); }}
              disabled={manifestando}
            >
              {manifestando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar à SEFAZ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar agente local</DialogTitle>
            <DialogDescription>
              O agente roda no computador do escritório com o certificado A1 e conversa com a SEFAZ.
              O certificado nunca sai desse computador — só os XMLs chegam ao ERP.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Endereço do agente</Label>
              <Input
                value={rascunhoCfg.url}
                placeholder={AGENTE_URL_PADRAO}
                onChange={(e) => setRascunhoCfg((c) => ({ ...c, url: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Token de pareamento</Label>
              <div className="relative">
                <Input
                  type={tokenVisivel ? "text" : "password"}
                  value={rascunhoCfg.token}
                  placeholder="Token exibido pelo comando mostrar-token.ps1"
                  className="pr-10"
                  onChange={(e) => setRascunhoCfg((c) => ({ ...c, token: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  title={tokenVisivel ? "Ocultar token" : "Mostrar token"}
                  onClick={() => setTokenVisivel((v) => !v)}
                >
                  {tokenVisivel ? <Eye className="h-4 w-4" /> : <ShieldQuestion className="h-4 w-4" />}
                </Button>
              </div>
              {!rascunhoCfg.token.trim() && <p className="text-[11px] text-destructive">Token não informado.</p>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use o comando local <code>mostrar-token.ps1</code> para copiar o token protegido. Ele nunca é exibido em logs.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigAberta(false)}>Cancelar</Button>
            <Button onClick={() => void salvarConfigAgente()}>Salvar e testar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>

  );
}
