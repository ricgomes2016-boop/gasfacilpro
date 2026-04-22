import { useState, useEffect, useRef, useMemo } from "react";
import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Upload, FileCode, Loader2, Download, Search, Archive } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { BotaoExportar } from "@/components/contador/BotaoExportar";
import { ImportacaoInteligente } from "@/components/contador/ImportacaoInteligente";
import { fmt } from "@/services/contadorExportService";
import JSZip from "jszip";

interface NotaRow {
  id: string;
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  tipo: string | null;
  valor_total: number | null;
  data_emissao: string | null;
  destinatario_nome: string | null;
  destinatario_cpf_cnpj: string | null;
  remetente_nome: string | null;
  remetente_cpf_cnpj: string | null;
  xml_url: string | null;
  status: string | null;
  created_at: string;
  unidade_id: string | null;
}

const fmtCNPJ = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v;
};

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ContadorXML() {
  const { empresaAtiva, unidadeAtiva, unidades } = useContador();
  const { range } = usePeriodo();
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("");
  const [ignorarPeriodo, setIgnorarPeriodo] = useState(false);
  const [totalNoBanco, setTotalNoBanco] = useState(0);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [baixandoLote, setBaixandoLote] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchNotas = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    try {
      const unidadeIds = unidadeAtiva ? [unidadeAtiva.id] : unidades.map((u) => u.id);
      if (unidadeIds.length === 0) { setNotas([]); setTotalNoBanco(0); return; }

      // 1) Conta o total existente (independente de período) para o aviso
      const { count: totalCount } = await supabase
        .from("notas_fiscais" as any)
        .select("*", { count: "exact", head: true })
        .in("unidade_id", unidadeIds);
      setTotalNoBanco(totalCount ?? 0);

      // 2) Busca os registros — opcionalmente filtrando por data_emissao
      let q = supabase.from("notas_fiscais" as any)
        .select("*")
        .in("unidade_id", unidadeIds)
        .order("data_emissao", { ascending: false, nullsFirst: false })
        .limit(1000);

      if (!ignorarPeriodo) {
        const inicioDate = (range.inicioISOFull ?? range.inicioISO ?? "").slice(0, 10);
        const fimDate = (range.fimISOFull ?? range.fimISO ?? "").slice(0, 10);
        if (inicioDate && fimDate) {
          q = q.gte("data_emissao", inicioDate).lte("data_emissao", fimDate);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      setNotas((data ?? []) as any);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar notas: " + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotas(); }, [empresaAtiva, unidadeAtiva, range.inicioISO, range.fimISO, ignorarPeriodo]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!empresaAtiva) { toast.error("Selecione uma empresa primeiro"); return; }
    if (!unidadeAtiva && unidades.length > 1) { toast.error("Selecione uma loja para importar"); return; }
    const targetUnidade = unidadeAtiva ?? unidades[0];
    if (!targetUnidade) { toast.error("Empresa sem lojas cadastradas"); return; }

    setUploading(true);
    let ok = 0, fail = 0, dup = 0;
    for (const file of Array.from(files)) {
      try {
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: maior que 5MB`); fail++; continue; }
        const xmlText = await file.text();

        const { data, error } = await supabase.functions.invoke("parse-nfe-xml", {
          body: {
            xml: xmlText,
            filename: file.name,
            empresa_id: empresaAtiva.empresa_id,
            unidade_id: targetUnidade.id,
          },
        });
        if (error) throw error;
        if (data?.duplicate) dup++; else ok++;
      } catch (e: any) {
        console.error(`upload ${file.name}:`, e);
        fail++;
      }
    }
    setUploading(false);
    if (ok) toast.success(`${ok} XML(s) importado(s)`);
    if (dup) toast.info(`${dup} já existia(m)`);
    if (fail) toast.error(`${fail} falha(s) na importação`);
    fetchNotas();
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadXml = async (n: NotaRow) => {
    if (!n.xml_url) { toast.error("XML não disponível"); return; }
    try {
      const { data, error } = await supabase.storage.from("contabil-xmls").createSignedUrl(n.xml_url, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      window.open(n.xml_url, "_blank");
    }
  };

  const toggleSel = (id: string) =>
    setSelecionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleSelAll = (ids: string[]) => {
    const todosMarcados = ids.length > 0 && ids.every((id) => selecionados.includes(id));
    setSelecionados((prev) => todosMarcados ? prev.filter((x) => !ids.includes(x)) : Array.from(new Set([...prev, ...ids])));
  };

  const baixarSelecionadosZip = async () => {
    const alvos = (filterTipo || search ? filtered : notas).filter((n) => selecionados.includes(n.id) && n.xml_url);
    if (alvos.length === 0) { toast.error("Nenhum XML selecionado com arquivo disponível"); return; }
    setBaixandoLote(true);
    const zip = new JSZip();
    let ok = 0, fail = 0;
    for (const n of alvos) {
      try {
        const { data, error } = await supabase.storage.from("contabil-xmls").createSignedUrl(n.xml_url!, 120);
        if (error) throw error;
        const resp = await fetch(data.signedUrl);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const blob = await resp.blob();
        const dia = (n.data_emissao ?? n.created_at?.slice(0, 10) ?? "sem-data").slice(0, 10);
        const tipo = (n.tipo ?? "doc").toLowerCase();
        const nome = `${dia}/${tipo}_${n.numero ?? n.id.slice(0, 8)}.xml`;
        zip.file(nome, blob);
        ok++;
      } catch (e) {
        console.error("zip falha", n.id, e);
        fail++;
      }
    }
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      const stamp = format(new Date(), "yyyyMMdd-HHmm");
      a.href = url;
      a.download = `xmls_${empresaAtiva?.empresa_slug ?? "empresa"}_${stamp}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success(`Lote ZIP gerado · ${ok} arquivo(s)${fail ? ` · ${fail} falha(s)` : ""}`);
    } catch (e: any) {
      toast.error("Falha ao gerar ZIP: " + e.message);
    } finally {
      setBaixandoLote(false);
    }
  };

  const baixarSelecionadosIndividual = async () => {
    const alvos = filtered.filter((n) => selecionados.includes(n.id) && n.xml_url);
    if (alvos.length === 0) { toast.error("Nenhum XML selecionado com arquivo disponível"); return; }
    for (const n of alvos) {
      try {
        const { data } = await supabase.storage.from("contabil-xmls").createSignedUrl(n.xml_url!, 120);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      } catch { /* ignore */ }
    }
    toast.success(`${alvos.length} download(s) iniciado(s)`);
  };

  const counts = useMemo(() => notas.reduce((acc, n) => {
    const t = (n.tipo ?? "outro").toLowerCase();
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>), [notas]);

  const filtered = useMemo(() => notas.filter((n) => {
    if (filterTipo && (n.tipo ?? "").toLowerCase() !== filterTipo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (n.chave_acesso ?? "").toLowerCase().includes(q)
        || (n.numero ?? "").toLowerCase().includes(q)
        || (n.destinatario_nome ?? "").toLowerCase().includes(q)
        || (n.remetente_nome ?? "").toLowerCase().includes(q)
        || (n.destinatario_cpf_cnpj ?? "").toLowerCase().includes(q)
        || (n.remetente_cpf_cnpj ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [notas, filterTipo, search]);

  // Totais por tipo (no período)
  const totaisPorTipo = useMemo(() => {
    const map: Record<string, { count: number; valor: number }> = {};
    filtered.forEach((n) => {
      const t = (n.tipo ?? "outro").toLowerCase();
      if (!map[t]) map[t] = { count: 0, valor: 0 };
      map[t].count++;
      map[t].valor += Number(n.valor_total ?? 0);
    });
    return map;
  }, [filtered]);

  const totalGeral = useMemo(() => filtered.reduce((s, n) => s + Number(n.valor_total ?? 0), 0), [filtered]);

  // Agrupar por data de emissão (fallback para created_at)
  const grupos = useMemo(() => {
    const map = new Map<string, NotaRow[]>();
    filtered.forEach((n) => {
      const d = (n.data_emissao ?? n.created_at?.slice(0, 10) ?? "0000-00-00");
      const k = d.slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(n);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const TIPOS: { key: string; label: string }[] = [
    { key: "", label: "Todos" },
    { key: "nfe", label: "NF-e" },
    { key: "nfce", label: "NFC-e" },
    { key: "cte", label: "CT-e" },
    { key: "mdfe", label: "MDF-e" },
  ];

  const lojaNome = (uid: string | null) => unidades.find((u) => u.id === uid)?.nome ?? "—";

  const safeDateLabel = (k: string) => {
    try { return format(parseISO(k), "dd/MM/yyyy"); } catch { return k; }
  };

  return (
    <ContadorPortalLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entrada de XMLs</h1>
            <p className="text-sm text-muted-foreground">XMLs de NF-e, NFC-e, CT-e e MDF-e — ordenados por data de emissão</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef} type="file" accept=".xml" multiple className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <BotaoExportar
              relatorio="xmls"
              titulo="Relatório de XMLs Fiscais"
              empresa={empresaAtiva?.empresa_nome ?? "—"}
              escopo={unidadeAtiva ? unidadeAtiva.nome : `Todas as lojas — ${unidades.length} unidades`}
              periodoLabel={range.label}
              colunas={[
                { header: "Emissão", key: "data_emissao", format: (v) => fmt.date(v) },
                { header: "Tipo", key: "tipo" },
                { header: "Número", key: "numero" },
                { header: "Série", key: "serie" },
                { header: "Chave", key: "chave_acesso" },
                { header: "CNPJ Emit.", key: "remetente_cpf_cnpj", format: (v) => fmtCNPJ(v) },
                { header: "Emitente", key: "remetente_nome" },
                { header: "CNPJ Dest.", key: "destinatario_cpf_cnpj", format: (v) => fmtCNPJ(v) },
                { header: "Destinatário", key: "destinatario_nome" },
                { header: "Loja", key: "_loja_nome" },
                { header: "Valor", key: "valor_total", align: "right", format: (v) => fmt.brl(Number(v ?? 0)) },
              ]}
              linhas={filtered.map((n) => ({
                ...n,
                _loja_nome: lojaNome(n.unidade_id),
                _dia: n.data_emissao ?? n.created_at?.slice(0, 10),
              }))}
              totais={[
                { label: "Total notas", value: String(filtered.length) },
                { label: "Valor total", value: fmt.brl(totalGeral) },
              ]}
              groupByPDF="_dia"
            />
            {empresaAtiva && (
              <ImportacaoInteligente
                empresa_id={empresaAtiva.empresa_id}
                unidade_id_padrao={unidadeAtiva?.id}
                destino="xml"
                onConcluido={fetchNotas}
                label="IA: ZIP/XML"
              />
            )}
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !empresaAtiva}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar XML
            </Button>
            <Button
              variant="outline"
              disabled={selecionados.length === 0 || baixandoLote}
              onClick={baixarSelecionadosIndividual}
              className="border-border text-foreground hover:bg-muted"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Selecionados ({selecionados.length})
            </Button>
            <Button
              disabled={selecionados.length === 0 || baixandoLote}
              onClick={baixarSelecionadosZip}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {baixandoLote ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
              Gerar Lote ZIP
            </Button>
          </div>
        </div>

        {/* Aviso: dados gravados vs filtro de período */}
        {empresaAtiva && totalNoBanco > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-md bg-card border border-border">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{totalNoBanco}</span> XML(s) gravado(s) no banco ·{" "}
              <span className="font-semibold text-primary">{notas.length}</span>{" "}
              {ignorarPeriodo ? "exibido(s) (todos os períodos)" : `no período ${range.label}`}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIgnorarPeriodo((v) => !v)}
              className="border-border text-foreground hover:bg-muted"
            >
              {ignorarPeriodo ? "Aplicar filtro de período" : "Mostrar todos os períodos"}
            </Button>
          </div>
        )}

        {/* Resumo por tipo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {[
            { key: "nfe", label: "NF-e" },
            { key: "nfce", label: "NFC-e" },
            { key: "cte", label: "CT-e" },
            { key: "mdfe", label: "MDF-e" },
            { key: "_total", label: "Total" },
          ].map((t) => {
            const v = t.key === "_total"
              ? { count: filtered.length, valor: totalGeral }
              : (totaisPorTipo[t.key] ?? { count: 0, valor: 0 });
            return (
              <Card key={t.key} className="bg-card border-border">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground uppercase">{t.label}</div>
                  <div className="text-lg font-semibold text-foreground">{v.count}</div>
                  <div className="text-xs text-primary">{brl(v.valor)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por chave, número, CNPJ ou nome…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-muted border-border text-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => {
                const n = t.key === "" ? notas.length : (counts[t.key] ?? 0);
                const active = filterTipo === t.key;
                return (
                  <button
                    key={t.key || "all"}
                    onClick={() => setFilterTipo(t.key)}
                    className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                      active
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-muted border-border text-foreground/80 hover:bg-muted/70"
                    }`}
                  >
                    {t.label} <span className="ml-1 opacity-70">({n})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-6">
                <FileCode className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-4">
                  {totalNoBanco > 0 && !ignorarPeriodo
                    ? `Nenhum XML no período ${range.label}. Existem ${totalNoBanco} no banco em outros períodos.`
                    : "Nenhum XML encontrado para os filtros selecionados."}
                </p>
                {totalNoBanco > 0 && !ignorarPeriodo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIgnorarPeriodo(true)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Ver todos os períodos
                  </Button>
                )}
              </div>
            ) : (
              <TooltipProvider delayDuration={200}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground text-xs uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-3 w-10">
                          <Checkbox
                            checked={filtered.length > 0 && filtered.every((n) => selecionados.includes(n.id))}
                            onCheckedChange={() => toggleSelAll(filtered.map((n) => n.id))}
                          />
                        </th>
                        <th className="px-3 py-3 text-left">Tipo</th>
                        <th className="px-3 py-3 text-left">Nº / Série</th>
                        <th className="px-3 py-3 text-left">Chave</th>
                        <th className="px-3 py-3 text-left">CNPJ Emit.</th>
                        <th className="px-3 py-3 text-left">Emitente</th>
                        <th className="px-3 py-3 text-left">CNPJ Dest.</th>
                        <th className="px-3 py-3 text-left">Destinatário</th>
                        <th className="px-3 py-3 text-left">Loja</th>
                        <th className="px-3 py-3 text-left">Status</th>
                        <th className="px-3 py-3 text-right">Valor</th>
                        <th className="px-3 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupos.map(([dia, rows]) => {
                        const somaDia = rows.reduce((s, n) => s + Number(n.valor_total ?? 0), 0);
                        return (
                          <>
                            <tr key={`g-${dia}`} className="bg-muted/60">
                              <td colSpan={12} className="px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={rows.length > 0 && rows.every((r) => selecionados.includes(r.id))}
                                      onCheckedChange={() => toggleSelAll(rows.map((r) => r.id))}
                                    />
                                    <div className="font-semibold text-primary">
                                      ▸ {safeDateLabel(dia)}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {rows.length} nota{rows.length > 1 ? "s" : ""} · <span className="text-foreground font-medium">{brl(somaDia)}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            {rows.map((n) => {
                              const chave = n.chave_acesso ?? "";
                              const chaveCurta = chave ? `${chave.slice(0, 6)}…${chave.slice(-6)}` : "—";
                              return (
                                <tr key={n.id} className="border-t border-border hover:bg-muted/40">
                                  <td className="px-3 py-2"><Checkbox checked={selecionados.includes(n.id)} onCheckedChange={() => toggleSel(n.id)} /></td>
                                  <td className="px-3 py-2"><Badge variant="outline" className="uppercase">{n.tipo ?? "—"}</Badge></td>
                                  <td className="px-3 py-2 text-foreground whitespace-nowrap">
                                    {n.numero ?? "—"} <span className="text-muted-foreground">/ {n.serie ?? "—"}</span>
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                                    {chave ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help">{chaveCurta}</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="font-mono text-xs max-w-[420px] break-all">
                                          {chave}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-foreground/80 whitespace-nowrap">{fmtCNPJ(n.remetente_cpf_cnpj)}</td>
                                  <td className="px-3 py-2 text-foreground/90 max-w-[180px] truncate" title={n.remetente_nome ?? ""}>
                                    {n.remetente_nome ?? "—"}
                                  </td>
                                  <td className="px-3 py-2 text-foreground/80 whitespace-nowrap">{fmtCNPJ(n.destinatario_cpf_cnpj)}</td>
                                  <td className="px-3 py-2 text-foreground/90 max-w-[180px] truncate" title={n.destinatario_nome ?? ""}>
                                    {n.destinatario_nome ?? "—"}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{lojaNome(n.unidade_id)}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className="text-xs">
                                      {n.status ?? "importado"}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 text-right text-foreground font-medium whitespace-nowrap">
                                    {n.valor_total != null ? brl(Number(n.valor_total)) : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => downloadXml(n)} title="Baixar XML">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>
    </ContadorPortalLayout>
  );
}
