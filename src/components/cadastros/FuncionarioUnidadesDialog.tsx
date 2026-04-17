import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
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
  userId: string;
  funcionarioNome: string;
  onSaved?: () => void;
}

export function FuncionarioUnidadesDialog({
  open, onOpenChange, userId, funcionarioNome, onSaved,
}: Props) {
  const { unidades } = useUnidade();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    supabase
      .from("user_unidades")
      .select("unidade_id")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (!error && data) {
          setSelectedIds(new Set(data.map((d: any) => d.unidade_id)));
        }
        setLoading(false);
      });
  }, [open, userId]);

  const toggle = (unidadeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unidadeId)) next.delete(unidadeId);
      else next.add(unidadeId);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      toast.error("O funcionário deve estar associado a pelo menos uma filial.");
      return;
    }
    setSaving(true);
    try {
      const { error: delError } = await supabase
        .from("user_unidades")
        .delete()
        .eq("user_id", userId);
      if (delError) throw delError;

      const rows = Array.from(selectedIds).map((unidade_id) => ({
        user_id: userId,
        unidade_id,
      }));

      const { error: insError } = await supabase
        .from("user_unidades")
        .insert(rows);
      if (insError) throw insError;

      toast.success("Filiais do funcionário atualizadas!");
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao atualizar filiais:", err);
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
            Filiais do Funcionário
          </DialogTitle>
          <DialogDescription>
            Selecione em quais filiais "{funcionarioNome}" pode atuar.
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
