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
import { Plus, Trash2 } from "lucide-react";

export interface EmpenhoItemInicial {
  produto_id?: string | null;
  quantidade?: number;
  valor_unitario?: number;
}

export interface NovoEmpenhoInitialData {
  numero_empenho?: string;
  data_empenho?: string | null;
  parceiro_id?: string | null;
  observacoes?: string;
  // Single-item legacy support
  produto_id?: string | null;
  quantidade?: number;
  valor_unitario?: number;
  // Multi-item support
  itens?: EmpenhoItemInicial[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialData?: NovoEmpenhoInitialData | null;
}

interface ItemForm {
  produto_id: string;
  quantidade: number;
  valor_unitario: number;
}

const emptyItem = (): ItemForm => ({ produto_id: "", quantidade: 0, valor_unitario: 0 });

export function NovoEmpenhoModal({ open, onClose, onCreated, initialData }: Props) {
  const { unidadeAtual } = useUnidade() as any;
  const [parceiroId, setParceiroId] = useState("");
  const [licitacaoId, setLicitacaoId] = useState("nenhum");
  const [numero, setNumero] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros-vale-gas"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("vale_gas_parceiros").select("id, nome, tipo").eq("ativo", true).order("nome");
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
      setItens([emptyItem()]); setObs("");
      return;
    }
    if (initialData) {
      if (initialData.numero_empenho) setNumero(initialData.numero_empenho);
      if (initialData.data_empenho) setData(initialData.data_empenho);
      if (initialData.parceiro_id) setParceiroId(initialData.parceiro_id);
      if (initialData.observacoes) setObs(initialData.observacoes);

      const itensIniciais: ItemForm[] = [];
      if (initialData.itens && initialData.itens.length > 0) {
        initialData.itens.forEach((it) => {
          itensIniciais.push({
            produto_id: it.produto_id || "",
            quantidade: typeof it.quantidade === "number" ? it.quantidade : 0,
            valor_unitario: typeof it.valor_unitario === "number" ? it.valor_unitario : 0,
          });
        });
      } else if (initialData.produto_id || initialData.quantidade || initialData.valor_unitario) {
        itensIniciais.push({
          produto_id: initialData.produto_id || "",
          quantidade: typeof initialData.quantidade === "number" ? initialData.quantidade : 0,
          valor_unitario: typeof initialData.valor_unitario === "number" ? initialData.valor_unitario : 0,
        });
      }
      if (itensIniciais.length > 0) setItens(itensIniciais);
    }
  }, [open, initialData]);

  const total = useMemo(
    () => itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0),
    [itens]
  );

  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItens((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItens((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleSave = async () => {
    if (!parceiroId || !numero.trim()) {
      toast.error("Preencha parceiro e nº do empenho");
      return;
    }
    if (!unidadeAtual?.id) {
      toast.error("Selecione uma unidade ativa");
      return;
    }
    const itensValidos = itens.filter((it) => it.produto_id && it.quantidade > 0 && it.valor_unitario >= 0);
    if (itensValidos.length === 0) {
      toast.error("Adicione ao menos um produto com quantidade válida");
      return;
    }

    setSaving(true);
    const rows = itensValidos.map((it) => {
      const prod = produtos.find((p: any) => p.id === it.produto_id);
      return {
        unidade_id: unidadeAtual.id,
        parceiro_id: parceiroId,
        licitacao_id: licitacaoId === "nenhum" ? null : licitacaoId,
        numero_empenho: numero.trim(),
        data_empenho: data,
        produto_id: it.produto_id,
        produto_nome: prod?.nome ?? "",
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        observacoes: obs || null,
      };
    });

    const { error } = await (supabase as any).from("empenhos").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(rows.length > 1 ? `${rows.length} itens do empenho cadastrados` : "Empenho cadastrado");
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo Empenho</DialogTitle></DialogHeader>
        {initialData && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            ✨ Dados extraídos por IA — confira antes de salvar.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Parceiro (Órgão Público) *</Label>
            <Select value={parceiroId} onValueChange={setParceiroId}>
              <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
              <SelectContent>
                {parceiros.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}{p.tipo === "empenho" ? " · Empenho" : p.tipo === "consignado" ? " · Consignado" : ""}
                  </SelectItem>
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

          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens do Empenho *</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Adicionar produto
              </Button>
            </div>
            <div className="space-y-3">
              {itens.map((it, idx) => (
                <div key={idx} className="rounded-md border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Item {idx + 1}</span>
                    {itens.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(idx)} className="h-7 w-7 p-0 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Produto *</Label>
                    <Select value={it.produto_id} onValueChange={(v) => updateItem(idx, { produto_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                      <SelectContent>
                        {produtos.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Quantidade *</Label>
                      <Input type="number" min={1} value={it.quantidade || ""} onChange={(e) => updateItem(idx, { quantidade: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label className="text-xs">Valor Unitário (R$) *</Label>
                      <Input type="number" min={0} step="0.01" value={it.valor_unitario || ""} onChange={(e) => updateItem(idx, { valor_unitario: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    Subtotal: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((it.quantidade || 0) * (it.valor_unitario || 0))}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 rounded-lg bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Valor total do empenho: </span>
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
