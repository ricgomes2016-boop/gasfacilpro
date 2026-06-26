import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import EntregadorNovaVenda from "@/pages/entregador/EntregadorNovaVenda";

export default function VendedorNovaVenda() {
  return (
    <VendedorLayout title="Nova Venda">
      <EntregadorNovaVenda noLayout />
    </VendedorLayout>
  );
}
