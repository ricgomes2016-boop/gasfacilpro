import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Empenho } from "./EmpenhosPanel";

interface Props {
  empenho: Empenho | null;
  onClose: () => void;
  onDone: () => void;
}

export function VincularValesModal({ empenho, onClose, onDone }: Props) {
  const [inicial, setInicial] = useState<number | "">("");
  const [final, setFinal] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (empenho) { setInicial(""); setFinal(""); }
  }, [empenho]);

  const qtdIntervalo = useMemo(() => {
    if (inicial === "" || final === "") return 0;
    return Number(final) - Number(inicial) + 1;
  }, [inicial, final]);

  const bate = empenho && qtdIntervalo === empenho.quantidade;
  const intervaloValido = inicial !== "" && final !== "" && Number(final) >= Number(inicial);

  const handleSave = async () => {
    if (!empenho || !bate) return;
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("vincular_vales_empenho", {
      _empenho_id: empenho.id,
      _numero_inicial: Number(inicial),
      _numero_final: Number(final),
    });
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    toast.success(`${data?.vales_criados ?? qtdIntervalo} vales vinculados ao empenho`);

    // Disparar NF-e automaticamente
    try {
      const { data: nfe } = await supabase.functions.invoke("emitir-nfe-empenho", {
        body: { empenho_id: empenho.id },
      });
      if (nfe?.mock) {
        toast.success(`NF-e simulada gerada: ${nfe.numero}`, {
          description: nfe.informacoes_adicionais,
        });
      } else if (nfe?.pendente) {
        toast.message("NF-e em modo Focus NFe — pendente de emissão", {
          description: nfe.informacoes_adicionais,
        });
      }
    } catch (e: any) {
      toast.error("Vales OK mas falha ao emitir NF-e: " + e.message);
    }

    setSaving(false);
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!empenho} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Intervalo de Vales Físicos</DialogTitle>
        </DialogHeader>
        {empenho && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Empenho:</span> <strong>{empenho.numero_empenho}</strong></div>
              <div><span className="text-muted-foreground">Produto:</span> {empenho.produto_nome}</div>
              <div><span className="text-muted-foreground">Quantidade autorizada:</span> <strong>{empenho.quantidade}</strong></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº Inicial</Label>
                <Input type="number" value={inicial} onChange={(e) => setInicial(e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="Ex: 31" />
              </div>
              <div>
                <Label>Nº Final</Label>
                <Input type="number" value={final} onChange={(e) => setFinal(e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="Ex: 40" />
              </div>
            </div>
            {intervaloValido && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${bate ? "bg-success text-success" : "bg-destructive text-destructive"}`}>
                {bate ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertTriangle className="h-4 w-4 mt-0.5" />}
                <div>
                  {bate
                    ? `Intervalo correto: ${qtdIntervalo} vales (${inicial} a ${final}).`
                    : `A quantidade do intervalo (${qtdIntervalo}) não bate com o empenho (${empenho.quantidade}).`}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!bate || saving}>
            {saving ? "Vinculando..." : "Confirmar e Emitir NF-e"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
