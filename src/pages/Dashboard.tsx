import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardKpis } from "@/components/dashboard/DashboardKpis";
import { DashboardFinancialHero } from "@/components/dashboard/DashboardFinancialHero";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RecentSales } from "@/components/dashboard/RecentSales";
import { DeliveryDriverStatus } from "@/components/dashboard/DeliveryDriverStatus";
import { StockOverview } from "@/components/dashboard/StockOverview";
import { RemindersWidget } from "@/components/dashboard/RemindersWidget";
import { AppPage } from "@/components/ui-kit";
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
      <div className={`${themeClass} dashboard-shell dashboard-forte-shell`}>
        <AppPage
          title={`${greeting()}${nome ? `, ${nome}` : ""}`}
          description={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          className="px-0 py-0 sm:px-0 sm:py-0"
        >
          <DashboardFinancialHero />
          <DashboardKpis />
          <QuickActions />

          <div className="grid w-full min-w-0 grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              <SalesChart />
            </div>
            <div className="min-w-0 xl:col-span-2">
              <RecentSales />
            </div>
          </div>

          <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <DeliveryDriverStatus />
            <StockOverview />
            <RemindersWidget />
          </div>
        </AppPage>
      </div>
    </MainLayout>
  );
}
