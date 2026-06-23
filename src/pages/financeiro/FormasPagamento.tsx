import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import ConfigDestinoPagamento from "@/components/financeiro/ConfigDestinoPagamento";

export default function FormasPagamento() {
  const { unidadeAtual } = useUnidade();

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-bancarias-formas-pagto", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase
        .from("contas_bancarias")
        .select("id,nome,banco,saldo_atual,unidade_id")
        .eq("ativo", true);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q.order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <MainLayout>
      <Header
        title="Formas de Pagamento"
        subtitle="Defina qual conta bancária recebe cada forma de pagamento das suas vendas"
      />
      <div className="p-4 md:p-6">
        <ConfigDestinoPagamento contas={contas as any} />
      </div>
    </MainLayout>
  );
}
