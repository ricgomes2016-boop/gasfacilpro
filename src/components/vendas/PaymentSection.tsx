import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Plus, Trash2, AlertCircle, CheckCircle2, Camera, ImageIcon, Loader2, Info, Banknote, Smartphone, ReceiptText, Flame, FileText, WalletCards } from "lucide-react";
import { cn, getBrasiliaDateString } from "@/lib/utils";
import { formatCurrency, parseCurrency } from "@/hooks/useInputMasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { PixKeySelectorModal } from "@/components/pagamento/PixKeySelectorModal";
import { useFormasPagamentoCustom } from "@/hooks/useFormasPagamentoCustom";
import { CardOperatorSelectorModal } from "@/components/pagamento/CardOperatorSelectorModal";
import { useUnidade } from "@/contexts/UnidadeContext";
import { VendaSectionHeader } from "./VendaSectionHeader";

export interface Pagamento {
  id: string;
  forma: string;
  valor: number;
  // Cheque extras
  cheque_numero?: string;
  cheque_banco?: string;
  cheque_foto_url?: string;
  // Fiado extras
  data_vencimento_fiado?: string;
  // Operator/PIX extras
  operadora_id?: string;
  operadora_nome?: string;
  conta_bancaria_id?: string;
}

interface PaymentSectionProps {
  pagamentos: Pagamento[];
  onChange: (pagamentos: Pagamento[]) => void;
  totalVenda: number;
  unidadeId?: string;
  itens?: Array<{ nome: string; quantidade: number }>;
}

const formasPagamentoBase = [
  { value: "dinheiro", label: "Dinheiro", icon: "💵", Icon: Banknote, tone: "bg-success/15 text-success ring-success/25", cardTone: "border-success/25 bg-success/5 hover:border-success/45 hover:bg-success/10", valueTone: "text-success", quickTone: "text-success", quickSurface: "bg-success/10", quickRing: "ring-success/35" },
  { value: "pix", label: "PIX", icon: "📱", Icon: Smartphone, tone: "bg-success/15 text-success ring-success/25", cardTone: "border-success/25 bg-success/5 hover:border-success/45 hover:bg-success/10", valueTone: "text-success", quickTone: "text-info", quickSurface: "bg-info/10", quickRing: "ring-info/35" },
  { value: "pix_maquininha", label: "PIX Maquininha", icon: "📱", Icon: CreditCard, tone: "bg-accent/15 text-accent ring-accent/25", cardTone: "border-accent/25 bg-accent/5 hover:border-accent/45 hover:bg-accent/10", valueTone: "text-accent", quickTone: "text-primary", quickSurface: "bg-primary/10", quickRing: "ring-primary/35" },
  { value: "cartao_debito", label: "Cartão Débito", icon: "💳", Icon: WalletCards, tone: "bg-primary/15 text-primary ring-primary/25", cardTone: "border-primary/25 bg-primary/5 hover:border-primary/45 hover:bg-primary/10", valueTone: "text-primary", quickTone: "text-secondary", quickSurface: "bg-secondary/10", quickRing: "ring-secondary/35" },
  { value: "cartao_credito", label: "Cartão Crédito", icon: "💳", Icon: CreditCard, tone: "bg-warning/15 text-warning ring-warning/25", cardTone: "border-warning/25 bg-warning/5 hover:border-warning/45 hover:bg-warning/10", valueTone: "text-warning", quickTone: "text-warning", quickSurface: "bg-warning/15", quickRing: "ring-warning/35" },
  { value: "boleto", label: "Boleto", icon: "📄", Icon: FileText, tone: "bg-muted text-foreground ring-border", cardTone: "border-border bg-muted/25 hover:border-primary/35 hover:bg-muted/45", valueTone: "text-foreground", quickTone: "text-foreground", quickSurface: "bg-muted", quickRing: "ring-border" },
  { value: "vale_gas", label: "Vale Gás", icon: "🔥", Icon: Flame, tone: "bg-destructive/15 text-destructive ring-destructive/25", cardTone: "border-destructive/25 bg-destructive/5 hover:border-destructive/45 hover:bg-destructive/10", valueTone: "text-destructive", quickTone: "text-destructive", quickSurface: "bg-destructive/10", quickRing: "ring-destructive/35" },
  { value: "cheque", label: "Cheque", icon: "🧾", Icon: ReceiptText, tone: "bg-secondary/10 text-secondary ring-secondary/25", cardTone: "border-secondary/25 bg-secondary/5 hover:border-primary/35 hover:bg-secondary/10", valueTone: "text-secondary", quickTone: "text-secondary", quickSurface: "bg-secondary/10", quickRing: "ring-secondary/35" },
  { value: "fiado", label: "Fiado / A Prazo", icon: "📝", Icon: AlertCircle, tone: "bg-warning/15 text-warning ring-warning/25", cardTone: "border-warning/25 bg-warning/5 hover:border-warning/45 hover:bg-warning/10", valueTone: "text-warning", quickTone: "text-warning", quickSurface: "bg-warning/15", quickRing: "ring-warning/35" },
];

const GAS_DO_POVO_FORMA = { value: "gas_do_povo", label: "Gás do Povo", icon: "🏛️", Icon: Flame, tone: "bg-info/15 text-info ring-info/25", cardTone: "border-info/25 bg-info/5 hover:border-info/45 hover:bg-info/10", valueTone: "text-info", quickTone: "text-info", quickSurface: "bg-info/10", quickRing: "ring-info/35" };

export function PaymentSection({ pagamentos, onChange, totalVenda, unidadeId, itens = [] }: PaymentSectionProps) {
  const [forma, setForma] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [chequeNumero, setChequeNumero] = useState("");
  const [chequeBanco, setChequeBanco] = useState("");
  const [chequeFotoUrl, setChequeFotoUrl] = useState<string | null>(null);
  const [isUploadingCheque, setIsUploadingCheque] = useState(false);
  const [dataVencimentoFiado, setDataVencimentoFiado] = useState("");
  const [chequeDialogOpen, setChequeDialogOpen] = useState(false);
  const chequePhotoRef = useRef<HTMLInputElement>(null);
  const chequeCameraRef = useRef<HTMLInputElement>(null);

  // Selector modals
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [pendingOperadora, setPendingOperadora] = useState<{ id: string; nome: string } | null>(null);
  const [pendingContaBancaria, setPendingContaBancaria] = useState<string | null>(null);
  const [pendingCardInfo, setPendingCardInfo] = useState<string | null>(null);

  const { unidadeAtual } = useUnidade();
  const effectiveUnidadeNome = unidadeId ? undefined : unidadeAtual?.nome;

  const gasDoPovoHabilitado = !!(unidadeAtual as any)?.gas_do_povo_habilitado;
  const gasDoPovoValor = Number((unidadeAtual as any)?.gas_do_povo_valor ?? 101.08);
  const { data: formasCustom = [] } = useFormasPagamentoCustom({ onlyActive: true });
  const customEntries = formasCustom.map((c) => ({
    value: c.slug,
    label: c.nome,
    icon: c.icone,
    Icon: c.grupo === "a_vista" ? Banknote : FileText,
    tone: "bg-primary/15 text-primary ring-primary/25",
    cardTone: "border-primary/25 bg-primary/5 hover:border-primary/45 hover:bg-primary/10",
    valueTone: "text-primary",
    quickTone: "text-primary",
    quickSurface: "bg-primary/10",
    quickRing: "ring-primary/35",
  }));
  const formasPagamento = [
    ...formasPagamentoBase,
    ...(gasDoPovoHabilitado ? [GAS_DO_POVO_FORMA] : []),
    ...customEntries,
  ];

  // Carrinho elegível: exatamente 1× Gás P13
  const cartoElegivelGasDoPovo = (() => {
    if (itens.length !== 1) return false;
    const it = itens[0];
    if (it.quantidade !== 1) return false;
    return /g[áa]s\s*p13/i.test(it.nome);
  })();

  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const diferenca = totalVenda - totalPago;

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setValorDisplay(formatted);
  };

  const handleChequeFoto = async (file: File) => {
    setIsUploadingCheque(true);
    try {
      const compressed = await compressImage(file);
      const blob = await (await fetch(compressed)).blob();
      const fileName = `cheques/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, blob, { cacheControl: "3600" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setChequeFotoUrl(urlData.publicUrl);
      toast.success("Foto enviada! Extraindo dados...");

      try {
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke("parse-cheque-photo", {
          body: { image_url: urlData.publicUrl },
        });
        if (!ocrError && ocrData?.success && ocrData.data) {
          const d = ocrData.data;
          if (d.numero_cheque) setChequeNumero(d.numero_cheque);
          if (d.banco_emitente) setChequeBanco(d.banco_emitente);
          toast.success("Dados do cheque preenchidos automaticamente!");
        } else {
          toast.info("Não foi possível extrair dados. Preencha manualmente.");
        }
      } catch {
        toast.info("OCR indisponível. Preencha manualmente.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar foto");
    } finally {
      setIsUploadingCheque(false);
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

  const resetExtraFields = () => {
    setChequeNumero("");
    setChequeBanco("");
    setChequeFotoUrl(null);
    setDataVencimentoFiado("");
    setPendingOperadora(null);
    setPendingContaBancaria(null);
    setPendingCardInfo(null);
  };

  const addPagamento = () => {
    const valorNum = parseCurrency(valorDisplay);
    if (!forma || valorNum <= 0) return;

    if (forma === "cheque" && (!chequeNumero || !chequeBanco)) {
      toast.error("Preencha o número e banco do cheque");
      return;
    }

    if (forma === "gas_do_povo") {
      if (!cartoElegivelGasDoPovo) {
        toast.error("Gás do Povo aceito apenas para 1× Gás P13.");
        return;
      }
      if (Math.abs(valorNum - gasDoPovoValor) > 0.01) {
        toast.error(`Valor do Gás do Povo é fixo em R$ ${gasDoPovoValor.toFixed(2)}.`);
        return;
      }
    }


    const novoPagamento: Pagamento = {
      id: crypto.randomUUID(),
      forma,
      valor: valorNum,
    };

    if (forma === "cheque") {
      novoPagamento.cheque_numero = chequeNumero;
      novoPagamento.cheque_banco = chequeBanco;
      novoPagamento.cheque_foto_url = chequeFotoUrl || undefined;
    }

    if (forma === "fiado") {
      novoPagamento.data_vencimento_fiado = dataVencimentoFiado || format(addDays(new Date(), 30), "yyyy-MM-dd");
    }

    // Attach operator/PIX info
    if (pendingOperadora) {
      novoPagamento.operadora_id = pendingOperadora.id;
      novoPagamento.operadora_nome = pendingOperadora.nome;
    }
    if (pendingContaBancaria) {
      novoPagamento.conta_bancaria_id = pendingContaBancaria;
    }

    onChange([...pagamentos, novoPagamento]);
    setForma("");
    setValorDisplay("");
    resetExtraFields();
  };

  const removePagamento = (id: string) => {
    onChange(pagamentos.filter((p) => p.id !== id));
  };

  const getFormaLabel = (formaValue: string) => {
    return formasPagamento.find((f) => f.value === formaValue)?.label || formaValue;
  };

  const getFormaIcon = (formaValue: string) => {
    return formasPagamento.find((f) => f.value === formaValue)?.icon || "💰";
  };

  const getFormaConfig = (formaValue: string) => {
    return formasPagamento.find((f) => f.value === formaValue) || formasPagamento[0];
  };

  const handleFormaChange = (value: string) => {
    if (value === "gas_do_povo") {
      if (!cartoElegivelGasDoPovo) {
        toast.error("Gás do Povo aceito apenas para venda de exatamente 1× Gás P13.");
        return;
      }
      setForma(value);
      resetExtraFields();
      setValorDisplay(formatCurrency(gasDoPovoValor.toFixed(2).replace(".", ",")));
      setPendingCardInfo(`Programa Gás do Povo — R$ ${gasDoPovoValor.toFixed(2)} (D+2, taxa 0%)`);
      return;
    }
    setForma(value);
    resetExtraFields();
    if (!valorDisplay && diferenca > 0) {
      setValorDisplay(formatCurrency(diferenca.toFixed(2).replace(".", ",")));
    }

    // Auto-open selector modals
    if (value === "pix") {
      setPixModalOpen(true);
    } else if (value === "cartao_debito" || value === "cartao_credito" || value === "pix_maquininha") {
      setCardModalOpen(true);
    }
  };

  const cardTipoMap: Record<string, "debito" | "credito" | "pix_maquininha"> = {
    cartao_debito: "debito",
    cartao_credito: "credito",
    pix_maquininha: "pix_maquininha",
  };

  return (
    <>
      <Card className="venda-card overflow-hidden">
        <VendaSectionHeader
          title="Pagamento"
          icon={<CreditCard className="h-5 w-5" />}
          tone="success"
          action={
            <div className="rounded-md border border-primary-foreground/25 bg-primary-foreground px-3 py-1.5 text-sm font-semibold text-primary shadow-sm">
              Total R$ {totalVenda.toFixed(2)}
            </div>
          }
        />
        <CardContent className="space-y-4 p-4">
          {/* Lista de pagamentos adicionados */}
          {pagamentos.length > 0 && (
            <div className="space-y-2">
              {pagamentos.map((pag) => {
                const formaConfig = getFormaConfig(pag.forma);
                const Icon = formaConfig.Icon;
                return (
                <div
                  key={pag.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                    formaConfig.cardTone
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1", formaConfig.tone)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{getFormaLabel(pag.forma)}</span>
                      {pag.cheque_numero && (
                        <p className="text-xs text-muted-foreground">Cheque #{pag.cheque_numero} • {pag.cheque_banco}</p>
                      )}
                      {pag.data_vencimento_fiado && (
                        <p className="text-xs text-muted-foreground">Venc: {format(new Date(pag.data_vencimento_fiado + "T12:00:00"), "dd/MM/yyyy")}</p>
                      )}
                      {pag.operadora_nome && (
                        <p className="text-xs text-muted-foreground">Operadora: {pag.operadora_nome}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pag.cheque_foto_url && (
                      <a href={pag.cheque_foto_url} target="_blank" rel="noopener noreferrer">
                        <img src={pag.cheque_foto_url} alt="Cheque" className="h-6 w-8 rounded object-cover border" />
                      </a>
                    )}
                    <span className={cn("font-semibold", formaConfig.valueTone)}>R$ {pag.valor.toFixed(2)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removePagamento(pag.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Adicionar novo pagamento */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 shadow-sm shadow-primary/10 space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
              {formasPagamento.map((fp) => {
                const Icon = fp.Icon;
                const selected = forma === fp.value;
                return (
                  <button
                    key={fp.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleFormaChange(fp.value)}
                    data-selected={selected}
                    className={cn(
                      "venda-payment-shortcut group flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center transition-all duration-200 hover:scale-[1.02] hover:border-primary/35 hover:bg-primary/5 hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      selected ? "ring-2 ring-offset-2 ring-primary/40 shadow-xl" : fp.quickRing
                    )}
                  >
                    <span className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-105",
                      selected ? "bg-primary-foreground/15 text-primary-foreground ring-primary-foreground/30" : `${fp.quickSurface} ${fp.quickTone} ${fp.quickRing}`
                    )}>
                      <Icon className="h-5 w-5 drop-shadow-sm" strokeWidth={2.25} />
                    </span>
                    <span className={cn("text-[11px] font-bold leading-tight text-center", selected ? "text-primary-foreground" : "text-foreground")}>{fp.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={forma} onValueChange={handleFormaChange}>
                <SelectTrigger className="h-11 flex-1 min-w-[180px] bg-background">
                  <SelectValue placeholder="Forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((fp) => (
                    <SelectItem key={fp.value} value={fp.value}>
                      <span className="flex items-center gap-2">
                        <span>{fp.icon}</span>
                        <span>{fp.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-shrink-0 w-32 sm:w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  placeholder="0,00"
                  value={valorDisplay}
                  onChange={handleValorChange}
                  className="h-11 bg-background pl-9"
                  data-venda-enter-next
                />
              </div>
              <Button onClick={addPagamento} size="icon" className="h-11 w-11 shrink-0 bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Pending selection info */}
            {pendingCardInfo && (
              <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                {pendingCardInfo}
              </div>
            )}

            {/* Cheque extra fields */}
            {forma === "cheque" && (
                <div className="venda-modern-surface p-3 rounded-lg space-y-2 border border-dashed">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados do Cheque</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nº Cheque *</Label>
                    <Input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000001" className="h-8 text-sm" data-venda-enter-next />
                  </div>
                  <div>
                    <Label className="text-xs">Banco *</Label>
                    <Input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Itaú, BB..." className="h-8 text-sm" data-venda-enter-next />
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
                  {chequeFotoUrl && <img src={chequeFotoUrl} alt="Cheque" className="h-8 w-12 rounded border object-cover" />}
                  <input ref={chequePhotoRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleChequeFoto(f); e.target.value = ""; }} />
                  <input ref={chequeCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleChequeFoto(f); e.target.value = ""; }} />
                </div>
              </div>
            )}

            {/* Fiado extra fields */}
            {forma === "fiado" && (
                <div className="venda-modern-surface p-3 rounded-lg space-y-2 border border-dashed">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados do Fiado</p>
                <div>
                  <Label className="text-xs">Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={dataVencimentoFiado}
                    onChange={e => setDataVencimentoFiado(e.target.value)}
                    min={getBrasiliaDateString()}
                    className="h-8 text-sm"
                    placeholder={format(addDays(new Date(), 30), "yyyy-MM-dd")}
                    data-venda-enter-next
                  />
                  <p className="text-xs text-muted-foreground mt-1">Se não informado, vencimento será em 30 dias ({format(addDays(new Date(), 30), "dd/MM/yyyy")})</p>
                </div>
              </div>
            )}
          </div>

          {/* Status do pagamento */}
          {totalVenda > 0 && (
            <div
              className={cn(
                "rounded-lg border p-3 flex items-center gap-2 text-sm font-medium shadow-sm",
                diferenca > 0 && "bg-destructive/10 text-destructive",
                diferenca < 0 && "bg-warning/10 text-warning",
                diferenca === 0 && "bg-success/10 text-success"
              )}
            >
              {diferenca > 0 ? (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span>Falta pagar: R$ {diferenca.toFixed(2)}</span>
                </>
              ) : diferenca < 0 ? (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span>Troco: R$ {Math.abs(diferenca).toFixed(2)}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Pagamento completo!</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PIX Key Selector */}
      <PixKeySelectorModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        valor={parseCurrency(valorDisplay) || diferenca}
        beneficiario={effectiveUnidadeNome}
        unidadeId={unidadeId}
        onSelect={(chavePix, contaBancariaId) => {
          setPendingContaBancaria(contaBancariaId);
          setPendingCardInfo(`Chave PIX selecionada ✓`);
        }}
      />

      {/* Card Operator Selector */}
      <CardOperatorSelectorModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        valor={parseCurrency(valorDisplay) || diferenca}
        tipoCartao={cardTipoMap[forma] || "debito"}
        unidadeId={unidadeId}
        onSelect={(op) => {
          setPendingOperadora({ id: op.id, nome: op.nome });
          if (op.conta_bancaria_id) setPendingContaBancaria(op.conta_bancaria_id);
          setPendingCardInfo(`${op.nome} • Taxa ${op.taxa.toFixed(2)}% • D+${op.prazo} • Líq. R$ ${op.valorLiquido.toFixed(2)}`);
        }}
      />
    </>
  );
}
