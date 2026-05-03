import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, DollarSign, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Produto {
  id: string;
  nome: string;
  preco: number;
  categoria: string | null;
}

interface PrecoNegociado {
  produto_id: string;
  preco_negociado: number;
  ativo: boolean;
}

interface Props {
  clienteId: string;
}

export function PrecosNegociadosTab({ clienteId }: Props) {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [precosOriginais, setPrecosOriginais] = useState<Record<string, number>>({});
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setLoading(true);
      try {
        let pq = supabase
          .from("produtos")
          .select("id, nome, preco, categoria")
          .eq("ativo", true)
          .or("tipo_botijao.is.null,tipo_botijao.neq.vazio")
          .order("nome");
        if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
        const { data: prods } = await pq;

        const { data: negs } = await supabase
          .from("cliente_precos_negociados")
          .select("produto_id, preco_negociado, ativo")
          .eq("cliente_id", clienteId);

        if (cancel) return;
        const map: Record<string, string> = {};
        const orig: Record<string, number> = {};
        (negs || []).forEach((n: PrecoNegociado) => {
          if (n.ativo) {
            map[n.produto_id] = String(n.preco_negociado);
            orig[n.produto_id] = Number(n.preco_negociado);
          }
        });
        setProdutos((prods || []) as Produto[]);
        setPrecos(map);
        setPrecosOriginais(orig);
      } catch (e: any) {
        toast({ title: "Erro", description: e.message || "Falha ao carregar", variant: "destructive" });
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    return () => { cancel = true; };
  }, [clienteId, unidadeAtual?.id]);

  const produtosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return produtos;
    return produtos.filter((p) => p.nome.toLowerCase().includes(t));
  }, [produtos, busca]);

  const salvarPreco = async (produtoId: string) => {
    if (!empresa?.id) return;
    const valorStr = (precos[produtoId] || "").replace(",", ".");
    const valor = parseFloat(valorStr);
    setSaving(produtoId);
    try {
      if (!valorStr || isNaN(valor) || valor <= 0) {
        // Remove negotiated price
        const { error } = await supabase
          .from("cliente_precos_negociados")
          .delete()
          .eq("cliente_id", clienteId)
          .eq("produto_id", produtoId);
        if (error) throw error;
        const next = { ...precos }; delete next[produtoId]; setPrecos(next);
        const o = { ...precosOriginais }; delete o[produtoId]; setPrecosOriginais(o);
        toast({ title: "Preço removido" });
      } else {
        const payload = {
          cliente_id: clienteId,
          produto_id: produtoId,
          preco_negociado: valor,
          empresa_id: empresa.id,
          unidade_id: unidadeAtual?.id || null,
          ativo: true,
        };
        const { error } = await supabase
          .from("cliente_precos_negociados")
          .upsert(payload, { onConflict: "cliente_id,produto_id" });
        if (error) throw error;
        setPrecosOriginais({ ...precosOriginais, [produtoId]: valor });
        toast({ title: "Preço salvo" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto..."
          className="pl-9 h-9 text-base md:text-sm"
        />
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <DollarSign className="h-3 w-3" />
        Defina preços especiais. Deixe vazio (ou 0) para usar o preço padrão.
      </p>
      <div className="border rounded-lg divide-y max-h-[50vh] overflow-y-auto">
        {produtosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum produto encontrado
          </div>
        ) : (
          produtosFiltrados.map((p) => {
            const valorAtual = precos[p.id] || "";
            const original = precosOriginais[p.id];
            const dirty = (parseFloat(valorAtual.replace(",", ".")) || 0) !== (original || 0);
            return (
              <div key={p.id} className="flex items-center gap-2 p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Padrão: R$ {Number(p.preco || 0).toFixed(2)}
                    {original ? <Badge variant="secondary" className="ml-2 text-[9px] h-4">Negociado</Badge> : null}
                  </p>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorAtual}
                  onChange={(e) => setPrecos({ ...precos, [p.id]: e.target.value })}
                  placeholder="R$"
                  className="h-9 w-24 text-base md:text-sm text-right"
                />
                <Button
                  size="sm"
                  variant={dirty ? "default" : "outline"}
                  className="h-9 shrink-0"
                  disabled={saving === p.id || !dirty}
                  onClick={() => salvarPreco(p.id)}
                >
                  {saving === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
