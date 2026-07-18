import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardKpis } from "@/components/dashboard/DashboardKpis";
import { DashboardFinancialHero } from "@/components/dashboard/DashboardFinancialHero";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const { themeClass } = useDashboardTheme();
  const { profile, user } = useAuth();
  const nome = (profile?.full_name || user?.email || "").split(" ")[0] || "";

  return (
    <MainLayout>
      <Header title="Dashboard" subtitle="Visão geral da operação" />
      <div className={`${themeClass} dashboard-shell space-y-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {greeting()}, {nome}
          </h2>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <DashboardFinancialHero />
        <DashboardKpis />
        <QuickActions />
      </div>
    </MainLayout>
  );
}
