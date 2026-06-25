import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardKpis } from "@/components/dashboard/DashboardKpis";
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
      <div className={`${themeClass} dashboard-shell space-y-5`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {greeting()}, {nome} 👋
            </h2>
          </div>
        </div>
        <DashboardKpis />
        <QuickActions />
      </div>
    </MainLayout>
  );
}
