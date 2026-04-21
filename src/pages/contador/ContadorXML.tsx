import { useState, useEffect, useRef } from "react";
import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, FileCode, Loader2, Download, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { BotaoExportar } from "@/components/contador/BotaoExportar";
import { fmt } from "@/services/contadorExportService";

interface NotaRow {
  id: string;
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  tipo: string | null;
  valor_total: number | null;
  data_emissao: string | null;
  destinatario_nome: string | null;
  remetente_nome: string | null;
  xml_url: string | null;
  status: string | null;
  created_at: string;
  unidade_id: string | null;
}

export default function ContadorXML() {
  const { empresaAtiva, unidadeAtiva, unidades } = useContador();
  const { range } = usePeriodo();
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchNotas = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    try {
      const unidadeIds = unidadeAtiva ? [unidadeAtiva.id] : unidades.map((u) => u.id);
      if (unidadeIds.length === 0) { setNotas([]); return; }
      let q = supabase.from("notas_fiscais" as any)
        .select("*")
        .in("unidade_id", unidadeIds)
        .gte("created_at", range.inicioISOFull)
        .lte("created_at", range.fimISOFull)
        .order("data_emissao", { ascending: false })
        .limit(500);
      const { data, error } = await q;
      if (error) throw error;
      setNotas((data ?? []) as any);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar notas: " + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotas(); }, [empresaAtiva, unidadeAtiva, range.inicioISO, range.fimISO]);

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
      const path = n.xml_url.includes("/") ? n.xml_url : n.xml_url;
      const { data, error } = await supabase.storage.from("contabil-xmls").createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      // fallback se for URL pública
      window.open(n.xml_url, "_blank");
    }
  };

  const filtered = notas.filter((n) => {
    if (filterTipo && n.tipo !== filterTipo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (n.chave_acesso ?? "").toLowerCase().includes(q)
        || (n.numero ?? "").toLowerCase().includes(q)
        || (n.destinatario_nome ?? "").toLowerCase().includes(q)
        || (n.remetente_nome ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <ContadorPortalLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(0,0%,95%)]">Entrada de XMLs</h1>
            <p className="text-sm text-[hsl(220,10%,60%)]">Importe XMLs de NF-e, NFC-e e CT-e por loja</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef} type="file" accept=".xml" multiple className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !empresaAtiva}
              className="bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white"
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar XML
            </Button>
          </div>
        </div>

        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,50%)]" />
              <Input
                placeholder="Buscar por chave, número, fornecedor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[hsl(220,18%,15%)] border-[hsl(220,15%,22%)] text-white"
              />
            </div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="bg-[hsl(220,18%,15%)] border border-[hsl(220,15%,22%)] text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="">Todos os tipos</option>
              <option value="nfe">NF-e</option>
              <option value="nfce">NFC-e</option>
              <option value="cte">CT-e</option>
              <option value="mdfe">MDF-e</option>
            </select>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[hsl(165,60%,55%)]" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FileCode className="h-12 w-12 mx-auto mb-3 text-[hsl(220,10%,30%)]" />
                <p className="text-sm text-[hsl(220,10%,55%)]">Nenhum XML encontrado. Importe seus arquivos para começar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[hsl(220,18%,13%)] text-[hsl(220,10%,60%)] text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Número</th>
                      <th className="px-4 py-3 text-left">Emissão</th>
                      <th className="px-4 py-3 text-left">Fornecedor / Destinatário</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(220,15%,18%)]">
                    {filtered.map((n) => (
                      <tr key={n.id} className="hover:bg-[hsl(220,18%,13%)]">
                        <td className="px-4 py-3"><Badge variant="outline" className="uppercase">{n.tipo ?? "—"}</Badge></td>
                        <td className="px-4 py-3 text-[hsl(0,0%,90%)]">{n.numero ?? "—"}</td>
                        <td className="px-4 py-3 text-[hsl(220,10%,70%)]">
                          {n.data_emissao ? format(new Date(n.data_emissao), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3 text-[hsl(220,10%,75%)] max-w-xs truncate">
                          {n.remetente_nome || n.destinatario_nome || "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-[hsl(0,0%,93%)] font-medium">
                          {n.valor_total != null ? `R$ ${Number(n.valor_total).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(165,60%,55%)]" onClick={() => downloadXml(n)}>
                            <Download className="h-4 w-4" />
                          </Button>
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
