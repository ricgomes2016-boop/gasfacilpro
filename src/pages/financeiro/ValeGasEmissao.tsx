import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useValeGas } from "@/contexts/ValeGasContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  Plus, Package, Hash, Banknote, FileText, CreditCard, Eye,
  Trash2, XCircle, ShoppingBag, User, Receipt, Printer,
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type ModoEmissao = "lote" | "automatico" | "manual";

interface CupomVale {
  numero: number;
  codigo: string;
  valor: number;
  parceiroNome: string;
  parceiroCnpj: string | null;
  parceiroTelefone: string | null;
  parceiroTipo: string;
  produtoNome: string | null;
  clienteNome: string | null;
  descricao: string;
  dataEmissao: string;
}

function gerarCuponsDoLote(
  previewVales: Array<{ numero: number; codigo: string; valor: number }>,
  parceiro: { nome: string; cnpj: string | null; telefone: string | null; tipo: string } | undefined,
  produtoNome: string | null,
  clienteNome: string | null,
  descricao: string,
): CupomVale[] {
  if (!parceiro) return [];
  return previewVales.map(v => ({
    ...v,
    parceiroNome: parceiro.nome,
    parceiroCnpj: parceiro.cnpj,
    parceiroTelefone: parceiro.telefone,
    parceiroTipo: parceiro.tipo === "prepago" ? "Pré-pago" : "Consignado",
    produtoNome,
    clienteNome,
    descricao,
    dataEmissao: format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }),
  }));
}

function CupomPrint({ cupons, onClose }: { cupons: CupomVale[]; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set(cupons.map(c => c.numero)));

  const toggleAll = () => {
    if (selecionados.size === cupons.length) setSelecionados(new Set());
    else setSelecionados(new Set(cupons.map(c => c.numero)));
  };

  const toggleOne = (num: number) => {
    const next = new Set(selecionados);
    if (next.has(num)) next.delete(num); else next.add(num);
    setSelecionados(next);
  };

  const handlePrint = () => {
    const cuponsParaImprimir = cupons.filter(c => selecionados.has(c.numero));
    if (cuponsParaImprimir.length === 0) { toast.error("Selecione ao menos um vale"); return; }

    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups."); return; }

    printWindow.document.write(`
      <html><head><title>Cupons Vale Gás</title>
      <style>
        @media print { @page { margin: 10mm; } }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Courier New', monospace; }
        body { padding: 10px; }
        .cupom { border: 2px dashed #333; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; max-width: 350px; }
        .cupom-header { text-align: center; border-bottom: 1px solid #999; padding-bottom: 8px; margin-bottom: 8px; }
        .cupom-header h2 { font-size: 18px; margin-bottom: 4px; }
        .cupom-header p { font-size: 11px; color: #666; }
        .cupom-body { font-size: 12px; line-height: 1.6; }
        .cupom-body .row { display: flex; justify-content: space-between; }
        .cupom-body .label { font-weight: bold; }
        .cupom-numero { text-align: center; font-size: 28px; font-weight: bold; margin: 10px 0; letter-spacing: 2px; }
        .cupom-codigo { text-align: center; font-size: 14px; background: #f0f0f0; padding: 6px; margin: 8px 0; letter-spacing: 1px; }
        .cupom-valor { text-align: center; font-size: 22px; font-weight: bold; margin: 10px 0; }
        .cupom-footer { text-align: center; border-top: 1px solid #999; padding-top: 8px; margin-top: 8px; font-size: 10px; color: #999; }
        .divider { border-top: 1px dashed #ccc; margin: 6px 0; }
      </style></head><body>
      ${cuponsParaImprimir.map(c => `
        <div class="cupom">
          <div class="cupom-header">
            <h2>🔥 VALE GÁS</h2>
            <p>${c.descricao}</p>
          </div>
          <div class="cupom-body">
            <div class="cupom-numero">Nº ${c.numero}</div>
            <div class="cupom-codigo">${c.codigo}</div>
            <div class="divider"></div>
            <div class="row"><span class="label">Parceiro:</span><span>${c.parceiroNome}</span></div>
            ${c.parceiroCnpj ? `<div class="row"><span class="label">CNPJ:</span><span>${c.parceiroCnpj}</span></div>` : ""}
            ${c.parceiroTelefone ? `<div class="row"><span class="label">Tel:</span><span>${c.parceiroTelefone}</span></div>` : ""}
            <div class="row"><span class="label">Tipo:</span><span>${c.parceiroTipo}</span></div>
            <div class="divider"></div>
            ${c.produtoNome ? `<div class="row"><span class="label">Produto:</span><span>${c.produtoNome}</span></div>` : ""}
            ${c.clienteNome ? `<div class="row"><span class="label">Cliente:</span><span>${c.clienteNome}</span></div>` : ""}
            <div class="cupom-valor">R$ ${c.valor.toFixed(2)}</div>
          </div>
          <div class="cupom-footer">
            <p>Emitido em ${c.dataEmissao}</p>
            <p>Vale válido conforme condições do parceiro</p>
          </div>
        </div>
      `).join("")}
      <script>window.onload = function() { window.print(); window.close(); }</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Selecione os vales para imprimir</Label>
        <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
          {selecionados.size === cupons.length ? "Desmarcar todos" : "Selecionar todos"}
        </Button>
      </div>
      <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
        {cupons.map(c => (
          <div key={c.numero} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer" onClick={() => toggleOne(c.numero)}>
            <Checkbox checked={selecionados.has(c.numero)} onCheckedChange={() => toggleOne(c.numero)} />
            <div className="flex-1">
              <span className="font-mono font-bold">Nº {c.numero}</span>
              <span className="text-muted-foreground text-sm ml-2">{c.codigo}</span>
            </div>
            <span className="font-medium">R$ {c.valor.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="p-3 bg-muted rounded-lg text-sm">
        <p><strong>Parceiro:</strong> {cupons[0]?.parceiroNome} ({cupons[0]?.parceiroTipo})</p>
        {cupons[0]?.parceiroCnpj && <p><strong>CNPJ:</strong> {cupons[0]?.parceiroCnpj}</p>}
        {cupons[0]?.produtoNome && <p><strong>Produto:</strong> {cupons[0]?.produtoNome}</p>}
        {cupons[0]?.clienteNome && <p><strong>Cliente:</strong> {cupons[0]?.clienteNome}</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
        <Button type="button" className="gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Imprimir {selecionados.size > 0 ? `(${selecionados.size})` : ""}
        </Button>
      </div>
    </div>
  );
}

export default function ValeGasEmissao({ embedded }: { embedded?: boolean } = {}) {
  const { parceiros, lotes, vales, emitirLote, cancelarLote, registrarPagamentoLote, proximoNumeroVale } = useValeGas();
  const { unidadeAtual } = useUnidade();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pagamentoDialog, setPagamentoDialog] = useState<string | null>(null);
  const [valorPagamento, setValorPagamento] = useState("");
  const [previewVales, setPreviewVales] = useState<Array<{ numero: number; codigo: string; valor: number }>>([]);
  const [cuponsGerados, setCuponsGerados] = useState<CupomVale[]>([]);
  const [cupomDialogOpen, setCupomDialogOpen] = useState(false);
  const [modoEmissao, setModoEmissao] = useState<ModoEmissao>("automatico");

  const [formData, setFormData] = useState({
    parceiroId: "", quantidade: "", valorUnitario: "105", dataVencimento: "",
    observacao: "", descricao: "VALE GÁS", clienteId: "", produtoId: "",
    gerarContaReceber: false, dataVencimentoConta: "",
    numeroInicialCustom: "", numeroFinalCustom: "",
    numeroManual: "",
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-vale", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data: cuData } = await supabase.from("cliente_unidades").select("cliente_id").eq("unidade_id", unidadeAtual.id);
      const ids = (cuData || []).map((cu: any) => cu.cliente_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("clientes").select("id, nome").eq("ativo", true).in("id", ids).order("nome");
      return data || [];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-vale-gas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("id, nome, preco")
        .eq("ativo", true)
        .in("categoria", ["gas", "agua"]);
      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }
      const { data } = await query.order("nome");
      return data || [];
    },
  });

  const parceiro = parceiros.find(p => p.id === formData.parceiroId);
  const clienteSelecionado = clientes.find(c => c.id === formData.clienteId);
  const produtoSelecionado = produtos.find(p => p.id === formData.produtoId);

  const getNumeroInicial = () => {
    if (modoEmissao === "lote" && formData.numeroInicialCustom) return parseInt(formData.numeroInicialCustom) || 1;
    if (modoEmissao === "manual" && formData.numeroManual) return parseInt(formData.numeroManual) || 1;
    return proximoNumeroVale;
  };

  const getQuantidadeEfetiva = () => {
    if (modoEmissao === "lote" && formData.numeroInicialCustom && formData.numeroFinalCustom) {
      return (parseInt(formData.numeroFinalCustom) || 0) - (parseInt(formData.numeroInicialCustom) || 0) + 1;
    }
    if (modoEmissao === "manual") return 1;
    return parseInt(formData.quantidade) || 0;
  };

  const valorTotal = getQuantidadeEfetiva() * (parseFloat(formData.valorUnitario) || 0);

  const gerarPreview = () => {
    const qtd = getQuantidadeEfetiva();
    const valor = parseFloat(formData.valorUnitario) || 0;
    const numInicial = getNumeroInicial();
    if (qtd <= 0 || valor <= 0) { toast.error("Informe quantidade e valor válidos"); return; }
    const preview = [];
    for (let i = 0; i < qtd; i++) {
      const num = numInicial + i;
      preview.push({ numero: num, codigo: `VG-${new Date().getFullYear()}-${num.toString().padStart(5, "0")}`, valor });
    }
    setPreviewVales(preview);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtdEfetiva = getQuantidadeEfetiva();
    const numInicial = getNumeroInicial();
    if (!formData.parceiroId || qtdEfetiva <= 0) { toast.error("Preencha todos os campos obrigatórios"); return; }

    try {
      const lote = await emitirLote({
        parceiroId: formData.parceiroId,
        quantidade: qtdEfetiva,
        valorUnitario: parseFloat(formData.valorUnitario),
        numeroInicial: modoEmissao !== "automatico" ? numInicial : undefined,
        dataVencimento: formData.dataVencimento ? new Date(formData.dataVencimento) : undefined,
        observacao: formData.observacao || undefined,
        descricao: formData.descricao || undefined,
        clienteId: formData.clienteId || undefined,
        clienteNome: clienteSelecionado?.nome || undefined,
        produtoId: formData.produtoId || undefined,
        produtoNome: produtoSelecionado?.nome || undefined,
        gerarContaReceber: formData.gerarContaReceber,
      });

      if (formData.gerarContaReceber && formData.clienteId) {
        try {
          const vencimento = formData.dataVencimentoConta || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
          await supabase.from("contas_receber").insert({
            cliente: clienteSelecionado?.nome || parceiro?.nome || "Vale Gás",
            descricao: `${formData.descricao || "Vale Gás"} - Lote ${lote.numero_inicial}-${lote.numero_final}`,
            valor: lote.valor_total,
            vencimento,
            status: "pendente",
            forma_pagamento: "vale_gas",
            observacoes: `Lote de ${lote.quantidade} vales. Parceiro: ${parceiro?.nome}`,
          });
          toast.success("Conta a receber gerada!");
        } catch { toast.error("Erro ao gerar conta a receber"); }
      }

      // Gerar cupons para impressão
      const valesDoLote: Array<{ numero: number; codigo: string; valor: number }> = [];
      for (let i = lote.numero_inicial; i <= lote.numero_final; i++) {
        valesDoLote.push({
          numero: i,
          codigo: `VG-${new Date().getFullYear()}-${i.toString().padStart(5, "0")}`,
          valor: Number(lote.valor_unitario),
        });
      }
      const cupons = gerarCuponsDoLote(
        valesDoLote,
        parceiro,
        produtoSelecionado?.nome || null,
        clienteSelecionado?.nome || null,
        formData.descricao || "VALE GÁS",
      );
      setCuponsGerados(cupons);

      toast.success(`Lote emitido! Vales de ${lote.numero_inicial} a ${lote.numero_final}`);
      setDialogOpen(false);
      setPreviewVales([]);
      setCupomDialogOpen(true);
      setFormData({
        parceiroId: "", quantidade: "", valorUnitario: "105", dataVencimento: "",
        observacao: "", descricao: "VALE GÁS", clienteId: "", produtoId: "",
        gerarContaReceber: false, dataVencimentoConta: "",
        numeroInicialCustom: "", numeroFinalCustom: "", numeroManual: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao emitir");
    }
  };

  const handlePagamento = async (loteId: string) => {
    const valor = parseFloat(valorPagamento);
    if (isNaN(valor) || valor <= 0) { toast.error("Informe um valor válido"); return; }
    await registrarPagamentoLote(loteId, valor);
    toast.success("Pagamento registrado!");
    setPagamentoDialog(null);
    setValorPagamento("");
  };

  const handleCancelarLote = async (loteId: string) => {
    await cancelarLote(loteId);
    toast.success("Lote cancelado!");
  };

  // Reimprimir cupons de um lote existente
  const handleReimprimirLote = (lote: any) => {
    const loteParceiro = parceiros.find(p => p.id === lote.parceiro_id);
    if (!loteParceiro) { toast.error("Parceiro não encontrado"); return; }
    const valesDoLote: Array<{ numero: number; codigo: string; valor: number }> = [];
    for (let i = lote.numero_inicial; i <= lote.numero_final; i++) {
      valesDoLote.push({
        numero: i,
        codigo: `VG-${new Date().getFullYear()}-${i.toString().padStart(5, "0")}`,
        valor: Number(lote.valor_unitario),
      });
    }
    const cupons = gerarCuponsDoLote(valesDoLote, loteParceiro, lote.produto_nome, lote.cliente_nome, lote.descricao || "VALE GÁS");
    setCuponsGerados(cupons);
    setCupomDialogOpen(true);
  };

  const lotesAtivos = lotes.filter(l => !l.cancelado);

  const totais = useMemo(() => ({
    lotes: lotesAtivos.length,
    valesEmitidos: lotesAtivos.reduce((s, l) => s + l.quantidade, 0),
    valorTotal: lotesAtivos.reduce((s, l) => s + Number(l.valor_total), 0),
    valorRecebido: lotesAtivos.reduce((s, l) => s + Number(l.valor_pago), 0),
  }), [lotesAtivos]);

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-end">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setPreviewVales([]); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Emitir Vale Gás</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Lançamento de Vale Gás</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Modo de emissão */}
                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="text-sm font-semibold">Modo de Emissão</Label>
                  <RadioGroup value={modoEmissao} onValueChange={v => { setModoEmissao(v as ModoEmissao); setPreviewVales([]); }} className="grid grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="automatico" id="modo-auto" />
                      <Label htmlFor="modo-auto" className="cursor-pointer">
                        <p className="font-medium text-sm">Automático</p>
                        <p className="text-xs text-muted-foreground">Numeração sequencial</p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="lote" id="modo-lote" />
                      <Label htmlFor="modo-lote" className="cursor-pointer">
                        <p className="font-medium text-sm">Lote (Intervalo)</p>
                        <p className="text-xs text-muted-foreground">Ex: 200 a 250</p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="manual" id="modo-manual" />
                      <Label htmlFor="modo-manual" className="cursor-pointer">
                        <p className="font-medium text-sm">Manual</p>
                        <p className="text-xs text-muted-foreground">Um vale por vez</p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={formData.descricao} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: VALE GÁS" />
                </div>
                <div className="space-y-2">
                  <Label>Parceiro *</Label>
                  <Select value={formData.parceiroId} onValueChange={v => setFormData(p => ({ ...p, parceiroId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                    <SelectContent>
                      {parceiros.filter(p => p.ativo).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome} ({p.tipo === "prepago" ? "Pré-pago" : "Consignado"})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {parceiro && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p className="font-medium">{parceiro.nome}</p>
                    <p className="text-muted-foreground">Tipo: {parceiro.tipo === "prepago" ? "Pré-pago" : "Consignado"} | CNPJ: {parceiro.cnpj || "N/A"}</p>
                    {parceiro.telefone && <p className="text-muted-foreground">Tel: {parceiro.telefone}</p>}
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Produto *</Label>
                  <Select value={formData.produtoId} onValueChange={v => setFormData(p => ({ ...p, produtoId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qualquer">Qualquer produto</SelectItem>
                      {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} - R$ {Number(p.preco).toFixed(2)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><User className="h-4 w-4" /> Cliente (opcional)</Label>
                  <Select value={formData.clienteId} onValueChange={v => setFormData(p => ({ ...p, clienteId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Vincular a um cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Numeração por modo */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-semibold text-sm">
                      {modoEmissao === "automatico" && "Numeração Automática"}
                      {modoEmissao === "lote" && "Intervalo de Numeração"}
                      {modoEmissao === "manual" && "Número do Vale"}
                    </Label>
                  </div>

                  {modoEmissao === "automatico" && (
                    <div className="space-y-3">
                      <div className="p-2 bg-primary/5 rounded text-sm">
                        Próximo número: <span className="font-mono font-bold">{proximoNumeroVale}</span>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade de Vales *</Label>
                        <Input type="number" min="1" value={formData.quantidade} onChange={e => { setFormData(p => ({ ...p, quantidade: e.target.value })); setPreviewVales([]); }} placeholder="Ex: 50" required />
                      </div>
                    </div>
                  )}

                  {modoEmissao === "lote" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Número Inicial *</Label>
                        <Input type="number" min="1" value={formData.numeroInicialCustom} onChange={e => { setFormData(p => ({ ...p, numeroInicialCustom: e.target.value })); setPreviewVales([]); }} placeholder="Ex: 200" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Número Final *</Label>
                        <Input type="number" min="1" value={formData.numeroFinalCustom} onChange={e => { setFormData(p => ({ ...p, numeroFinalCustom: e.target.value })); setPreviewVales([]); }} placeholder="Ex: 250" required />
                      </div>
                      {getQuantidadeEfetiva() > 0 && <div className="col-span-2 text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{getQuantidadeEfetiva()}</span> vales</div>}
                    </div>
                  )}

                  {modoEmissao === "manual" && (
                    <div className="space-y-2">
                      <Label>Número do Vale *</Label>
                      <Input type="number" min="1" value={formData.numeroManual} onChange={e => { setFormData(p => ({ ...p, numeroManual: e.target.value })); setPreviewVales([]); }} placeholder="Ex: 501" required />
                      <p className="text-xs text-muted-foreground">Será gerado 1 vale com este número</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Valor de cada Vale (R$) *</Label>
                  <Input type="number" step="0.01" value={formData.valorUnitario} onChange={e => { setFormData(p => ({ ...p, valorUnitario: e.target.value })); setPreviewVales([]); }} required />
                </div>

                <div className="p-3 bg-primary/10 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Numeração:</span>
                    <span className="font-mono">{getNumeroInicial()} a {getNumeroInicial() + getQuantidadeEfetiva() - 1}</span>
                  </div>
                  <div className="flex justify-between text-sm"><span>Quantidade:</span><span className="font-bold">{getQuantidadeEfetiva()}</span></div>
                  <div className="flex justify-between font-medium text-lg"><span>Valor Total:</span><span className="text-green-600">R$ {valorTotal.toFixed(2)}</span></div>
                  <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={gerarPreview}><Eye className="h-4 w-4" /> Visualizar Vales</Button>
                </div>

                {previewVales.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-muted">
                      <span className="text-sm font-medium">Preview: {previewVales.length} vales</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewVales([])}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Código</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {previewVales.map(v => (
                            <TableRow key={v.numero}><TableCell className="font-mono font-bold">{v.numero}</TableCell><TableCell className="font-mono text-xs">{v.codigo}</TableCell><TableCell className="text-right">R$ {v.valor.toFixed(2)}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {parceiro?.tipo === "prepago" && (
                  <div className="space-y-2">
                    <Label>Data de Vencimento do Pagamento</Label>
                    <Input type="date" value={formData.dataVencimento} onChange={e => setFormData(p => ({ ...p, dataVencimento: e.target.value }))} />
                  </div>
                )}

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="gerarConta" checked={formData.gerarContaReceber} onCheckedChange={c => setFormData(p => ({ ...p, gerarContaReceber: c === true }))} />
                    <Label htmlFor="gerarConta" className="flex items-center gap-2 cursor-pointer"><Receipt className="h-4 w-4" /> Gerar contas a receber</Label>
                  </div>
                  {formData.gerarContaReceber && (
                    <div className="space-y-2 pl-6">
                      <Label>Vencimento da Conta</Label>
                      <Input type="date" value={formData.dataVencimentoConta} onChange={e => setFormData(p => ({ ...p, dataVencimentoConta: e.target.value }))} />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea value={formData.observacao} onChange={e => setFormData(p => ({ ...p, observacao: e.target.value }))} placeholder="Observações..." rows={2} />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Gravar e Gerar Cupom</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dialog de Cupom para impressão */}
        <Dialog open={cupomDialogOpen} onOpenChange={setCupomDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Cupons Gerados</DialogTitle></DialogHeader>
            {cuponsGerados.length > 0 && (
              <CupomPrint cupons={cuponsGerados} onClose={() => setCupomDialogOpen(false)} />
            )}
          </DialogContent>
        </Dialog>

        {/* Cards resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><FileText className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{totais.lotes}</p><p className="text-sm text-muted-foreground">Lotes Ativos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-500/10"><CreditCard className="h-6 w-6 text-blue-500" /></div><div><p className="text-2xl font-bold">{totais.valesEmitidos}</p><p className="text-sm text-muted-foreground">Vales Emitidos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-green-500/10"><Banknote className="h-6 w-6 text-green-500" /></div><div><p className="text-2xl font-bold">R$ {totais.valorRecebido.toFixed(0)}</p><p className="text-sm text-muted-foreground">Recebido</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-amber-500/10"><Package className="h-6 w-6 text-amber-500" /></div><div><p className="text-2xl font-bold">R$ {(totais.valorTotal - totais.valorRecebido).toFixed(0)}</p><p className="text-sm text-muted-foreground">A Receber</p></div></div></CardContent></Card>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Hash className="h-5 w-5 text-muted-foreground" />
              <div><p className="text-sm text-muted-foreground">Próximo número de vale</p><p className="text-xl font-mono font-bold">{proximoNumeroVale}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de lotes */}
        <Card>
          <CardHeader><CardTitle>Lotes Emitidos</CardTitle><CardDescription>Histórico de emissão</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Descrição / Parceiro</TableHead><TableHead>Cliente / Produto</TableHead>
                  <TableHead className="text-center">Numeração</TableHead><TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead><TableHead className="text-center">Status</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum lote emitido</TableCell></TableRow>
                ) : lotes.map(lote => {
                  const loteParceiro = parceiros.find(p => p.id === lote.parceiro_id);
                  return (
                    <TableRow key={lote.id} className={lote.cancelado ? "opacity-50" : ""}>
                      <TableCell>
                        <div>
                          <p>{format(new Date(lote.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                          {lote.data_vencimento_pagamento && <p className="text-xs text-muted-foreground">Venc: {format(new Date(lote.data_vencimento_pagamento), "dd/MM/yyyy", { locale: ptBR })}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {lote.descricao && <p className="font-medium text-xs text-muted-foreground">{lote.descricao}</p>}
                          <p className="font-medium">{loteParceiro?.nome}</p>
                          <Badge variant={loteParceiro?.tipo === "prepago" ? "default" : "secondary"} className="text-xs">
                            {loteParceiro?.tipo === "prepago" ? "Pré-pago" : "Consignado"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {lote.cliente_nome && <p className="text-sm flex items-center gap-1"><User className="h-3 w-3" /> {lote.cliente_nome}</p>}
                          {lote.produto_nome && <p className="text-sm flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> {lote.produto_nome}</p>}
                          {!lote.cliente_nome && !lote.produto_nome && <span className="text-muted-foreground text-sm">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{lote.numero_inicial} - {lote.numero_final}</TableCell>
                      <TableCell className="text-center">{lote.quantidade}</TableCell>
                      <TableCell className="text-right">R$ {Number(lote.valor_total).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        {lote.cancelado ? <Badge variant="destructive">Cancelado</Badge> : (
                          <Badge variant={lote.status_pagamento === "pago" ? "default" : lote.status_pagamento === "parcial" ? "secondary" : "destructive"}>
                            {lote.status_pagamento === "pago" ? "Pago" : lote.status_pagamento === "parcial" ? "Parcial" : "Pendente"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!lote.cancelado && (
                            <Button size="sm" variant="ghost" title="Reimprimir cupons" onClick={() => handleReimprimirLote(lote)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          )}
                          {!lote.cancelado && lote.status_pagamento !== "pago" && loteParceiro?.tipo === "prepago" && (
                            <Dialog open={pagamentoDialog === lote.id} onOpenChange={open => setPagamentoDialog(open ? lote.id : null)}>
                              <DialogTrigger asChild><Button size="sm" variant="outline">Receber</Button></DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="font-medium">{loteParceiro?.nome}</p>
                                    <p className="text-sm text-muted-foreground">Pendente: R$ {(Number(lote.valor_total) - Number(lote.valor_pago)).toFixed(2)}</p>
                                  </div>
                                  <div className="space-y-2"><Label>Valor do Pagamento</Label><Input type="number" step="0.01" value={valorPagamento} onChange={e => setValorPagamento(e.target.value)} placeholder="0,00" /></div>
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="outline" onClick={() => setPagamentoDialog(null)}>Cancelar</Button>
                                    <Button onClick={() => handlePagamento(lote.id)}>Confirmar</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          {!lote.cancelado && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><XCircle className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar Lote?</AlertDialogTitle>
                                  <AlertDialogDescription>Isso cancelará os vales disponíveis do lote {lote.numero_inicial}-{lote.numero_final}.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleCancelarLote(lote.id)}>Cancelar Lote</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Emissão de Vale Gás" subtitle="Emita e gerencie lotes de vales" />
      {content}
    </MainLayout>
  );
}
