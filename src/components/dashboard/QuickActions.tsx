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
  bg: string;
  ring: string;
}

const actions: QuickAction[] = [
  {
    label: "Nova Venda",
    icon: PlusCircle,
    path: "/vendas/nova",
    bg: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25",
    ring: "ring-emerald-400/40",
  },
  {
    label: "Abrir PDV",
    icon: Monitor,
    path: "/vendas/pdv",
    bg: "bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sky-500/25",
    ring: "ring-sky-400/40",
  },
  {
    label: "Pedidos",
    icon: ShoppingCart,
    path: "/vendas/pedidos",
    bg: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-500/25",
    ring: "ring-violet-400/40",
  },
  {
    label: "Clientes",
    icon: Users,
    path: "/clientes/cadastro",
    bg: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/25",
    ring: "ring-amber-400/40",
  },
  {
    label: "Estoque",
    icon: Package,
    path: "/estoque",
    bg: "bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-teal-500/25",
    ring: "ring-teal-400/40",
  },
  {
    label: "Entregas",
    icon: Truck,
    path: "/entregas",
    bg: "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/25",
    ring: "ring-rose-400/40",
  },
  {
    label: "Financeiro",
    icon: DollarSign,
    path: "/financeiro/dashboard",
    bg: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-500/25",
    ring: "ring-indigo-400/40",
  },
  {
    label: "Despesas",
    icon: Receipt,
    path: "/caixa/despesas",
    bg: "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-500/25",
    ring: "ring-orange-400/40",
  },
  {
    label: "Relatórios",
    icon: BarChart3,
    path: "/vendas/relatorios",
    bg: "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-cyan-500/25",
    ring: "ring-cyan-400/40",
  },
  {
    label: "Notas Fiscais",
    icon: FileText,
    path: "/fiscal/dashboard",
    bg: "bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white shadow-fuchsia-500/25",
    ring: "ring-fuchsia-400/40",
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">⚡ Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-10 gap-3">
          {actions.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={`group flex flex-col items-center gap-1.5 rounded-xl p-3 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${a.bg} ${a.ring}`}
            >
              <a.icon className="h-5 w-5 drop-shadow-sm" strokeWidth={2.25} />
              <span className="text-[10px] sm:text-[11px] font-semibold leading-tight text-center tracking-tight">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
