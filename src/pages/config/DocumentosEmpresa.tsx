import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Download, Trash2, Search, FileText, File, Image, FileSpreadsheet, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CATEGORIAS = [
  { value: "geral", label: "Geral" },
  { value: "contrato", label: "Contratos" },
  { value: "alvara", label: "Alvarás / Licenças" },
  { value: "fiscal", label: "Documentos Fiscais" },
  { value: "trabalhista", label: "Documentos Trabalhistas" },
  { value: "societario", label: "Societário" },
  { value: "seguro", label: "Seguros" },
  { value: "certificado", label: "Certificados" },
  { value: "outro", label: "Outros" },
];

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext || "")) return <FileText className="h-5 w-5 text-red-500" />;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return <Image className="h-5 w-5 text-blue-500" />;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentosEmpresa() {
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      // Extract storage path from URL
      const urlParts = doc.arquivo_url.split("/documentos-empresa/");
      const storagePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;

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
    setUploading(true);

    try {
      const ext = selectedFile.name.split(".").pop();
      const storagePath = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos-empresa")
        .upload(storagePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documentos-empresa")
        .getPublicUrl(storagePath);

      const { error: dbError } = await supabase.from("documentos_empresa").insert({
        nome: formNome.trim(),
        descricao: formDescricao.trim() || null,
        categoria: formCategoria,
        arquivo_url: urlData.publicUrl,
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
    const urlParts = doc.arquivo_url.split("/documentos-empresa/");
    const storagePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;
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

  const filtered = documentos.filter((d: any) => {
    const matchSearch = !search || d.nome.toLowerCase().includes(search.toLowerCase()) || d.arquivo_nome.toLowerCase().includes(search.toLowerCase());
    const matchCategoria = categoriaFiltro === "todas" || d.categoria === categoriaFiltro;
    return matchSearch && matchCategoria;
  });

  return (
    <MainLayout>
      <Header title="Documentos da Empresa" subtitle="Importe e gerencie as documentações da empresa" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
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
          <Button className="gap-2" onClick={() => setUploadOpen(true)}>
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
              <div className="text-2xl font-bold">{documentos.length}</div>
            </CardContent>
          </Card>
          {["contrato", "alvara", "fiscal"].map((cat) => {
            const count = documentos.filter((d: any) => d.categoria === cat).length;
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
                <div className="shrink-0">{getFileIcon(doc.arquivo_nome)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.nome}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.arquivo_nome}</span>
                    <span>•</span>
                    <span>{formatBytes(doc.arquivo_tamanho)}</span>
                    <span>•</span>
                    <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {doc.descricao && <p className="text-xs text-muted-foreground mt-1 truncate">{doc.descricao}</p>}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {CATEGORIAS.find((c) => c.value === doc.categoria)?.label || doc.categoria}
                </Badge>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)} title="Baixar">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(doc)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
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
            <Button onClick={handleUpload} disabled={uploading || !selectedFile || !formNome.trim()}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</> : "Salvar Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
