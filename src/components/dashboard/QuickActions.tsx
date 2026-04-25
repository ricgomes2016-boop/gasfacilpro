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
}

const actions: QuickAction[] = [
  {
    label: "Nova Venda",
    icon: PlusCircle,
    path: "/vendas/nova",
  },
  {
    label: "Abrir PDV",
    icon: Monitor,
    path: "/vendas/pdv",
  },
  {
    label: "Pedidos",
    icon: ShoppingCart,
    path: "/vendas/pedidos",
  },
  {
    label: "Clientes",
    icon: Users,
    path: "/clientes/cadastro",
  },
  {
    label: "Estoque",
    icon: Package,
    path: "/estoque",
  },
  {
    label: "Entregas",
    icon: Truck,
    path: "/entregas",
  },
  {
    label: "Financeiro",
    icon: DollarSign,
    path: "/financeiro",
  },
  {
    label: "Despesas",
    icon: Receipt,
    path: "/caixa/despesas",
  },
  {
    label: "Relatórios",
    icon: BarChart3,
    path: "/vendas/relatorio",
  },
  {
    label: "Notas Fiscais",
    icon: FileText,
    path: "/fiscal",
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="w-full min-w-0 border-border/60 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">⚡ Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
          {actions.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className="group flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <a.icon className="h-5 w-5 shrink-0" strokeWidth={2.25} />
              <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
