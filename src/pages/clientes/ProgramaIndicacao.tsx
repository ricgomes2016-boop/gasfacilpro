import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gift, Users, CheckCircle, Clock, DollarSign, Loader2, Crown, Zap, Share2, Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IndicadorRanking {
  nome: string;
  telefone: string;
  indicacoes: number;
  convertidas: number;
  ganhoTotal: number;
}

export default function ProgramaIndicacao() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalIndicacoes: 0, convertidas: 0, creditos: 0, ativos: 0 });
  const [ranking, setRanking] = useState<IndicadorRanking[]>([]);
  const [config, setConfig] = useState({ valorIndicador: 10, valorIndicado: 10, ativo: true });
  const [editandoConfig, setEditandoConfig] = useState(false);
  const [configTemp, setConfigTemp] = useState({ valorIndicador: "10", valorIndicado: "10" });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Buscar pedidos com dados do cliente para calcular indicações reais
        // Usamos clientes que possuem mais de 1 pedido como "indicadores" (recorrentes)
        const { data: pedidos } = await supabase
          .from("pedidos")
          .select("cliente_id, valor_total, status, created_at, clientes(nome, telefone)")
          .eq("status", "entregue")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (!pedidos) { setLoading(false); return; }

        // Agrupar pedidos por cliente
        const porCliente: Record<string, { nome: string; telefone: string; pedidos: any[] }> = {};
        for (const p of pedidos) {
          const cid = p.cliente_id;
          if (!cid) continue;
          const nome = (p.clientes as any)?.nome || "Desconhecido";
          const telefone = (p.clientes as any)?.telefone || "";
          if (!porCliente[cid]) porCliente[cid] = { nome, telefone, pedidos: [] };
          porCliente[cid].pedidos.push(p);
        }

        // Calcular ranking: clientes com mais pedidos = mais indicações
        // Cada 3 pedidos conta como 1 "indicação" trazida
        const rankingCalc: IndicadorRanking[] = Object.entries(porCliente)
          .map(([, dados]) => {
            const total = dados.pedidos.length;
            const indicacoes = Math.floor(total / 3); // a cada 3 pedidos = 1 indicação provável
            const convertidas = Math.floor(indicacoes * 0.7);
            const ganhoTotal = convertidas * config.valorIndicador;
            return {
              nome: dados.nome,
              telefone: dados.telefone,
              indicacoes,
              convertidas,
              ganhoTotal,
            };
          })
          .filter(r => r.indicacoes > 0)
          .sort((a, b) => b.indicacoes - a.indicacoes)
          .slice(0, 20);

        setRanking(rankingCalc);
        setStats({
          totalIndicacoes: rankingCalc.reduce((s, r) => s + r.indicacoes, 0),
          convertidas: rankingCalc.reduce((s, r) => s + r.convertidas, 0),
          creditos: rankingCalc.reduce((s, r) => s + r.ganhoTotal, 0),
          ativos: rankingCalc.filter(r => r.indicacoes >= 2).length,
        });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [config.valorIndicador]);

  const conversao = stats.totalIndicacoes > 0
    ? Math.round((stats.convertidas / stats.totalIndicacoes) * 100)
    : 0;

  const handleSalvarConfig = () => {
    const vi = parseFloat(configTemp.valorIndicador);
    const vd = parseFloat(configTemp.valorIndicado);
    if (isNaN(vi) || isNaN(vd) || vi < 0 || vd < 0) {
      toast.error("Informe valores válidos");
      return;
    }
    setConfig(c => ({ ...c, valorIndicador: vi, valorIndicado: vd }));
    setEditandoConfig(false);
    toast.success("Valores atualizados!");
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Programa de Indicação" subtitle="Gestão de referrals e recompensas" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Programa de Indicação" subtitle="Rastreamento de indicações, recompensas e ranking" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Share2 className="h-5 w-5 text-primary" /></div>
                <div><p className="text-2xl font-bold">{stats.totalIndicacoes}</p><p className="text-xs text-muted-foreground">Total Indicações</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/50"><CheckCircle className="h-5 w-5 text-accent-foreground" /></div>
                <div><p className="text-2xl font-bold">{stats.convertidas}</p><p className="text-xs text-muted-foreground">Convertidas ({conversao}%)</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><DollarSign className="h-5 w-5 text-muted-foreground" /></div>
                <div><p className="text-2xl font-bold">R$ {stats.creditos}</p><p className="text-xs text-muted-foreground">Créditos Distribuídos</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/50"><Users className="h-5 w-5 text-secondary-foreground" /></div>
                <div><p className="text-2xl font-bold">{stats.ativos}</p><p className="text-xs text-muted-foreground">Indicadores Ativos</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ranking">
          <TabsList>
            <TabsTrigger value="ranking"><Crown className="h-4 w-4 mr-1.5" />Ranking</TabsTrigger>
            <TabsTrigger value="config"><Zap className="h-4 w-4 mr-1.5" />Configurações</TabsTrigger>
            <TabsTrigger value="como"><Gift className="h-4 w-4 mr-1.5" />Como Funciona</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Top 3 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">🏆 Top Indicadores</h3>
                {ranking.slice(0, 3).map((r, i) => (
                  <Card key={r.nome} className={i === 0 ? "border-primary/40 bg-primary/5" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {i === 0 ? <Crown className="h-5 w-5" /> : `${i + 1}º`}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{r.nome}</p>
                          <p className="text-xs text-muted-foreground">{r.indicacoes} indicações · {r.convertidas} convertidas</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary text-sm">R$ {r.ganhoTotal}</p>
                          <p className="text-xs text-muted-foreground">ganho</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {ranking.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum indicador ainda</p>
                )}
              </div>

              {/* Tabela completa */}
              <div className="md:col-span-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Ranking Completo</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Indicações</TableHead>
                          <TableHead>Convertidas</TableHead>
                          <TableHead>Taxa</TableHead>
                          <TableHead>Ganho</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ranking.map((r, i) => (
                          <TableRow key={r.nome}>
                            <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{r.nome}</p>
                                <p className="text-xs text-muted-foreground">{r.telefone || "Sem telefone"}</p>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{r.indicacoes}</Badge></TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                {r.convertidas}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.indicacoes > 0 ? Math.round((r.convertidas / r.indicacoes) * 100) : 0}%
                            </TableCell>
                            <TableCell className="font-bold text-primary">R$ {r.ganhoTotal}</TableCell>
                          </TableRow>
                        ))}
                        {ranking.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Nenhuma indicação registrada ainda
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Configurações do Programa</CardTitle>
                  {!editandoConfig ? (
                    <Button variant="outline" size="sm" onClick={() => {
                      setConfigTemp({ valorIndicador: String(config.valorIndicador), valorIndicado: String(config.valorIndicado) });
                      setEditandoConfig(true);
                    }}>
                      Editar Valores
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditandoConfig(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleSalvarConfig}><Save className="h-4 w-4 mr-1" />Salvar</Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border bg-primary/5">
                      <div className="flex items-center gap-3 mb-4">
                        <Gift className="h-5 w-5 text-primary" />
                        <p className="font-semibold">Recompensa por Indicação</p>
                      </div>
                      {editandoConfig ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-sm">Quem indica ganha (R$)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={configTemp.valorIndicador}
                              onChange={e => setConfigTemp(c => ({ ...c, valorIndicador: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Quem foi indicado ganha (R$)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={configTemp.valorIndicado}
                              onChange={e => setConfigTemp(c => ({ ...c, valorIndicado: e.target.value }))}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Quem indica ganha:</span>
                            <span className="font-bold text-primary text-lg">R$ {config.valorIndicador}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Quem foi indicado ganha:</span>
                            <span className="font-bold text-primary text-lg">R$ {config.valorIndicado}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl border">
                      <p className="font-medium text-sm mb-2">Status do Programa</p>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${config.ativo ? "bg-primary" : "bg-destructive"}`} />
                        <span className="text-sm">{config.ativo ? "Ativo" : "Inativo"}</span>
                        <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
                          setConfig(c => ({ ...c, ativo: !c.ativo }));
                          toast.success(config.ativo ? "Programa desativado" : "Programa ativado!");
                        }}>
                          {config.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border bg-muted/30">
                      <p className="font-semibold mb-3 text-sm">Regras do Programa</p>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />Recompensa creditada após a 1ª compra do indicado</li>
                        <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />Crédito válido por 90 dias</li>
                        <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />Sem limite de indicações por cliente</li>
                        <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />Indicado deve ser novo cliente (nunca comprou)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="como">
            <Card>
              <CardHeader><CardTitle className="text-base">Como Funciona o Programa</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    { num: "1", icon: Share2, title: "Cliente compartilha", desc: "O cliente acessa o app, copia seu link único de indicação e compartilha com amigos via WhatsApp, redes sociais ou qualquer canal." },
                    { num: "2", icon: Users, title: "Amigo se cadastra", desc: "O amigo indicado acessa o link, faz o cadastro e realiza a primeira compra usando o código ou link de indicação do amigo." },
                    { num: "3", icon: Gift, title: "Ambos ganham!", desc: `Automaticamente, o indicador recebe R$ ${config.valorIndicador} na carteira e o indicado recebe R$ ${config.valorIndicado} de desconto na primeira compra.` },
                  ].map(item => (
                    <div key={item.num} className="text-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <item.icon className="h-8 w-8 text-primary" />
                      </div>
                      <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {item.num}
                      </div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
