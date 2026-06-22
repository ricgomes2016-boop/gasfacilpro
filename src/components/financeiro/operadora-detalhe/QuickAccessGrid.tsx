import { Card } from "@/components/ui/card";
import {
  ShoppingCart, Banknote, Percent, BarChart3, CheckCircle2, CreditCard,
} from "lucide-react";
import { OperatorTheme } from "@/lib/cartoes/operatorThemes";

interface QuickItem {
  key: string;
  label: string;
  sub: string;
  icon: typeof ShoppingCart;
}

interface Props {
  theme: OperatorTheme;
  metrics: {
    vendasMes: number;
    aReceber: number;
    recebido: number;
    taxaDebito: number;
    maquininhas: number;
    conferencias: number;
  };
  onSelect: (tab: string) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function QuickAccessGrid({ theme, metrics, onSelect }: Props) {
  const items: QuickItem[] = [
    { key: "vendas", label: "Vendas", sub: fmt(metrics.vendasMes) + " no mês", icon: ShoppingCart },
    { key: "recebiveis", label: "Recebíveis", sub: fmt(metrics.aReceber) + " a receber", icon: Banknote },
    { key: "taxas", label: "Taxas", sub: `${metrics.taxaDebito.toFixed(2)}% débito`, icon: Percent },
    { key: "relatorios", label: "Relatórios", sub: "Vendas, futuro e recebidos", icon: BarChart3 },
    { key: "conferencia", label: "Conferência", sub: `${metrics.conferencias} a conferir`, icon: CheckCircle2 },
    { key: "maquininhas", label: "Maquininhas", sub: `${metrics.maquininhas} ativa(s)`, icon: CreditCard },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            onClick={() => onSelect(it.key)}
            className="group text-left"
          >
            <Card className="p-4 h-full transition-all hover:-translate-y-0.5 hover:shadow-lg border-border/60 hover:border-primary/40">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${theme.primary}1a`, color: theme.primary }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold leading-tight">{it.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{it.sub}</p>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
