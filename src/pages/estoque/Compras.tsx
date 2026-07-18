import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ShoppingCart, Plus, DollarSign, Truck, FileText, Upload, Trash2,
  Camera, Loader2, TrendingUp, TrendingDown, BarChart3, CalendarDays, Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { formatCurrency, parseCurrency, formatCNPJ } from "@/hooks/useInputMasks";
import { atualizarEstoqueCompra } from "@/services/estoqueService";
import { OutlookImportButton } from "@/components/estoque/OutlookImportButton";
import { ComprasListaTableEstoque } from "@/components/estoque/ComprasListaTableEstoque";
import { ConfirmarNovosProdutosDialog, NovoProdutoCandidato, DecisaoItem } from "@/components/estoque/ConfirmarNovosProdutosDialog";
import { registrarPagamentoCompra, reverterPagamentoCompra, type FormaPagamentoCompra } from "@/services/compraFinanceiroService";
import { EstoqueKpiCard } from "@/components/estoque/EstoqueKpiCard";
import { EstoquePageHeader } from "@/components/estoque/EstoquePageHeader";

interface Compra {
  id: string;
  valor_total: number;
  valor_frete: number | null;
  status: string;
  
  data_compra: string | null;
  data_pagamento: string | null;
  numero_nota_fiscal: string | null;
  chave_nfe: string | null;
  observacoes: string | null;
  created_at: string;
  fornecedores: { razao_social: string } | null;
}

interface Fornecedor {
  id: string;
  razao_social: string;
  cnpj: string | null;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
}

interface ItemFiscal {
  descricao_xml?: string;
  codigo_produto_fornecedor?: string;
  unidade_xml?: string;
  ncm?: string;
  cest?: string;
  cfop?: string;
  codigo_anp?: string;
  cst_icms?: string;
  csosn_icms?: string;
  cst_pis?: string;
  cst_cofins?: string;
  aliquota_icms?: number;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  valor_icms?: number;
  valor_pis?: number;
  valor_cofins?: number;
  valor_desconto?: number;
}

interface ItemCompra {
  produto_id: string;
  produto_nome?: string;
  quantidade: number;
  preco_unitario: number;
  is_new?: boolean;
  fiscal?: ItemFiscal;
}

interface NfFiscal {
  serie?: string;
  modelo?: string;
  natureza_operacao?: string;
  cfop_predominante?: string;
  valor_produtos?: number;
  valor_desconto?: number;
  valor_seguro?: number;
  valor_outros?: number;
  valor_icms?: number;
  valor_icms_st?: number;
  valor_ipi?: number;
  valor_pis?: number;
  valor_cofins?: number;
  base_icms?: number;
  base_icms_st?: number;
  transportadora_nome?: string;
  transportadora_cnpj?: string;
  placa_veiculo?: string;
  modalidade_frete?: string;
  xml_content?: string;
}

export default function Compras() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [quickFornOpen, setQuickFornOpen] = useState(false);
  const [quickFornForm, setQuickFornForm] = useState({ razao_social: "", nome_fantasia: "", cnpj: "", tipo: "gas", telefone: "", email: "", cidade: "" });
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fornecedor_id: "",
    fornecedor_novo: null as { razao_social: string; cnpj: string; nome_fantasia?: string; endereco?: string; cidade?: string; estado?: string; telefone?: string } | null,
    numero_nota_fiscal: "",
    chave_nfe: "",
    data_compra: getBrasiliaDateString(),
    data_pagamento: "",
    valor_frete: "",
    observacoes: "",
  });

  const [pagamento, setPagamento] = useState<{
    situacao: "avista" | "aprazo";
    forma: FormaPagamentoCompra;
    conta_bancaria_id: string;
    parcelas: number;
    numero_cheque: string;
    banco_cheque: string;
    bom_para: string;
  }>({
    situacao: "avista",
    forma: "dinheiro",
    conta_bancaria_id: "",
    parcelas: 1,
    numero_cheque: "",
    banco_cheque: "",
    bom_para: "",
  });

  type PagExtra = {
    id: string;
    forma: FormaPagamentoCompra;
    conta_bancaria_id: string;
    valor: string;
    numero_cheque: string;
    banco_cheque: string;
    bom_para: string;
  };
  const [pagamentosExtras, setPagamentosExtras] = useState<PagExtra[]>([]);

  const [contasBancarias, setContasBancarias] = useState<Array<{ id: string; nome: string; banco: string | null; saldo_atual: number | null }>>([]);

  const [itens, setItens] = useState<ItemCompra[]>([]);
  const [novoItem, setNovoItem] = useState({ produto_id: "", quantidade: "1", preco_unitario: "" });
  const [nfFiscal, setNfFiscal] = useState<NfFiscal | null>(null);

  // Confirmação de novos produtos detectados no XML
  const [novosProdDialogOpen, setNovosProdDialogOpen] = useState(false);
  const [novosCandidatos, setNovosCandidatos] = useState<NovoProdutoCandidato[]>([]);
  const pendingItensRef = useRef<ItemCompra[]>([]);
  const pendingFiscalByKeyRef = useRef<Record<string, { fiscal: ItemFiscal; categoria: "gas" | "agua" | "outros" }>>({});
  const pendingMetaRef = useRef<{ nNF: string; vNF: number } | null>(null);

  const fetchCompras = async () => {
    let query = supabase
      .from("compras")
      .select("*, fornecedores(razao_social), compra_itens(quantidade, produtos(nome))")
      .order("created_at", { ascending: false });

    if (unidadeAtual?.id) {
      query = query.eq("unidade_id", unidadeAtual.id);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return; }
    setCompras((data || []) as any);
    setLoading(false);
  };

  const fetchFornecedores = async () => {
    let q = supabase.from("fornecedores").select("id, razao_social, cnpj").eq("ativo", true).order("razao_social");
    if (empresa?.id) q = q.eq("empresa_id", empresa.id);
    const { data } = await q;
    setFornecedores(data || []);
  };

  const fetchProdutos = async () => {
    let query = supabase.from("produtos").select("id, nome, preco").eq("ativo", true);
    if (unidadeAtual?.id) {
      query = query.eq("unidade_id", unidadeAtual.id);
    }
    const { data } = await query;
    setProdutos(data || []);
  };

  const fetchContasBancarias = async () => {
    let q = supabase
      .from("contas_bancarias")
      .select("id, nome, banco, saldo_atual")
      .eq("ativo", true);
    if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
    const { data } = await q.order("nome");
    setContasBancarias((data || []) as any);
  };

  useEffect(() => {
    fetchFornecedores();
  }, []);

  useEffect(() => {
    fetchCompras();
    fetchProdutos();
    fetchContasBancarias();
  }, [unidadeAtual?.id]);

  const subtotalItens = itens.reduce((a, i) => a + i.preco_unitario * i.quantidade, 0);
  const valorFrete = parseCurrency(form.valor_frete);
  const totalCompra = subtotalItens + valorFrete;

  const adicionarItem = () => {
    if (!novoItem.produto_id) { toast.error("Selecione um produto"); return; }
    if (!novoItem.preco_unitario) { toast.error("Informe o preço unitário"); return; }

    setItens([...itens, {
      produto_id: novoItem.produto_id,
      quantidade: parseInt(novoItem.quantidade) || 1,
      preco_unitario: parseCurrency(novoItem.preco_unitario),
    }]);
    setNovoItem({ produto_id: "", quantidade: "1", preco_unitario: "" });
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setForm({
      fornecedor_id: "", fornecedor_novo: null, numero_nota_fiscal: "", chave_nfe: "",
      data_compra: getBrasiliaDateString(),
      data_pagamento: "", valor_frete: "", observacoes: "",
    });
    setPagamento({
      situacao: "avista", forma: "dinheiro", conta_bancaria_id: "",
      parcelas: 1, numero_cheque: "", banco_cheque: "", bom_para: "",
    });
    setPagamentosExtras([]);
    setItens([]);
    setNovoItem({ produto_id: "", quantidade: "1", preco_unitario: "" });
    setNfFiscal(null);
  };

  const handleSave = async () => {
    if (!form.fornecedor_id && !form.fornecedor_novo) { toast.error("Selecione um fornecedor"); return; }
    if (itens.length === 0) { toast.error("Adicione pelo menos um item"); return; }

    let fornecedorId = form.fornecedor_id;

    // Create new supplier if needed
    if (form.fornecedor_novo && !fornecedorId) {
      const { data: newForn, error: fornError } = await supabase.from("fornecedores").insert({
        razao_social: form.fornecedor_novo.razao_social,
        nome_fantasia: form.fornecedor_novo.nome_fantasia || null,
        cnpj: form.fornecedor_novo.cnpj || null,
        endereco: form.fornecedor_novo.endereco || null,
        cidade: form.fornecedor_novo.cidade || null,
        estado: form.fornecedor_novo.estado || null,
        telefone: form.fornecedor_novo.telefone || null,
        empresa_id: empresa?.id,
        ativo: true,
      }).select("id").single();

      if (fornError) { toast.error("Erro ao cadastrar fornecedor: " + fornError.message); return; }
      fornecedorId = newForn.id;
      toast.success(`Fornecedor "${form.fornecedor_novo.razao_social}" cadastrado!`);

      // Espelha em clientes (tipo='fornecedor') se ainda não existir por CNPJ
      if (empresa?.id) {
        const cnpjLimpo = (form.fornecedor_novo.cnpj || "").replace(/\D/g, "");
        let exists = false;
        if (cnpjLimpo) {
          const { data: existing } = await (supabase as any).from("clientes")
            .select("id").eq("empresa_id", empresa.id).eq("cnpj", cnpjLimpo).maybeSingle();
          exists = !!existing;
        }
        if (!exists) {
          await (supabase as any).from("clientes").insert({
            empresa_id: empresa.id,
            nome: form.fornecedor_novo.razao_social,
            razao_social: form.fornecedor_novo.razao_social,
            nome_fantasia: form.fornecedor_novo.nome_fantasia || null,
            cnpj: cnpjLimpo || null,
            telefone: form.fornecedor_novo.telefone || null,
            endereco: form.fornecedor_novo.endereco || null,
            cidade: form.fornecedor_novo.cidade || null,
            estado: form.fornecedor_novo.estado || null,
            tipo: "fornecedor",
            ativo: true,
          });
        }
      }
    }

    // Create new products if needed (com dados fiscais do XML quando disponíveis)
    const resolvedItens: { produto_id: string; quantidade: number; preco_unitario: number; fiscal?: ItemFiscal }[] = [];
    for (const item of itens) {
      let prodId = item.produto_id;
      if (item.is_new && item.produto_nome) {
        const f = item.fiscal || {};
        const isMonofasico = (f.cst_pis === "04" || f.cst_cofins === "04" || (f.codigo_anp || "").startsWith("21"));
        const isGas = /g[áa]s|glp|p[\s-]?13|p[\s-]?20|p[\s-]?45/i.test(item.produto_nome);
        const { data: newProd, error: prodError } = await (supabase as any).from("produtos").insert({
          nome: item.produto_nome,
          preco: item.preco_unitario,
          ativo: true,
          unidade_id: unidadeAtual?.id || null,
          categoria: isGas ? "gas" : null,
          ncm: f.ncm || null,
          cest: f.cest || null,
          cfop_entrada_padrao: f.cfop || null,
          codigo_anp: f.codigo_anp || null,
          cst_icms: f.cst_icms || null,
          csosn_icms: f.csosn_icms || null,
          cst_pis: f.cst_pis || null,
          cst_cofins: f.cst_cofins || null,
          aliquota_pis: f.aliquota_pis ?? null,
          aliquota_cofins: f.aliquota_cofins ?? null,
          unidade_tributavel: f.unidade_xml || null,
          monofasico: isMonofasico,
        }).select("id").single();

        if (prodError) { toast.error("Erro ao cadastrar produto: " + prodError.message); return; }
        prodId = newProd.id;
        toast.success(`Produto "${item.produto_nome}" cadastrado!`);
      }
      resolvedItens.push({ produto_id: prodId, quantidade: item.quantidade, preco_unitario: item.preco_unitario, fiscal: item.fiscal });
    }

    const nf = nfFiscal || {};
    const { data: compra, error } = await (supabase as any).from("compras").insert({
      fornecedor_id: fornecedorId,
      unidade_id: unidadeAtual?.id || null,
      valor_total: totalCompra,
      valor_frete: valorFrete || 0,
      numero_nota_fiscal: form.numero_nota_fiscal || null,
      chave_nfe: form.chave_nfe || null,
      data_compra: form.data_compra || null,
      forma_pagamento: pagamento.situacao === "aprazo" ? "a_prazo" : (pagamentosExtras.length > 0 ? "misto" : pagamento.forma),
      origem_pagamento: pagamento.situacao === "aprazo" ? "fatura" : (pagamentosExtras.length > 0 ? "misto" : (pagamento.forma === "dinheiro" ? "caixa" : (pagamento.forma === "credito" ? "fatura" : "banco"))),
      conta_bancaria_id: pagamento.conta_bancaria_id || null,
      parcelas: pagamento.parcelas || 1,
      data_pagamento: form.data_pagamento || null,
      observacoes: form.observacoes || null,
      status: "pendente",
      serie: nf.serie || null,
      modelo: nf.modelo || null,
      natureza_operacao: nf.natureza_operacao || null,
      cfop_predominante: nf.cfop_predominante || null,
      valor_produtos: nf.valor_produtos ?? null,
      valor_desconto: nf.valor_desconto ?? null,
      valor_seguro: nf.valor_seguro ?? null,
      valor_outros: nf.valor_outros ?? null,
      valor_icms: nf.valor_icms ?? null,
      valor_icms_st: nf.valor_icms_st ?? null,
      valor_ipi: nf.valor_ipi ?? null,
      valor_pis: nf.valor_pis ?? null,
      valor_cofins: nf.valor_cofins ?? null,
      base_icms: nf.base_icms ?? null,
      base_icms_st: nf.base_icms_st ?? null,
      transportadora_nome: nf.transportadora_nome || null,
      transportadora_cnpj: nf.transportadora_cnpj || null,
      placa_veiculo: nf.placa_veiculo || null,
      modalidade_frete: nf.modalidade_frete || null,
      xml_content: nf.xml_content || null,
    }).select("id").single();

    if (error) { toast.error("Erro: " + error.message); return; }

    if (compra) {
      const itensData = resolvedItens.map(i => ({
        compra_id: compra.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        descricao_xml: i.fiscal?.descricao_xml || null,
        codigo_produto_fornecedor: i.fiscal?.codigo_produto_fornecedor || null,
        unidade_xml: i.fiscal?.unidade_xml || null,
        ncm: i.fiscal?.ncm || null,
        cest: i.fiscal?.cest || null,
        cfop: i.fiscal?.cfop || null,
        codigo_anp: i.fiscal?.codigo_anp || null,
        cst_icms: i.fiscal?.cst_icms || null,
        csosn_icms: i.fiscal?.csosn_icms || null,
        cst_pis: i.fiscal?.cst_pis || null,
        cst_cofins: i.fiscal?.cst_cofins || null,
        aliquota_icms: i.fiscal?.aliquota_icms ?? null,
        aliquota_pis: i.fiscal?.aliquota_pis ?? null,
        aliquota_cofins: i.fiscal?.aliquota_cofins ?? null,
        valor_icms: i.fiscal?.valor_icms ?? null,
        valor_pis: i.fiscal?.valor_pis ?? null,
        valor_cofins: i.fiscal?.valor_cofins ?? null,
        valor_desconto: i.fiscal?.valor_desconto ?? null,
      }));
      const { error: itensError } = await (supabase as any).from("compra_itens").insert(itensData);
      if (itensError) { toast.error("Erro nos itens: " + itensError.message); }

      // Atualizar estoque dos produtos comprados
      await atualizarEstoqueCompra(
        resolvedItens.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
        unidadeAtual?.id
      );
    }

    // Rota financeira do pagamento
    if (compra) {
      const fornecedor = fornecedores.find(f => f.id === fornecedorId);
      const fornecedorNome = fornecedor?.razao_social || form.fornecedor_novo?.razao_social || "";
      const descricao = `Compra NF ${form.numero_nota_fiscal || "S/N"} - ${fornecedorNome}`;
      try {
        if (pagamento.situacao === "aprazo" || pagamentosExtras.length === 0) {
          await registrarPagamentoCompra(compra.id, {
            forma: pagamento.situacao === "aprazo" ? "a_prazo" : pagamento.forma,
            valor: totalCompra,
            data_pagamento: form.data_pagamento || form.data_compra || null,
            conta_bancaria_id: pagamento.conta_bancaria_id || null,
            parcelas: pagamento.parcelas,
            numero_cheque: pagamento.numero_cheque || null,
            banco_cheque: pagamento.banco_cheque || null,
            bom_para: pagamento.bom_para || null,
            descricao,
            fornecedor: fornecedorNome,
            unidade_id: unidadeAtual?.id || null,
          });
        } else {
          // Múltiplas formas de pagamento à vista
          const somaExtras = pagamentosExtras.reduce((a, r) => a + parseCurrency(r.valor), 0);
          const valorPrimaria = Math.max(0, +(totalCompra - somaExtras).toFixed(2));
          const rows: Array<{ tag: string; row: typeof pagamento | PagExtra; valor: number }> = [
            { tag: "primaria", row: pagamento, valor: valorPrimaria },
            ...pagamentosExtras.map((r, i) => ({ tag: `extra_${i + 1}`, row: r, valor: parseCurrency(r.valor) })),
          ];
          for (const r of rows) {
            if (r.valor <= 0) continue;
            const isPrim = r.tag === "primaria";
            await registrarPagamentoCompra(compra.id, {
              forma: (r.row as any).forma,
              valor: r.valor,
              data_pagamento: form.data_pagamento || form.data_compra || null,
              conta_bancaria_id: (r.row as any).conta_bancaria_id || null,
              parcelas: isPrim ? pagamento.parcelas : 1,
              numero_cheque: (r.row as any).numero_cheque || null,
              banco_cheque: (r.row as any).banco_cheque || null,
              bom_para: (r.row as any).bom_para || null,
              descricao: `${descricao} · ${r.tag === "primaria" ? "parte 1" : `parte ${Number(r.tag.split("_")[1]) + 1}`}`,
              fornecedor: fornecedorNome,
              unidade_id: unidadeAtual?.id || null,
            });
          }
        }
      } catch (e: any) {
        toast.error("Compra salva, mas houve erro no lançamento financeiro: " + e.message);
      }
    }

    toast.success("Compra registrada!");
    setOpen(false);
    resetForm();
    fetchCompras();
    fetchFornecedores();
    fetchProdutos();
    fetchContasBancarias();
  };

  const handleDeleteCompra = async () => {
    if (!deleteId) return;

    // Reverter lançamentos financeiros antes de apagar a compra
    try {
      await reverterPagamentoCompra(deleteId);
    } catch (e: any) {
      console.error("Erro ao reverter financeiro da compra:", e);
    }

    // Delete items first then the purchase
    const { error: itensErr } = await supabase.from("compra_itens").delete().eq("compra_id", deleteId);
    if (itensErr) { toast.error("Erro ao excluir itens: " + itensErr.message); return; }

    const { error } = await supabase.from("compras").delete().eq("id", deleteId);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }


    toast.success("Compra excluída!");
    setDeleteId(null);
    fetchCompras();
    fetchContasBancarias();
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 10MB)");
      return;
    }

    setIsProcessingPhoto(true);
    toast.info("Processando nota fiscal com IA...");

    try {
      // Resize image to avoid API limits
      const resizeImage = (file: File, maxWidth = 1600): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = document.createElement("img");
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject(new Error("Canvas not supported"));
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
              } catch (err) {
                reject(err);
              }
            };
            img.onerror = () => reject(new Error("Erro ao carregar imagem"));
            img.src = reader.result as string;
          };
          reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
          reader.readAsDataURL(file);
        });
      };

      let base64: string;
      try {
        base64 = await resizeImage(file);
      } catch (resizeErr) {
        console.error("Resize error, using original:", resizeErr);
        // Fallback: use original file as base64
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const { data, error } = await supabase.functions.invoke("parse-invoice-photo", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;
      if (!data || data?.error) throw new Error(data?.error || "Resposta vazia da IA");

      // Safely access nested data
      const fornecedorData = data.fornecedor || {};
      const notaData = data.nota || {};
      const itensData = Array.isArray(data.itens) ? data.itens : [];

      // Process supplier
      let fornecedorId = "";
      let fornecedorNovo = null;

      if (fornecedorData.cnpj) {
        const cnpjLimpo = String(fornecedorData.cnpj).replace(/\D/g, "");
        if (cnpjLimpo.length >= 11) {
          const cnpjFormatado = formatCNPJ(cnpjLimpo);
          const existing = fornecedores.find(f => f.cnpj?.replace(/\D/g, "") === cnpjLimpo);
          if (existing) {
            fornecedorId = existing.id;
            toast.info(`Fornecedor encontrado: ${existing.razao_social}`);
          } else {
            fornecedorNovo = {
              razao_social: fornecedorData.razao_social || "Fornecedor não identificado",
              nome_fantasia: fornecedorData.nome_fantasia || undefined,
              cnpj: cnpjFormatado,
              endereco: fornecedorData.endereco || undefined,
              cidade: fornecedorData.cidade || undefined,
              estado: fornecedorData.estado || undefined,
              telefone: fornecedorData.telefone || undefined,
            };
            toast.info(`Novo fornecedor será cadastrado: ${fornecedorNovo.razao_social}`);
          }
        }
      }

      // Process items
      const itensProcessados: ItemCompra[] = [];
      for (const item of itensData) {
        if (!item) continue;
        const descLower = String(item.descricao || "").toLowerCase();
        const produtoExistente = produtos.find(p =>
          p.nome.toLowerCase().includes(descLower) || descLower.includes(p.nome.toLowerCase())
        );

        const quantidade = Math.round(Number(item.quantidade) || 1);
        const precoUnit = Number(item.preco_unitario) || 0;

        if (produtoExistente) {
          itensProcessados.push({
            produto_id: produtoExistente.id,
            quantidade,
            preco_unitario: precoUnit,
          });
        } else {
          itensProcessados.push({
            produto_id: `new_${Date.now()}_${Math.random()}`,
            produto_nome: item.descricao || "Produto não identificado",
            quantidade,
            preco_unitario: precoUnit,
            is_new: true,
          });
        }
      }

      // Safe value for frete
      const freteValue = Number(notaData.valor_frete) || 0;

      setForm(prev => ({
        ...prev,
        fornecedor_id: fornecedorId,
        fornecedor_novo: fornecedorNovo,
        numero_nota_fiscal: notaData.numero ? String(notaData.numero) : prev.numero_nota_fiscal,
        chave_nfe: notaData.chave_nfe ? String(notaData.chave_nfe) : prev.chave_nfe,
        data_compra: notaData.data_emissao ? String(notaData.data_emissao) : prev.data_compra,
        valor_frete: freteValue > 0 ? formatCurrency((freteValue * 100).toFixed(0)) : prev.valor_frete,
      }));

      if (itensProcessados.length > 0) {
        setItens(itensProcessados);
      }

      const newCount = itensProcessados.filter(i => i.is_new).length;
      toast.success(
        `NF lida! ${itensProcessados.length} item(ns)${newCount > 0 ? `, ${newCount} novo(s) serão cadastrados` : ""}.`
      );
    } catch (err: any) {
      console.error("Photo parse error:", err);
      toast.error("Erro ao processar foto: " + (err.message || "tente novamente"));
    } finally {
      setIsProcessingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleImportXML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("XML muito grande (máx 5MB)");
      if (xmlInputRef.current) xmlInputRef.current.value = "";
      return;
    }

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");

      const nfe = xml.querySelector("infNFe, NFe infNFe");
      if (!nfe) { toast.error("XML inválido ou não é uma NFe"); return; }

      const tt = (sel: string, root: Element = nfe as Element) =>
        (root.querySelector(sel)?.textContent || "").trim();

      // Identificação
      const chaveNfe = (nfe.getAttribute("Id") || "").replace(/^NFe/, "");
      const nNF = tt("ide nNF");
      const serie = tt("ide serie");
      const modelo = tt("ide mod");
      const natOp = tt("ide natOp");
      const dhEmi = tt("ide dhEmi") || tt("ide dEmi");
      const dataCompra = dhEmi ? dhEmi.split("T")[0] : "";

      // Anti-duplicidade
      if (chaveNfe) {
        const { data: dup } = await (supabase as any).from("compras")
          .select("id, numero_nota_fiscal").eq("chave_nfe", chaveNfe).maybeSingle();
        if (dup) {
          toast.error(`Esta NF-e já foi importada (NF ${dup.numero_nota_fiscal || "S/N"})`);
          if (xmlInputRef.current) xmlInputRef.current.value = "";
          return;
        }
      }

      // Emitente (fornecedor)
      const emit = nfe.querySelector("emit");
      const cnpjEmit = (emit?.querySelector("CNPJ")?.textContent || "").replace(/\D/g, "");
      const razaoEmit = emit?.querySelector("xNome")?.textContent?.trim() || "";
      const fantasiaEmit = emit?.querySelector("xFant")?.textContent?.trim() || "";
      const enderEmit = emit?.querySelector("enderEmit");
      const endLogradouro = [
        enderEmit?.querySelector("xLgr")?.textContent || "",
        enderEmit?.querySelector("nro")?.textContent || "",
      ].filter(Boolean).join(", ");
      const cidadeEmit = enderEmit?.querySelector("xMun")?.textContent || "";
      const ufEmit = enderEmit?.querySelector("UF")?.textContent || "";
      const foneEmit = enderEmit?.querySelector("fone")?.textContent || "";

      let fornecedorId = "";
      let fornecedorNovo: typeof form.fornecedor_novo = null;
      if (cnpjEmit) {
        const cnpjFmt = formatCNPJ(cnpjEmit);
        const existing = fornecedores.find(f => (f.cnpj || "").replace(/\D/g, "") === cnpjEmit);
        if (existing) {
          fornecedorId = existing.id;
          toast.info(`Fornecedor encontrado: ${existing.razao_social}`);
        } else {
          fornecedorNovo = {
            razao_social: razaoEmit || "Fornecedor não identificado",
            nome_fantasia: fantasiaEmit || undefined,
            cnpj: cnpjFmt,
            endereco: endLogradouro || undefined,
            cidade: cidadeEmit || undefined,
            estado: ufEmit || undefined,
            telefone: foneEmit || undefined,
          };
          toast.info(`Novo fornecedor será cadastrado: ${fornecedorNovo.razao_social}`);
        }
      }

      // Totais
      const totalNode = nfe.querySelector("total ICMSTot") as Element | null;
      const tnum = (sel: string) => totalNode ? parseFloat(totalNode.querySelector(sel)?.textContent || "0") || 0 : 0;
      const vNF = tnum("vNF");
      const vProd = tnum("vProd");
      const vFrete = tnum("vFrete");
      const vSeg = tnum("vSeg");
      const vDesc = tnum("vDesc");
      const vOutro = tnum("vOutro");
      const vICMS = tnum("vICMS");
      const vST = tnum("vST");
      const vIPI = tnum("vIPI");
      const vPIS = tnum("vPIS");
      const vCOFINS = tnum("vCOFINS");
      const vBC = tnum("vBC");
      const vBCST = tnum("vBCST");

      // Transporte
      const transp = nfe.querySelector("transp");
      const modFrete = transp?.querySelector("modFrete")?.textContent || "";
      const transpNome = transp?.querySelector("transporta xNome")?.textContent || "";
      const transpCnpj = transp?.querySelector("transporta CNPJ")?.textContent || "";
      const placa = transp?.querySelector("veicTransp placa")?.textContent || "";

      // Cobrança - 1ª duplicata como vencimento
      const dVenc = nfe.querySelector("cobr dup dVenc")?.textContent || "";

      // Itens
      const dets = Array.from(nfe.querySelectorAll("det"));
      const itensXml: ItemCompra[] = [];
      const cfops: string[] = [];

      for (const det of dets) {
        const prod = det.querySelector("prod");
        if (!prod) continue;
        const xProd = prod.querySelector("xProd")?.textContent?.trim() || "";
        const cProd = prod.querySelector("cProd")?.textContent?.trim() || "";
        const ncm = prod.querySelector("NCM")?.textContent?.trim() || "";
        const cest = prod.querySelector("CEST")?.textContent?.trim() || "";
        const cfop = prod.querySelector("CFOP")?.textContent?.trim() || "";
        const uCom = prod.querySelector("uCom")?.textContent?.trim() || "";
        const qCom = parseFloat(prod.querySelector("qCom")?.textContent || "1") || 1;
        const vUnCom = parseFloat(prod.querySelector("vUnCom")?.textContent || "0") || 0;
        const vDescItem = parseFloat(prod.querySelector("vDesc")?.textContent || "0") || 0;
        const cProdANP = prod.querySelector("comb cProdANP")?.textContent?.trim() || "";

        if (cfop) cfops.push(cfop);

        const imposto = det.querySelector("imposto");
        const icmsNode = imposto?.querySelector("ICMS > *") as Element | null;
        const cstIcms = icmsNode?.querySelector("CST")?.textContent?.trim() || "";
        const csosnIcms = icmsNode?.querySelector("CSOSN")?.textContent?.trim() || "";
        const pICMS = parseFloat(icmsNode?.querySelector("pICMS")?.textContent || "0") || 0;
        const vICMSItem = parseFloat(icmsNode?.querySelector("vICMS")?.textContent || "0") || 0;

        const pisNode = imposto?.querySelector("PIS > *") as Element | null;
        const cstPis = pisNode?.querySelector("CST")?.textContent?.trim() || "";
        const pPIS = parseFloat(pisNode?.querySelector("pPIS")?.textContent || "0") || 0;
        const vPISItem = parseFloat(pisNode?.querySelector("vPIS")?.textContent || "0") || 0;

        const cofinsNode = imposto?.querySelector("COFINS > *") as Element | null;
        const cstCofins = cofinsNode?.querySelector("CST")?.textContent?.trim() || "";
        const pCOFINS = parseFloat(cofinsNode?.querySelector("pCOFINS")?.textContent || "0") || 0;
        const vCOFINSItem = parseFloat(cofinsNode?.querySelector("vCOFINS")?.textContent || "0") || 0;

        const fiscal: ItemFiscal = {
          descricao_xml: xProd,
          codigo_produto_fornecedor: cProd || undefined,
          unidade_xml: uCom || undefined,
          ncm: ncm || undefined,
          cest: cest || undefined,
          cfop: cfop || undefined,
          codigo_anp: cProdANP || undefined,
          cst_icms: cstIcms || undefined,
          csosn_icms: csosnIcms || undefined,
          cst_pis: cstPis || undefined,
          cst_cofins: cstCofins || undefined,
          aliquota_icms: pICMS || undefined,
          aliquota_pis: pPIS || undefined,
          aliquota_cofins: pCOFINS || undefined,
          valor_icms: vICMSItem || undefined,
          valor_pis: vPISItem || undefined,
          valor_cofins: vCOFINSItem || undefined,
          valor_desconto: vDescItem || undefined,
        };

        // Match local mínimo (igual canônico). O matching forte + IA acontece depois.
        const normNome = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[\-\.]/g, " ").replace(/\s+/g, " ").trim();
        const xProdN = normNome(xProd);
        const produtoEncontrado = produtos.find(p => normNome(p.nome) === xProdN);

        itensXml.push(produtoEncontrado ? {
          produto_id: produtoEncontrado.id,
          quantidade: Math.max(1, Math.round(qCom)),
          preco_unitario: vUnCom,
          fiscal,
        } : {
          produto_id: `new_${Date.now()}_${Math.random()}`,
          produto_nome: xProd,
          quantidade: Math.max(1, Math.round(qCom)),
          preco_unitario: vUnCom,
          is_new: true,
          fiscal,
        });
      }

      // CFOP predominante
      const cfopCount: Record<string, number> = {};
      cfops.forEach(c => { cfopCount[c] = (cfopCount[c] || 0) + 1; });
      const cfopPred = Object.entries(cfopCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

      setNfFiscal({
        serie, modelo, natureza_operacao: natOp, cfop_predominante: cfopPred,
        valor_produtos: vProd, valor_desconto: vDesc, valor_seguro: vSeg, valor_outros: vOutro,
        valor_icms: vICMS, valor_icms_st: vST, valor_ipi: vIPI, valor_pis: vPIS, valor_cofins: vCOFINS,
        base_icms: vBC, base_icms_st: vBCST,
        transportadora_nome: transpNome || undefined,
        transportadora_cnpj: transpCnpj || undefined,
        placa_veiculo: placa || undefined,
        modalidade_frete: modFrete || undefined,
        xml_content: text,
      });

      setForm(prev => ({
        ...prev,
        numero_nota_fiscal: nNF || prev.numero_nota_fiscal,
        chave_nfe: chaveNfe || prev.chave_nfe,
        data_compra: dataCompra || prev.data_compra,
        data_pagamento: dVenc || prev.data_pagamento,
        valor_frete: vFrete > 0 ? formatCurrency((vFrete * 100).toFixed(0)) : prev.valor_frete,
        fornecedor_id: fornecedorId || prev.fornecedor_id,
        fornecedor_novo: fornecedorNovo || prev.fornecedor_novo,
      }));

      // Bloqueia NF de vasilhame (retorno/remessa) — não geram compra
      const vasilhameCfops = new Set(["1913","1914","2913","2914","5913","5914","6913","6914","5920","5921","6920","6921","1920","1921","2920","2921"]);
      const cfopsNorm = cfops.map(c => (c || "").replace(/\D/g, ""));
      const natLow = (natOp || "").toLowerCase();
      const isVasilhame = cfopsNorm.some(cf => vasilhameCfops.has(cf))
        || /vasilhame|botij[ãa]o vazio|comodato/i.test(natLow)
        || (/retorno|remessa/i.test(natLow) && !/venda|compra/i.test(natLow));
      if (isVasilhame) {
        toast.error("NF de vasilhame (retorno/remessa) ignorada — não é uma compra de mercadoria.");
        if (xmlInputRef.current) xmlInputRef.current.value = "";
        return;
      }

      // --- Match forte + IA para itens não-mapeados ---
      const finalizarImport = (lista: ItemCompra[]) => {
        if (lista.length > 0) setItens(lista);
        const novos = lista.filter(i => i.is_new).length;
        toast.success(
          `NF ${nNF || "S/N"} importada · ${lista.length} item(ns)${novos > 0 ? ` (${novos} novo(s))` : ""} · R$ ${vNF.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        );
      };

      const unmatched = itensXml.filter(i => i.is_new);
      if (unmatched.length === 0 || !unidadeAtual?.id) {
        finalizarImport(itensXml);
      } else {
        // Carrega produtos completos da unidade p/ matching forte
        const { data: produtosFull } = await supabase
          .from("produtos")
          .select("id, nome, ncm, codigo_anp, categoria")
          .eq("unidade_id", unidadeAtual.id)
          .eq("ativo", true);

        const normNome2 = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[\-\.]/g, " ").replace(/\bp\s*(13|20|45)\b/g, "p$1").replace(/\s+/g, " ").trim();
        const trySubtipo = (s: string): string | null => {
          const n = normNome2(s);
          if (/\bp13\b|13\s*kg|glp\s*13|botij[ao]\s*13/.test(n)) return "p13";
          if (/\bp20\b|20\s*kg|glp\s*20/.test(n)) return "p20";
          if (/\bp45\b|45\s*kg|glp\s*45/.test(n)) return "p45";
          if (/agua|gal[ao]o\s*20\s*l|20\s*litros/.test(n)) return "agua";
          return null;
        };

        // 1) Match forte local
        const stillUnmatched: ItemCompra[] = [];
        for (const it of unmatched) {
          const f = it.fiscal || {};
          const xProd = it.produto_nome || f.descricao_xml || "";
          const xN = normNome2(xProd);
          const sub = trySubtipo(xProd);
          let found: any = null;
          // (sem coluna codigo_produto_fornecedor em produtos — pulado)
          // por código ANP
          if (!found && f.codigo_anp) {
            found = produtosFull?.find(p => (p.codigo_anp || "").trim() === f.codigo_anp!.trim());
          }
          // por nome normalizado igual
          if (!found) {
            found = produtosFull?.find(p => normNome2(p.nome) === xN);
          }
          // por subtipo (P13/P20/P45/agua) quando inequívoco
          if (!found && sub) {
            const candidatos = (produtosFull || []).filter(p => trySubtipo(p.nome) === sub);
            if (candidatos.length === 1) found = candidatos[0];
          }
          // por NCM + similaridade alta de tokens
          if (!found && f.ncm) {
            const mesmoNcm = (produtosFull || []).filter(p => (p.ncm || "") === f.ncm);
            const xTokens = new Set(xN.split(" ").filter(t => t.length > 2));
            let best: { p: any; score: number } | null = null;
            for (const p of mesmoNcm) {
              const pTokens = new Set(normNome2(p.nome).split(" ").filter(t => t.length > 2));
              const inter = [...xTokens].filter(t => pTokens.has(t)).length;
              const score = inter / Math.max(1, Math.min(xTokens.size, pTokens.size));
              if (score >= 0.7 && (!best || score > best.score)) best = { p, score };
            }
            if (best) found = best.p;
          }

          if (found) {
            const idx = itensXml.indexOf(it);
            itensXml[idx] = { ...it, produto_id: found.id, produto_nome: undefined, is_new: false };
          } else {
            stillUnmatched.push(it);
          }
        }

        // 2) IA para os duvidosos
        let aiMotivoByKey: Record<string, string> = {};
        if (stillUnmatched.length > 0) {
          try {
            const xmlItemsPayload = stillUnmatched.map((it, idx) => ({
              index: idx,
              xProd: it.produto_nome || it.fiscal?.descricao_xml || "",
              cProd: it.fiscal?.codigo_produto_fornecedor,
              ncm: it.fiscal?.ncm,
              cProdANP: it.fiscal?.codigo_anp,
              uCom: it.fiscal?.unidade_xml,
            }));
            const produtosPayload = (produtosFull || []).slice(0, 200).map(p => ({
              id: p.id, nome: p.nome, ncm: p.ncm, codigo_anp: p.codigo_anp,
            }));
            const { data: aiResp } = await supabase.functions.invoke("match-produtos-xml", {
              body: { xml_items: xmlItemsPayload, produtos: produtosPayload },
            });
            const matches: Array<{ index: number; match_produto_id: string | null; confianca: number; motivo: string }> =
              aiResp?.matches || [];
            const aindaSemMatch: ItemCompra[] = [];
            stillUnmatched.forEach((it, idx) => {
              const m = matches.find(x => x.index === idx);
              if (m && m.match_produto_id && m.confianca >= 0.85
                  && (produtosFull || []).some(p => p.id === m.match_produto_id)) {
                const i2 = itensXml.indexOf(it);
                itensXml[i2] = { ...it, produto_id: m.match_produto_id, produto_nome: undefined, is_new: false };
              } else {
                if (m?.motivo) aiMotivoByKey[it.produto_id] = m.motivo;
                aindaSemMatch.push(it);
              }
            });
            stillUnmatched.length = 0;
            stillUnmatched.push(...aindaSemMatch);
          } catch (e) {
            console.warn("match-produtos-xml falhou, seguindo sem IA:", e);
          }
        }

        // 3) Se ainda sobrou, abre o diálogo
        if (stillUnmatched.length === 0) {
          finalizarImport(itensXml);
        } else {
          const candidatos: NovoProdutoCandidato[] = stillUnmatched.map(it => {
            const xProd = it.produto_nome || it.fiscal?.descricao_xml || "";
            const n = normNome2(xProd);
            const categoria: "gas" | "agua" | "outros" =
              /gas|glp|p13|p20|p45|botij/.test(n) ? "gas"
              : /agua|gal[ao]o/.test(n) ? "agua" : "outros";
            return {
              key: it.produto_id,
              xProd,
              ncm: it.fiscal?.ncm,
              unidade: it.fiscal?.unidade_xml,
              preco_unitario: it.preco_unitario,
              categoria_sugerida: categoria,
              ai_motivo: aiMotivoByKey[it.produto_id],
            };
          });
          pendingItensRef.current = itensXml;
          pendingMetaRef.current = { nNF, vNF };
          setNovosCandidatos(candidatos);
          setNovosProdDialogOpen(true);
        }
      }
    } catch (err: any) {
      console.error("XML parse error:", err);
      toast.error("Erro ao processar o XML: " + (err?.message || "formato inválido"));
    }

    if (xmlInputRef.current) xmlInputRef.current.value = "";
  };

  const updateStatus = async (id: string, status: string) => {
    const updateData: Record<string, unknown> = { status };
    if (status === "recebido") {
      updateData.data_recebimento = new Date().toISOString();
    }
    const { error } = await supabase.from("compras").update(updateData as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Status atualizado!");
    fetchCompras();
  };

  // Dashboard calculations
  const now = getBrasiliaDate();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();

  const comprasMesAtual = compras.filter(c => {
    const d = new Date(c.data_compra || c.created_at);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const comprasMesAnterior = compras.filter(c => {
    const d = new Date(c.data_compra || c.created_at);
    const mesAnt = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnt = mesAtual === 0 ? anoAtual - 1 : anoAtual;
    return d.getMonth() === mesAnt && d.getFullYear() === anoAnt;
  });

  const totalMesAtual = comprasMesAtual.reduce((a, c) => a + (Number(c.valor_total) || 0), 0);
  const totalMesAnterior = comprasMesAnterior.reduce((a, c) => a + (Number(c.valor_total) || 0), 0);
  const variacaoMes = totalMesAnterior > 0 ? ((totalMesAtual - totalMesAnterior) / totalMesAnterior * 100) : 0;

  const totalFreteMes = comprasMesAtual.reduce((a, c) => a + (Number(c.valor_frete) || 0), 0);
  const percentualFrete = totalMesAtual > 0 ? (totalFreteMes / totalMesAtual * 100) : 0;

  const comprasPendentes = compras.filter(c => c.status === "pendente" || c.status === "em_transito");
  const valorPendente = comprasPendentes.reduce((a, c) => a + (Number(c.valor_total) || 0), 0);

  const ticketMedio = comprasMesAtual.length > 0 ? totalMesAtual / comprasMesAtual.length : 0;

  // Top suppliers
  const fornecedorTotals: Record<string, { nome: string; total: number; count: number }> = {};
  compras.forEach(c => {
    const nome = c.fornecedores?.razao_social || "Desconhecido";
    if (!fornecedorTotals[nome]) fornecedorTotals[nome] = { nome, total: 0, count: 0 };
    fornecedorTotals[nome].total += Number(c.valor_total) || 0;
    fornecedorTotals[nome].count += 1;
  });
  const topFornecedores = Object.values(fornecedorTotals).sort((a, b) => b.total - a.total).slice(0, 5);

  const statusLabel = (s: string) => {
    if (s === "recebido") return "Recebido";
    if (s === "em_transito") return "Em Trânsito";
    if (s === "cancelado") return "Cancelado";
    return "Pendente";
  };

  const statusVariant = (s: string) => {
    if (s === "recebido") return "default" as const;
    if (s === "em_transito") return "secondary" as const;
    if (s === "cancelado") return "destructive" as const;
    return "outline" as const;
  };

  const getProdutoNome = (id: string) => produtos.find(p => p.id === id)?.nome || "Produto";

  const handleQuickFornSave = async () => {
    if (!quickFornForm.razao_social.trim()) { toast.error("Razão Social é obrigatória"); return; }
    const { data, error } = await supabase.from("fornecedores").insert({
      razao_social: quickFornForm.razao_social,
      nome_fantasia: quickFornForm.nome_fantasia || null,
      cnpj: quickFornForm.cnpj || null,
      tipo: quickFornForm.tipo || null,
      telefone: quickFornForm.telefone || null,
      email: quickFornForm.email || null,
      cidade: quickFornForm.cidade || null,
      empresa_id: empresa?.id,
      ativo: true,
    }).select("id").single();
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Fornecedor cadastrado!");
    setQuickFornOpen(false);
    setQuickFornForm({ razao_social: "", nome_fantasia: "", cnpj: "", tipo: "gas", telefone: "", email: "", cidade: "" });
    await fetchFornecedores();
    if (data) setForm(prev => ({ ...prev, fornecedor_id: data.id }));
  };

  const handleConfirmNovosProdutos = async (decisoes: Record<string, DecisaoItem>) => {
    if (!unidadeAtual?.id) { toast.error("Selecione uma unidade"); return; }
    const lista = [...pendingItensRef.current];

    // Para cada item pendente, aplicar decisão
    for (let i = lista.length - 1; i >= 0; i--) {
      const it = lista[i];
      if (!it.is_new) continue;
      const dec = decisoes[it.produto_id];
      if (!dec || dec.tipo === "pular") {
        lista.splice(i, 1);
        continue;
      }
      if (dec.tipo === "vincular") {
        if (!dec.produto_id) { lista.splice(i, 1); continue; }
        lista[i] = { ...it, produto_id: dec.produto_id, produto_nome: undefined, is_new: false };
        continue;
      }
      // criar produto com dados fiscais completos do XML
      const f = it.fiscal || {};
      const xProd = it.produto_nome || f.descricao_xml || "Produto";
      const n = xProd.toLowerCase();
      const isMono = (f.cst_pis === "04" || f.cst_cofins === "04" || (f.codigo_anp || "").startsWith("21"));
      const isGas = /g[áa]s|glp|p[\s\-]?13|p[\s\-]?20|p[\s\-]?45|botij/i.test(n);
      const isAgua = /[aá]gua|gal[ãa]o/i.test(n);
      const categoria = isGas ? "gas" : isAgua ? "agua" : null;
      const payload: any = {
        nome: xProd, preco: it.preco_unitario, ativo: true, unidade_id: unidadeAtual.id,
        categoria,
        ncm: f.ncm || null, cest: f.cest || null,
        cfop_entrada_padrao: f.cfop || null, codigo_anp: f.codigo_anp || null,
        cst_icms: f.cst_icms || null, csosn_icms: f.csosn_icms || null,
        cst_pis: f.cst_pis || null, cst_cofins: f.cst_cofins || null,
        aliquota_pis: f.aliquota_pis || null, aliquota_cofins: f.aliquota_cofins || null,
        unidade_tributavel: f.unidade_xml || null,
        monofasico: isMono,
      };
      let { data: novo, error } = await supabase.from("produtos").insert(payload).select("id").single();
      if (error) {
        // fallback minimal
        const min = { nome: xProd, preco: it.preco_unitario, ativo: true, unidade_id: unidadeAtual.id, categoria };
        const r2 = await supabase.from("produtos").insert(min).select("id").single();
        if (r2.error) { toast.error(`Falha ao cadastrar "${xProd}": ${r2.error.message}`); lista.splice(i, 1); continue; }
        novo = r2.data;
      }
      lista[i] = { ...it, produto_id: novo!.id, produto_nome: undefined, is_new: false };
    }

    setItens(lista);
    setNovosProdDialogOpen(false);
    setNovosCandidatos([]);
    pendingItensRef.current = [];
    await fetchProdutos();

    const meta = pendingMetaRef.current;
    pendingMetaRef.current = null;
    toast.success(
      `NF ${meta?.nNF || "S/N"} importada · ${lista.length} item(ns) · R$ ${(meta?.vNF ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    );
  };

  const handleCancelNovosProdutos = () => {
    setNovosProdDialogOpen(false);
    setNovosCandidatos([]);
    pendingItensRef.current = [];
    pendingMetaRef.current = null;
    setNfFiscal(null);
    toast.info("Importação cancelada.");
  };


  return (
    <MainLayout>
      <Header title="Compras" subtitle="Gestão de compras e pedidos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <EstoquePageHeader
          title="Compras e notas fiscais"
          description="Registre notas, importe XML e acompanhe o gasto por fornecedor"
          actions={
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <OutlookImportButton
                onImported={() => { fetchCompras(); fetchProdutos(); fetchFornecedores(); }}
              />
              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto h-11">
                    <Plus className="h-4 w-4 mr-2" />Nova Compra
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registrar Nova Compra</DialogTitle>
                <DialogDescription>Preencha os dados, importe XML ou tire foto da nota fiscal</DialogDescription>
              </DialogHeader>

              {/* Import buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <input ref={xmlInputRef} type="file" accept=".xml" className="hidden" onChange={handleImportXML} />
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                <Button variant="import" className="h-11 w-full gap-2" onClick={() => xmlInputRef.current?.click()} disabled={isProcessingPhoto}>
                  <Upload className="h-4 w-4" />Importar XML
                </Button>
                <Button variant="photo" className="h-11 w-full gap-2" onClick={() => photoInputRef.current?.click()} disabled={isProcessingPhoto}>
                  {isProcessingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {isProcessingPhoto ? "Lendo NF..." : "Foto da NF"}
                </Button>
              </div>

              {/* Supplier info */}
              {form.fornecedor_novo && !form.fornecedor_id && (
                <div className="bg-accent/50 border border-accent rounded-lg p-3 space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Novo fornecedor será cadastrado:
                  </p>
                  <p className="text-sm">{form.fornecedor_novo.razao_social}</p>
                  {form.fornecedor_novo.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {form.fornecedor_novo.cnpj}</p>}
                  <Button variant="ghost" size="sm" className="text-xs h-6 mt-1" onClick={() => setForm(prev => ({ ...prev, fornecedor_novo: null }))}>
                    Cancelar (selecionar existente)
                  </Button>
                </div>
              )}

              <div className="space-y-4 pt-2">
                {/* Fornecedor e NF */}
                {!form.fornecedor_novo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label>Fornecedor *</Label>
                      <div className="flex gap-2">
                        <Select value={form.fornecedor_id} onValueChange={v => setForm({ ...form, fornecedor_id: v })}>
                          <SelectTrigger className="flex-1 h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {fornecedores.map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" className="shrink-0 h-11 w-11" onClick={() => setQuickFornOpen(true)} title="Cadastrar fornecedor">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Nº Nota Fiscal</Label>
                      <Input value={form.numero_nota_fiscal} onChange={e => setForm({ ...form, numero_nota_fiscal: e.target.value })} placeholder="000000" />
                    </div>
                  </div>
                )}

                {form.fornecedor_novo && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Nº Nota Fiscal</Label>
                      <Input value={form.numero_nota_fiscal} onChange={e => setForm({ ...form, numero_nota_fiscal: e.target.value })} placeholder="000000" />
                    </div>
                  </div>
                )}

                {/* Chave NFe */}
                <div>
                  <Label>Chave da NFe (44 dígitos)</Label>
                  <Input
                    value={form.chave_nfe}
                    onChange={e => setForm({ ...form, chave_nfe: e.target.value.replace(/\D/g, "").slice(0, 44) })}
                    placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                    maxLength={44}
                  />
                </div>

                {/* Data da compra */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Data da Compra</Label>
                    <Input type="date" value={form.data_compra} onChange={e => setForm({ ...form, data_compra: e.target.value })} />
                  </div>
                  <div>
                    <Label>{pagamento.situacao === "aprazo" ? "Vencimento" : "Data do Pagamento"}</Label>
                    <Input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} />
                  </div>
                </div>

                {/* Itens */}
                <div className="border rounded-xl p-3 sm:p-4 space-y-3 bg-card/50">
                  <h3 className="font-semibold text-sm">Itens da Compra</h3>

                  {itens.length > 0 && (
                    <div className="overflow-x-auto -mx-3 px-3 sm:-mx-4 sm:px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[140px]">Produto</TableHead>
                            <TableHead className="w-20 text-center">Qtd</TableHead>
                            <TableHead className="w-28 text-right">Preço Un.</TableHead>
                            <TableHead className="w-28 text-right">Subtotal</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itens.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm">
                                {item.is_new ? (
                                  <span className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-xs mr-1">Novo</Badge>
                                    {item.produto_nome}
                                  </span>
                                ) : (
                                  getProdutoNome(item.produto_id)
                                )}
                              </TableCell>
                              <TableCell className="text-center">{item.quantidade}</TableCell>
                              <TableCell className="text-right">R$ {item.preco_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">R$ {(item.preco_unitario * item.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => removerItem(idx)} className="text-destructive h-8 w-8 p-0">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="grid gap-2 items-end grid-cols-1 sm:grid-cols-[1fr_80px_120px_48px]">
                    <div>
                      <Label className="text-xs">Produto</Label>
                      <Select value={novoItem.produto_id} onValueChange={v => {
                        const prod = produtos.find(p => p.id === v);
                        setNovoItem({ ...novoItem, produto_id: v, preco_unitario: prod ? formatCurrency((prod.preco * 100).toFixed(0)) : novoItem.preco_unitario });
                      }}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                        <SelectContent>
                          {produtos.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nome} - R$ {Number(p.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:contents">
                      <div>
                        <Label className="text-xs">Qtd</Label>
                        <Input type="number" min="1" value={novoItem.quantidade} onChange={e => setNovoItem({ ...novoItem, quantidade: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Preço Unit.</Label>
                        <Input
                          value={novoItem.preco_unitario}
                          onChange={e => setNovoItem({ ...novoItem, preco_unitario: formatCurrency(e.target.value) })}
                          placeholder="0,00"
                        />
                      </div>
                      <Button type="button" size="icon" onClick={adicionarItem} className="h-11 w-full sm:w-11">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Frete e Total */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Valor Frete</Label>
                    <Input
                      value={form.valor_frete}
                      onChange={e => setForm({ ...form, valor_frete: formatCurrency(e.target.value) })}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Subtotal Itens</Label>
                    <Input disabled value={`R$ ${subtotalItens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </div>
                  <div>
                    <Label className="font-bold">Total da Compra</Label>
                    <Input disabled value={`R$ ${totalCompra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} className="font-bold" />
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações adicionais..." rows={2} />
                </div>

                {/* Pagamento */}
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Pagamento
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={pagamento.situacao === "avista" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPagamento({ ...pagamento, situacao: "avista" })}
                    >
                      À vista
                    </Button>
                    <Button
                      type="button"
                      variant={pagamento.situacao === "aprazo" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPagamento({ ...pagamento, situacao: "aprazo", forma: "a_prazo" })}
                    >
                      A prazo
                    </Button>
                  </div>

                  {pagamento.situacao === "avista" && (
                    <>
                      <div>
                        <Label className="text-xs">Forma de pagamento</Label>
                        <Select
                          value={pagamento.forma}
                          onValueChange={(v: FormaPagamentoCompra) =>
                            setPagamento({ ...pagamento, forma: v, conta_bancaria_id: "" })
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dinheiro">💵 Dinheiro (caixa da loja)</SelectItem>
                            <SelectItem value="pix">⚡ PIX</SelectItem>
                            <SelectItem value="ted">🏦 TED / Transferência</SelectItem>
                            <SelectItem value="debito">💳 Cartão de Débito</SelectItem>
                            <SelectItem value="credito">💳 Cartão de Crédito</SelectItem>
                            <SelectItem value="boleto">📄 Boleto pago</SelectItem>
                            <SelectItem value="cheque">📝 Cheque</SelectItem>
                            <SelectItem value="vale_central_gas">🎟️ Vale Central Gás</SelectItem>
                            <SelectItem value="vale_ultragaz">🎟️ Vale Ultragaz</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {pagamento.forma === "dinheiro" && (
                        <div className="text-xs bg-warning/10 border border-warning/30 rounded p-2 text-warning dark:text-warning">
                          A saída será lançada no caixa da loja ({unidadeAtual?.nome || "unidade atual"}) e reduzirá o saldo em caixa.
                        </div>
                      )}

                      {["pix", "ted", "debito", "boleto", "credito", "cheque", "vale_central_gas", "vale_ultragaz"].includes(pagamento.forma) && (
                        <div>
                          <Label className="text-xs">
                            {pagamento.forma === "credito"
                              ? "Cartão / conta da fatura"
                              : pagamento.forma === "cheque"
                              ? "Conta bancária (opcional)"
                              : pagamento.forma === "vale_central_gas" || pagamento.forma === "vale_ultragaz"
                              ? "Conta do vale (ex.: Vale Gás)"
                              : "Conta bancária de origem"}
                          </Label>
                          <Select
                            value={pagamento.conta_bancaria_id || "nenhum"}
                            onValueChange={(v) => setPagamento({ ...pagamento, conta_bancaria_id: v === "nenhum" ? "" : v })}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                            <SelectContent>
                              {pagamento.forma === "cheque" && <SelectItem value="nenhum">— Sem vínculo bancário —</SelectItem>}
                              {contasBancarias.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.banco || c.nome} · {c.nome}
                                  {c.saldo_atual != null && ` · saldo R$ ${Number(c.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {contasBancarias.length === 0 && (
                            <p className="text-xs text-destructive mt-1">
                              Nenhuma conta bancária ativa nesta unidade. Cadastre em Financeiro › Contas Bancárias.
                            </p>
                          )}
                        </div>
                      )}

                      {pagamento.forma === "credito" && (
                        <div>
                          <Label className="text-xs">Parcelas</Label>
                          <Input
                            type="number"
                            min={1}
                            max={24}
                            value={pagamento.parcelas}
                            onChange={(e) => setPagamento({ ...pagamento, parcelas: Math.max(1, Number(e.target.value) || 1) })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Serão criadas {pagamento.parcelas}x contas a pagar mensais.
                          </p>
                        </div>
                      )}

                      {pagamento.forma === "cheque" && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Nº cheque</Label>
                            <Input value={pagamento.numero_cheque} onChange={(e) => setPagamento({ ...pagamento, numero_cheque: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-xs">Banco</Label>
                            <Input value={pagamento.banco_cheque} onChange={(e) => setPagamento({ ...pagamento, banco_cheque: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-xs">Bom para</Label>
                            <Input type="date" value={pagamento.bom_para} onChange={(e) => setPagamento({ ...pagamento, bom_para: e.target.value })} />
                          </div>
                        </div>
                      )}

                      {/* Formas de pagamento extras (split) */}
                      {pagamentosExtras.length > 0 && (() => {
                        const somaExtras = pagamentosExtras.reduce((a, r) => a + parseCurrency(r.valor), 0);
                        const valorPrimaria = Math.max(0, +(totalCompra - somaExtras).toFixed(2));
                        return (
                          <div className="rounded-md border border-dashed border-border/70 bg-background/60 p-2 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <span>Valor desta forma (parte 1)</span>
                              <span className="font-semibold text-foreground">
                                R$ {valorPrimaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {pagamentosExtras.map((row, idx) => (
                        <div key={row.id} className="rounded-lg border border-border bg-background p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground">Forma adicional #{idx + 2}</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-destructive"
                              onClick={() => setPagamentosExtras(pagamentosExtras.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Forma</Label>
                              <Select
                                value={row.forma}
                                onValueChange={(v: FormaPagamentoCompra) =>
                                  setPagamentosExtras(pagamentosExtras.map((r, i) => i === idx ? { ...r, forma: v, conta_bancaria_id: "" } : r))
                                }
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                                  <SelectItem value="pix">⚡ PIX</SelectItem>
                                  <SelectItem value="ted">🏦 TED</SelectItem>
                                  <SelectItem value="debito">💳 Débito</SelectItem>
                                  <SelectItem value="credito">💳 Crédito</SelectItem>
                                  <SelectItem value="boleto">📄 Boleto</SelectItem>
                                  <SelectItem value="cheque">📝 Cheque</SelectItem>
                                  <SelectItem value="vale_central_gas">🎟️ Vale Central Gás</SelectItem>
                                  <SelectItem value="vale_ultragaz">🎟️ Vale Ultragaz</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Valor</Label>
                              <Input
                                value={row.valor}
                                onChange={(e) => setPagamentosExtras(pagamentosExtras.map((r, i) => i === idx ? { ...r, valor: formatCurrency(e.target.value) } : r))}
                                placeholder="0,00"
                                inputMode="decimal"
                              />
                            </div>
                          </div>

                          {["pix", "ted", "debito", "boleto", "credito", "cheque", "vale_central_gas", "vale_ultragaz"].includes(row.forma) && (
                            <div>
                              <Label className="text-xs">Conta</Label>
                              <Select
                                value={row.conta_bancaria_id || "nenhum"}
                                onValueChange={(v) => setPagamentosExtras(pagamentosExtras.map((r, i) => i === idx ? { ...r, conta_bancaria_id: v === "nenhum" ? "" : v } : r))}
                              >
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  {row.forma === "cheque" && <SelectItem value="nenhum">— Sem vínculo bancário —</SelectItem>}
                                  {contasBancarias.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.banco || c.nome} · {c.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {row.forma === "cheque" && (
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Nº cheque</Label>
                                <Input value={row.numero_cheque} onChange={(e) => setPagamentosExtras(pagamentosExtras.map((r, i) => i === idx ? { ...r, numero_cheque: e.target.value } : r))} />
                              </div>
                              <div>
                                <Label className="text-xs">Banco</Label>
                                <Input value={row.banco_cheque} onChange={(e) => setPagamentosExtras(pagamentosExtras.map((r, i) => i === idx ? { ...r, banco_cheque: e.target.value } : r))} />
                              </div>
                              <div>
                                <Label className="text-xs">Bom para</Label>
                                <Input type="date" value={row.bom_para} onChange={(e) => setPagamentosExtras(pagamentosExtras.map((r, i) => i === idx ? { ...r, bom_para: e.target.value } : r))} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          setPagamentosExtras([
                            ...pagamentosExtras,
                            { id: crypto.randomUUID(), forma: "pix", conta_bancaria_id: "", valor: "", numero_cheque: "", banco_cheque: "", bom_para: "" },
                          ])
                        }
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar forma de pagamento
                      </Button>

                      {pagamentosExtras.length > 0 && (() => {
                        const somaExtras = pagamentosExtras.reduce((a, r) => a + parseCurrency(r.valor), 0);
                        const valorPrimaria = Math.max(0, +(totalCompra - somaExtras).toFixed(2));
                        const total = valorPrimaria + somaExtras;
                        const diff = +(totalCompra - total).toFixed(2);
                        return (
                          <div className={`rounded-md p-2 text-xs ${Math.abs(diff) < 0.01 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                            Total pago: R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R$ {totalCompra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            {Math.abs(diff) >= 0.01 && ` · falta R$ ${Math.abs(diff).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {pagamento.situacao === "aprazo" && (
                    <div className="text-xs bg-muted p-2 rounded">
                      Uma conta a pagar será criada com vencimento em{" "}
                      <strong>{form.data_pagamento ? new Date(form.data_pagamento + "T12:00:00").toLocaleDateString("pt-BR") : "— informe a data acima"}</strong>.
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
                  <Button onClick={handleSave}>Registrar Compra</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
            </div>
          }
        />



        {/* KPI Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <EstoqueKpiCard
            icon={DollarSign}
            label="Compras no Mês"
            value={`R$ ${(totalMesAtual / 1000).toFixed(1)}k`}
            tone="primary"
            hint={`${variacaoMes >= 0 ? "+" : ""}${variacaoMes.toFixed(1)}% vs mês anterior`}
          />
          <EstoqueKpiCard
            icon={BarChart3}
            label="Ticket Médio"
            value={`R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            tone="info"
            hint={`${comprasMesAtual.length} compras no mês`}
          />
          <EstoqueKpiCard
            icon={Truck}
            label="Frete no Mês"
            value={`R$ ${totalFreteMes.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            tone="warning"
            hint={`${percentualFrete.toFixed(1)}% do total`}
          />
          <EstoqueKpiCard
            icon={CalendarDays}
            label="Pendentes/Trânsito"
            value={comprasPendentes.length}
            tone={comprasPendentes.length > 0 ? "destructive" : "secondary"}
            hint={`R$ ${valorPendente.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          />
        </div>


        {/* Top Suppliers */}
        {topFornecedores.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top Fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topFornecedores.map((f, idx) => {
                  const percent = totalMesAtual > 0 ? (f.total / compras.reduce((a, c) => a + (Number(c.valor_total) || 0), 0)) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground w-5">{idx + 1}.</span>
                        <span className="truncate">{f.nome}</span>
                        <span className="text-xs text-muted-foreground">({f.count}x)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} />
                        </div>
                        <span className="font-medium w-24 text-right">R$ {f.total.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchases table — visual igual ao Histórico do Transportador */}
        {loading ? (
          <Card><CardContent className="p-6"><p className="text-muted-foreground">Carregando...</p></CardContent></Card>
        ) : (
          <ComprasListaTableEstoque
            compras={compras}
            unidadesMap={unidadeAtual?.id ? new Map([[unidadeAtual.id, unidadeAtual.nome || ""]]) : undefined}
            onChanged={fetchCompras}
            onDelete={(id) => setDeleteId(id)}
          />
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Compra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta compra? Todos os itens vinculados serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCompra} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add Fornecedor Modal */}
      <Dialog open={quickFornOpen} onOpenChange={setQuickFornOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar Fornecedor</DialogTitle>
            <DialogDescription>Preencha os dados do fornecedor</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-2">
              <Label>Razão Social *</Label>
              <Input value={quickFornForm.razao_social} onChange={e => setQuickFornForm({ ...quickFornForm, razao_social: e.target.value })} placeholder="Nome da empresa" />
            </div>
            <div className="space-y-2">
              <Label>Nome Fantasia</Label>
              <Input value={quickFornForm.nome_fantasia} onChange={e => setQuickFornForm({ ...quickFornForm, nome_fantasia: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={quickFornForm.cnpj} onChange={e => setQuickFornForm({ ...quickFornForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input value={quickFornForm.tipo} onChange={e => setQuickFornForm({ ...quickFornForm, tipo: e.target.value })} placeholder="Gás, Água..." />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={quickFornForm.telefone} onChange={e => setQuickFornForm({ ...quickFornForm, telefone: e.target.value })} placeholder="(00) 0000-0000" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={quickFornForm.email} onChange={e => setQuickFornForm({ ...quickFornForm, email: e.target.value })} type="email" />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={quickFornForm.cidade} onChange={e => setQuickFornForm({ ...quickFornForm, cidade: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setQuickFornOpen(false)}>Cancelar</Button>
            <Button onClick={handleQuickFornSave}>Salvar Fornecedor</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmarNovosProdutosDialog
        open={novosProdDialogOpen}
        onOpenChange={(v) => { if (!v) handleCancelNovosProdutos(); }}
        candidatos={novosCandidatos}
        produtosExistentes={produtos}
        onConfirmar={handleConfirmNovosProdutos}
        onCancelar={handleCancelNovosProdutos}
      />
    </MainLayout>
  );
}
