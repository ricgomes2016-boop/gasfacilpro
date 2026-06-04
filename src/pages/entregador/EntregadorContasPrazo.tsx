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
import { Search, HandCoins, DollarSign, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function EntregadorContasPrazo() {
  const { user } = useAuth();
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [observacoes, setObservacoes] = useState("");

  const fetchContas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contas_receber")
      .select("*, clientes(nome, telefone)")
      .in("status", ["pendente", "parcial", "vencido"])
      .order("data_vencimento", { ascending: true });
    setContas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchContas();
  }, []);

  const handleReceber = (conta: any) => {
    setSelectedConta(conta);
    setValorRecebido(String(conta.valor_restante ?? conta.valor));
    setFormaPagamento("dinheiro");
    setObservacoes("");
    setDialogOpen(true);
  };

  const handleConfirmar = async () => {
    if (!selectedConta) return;
    const valor = parseFloat(valorRecebido);
    if (!valor || valor <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const valorTotal = Number(selectedConta.valor_restante ?? selectedConta.valor);
    const novoRestante = Math.max(0, valorTotal - valor);
    const novoStatus = novoRestante <= 0 ? "pago" : "parcial";

    const { error } = await supabase
      .from("contas_receber")
      .update({
        status: novoStatus,
        valor_restante: novoRestante,
        data_pagamento: novoStatus === "pago" ? new Date().toISOString().split("T")[0] : null,
        observacoes: observacoes
          ? `${selectedConta.observacoes || ""}\n[Recebido R$${valor.toFixed(2)} via ${formaPagamento} pelo entregador em ${format(new Date(), "dd/MM/yy HH:mm")}] ${observacoes}`.trim()
          : `${selectedConta.observacoes || ""}\n[Recebido R$${valor.toFixed(2)} via ${formaPagamento} pelo entregador em ${format(new Date(), "dd/MM/yy HH:mm")}]`.trim(),
      } as any)
      .eq("id", selectedConta.id);

    if (error) {
      toast.error("Erro ao registrar recebimento");
    } else {
      toast.success(`Recebimento de R$ ${valor.toFixed(2)} registrado!`);
      setDialogOpen(false);
      fetchContas();
    }
  };

  const filtradas = contas.filter((c) => {
    if (!busca) return true;
    const nome = c.clientes?.nome || c.descricao || "";
    return nome.toLowerCase().includes(busca.toLowerCase());
  });

  const totalPendente = contas.reduce((s, c) => s + Number(c.valor_restante ?? c.valor), 0);

  return (
    <EntregadorLayout title="Contas a Prazo">
      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="text-xl font-bold">{contas.length}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-lg font-bold">R$ {totalPendente.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total a receber</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhuma conta pendente</p>
        ) : (
          <div className="space-y-3">
            {filtradas.map((conta) => {
              const vencida = new Date(conta.data_vencimento) < new Date();
              return (
                <Card key={conta.id} className={vencida ? "border-destructive/50" : ""}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{conta.clientes?.nome || conta.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          Vence: {format(new Date(conta.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant={vencida ? "destructive" : "outline"} className="text-xs shrink-0 ml-2">
                        {vencida ? "Vencida" : conta.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-bold text-primary">
                        R$ {Number(conta.valor_restante ?? conta.valor).toFixed(2)}
                      </p>
                      <Button size="sm" className="gap-1.5" onClick={() => handleReceber(conta)}>
                        <HandCoins className="h-4 w-4" />
                        Receber
                      </Button>
                    </div>
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
              <DialogTitle>Registrar Recebimento</DialogTitle>
            </DialogHeader>
            {selectedConta && (
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-semibold">{selectedConta.clientes?.nome || selectedConta.descricao}</p>
                  <p className="text-sm text-muted-foreground">
                    Total: R$ {Number(selectedConta.valor_restante ?? selectedConta.valor).toFixed(2)}
                  </p>
                </div>
                <div>
                  <Label>Valor Recebido (R$)</Label>
                  <Input type="number" step="0.01" value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)} />
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional..." />
                </div>
                <Button className="w-full gap-2" onClick={handleConfirmar}>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar Recebimento
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EntregadorLayout>
  );
}