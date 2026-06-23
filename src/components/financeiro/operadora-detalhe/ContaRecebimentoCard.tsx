import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Banknote, Save, AlertCircle, Plug, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { getBankTheme } from "@/lib/bancos/bankThemes";
import { getBankProvider } from "@/lib/bancos/bankProviders";
import { toast } from "sonner";

interface Props {
  operadoraId: string;
  contaBancariaId: string | null;
}

export function ContaRecebimentoCard({ operadoraId, contaBancariaId }: Props) {
  const { unidadeAtual } = useUnidade();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(contaBancariaId || "nenhuma");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(contaBancariaId || "nenhuma");
  }, [contaBancariaId]);

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-bancarias-operadora", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id,nome,banco").eq("ativo", true);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const salvar = async () => {
    setSaving(true);
    const novoId = selected === "nenhuma" ? null : selected;
    const { error } = await supabase
      .from("operadoras_cartao")
      .update({ conta_bancaria_id: novoId })
      .eq("id", operadoraId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Conta de recebimento atualizada");
    qc.invalidateQueries({ queryKey: ["operadora-cartao", operadoraId] });
  };

  const contaAtual = contas.find((c: any) => c.id === contaBancariaId);
  const dirty = (selected === "nenhuma" ? null : selected) !== contaBancariaId;

  return (
    <Card className={!contaBancariaId ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/10" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          Conta de recebimento desta operadora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Todos os recebíveis (crédito, débito e PIX Maq.) desta operadora serão creditados nesta conta quando a baixa for confirmada.
        </p>

        {!contaBancariaId && (
          <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Sem conta vinculada — recebíveis ficam sem destino bancário.
          </div>
        )}

        {contaAtual && (
          <div className="text-xs flex items-center gap-2 p-2 rounded-md bg-muted/40">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Hoje deposita em: <span className="font-medium">{contaAtual.nome}</span>
            <span className="text-muted-foreground">({contaAtual.banco})</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">— Nenhuma —</SelectItem>
                {contas.map((c: any) => {
                  const theme = getBankTheme(c.banco);
                  const provider = getBankProvider(c.banco);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold"
                          style={{ background: theme.primary, color: theme.textColor }}
                        >
                          {theme.initials}
                        </span>
                        <span>{c.nome}</span>
                        {provider && <Plug className="h-3 w-3 text-primary" />}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={salvar} disabled={!dirty || saving} className="gap-1.5">
            <Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
