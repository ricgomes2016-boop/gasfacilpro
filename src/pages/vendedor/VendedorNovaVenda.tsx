import { useEffect, useState } from "react";
import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Minus, Trash2 } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  preco: number;
}
interface ItemCarrinho extends Produto {
  qtd: number;
}
interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  endereco?: string | null;
}

export default function VendedorNovaVenda() {
  const { user } = useAuth();
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();

  const [tipo, setTipo] = useState<"balcao" | "entrega">("balcao");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pagamento, setPagamento] = useState("dinheiro");
  const [endereco, setEndereco] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!unidadeAtual?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("produtos")
        .select("id, nome, preco")
        .eq("unidade_id", unidadeAtual.id)
        .eq("ativo", true)
        .order("nome")
        .limit(50);
      setProdutos((data as any) || []);
    })();
  }, [unidadeAtual?.id]);

  useEffect(() => {
    if (!unidadeAtual?.id || buscaCliente.length < 2) {
      setClientes([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from("clientes")
        .select("id, nome, telefone, endereco")
        .eq("unidade_id", unidadeAtual.id)
        .or(`nome.ilike.%${buscaCliente}%,telefone.ilike.%${buscaCliente}%`)
        .limit(8);
      setClientes((data as any) || []);
    }, 300);
    return () => clearTimeout(t);
  }, [buscaCliente, unidadeAtual?.id]);

  const total = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);

  const addProduto = (p: Produto) => {
    setCarrinho((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qtd: i.qtd + 1 } : i));
      return [...prev, { ...p, qtd: 1 }];
    });
  };

  const updateQtd = (id: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qtd: i.qtd + delta } : i))
        .filter((i) => i.qtd > 0)
    );
  };

  const finalizar = async () => {
    if (!user?.id || !unidadeAtual?.id) {
      toast.error("Sessão inválida");
      return;
    }
    if (carrinho.length === 0) {
      toast.error("Adicione ao menos um produto");
      return;
    }
    if (tipo === "entrega" && !cliente) {
      toast.error("Selecione um cliente para entrega");
      return;
    }
    setSaving(true);
    try {
      const status = tipo === "balcao" ? "entregue" : "pendente";
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          unidade_id: unidadeAtual.id,
          empresa_id: (unidadeAtual as any).empresa_id,
          vendedor_id: user.id,
          cliente_id: cliente?.id || null,
          status,
          valor_total: total,
          forma_pagamento: pagamento,
          endereco_entrega: tipo === "entrega" ? (endereco || cliente?.endereco || "") : null,
          observacoes: obs || null,
          tipo_venda: tipo,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const itens = carrinho.map((i) => ({
        pedido_id: pedido.id,
        produto_id: i.id,
        quantidade: i.qtd,
        preco_unitario: i.preco,
      }));
      const { error: e2 } = await supabase.from("pedido_itens").insert(itens);
      if (e2) throw e2;

      toast.success(tipo === "balcao" ? "Venda balcão registrada!" : "Pedido enviado para entrega!");
      navigate("/vendedor/historico");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VendedorLayout title="Nova Venda">
      <div className="p-4 space-y-4">
        <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="balcao">Balcão</TabsTrigger>
            <TabsTrigger value="entrega">Entrega</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cliente {tipo === "balcao" && "(opcional)"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cliente ? (
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <p className="font-medium">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground">{cliente.telefone}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setCliente(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar por nome ou telefone"
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                  />
                </div>
                {clientes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCliente(c);
                      setBuscaCliente("");
                      setEndereco(c.endereco || "");
                    }}
                    className="w-full text-left p-2 border rounded-lg hover:bg-accent"
                  >
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.telefone}</p>
                  </button>
                ))}
              </>
            )}
            {tipo === "entrega" && (
              <Input
                placeholder="Endereço de entrega"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-auto">
              {produtos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduto(p)}
                  className="text-left p-2 border rounded-lg hover:bg-accent"
                >
                  <p className="font-medium text-sm truncate">{p.nome}</p>
                  <p className="text-sm text-primary font-bold">
                    R$ {Number(p.preco).toFixed(2)}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {carrinho.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Carrinho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {carrinho.map((i) => (
                <div key={i.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {i.preco.toFixed(2)} × {i.qtd}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQtd(i.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{i.qtd}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQtd(i.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQtd(i.id, -i.qtd)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Pagamento</Label>
              <Select value={pagamento} onValueChange={setPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                  <SelectItem value="fiado">Fiado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-bold text-primary">R$ {total.toFixed(2)}</span>
            </div>
            <Button onClick={finalizar} disabled={saving} className="w-full h-12">
              {saving ? "Salvando..." : tipo === "balcao" ? "Finalizar venda" : "Enviar para entrega"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </VendedorLayout>
  );
}
