import { Building2, Store, Crown, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { useContador } from "@/contexts/ContadorContext";
import { Badge } from "@/components/ui/badge";

export function SeletorEmpresaUnidade() {
  const { empresas, empresaAtiva, setEmpresaAtiva, unidades, unidadeAtiva, setUnidadeAtiva } = useContador();

  if (empresas.length === 0) return null;

  const matrizes = unidades.filter((u) => u.tipo === "matriz");
  const filiais = unidades.filter((u) => u.tipo !== "matriz");
  const totalLojas = unidades.length;

  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Building2 className="h-4 w-4 text-[hsl(165,60%,55%)] shrink-0" />
        <Select
          value={empresaAtiva?.empresa_id ?? ""}
          onValueChange={(v) => {
            const e = empresas.find((x) => x.empresa_id === v) ?? null;
            setEmpresaAtiva(e);
          }}
        >
          <SelectTrigger className="bg-[hsl(220,18%,15%)] border-[hsl(220,15%,22%)] text-white h-9 text-xs">
            <SelectValue placeholder="Selecione a empresa" />
          </SelectTrigger>
          <SelectContent>
            {empresas.map((e) => (
              <SelectItem key={e.empresa_id} value={e.empresa_id}>
                {e.empresa_nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Store className="h-4 w-4 text-[hsl(220,10%,55%)] shrink-0" />
        <Select
          value={unidadeAtiva?.id ?? "__all__"}
          onValueChange={(v) => {
            if (v === "__all__") setUnidadeAtiva(null);
            else {
              const u = unidades.find((x) => x.id === v) ?? null;
              setUnidadeAtiva(u);
            }
          }}
          disabled={!empresaAtiva || unidades.length === 0}
        >
          <SelectTrigger className="bg-[hsl(220,18%,15%)] border-[hsl(220,15%,22%)] text-white h-9 text-xs">
            <SelectValue placeholder="Todas as lojas" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="__all__">
              <span className="flex items-center gap-2">
                <span className="font-medium">Todas as lojas</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{totalLojas}</Badge>
              </span>
            </SelectItem>

            {matrizes.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[hsl(165,60%,55%)]">
                    <Crown className="h-3 w-3" /> Matriz
                  </SelectLabel>
                  {matrizes.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}

            {filiais.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[hsl(220,10%,60%)]">
                    <MapPin className="h-3 w-3" /> Filiais ({filiais.length})
                  </SelectLabel>
                  {filiais.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
