import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Plus, QrCode, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Props {
  contaId: string;
  saldoAtual: number;
  unidadeId: string | null;
  accentColor: string;
  onPago: () => void;
}

export default function PixPanel({ contaId, saldoAtual, unidadeId, accentColor, onPago }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [novaChave, setNovaChave] = useState({ tipo: "cpf", chave: "" });
  const [pagarOpen, setPagarOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<string>("");

  const { data: chaves = [] } = useQuery({
    queryKey: ["pix-chaves", contaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pix_chaves")
        .select("*")
        .eq("conta_bancaria_id", contaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ["contas-pagar-pix", contaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*")
        .eq("status", "pendente")
        .order("vencimento", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const cadastrar = async () => {
    if (!novaChave.chave.trim()) { toast.error("Informe a chave"); return; }
    const { error } = await supabase.from("contas_pix_chaves").insert({
      conta_bancaria_id: contaId,
      tipo: novaChave.tipo,
      chave: novaChave.chave.trim(),
      unidade_id: unidadeId,
    });
    if (error) { toast.error("Erro ao cadastrar chave"); return; }
    toast.success("Chave cadastrada!");
    setNovaChave({ tipo: "cpf", chave: "" });
    qc.invalidateQueries({ queryKey: ["pix-chaves", contaId] });
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("contas_pix_chaves").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Chave removida");
    qc.invalidateQueries({ queryKey: ["pix-chaves", contaId] });
  };

  const pagar = async () => {
    const titulo = contasPagar.find((c: any) => c.id === selecionado);
    if (!titulo) { toast.error("Selecione um título"); return; }
    const valor = Number(titulo.valor);
    if (valor > saldoAtual) { toast.error("Saldo insuficiente"); return; }

    const novoSaldo = saldoAtual - valor;
    const hoje = format(new Date(), "yyyy-MM-dd");

    const { error: e1 } = await supabase.from("contas_pagar").update({
      status: "pago",
      data_pagamento: hoje,
      conta_bancaria_id: contaId,
      forma_pagamento: "pix",
    }).eq("id", titulo.id);
    if (e1) { toast.error("Erro ao baixar título"); return; }

    await supabase.from("movimentacoes_bancarias").insert({
      conta_bancaria_id: contaId,
      data: hoje,
      tipo: "saida",
      categoria: "Pagamento PIX",
      descricao: `PIX ${titulo.fornecedor} - ${titulo.descricao}`,
      valor,
      saldo_apos: novoSaldo,
      referencia_id: titulo.id,
      referencia_tipo: "contas_pagar",
      user_id: user?.id,
      unidade_id: unidadeId,
    });

    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", contaId);

    toast.success("Pagamento PIX realizado!");
    setPagarOpen(false);
    setSelecionado("");
    qc.invalidateQueries({ queryKey: ["contas-pagar-pix", contaId] });
    onPago();
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="chaves">
        <TabsList>
          <TabsTrigger value="chaves">Chaves cadastradas</TabsTrigger>
          <TabsTrigger value="cadastrar">Cadastrar chave</TabsTrigger>
          <TabsTrigger value="pagar">Pagar com PIX</TabsTrigger>
        </TabsList>

        <TabsContent value="chaves" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {chaves.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma chave cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {chaves.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <QrCode className="h-5 w-5" style={{ color: accentColor }} />
                        <div>
                          <p className="font-medium">{c.chave}</p>
                          <Badge variant="secondary" className="text-xs uppercase mt-0.5">{c.tipo}</Badge>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => remover(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cadastrar" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4 max-w-md">
              <div>
                <Label>Tipo de chave</Label>
                <Select value={novaChave.tipo} onValueChange={(v) => setNovaChave({ ...novaChave, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chave</Label>
                <Input value={novaChave.chave} onChange={(e) => setNovaChave({ ...novaChave, chave: e.target.value })} placeholder="Digite a chave" />
              </div>
              <Button onClick={cadastrar} style={{ background: accentColor }} className="text-white">
                <Plus className="h-4 w-4 mr-2" />Cadastrar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagar" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-semibold">Pagar conta via PIX</h3>
                  <p className="text-xs text-muted-foreground">Selecione um título pendente para quitar com o saldo desta conta.</p>
                </div>
                <Button onClick={() => setPagarOpen(true)} style={{ background: accentColor }} className="text-white">
                  <Send className="h-4 w-4 mr-2" />Novo pagamento
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Saldo disponível: <span className="font-bold text-foreground">R$ {saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={pagarOpen} onOpenChange={setPagarOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagar conta via PIX</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Título a pagar</Label>
            <Select value={selecionado} onValueChange={setSelecionado}>
              <SelectTrigger><SelectValue placeholder="Selecione um título pendente" /></SelectTrigger>
              <SelectContent>
                {contasPagar.length === 0 ? (
                  <SelectItem value="nenhum" disabled>Nenhuma conta pendente</SelectItem>
                ) : contasPagar.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fornecedor} — R$ {Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({format(new Date(c.vencimento), "dd/MM/yyyy")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagarOpen(false)}>Cancelar</Button>
            <Button onClick={pagar} style={{ background: accentColor }} className="text-white">Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
