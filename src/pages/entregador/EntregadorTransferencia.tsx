import { useEffect, useState, useCallback } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Plus, Trash2, Loader2, Check, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Produto {
  id: string;
  nome: string;
  preco_custo?: number;
}

interface TransfItem {
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_compra: number;
}

interface Unidade {
  id: string;
  nome: string;
}

export default function EntregadorTransferencia() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [entregadorUnidadeId, setEntregadorUnidadeId] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [destino, setDestino] = useState("");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<TransfItem[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSel, setProdutoSel] = useState("");
  const [qtdSel, setQtdSel] = useState(1);
  const [historico, setHistorico] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: ent } = await supabase
        .from("entregadores")
        .select("id, unidade_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!ent) { setLoading(false); return; }
      setEntregadorId(ent.id);
      setEntregadorUnidadeId(ent.unidade_id);

      // Fetch products from active carregamento
      const { data: carreg } = await supabase
        .from("carregamentos_rota")
        .select("id")
        .eq("entregador_id", ent.id)
        .eq("status", "em_rota")
        .order("data_saida", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (carreg) {
        const { data: cItens } = await supabase
          .from("carregamento_rota_itens")
          .select("produto_id, quantidade_saida, quantidade_vendida, quantidade_transferida, produtos:produto_id(nome, preco_custo)")
          .eq("carregamento_id", carreg.id);

        setProdutos(
          (cItens || [])
            .filter((i: any) => ((i.quantidade_saida || 0) - (i.quantidade_vendida || 0) - (i.quantidade_transferida || 0)) > 0)
            .map((i: any) => ({
              id: i.produto_id,
              nome: i.produtos?.nome || "Produto",
              preco_custo: i.produtos?.preco_custo || 0,
            }))
        );
      }

      // Fetch unidades
      const { data: uns } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .neq("id", ent.unidade_id || "")
        .order("nome");
      setUnidades(uns || []);

      // Fetch own transfers
      const { data: hist } = await supabase
        .from("transferencias_estoque")
        .select(`
          id, status, valor_total, created_at,
          unidade_destino:unidade_destino_id(nome)
        `)
        .eq("entregador_id", ent.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistorico(hist || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addItem = () => {
    const prod = produtos.find(p => p.id === produtoSel);
    if (!prod) return;
    if (itens.find(i => i.produto_id === produtoSel)) { toast.error("Já adicionado"); return; }
    setItens([...itens, {
      produto_id: prod.id,
      produto_nome: prod.nome,
      quantidade: qtdSel,
      preco_compra: prod.preco_custo || 0,
    }]);
    setProdutoSel("");
    setQtdSel(1);
  };

  const valorTotal = itens.reduce((s, i) => s + i.quantidade * i.preco_compra, 0);

  const handleEnviar = async () => {
    if (!destino || itens.length === 0 || !entregadorId || !entregadorUnidadeId || !user) {
      toast.error("Selecione destino e produtos");
      return;
    }
    setSaving(true);
    try {
      const { data: transf, error } = await supabase
        .from("transferencias_estoque")
        .insert({
          unidade_origem_id: entregadorUnidadeId,
          unidade_destino_id: destino,
          solicitante_id: user.id,
          entregador_id: entregadorId,
          observacoes: obs || null,
          valor_total: valorTotal,
          status: "em_transito",
          data_envio: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("transferencia_estoque_itens").insert(
        itens.map(i => ({
          transferencia_id: transf.id,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_compra: i.preco_compra,
        }))
      );

      // Atualizar quantidade_transferida no carregamento ativo
      const { data: carreg } = await supabase
        .from("carregamentos_rota")
        .select("id")
        .eq("entregador_id", entregadorId)
        .eq("status", "em_rota")
        .order("data_saida", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (carreg) {
        for (const item of itens) {
          const { data: cItem } = await supabase
            .from("carregamento_rota_itens")
            .select("id, quantidade_transferida")
            .eq("carregamento_id", carreg.id)
            .eq("produto_id", item.produto_id)
            .maybeSingle();

          if (cItem) {
            await supabase
              .from("carregamento_rota_itens")
              .update({
                quantidade_transferida: (cItem.quantidade_transferida || 0) + item.quantidade,
              } as any)
              .eq("id", cItem.id);
          }
        }
      }

      toast.success("Transferência registrada!");
      setItens([]);
      setObs("");
      setDestino("");
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  const statusColor: Record<string, string> = {
    pendente: "bg-warning text-white",
    em_transito: "bg-info text-white",
    recebido: "bg-success text-white",
    cancelado: "bg-destructive text-destructive-foreground",
  };

  if (loading) {
    return (
      <EntregadorLayout title="Transferência">
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </EntregadorLayout>
    );
  }

  return (
    <EntregadorLayout title="Transferência">
      <div className="p-4 space-y-4">
        {/* Form */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Nova Transferência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm">Filial Destino</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Select value={produtoSel} onValueChange={setProdutoSel}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min={1} value={qtdSel} onChange={e => setQtdSel(Number(e.target.value))} className="w-16" />
              <Button size="sm" onClick={addItem}><Plus className="h-4 w-4" /></Button>
            </div>

            {itens.map(i => (
              <div key={i.produto_id} className="flex justify-between items-center bg-muted/50 rounded-lg p-2">
                <div>
                  <p className="text-sm font-medium">{i.produto_nome}</p>
                  <p className="text-xs text-muted-foreground">Qtd: {i.quantidade} × R$ {i.preco_compra.toFixed(2)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setItens(itens.filter(x => x.produto_id !== i.produto_id))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            {itens.length > 0 && (
              <div className="text-right font-bold text-sm">Total: R$ {valorTotal.toFixed(2)}</div>
            )}

            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações..." className="text-sm" />

            <Button onClick={handleEnviar} disabled={saving || itens.length === 0} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
              Enviar Transferência
            </Button>
          </CardContent>
        </Card>

        {/* Histórico */}
        {historico.length > 0 && (
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {historico.map((h: any) => (
                <div key={h.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{(h.unidade_destino as any)?.nome}</p>
                    <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">R$ {h.valor_total?.toFixed(2)}</span>
                    <Badge className={statusColor[h.status] || ""}>{h.status === "em_transito" ? "Em Trânsito" : h.status === "recebido" ? "Recebido" : h.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </EntregadorLayout>
  );
}
