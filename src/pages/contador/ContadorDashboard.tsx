import { useEffect, useMemo, useState } from "react";
import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileCode, Receipt, Banknote, AlertTriangle, Loader2, TrendingUp, TrendingDown, Crown, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

interface UnidadeRow {
  id: string;
  nome: string;
  tipo: string;
  receita: number;
  despesa: number;
  resultado: number;
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function ContadorDashboard() {
  const { empresaAtiva, unidades, unidadeAtiva, loading: loadingCtx } = useContador();
  const { range } = usePeriodo();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ xmls: 0, despesasPendentes: 0, despesasMes: 0, extratos: 0 });
  const [linhas, setLinhas] = useState<UnidadeRow[]>([]);

  // Filter unidades by selected (or all)
  const unidadesAlvo = useMemo(() => {
    if (!empresaAtiva) return [];
    if (unidadeAtiva) return unidades.filter((u) => u.id === unidadeAtiva.id);
    return unidades;
  }, [unidades, unidadeAtiva, empresaAtiva]);

  useEffect(() => {
    if (!empresaAtiva || unidadesAlvo.length === 0) {
      setLinhas([]);
      setStats({ xmls: 0, despesasPendentes: 0, despesasMes: 0, extratos: 0 });
      return;
    }
    setLoading(true);
    const ids = unidadesAlvo.map((u) => u.id);

    Promise.all([
      // Receitas (pedidos entregues no período)
      supabase
        .from("pedidos")
        .select("unidade_id, valor_total, status, created_at")
        .in("unidade_id", ids)
        .gte("created_at", range.inicioISOFull)
        .lte("created_at", range.fimISOFull),
      // Despesas no período
      supabase
        .from("despesas_contabeis" as any)
        .select("unidade_id, valor, status, data_despesa")
        .eq("empresa_id", empresaAtiva.empresa_id)
        .gte("data_despesa", range.inicioISO)
        .lte("data_despesa", range.fimISO),
      // XMLs no período
      supabase
        .from("notas_fiscais" as any)
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.inicioISOFull)
        .lte("created_at", range.fimISOFull),
      // Extratos no período
      supabase
        .from("extrato_bancario" as any)
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.inicioISOFull)
        .lte("created_at", range.fimISOFull),
    ])
      .then(([pedRes, despRes, xmlRes, extRes]: any[]) => {
        const pedidos = pedRes?.data ?? [];
        const despesas = despRes?.data ?? [];

        const map: Record<string, UnidadeRow> = {};
        unidadesAlvo.forEach((u) => {
          map[u.id] = { id: u.id, nome: u.nome, tipo: u.tipo, receita: 0, despesa: 0, resultado: 0 };
        });

        pedidos.forEach((p: any) => {
          if (p.status === "cancelado") return;
          const r = map[p.unidade_id];
          if (r) r.receita += Number(p.valor_total ?? 0);
        });

        let pend = 0;
        despesas.forEach((d: any) => {
          if (d.status === "pendente") pend += 1;
          const r = map[d.unidade_id];
          if (r) r.despesa += Number(d.valor ?? 0);
        });

        Object.values(map).forEach((r) => (r.resultado = r.receita - r.despesa));

        const ordered = Object.values(map).sort((a, b) => {
          if (a.tipo === b.tipo) return a.nome.localeCompare(b.nome);
          return a.tipo === "matriz" ? -1 : 1;
        });

        setLinhas(ordered);
        setStats({
          xmls: xmlRes?.count ?? 0,
          despesasPendentes: pend,
          despesasMes: despesas.length,
          extratos: extRes?.count ?? 0,
        });
      })
      .finally(() => setLoading(false));
  }, [empresaAtiva, unidadesAlvo, range.inicioISO, range.fimISO]);

  const totais = useMemo(() => {
    const t = linhas.reduce(
      (acc, r) => ({ receita: acc.receita + r.receita, despesa: acc.despesa + r.despesa }),
      { receita: 0, despesa: 0 }
    );
    return { ...t, resultado: t.receita - t.despesa };
  }, [linhas]);

  if (loadingCtx) {
    return (
      <ContadorPortalLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(165,60%,55%)]" />
        </div>
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
            <p className="text-sm text-[hsl(220,10%,55%)]">
              Solicite ao administrador para vincular sua conta a uma empresa cliente.
            </p>
          </CardContent>
        </Card>
      </ContadorPortalLayout>
    );
  }

  const cards = [
    { label: "Receita do período", value: fmtBRL(totais.receita), icon: TrendingUp, color: "150,70%,55%", to: "/contador/financeiro" },
    { label: "Despesa do período", value: fmtBRL(totais.despesa), icon: TrendingDown, color: "0,80%,65%", to: "/contador/despesas" },
    { label: "Resultado", value: fmtBRL(totais.resultado), icon: Banknote, color: totais.resultado >= 0 ? "150,70%,55%" : "0,80%,65%", to: "/contador/financeiro" },
    { label: "Despesas pendentes", value: stats.despesasPendentes.toString(), icon: AlertTriangle, color: "38,90%,60%", to: "/contador/despesas?status=pendente" },
  ];

  const maxAbs = Math.max(...linhas.map((l) => Math.max(l.receita, l.despesa)), 1);

  return (
    <ContadorPortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,95%)]">Olá, contador 👋</h1>
          <p className="text-sm text-[hsl(220,10%,60%)] mt-1">
            {empresaAtiva.empresa_nome} {unidadeAtiva ? `· ${unidadeAtiva.nome}` : "· Todas as lojas"} · <span className="text-[hsl(165,60%,55%)]">{range.label}</span>
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
                  <p className="text-lg font-bold text-[hsl(0,0%,95%)] truncate">{loading ? "—" : c.value}</p>
                  <p className="text-xs text-[hsl(220,10%,60%)] mt-1">{c.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
          <CardHeader>
            <CardTitle className="text-base text-[hsl(0,0%,95%)] flex items-center justify-between">
              <span>Consolidado por unidade</span>
              <span className="text-xs font-normal text-[hsl(220,10%,55%)]">{linhas.length} {linhas.length === 1 ? "loja" : "lojas"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(165,60%,55%)]" />
              </div>
            ) : linhas.length === 0 ? (
              <p className="text-sm text-[hsl(220,10%,55%)] text-center py-8">Sem dados no período.</p>
            ) : (
              <div className="space-y-3">
                {linhas.map((l) => {
                  const recPct = (l.receita / maxAbs) * 100;
                  const despPct = (l.despesa / maxAbs) * 100;
                  return (
                    <div key={l.id} className="p-3 rounded-lg bg-[hsl(220,18%,13%)] border border-[hsl(220,15%,18%)]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {l.tipo === "matriz" ? (
                            <Crown className="h-3.5 w-3.5 text-[hsl(165,60%,55%)] shrink-0" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 text-[hsl(220,10%,55%)] shrink-0" />
                          )}
                          <span className="text-sm font-medium text-[hsl(0,0%,93%)] truncate">{l.nome}</span>
                        </div>
                        <span
                          className="text-sm font-semibold tabular-nums shrink-0 ml-2"
                          style={{ color: l.resultado >= 0 ? "hsl(150,70%,60%)" : "hsl(0,80%,68%)" }}
                        >
                          {fmtBRL(l.resultado)}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase text-[hsl(150,60%,50%)] w-14 shrink-0">Receita</span>
                          <div className="flex-1 h-2 bg-[hsl(220,18%,10%)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[hsl(150,70%,50%)] rounded-full transition-all"
                              style={{ width: `${recPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-[hsl(220,10%,75%)] w-24 text-right shrink-0">
                            {fmtBRL(l.receita)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase text-[hsl(0,70%,60%)] w-14 shrink-0">Despesa</span>
                          <div className="flex-1 h-2 bg-[hsl(220,18%,10%)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[hsl(0,75%,55%)] rounded-full transition-all"
                              style={{ width: `${despPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-[hsl(220,10%,75%)] w-24 text-right shrink-0">
                            {fmtBRL(l.despesa)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-3 border-t border-[hsl(220,15%,18%)]">
                  <span className="text-sm font-semibold text-[hsl(0,0%,95%)]">Total consolidado</span>
                  <div className="flex items-center gap-4 text-sm tabular-nums">
                    <span className="text-[hsl(150,70%,60%)]">{fmtBRL(totais.receita)}</span>
                    <span className="text-[hsl(0,80%,68%)]">−{fmtBRL(totais.despesa)}</span>
                    <span
                      className="font-bold"
                      style={{ color: totais.resultado >= 0 ? "hsl(150,70%,60%)" : "hsl(0,80%,68%)" }}
                    >
                      = {fmtBRL(totais.resultado)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
          <CardHeader>
            <CardTitle className="text-base text-[hsl(0,0%,95%)]">Atalhos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link to="/contador/xml" className="p-4 rounded-lg bg-[hsl(220,18%,14%)] hover:bg-[hsl(220,18%,17%)] border border-[hsl(220,15%,20%)] transition-colors">
              <FileCode className="h-5 w-5 text-[hsl(165,60%,55%)] mb-2" />
              <p className="text-sm font-medium text-[hsl(0,0%,93%)]">Importar XMLs ({stats.xmls})</p>
              <p className="text-xs text-[hsl(220,10%,55%)] mt-1">NF-e, NFC-e, CT-e</p>
            </Link>
            <Link to="/contador/despesas" className="p-4 rounded-lg bg-[hsl(220,18%,14%)] hover:bg-[hsl(220,18%,17%)] border border-[hsl(220,15%,20%)] transition-colors">
              <Receipt className="h-5 w-5 text-[hsl(38,90%,60%)] mb-2" />
              <p className="text-sm font-medium text-[hsl(0,0%,93%)]">Despesas ({stats.despesasMes})</p>
              <p className="text-xs text-[hsl(220,10%,55%)] mt-1">OCR automático com IA</p>
            </Link>
            <Link to="/contador/financeiro" className="p-4 rounded-lg bg-[hsl(220,18%,14%)] hover:bg-[hsl(220,18%,17%)] border border-[hsl(220,15%,20%)] transition-colors">
              <Banknote className="h-5 w-5 text-[hsl(280,60%,65%)] mb-2" />
              <p className="text-sm font-medium text-[hsl(0,0%,93%)]">Extratos ({stats.extratos})</p>
              <p className="text-xs text-[hsl(220,10%,55%)] mt-1">OFX/PDF bancário</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </ContadorPortalLayout>
  );
}
