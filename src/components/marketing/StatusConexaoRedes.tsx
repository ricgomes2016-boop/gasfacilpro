import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Instagram, Facebook, CheckCircle2, XCircle, AlertTriangle, Link2, Radio } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Conta = {
  id: string;
  plataforma: string;
  nome_conta: string;
  username?: string | null;
  ativo: boolean;
  conectado_via?: string | null;
  token_expires_at?: string | null;
};

const REDES = [
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-primary", bg: "bg-primary/10" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "text-info", bg: "bg-info/10" },
];

interface Props {
  empresaId?: string | null;
  contas: Conta[];
  onConectar: () => void;
}

export function StatusConexaoRedes({ empresaId, contas, onConectar }: Props) {
  const queryClient = useQueryClient();

  // Atualização em tempo real das conexões
  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`social-accounts-${empresaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_accounts", filter: `empresa_id=eq.${empresaId}` },
        () => queryClient.invalidateQueries({ queryKey: ["social-accounts"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId, queryClient]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {REDES.map((rede) => {
        const Icon = rede.icon;
        const oauth = contas.find((c) => c.plataforma === rede.id && c.conectado_via === "oauth");
        const manual = contas.find((c) => c.plataforma === rede.id && c.conectado_via !== "oauth");
        const conta = oauth ?? manual;

        const expDias = oauth?.token_expires_at
          ? Math.floor((new Date(oauth.token_expires_at).getTime() - Date.now()) / 86400000)
          : null;

        const estado: "conectado" | "expirando" | "expirado" | "manual" | "off" = oauth
          ? !oauth.ativo || (expDias !== null && expDias <= 0)
            ? "expirado"
            : expDias !== null && expDias <= 7
              ? "expirando"
              : "conectado"
          : manual
            ? "manual"
            : "off";

        const badge = {
          conectado: { cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2, txt: "Conectado" },
          expirando: { cls: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle, txt: `Expira em ${expDias}d` },
          expirado: { cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle, txt: "Reconectar" },
          manual: { cls: "bg-muted text-muted-foreground border-border", icon: AlertTriangle, txt: "Só cadastro manual" },
          off: { cls: "bg-muted text-muted-foreground border-border", icon: XCircle, txt: "Não conectado" },
        }[estado];
        const BadgeIcon = badge.icon;

        return (
          <Card key={rede.id} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-3 rounded-xl ${rede.bg} ${rede.color} relative`}>
                <Icon className="h-5 w-5" />
                {estado === "conectado" && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-success/70" />
                    <span className="relative rounded-full h-2.5 w-2.5 bg-success" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{rede.label}</span>
                  <Badge variant="outline" className={`gap-1 text-[10px] border ${badge.cls}`}>
                    <BadgeIcon className="h-3 w-3" /> {badge.txt}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {conta
                    ? `${conta.nome_conta}${conta.username ? ` · @${conta.username}` : ""}`
                    : "Nenhuma conta vinculada"}
                </p>
                {oauth?.token_expires_at && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Token até {format(new Date(oauth.token_expires_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
              {estado !== "conectado" && (
                <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={onConectar}>
                  <Link2 className="h-3.5 w-3.5" />
                  Conectar
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
      <p className="sm:col-span-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Radio className="h-3 w-3" /> Status atualizado em tempo real.
      </p>
    </div>
  );
}
