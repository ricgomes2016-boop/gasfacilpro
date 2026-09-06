import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  RefreshCw,
  MessageCircle,
  Phone,
  GripVertical,
  X,
} from "lucide-react";
import { useFormaPagamentoLabel } from "@/hooks/useFormasPagamentoCustom";

import { Card } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { usePedidos } from "@/hooks/usePedidos";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PedidoFormatado, PedidoStatus } from "@/types/pedido";

type ColKey = "novo" | "conf" | "rota" | "entg" | "canc";

const COLUMNS: {
  key: ColKey;
  label: string;
  emoji: string;
  tone: "amber" | "blue" | "violet" | "green" | "red";
  statuses: PedidoStatus[];
}[] = [
  {
    key: "novo",
    label: "Novos",
    emoji: "🟡",
    tone: "amber",
    statuses: ["pendente"],
  },
  {
    key: "conf",
    label: "Confirmados",
    emoji: "🔵",
    tone: "blue",
    statuses: ["agendado" as PedidoStatus],
  },
  {
    key: "rota",
    label: "Em Rota",
    emoji: "🟣",
    tone: "violet",
    statuses: ["em_rota"],
  },
  {
    key: "entg",
    label: "Entregues",
    emoji: "🟢",
    tone: "green",
    statuses: ["entregue", "finalizado"],
  },
  {
    key: "canc",
    label: "Cancelados",
    emoji: "🔴",
    tone: "red",
    statuses: ["cancelado"],
  },
];

const STATUS_TO_COL: Record<string, ColKey> = {
  pendente: "novo",
  agendado: "conf",
  em_rota: "rota",
  entregue: "entg",
  finalizado: "entg",
  cancelado: "canc",
};

const COL_PRIMARY_STATUS: Record<ColKey, PedidoStatus> = {
  novo: "pendente",
  conf: "agendado" as PedidoStatus,
  rota: "em_rota",
  entg: "entregue",
  canc: "cancelado",
};

function getNumero(p: { numero_sequencial?: number | null; id: string }) {
  return p.numero_sequencial != null
    ? String(p.numero_sequencial).padStart(4, "0")
    : p.id.substring(0, 4).toUpperCase();
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default function PedidosKanban() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const hoje = format(new Date(), "yyyy-MM-dd");

  const { pedidos, isLoading, atualizarStatus, atribuirEntregador } =
    usePedidos({
      dataInicio: hoje,
      dataFim: hoje,
    });

  const [filtroEntregador, setFiltroEntregador] = useState<string>("todos");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: entregadores = [] } = useQuery({
    queryKey: ["entregadores-kanban", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("entregadores")
        .select("id, nome")
        .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
        .order("nome");
      return data || [];
    },
  });

  const pedidosFiltrados = useMemo(() => {
    if (filtroEntregador === "todos") return pedidos;
    if (filtroEntregador === "sem")
      return pedidos.filter((p) => !p.entregador_id);
    return pedidos.filter((p) => p.entregador_id === filtroEntregador);
  }, [pedidos, filtroEntregador]);

  const porColuna = useMemo(() => {
    const map: Record<ColKey, PedidoFormatado[]> = {
      novo: [],
      conf: [],
      rota: [],
      entg: [],
      canc: [],
    };
    for (const p of pedidosFiltrados) {
      const col = STATUS_TO_COL[p.status] ?? "novo";
      map[col].push(p);
    }
    return map;
  }, [pedidosFiltrados]);

  const totais = useMemo(() => {
    const total = pedidosFiltrados
      .filter((p) => p.status !== "cancelado")
      .reduce((acc, p) => acc + (p.valor || 0), 0);
    return {
      novo: porColuna.novo.length,
      conf: porColuna.conf.length,
      rota: porColuna.rota.length,
      entg: porColuna.entg.length,
      total,
    };
  }, [pedidosFiltrados, porColuna]);

  const pedidoAberto = openId
    ? (pedidos.find((p) => p.id === openId) ?? null)
    : null;

  function onDragStart(e: React.DragEvent, pedidoId: string) {
    e.dataTransfer.setData("text/plain", pedidoId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDrop(e: React.DragEvent, col: ColKey) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;
    const currentCol = STATUS_TO_COL[pedido.status] ?? "novo";
    if (currentCol === col) return;
    atualizarStatus({ pedidoId: id, novoStatus: COL_PRIMARY_STATUS[col] });
    toast.success("Status atualizado");
  }

  return (
    <MainLayout>
      <Header title="Pedidos — Kanban" subtitle="Visualização por status" />
      <div className="px-3 md:px-6 py-4 space-y-4">
        {/* Top bar */}
        <Card className="p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex-1 min-w-[180px]">
              <div className="text-xs text-muted-foreground">
                Pedidos — Kanban
              </div>
              <div className="text-sm font-semibold capitalize">
                {format(new Date(), "EEEE, dd 'de' MMMM yyyy", {
                  locale: ptBR,
                })}
              </div>
            </div>

            <Select
              value={filtroEntregador}
              onValueChange={setFiltroEntregador}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Entregador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos entregadores</SelectItem>
                <SelectItem value="sem">Sem entregador</SelectItem>
                {entregadores.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["pedidos"] })
              }
            >
              <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => navigate("/vendas/nova")}>
              <Plus className="h-4 w-4 mr-1.5" /> Nova Venda
            </Button>
          </div>
        </Card>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiTile tone="amber" label="Novos" value={String(totais.novo)} />
          <KpiTile
            tone="blue"
            label="Confirmados"
            value={String(totais.conf)}
          />
          <KpiTile tone="violet" label="Em Rota" value={String(totais.rota)} />
          <KpiTile tone="green" label="Entregues" value={String(totais.entg)} />
          <KpiTile tone="sky" label="Total do Dia" value={brl(totais.total)} />
        </div>

        {/* Board */}
        <div className="flex flex-col md:flex-row gap-3 md:overflow-x-auto pb-2 md:-mx-3 md:px-3">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className="w-full md:flex-shrink-0 md:w-[300px] flex flex-col"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, col.key)}
            >
              <ColumnHeader col={col} count={porColuna[col.key].length} />
              <div className="bg-muted/30 border border-border/60 border-t-0 rounded-b-[var(--radius)] p-2 flex-1 min-h-[120px] space-y-2 overflow-y-auto md:max-h-[calc(100vh-320px)]">
                {porColuna[col.key].length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    {isLoading ? "Carregando…" : "Vazio"}
                  </div>
                )}
                {porColuna[col.key].map((p) => (
                  <KanbanCard
                    key={p.id}
                    pedido={p}
                    onOpen={() => setOpenId(p.id)}
                    onDragStart={(e) => onDragStart(e, p.id)}
                    toneVar={`var(--tile-${col.tone})`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <DetailModal
          pedido={pedidoAberto}
          open={!!pedidoAberto}
          onClose={() => setOpenId(null)}
          entregadores={entregadores}
          onChangeStatus={(s) =>
            pedidoAberto &&
            atualizarStatus({ pedidoId: pedidoAberto.id, novoStatus: s })
          }
          onChangeEntregador={(id) =>
            pedidoAberto &&
            atribuirEntregador({ pedidoId: pedidoAberto.id, entregadorId: id })
          }
        />
      </div>
    </MainLayout>
  );
}

function KpiTile({
  tone,
  label,
  value,
}: {
  tone: "amber" | "blue" | "violet" | "green" | "sky";
  label: string;
  value: string;
}) {
  return (
    <Card variant="kpi" tone={tone} className="px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/85 font-medium">
        {label}
      </div>
      <div className="text-2xl font-extrabold text-white tabular-nums mt-0.5">
        {value}
      </div>
    </Card>
  );
}

function ColumnHeader({
  col,
  count,
}: {
  col: (typeof COLUMNS)[number];
  count: number;
}) {
  return (
    <div
      className="rounded-t-[var(--radius)] border border-border/60 px-3 py-2 flex items-center justify-between font-semibold text-sm"
      style={{
        background: `color-mix(in srgb, var(--tile-${col.tone}) 10%, transparent)`,
        borderTopColor: `var(--tile-${col.tone})`,
        borderTopWidth: 3,
      }}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden>{col.emoji}</span> {col.label}
      </span>
      <span
        className="text-xs px-2 py-0.5 rounded-[var(--radius)] font-bold tabular-nums text-white"
        style={{ background: `var(--tile-${col.tone})` }}
      >
        {count}
      </span>
    </div>
  );
}

function KanbanCard({
  pedido,
  onOpen,
  onDragStart,
  toneVar,
}: {
  pedido: PedidoFormatado;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  toneVar: string;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="group bg-card border border-border/70 rounded-[var(--radius)] p-2.5 cursor-pointer hover:border-primary/40 hover:shadow-sm transition relative"
      style={{ borderLeft: `3px solid ${toneVar}` }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-muted-foreground">
            #{getNumero(pedido)}
          </div>
          <div className="text-sm font-semibold text-foreground truncate">
            {pedido.cliente}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {pedido.produtos}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
        <span className="text-sm font-bold text-foreground tabular-nums">
          {brl(pedido.valor)}
        </span>
        {pedido.entregador && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {pedido.entregador}
          </Badge>
        )}
      </div>
    </div>
  );
}

function DetailModal({
  pedido,
  open,
  onClose,
  entregadores,
  onChangeStatus,
  onChangeEntregador,
}: {
  pedido: PedidoFormatado | null;
  open: boolean;
  onClose: () => void;
  entregadores: { id: string; nome: string }[];
  onChangeStatus: (s: PedidoStatus) => void;
  onChangeEntregador: (id: string) => void;
}) {
  const formaLabel = useFormaPagamentoLabel();
  if (!pedido) return null;
  const colAtual = STATUS_TO_COL[pedido.status] ?? "novo";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedido #{getNumero(pedido)}</DialogTitle>
          <div className="text-xs text-muted-foreground">
            {pedido.data} · {formaLabel(pedido.forma_pagamento)}
          </div>
        </DialogHeader>

        {/* Status chips */}
        <div className="flex flex-wrap gap-1.5">
          {COLUMNS.map((c) => (
            <button
              key={c.key}
              onClick={() => onChangeStatus(COL_PRIMARY_STATUS[c.key])}
              className="text-xs px-2.5 py-1 rounded-[var(--radius)] border transition"
              style={
                colAtual === c.key
                  ? {
                      background: `var(--tile-${c.tone})`,
                      color: "white",
                      borderColor: `var(--tile-${c.tone})`,
                    }
                  : { borderColor: "hsl(var(--border))" }
              }
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <Section label="Cliente">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-[var(--radius)] bg-primary/10 text-primary text-xs font-bold grid place-items-center">
              {initials(pedido.cliente)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {pedido.cliente}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {pedido.endereco}
              </div>
            </div>
            <Button size="icon" variant="outline" className="h-8 w-8">
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8">
              <Phone className="h-4 w-4" />
            </Button>
          </div>
        </Section>

        <Section label="Produtos">
          <div className="text-sm text-muted-foreground">{pedido.produtos}</div>
        </Section>

        <div className="grid grid-cols-2 gap-3">
          <Section label="Entregador">
            <Select
              value={pedido.entregador_id ?? ""}
              onValueChange={onChangeEntregador}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Atribuir" />
              </SelectTrigger>
              <SelectContent>
                {entregadores.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>
          <Section label="Pagamento">
            <div className="text-sm font-medium">
              {formaLabel(pedido.forma_pagamento)}
            </div>
          </Section>
        </div>

        {pedido.observacoes && (
          <Section label="Observações">
            <div className="text-xs text-muted-foreground">
              {pedido.observacoes}
            </div>
          </Section>
        )}

        <div className="bg-primary/5 rounded-[var(--radius)] px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-xl font-extrabold text-primary tabular-nums">
            {brl(pedido.valor)}
          </span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
