import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { parseLocalDate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package, Plus, Users, AlertTriangle, CheckCircle, Search, RotateCcw, FileText, Zap, Info, Printer, PenLine } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EstoqueKpiCard } from "@/components/estoque/EstoqueKpiCard";
import { EstoquePageHeader } from "@/components/estoque/EstoquePageHeader";
import { ClienteAutocompleteInput } from "@/components/clientes/ClienteAutocompleteInput";

export default function Comodatos() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [devolucao, setDevolucao] = useState<{ id: string; pendente: number; nome: string } | null>(null);
  const [qtdDevolucao, setQtdDevolucao] = useState("1");
  const [comprovante, setComprovante] = useState<{ url: string | null; nome: string; carregando: boolean; erro?: string } | null>(null);
  const comprovanteUrl = useRef<string | null>(null);
  const comprovanteRequest = useRef(0);
  const [comodatoSelecionadoId, setComodatoSelecionadoId] = useState<string | null>(null);
  const [assinaturaComodatoId, setAssinaturaComodatoId] = useState<string | null>(null);
  const [nomeAssinante, setNomeAssinante] = useState("");
  const [aceiteAssinatura, setAceiteAssinatura] = useState(false);
  const [salvandoAssinatura, setSalvandoAssinatura] = useState(false);
  const assinaturaRef = useRef<SignatureCanvas | null>(null);
  const assinaturaContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (comprovanteUrl.current) URL.revokeObjectURL(comprovanteUrl.current);
  }, []);

  const fecharComprovante = () => {
    comprovanteRequest.current += 1;
    if (comprovanteUrl.current) URL.revokeObjectURL(comprovanteUrl.current);
    comprovanteUrl.current = null;
    setComprovante(null);
  };

  const [form, setForm] = useState({
    cliente_id: "",
    produto_id: "",
    quantidade: "1",
    deposito: "0",
    prazo_dias: "90",
    observacoes: "",
    modalidade: "rapido" as "rapido" | "formal",
    responsavel_entrega: "",
    documento_referencia: "",
    local_entrega: "",
    finalidade: "",
  });

  const { data: comodatos = [], isLoading } = useQuery({
    queryKey: ["comodatos", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase
        .from("comodatos")
        .select("*, clientes:cliente_id(nome, telefone), produtos:produto_id(nome)")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });
  const comodatoSelecionado = comodatos.find((c: any) => c.id === comodatoSelecionadoId);
  const comodatoParaAssinar = comodatos.find((c: any) => c.id === assinaturaComodatoId);

  const { data: ultimaCompra, isLoading: carregandoUltimaCompra, isError: erroUltimaCompra } = useQuery({
    queryKey: ["comodato-ultima-compra", comodatoSelecionado?.cliente_id, unidadeAtual?.id],
    enabled: !!comodatoSelecionado?.cliente_id && !!unidadeAtual?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos")
        .select("id, numero_sequencial, created_at, data_entrega, valor_total")
        .eq("cliente_id", comodatoSelecionado!.cliente_id)
        .eq("unidade_id", unidadeAtual!.id)
        .in("status", ["finalizado", "entregue"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!assinaturaComodatoId) return;
    const ajustar = () => {
      const canvas = assinaturaRef.current?.getCanvas();
      const container = assinaturaContainerRef.current;
      if (!canvas || !container) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = container.clientWidth * ratio;
      canvas.height = 190 * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      assinaturaRef.current?.clear();
    };
    const timer = window.setTimeout(ajustar, 0);
    return () => window.clearTimeout(timer);
  }, [assinaturaComodatoId]);

  const [clienteNome, setClienteNome] = useState("");
  const { data: produtos = [] } = useQuery({
    queryKey: ["comodatos-produtos", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("produtos").select("id, nome, estoque, categoria, preco_custo").eq("ativo", true).eq("tipo_botijao", "vazio").order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const criarComodato = useMutation({
    mutationFn: async () => {
      const quantidade = Number(form.quantidade);
      const prazoDias = Number(form.prazo_dias);
      const custoReposicao = Number(form.deposito);
      const produto = produtos.find((p: any) => p.id === form.produto_id);
      if (!unidadeAtual?.id || !form.cliente_id || !produto) throw new Error("Selecione unidade, cliente e vasilhame.");
      if (!Number.isInteger(quantidade) || quantidade < 1) throw new Error("Informe uma quantidade válida.");
      if (quantidade > Number(produto.estoque || 0)) throw new Error("Quantidade maior que o saldo disponível.");
      if (!Number.isInteger(prazoDias) || prazoDias < 1) throw new Error("Informe um prazo válido.");
      if (!Number.isFinite(custoReposicao) || custoReposicao < 0) throw new Error("Informe um custo de reposição válido.");
      if (form.modalidade === "formal" && (!form.responsavel_entrega.trim() || !form.local_entrega.trim())) {
        throw new Error("No comodato formal, informe o responsável e o local de entrega.");
      }
      if (form.modalidade === "formal") {
        const { data: cliente, error: clienteError } = await supabase.from("clientes").select("cpf, cnpj").eq("id", form.cliente_id).single();
        if (clienteError) throw clienteError;
        if (!cliente?.cpf && !cliente?.cnpj) throw new Error("Cadastre o CPF ou CNPJ do cliente para emitir o termo formal.");
      }
      const { error } = await supabase.from("comodatos").insert({
        cliente_id: form.cliente_id,
        produto_id: form.produto_id,
        quantidade,
        // Campo legado; representa custo unitário de reposição, nunca um recebimento de garantia.
        deposito: custoReposicao,
        prazo_devolucao: format(addDays(new Date(), prazoDias), "yyyy-MM-dd"),
        observacoes: form.observacoes || null,
        unidade_id: unidadeAtual.id,
        status: "ativo",
        modalidade: form.modalidade,
        responsavel_entrega: form.responsavel_entrega || null,
        documento_referencia: form.documento_referencia || null,
        local_entrega: form.local_entrega || null,
        finalidade: form.finalidade || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comodatos"] });
      queryClient.invalidateQueries({ queryKey: ["comodatos-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Comodato registrado!" });
      setDialogOpen(false);
      setForm({ cliente_id: "", produto_id: "", quantidade: "1", deposito: "0", prazo_dias: "2", observacoes: "", modalidade: "rapido", responsavel_entrega: "", documento_referencia: "", local_entrega: "", finalidade: "" });
      setClienteNome("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const devolverComodato = useMutation({
    mutationFn: async () => {
      if (!devolucao) throw new Error("Selecione o comodato.");
      const quantidade = Number(qtdDevolucao);
      if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > devolucao.pendente) throw new Error("Quantidade devolvida inválida.");
      const atual = comodatos.find((c: any) => c.id === devolucao.id);
      const { data, error } = await supabase.from("comodatos").update({
        quantidade_devolvida: Number(atual?.quantidade_devolvida || 0) + quantidade,
      } as any).eq("id", devolucao.id).eq("status", "ativo").eq("quantidade_devolvida", Number(atual?.quantidade_devolvida || 0)).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("O comodato foi alterado por outro usuário. Atualize a página e tente novamente.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comodatos"] });
      queryClient.invalidateQueries({ queryKey: ["comodatos-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setDevolucao(null);
      toast({ title: "Devolução registrada", description: "O saldo de vasilhames vazios foi reposto." });
    },
    onError: (e: any) => toast({ title: "Não foi possível registrar a devolução", description: e.message, variant: "destructive" }),
  });

  const abrirDevolucao = (c: any) => {
    const pendente = c.quantidade - Number(c.quantidade_devolvida || 0);
    setQtdDevolucao(String(pendente));
    setDevolucao({ id: c.id, pendente, nome: c.produtos?.nome || "Vasilhame" });
  };

  const montarPdfComodato = (c: any, cliente: any, assinatura?: { imagem: string; nome: string; data: Date }) => {
    const formal = c.modalidade !== "rapido";
    const pdf = new jsPDF();
    const cedente = unidadeAtual?.nome || "Empresa";
    const linhas = [
      `Cedente: ${cedente}  |  CNPJ: ${unidadeAtual?.cnpj || "a preencher"}`,
      `Cliente: ${c.clientes?.nome || cliente?.nome || "a preencher"}`,
      `CPF/CNPJ: ${cliente?.cpf || cliente?.cnpj || "a preencher"}`,
      `Vasilhame: ${c.produtos?.nome || "-"}  |  Quantidade: ${c.quantidade}`,
      `Entregue em: ${format(parseLocalDate(c.data_emprestimo), "dd/MM/yyyy")}`,
      `Devolver até: ${c.prazo_devolucao ? format(parseLocalDate(c.prazo_devolucao), "dd/MM/yyyy") : "a combinar"}`,
      `Local: ${c.local_entrega || cliente?.endereco || "a combinar"}`,
      `Responsável: ${c.responsavel_entrega || c.clientes?.nome || "-"}`,
      `Referência: ${c.documento_referencia || "-"}`,
      `Custo de reposição por vasilhame não devolvido: R$ ${Number(c.deposito || 0).toFixed(2)}`,
      `Exposição máxima (${c.quantidade} unidade(s)): R$ ${(Number(c.deposito || 0) * c.quantidade).toFixed(2)}`,
    ];
    pdf.setFontSize(16);
    pdf.text(formal ? "TERMO DE COMODATO DE VASILHAME" : "COMPROVANTE DE EMPRÉSTIMO DE VASILHAME", 14, 20);
    pdf.setFontSize(10);
    let y = 33;
    for (const linha of linhas) {
      const bloco = pdf.splitTextToSize(linha, 180);
      pdf.text(bloco, 14, y);
      y += bloco.length * 5 + 4;
    }
    const clausulas = formal ? [
      "O cedente entrega gratuitamente o(s) vasilhame(s) identificado(s) acima, permanecendo responsável pelo controle da sua devolução.",
      "O cliente compromete-se a conservar e restituir a quantidade recebida no prazo indicado, comunicando perda ou avaria. O custo de reposição informado aplica-se apenas às unidades perdidas ou não devolvidas, mediante apuração; não é pagamento antecipado.",
      "Este termo registra o empréstimo do recipiente vazio. A venda do GLP e os documentos fiscais correspondentes são operações separadas.",
    ] : ["O cliente confirma o recebimento do(s) vasilhame(s) vazio(s) e combina sua devolução até a data indicada. O valor de reposição só se aplica às unidades perdidas ou não devolvidas; não é cobrado neste empréstimo."];
    for (const clausula of clausulas) { const bloco = pdf.splitTextToSize(clausula, 180); pdf.text(bloco, 14, y); y += bloco.length * 5 + 5; }
    if (c.observacoes) { const bloco = pdf.splitTextToSize(`Observações: ${c.observacoes}`, 180); pdf.text(bloco, 14, y); y += bloco.length * 5 + 7; }
    y = Math.min(Math.max(y + 16, 160), 255);
    pdf.line(16, y, 90, y); pdf.line(116, y, 190, y);
    pdf.text("Cedente", 42, y + 6); pdf.text("Cliente / responsável", 136, y + 6);
    if (assinatura) {
      pdf.addImage(assinatura.imagem, "PNG", 120, y - 24, 64, 22);
      pdf.setFontSize(8);
      pdf.text(`Aceite eletrônico manuscrito: ${assinatura.nome}`, 116, y + 12);
      pdf.text(`Registrado em ${format(assinatura.data, "dd/MM/yyyy HH:mm")}`, 116, y + 17);
    }
    return pdf;
  };

  const buscarDadosCliente = async (clienteId: string) => {
    const { data, error } = await supabase.from("clientes")
      .select("nome, cpf, cnpj, endereco, numero, cidade, telefone")
      .eq("id", clienteId).maybeSingle();
    if (error) throw error;
    return data;
  };

  const calcularSha256 = async (bytes: ArrayBuffer) => {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const imprimirComprovante = async (c: any) => {
    fecharComprovante();
    const request = comprovanteRequest.current;
    const formal = c.modalidade !== "rapido";
    const nome = `${formal ? "termo" : "comprovante"}-comodato-${c.id.slice(0, 8)}.pdf`;
    setComprovante({ url: null, nome, carregando: true });
    try {
      let blob: Blob;
      if (c.assinatura_pdf_path) {
        const { data, error } = await supabase.storage.from("comodato-termos").download(c.assinatura_pdf_path);
        if (error || !data) throw error || new Error("Documento assinado não encontrado.");
        if (c.assinatura_sha256 && await calcularSha256(await data.arrayBuffer()) !== c.assinatura_sha256) {
          throw new Error("A integridade do termo assinado não pôde ser confirmada.");
        }
        blob = data;
      } else {
        const cliente = await buscarDadosCliente(c.cliente_id);
        blob = montarPdfComodato(c, cliente).output("blob");
      }
      if (request !== comprovanteRequest.current) return;
      const url = URL.createObjectURL(blob);
      comprovanteUrl.current = url;
      setComprovante({ url, nome, carregando: false });
    } catch (error) {
      if (request !== comprovanteRequest.current) return;
      const mensagem = error instanceof Error ? error.message : "Não foi possível gerar o PDF.";
      setComprovante({ url: null, nome, carregando: false, erro: mensagem });
      toast({ title: "Erro ao gerar comprovante", description: mensagem, variant: "destructive" });
    }
  };

  const assinarComodato = async () => {
    const c = comodatoParaAssinar;
    const nome = nomeAssinante.trim();
    if (!c || !empresa?.id || !unidadeAtual?.id) return;
    if (c.assinatura_pdf_path) {
      toast({ title: "Termo já assinado", description: "A assinatura registrada não pode ser substituída.", variant: "destructive" });
      return;
    }
    if (nome.length < 2 || !aceiteAssinatura || !assinaturaRef.current || assinaturaRef.current.isEmpty()) {
      toast({ title: "Assinatura incompleta", description: "Informe o nome, assine no quadro e confirme o aceite.", variant: "destructive" });
      return;
    }
    setSalvandoAssinatura(true);
    try {
      const cliente = await buscarDadosCliente(c.cliente_id);
      if (!cliente) throw new Error("Cliente do comodato não encontrado.");
      const imagem = assinaturaRef.current.getCanvas().toDataURL("image/png");
      const pdf = montarPdfComodato(c, cliente, { imagem, nome, data: new Date() });
      const bytes = pdf.output("arraybuffer");
      const sha256 = await calcularSha256(bytes);
      const path = `${empresa.id}/${c.id}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage.from("comodato-termos")
        .upload(path, new Blob([bytes], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;
      const { data: atualizado, error: updateError } = await supabase.from("comodatos")
        .update({ assinatura_pdf_path: path, assinatura_sha256: sha256, assinatura_nome: nome })
        .eq("id", c.id).eq("unidade_id", unidadeAtual.id).is("assinatura_pdf_path", null)
        .select("id").maybeSingle();
      if (updateError || !atualizado) throw updateError || new Error("O termo já foi assinado ou foi alterado por outro usuário.");
      await queryClient.invalidateQueries({ queryKey: ["comodatos", unidadeAtual.id] });
      setAssinaturaComodatoId(null);
      setComodatoSelecionadoId(c.id);
      toast({ title: "Termo assinado", description: "O PDF assinado foi guardado de forma privada e está disponível no comprovante." });
    } catch (error) {
      toast({ title: "Não foi possível salvar a assinatura", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSalvandoAssinatura(false);
    }
  };

  const filtrados = comodatos.filter((c: any) => {
    const matchBusca = !filtro || c.clientes?.nome?.toLowerCase().includes(filtro.toLowerCase()) || c.produtos?.nome?.toLowerCase().includes(filtro.toLowerCase());
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const ativos = comodatos.filter((c: any) => c.status === "ativo");
  const totalQtd = ativos.reduce((s: number, c: any) => s + Math.max(0, (c.quantidade || 0) - Number(c.quantidade_devolvida || 0)), 0);
  const custoReposicaoPendente = ativos.reduce((s: number, c: any) => s + Math.max(0, c.quantidade - Number(c.quantidade_devolvida || 0)) * Number(c.deposito || 0), 0);
  const vencidos = ativos.filter((c: any) => c.prazo_devolucao && parseLocalDate(c.prazo_devolucao) < new Date()).length;
  const clientesUnicos = new Set(ativos.map((c: any) => c.cliente_id)).size;

  return (
    <MainLayout>
      <Header title="Comodatos" subtitle="Controle de vasilhames emprestados a clientes" />
      <div className="p-3 sm:p-6 space-y-6">
        <Dialog open={!!comodatoSelecionadoId} onOpenChange={(open) => { if (!open) setComodatoSelecionadoId(null); }}>
          <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Comodato de {comodatoSelecionado?.clientes?.nome || "cliente"}</DialogTitle>
              <p className="text-sm text-muted-foreground">{comodatoSelecionado?.produtos?.nome || "Vasilhame"} · {comodatoSelecionado?.modalidade === "rapido" ? "Empréstimo rápido" : "Termo formal"}</p>
            </DialogHeader>
            {comodatoSelecionado && <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Emprestados</p><p className="text-xl font-bold">{comodatoSelecionado.quantidade}</p></div>
                <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Devolvidos</p><p className="text-xl font-bold">{Number(comodatoSelecionado.quantidade_devolvida || 0)}</p></div>
                <div className="rounded-xl border bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-xl font-bold text-primary">{Math.max(0, comodatoSelecionado.quantidade - Number(comodatoSelecionado.quantidade_devolvida || 0))}</p></div>
              </div>
              <div className="rounded-xl border p-4 text-sm space-y-2">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Última compra nesta unidade</span><strong>{carregandoUltimaCompra ? "Carregando..." : erroUltimaCompra ? "Não foi possível consultar" : ultimaCompra ? format(new Date(ultimaCompra.data_entrega || ultimaCompra.created_at), "dd/MM/yyyy") : "Nenhuma venda concluída"}</strong></div>
                {ultimaCompra && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Pedido</span><span>#{ultimaCompra.numero_sequencial || ultimaCompra.id.slice(0, 8)} · R$ {Number(ultimaCompra.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>}
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Emprestado em</span><span>{format(parseLocalDate(comodatoSelecionado.data_emprestimo), "dd/MM/yyyy")}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Devolver até</span><span>{comodatoSelecionado.prazo_devolucao ? format(parseLocalDate(comodatoSelecionado.prazo_devolucao), "dd/MM/yyyy") : "A combinar"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Reposição por unidade não devolvida</span><span>R$ {Number(comodatoSelecionado.deposito || 0).toFixed(2)}</span></div>
              </div>
              <div className="rounded-xl border p-4 text-sm">
                {comodatoSelecionado.assinatura_em ? <><p className="font-medium text-success">Termo assinado por {comodatoSelecionado.assinatura_nome}</p><p className="text-muted-foreground">Em {format(new Date(comodatoSelecionado.assinatura_em), "dd/MM/yyyy HH:mm")}. A cópia assinada não pode ser alterada.</p></> : <><p className="font-medium">Aguardando assinatura</p><p className="text-muted-foreground">O cliente pode assinar com o dedo neste aparelho antes ou depois da entrega.</p></>}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => { setComodatoSelecionadoId(null); imprimirComprovante(comodatoSelecionado); }}><Printer className="mr-2 h-4 w-4" />Ver {comodatoSelecionado.assinatura_pdf_path ? "termo assinado" : "comprovante"}</Button>
                {!comodatoSelecionado.assinatura_pdf_path && <Button onClick={() => { setNomeAssinante(comodatoSelecionado.responsavel_entrega || comodatoSelecionado.clientes?.nome || ""); setAceiteAssinatura(false); setComodatoSelecionadoId(null); setAssinaturaComodatoId(comodatoSelecionado.id); }}><PenLine className="mr-2 h-4 w-4" />Assinar no celular</Button>}
                {comodatoSelecionado.status === "ativo" && <Button variant="secondary" onClick={() => { abrirDevolucao(comodatoSelecionado); setComodatoSelecionadoId(null); }}><RotateCcw className="mr-2 h-4 w-4" />Registrar devolução</Button>}
              </div>
            </div>}
          </DialogContent>
        </Dialog>
        <Dialog open={!!assinaturaComodatoId} onOpenChange={(open) => { if (!open && !salvandoAssinatura) setAssinaturaComodatoId(null); }}>
          <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
            <DialogHeader><DialogTitle>Assinar termo de comodato</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{comodatoParaAssinar?.clientes?.nome} · {comodatoParaAssinar?.quantidade} {comodatoParaAssinar?.produtos?.nome}. A assinatura será inserida no PDF e o documento ficará guardado sem possibilidade de substituição.</p>
            <div className="space-y-2"><Label htmlFor="nome-assinante-comodato">Nome de quem assina *</Label><Input id="nome-assinante-comodato" value={nomeAssinante} onChange={(e) => setNomeAssinante(e.target.value)} /></div>
            <div className="space-y-2"><Label>Assinatura com o dedo *</Label><div ref={assinaturaContainerRef} className="overflow-hidden rounded-xl border bg-white touch-none"><SignatureCanvas ref={assinaturaRef} penColor="#172554" canvasProps={{ className: "block h-[190px] w-full bg-white", style: { touchAction: "none" } }} /></div><Button variant="ghost" size="sm" onClick={() => assinaturaRef.current?.clear()}><RotateCcw className="mr-1 h-4 w-4" />Limpar assinatura</Button></div>
            <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm"><input type="checkbox" checked={aceiteAssinatura} onChange={(e) => setAceiteAssinatura(e.target.checked)} className="mt-1" /><span>Li o termo e confirmo o empréstimo dos vasilhames, o prazo de devolução e o custo de reposição apenas em caso de perda ou não devolução. Esta é uma assinatura eletrônica manuscrita, não uma assinatura com certificado ICP-Brasil.</span></label>
            <div className="flex justify-end gap-2"><Button variant="outline" disabled={salvandoAssinatura} onClick={() => setAssinaturaComodatoId(null)}>Cancelar</Button><Button disabled={salvandoAssinatura} onClick={assinarComodato}>{salvandoAssinatura ? "Salvando termo..." : "Confirmar e assinar"}</Button></div>
          </DialogContent>
        </Dialog>
        <Dialog open={!!comprovante} onOpenChange={(open) => { if (!open) fecharComprovante(); }}>
          <DialogContent className="flex h-[90dvh] max-w-4xl flex-col overflow-hidden p-4 sm:p-6">
            <DialogHeader><DialogTitle>Comprovante do comodato</DialogTitle></DialogHeader>
            {comprovante?.carregando && <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Preparando documento...</div>}
            {comprovante?.erro && <div className="flex flex-1 items-center justify-center text-sm text-destructive">{comprovante.erro}</div>}
            {comprovante?.url && <>
              <iframe title="Prévia do comprovante de comodato" src={comprovante.url} className="min-h-0 w-full flex-1 rounded-lg border" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={fecharComprovante}>Fechar</Button>
                <Button asChild><a href={comprovante.url} download={comprovante.nome}>Baixar PDF</a></Button>
                <Button asChild variant="secondary"><a href={comprovante.url} target="_blank" rel="noopener noreferrer">Abrir para imprimir</a></Button>
              </div>
            </>}
          </DialogContent>
        </Dialog>
        <Dialog open={!!devolucao} onOpenChange={(open) => { if (!open) setDevolucao(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Receber vasilhames</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{devolucao?.nome} · {devolucao?.pendente} pendente(s). Você pode receber apenas parte agora.</p>
            <div className="grid gap-2"><Label>Quantidade recebida</Label><Input type="number" min="1" max={devolucao?.pendente} value={qtdDevolucao} onChange={(e) => setQtdDevolucao(e.target.value)} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDevolucao(null)}>Cancelar</Button><Button onClick={() => devolverComodato.mutate()} disabled={devolverComodato.isPending}>Confirmar devolução</Button></div>
          </DialogContent>
        </Dialog>
        <EstoquePageHeader
          title="Vasilhames em comodato"
          description="Empréstimos ativos, prazos e custo de reposição por cliente"
          actions={
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo Comodato</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto p-0">
                <div className="border-b bg-gradient-to-r from-primary/10 to-background px-5 py-5 sm:px-7">
                  <DialogHeader>
                    <DialogTitle className="text-xl">Novo comodato de vasilhame</DialogTitle>
                    <p className="text-sm text-muted-foreground">Registre a saída do vazio e acompanhe a devolução ao estoque.</p>
                  </DialogHeader>
                </div>
                <div className="grid gap-5 px-5 py-5 sm:px-7">
                  <div className="grid gap-2">
                    <Label>Tipo de comodato</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => setForm({ ...form, modalidade: "rapido", prazo_dias: "2" })} className={`rounded-xl border p-4 text-left transition-colors ${form.modalidade === "rapido" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                        <Zap className="mb-2 h-5 w-5 text-primary" /><span className="block font-semibold">Empréstimo rápido</span><span className="block text-xs text-muted-foreground">Comprovante simples, devolução em poucos dias.</span>
                      </button>
                      <button type="button" onClick={() => setForm({ ...form, modalidade: "formal", prazo_dias: "90" })} className={`rounded-xl border p-4 text-left transition-colors ${form.modalidade === "formal" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                        <FileText className="mb-2 h-5 w-5 text-primary" /><span className="block font-semibold">Comodato formal</span><span className="block text-xs text-muted-foreground">Dados para termo completo, prazo e responsável.</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Cliente *</Label>
                    <ClienteAutocompleteInput
                      value={clienteNome}
                      placeholder="Digite nome, telefone ou endereço..."
                      onChange={(nome, cliente) => {
                        setClienteNome(nome);
                        setForm((f) => ({ ...f, cliente_id: cliente?.id || "" }));
                      }}
                    />
                    {clienteNome.trim().length >= 2 && !form.cliente_id && <p className="text-xs text-muted-foreground">Selecione um cliente da lista.</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label>Vasilhame vazio *</Label>
                    <Select value={form.produto_id} onValueChange={(v) => {
                      const produto = produtos.find((p: any) => p.id === v);
                      setForm({ ...form, produto_id: v, deposito: Number(produto?.preco_custo || 0).toFixed(2) });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecione o vasilhame" /></SelectTrigger>
                      <SelectContent>
                        {produtos.map((p: any) => <SelectItem key={p.id} value={p.id} disabled={Number(p.estoque || 0) < 1}>{p.nome} · {p.estoque || 0} disponíveis</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.produto_id && <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm"><Package className="h-4 w-4 text-primary" /> Saldo disponível: <strong>{produtos.find((p: any) => p.id === form.produto_id)?.estoque || 0} vazios</strong></div>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>Quantidade</Label>
                      <Input type="number" min="1" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Custo de reposição por vasilhame (R$)</Label>
                      <Input type="number" min="0" step="0.01" value={form.deposito} onChange={(e) => setForm({ ...form, deposito: e.target.value })} />
                      <p className="text-xs text-muted-foreground">Sugerido pelo custo cadastrado no produto. Ajuste se necessário; não há cobrança agora.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label>Prazo de devolução (dias)</Label>
                      <Input type="number" min="1" value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} />
                    </div>
                  </div>
                  {form.modalidade === "formal" && <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                    <div className="grid gap-2"><Label>Responsável pelo recebimento *</Label><Input value={form.responsavel_entrega} onChange={(e) => setForm({ ...form, responsavel_entrega: e.target.value })} placeholder="Nome de quem receberá" /></div>
                    <div className="grid gap-2"><Label>Documento ou referência</Label><Input value={form.documento_referencia} onChange={(e) => setForm({ ...form, documento_referencia: e.target.value })} placeholder="CPF/CNPJ ou nº do contrato" /></div>
                    <div className="grid gap-2 sm:col-span-2"><Label>Local de entrega *</Label><Input value={form.local_entrega} onChange={(e) => setForm({ ...form, local_entrega: e.target.value })} placeholder="Endereço ou unidade de instalação" /></div>
                    <div className="grid gap-2 sm:col-span-2"><Label>Finalidade</Label><Input value={form.finalidade} onChange={(e) => setForm({ ...form, finalidade: e.target.value })} placeholder="Ex.: abastecimento da cozinha" /></div>
                  </div>}
                  <div className="grid gap-2">
                    <Label>Observações sobre o vasilhame</Label>
                    <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Estado de conservação, identificação, combinação de retirada..." />
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><Info className="mr-2 inline h-4 w-4" />Ao registrar, o sistema retira {form.quantidade || 0} vasilhame(s) vazio(s) do estoque. Na devolução, repõe apenas os recebidos.</div>
                  <p className="text-xs text-muted-foreground">Em caso de perda ou não devolução, o termo informa um custo estimado de R$ {(Number(form.deposito || 0) * Number(form.quantidade || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Este registro não cria recebimento no caixa.</p>
                  <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={() => criarComodato.mutate()} disabled={!form.cliente_id || !form.produto_id || criarComodato.isPending}>{criarComodato.isPending ? "Registrando..." : "Registrar e baixar do estoque"}</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        {/* KPIs */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <EstoqueKpiCard icon={Package} label="Vasilhames Emprestados" value={totalQtd} tone="primary" />
          <EstoqueKpiCard icon={Users} label="Clientes" value={clientesUnicos} tone="info" />
          <EstoqueKpiCard icon={AlertTriangle} label="Vencidos" value={vencidos} tone={vencidos > 0 ? "destructive" : "secondary"} />
          <EstoqueKpiCard icon={CheckCircle} label="Reposição em aberto" value={`R$ ${custoReposicaoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="secondary" />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar cliente ou produto..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="devolvido">Devolvidos</SelectItem>
            </SelectContent>
          </Select>
        </div>


        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Comodatos ({filtrados.length})</CardTitle></CardHeader>
          <CardContent className="px-3 sm:px-6">
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtrados.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum comodato encontrado</p>}
              {filtrados.map((c: any) => {
                const vencido = c.status === "ativo" && c.prazo_devolucao && parseLocalDate(c.prazo_devolucao) < new Date();
                const diasRestantes = c.prazo_devolucao ? differenceInDays(parseLocalDate(c.prazo_devolucao), new Date()) : null;
                return (
                  <div key={c.id} className={`border rounded-lg p-3 ${vencido ? "border-destructive/30 bg-destructive/5" : ""}`}>
                    <button type="button" className="block w-full text-left" onClick={() => setComodatoSelecionadoId(c.id)} aria-label={`Ver detalhes do comodato de ${c.clientes?.nome || "cliente"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.clientes?.nome || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.produtos?.nome || "—"} · {c.modalidade === "rapido" ? "Rápido" : "Formal"}</p>
                        <p className="text-xs text-muted-foreground">{c.quantidade - Number(c.quantidade_devolvida || 0)} de {c.quantidade} pendente(s)</p>
                      </div>
                      {c.status === "ativo" ? (vencido ? <Badge variant="destructive" className="text-xs shrink-0">Vencido</Badge> : <Badge className="text-xs shrink-0">Ativo</Badge>) : <Badge variant="secondary" className="text-xs shrink-0">Devolvido</Badge>}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>Reposição: R$ {Number(c.deposito || 0).toFixed(2)} / un.</span>
                      <span>Prazo: {c.prazo_devolucao ? format(parseLocalDate(c.prazo_devolucao), "dd/MM/yy") : "—"}{diasRestantes !== null && c.status === "ativo" && ` (${diasRestantes > 0 ? `${diasRestantes}d` : `${Math.abs(diasRestantes)}d atrás`})`}</span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-primary">Toque para ver compras, devoluções e assinatura</p>
                    </button>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => imprimirComprovante(c)}><Printer className="mr-1 h-3.5 w-3.5" /> {c.modalidade === "rapido" ? "Comprovante" : "Termo"}</Button>
                      {c.status === "ativo" && <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirDevolucao(c)} disabled={devolverComodato.isPending}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Devolver</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vasilhame</TableHead>
                    <TableHead className="text-center">Pendente / total</TableHead>
                    <TableHead className="text-center">Reposição / un.</TableHead>
                    <TableHead>Empréstimo</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum comodato encontrado</TableCell></TableRow>
                  ) : filtrados.map((c: any) => {
                    const vencido = c.status === "ativo" && c.prazo_devolucao && parseLocalDate(c.prazo_devolucao) < new Date();
                    const diasRestantes = c.prazo_devolucao ? differenceInDays(parseLocalDate(c.prazo_devolucao), new Date()) : null;
                    return (
                      <TableRow key={c.id} className={vencido ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{c.clientes?.nome || "—"}</TableCell>
                        <TableCell>{c.produtos?.nome || "—"}</TableCell>
                        <TableCell className="text-center">{c.quantidade - Number(c.quantidade_devolvida || 0)} / {c.quantidade}<span className="block text-xs text-muted-foreground">{c.modalidade === "rapido" ? "Rápido" : "Formal"}</span></TableCell>
                        <TableCell className="text-center">R$ {Number(c.deposito || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-sm">{format(parseLocalDate(c.data_emprestimo), "dd/MM/yy")}</TableCell>
                        <TableCell className="text-sm">
                          {c.prazo_devolucao ? (
                            <span className={vencido ? "text-destructive font-bold" : ""}>
                              {format(parseLocalDate(c.prazo_devolucao), "dd/MM/yy")}
                              {diasRestantes !== null && c.status === "ativo" && (
                                <span className="text-xs ml-1">({diasRestantes > 0 ? `${diasRestantes}d` : `${Math.abs(diasRestantes)}d atrás`})</span>
                              )}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.status === "ativo" ? (vencido ? <Badge variant="destructive">Vencido</Badge> : <Badge>Ativo</Badge>) : <Badge variant="secondary">Devolvido</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setComodatoSelecionadoId(c.id)}>Detalhes</Button>
                            <Button variant="ghost" size="sm" onClick={() => imprimirComprovante(c)}><Printer className="mr-1 h-3.5 w-3.5" /> {c.modalidade === "rapido" ? "Comprovante" : "Termo"}</Button>
                            {c.status === "ativo" && <Button variant="ghost" size="sm" onClick={() => abrirDevolucao(c)} disabled={devolverComodato.isPending}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Devolver</Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
