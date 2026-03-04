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
  Camera, Loader2, TrendingUp, TrendingDown, BarChart3, CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { formatCurrency, parseCurrency, formatCNPJ } from "@/hooks/useInputMasks";
import { atualizarEstoqueCompra } from "@/services/estoqueService";

interface Compra {
  id: string;
  valor_total: number;
  valor_frete: number | null;
  status: string;
  data_prevista: string | null;
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

interface ItemCompra {
  produto_id: string;
  produto_nome?: string;
  quantidade: number;
  preco_unitario: number;
  is_new?: boolean;
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
    data_prevista: "",
    data_pagamento: "",
    valor_frete: "",
    observacoes: "",
  });

  const [itens, setItens] = useState<ItemCompra[]>([]);
  const [novoItem, setNovoItem] = useState({ produto_id: "", quantidade: "1", preco_unitario: "" });

  const fetchCompras = async () => {
    let query = supabase
      .from("compras")
      .select("*, fornecedores(razao_social)")
      .order("created_at", { ascending: false });

    if (unidadeAtual?.id) {
      query = query.eq("unidade_id", unidadeAtual.id);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return; }
    setCompras(data || []);
    setLoading(false);
  };

  const fetchFornecedores = async () => {
    const { data } = await supabase.from("fornecedores").select("id, razao_social, cnpj").eq("ativo", true).order("razao_social");
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

  useEffect(() => {
    fetchFornecedores();
  }, []);

  useEffect(() => {
    fetchCompras();
    fetchProdutos();
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
      data_prevista: "", data_pagamento: "", valor_frete: "", observacoes: "",
    });
    setItens([]);
    setNovoItem({ produto_id: "", quantidade: "1", preco_unitario: "" });
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
    }

    // Create new products if needed
    const resolvedItens: { produto_id: string; quantidade: number; preco_unitario: number }[] = [];
    for (const item of itens) {
      let prodId = item.produto_id;
      if (item.is_new && item.produto_nome) {
        const { data: newProd, error: prodError } = await supabase.from("produtos").insert({
          nome: item.produto_nome,
          preco: item.preco_unitario,
          ativo: true,
          unidade_id: unidadeAtual?.id || null,
        }).select("id").single();

        if (prodError) { toast.error("Erro ao cadastrar produto: " + prodError.message); return; }
        prodId = newProd.id;
        toast.success(`Produto "${item.produto_nome}" cadastrado!`);
      }
      resolvedItens.push({ produto_id: prodId, quantidade: item.quantidade, preco_unitario: item.preco_unitario });
    }

    const { data: compra, error } = await supabase.from("compras").insert({
      fornecedor_id: fornecedorId,
      unidade_id: unidadeAtual?.id || null,
      valor_total: totalCompra,
      valor_frete: valorFrete || 0,
      numero_nota_fiscal: form.numero_nota_fiscal || null,
      chave_nfe: form.chave_nfe || null,
      data_compra: form.data_compra || null,
      data_prevista: form.data_prevista || null,
      data_pagamento: form.data_pagamento || null,
      observacoes: form.observacoes || null,
      status: "pendente",
    }).select("id").single();

    if (error) { toast.error("Erro: " + error.message); return; }

    if (compra) {
      const itensData = resolvedItens.map(i => ({
        compra_id: compra.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      }));
      const { error: itensError } = await supabase.from("compra_itens").insert(itensData);
      if (itensError) { toast.error("Erro nos itens: " + itensError.message); }

      // Atualizar estoque dos produtos comprados
      await atualizarEstoqueCompra(
        resolvedItens.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
        unidadeAtual?.id
      );
    }

    // Criar conta a pagar se tem data de pagamento
    if (form.data_pagamento && compra) {
      const fornecedor = fornecedores.find(f => f.id === fornecedorId);
      await supabase.from("contas_pagar").insert({
        descricao: `Compra NF ${form.numero_nota_fiscal || "S/N"} - ${fornecedor?.razao_social || form.fornecedor_novo?.razao_social || ""}`,
        fornecedor: fornecedor?.razao_social || form.fornecedor_novo?.razao_social || "",
        valor: totalCompra,
        vencimento: form.data_pagamento,
        categoria: "compras",
        unidade_id: unidadeAtual?.id || null,
        status: "pendente",
      });
    }

    toast.success("Compra registrada!");
    setOpen(false);
    resetForm();
    fetchCompras();
    fetchFornecedores();
    fetchProdutos();
  };

  const handleDeleteCompra = async () => {
    if (!deleteId) return;

    // Delete items first then the purchase
    const { error: itensErr } = await supabase.from("compra_itens").delete().eq("compra_id", deleteId);
    if (itensErr) { toast.error("Erro ao excluir itens: " + itensErr.message); return; }

    const { error } = await supabase.from("compras").delete().eq("id", deleteId);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }

    toast.success("Compra excluída!");
    setDeleteId(null);
    fetchCompras();
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

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");

      const nfe = xml.querySelector("infNFe, NFe infNFe");
      if (!nfe) { toast.error("XML inválido ou não é uma NFe"); return; }

      const chaveNfe = nfe.getAttribute("Id")?.replace("NFe", "") || "";
      const nNF = nfe.querySelector("ide nNF")?.textContent || "";
      const dhEmi = nfe.querySelector("ide dhEmi")?.textContent || "";
      const dataCompra = dhEmi ? dhEmi.split("T")[0] : "";
      const vNF = nfe.querySelector("total ICMSTot vNF")?.textContent || "0";
      const vFrete = nfe.querySelector("total ICMSTot vFrete")?.textContent || "0";
      const cnpjEmit = nfe.querySelector("emit CNPJ")?.textContent || "";

      let fornecedorId = "";
      if (cnpjEmit) {
        const cnpjLimpo = cnpjEmit.replace(/\D/g, "");
        const { data: fornecedorData } = await supabase
          .from("fornecedores")
          .select("id")
          .ilike("cnpj", `%${cnpjLimpo.slice(0, 8)}%`)
          .maybeSingle();
        if (fornecedorData) fornecedorId = fornecedorData.id;
      }

      const dets = nfe.querySelectorAll("det");
      const itensXml: ItemCompra[] = [];
      dets.forEach(det => {
        const xProd = det.querySelector("prod xProd")?.textContent || "";
        const qCom = parseFloat(det.querySelector("prod qCom")?.textContent || "1");
        const vUnCom = parseFloat(det.querySelector("prod vUnCom")?.textContent || "0");

        const produtoEncontrado = produtos.find(p =>
          p.nome.toLowerCase().includes(xProd.toLowerCase()) ||
          xProd.toLowerCase().includes(p.nome.toLowerCase())
        );

        if (produtoEncontrado) {
          itensXml.push({
            produto_id: produtoEncontrado.id,
            quantidade: Math.round(qCom),
            preco_unitario: vUnCom,
          });
        } else {
          itensXml.push({
            produto_id: `new_${Date.now()}_${Math.random()}`,
            produto_nome: xProd,
            quantidade: Math.round(qCom),
            preco_unitario: vUnCom,
            is_new: true,
          });
        }
      });

      setForm(prev => ({
        ...prev,
        numero_nota_fiscal: nNF,
        chave_nfe: chaveNfe,
        data_compra: dataCompra || prev.data_compra,
        valor_frete: vFrete !== "0" ? formatCurrency((parseFloat(vFrete) * 100).toFixed(0)) : "",
        fornecedor_id: fornecedorId || prev.fornecedor_id,
      }));

      if (itensXml.length > 0) {
        setItens(itensXml);
        const newCount = itensXml.filter(i => i.is_new).length;
        toast.success(`${itensXml.length} item(ns) importado(s)${newCount > 0 ? `, ${newCount} novo(s) serão cadastrados` : ""}`);
      } else {
        toast.info("XML importado. Adicione os itens manualmente.");
      }
    } catch {
      toast.error("Erro ao processar o arquivo XML");
    }

    if (xmlInputRef.current) xmlInputRef.current.value = "";
  };

  const updateStatus = async (id: string, status: string) => {
    const updateData: Record<string, unknown> = { status };
    if (status === "recebido") {
      updateData.data_recebimento = new Date().toISOString();
    }
    const { error } = await supabase.from("compras").update(updateData).eq("id", id);
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

  return (
    <MainLayout>
      <Header title="Compras" subtitle="Gestão de compras e pedidos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Compra</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Nova Compra</DialogTitle>
                <DialogDescription>Preencha os dados, importe XML ou tire foto da nota fiscal</DialogDescription>
              </DialogHeader>

              {/* Import buttons */}
              <div className="flex gap-2 pt-2">
                <input ref={xmlInputRef} type="file" accept=".xml" className="hidden" onChange={handleImportXML} />
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                <Button variant="outline" className="flex-1" onClick={() => xmlInputRef.current?.click()} disabled={isProcessingPhoto}>
                  <Upload className="h-4 w-4 mr-2" />Importar XML
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => photoInputRef.current?.click()} disabled={isProcessingPhoto}>
                  {isProcessingPhoto ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Fornecedor *</Label>
                      <div className="flex gap-1">
                        <Select value={form.fornecedor_id} onValueChange={v => setForm({ ...form, fornecedor_id: v })}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {fornecedores.map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setQuickFornOpen(true)} title="Cadastrar fornecedor">
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

                {/* Datas */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Data da Compra</Label>
                    <Input type="date" value={form.data_compra} onChange={e => setForm({ ...form, data_compra: e.target.value })} />
                  </div>
                  <div>
                    <Label>Previsão Entrega</Label>
                    <Input type="date" value={form.data_prevista} onChange={e => setForm({ ...form, data_prevista: e.target.value })} />
                  </div>
                  <div>
                    <Label>Data Pagamento</Label>
                    <Input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} />
                  </div>
                </div>

                {/* Itens */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Itens da Compra</h3>

                  {itens.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="w-20">Qtd</TableHead>
                          <TableHead className="w-28">Preço Un.</TableHead>
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
                            <TableCell>{item.quantidade}</TableCell>
                            <TableCell>R$ {item.preco_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">R$ {(item.preco_unitario * item.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => removerItem(idx)} className="text-destructive h-6 w-6 p-0">×</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  <div className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-end">
                    <div>
                      <Label className="text-xs">Produto</Label>
                      <Select value={novoItem.produto_id} onValueChange={v => {
                        const prod = produtos.find(p => p.id === v);
                        setNovoItem({ ...novoItem, produto_id: v, preco_unitario: prod ? formatCurrency((prod.preco * 100).toFixed(0)) : novoItem.preco_unitario });
                      }}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {produtos.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nome} - R$ {Number(p.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                    <Button size="sm" onClick={adicionarItem} className="mb-0">+</Button>
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

                {form.data_pagamento && (
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    ℹ️ Uma conta a pagar será criada automaticamente com vencimento em {new Date(form.data_pagamento + "T12:00:00").toLocaleDateString("pt-BR")}.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
                  <Button onClick={handleSave}>Registrar Compra</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dashboard Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Compras no Mês</p>
                  <p className="text-2xl font-bold">R$ {(totalMesAtual / 1000).toFixed(1)}k</p>
                  <div className="flex items-center gap-1 mt-1">
                    {variacaoMes >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-destructive" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-primary" />
                    )}
                    <span className={`text-xs ${variacaoMes >= 0 ? "text-destructive" : "text-primary"}`}>
                      {variacaoMes >= 0 ? "+" : ""}{variacaoMes.toFixed(1)}% vs mês anterior
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold">R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground mt-1">{comprasMesAtual.length} compras no mês</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary"><BarChart3 className="h-6 w-6 text-secondary-foreground" /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Frete no Mês</p>
                  <p className="text-2xl font-bold">R$ {totalFreteMes.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground mt-1">{percentualFrete.toFixed(1)}% do total</p>
                </div>
                <div className="p-3 rounded-lg bg-accent"><Truck className="h-6 w-6 text-accent-foreground" /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes/Trânsito</p>
                  <p className="text-2xl font-bold">{comprasPendentes.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">R$ {valorPendente.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10"><CalendarDays className="h-6 w-6 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
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

        {/* Purchases table */}
        <Card>
          <CardHeader><CardTitle>Pedidos de Compra</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground">Carregando...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NF</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Frete</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        {c.numero_nota_fiscal ? (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            {c.numero_nota_fiscal}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="font-medium">{c.fornecedores?.razao_social || "-"}</TableCell>
                      <TableCell>{c.data_compra ? new Date(c.data_compra + "T12:00:00").toLocaleDateString("pt-BR") : new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>R$ {Number(c.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{Number(c.valor_frete) > 0 ? `R$ ${Number(c.valor_frete).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</TableCell>
                      <TableCell><Badge variant={statusVariant(c.status)}>{statusLabel(c.status)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {c.status === "pendente" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "em_transito")}>Enviar</Button>
                          )}
                          {c.status === "em_transito" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "recebido")}>Receber</Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {compras.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma compra registrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
    </MainLayout>
  );
}
