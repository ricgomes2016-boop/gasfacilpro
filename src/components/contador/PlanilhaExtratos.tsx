import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ExtratoLinha = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: string | null;
  conciliado: boolean | null;
  categoria?: string | null;
  unidade_id?: string | null;
  conta_bancaria_id?: string | null;
};

interface Props {
  linhas: ExtratoLinha[];
  categorias: string[];
  onCategoriaChange?: (id: string, categoria: string | null) => void;
}

type SortKey = "data" | "valor";
type SortDir = "asc" | "desc";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function PlanilhaExtratos({ linhas, categorias, onCategoriaChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState<number>(1);

  const ordenadasCronologico = useMemo(() => {
    return [...linhas].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
    );
  }, [linhas]);

  // Saldo acumulado calculado em ordem cronológica (independente do sort visual)
  const saldoPorId = useMemo(() => {
    const map = new Map<string, number>();
    let acc = 0;
    for (const l of ordenadasCronologico) {
      acc += Number(l.valor ?? 0);
      map.set(l.id, acc);
    }
    return map;
  }, [ordenadasCronologico]);

  const ordenadasVisual = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "data") {
        cmp = new Date(a.data).getTime() - new Date(b.data).getTime();
      } else {
        cmp = Number(a.valor ?? 0) - Number(b.valor ?? 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [linhas, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(ordenadasVisual.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const visiveis = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return ordenadasVisual.slice(start, start + pageSize);
  }, [ordenadasVisual, pageSafe, pageSize]);

  // Totais (refletindo as linhas filtradas que chegaram via props)
  const totais = useMemo(() => {
    const debitos = linhas
      .filter((l) => Number(l.valor) < 0)
      .reduce((s, l) => s + Number(l.valor ?? 0), 0);
    const creditos = linhas
      .filter((l) => Number(l.valor) >= 0)
      .reduce((s, l) => s + Number(l.valor ?? 0), 0);
    const saldoFinal = debitos + creditos;
    // saldo inicial = 0 antes da primeira movimentação (não há saldo prévio confiável aqui)
    const saldoInicial = 0;
    return { debitos, creditos, saldoFinal, saldoInicial };
  }, [linhas]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleCategoriaChange = async (id: string, novaCategoria: string) => {
    const valor = novaCategoria === "__none__" ? null : novaCategoria;
    try {
      const { error } = await (supabase.from("extrato_bancario" as any) as any)
        .update({ categoria: valor })
        .eq("id", id);
      if (error) throw error;
      onCategoriaChange?.(id, valor);
      toast.success("Categoria atualizada");
    } catch (e: any) {
      toast.error("Erro ao salvar categoria: " + e.message);
    }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  if (linhas.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-[hsl(220,10%,55%)]">
        Nenhuma transação corresponde aos filtros.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-[hsl(220,18%,13%)] text-[hsl(220,10%,60%)] text-xs uppercase">
            <tr>
              <th
                className="px-3 py-3 text-left whitespace-nowrap cursor-pointer hover:text-[hsl(0,0%,90%)] w-[110px]"
                onClick={() => toggleSort("data")}
              >
                <span className="inline-flex items-center gap-1">
                  Data <SortIcon active={sortKey === "data"} dir={sortDir} />
                </span>
              </th>
              <th className="px-3 py-3 text-left">Descrição</th>
              <th
                className="px-3 py-3 text-right whitespace-nowrap cursor-pointer hover:text-[hsl(0,0%,90%)] w-[120px]"
                onClick={() => toggleSort("valor")}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  Débito <SortIcon active={sortKey === "valor"} dir={sortDir} />
                </span>
              </th>
              <th className="px-3 py-3 text-right whitespace-nowrap w-[120px]">Crédito</th>
              <th className="px-3 py-3 text-right whitespace-nowrap w-[130px]">Saldo</th>
              <th className="px-3 py-3 text-left w-[180px]">Categoria</th>
              <th className="px-3 py-3 text-left w-[100px]">Conciliado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(220,15%,18%)]">
            {visiveis.map((l) => {
              const v = Number(l.valor ?? 0);
              const isDeb = v < 0;
              const saldoAcum = saldoPorId.get(l.id) ?? 0;
              const suspeito = v === 0 || Math.abs(v) > 100000;
              return (
                <tr key={l.id} className="hover:bg-[hsl(220,18%,13%)]">
                  <td className="px-3 py-2 text-[hsl(220,10%,75%)] whitespace-nowrap">
                    {format(new Date(l.data + "T12:00:00"), "dd/MM/yyyy")}
                  </td>
                  <td className="px-3 py-2 text-[hsl(0,0%,90%)] max-w-md">
                    <div className="flex items-center gap-2">
                      {suspeito && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {v === 0 ? "Valor zero — revisar" : "Valor alto — revisar"}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate block">{l.descricao}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">{l.descricao}</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-destructive">
                    {isDeb ? brl(Math.abs(v)) : ""}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-success">
                    {!isDeb ? brl(v) : ""}
                  </td>
                  <td
                    className={`px-3 py-2 text-right whitespace-nowrap font-medium ${
                      saldoAcum >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {brl(saldoAcum)}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={l.categoria ?? "__none__"}
                      onValueChange={(v) => handleCategoriaChange(l.id, v)}
                    >
                      <SelectTrigger className="h-8 bg-[hsl(220,18%,13%)] border-[hsl(220,15%,22%)] text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
                        <SelectItem value="__none__">—</SelectItem>
                        {categorias.length === 0 ? (
                          <SelectItem value="__sem_categoria__" disabled>Cadastre categorias em Configurações</SelectItem>
                        ) : categorias.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    {l.conciliado ? (
                      <Badge
                        className="bg-success/15 text-success border-success/30"
                        variant="outline"
                      >
                        Sim
                      </Badge>
                    ) : (
                      <Badge
                        className="bg-warning/15 text-warning border-warning/30"
                        variant="outline"
                      >
                        Não
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-[hsl(220,18%,13%)] text-xs">
            <tr className="border-t-2 border-[hsl(220,15%,22%)]">
              <td colSpan={2} className="px-3 py-3 text-[hsl(220,10%,60%)] uppercase font-semibold">
                Totais
              </td>
              <td className="px-3 py-3 text-right font-semibold text-destructive whitespace-nowrap">
                {brl(Math.abs(totais.debitos))}
              </td>
              <td className="px-3 py-3 text-right font-semibold text-success whitespace-nowrap">
                {brl(totais.creditos)}
              </td>
              <td
                className={`px-3 py-3 text-right font-semibold whitespace-nowrap ${
                  totais.saldoFinal >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {brl(totais.saldoFinal)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-3 border-t border-[hsl(220,15%,18%)] text-xs text-[hsl(220,10%,60%)]">
        <div className="flex items-center gap-2">
          <span>Linhas por página:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-20 bg-[hsl(220,18%,13%)] border-[hsl(220,15%,22%)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-2">
            {linhas.length} {linhas.length === 1 ? "lançamento" : "lançamentos"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageSafe <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-8 border-[hsl(220,15%,22%)]"
          >
            Anterior
          </Button>
          <span>
            Página {pageSafe} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pageSafe >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-8 border-[hsl(220,15%,22%)]"
          >
            Próxima
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}