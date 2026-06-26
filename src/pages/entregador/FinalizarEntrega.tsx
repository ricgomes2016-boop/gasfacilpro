import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Package, CreditCard, Plus, QrCode, CheckCircle, Trash2, AlertCircle,
  Keyboard, Loader2, Pencil, Camera, ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getBrasiliaDateString } from "@/lib/utils";
import { QRCodeScanner } from "@/components/entregador/QRCodeScanner";
import { supabase } from "@/integrations/supabase/client";
import { validarValeGasNoBanco } from "@/hooks/useValeGasValidation";
import { Skeleton } from "@/components/ui/skeleton";
import { PixQRCode } from "@/components/pix/PixQRCode";
import { PixKeySelectorModal } from "@/components/pagamento/PixKeySelectorModal";
import { CardOperatorSelectorModal } from "@/components/pagamento/CardOperatorSelectorModal";
import { format, addDays } from "date-fns";
import { toast as sonnerToast } from "sonner";
import { CardPaymentModal } from "@/components/entregador/CardPaymentModal";
import { AssinaturaCanhotoCard, type AssinaturaPayload } from "@/components/entregador/AssinaturaCanhotoCard";

const formasPagamento = [
  "Dinheiro", "PIX", "Cartão Crédito", "Cartão Débito", "Vale Gás", "Cheque", "Fiado",
];

interface Pagamento {
  forma: string;
  valor: number;
  valeGasInfo?: { parceiro: string; codigo: string; valido: boolean; valeId?: string };
  cheque_numero?: string;
  cheque_banco?: string;
  cheque_foto_url?: string;
  data_vencimento_fiado?: string;
  comprovante_url?: string;
  codigo_voucher?: string;
  conta_bancaria_id?: string;
  operadora_id?: string;
}


interface PedidoItem {
  id: string;
  quantidade: number;
  preco_unitario: number;
  produtos: { nome: string } | null;
}

interface PedidoData {
  id: string;
  created_at: string;
  data_entrega: string | null;
  valor_total: number | null;
  endereco_entrega: string | null;
  observacoes: string | null;
  forma_pagamento: string | null;
  clientes: { nome: string; telefone: string | null; bairro: string | null } | null;
  pedido_itens: PedidoItem[];
}

export default function FinalizarEntrega() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pedido, setPedido] = useState<PedidoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [novoPagamentoForma, setNovoPagamentoForma] = useState("");
  const [novoPagamentoValor, setNovoPagamentoValor] = useState("");
  const [dialogPagamentoAberto, setDialogPagamentoAberto] = useState(false);
  const [dialogQRAberto, setDialogQRAberto] = useState(false);
  const [modoEntradaManual, setModoEntradaManual] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [valeGasLido, setValeGasLido] = useState<{
    parceiro: string; codigo: string; valor: number; valorVenda: number; valido: boolean; valeId?: string;
  } | null>(null);
  // Editable items state
  const [editableItens, setEditableItens] = useState<PedidoItem[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [chavePix, setChavePix] = useState<string | null>(null);
  const [nomeUnidade, setNomeUnidade] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [showPixQR, setShowPixQR] = useState(false);
  // Cheque fields
  const [chequeNumero, setChequeNumero] = useState("");
  const [chequeBanco, setChequeBanco] = useState("");
  const [chequeFotoUrl, setChequeFotoUrl] = useState<string | null>(null);
  const [chequeFotoPreviewUrl, setChequeFotoPreviewUrl] = useState<string | null>(null);
  const [isUploadingCheque, setIsUploadingCheque] = useState(false);
  // Fiado fields
  const [dataVencimentoFiado, setDataVencimentoFiado] = useState("");
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardModalTipo, setCardModalTipo] = useState<"credito" | "debito" | "pix_maquininha">("credito");
  const [selectedPaymentInfo, setSelectedPaymentInfo] = useState<string | null>(null);
  const [selectedPaymentExtras, setSelectedPaymentExtras] = useState<{ operadora_id?: string; conta_bancaria_id?: string }>({});
  const [cardPaymentOpen, setCardPaymentOpen] = useState(false);
  const [entregadorIdLocal, setEntregadorIdLocal] = useState<string | null>(null);
  const [dataEntrega, setDataEntrega] = useState(getBrasiliaDateString());
  const chequePhotoRef = useRef<HTMLInputElement>(null);
  const chequeCameraRef = useRef<HTMLInputElement>(null);
  const comprovantePhotoRef = useRef<HTMLInputElement>(null);
  const comprovanteCameraRef = useRef<HTMLInputElement>(null);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  const [comprovantePreviewUrl, setComprovantePreviewUrl] = useState<string | null>(null);
  const [isUploadingComprovante, setIsUploadingComprovante] = useState(false);
  const [codigoVoucherGasPovo, setCodigoVoucherGasPovo] = useState("");
  const [assinatura, setAssinatura] = useState<AssinaturaPayload | null>(null);

  // Fetch real pedido data
  useEffect(() => {
    const fetchPedido = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id, created_at, data_entrega, valor_total, endereco_entrega, observacoes, forma_pagamento, unidade_id,
          clientes:cliente_id (nome, telefone, bairro),
          pedido_itens (
            id, quantidade, preco_unitario,
            produtos:produto_id (nome)
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        toast({ title: "Erro ao carregar pedido", description: error.message, variant: "destructive" });
      } else if (data) {
        const pedidoData = data as unknown as PedidoData;
        setPedido(pedidoData);
        setDataEntrega(pedidoData.data_entrega || getBrasiliaDateString(new Date(pedidoData.created_at)));
        setEditableItens(pedidoData.pedido_itens.map(i => ({ ...i })));
        const total = Number(data.valor_total) || 0;
        if (total > 0) {
          setPagamentos([{ forma: "Dinheiro", valor: total }]);
        }
        // Fetch chave_pix from unidade
        if ((data as any).unidade_id) {
          setUnidadeId((data as any).unidade_id);
          const { data: unidadeData } = await supabase
            .from("unidades")
            .select("chave_pix, nome, empresa_id")
            .eq("id", (data as any).unidade_id)
            .maybeSingle();
          if (unidadeData) {
            setChavePix((unidadeData as any).chave_pix || null);
            setNomeUnidade(unidadeData.nome || null);
            setEmpresaId((unidadeData as any).empresa_id || null);
          }
        }
        // Fetch entregador_id for the current pedido
        const { data: pedidoEnt } = await supabase
          .from("pedidos")
          .select("entregador_id")
          .eq("id", id)
          .maybeSingle();
        if (pedidoEnt?.entregador_id) {
          setEntregadorIdLocal(pedidoEnt.entregador_id);
        }
      }
      setIsLoading(false);
    };
    fetchPedido();
  }, [id, toast]);

  const totalItens = editableItens.reduce(
    (acc, item) => acc + (item.quantidade || 0) * Number(item.preco_unitario || 0), 0
  );

  const totalPagamentos = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const diferenca = totalItens - totalPagamentos;

  const removerPagamento = (index: number) => {
    setPagamentos((prev) => prev.filter((_, i) => i !== index));
  };

  const adicionarPagamento = () => {
    if (novoPagamentoForma && Number(novoPagamentoValor) > 0) {
      // Validate cheque fields
      if (novoPagamentoForma === "Cheque" && (!chequeNumero || !chequeBanco)) {
        toast({ title: "Preencha número e banco do cheque", variant: "destructive" });
        return;
      }
      // Card comprovante is optional but recommended
      const pag: Pagamento = { forma: novoPagamentoForma, valor: Number(novoPagamentoValor) };
      if (novoPagamentoForma === "Cheque") {
        pag.cheque_numero = chequeNumero;
        pag.cheque_banco = chequeBanco;
        pag.cheque_foto_url = chequeFotoUrl || undefined;
      }
      if (novoPagamentoForma === "Fiado") {
        pag.data_vencimento_fiado = dataVencimentoFiado || format(addDays(new Date(), 30), "yyyy-MM-dd");
      }
      if (novoPagamentoForma === "Cartão Crédito" || novoPagamentoForma === "Cartão Débito") {
        pag.comprovante_url = comprovanteUrl || undefined;
      }
      if (selectedPaymentExtras.conta_bancaria_id) {
        pag.conta_bancaria_id = selectedPaymentExtras.conta_bancaria_id;
      }
      if (selectedPaymentExtras.operadora_id) {
        pag.operadora_id = selectedPaymentExtras.operadora_id;
      }
      setPagamentos((prev) => [...prev, pag]);

      setNovoPagamentoForma("");
      setNovoPagamentoValor("");
      setChequeNumero("");
      setChequeBanco("");
      setChequeFotoUrl(null);
      setChequeFotoPreviewUrl(null);
      setDataVencimentoFiado("");
      setComprovanteUrl(null);
      setComprovantePreviewUrl(null);
      setCodigoVoucherGasPovo("");
      setDialogPagamentoAberto(false);
    }
  };

  const handleComprovanteFoto = async (file: File) => {
    setIsUploadingComprovante(true);
    try {
      if (!empresaId || !id) throw new Error("Empresa ou pedido não identificado para o upload");
      const compressed = await compressImage(file);
      const blob = await (await fetch(compressed)).blob();
      const fileName = `${empresaId}/${id}/pagamentos/comprovantes/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from("comprovantes-entrega").upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("comprovantes-entrega").createSignedUrl(fileName, 60 * 60);
      setComprovanteUrl(`storage://comprovantes-entrega/${fileName}`);
      setComprovantePreviewUrl(signed?.signedUrl || compressed);
      sonnerToast.success("Foto do comprovante enviada!");
    } catch (err: any) {
      sonnerToast.error(err?.message || "Erro ao enviar foto");
    } finally {
      setIsUploadingComprovante(false);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxW = 1200;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleChequeFoto = async (file: File) => {
    setIsUploadingCheque(true);
    try {
      if (!empresaId || !id) throw new Error("Empresa ou pedido não identificado para o upload");
      const compressed = await compressImage(file);
      const blob = await (await fetch(compressed)).blob();
      const fileName = `${empresaId}/${id}/pagamentos/cheques/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from("comprovantes-entrega").upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const { data: urlData } = await supabase.storage.from("comprovantes-entrega").createSignedUrl(fileName, 60 * 60);
      setChequeFotoUrl(`storage://comprovantes-entrega/${fileName}`);
      setChequeFotoPreviewUrl(urlData?.signedUrl || compressed);
      sonnerToast.success("Foto enviada! Extraindo dados...");

      // OCR auto-fill
      try {
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke("parse-cheque-photo", {
          body: { image_url: urlData?.signedUrl },
        });
        if (!ocrError && ocrData?.success && ocrData.data) {
          const d = ocrData.data;
          if (d.numero_cheque) setChequeNumero(d.numero_cheque);
          if (d.banco_emitente) setChequeBanco(d.banco_emitente);
          sonnerToast.success("Dados do cheque preenchidos automaticamente!");
        } else {
          sonnerToast.info("Não foi possível extrair dados. Preencha manualmente.");
        }
      } catch {
        sonnerToast.info("OCR indisponível. Preencha manualmente.");
      }
    } catch (err: any) {
      sonnerToast.error(err?.message || "Erro ao enviar foto");
    } finally {
      setIsUploadingCheque(false);
    }
  };

  const updateItem = (index: number, field: "quantidade" | "preco_unitario", value: number) => {
    setEditableItens(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const validarValeGas = async (codigo: string) => {
    setValidandoCodigo(true);
    try {
      const result = await validarValeGasNoBanco(codigo);
      if (result.valido) {
        setValeGasLido({ parceiro: result.parceiro, codigo: result.codigo, valor: result.valor, valorVenda: result.valorVenda, valido: true, valeId: result.valeId });
        toast({ title: "Vale Gás validado!", description: `Parceiro: ${result.parceiro} - Valor: R$ ${result.valor.toFixed(2)}` });
      } else {
        setValeGasLido({ parceiro: "", codigo, valor: 0, valorVenda: 0, valido: false });
        toast({ title: "Vale Gás inválido", description: result.erro || "Código não encontrado.", variant: "destructive" });
      }
    } catch {
      setValeGasLido({ parceiro: "", codigo, valor: 0, valorVenda: 0, valido: false });
      toast({ title: "Erro na validação", description: "Não foi possível validar o vale.", variant: "destructive" });
    } finally {
      setValidandoCodigo(false);
    }
  };

  const handleQRCodeScan = (decodedText: string) => validarValeGas(decodedText);

  const validarCodigoManual = () => {
    if (codigoManual.trim()) validarValeGas(codigoManual.trim());
  };

  const confirmarValeGas = () => {
    if (valeGasLido) {
      setPagamentos((prev) => [
        ...prev,
        { forma: "Vale Gás", valor: valeGasLido.valor, valeGasInfo: { parceiro: valeGasLido.parceiro, codigo: valeGasLido.codigo, valido: valeGasLido.valido, valeId: valeGasLido.valeId } },
      ]);
      setValeGasLido(null);
      setDialogQRAberto(false);
    }
  };

  const finalizarEntrega = async () => {
    if (diferenca !== 0) {
      toast({ title: "Atenção", description: "O valor dos pagamentos deve ser igual ao total da entrega.", variant: "destructive" });
      return;
    }
    if (!id) return;
    setIsSaving(true);

    try {
      // Save edited items
      for (const item of editableItens) {
        const { error } = await supabase
          .from("pedido_itens")
          .update({ quantidade: item.quantidade, preco_unitario: item.preco_unitario })
          .eq("id", item.id);
        if (error) throw error;
      }

      const formaStr = pagamentos.map(p => p.forma).join(", ");
      
      // Se houver pagamento com Vale Gás, usar o nome do parceiro como canal de venda
      const valeGasPag = pagamentos.find(p => p.forma === "Vale Gás" && p.valeGasInfo?.parceiro);
      
      const chequePag = pagamentos.find(p => p.forma === "Cheque");
      const fiadoPag = pagamentos.find(p => p.forma === "Fiado");
      const cartaoPag = pagamentos.find(p => (p.forma === "Cartão Crédito" || p.forma === "Cartão Débito") && p.comprovante_url);
      const updateData: any = { status: "entregue", forma_pagamento: formaStr, valor_total: totalItens, data_entrega: dataEntrega };
      if (valeGasPag) {
        updateData.canal_venda = valeGasPag.valeGasInfo!.parceiro;
      }
      if (chequePag) {
        updateData.cheque_numero = chequePag.cheque_numero || null;
        updateData.cheque_banco = chequePag.cheque_banco || null;
        updateData.cheque_foto_url = chequePag.cheque_foto_url || null;
      }
      if (fiadoPag) {
        updateData.data_vencimento_fiado = fiadoPag.data_vencimento_fiado || null;
      }
      if (cartaoPag) {
        updateData.comprovante_cartao_url = cartaoPag.comprovante_url || null;
      }
      
      const { error } = await supabase
        .from("pedidos")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // Salvar comprovante de entrega (assinatura)
      if (assinatura) {
        try {
          let assinaturaUrl: string | null = null;
          if (assinatura.assinatura_data_url) {
            const blob = await (await fetch(assinatura.assinatura_data_url)).blob();
            if (!empresaId) throw new Error("Empresa não identificada para o upload");
            const path = `${empresaId}/${id}/${Date.now()}.png`;
            const { error: upErr } = await supabase.storage
              .from("comprovantes-entrega")
              .upload(path, blob, { contentType: "image/png", upsert: true });
            if (upErr) throw upErr;
            assinaturaUrl = `storage://comprovantes-entrega/${path}`;
          }

          await (supabase as any).from("comprovantes_entrega").insert({
            pedido_id: id,
            unidade_id: unidadeId,
            entregador_id: entregadorIdLocal,
            cliente_id: (pedido as any)?.cliente_id || null,
            assinatura_url: assinaturaUrl,
            nome_recebedor: assinatura.nome_recebedor,
            documento_recebedor: assinatura.documento_recebedor || null,
            observacao: assinatura.observacao || null,
            latitude: assinatura.latitude,
            longitude: assinatura.longitude,
            user_agent: navigator.userAgent,
            assinado_em: assinatura.assinado_em,
          });
        } catch (sigErr: any) {
          sonnerToast.warning("Pedido entregue, mas falhou ao salvar a assinatura: " + sigErr.message);
        }
      }

      // Vincular vales gás utilizados ao cliente e pedido
      const valeGasPagamentos = pagamentos.filter(p => p.forma === "Vale Gás" && p.valeGasInfo?.valeId);
      if (valeGasPagamentos.length > 0) {
        const clienteNomeAtual = pedido?.clientes?.nome || null;
        const clienteIdAtual = (pedido as any)?.cliente_id || null;

        // Buscar entregador_id do pedido
        const { data: pedidoData } = await supabase
          .from("pedidos")
          .select("entregador_id, cliente_id")
          .eq("id", id)
          .single();

        for (const pag of valeGasPagamentos) {
          await (supabase as any)
            .from("vale_gas")
            .update({
              status: "utilizado",
              data_utilizacao: new Date().toISOString(),
              cliente_id: pedidoData?.cliente_id || clienteIdAtual,
              cliente_nome: clienteNomeAtual,
              consumidor_nome: clienteNomeAtual,
              consumidor_endereco: pedido?.endereco_entrega || null,
              consumidor_telefone: pedido?.clientes?.telefone || null,
              entregador_id: pedidoData?.entregador_id || null,
              venda_id: id,
            })
            .eq("id", pag.valeGasInfo!.valeId);
        }
      }

      toast({ title: "Entrega finalizada!", description: "Os dados foram salvos com sucesso." });
      navigate("/entregador/entregas");
    } catch (err: any) {
      toast({ title: "Erro ao finalizar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <EntregadorLayout title="Finalizar Entrega">
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </EntregadorLayout>
    );
  }

  if (!pedido) {
    return (
      <EntregadorLayout title="Finalizar Entrega">
        <div className="p-4 text-center text-muted-foreground py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Pedido não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/entregador/entregas")}>Voltar</Button>
        </div>
      </EntregadorLayout>
    );
  }

  const clienteNome = pedido.clientes?.nome || "Cliente";

  return (
    <EntregadorLayout title="Finalizar Entrega">
      <div className="p-4 space-y-4">
        {/* Cabeçalho */}
        <Card className="border-none shadow-md gradient-primary text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Pedido #{id?.slice(-6).toUpperCase()}</p>
                <p className="font-bold text-lg">{clienteNome}</p>
                {pedido.endereco_entrega && <p className="text-sm text-white/80">{pedido.endereco_entrega}</p>}
              </div>
              <Package className="h-12 w-12 text-white/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="data-entrega">Data da entrega</Label>
            <Input
              id="data-entrega"
              type="date"
              value={dataEntrega}
              onChange={(e) => setDataEntrega(e.target.value)}
              className="h-11 text-base"
            />
          </CardContent>
        </Card>

        {/* Produtos (editáveis) */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editableItens.map((item, index) => (
              <div key={item.id} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm flex-1">{item.produtos?.nome || "Produto"}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditingItemIndex(editingItemIndex === index ? null : index)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {editingItemIndex === index ? (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Quantidade</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => updateItem(index, "quantidade", Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.preco_unitario}
                        onChange={(e) => updateItem(index, "preco_unitario", Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">R$ {Number(item.preco_unitario).toFixed(2)} un.</p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{item.quantidade}x</span>
                      <span className="font-bold text-sm">R$ {(item.quantidade * Number(item.preco_unitario)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-border">
              <span className="font-medium">Total dos produtos:</span>
              <span className="font-bold text-lg">R$ {totalItens.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pagamentos */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Pagamentos
              </CardTitle>
              <div className="flex gap-2">
                <Dialog open={dialogQRAberto} onOpenChange={setDialogQRAberto}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <QrCode className="h-4 w-4 mr-1" />Vale Gás
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Validar Vale Gás</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      {!valeGasLido ? (
                        <>
                          <div className="flex gap-2 p-1 bg-muted rounded-lg">
                            <Button variant={!modoEntradaManual ? "default" : "ghost"} size="sm" className={`flex-1 ${!modoEntradaManual ? "gradient-primary text-white" : ""}`} onClick={() => setModoEntradaManual(false)}>
                              <QrCode className="h-4 w-4 mr-2" />Câmera
                            </Button>
                            <Button variant={modoEntradaManual ? "default" : "ghost"} size="sm" className={`flex-1 ${modoEntradaManual ? "gradient-primary text-white" : ""}`} onClick={() => setModoEntradaManual(true)}>
                              <Keyboard className="h-4 w-4 mr-2" />Digitar
                            </Button>
                          </div>
                          {modoEntradaManual ? (
                            <div className="space-y-4">
                              <div>
                              <Label>Código ou Número do Vale Gás</Label>
                                <Input placeholder="Ex: 1 ou VG-2026-00001" value={codigoManual} onChange={(e) => setCodigoManual(e.target.value)} className="font-mono" />
                                <p className="text-xs text-muted-foreground mt-1">Digite apenas o número (ex: 1) ou o código completo</p>
                              </div>
                              <Button onClick={validarCodigoManual} disabled={!codigoManual.trim() || validandoCodigo} className="w-full gradient-primary text-white">
                                {validandoCodigo ? "Validando..." : "Validar Código"}
                              </Button>
                            </div>
                          ) : (
                            <QRCodeScanner onScan={handleQRCodeScan} onError={(err) => toast({ title: "Erro na câmera", description: err, variant: "destructive" })} />
                          )}
                        </>
                      ) : (
                        <div className="space-y-4">
                          {valeGasLido.valido ? (
                            <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                              <div className="flex items-center gap-2 mb-3">
                                <CheckCircle className="h-5 w-5 text-success" />
                                <span className="font-semibold text-success">Vale Gás Válido</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Parceiro:</span><span className="font-medium">{valeGasLido.parceiro}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Código:</span><span className="font-mono">{valeGasLido.codigo}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="font-bold text-lg">R$ {valeGasLido.valor.toFixed(2)}</span></div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <span className="font-semibold text-destructive">Vale Gás Inválido</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">Código: {valeGasLido.codigo}</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => { setValeGasLido(null); setCodigoManual(""); }} className="flex-1">Tentar outro</Button>
                            {valeGasLido.valido && <Button onClick={confirmarValeGas} className="flex-1 gradient-primary text-white">Confirmar</Button>}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={dialogPagamentoAberto} onOpenChange={setDialogPagamentoAberto}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <Plus className="h-4 w-4 mr-1" />Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Adicionar Pagamento</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                     <div>
                        <Label>Forma de Pagamento</Label>
                        <Select value={novoPagamentoForma} onValueChange={(v) => {
                          setNovoPagamentoForma(v);
                          setSelectedPaymentInfo(null);
                          setSelectedPaymentExtras({});
                          if (v === "PIX") {
                            setPixModalOpen(true);
                            setShowPixQR(false);
                          } else if (v === "Cartão Crédito" || v === "Cartão Débito" || v === "PIX Maquininha") {
                            const tipo = v === "Cartão Crédito" ? "credito" : v === "PIX Maquininha" ? "pix_maquininha" : "debito";
                            setCardModalTipo(tipo);
                            setCardModalOpen(true);
                          } else {
                            setShowPixQR(false);
                          }
                        }}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {[...formasPagamento, "PIX Maquininha"].filter((f) => f !== "Vale Gás").map((forma) => (
                              <SelectItem key={forma} value={forma}>{forma}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedPaymentInfo && (
                        <div className="p-3 rounded-lg bg-success/10 text-success text-sm text-center font-medium">
                          {selectedPaymentInfo}
                        </div>
                      )}
                      {novoPagamentoForma === "PIX" && showPixQR && chavePix && (
                        <PixQRCode
                          chavePix={chavePix}
                          valor={diferenca > 0 ? diferenca : totalItens}
                          beneficiario={nomeUnidade || undefined}
                        />
                      )}
                       {/* Cheque fields */}
                       {novoPagamentoForma === "Cheque" && (
                         <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-dashed">
                           <p className="text-xs font-medium text-muted-foreground uppercase">Dados do Cheque</p>
                           <div className="grid grid-cols-2 gap-2">
                             <div>
                               <Label className="text-xs">Nº Cheque *</Label>
                               <Input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000001" className="h-8 text-sm" />
                             </div>
                             <div>
                               <Label className="text-xs">Banco *</Label>
                               <Input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Itaú, BB..." className="h-8 text-sm" />
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <Button type="button" variant="import" size="sm" className="text-xs" onClick={() => chequePhotoRef.current?.click()} disabled={isUploadingCheque}>
                                {isUploadingCheque ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                               Foto
                             </Button>
                              <Button type="button" variant="photo" size="sm" className="text-xs" onClick={() => chequeCameraRef.current?.click()} disabled={isUploadingCheque}>
                                <Camera className="h-4 w-4" />Câmera
                             </Button>
                             {chequeFotoPreviewUrl && <img src={chequeFotoPreviewUrl} alt="Cheque" className="h-8 w-12 rounded border object-cover" />}
                             <input ref={chequePhotoRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleChequeFoto(f); e.target.value = ""; }} />
                             <input ref={chequeCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleChequeFoto(f); e.target.value = ""; }} />
                           </div>
                         </div>
                       )}
                       {/* Cartão - Comprovante obrigatório */}
                       {(novoPagamentoForma === "Cartão Crédito" || novoPagamentoForma === "Cartão Débito") && (
                         <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-dashed">
                           <p className="text-xs font-medium text-muted-foreground uppercase">📸 Foto do Comprovante *</p>
                           <p className="text-xs text-muted-foreground">Tire uma foto do comprovante da maquininha para auditoria</p>
                           <div className="flex items-center gap-2">
                              <Button type="button" variant="import" size="sm" className="text-xs" onClick={() => comprovantePhotoRef.current?.click()} disabled={isUploadingComprovante}>
                                {isUploadingComprovante ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                               Galeria
                             </Button>
                              <Button type="button" variant="photo" size="sm" className="text-xs" onClick={() => comprovanteCameraRef.current?.click()} disabled={isUploadingComprovante}>
                                <Camera className="h-4 w-4" />Tirar Foto
                             </Button>
                             {comprovantePreviewUrl && <img src={comprovantePreviewUrl} alt="Comprovante" className="h-10 w-14 rounded border object-cover" />}
                             {comprovanteUrl && <CheckCircle className="h-4 w-4 text-success" />}
                             <input ref={comprovantePhotoRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleComprovanteFoto(f); e.target.value = ""; }} />
                             <input ref={comprovanteCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleComprovanteFoto(f); e.target.value = ""; }} />
                           </div>
                           {!comprovanteUrl && (
                             <p className="text-xs text-destructive flex items-center gap-1">
                               <AlertCircle className="h-3 w-3" /> Obrigatório para finalizar
                             </p>
                           )}
                         </div>
                       )}
                       {/* Gás do Povo - código do voucher */}
                       {novoPagamentoForma === "Gás do Povo" && (
                         <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-dashed">
                           <p className="text-xs font-medium text-muted-foreground uppercase">🏛️ Voucher Gás do Povo</p>
                           <div>
                             <Label className="text-xs">Código do Voucher *</Label>
                             <Input value={codigoVoucherGasPovo} onChange={e => setCodigoVoucherGasPovo(e.target.value)} placeholder="Ex: GdP-2026-00001" className="h-8 text-sm font-mono" />
                             <p className="text-xs text-muted-foreground mt-1">Digite o código impresso no voucher ou cartão do beneficiário</p>
                           </div>
                         </div>
                       )}
                       {/* Fiado fields */}
                       {novoPagamentoForma === "Fiado" && (
                         <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-dashed">
                           <p className="text-xs font-medium text-muted-foreground uppercase">Dados do Fiado</p>
                           <div>
                             <Label className="text-xs">Data de Vencimento</Label>
                             <Input type="date" value={dataVencimentoFiado} onChange={e => setDataVencimentoFiado(e.target.value)} min={getBrasiliaDateString()} className="h-8 text-sm" />
                             <p className="text-xs text-muted-foreground mt-1">Padrão: 30 dias ({format(addDays(new Date(), 30), "dd/MM/yyyy")})</p>
                           </div>
                         </div>
                       )}
                       <div>
                         <Label>Valor (R$)</Label>
                         <Input type="number" step="0.01" value={novoPagamentoValor} onChange={(e) => setNovoPagamentoValor(e.target.value)} placeholder="0,00" />
                       </div>
                      <Button onClick={adicionarPagamento} className="w-full gradient-primary text-white">Adicionar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pagamentos.map((pag, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{pag.forma}</p>
                  {pag.valeGasInfo && <p className="text-xs text-muted-foreground">{pag.valeGasInfo.parceiro} • {pag.valeGasInfo.codigo}</p>}
                  {pag.cheque_numero && <p className="text-xs text-muted-foreground">Cheque #{pag.cheque_numero} • {pag.cheque_banco}</p>}
                  {pag.data_vencimento_fiado && <p className="text-xs text-muted-foreground">Venc: {format(new Date(pag.data_vencimento_fiado + "T12:00:00"), "dd/MM/yyyy")}</p>}
                  {pag.comprovante_url && <p className="text-xs text-success flex items-center gap-1"><Camera className="h-3 w-3" /> Comprovante anexado</p>}
                  {pag.codigo_voucher && <p className="text-xs text-muted-foreground">Voucher: {pag.codigo_voucher}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">R$ {pag.valor.toFixed(2)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removerPagamento(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-border">
              <span className="font-medium">Total pago:</span>
              <span className="font-bold text-lg">R$ {totalPagamentos.toFixed(2)}</span>
            </div>
            {diferenca !== 0 && (
              <div className={`flex justify-between p-2 rounded-lg ${diferenca > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
                <span className="text-sm">{diferenca > 0 ? "Falta pagar:" : "Troco:"}</span>
                <span className={`font-bold ${diferenca > 0 ? "text-destructive" : "text-success"}`}>
                  R$ {Math.abs(diferenca).toFixed(2)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botão Receber no Cartão */}
        <Button
          variant="outline"
          onClick={() => setCardPaymentOpen(true)}
          className="w-full h-12 text-base border-primary text-primary hover:bg-primary/10"
          disabled={totalItens <= 0}
        >
          <CreditCard className="h-5 w-5 mr-2" />
          Receber no Cartão (Maquininha)
        </Button>


        {/* Assinatura do canhoto */}
        <AssinaturaCanhotoCard onChange={setAssinatura} />

        {/* Botão Finalizar */}
        <Button
          onClick={finalizarEntrega}
          className="w-full h-14 text-lg gradient-primary text-white shadow-glow"
          disabled={diferenca !== 0 || isSaving || !assinatura}
        >
          {isSaving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle className="h-5 w-5 mr-2" />}
          {isSaving ? "Salvando..." : !assinatura ? "Assine o canhoto para finalizar" : "Finalizar Entrega"}
        </Button>

        <div className="h-4" />
      </div>


      {/* PIX Key Selector */}
      <PixKeySelectorModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        valor={diferenca > 0 ? diferenca : totalItens}
        beneficiario={nomeUnidade || undefined}
        unidadeId={unidadeId || undefined}
        onSelect={(chavePix, contaBancariaId) => {
          setSelectedPaymentExtras({ conta_bancaria_id: contaBancariaId });
          setSelectedPaymentInfo("PIX via conta selecionada");
          setShowPixQR(false);
        }}
      />

      {/* Card Operator Selector */}
      <CardOperatorSelectorModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        valor={diferenca > 0 ? diferenca : totalItens}
        tipoCartao={cardModalTipo}
        unidadeId={unidadeId || undefined}
        onSelect={(op) => {
          setSelectedPaymentExtras({ operadora_id: op.id });
          setSelectedPaymentInfo(`${op.nome} • Taxa ${op.taxa.toFixed(2)}% • D+${op.prazo} • Líq. R$ ${op.valorLiquido.toFixed(2)}`);
        }}
      />

      {/* Card Payment Modal (Maquininha) */}
      <CardPaymentModal
        open={cardPaymentOpen}
        onClose={() => setCardPaymentOpen(false)}
        pedidoId={id || ""}
        entregadorId={entregadorIdLocal}
        valor={diferenca > 0 ? diferenca : totalItens}
        onSuccess={() => {
          toast({ title: "Pagamento aprovado!", description: "O pedido foi marcado como pago." });
          navigate("/entregador/entregas");
        }}
      />
    </EntregadorLayout>
  );
}
