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
  Gift, Users, CheckCircle, Clock, DollarSign, Loader2, Crown, Zap, Share2, Save, ReceiptText, RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface IndicadorRanking {
  clienteId: string;
  nome: string;
  telefone: string;
  indicacoes: number;
  convertidas: number;
  ganhoTotal: number;
}

type CreditoStatus = "pendente" | "aprovado" | "estornado";

interface CreditoIndicacaoLinha {
  id: string;
  data: string;
  beneficiario: string;
  telefone: string;
  papel: "Indicador" | "Indicado";
  indicado: string;
  valor: number;
  status: CreditoStatus;
  pedidoId: string | null;
  pedidoNumero: number | null;
  descricao: string;
}

export default function ProgramaIndicacao() {
  const { empresa } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalIndicacoes: 0, convertidas: 0, creditos: 0, ativos: 0 });
  const [ranking, setRanking] = useState<IndicadorRanking[]>([]);
  const [creditos, setCreditos] = useState<CreditoIndicacaoLinha[]>([]);
  const [config, setConfig] = useState({ valorIndicador: 10, valorIndicado: 10, ativo: true });
  const [editandoConfig, setEditandoConfig] = useState(false);
  const [configTemp, setConfigTemp] = useState({ valorIndicador: "10", valorIndicado: "10" });

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
  const statusMeta: Record<CreditoStatus, { label: string; className: string; icon: typeof Clock }> = {
    pendente: { label: "Pendente", className: "bg-muted text-muted-foreground border-border", icon: Clock },
    aprovado: { label: "Aprovado", className: "bg-primary/10 text-primary border-primary/30", icon: CheckCircle },
    estornado: { label: "Estornado", className: "bg-destructive/10 text-destructive border-destructive/30", icon: RotateCcw },
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!empresa?.id) return;
      setLoading(true);
      try {
        const { data: configData, error: configError } = await (supabase as any)
          .from("programa_indicacao_config")
          .select("valor_indicador, valor_indicado, ativo")
          .eq("empresa_id", empresa.id)
          .maybeSingle();
        if (configError) throw configError;
        if (configData) {
          setConfig({
            valorIndicador: Number(configData.valor_indicador) || 10,
            valorIndicado: Number(configData.valor_indicado) || 10,
            ativo: configData.ativo !== false,
          });
        }

        const { data: indicacoes, error: indicacoesError } = await (supabase as any)
          .from("cliente_indicacoes")
          .select("id, indicador_cliente_id, indicado_cliente_id, status, valor_credito_indicador, valor_credito_indicado, primeiro_pedido_id, created_at, convertido_em")
          .eq("empresa_id", empresa.id)
          .order("created_at", { ascending: false })
          .limit(1000);
        if (indicacoesError) throw indicacoesError;

        const { data: creditosData, error: creditosError } = await (supabase as any)
          .from("cliente_creditos")
          .select("id, cliente_id, indicacao_id, valor, status, descricao, pedido_id, created_at")
          .eq("empresa_id", empresa.id)
          .eq("tipo", "indicacao")
          .order("created_at", { ascending: false })
          .limit(1000);
        if (creditosError) throw creditosError;

        const indicacoesMap = new Map<string, any>((indicacoes || []).map((i: any) => [i.id, i]));
        const indicadorIds = Array.from(new Set<string>((indicacoes || []).flatMap((i: any) => [i.indicador_cliente_id, i.indicado_cliente_id]).concat((creditosData || []).map((c: any) => c.cliente_id)).filter(Boolean)));
        const clientesMap = new Map<string, { nome: string; telefone: string }>();
        if (indicadorIds.length > 0) {
          const { data: clientesData, error: clientesError } = await supabase
            .from("clientes")
            .select("id, nome, telefone")
            .in("id", indicadorIds);
          if (clientesError) throw clientesError;
          (clientesData || []).forEach((c: any) => clientesMap.set(c.id, { nome: c.nome, telefone: c.telefone || "" }));
        }

        const pedidoIds = Array.from(new Set<string>((creditosData || []).map((c: any) => c.pedido_id).concat((indicacoes || []).map((i: any) => i.primeiro_pedido_id)).filter(Boolean)));
        const pedidosMap = new Map<string, number>();
        if (pedidoIds.length > 0) {
          const { data: pedidosData, error: pedidosError } = await supabase
            .from("pedidos")
            .select("id, numero_sequencial")
            .in("id", pedidoIds);
          if (pedidosError) throw pedidosError;
          (pedidosData || []).forEach((p: any) => pedidosMap.set(p.id, p.numero_sequencial || null));
        }

        const porIndicador = new Map<string, IndicadorRanking>();
        (indicacoes || []).forEach((indicacao: any) => {
          const cliente = clientesMap.get(indicacao.indicador_cliente_id);
          const atual = porIndicador.get(indicacao.indicador_cliente_id) || {
            clienteId: indicacao.indicador_cliente_id,
            nome: cliente?.nome || "Cliente não identificado",
            telefone: cliente?.telefone || "",
            indicacoes: 0,
            convertidas: 0,
            ganhoTotal: 0,
          };
          atual.indicacoes += 1;
          if (indicacao.status === "convertida") {
            atual.convertidas += 1;
            atual.ganhoTotal += Number(indicacao.valor_credito_indicador) || 0;
          }
          porIndicador.set(indicacao.indicador_cliente_id, atual);
        });

        const rankingCalc = Array.from(porIndicador.values())
          .sort((a, b) => b.convertidas - a.convertidas || b.indicacoes - a.indicacoes)
          .slice(0, 20);

        setRanking(rankingCalc);
        setStats({
          totalIndicacoes: (indicacoes || []).length,
          convertidas: (indicacoes || []).filter((i: any) => i.status === "convertida").length,
          creditos: (indicacoes || []).reduce((s: number, i: any) => s + (i.status === "convertida" ? Number(i.valor_credito_indicador) || 0 : 0), 0),
          ativos: rankingCalc.filter(r => r.indicacoes >= 2).length,
        });

        const linhasAprovadas: CreditoIndicacaoLinha[] = (creditosData || []).map((credito: any) => {
          const indicacao = credito.indicacao_id ? indicacoesMap.get(credito.indicacao_id) : null;
          const cliente = clientesMap.get(credito.cliente_id);
          const indicado = indicacao ? clientesMap.get(indicacao.indicado_cliente_id) : null;
          const status: CreditoStatus = ["cancelado", "expirado"].includes(credito.status) ? "estornado" : "aprovado";
          return {
            id: credito.id,
            data: credito.created_at,
            beneficiario: cliente?.nome || "Cliente não identificado",
            telefone: cliente?.telefone || "",
            papel: indicacao?.indicado_cliente_id === credito.cliente_id ? "Indicado" : "Indicador",
            indicado: indicado?.nome || "Não vinculado",
            valor: Number(credito.valor) || 0,
            status,
            pedidoId: credito.pedido_id || indicacao?.primeiro_pedido_id || null,
            pedidoNumero: pedidosMap.get(credito.pedido_id || indicacao?.primeiro_pedido_id) || null,
            descricao: credito.descricao || "Crédito de indicação",
          };
        });

        const linhasPendentes: CreditoIndicacaoLinha[] = (indicacoes || [])
          .filter((indicacao: any) => indicacao.status === "pendente")
          .flatMap((indicacao: any) => {
            const indicador = clientesMap.get(indicacao.indicador_cliente_id);
            const indicado = clientesMap.get(indicacao.indicado_cliente_id);
            return [
              {
                id: `${indicacao.id}-indicador`, data: indicacao.created_at, beneficiario: indicador?.nome || "Cliente não identificado", telefone: indicador?.telefone || "", papel: "Indicador" as const,
                indicado: indicado?.nome || "Cliente indicado", valor: Number(indicacao.valor_credito_indicador) || 0, status: "pendente" as const, pedidoId: null, pedidoNumero: null, descricao: "Aguardando 1º pedido entregue do indicado",
              },
              {
                id: `${indicacao.id}-indicado`, data: indicacao.created_at, beneficiario: indicado?.nome || "Cliente não identificado", telefone: indicado?.telefone || "", papel: "Indicado" as const,
                indicado: indicado?.nome || "Cliente indicado", valor: Number(indicacao.valor_credito_indicado) || 0, status: "pendente" as const, pedidoId: null, pedidoNumero: null, descricao: "Crédito de boas-vindas aguardando aprovação",
              },
            ];
          });

        setCreditos([...linhasAprovadas, ...linhasPendentes].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [empresa?.id]);

  const conversao = stats.totalIndicacoes > 0
    ? Math.round((stats.convertidas / stats.totalIndicacoes) * 100)
    : 0;

  const handleSalvarConfig = async () => {
    if (!empresa?.id) return;
    const vi = parseFloat(configTemp.valorIndicador);
    const vd = parseFloat(configTemp.valorIndicado);
    if (isNaN(vi) || isNaN(vd) || vi < 0 || vd < 0) {
      toast.error("Informe valores válidos");
      return;
    }
    const { error } = await (supabase as any).from("programa_indicacao_config").upsert({
      empresa_id: empresa.id,
      valor_indicador: vi,
      valor_indicado: vd,
      ativo: config.ativo,
    }, { onConflict: "empresa_id" });
    if (error) { toast.error("Erro ao salvar configurações"); return; }
    setConfig(c => ({ ...c, valorIndicador: vi, valorIndicado: vd }));
    setEditandoConfig(false);
    toast.success("Valores atualizados!");
  };

  const handleToggleAtivo = async () => {
    if (!empresa?.id) return;
    const novoAtivo = !config.ativo;
    const { error } = await (supabase as any).from("programa_indicacao_config").upsert({
      empresa_id: empresa.id,
      valor_indicador: config.valorIndicador,
      valor_indicado: config.valorIndicado,
      ativo: novoAtivo,
    }, { onConflict: "empresa_id" });
    if (error) { toast.error("Erro ao atualizar status do programa"); return; }
    setConfig(c => ({ ...c, ativo: novoAtivo }));
    toast.success(novoAtivo ? "Programa ativado!" : "Programa desativado");
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
          <TabsList className="h-11">
            <TabsTrigger value="ranking"><Crown className="h-4 w-4 mr-1.5" />Ranking</TabsTrigger>
            <TabsTrigger value="creditos"><ReceiptText className="h-4 w-4 mr-1.5" />Créditos</TabsTrigger>
            <TabsTrigger value="config"><Zap className="h-4 w-4 mr-1.5" />Configurações</TabsTrigger>
            <TabsTrigger value="como"><Gift className="h-4 w-4 mr-1.5" />Como Funciona</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Top 3 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">🏆 Top Indicadores</h3>
                {ranking.slice(0, 3).map((r, i) => (
                  <Card key={r.clienteId} className={i === 0 ? "border-primary/40 bg-primary/5" : ""}>
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
                          <TableRow key={r.clienteId}>
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

          <TabsContent value="creditos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Créditos do Programa de Indicação</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Beneficiário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Indicado</TableHead>
                      <TableHead>Pedido gerador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditos.map((credito) => {
                      const meta = statusMeta[credito.status];
                      const StatusIcon = meta.icon;
                      return (
                        <TableRow key={credito.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(credito.data)}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{credito.beneficiario}</p>
                              <p className="text-xs text-muted-foreground">{credito.telefone || credito.descricao}</p>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{credito.papel}</Badge></TableCell>
                          <TableCell className="text-sm">{credito.indicado}</TableCell>
                          <TableCell>
                            {credito.pedidoId ? (
                              <div className="text-sm">
                                <p className="font-medium">Pedido #{credito.pedidoNumero || credito.pedidoId.slice(0, 8)}</p>
                                <p className="text-xs text-muted-foreground">Gerou o crédito</p>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Aguardando pedido</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.className}>
                              <StatusIcon className="h-3 w-3 mr-1" />{meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(credito.valor)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {creditos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum crédito de indicação registrado ainda
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
                        <Button variant="outline" size="sm" className="ml-auto" onClick={handleToggleAtivo}>
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
