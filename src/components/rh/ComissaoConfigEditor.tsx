import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, Loader2, Store, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function ComissaoConfigEditor() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, Record<string, number>>>({});
  const [activeTab, setActiveTab] = useState<string>("");
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("");
  const [copyFromUnidadeId, setCopyFromUnidadeId] = useState<string>("");
  const [isCopying, setIsCopying] = useState(false);

  // Fetch unidades
  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades-comissao"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
    enabled: open,
  });

  // Set default unidade when data loads
  useEffect(() => {
    if (unidades.length > 0 && !selectedUnidadeId) {
      setSelectedUnidadeId(unidadeAtual?.id || unidades[0].id);
    }
  }, [unidades, unidadeAtual]);

  // Fetch products filtered by selected store, exclude "Vazio"
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-comissao-config", selectedUnidadeId],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("id, nome, categoria, tipo_botijao")
        .eq("ativo", true)
        .not("tipo_botijao", "eq", "vazio")
        .order("nome");
      if (selectedUnidadeId) {
        query = query.eq("unidade_id", selectedUnidadeId);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: open && !!selectedUnidadeId,
  });

  // Fetch active sales channels from DB
  const { data: canaisVenda = [] } = useQuery({
    queryKey: ["canais-venda-comissao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("canais_venda")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: open,
  });

  // Fetch existing config for selected unidade
  const { data: configExistente = [], isLoading } = useQuery({
    queryKey: ["comissao-config-editor", selectedUnidadeId],
    queryFn: async () => {
      let query = supabase.from("comissao_config").select("*");
      if (selectedUnidadeId) {
        query = query.eq("unidade_id", selectedUnidadeId);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: open && !!selectedUnidadeId,
  });

  // Initialize edit values when data loads
  useEffect(() => {
    if (!produtos.length || !canaisVenda.length) return;

    const values: Record<string, Record<string, number>> = {};
    produtos.forEach((p: any) => {
      values[p.id] = {};
      canaisVenda.forEach((c: any) => {
        const existing = configExistente.find(
          (cfg: any) => cfg.produto_id === p.id && cfg.canal_venda === c.nome
        );
        values[p.id][c.nome] = existing ? Number(existing.valor) : 0;
      });
    });
    setEditValues(values);

    if (!activeTab && produtos.length > 0) {
      setActiveTab(produtos[0].id);
    }
  }, [produtos, canaisVenda, configExistente]);

  // Save mutation (upsert idempotente, sem delete)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUnidadeId) throw new Error("Selecione uma loja");

      const upserts: any[] = [];
      Object.entries(editValues).forEach(([produtoId, canais]) => {
        Object.entries(canais).forEach(([canalVenda, valor]) => {
          upserts.push({
            produto_id: produtoId,
            canal_venda: canalVenda,
            valor,
            unidade_id: selectedUnidadeId,
          });
        });
      });

      if (upserts.length > 0) {
        const { error } = await supabase
          .from("comissao_config")
          .upsert(upserts, { onConflict: "unidade_id,produto_id,canal_venda" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Comissões salvas com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["comissao-config"] });
      queryClient.invalidateQueries({ queryKey: ["comissao-config-editor"] });
      queryClient.invalidateQueries({ queryKey: ["comissao-detalhada"] });
    },
    onError: () => {
      toast({ title: "Erro ao salvar comissões", variant: "destructive" });
    },
  });

  const handleValueChange = (produtoId: string, canal: string, valor: string) => {
    const num = parseFloat(valor.replace(",", ".")) || 0;
    setEditValues((prev) => ({
      ...prev,
      [produtoId]: { ...prev[produtoId], [canal]: num },
    }));
  };

  const handleCopyFrom = async () => {
    if (!copyFromUnidadeId || !produtos.length || !canaisVenda.length) return;
    setIsCopying(true);
    try {
      // Fetch config from source store
      const { data: sourceConfig } = await supabase
        .from("comissao_config")
        .select("produto_id, canal_venda, valor")
        .eq("unidade_id", copyFromUnidadeId);

      // Fetch source products to map by name
      const { data: sourceProdutos } = await supabase
        .from("produtos")
        .select("id, nome")
        .eq("ativo", true)
        .eq("unidade_id", copyFromUnidadeId);

      if (!sourceConfig?.length || !sourceProdutos?.length) {
        toast({ title: "Nenhuma configuração encontrada na loja de origem", variant: "destructive" });
        return;
      }

      // Build source map: produto_name|canal -> valor
      const sourceMap = new Map<string, number>();
      sourceConfig.forEach((cfg: any) => {
        const prodName = sourceProdutos.find((p: any) => p.id === cfg.produto_id)?.nome;
        if (prodName) sourceMap.set(`${prodName}|${cfg.canal_venda}`, Number(cfg.valor));
      });

      // Apply to current products by matching name
      const newValues = { ...editValues };
      produtos.forEach((p: any) => {
        canaisVenda.forEach((c: any) => {
          const val = sourceMap.get(`${p.nome}|${c.nome}`);
          if (val !== undefined) {
            if (!newValues[p.id]) newValues[p.id] = {};
            newValues[p.id][c.nome] = val;
          }
        });
      });
      setEditValues(newValues);
      toast({ title: `Valores copiados da loja de origem! Clique em Salvar para confirmar.` });
    } catch {
      toast({ title: "Erro ao copiar configuração", variant: "destructive" });
    } finally {
      setIsCopying(false);
    }
  };

  const selectedUnidadeNome = unidades.find((u: any) => u.id === selectedUnidadeId)?.nome;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Configurar Comissões
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Comissões por Produto / Canal</DialogTitle>
        </DialogHeader>

        {/* Store selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Store className="h-4 w-4" /> Loja
          </label>
          <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a loja" />
            </SelectTrigger>
            <SelectContent>
              {unidades.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedUnidadeNome && (
            <Badge variant="secondary" className="text-xs">
              Editando: {selectedUnidadeNome}
            </Badge>
          )}

          {/* Copy from another store */}
          <div className="flex items-center gap-2 pt-1">
            <Select value={copyFromUnidadeId} onValueChange={setCopyFromUnidadeId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Copiar de outra loja..." />
              </SelectTrigger>
              <SelectContent>
                {unidades
                  .filter((u: any) => u.id !== selectedUnidadeId)
                  .map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 shrink-0"
              disabled={!copyFromUnidadeId || isCopying}
              onClick={handleCopyFrom}
            >
              {isCopying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
              Copiar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : produtos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum produto cadastrado.</p>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {produtos.map((p: any) => (
                  <TabsTrigger key={p.id} value={p.id} className="text-xs">
                    {p.nome}{selectedUnidadeNome ? ` - ${selectedUnidadeNome}` : ""}
                  </TabsTrigger>
                ))}
              </TabsList>

              {produtos.map((p: any) => (
                <TabsContent key={p.id} value={p.id}>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{p.nome}{selectedUnidadeNome ? ` - ${selectedUnidadeNome}` : ""}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {canaisVenda.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium min-w-[140px]">{c.nome}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-24 text-right"
                              value={editValues[p.id]?.[c.nome] ?? 0}
                              onChange={(e) => handleValueChange(p.id, c.nome, e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                      {canaisVenda.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum canal de venda cadastrado.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !selectedUnidadeId}
                className="gap-2"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Comissões
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
