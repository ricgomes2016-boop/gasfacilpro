import { ReactNode, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  /** Renderização da célula. */
  cell: (row: T) => ReactNode;
  /** Valor usado para ordenação (quando `sortable`). */
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  /** Oculta a coluna em telas menores que lg. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  /** Renderização alternativa em mobile (cards). Se ausente, usa scroll horizontal. */
  mobileCard?: (row: T) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** 0 desativa a paginação. */
  pageSize?: number;
  className?: string;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Tabela canônica do ERP: ordenação, paginação, estados de vazio/carregando
 * e renderização em cards no mobile.
 */
export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading,
  onRowClick,
  mobileCard,
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription,
  emptyAction,
  pageSize = 25,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === "number" && typeof vb === "number") return sort.dir === "asc" ? va - vb : vb - va;
      return sort.dir === "asc"
        ? String(va).localeCompare(String(vb), "pt-BR")
        : String(vb).localeCompare(String(va), "pt-BR");
    });
    return copy;
  }, [data, sort, columns]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const paged = pageSize > 0 ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

  const toggleSort = (id: string) =>
    setSort((prev) =>
      prev?.id === id ? (prev.dir === "asc" ? { id, dir: "desc" } : null) : { id, dir: "asc" },
    );

  if (loading) return <LoadingState rows={6} />;

  if (!data.length) {
    return (
      <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }

  return (
    <div className={cn("w-full min-w-0", className)}>
      {/* Mobile: cards */}
      {mobileCard && (
        <div className="space-y-2 p-2.5 lg:hidden">
          {paged.map((row) => (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "w-full min-w-0 rounded-card border border-border/70 bg-card p-3",
                onRowClick && "cursor-pointer active:bg-muted/40",
              )}
            >
              {mobileCard(row)}
            </div>
          ))}
        </div>
      )}

      {/* Desktop (ou mobile com scroll quando não há mobileCard) */}
      <div className={cn("w-full overflow-x-auto", mobileCard && "hidden lg:block")}>
        <table className="w-full min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    alignClass[col.align ?? "left"],
                    col.hideOnMobile && "hidden lg:table-cell",
                    col.headerClassName,
                  )}
                >
                  {col.sortable && col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.id)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {col.header}
                      {sort?.id === col.id &&
                        (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border/50 transition-colors last:border-0",
                  onRowClick && "cursor-pointer hover:bg-muted/40",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "px-3 py-2.5 align-middle text-foreground",
                      alignClass[col.align ?? "left"],
                      col.hideOnMobile && "hidden lg:table-cell",
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageSize > 0 && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            {sorted.length} registros · página {safePage + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
