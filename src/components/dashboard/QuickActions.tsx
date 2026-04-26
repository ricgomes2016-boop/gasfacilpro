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
    <Card className="modern-panel w-full min-w-0 max-w-full bg-card/80 backdrop-blur-sm">
      <CardHeader className="section-header-stock pb-3">
        <CardTitle className="text-base font-semibold text-warning-foreground">⚡ Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full min-w-0 grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-5 lg:grid-cols-10">
          {actions.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={`group flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl p-3 shadow-lg transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${a.tone}`}
            >
              <a.icon className="h-5 w-5 drop-shadow-sm" strokeWidth={2.25} />
              <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight tracking-tight sm:text-[11px]">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
