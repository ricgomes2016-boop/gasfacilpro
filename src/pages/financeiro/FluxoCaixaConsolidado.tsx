import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpDown, TrendingUp } from "lucide-react";
import FluxoCaixa from "./FluxoCaixa";
import PrevisaoCaixa from "./PrevisaoCaixa";
import { SectionCard } from "@/components/shared";

export default function FluxoCaixaConsolidado() {
  const [tab, setTab] = useState("fluxo");

  return (
    <MainLayout>
      <Header title="Fluxo de Caixa" subtitle="Movimentações e projeções financeiras" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4">
        <SectionCard noPadding contentClassName="p-3 sm:p-4">
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="h-11">
              <TabsTrigger value="fluxo" className="gap-1.5"><ArrowUpDown className="h-4 w-4" />Fluxo Atual</TabsTrigger>
              <TabsTrigger value="previsao" className="gap-1.5"><TrendingUp className="h-4 w-4" />Previsão</TabsTrigger>
            </TabsList>

            <TabsContent value="fluxo" className="m-0"><FluxoCaixa embedded /></TabsContent>
            <TabsContent value="previsao" className="m-0"><PrevisaoCaixa embedded /></TabsContent>
          </Tabs>
        </SectionCard>
      </div>
    </MainLayout>
  );
}
