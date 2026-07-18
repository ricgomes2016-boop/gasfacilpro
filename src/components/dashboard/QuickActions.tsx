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
  { label: "Nova Venda", icon: PlusCircle, path: "/vendas/nova", tone: "bg-success text-white shadow-success/25 focus-visible:ring-success/45" },
  { label: "Abrir PDV", icon: Monitor, path: "/vendas/pdv", tone: "bg-info text-white shadow-info/25 focus-visible:ring-info/45" },
  { label: "Pedidos", icon: ShoppingCart, path: "/vendas/pedidos", tone: "bg-primary text-primary-foreground shadow-primary/25 focus-visible:ring-primary/45" },
  { label: "Clientes", icon: Users, path: "/clientes/cadastro", tone: "bg-warning text-white shadow-warning/25 focus-visible:ring-warning/45" },
  { label: "Estoque", icon: Package, path: "/estoque", tone: "bg-[hsl(262_70%_55%)] text-white shadow-[hsl(262_70%_55%)]/25 focus-visible:ring-[hsl(262_70%_55%)]/45" },
  { label: "Entregas", icon: Truck, path: "/entregas", tone: "bg-destructive text-white shadow-destructive/25 focus-visible:ring-destructive/45" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro", tone: "bg-[hsl(160_65%_40%)] text-white shadow-[hsl(160_65%_40%)]/25 focus-visible:ring-[hsl(160_65%_40%)]/45" },
  { label: "Despesas", icon: Receipt, path: "/caixa/despesas", tone: "bg-[hsl(28_90%_52%)] text-white shadow-[hsl(28_90%_52%)]/25 focus-visible:ring-[hsl(28_90%_52%)]/45" },
  { label: "Relatórios", icon: BarChart3, path: "/vendas/relatorio", tone: "bg-[hsl(200_85%_45%)] text-white shadow-[hsl(200_85%_45%)]/25 focus-visible:ring-[hsl(200_85%_45%)]/45" },
  { label: "Notas Fiscais", icon: FileText, path: "/fiscal", tone: "bg-[hsl(230_55%_50%)] text-white shadow-[hsl(230_55%_50%)]/25 focus-visible:ring-[hsl(230_55%_50%)]/45" },
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
              className={`quick-action-tile group flex min-h-[86px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${a.tone}`}
            >
              <a.icon className="h-5 w-5 shrink-0 drop-shadow-sm" strokeWidth={2.25} />
              <span className="w-full break-words text-center text-[11px] font-semibold leading-tight tracking-tight">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
