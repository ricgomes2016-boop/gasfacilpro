import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Plus, Search, Edit, Trash2, Flame, Droplets, Box, Loader2, ScanBarcode, Camera, CameraOff, Zap, FileText, Receipt, Boxes, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUpload } from "@/components/ui/image-upload";
import { useUnidade } from "@/contexts/UnidadeContext";
import { BarcodeScanner } from "@/components/pdv/BarcodeScanner";
import { SmartImportButtons } from "@/components/import/SmartImportButtons";
import { ImportReviewDialog } from "@/components/import/ImportReviewDialog";
import { toast as sonnerToast } from "sonner";

interface Produto {
  id: string;
  nome: string;
  categoria: string | null;
  preco: number;
  preco_custo?: number | null;
  preco_portaria?: number | null;
  preco_telefone?: number | null;
  estoque: number | null;
  ativo: boolean | null;
  codigo_barras: string | null;
  descricao: string | null;
  tipo_botijao: string | null;
  image_url: string | null;
  estoque_unico: boolean;
  // Fiscal
  ncm?: string | null;
  cest?: string | null;
  codigo_anp?: string | null;
  descricao_anp?: string | null;
  unidade_tributavel?: string | null;
  cfop_saida?: string | null;
  cfop_entrada_padrao?: string | null;
  cst_icms?: string | null;
  csosn_icms?: string | null;
  cst_pis?: string | null;
  cst_cofins?: string | null;
  aliquota_pis?: number | null;
  aliquota_cofins?: number | null;
  aliquota_icms?: number | null;
  monofasico?: boolean | null;
  fator_conversao_anp?: number | null;
  produto_vasilhame_id?: string | null;
  origem_mercadoria?: string | null;
  unidade_comercial?: string | null;
}

interface ProdutoForm {
  nome: string;
  categoria: string;
  preco: string;
  preco_custo: string;
  preco_portaria: string;
  preco_telefone: string;
  estoque: string;
  estoque_vazio: string;
  codigo_barras: string;
  descricao: string;
  tipo_botijao: string;
  image_url: string | null;
  estoque_unico: boolean;
  // Fiscal
  ncm: string;
  cest: string;
  codigo_anp: string;
  descricao_anp: string;
  unidade_tributavel: string;
  cfop_saida: string;
  cfop_entrada_padrao: string;
  cst_icms: string;
  csosn_icms: string;
  cst_pis: string;
  cst_cofins: string;
  aliquota_pis: string;
  aliquota_cofins: string;
  aliquota_icms: string;
  monofasico: boolean;
  fator_conversao_anp: string;
  produto_vasilhame_id: string;
  origem_mercadoria: string;
  unidade_comercial: string;
}

const initialForm: ProdutoForm = {
  nome: "",
  categoria: "",
  preco: "",
  preco_custo: "",
  preco_portaria: "",
  preco_telefone: "",
  estoque: "",
  estoque_vazio: "0",
  codigo_barras: "",
  descricao: "",
  tipo_botijao: "",
  image_url: null,
  estoque_unico: false,
  ncm: "",
  cest: "",
  codigo_anp: "",
  descricao_anp: "",
  unidade_tributavel: "KG",
  cfop_saida: "",
  cfop_entrada_padrao: "",
  cst_icms: "",
  csosn_icms: "",
  cst_pis: "",
  cst_cofins: "",
  aliquota_pis: "0",
  aliquota_cofins: "0",
  aliquota_icms: "0",
  monofasico: false,
  fator_conversao_anp: "",
  produto_vasilhame_id: "nenhum",
  origem_mercadoria: "0",
  unidade_comercial: "UN",
};

function parseNumOrNull(v: string): number | null {
  if (!v || !v.trim()) return null;
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

function buildFiscalPayload(dados: ProdutoForm) {
  return {
    ncm: dados.ncm || null,
    cest: dados.cest || null,
    codigo_anp: dados.codigo_anp || null,
    descricao_anp: dados.descricao_anp || null,
    unidade_tributavel: dados.unidade_tributavel || null,
    cfop_saida: dados.cfop_saida || null,
    cfop_entrada_padrao: dados.cfop_entrada_padrao || null,
    cst_icms: dados.cst_icms || null,
    csosn_icms: dados.csosn_icms || null,
    cst_pis: dados.cst_pis || null,
    cst_cofins: dados.cst_cofins || null,
    aliquota_pis: parseNumOrNull(dados.aliquota_pis),
    aliquota_cofins: parseNumOrNull(dados.aliquota_cofins),
    aliquota_icms: parseNumOrNull(dados.aliquota_icms),
    monofasico: !!dados.monofasico,
    fator_conversao_anp: parseNumOrNull(dados.fator_conversao_anp),
    produto_vasilhame_id: dados.produto_vasilhame_id && dados.produto_vasilhame_id !== "nenhum" ? dados.produto_vasilhame_id : null,
    origem_mercadoria: dados.origem_mercadoria || null,
    unidade_comercial: dados.unidade_comercial || null,
  };
}

export default function Produtos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editandoProduto, setEditandoProduto] = useState<Produto | null>(null);
  const [form, setForm] = useState<ProdutoForm>(initialForm);
  const { unidadeAtual } = useUnidade();
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [buscandoEan, setBuscandoEan] = useState(false);


  // Import states
  const [importItems, setImportItems] = useState<Array<{
    nome: string; categoria: string; preco: number; estoque: number;
    codigo_barras: string; descricao: string; tipo_botijao: string;
  }>>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSaving, setImportSaving] = useState(false);

  const handleImportData = (data: any) => {
    const produtos = data?.produtos || [data];
    setImportItems(produtos.map((p: any) => ({
      nome: p.nome || "",
      categoria: p.categoria || "outro",
      preco: p.preco || 0,
      estoque: p.estoque || 0,
      codigo_barras: p.codigo_barras || "",
      descricao: p.descricao || "",
      tipo_botijao: p.tipo_botijao || "",
    })));
    setImportDialogOpen(true);
    sonnerToast.success(`${produtos.length} produto(s) identificado(s)!`);
  };

  const saveImportedProducts = async () => {
    const valid = importItems.filter(p => p.nome.trim());
    if (valid.length === 0) return;
    setImportSaving(true);
    try {
      const rows = valid.map(p => ({
        nome: p.nome,
        categoria: p.categoria || null,
        preco: p.preco,
        estoque: p.estoque,
        codigo_barras: p.codigo_barras || null,
        descricao: p.descricao || null,
        tipo_botijao: p.tipo_botijao || null,
        ativo: true,
        unidade_id: unidadeAtual?.id || null,
      }));
      const { error } = await supabase.from("produtos").insert(rows);
      if (error) throw error;
      sonnerToast.success(`${valid.length} produto(s) importado(s)!`);
      setImportDialogOpen(false);
      setImportItems([]);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    } catch (err: any) {
      sonnerToast.error("Erro ao importar: " + (err.message || "erro desconhecido"));
    } finally {
      setImportSaving(false);
    }
  };

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("*")
        .order("nome", { ascending: true });

      if (unidadeAtual?.id) {
        query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Produto[];
    },
  });

  const vasilhameOptions = useMemo(
    () => produtos.filter((p) => p.tipo_botijao === "vazio" && p.id !== editandoProduto?.id),
    [produtos, editandoProduto?.id]
  );


  // Mutation para criar produto (com auto-criação do par vazio)
  const criarProduto = useMutation({
    mutationFn: async (dados: ProdutoForm) => {
      const tipoBotijao = dados.tipo_botijao || null;
      const categoria = dados.categoria || null;
      const isEstoqueUnico = dados.estoque_unico;
      const isBotijaoOuAgua = !isEstoqueUnico && (categoria === "gas" || categoria === "agua") && tipoBotijao === "cheio";
      const fiscalPayload = buildFiscalPayload(dados);

      // Criar produto cheio
      const { data: produtoCheio, error } = await supabase
        .from("produtos")
        .insert({
          nome: dados.nome,
          categoria,
          preco: parseFloat(dados.preco.replace(",", ".")) || 0,
          preco_custo: dados.preco_custo ? parseFloat(dados.preco_custo.replace(",", ".")) : null,
          preco_portaria: dados.preco_portaria ? parseFloat(dados.preco_portaria.replace(",", ".")) : null,
          preco_telefone: dados.preco_telefone ? parseFloat(dados.preco_telefone.replace(",", ".")) : null,
          estoque: parseInt(dados.estoque) || 0,
          codigo_barras: dados.codigo_barras || null,
          descricao: dados.descricao || null,
          tipo_botijao: isBotijaoOuAgua ? "cheio" : tipoBotijao,
          image_url: dados.image_url || null,
          estoque_unico: isEstoqueUnico,
          ativo: true,
          unidade_id: unidadeAtual?.id || null,
          ...fiscalPayload,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-criar par vazio se for botijão/água cheio
      if (isBotijaoOuAgua && produtoCheio) {
        const nomeVazio = `${dados.nome} (Vazio)`;
        const { data: produtoVazio, error: errVazio } = await supabase
          .from("produtos")
          .insert({
            nome: nomeVazio,
            categoria,
            preco: 0,
            estoque: parseInt(dados.estoque_vazio) || 0,
            tipo_botijao: "vazio",
            botijao_par_id: produtoCheio.id,
            ativo: true,
            unidade_id: unidadeAtual?.id || null,
          })
          .select()
          .single();

        if (errVazio) throw errVazio;

        // Vincular cheio ao vazio
        if (produtoVazio) {
          await supabase
            .from("produtos")
            .update({ botijao_par_id: produtoVazio.id })
            .eq("id", produtoCheio.id);
        }
      }

      return produtoCheio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Produto cadastrado com sucesso!", description: form.tipo_botijao === "cheio" && (form.categoria === "gas" || form.categoria === "agua") ? "O par vazio foi criado automaticamente." : undefined });
      setDialogAberto(false);
      setForm(initialForm);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar produto
  const atualizarProduto = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: ProdutoForm }) => {
      const { data, error } = await supabase
        .from("produtos")
        .update({
          nome: dados.nome,
          categoria: dados.categoria || null,
          preco: parseFloat(dados.preco.replace(",", ".")) || 0,
          preco_custo: dados.preco_custo ? parseFloat(dados.preco_custo.replace(",", ".")) : null,
          preco_portaria: dados.preco_portaria ? parseFloat(dados.preco_portaria.replace(",", ".")) : null,
          preco_telefone: dados.preco_telefone ? parseFloat(dados.preco_telefone.replace(",", ".")) : null,
          estoque: parseInt(dados.estoque) || 0,
          codigo_barras: dados.codigo_barras || null,
          descricao: dados.descricao || null,
          tipo_botijao: dados.tipo_botijao || null,
          image_url: dados.image_url || null,
          estoque_unico: dados.estoque_unico,
          ...buildFiscalPayload(dados),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Produto atualizado com sucesso!" });
      setDialogAberto(false);
      setEditandoProduto(null);
      setForm(initialForm);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para excluir produto
  const excluirProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Produto excluído com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!form.nome || !form.preco) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e preço são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (editandoProduto) {
      atualizarProduto.mutate({ id: editandoProduto.id, dados: form });
    } else {
      criarProduto.mutate(form);
    }
  };

  const handleEditar = (produto: Produto) => {
    setEditandoProduto(produto);
    setForm({
      ...initialForm,
      nome: produto.nome,
      categoria: produto.categoria || "",
      preco: produto.preco.toString().replace(".", ","),
      preco_custo: (produto.preco_custo ?? "").toString().replace(".", ","),
      preco_portaria: (produto.preco_portaria ?? "").toString().replace(".", ","),
      preco_telefone: (produto.preco_telefone ?? "").toString().replace(".", ","),
      estoque: (produto.estoque || 0).toString(),
      estoque_vazio: "0",
      codigo_barras: produto.codigo_barras || "",
      descricao: produto.descricao || "",
      tipo_botijao: produto.tipo_botijao || "",
      image_url: produto.image_url || null,
      estoque_unico: produto.estoque_unico ?? false,
      ncm: produto.ncm || "",
      cest: produto.cest || "",
      codigo_anp: produto.codigo_anp || "",
      descricao_anp: produto.descricao_anp || "",
      unidade_tributavel: produto.unidade_tributavel || "KG",
      cfop_saida: produto.cfop_saida || "",
      cfop_entrada_padrao: produto.cfop_entrada_padrao || "",
      cst_icms: produto.cst_icms || "",
      csosn_icms: produto.csosn_icms || "",
      cst_pis: produto.cst_pis || "",
      cst_cofins: produto.cst_cofins || "",
      aliquota_pis: (produto.aliquota_pis ?? 0).toString().replace(".", ","),
      aliquota_cofins: (produto.aliquota_cofins ?? 0).toString().replace(".", ","),
      aliquota_icms: (produto.aliquota_icms ?? 0).toString().replace(".", ","),
      monofasico: produto.monofasico ?? false,
      fator_conversao_anp: (produto.fator_conversao_anp ?? "").toString().replace(".", ","),
      produto_vasilhame_id: produto.produto_vasilhame_id || "nenhum",
      origem_mercadoria: produto.origem_mercadoria || "0",
      unidade_comercial: produto.unidade_comercial || "UN",
    });
    setDialogAberto(true);
  };

  const handleExcluir = (produto: Produto) => {
    if (confirm(`Deseja excluir o produto "${produto.nome}"?`)) {
      excluirProduto.mutate(produto.id);
    }
  };

  const handleNovoClick = () => {
    setEditandoProduto(null);
    setForm(initialForm);
    setScannerAtivo(false);
    setScanFeedback(null);
    setDialogAberto(true);
  };

  const buscarDadosPorCodigo = async (barcode: string) => {
    try {
      setBuscandoEan(true);
      const { data, error } = await supabase.functions.invoke("lookup-barcode", {
        body: { codigo: barcode },
      });
      if (error) throw error;
      if (data?.encontrado && data?.dados) {
        const d = data.dados;
        setForm((prev) => ({
          ...prev,
          nome: prev.nome?.trim() ? prev.nome : (d.nome || prev.nome),
          descricao: prev.descricao?.trim() ? prev.descricao : (d.descricao || prev.descricao),
          categoria: prev.categoria ? prev.categoria : (d.categoria_sugerida || prev.categoria),
        }));
        toast({
          title: "Produto identificado",
          description: `${d.nome}${d.marca ? ` — ${d.marca}` : ""} (via ${data.fonte})`,
        });
      } else {
        toast({
          title: "Código lido",
          description: "Não encontramos dados públicos. Preencha manualmente.",
        });
      }
    } catch (e: any) {
      console.warn("lookup-barcode falhou:", e);
    } finally {
      setBuscandoEan(false);
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    setScannerAtivo(false);
    setForm((prev) => ({ ...prev, codigo_barras: barcode }));

    // Verificar se já existe produto com esse código
    const existente = produtos.find((p) => p.codigo_barras === barcode);
    if (existente) {
      setScanFeedback(`⚠️ Código já cadastrado: "${existente.nome}"`);
      toast({
        title: "Produto já existe",
        description: `O código ${barcode} pertence a "${existente.nome}".`,
        variant: "destructive",
      });
      return;
    }

    setScanFeedback(`✅ Código ${barcode} lido — buscando dados...`);
    buscarDadosPorCodigo(barcode);
  };

  // Filtrar produtos
  const produtosFiltrados = produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.categoria?.toLowerCase().includes(busca.toLowerCase()) ||
      p.codigo_barras?.toLowerCase().includes(busca.toLowerCase())
  );

  // Estatísticas
  const totalProdutos = produtos.length;
  const produtosGas = produtos.filter((p) => p.categoria === "gas").length;
  const produtosAgua = produtos.filter((p) => p.categoria === "agua").length;
  const produtosAcessorios = produtos.filter((p) => p.categoria === "acessorio").length;
  const baixoEstoque = produtos.filter((p) => (p.estoque || 0) < 10).length;

  const isSubmitting = criarProduto.isPending || atualizarProduto.isPending;

  return (
    <MainLayout>
      <Header title="Produtos" subtitle="Catálogo de produtos" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button className="gap-2" onClick={handleNovoClick}>
              <Plus className="h-4 w-4" />
              Novo Produto
            </Button>
            <SmartImportButtons
              edgeFunctionName="parse-products-import"
              onDataExtracted={handleImportData}
            />
          </div>
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editandoProduto ? "Editar Produto" : "Cadastrar Novo Produto"}
                </DialogTitle>
                <DialogDescription>
                  {editandoProduto
                    ? "Altere os dados do produto abaixo."
                    : "Preencha os dados para cadastrar um novo produto."}
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="geral" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="geral" className="gap-1.5"><Package className="h-3.5 w-3.5" />Geral</TabsTrigger>
                  <TabsTrigger value="fiscal" className="gap-1.5"><Receipt className="h-3.5 w-3.5" />Fiscal</TabsTrigger>
                  <TabsTrigger value="vasilhame" className="gap-1.5"><Boxes className="h-3.5 w-3.5" />Vasilhame</TabsTrigger>
                </TabsList>
                <TabsContent value="geral">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome do Produto *</Label>
                  <Input
                    placeholder="Ex: Botijão P13 Cheio"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={form.categoria}
                    onValueChange={(value) => {
                      const isBotijaoCategoria = value === "gas" || value === "agua";
                      const isAcessorioOuOutro = value === "acessorio" || value === "outro";
                      const isGas = value === "gas";
                      const isAcessorio = value === "acessorio";
                      setForm({
                        ...form,
                        categoria: value,
                        tipo_botijao: isBotijaoCategoria ? "cheio" : form.tipo_botijao,
                        estoque_unico: isAcessorioOuOutro ? true : false,
                        // Smart defaults fiscais
                        ncm: form.ncm || (isGas ? "27111910" : isAcessorio ? "" : form.ncm),
                        cest: form.cest || (isGas ? "0600600" : form.cest),
                        cfop_saida: form.cfop_saida || (isGas ? "5656" : isAcessorio ? "5102" : form.cfop_saida),
                        cfop_entrada_padrao: form.cfop_entrada_padrao || (isGas ? "1652" : form.cfop_entrada_padrao),
                        unidade_tributavel: isGas ? "KG" : form.unidade_tributavel,
                        monofasico: isGas ? true : form.monofasico,
                        cst_pis: isGas ? "04" : form.cst_pis,
                        cst_cofins: isGas ? "04" : form.cst_cofins,
                        aliquota_pis: isGas ? "0" : form.aliquota_pis,
                        aliquota_cofins: isGas ? "0" : form.aliquota_cofins,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gas">Gás</SelectItem>
                      <SelectItem value="agua">Água</SelectItem>
                      <SelectItem value="acessorio">Acessório</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Toggle estoque único para categorias que suportam par cheio/vazio */}
                {(form.categoria === "gas" || form.categoria === "agua") && (
                  <div className="flex items-center justify-between rounded-lg border border-input p-3 md:col-span-2">
                    <div>
                      <Label className="text-sm font-medium">Estoque Único</Label>
                      <p className="text-xs text-muted-foreground">
                        {form.estoque_unico
                          ? "Produto sem par cheio/vazio (ex: acessório de gás)"
                          : "Produto com par cheio/vazio criado automaticamente"}
                      </p>
                    </div>
                    <Switch
                      checked={form.estoque_unico}
                      onCheckedChange={(checked) => setForm({ ...form, estoque_unico: checked })}
                    />
                  </div>
                )}
                {(form.categoria === "gas" || form.categoria === "agua") && !form.estoque_unico ? (
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/50 text-sm">
                      <Flame className="h-4 w-4 text-warning" />
                      <span>Cheio</span>
                      <span className="text-muted-foreground text-xs ml-auto">Par vazio criado automaticamente</span>
                    </div>
                  </div>
                ) : (form.categoria !== "gas" && form.categoria !== "agua") && !form.estoque_unico ? (
                  <div className="space-y-2">
                    <Label>Tipo de Botijão</Label>
                    <Select
                      value={form.tipo_botijao}
                      onValueChange={(value) => setForm({ ...form, tipo_botijao: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cheio">Cheio</SelectItem>
                        <SelectItem value="vazio">Vazio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {(form.categoria === "gas" || form.categoria === "agua") && !form.estoque_unico && (
                  <div className="space-y-2">
                    <Label>Estoque Cheio</Label>
                    <Input
                      placeholder="0"
                      type="number"
                      value={form.estoque}
                      onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                    />
                  </div>
                )}
                {(form.categoria === "gas" || form.categoria === "agua") && !form.estoque_unico && !editandoProduto && (
                  <div className="space-y-2">
                    <Label>Estoque Vazio (Vasilhames)</Label>
                    <Input
                      placeholder="0"
                      type="number"
                      value={form.estoque_vazio}
                      onChange={(e) => setForm({ ...form, estoque_vazio: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Preço de Custo (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={form.preco_custo}
                    onChange={(e) => setForm({ ...form, preco_custo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço de Venda (R$) *</Label>
                  <Input
                    placeholder="0,00"
                    value={form.preco}
                    onChange={(e) => setForm({ ...form, preco: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Portaria (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={form.preco_portaria}
                    onChange={(e) => setForm({ ...form, preco_portaria: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Telefone/Entrega (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={form.preco_telefone}
                    onChange={(e) => setForm({ ...form, preco_telefone: e.target.value })}
                  />
                </div>
                {(!(form.categoria === "gas" || form.categoria === "agua") || form.estoque_unico) && (
                  <div className="space-y-2">
                    <Label>Estoque Atual</Label>
                    <Input
                      placeholder="0"
                      type="number"
                      value={form.estoque}
                      onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                    />
                  </div>
                )}
                {(form.categoria === "acessorio" || form.categoria === "outro") && (
                  <div className="flex items-center justify-between rounded-lg border border-input p-3 md:col-span-2">
                    <div>
                      <Label className="text-sm font-medium">Estoque Único</Label>
                      <p className="text-xs text-muted-foreground">
                        Produto com controle de estoque simples (sem par cheio/vazio)
                      </p>
                    </div>
                    <Switch
                      checked={form.estoque_unico}
                      onCheckedChange={(checked) => setForm({ ...form, estoque_unico: checked })}
                    />
                  </div>
                )}
                <div className="space-y-3 md:col-span-2">
                  <Label>Código de Barras</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="7891234567890"
                      value={form.codigo_barras}
                      onChange={(e) => {
                        setForm({ ...form, codigo_barras: e.target.value });
                        setScanFeedback(null);
                      }}
                      onBlur={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        if (v.length >= 8 && v.length <= 14 && !editandoProduto) {
                          const existente = produtos.find((p) => p.codigo_barras === v);
                          if (!existente) buscarDadosPorCodigo(v);
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant={scannerAtivo ? "destructive" : "outline"}
                      size="icon"
                      onClick={() => {
                        setScannerAtivo(!scannerAtivo);
                        setScanFeedback(null);
                      }}
                      title={scannerAtivo ? "Fechar scanner" : "Escanear código de barras"}
                    >
                      {scannerAtivo ? <CameraOff className="h-4 w-4" /> : <ScanBarcode className="h-4 w-4" />}
                    </Button>
                    {buscandoEan && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
                  </div>

                  {scannerAtivo && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-2 text-xs text-primary font-medium">
                        <Zap className="h-3.5 w-3.5" />
                        Aponte a câmera para o código de barras
                      </div>
                      <BarcodeScanner
                        onScan={handleBarcodeScan}
                        isActive={scannerAtivo}
                        onToggle={() => setScannerAtivo(!scannerAtivo)}
                        hideToggle
                      />
                    </div>
                  )}

                  {scanFeedback && (
                    <p className="text-xs font-medium animate-in fade-in duration-200">
                      {scanFeedback}
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descrição</Label>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Descrição detalhada do produto..."
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Imagem do Produto</Label>
                  <ImageUpload
                    value={form.image_url}
                    onChange={(url) => setForm({ ...form, image_url: url })}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
                </TabsContent>

                <TabsContent value="fiscal" className="mt-4 space-y-4">
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">GLP / Combustíveis:</strong> use NCM 2711.19.10, CFOP 5656, CST PIS/COFINS 04 (Monofásico) e informe Código ANP. Acessórios: NCM próprio, CFOP 5102, tributação normal.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-input p-3 bg-primary/5">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Flame className="h-4 w-4 text-warning" />
                        Regime Monofásico (GLP / Combustíveis)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Aplica CST PIS/COFINS 04 (alíquota zero - tributado na origem) automaticamente.
                      </p>
                    </div>
                    <Switch
                      checked={form.monofasico}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setForm({
                            ...form,
                            monofasico: true,
                            cst_pis: "04",
                            cst_cofins: "04",
                            aliquota_pis: "0",
                            aliquota_cofins: "0",
                            unidade_tributavel: form.unidade_tributavel || "KG",
                          });
                        } else {
                          setForm({ ...form, monofasico: false });
                        }
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>NCM *</Label>
                      <Input
                        placeholder="2711.19.10"
                        value={form.ncm}
                        onChange={(e) => setForm({ ...form, ncm: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CEST</Label>
                      <Input
                        placeholder="06.006.00"
                        value={form.cest}
                        onChange={(e) => setForm({ ...form, cest: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Código ANP {form.monofasico && "*"}</Label>
                      <Input
                        placeholder="210203001 (GLP P13)"
                        value={form.codigo_anp}
                        onChange={(e) => setForm({ ...form, codigo_anp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição ANP</Label>
                      <Input
                        placeholder="GLP - Gás Liquefeito de Petróleo"
                        value={form.descricao_anp}
                        onChange={(e) => setForm({ ...form, descricao_anp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade Comercial</Label>
                      <Input
                        placeholder="UN"
                        value={form.unidade_comercial}
                        onChange={(e) => setForm({ ...form, unidade_comercial: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade Tributável (ANP)</Label>
                      <Select
                        value={form.unidade_tributavel}
                        onValueChange={(v) => setForm({ ...form, unidade_tributavel: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KG">KG (Quilograma)</SelectItem>
                          <SelectItem value="L">L (Litro)</SelectItem>
                          <SelectItem value="M3">M³ (Metro Cúbico)</SelectItem>
                          <SelectItem value="UN">UN (Unidade)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Fator Conversão ANP</Label>
                      <Input
                        placeholder="13 (KG por P13)"
                        value={form.fator_conversao_anp}
                        onChange={(e) => setForm({ ...form, fator_conversao_anp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Origem da Mercadoria</Label>
                      <Select
                        value={form.origem_mercadoria}
                        onValueChange={(v) => setForm({ ...form, origem_mercadoria: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 - Nacional</SelectItem>
                          <SelectItem value="1">1 - Estrangeira (Imp. direta)</SelectItem>
                          <SelectItem value="2">2 - Estrangeira (Mercado interno)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>CFOP Saída</Label>
                      <Input
                        placeholder="5656 (GLP) ou 5102"
                        value={form.cfop_saida}
                        onChange={(e) => setForm({ ...form, cfop_saida: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CFOP Entrada Padrão</Label>
                      <Input
                        placeholder="1652 / 2652"
                        value={form.cfop_entrada_padrao}
                        onChange={(e) => setForm({ ...form, cfop_entrada_padrao: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/45 p-3 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Tributação ICMS</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>CST ICMS (Lucro Real/Presumido)</Label>
                        <Input
                          placeholder="60 (ST) ou 00"
                          value={form.cst_icms}
                          onChange={(e) => setForm({ ...form, cst_icms: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CSOSN (Simples Nacional)</Label>
                        <Input
                          placeholder="500 ou 102"
                          value={form.csosn_icms}
                          onChange={(e) => setForm({ ...form, csosn_icms: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Alíquota ICMS (%)</Label>
                        <Input
                          placeholder="0,00"
                          value={form.aliquota_icms}
                          onChange={(e) => setForm({ ...form, aliquota_icms: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/45 p-3 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Tributação PIS / COFINS</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>CST PIS</Label>
                        <Input
                          placeholder="04 (Monofásico) ou 01"
                          value={form.cst_pis}
                          onChange={(e) => setForm({ ...form, cst_pis: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CST COFINS</Label>
                        <Input
                          placeholder="04 (Monofásico) ou 01"
                          value={form.cst_cofins}
                          onChange={(e) => setForm({ ...form, cst_cofins: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Alíquota PIS (%)</Label>
                        <Input
                          placeholder="0,00"
                          value={form.aliquota_pis}
                          onChange={(e) => setForm({ ...form, aliquota_pis: e.target.value })}
                          disabled={form.monofasico}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Alíquota COFINS (%)</Label>
                        <Input
                          placeholder="0,00"
                          value={form.aliquota_cofins}
                          onChange={(e) => setForm({ ...form, aliquota_cofins: e.target.value })}
                          disabled={form.monofasico}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="vasilhame" className="mt-4 space-y-4">
                  <div className="rounded-lg border border-info/30 bg-info/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Vasilhame em comodato:</strong> vincule o produto cheio (GLP) ao seu vasilhame correspondente. Isso permite separar o custo do gás (consumível) do valor do casco (ativo) durante a importação do XML da distribuidora.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Produto Vasilhame Vinculado</Label>
                    <Select
                      value={form.produto_vasilhame_id}
                      onValueChange={(v) => setForm({ ...form, produto_vasilhame_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o vasilhame correspondente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {vasilhameOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Apenas produtos marcados como "Vazio" aparecem nesta lista.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setDialogAberto(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editandoProduto ? "Salvar Alterações" : "Salvar Produto"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <Card className="modern-status-card">
            <CardHeader className="flex flex-row items-center justify-between border-muted/40 bg-muted pb-2 text-muted-foreground">
              <CardTitle className="text-xs md:text-sm font-medium text-foreground">Total</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{totalProdutos}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">No catálogo</p>
            </CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="section-header-stock flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-warning-foreground">Gás</CardTitle>
              <Flame className="h-4 w-4 text-warning-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-warning">{produtosGas}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Produtos</p>
            </CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="section-header-catalog flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-info-foreground">Água</CardTitle>
              <Droplets className="h-4 w-4 text-info-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-info">{produtosAgua}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Produtos</p>
            </CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="section-header-finance flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-success-foreground">Acessórios</CardTitle>
              <Box className="h-4 w-4 text-success-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-success">{produtosAcessorios}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Produtos</p>
            </CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="section-header-critical flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-destructive-foreground">Baixo Est.</CardTitle>
              <Package className="h-4 w-4 text-destructive-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-destructive">{baixoEstoque}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Repor</p>
            </CardContent>
          </Card>
        </div>

        <Card className="modern-panel">
          <CardHeader className="section-header-catalog">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-info-foreground">Lista de Produtos</CardTitle>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  className="pl-10 w-full sm:w-[300px]"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {busca
                  ? "Nenhum produto encontrado com essa busca."
                  : "Nenhum produto cadastrado. Clique em 'Novo Produto' para adicionar."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 hidden sm:table-cell">Imagem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Categoria</TableHead>
                    <TableHead className="hidden md:table-cell">Preço Custo</TableHead>
                    <TableHead>Preço Venda</TableHead>
                    <TableHead className="hidden sm:table-cell">Estoque</TableHead>
                    <TableHead className="hidden lg:table-cell">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosFiltrados.map((produto) => (
                    <TableRow key={produto.id}>
                      <TableCell className="hidden sm:table-cell">
                        {produto.image_url ? (
                          <img
                            src={produto.image_url}
                            alt={produto.nome}
                            className="h-10 w-10 object-cover rounded-md border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="sm:hidden">
                            {produto.image_url ? (
                              <img
                                src={produto.image_url}
                                alt={produto.nome}
                                className="h-8 w-8 object-cover rounded-md border"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            {produto.nome}
                            <span className="block md:hidden text-xs text-muted-foreground">
                              {produto.categoria || "Sem categoria"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{produto.categoria || "Sem categoria"}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {produto.preco_custo != null ? `R$ ${produto.preco_custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell>
                        R$ {produto.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span
                          className={
                            (produto.estoque || 0) < 10
                              ? "text-destructive font-medium"
                              : ""
                          }
                        >
                          {produto.estoque || 0}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant={produto.ativo ? "default" : "destructive"}>
                            {produto.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          {(!produto.ncm || (produto.categoria === "gas" && !produto.codigo_anp)) && (
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Fiscal incompleto
                            </Badge>
                          )}
                          {produto.monofasico && (
                            <Badge variant="info" className="gap-1">
                              <Receipt className="h-3 w-3" />
                              Monofásico
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 md:gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditar(produto)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExcluir(produto)}
                            disabled={excluirProduto.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ImportReviewDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Importar Produtos"
        description={`${importItems.length} produto(s) identificado(s). Revise antes de importar.`}
        items={importItems}
        columns={[
          { key: "nome", label: "Nome", width: "30%" },
          { key: "categoria", label: "Categoria", width: "15%" },
          { key: "preco", label: "Preço", type: "number", width: "15%" },
          { key: "estoque", label: "Estoque", type: "number", width: "10%" },
          { key: "tipo_botijao", label: "Tipo", width: "10%" },
        ]}
        onUpdateItem={(i, field, value) => setImportItems(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))}
        onRemoveItem={(i) => setImportItems(prev => prev.filter((_, idx) => idx !== i))}
        onConfirm={saveImportedProducts}
        saving={importSaving}
      />
    </MainLayout>
  );
}
