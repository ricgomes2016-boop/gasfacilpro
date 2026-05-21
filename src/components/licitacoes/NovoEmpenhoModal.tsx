import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NovoEmpenhoModal({ open, onClose, onCreated }: Props) {
  const { unidadeAtual } = useUnidade() as any;
  const [parceiroId, setParceiroId] = useState("");
  const [licitacaoId, setLicitacaoId] = useState("nenhum");
  const [numero, setNumero] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [valor, setValor] = useState<number>(0);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros-vale-gas"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("vale_gas_parceiros").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-empenho", unidadeAtual?.id],
    queryFn: async () => {
      let q = (supabase as any).from("produtos").select("id, nome").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: licitacoes = [] } = useQuery({
    queryKey: ["licitacoes-ganhas"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("licitacoes")
        .select("id, numero, orgao")
        .in("status", ["vencida", "em_execucao", "concluida"])
        .order("numero", { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    if (!open) {
      setParceiroId(""); setLicitacaoId("nenhum"); setNumero("");
      setData(new Date().toISOString().slice(0, 10));
      setProdutoId(""); setQuantidade(0); setValor(0); setObs("");
    }
  }, [open]);

  const total = useMemo(() => (Number(quantidade) || 0) * (Number(valor) || 0), [quantidade, valor]);
  const produto = produtos.find((p: any) => p.id === produtoId);

  const handleSave = async () => {
    if (!parceiroId || !numero.trim() || !produtoId || quantidade <= 0 || valor < 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!unidadeAtual?.id) {
      toast.error("Selecione uma unidade ativa");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("empenhos").insert({
      unidade_id: unidadeAtual.id,
      parceiro_id: parceiroId,
      licitacao_id: licitacaoId === "nenhum" ? null : licitacaoId,
      numero_empenho: numero.trim(),
      data_empenho: data,
      produto_id: produtoId,
      produto_nome: produto?.nome ?? "",
      quantidade,
      valor_unitario: valor,
      observacoes: obs || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Empenho cadastrado");
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo Empenho</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Parceiro (Órgão Público) *</Label>
            <Select value={parceiroId} onValueChange={setParceiroId}>
              <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
              <SelectContent>
                {parceiros.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nº do Empenho *</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 2747/2026" />
          </div>
          <div>
            <Label>Data do Empenho</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Licitação (opcional)</Label>
            <Select value={licitacaoId} onValueChange={setLicitacaoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhuma</SelectItem>
                {licitacoes.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.numero} — {l.orgao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Produto *</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {produtos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade Empenhada *</Label>
            <Input type="number" min={1} value={quantidade || ""} onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Valor Unitário (R$) *</Label>
            <Input type="number" min={0} step="0.01" value={valor || ""} onChange={(e) => setValor(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="md:col-span-2 rounded-lg bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Valor total: </span>
            <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</strong>
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Empenho"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
