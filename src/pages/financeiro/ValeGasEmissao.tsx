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
import { codigoValeGas } from "@/lib/vales/codigoVale";
import { useQuery } from "@tanstack/react-query";
import { 
  Plus, Package, Hash, Banknote, FileText, CreditCard, Eye,
  Trash2, XCircle, ShoppingBag, User, Receipt, Printer,
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { esc } from "@/lib/escapeHtml";
import { obterApresentacaoVale } from "@/lib/vales/apresentacaoVale";

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
  numeroEmpenho: string | null;
  clienteNome: string | null;
  descricao: string;
  dataEmissao: string;
}

interface EmpresaCupom {
  nome: string;
  telefone: string | null;
  endereco: string | null;
}

function gerarCuponsDoLote(
  previewVales: Array<{ numero: number; codigo: string; valor: number }>,
  parceiro: { nome: string; cnpj: string | null; telefone: string | null; tipo: string } | undefined,
  produtoNome: string | null,
  clienteNome: string | null,
  descricao: string,
  numeroEmpenho: string | null,
): CupomVale[] {
  if (!parceiro) return [];
  return previewVales.map(v => ({
    ...v,
    parceiroNome: parceiro.nome,
    parceiroCnpj: parceiro.cnpj,
    parceiroTelefone: parceiro.telefone,
    parceiroTipo: parceiro.tipo === "prepago" ? "Pré-pago" : parceiro.tipo === "empenho" ? "Empenho" : "Consignado",
    produtoNome,
    clienteNome,
    descricao,
    numeroEmpenho,
    dataEmissao: format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }),
  }));
}

function CupomPrint({ cupons, empresa, onClose }: { cupons: CupomVale[]; empresa: EmpresaCupom; onClose: () => void }) {
  const qrContainerRef = useRef<HTMLDivElement>(null);
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

  const previewCupom = useMemo(() => {
    const firstSel = cupons.find(c => selecionados.has(c.numero));
    return firstSel ?? cupons[0];
  }, [cupons, selecionados]);
  const previewApresentacao = useMemo(
    () => obterApresentacaoVale(previewCupom?.produtoNome, previewCupom?.descricao),
    [previewCupom],
  );

  const openPrintView = (autoPrint: boolean) => {
    const cuponsParaImprimir = cupons.filter(c => selecionados.has(c.numero));
    if (cuponsParaImprimir.length === 0) { toast.error("Selecione ao menos um vale"); return; }

    const container = qrContainerRef.current;
    if (!container) { toast.error("Erro ao gerar QR Codes"); return; }
    const qrMap = new Map<number, string>();
    container.querySelectorAll<SVGSVGElement>("svg[data-vale-numero]").forEach(svg => {
      const num = Number(svg.getAttribute("data-vale-numero"));
      qrMap.set(num, svg.outerHTML);
    });
    const cuponsHtml = cuponsParaImprimir.map(c => {
      const apresentacao = obterApresentacaoVale(c.produtoNome, c.descricao);
      return `
        <div class="cupom">
          <div class="empresa">${esc(empresa.nome)}</div>
          <div class="empresa-contato">
            ${empresa.telefone ? `<div>Telefone: ${esc(empresa.telefone)}</div>` : ""}
            ${empresa.endereco ? `<div>${esc(empresa.endereco)}</div>` : ""}
          </div>
          <div class="logo">${esc(apresentacao.titulo)}</div>
          ${apresentacao.subtitulo ? `<div class="desc">${esc(apresentacao.subtitulo)}</div>` : ""}
          <div class="qr">${qrMap.get(c.numero) ?? ""}</div>
          <div class="numero">Nº ${esc(c.numero)}</div>
          <div class="codigo">${esc(c.codigo)}</div>
          <div class="info">
            <div class="row"><span class="label">Parceiro:</span><span>${esc(c.parceiroNome)}</span></div>
            ${c.parceiroCnpj ? `<div class="row"><span class="label">CNPJ:</span><span>${esc(c.parceiroCnpj)}</span></div>` : ""}
            ${c.parceiroTelefone ? `<div class="row"><span class="label">Tel:</span><span>${esc(c.parceiroTelefone)}</span></div>` : ""}
            <div class="row"><span class="label">Tipo:</span><span>${esc(c.parceiroTipo)}</span></div>
            ${c.produtoNome ? `<div class="row"><span class="label">Produto:</span><span>${esc(c.produtoNome)}</span></div>` : ""}
            ${c.numeroEmpenho ? `<div class="row"><span class="label">Empenho:</span><span>${esc(c.numeroEmpenho)}</span></div>` : ""}
            ${c.clienteNome ? `<div class="row"><span class="label">Cliente:</span><span>${esc(c.clienteNome)}</span></div>` : ""}
          </div>
          <div class="footer">
            Emitido em ${esc(c.dataEmissao)}<br/>
            Apresente este QR Code ao entregador para validar este vale.
          </div>
        </div>`;
    }).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups."); return; }

    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Cupons Vale Gás</title>
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body { padding: 0 !important; }
          .print-actions { display: none !important; }
          .print-sheet { gap: 3mm !important; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; padding: 8mm; background: #f8fafc; color: #172033; }
        .print-actions { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; padding: 0 0 5mm; }
        .print-actions button { border: 0; border-radius: 8px; padding: 10px 18px; background: #0f766e; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .print-sheet {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 3mm; align-items: stretch;
        }
        .cupom {
          border: 1.2px dashed #64748b; border-radius: 3mm; padding: 2.5mm;
          min-height: 86mm; max-height: 86mm; text-align: center;
          break-inside: avoid; page-break-inside: avoid; background: #fff;
          display: flex; flex-direction: column; justify-content: center;
        }
        .empresa { font-size: 12px; font-weight: 800; color: #0f766e; line-height: 1.15; text-transform: uppercase; }
        .empresa-contato { min-height: 8mm; margin-top: .8mm; font-size: 7px; color: #475569; line-height: 1.25; }
        .logo { font-size: 13px; font-weight: 800; color: #172033; margin-top: 1mm; }
        .desc { font-size: 7px; color: #64748b; margin-bottom: .5mm; text-transform: uppercase; letter-spacing: .6px; }
        .qr { margin: 1mm 0; display: flex; justify-content: center; }
        .qr svg { width: 21mm; height: 21mm; }
        .numero { font-size: 15px; font-weight: 800; margin-top: .5mm; letter-spacing: .4px; }
        .codigo { font-family: 'Courier New', monospace; font-size: 7px; color: #64748b; margin-bottom: .7mm; }
        .info { font-size: 7px; color: #334155; line-height: 1.25; text-align: left; padding: 1mm .5mm; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; margin: .7mm 0; }
        .info .row { display: flex; justify-content: space-between; gap: 8px; }
        .info .label { font-weight: 700; color: #172033; }
        .footer { font-size: 6.5px; color: #64748b; margin-top: .7mm; line-height: 1.25; }
        .cupom:nth-child(9n) { break-after: page; page-break-after: always; }
        .cupom:last-child { break-after: auto; page-break-after: auto; }
      </style></head><body>
      ${autoPrint ? "" : '<div class="print-actions"><button type="button" onclick="window.print()">Imprimir vales</button></div>'}
      <main class="print-sheet">
      ${cuponsHtml}</main>
      ${autoPrint ? '<script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 300); }</script>' : ""}
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* QR Codes ocultos só para extrair o SVG na impressão */}
      <div ref={qrContainerRef} className="hidden" aria-hidden="true">
        {cupons.map(c => (
          <QRCodeSVG
            key={c.numero}
            value={c.codigo}
            size={180}
            level="H"
            includeMargin
            data-vale-numero={c.numero}
          />
        ))}
      </div>

      {previewCupom && (
        <div className="flex justify-center">
          <div className="bg-white border-2 border-dashed border-muted-foreground/40 rounded-xl p-5 w-[300px] text-center">
            <div className="text-sm font-extrabold uppercase text-primary">{empresa.nome}</div>
            <div className="mb-2 text-[9px] leading-tight text-muted-foreground">
              {empresa.telefone && <div>Telefone: {empresa.telefone}</div>}
              {empresa.endereco && <div>{empresa.endereco}</div>}
            </div>
            <div className="text-lg font-extrabold">
              {previewApresentacao.titulo}
            </div>
            {previewApresentacao.subtitulo && (
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {previewApresentacao.subtitulo}
              </div>
            )}
            <div className="flex justify-center my-2">
              <QRCodeSVG value={previewCupom.codigo} size={160} level="H" includeMargin />
            </div>
            <div className="text-xl font-extrabold">Nº {previewCupom.numero}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{previewCupom.codigo}</div>
            <div className="text-[11px] text-left border-t border-dashed pt-2 space-y-0.5">
              <div><strong>Parceiro:</strong> {previewCupom.parceiroNome}</div>
              {previewCupom.produtoNome && <div><strong>Produto:</strong> {previewCupom.produtoNome}</div>}
              {previewCupom.numeroEmpenho && <div><strong>Empenho:</strong> {previewCupom.numeroEmpenho}</div>}
              {previewCupom.clienteNome && <div><strong>Cliente:</strong> {previewCupom.clienteNome}</div>}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">
              Apresente este QR Code ao entregador.
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
        A impressão organiza automaticamente até <strong className="text-foreground">9 vales por folha A4</strong>, com os dados da empresa e sem exibir valores ao cliente.
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label className="text-sm font-semibold sm:text-base">Selecione os vales para imprimir</Label>
        <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
          {selecionados.size === cupons.length ? "Desmarcar todos" : "Selecionar todos"}
        </Button>
      </div>
      <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
        {cupons.map(c => (
          <label key={c.numero} className="flex min-h-12 cursor-pointer items-center gap-3 p-3 hover:bg-muted/50">
            <Checkbox checked={selecionados.has(c.numero)} onCheckedChange={() => toggleOne(c.numero)} />
            <div className="min-w-0 flex-1">
              <span className="font-mono font-bold">Nº {c.numero}</span>
              <span className="ml-2 break-all text-xs text-muted-foreground sm:text-sm">{c.codigo}</span>
            </div>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>Fechar</Button>
        <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => openPrintView(false)}>
          <Eye className="h-4 w-4" /> Visualizar
        </Button>
        <Button type="button" className="col-span-2 min-h-11 gap-2 sm:col-span-1" onClick={() => openPrintView(true)}>
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

  const defaultVencConta = () => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    parceiroId: "", quantidade: "", valorUnitario: "105", dataVencimento: "",
    observacao: "", descricao: "VALE GÁS", clienteId: "", produtoId: "",
    dataVencimentoConta: defaultVencConta(),
    numeroInicialCustom: "", numeroFinalCustom: "",
    numeroManual: "", numeroEmpenho: "",
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

  const getNumerosDuplicadosExternos = () => {
    if (modoEmissao === "automatico") return [];
    const qtd = getQuantidadeEfetiva();
    const numInicial = getNumeroInicial();
    if (qtd <= 0 || numInicial <= 0) return [];
    const numerosInformados = new Set(Array.from({ length: qtd }, (_, i) => numInicial + i));
    return vales
      .filter(v => numerosInformados.has(v.numero))
      .map(v => v.numero)
      .sort((a, b) => a - b);
  };

  const validarNumeracaoExterna = () => {
    const duplicados = getNumerosDuplicadosExternos();
    if (duplicados.length === 0) return true;
    toast.error(`Numeração de Vale Gás já cadastrada: ${duplicados.join(", ")}`);
    return false;
  };

  const valorTotal = getQuantidadeEfetiva() * (parseFloat(formData.valorUnitario) || 0);

  const gerarPreview = () => {
    const qtd = getQuantidadeEfetiva();
    const valor = parseFloat(formData.valorUnitario) || 0;
    const numInicial = getNumeroInicial();
    if (qtd <= 0 || valor <= 0) { toast.error("Informe quantidade e valor válidos"); return; }
    if (!validarNumeracaoExterna()) return;
    const preview = [];
    for (let i = 0; i < qtd; i++) {
      const num = numInicial + i;
      preview.push({ numero: num, codigo: codigoValeGas(num), valor });
    }
    setPreviewVales(preview);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtdEfetiva = getQuantidadeEfetiva();
    const numInicial = getNumeroInicial();
    if (!formData.parceiroId || qtdEfetiva <= 0) { toast.error("Preencha todos os campos obrigatórios"); return; }
    if (parceiro?.tipo === "empenho" && !formData.numeroEmpenho.trim()) {
      toast.error("Informe o número do empenho");
      return;
    }
    if (!validarNumeracaoExterna()) return;

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
        numeroEmpenho: parceiro?.tipo === "empenho" ? formData.numeroEmpenho.trim() : undefined,
        gerarContaReceber: false, // título é criado abaixo, sempre
        unidadeId: unidadeAtual?.id || null,
      });

      // O título nasce sempre na aba Acerto para evitar duplicidade e manter uma
      // única baixa financeira. Pré-pago/empenho: lote integral; consignado: utilizados.
      if (parceiro) {
        toast.info(parceiro.tipo === "consignado"
          ? "Consignado: o acerto considerará somente os vales utilizados."
          : "O lote completo está disponível para acerto financeiro.");
      }

      // Gerar cupons para impressão
      const valesDoLote: Array<{ numero: number; codigo: string; valor: number }> = [];
      for (let i = lote.numero_inicial; i <= lote.numero_final; i++) {
        valesDoLote.push({
          numero: i,
          codigo: codigoValeGas(i),
          valor: Number(lote.valor_unitario),
        });
      }
      const cupons = gerarCuponsDoLote(
        valesDoLote,
        parceiro,
        produtoSelecionado?.nome || null,
        clienteSelecionado?.nome || null,
        formData.descricao || "VALE GÁS",
        parceiro?.tipo === "empenho" ? formData.numeroEmpenho.trim() : null,
      );
      setCuponsGerados(cupons);

      toast.success(`Lote emitido! Vales de ${lote.numero_inicial} a ${lote.numero_final}`);
      setDialogOpen(false);
      setPreviewVales([]);
      setCupomDialogOpen(true);
      setFormData({
        parceiroId: "", quantidade: "", valorUnitario: "105", dataVencimento: "",
        observacao: "", descricao: "VALE GÁS", clienteId: "", produtoId: "",
        dataVencimentoConta: defaultVencConta(),
        numeroInicialCustom: "", numeroFinalCustom: "", numeroManual: "", numeroEmpenho: "",
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
  const handleReimprimirLote = async (lote: any) => {
    const loteParceiro = parceiros.find(p => p.id === lote.parceiro_id);
    if (!loteParceiro) { toast.error("Parceiro não encontrado"); return; }
    const { data, error } = await (supabase as any).from("vale_gas")
      .select("numero, codigo, valor, numero_empenho").eq("lote_id", lote.id).order("numero");
    if (error || !data?.length) { toast.error("Não foi possível carregar os códigos originais deste lote."); return; }
    const valesDoLote = data.map((vale: any) => ({ numero: vale.numero, codigo: vale.codigo, valor: Number(vale.valor) }));
    const cupons = gerarCuponsDoLote(
      valesDoLote,
      loteParceiro,
      lote.produto_nome,
      lote.cliente_nome,
      lote.descricao || "VALE GÁS",
      lote.numero_empenho || data[0]?.numero_empenho || null,
    );
    setCuponsGerados(cupons);
    setCupomDialogOpen(true);
  };

  const lotesAtivos = lotes.filter(l => !l.cancelado);

  const getStatusFinanceiroLote = (lote: any) => {
    if (lote.cancelado) return { label: "Cancelado", variant: "destructive" as const };
    if (lote.status_pagamento === "pago") return { label: "Pago", variant: "default" as const };
    if (lote.status_pagamento === "parcial") return { label: "Acerto parcial", variant: "secondary" as const };
    const parceiroLote = parceiros.find(p => p.id === lote.parceiro_id);
    if (parceiroLote?.tipo === "consignado") {
      const utilizados = vales.filter(v => v.lote_id === lote.id && v.status === "utilizado").length;
      return utilizados > 0
        ? { label: "Pendente de acerto", variant: "destructive" as const }
        : { label: "Aguardando utilização", variant: "secondary" as const };
    }
    return { label: "Lote pendente de acerto", variant: "destructive" as const };
  };

  const totais = useMemo(() => ({
    lotes: lotesAtivos.length,
    valesEmitidos: lotesAtivos.reduce((s, l) => s + l.quantidade, 0),
    valorTotal: lotesAtivos.reduce((s, l) => s + Number(l.valor_total), 0),
    valorRecebido: lotesAtivos.reduce((s, l) => s + Number(l.valor_pago), 0),
  }), [lotesAtivos]);

  const empresaCupom = useMemo<EmpresaCupom>(() => {
    const localidade = [unidadeAtual?.bairro, unidadeAtual?.cidade, unidadeAtual?.estado]
      .filter(Boolean)
      .join(" - ");
    const endereco = [unidadeAtual?.endereco, localidade, unidadeAtual?.cep ? `CEP ${unidadeAtual.cep}` : null]
      .filter(Boolean)
      .join(", ");

    return {
      nome: unidadeAtual?.nome || "Empresa",
      telefone: unidadeAtual?.telefone || null,
      endereco: endereco || null,
    };
  }, [unidadeAtual]);

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-end">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setPreviewVales([]); }}>
            <DialogTrigger asChild>
              <Button className="min-h-11 w-full gap-2 sm:w-auto"><Plus className="h-4 w-4" /> Emitir Vale Gás</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-2xl p-4 sm:p-6">
              <DialogHeader><DialogTitle>Lançamento de Vale Gás</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Modo de emissão */}
                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="text-sm font-semibold">Modo de Emissão</Label>
                  <RadioGroup value={modoEmissao} onValueChange={v => { setModoEmissao(v as ModoEmissao); setPreviewVales([]); }} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
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
                        <p className="font-medium text-sm">Lote Externo</p>
                        <p className="text-xs text-muted-foreground">Vales já gerados</p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="manual" id="modo-manual" />
                      <Label htmlFor="modo-manual" className="cursor-pointer">
                        <p className="font-medium text-sm">Vale Externo</p>
                        <p className="text-xs text-muted-foreground">Um número já emitido</p>
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
                  <Select value={formData.parceiroId} onValueChange={v => setFormData(p => ({ ...p, parceiroId: v, numeroEmpenho: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                    <SelectContent>
                      {parceiros.filter(p => p.ativo).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome} ({p.tipo === "prepago" ? "Pré-pago" : p.tipo === "empenho" ? "Empenho" : "Consignado"})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {parceiro && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p className="font-medium">{parceiro.nome}</p>
                    <p className="text-muted-foreground">Tipo: {parceiro.tipo === "prepago" ? "Pré-pago" : parceiro.tipo === "empenho" ? "Empenho" : "Consignado"} | CNPJ: {parceiro.cnpj || "N/A"}</p>
                    {parceiro.telefone && <p className="text-muted-foreground">Tel: {parceiro.telefone}</p>}
                  </div>
                )}
                {parceiro?.tipo === "empenho" && (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <Label htmlFor="numero-empenho" className="font-semibold">Número do empenho *</Label>
                    <Input
                      id="numero-empenho"
                      value={formData.numeroEmpenho}
                      onChange={e => setFormData(p => ({ ...p, numeroEmpenho: e.target.value }))}
                      placeholder="Ex: 7082/2026"
                      autoComplete="off"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Este número será gravado e impresso em todos os vales deste lote.</p>
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
                      {modoEmissao === "lote" && "Registrar Intervalo Externo"}
                      {modoEmissao === "manual" && "Registrar Vale Externo"}
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
                  <div className="flex justify-between font-medium text-lg"><span>Valor Total:</span><span className="text-success">R$ {valorTotal.toFixed(2)}</span></div>
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

                {parceiro?.tipo === "prepago" ? (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Receipt className="h-4 w-4" /> Conta a Receber do Parceiro
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Será criada automaticamente uma conta a receber para o parceiro com o valor total do lote.
                      A venda paga com Vale Gás não gera cobrança — quem paga é o parceiro.
                    </p>
                    <div className="space-y-2">
                      <Label>Vencimento do título</Label>
                      <Input
                        type="date"
                        value={formData.dataVencimentoConta}
                        onChange={e => setFormData(p => ({ ...p, dataVencimentoConta: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : parceiro ? (
                  <div className="border rounded-lg p-4 space-y-2 bg-warning dark:bg-warning/20 border-warning dark:border-warning">
                    <Label className="flex items-center gap-2 font-semibold text-warning dark:text-warning">
                      <Receipt className="h-4 w-4" /> Parceiro Consignado
                    </Label>
                    <p className="text-xs text-warning dark:text-warning">
                      Este parceiro paga depois. <strong>Nenhuma conta a receber será criada agora</strong> — o título financeiro
                      é gerado na tela <strong>Acerto</strong>, quando você apurar os vales utilizados na quinzena ou fechamento de mês.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea value={formData.observacao} onChange={e => setFormData(p => ({ ...p, observacao: e.target.value }))} placeholder="Observações..." rows={2} />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-4 sm:flex sm:justify-end">
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="min-h-11 gap-2"><Plus className="h-4 w-4" /> Gravar e Gerar Cupom</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dialog de Cupom para impressão */}
        <Dialog open={cupomDialogOpen} onOpenChange={setCupomDialogOpen}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto rounded-2xl p-4 sm:p-6">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Cupons Gerados</DialogTitle></DialogHeader>
            {cuponsGerados.length > 0 && (
              <CupomPrint cupons={cuponsGerados} empresa={empresaCupom} onClose={() => setCupomDialogOpen(false)} />
            )}
          </DialogContent>
        </Dialog>

        {/* Cards resumo */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card className="border-0 shadow-sm ring-1 ring-border/60"><CardContent className="p-3 sm:p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5"><FileText className="h-5 w-5 text-primary" /></div><div className="min-w-0"><p className="text-xl font-bold sm:text-2xl">{totais.lotes}</p><p className="truncate text-xs text-muted-foreground sm:text-sm">Lotes ativos</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-sm ring-1 ring-border/60"><CardContent className="p-3 sm:p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-info/10 p-2.5"><CreditCard className="h-5 w-5 text-info" /></div><div className="min-w-0"><p className="text-xl font-bold sm:text-2xl">{totais.valesEmitidos}</p><p className="truncate text-xs text-muted-foreground sm:text-sm">Vales emitidos</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-sm ring-1 ring-border/60"><CardContent className="p-3 sm:p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-success/10 p-2.5"><Banknote className="h-5 w-5 text-success" /></div><div className="min-w-0"><p className="text-lg font-bold sm:text-2xl">R$ {totais.valorRecebido.toFixed(0)}</p><p className="truncate text-xs text-muted-foreground sm:text-sm">Recebido</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-sm ring-1 ring-border/60"><CardContent className="p-3 sm:p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-warning/10 p-2.5"><Package className="h-5 w-5 text-warning" /></div><div className="min-w-0"><p className="text-lg font-bold sm:text-2xl">R$ {(totais.valorTotal - totais.valorRecebido).toFixed(0)}</p><p className="truncate text-xs text-muted-foreground sm:text-sm">A receber</p></div></div></CardContent></Card>
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
        <Card className="border-0 shadow-sm ring-1 ring-border/60">
          <CardHeader className="p-4 sm:p-6"><CardTitle>Lotes emitidos</CardTitle><CardDescription>Histórico de emissão e situação financeira</CardDescription></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="hidden md:block">
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
                            {loteParceiro?.tipo === "prepago" ? "Pré-pago" : loteParceiro?.tipo === "empenho" ? "Empenho" : "Consignado"}
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
                        {(() => { const status = getStatusFinanceiroLote(lote); return <Badge variant={status.variant}>{status.label}</Badge>; })()}
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
            </div>
            <div className="space-y-3 md:hidden">
              {lotes.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Nenhum lote emitido</div>
              ) : lotes.map(lote => {
                const loteParceiro = parceiros.find(p => p.id === lote.parceiro_id);
                return (
                  <article key={lote.id} className={`rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/70 ${lote.cancelado ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{loteParceiro?.nome || "Parceiro"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Emitido em {format(new Date(lote.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                      </div>
                      {(() => { const status = getStatusFinanceiroLote(lote); return <Badge variant={status.variant}>{status.label}</Badge>; })()}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Numeração</p><p className="font-mono font-semibold">{lote.numero_inicial}–{lote.numero_final}</p></div>
                      <div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-semibold">{lote.quantidade} vales</p></div>
                      <div><p className="text-xs text-muted-foreground">Produto</p><p className="truncate font-medium">{lote.produto_nome || "Qualquer produto"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Valor interno</p><p className="font-semibold">R$ {Number(lote.valor_total).toFixed(2)}</p></div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {!lote.cancelado && <Button variant="outline" className="min-h-11 gap-2" onClick={() => handleReimprimirLote(lote)}><Printer className="h-4 w-4" /> Imprimir</Button>}
                      {!lote.cancelado && lote.status_pagamento !== "pago" && loteParceiro?.tipo === "prepago" && <Button className="min-h-11" onClick={() => setPagamentoDialog(lote.id)}>Receber</Button>}
                    </div>
                  </article>
                );
              })}
            </div>
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
