import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Truck, TrendingUp } from "lucide-react";

// Lazy imports of existing dashboard content
import DashboardExecutivoContent from "./dashboards/ExecutivoContent";
import DashboardAvancadoContent from "./dashboards/AvancadoContent";
import DashboardTrabalhistaContent from "./dashboards/TrabalhistaContent";
import DashboardLogisticoContent from "./dashboards/LogisticoContent";

export default function CentralIndicadores() {
  return (
    <MainLayout>
      <Header title="Central de Indicadores" subtitle="Visão consolidada do negócio" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        <Tabs defaultValue="executivo" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="executivo" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Executivo</span>
            </TabsTrigger>
            <TabsTrigger value="avancado" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Avançado</span>
            </TabsTrigger>
            <TabsTrigger value="trabalhista" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Trabalhista</span>
            </TabsTrigger>
            <TabsTrigger value="logistico" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Logístico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="executivo">
            <DashboardExecutivoContent />
          </TabsContent>
          <TabsContent value="avancado">
            <DashboardAvancadoContent />
          </TabsContent>
          <TabsContent value="trabalhista">
            <DashboardTrabalhistaContent />
          </TabsContent>
          <TabsContent value="logistico">
            <DashboardLogisticoContent />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
