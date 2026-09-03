import { useState, useEffect } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { RotateCcw, ArrowLeftRight, DollarSign, Plus, Search, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  aprovada: { label: "Aprovada", variant: "default" },
  recusada: { label: "Recusada", variant: "destructive" },
  concluida: { label: "Concluída", variant: "secondary" },
};

const tipoConfig: Record<string, { label: string; icon: React.ElementType }> = {
  devolucao: { label: "Devolução", icon: RotateCcw },
  troca: { label: "Troca", icon: ArrowLeftRight },
  estorno: { label: "Estorno", icon: DollarSign },
};

export default function EntregadorDevolucoes() {
  const { unidadeAtual } = useUnidade();
  const [devolucoes, setDevolucoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState({
    cliente_nome: "",
    tipo: "devolucao",
    motivo: "",
    valor_total: "",
    observacoes: "",
  });

  const fetchDevolucoes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("devolucoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setDevolucoes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDevolucoes();
  }, []);

  const handleSubmit = async () => {
    if (!form.cliente_nome || !form.motivo) {
      toast.error("Preencha cliente e motivo");
      return;
    }
    if (!unidadeAtual?.id) {
      toast.error("Unidade não identificada. Faça login novamente.");
      return;
    }
    const { error } = await supabase.from("devolucoes").insert({
      unidade_id: unidadeAtual.id,
      cliente_nome: form.cliente_nome,
      tipo: form.tipo,
      motivo: form.motivo,
      valor_total: parseFloat(form.valor_total) || 0,
      observacoes: form.observacoes || null,
    });
    if (error) {
      toast.error("Erro ao registrar: " + error.message);
    } else {
      toast.success("Registrado com sucesso!");
      setDialogOpen(false);
      setForm({ cliente_nome: "", tipo: "devolucao", motivo: "", valor_total: "", observacoes: "" });
      fetchDevolucoes();
    }
  };

  const filtradas = devolucoes.filter((d) => {
    if (!busca) return true;
    return d.cliente_nome?.toLowerCase().includes(busca.toLowerCase());
  });

  return (
    <EntregadorLayout title="Devoluções/Trocas">
      <div className="p-4 space-y-4">
        {/* Search + Add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Button className="gap-1.5 shrink-0" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhum registro</p>
        ) : (
          <div className="space-y-3">
            {filtradas.map((d) => {
              const tipo = tipoConfig[d.tipo] || tipoConfig.devolucao;
              const status = statusConfig[d.status] || statusConfig.pendente;
              const TipoIcon = tipo.icon;
              return (
                <Card key={d.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{d.cliente_nome}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <TipoIcon className="h-3 w-3" />
                          <span>{tipo.label}</span>
                          <span>•</span>
                          <span>{format(new Date(d.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      <Badge variant={status.variant} className="text-xs shrink-0 ml-2">
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{d.motivo}</p>
                    <p className="text-sm font-bold text-primary mt-1">R$ {Number(d.valor_total).toFixed(2)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Devolução / Troca</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Cliente *</Label>
                <Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="devolucao">Devolução</SelectItem>
                    <SelectItem value="troca">Troca</SelectItem>
                    <SelectItem value="estorno">Estorno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo *</Label>
                <Textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
              <Button className="w-full" onClick={handleSubmit}>Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EntregadorLayout>
  );
}