import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell, Cake, CreditCard, ShoppingCart, Wrench,
  ChevronRight, RefreshCw, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Reminder {
  id: string;
  icon: typeof Bell;
  iconColor: string;
  bgColor: string;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "default" | "destructive" | "outline" | "secondary";
  link?: string;
  daysUntil?: number;
}

export function RemindersWidget() {
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();

  const { data: reminders, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["smart-reminders", unidadeAtual?.id],
    queryFn: async () => {
      const items: Reminder[] = [];
      const hoje = new Date();
      const hojeStr = hoje.toISOString().split("T")[0];
      const em7dias = addDays(hoje, 7).toISOString().split("T")[0];
      const em3dias = addDays(hoje, 3).toISOString().split("T")[0];

      // 1. (Aniversariantes removido: a base de clientes não possui data de nascimento,
      //    o lembrete anterior usava a data de cadastro e gerava informação incorreta.)


      // 2. Contas a pagar — vencidas + próximos 3 dias
      let contasQuery = supabase
        .from("contas_pagar")
        .select("id, descricao, valor, vencimento")
        .in("status", ["pendente", "parcial", "atrasada", "vencida"])
        .lte("vencimento", em3dias)
        .order("vencimento");
      if (unidadeAtual?.id) contasQuery = contasQuery.eq("unidade_id", unidadeAtual.id);
      const { data: contas } = await contasQuery;

      if (contas && contas.length > 0) {
        const total = contas.reduce((s, c) => s + (Number(c.valor) || 0), 0);
        const vencidas = contas.filter(c => c.vencimento < hojeStr);
        items.push({
          id: "contas-vencer",
          icon: CreditCard,
          iconColor: vencidas.length > 0 ? "text-destructive" : "text-warning",
          bgColor: vencidas.length > 0 ? "bg-destructive/10" : "bg-warning/15",
          title: `${contas.length} conta(s) a pagar ${vencidas.length > 0 ? "vencida(s)" : "vencem em breve"}`,
          description: `Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          badge: vencidas.length > 0 ? "Urgente" : "3 dias",
          badgeVariant: vencidas.length > 0 ? "destructive" : "outline",
          link: "/financeiro/pagar",
        });
      }

      // 2b. Contas a receber — próximas de vencer (3 dias)
      let receberProxQuery = supabase
        .from("contas_receber")
        .select("id, descricao, valor, vencimento")
        .in("status", ["pendente", "parcial", "atrasada", "vencida"])
        .gte("vencimento", hojeStr)
        .lte("vencimento", em3dias)
        .order("vencimento");
      if (unidadeAtual?.id) receberProxQuery = receberProxQuery.eq("unidade_id", unidadeAtual.id);
      const { data: receberProx } = await receberProxQuery;

      if (receberProx && receberProx.length > 0) {
        const total = receberProx.reduce((s, c) => s + (Number(c.valor) || 0), 0);
        items.push({
          id: "receber-vencendo",
          icon: Bell,
          iconColor: "text-warning",
          bgColor: "bg-warning/10",
          title: `${receberProx.length} recebível(is) vence(m) em 3 dias`,
          description: `Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          badge: "Cobrar",
          badgeVariant: "outline",
          link: "/financeiro/receber",
        });
      }

      // 3. Previsão de recompra (contratos recorrentes com entrega próxima)
      let contratosQuery = supabase
        .from("contratos_recorrentes")
        .select("id, cliente_nome, produto_nome, proxima_entrega")
        .eq("status", "ativo")
        .lte("proxima_entrega", em7dias)
        .order("proxima_entrega");
      if (unidadeAtual?.id) contratosQuery = contratosQuery.eq("unidade_id", unidadeAtual.id);
      const { data: contratos } = await contratosQuery;

      if (contratos && contratos.length > 0) {
        items.push({
          id: "recompra",
          icon: ShoppingCart,
          iconColor: "text-primary",
          bgColor: "bg-primary/10",
          title: `${contratos.length} entrega${contratos.length > 1 ? "s" : ""} recorrente${contratos.length > 1 ? "s" : ""} esta semana`,
          description: contratos.slice(0, 2).map(c => `${c.cliente_nome?.split(" ")[0]} — ${c.produto_nome}`).join("; "),
          badge: "Assinaturas",
          badgeVariant: "secondary",
          link: "/clientes/contratos",
        });
      }

      // 4. Manutenção de frota vencendo
      let manutQuery = supabase
        .from("manutencoes")
        .select("id, veiculo_id, descricao, data")
        .eq("status", "agendada")
        .lte("data", em7dias)
        .order("data");
      if (unidadeAtual?.id) manutQuery = manutQuery.eq("unidade_id", unidadeAtual.id);
      const { data: manutencoes } = await manutQuery;

      if (manutencoes && manutencoes.length > 0) {
        const vencidas = manutencoes.filter(m => m.data && m.data < hojeStr);
        items.push({
          id: "manutencao",
          icon: Wrench,
          iconColor: vencidas.length > 0 ? "text-destructive" : "text-warning",
          bgColor: vencidas.length > 0 ? "bg-destructive/10" : "bg-warning/10",
          title: `${manutencoes.length} manutenç${manutencoes.length > 1 ? "ões" : "ão"} ${vencidas.length > 0 ? "atrasada(s)" : "programada(s)"}`,
          description: manutencoes.slice(0, 2).map(m => m.descricao).join(", "),
          badge: vencidas.length > 0 ? "Atrasada" : "7 dias",
          badgeVariant: vencidas.length > 0 ? "destructive" : "outline",
          link: "/frota/manutencao",
        });
      }

      // 5. Contas a receber vencidas
      let receberQuery = supabase
        .from("contas_receber")
        .select("id, descricao, valor, vencimento")
        .in("status", ["pendente", "parcial", "atrasada", "vencida"])
        .lt("vencimento", hojeStr)
        .order("vencimento")
        .limit(50);
      if (unidadeAtual?.id) receberQuery = receberQuery.eq("unidade_id", unidadeAtual.id);
      const { data: receber } = await receberQuery;

      if (receber && receber.length > 0) {
        const total = receber.reduce((s, c) => s + (Number(c.valor) || 0), 0);
        items.push({
          id: "receber-vencidas",
          icon: Calendar,
          iconColor: "text-destructive",
          bgColor: "bg-destructive/10",
          title: `${receber.length} recebível${receber.length > 1 ? "is" : ""} vencido${receber.length > 1 ? "s" : ""}`,
          description: `Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          badge: "Cobrar",
          badgeVariant: "destructive",
          link: "/financeiro/receber",
        });
      }

      return items;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const items = reminders || [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="section-header-catalog pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="section-header-title">
            <span className="section-header-icon-frame h-8 w-8"><Bell className="h-4 w-4" /></span>
            Lembretes Inteligentes
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-info-foreground hover:bg-info-foreground/10 hover:text-info-foreground"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Tudo em dia! 🎉</p>
            <p className="text-xs mt-1">Nenhum lembrete pendente</p>
          </div>
        ) : (
          items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 group"
                onClick={() => item.link && navigate(item.link)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-lg p-2 shrink-0", item.bgColor)}>
                    <Icon className={cn("h-4 w-4", item.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      {item.badge && (
                        <Badge variant={item.badgeVariant} className="text-[10px] h-5 shrink-0">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground shrink-0 mt-1" />
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
