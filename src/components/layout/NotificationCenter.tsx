import { Bell, Check, CheckCheck, Trash2, Package, Tag, AlertTriangle, Info, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificacoes, type Notificacao } from "@/hooks/useNotificacoes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const tipoIcons: Record<string, typeof Bell> = {
  pedido: Package,
  promocao: Tag,
  alerta: AlertTriangle,
  marketing: Megaphone,
  info: Info,
};

const tipoCores: Record<string, string> = {
  pedido: "text-info",
  promocao: "text-success",
  alerta: "text-warning",
  marketing: "text-primary",
  info: "text-muted-foreground",
};

function NotificacaoItem({
  notif,
  onLer,
  onDeletar,
  onNavigate,
}: {
  notif: Notificacao;
  onLer: (id: string) => void;
  onDeletar: (id: string) => void;
  onNavigate: (link: string) => void;
}) {
  const Icon = tipoIcons[notif.tipo] || Bell;
  const cor = tipoCores[notif.tipo] || "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 border-b border-border transition-colors cursor-pointer hover:bg-accent/50",
        !notif.lida && "bg-primary/5"
      )}
      onClick={() => {
        if (!notif.lida) onLer(notif.id);
        if (notif.link) onNavigate(notif.link);
      }}
    >
      <div className={cn("mt-0.5 shrink-0", cor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm font-medium truncate", !notif.lida && "text-foreground")}>
            {notif.titulo}
          </p>
          {!notif.lida && (
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notif.mensagem}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(notif.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDeletar(notif.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

export function NotificationCenter() {
  const { notificacoes, naoLidas, marcarComoLida, marcarTodasComoLidas, deletar } =
    useNotificacoes();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNavigate = (link: string) => {
    setOpen(false);
    navigate(link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px] font-bold flex items-center justify-center"
            >
              {naoLidas > 99 ? "99+" : naoLidas}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 z-50 bg-popover border shadow-lg"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notificações</h3>
            {naoLidas > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {naoLidas} nova{naoLidas > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={marcarTodasComoLidas}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[400px]">
          {notificacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma notificação</p>
              <p className="text-xs">Você será notificado aqui</p>
            </div>
          ) : (
            <div className="group">
              {notificacoes.map((notif) => (
                <NotificacaoItem
                  key={notif.id}
                  notif={notif}
                  onLer={marcarComoLida}
                  onDeletar={deletar}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
