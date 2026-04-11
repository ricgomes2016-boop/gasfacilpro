import { useState, useEffect } from "react";
import {
  ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle, ResponsiveDialogFooter as DialogFooter, ResponsiveDialogDescription as DialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
  onSaved?: () => void;
}

export function ClienteUnidadesDialog({ open, onOpenChange, clienteId, clienteNome, onSaved }: Props) {
  const { unidades } = useUnidade();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !clienteId) return;
    setLoading(true);

    supabase
      .from("cliente_unidades")
      .select("unidade_id")
      .eq("cliente_id", clienteId)
      .then(({ data, error }) => {
        if (!error && data) {
          setSelectedIds(new Set(data.map((d: any) => d.unidade_id)));
        }
        setLoading(false);
      });
  }, [open, clienteId]);

  const toggle = (unidadeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unidadeId)) {
        next.delete(unidadeId);
      } else {
        next.add(unidadeId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      toast.error("O cliente deve estar associado a pelo menos uma unidade.");
      return;
    }

    setSaving(true);
    try {
      // Delete all existing associations
      const { error: delError } = await supabase
        .from("cliente_unidades")
        .delete()
        .eq("cliente_id", clienteId);
      if (delError) throw delError;

      // Insert new associations
      const rows = Array.from(selectedIds).map((unidade_id) => ({
        cliente_id: clienteId,
        unidade_id,
      }));

      const { error: insError } = await supabase
        .from("cliente_unidades")
        .insert(rows);
      if (insError) throw insError;

      toast.success("Unidades do cliente atualizadas!");
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao atualizar unidades:", err);
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Unidades do Cliente
          </DialogTitle>
          <DialogDescription>
            Selecione em quais unidades "{clienteNome}" deve aparecer.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {unidades.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => toggle(u.id)}
              >
                <Checkbox
                  checked={selectedIds.has(u.id)}
                  onCheckedChange={() => toggle(u.id)}
                />
                <div className="flex-1 min-w-0">
                  <Label className="cursor-pointer font-medium text-sm">{u.nome}</Label>
                </div>
                <Badge
                  variant={u.tipo === "matriz" ? "default" : "secondary"}
                  className="text-xs capitalize"
                >
                  {u.tipo}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
