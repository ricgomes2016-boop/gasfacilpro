import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";

export default function Dashboard() {
  const { themeClass } = useDashboardTheme();

  return (
    <MainLayout>
      <Header title="Dashboard" subtitle="Bem-vindo ao GásPro - Sua revenda de gás" />
      <div className={`${themeClass} dashboard-shell`}>
        <QuickActions />
      </div>
    </MainLayout>
  );
}
