import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { AlertTriangle, Brain, CreditCard, Download, Filter, RefreshCw, Search, TrendingUp, X, Trophy, Medal, Crown, UserRound, ShoppingCart, WalletCards } from "lucide-react";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import { normalizeFormaPagamentoKey } from "@/lib/financeiro/formaPagamento";

interface PedidoRelatorio {
  id: string;
  data_entrega: string | null;
  created_at: string;
  valor_total: number | null;
  status: string | null;
  canal_venda: string | null;
  forma_pagamento: string | null;
  entregadores: { nome: string } | null;
  pedido_itens: Array<{
    quantidade: number;
    preco_unitario: number;
    produtos: { id: string; nome: string; preco_custo: number | null } | null;
  }>;
}

type LinhaDetalhe = {
  entregador: string;
  produto: string;
  canal: string;
  qtd: number;
  qtdComCusto: number;
  custoMedio: number;
  vendaMedia: number;
  totalCusto: number;
  totalVenda: number;
  vendaSemCusto: number;
  lucro: number;
  margem: number;
  temCustoIncompleto: boolean;
};

type ResumoEntregador = LinhaDetalhe & {
  participacao: number;
  posicao: number;
};

type ResumoPagamento = {
  chave: string;
  forma: string;
  vendas: number;
  total: number;
  participacao: number;
  ticketMedio: number;
  aReceber: boolean;
  pedidos: Array<{ id: string; data: string; status: string; valor: number }>;
};

const canalLabels: Record<string, string> = {
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  portaria: "Portaria",
  balcao: "Balcão",
  entregador: "Entregador",
  app_cliente: "App Cliente",
  parceiro: "Parceiro",
  importado: "Importado",
  outros: "Outros",
};

const formaPagamentoLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  pix_maquininha: "PIX na maquininha",
  cartao_credito: "Cartão de crédito",
  credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  debito: "Cartão de débito",
  boleto: "Boleto",
  vale_gas: "Vale-gás",
  gas_do_povo: "Gás do Povo",
  fiado: "Fiado / a prazo",
  a_prazo: "A prazo",
  convenio: "Convênio",
  cheque: "Cheque",
  a_definir: "Não informado",
  nao_informado: "Não informado",
};

const normalizarFormaPagamento = (forma: string | null | undefined) => {
  const chave = normalizeFormaPagamentoKey(forma);
  const custom = chave.match(/^custom_(?:avista|aprazo)_(.+)$/);
  const labelCustom = custom?.[1]
    .split("_")
    .filter(Boolean)
    .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
  return { chave, label: formaPagamentoLabels[chave] || labelCustom || chave.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()) };
};

const parseFormasPagamento = (raw: string | null | undefined) => {
  const texto = String(raw || "").trim();
  if (!texto) return [{ ...normalizarFormaPagamento(null), valor: null as number | null }];
  const semPrefixo = texto.toLowerCase().startsWith("multiplo:") ? texto.slice("multiplo:".length) : texto;
  const formas = semPrefixo.split(/[,+]/).map((trecho) => {
    const limpo = trecho.replace(/\[[^\]]*\]/g, " ").trim();
    const valorEncontrado = limpo.match(/r\$\s*([\d.,]+)/i);
    const valorTexto = valorEncontrado?.[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const valor = valorTexto && Number.isFinite(Number(valorTexto)) ? Number(valorTexto) : null;
    const forma = limpo.replace(/r\$\s*[\d.,]+/gi, " ").replace(/\s+/g, " ").trim();
    return { ...normalizarFormaPagamento(forma), valor };
  }).filter(item => item.chave && item.chave !== "nao_informado");
  if (!formas.length) return [{ ...normalizarFormaPagamento(null), valor: null as number | null }];

  const consolidadas = new Map<string, (typeof formas)[number]>();
  formas.forEach((forma) => {
    const atual = consolidadas.get(forma.chave);
    if (!atual) consolidadas.set(forma.chave, { ...forma });
    else if (forma.valor != null) atual.valor = (atual.valor || 0) + forma.valor;
  });
  return Array.from(consolidadas.values());
};

const formasAReceber = new Set(["fiado", "a_prazo", "convenio", "boleto"]);
const formaEhAReceber = (chave: string) => formasAReceber.has(chave) || chave.startsWith("custom_aprazo_");

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const dataPedido = (pedido: PedidoRelatorio) => pedido.data_entrega?.slice(0, 10) || pedido.created_at?.slice(0, 10) || "";

function MultiSelectFiltro({ titulo, opcoes, selecionados, onChange }: {
  titulo: string;
  opcoes: string[];
  selecionados: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (opcao: string) => {
    onChange(selecionados.includes(opcao) ? selecionados.filter((v) => v !== opcao) : [...selecionados, opcao]);
  };
  const label = selecionados.length === 0 ? "Todos" : selecionados.length === 1 ? selecionados[0] : `${selecionados.length} selecionados`;

  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs">{titulo}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-10 justify-between font-normal min-w-0">
            <span className="truncate">{label}</span>
            {selecionados.length > 0 && <Badge variant="secondary" className="ml-2 shrink-0">{selecionados.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2" align="start">
          <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b">
            <span className="text-sm font-medium">{titulo}</span>
            {selecionados.length > 0 && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onChange([])}>Limpar</Button>}
          </div>
          <div className="max-h-64 overflow-y-auto py-1 space-y-1">
            {opcoes.length === 0 ? <p className="text-sm text-muted-foreground px-2 py-3">Sem opções</p> : opcoes.map((opcao) => (
              <label key={opcao} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted cursor-pointer">
                <input type="checkbox" checked={selecionados.includes(opcao)} onChange={() => toggle(opcao)} className="h-4 w-4" />
                <span className="truncate">{opcao}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function RelatorioDetalhadoVendas() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [entregadoresSelecionados, setEntregadoresSelecionados] = useState<string[]>([]);
  const [canaisSelecionados, setCanaisSelecionados] = useState<string[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [entregadorAberto, setEntregadorAberto] = useState<ResumoEntregador | null>(null);
  const [produtoAberto, setProdutoAberto] = useState<LinhaDetalhe | null>(null);
  const [formaPagamentoAberta, setFormaPagamentoAberta] = useState<string | null>(null);

  const { data: pedidos = [], isLoading, refetch } = useQuery({
    queryKey: ["relatorio-vendas-unificado", unidadeAtual?.id, dataInicio, dataFim],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const inicioCriacao = `${dataInicio}T00:00:00`;
      const fimCriacao = `${dataFim}T23:59:59`;
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id, data_entrega, created_at, valor_total, status, canal_venda, forma_pagamento,
          entregadores (nome),
          pedido_itens (quantidade, preco_unitario, produtos (id, nome, preco_custo))
        `)
        .eq("unidade_id", unidadeAtual!.id)
        .neq("status", "cancelado")
        .or(`and(data_entrega.gte.${dataInicio},data_entrega.lte.${dataFim}),and(created_at.gte.${inicioCriacao},created_at.lte.${fimCriacao})`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as PedidoRelatorio[]).filter((pedido) => {
        const d = dataPedido(pedido);
        return d >= dataInicio && d <= dataFim;
      });
    },
  });

  const novaLinha = (entregador: string, produto: string, canal: string): LinhaDetalhe => ({
    entregador, produto, canal,
    qtd: 0, qtdComCusto: 0, custoMedio: 0, vendaMedia: 0,
    totalCusto: 0, totalVenda: 0, vendaSemCusto: 0, lucro: 0, margem: 0,
    temCustoIncompleto: false,
  });

  const finalizarLinha = (l: LinhaDetalhe): LinhaDetalhe => {
    // Base = apenas a venda cujos itens têm custo cadastrado.
    // Assim, itens sem preco_custo NÃO inflam lucro nem margem.
    const baseMargem = l.totalVenda - l.vendaSemCusto;
    const lucro = baseMargem > 0 ? baseMargem - l.totalCusto : 0;
    return {
      ...l,
      custoMedio: l.qtdComCusto ? l.totalCusto / l.qtdComCusto : 0,
      vendaMedia: l.qtd ? l.totalVenda / l.qtd : 0,
      lucro,
      margem: baseMargem > 0 ? (lucro / baseMargem) * 100 : 0,
      temCustoIncompleto: l.vendaSemCusto > 0,
    };
  };

  const produtosSemCusto = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach((p) => p.pedido_itens?.forEach((i) => {
      const custo = Number(i.produtos?.preco_custo) || 0;
      if (custo <= 0 && i.produtos?.nome) set.add(i.produtos.nome);
    }));
    return Array.from(set).sort();
  }, [pedidos]);

  const linhas = useMemo<LinhaDetalhe[]>(() => {
    const map = new Map<string, LinhaDetalhe>();
    pedidos.forEach((pedido) => {
      const entregador = pedido.entregadores?.nome || "Sem entregador";
      const canalKey = pedido.canal_venda || "outros";
      const canal = canalLabels[canalKey] || canalKey;
      pedido.pedido_itens?.forEach((item) => {
        const produto = item.produtos?.nome || "Produto sem nome";
        const qtd = Number(item.quantidade) || 0;
        const vendaUnit = Number(item.preco_unitario) || 0;
        const custoUnit = Number(item.produtos?.preco_custo) || 0;
        const key = `${entregador}|||${produto}|||${canal}`;
        const atual = map.get(key) || novaLinha(entregador, produto, canal);
        atual.qtd += qtd;
        atual.totalVenda += qtd * vendaUnit;
        if (custoUnit > 0) {
          atual.qtdComCusto += qtd;
          atual.totalCusto += qtd * custoUnit;
        } else {
          atual.vendaSemCusto += qtd * vendaUnit;
        }
        map.set(key, atual);
      });
    });
    return Array.from(map.values()).map(finalizarLinha).sort((a, b) => b.totalVenda - a.totalVenda);
  }, [pedidos]);

  const opcoesEntregador = useMemo(() => Array.from(new Set(linhas.map(l => l.entregador))).sort(), [linhas]);
  const opcoesProduto = useMemo(() => Array.from(new Set(linhas.map(l => l.produto))).sort(), [linhas]);
  const opcoesCanal = useMemo(() => Array.from(new Set(linhas.map(l => l.canal))).sort(), [linhas]);

  const filtradas = useMemo(() => linhas.filter(l => {
    if (entregadoresSelecionados.length > 0 && !entregadoresSelecionados.includes(l.entregador)) return false;
    if (canaisSelecionados.length > 0 && !canaisSelecionados.includes(l.canal)) return false;
    if (produtosSelecionados.length > 0 && !produtosSelecionados.includes(l.produto)) return false;
    if (busca && !`${l.entregador} ${l.produto} ${l.canal}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [linhas, entregadoresSelecionados, canaisSelecionados, produtosSelecionados, busca]);

  const resumo = useMemo(() => {
    const qtd = filtradas.reduce((s, l) => s + l.qtd, 0);
    const totalVenda = filtradas.reduce((s, l) => s + l.totalVenda, 0);
    const totalCusto = filtradas.reduce((s, l) => s + l.totalCusto, 0);
    const vendaSemCusto = filtradas.reduce((s, l) => s + l.vendaSemCusto, 0);
    const baseMargem = totalVenda - vendaSemCusto;
    const lucro = baseMargem > 0 ? baseMargem - totalCusto : 0;
    return { qtd, totalVenda, totalCusto, lucro, vendaMedia: qtd ? totalVenda / qtd : 0, margem: baseMargem > 0 ? (lucro / baseMargem) * 100 : 0 };
  }, [filtradas]);

  // Os cards de faturamento e a aba de pagamentos precisam respeitar os mesmos
  // filtros aplicados ao detalhamento por item.
  const pedidosFiltrados = useMemo(() => pedidos.filter((pedido) => {
    const entregador = pedido.entregadores?.nome || "Sem entregador";
    const canalKey = pedido.canal_venda || "outros";
    const canal = canalLabels[canalKey] || canalKey;
    if (entregadoresSelecionados.length > 0 && !entregadoresSelecionados.includes(entregador)) return false;
    if (canaisSelecionados.length > 0 && !canaisSelecionados.includes(canal)) return false;
    const produtosPedido = (pedido.pedido_itens || []).map(i => i.produtos?.nome || "Produto sem nome");
    if (produtosSelecionados.length > 0 && !produtosPedido.some(p => produtosSelecionados.includes(p))) return false;
    if (busca) {
      const alvo = `${entregador} ${produtosPedido.join(" ")} ${canal}`.toLowerCase();
      if (!alvo.includes(busca.toLowerCase())) return false;
    }
    return true;
  }), [pedidos, entregadoresSelecionados, canaisSelecionados, produtosSelecionados, busca]);

  const resumoPagamentos = useMemo<ResumoPagamento[]>(() => {
    const mapa = new Map<string, Omit<ResumoPagamento, "participacao" | "ticketMedio">>();
    pedidosFiltrados.forEach((pedido) => {
      const formasValidas = parseFormasPagamento(pedido.forma_pagamento);
      const valorPedido = Number(pedido.valor_total) || (pedido.pedido_itens || []).reduce(
        (total, item) => total + (Number(item.quantidade) || 0) * (Number(item.preco_unitario) || 0), 0,
      );
      const totalInformado = formasValidas.reduce((soma, forma) => soma + (forma.valor || 0), 0);
      const semValor = formasValidas.filter(forma => forma.valor == null).length;
      const saldoSemForma = Math.max(valorPedido - totalInformado, 0);
      formasValidas.forEach(({ chave, label, valor }) => {
        // Os fluxos mais novos persistem o valor de cada forma no próprio texto.
        // Para registros legados sem valor, somente o saldo é dividido entre elas.
        const valorPorForma = valor ?? (semValor ? saldoSemForma / semValor : 0);
        const atual = mapa.get(chave) || {
          chave,
          forma: label,
          vendas: 0,
          total: 0,
          aReceber: formaEhAReceber(chave),
          pedidos: [],
        };
        atual.vendas += 1;
        atual.total += valorPorForma;
        atual.pedidos.push({
          id: pedido.id,
          data: dataPedido(pedido),
          status: pedido.status || "não informado",
          valor: valorPorForma,
        });
        mapa.set(chave, atual);
      });
    });
    const total = Array.from(mapa.values()).reduce((soma, item) => soma + item.total, 0);
    return Array.from(mapa.values())
      .map(item => ({
        ...item,
        participacao: total ? item.total / total * 100 : 0,
        ticketMedio: item.vendas ? item.total / item.vendas : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  const totaisPagamentos = useMemo(() => {
    const total = resumoPagamentos.reduce((soma, item) => soma + item.total, 0);
    const aReceber = resumoPagamentos.filter(item => item.aReceber).reduce((soma, item) => soma + item.total, 0);
    return { total, aReceber, recebido: total - aReceber };
  }, [resumoPagamentos]);

  const agregado = (campo: "entregador" | "produto" | "canal") => {
    const map = new Map<string, LinhaDetalhe>();
    filtradas.forEach(l => {
      const nome = l[campo];
      const atual = map.get(nome) || novaLinha(nome, nome, nome);
      atual.qtd += l.qtd;
      atual.qtdComCusto += l.qtdComCusto;
      atual.totalVenda += l.totalVenda;
      atual.totalCusto += l.totalCusto;
      atual.vendaSemCusto += l.vendaSemCusto;
      map.set(nome, atual);
    });
    return Array.from(map.values()).map(finalizarLinha).sort((a, b) => b.totalVenda - a.totalVenda);
  };

  const rankingEntregadores = useMemo<ResumoEntregador[]>(() => agregado("entregador").map((l, index) => ({
    ...l,
    participacao: resumo.totalVenda ? (l.totalVenda / resumo.totalVenda) * 100 : 0,
    posicao: index + 1,
  })), [filtradas, resumo.totalVenda]);

  const detalhesSelecionado = useMemo(() => {
    if (!entregadorAberto) return null;
    const dados = filtradas.filter(l => l.entregador === entregadorAberto.entregador);
    const porProduto = new Map<string, LinhaDetalhe>();
    const porCanal = new Map<string, LinhaDetalhe>();
    dados.forEach(l => {
      const prod = porProduto.get(l.produto) || novaLinha(l.entregador, l.produto, l.canal);
      prod.qtd += l.qtd; prod.qtdComCusto += l.qtdComCusto; prod.totalCusto += l.totalCusto; prod.totalVenda += l.totalVenda; prod.vendaSemCusto += l.vendaSemCusto;
      porProduto.set(l.produto, prod);
      const canal = porCanal.get(l.canal) || novaLinha(l.entregador, l.produto, l.canal);
      canal.qtd += l.qtd; canal.qtdComCusto += l.qtdComCusto; canal.totalCusto += l.totalCusto; canal.totalVenda += l.totalVenda; canal.vendaSemCusto += l.vendaSemCusto;
      porCanal.set(l.canal, canal);
    });
    const finalizar = (list: LinhaDetalhe[]) => list.map(finalizarLinha).sort((a, b) => b.totalVenda - a.totalVenda);
    return { produtos: finalizar(Array.from(porProduto.values())), canais: finalizar(Array.from(porCanal.values())) };
  }, [entregadorAberto, filtradas]);

  const detalhesProduto = useMemo(() => {
    if (!produtoAberto) return null;
    const dados = linhas.filter(l => l.produto === produtoAberto.produto);
    const porEntregador = new Map<string, LinhaDetalhe>();
    const porCanal = new Map<string, LinhaDetalhe>();
    dados.forEach(l => {
      const ent = porEntregador.get(l.entregador) || novaLinha(l.entregador, l.produto, l.canal);
      ent.qtd += l.qtd; ent.qtdComCusto += l.qtdComCusto; ent.totalCusto += l.totalCusto; ent.totalVenda += l.totalVenda; ent.vendaSemCusto += l.vendaSemCusto;
      porEntregador.set(l.entregador, ent);
      const cnl = porCanal.get(l.canal) || novaLinha(l.entregador, l.produto, l.canal);
      cnl.qtd += l.qtd; cnl.qtdComCusto += l.qtdComCusto; cnl.totalCusto += l.totalCusto; cnl.totalVenda += l.totalVenda; cnl.vendaSemCusto += l.vendaSemCusto;
      porCanal.set(l.canal, cnl);
    });
    const totais = dados.reduce((acc, l) => {
      acc.qtd += l.qtd; acc.qtdComCusto += l.qtdComCusto; acc.totalCusto += l.totalCusto; acc.totalVenda += l.totalVenda; acc.vendaSemCusto += l.vendaSemCusto;
      return acc;
    }, novaLinha("", produtoAberto.produto, ""));
    const finalizar = (list: LinhaDetalhe[]) => list.map(finalizarLinha).sort((a, b) => b.totalVenda - a.totalVenda);
    return {
      entregadores: finalizar(Array.from(porEntregador.values())),
      canais: finalizar(Array.from(porCanal.values())),
      totais: finalizarLinha(totais),
    };
  }, [produtoAberto, linhas]);

  const limparFiltros = () => { setEntregadoresSelecionados([]); setCanaisSelecionados([]); setProdutosSelecionados([]); setBusca(""); };
  const filtrosAtivos = entregadoresSelecionados.length + canaisSelecionados.length + produtosSelecionados.length + (busca ? 1 : 0);

  const insights = useMemo(() => {
    const porEntregador = rankingEntregadores;
    const porProduto = agregado("produto");
    const porCanal = agregado("canal");
    const topEnt = porEntregador[0]; const topProd = porProduto[0]; const topCanal = porCanal[0];
    const baixaMargem = filtradas.filter(l => l.totalVenda > 0 && l.margem < 20).slice(0, 3);
    return [
      topProd ? `Produto destaque: ${topProd.produto} com ${topProd.qtd.toLocaleString("pt-BR")} unidades e ${money(topProd.totalVenda)}.` : null,
      topEnt ? `Entregador destaque: ${topEnt.entregador} faturou ${money(topEnt.totalVenda)} e representa ${pct(topEnt.participacao)} das vendas.` : null,
      topCanal ? `Canal destaque: ${topCanal.canal} representa ${pct(resumo.totalVenda ? topCanal.totalVenda / resumo.totalVenda * 100 : 0)} do faturamento filtrado.` : null,
      baixaMargem.length ? `Atenção: ${baixaMargem.map(l => `${l.produto}/${l.entregador}/${l.canal}`).join("; ")} com margem abaixo de 20%.` : null,
    ].filter(Boolean) as string[];
  }, [filtradas, resumo.totalVenda, rankingEntregadores]);

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoPagamentos.map(item => ({
      "Forma de pagamento": item.forma,
      "Quantidade de vendas": item.vendas,
      "Valor total": item.total,
      "Participação %": item.participacao,
      "Ticket médio": item.ticketMedio,
      "Situação financeira": item.aReceber ? "A receber" : "Recebido",
    }))), "Formas de pagamento");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtradas.map(l => ({ Entregador: l.entregador, Produto: l.produto, Canal: l.canal, Quantidade: l.qtd, "Custo Médio": l.custoMedio, "Preço Médio Venda": l.vendaMedia, "Total Custo": l.totalCusto, "Total Venda": l.totalVenda, Lucro: l.lucro, "Margem %": l.margem }))), "Detalhado");
    XLSX.writeFile(wb, `relatorio-vendas-${dataInicio}-${dataFim}.xlsx`);
    toast({ title: "Relatório exportado" });
  };

  const ResumoFormasPagamento = () => {
    const selecionada = resumoPagamentos.find(item => item.chave === formaPagamentoAberta);
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-primary/20"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Faturamento do período</p><p className="text-xl font-bold">{money(totaisPagamentos.total)}</p><p className="text-xs text-muted-foreground mt-1">{pedidosFiltrados.length.toLocaleString("pt-BR")} vendas</p></CardContent></Card>
          <Card className="border-success/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recebido / à vista</p><p className="text-xl font-bold text-success">{money(totaisPagamentos.recebido)}</p><p className="text-xs text-muted-foreground mt-1">{pct(totaisPagamentos.total ? totaisPagamentos.recebido / totaisPagamentos.total * 100 : 0)} do total</p></CardContent></Card>
          <Card className="border-warning/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">A receber / a prazo</p><p className="text-xl font-bold text-warning">{money(totaisPagamentos.aReceber)}</p><p className="text-xs text-muted-foreground mt-1">{pct(totaisPagamentos.total ? totaisPagamentos.aReceber / totaisPagamentos.total * 100 : 0)} do total</p></CardContent></Card>
        </div>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary" />Resumo por forma de pagamento</CardTitle></CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : resumoPagamentos.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem vendas no período selecionado.</p> : <div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Forma de pagamento</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Valor total</TableHead><TableHead className="text-right">Participação</TableHead><TableHead className="text-right">Ticket médio</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader><TableBody>{resumoPagamentos.map(item => <TableRow key={item.chave} className="cursor-pointer hover:bg-muted/60" onClick={() => setFormaPagamentoAberta(atual => atual === item.chave ? null : item.chave)}><TableCell><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><CreditCard className="h-4 w-4" /></div><div className="min-w-[180px]"><p className="font-medium">{item.forma}</p><div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(item.participacao, 2)}%` }} /></div></div></div></TableCell><TableCell className="text-right">{item.vendas.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right font-semibold">{money(item.total)}</TableCell><TableCell className="text-right">{pct(item.participacao)}</TableCell><TableCell className="text-right">{money(item.ticketMedio)}</TableCell><TableCell><Badge variant={item.aReceber ? "outline" : "secondary"}>{item.aReceber ? "A receber" : "Recebido"}</Badge></TableCell></TableRow>)}<TableRow className="bg-muted/50 font-bold"><TableCell>Total</TableCell><TableCell className="text-right">{pedidosFiltrados.length.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">{money(totaisPagamentos.total)}</TableCell><TableCell className="text-right">100,0%</TableCell><TableCell className="text-right">{money(pedidosFiltrados.length ? totaisPagamentos.total / pedidosFiltrados.length : 0)}</TableCell><TableCell>—</TableCell></TableRow></TableBody></Table></div>}
          </CardContent>
        </Card>
        {selecionada && <Card className="border-primary/25"><CardHeader className="pb-3"><CardTitle className="text-base">Vendas em {selecionada.forma}</CardTitle></CardHeader><CardContent className="p-0 sm:p-6 sm:pt-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor atribuído</TableHead></TableRow></TableHeader><TableBody>{selecionada.pedidos.map(pedido => <TableRow key={pedido.id}><TableCell>{pedido.data ? format(new Date(`${pedido.data}T00:00:00`), "dd/MM/yyyy") : "—"}</TableCell><TableCell><Badge variant="outline">{pedido.status.replace(/_/g, " ")}</Badge></TableCell><TableCell className="text-right font-medium">{money(pedido.valor)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}
      </div>
    );
  };

  const TabelaDetalhada = () => (
    <Card><CardHeader className="pb-3"><CardTitle className="text-base">Entregador x Produto x Canal</CardTitle></CardHeader><CardContent className="p-0 sm:p-6 sm:pt-0">
      {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : filtradas.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados para os filtros selecionados.</p> : <div className="overflow-x-auto"><Table className="min-w-[980px]"><TableHeader><TableRow><TableHead>Entregador</TableHead><TableHead>Produto</TableHead><TableHead>Canal</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Custo médio</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total venda</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader><TableBody>{filtradas.map((l, i) => <TableRow key={`det-${i}`}><TableCell className="font-medium whitespace-nowrap">{l.entregador}</TableCell><TableCell>{l.produto}</TableCell><TableCell>{l.canal}</TableCell><TableCell className="text-right">{l.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">{l.custoMedio > 0 ? money(l.custoMedio) : <span className="text-xs text-muted-foreground italic">sem custo</span>}</TableCell><TableCell className="text-right">{money(l.vendaMedia)}</TableCell><TableCell className="text-right font-semibold">{money(l.totalVenda)}</TableCell><TableCell className="text-right text-success">{l.custoMedio > 0 ? money(l.lucro) : "—"}</TableCell><TableCell className="text-right">{l.custoMedio > 0 ? <Badge variant={l.margem < 20 ? "destructive" : "secondary"}>{pct(l.margem)}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell></TableRow>)}<TableRow className="bg-muted/50 font-bold"><TableCell colSpan={3}>Total</TableCell><TableCell className="text-right">{resumo.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">—</TableCell><TableCell className="text-right">{money(resumo.vendaMedia)}</TableCell><TableCell className="text-right">{money(resumo.totalVenda)}</TableCell><TableCell className="text-right text-success">{money(resumo.lucro)}</TableCell><TableCell className="text-right">{pct(resumo.margem)}</TableCell></TableRow></TableBody></Table></div>}
    </CardContent></Card>
  );

  const TabelaResumo = ({ rows, titulo, campo }: { rows: LinhaDetalhe[]; titulo: string; campo: "produto" | "canal" }) => {
    const totQtd = rows.reduce((s, r) => s + r.qtd, 0);
    const totVenda = rows.reduce((s, r) => s + r.totalVenda, 0);
    const totCusto = rows.reduce((s, r) => s + r.totalCusto, 0);
    const totSemCusto = rows.reduce((s, r) => s + r.vendaSemCusto, 0);
    const baseTot = totVenda - totSemCusto;
    const totLucro = baseTot > 0 ? baseTot - totCusto : 0;
    return (
    <Card><CardHeader className="pb-3"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader><CardContent className="p-0 sm:p-6 sm:pt-0">
      {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p> : <div className="overflow-x-auto"><Table className="min-w-[720px]"><TableHeader><TableRow><TableHead>{campo === "produto" ? "Produto" : "Canal"}</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Custo médio</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Lucro</TableHead></TableRow></TableHeader><TableBody>{rows.map((l, i) => <TableRow key={`${campo}-${i}`} className={campo === "produto" ? "cursor-pointer hover:bg-muted/60" : ""} onClick={campo === "produto" ? () => setProdutoAberto(l) : undefined}><TableCell className="font-medium">{campo === "produto" ? l.produto : l.canal}{l.temCustoIncompleto && <Badge variant="outline" className="ml-2 text-[10px]">custo parcial</Badge>}</TableCell><TableCell className="text-right">{l.qtd}</TableCell><TableCell className="text-right">{l.custoMedio > 0 ? money(l.custoMedio) : <span className="text-xs text-muted-foreground italic">sem custo</span>}</TableCell><TableCell className="text-right">{money(l.vendaMedia)}</TableCell><TableCell className="text-right font-semibold">{money(l.totalVenda)}</TableCell><TableCell className="text-right text-success">{l.custoMedio > 0 ? money(l.lucro) : "—"}</TableCell></TableRow>)}<TableRow className="bg-muted/50 font-bold"><TableCell>Total</TableCell><TableCell className="text-right">{totQtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">—</TableCell><TableCell className="text-right">{money(totQtd ? totVenda / totQtd : 0)}</TableCell><TableCell className="text-right">{money(totVenda)}</TableCell><TableCell className="text-right text-success">{money(totLucro)}</TableCell></TableRow></TableBody></Table></div>}
    </CardContent></Card>
    );
  };

  const MedalhaIcon = ({ posicao }: { posicao: number }) => posicao === 1 ? <Crown className="h-5 w-5 text-warning" /> : posicao === 2 ? <Medal className="h-5 w-5 text-slate-400" /> : posicao === 3 ? <Medal className="h-5 w-5 text-warning" /> : <span className="text-sm text-muted-foreground">{posicao}º</span>;

  const RankingEntregadores = () => (
    <div className="space-y-4">
      {rankingEntregadores.length > 0 && <div className="grid gap-3 md:grid-cols-3">
        {rankingEntregadores.slice(0, 3).map(e => <Card key={e.entregador} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setEntregadorAberto(e)}><CardContent className="p-4 space-y-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><MedalhaIcon posicao={e.posicao} /><p className="font-semibold truncate">{e.entregador}</p></div><Badge variant="secondary">{pct(e.participacao)}</Badge></div><div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Faturamento</p><p className="font-bold">{money(e.totalVenda)}</p></div><div><p className="text-xs text-muted-foreground">Lucro</p><p className="font-bold text-success">{money(e.lucro)}</p></div><div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-semibold">{e.qtd.toLocaleString("pt-BR")}</p></div><div><p className="text-xs text-muted-foreground">Preço médio</p><p className="font-semibold">{money(e.vendaMedia)}</p></div></div><Button variant="outline" size="sm" className="w-full">Ver análise</Button></CardContent></Card>)}
      </div>}
      <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Ranking por faturamento</CardTitle></CardHeader><CardContent className="p-0 sm:p-6 sm:pt-0"><div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Entregador</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Participação</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader><TableBody>{rankingEntregadores.map(e => <TableRow key={e.entregador} className="cursor-pointer hover:bg-muted/60" onClick={() => setEntregadorAberto(e)}><TableCell><MedalhaIcon posicao={e.posicao} /></TableCell><TableCell className="font-medium">{e.entregador}</TableCell><TableCell className="text-right">{e.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right font-semibold">{money(e.totalVenda)}</TableCell><TableCell className="text-right text-success">{money(e.lucro)}</TableCell><TableCell className="text-right">{pct(e.participacao)}</TableCell><TableCell className="text-right"><Badge variant={e.margem < 20 ? "destructive" : "secondary"}>{pct(e.margem)}</Badge></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>
  );

  return (
    <MainLayout>
      <Header title="Relatório de Vendas" subtitle="Resumo e detalhamento inteligente em uma única tela" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
        <Card><CardContent className="p-3 sm:p-4 space-y-3"><div className="flex items-center justify-between gap-3 flex-wrap"><div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4 text-primary" />Filtros inteligentes</div>{filtrosAtivos > 0 && <Button size="sm" variant="ghost" onClick={limparFiltros}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}</div><div className="grid grid-cols-2 lg:grid-cols-7 gap-2 sm:gap-3"><div className="space-y-1"><Label className="text-xs">Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div><div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div><div className="lg:col-span-1 col-span-2"><MultiSelectFiltro titulo="Entregadores" opcoes={opcoesEntregador} selecionados={entregadoresSelecionados} onChange={setEntregadoresSelecionados} /></div><div className="lg:col-span-1 col-span-2"><MultiSelectFiltro titulo="Produtos" opcoes={opcoesProduto} selecionados={produtosSelecionados} onChange={setProdutosSelecionados} /></div><div className="lg:col-span-1 col-span-2"><MultiSelectFiltro titulo="Canais" opcoes={opcoesCanal} selecionados={canaisSelecionados} onChange={setCanaisSelecionados} /></div><div className="col-span-2 lg:col-span-1 flex items-end"><Button variant="outline" className="w-full" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />Atualizar</Button></div></div><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar entregador, produto ou canal..." value={busca} onChange={e => setBusca(e.target.value)} /></div></CardContent></Card>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3"><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Número de vendas</p><p className="text-xl font-bold">{pedidosFiltrados.length.toLocaleString("pt-BR")}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Itens vendidos</p><p className="text-xl font-bold">{resumo.qtd.toLocaleString("pt-BR")}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Faturamento real</p><p className="text-lg font-bold truncate">{money(totaisPagamentos.total)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Preço médio/item</p><p className="text-lg font-bold truncate">{money(resumo.vendaMedia)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lucro estimado</p><p className="text-lg font-bold text-success truncate">{money(resumo.lucro)}</p></CardContent></Card><Card className="col-span-2 lg:col-span-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Margem média</p><p className="text-xl font-bold">{pct(resumo.margem)}</p></CardContent></Card></div>
        {produtosSemCusto.length > 0 && (
          <Card className="border-warning/60 bg-warning dark:bg-warning/20">
            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-warning dark:text-warning">
                  {produtosSemCusto.length} produto(s) sem preço de custo cadastrado — lucro e margem incompletos.
                </p>
                <p className="text-xs text-warning/80 dark:text-warning/80 truncate" title={produtosSemCusto.join(", ")}>
                  {produtosSemCusto.slice(0, 4).join(", ")}{produtosSemCusto.length > 4 ? ` +${produtosSemCusto.length - 4}` : ""}
                </p>
              </div>
              <Link to="/cadastros/produtos"><Button size="sm" variant="outline">Cadastrar custos</Button></Link>
            </CardContent>
          </Card>
        )}
        <div className="flex justify-end"><Button onClick={exportarExcel}><Download className="h-4 w-4 mr-2" />Exportar Excel</Button></div>
        <Tabs defaultValue="pagamentos" className="space-y-3"><TabsList className="w-full h-auto p-1 grid grid-cols-3 md:grid-cols-6"><TabsTrigger value="pagamentos">Pagamentos</TabsTrigger><TabsTrigger value="produto">Produtos</TabsTrigger><TabsTrigger value="entregador">Entregadores</TabsTrigger><TabsTrigger value="canal">Canais</TabsTrigger><TabsTrigger value="detalhado">Detalhado</TabsTrigger><TabsTrigger value="ia">Inteligência</TabsTrigger></TabsList><TabsContent value="pagamentos"><ResumoFormasPagamento /></TabsContent><TabsContent value="produto"><TabelaResumo rows={agregado("produto")} titulo="Resumo por Produto" campo="produto" /></TabsContent><TabsContent value="entregador"><RankingEntregadores /></TabsContent><TabsContent value="canal"><TabelaResumo rows={agregado("canal")} titulo="Resumo por Canal" campo="canal" /></TabsContent><TabsContent value="detalhado"><TabelaDetalhada /></TabsContent><TabsContent value="ia"><Card className="border-primary/20 bg-primary/5"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Insights automáticos</CardTitle></CardHeader><CardContent className="space-y-2">{insights.length ? insights.map((i, idx) => <div key={idx} className="text-sm flex gap-2"><TrendingUp className="h-4 w-4 text-primary mt-0.5" /><span>{i}</span></div>) : <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar insights.</p>}</CardContent></Card></TabsContent></Tabs>
      </div>

      <Dialog open={!!entregadorAberto} onOpenChange={(open) => !open && setEntregadorAberto(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          {entregadorAberto && detalhesSelecionado && <>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" />{entregadorAberto.entregador}</DialogTitle><DialogDescription>Análise comercial no período selecionado</DialogDescription></DialogHeader>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Quantidade</p><p className="text-xl font-bold">{entregadorAberto.qtd}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Faturamento</p><p className="font-bold">{money(entregadorAberto.totalVenda)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lucro</p><p className="font-bold text-success">{money(entregadorAberto.lucro)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Margem</p><p className="font-bold">{pct(entregadorAberto.margem)}</p></CardContent></Card><Card className="col-span-2 lg:col-span-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Participação</p><p className="font-bold">{pct(entregadorAberto.participacao)}</p></CardContent></Card></div>
            <Tabs defaultValue="produtos" className="space-y-3"><TabsList className="grid grid-cols-3 w-full"><TabsTrigger value="produtos">Produtos</TabsTrigger><TabsTrigger value="canais">Canais</TabsTrigger><TabsTrigger value="financeiro">Financeiro</TabsTrigger></TabsList><TabsContent value="produtos"><TabelaResumo rows={detalhesSelecionado.produtos} titulo="Produtos vendidos" campo="produto" /></TabsContent><TabsContent value="canais"><TabelaResumo rows={detalhesSelecionado.canais} titulo="Canais utilizados" campo="canal" /></TabsContent><TabsContent value="financeiro"><Card><CardContent className="p-4 grid gap-3 sm:grid-cols-2"><div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Venda bruta</span><strong>{money(entregadorAberto.totalVenda)}</strong></div><div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Custo estimado</span><strong>{money(entregadorAberto.totalCusto)}</strong></div><div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Lucro</span><strong className="text-success">{money(entregadorAberto.lucro)}</strong></div><div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Margem</span><strong>{pct(entregadorAberto.margem)}</strong></div></CardContent></Card></TabsContent></Tabs>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!produtoAberto} onOpenChange={(open) => !open && setProdutoAberto(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          {produtoAberto && detalhesProduto && <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" />{produtoAberto.produto}</DialogTitle>
              <DialogDescription>
                Vendas e custos no período {format(new Date(dataInicio + "T00:00:00"), "dd/MM/yyyy")} a {format(new Date(dataFim + "T00:00:00"), "dd/MM/yyyy")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Quantidade</p><p className="text-xl font-bold">{detalhesProduto.totais.qtd.toLocaleString("pt-BR")}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Preço médio</p><p className="font-bold">{money(detalhesProduto.totais.vendaMedia)}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Custo médio</p><p className="font-bold">{detalhesProduto.totais.custoMedio > 0 ? money(detalhesProduto.totais.custoMedio) : <span className="text-xs italic text-muted-foreground">sem custo</span>}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Faturamento</p><p className="font-bold">{money(detalhesProduto.totais.totalVenda)}</p></CardContent></Card>
              <Card className="col-span-2 lg:col-span-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lucro / Margem</p><p className="font-bold text-success">{detalhesProduto.totais.custoMedio > 0 ? `${money(detalhesProduto.totais.lucro)} · ${pct(detalhesProduto.totais.margem)}` : "—"}</p></CardContent></Card>
            </div>
            {detalhesProduto.totais.temCustoIncompleto && (
              <div className="flex items-center gap-2 text-xs text-warning bg-warning dark:bg-warning/20 border border-warning/50 rounded-md p-2">
                <AlertTriangle className="h-4 w-4" />
                Este produto tem vendas sem preço de custo cadastrado — lucro/margem baseados apenas nas unidades com custo conhecido.
              </div>
            )}
            <Tabs defaultValue="entregadores" className="space-y-3">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="entregadores">Por entregador</TabsTrigger>
                <TabsTrigger value="canais">Por canal</TabsTrigger>
              </TabsList>
              <TabsContent value="entregadores">
                <Card><CardContent className="p-0 sm:p-6 sm:pt-0"><div className="overflow-x-auto"><Table className="min-w-[640px]"><TableHeader><TableRow><TableHead>Entregador</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total venda</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader><TableBody>{detalhesProduto.entregadores.map((l, i) => <TableRow key={`pe-${i}`}><TableCell className="font-medium">{l.entregador}</TableCell><TableCell className="text-right">{l.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">{money(l.vendaMedia)}</TableCell><TableCell className="text-right font-semibold">{money(l.totalVenda)}</TableCell><TableCell className="text-right text-success">{l.custoMedio > 0 ? money(l.lucro) : "—"}</TableCell><TableCell className="text-right">{l.custoMedio > 0 ? pct(l.margem) : "—"}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
              </TabsContent>
              <TabsContent value="canais">
                <Card><CardContent className="p-0 sm:p-6 sm:pt-0"><div className="overflow-x-auto"><Table className="min-w-[640px]"><TableHeader><TableRow><TableHead>Canal</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total venda</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader><TableBody>{detalhesProduto.canais.map((l, i) => <TableRow key={`pc-${i}`}><TableCell className="font-medium">{l.canal}</TableCell><TableCell className="text-right">{l.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">{money(l.vendaMedia)}</TableCell><TableCell className="text-right font-semibold">{money(l.totalVenda)}</TableCell><TableCell className="text-right text-success">{l.custoMedio > 0 ? money(l.lucro) : "—"}</TableCell><TableCell className="text-right">{l.custoMedio > 0 ? pct(l.margem) : "—"}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
              </TabsContent>
            </Tabs>
          </>}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
