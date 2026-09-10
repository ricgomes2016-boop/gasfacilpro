import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, Package, FileText, Banknote, BarChart3 } from "lucide-react";
import ValeGasParceiros from "./ValeGasParceiros";
import ValeGasEmissao from "./ValeGasEmissao";
import ValeGasControle from "./ValeGasControle";
import ValeGasAcerto from "./ValeGasAcerto";
import ValeGasRelatorio from "./ValeGasRelatorio";

export default function ValeGas() {
  const [tab, setTab] = useState("controle");

  return (
    <MainLayout>
      <Header title="Vale Gás" subtitle="Gestão completa de vales gás" />
      <div className="space-y-4 p-3 sm:p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
            <TabsList className="h-12 min-w-max justify-start gap-1 rounded-xl bg-muted/70 p-1 sm:w-full sm:min-w-0 sm:justify-center">
              <TabsTrigger value="controle" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs sm:flex-1 sm:text-sm"><Package className="h-4 w-4" />Controle</TabsTrigger>
              <TabsTrigger value="emissao" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs sm:flex-1 sm:text-sm"><Plus className="h-4 w-4" />Emissão</TabsTrigger>
              <TabsTrigger value="parceiros" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs sm:flex-1 sm:text-sm"><Building2 className="h-4 w-4" />Parceiros</TabsTrigger>
              <TabsTrigger value="acerto" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs sm:flex-1 sm:text-sm"><Banknote className="h-4 w-4" />Acerto</TabsTrigger>
              <TabsTrigger value="relatorio" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs sm:flex-1 sm:text-sm"><BarChart3 className="h-4 w-4" />Relatório</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="controle"><ValeGasControle embedded /></TabsContent>
          <TabsContent value="emissao"><ValeGasEmissao embedded /></TabsContent>
          <TabsContent value="parceiros"><ValeGasParceiros embedded /></TabsContent>
          <TabsContent value="acerto"><ValeGasAcerto embedded /></TabsContent>
          <TabsContent value="relatorio"><ValeGasRelatorio embedded /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
