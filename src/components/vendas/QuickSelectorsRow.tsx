import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Truck, Package, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ItemVenda } from "./ProductSearch";
import type { Pagamento } from "./PaymentSection";

interface Entregador {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
}

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "pix_maquininha", label: "PIX Maquininha" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "fiado", label: "Fiado / A Prazo" },
  { value: "vale_gas", label: "Vale Gás" },
  { value: "cheque", label: "Cheque" },
];

interface QuickSelectorsRowProps {
  unidadeId?: string | null;
  clienteId?: string | null;
  entregadorId: string | null;
  itens: ItemVenda[];
  onItensChange: (itens: ItemVenda[]) => void;
  pagamentos: Pagamento[];
  onPagamentosChange: (pagamentos: Pagamento[]) => void;
  totalVenda: number;
  onSelectEntregador: (id: string, nome: string) => void;
  onVendedorAuto?: (vendedorUserId: string | null, nome: string | null) => void;
}

export function QuickSelectorsRow({
  unidadeId,
  clienteId,
  entregadorId,
  itens,
  onItensChange,
  pagamentos,
  onPagamentosChange,
  totalVenda,
  onSelectEntregador,
  onVendedorAuto,
}: QuickSelectorsRowProps) {
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("entregadores")
        .select("id, nome, vendedor_user_id")
        .eq("ativo", true)
        .order("nome");
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data } = await q;
      if (data) setEntregadores(data as Entregador[]);
    })();
  }, [unidadeId]);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("produtos")
        .select("id, nome, preco")
        .eq("ativo", true)
        .or("tipo_botijao.is.null,tipo_botijao.neq.vazio")
        .order("nome")
        .limit(200);
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data } = await q;
      if (data) setProdutos(data as Produto[]);
    })();
  }, [unidadeId]);

  const handleEntregador = (id: string) => {
    const e = entregadores.find((x) => x.id === id);
    if (!e) return;
    onSelectEntregador(e.id, e.nome);
    onVendedorAuto?.(e.vendedor_user_id ?? null, e.nome);
  };

  const handleAddProduto = async (id: string) => {
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    const idx = itens.findIndex((i) => i.produto_id === p.id);
    if (idx >= 0) {
      const next = [...itens];
      next[idx] = {
        ...next[idx],
        quantidade: next[idx].quantidade + 1,
        total: (next[idx].quantidade + 1) * next[idx].preco_unitario,
      };
      onItensChange(next);
      return;
    }
    let preco = p.preco;
    if (clienteId) {
      try {
        const { data: precoNeg } = await supabase
          .from("cliente_precos_negociados")
          .select("preco_negociado")
          .eq("cliente_id", clienteId)
          .eq("produto_id", p.id)
          .eq("ativo", true)
          .maybeSingle();
        if (precoNeg) preco = Number(precoNeg.preco_negociado);
      } catch {}
    }
    onItensChange([
      ...itens,
      {
        id: crypto.randomUUID(),
        produto_id: p.id,
        nome: p.nome,
        quantidade: 1,
        preco_unitario: preco,
        total: preco,
      },
    ]);
  };

  const formaAtual = pagamentos[0]?.forma ?? "";

  const handlePagamento = (forma: string) => {
    const valor = totalVenda > 0 ? totalVenda : pagamentos[0]?.valor ?? 0;
    if (pagamentos.length === 0) {
      onPagamentosChange([
        { id: crypto.randomUUID(), forma, valor },
      ]);
    } else {
      const next = [...pagamentos];
      next[0] = { ...next[0], forma, valor };
      onPagamentosChange(next);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1 text-muted-foreground">
          <Truck className="h-3.5 w-3.5" /> Entregador
        </Label>
        <Select value={entregadorId ?? undefined} onValueChange={handleEntregador}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            {entregadores.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1 text-muted-foreground">
          <Package className="h-3.5 w-3.5" /> Adicionar produto
        </Label>
        <Select value="" onValueChange={handleAddProduto}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Selecionar produto..." />
          </SelectTrigger>
          <SelectContent>
            {produtos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1 text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5" /> Pagamento
        </Label>
        <Select value={formaAtual || undefined} onValueChange={handlePagamento}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            {FORMAS_PAGAMENTO.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
