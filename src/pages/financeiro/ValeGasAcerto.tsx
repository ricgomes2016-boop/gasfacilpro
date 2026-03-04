import { MainLayout } from "@/components/layout/MainLayout";
import { parseLocalDate } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useValeGas } from "@/contexts/ValeGasContext";
import { 
  FileText, Banknote, Building2, CheckCircle2, Clock, AlertCircle, Plus,
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function ValeGasAcerto({ embedded }: { embedded?: boolean } = {}) {
  const { parceiros, vales, acertos, gerarAcerto, registrarPagamentoAcerto } = useValeGas();
  
  const [novoAcertoDialog, setNovoAcertoDialog] = useState(false);
  const [parceiroSelecionado, setParceiroSelecionado] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [pagamentoAcertoId, setPagamentoAcertoId] = useState<string | null>(null);

  const parceirosConsignados = parceiros.filter(p => p.tipo === "consignado" && p.ativo);

  const valesPendentes = useMemo(() => {
    const pendentes: Record<string, { quantidade: number; valor: number }> = {};
    parceirosConsignados.forEach(parceiro => {
      const valesNaoAcertados = vales.filter(v => 
        v.parceiro_id === parceiro.id && v.status === "utilizado"
      );
      pendentes[parceiro.id] = {
        quantidade: valesNaoAcertados.length,
        valor: valesNaoAcertados.reduce((sum, v) => sum + Number(v.valor), 0),
      };
    });
    return pendentes;
  }, [parceirosConsignados, vales]);

  const handleGerarAcerto = async () => {
    if (!parceiroSelecionado) { toast.error("Selecione um parceiro"); return; }
    try {
      const acerto = await gerarAcerto(parceiroSelecionado);
      if (acerto) {
        toast.success(`Acerto gerado! ${acerto.quantidade} vales - R$ ${Number(acerto.valor_total).toFixed(2)}`);
        setNovoAcertoDialog(false);
        setParceiroSelecionado("");
      } else {
        toast.error("Não há vales pendentes de acerto");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar acerto");
    }
  };

  const handleRegistrarPagamento = async () => {
    if (!pagamentoAcertoId || !formaPagamento) { toast.error("Selecione a forma de pagamento"); return; }
    await registrarPagamentoAcerto(pagamentoAcertoId, formaPagamento);
    toast.success("Pagamento registrado!");
    setPagamentoAcertoId(null);
    setFormaPagamento("");
  };

  const totais = useMemo(() => ({
    acertosPendentes: acertos.filter(a => a.status_pagamento === "pendente").length,
    valorPendente: acertos.filter(a => a.status_pagamento === "pendente").reduce((s, a) => s + Number(a.valor_total), 0),
    acertosPagos: acertos.filter(a => a.status_pagamento === "pago").length,
    valorPago: acertos.filter(a => a.status_pagamento === "pago").reduce((s, a) => s + Number(a.valor_total), 0),
  }), [acertos]);

  const parceiroInfo = parceiroSelecionado ? parceiros.find(p => p.id === parceiroSelecionado) : null;

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-end">
          <Dialog open={novoAcertoDialog} onOpenChange={setNovoAcertoDialog}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Gerar Acerto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Gerar Novo Acerto</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Parceiro Consignado</label>
                  <Select value={parceiroSelecionado} onValueChange={setParceiroSelecionado}>
                    <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                    <SelectContent>{parceirosConsignados.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {parceiroInfo && valesPendentes[parceiroInfo.id] && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p className="font-medium">{parceiroInfo.nome}</p>
                    <div className="flex justify-between text-sm"><span>Vales pendentes:</span><span className="font-bold">{valesPendentes[parceiroInfo.id].quantidade}</span></div>
                    <div className="flex justify-between text-sm"><span>Valor total:</span><span className="font-bold text-green-600">R$ {valesPendentes[parceiroInfo.id].valor.toFixed(2)}</span></div>
                  </div>
                )}
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setNovoAcertoDialog(false)}>Cancelar</Button>
                  <Button onClick={handleGerarAcerto}>Gerar Acerto</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-amber-500/10"><Clock className="h-6 w-6 text-amber-500" /></div><div><p className="text-2xl font-bold">{totais.acertosPendentes}</p><p className="text-sm text-muted-foreground">Acertos Pendentes</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-destructive/10"><Banknote className="h-6 w-6 text-destructive" /></div><div><p className="text-2xl font-bold">R$ {totais.valorPendente.toFixed(0)}</p><p className="text-sm text-muted-foreground">Valor Pendente</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-green-500/10"><CheckCircle2 className="h-6 w-6 text-green-500" /></div><div><p className="text-2xl font-bold">{totais.acertosPagos}</p><p className="text-sm text-muted-foreground">Acertos Pagos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Banknote className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">R$ {totais.valorPago.toFixed(0)}</p><p className="text-sm text-muted-foreground">Total Recebido</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-500" /> Parceiros com Vales Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {parceirosConsignados.map(parceiro => {
                const pendente = valesPendentes[parceiro.id];
                if (!pendente || pendente.quantidade === 0) return null;
                return (
                  <Card key={parceiro.id} className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div><p className="font-medium">{parceiro.nome}</p><p className="text-sm text-muted-foreground mt-1">{pendente.quantidade} vales utilizados</p></div>
                        <Building2 className="h-5 w-5 text-amber-600" />
                      </div>
                      <p className="text-2xl font-bold text-amber-600 mt-3">R$ {pendente.valor.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                );
              })}
              {Object.values(valesPendentes).every(p => p.quantidade === 0) && (
                <div className="col-span-3 text-center py-8 text-muted-foreground">Não há vales pendentes</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Histórico de Acertos</CardTitle><CardDescription>Acertos realizados</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Parceiro</TableHead><TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead><TableHead className="text-center">Status</TableHead>
                  <TableHead>Pagamento</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acertos.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum acerto registrado</TableCell></TableRow>
                ) : acertos.map(acerto => (
                  <TableRow key={acerto.id}>
                    <TableCell>{format(new Date(acerto.data_acerto), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell className="font-medium">{acerto.parceiro_nome}</TableCell>
                    <TableCell className="text-center">{acerto.quantidade}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(acerto.valor_total).toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={acerto.status_pagamento === "pago" ? "default" : "destructive"}>
                        {acerto.status_pagamento === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {acerto.data_pagamento ? (
                        <div className="text-sm">
                          <p>{format(parseLocalDate(acerto.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}</p>
                          <p className="text-muted-foreground">{acerto.forma_pagamento}</p>
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {acerto.status_pagamento === "pendente" && (
                        <Dialog open={pagamentoAcertoId === acerto.id} onOpenChange={open => setPagamentoAcertoId(open ? acerto.id : null)}>
                          <DialogTrigger asChild><Button size="sm">Receber</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Registrar Recebimento</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                              <div className="p-4 bg-muted rounded-lg">
                                <p className="font-medium">{acerto.parceiro_nome}</p>
                                <p className="text-sm text-muted-foreground">{acerto.quantidade} vales</p>
                                <p className="text-2xl font-bold text-green-600 mt-2">R$ {Number(acerto.valor_total).toFixed(2)}</p>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Forma de Pagamento</label>
                                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="PIX">PIX</SelectItem>
                                    <SelectItem value="Transferência">Transferência</SelectItem>
                                    <SelectItem value="Cheque">Cheque</SelectItem>
                                    <SelectItem value="Boleto">Boleto</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-2 justify-end pt-4">
                                <Button variant="outline" onClick={() => setPagamentoAcertoId(null)}>Cancelar</Button>
                                <Button onClick={handleRegistrarPagamento}>Confirmar</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Acerto de Contas - Vale Gás" subtitle="Gerencie os acertos com parceiros consignados" />
      {content}
    </MainLayout>
  );
}
