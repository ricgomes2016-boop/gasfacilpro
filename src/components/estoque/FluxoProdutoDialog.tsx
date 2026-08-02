import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle, ShoppingCart, Truck } from "lucide-react";

interface FluxoProdutoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string | null;
  produtoNome: string;
  estoqueAtual: number;
  saldoInicial: number;
  inicio: Date;
  fim: Date;
  unidadeId?: string | null;
}

interface Evento {
  data: string;
  tipo: "compra" | "venda" | "entrada" | "saida" | "avaria" | "transferencia";
  descricao: string;
  delta: number;
}

const tipoMeta: Record<Evento["tipo"], { label: string; icon: any; tone: string }> = {
  compra: { label: "Compra", icon: ShoppingCart, tone: "text-success" },
  venda: { label: "Venda", icon: ArrowDownCircle, tone: "text-info" },
  entrada: { label: "Entrada", icon: ArrowUpCircle, tone: "text-success" },
  saida: { label: "Saída", icon: ArrowDownCircle, tone: "text-warning" },
  avaria: { label: "Avaria", icon: AlertTriangle, tone: "text-destructive" },
  transferencia: { label: "Transferência", icon: Truck, tone: "text-muted-foreground" },
};

export function FluxoProdutoDialog({
  open, onOpenChange, produtoId, produtoNome, estoqueAtual, saldoInicial, inicio, fim, unidadeId,
}: FluxoProdutoDialogProps) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !produtoId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const sb = supabase as any;
        const ini = format(inicio, "yyyy-MM-dd");
        const end = format(fim, "yyyy-MM-dd");

        const [comprasQ, vendasQ, movQ] = await Promise.all([
          sb.from("compra_itens")
            .select("quantidade, compras!inner(data_compra, numero_nota, status, fornecedores(nome))")
            .eq("produto_id", produtoId)
            .gte("compras.data_compra", ini)
            .lte("compras.data_compra", end)
            .neq("compras.status", "cancelada"),
          sb.from("pedido_itens")
            .select("quantidade, pedidos!inner(created_at, numero_pedido, status, clientes(nome))")
            .eq("produto_id", produtoId)
            .gte("pedidos.created_at", `${ini}T00:00:00`)
            .lte("pedidos.created_at", `${end}T23:59:59`)
            .neq("pedidos.status", "cancelado"),
          sb.from("movimentacoes_estoque")
            .select("tipo, quantidade, observacoes, data_movimento")
            .eq("produto_id", produtoId)
            .gte("data_movimento", ini)
            .lte("data_movimento", end),
        ]);

        const lista: Evento[] = [];

        (comprasQ.data || []).forEach((c: any) => {
          lista.push({
            data: c.compras?.data_compra || ini,
            tipo: "compra",
            descricao: [c.compras?.fornecedores?.nome, c.compras?.numero_nota ? `NF ${c.compras.numero_nota}` : null]
              .filter(Boolean).join(" · ") || "Compra",
            delta: Number(c.quantidade) || 0,
          });
        });

        (vendasQ.data || []).forEach((v: any) => {
          lista.push({
            data: (v.pedidos?.created_at || "").slice(0, 10),
            tipo: "venda",
            descricao: [v.pedidos?.numero_pedido ? `Pedido #${v.pedidos.numero_pedido}` : null, v.pedidos?.clientes?.nome]
              .filter(Boolean).join(" · ") || "Venda",
            delta: -(Number(v.quantidade) || 0),
          });
        });

        (movQ.data || []).forEach((m: any) => {
          const obs = String(m.observacoes || "");
          if (obs.includes("Baixa automática por venda")) return;
          const isTransf = /transfer/i.test(obs);
          const tipo: Evento["tipo"] = isTransf
            ? "transferencia"
            : m.tipo === "entrada" ? "entrada" : m.tipo === "avaria" ? "avaria" : "saida";
          const qtd = Number(m.quantidade) || 0;
          lista.push({
            data: m.data_movimento,
            tipo,
            descricao: obs || tipoMeta[tipo].label,
            delta: m.tipo === "entrada" ? qtd : -qtd,
          });
        });

        lista.sort((a, b) => a.data.localeCompare(b.data));
        if (!cancelled) setEventos(lista);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, produtoId, inicio, fim, unidadeId]);

  let acumulado = saldoInicial;
  const linhas = eventos.map((e) => {
    acumulado += e.delta;
    return { ...e, saldo: acumulado };
  });
  const divergencia = acumulado - estoqueAtual;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fluxo · {produtoNome}</DialogTitle>
          <DialogDescription>
            {format(inicio, "dd/MM/yyyy")} até {format(fim, "dd/MM/yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Saldo inicial</span>
          <span className="font-semibold tabular-nums">{saldoInicial}</span>
        </div>

        <ScrollArea className="max-h-[50vh] pr-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando fluxo...</p>
          ) : linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação no período.</p>
          ) : (
            <ul className="divide-y divide-border">
              {linhas.map((l, i) => {
                const meta = tipoMeta[l.tipo];
                const Icon = meta.icon;
                return (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <Icon className={`h-4 w-4 shrink-0 ${meta.tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{meta.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {format(new Date(`${l.data}T12:00:00`), "dd/MM")} · {l.descricao}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${l.delta >= 0 ? "text-success" : "text-destructive"}`}>
                      {l.delta > 0 ? `+${l.delta}` : l.delta}
                    </span>
                    <span className="w-12 text-right text-sm font-bold tabular-nums text-foreground">{l.saldo}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Saldo final calculado</span>
            <span className="font-semibold tabular-nums">{acumulado}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Estoque cadastrado</span>
            <span className="font-semibold tabular-nums">{estoqueAtual}</span>
          </div>
          {divergencia !== 0 && !loading && (
            <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Divergência de {divergencia > 0 ? `+${divergencia}` : divergencia} un. — há lançamento faltante ou saldo inicial incorreto.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
