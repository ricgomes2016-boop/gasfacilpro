import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, PackagePlus, Link2 } from "lucide-react";

export interface NovoProdutoCandidato {
  key: string;
  xProd: string;
  ncm?: string;
  unidade?: string;
  preco_unitario: number;
  categoria_sugerida: "gas" | "agua" | "outros";
  ai_motivo?: string;
}

export interface ProdutoExistenteOption {
  id: string;
  nome: string;
}

export type DecisaoItem =
  | { tipo: "criar" }
  | { tipo: "vincular"; produto_id: string }
  | { tipo: "pular" };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidatos: NovoProdutoCandidato[];
  produtosExistentes: ProdutoExistenteOption[];
  onConfirmar: (decisoes: Record<string, DecisaoItem>) => void;
  onCancelar: () => void;
}

export function ConfirmarNovosProdutosDialog({
  open, onOpenChange, candidatos, produtosExistentes, onConfirmar, onCancelar,
}: Props) {
  const [decisoes, setDecisoes] = useState<Record<string, DecisaoItem>>({});

  // default = criar para todos
  useMemo(() => {
    const d: Record<string, DecisaoItem> = {};
    candidatos.forEach(c => { d[c.key] = decisoes[c.key] ?? { tipo: "criar" }; });
    setDecisoes(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatos.map(c => c.key).join("|")]);

  const setDec = (key: string, d: DecisaoItem) => setDecisoes(prev => ({ ...prev, [key]: d }));

  const stats = useMemo(() => {
    let criar = 0, vincular = 0, pular = 0;
    candidatos.forEach(c => {
      const d = decisoes[c.key]?.tipo ?? "criar";
      if (d === "criar") criar++;
      else if (d === "vincular") vincular++;
      else pular++;
    });
    return { criar, vincular, pular };
  }, [candidatos, decisoes]);

  const produtosOrdenados = useMemo(
    () => [...produtosExistentes].sort((a, b) => a.nome.localeCompare(b.nome)),
    [produtosExistentes]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Novos produtos detectados no XML
          </DialogTitle>
          <DialogDescription>
            Verifiquei os itens da nota e estes não bateram com nenhum produto cadastrado.
            Você pode cadastrar automaticamente (com NCM, CFOP, CST, ANP do XML), vincular a um produto existente, ou pular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {candidatos.map((c) => {
            const dec = decisoes[c.key] ?? { tipo: "criar" as const };
            return (
              <div key={c.key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.xProd}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
                      {c.ncm && <Badge variant="secondary">NCM {c.ncm}</Badge>}
                      {c.unidade && <Badge variant="outline">{c.unidade}</Badge>}
                      <Badge variant="outline">R$ {c.preco_unitario.toFixed(2)}</Badge>
                      <Badge>{c.categoria_sugerida}</Badge>
                    </div>
                    {c.ai_motivo && (
                      <div className="text-xs text-muted-foreground mt-1 italic">IA: {c.ai_motivo}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={dec.tipo === "criar"}
                      onCheckedChange={(v) => v && setDec(c.key, { tipo: "criar" })}
                    />
                    <PackagePlus className="h-3.5 w-3.5" /> Cadastrar
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={dec.tipo === "vincular"}
                      onCheckedChange={(v) => v && setDec(c.key, { tipo: "vincular", produto_id: produtosOrdenados[0]?.id ?? "" })}
                    />
                    <Link2 className="h-3.5 w-3.5" /> Vincular a existente
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={dec.tipo === "pular"}
                      onCheckedChange={(v) => v && setDec(c.key, { tipo: "pular" })}
                    />
                    Pular
                  </label>

                  {dec.tipo === "vincular" && (
                    <Select
                      value={dec.produto_id || "nenhum"}
                      onValueChange={(v) => setDec(c.key, { tipo: "vincular", produto_id: v })}
                    >
                      <SelectTrigger className="h-8 flex-1 min-w-[180px]">
                        <SelectValue placeholder="Escolha o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtosOrdenados.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-xs text-muted-foreground mr-auto">
            {stats.criar} a cadastrar · {stats.vincular} vincular · {stats.pular} pular
          </div>
          <Button variant="outline" onClick={onCancelar}>Cancelar importação</Button>
          <Button onClick={() => onConfirmar(decisoes)}>Confirmar e continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
