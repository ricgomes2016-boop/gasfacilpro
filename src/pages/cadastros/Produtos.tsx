import { useState } from "react";
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
import { Package, Plus, Search, Edit, Trash2, Flame, Droplets, Box, Loader2, ScanBarcode, Camera, CameraOff, Zap } from "lucide-react";
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
};

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

  // Mutation para criar produto (com auto-criação do par vazio)
  const criarProduto = useMutation({
    mutationFn: async (dados: ProdutoForm) => {
      const tipoBotijao = dados.tipo_botijao || null;
      const categoria = dados.categoria || null;
      const isBotijaoOuAgua = (categoria === "gas" || categoria === "agua") && tipoBotijao === "cheio";

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
          ativo: true,
          unidade_id: unidadeAtual?.id || null,
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
    } else {
      setScanFeedback(`✅ Código ${barcode} lido com sucesso!`);
      toast({ title: "Código lido!", description: `Código de barras: ${barcode}` });
    }
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
                      setForm({
                        ...form,
                        categoria: value,
                        tipo_botijao: isBotijaoCategoria ? "cheio" : form.tipo_botijao,
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
                {(form.categoria === "gas" || form.categoria === "agua") ? (
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/50 text-sm">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <span>Cheio</span>
                      <span className="text-muted-foreground text-xs ml-auto">Par vazio criado automaticamente</span>
                    </div>
                  </div>
                ) : (
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
                )}
                {(form.categoria === "gas" || form.categoria === "agua") && (
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
                {(form.categoria === "gas" || form.categoria === "agua") && !editandoProduto && (
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
                {!(form.categoria === "gas" || form.categoria === "agua") && (
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Total</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{totalProdutos}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">No catálogo</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Gás</CardTitle>
              <Flame className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-orange-600">{produtosGas}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Produtos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Água</CardTitle>
              <Droplets className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-blue-600">{produtosAgua}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Produtos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Acessórios</CardTitle>
              <Box className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-green-600">{produtosAcessorios}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Produtos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Baixo Est.</CardTitle>
              <Package className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-red-600">{baixoEstoque}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Repor</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>Lista de Produtos</CardTitle>
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
                        <Badge variant={produto.ativo ? "default" : "destructive"}>
                          {produto.ativo ? "Ativo" : "Inativo"}
                        </Badge>
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
