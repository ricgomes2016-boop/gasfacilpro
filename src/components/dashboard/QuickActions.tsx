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
  { label: "Nova Venda", icon: PlusCircle, path: "/vendas/nova", tone: "bg-success text-success-foreground focus-visible:ring-success/45" },
  { label: "Abrir PDV", icon: Monitor, path: "/vendas/pdv", tone: "bg-primary text-primary-foreground focus-visible:ring-primary/45" },
  { label: "Pedidos", icon: ShoppingCart, path: "/vendas/pedidos", tone: "bg-primary text-primary-foreground focus-visible:ring-primary/45" },
  { label: "Clientes", icon: Users, path: "/clientes/cadastro", tone: "bg-info text-info-foreground focus-visible:ring-info/45" },
  { label: "Estoque", icon: Package, path: "/estoque", tone: "bg-warning text-warning-foreground focus-visible:ring-warning/45" },
  { label: "Entregas", icon: Truck, path: "/entregas", tone: "bg-accent text-accent-foreground focus-visible:ring-accent/45" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro", tone: "bg-success text-success-foreground focus-visible:ring-success/45" },
  { label: "Despesas", icon: Receipt, path: "/caixa/despesas", tone: "bg-accent text-accent-foreground focus-visible:ring-accent/45" },
  { label: "Relatórios", icon: BarChart3, path: "/vendas/relatorio", tone: "bg-info text-info-foreground focus-visible:ring-info/45" },
  { label: "Notas Fiscais", icon: FileText, path: "/fiscal", tone: "bg-secondary text-secondary-foreground focus-visible:ring-secondary/45" },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="w-full min-w-0 max-w-full">
      <CardHeader className="pb-3">
        <CardTitle>Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-10">
          {actions.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={`quick-action-tile group flex min-h-[86px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-3 shadow-sm transition-all duration-150 hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 ${a.tone}`}
            >
              <a.icon className="h-5 w-5 shrink-0" strokeWidth={2.25} />
              <span className="w-full break-words text-center text-[11px] font-semibold leading-tight tracking-normal">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
