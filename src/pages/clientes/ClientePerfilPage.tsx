import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Phone, MapPin, Mail, Edit, Plus, Trash2, Send, Loader2, DollarSign, ShoppingCart, Calendar, Tag, MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClienteDetail {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  tipo: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean | null;
  created_at: string;
}

interface Pedido {
  id: string;
  created_at: string;
  valor_total: number | null;
  forma_pagamento: string | null;
  status: string | null;
}

interface TagData {
  id: string;
  nome: string;
  cor: string;
}

interface Observacao {
  id: string;
  texto: string;
  created_at: string;
}

export default function ClientePerfilPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClienteDetail | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [tags, setTags] = useState<TagData[]>([]);
  const [clienteTags, setClienteTags] = useState<TagData[]>([]);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [novaObs, setNovaObs] = useState("");
  const [savingObs, setSavingObs] = useState(false);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [clienteRes, pedidosRes, tagsRes, allTagsRes, obsRes] = await Promise.all([
        supabase.from("clientes").select("*").eq("id", id!).single(),
        supabase.from("pedidos").select("id, created_at, valor_total, forma_pagamento, status").eq("cliente_id", id!).order("created_at", { ascending: false }).limit(20),
        supabase.from("cliente_tag_associacoes").select("tag_id, cliente_tags(id, nome, cor)").eq("cliente_id", id!),
        supabase.from("cliente_tags").select("*").order("nome"),
        supabase.from("cliente_observacoes").select("*").eq("cliente_id", id!).order("created_at", { ascending: false }),
      ]);

      if (clienteRes.data) setCliente(clienteRes.data);
      setPedidos(pedidosRes.data || []);
      
      const mappedTags = (tagsRes.data || []).map((t: any) => t.cliente_tags).filter(Boolean);
      setClienteTags(mappedTags);
      setAllTags(allTagsRes.data || []);
      setObservacoes(obsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = async (tag: TagData) => {
    const hasTag = clienteTags.some((t) => t.id === tag.id);
    if (hasTag) {
      await supabase.from("cliente_tag_associacoes").delete().eq("cliente_id", id!).eq("tag_id", tag.id);
      setClienteTags((prev) => prev.filter((t) => t.id !== tag.id));
    } else {
      await supabase.from("cliente_tag_associacoes").insert({ cliente_id: id!, tag_id: tag.id });
      setClienteTags((prev) => [...prev, tag]);
    }
  };

  const addObservacao = async () => {
    if (!novaObs.trim()) return;
    setSavingObs(true);
    try {
      const { error } = await supabase.from("cliente_observacoes").insert({ cliente_id: id!, texto: novaObs.trim() });
      if (error) throw error;
      setNovaObs("");
      toast.success("Observação adicionada");
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSavingObs(false);
    }
  };

  const deleteObs = async (obsId: string) => {
    await supabase.from("cliente_observacoes").delete().eq("id", obsId);
    setObservacoes((prev) => prev.filter((o) => o.id !== obsId));
    toast.success("Observação removida");
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Perfil do Cliente" subtitle="Carregando..." />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!cliente) {
    return (
      <MainLayout>
        <Header title="Cliente não encontrado" />
        <div className="p-3 sm:p-4 md:p-6">
          <Button variant="outline" onClick={() => navigate("/clientes/cadastro")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      </MainLayout>
    );
  }

  const totalGasto = pedidos.filter((p) => p.status !== "cancelado").reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalPedidos = pedidos.filter((p) => p.status !== "cancelado").length;
  const ticketMedio = totalPedidos > 0 ? totalGasto / totalPedidos : 0;

  const getStatusBadge = (status: string | null) => {
    const map: Record<string, string> = { entregue: "default", em_rota: "secondary", pendente: "outline", cancelado: "destructive" };
    return <Badge variant={(map[status || ""] || "outline") as any}>{status || "—"}</Badge>;
  };

  return (
    <MainLayout>
      <Header title="Perfil do Cliente" subtitle={cliente.nome} />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/clientes/cadastro")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
          </Button>
        </div>

        {/* KPIs + Info */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">R$ {totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">Total Gasto (LTV)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-green-500/10">
                  <ShoppingCart className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{totalPedidos}</p>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">R$ {ticketMedio.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-yellow-500/10">
                  <Calendar className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {pedidos.length > 0 ? format(new Date(pedidos[0].created_at), "dd/MM/yy") : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Última Compra</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Dados + Tags */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dados do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{cliente.telefone || "Sem telefone"}</span>
                  {cliente.telefone && (
                    <a
                      href={`https://wa.me/55${cliente.telefone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Send className="h-3.5 w-3.5 text-green-500" />
                      </Button>
                    </a>
                  )}
                </div>
                {cliente.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{cliente.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {[cliente.endereco, cliente.numero && `Nº ${cliente.numero}`, cliente.bairro, cliente.cidade].filter(Boolean).join(", ") || "Sem endereço"}
                  </span>
                </div>
                {cliente.cpf && <p className="text-muted-foreground">CPF: {cliente.cpf}</p>}
                <div className="flex gap-1.5 flex-wrap pt-1">
                  <Badge variant="outline">{cliente.tipo || "residencial"}</Badge>
                  {cliente.latitude && <Badge variant="secondary" className="text-[10px]">📍 Geolocalizado</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  Cadastrado em {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const active = clienteTags.some((t) => t.id === tag.id);
                    return (
                      <Badge
                        key={tag.id}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer transition-all text-xs"
                        style={active ? { backgroundColor: tag.cor, borderColor: tag.cor } : { borderColor: tag.cor, color: tag.cor }}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag.nome}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Observações */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Observações Internas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    value={novaObs}
                    onChange={(e) => setNovaObs(e.target.value)}
                    placeholder="Ex: Prefere entrega pela manhã, portão azul..."
                    className="min-h-[60px] text-sm"
                  />
                </div>
                <Button size="sm" onClick={addObservacao} disabled={savingObs || !novaObs.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {savingObs ? "Salvando..." : "Adicionar"}
                </Button>

                {observacoes.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    {observacoes.map((obs) => (
                      <div key={obs.id} className="flex items-start justify-between gap-2 p-2 rounded-md bg-muted/50 text-sm">
                        <div>
                          <p>{obs.texto}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(obs.created_at), "dd/MM/yy HH:mm")}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteObs(obs.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Histórico de Pedidos */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Histórico de Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                {pedidos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido encontrado</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Data</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedidos.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm">
                              {format(new Date(p.created_at), "dd/MM/yy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              #{p.id.slice(0, 6)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {(p.valor_total || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{p.forma_pagamento || "—"}</Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(p.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
