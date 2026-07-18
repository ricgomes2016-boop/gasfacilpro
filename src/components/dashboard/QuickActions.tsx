import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
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
  tone: string;
}

const actions: QuickAction[] = [
  { label: "Nova Venda", icon: PlusCircle, path: "/vendas/nova", tone: "bg-success text-success-foreground shadow-success/25 focus-visible:ring-success/45" },
  { label: "Abrir PDV", icon: Monitor, path: "/vendas/pdv", tone: "bg-info text-info-foreground shadow-info/25 focus-visible:ring-info/45" },
  { label: "Pedidos", icon: ShoppingCart, path: "/vendas/pedidos", tone: "bg-primary text-primary-foreground shadow-primary/25 focus-visible:ring-primary/45" },
  { label: "Clientes", icon: Users, path: "/clientes/cadastro", tone: "bg-warning text-warning-foreground shadow-warning/25 focus-visible:ring-warning/45" },
  { label: "Estoque", icon: Package, path: "/estoque", tone: "bg-secondary text-secondary-foreground shadow-secondary/25 focus-visible:ring-secondary/45" },
  { label: "Entregas", icon: Truck, path: "/entregas", tone: "bg-destructive text-destructive-foreground shadow-destructive/25 focus-visible:ring-destructive/45" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro", tone: "bg-success text-success-foreground shadow-success/25 focus-visible:ring-success/45" },
  { label: "Despesas", icon: Receipt, path: "/caixa/despesas", tone: "bg-warning text-warning-foreground shadow-warning/25 focus-visible:ring-warning/45" },
  { label: "Relatórios", icon: BarChart3, path: "/vendas/relatorio", tone: "bg-info text-info-foreground shadow-info/25 focus-visible:ring-info/45" },
  { label: "Notas Fiscais", icon: FileText, path: "/fiscal", tone: "bg-primary text-primary-foreground shadow-primary/25 focus-visible:ring-primary/45" },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border-border/60 shadow-[var(--elev-1)]">
      <CardHeader className="px-3.5 pb-2.5 pt-3.5 sm:px-4 sm:pt-4">
        <CardTitle className="text-sm font-semibold tracking-tight">Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent className="px-3.5 pb-3.5 pt-0 sm:px-4 sm:pb-4">
        <div className="grid w-full min-w-0 grid-cols-2 gap-2.5 min-[420px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-10">
          {actions.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={`quick-action-tile group relative flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/15 px-2.5 py-3 shadow-md transition-all duration-200 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/35 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${a.tone}`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/20 transition-transform duration-200 group-hover:scale-105">
                <a.icon className="h-[18px] w-[18px] drop-shadow-sm" strokeWidth={2.3} />
              </span>
              <span className="line-clamp-2 min-h-[24px] text-center text-[11px] font-semibold leading-[1.1] tracking-normal">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
