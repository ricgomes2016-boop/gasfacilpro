import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  ShoppingCart,
  Users,
  Package,
  Truck,
  DollarSign,
  BarChart3,
  Receipt,
  Zap,
} from "lucide-react";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
  tone: string;
}

const actions: QuickAction[] = [
  { label: "Nova Venda", icon: PlusCircle, path: "/vendas/nova", tone: "bg-[#4f68e8] text-white focus-visible:ring-[#4f68e8]/45" },
  { label: "Pedidos", icon: ShoppingCart, path: "/vendas/pedidos", tone: "bg-[#4f68e8] text-white focus-visible:ring-[#4f68e8]/45" },
  { label: "Clientes", icon: Users, path: "/clientes/cadastro", tone: "bg-[#e7a936] text-white focus-visible:ring-[#e7a936]/45" },
  { label: "Estoque", icon: Package, path: "/estoque", tone: "bg-[#e97832] text-white focus-visible:ring-[#e97832]/45" },
  { label: "Entregas", icon: Truck, path: "/entregas", tone: "bg-[#c83c35] text-white focus-visible:ring-[#c83c35]/45" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro", tone: "bg-[#66bd67] text-white focus-visible:ring-[#66bd67]/45" },
  { label: "Despesas", icon: Receipt, path: "/caixa/despesas", tone: "bg-[#e7a936] text-white focus-visible:ring-[#e7a936]/45" },
  { label: "Relatórios", icon: BarChart3, path: "/vendas/relatorio", tone: "bg-[#4f68e8] text-white focus-visible:ring-[#4f68e8]/45" },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="w-full min-w-0 max-w-full rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-[#e7a936]" />
          Acesso Rápido
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid w-full min-w-0 grid-cols-2 gap-3 min-[520px]:grid-cols-4 xl:grid-cols-8">
          {actions.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              style={{ color: "#fff" }}
              className={`quick-action-tile group flex min-h-[96px] min-w-0 flex-col items-center justify-center gap-2 rounded-xl px-3 py-4 !text-white shadow-[0_12px_22px_-16px_rgba(15,23,42,0.6)] transition-all duration-150 hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 ${a.tone}`}
            >
              <a.icon className="h-6 w-6 shrink-0 !text-white" strokeWidth={2.25} />
              <span className="w-full break-words text-center text-[12px] font-bold leading-tight tracking-normal !text-white">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
