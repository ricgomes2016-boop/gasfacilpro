import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UNIDADES_PUBLIC_COLUMNS } from "@/lib/db/sensitiveColumns";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogDescription as DialogDescription,
} from "@/components/ui/responsive-dialog";
import { toast } from "sonner";
import {
  ExternalLink,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  FileCheck2,
  AlertTriangle,
  Loader2,
  Building2,
  Landmark,
  Briefcase,
  Building,
  ScrollText,
  FileText,
} from "lucide-react";
import { SINTEGRA_URLS, CND_URLS, CND_ESTADUAL_URLS } from "@/lib/certidoes/urls";
import { statusBadge, diasAteVencimento } from "@/lib/certidoes/status";

type TipoCertidao = "anp" | "cnd_federal" | "cnd_estadual" | "cnd_municipal" | "cndt" | "sintegra";

const TIPOS: Array<{
  tipo: TipoCertidao;
  nome: string;
  descricao: string;
  icon: any;
  automatica: boolean;
  validade_dias: number;
}> = [
  { tipo: "anp", nome: "ANP - Revenda GLP", descricao: "Autorização da ANP — abrir portal e fazer upload", icon: ScrollText, automatica: false, validade_dias: 365 },
  { tipo: "cnd_federal", nome: "CND Federal", descricao: "Receita Federal / PGFN — emitir e fazer upload", icon: Landmark, automatica: false, validade_dias: 180 },
  { tipo: "cnd_estadual", nome: "CND Estadual", descricao: "SEFAZ do estado da unidade", icon: Building, automatica: false, validade_dias: 90 },
  { tipo: "cnd_municipal", nome: "CND Municipal", descricao: "Prefeitura do município da unidade", icon: Building2, automatica: false, validade_dias: 90 },
  { tipo: "cndt", nome: "CNDT - Trabalhista", descricao: "Tribunal Superior do Trabalho", icon: Briefcase, automatica: false, validade_dias: 180 },
  { tipo: "sintegra", nome: "Sintegra", descricao: "Cadastro de Contribuintes do ICMS", icon: FileCheck2, automatica: false, validade_dias: 90 },
];


export function CertidoesEmpresaTab() {
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();

  const [uploadFor, setUploadFor] = useState<TipoCertidao | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNumero, setUploadNumero] = useState("");
  const [uploadEmissao, setUploadEmissao] = useState("");
  const [uploadVencimento, setUploadVencimento] = useState("");
  const [uploading, setUploading] = useState(false);
  const [consultandoTipo, setConsultandoTipo] = useState<TipoCertidao | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Buscar unidade completa para ter cnpj/estado
  const { data: unidadeFull } = useQuery({
    queryKey: ["unidade-full", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return null;
      const { data } = await supabase.from("unidades").select("*").eq("id", unidadeAtual.id).single();
      return data;
    },
    enabled: !!unidadeAtual?.id,
  });

  const { data: certidoes = [], isLoading } = useQuery({
    queryKey: ["certidoes_empresa", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data, error } = await supabase
        .from("certidoes_empresa")
        .select("*")
        .eq("unidade_id", unidadeAtual.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!unidadeAtual?.id,
  });

  const certByTipo = useMemo(() => {
    const m: Record<string, any> = {};
    for (const c of certidoes as any[]) m[c.tipo] = c;
    return m;
  }, [certidoes]);

  const consultarANP = async () => {
    if (!unidadeFull?.cnpj || !empresa?.id) {
      toast.error("Cadastre o CNPJ desta unidade antes de consultar");
      return;
    }
    setConsultandoTipo("anp");
    try {
      const { data, error } = await supabase.functions.invoke("consultar-anp", {
        body: { cnpj: unidadeFull.cnpj, unidade_id: unidadeFull.id, empresa_id: empresa.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Consulta ANP realizada");
      } else {
        toast.warning(data?.error || "ANP retornou sem dados");
      }
      queryClient.invalidateQueries({ queryKey: ["certidoes_empresa"] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao consultar ANP");
    } finally {
      setConsultandoTipo(null);
    }
  };

  const abrirPortalOficial = (tipo: TipoCertidao) => {
    const cnpj = unidadeFull?.cnpj?.replace(/\D/g, "");
    let url: string | null = null;
    if (tipo === "anp") url = CND_URLS.anp.url;
    else if (tipo === "cnd_federal") url = CND_URLS.cnd_federal.url;
    else if (tipo === "cndt") url = CND_URLS.cndt.url;
    else if (tipo === "cnd_estadual") url = unidadeFull?.estado ? CND_ESTADUAL_URLS[unidadeFull.estado] : null;
    else if (tipo === "sintegra") url = unidadeFull?.estado ? SINTEGRA_URLS[unidadeFull.estado]?.url : null;
    else if (tipo === "cnd_municipal") {
      const cidade = unidadeFull?.cidade || "";
      url = `https://www.google.com/search?q=${encodeURIComponent(`emitir CND municipal ${cidade} ${cnpj || ""}`)}`;
    }
    if (!url) {
      toast.error("URL não disponível. Verifique estado/cidade da unidade.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const abrirUpload = (tipo: TipoCertidao) => {
    setUploadFor(tipo);
    const cert = certByTipo[tipo];
    setUploadNumero(cert?.numero || "");
    setUploadEmissao(cert?.data_emissao || "");
    setUploadVencimento(cert?.data_vencimento || "");
    setUploadFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!uploadFor || !empresa?.id || !unidadeFull?.id || !user) return;
    setUploading(true);
    try {
      let arquivo_url: string | null = null;
      let arquivo_nome: string | null = null;
      if (uploadFile) {
        const ext = uploadFile.name.split(".").pop();
        const path = `${empresa.id}/${unidadeFull.id}/${uploadFor}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("certidoes-empresa").upload(path, uploadFile);
        if (upErr) throw upErr;
        arquivo_url = path;
        arquivo_nome = uploadFile.name;
      }

      const status =
        uploadVencimento && new Date(uploadVencimento) < new Date() ? "vencida" : "regular";

      const { error } = await supabase.from("certidoes_empresa").upsert(
        {
          empresa_id: empresa.id,
          unidade_id: unidadeFull.id,
          tipo: uploadFor,
          numero: uploadNumero || null,
          data_emissao: uploadEmissao || null,
          data_vencimento: uploadVencimento || null,
          status,
          origem: "manual",
          arquivo_url,
          arquivo_nome,
          ultima_consulta_at: new Date().toISOString(),
          created_by: user.id,
        },
        { onConflict: "unidade_id,tipo" },
      );
      if (error) throw error;

      toast.success("Certidão salva");
      setUploadFor(null);
      queryClient.invalidateQueries({ queryKey: ["certidoes_empresa"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setUploading(false);
    }
  };

  const baixar = async (cert: any) => {
    if (!cert.arquivo_url) return;
    const { data, error } = await supabase.storage
      .from("certidoes-empresa")
      .createSignedUrl(cert.arquivo_url, 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar link");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = cert.arquivo_nome || `${cert.tipo}.pdf`;
    a.click();
  };

  const remover = async (cert: any) => {
    if (!confirm("Remover esta certidão?")) return;
    if (cert.arquivo_url) {
      await supabase.storage.from("certidoes-empresa").remove([cert.arquivo_url]);
    }
    await supabase.from("certidoes_empresa").delete().eq("id", cert.id);
    queryClient.invalidateQueries({ queryKey: ["certidoes_empresa"] });
    toast.success("Removida");
  };

  if (!unidadeAtual) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Selecione uma unidade no seletor acima para gerenciar as certidões.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
        <div>
          <strong>Como funciona:</strong> Cada certidão tem um botão "Abrir portal" que leva ao site oficial
          (ANP, Receita, SEFAZ, TST, Sintegra). Após emitir o PDF, faça upload aqui — o sistema controla
          os vencimentos e avisa 30 dias antes. Os PDFs enviados aqui aparecem automaticamente na aba <strong>Documentos</strong>.
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {TIPOS.map((t) => {
            const cert = certByTipo[t.tipo];
            const Icon = t.icon;
            return (
              <Card key={t.tipo} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{t.nome}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{t.descricao}</p>
                      </div>
                    </div>
                    {statusBadge(cert)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {cert && (
                    <div className="text-xs space-y-1 text-muted-foreground">
                      {cert.numero && <div>Nº: <span className="text-foreground font-mono">{cert.numero}</span></div>}
                      {cert.data_emissao && <div>Emissão: {new Date(cert.data_emissao).toLocaleDateString("pt-BR")}</div>}
                      {cert.data_vencimento && <div>Vencimento: <span className="text-foreground font-medium">{new Date(cert.data_vencimento).toLocaleDateString("pt-BR")}</span></div>}
                      {cert.ultimo_erro && <div className="text-destructive">⚠ {cert.ultimo_erro}</div>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {t.automatica ? (
                      <Button
                        size="sm"
                        onClick={consultarANP}
                        disabled={consultandoTipo === t.tipo}
                      >
                        {consultandoTipo === t.tipo ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Consultar ANP
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => abrirPortalOficial(t.tipo)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Abrir portal
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => abrirUpload(t.tipo)}>
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      {cert?.arquivo_url ? "Atualizar" : "Upload PDF"}
                    </Button>
                    {cert?.arquivo_url && (
                      <Button size="sm" variant="ghost" onClick={() => baixar(cert)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {cert && (
                      <Button size="sm" variant="ghost" onClick={() => remover(cert)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!uploadFor} onOpenChange={(o) => !o && setUploadFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TIPOS.find((t) => t.tipo === uploadFor)?.nome}</DialogTitle>
            <DialogDescription>Preencha os dados e anexe o PDF da certidão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Número da certidão</Label>
              <Input value={uploadNumero} onChange={(e) => setUploadNumero(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de emissão</Label>
                <Input type="date" value={uploadEmissao} onChange={(e) => setUploadEmissao(e.target.value)} />
              </div>
              <div>
                <Label>Data de vencimento</Label>
                <Input type="date" value={uploadVencimento} onChange={(e) => setUploadVencimento(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Arquivo PDF</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadFor(null)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
