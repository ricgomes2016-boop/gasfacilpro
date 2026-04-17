import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { CaixaBloqueadoBanner } from "@/components/caixa/CaixaBloqueadoBanner";
import { useUnidade } from "@/contexts/UnidadeContext";

import { CustomerSearch } from "@/components/vendas/CustomerSearch";
import { ProductSearch, type ItemVenda } from "@/components/vendas/ProductSearch";
import { PaymentSection, type Pagamento } from "@/components/vendas/PaymentSection";
import { OrderSummary } from "@/components/vendas/OrderSummary";

import { aplicarModoEntregador } from "@/utils/mobileApp";
import { toast } from "sonner";

interface CustomerData {
  id: string | null;
  nome: string;
  telefone: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  observacao: string;
  latitude?: number | null;
  longitude?: number | null;
}

const emptyCustomer: CustomerData = {
  id: null,
  nome: "",
  telefone: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  observacao: "",
  latitude: null,
  longitude: null,
};

interface NovaVendaProps {
  embedded?: boolean;
  initialClienteId?: string | null;
  onClose?: () => void;
}

export default function NovaVenda({ embedded = false, initialClienteId, onClose }: NovaVendaProps) {
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();

  const [customer, setCustomer] = useState<CustomerData>(emptyCustomer);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    aplicarModoEntregador();
  }, []);

  const total = itens.reduce((acc, i) => acc + i.total, 0);

  const handleFinalizar = () => {
    toast.info("Finalização da venda em desenvolvimento");
  };

  const handleCancelar = () => {
    setCustomer(emptyCustomer);
    setItens([]);
    setPagamentos([]);
    if (onClose) onClose();
    else if (!embedded) navigate(-1);
  };

  const vendaContent = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
      <CaixaBloqueadoBanner />

      <CustomerSearch value={customer} onChange={setCustomer} />
      <ProductSearch
        itens={itens}
        onChange={setItens}
        unidadeId={unidadeAtual?.id}
        clienteId={customer.id}
      />
      <PaymentSection
        pagamentos={pagamentos}
        onChange={setPagamentos}
        totalVenda={total}
        unidadeId={unidadeAtual?.id}
      />
      <OrderSummary
        itens={itens}
        pagamentos={pagamentos}
        entregadorNome={null}
        canalVenda="Balcão"
        onFinalizar={handleFinalizar}
        onCancelar={handleCancelar}
        isLoading={isLoading}
      />
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
