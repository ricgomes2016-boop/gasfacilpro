import { useEffect, useState } from "react";
import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Target, TrendingUp, Award } from "lucide-react";

export default function VendedorMetas() {
  const { user } = useAuth();
  const [meta, setMeta] = useState(0);
  const [comissaoPct, setComissaoPct] = useState(0);
  const [valorFixo, setValorFixo] = useState(0);
  const [tipoComissao, setTipoComissao] = useState<"percentual" | "valor_fixo">("percentual");
  const [vendido, setVendido] = useState(0);
  const [qtd, setQtd] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const inicio = new Date();
      inicio.setDate(1);
      inicio.setHours(0, 0, 0, 0);

      const { data: vendas } = await (supabase as any)
        .from("pedidos")
        .select("valor_total")
        .eq("vendedor_id", user.id)
        .gte("created_at", inicio.toISOString())
        .in("status", ["entregue", "pago", "concluido"]);

      const total = ((vendas || []) as any[]).reduce((s, p) => s + Number(p.valor_total || 0), 0);
      setVendido(total);
      setQtd(((vendas || []) as any[]).length);

      const { data: cfg } = await (supabase as any)
        .from("vendedor_metas")
        .select("meta_mensal, percentual, valor_fixo_comissao, tipo_comissao")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cfg) {
        setMeta(Number((cfg as any).meta_mensal || 0));
        setComissaoPct(Number((cfg as any).percentual || 0));
        setValorFixo(Number((cfg as any).valor_fixo_comissao || 0));
        setTipoComissao((((cfg as any).tipo_comissao as string) || "percentual") as "percentual" | "valor_fixo");
      }
    })();
  }, [user?.id]);

  const progresso = meta > 0 ? Math.min(100, (vendido / meta) * 100) : 0;
  const comissao = tipoComissao === "valor_fixo" ? qtd * valorFixo : vendido * (comissaoPct / 100);
  const comissaoLabel =
    tipoComissao === "valor_fixo"
      ? `R$ ${valorFixo.toFixed(2)} por venda`
      : `${comissaoPct}% sobre vendido`;

  return (
    <VendedorLayout title="Metas & Comissão">
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Meta do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {meta > 0 ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>R$ {vendido.toFixed(2)}</span>
                  <span className="text-muted-foreground">R$ {meta.toFixed(2)}</span>
                </div>
                <Progress value={progresso} className="h-3" />
                <p className="text-center text-sm font-medium">
                  {progresso.toFixed(0)}% atingido
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma meta configurada ainda. Fale com seu gestor.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
              <p className="text-xs text-muted-foreground">Vendas no mês</p>
              <p className="text-2xl font-bold">{qtd}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Award className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
              <p className="text-xs text-muted-foreground">Comissão est.</p>
              <p className="text-2xl font-bold">R$ {comissao.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground">{comissaoPct}% sobre vendido</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </VendedorLayout>
  );
}
