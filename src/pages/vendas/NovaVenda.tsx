import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, ShoppingBag, Sparkles, Loader2, Send, Mic, MicOff, Camera, ImageIcon, PlusCircle, Check, User, Package as PackageIcon, CreditCard, CheckCircle, CalendarClock } from "lucide-react";
import { NovaVendaModal } from "@/components/vendas/NovaVendaModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateReceiptPdf, EmpresaConfig } from "@/services/receiptPdfService";
import { atualizarEstoqueVenda } from "@/services/estoqueService";
import { rotearPagamentosVenda } from "@/services/paymentRoutingService";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { cn, getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";
import { CaixaBloqueadoBanner } from "@/components/caixa/CaixaBloqueadoBanner";

import { CustomerSearch } from "@/components/vendas/CustomerSearch";
import { ProductSearch, ItemVenda } from "@/components/vendas/ProductSearch";
import { PaymentSection, Pagamento } from "@/components/vendas/PaymentSection";
import { EmitirBoletoAsaasDialog } from "@/components/financeiro/EmitirBoletoAsaasDialog";
import { OrderSummary } from "@/components/vendas/OrderSummary";
import { CustomerHistory } from "@/components/vendas/CustomerHistory";
import { DeliveryPersonSelect } from "@/components/vendas/DeliveryPersonSelect";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";

interface CustomerData {
  id: string | null;
  nome: string;
  telefone: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  observacao: string;
}

const initialCustomerData: CustomerData = {
  id: null,
  nome: "",
  telefone: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  observacao: "",
};

const DRAFT_KEY = "nova-venda-rascunho";
const VIEW_KEY = "nova-venda-view-mode";
type VendaStepId = "cliente" | "produtos" | "pagamento" | "entregador" | "confirmar";
const VENDA_STEPS: VendaStepId[] = ["cliente", "produtos", "pagamento", "entregador", "confirmar"];
const STEP_TONE_CLASS: Record<VendaStepId, string> = {
  cliente: "venda-tone-cliente",
  produtos: "venda-tone-produtos",
  pagamento: "venda-tone-pagamento",
  entregador: "venda-tone-entregador",
  confirmar: "venda-tone-confirmar",
};

function getSavedViewMode() {
  try {
    return localStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

function saveViewMode(useNewView: boolean) {
  try {
    localStorage.setItem(VIEW_KEY, useNewView ? "new" : "old");
  } catch {}
}

function saveDraft(data: { customer: CustomerData; itens: ItemVenda[]; pagamentos: Pagamento[]; canalVenda: string; entregador: { id: string | null; nome: string | null } }) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {}
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function toBrasiliaNoonISOString(dateValue: string) {
  return `${dateValue}T12:00:00-03:00`;
}

// Stepper component
function VendaStepper({ customer, itens, pagamentos, totalVenda, entregadorSelecionado = false, activeStep, onStepClick, compact = false }: {
  customer: CustomerData;
  itens: ItemVenda[];
  pagamentos: Pagamento[];
  totalVenda: number;
  entregadorSelecionado?: boolean;
  activeStep?: VendaStepId;
  onStepClick?: (step: VendaStepId) => void;
  compact?: boolean;
}) {
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const clienteOk = !!customer.nome.trim();
  const produtosOk = itens.length > 0;
  const pagamentoOk = totalPago >= totalVenda && totalVenda > 0;
  const steps: Array<{ id: VendaStepId; label: string; done: boolean; enabled: boolean; icon: typeof User }> = [
    { id: "cliente", label: "Cliente", done: clienteOk, enabled: true, icon: User },
    { id: "produtos", label: "Produtos", done: produtosOk, enabled: true, icon: PackageIcon },
    { id: "pagamento", label: "Pagamento", done: pagamentoOk, enabled: true, icon: CreditCard },
    { id: "entregador", label: "Entregador", done: entregadorSelecionado, enabled: true, icon: ShoppingBag },
    { id: "confirmar", label: "Confirmar", done: pagamentoOk && produtosOk && entregadorSelecionado, enabled: true, icon: CheckCircle },
  ];

  return (
    <div className="flex items-center justify-between gap-1">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex items-center gap-1 flex-1">
            <button
              type="button"
              data-active={activeStep === step.id}
              data-done={step.done}
              disabled={!step.enabled || !onStepClick}
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors disabled:cursor-not-allowed",
                "venda-step-tab",
                STEP_TONE_CLASS[step.id],
                compact ? "px-2 py-1" : "px-2.5 py-1.5",
                activeStep === step.id || step.done ? "" : "bg-muted text-muted-foreground",
                step.enabled && onStepClick && activeStep !== step.id && "hover:bg-muted/80"
              )}
            >
              {step.done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn("h-0.5 flex-1 rounded", step.done ? "bg-primary/30" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface NovaVendaProps {
  embedded?: boolean;
  initialClienteId?: string | null;
  onClose?: () => void;
}

export default function NovaVenda({ embedded = false, initialClienteId, onClose }: NovaVendaProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { isGasmais } = useDashboardTheme();

  const [dataEntrega, setDataEntrega] = useState(() => { const d = getBrasiliaDate(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; });
  const [canalVenda, setCanalVenda] = useState("telefone");
  const [customer, setCustomer] = useState<CustomerData>(initialCustomerData);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [entregador, setEntregador] = useState<{ id: string | null; nome: string | null }>({
    id: null,
    nome: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Próximo número de pedido (preview na tela)
  const { data: proximoNumero } = useQuery({
    queryKey: ["proximo-numero-pedido", empresa?.id, isLoading],
    queryFn: async () => {
      if (!empresa?.id) return null;
      const { data, error } = await supabase.rpc("proximo_numero_pedido", { _empresa_id: empresa.id });
      if (error) return null;
      return data as number;
    },
    enabled: !!empresa?.id,
    refetchInterval: 30000,
  });

  // Empenhos abertos (Licitações Ganhas) — usado para campo "Vale Físico"
  const [parceiroEmpenhoId, setParceiroEmpenhoId] = useState<string>("nenhum");
  const [valeNumero, setValeNumero] = useState<string>("");

  const { data: parceirosComEmpenho = [] } = useQuery({
    queryKey: ["parceiros-com-empenho-aberto", unidadeAtual?.id, empresa?.id],
    queryFn: async () => {
      const q = (supabase as any)
        .from("empenhos")
        .select("parceiro_id, parceiro:vale_gas_parceiros(id,nome)")
        .in("status", ["aberto", "parcial"]);
      if (unidadeAtual?.id) q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) return [];
      const map = new Map<string, { id: string; nome: string }>();
      (data || []).forEach((r: any) => {
        if (r.parceiro?.id) map.set(r.parceiro.id, r.parceiro);
      });
      return Array.from(map.values());
    },
    enabled: !!empresa?.id,
  });

  const [aiCommand, setAiCommand] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horaAgendamento, setHoraAgendamento] = useState("08:00");
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [pendingReceiptData, setPendingReceiptData] = useState<any>(null);
  const [boletoAsaasConta, setBoletoAsaasConta] = useState<any>(null);
  const [useNewView, setUseNewView] = useState(() => {
    const saved = getSavedViewMode();
    return saved ? saved === "new" : isGasmais;
  });
  const [activeStep, setActiveStep] = useState<VendaStepId>("cliente");
  const recognitionRef = useRef<any>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const draftLoaded = useRef(false);
  const previousStepState = useRef({ cliente: false, produtos: false, pagamento: false, entregador: false });

  useEffect(() => {
    if (!getSavedViewMode() && isGasmais) setUseNewView(true);
  }, [isGasmais]);

  // #5 - Load draft on mount
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    const draft = loadDraft();
    if (draft && (draft.itens?.length > 0 || draft.customer?.nome)) {
      setCustomer(draft.customer || initialCustomerData);
      setItens(draft.itens || []);
      setPagamentos(draft.pagamentos || []);
      setCanalVenda(draft.canalVenda || "telefone");
      setEntregador(draft.entregador || { id: null, nome: null });
      toast({ title: "Rascunho restaurado", description: "Sua venda em andamento foi recuperada." });
    }
  }, []);

  // #5 - Auto-save draft
  useEffect(() => {
    if (!draftLoaded.current) return;
    if (customer.nome || itens.length > 0) {
      saveDraft({ customer, itens, pagamentos, canalVenda, entregador });
    }
  }, [customer, itens, pagamentos, canalVenda, entregador]);

  // Fetch dynamic sales channels
  const { data: canaisVenda = [] } = useQuery({
    queryKey: ["canais-venda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canais_venda")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });


  // Fixed channels + dynamic ones
  const fixedChannels = [
    { value: "telefone", label: "📞 Telefone" },
    { value: "whatsapp", label: "💬 WhatsApp" },
    { value: "portaria", label: "🏢 Portaria" },
  ];

  const dynamicChannels = canaisVenda
    .filter((c) => !fixedChannels.some((f) => f.value === c.nome.toLowerCase()))
    .map((c) => ({ value: c.nome, label: `🏷️ ${c.nome}` }));

  const allChannels = [...fixedChannels, ...dynamicChannels];

  // Voice recognition
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Não suportado",
        description: "Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setAiCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast({
          title: "Microfone bloqueado",
          description: "Permita o acesso ao microfone nas configurações do navegador.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setTimeout(() => {
        const btn = document.getElementById("ai-send-btn");
        if (btn) btn.click();
      }, 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleAiCommand = async () => {
    if (!aiCommand.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-sales-command", {
        body: { comando: aiCommand, unidade_id: unidadeAtual?.id || null },
      });

      if (error) throw error;

      // Se for uma consulta de fiado/notinhas, mostra resultado e não cria venda
      if (data?.tipo === "consulta_fiado") {
        toast({
          title: "Consulta de fiado",
          description: data.mensagem,
          duration: 12000,
        });
        setAiCommand("");
        setAiLoading(false);
        return;
      }

      if (data.cliente_id) {
        const { data: clienteData } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", data.cliente_id)
          .single();
        if (clienteData) {
          setCustomer({
            id: clienteData.id,
            nome: clienteData.nome,
            telefone: clienteData.telefone || "",
            endereco: data.endereco || clienteData.endereco || "",
            numero: data.numero || "",
            complemento: data.complemento || "",
            bairro: data.bairro || clienteData.bairro || "",
            cep: data.cep || clienteData.cep || "",
            observacao: data.observacoes || "",
          });
        }
      } else if (data.cliente_nome) {
        const novoCliente: any = {
          nome: data.cliente_nome,
          endereco: data.endereco || null,
          bairro: data.bairro || null,
          cep: data.cep || null,
          cidade: data.cidade || null,
          telefone: data.cliente_telefone || null,
          ativo: true,
          empresa_id: empresa?.id || null,
        };

        const { data: clienteCriado, error: createError } = await supabase
          .from("clientes")
          .insert(novoCliente)
          .select("id")
          .single();

        if (createError) {
          setCustomer({
            ...initialCustomerData,
            nome: data.cliente_nome,
            telefone: data.cliente_telefone || "",
            endereco: data.endereco || "",
            numero: data.numero || "",
            complemento: data.complemento || "",
            bairro: data.bairro || "",
            cep: data.cep || "",
            observacao: data.observacoes || "",
          });
        } else {
          // Associate new client with current unidade
          if (unidadeAtual?.id) {
            await supabase.from("cliente_unidades").insert({
              cliente_id: clienteCriado.id,
              unidade_id: unidadeAtual.id,
            });
          }
          setCustomer({
            id: clienteCriado.id,
            nome: data.cliente_nome,
            telefone: data.cliente_telefone || "",
            endereco: data.endereco || "",
            numero: data.numero || "",
            complemento: data.complemento || "",
            bairro: data.bairro || "",
            cep: data.cep || "",
            observacao: data.observacoes || "",
          });
          toast({
            title: "Novo cliente cadastrado!",
            description: `${data.cliente_nome} foi adicionado automaticamente ao sistema.`,
          });
        }
      }

      if (data.itens && data.itens.length > 0) {
        const newItens: ItemVenda[] = data.itens.map((item: any) => ({
          id: crypto.randomUUID(),
          produto_id: item.produto_id,
          nome: item.nome,
          quantidade: item.quantidade || 1,
          preco_unitario: item.preco_unitario,
          total: (item.quantidade || 1) * item.preco_unitario,
        }));
        setItens(newItens);
      }

      if (data.forma_pagamento) {
        const totalItens = (data.itens || []).reduce((a: number, i: any) => a + (i.quantidade || 1) * i.preco_unitario, 0);
        setPagamentos([{ id: crypto.randomUUID(), forma: data.forma_pagamento, valor: totalItens }]);
      }

      if (data.canal_venda) {
        setCanalVenda(data.canal_venda);
      }

      setAiCommand("");
      toast({
        title: "Comando interpretado!",
        description: `Venda pré-preenchida para ${data.cliente_nome || "cliente não identificado"}.`,
      });
    } catch (error: any) {
      console.error("Erro IA:", error);
      toast({
        title: "Erro ao interpretar",
        description: error.message || "Não foi possível processar o comando.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Photo OCR handler
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxWidth = 1600;
          const scale = Math.min(1, maxWidth / img.width);
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

  const handlePhotoSales = async (file: File) => {
    setPhotoLoading(true);
    try {
      const imageData = await compressImage(file);

      const { data, error } = await supabase.functions.invoke("parse-sales-photo", {
        body: { image: imageData },
      });

      if (error) throw error;

      const vendas = data.vendas || [data];
      if (!vendas.length) {
        toast({ title: "Nenhuma venda encontrada", description: "Não foi possível identificar vendas na imagem.", variant: "destructive" });
        return;
      }

      let successCount = 0;
      for (const venda of vendas) {
        try {
          let clienteId = venda.cliente_id;
          if (!clienteId && venda.cliente_nome) {
            const { data: found } = await supabase
              .from("clientes")
              .select("id")
              .ilike("nome", `%${venda.cliente_nome}%`)
              .limit(1)
              .single();

            if (found) {
              clienteId = found.id;
            } else {
          const { data: created } = await supabase
                .from("clientes")
                .insert({
                  nome: venda.cliente_nome,
                  endereco: venda.endereco || null,
                  numero: venda.numero || null,
                  bairro: venda.bairro || null,
                  cep: venda.cep || null,
                  cidade: venda.cidade || null,
                  telefone: venda.cliente_telefone || null,
                  ativo: true,
                })
                .select("id")
                .single();
              if (created) {
                clienteId = created.id;
                if (unidadeAtual?.id) {
                  await supabase.from("cliente_unidades").insert({
                    cliente_id: created.id,
                    unidade_id: unidadeAtual.id,
                  });
                }
              }
            }
          }

          const enderecoCompleto = [
            venda.endereco,
            venda.numero && `Nº ${venda.numero}`,
            venda.complemento,
            venda.bairro,
          ].filter(Boolean).join(", ");

          const valorTotal = (venda.itens || []).reduce((a: number, i: any) => a + (i.quantidade || 1) * i.preco_unitario, 0);

          const { data: pedido, error: pedidoError } = await supabase
            .from("pedidos")
            .insert({
              cliente_id: clienteId,
              endereco_entrega: enderecoCompleto,
              valor_total: valorTotal,
              forma_pagamento: venda.forma_pagamento || null,
              canal_venda: venda.canal_venda || "telefone",
              observacoes: venda.observacoes || null,
              status: "pendente",
              unidade_id: unidadeAtual?.id,
              data_entrega: dataEntrega,
              created_at: toBrasiliaNoonISOString(dataEntrega),
            })
            .select("id")
            .single();

          if (pedidoError) throw pedidoError;

          if (venda.itens?.length) {
            const itensInsert = venda.itens.map((item: any) => ({
              pedido_id: pedido.id,
              produto_id: item.produto_id,
              quantidade: item.quantidade || 1,
              preco_unitario: item.preco_unitario,
            }));
            await supabase.from("pedido_itens").insert(itensInsert);
          }

          // #4 - Use shared stock update service
          await atualizarEstoqueVenda(
            (venda.itens || []).map((item: any) => ({
              produto_id: item.produto_id,
              quantidade: item.quantidade || 1,
            })),
            unidadeAtual?.id
          );

          successCount++;
        } catch (err: any) {
          console.error(`Erro ao lançar venda para ${venda.cliente_nome}:`, err);
        }
      }

      toast({
        title: `${successCount} venda(s) lançada(s)!`,
        description: `${successCount} de ${vendas.length} vendas foram criadas com sucesso a partir da foto.`,
      });

      if (successCount > 0) {
        clearDraft();
        navigate("/vendas/pedidos");
      }
    } catch (error: any) {
      console.error("Erro OCR:", error);
      toast({
        title: "Erro ao processar foto",
        description: error.message || "Não foi possível interpretar a anotação.",
        variant: "destructive",
      });
    } finally {
      setPhotoLoading(false);
    }
  };

  const totalVenda = itens.reduce((acc, item) => acc + item.total, 0);
  const totalPagoVenda = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const clientePreenchido = !!customer.nome.trim();
  const produtosPreenchidos = itens.length > 0;
  const pagamentoPreenchido = totalPagoVenda >= totalVenda && totalVenda > 0;
  const entregadorPreenchido = !!entregador.id;
  const firstPendingStep: VendaStepId = !clientePreenchido
    ? "cliente"
    : !produtosPreenchidos
    ? "produtos"
    : !pagamentoPreenchido
    ? "pagamento"
    : !entregadorPreenchido
    ? "entregador"
    : "confirmar";

  useEffect(() => {
    const current = {
      cliente: clientePreenchido,
      produtos: produtosPreenchidos,
      pagamento: pagamentoPreenchido,
      entregador: entregadorPreenchido,
    };

    if (!useNewView) {
      previousStepState.current = current;
      return;
    }

    const previous = previousStepState.current;
    let nextStep: VendaStepId | null = null;

    if (!previous.cliente && current.cliente && activeStep === "cliente") nextStep = "produtos";
    else if (!previous.produtos && current.produtos && activeStep === "produtos") nextStep = "pagamento";
    else if (!previous.pagamento && current.pagamento && activeStep === "pagamento") nextStep = "entregador";
    else if (!previous.entregador && current.entregador && activeStep === "entregador") nextStep = "confirmar";

    previousStepState.current = current;
    if (nextStep) setActiveStep(nextStep);
  }, [useNewView, activeStep, clientePreenchido, produtosPreenchidos, pagamentoPreenchido, entregadorPreenchido]);

  const canOpenStep = (step: VendaStepId) => {
    return VENDA_STEPS.includes(step);
  };

  const toggleViewMode = () => {
    const next = !useNewView;
    setUseNewView(next);
    saveViewMode(next);
  };


  // Nova Venda modal state
  const [showNovaVendaModal, setShowNovaVendaModal] = useState(false);

  const handleSelecionarEntregador = (id: string, nome: string) => {
    setEntregador({ id, nome });
    if (useNewView) setActiveStep("confirmar");
    toast({
      title: "Entregador selecionado!",
      description: `${nome} foi atribuído a esta venda.`,
    });
  };

  const handleStepEnterNavigation = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest("#ai-send-btn") || target.closest("[data-venda-enter-skip]") || target.closest('[role="combobox"]') || target.closest("button")) return;
    if (target instanceof HTMLTextAreaElement) return;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
    if (target.type === "file" || target.type === "checkbox" || target.type === "radio") return;
    if (!target.matches("[data-venda-enter-next]")) return;

    const panel = target.closest(".venda-step-panel");
    if (!panel) return;

    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>('[data-venda-enter-next]:not([disabled])')
    ).filter((el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'));
    const index = focusables.indexOf(target);
    const next = focusables[index + 1];

    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  const handleFinalizar = async () => {
    if (itens.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um produto.", variant: "destructive" });
      return;
    }

    if (pagamentos.length === 0) {
      toast({ title: "Forma de pagamento obrigatória", description: "Selecione pelo menos uma forma de pagamento antes de finalizar.", variant: "destructive" });
      return;
    }

    const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
    if (totalPago < totalVenda) {
      toast({ title: "Pagamento incompleto", description: `Falta pagar R$ ${(totalVenda - totalPago).toFixed(2)}`, variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      // Auto-cadastrar cliente se não estiver cadastrado
      let clienteId = customer.id;
      if (!clienteId && customer.nome.trim()) {
        const { data: novoCliente, error: clienteError } = await supabase
          .from("clientes")
          .insert({
            nome: customer.nome,
            telefone: customer.telefone || null,
            endereco: customer.endereco || null,
            numero: customer.numero || null,
            bairro: customer.bairro || null,
            cidade: unidadeAtual?.cidade || null,
            cep: customer.cep || null,
            tipo: "residencial",
            ativo: true,
            empresa_id: empresa?.id || null,
          })
          .select("id")
          .single();
        
        if (!clienteError && novoCliente) {
          clienteId = novoCliente.id;
          // Associate with current unidade
          if (unidadeAtual?.id) {
            await supabase.from("cliente_unidades").insert({
              cliente_id: novoCliente.id,
              unidade_id: unidadeAtual.id,
            });
          }
          toast({ title: "Cliente cadastrado automaticamente!", description: `${customer.nome} foi adicionado ao sistema.` });
        }
      }

      const enderecoCompleto = [
        customer.endereco,
        customer.numero && `Nº ${customer.numero}`,
        customer.complemento,
        customer.bairro,
      ].filter(Boolean).join(", ");

      // Extract cheque/fiado data from pagamentos
      const chequePag = pagamentos.find(p => p.forma === "cheque");
      const fiadoPag = pagamentos.find(p => p.forma === "fiado");

      const pedidoInsert: any = {
        cliente_id: clienteId,
        entregador_id: entregador.id,
        endereco_entrega: enderecoCompleto,
        valor_total: totalVenda,
        forma_pagamento: pagamentos.map((p) => p.forma).join(", "),
        canal_venda: canalVenda,
        observacoes: customer.observacao,
        status: "pendente",
        unidade_id: unidadeAtual?.id,
        data_entrega: dataEntrega,
        created_at: toBrasiliaNoonISOString(dataEntrega),
      };

      if (chequePag) {
        pedidoInsert.cheque_numero = chequePag.cheque_numero || null;
        pedidoInsert.cheque_banco = chequePag.cheque_banco || null;
        pedidoInsert.cheque_foto_url = chequePag.cheque_foto_url || null;
      }

      if (fiadoPag) {
        pedidoInsert.data_vencimento_fiado = fiadoPag.data_vencimento_fiado || null;
      }

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert(pedidoInsert)
        .select("id, numero_sequencial")
        .single();

      if (pedidoError) throw pedidoError;

      const itensInsert = itens.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
      }));

      const { error: itensError } = await supabase.from("pedido_itens").insert(itensInsert);
      if (itensError) throw itensError;

      // #4 - Use shared stock update service
      await atualizarEstoqueVenda(itens.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
      })), unidadeAtual?.id);

      // Prepare receipt data for optional printing
      let empresaConfig: EmpresaConfig | undefined;
      try {
        let cfgQuery = supabase
          .from("configuracoes_empresa")
          .select("nome_empresa, cnpj, telefone, endereco, mensagem_cupom")
          .limit(1);
        if (empresa?.id) cfgQuery = cfgQuery.eq("empresa_id", empresa.id);
        const { data: configData } = await cfgQuery.maybeSingle();

        empresaConfig = {
          nome_empresa: empresa?.nome || configData?.nome_empresa || "Empresa",
          cnpj: configData?.cnpj ?? null,
          telefone: configData?.telefone ?? null,
          endereco: configData?.endereco ?? null,
          mensagem_cupom: configData?.mensagem_cupom ?? null,
        };
      } catch (e) {
        console.warn("Não foi possível carregar configurações da empresa");
        if (empresa?.nome) empresaConfig = { nome_empresa: empresa.nome };
      }

      const receiptData = {
        pedidoId: pedido.id,
        pedidoNumero: (pedido as any).numero_sequencial ?? null,
        data: new Date(toBrasiliaNoonISOString(dataEntrega)),
        cliente: { nome: customer.nome, telefone: customer.telefone, endereco: enderecoCompleto },
        itens,
        pagamentos,
        entregadorNome: entregador.nome,
        canalVenda,
        observacoes: customer.observacao,
        empresa: empresaConfig,
      };

      // #5 - Rotear pagamentos para caixa/contas a receber/cheques
      // Se tem entregador, o roteamento financeiro acontece APENAS no acerto diário
      // porque o entregador ainda não entregou/coletou o dinheiro
      if (!entregador.id) {
        await rotearPagamentosVenda({
          pedidoId: pedido.id,
          pedidoNumero: (pedido as any).numero_sequencial ?? null,
          clienteId,
          clienteNome: customer.nome || "Consumidor",
          pagamentos: pagamentos.map(p => ({
            forma: p.forma,
            valor: p.valor,
            cheque_numero: p.cheque_numero,
            cheque_banco: p.cheque_banco,
            cheque_foto_url: p.cheque_foto_url,
            data_vencimento_fiado: p.data_vencimento_fiado,
          })),
          unidadeId: unidadeAtual?.id,
          entregadorId: null,
        });
      }

      // #5.1 - Se houver boleto, buscar a conta_receber criada para abrir o Asaas
      const temBoleto = pagamentos.some((p) => p.forma === "boleto");
      let contaBoletoAsaas: any = null;
      if (temBoleto && !entregador.id) {
        const { data: cr } = await supabase
          .from("contas_receber")
          .select("id, cliente, descricao, valor, vencimento, pedido_id, asaas_charge_id, linha_digitavel, boleto_url, pix_copia_cola")
          .eq("pedido_id", pedido.id)
          .eq("forma_pagamento", "boleto")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cr) contaBoletoAsaas = cr;
      }

      // #6 - Clear draft after successful sale
      clearDraft();

      toast({
        title: "Venda finalizada!",
        description: `Pedido #${(pedido as any).numero_sequencial ?? pedido.id.slice(0, 8).toUpperCase()} criado com sucesso.`,
      });

      // Show print confirmation dialog (Asaas dialog abre depois, se houver boleto)
      setPendingReceiptData(receiptData);
      setBoletoAsaasConta(contaBoletoAsaas);
      setPrintDialogOpen(true);
    } catch (error: any) {
      console.error("Erro ao salvar venda:", error);
      toast({ title: "Erro ao salvar", description: error.message || "Ocorreu um erro ao finalizar a venda.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgendar = () => {
    if (itens.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um produto.", variant: "destructive" });
      return;
    }
    setAgendarOpen(true);
  };

  const handleConfirmarAgendamento = async () => {
    if (!dataAgendamento) {
      toast({ title: "Selecione a data", variant: "destructive" }); return;
    }
    setIsLoading(true);
    try {
      const enderecoCompleto = [
        customer.endereco, customer.numero && `Nº ${customer.numero}`,
        customer.complemento, customer.bairro,
      ].filter(Boolean).join(", ");

      const agendamentoDate = new Date(`${dataAgendamento}T${horaAgendamento}:00`);

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: customer.id, entregador_id: entregador.id,
          endereco_entrega: enderecoCompleto, valor_total: totalVenda,
          forma_pagamento: pagamentos.map((p) => p.forma).join(", "),
          canal_venda: canalVenda, observacoes: customer.observacao,
          status: "pendente", unidade_id: unidadeAtual?.id,
          data_entrega: dataAgendamento,
          agendado: true, data_agendamento: agendamentoDate.toISOString(),
        } as any)
        .select("id, numero_sequencial")
        .single();

      if (pedidoError) throw pedidoError;

      const itensInsert = itens.map((item) => ({
        pedido_id: pedido.id, produto_id: item.produto_id,
        quantidade: item.quantidade, preco_unitario: item.preco_unitario,
      }));
      await supabase.from("pedido_itens").insert(itensInsert);

      clearDraft();
      setAgendarOpen(false);
      toast({
        title: "Entrega agendada!",
        description: `Pedido #${(pedido as any).numero_sequencial ?? pedido.id.slice(0, 6)} agendado para ${dataAgendamento} às ${horaAgendamento}.`,
      });
      navigate("/vendas/pedidos");
    } catch (error: any) {
      console.error(error);
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelar = () => {
    if (itens.length > 0 || pagamentos.length > 0) {
      if (!confirm("Deseja realmente cancelar esta venda? Os dados serão perdidos.")) return;
    }
    clearDraft();
    if (embedded && onClose) {
      onClose();
    } else {
      navigate("/vendas/pedidos");
    }
  };

  // Load initial client when in embedded mode (e.g., from CallerIdPopup) OR via URL ?cliente_id=
  const [searchParams] = useSearchParams();
  const urlClienteId = searchParams.get("cliente_id");
  const urlRepetirPedido = searchParams.get("repetir_pedido");
  const effectiveClienteId = initialClienteId || urlClienteId;
  const initLoadedRef = useRef(false);

  useEffect(() => {
    if (!effectiveClienteId || initLoadedRef.current) return;
    initLoadedRef.current = true;
    const loadCliente = async () => {
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", effectiveClienteId)
        .single();
      if (data) {
        setCustomer({
          id: data.id,
          nome: data.nome,
          telefone: data.telefone || "",
          endereco: data.endereco || "",
          numero: data.numero || "",
          complemento: "",
          bairro: data.bairro || "",
          cep: data.cep || "",
          observacao: "",
        });
      }

      // Repetir pedido: carregar itens do pedido informado
      if (urlRepetirPedido) {
        const { data: itensPedido } = await supabase
          .from("pedido_itens")
          .select("produto_id, quantidade, preco_unitario, produtos(nome)")
          .eq("pedido_id", urlRepetirPedido);
        if (itensPedido && itensPedido.length > 0) {
          const novos: ItemVenda[] = itensPedido.map((it: any) => ({
            id: crypto.randomUUID(),
            produto_id: it.produto_id,
            nome: it.produtos?.nome || "Produto",
            quantidade: it.quantidade,
            preco_unitario: Number(it.preco_unitario),
            total: it.quantidade * Number(it.preco_unitario),
          }));
          setItens(novos);
          toast({ title: "Pedido replicado", description: `${novos.length} item(ns) carregado(s) do pedido anterior.` });
        }
      }
    };
    loadCliente();
  }, [effectiveClienteId, urlRepetirPedido]);


  const metaCard = (
    <Card className="venda-card venda-gasmais-card venda-tone-cliente border-primary/20 bg-card/95">
      <CardContent className="p-3 md:p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="py-[8px]">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Data de Entrega
            </Label>
            <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} className="mt-1" data-venda-enter-next />
          </div>
          <div>
            <Label className="text-xs font-semibold text-foreground">Canal de Venda</Label>
            <Select value={canalVenda} onValueChange={setCanalVenda}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allChannels.map((ch) => (
                  <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const aiCommandCard = (
    <Card className="venda-card venda-gasmais-card venda-tone-confirmar border-primary/40 bg-primary/5 shadow-primary/10">
      <CardContent className="py-3 md:py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <Input
            placeholder='Ex: "2 P13 para Maria, Rua Ceará 30, Centro"'
            value={aiCommand}
            onChange={(e) => setAiCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !aiLoading && handleAiCommand()}
            className="bg-background flex-1 min-w-0"
              data-venda-enter-skip
            disabled={aiLoading || isListening}
          />
          <div className="flex items-center gap-1">
            <Button variant={isListening ? "destructive" : "microphone"} size="icon" onClick={isListening ? stopListening : startListening} disabled={aiLoading} className={`shrink-0 h-9 w-9 ${isListening ? "animate-pulse" : ""}`} title={isListening ? "Parar gravação" : "Comando por voz"}>
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button variant="import" size="icon" onClick={() => photoInputRef.current?.click()} disabled={aiLoading || photoLoading} className="shrink-0 h-9 w-9" title="Lançar vendas por foto">
              {photoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </Button>
            <Button variant="photo" size="icon" onClick={() => cameraInputRef.current?.click()} disabled={aiLoading || photoLoading} className="shrink-0 h-9 w-9" title="Tirar foto da anotação">
              {photoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </Button>
            <Button id="ai-send-btn" onClick={handleAiCommand} disabled={aiLoading || !aiCommand.trim()} size="sm" className="shrink-0 gap-1">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">{aiLoading ? "..." : "Enviar"}</span>
            </Button>
          </div>
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoSales(file); e.target.value = ""; }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoSales(file); e.target.value = ""; }} />
        <p className="text-xs font-medium text-foreground mt-2 ml-7">
          {photoLoading ? "📸 Processando foto..." : isListening ? "🔴 Ouvindo... Fale o comando." : "💡 Digite, 🎤 dite, ou 📷 tire foto de anotações."}
        </p>
      </CardContent>
    </Card>
  );

  const vendaContent = (
    <>
      <div className="p-3 md:p-4 space-y-3 md:space-y-4"> 
        <CaixaBloqueadoBanner />

        <div className="space-y-3 rounded-lg border border-border/70 bg-card p-3 shadow-lg shadow-foreground/10">
          <VendaStepper
            customer={customer}
            itens={itens}
            pagamentos={pagamentos}
            totalVenda={totalVenda}
            entregadorSelecionado={entregadorPreenchido}
            activeStep={useNewView ? activeStep : undefined}
            onStepClick={useNewView ? (step) => canOpenStep(step) && setActiveStep(step) : undefined}
            compact
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className="text-xs border-primary/30 bg-primary/5 text-primary">
              #{proximoNumero ?? "—"}
            </Badge>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleViewMode} className="h-8 px-2 text-xs font-semibold text-foreground hover:text-primary">
                {useNewView ? "Versão antiga" : "Versão nova"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowNovaVendaModal(true)} className="gap-1.5 text-xs">
                <PlusCircle className="h-3.5 w-3.5" />
                Nova Venda
              </Button>
            </div>
          </div>
        </div>

        {useNewView ? (
          <div className="space-y-3 md:space-y-4">
            {activeStep === "cliente" && (
              <div className="venda-step-panel grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1fr)_420px]" onKeyDown={handleStepEnterNavigation}>
                <div className="space-y-3 md:space-y-4 min-w-0">
                  {aiCommandCard}
                  {metaCard}
                  <div className="venda-tone-cliente"><CustomerSearch value={customer} onChange={setCustomer} /></div>
                </div>
                <div className="venda-tone-cliente min-w-0 xl:sticky xl:top-4 self-start">
                  <CustomerHistory clienteId={customer.id} />
                </div>
              </div>
            )}
            {activeStep === "produtos" && (
              <div className="venda-step-panel w-full" onKeyDown={handleStepEnterNavigation}>
                <ProductSearch itens={itens} onChange={setItens} unidadeId={unidadeAtual?.id} clienteId={customer.id} />
              </div>
            )}
            {activeStep === "pagamento" && (
              <div className="venda-step-panel venda-tone-pagamento w-full" onKeyDown={handleStepEnterNavigation}>
                <PaymentSection pagamentos={pagamentos} onChange={setPagamentos} totalVenda={totalVenda} />
              </div>
            )}
            {activeStep === "entregador" && (
              <div className="venda-step-panel venda-tone-entregador w-full">
                <DeliveryPersonSelect value={entregador.id} onChange={handleSelecionarEntregador} endereco={customer.endereco} />
              </div>
            )}
            {activeStep === "confirmar" && (
              <div className="venda-step-panel venda-tone-confirmar w-full">
                <OrderSummary itens={itens} pagamentos={pagamentos} entregadorNome={entregador.nome} canalVenda={canalVenda} onFinalizar={handleFinalizar} onCancelar={handleCancelar} onAgendar={handleAgendar} isLoading={isLoading} />
              </div>
            )}
          </div>
        ) : (
          <>
            {aiCommandCard}
            <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3 md:space-y-4">
                {metaCard}
                <CustomerSearch value={customer} onChange={setCustomer} />
                <DeliveryPersonSelect value={entregador.id} onChange={handleSelecionarEntregador} endereco={customer.endereco} />
                <ProductSearch itens={itens} onChange={setItens} unidadeId={unidadeAtual?.id} clienteId={customer.id} />
                <PaymentSection pagamentos={pagamentos} onChange={setPagamentos} totalVenda={totalVenda} />
              </div>
              <div className="lg:sticky lg:top-4 space-y-3 md:space-y-4 self-start">
                <OrderSummary itens={itens} pagamentos={pagamentos} entregadorNome={entregador.nome} canalVenda={canalVenda} onFinalizar={handleFinalizar} onCancelar={handleCancelar} onAgendar={handleAgendar} isLoading={isLoading} />
                <CustomerHistory clienteId={customer.id} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialog Agendamento */}
      <Dialog open={agendarOpen} onOpenChange={setAgendarOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />Agendar Entrega</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Data da Entrega *</Label>
              <Input type="date" value={dataAgendamento} onChange={e => setDataAgendamento(e.target.value)} min={getBrasiliaDateString()} />
            </div>
            <div>
              <Label>Horário Previsto</Label>
              <Input type="time" value={horaAgendamento} onChange={e => setHoraAgendamento(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">
              O pedido será criado com status "pendente" e marcado como agendado.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAgendarOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfirmarAgendamento} disabled={isLoading}>
                {isLoading ? "Agendando..." : "Confirmar Agendamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print confirmation dialog */}
      <Dialog open={printDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPrintDialogOpen(false);
          setPendingReceiptData(null);
          if (boletoAsaasConta) return; // não navega ainda — Asaas dialog ainda vai abrir
          if (embedded && onClose) { onClose(); } else { navigate("/vendas/pedidos"); }
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Imprimir comprovante?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja imprimir o comprovante desta venda?</p>
          {boletoAsaasConta && (
            <p className="text-xs text-primary">Em seguida abriremos a emissão do boleto Asaas.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => {
              setPrintDialogOpen(false);
              setPendingReceiptData(null);
              if (!boletoAsaasConta) {
                if (embedded && onClose) { onClose(); } else { navigate("/vendas/pedidos"); }
              }
            }}>
              Não
            </Button>
            <Button onClick={() => {
              if (pendingReceiptData) generateReceiptPdf(pendingReceiptData);
              setPrintDialogOpen(false);
              setPendingReceiptData(null);
              if (!boletoAsaasConta) {
                if (embedded && onClose) { onClose(); } else { navigate("/vendas/pedidos"); }
              }
            }}>
              Sim, Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Emissão de boleto Asaas após a venda */}
      {boletoAsaasConta && !printDialogOpen && (
        <EmitirBoletoAsaasDialog
          open={!!boletoAsaasConta}
          onOpenChange={(o) => {
            if (!o) {
              setBoletoAsaasConta(null);
              if (embedded && onClose) { onClose(); } else { navigate("/vendas/pedidos"); }
            }
          }}
          conta={boletoAsaasConta}
        />
      )}
    </>
  );

  const novaVendaModalElement = (
    <NovaVendaModal open={showNovaVendaModal} onClose={() => setShowNovaVendaModal(false)} />
  );

  if (embedded) {
    return vendaContent;
  }

  return (
    <MainLayout>
      <Header title="Nova Venda" subtitle={unidadeAtual?.nome || "Carregando..."} />
      {vendaContent}
    </MainLayout>
  );
}
