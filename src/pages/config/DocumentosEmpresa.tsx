import { useState, useRef, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle, ResponsiveDialogFooter as DialogFooter, ResponsiveDialogDescription as DialogDescription } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Download, Trash2, Search, FileText, File, Image, FileSpreadsheet, Loader2, ScrollText, Settings2, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CertidoesEmpresaTab } from "@/components/config/CertidoesEmpresaTab";
import { LicitacaoTab } from "@/components/config/LicitacaoTab";
import { statusBadge, diasAteVencimento, TIPO_CERTIDAO_LABEL } from "@/lib/certidoes/status";

const CATEGORIAS = [
  { value: "geral", label: "Geral" },
  { value: "contrato", label: "Contratos" },
  { value: "alvara", label: "Alvarás / Licenças" },
  { value: "fiscal", label: "Documentos Fiscais" },
  { value: "trabalhista", label: "Documentos Trabalhistas" },
  { value: "societario", label: "Societário" },
  { value: "seguro", label: "Seguros" },
  { value: "certificado", label: "Certificados" },
  { value: "certidao", label: "Certidões" },
  { value: "outro", label: "Outros" },
];

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext || "")) return <FileText className="h-5 w-5 text-destructive" />;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return <Image className="h-5 w-5 text-info" />;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return <FileSpreadsheet className="h-5 w-5 text-success" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStoragePath(value: string | null | undefined, bucket: string) {
  if (!value) return null;
  const urlParts = value.split(`/${bucket}/`);
  return urlParts[1] ? decodeURIComponent(urlParts[1]) : value;
}

export default function DocumentosEmpresa() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState("documentos");
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formCategoria, setFormCategoria] = useState("geral");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ["documentos_empresa", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("documentos_empresa")
        .select("*")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: certidoes = [] } = useQuery({
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

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      const storagePath = getStoragePath(doc.arquivo_url, "documentos-empresa");

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("documentos-empresa")
          .remove([storagePath]);
        if (storageError) console.error("Storage delete error:", storageError);
      }

      const { error } = await supabase.from("documentos_empresa").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos_empresa"] });
      toast.success("Documento removido");
    },
    onError: () => toast.error("Erro ao remover documento"),
  });

  const handleUpload = async () => {
    if (!selectedFile || !formNome.trim() || !user) return;
    if (!empresa?.id) {
      toast.error("Empresa não identificada para salvar o documento");
      return;
    }
    setUploading(true);

    try {
      const ext = selectedFile.name.split(".").pop();
      const storagePath = `${empresa.id}/documentos/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos-empresa")
        .upload(storagePath, selectedFile);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documentos_empresa").insert({
        nome: formNome.trim(),
        descricao: formDescricao.trim() || null,
        categoria: formCategoria,
        arquivo_url: storagePath,
        arquivo_nome: selectedFile.name,
        arquivo_tamanho: selectedFile.size,
        unidade_id: unidadeAtual?.id || null,
        uploaded_by: user.id,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["documentos_empresa"] });
      toast.success("Documento salvo com sucesso!");
      setUploadOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao enviar documento");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: any) => {
    if (doc.__origem === "certidao") {
      if (!doc.arquivo_url) { toast.error("Sem arquivo anexado"); return; }
      const { data, error } = await supabase.storage
        .from("certidoes-empresa")
        .createSignedUrl(doc.arquivo_url, 60);
      if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.arquivo_nome || `${doc.tipo}.pdf`;
      a.click();
      return;
    }

    const storagePath = getStoragePath(doc.arquivo_url, "documentos-empresa");
    if (!storagePath) { toast.error("Arquivo não encontrado"); return; }

    const { data, error } = await supabase.storage
      .from("documentos-empresa")
      .createSignedUrl(storagePath, 60);

    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link de download"); return; }

    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = doc.arquivo_nome;
    a.click();
  };

  const resetForm = () => {
    setFormNome("");
    setFormDescricao("");
    setFormCategoria("geral");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Normalize certidões to the same shape so they show in the unified list
  const certidoesAsDocs = useMemo(() => {
    return (certidoes as any[])
      .filter((c) => c.arquivo_url) // only those with PDF uploaded
      .map((c) => ({
        id: `cert-${c.id}`,
        nome: TIPO_CERTIDAO_LABEL[c.tipo] || c.tipo,
        descricao: c.numero ? `Nº ${c.numero}` : null,
        categoria: "certidao",
        arquivo_url: c.arquivo_url,
        arquivo_nome: c.arquivo_nome || `${c.tipo}.pdf`,
        arquivo_tamanho: null,
        created_at: c.ultima_consulta_at || c.updated_at || c.created_at,
        __origem: "certidao",
        data_vencimento: c.data_vencimento,
        status: c.status,
        tipo: c.tipo,
      }));
  }, [certidoes]);

  const merged = useMemo(() => {
    return [...certidoesAsDocs, ...(documentos as any[])].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [certidoesAsDocs, documentos]);

  const filtered = merged.filter((d: any) => {
    const matchSearch = !search || d.nome.toLowerCase().includes(search.toLowerCase()) || d.arquivo_nome.toLowerCase().includes(search.toLowerCase());
    const matchCategoria = categoriaFiltro === "todas" || d.categoria === categoriaFiltro;
    return matchSearch && matchCategoria;
  });

  const certidoesVencendo = (certidoes as any[]).filter((c) => {
    const d = diasAteVencimento(c.data_vencimento);
    return d !== null && d <= 30;
  }).length;

  return (
    <MainLayout>
      <Header title="Documentos da Empresa" subtitle="Importe e gerencie as documentações da empresa" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="certidoes">Certidões e Vencimentos</TabsTrigger>
            <TabsTrigger value="licitacao">Documentos Licitação</TabsTrigger>
          </TabsList>
          <TabsContent value="certidoes" className="mt-4">
            <CertidoesEmpresaTab />
          </TabsContent>
          <TabsContent value="licitacao" className="mt-4">
            <LicitacaoTab />
          </TabsContent>
          <TabsContent value="documentos" className="mt-4 space-y-4 md:space-y-6">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar documento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="import" className="gap-2" onClick={() => setUploadOpen(true)}>
            <FileUp className="h-4 w-4" />
            Enviar Documento
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{merged.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <ScrollText className="h-3.5 w-3.5" /> Certidões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{certidoesAsDocs.length}</div>
              {certidoesVencendo > 0 && (
                <p className="text-xs text-warning mt-1">{certidoesVencendo} vencendo em 30d</p>
              )}
            </CardContent>
          </Card>
          {["contrato", "alvara"].map((cat) => {
            const count = (documentos as any[]).filter((d: any) => d.categoria === cat).length;
            const label = CATEGORIAS.find((c) => c.value === cat)?.label || cat;
            return (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{count}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum documento encontrado.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc: any) => (
              <Card key={doc.id} className="flex items-center p-4 gap-4">
                <div className="shrink-0">
                  {doc.__origem === "certidao" ? (
                    <ScrollText className="h-5 w-5 text-primary" />
                  ) : (
                    getFileIcon(doc.arquivo_nome)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.nome}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="truncate">{doc.arquivo_nome}</span>
                    {doc.arquivo_tamanho && (<><span>•</span><span>{formatBytes(doc.arquivo_tamanho)}</span></>)}
                    <span>•</span>
                    <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {doc.descricao && <p className="text-xs text-muted-foreground mt-1 truncate">{doc.descricao}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.__origem === "certidao" ? (
                    <>
                      <Badge variant="secondary">Certidão</Badge>
                      {statusBadge(doc)}
                    </>
                  ) : (
                    <Badge variant="secondary">
                      {CATEGORIAS.find((c) => c.value === doc.categoria)?.label || doc.categoria}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)} title="Baixar">
                    <Download className="h-4 w-4" />
                  </Button>
                  {doc.__origem === "certidao" ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTab("certidoes")} title="Gerenciar na aba Certidões">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(doc)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Documento</DialogTitle>
            <DialogDescription>Selecione o arquivo e preencha as informações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Documento *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Ex: Contrato Social" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={formCategoria} onValueChange={setFormCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formCategoria === "certidao" && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>Para certidões com controle de vencimento (ANP, CNDs, Sintegra), use a aba <strong>Certidões e Vencimentos</strong>.</p>
                  <Button
                    size="sm"
                    variant="link"
                    className="px-0 h-auto mt-1"
                    onClick={() => { setUploadOpen(false); resetForm(); setTab("certidoes"); }}
                  >
                    Ir para Certidões →
                  </Button>
                </div>
              </div>
            )}
            <div>
              <Label>Descrição</Label>
              <Textarea value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} placeholder="Observações opcionais..." rows={2} />
            </div>
            <div>
              <Label>Arquivo *</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.txt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile || !formNome.trim() || formCategoria === "certidao"}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</> : "Salvar Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
