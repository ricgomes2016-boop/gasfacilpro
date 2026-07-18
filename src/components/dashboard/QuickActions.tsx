import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  PlusCircle,
  Monitor,
  ShoppingCart,
  Users,
  Package,
  Truck,
  DollarSign,
  FileText,
  BarChart3,
  Receipt,
} from "lucide-react";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
  tone: "primary" | "success" | "info" | "warning" | "destructive" | "secondary";
}

const toneStyles: Record<QuickAction["tone"], { icon: string; bg: string; ring: string }> = {
  primary:     { icon: "text-primary",     bg: "bg-primary/10",     ring: "ring-primary/15" },
  success:     { icon: "text-success",     bg: "bg-success/10",     ring: "ring-success/15" },
  info:        { icon: "text-info",        bg: "bg-info/10",        ring: "ring-info/15" },
  warning:     { icon: "text-warning",     bg: "bg-warning/10",     ring: "ring-warning/15" },
  destructive: { icon: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/15" },
  secondary:   { icon: "text-secondary-foreground", bg: "bg-secondary/60", ring: "ring-border/60" },
};

const actions: QuickAction[] = [
  { label: "Nova Venda",    icon: PlusCircle, path: "/vendas/nova",      tone: "success" },
  { label: "PDV",           icon: Monitor,    path: "/vendas/pdv",       tone: "info" },
  { label: "Pedidos",       icon: ShoppingCart, path: "/vendas/pedidos", tone: "primary" },
  { label: "Clientes",      icon: Users,      path: "/clientes/cadastro", tone: "warning" },
  { label: "Estoque",       icon: Package,    path: "/estoque",          tone: "secondary" },
  { label: "Entregas",      icon: Truck,      path: "/entregas",         tone: "destructive" },
  { label: "Financeiro",    icon: DollarSign, path: "/financeiro",       tone: "success" },
  { label: "Despesas",      icon: Receipt,    path: "/caixa/despesas",   tone: "warning" },
  { label: "Relatórios",    icon: BarChart3,  path: "/vendas/relatorio", tone: "info" },
  { label: "Notas Fiscais", icon: FileText,   path: "/fiscal",           tone: "primary" },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 shadow-[var(--elev-1)] sm:p-4">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">Acesso rápido</h3>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {actions.map((a) => {
          const t = toneStyles[a.tone];
          return (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={cn(
                "group flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-card px-2 py-2.5",
                "transition-all duration-150 hover:-translate-y-0.5 hover:border-border hover:bg-muted/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              )}
            >
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-inset transition-colors",
                t.bg, t.ring,
              )}>
                <a.icon className={cn("h-4 w-4", t.icon)} strokeWidth={2.2} />
              </span>
              <span className="line-clamp-1 text-center text-[11px] font-medium text-foreground">
                {a.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
