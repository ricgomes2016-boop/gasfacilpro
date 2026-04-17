// PATCHED WITH MOBILE APP FEATURES
import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { CaixaBloqueadoBanner } from "@/components/caixa/CaixaBloqueadoBanner";

import { CustomerSearch } from "@/components/vendas/CustomerSearch";
import { ProductSearch } from "@/components/vendas/ProductSearch";
import { PaymentSection } from "@/components/vendas/PaymentSection";
import { OrderSummary } from "@/components/vendas/OrderSummary";

import { aplicarModoEntregador } from "@/utils/mobileApp";

export default function NovaVenda({ embedded = false }: any) {
  const navigate = useNavigate();

  useEffect(() => {
    aplicarModoEntregador();
  }, []);

  const vendaContent = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 w-full">
      <CaixaBloqueadoBanner />

      <CustomerSearch />
      <ProductSearch />
      <PaymentSection />
      <OrderSummary />

      <Button className="w-full h-12" variant="secondary">
        <MapPin className="h-5 w-5 mr-2" />
        Ir para entrega
      </Button>
    </div>
  );

  if (embedded) return <>{vendaContent}</>;

  return (
    <MainLayout>
      <Header title="Nova Venda" subtitle="" />
      {vendaContent}
    </MainLayout>
  );
}
