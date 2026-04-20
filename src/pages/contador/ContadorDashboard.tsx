import { useEffect, useState } from "react";
import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileCode, Receipt, Banknote, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ContadorDashboard() {
  const { empresaAtiva, unidadeAtiva, loading: loadingCtx } = useContador();
  const [stats, setStats] = useState({ xmls: 0, despesasPendentes: 0, despesasMes: 0, extratos: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaAtiva) return;
    const start = new Date();
    start.setDate(1); start.setHours(0, 0, 0, 0);
    const startISO = start.toISOString();

    setLoading(true);
    Promise.all([
      // XMLs do mês — usa notas_fiscais
      supabase.from("notas_fiscais" as any).select("id", { count: "exact", head: true })
        .gte("created_at", startISO)
        .then((r: any) => r.count ?? 0),
      // Despesas pendentes
      supabase.from("despesas_contabeis" as any).select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaAtiva.empresa_id).eq("status", "pendente")
        .then((r: any) => r.count ?? 0),
      // Despesas do mês
      supabase.from("despesas_contabeis" as any).select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaAtiva.empresa_id).gte("data_despesa", start.toISOString().slice(0, 10))
        .then((r: any) => r.count ?? 0),
      // Extratos do mês — extrato_bancario
      supabase.from("extrato_bancario" as any).select("id", { count: "exact", head: true })
        .gte("created_at", startISO)
        .then((r: any) => r.count ?? 0),
    ]).then(([xmls, despesasPendentes, despesasMes, extratos]) => {
      setStats({ xmls, despesasPendentes, despesasMes, extratos });
    }).finally(() => setLoading(false));
  }, [empresaAtiva, unidadeAtiva]);

  if (loadingCtx) {
    return (
      <ContadorPortalLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[hsl(165,60%,55%)]" /></div>
      </ContadorPortalLayout>
    );
  }

  if (!empresaAtiva) {
    return (
      <ContadorPortalLayout>
        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)] text-[hsl(0,0%,93%)]">
          <CardContent className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-[hsl(220,10%,40%)]" />
            <h2 className="text-lg font-semibold mb-1">Nenhuma empresa vinculada</h2>
            <p className="text-sm text-[hsl(220,10%,55%)]">Solicite ao administrador para vincular sua conta a uma empresa cliente.</p>
          </CardContent>
        </Card>
      </ContadorPortalLayout>
    );
  }

  const cards = [
    { label: "XMLs do mês", value: stats.xmls, icon: FileCode, color: "165,60%,55%", to: "/contador/xml" },
    { label: "Despesas pendentes", value: stats.despesasPendentes, icon: AlertTriangle, color: "38,90%,60%", to: "/contador/despesas?status=pendente" },
    { label: "Despesas do mês", value: stats.despesasMes, icon: Receipt, color: "210,80%,60%", to: "/contador/despesas" },
    { label: "Extratos importados", value: stats.extratos, icon: Banknote, color: "280,60%,65%", to: "/contador/financeiro" },
  ];

  return (
    <ContadorPortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,95%)]">Olá, contador 👋</h1>
          <p className="text-sm text-[hsl(220,10%,60%)] mt-1">
            {empresaAtiva.empresa_nome} {unidadeAtiva ? `· ${unidadeAtiva.nome}` : "· Todas as lojas"}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <Link key={c.label} to={c.to}>
              <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)] hover:border-[hsl(165,60%,40%)]/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ background: `hsl(${c.color}/0.15)` }}
                    >
                      <c.icon className="h-5 w-5" style={{ color: `hsl(${c.color})` }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-[hsl(0,0%,95%)]">{loading ? "—" : c.value}</p>
                  <p className="text-xs text-[hsl(220,10%,60%)] mt-1">{c.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
          <CardHeader>
            <CardTitle className="text-base text-[hsl(0,0%,95%)]">Atalhos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link to="/contador/xml" className="p-4 rounded-lg bg-[hsl(220,18%,14%)] hover:bg-[hsl(220,18%,17%)] border border-[hsl(220,15%,20%)] transition-colors">
              <FileCode className="h-5 w-5 text-[hsl(165,60%,55%)] mb-2" />
              <p className="text-sm font-medium text-[hsl(0,0%,93%)]">Importar XMLs</p>
              <p className="text-xs text-[hsl(220,10%,55%)] mt-1">NF-e, NFC-e, CT-e</p>
            </Link>
            <Link to="/contador/despesas" className="p-4 rounded-lg bg-[hsl(220,18%,14%)] hover:bg-[hsl(220,18%,17%)] border border-[hsl(220,15%,20%)] transition-colors">
              <Receipt className="h-5 w-5 text-[hsl(38,90%,60%)] mb-2" />
              <p className="text-sm font-medium text-[hsl(0,0%,93%)]">Despesas escaneadas</p>
              <p className="text-xs text-[hsl(220,10%,55%)] mt-1">OCR automático com IA</p>
            </Link>
            <Link to="/contador/financeiro" className="p-4 rounded-lg bg-[hsl(220,18%,14%)] hover:bg-[hsl(220,18%,17%)] border border-[hsl(220,15%,20%)] transition-colors">
              <Banknote className="h-5 w-5 text-[hsl(280,60%,65%)] mb-2" />
              <p className="text-sm font-medium text-[hsl(0,0%,93%)]">Importar OFX/PDF</p>
              <p className="text-xs text-[hsl(220,10%,55%)] mt-1">Extrato bancário</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </ContadorPortalLayout>
  );
}
