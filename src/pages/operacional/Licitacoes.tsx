import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  FileText,
  Calendar,
  DollarSign,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Pencil,
  Trash2,
  ExternalLink,
  TrendingUp,
  ClipboardList,
  Trophy,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Licitacao {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  status: string;
  valor_estimado: number;
  valor_proposta: number | null;
  valor_adjudicado: number | null;
  data_publicacao: string | null;
  data_abertura: string | null;
  data_resultado: string | null;
  data_vigencia_inicio: string | null;
  data_vigencia_fim: string | null;
  prazo_entrega: string | null;
  local_entrega: string | null;
  produtos: string | null;
  observacoes: string | null;
  link_edital: string | null;
  numero_processo: string | null;
  cnpj_orgao: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MODALIDADES: Record<string, string> = {
  pregao_eletronico: "Pregão Eletrônico",
  pregao_presencial: "Pregão Presencial",
  concorrencia: "Concorrência",
  tomada_precos: "Tomada de Preços",
  convite: "Convite",
  dispensa: "Dispensa de Licitação",
  inexigibilidade: "Inexigibilidade",
};

const STATUS_OPTIONS = [
  { value: "prospeccao", label: "Prospecção", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "participando", label: "Participando", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "proposta_enviada", label: "Proposta Enviada", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "habilitada", label: "Habilitada", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "vencida", label: "Vencida 🏆", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "perdida", label: "Perdida", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "cancelada", label: "Cancelada", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "em_execucao", label: "Em Execução", color: "bg-teal-100 text-teal-700 border-teal-200" },
  { value: "concluida", label: "Concluída", color: "bg-green-100 text-green-800 border-green-200" },
];

const EMPTY_FORM = {
  numero: "",
  orgao: "",
  objeto: "",
  modalidade: "pregao_eletronico",
  status: "prospeccao",
  valor_estimado: "",
  valor_proposta: "",
  data_publicacao: "",
  data_abertura: "",
  prazo_entrega: "",
  local_entrega: "",
  produtos: "",
  link_edital: "",
  numero_processo: "",
  cnpj_orgao: "",
  observacoes: "",
};

function getStatusBadge(status: string) {
  const found = STATUS_OPTIONS.find((s) => s.value === status);
  return found
    ? <Badge variant="outline" className={`${found.color} text-xs`}>{found.label}</Badge>
    : <Badge variant="outline">{status}</Badge>;
}

function formatCurrency(value: number | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Licitacoes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [ocorrenciaOpen, setOcorrenciaOpen] = useState(false);
  const [selected, setSelected] = useState<Licitacao | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editMode, setEditMode] = useState(false);
  const [novaOcorrencia, setNovaOcorrencia] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: licitacoes = [], isLoading } = useQuery({
    queryKey: ["licitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licitacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Licitacao[];
    },
  });

  const { data: ocorrencias = [] } = useQuery({
    queryKey: ["licitacao_ocorrencias", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licitacao_ocorrencias")
        .select("*")
        .eq("licitacao_id", selected!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM & { id?: string }) => {
      const body = {
        numero: payload.numero,
        orgao: payload.orgao,
        objeto: payload.objeto,
        modalidade: payload.modalidade,
        status: payload.status,
        valor_estimado: payload.valor_estimado ? parseFloat(payload.valor_estimado) : 0,
        valor_proposta: payload.valor_proposta ? parseFloat(payload.valor_proposta) : null,
        data_publicacao: payload.data_publicacao || null,
        data_abertura: payload.data_abertura ? new Date(payload.data_abertura).toISOString() : null,
        prazo_entrega: payload.prazo_entrega || null,
        local_entrega: payload.local_entrega || null,
        produtos: payload.produtos || null,
        link_edital: payload.link_edital || null,
        numero_processo: payload.numero_processo || null,
        cnpj_orgao: payload.cnpj_orgao || null,
        observacoes: payload.observacoes || null,
      };

      if (payload.id) {
        const { error } = await supabase.from("licitacoes").update(body).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("licitacoes").insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licitacoes"] });
      toast.success(editMode ? "Licitação atualizada!" : "Licitação cadastrada!");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditMode(false);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licitacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licitacoes"] });
      toast.success("Licitação excluída.");
      setDetailOpen(false);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const addOcorrenciaMutation = useMutation({
    mutationFn: async ({ licitacaoId, descricao }: { licitacaoId: string; descricao: string }) => {
      const { error } = await supabase.from("licitacao_ocorrencias").insert({
        licitacao_id: licitacaoId,
        descricao,
        tipo: "atualizacao",
        autor_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licitacao_ocorrencias", selected?.id] });
      toast.success("Ocorrência registrada!");
      setNovaOcorrencia("");
      setOcorrenciaOpen(false);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const filtered = licitacoes.filter((l) => {
    const matchSearch =
      l.numero.toLowerCase().includes(search.toLowerCase()) ||
      l.orgao.toLowerCase().includes(search.toLowerCase()) ||
      l.objeto.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: licitacoes.length,
    participando: licitacoes.filter((l) => ["participando", "proposta_enviada", "habilitada"].includes(l.status)).length,
    vencidas: licitacoes.filter((l) => l.status === "vencida").length,
    emExecucao: licitacoes.filter((l) => l.status === "em_execucao").length,
    valorTotal: licitacoes.filter((l) => l.status === "em_execucao").reduce((s, l) => s + (l.valor_adjudicado || l.valor_proposta || 0), 0),
  };

  function openNew() {
    setForm(EMPTY_FORM);
    setEditMode(false);
    setDialogOpen(true);
  }

  function openEdit(l: Licitacao) {
    setForm({
      numero: l.numero,
      orgao: l.orgao,
      objeto: l.objeto,
      modalidade: l.modalidade,
      status: l.status,
      valor_estimado: l.valor_estimado?.toString() || "",
      valor_proposta: l.valor_proposta?.toString() || "",
      data_publicacao: l.data_publicacao || "",
      data_abertura: l.data_abertura ? l.data_abertura.substring(0, 16) : "",
      prazo_entrega: l.prazo_entrega || "",
      local_entrega: l.local_entrega || "",
      produtos: l.produtos || "",
      link_edital: l.link_edital || "",
      numero_processo: l.numero_processo || "",
      cnpj_orgao: l.cnpj_orgao || "",
      observacoes: l.observacoes || "",
    });
    setEditMode(true);
    setSelected(l);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.numero || !form.orgao || !form.objeto) {
      toast.error("Preencha número, órgão e objeto da licitação.");
      return;
    }
    saveMutation.mutate({ ...form, id: editMode ? selected?.id : undefined });
  }

  const tabCounts = {
    todos: licitacoes.length,
    participando: licitacoes.filter((l) => ["participando", "proposta_enviada", "habilitada"].includes(l.status)).length,
    vencidas: licitacoes.filter((l) => ["vencida", "em_execucao", "concluida"].includes(l.status)).length,
    perdidas: licitacoes.filter((l) => ["perdida", "cancelada"].includes(l.status)).length,
  };

  return (
    <MainLayout>
      <Header title="Licitações Públicas" subtitle="Gerencie processos licitatórios e contratos com órgãos públicos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header actions */}
        <div className="flex justify-end">
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Licitação
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.participando}</p>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.vencidas}</p>
                <p className="text-xs text-muted-foreground">Vencidas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-bold">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">Em Execução</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, órgão ou objeto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-52">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs + Tabela */}
        <Tabs defaultValue="todos">
          <TabsList>
            <TabsTrigger value="todos">Todas ({tabCounts.todos})</TabsTrigger>
            <TabsTrigger value="andamento">Em Andamento ({tabCounts.participando})</TabsTrigger>
            <TabsTrigger value="ganhas">Ganhas ({tabCounts.vencidas})</TabsTrigger>
            <TabsTrigger value="perdidas">Perdidas ({tabCounts.perdidas})</TabsTrigger>
          </TabsList>

          {["todos", "andamento", "ganhas", "perdidas"].map((tab) => {
            const tabData = tab === "todos" ? filtered
              : tab === "andamento" ? filtered.filter((l) => ["participando", "proposta_enviada", "habilitada"].includes(l.status))
              : tab === "ganhas" ? filtered.filter((l) => ["vencida", "em_execucao", "concluida"].includes(l.status))
              : filtered.filter((l) => ["perdida", "cancelada"].includes(l.status));

            return (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                    ) : tabData.length === 0 ? (
                      <div className="p-12 text-center">
                        <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-muted-foreground">Nenhuma licitação encontrada</p>
                        <Button variant="outline" className="mt-4 gap-2" onClick={openNew}>
                          <Plus className="h-4 w-4" /> Cadastrar primeira
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Número / Processo</TableHead>
                              <TableHead>Órgão</TableHead>
                              <TableHead>Objeto</TableHead>
                              <TableHead>Modalidade</TableHead>
                              <TableHead>Abertura</TableHead>
                              <TableHead>Valor Estimado</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-24">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tabData.map((l) => (
                              <TableRow key={l.id} className="cursor-pointer hover:bg-muted/40">
                                <TableCell className="font-medium">
                                  <div>{l.numero}</div>
                                  {l.numero_processo && (
                                    <div className="text-xs text-muted-foreground">{l.numero_processo}</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm">{l.orgao}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <p className="text-sm max-w-[220px] truncate" title={l.objeto}>{l.objeto}</p>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {MODALIDADES[l.modalidade] || l.modalidade}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDate(l.data_abertura)}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium text-sm">
                                  {formatCurrency(l.valor_estimado)}
                                </TableCell>
                                <TableCell>{getStatusBadge(l.status)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => { setSelected(l); setDetailOpen(true); }}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => openEdit(l)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* ── Dialog: Novo / Editar ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? "Editar Licitação" : "Nova Licitação"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Identificação */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Identificação</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Número do Edital *</Label>
                  <Input placeholder="Ex: 001/2025" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Número do Processo</Label>
                  <Input placeholder="Ex: 23000.000001/2025-01" value={form.numero_processo} onChange={(e) => setForm((f) => ({ ...f, numero_processo: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Órgão Licitante *</Label>
                  <Input placeholder="Ex: Prefeitura Municipal de..." value={form.orgao} onChange={(e) => setForm((f) => ({ ...f, orgao: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ do Órgão</Label>
                  <Input placeholder="00.000.000/0001-00" value={form.cnpj_orgao} onChange={(e) => setForm((f) => ({ ...f, cnpj_orgao: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Modalidade</Label>
                  <Select value={form.modalidade} onValueChange={(v) => setForm((f) => ({ ...f, modalidade: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MODALIDADES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Objeto da Licitação *</Label>
                  <Textarea
                    placeholder="Descreva o objeto da licitação..."
                    value={form.objeto}
                    onChange={(e) => setForm((f) => ({ ...f, objeto: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Datas e Valores */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Datas e Valores</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data de Publicação</Label>
                  <Input type="date" value={form.data_publicacao} onChange={(e) => setForm((f) => ({ ...f, data_publicacao: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data/Hora de Abertura</Label>
                  <Input type="datetime-local" value={form.data_abertura} onChange={(e) => setForm((f) => ({ ...f, data_abertura: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor Estimado (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={form.valor_estimado} onChange={(e) => setForm((f) => ({ ...f, valor_estimado: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nossa Proposta (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={form.valor_proposta} onChange={(e) => setForm((f) => ({ ...f, valor_proposta: e.target.value }))} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Entrega e Produtos */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Entrega e Produtos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prazo de Entrega</Label>
                  <Input placeholder="Ex: 30 dias após empenho" value={form.prazo_entrega} onChange={(e) => setForm((f) => ({ ...f, prazo_entrega: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Local de Entrega</Label>
                  <Input placeholder="Ex: Almoxarifado Central" value={form.local_entrega} onChange={(e) => setForm((f) => ({ ...f, local_entrega: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Produtos / Itens</Label>
                  <Textarea placeholder="Descreva os produtos solicitados..." value={form.produtos} onChange={(e) => setForm((f) => ({ ...f, produtos: e.target.value }))} rows={2} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Status e Observações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Link do Edital</Label>
                <Input placeholder="https://..." value={form.link_edital} onChange={(e) => setForm((f) => ({ ...f, link_edital: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea placeholder="Anotações internas..." value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editMode ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Detalhes ─────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-lg">Licitação {selected.numero}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">{selected.orgao}</p>
                  </div>
                  {getStatusBadge(selected.status)}
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Modalidade</p>
                    <p className="font-medium">{MODALIDADES[selected.modalidade] || selected.modalidade}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Abertura</p>
                    <p className="font-medium">{formatDate(selected.data_abertura)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Valor Estimado</p>
                    <p className="font-medium text-primary">{formatCurrency(selected.valor_estimado)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Nossa Proposta</p>
                    <p className="font-medium">{formatCurrency(selected.valor_proposta)}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Objeto</p>
                  <p className="text-sm">{selected.objeto}</p>
                </div>

                {selected.produtos && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Produtos</p>
                    <p className="text-sm">{selected.produtos}</p>
                  </div>
                )}

                {selected.link_edital && (
                  <a
                    href={selected.link_edital}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Acessar Edital
                  </a>
                )}

                <Separator />

                {/* Ocorrências */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Histórico de Ocorrências</h3>
                    <Button size="sm" variant="outline" onClick={() => setOcorrenciaOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Registrar
                    </Button>
                  </div>
                  {ocorrencias.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {ocorrencias.map((o: { id: string; descricao: string; created_at: string }) => (
                        <div key={o.id} className="flex gap-2 text-sm border-l-2 border-primary/30 pl-3 py-1">
                          <div className="flex-1">
                            <p>{o.descricao}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(parseISO(o.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Excluir esta licitação?")) deleteMutation.mutate(selected.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
                <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(selected); }}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova Ocorrência ───────────────────────────────────────────── */}
      <Dialog open={ocorrenciaOpen} onOpenChange={setOcorrenciaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Ocorrência</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Descreva o que aconteceu nesta licitação..."
            rows={4}
            value={novaOcorrencia}
            onChange={(e) => setNovaOcorrencia(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOcorrenciaOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!novaOcorrencia.trim()) return;
                addOcorrenciaMutation.mutate({ licitacaoId: selected!.id, descricao: novaOcorrencia });
              }}
              disabled={addOcorrenciaMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
