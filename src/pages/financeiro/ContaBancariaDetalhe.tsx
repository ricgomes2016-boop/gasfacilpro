import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { getBankTheme, bankGradient } from "@/lib/bancos/bankThemes";
import QuickShortcuts from "@/components/financeiro/conta-detalhe/QuickShortcuts";
import ExtratoTabela from "@/components/financeiro/conta-detalhe/ExtratoTabela";
import VisaoGeralPanel from "@/components/financeiro/conta-detalhe/VisaoGeralPanel";
import PixPanel from "@/components/financeiro/conta-detalhe/PixPanel";
import BoletosPanel from "@/components/financeiro/conta-detalhe/BoletosPanel";
import OfxPanel from "@/components/financeiro/conta-detalhe/OfxPanel";


interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  agencia: string | null;
  conta: string | null;
  tipo: string;
  saldo_atual: number;
  chave_pix: string | null;
  ativo: boolean;
  unidade_id: string | null;
  empresa_id?: string | null;
  unidades?: { nome: string } | null;
}

export default function ContaBancariaDetalhe() {
  const { contaId } = useParams<{ contaId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { user } = useAuth();
  const [mostrarSaldo, setMostrarSaldo] = useState(true);
  const [aba, setAba] = useState("visao");
  const [transferForm, setTransferForm] = useState({ conta_destino_id: "", valor: "", descricao: "" });

  const { data: conta, isLoading } = useQuery({
    queryKey: ["conta-bancaria-detalhe", contaId],
    queryFn: async () => {
      if (!contaId) return null;
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*, unidades(nome)")
        .eq("id", contaId)
        .maybeSingle();
      if (error) throw error;
      return data as ContaBancaria | null;
    },
    enabled: !!contaId,
  });

  const { data: outrasContas = [] } = useQuery({
    queryKey: ["contas-bancarias-transfer", unidadeAtual?.id, empresa?.id, contaId],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id,nome,banco,saldo_atual,unidade_id").eq("ativo", true);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q.order("nome");
      if (error) throw error;
      return (data || []).filter((c: any) => c.id !== contaId);
    },
    enabled: !!contaId,
  });

  const { data: transferencias = [] } = useQuery({
    queryKey: ["transferencias-conta", contaId],
    queryFn: async () => {
      if (!contaId) return [];
      const { data, error } = await supabase
        .from("transferencias_bancarias")
        .select("*, conta_origem:contas_bancarias!transferencias_bancarias_conta_origem_id_fkey(id,nome,banco), conta_destino:contas_bancarias!transferencias_bancarias_conta_destino_id_fkey(id,nome,banco)")
        .or(`conta_origem_id.eq.${contaId},conta_destino_id.eq.${contaId}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!contaId,
  });

  const theme = useMemo(() => getBankTheme(conta?.banco || ""), [conta?.banco]);

  const invalidarConta = () => {
    queryClient.invalidateQueries({ queryKey: ["conta-bancaria-detalhe", contaId] });
    queryClient.invalidateQueries({ queryKey: ["contas-bancarias"] });
  };

  const realizarTransferencia = async () => {
    if (!conta) return;
    const valor = parseFloat((transferForm.valor || "").replace(",", "."));
    if (!transferForm.conta_destino_id || !valor || valor <= 0) {
      toast.error("Preencha conta de destino e valor"); return;
    }
    if (valor > Number(conta.saldo_atual)) {
      toast.error("Saldo insuficiente"); return;
    }
    const destino = outrasContas.find((c: any) => c.id === transferForm.conta_destino_id);
    if (!destino) { toast.error("Conta destino inválida"); return; }

    const { data: transRow, error: transError } = await supabase
      .from("transferencias_bancarias")
      .insert({
        conta_origem_id: conta.id,
        conta_destino_id: destino.id,
        valor,
        descricao: transferForm.descricao || null,
        user_id: user?.id,
      })
      .select()
      .maybeSingle();
    if (transError) { toast.error("Erro na transferência"); console.error(transError); return; }

    const novoSaldoOrigem = Number(conta.saldo_atual) - valor;
    const novoSaldoDestino = Number(destino.saldo_atual) + valor;
    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldoOrigem }).eq("id", conta.id);
    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldoDestino }).eq("id", destino.id);

    const hoje = format(new Date(), "yyyy-MM-dd");
    const descBase = transferForm.descricao ? ` - ${transferForm.descricao}` : "";
    const { error: movErr } = await supabase.from("movimentacoes_bancarias").insert([
      {
        conta_bancaria_id: conta.id,
        data: hoje,
        tipo: "saida",
        categoria: "transferencia",
        descricao: `Transferência enviada para ${destino.nome}${descBase}`,
        valor,
        saldo_apos: novoSaldoOrigem,
        referencia_id: transRow?.id ?? null,
        referencia_tipo: "transferencia_bancaria",
        user_id: user?.id,
        unidade_id: conta.unidade_id,
      },
      {
        conta_bancaria_id: destino.id,
        data: hoje,
        tipo: "entrada",
        categoria: "transferencia",
        descricao: `Transferência recebida de ${conta.nome}${descBase}`,
        valor,
        saldo_apos: novoSaldoDestino,
        referencia_id: transRow?.id ?? null,
        referencia_tipo: "transferencia_bancaria",
        user_id: user?.id,
        unidade_id: destino.unidade_id ?? conta.unidade_id,
      },
    ]);
    if (movErr) console.error("Erro ao gravar movimentações:", movErr);

    toast.success("Transferência realizada!");
    setTransferForm({ conta_destino_id: "", valor: "", descricao: "" });
    invalidarConta();
    queryClient.invalidateQueries({ queryKey: ["transferencias-conta", contaId] });
    queryClient.invalidateQueries({ queryKey: ["contas-bancarias-transfer"] });
    queryClient.invalidateQueries({ queryKey: ["extrato-tabela"] });
    queryClient.invalidateQueries({ queryKey: ["visao-geral-movs"] });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <Header title="Carregando..." />
        <div className="p-6 text-muted-foreground">Carregando conta...</div>
      </MainLayout>
    );
  }

  if (!conta) {
    return (
      <MainLayout>
        <Header title="Conta não encontrada" />
        <div className="p-6">
          <p className="text-muted-foreground mb-4">Esta conta não existe ou não pertence à unidade atual.</p>
          <Button asChild variant="outline"><Link to="/financeiro/contas-bancarias"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link></Button>
        </div>
      </MainLayout>
    );
  }

  const saldo = Number(conta.saldo_atual);
  const tipoLabel = ({ corrente: "Conta Corrente", poupanca: "Poupança", caixa_interno: "Caixa Interno" } as Record<string, string>)[conta.tipo] || conta.tipo;

  return (
    <MainLayout>
      <Header title={conta.nome} subtitle={`${theme.nome} • ${tipoLabel}`} />
      <div className="p-4 md:p-6 space-y-5">
        {/* Header do banco */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="p-5 md:p-7" style={{ background: bankGradient(theme), color: theme.textColor }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/financeiro/contas-bancarias")}
                  className="h-9 w-9 rounded-full hover:bg-white/15" style={{ color: theme.textColor }} title="Voltar">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-lg shadow"
                  style={{ background: "rgba(255,255,255,0.18)", color: theme.textColor }}>
                  {theme.initials}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-80">{theme.nome}</p>
                  <h2 className="text-xl md:text-2xl font-bold leading-tight">{conta.nome}</h2>
                  <p className="text-xs opacity-80 mt-1">
                    {conta.agencia && `Ag ${conta.agencia}`}{conta.agencia && conta.conta && " • "}{conta.conta && `Conta ${conta.conta}`}
                    {!conta.agencia && !conta.conta && tipoLabel}
                  </p>
                </div>
              </div>
              <Badge style={{ background: "rgba(255,255,255,0.2)", color: theme.textColor, border: "none" }}>
                {conta.unidades?.nome || "Sem unidade"}
              </Badge>
            </div>

            <div className="mt-6 md:mt-8">
              <div className="flex items-center gap-2 opacity-85">
                <span className="text-xs uppercase tracking-wider">Saldo disponível</span>
                <button onClick={() => setMostrarSaldo(v => !v)} className="opacity-80 hover:opacity-100"
                  title={mostrarSaldo ? "Ocultar" : "Mostrar"} style={{ color: theme.textColor }}>
                  {mostrarSaldo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-3xl md:text-4xl font-extrabold mt-1 tracking-tight">
                {mostrarSaldo ? `R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "R$ ••••••"}
              </p>
              {conta.chave_pix && <p className="text-xs opacity-80 mt-2">PIX: {conta.chave_pix}</p>}
            </div>
          </div>
        </Card>

        {/* Tabs principais */}
        {(() => {
          const isCaixa = conta.tipo === "caixa_interno";
          return (
        <Tabs value={aba} onValueChange={setAba} className="space-y-4">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            {!isCaixa && <TabsTrigger value="extrato">Extrato Bancário</TabsTrigger>}
            {!isCaixa && <TabsTrigger value="pix">PIX</TabsTrigger>}
            <TabsTrigger value="transferencia">Transferência</TabsTrigger>
            {!isCaixa && <TabsTrigger value="ofx">OFX</TabsTrigger>}
          </TabsList>

          {/* Atalhos rápidos */}
          <QuickShortcuts
            activeTab={aba}
            onChange={setAba}
            accentColor={theme.primary}
            items={isCaixa ? ["visao", "transferencia"] : undefined}
          />

          <TabsContent value="visao" className="mt-4">
            <VisaoGeralPanel contaId={conta.id} accentColor={theme.primary} isCaixa={isCaixa} saldoAtual={saldo} />
          </TabsContent>

          {!isCaixa && (
            <TabsContent value="extrato" className="mt-4">
              <ExtratoTabela contaId={conta.id} saldoAtual={saldo} />
            </TabsContent>
          )}

          {!isCaixa && (
            <TabsContent value="pix" className="mt-4">
              <PixPanel
                contaId={conta.id}
                saldoAtual={saldo}
                unidadeId={conta.unidade_id}
                accentColor={theme.primary}
                onPago={invalidarConta}
              />
            </TabsContent>
          )}

          {!isCaixa && (
            <TabsContent value="boletos" className="mt-4">
              <BoletosPanel
                contaId={conta.id}
                saldoAtual={saldo}
                unidadeId={conta.unidade_id}
                accentColor={theme.primary}
                onPago={invalidarConta}
              />
            </TabsContent>
          )}

          <TabsContent value="transferencia" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Send className="h-5 w-5" style={{ color: theme.primary }} />
                    <h3 className="font-semibold">Nova transferência</h3>
                  </div>
                  <div>
                    <Label>Conta destino *</Label>
                    <Select value={transferForm.conta_destino_id} onValueChange={v => setTransferForm({ ...transferForm, conta_destino_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                      <SelectContent>
                        {outrasContas.length === 0 ? (
                          <SelectItem value="nenhum" disabled>Nenhuma outra conta disponível</SelectItem>
                        ) : (
                          outrasContas.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome} ({c.banco})</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor (R$) *</Label>
                    <Input value={transferForm.valor} onChange={e => setTransferForm({ ...transferForm, valor: e.target.value })} placeholder="0,00" />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input value={transferForm.descricao} onChange={e => setTransferForm({ ...transferForm, descricao: e.target.value })} placeholder="Ex: Repasse do caixa" />
                  </div>
                  <Button onClick={realizarTransferencia} className="w-full" style={{ background: theme.primary, color: theme.textColor }}>
                    <Send className="h-4 w-4 mr-2" />Transferir
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Últimas transferências</h3>
                  {transferencias.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma transferência envolvendo esta conta.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Origem → Destino</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transferencias.map((t: any) => {
                            const saiu = t.conta_origem_id === conta.id;
                            return (
                              <TableRow key={t.id}>
                                <TableCell className="text-xs">{format(new Date(t.data_transferencia || t.created_at), "dd/MM/yyyy")}</TableCell>
                                <TableCell className="text-sm">
                                  <span className="font-medium">{t.conta_origem?.nome}</span>
                                  {" → "}
                                  <span className="font-medium">{t.conta_destino?.nome}</span>
                                  {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${saiu ? "text-destructive" : "text-green-600"}`}>
                                  {saiu ? "-" : "+"}R$ {Number(t.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {!isCaixa && (
            <TabsContent value="ofx" className="mt-4">
              <OfxPanel contaId={conta.id} unidadeId={conta.unidade_id} accentColor={theme.primary} />

            </TabsContent>
          )}
        </Tabs>
          );
        })()}

      </div>
    </MainLayout>
  );
}
