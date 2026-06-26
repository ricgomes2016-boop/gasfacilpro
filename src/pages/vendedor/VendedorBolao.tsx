import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import EntregadorBolao from "@/pages/entregador/EntregadorBolao";

export default function VendedorBolao() {
  return (
    <VendedorLayout title="Bolão Copa 2026">
      <EntregadorBolao noLayout />
    </VendedorLayout>
  );
}
