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
      <div className="p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 w-full">
            <TabsTrigger value="controle" className="gap-1.5 text-xs sm:text-sm"><Package className="h-4 w-4" /><span className="hidden sm:inline">Controle</span><span className="sm:hidden">Ctrl</span></TabsTrigger>
            <TabsTrigger value="emissao" className="gap-1.5 text-xs sm:text-sm"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Emissão</span><span className="sm:hidden">Emit</span></TabsTrigger>
            <TabsTrigger value="parceiros" className="gap-1.5 text-xs sm:text-sm"><Building2 className="h-4 w-4" /><span className="hidden sm:inline">Parceiros</span><span className="sm:hidden">Parc</span></TabsTrigger>
            <TabsTrigger value="acerto" className="gap-1.5 text-xs sm:text-sm"><Banknote className="h-4 w-4" /><span className="hidden sm:inline">Acerto</span><span className="sm:hidden">Acrt</span></TabsTrigger>
            <TabsTrigger value="relatorio" className="gap-1.5 text-xs sm:text-sm"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Relatório</span><span className="sm:hidden">Rel</span></TabsTrigger>
          </TabsList>

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
