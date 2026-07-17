import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  BarChart3, Eye, Heart, MessageCircle, Share2, MousePointerClick,
  TrendingUp, ShoppingCart, Sparkles, Trophy, Calendar,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const platformColors: Record<string, string> = {
  instagram: "#E1306C",
  facebook: "#1877F2",
  tiktok: "#000000",
  whatsapp: "#25D366",
  youtube: "#FF0000",
};

const platformEmoji: Record<string, string> = {
  instagram: "📸", facebook: "📘", tiktok: "🎵", whatsapp: "💬", youtube: "▶️",
};

export default function MarketingMetricas() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [periodo, setPeriodo] = useState<"7" | "30" | "90">("30");
  const [plataforma, setPlataforma] = useState<string>("todas");

  const since = useMemo(() => startOfDay(subDays(new Date(), Number(periodo))), [periodo]);

  const { data: metricas = [] } = useQuery({
    queryKey: ["mkt-metricas", empresaId, periodo],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from("marketing_metricas")
        .select("*")
        .eq("empresa_id", empresaId)
        .gte("data_metrica", since.toISOString().slice(0, 10))
        .order("data_metrica", { ascending: true });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["mkt-ags-metricas", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from("marketing_agendamentos")
        .select("id, plataforma, texto, data_agendamento, status")
        .eq("empresa_id", empresaId)
        .limit(500);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["mkt-avaliacoes", empresaId, periodo],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from("avaliacoes_entrega")
        .select("nota, comentario, created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const filtered = useMemo(() => {
    return plataforma === "todas" ? metricas : metricas.filter((m: any) => m.plataforma === plataforma);
  }, [metricas, plataforma]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc: any, m: any) => {
        acc.alcance += m.alcance || 0;
        acc.impressoes += m.impressoes || 0;
        acc.curtidas += m.curtidas || 0;
        acc.comentarios += m.comentarios || 0;
        acc.compartilhamentos += m.compartilhamentos || 0;
        acc.cliques += m.cliques || 0;
        acc.conversoes += m.conversoes || 0;
        acc.pedidos_gerados += m.pedidos_gerados || 0;
        return acc;
      },
      { alcance: 0, impressoes: 0, curtidas: 0, comentarios: 0, compartilhamentos: 0, cliques: 0, conversoes: 0, pedidos_gerados: 0 }
    );
  }, [filtered]);

  const engajamentoTaxa = totals.alcance > 0
    ? (((totals.curtidas + totals.comentarios + totals.compartilhamentos) / totals.alcance) * 100).toFixed(1)
    : "0";

  const ctr = totals.impressoes > 0 ? ((totals.cliques / totals.impressoes) * 100).toFixed(2) : "0";

  // Série diária
  const serie = useMemo(() => {
    const map = new Map<string, any>();
    filtered.forEach((m: any) => {
      const key = m.data_metrica;
      const ex = map.get(key) || { data: key, alcance: 0, engajamento: 0, cliques: 0 };
      ex.alcance += m.alcance || 0;
      ex.engajamento += (m.curtidas || 0) + (m.comentarios || 0) + (m.compartilhamentos || 0);
      ex.cliques += m.cliques || 0;
      map.set(key, ex);
    });
    return Array.from(map.values())
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((d) => ({ ...d, label: format(new Date(d.data), "dd/MM", { locale: ptBR }) }));
  }, [filtered]);

  // Por plataforma
  const porPlataforma = useMemo(() => {
    const map = new Map<string, any>();
    metricas.forEach((m: any) => {
      const k = m.plataforma;
      const ex = map.get(k) || { plataforma: k, alcance: 0, engajamento: 0, conversoes: 0 };
      ex.alcance += m.alcance || 0;
      ex.engajamento += (m.curtidas || 0) + (m.comentarios || 0) + (m.compartilhamentos || 0);
      ex.conversoes += m.conversoes || 0;
      map.set(k, ex);
    });
    return Array.from(map.values());
  }, [metricas]);

  // Top posts (por agendamento_id)
  const topPosts = useMemo(() => {
    const map = new Map<string, any>();
    filtered.forEach((m: any) => {
      if (!m.agendamento_id) return;
      const ex = map.get(m.agendamento_id) || {
        agendamento_id: m.agendamento_id,
        plataforma: m.plataforma,
        alcance: 0, engajamento: 0, cliques: 0, conversoes: 0, pedidos_gerados: 0,
      };
      ex.alcance += m.alcance || 0;
      ex.engajamento += (m.curtidas || 0) + (m.comentarios || 0) + (m.compartilhamentos || 0);
      ex.cliques += m.cliques || 0;
      ex.conversoes += m.conversoes || 0;
      ex.pedidos_gerados += m.pedidos_gerados || 0;
      map.set(m.agendamento_id, ex);
    });
    const arr = Array.from(map.values()).map((p: any) => {
      const ag = agendamentos.find((a: any) => a.id === p.agendamento_id);
      return { ...p, texto: ag?.texto || "", data: ag?.data_agendamento };
    });
    arr.sort((a: any, b: any) => (b.engajamento + b.conversoes * 5) - (a.engajamento + a.conversoes * 5));
    return arr.slice(0, 5);
  }, [filtered, agendamentos]);

  const insights = useMemo(() => {
    const out: string[] = [];
    if (filtered.length === 0) return out;
    if (porPlataforma.length > 1) {
      const best = [...porPlataforma].sort((a, b) => b.engajamento - a.engajamento)[0];
      if (best?.engajamento) out.push(`📈 ${(platformEmoji[best.plataforma] || "")} ${best.plataforma} é seu canal de maior engajamento (${best.engajamento.toLocaleString("pt-BR")} interações).`);
    }
    if (totals.pedidos_gerados > 0) out.push(`🛒 ${totals.pedidos_gerados} pedidos foram atribuídos ao marketing nos últimos ${periodo} dias.`);
    if (Number(ctr) > 2) out.push(`🎯 CTR de ${ctr}% está acima da média do setor — seus posts convertem em cliques.`);
    if (Number(engajamentoTaxa) < 1 && totals.alcance > 100) out.push(`⚠️ Taxa de engajamento baixa (${engajamentoTaxa}%). Tente perguntas, enquetes e CTAs mais diretos.`);
    if (topPosts[0]) out.push(`🏆 Seu post de melhor desempenho é em ${platformEmoji[topPosts[0].plataforma] || ""} ${topPosts[0].plataforma}.`);
    return out;
  }, [filtered, porPlataforma, totals, ctr, engajamentoTaxa, topPosts, periodo]);

  const kpiList = [
    { label: "Alcance", value: totals.alcance, icon: Eye, color: "text-info", bg: "bg-info/10" },
    { label: "Engajamento", value: totals.curtidas + totals.comentarios + totals.compartilhamentos, icon: Heart, color: "text-primary", bg: "bg-primary/10" },
    { label: "Cliques", value: totals.cliques, icon: MousePointerClick, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pedidos gerados", value: totals.pedidos_gerados, icon: ShoppingCart, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <MainLayout>
      <Header title="Métricas de Marketing" subtitle="Performance real dos seus posts e campanhas" />
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={plataforma} onValueChange={setPlataforma}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as plataformas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Badge variant="outline" className="gap-1.5"><Calendar className="h-3 w-3" /> {filtered.length} registros</Badge>
        </div>

        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold mb-2">Sem métricas no período</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Conecte suas contas de rede social ou registre métricas dos posts publicados para ver gráficos, tendências e insights da IA.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpiList.map((k) => (
                <Card key={k.label} className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${k.bg}`}><k.icon className={`h-5 w-5 ${k.color}`} /></div>
                    <div>
                      <p className="text-2xl font-bold">{k.value.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Taxa de engajamento</p>
                  <p className="text-2xl font-bold">{engajamentoTaxa}%</p>
                  <p className="text-[11px] text-muted-foreground mt-1">interações / alcance</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">CTR (cliques / impressões)</p>
                  <p className="text-2xl font-bold">{ctr}%</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Conversões</p>
                  <p className="text-2xl font-bold">{totals.conversoes.toLocaleString("pt-BR")}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Evolução diária</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={serie}>
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="alcance" stroke="hsl(var(--primary))" fill="url(#grad)" name="Alcance" />
                      <Area type="monotone" dataKey="engajamento" stroke="#ec4899" fill="#ec489922" name="Engajamento" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Por plataforma</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porPlataforma}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="plataforma" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="alcance" fill="hsl(var(--primary))" name="Alcance" />
                        <Bar dataKey="engajamento" fill="#ec4899" name="Engajamento" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" /> Top posts</CardTitle>
                  <CardDescription>Maior engajamento + conversão</CardDescription>
                </CardHeader>
                <CardContent>
                  {topPosts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Sem posts agendados ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {topPosts.map((p: any, i: number) => (
                        <div key={p.agendamento_id} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40">
                          <span className="text-base font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                          <span className="text-base">{platformEmoji[p.plataforma] || "📝"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{p.texto?.slice(0, 80) || "Post"}</p>
                            <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                              <span>👁️ {p.alcance.toLocaleString("pt-BR")}</span>
                              <span>❤️ {p.engajamento.toLocaleString("pt-BR")}</span>
                              <span>🛒 {p.pedidos_gerados}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {insights.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Insights da IA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {insights.map((t, i) => (
                    <div key={i} className="text-sm p-2.5 rounded-lg bg-background/60">{t}</div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Avaliações de entrega como combustível de conteúdo */}
            {avaliacoes.length > 0 && (() => {
              const total = avaliacoes.length;
              const soma = avaliacoes.reduce((s: number, a: any) => s + (a.nota || 0), 0);
              const media = total ? (soma / total).toFixed(2) : "0";
              const positivas = avaliacoes.filter((a: any) => (a.nota || 0) >= 4 && (a.comentario || "").trim().length > 10).slice(0, 5);
              return (
                <Card className="border-success/30 bg-success/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="h-4 w-4 text-success" /> Avaliações de entrega — combustível para conteúdo
                    </CardTitle>
                    <CardDescription>
                      Média {media} ⭐ · {total} avaliações no período. Use os elogios abaixo como prova social em posts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {positivas.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Sem comentários positivos suficientes ainda. Peça avaliações pós-entrega via WhatsApp.</p>
                    ) : positivas.map((a: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-background/60 border border-success/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-warning text-sm">{"⭐".repeat(a.nota || 0)}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(a.created_at), "dd/MM/yyyy")}</span>
                        </div>
                        <p className="text-sm italic">"{a.comentario}"</p>
                        <Button
                          size="sm" variant="ghost"
                          className="mt-1.5 text-xs h-7 gap-1.5"
                          onClick={() => {
                            const texto = `💚 Quem é cliente nosso recomenda:\n\n"${a.comentario}"\n\n⭐⭐⭐⭐⭐\n\nPeça seu gás pelo WhatsApp!`;
                            navigator.clipboard.writeText(texto);
                          }}
                        >
                          📋 Transformar em post
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })()}
          </>
        )}
      </div>
    </MainLayout>
  );
}
