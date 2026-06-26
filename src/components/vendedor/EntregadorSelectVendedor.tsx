import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

export interface EntregadorOption {
  id: string;
  nome: string;
  telefone: string | null;
}

interface Props {
  value: string | null;
  onChange: (entregador: EntregadorOption | null) => void;
}

export function EntregadorSelectVendedor({ value, onChange }: Props) {
  const { unidadeAtual } = useUnidade();
  const [entregadores, setEntregadores] = useState<EntregadorOption[]>([]);

  useEffect(() => {
    if (!unidadeAtual?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("entregadores")
        .select("id, nome, telefone, ativo")
        .eq("unidade_id", unidadeAtual.id)
        .eq("ativo", true)
        .order("nome");
      setEntregadores(((data as any[]) || []).map((e) => ({
        id: e.id, nome: e.nome, telefone: e.telefone,
      })));
    })();
  }, [unidadeAtual?.id]);

  const items = useMemo(() => entregadores, [entregadores]);

  return (
    <div>
      <Label>Entregador *</Label>
      <Select
        value={value || "nenhum"}
        onValueChange={(v) => {
          if (v === "nenhum") { onChange(null); return; }
          const found = items.find((e) => e.id === v) || null;
          onChange(found);
        }}
      >
        <SelectTrigger><SelectValue placeholder="Selecione o entregador" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="nenhum">—</SelectItem>
          {items.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nome}{e.telefone ? ` — ${e.telefone}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
