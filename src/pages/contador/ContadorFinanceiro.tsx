import { useState, useEffect, useRef } from "react";
import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, FileText, Banknote } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { BotaoExportar } from "@/components/contador/BotaoExportar";
import { ImportacaoInteligente } from "@/components/contador/ImportacaoInteligente";
import { fmt } from "@/services/contadorExportService";

interface ExtratoRow {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: string | null;
  conciliado: boolean | null;
  unidade_id: string | null;
  created_at: string;
}

function parseOFX(text: string) {
  // Parser simples que extrai STMTTRN
  const txns: Array<{ date: string; amount: number; type: string; memo: string; fitid: string }> = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m: RegExpExecArray | null;
  const get = (block: string, tag: string) => {
    const r = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
    const x = block.match(r);
    return x ? x[1].trim() : "";
  };
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const dt = get(block, "DTPOSTED").slice(0, 8);
    const date = dt.length === 8 ? `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}` : new Date().toISOString().slice(0,10);
    const amount = parseFloat(get(block, "TRNAMT") || "0");
    const type = get(block, "TRNTYPE");
    const memo = get(block, "MEMO") || get(block, "NAME");
    const fitid = get(block, "FITID");
    txns.push({ date, amount, type, memo, fitid });
  }
  return txns;
}

export default function ContadorFinanceiro() {
  const { empresaAtiva, unidadeAtiva, unidades } = useContador();
  const { range } = usePeriodo();
  const [extratos, setExtratos] = useState<ExtratoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const ofxRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const fetchExtratos = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    try {
      const unidadeIds = unidadeAtiva ? [unidadeAtiva.id] : unidades.map((u) => u.id);
      if (unidadeIds.length === 0) { setExtratos([]); return; }
      const { data, error } = await supabase.from("extrato_bancario" as any)
        .select("*")
        .in("unidade_id", unidadeIds)
        .gte("data", range.inicioISO)
        .lte("data", range.fimISO)
        .order("data", { ascending: false })
        .limit(500);
      if (error) throw error;
      setExtratos((data ?? []) as any);
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchExtratos(); }, [empresaAtiva, unidadeAtiva, range.inicioISO, range.fimISO]);

  const handleOFX = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!empresaAtiva) { toast.error("Selecione uma empresa"); return; }
    const targetUnidade = unidadeAtiva ?? unidades[0];
    if (!targetUnidade) { toast.error("Empresa sem lojas"); return; }

    setUploading(true);
    let total = 0, dup = 0;
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const txns = parseOFX(text);
        if (txns.length === 0) { toast.error(`${file.name}: nenhuma transação encontrada`); continue; }

        // Upload arquivo original
        const path = `${empresaAtiva.empresa_id}/${targetUnidade.id}/ofx-${Date.now()}-${file.name}`;
        await supabase.storage.from("contabil-extratos").upload(path, file, { contentType: "application/x-ofx" });

        for (const t of txns) {
          // Anti-duplicidade: data+valor+memo (limit 80) por unidade
          const memo = (t.memo ?? "").slice(0, 200);
          const { data: exists } = await supabase.from("extrato_bancario" as any)
            .select("id")
            .eq("unidade_id", targetUnidade.id)
            .eq("data", t.date)
            .eq("valor", t.amount)
            .ilike("descricao", memo.slice(0, 80) + "%")
            .limit(1);
          if (exists && exists.length > 0) { dup++; continue; }

          const { error } = await (supabase.from("extrato_bancario" as any) as any).insert({
            data: t.date,
            descricao: memo || t.fitid || "OFX",
            valor: t.amount,
            tipo: t.amount >= 0 ? "credito" : "debito",
            unidade_id: targetUnidade.id,
            conciliado: false,
          });
          if (!error) total++;
        }
      } catch (e: any) { console.error(e); toast.error(`${file.name}: ${e.message}`); }
    }
    setUploading(false);
    toast.success(`${total} transação(ões) importada(s)${dup ? `, ${dup} duplicada(s) ignorada(s)` : ""}`);
    fetchExtratos();
    if (ofxRef.current) ofxRef.current.value = "";
  };

  const handlePDF = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!empresaAtiva) { toast.error("Selecione uma empresa"); return; }
    const targetUnidade = unidadeAtiva ?? unidades[0];
    if (!targetUnidade) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        if (file.size > 15 * 1024 * 1024) { toast.error("PDF maior que 15MB"); continue; }
        const buf = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

        // Upload original
        const path = `${empresaAtiva.empresa_id}/${targetUnidade.id}/pdf-${Date.now()}-${file.name}`;
        await supabase.storage.from("contabil-extratos").upload(path, file, { contentType: "application/pdf" });

        const { data, error } = await supabase.functions.invoke("parse-extrato-pdf", {
          body: { pdf_base64: b64, filename: file.name },
        });
        if (error) throw error;

        const txns = (data?.transacoes ?? []) as Array<{ data: string; descricao: string; valor: number }>;
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
      } catch (e: any) { toast.error(`${file.name}: ${e.message}`); }
    }
    setUploading(false);
    fetchExtratos();
    if (pdfRef.current) pdfRef.current.value = "";
  };

  return (
    <ContadorPortalLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(0,0%,95%)]">Financeiro</h1>
            <p className="text-sm text-[hsl(220,10%,60%)]">Importação de OFX e PDF de extratos bancários</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {empresaAtiva && (
              <ImportacaoInteligente
                empresa_id={empresaAtiva.empresa_id}
                unidade_id_padrao={unidadeAtiva?.id}
                destino="financeiro"
                onConcluido={fetchExtratos}
                label="IA: OFX/CSV/PDF"
              />
            )}
            <BotaoExportar
              relatorio="extratos"
              titulo="Relatório de Extratos Bancários"
              empresa={empresaAtiva?.empresa_nome ?? "—"}
              escopo={unidadeAtiva ? unidadeAtiva.nome : `Todas as lojas — ${unidades.length} unidades`}
              periodoLabel={range.label}
              colunas={[
                { header: "Data", key: "data", format: (v) => fmt.date(v) },
                { header: "Descrição", key: "descricao" },
                { header: "Tipo", key: "tipo" },
                { header: "Valor", key: "valor", align: "right", format: (v) => fmt.brl(Number(v ?? 0)) },
                { header: "Conciliado", key: "conciliado", format: (v) => (v ? "Sim" : "Não") },
                { header: "Loja", key: "_loja_nome" },
              ]}
              linhas={extratos.map((e) => ({
                ...e,
                _loja_nome: unidades.find((u) => u.id === e.unidade_id)?.nome ?? "—",
              }))}
              totais={[
                {
                  label: "Entradas",
                  value: fmt.brl(extratos.filter((e) => Number(e.valor) >= 0).reduce((s, e) => s + Number(e.valor ?? 0), 0)),
                },
                {
                  label: "Saídas",
                  value: fmt.brl(extratos.filter((e) => Number(e.valor) < 0).reduce((s, e) => s + Number(e.valor ?? 0), 0)),
                },
                {
                  label: "Saldo do período",
                  value: fmt.brl(extratos.reduce((s, e) => s + Number(e.valor ?? 0), 0)),
                },
              ]}
              groupByPDF={!unidadeAtiva ? "_loja_nome" : undefined}
            />
          </div>

        <Tabs defaultValue="importar" className="w-full">
          <TabsList className="bg-[hsl(220,18%,13%)] border border-[hsl(220,15%,20%)]">
            <TabsTrigger value="importar">Importar</TabsTrigger>
            <TabsTrigger value="extratos">Extratos</TabsTrigger>
          </TabsList>

          <TabsContent value="importar" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
                <CardContent className="p-6">
                  <Banknote className="h-8 w-8 text-[hsl(165,60%,55%)] mb-3" />
                  <h3 className="font-semibold text-[hsl(0,0%,95%)] mb-1">Importar OFX</h3>
                  <p className="text-sm text-[hsl(220,10%,60%)] mb-4">Arquivo OFX exportado do internet banking</p>
                  <input ref={ofxRef} type="file" accept=".ofx,.OFX" multiple className="hidden"
                    onChange={(e) => handleOFX(e.target.files)} />
                  <Button onClick={() => ofxRef.current?.click()} disabled={uploading || !empresaAtiva}
                    className="bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white">
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Selecionar OFX
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
                <CardContent className="p-6">
                  <FileText className="h-8 w-8 text-[hsl(280,60%,65%)] mb-3" />
                  <h3 className="font-semibold text-[hsl(0,0%,95%)] mb-1">Importar PDF</h3>
                  <p className="text-sm text-[hsl(220,10%,60%)] mb-4">PDF do extrato — extração via IA</p>
                  <input ref={pdfRef} type="file" accept="application/pdf" className="hidden"
                    onChange={(e) => handlePDF(e.target.files)} />
                  <Button onClick={() => pdfRef.current?.click()} disabled={uploading || !empresaAtiva}
                    className="bg-[hsl(280,60%,55%)] hover:bg-[hsl(280,60%,60%)] text-white">
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Selecionar PDF
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="extratos" className="mt-4">
            <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[hsl(165,60%,55%)]" /></div>
                ) : extratos.length === 0 ? (
                  <div className="text-center py-12">
                    <Banknote className="h-12 w-12 mx-auto mb-3 text-[hsl(220,10%,30%)]" />
                    <p className="text-sm text-[hsl(220,10%,55%)]">Nenhum extrato importado ainda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[hsl(220,18%,13%)] text-[hsl(220,10%,60%)] text-xs uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Data</th>
                          <th className="px-4 py-3 text-left">Descrição</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                          <th className="px-4 py-3 text-left">Conciliado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[hsl(220,15%,18%)]">
                        {extratos.map((e) => (
                          <tr key={e.id} className="hover:bg-[hsl(220,18%,13%)]">
                            <td className="px-4 py-3 text-[hsl(220,10%,75%)]">{format(new Date(e.data), "dd/MM/yyyy")}</td>
                            <td className="px-4 py-3 text-[hsl(0,0%,90%)] max-w-md truncate">{e.descricao}</td>
                            <td className={`px-4 py-3 text-right font-medium ${e.valor >= 0 ? "text-green-400" : "text-red-400"}`}>
                              R$ {Math.abs(Number(e.valor)).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              {e.conciliado
                                ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30" variant="outline">Sim</Badge>
                                : <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" variant="outline">Não</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ContadorPortalLayout>
  );
}
