import { useState, useRef, useCallback } from "react";

import { ContadorPageWrapper } from "@/components/contador/ContadorPageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Download, Calendar, CheckCircle2, AlertCircle,
  Upload, Inbox, Send, Search, Trash2, File, Image,
  FileSpreadsheet, Loader2, FolderOpen, Clock, Eye,
  TrendingUp, AlertTriangle, RefreshCw, Tag
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ──────────────────── Constants ────────────────────

const CATEGORIAS = [
  { value: "balancete", label: "Balancete" },
  { value: "dre", label: "DRE" },
  { value: "folha", label: "Folha de Pagamento" },
  { value: "notas_fiscais", label: "Notas Fiscais" },
  { value: "guias", label: "Guias / Tributos" },
  { value: "sped", label: "SPED / EFD" },
  { value: "ecf", label: "ECF / IRPJ" },
  { value: "contratos", label: "Contratos" },
  { value: "declaracoes", label: "Declarações" },
  { value: "relatorio", label: "Relatórios" },
  { value: "simples_nacional", label: "Simples Nacional / DAS" },
  { value: "geral", label: "Geral" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  disponivel: { label: "Disponível",  variant: "default" },
  pendente:   { label: "Pendente",    variant: "secondary" },
  revisao:    { label: "Em revisão",  variant: "outline" },
  vencido:    { label: "Vencido",     variant: "destructive" },
};

const PRAZOS_LEGAIS = [
  { key: "das",        label: "DAS (Simples Nacional)",       dia: 20 },
  { key: "fgts",       label: "FGTS",                         dia: 7  },
  { key: "inss",       label: "INSS (GPS)",                   dia: 20 },
  { key: "irrf",       label: "IRRF sobre folha",             dia: 20 },
  { key: "csll_pis_cofins", label: "CSLL / PIS / COFINS (Lucro Presumido)", dia: 25 },
  { key: "sped",       label: "EFD-ICMS/IPI",                 dia: 15 },
  { key: "ecf",        label: "ECF (IRPJ anual)",             dia: 31, mes: 7 },
];

// ──────────────────── Helpers ────────────────────

function getFileIcon(name = "") {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return <FileText className="h-5 w-5 text-red-500" />;
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return <Image className="h-5 w-5 text-blue-500" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function periodoOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = getBrasiliaDate();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

function getDaysUntil(day: number, mes?: number): number {
  const now = getBrasiliaDate();
  const target = new Date(now.getFullYear(), mes !== undefined ? mes - 1 : now.getMonth(), day);
  if (target < now) {
    target.setMonth(target.getMonth() + 1);
  }
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ──────────────────── Sub-components ────────────────────

interface DocCardProps {
  doc: any;
  onDownload: (doc: any) => void;
  onDelete:   (doc: any) => void;
  onPreview:  (doc: any) => void;
  deleting:   boolean;
}

function DocCard({ doc, onDownload, onDelete, onPreview, deleting }: DocCardProps) {
  const status = STATUS_MAP[doc.status] ?? STATUS_MAP.disponivel;
  const cat    = CATEGORIAS.find((c) => c.value === doc.categoria)?.label ?? doc.categoria;
  const isVencido = doc.prazo_entrega && new Date(doc.prazo_entrega) < new Date() && doc.status !== "disponivel";

  return (
    <Card className={`flex flex-col sm:flex-row items-start sm:items-center p-4 gap-3 ${isVencido ? "border-destructive/50 bg-destructive/5" : ""}`}>
      <div className="shrink-0">{getFileIcon(doc.arquivo_nome)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium truncate">{doc.nome}</p>
          <Badge variant={isVencido ? "destructive" : status.variant} className="text-xs">
            {isVencido ? "Vencido" : status.label}
          </Badge>
          {doc.competencia && (
            <Badge variant="outline" className="text-xs gap-1">
              <Calendar className="h-3 w-3" />
              {doc.competencia}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{cat}</span>
          {doc.periodo && <><span>•</span><span>{doc.periodo}</span></>}
          {doc.arquivo_nome && <><span>•</span><span>{doc.arquivo_nome}</span></>}
          <span>•</span>
          <span>{formatBytes(doc.arquivo_tamanho)}</span>
          <span>•</span>
          <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
          {doc.prazo_entrega && (
            <><span>•</span>
            <span className={new Date(doc.prazo_entrega) < new Date() ? "text-destructive font-medium" : ""}>
              Prazo: {new Date(doc.prazo_entrega).toLocaleDateString("pt-BR")}
            </span></>
          )}
        </div>
        {doc.observacoes && <p className="text-xs text-muted-foreground mt-1 truncate">{doc.observacoes}</p>}
        {doc.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {doc.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {doc.arquivo_url && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPreview(doc)} title="Visualizar">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDownload(doc)} title="Baixar">
              <Download className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(doc)} disabled={deleting} title="Excluir">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}

function CalendarioObrigacoes() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Calendário de Obrigações Fiscais
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {PRAZOS_LEGAIS.map((p) => {
            const days = getDaysUntil(p.dia, p.mes);
            const urgente = days <= 5;
            const proximo = days <= 15;
            const rowClass = urgente
              ? "bg-destructive/10 border border-destructive/30"
              : proximo
              ? "bg-secondary/50 border border-secondary"
              : "bg-muted/50";
            return (
              <div key={p.key} className={`flex items-center justify-between p-2 rounded-md text-sm ${rowClass}`}>
                <span className="font-medium truncate mr-2">{p.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">dia {p.dia}{p.mes ? `/${p.mes}` : ""}</span>
                  <Badge variant={urgente ? "destructive" : proximo ? "secondary" : "outline"} className="text-xs">
                    {days === 0 ? "Hoje!" : days === 1 ? "Amanhã" : `${days}d`}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">* Prazos estimados. Consulte o contador para confirmação.</p>
      </CardContent>
    </Card>
  );
}

// ──────────────────── Main Page ────────────────────

export default function Contador() {
  const { unidadeAtual } = useUnidade();
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState("enviados");
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTipo, setUploadTipo] = useState<"enviado" | "recebido">("enviado");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formNome, setFormNome] = useState("");
  const [formCategoria, setFormCategoria] = useState("geral");
  const [formPeriodo, setFormPeriodo] = useState("");
  const [formCompetencia, setFormCompetencia] = useState("");
  const [formStatus, setFormStatus] = useState("disponivel");
  const [formObs, setFormObs] = useState("");
  const [formPrazo, setFormPrazo] = useState("");
  const [formTags, setFormTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Query ──
  const { data: documentos = [], isLoading, refetch } = useQuery({
    queryKey: ["documentos_contabeis", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("documentos_contabeis")
        .select("*")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const enviados  = documentos.filter((d: any) => d.tipo === "enviado");
  const recebidos = documentos.filter((d: any) => d.tipo === "recebido");

  const filtered = useCallback((list: any[]) =>
    list.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (d.nome || "").toLowerCase().includes(q) || (d.arquivo_nome || "").toLowerCase().includes(q);
      const matchCat    = categoriaFiltro === "todas" || d.categoria === categoriaFiltro;
      const matchStatus = statusFiltro === "todos" || d.status === statusFiltro;
      return matchSearch && matchCat && matchStatus;
    }), [search, categoriaFiltro, statusFiltro]);

  // ── Stats ──
  const disponiveis = documentos.filter((d: any) => d.status === "disponivel").length;
  const pendentes   = documentos.filter((d: any) => d.status === "pendente").length;
  const emRevisao   = documentos.filter((d: any) => d.status === "revisao").length;
  const vencidos    = documentos.filter((d: any) =>
    d.prazo_entrega && new Date(d.prazo_entrega) < new Date() && d.status !== "disponivel"
  ).length;

  // ── Upload ──
  const openUpload = (tipo: "enviado" | "recebido") => {
    setUploadTipo(tipo);
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!formNome.trim() || !user) return;
    setUploading(true);

    try {
      let arquivo_url: string | null = null;
      let arquivo_nome: string | null = null;
      let arquivo_tamanho: number | null = null;

      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop();
        const storagePath = `${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos-contabeis")
          .upload(storagePath, selectedFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("documentos-contabeis")
          .getPublicUrl(storagePath);

        arquivo_url      = urlData.publicUrl;
        arquivo_nome     = selectedFile.name;
        arquivo_tamanho  = selectedFile.size;
      }

      const tagsArray = formTags.trim()
        ? formTags.split(",").map((t) => t.trim()).filter(Boolean)
        : null;

      const { error } = await supabase.from("documentos_contabeis").insert({
        nome:            formNome.trim(),
        categoria:       formCategoria,
        periodo:         formPeriodo || null,
        competencia:     formCompetencia || null,
        status:          formStatus,
        tipo:            uploadTipo,
        observacoes:     formObs.trim() || null,
        prazo_entrega:   formPrazo || null,
        tags:            tagsArray,
        arquivo_url,
        arquivo_nome,
        arquivo_tamanho,
        unidade_id:      unidadeAtual?.id || null,
        uploaded_by:     user.id,
        gerado_em:       new Date().toISOString(),
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["documentos_contabeis"] });
      toast.success("Documento salvo com sucesso!");
      setUploadOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar documento");
    } finally {
      setUploading(false);
    }
  };

  // ── Download ──
  const handleDownload = async (doc: any) => {
    if (!doc.arquivo_url) { toast.error("Nenhum arquivo anexado"); return; }
    const urlParts    = doc.arquivo_url.split("/documentos-contabeis/");
    const storagePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;
    if (!storagePath) { toast.error("Arquivo não encontrado"); return; }

    const { data, error } = await supabase.storage
      .from("documentos-contabeis")
      .createSignedUrl(storagePath, 60);

    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }

    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = doc.arquivo_nome || "documento";
    a.click();
  };

  // ── Preview ──
  const handlePreview = async (doc: any) => {
    if (!doc.arquivo_url) return;
    const urlParts    = doc.arquivo_url.split("/documentos-contabeis/");
    const storagePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;
    if (!storagePath) return;

    const { data } = await supabase.storage
      .from("documentos-contabeis")
      .createSignedUrl(storagePath, 300);

    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  // ── Delete ──
  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      setDeletingId(doc.id);
      if (doc.arquivo_url) {
        const urlParts    = doc.arquivo_url.split("/documentos-contabeis/");
        const storagePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;
        if (storagePath) {
          await supabase.storage.from("documentos-contabeis").remove([storagePath]);
        }
      }
      const { error } = await supabase.from("documentos_contabeis").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos_contabeis"] });
      toast.success("Documento removido");
    },
    onError: () => toast.error("Erro ao remover documento"),
    onSettled: () => setDeletingId(null),
  });

  const resetForm = () => {
    setFormNome(""); setFormCategoria("geral"); setFormPeriodo("");
    setFormCompetencia(""); setFormStatus("disponivel"); setFormObs("");
    setFormPrazo(""); setFormTags(""); setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Render ──
  return (
    <ContadorPageWrapper title="Documentos" subtitle="Troca segura de documentos e relatórios contábeis">
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documentos.length}</div>
              <p className="text-xs text-muted-foreground">{enviados.length} enviados · {recebidos.length} recebidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{disponiveis}</div>
              <p className="text-xs text-muted-foreground">Prontos para download</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendentes}</div>
              <p className="text-xs text-muted-foreground">Aguardando processamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vencidos / Revisão</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{vencidos + emRevisao}</div>
              <p className="text-xs text-muted-foreground">{vencidos} venc. · {emRevisao} revisão</p>
            </CardContent>
          </Card>
        </div>

        {/* Layout 2 colunas: Docs + Calendário */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Documentos (2/3) */}
          <div className="xl:col-span-2 space-y-4">
            <Tabs value={tab} onValueChange={setTab}>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="enviados" className="gap-2">
                    <Send className="h-4 w-4" />
                    Enviados
                    <Badge variant="secondary" className="ml-1">{enviados.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="recebidos" className="gap-2">
                    <Inbox className="h-4 w-4" />
                    Recebidos
                    <Badge variant="secondary" className="ml-1">{recebidos.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => refetch()} title="Atualizar">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => openUpload("recebido")}>
                    <Inbox className="h-4 w-4" />
                    Recebido
                  </Button>
                  <Button className="gap-2" onClick={() => openUpload("enviado")}>
                    <Upload className="h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1">
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
                    <SelectItem value="todas">Todas as categorias</SelectItem>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="revisao">Em revisão</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Alerta de vencidos */}
              {vencidos > 0 && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive mb-3">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span><strong>{vencidos}</strong> documento(s) com prazo vencido. Regularize com o contador.</span>
                </div>
              )}

              {/* Enviados */}
              <TabsContent value="enviados" className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
                  </div>
                ) : filtered(enviados).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <Send className="h-10 w-10 mx-auto opacity-30" />
                    <p>Nenhum documento enviado ainda.</p>
                    <Button variant="outline" size="sm" onClick={() => openUpload("enviado")}>
                      Enviar primeiro documento
                    </Button>
                  </div>
                ) : (
                  filtered(enviados).map((doc: any) => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      onDownload={handleDownload}
                      onDelete={(d) => deleteMutation.mutate(d)}
                      onPreview={handlePreview}
                      deleting={deletingId === doc.id}
                    />
                  ))
                )}
              </TabsContent>

              {/* Recebidos */}
              <TabsContent value="recebidos" className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
                  </div>
                ) : filtered(recebidos).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <Inbox className="h-10 w-10 mx-auto opacity-30" />
                    <p>Nenhum documento recebido ainda.</p>
                    <Button variant="outline" size="sm" onClick={() => openUpload("recebido")}>
                      Registrar documento recebido
                    </Button>
                  </div>
                ) : (
                  filtered(recebidos).map((doc: any) => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      onDownload={handleDownload}
                      onDelete={(d) => deleteMutation.mutate(d)}
                      onPreview={handlePreview}
                      deleting={deletingId === doc.id}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar: Calendário + Dicas (1/3) */}
          <div className="space-y-4">
            <CalendarioObrigacoes />

            {/* Card de boas práticas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Documentos Recomendados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {[
                  "Notas fiscais de entrada e saída do mês",
                  "Extrato bancário consolidado",
                  "Relatório de vendas por forma de pagamento",
                  "Comprovantes de pagamento de tributos",
                  "Folha de pagamento e pró-labore",
                  "Controle de estoque (inventário)",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {uploadTipo === "enviado"
                ? <><Send className="h-5 w-5" /> Enviar Documento ao Contador</>
                : <><Inbox className="h-5 w-5" /> Registrar Documento Recebido</>}
            </DialogTitle>
            <DialogDescription>
              {uploadTipo === "enviado"
                ? "Documentos que você está enviando para o contador."
                : "Documentos que você recebeu do contador."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome / Título *</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Notas Fiscais Janeiro 2025"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <Label>Competência</Label>
                <Input
                  type="month"
                  value={formCompetencia}
                  onChange={(e) => setFormCompetencia(e.target.value)}
                  placeholder="MM/AAAA"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Período de referência</Label>
                <Select value={formPeriodo} onValueChange={setFormPeriodo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem período</SelectItem>
                    {periodoOptions().map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo de entrega</Label>
                <Input
                  type="date"
                  value={formPrazo}
                  onChange={(e) => setFormPrazo(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="revisao">Em Revisão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Tags (separadas por vírgula)</Label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="Ex: urgente, mensal, sped"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                placeholder="Informações adicionais..."
                rows={2}
              />
            </div>

            <div>
              <Label>Arquivo (opcional)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.txt,.zip,.xml"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Word, Excel, XML, imagens, ZIP — máx. 20 MB
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !formNome.trim()}>
              {uploading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                : uploadTipo === "enviado" ? "Enviar Documento" : "Registrar Recebido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContadorPageWrapper>
  );
}
