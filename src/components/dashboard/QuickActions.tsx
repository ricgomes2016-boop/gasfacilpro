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
  { label: "Nova Venda", icon: PlusCircle, path: "/vendas/nova", tone: "border-success/25 bg-success/10 text-success hover:bg-success/15 focus-visible:ring-success/35" },
  { label: "Abrir PDV", icon: Monitor, path: "/vendas/pdv", tone: "border-info/25 bg-info/10 text-info hover:bg-info/15 focus-visible:ring-info/35" },
  { label: "Pedidos", icon: ShoppingCart, path: "/vendas/pedidos", tone: "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 focus-visible:ring-primary/35" },
  { label: "Clientes", icon: Users, path: "/clientes/cadastro", tone: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15 focus-visible:ring-warning/35" },
  { label: "Estoque", icon: Package, path: "/estoque", tone: "border-secondary/25 bg-secondary/10 text-secondary hover:bg-secondary/15 focus-visible:ring-secondary/35" },
  { label: "Entregas", icon: Truck, path: "/entregas", tone: "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:ring-destructive/35" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro", tone: "border-success/25 bg-success/10 text-success hover:bg-success/15 focus-visible:ring-success/35" },
  { label: "Despesas", icon: Receipt, path: "/caixa/despesas", tone: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15 focus-visible:ring-warning/35" },
  { label: "Relatórios", icon: BarChart3, path: "/vendas/relatorio", tone: "border-info/25 bg-info/10 text-info hover:bg-info/15 focus-visible:ring-info/35" },
  { label: "Notas Fiscais", icon: FileText, path: "/fiscal", tone: "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 focus-visible:ring-primary/35" },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="modern-panel w-full min-w-0 max-w-full bg-card/80 backdrop-blur-sm">
      <CardHeader className="section-header-stock pb-3">
        <CardTitle className="text-base font-semibold text-card-foreground">⚡ Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full min-w-0 grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-5 lg:grid-cols-10">
          {actions.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={`group flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border p-3 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${a.tone}`}
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
