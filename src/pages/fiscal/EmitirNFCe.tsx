import { useState, useEffect, useCallback } from "react";
import { parseLocalDate } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Send, Search, Printer, Layers, Play, RotateCcw, CheckCircle2, XCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarNotas, criarNota, transmitirParaSefaz, adicionarItem, type NotaFiscal } from "@/services/focusNfeService";
import { ProductSearch, type ItemVenda } from "@/components/vendas/ProductSearch";
import { emitirDocumentoVenderGas } from "@/lib/fiscal/venderGasAgent";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";

interface LoteConfig {
  produto: string;
  precoUnitario: number;
  quantidadeTotal: number;
  totalNotas: number;
  qtdMinima: number;
  qtdMaxima: number;
  formaPagamento: string;
}

interface NotaLotePreview {
  indice: number;
  quantidade: number;
  valorTotal: number;
  status: "pendente" | "emitindo" | "sucesso" | "erro";
  erro?: string;
}

/**
 * Distribui `totalUnidades` unidades aleatoriamente entre `totalNotas` notas,
 * respeitando min/max por nota.
 */
function distribuirAleatoriamente(totalUnidades: number, totalNotas: number, min: number, max: number): number[] {
  if (totalNotas <= 0 || totalUnidades <= 0) return [];
  if (min * totalNotas > totalUnidades || max * totalNotas < totalUnidades) return [];

  const resultado: number[] = new Array(totalNotas).fill(min);
  let restante = totalUnidades - min * totalNotas;

  // Distribui o restante aleatoriamente
  while (restante > 0) {
    const idx = Math.floor(Math.random() * totalNotas);
    if (resultado[idx] < max) {
      resultado[idx]++;
      restante--;
    }
  }

  // Embaralha para mais aleatoriedade
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }

  return resultado;
}

export default function EmitirNFCe() {
  const { toast } = useToast();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [itensNfce, setItensNfce] = useState<ItemVenda[]>([]);
  const [documentoNfce, setDocumentoNfce] = useState("");
  const [formaPagamentoNfce, setFormaPagamentoNfce] = useState("dinheiro");
  const [preparandoNfce, setPreparandoNfce] = useState(false);

  // Lote state
  const [loteConfig, setLoteConfig] = useState<LoteConfig>({
    produto: "P13",
    precoUnitario: 95,
    quantidadeTotal: 200,
    totalNotas: 40,
    qtdMinima: 1,
    qtdMaxima: 10,
    formaPagamento: "dinheiro",
  });
  const [lotePreview, setLotePreview] = useState<NotaLotePreview[]>([]);
  const [loteEmitindo, setLoteEmitindo] = useState(false);
  const [loteProgresso, setLoteProgresso] = useState(0);
  const [loteConcluido, setLoteConcluido] = useState(false);

  const carregarNotas = async () => {
    try {
      const data = await listarNotas("nfce");
      setNotas(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregarNotas(); }, []);

  const handleEmitir = async () => {
    const documento = documentoNfce.replace(/\D/g, "");
    if (documento && ![11, 14].includes(documento.length)) {
      toast({ title: "Documento inválido", description: "Informe CPF com 11 dígitos, CNPJ com 14 dígitos ou deixe o campo vazio.", variant: "destructive" });
      return;
    }
    if (!itensNfce.length) {
      toast({ title: "Adicione um produto", description: "A NFC-e precisa ter ao menos um item.", variant: "destructive" });
      return;
    }
    if (!empresa?.cnpj || !unidadeAtual?.id) {
      toast({ title: "Empresa não identificada", description: "Selecione a unidade Forte Gás antes de continuar.", variant: "destructive" });
      return;
    }
    setPreparandoNfce(true);
    try {
      const total = itensNfce.reduce((soma, item) => soma + item.total, 0);
      const nota = await criarNota({
        tipo: "nfce",
        status: "rascunho",
        destinatario_nome: "Consumidor Final",
        destinatario_cpf_cnpj: documento || null,
        valor_total: total,
        forma_pagamento: formaPagamentoNfce,
      });
      for (const item of itensNfce) {
        await adicionarItem({
          nota_fiscal_id: nota.id,
          produto_id: item.produto_id,
          descricao: item.nome,
          unidade: "UN",
          quantidade: item.quantidade,
          valor_unitario: item.preco_unitario,
          valor_total: item.total,
        });
      }
      const result = await emitirDocumentoVenderGas({
        tipoDocumento: "nfce",
        unidadeId: unidadeAtual.id,
        cnpjEmitente: empresa.cnpj,
        pedidoId: nota.id,
        numeroPedido: nota.numero || nota.id.slice(0, 8),
        somentePreparar: true,
        destinatario: { nome: "Consumidor Final", cpfCnpj: documento || undefined },
        itens: itensNfce.map((item) => ({ produtoId: item.produto_id, descricao: item.nome, quantidade: item.quantidade, valorUnitario: item.preco_unitario })),
        valorTotal: total,
        formaPagamento: formaPagamentoNfce,
      });
      if (!result.ok) throw new Error(result.mensagem);
      toast({ title: "NFC-e pronta para revisão", description: result.mensagem });
      carregarNotas();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setPreparandoNfce(false);
    }
  };

  // ===== Lote =====

  const gerarPreview = useCallback(() => {
    const { quantidadeTotal, totalNotas, qtdMinima, qtdMaxima, precoUnitario } = loteConfig;

    if (totalNotas <= 0 || quantidadeTotal <= 0) {
      toast({ title: "Configuração inválida", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    if (qtdMinima * totalNotas > quantidadeTotal) {
      toast({ title: "Impossível distribuir", description: `Mínimo de ${qtdMinima} × ${totalNotas} notas = ${qtdMinima * totalNotas}, mas total é ${quantidadeTotal}.`, variant: "destructive" });
      return;
    }
    if (qtdMaxima * totalNotas < quantidadeTotal) {
      toast({ title: "Impossível distribuir", description: `Máximo de ${qtdMaxima} × ${totalNotas} notas = ${qtdMaxima * totalNotas}, mas total é ${quantidadeTotal}.`, variant: "destructive" });
      return;
    }

    const distribuicao = distribuirAleatoriamente(quantidadeTotal, totalNotas, qtdMinima, qtdMaxima);
    const preview: NotaLotePreview[] = distribuicao.map((qtd, i) => ({
      indice: i + 1,
      quantidade: qtd,
      valorTotal: qtd * precoUnitario,
      status: "pendente",
    }));
    setLotePreview(preview);
    setLoteProgresso(0);
    setLoteConcluido(false);
  }, [loteConfig, toast]);

  const emitirLote = async () => {
    if (lotePreview.length === 0) return;
    setLoteEmitindo(true);
    setLoteProgresso(0);
    setLoteConcluido(false);

    const updated = [...lotePreview];

    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: "emitindo" };
      setLotePreview([...updated]);

      try {
        const nota = await criarNota({
          tipo: "nfce",
          status: "rascunho",
          destinatario_nome: "Consumidor Final",
          valor_total: updated[i].valorTotal,
          forma_pagamento: loteConfig.formaPagamento,
        });

        await adicionarItem({
          nota_fiscal_id: nota.id,
          descricao: loteConfig.produto,
          unidade: "UN",
          quantidade: updated[i].quantidade,
          valor_unitario: loteConfig.precoUnitario,
          valor_total: updated[i].valorTotal,
        });

        await transmitirParaSefaz(nota.id);
        updated[i] = { ...updated[i], status: "sucesso" };
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "erro", erro: e.message };
      }

      setLotePreview([...updated]);
      setLoteProgresso(Math.round(((i + 1) / updated.length) * 100));
    }

    setLoteEmitindo(false);
    setLoteConcluido(true);

    const sucessos = updated.filter(n => n.status === "sucesso").length;
    const erros = updated.filter(n => n.status === "erro").length;
    toast({
      title: "Emissão em lote concluída",
      description: `${sucessos} emitidas com sucesso${erros > 0 ? `, ${erros} com erro` : ""}.`,
    });

    carregarNotas();
  };

  const resetarLote = () => {
    setLotePreview([]);
    setLoteProgresso(0);
    setLoteConcluido(false);
  };

  const totalUnidadesPreview = lotePreview.reduce((s, n) => s + n.quantidade, 0);
  const totalValorPreview = lotePreview.reduce((s, n) => s + n.valorTotal, 0);
  const sucessosLote = lotePreview.filter(n => n.status === "sucesso").length;
  const errosLote = lotePreview.filter(n => n.status === "erro").length;

  return (
    <MainLayout>
      <Header title="NFC-e" subtitle="Gestão Fiscal" />
      <div className="space-y-6 p-4 md:p-6">
        <Tabs defaultValue="consultar">
          <TabsList className="h-11">
            <TabsTrigger value="consultar"><Search className="h-4 w-4 mr-2" />Consultar</TabsTrigger>
            <TabsTrigger value="emitir"><Plus className="h-4 w-4 mr-2" />Nova NFC-e</TabsTrigger>
            <TabsTrigger value="lote"><Layers className="h-4 w-4 mr-2" />Emissão em Lote</TabsTrigger>
          </TabsList>

          {/* ===== CONSULTAR ===== */}
          <TabsContent value="consultar">
            <Card>
              <CardHeader><CardTitle className="text-lg">Cupons Fiscais Emitidos (NFC-e)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-3 mb-4">
                  <Input placeholder="Buscar por cliente ou número..." className="max-w-sm" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : notas.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma NFC-e encontrada</TableCell></TableRow>
                    ) : notas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.numero || "—"}</TableCell>
                        <TableCell>{parseLocalDate(c.data_emissao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="font-medium">{c.destinatario_nome || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{c.destinatario_cpf_cnpj || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">R$ {Number(c.valor_total).toFixed(2)}</TableCell>
                        <TableCell><Badge variant={c.status === "autorizada" ? "default" : "destructive"}>{c.status}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" title="Reimprimir"><Printer className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== NOVA NFC-e ===== */}
          <TabsContent value="emitir">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-2 space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Dados do Consumidor (opcional)</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Label htmlFor="documento-nova-nfce">CPF ou CNPJ</Label>
                    <Input id="documento-nova-nfce" inputMode="numeric" value={documentoNfce} onChange={(e) => setDocumentoNfce(e.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="Preencha somente quando o consumidor solicitar" />
                    <p className="text-xs text-muted-foreground">Os demais dados do destinatário não são obrigatórios para NFC-e.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-lg">Itens da Venda</CardTitle></CardHeader>
                  <CardContent>
                    <ProductSearch itens={itensNfce} onChange={setItensNfce} unidadeId={unidadeAtual?.id} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Pagamento</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Select value={formaPagamentoNfce} onValueChange={setFormaPagamentoNfce}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="credito">Cartão Crédito</SelectItem>
                          <SelectItem value="debito">Cartão Débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>R$ {itensNfce.reduce((soma, item) => soma + item.total, 0).toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleEmitir} disabled={preparandoNfce || !itensNfce.length}>
                      {preparandoNfce ? <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {preparandoNfce ? "Preparando no Vender Gás..." : "Preparar NFC-e para revisão"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ===== EMISSÃO EM LOTE ===== */}
          <TabsContent value="lote">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Configuração */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configuração do Lote</CardTitle>
                    <CardDescription>Defina produto, preço e quantidade. O sistema distribui aleatoriamente entre as notas.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Produto</Label>
                      <Input
                        value={loteConfig.produto}
                        onChange={e => setLoteConfig(p => ({ ...p, produto: e.target.value }))}
                        placeholder="Ex: P13, P20, Água 20L"
                      />
                    </div>
                    <div>
                      <Label>Preço Unitário (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={loteConfig.precoUnitario}
                        onChange={e => setLoteConfig(p => ({ ...p, precoUnitario: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Quantidade Total de Unidades</Label>
                      <Input
                        type="number"
                        min={1}
                        value={loteConfig.quantidadeTotal}
                        onChange={e => setLoteConfig(p => ({ ...p, quantidadeTotal: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Total de NFC-e a emitir</Label>
                      <Input
                        type="number"
                        min={1}
                        value={loteConfig.totalNotas}
                        onChange={e => setLoteConfig(p => ({ ...p, totalNotas: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Qtd Mínima/Nota</Label>
                        <Input
                          type="number"
                          min={1}
                          value={loteConfig.qtdMinima}
                          onChange={e => setLoteConfig(p => ({ ...p, qtdMinima: Number(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Qtd Máxima/Nota</Label>
                        <Input
                          type="number"
                          min={1}
                          value={loteConfig.qtdMaxima}
                          onChange={e => setLoteConfig(p => ({ ...p, qtdMaxima: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Select value={loteConfig.formaPagamento} onValueChange={v => setLoteConfig(p => ({ ...p, formaPagamento: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="credito">Cartão Crédito</SelectItem>
                          <SelectItem value="debito">Cartão Débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button className="w-full" variant="outline" onClick={gerarPreview} disabled={loteEmitindo}>
                      <Eye className="h-4 w-4 mr-2" />Gerar Distribuição
                    </Button>
                  </CardContent>
                </Card>

                {/* Resumo */}
                {lotePreview.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Resumo do Lote</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Notas:</span>
                        <span className="font-semibold">{lotePreview.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Unidades:</span>
                        <span className="font-semibold">{totalUnidadesPreview}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor Total:</span>
                        <span className="font-bold text-primary">R$ {totalValorPreview.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Média/Nota:</span>
                        <span className="font-semibold">{(totalUnidadesPreview / lotePreview.length).toFixed(1)} un</span>
                      </div>

                      {loteEmitindo && (
                        <div className="space-y-2 pt-2">
                          <Progress value={loteProgresso} />
                          <p className="text-xs text-center text-muted-foreground">{loteProgresso}% — {sucessosLote + errosLote}/{lotePreview.length}</p>
                        </div>
                      )}

                      {loteConcluido && (
                        <div className="flex gap-4 pt-2 text-sm">
                          <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" />{sucessosLote}</span>
                          {errosLote > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" />{errosLote}</span>}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        {!loteConcluido ? (
                          <Button className="flex-1" onClick={emitirLote} disabled={loteEmitindo}>
                            <Play className="h-4 w-4 mr-2" />{loteEmitindo ? "Emitindo..." : "Emitir Lote"}
                          </Button>
                        ) : (
                          <Button className="flex-1" variant="outline" onClick={resetarLote}>
                            <RotateCcw className="h-4 w-4 mr-2" />Novo Lote
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Preview da distribuição */}
              <div className="md:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Distribuição das NFC-e
                      {lotePreview.length > 0 && <Badge variant="outline" className="ml-2">{lotePreview.length} notas</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lotePreview.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Configure o lote e clique em "Gerar Distribuição"</p>
                        <p className="text-xs mt-1">O sistema distribuirá as quantidades aleatoriamente entre as notas</p>
                      </div>
                    ) : (
                      <div className="max-h-[600px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">#</TableHead>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Valor Unit.</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lotePreview.map((nota) => (
                              <TableRow key={nota.indice} className={
                                nota.status === "sucesso" ? "bg-primary/5" :
                                nota.status === "erro" ? "bg-destructive/5" :
                                nota.status === "emitindo" ? "bg-accent/20" : ""
                              }>
                                <TableCell className="font-mono text-sm font-bold">{nota.indice}</TableCell>
                                <TableCell>{loteConfig.produto}</TableCell>
                                <TableCell className="text-right font-semibold">{nota.quantidade}</TableCell>
                                <TableCell className="text-right">R$ {loteConfig.precoUnitario.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-bold">R$ {nota.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-center">
                                  {nota.status === "pendente" && <Badge variant="outline">Pendente</Badge>}
                                  {nota.status === "emitindo" && <Badge variant="secondary" className="animate-pulse">Emitindo...</Badge>}
                                  {nota.status === "sucesso" && <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>}
                                  {nota.status === "erro" && (
                                    <Badge variant="destructive" title={nota.erro}>
                                      <XCircle className="h-3 w-3 mr-1" />Erro
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
