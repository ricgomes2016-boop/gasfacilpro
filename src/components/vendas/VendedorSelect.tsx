import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";
import { VendaSectionHeader } from "./VendaSectionHeader";

interface Vendedor {
  id: string;
  user_id: string | null;
  nome: string;
  is_transporte?: boolean | null;
}

interface VendedorSelectProps {
  value: string | null;
  onChange: (id: string | null, nome: string | null) => void;
}

export function VendedorSelect({ value, onChange }: VendedorSelectProps) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    const run = async () => {
      try {
        let q = supabase
          .from("funcionarios")
          .select("id, user_id, nome, is_transporte")
          .eq("ativo", true)
          .eq("is_vendedor", true)
          .not("user_id", "is", null)
          .order("nome");
        if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
        const { data, error } = await q;
        if (!error && data) setVendedores(data as unknown as Vendedor[]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [unidadeAtual?.id]);

  const handleSelect = (id: string) => {
    if (id === "nenhum") {
      onChange(null, null);
      return;
    }
    const v = vendedores.find((x) => x.user_id === id);
    if (v?.user_id) onChange(v.user_id, v.nome);
  };

  if (!loading && vendedores.length === 0) return null;

  return (
    <Card className="venda-card overflow-hidden">
      <VendaSectionHeader title="Vendedor (comissão)" icon={<UserCheck className="h-5 w-5" />} tone="primary" />
      <CardContent className="space-y-3 p-4">
        <Select value={value || "nenhum"} onValueChange={handleSelect} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Carregando..." : "Sem vendedor"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">— Sem vendedor —</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v.id} value={v.user_id!}>
                {v.nome}{v.is_transporte ? " (entregador)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-2">
          {vendedores.map((v) => {
            const selected = value === v.user_id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => v.user_id && handleSelect(v.user_id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                <span>{v.nome}</span>
                {v.is_transporte && (
                  <Badge variant="secondary" className="text-[10px]">Entregador</Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
