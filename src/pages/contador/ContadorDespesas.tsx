import { useState, useEffect, useRef } from "react";
import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Loader2, Receipt, Search, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { BotaoExportar } from "@/components/contador/BotaoExportar";
import { ImportacaoInteligente } from "@/components/contador/ImportacaoInteligente";
import { fmt } from "@/services/contadorExportService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DespesaRow {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  descricao: string;
  fornecedor: string | null;
  cnpj_fornecedor: string | null;
  data_despesa: string;
  valor: number;
  categoria: string | null;
  forma_pagamento: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_mime: string | null;
  status: string;
  created_at: string;
}

export default function ContadorDespesas() {
  const { empresaAtiva, unidadeAtiva, unidades } = useContador();
  const { range } = usePeriodo();
  const { user } = useAuth();
  const [despesas, setDespesas] = useState<DespesaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const fetchDespesas = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    try {
      let q: any = supabase.from("despesas_contabeis" as any)
        .select("*")
        .eq("empresa_id", empresaAtiva.empresa_id)
        .gte("data_despesa", range.inicioISO)
        .lte("data_despesa", range.fimISO)
        .order("data_despesa", { ascending: false })
        .limit(500);
      if (unidadeAtiva) q = q.eq("unidade_id", unidadeAtiva.id);
      const { data, error } = await q;
      if (error) throw error;
      setDespesas((data ?? []) as any);
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDespesas(); }, [empresaAtiva, unidadeAtiva, range.inicioISO, range.fimISO]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!empresaAtiva) { toast.error("Selecione uma empresa"); return; }
    const targetUnidade = unidadeAtiva ?? unidades[0];
    if (!targetUnidade) { toast.error("Empresa sem lojas"); return; }

    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}: maior que 10MB`); continue; }

        // Upload arquivo
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${empresaAtiva.empresa_id}/${targetUnidade.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("contabil-despesas").upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;

        // OCR via edge function (assíncrono — não bloqueia listagem)
        let ocrData: any = null;
        try {
          // Converte para base64 para envio
          const buf = await file.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          const { data: ocrResp } = await supabase.functions.invoke("ocr-despesa", {
            body: { image_base64: b64, mime_type: file.type, filename: file.name },
          });
          ocrData = ocrResp;
        } catch (ocrErr) {
          console.warn("OCR falhou (não fatal):", ocrErr);
        }

        const valorNum = ocrData?.valor ? Number(String(ocrData.valor).replace(/[^\d,.-]/g, "").replace(",", ".")) : 0;

        const { error: insErr } = await (supabase.from("despesas_contabeis" as any) as any).insert({
          empresa_id: empresaAtiva.empresa_id,
          unidade_id: targetUnidade.id,
          descricao: ocrData?.descricao ?? file.name,
          fornecedor: ocrData?.fornecedor ?? null,
          cnpj_fornecedor: ocrData?.cnpj ?? null,
          data_despesa: ocrData?.data ?? new Date().toISOString().slice(0, 10),
          valor: isFinite(valorNum) ? valorNum : 0,
          categoria: ocrData?.categoria ?? null,
          forma_pagamento: ocrData?.forma_pagamento ?? null,
          arquivo_url: path,
          arquivo_nome: file.name,
          arquivo_mime: file.type,
          ocr_metadata: ocrData ?? null,
          uploaded_by: user?.id ?? null,
          status: ocrData?.fornecedor ? "classificada" : "pendente",
        });
        if (insErr) throw insErr;
      } catch (e: any) {
        console.error("upload despesa:", e);
        toast.error(`Erro: ${e.message}`);
      }
    }
    setUploading(false);
    toast.success("Despesas processadas!");
    fetchDespesas();
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const marcarBaixada = async (id: string) => {
    const { error } = await (supabase.from("despesas_contabeis" as any) as any)
      .update({ status: "baixada", contador_baixou_em: new Date().toISOString(), contador_user_id: user?.id })
      .eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Despesa baixada"); fetchDespesas(); }
  };

  const downloadArquivo = async (d: DespesaRow) => {
    if (!d.arquivo_url) return;
    const { data, error } = await supabase.storage.from("contabil-despesas").createSignedUrl(d.arquivo_url, 120);
    if (error) toast.error("Erro: " + error.message);
    else window.open(data.signedUrl, "_blank");
  };

  const filtered = despesas.filter((d) => {
    if (filterStatus && d.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (d.descricao ?? "").toLowerCase().includes(q)
        || (d.fornecedor ?? "").toLowerCase().includes(q)
        || (d.cnpj_fornecedor ?? "").includes(q);
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    pendente: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    classificada: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    baixada: "bg-green-500/15 text-green-400 border-green-500/30",
    rejeitada: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <ContadorPortalLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(0,0%,95%)]">Despesas Escaneadas</h1>
            <p className="text-sm text-[hsl(220,10%,60%)]">Comprovantes, recibos e notas com OCR automático</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => handleUpload(e.target.files)} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={(e) => handleUpload(e.target.files)} />
            <BotaoExportar
              relatorio="despesas"
              titulo="Relatório de Despesas"
              empresa={empresaAtiva?.empresa_nome ?? "—"}
              escopo={unidadeAtiva ? unidadeAtiva.nome : `Todas as lojas — ${unidades.length} unidades`}
              periodoLabel={range.label}
              colunas={[
                { header: "Data", key: "data_despesa", format: (v) => fmt.date(v) },
                { header: "Fornecedor", key: "fornecedor" },
                { header: "CNPJ", key: "cnpj_fornecedor" },
                { header: "Descrição", key: "descricao" },
                { header: "Categoria", key: "categoria" },
                { header: "Valor", key: "valor", align: "right", format: (v) => fmt.brl(Number(v ?? 0)) },
                { header: "Status", key: "status" },
                { header: "Loja", key: "_loja_nome" },
              ]}
              linhas={filtered.map((d) => ({
                ...d,
                _loja_nome: unidades.find((u) => u.id === d.unidade_id)?.nome ?? "—",
              }))}
              totais={[
                { label: "Total despesas", value: fmt.brl(filtered.reduce((s, d) => s + Number(d.valor ?? 0), 0)) },
                { label: "Quantidade", value: String(filtered.length) },
              ]}
              groupByPDF={!unidadeAtiva ? "_loja_nome" : undefined}
            />
            {empresaAtiva && (
              <ImportacaoInteligente
                empresa_id={empresaAtiva.empresa_id}
                unidade_id_padrao={unidadeAtiva?.id}
                destino="despesa"
                onConcluido={fetchDespesas}
                label="IA: PDF/ZIP"
              />
            )}
            <Button variant="outline" onClick={() => cameraRef.current?.click()} disabled={uploading || !empresaAtiva}
              className="border-[hsl(220,15%,22%)] text-[hsl(0,0%,90%)] hover:bg-[hsl(220,18%,15%)]">
              <Camera className="h-4 w-4 mr-2" /> Escanear
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={uploading || !empresaAtiva}
              className="bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white">
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Enviar arquivo
            </Button>
          </div>
        </div>

        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,50%)]" />
              <Input placeholder="Buscar fornecedor, descrição ou CNPJ…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[hsl(220,18%,15%)] border-[hsl(220,15%,22%)] text-white" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[hsl(220,18%,15%)] border border-[hsl(220,15%,22%)] text-white rounded-md px-3 py-2 text-sm">
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="classificada">Classificada</option>
              <option value="baixada">Baixada</option>
              <option value="rejeitada">Rejeitada</option>
            </select>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[hsl(165,60%,55%)]" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto mb-3 text-[hsl(220,10%,30%)]" />
                <p className="text-sm text-[hsl(220,10%,55%)]">Nenhuma despesa cadastrada ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[hsl(220,18%,13%)] text-[hsl(220,10%,60%)] text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Fornecedor</th>
                      <th className="px-4 py-3 text-left">Descrição</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(220,15%,18%)]">
                    {filtered.map((d) => (
                      <tr key={d.id} className="hover:bg-[hsl(220,18%,13%)]">
                        <td className="px-4 py-3 text-[hsl(220,10%,75%)]">{format(new Date(d.data_despesa), "dd/MM/yyyy")}</td>
                        <td className="px-4 py-3 text-[hsl(0,0%,90%)] max-w-xs truncate">{d.fornecedor ?? "—"}</td>
                        <td className="px-4 py-3 text-[hsl(220,10%,75%)] max-w-xs truncate">{d.descricao}</td>
                        <td className="px-4 py-3 text-right text-[hsl(0,0%,93%)] font-medium">R$ {Number(d.valor).toFixed(2)}</td>
                        <td className="px-4 py-3"><Badge className={statusColors[d.status] ?? ""} variant="outline">{d.status}</Badge></td>
                        <td className="px-4 py-3 text-right space-x-1">
                          {d.arquivo_url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(165,60%,55%)]" onClick={() => downloadArquivo(d)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {d.status !== "baixada" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400" onClick={() => marcarBaixada(d.id)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ContadorPortalLayout>
  );
}
