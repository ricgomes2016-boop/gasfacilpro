import { useState } from "react";
import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Plus, Pause, Play, XCircle, Calendar, Package, Flame } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const freqLabels: Record<string, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  bimestral: "Bimestral",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativa", color: "bg-success" },
  pausado: { label: "Pausada", color: "bg-warning" },
  cancelado: { label: "Cancelada", color: "bg-destructive" },
};

export default function ClienteAssinaturas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    frequencia: "mensal",
    dia_preferencial: "",
    turno_preferencial: "manha",
  });

  // Fetch products
  const { data: produtos } = useQuery({
    queryKey: ["produtos-assinatura"],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome, preco")
        .eq("ativo", true)
        .eq("categoria", "gas")
        .order("nome");
      return data || [];
    },
  });

  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
  const [quantidade, setQuantidade] = useState("1");

  // Fetch client's subscriptions
  const { data: assinaturas, isLoading } = useQuery({
    queryKey: ["cliente-assinaturas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("contratos_recorrentes")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const handleCriar = async () => {
    const produto = produtos?.find(p => p.id === produtoSelecionado);
    if (!produto) {
      toast.error("Selecione um produto");
      return;
    }

    // Find client by user email/profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user?.id)
      .single();

    const clienteNome = profile?.full_name || user?.email || "Cliente";

    // Find or create client record
    let clienteId: string | null = null;
    const { data: existing } = await supabase
      .from("clientes")
      .select("id")
      .eq("email", user?.email)
      .limit(1);

    if (existing?.[0]) {
      clienteId = existing[0].id;
    } else {
      const { data: novo } = await supabase
        .from("clientes")
        .insert({ nome: clienteNome, email: user?.email })
        .select("id")
        .single();
      clienteId = novo?.id || null;
    }

    if (!clienteId) {
      toast.error("Erro ao vincular cadastro");
      return;
    }

    // Calculate next delivery date
    const hoje = getBrasiliaDate();
    const dia = form.dia_preferencial ? parseInt(form.dia_preferencial) : hoje.getDate();
    let proximaEntrega = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (proximaEntrega <= hoje) {
      proximaEntrega.setMonth(proximaEntrega.getMonth() + 1);
    }

    const { error } = await supabase.from("contratos_recorrentes").insert({
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      produto_id: produto.id,
      produto_nome: produto.nome,
      quantidade: parseInt(quantidade) || 1,
      valor_unitario: produto.preco,
      frequencia: form.frequencia,
      dia_preferencial: form.dia_preferencial ? parseInt(form.dia_preferencial) : null,
      turno_preferencial: form.turno_preferencial,
      proxima_entrega: proximaEntrega.toISOString().split("T")[0],
    });

    if (error) {
      toast.error("Erro ao criar assinatura");
    } else {
      toast.success("Assinatura criada com sucesso!");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cliente-assinaturas"] });
    }
  };

  const handleToggle = async (id: string, status: string) => {
    const newStatus = status === "ativo" ? "pausado" : "ativo";
    await supabase.from("contratos_recorrentes").update({ status: newStatus }).eq("id", id);
    toast.success(newStatus === "ativo" ? "Assinatura reativada!" : "Assinatura pausada");
    queryClient.invalidateQueries({ queryKey: ["cliente-assinaturas"] });
  };

  const handleCancelar = async (id: string) => {
    await supabase.from("contratos_recorrentes").update({ status: "cancelado" }).eq("id", id);
    toast.success("Assinatura cancelada");
    queryClient.invalidateQueries({ queryKey: ["cliente-assinaturas"] });
  };

  const ativas = (assinaturas || []).filter(a => a.status === "ativo");

  return (
    <ClienteLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Minhas Assinaturas</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Nova Assinatura
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Produto</Label>
                  <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                    <SelectContent>
                      {(produtos || []).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} — R$ {Number(p.preco).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade</Label>
                    <Input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
                  </div>
                  <div>
                    <Label>Frequência</Label>
                    <Select value={form.frequencia} onValueChange={v => setForm({ ...form, frequencia: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="quinzenal">Quinzenal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="bimestral">Bimestral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Dia preferencial</Label>
                    <Input type="number" min="1" max="31" placeholder="Ex: 15" value={form.dia_preferencial} onChange={e => setForm({ ...form, dia_preferencial: e.target.value })} />
                  </div>
                  <div>
                    <Label>Turno</Label>
                    <Select value={form.turno_preferencial} onValueChange={v => setForm({ ...form, turno_preferencial: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manha">Manhã</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noite">Noite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {produtoSelecionado && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor por entrega:</span>
                        <span className="font-bold">
                          R$ {((produtos?.find(p => p.id === produtoSelecionado)?.preco || 0) * (parseInt(quantidade) || 1)).toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button className="w-full" onClick={handleCriar}>
                  Criar Assinatura
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        {ativas.length > 0 && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm">
                <Flame className="h-4 w-4 text-primary" />
                <span className="font-medium">{ativas.length} assinatura{ativas.length > 1 ? "s" : ""} ativa{ativas.length > 1 ? "s" : ""}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : (assinaturas || []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">Nenhuma assinatura</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie uma assinatura para receber gás automaticamente
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(assinaturas || []).map(a => {
              const st = statusConfig[a.status] || statusConfig.ativo;
              return (
                <Card key={a.id}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">{a.produto_nome}</p>
                          <p className="text-xs text-muted-foreground">{a.quantidade}x — {freqLabels[a.frequencia]}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs gap-1">
                        <span className={`h-2 w-2 rounded-full ${st.color}`} />
                        {st.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Próxima: {a.proxima_entrega ? format(new Date(a.proxima_entrega), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </div>
                      <div className="text-right font-medium text-foreground">
                        R$ {(Number(a.valor_unitario) * a.quantidade).toFixed(2)}/entrega
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground mt-1">
                      {a.entregas_realizadas} entrega{a.entregas_realizadas !== 1 ? "s" : ""} realizada{a.entregas_realizadas !== 1 ? "s" : ""}
                    </div>

                    {(a.status === "ativo" || a.status === "pausado") && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs gap-1"
                          onClick={() => handleToggle(a.id, a.status)}
                        >
                          {a.status === "ativo" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          {a.status === "ativo" ? "Pausar" : "Reativar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs gap-1 text-destructive"
                          onClick={() => handleCancelar(a.id)}
                        >
                          <XCircle className="h-3 w-3" />
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ClienteLayout>
  );
}
