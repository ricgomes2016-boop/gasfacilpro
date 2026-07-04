import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bike, Clock, MapPin, Phone, User, Volume2, VolumeX, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PedidoPendente } from "@/hooks/usePedidosPendentesAlert";
import { useFormaPagamentoLabel } from "@/hooks/useFormasPagamentoCustom";

interface Props {
  pedido: PedidoPendente;
  totalPendentes: number;
  somAtivo: boolean;
  onToggleSom: () => void;
  onAceitar: () => void;
  onSnooze: () => void;
}

function formatCanal(canal: string | null): { label: string; color: string } {
  switch (canal) {
    case "site_ia":
      return { label: "🤖 Bia (Site)", color: "bg-purple-500" };
    case "whatsapp":
      return { label: "💬 WhatsApp", color: "bg-green-500" };
    case "telefone":
    case "voip":
      return { label: "📞 Telefone", color: "bg-blue-500" };
    case "balcao":
      return { label: "🏪 Balcão", color: "bg-amber-500" };
    case "app":
      return { label: "📱 App", color: "bg-pink-500" };
    default:
      return { label: canal || "Direto", color: "bg-slate-500" };
  }
}

export function PedidoPendenteModal({
  pedido,
  totalPendentes,
  somAtivo,
  onToggleSom,
  onAceitar,
  onSnooze,
}: Props) {
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const minutosEspera = Math.floor(
    (agora - new Date(pedido.created_at).getTime()) / 60000
  );

  const urgencia: "normal" | "alerta" | "critico" =
    minutosEspera >= 10 ? "critico" : minutosEspera >= 5 ? "alerta" : "normal";

  const canal = formatCanal(pedido.canal_venda);

  // Piscar título da aba quando crítico
  useEffect(() => {
    if (urgencia !== "critico") return;
    const tituloOriginal = document.title;
    let toggle = false;
    const i = setInterval(() => {
      document.title = toggle
        ? "🔴 PEDIDO URGENTE"
        : `(${totalPendentes}) ${tituloOriginal}`;
      toggle = !toggle;
    }, 1000);
    return () => {
      clearInterval(i);
      document.title = tituloOriginal;
    };
  }, [urgencia, totalPendentes]);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className={cn(
          "max-w-md border-4 transition-all",
          urgencia === "critico" && "border-destructive animate-pulse shadow-[0_0_40px_hsl(var(--destructive)/0.6)]",
          urgencia === "alerta" && "border-amber-500 shadow-[0_0_30px_hsl(45_93%_47%/0.4)]",
          urgencia === "normal" && "border-primary"
        )}
      >
        <DialogTitle className="sr-only">Novo pedido pendente</DialogTitle>
        <DialogDescription className="sr-only">
          Alerta operacional para atendimento de pedido recebido.
        </DialogDescription>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 -mt-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-11 w-11 rounded-full flex items-center justify-center text-white",
              urgencia === "critico" ? "bg-destructive animate-bounce" : "bg-primary"
            )}>
              {urgencia === "critico" ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <Bike className="h-6 w-6" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {urgencia === "critico" ? "🚨 PEDIDO URGENTE!" : "🛵 Novo Pedido!"}
              </h2>
              <p className="text-xs text-muted-foreground">
                #{pedido.numero_sequencial ?? pedido.id.slice(0, 8).toUpperCase()}
                {totalPendentes > 1 && (
                  <span className="ml-2 font-semibold text-primary">
                    +{totalPendentes - 1} aguardando
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleSom}
            title={somAtivo ? "Silenciar" : "Ativar som"}
          >
            {somAtivo ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
        </div>

        {/* Tempo + Canal */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-white gap-1", canal.color)}>
            {canal.label}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 font-bold",
              urgencia === "critico" && "border-destructive text-destructive animate-pulse",
              urgencia === "alerta" && "border-amber-500 text-amber-600",
            )}
          >
            <Clock className="h-3 w-3" />
            {minutosEspera === 0 ? "Agora" : `${minutosEspera} min esperando`}
          </Badge>
        </div>

        {/* Cliente */}
        <div className="space-y-2 bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-primary" />
            {pedido.cliente_nome}
          </div>
          {pedido.cliente_telefone && (
            <a
              href={`tel:${pedido.cliente_telefone}`}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Phone className="h-4 w-4" />
              {pedido.cliente_telefone}
            </a>
          )}
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <span>
              {pedido.endereco_completo}
              {pedido.bairro && <span className="text-muted-foreground"> · {pedido.bairro}</span>}
            </span>
          </div>
        </div>

        {/* Itens + Valor */}
        <div className="border rounded-lg p-3 space-y-1">
          <p className="text-sm font-medium">{pedido.itens_resumo}</p>
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-xs text-muted-foreground">
              {pedido.forma_pagamento || "A definir"}
            </span>
            <span className="text-lg font-bold text-primary">
              R$ {pedido.valor_total.toFixed(2)}
            </span>
          </div>
        </div>

        {pedido.observacoes && (
          <p className="text-xs italic text-muted-foreground border-l-2 border-primary pl-2">
            {pedido.observacoes}
          </p>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onSnooze} className="flex-1">
            Adiar 1 min
          </Button>
          <Button
            onClick={onAceitar}
            className={cn(
              "flex-1 font-bold",
              urgencia === "critico" && "bg-destructive hover:bg-destructive/90"
            )}
          >
            Atender Agora →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
