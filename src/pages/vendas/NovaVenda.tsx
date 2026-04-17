// PATCHED WITH MOBILE APP FEATURES
import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Sparkles, Loader2, Send, Mic, MicOff, Camera, ImageIcon, PlusCircle, Check, User, Package as PackageIcon, CreditCard, CheckCircle, CalendarClock, MapPin } from "lucide-react";
import { NovaVendaModal } from "@/components/vendas/NovaVendaModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateReceiptPdf } from "@/services/receiptPdfService";
import { atualizarEstoqueVenda } from "@/services/estoqueService";
import { rotearPagamentosVenda } from "@/services/paymentRoutingService";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { cn, getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";
import { CaixaBloqueadoBanner } from "@/components/caixa/CaixaBloqueadoBanner";

import { CustomerSearch } from "@/components/vendas/CustomerSearch";
import { ProductSearch, ItemVenda } from "@/components/vendas/ProductSearch";
import { PaymentSection, Pagamento } from "@/components/vendas/PaymentSection";
import { OrderSummary } from "@/components/vendas/OrderSummary";
import { CustomerHistory } from "@/components/vendas/CustomerHistory";
import { DeliveryPersonSelect } from "@/components/vendas/DeliveryPersonSelect";

// NEW
import { aplicarModoEntregador, vibrar } from "@/utils/mobileApp";

export default function NovaVenda({ embedded = false, initialClienteId, onClose }: any) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();

  useEffect(() => {
    aplicarModoEntregador();
  }, []);

  const abrirMapaEndereco = (customer:any) => {
    if (!customer?.endereco) return;

    const endereco = `${customer.endereco} ${customer.numero || ""} ${customer.bairro || ""}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
    window.open(url, "_system");
  };

  const vendaContent = (
    <>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden w-full min-w-0 max-w-full">
        <CaixaBloqueadoBanner />

        {/* botão rota segura */}
        {typeof customer !== "undefined" && customer?.endereco && (
          <Button
            onClick={() => abrirMapaEndereco(customer)}
            className="w-full h-12 flex items-center gap-2"
            variant="secondary"
          >
            <MapPin className="h-5 w-5" />
            Ir para entrega
          </Button>
        )}

      </div>
    </>
  );

  if (embedded) return <>{vendaContent}</>;

  return (
    <MainLayout>
      <Header title="Nova Venda" subtitle={unidadeAtual?.nome || ""} />
      {vendaContent}
    </MainLayout>
  );
}
