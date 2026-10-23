import { Fragment, useEffect, useMemo, useState } from "react";
import { conferenciaApi } from "@/lib/estoque/conferenciaPortal";
import { ConferentesAccessDialog } from "@/components/estoque/ConferentesAccessDialog";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Archive, CalendarDays, Download, FileSpreadsheet, Loader2, Package, PackageOpen, Pencil, RefreshCw, Save, Store, Trash2, TrendingUp } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calcularFluxoConferencia, resolverSaldoInicial, SaldoCheioVazio, datasApuracao, combinarContagens, MomentoContagem, saldoComEntradas } from "@/lib/estoque/conferenciaFluxo";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { EstoquePageHeader } from "@/components/estoque/EstoquePageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Unidade, useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";

type GrupoProduto = "P13" | "P20" | "P45" | "Agua";
type TipoEstoque = "cheio" | "vazio";
type ValoresConferencia = Record<string, Record<GrupoProduto, Record<TipoEstoque, number>>>;
type ModoPersistencia = "banco" | "local";

interface RegistroConferencia {
  unidade_id: string;
  produto_grupo: GrupoProduto;
  tipo_estoque: TipoEstoque;
  quantidade: number;
}

interface LinhaConferencia {
  unidade: Unidade;
  totais: Record<GrupoProduto, Record<TipoEstoque, number>>;
  totalGeral: number;
}

interface MovTransferencia {
  id: string;
  unidade_id: string;
  unidade_destino_id: string | null;
  produto_grupo: GrupoProduto;
  quantidade: number;
}

const colunasFluxo = [
  { key: "ini", label: "Inicial", bg: "bg-slate-100" },
  { key: "ent", label: "Entrada", bg: "bg-emerald-100" },
  { key: "tra", label: "Transf.", bg: "bg-purple-100" },
  { key: "che", label: "Cheio", bg: "bg-amber-100" },
  { key: "vaz", label: "Vazio", bg: "bg-slate-200" },
  { key: "tot", label: "Total", bg: "bg-slate-300" },
  { key: "ven", label: "Venda", bg: "bg-emerald-200" },
];

const grupos: { key: GrupoProduto; label: string; tone: string; mobileTone: string }[] = [
  { key: "P13", label: "P13", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "P20", label: "P20", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "P45", label: "P45", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "Agua", label: "Agua", tone: "bg-[#198fbe] text-white", mobileTone: "border-[#198fbe]/30 bg-[#eef9fd]" },
];

const criarTotaisZerados = () => ({
  P13: { cheio: 0, vazio: 0 },
  P20: { cheio: 0, vazio: 0 },
  P45: { cheio: 0, vazio: 0 },
  Agua: { cheio: 0, vazio: 0 },
});

const formatarDataBR = (data: string) =>
  format(parseISO(`${data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });

const nomeArquivoSeguro = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const criarValoresVazios = (lojas: Unidade[]): ValoresConferencia =>
  lojas.reduce((acc, loja) => {
    acc[loja.id] = criarTotaisZerados();
    return acc;
  }, {} as ValoresConferencia);

interface PortalConferenciaProps {
  unidades: Unidade[];
  destinos?: Unidade[];
  userId: string;
  name: string;
  onSignOut: () => Promise<void>;
}

export default function ConferenciaEstoque({ portal }: { portal?: PortalConferenciaProps } = {}) {
  const { toast } = useToast();
  const { user: erpUser, hasAnyRole } = useAuth();
  const user = portal ? { id: portal.userId } : erpUser;
  const isMaster = !portal && hasAnyRole(["admin", "super_admin"]);
  const colunas = isMaster ? colunasFluxo : colunasFluxo.filter((c) => ["che", "vaz", "tot"].includes(c.key));
  const totalCols = 1 + grupos.length * colunas.length;
  const erpUnidades = useUnidade();
  const unidades = portal?.unidades ?? erpUnidades.unidades;
  const unidadeAtual = portal ? portal.unidades[0] : erpUnidades.unidadeAtual;
  const unidadesLoading = portal ? false : erpUnidades.loading;
  const Layout = portal ? Fragment : MainLayout;
  const [dataContagem, setDataContagem] = useState(format(new Date(), "yyyy-MM-dd"));
  const [momento, setMomento] = useState<MomentoContagem>("inicio");
  const { dataVenda: dataConferencia, dataSaldo: dataAnterior } = datasApuracao(dataContagem, momento);
  const dataLegadoAtual = format(subDays(parseISO(`${dataConferencia}T12:00:00`), -1), "yyyy-MM-dd");
  const dataLegadoAnterior = dataConferencia;
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [valores, setValores] = useState<ValoresConferencia>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modoPersistencia, setModoPersistencia] = useState<ModoPersistencia>("banco");
  const [saldoAnterior, setSaldoAnterior] = useState<Record<string, Partial<Record<GrupoProduto, SaldoCheioVazio>>>>({});
  const [ajustes, setAjustes] = useState<Record<string, Partial<Record<GrupoProduto, SaldoCheioVazio>>>>({});
  const [confirmEdit, setConfirmEdit] = useState<{ unidadeId: string; grupo: GrupoProduto } | null>(null);
  const [editSaldo, setEditSaldo] = useState<{ unidadeId: string; grupo: GrupoProduto } | null>(null);
  const [editCheio, setEditCheio] = useState("");
  const [editVazio, setEditVazio] = useState("");
  const [entradas, setEntradas] = useState<Record<string, Partial<Record<GrupoProduto, number>>>>({});
  const [transferencias, setTransferencias] = useState<MovTransferencia[]>([]);
  const [dialogTransf, setDialogTransf] = useState<{ unidadeId: string; grupo: GrupoProduto } | null>(null);
  const [transfDestino, setTransfDestino] = useState("nenhum");
  const [transfQtd, setTransfQtd] = useState("");
  const todasLojas = portal?.destinos ?? unidades;
  const [momentoConfirmado, setMomentoConfirmado] = useState(false);
  const [perguntarMomento, setPerguntarMomento] = useState(false);
  const [movLoja, setMovLoja] = useState("nenhum");
  const [movGrupo, setMovGrupo] = useState<GrupoProduto>("P13");
  const [entradaQtd, setEntradaQtd] = useState("");
  const pedirMomento = () => { if (!momentoConfirmado) setPerguntarMomento(true); };
  const camposContagem = (id: string) => ({
    "aria-label": id,
    readOnly: !momentoConfirmado || isLoading,
    onFocus: pedirMomento,
    onClick: pedirMomento,
  });
  const escolherMomento = (value: MomentoContagem) => {
    setMomento(value);
    setMomentoConfirmado(true);
    setPerguntarMomento(false);
  };
  const registrarEntrada = async () => {
    if (!momentoConfirmado) { setPerguntarMomento(true); return; }
    const quantidade = Number(entradaQtd);
    const unidade = unidades.find((u) => u.id === movLoja);
    if (!unidade || entradaQtd === "" || !Number.isSafeInteger(quantidade) || quantidade < 0) {
      toast({ title: "Escolha a loja e informe a quantidade", variant: "destructive" }); return;
    }
    setIsSaving(true);
    try {
      if (portal) await conferenciaApi({ action: "entry", date: dataConferencia, count_date: dataContagem, moment: momento, unidade_id: movLoja, produto_grupo: movGrupo, quantidade });
      else {
        const existing = await (supabase as any).from("estoque_conferencia_movimentos").select("id").eq("data_conferencia", dataConferencia).eq("unidade_id", movLoja).eq("produto_grupo", movGrupo).eq("tipo", "entrada_manual").maybeSingle();
        if (existing.error) throw existing.error;
        const payload = { empresa_id: unidade.empresa_id, unidade_id: movLoja, data_conferencia: dataConferencia, produto_grupo: movGrupo, quantidade, criado_por: user?.id };
        const result = existing.data ? await (supabase as any).from("estoque_conferencia_movimentos").update(payload).eq("id", existing.data.id) : await (supabase as any).from("estoque_conferencia_movimentos").insert({ ...payload, tipo: "entrada_manual" });
        if (result.error) throw result.error;
      }
      atualizarEntrada(movLoja, movGrupo, entradaQtd);
      toast({ title: "Entrada registrada" });
    } catch (error) { toast({ title: "Entrada não foi salva", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };


  const atualizarEntrada = (unidadeId: string, grupo: GrupoProduto, value: string) => {
    const q = Math.max(0, Math.floor(Number(value || 0)));
    setEntradas((prev) => ({ ...prev, [unidadeId]: { ...(prev[unidadeId] || {}), [grupo]: Number.isFinite(q) ? q : 0 } }));
  };

  const lojasVisiveis = useMemo(() => {
    if (lojaFiltro === "todas") return unidades;
    return unidades.filter((unidade) => unidade.id === lojaFiltro);
  }, [lojaFiltro, unidades]);

  const escopoLabel = lojaFiltro === "todas"
    ? "Todas as lojas"
    : lojasVisiveis[0]?.nome || unidadeAtual?.nome || "Loja selecionada";

  const getLocalStorageKey = () =>
    `gasfacil:estoque-conferencia:${dataConferencia}:${lojaFiltro}`;

  const carregarConferenciaLocal = (base: ValoresConferencia) => {
    try {
      const salvo = localStorage.getItem(getLocalStorageKey());
      return salvo ? { ...base, ...JSON.parse(salvo) } : base;
    } catch {
      return base;
    }
  };

  const salvarConferenciaLocal = (dados: ValoresConferencia) => {
    localStorage.setItem(getLocalStorageKey(), JSON.stringify(dados));
  };

  const carregarConferencia = async () => {
    if (unidadesLoading) return;

    const base = criarValoresVazios(unidades);
    setIsLoading(true);

    try {
      const portalData = portal ? await conferenciaApi({ action: "load", date: dataConferencia, count_date: dataContagem, moment: momento }) : null;
      let query = (supabase as any)
        .from("estoque_conferencias")
        .select("unidade_id, produto_grupo, tipo_estoque, quantidade")
        .eq("data_conferencia", dataLegadoAtual);

      if (lojaFiltro !== "todas") {
        query = query.eq("unidade_id", lojaFiltro);
      } else if (unidades.length > 0) {
        query = query.in("unidade_id", unidades.map((unidade) => unidade.id));
      }

      const legacy = portalData ? { data: [], error: null } : await query;
      const closing = portalData ? { data: portalData.current, error: null } : await (supabase as any)
        .from("estoque_conferencia_fechamentos").select("unidade_id, produto_grupo, tipo_estoque, quantidade")
        .eq("data_conferencia", dataConferencia).in("unidade_id", unidades.map((u) => u.id));
      if (legacy.error || closing.error) throw legacy.error || closing.error;
      const data = combinarContagens<RegistroConferencia>(legacy.data || [], closing.data || []);

      (data || []).forEach((registro: RegistroConferencia) => {
        if (!base[registro.unidade_id]) base[registro.unidade_id] = criarTotaisZerados();
        base[registro.unidade_id][registro.produto_grupo][registro.tipo_estoque] = Number(registro.quantidade || 0);
      });

      setValores(base);
      setModoPersistencia("banco");

      const ids = unidades.map((u) => u.id);
      const [legacyPrev, previousClosing, movements, adjustments] = portalData
        ? [{ data: [], error: null }, { data: portalData.prev, error: null }, { data: portalData.movs, error: null }, { data: portalData.ajs, error: null }]
        : await Promise.all([
        (supabase as any)
          .from("estoque_conferencias")
          .select("unidade_id, produto_grupo, tipo_estoque, quantidade")
          .eq("data_conferencia", dataLegadoAnterior)
          .in("unidade_id", ids),
        (supabase as any).from("estoque_conferencia_fechamentos")
          .select("unidade_id, produto_grupo, tipo_estoque, quantidade")
          .eq("data_conferencia", dataAnterior).in("unidade_id", ids),
        (supabase as any)
          .from("estoque_conferencia_movimentos")
          .select("id, unidade_id, unidade_destino_id, produto_grupo, quantidade, tipo")
          .eq("data_conferencia", dataConferencia),
        (supabase as any)
          .from("estoque_conferencia_saldo_ajustes")
          .select("unidade_id, produto_grupo, cheio, vazio")
          .eq("data_conferencia", dataConferencia)
          .in("unidade_id", ids),
      ]);
      for (const result of [legacyPrev, previousClosing, movements, adjustments]) if (result.error) throw result.error;
      const prev = combinarContagens<RegistroConferencia>(legacyPrev.data || [], previousClosing.data || []);
      const movs = movements.data;
      const ajs = adjustments.data;
      const saldo: Record<string, Partial<Record<GrupoProduto, SaldoCheioVazio>>> = {};
      (prev || []).forEach((r: any) => {
        saldo[r.unidade_id] = saldo[r.unidade_id] || {};
        const g = r.produto_grupo as GrupoProduto;
        const atual = saldo[r.unidade_id][g] || { cheio: 0, vazio: 0 };
        atual[r.tipo_estoque as TipoEstoque] = Number(r.quantidade || 0);
        saldo[r.unidade_id][g] = atual;
      });
      const aj: Record<string, Partial<Record<GrupoProduto, SaldoCheioVazio>>> = {};
      (ajs || []).forEach((r: any) => {
        aj[r.unidade_id] = aj[r.unidade_id] || {};
        aj[r.unidade_id][r.produto_grupo as GrupoProduto] = { cheio: Number(r.cheio || 0), vazio: Number(r.vazio || 0) };
      });
      setAjustes(aj);
      const ent: Record<string, Partial<Record<GrupoProduto, number>>> = {};
      const trs: MovTransferencia[] = [];
      (movs || []).forEach((m: any) => {
        if (m.tipo === "entrada_manual") {
          ent[m.unidade_id] = ent[m.unidade_id] || {};
          ent[m.unidade_id][m.produto_grupo as GrupoProduto] = Number(m.quantidade || 0);
        } else {
          trs.push(m);
        }
      });
      setSaldoAnterior(saldo);
      setEntradas(ent);
      setTransferencias(trs);
    } catch (error) {
      console.error("Erro ao carregar conferencia manual:", error);
      if (portal) {
        setValores(base);
        toast({ title: "Não foi possível carregar a conferência", description: "Tente atualizar novamente.", variant: "destructive" });
        return;
      }
      setModoPersistencia("local");
      setValores(carregarConferenciaLocal(base));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarConferencia();
  }, [dataConferencia, dataContagem, momento, lojaFiltro, unidadesLoading, unidades.length]);

  const atualizarValor = (unidadeId: string, grupo: GrupoProduto, tipo: TipoEstoque, value: string) => {
    const quantidade = Math.max(0, Number(value || 0));

    setValores((prev) => {
      const next = { ...prev };
      next[unidadeId] = next[unidadeId] || criarTotaisZerados();
      next[unidadeId] = {
        ...next[unidadeId],
        [grupo]: {
          ...next[unidadeId][grupo],
          [tipo]: Number.isFinite(quantidade) ? quantidade : 0,
        },
      };
      return next;
    });
  };

  const linhas = useMemo<LinhaConferencia[]>(() => {
    return lojasVisiveis.map((unidade) => {
      const totais = valores[unidade.id] || criarTotaisZerados();
      const totalGeral = grupos.reduce(
        (acc, grupo) => acc + totais[grupo.key].cheio + totais[grupo.key].vazio,
        0
      );

      return { unidade, totais, totalGeral };
    });
  }, [lojasVisiveis, valores]);

  const entradaRecebida = (unidadeId: string, grupo: GrupoProduto) =>
    transferencias
      .filter((t) => t.unidade_destino_id === unidadeId && t.produto_grupo === grupo)
      .reduce((acc, t) => acc + Number(t.quantidade || 0), 0);

  const saldoInicialDe = (unidadeId: string, grupo: GrupoProduto) =>
    resolverSaldoInicial(ajustes[unidadeId]?.[grupo], saldoAnterior[unidadeId]?.[grupo]);

  const pedirEdicaoSaldo = (unidadeId: string, grupo: GrupoProduto) => {
    if (!isMaster) return;
    setConfirmEdit({ unidadeId, grupo });
  };

  const confirmarEdicaoSaldo = () => {
    if (!confirmEdit) return;
    const s = saldoInicialDe(confirmEdit.unidadeId, confirmEdit.grupo);
    setEditCheio(String(s.cheio));
    setEditVazio(String(s.vazio));
    setEditSaldo(confirmEdit);
    setConfirmEdit(null);
  };

  const salvarSaldoInicial = async () => {
    if (!editSaldo || !isMaster) return;
    const cheio = Math.max(0, Math.floor(Number(editCheio || 0)));
    const vazio = Math.max(0, Math.floor(Number(editVazio || 0)));
    setIsSaving(true);
    const { error } = await (supabase as any)
      .from("estoque_conferencia_saldo_ajustes")
      .upsert(
        { data_conferencia: dataConferencia, unidade_id: editSaldo.unidadeId, produto_grupo: editSaldo.grupo, cheio, vazio, editado_por: user?.id || null, updated_at: new Date().toISOString() },
        { onConflict: "data_conferencia,unidade_id,produto_grupo" }
      );
    setIsSaving(false);
    if (error) {
      console.error(error);
      toast({ title: "Não foi possível salvar o saldo inicial", description: "Somente usuário Master pode editar.", variant: "destructive" });
      return;
    }
    setAjustes((prev) => ({ ...prev, [editSaldo.unidadeId]: { ...(prev[editSaldo.unidadeId] || {}), [editSaldo.grupo]: { cheio, vazio } } }));
    toast({ title: "Saldo inicial atualizado" });
    setEditSaldo(null);
  };

  const fluxo = (unidadeId: string, grupo: GrupoProduto) =>
    calcularFluxoConferencia({
      saldoInicial: saldoInicialDe(unidadeId, grupo).cheio,
      entrada: (entradas[unidadeId]?.[grupo] || 0) + entradaRecebida(unidadeId, grupo),
      transferencia: transferencias
        .filter((t) => t.unidade_id === unidadeId && t.produto_grupo === grupo)
        .reduce((acc, t) => acc + Number(t.quantidade || 0), 0),
      cheio: valores[unidadeId]?.[grupo]?.cheio || 0,
    });

  const resumo = useMemo(() => {
    const porGrupo = grupos.reduce((acc, g) => {
      acc[g.key] = { inicial: 0, inicialVazio: 0, entrada: 0, transf: 0, cheio: 0, vazio: 0, venda: 0 };
      return acc;
    }, {} as Record<GrupoProduto, { inicial: number; inicialVazio: number; entrada: number; transf: number; cheio: number; vazio: number; venda: number }>);
    const acc = { inicial: 0, cheios: 0, vazios: 0, total: 0, venda: 0, porGrupo };
    linhas.forEach((linha) => {
      grupos.forEach((grupo) => {
        const f = fluxo(linha.unidade.id, grupo.key);
        const pg = porGrupo[grupo.key];
        const saldo = saldoComEntradas(saldoInicialDe(linha.unidade.id, grupo.key), f.entrada);
        pg.inicial += saldo.cheio;
        pg.inicialVazio += saldo.vazio;
        pg.entrada += f.entrada;
        pg.transf += f.transferencia;
        pg.cheio += linha.totais[grupo.key].cheio;
        pg.vazio += linha.totais[grupo.key].vazio;
        pg.venda += f.vendaEsperada;
        acc.inicial += f.saldoInicial;
        acc.cheios += linha.totais[grupo.key].cheio;
        acc.vazios += linha.totais[grupo.key].vazio;
        acc.venda += f.vendaEsperada;
      });
      acc.total += linha.totalGeral;
    });
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, saldoAnterior, ajustes, entradas, transferencias]);

  const nomeLoja = (id: string | null) => todasLojas.find((u) => u.id === id)?.nome || "Loja";

  const transferenciasDoDialog = useMemo(
    () =>
      dialogTransf
        ? transferencias.filter((t) => t.unidade_id === dialogTransf.unidadeId && t.produto_grupo === dialogTransf.grupo)
        : [],
    [dialogTransf, transferencias]
  );

  const abrirTransferencia = (unidadeId: string, grupo: GrupoProduto) => {
    if (!momentoConfirmado) { setPerguntarMomento(true); return; }
    setTransfDestino("nenhum");
    setTransfQtd("");
    setDialogTransf({ unidadeId, grupo });
  };

  const registrarTransferencia = async () => {
    if (!dialogTransf) return;
    const qtd = Math.floor(Number(transfQtd || 0));
    if (transfDestino === "nenhum" || qtd <= 0) {
      toast({ title: "Escolha a loja e a quantidade", variant: "destructive" });
      return;
    }
    if (!momentoConfirmado) { setPerguntarMomento(true); return; }
    const origem = unidades.find((u) => u.id === dialogTransf.unidadeId);
    if (!origem || !Number.isSafeInteger(qtd) || transfDestino === origem.id) return;
    setIsSaving(true);
    try {
      let data: MovTransferencia;
      if (portal) {
        const result = await conferenciaApi({ action: "transfer", date: dataConferencia, count_date: dataContagem, moment: momento, unidade_id: origem.id, unidade_destino_id: transfDestino, produto_grupo: dialogTransf.grupo, quantidade: qtd });
        data = result.movement;
      } else {
        const result = await (supabase as any).from("estoque_conferencia_movimentos").insert({ data_conferencia: dataConferencia, empresa_id: origem.empresa_id, unidade_id: origem.id, produto_grupo: dialogTransf.grupo, tipo: "transferencia", quantidade: qtd, unidade_destino_id: transfDestino, criado_por: user?.id }).select("id, unidade_id, unidade_destino_id, produto_grupo, quantidade").single();
        if (result.error) throw result.error;
        data = result.data;
      }
      setTransferencias((prev) => [...prev, data]);
      toast({ title: "Transferência registrada", description: `${qtd} ${dialogTransf.grupo} para ${nomeLoja(transfDestino)}` });
      setDialogTransf(null);
    } catch (error) { toast({ title: "Não foi possível registrar a transferência", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const excluirTransferencia = async (id: string) => {
    try {
      if (portal) await conferenciaApi({ action: "delete_transfer", date: dataConferencia, count_date: dataContagem, moment: momento, id });
      else {
        const { error } = await (supabase as any).from("estoque_conferencia_movimentos").delete().eq("id", id);
        if (error) throw error;
      }
      setTransferencias((prev) => prev.filter((t) => t.id !== id));
    } catch { toast({ title: "Não foi possível excluir", variant: "destructive" }); }
  };

  const montarLinhasExportacao = () =>
    linhas.map((linha) => [
      linha.unidade.nome,
      linha.totais.P13.cheio,
      linha.totais.P13.vazio,
      linha.totais.P20.cheio,
      linha.totais.P20.vazio,
      linha.totais.P45.cheio,
      linha.totais.P45.vazio,
      linha.totais.Agua.cheio,
      linha.totais.Agua.vazio,
    ]);

  const salvarConferencia = async () => {
    if (!momentoConfirmado) { setPerguntarMomento(true); return; }
    if (linhas.length === 0) {
      toast({ title: "Nenhuma loja para salvar", variant: "destructive" });
      return;
    }

    const registros = linhas.flatMap((linha) =>
      grupos.flatMap((grupo) => [
        {
          data_conferencia: dataConferencia,
          data_contagem: dataContagem,
          momento,
          empresa_id: linha.unidade.empresa_id,
          unidade_id: linha.unidade.id,
          produto_grupo: grupo.key,
          tipo_estoque: "cheio",
          quantidade: linha.totais[grupo.key].cheio || 0,
          conferido_por: user?.id || null,
        },
        {
          data_conferencia: dataConferencia,
          data_contagem: dataContagem,
          momento,
          empresa_id: linha.unidade.empresa_id,
          unidade_id: linha.unidade.id,
          produto_grupo: grupo.key,
          tipo_estoque: "vazio",
          quantidade: linha.totais[grupo.key].vazio || 0,
          conferido_por: user?.id || null,
        },
      ])
    );

    setIsSaving(true);
    try {
      if (portal) {
        await conferenciaApi({ action: "save", date: dataConferencia, count_date: dataContagem, moment: momento, records: registros.map(({ unidade_id, produto_grupo, tipo_estoque, quantidade }) => ({ unidade_id, produto_grupo, tipo_estoque, quantidade })) });
        toast({ title: "Conferência salva", description: `${escopoLabel} — contagem ${formatarDataBR(dataContagem)} · venda ${formatarDataBR(dataConferencia)}` });
        return;
      }
      if (modoPersistencia === "local") {
        salvarConferenciaLocal(valores);
        toast({
          title: "Conferência salva localmente",
          description: "Assim que a tabela estiver publicada no Lovable, o salvamento irá para o Supabase.",
        });
        return;
      }

      const { error } = await (supabase as any)
        .from("estoque_conferencia_fechamentos")
        .upsert(registros, {
          onConflict: "data_conferencia,unidade_id,produto_grupo,tipo_estoque",
        });

      if (error) throw error;

      const lojaIds = linhas.map((l) => l.unidade.id);
      const { error: delErr } = await (supabase as any)
        .from("estoque_conferencia_movimentos")
        .delete()
        .eq("data_conferencia", dataConferencia)
        .eq("tipo", "entrada_manual")
        .in("unidade_id", lojaIds);
      if (delErr) throw delErr;
      const entradasRegistros = lojaIds.flatMap((uid) =>
        grupos
          .filter((g) => (entradas[uid]?.[g.key] || 0) > 0)
          .map((g) => ({
            data_conferencia: dataConferencia,
            unidade_id: uid,
            empresa_id: unidades.find((u) => u.id === uid)?.empresa_id,
            produto_grupo: g.key,
            tipo: "entrada_manual",
            quantidade: entradas[uid][g.key],
            criado_por: user?.id || null,
          }))
      );
      if (entradasRegistros.length > 0) {
        const { error: insErr } = await (supabase as any).from("estoque_conferencia_movimentos").insert(entradasRegistros);
        if (insErr) throw insErr;
      }
      toast({ title: "Conferência salva", description: `${escopoLabel} — contagem ${formatarDataBR(dataContagem)} · venda ${formatarDataBR(dataConferencia)}` });
    } catch (error) {
      console.error("Erro ao salvar conferencia manual:", error);
      if (portal) {
        toast({ title: "A conferência não foi salva", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
        return;
      }
      setModoPersistencia("local");
      salvarConferenciaLocal(valores);
      toast({
        title: "Conferência salva localmente",
        description: "O Supabase do Lovable ainda não aceitou a tabela; mantive os dados neste navegador.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const exportarExcel = () => {
    if (linhas.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const aoa = [
      [`Conferencia de Estoque - ${formatarDataBR(dataConferencia)}`],
      [`Contagem: ${formatarDataBR(dataContagem)} (${momento === "inicio" ? "início" : "fim"}) | Vendas: ${formatarDataBR(dataConferencia)} | Escopo: ${escopoLabel}`],
      ["Lojas", "P13", "", "P20", "", "P45", "", "Agua", ""],
      ["", "Cheio", "Vazio", "Cheio", "Vazio", "Cheio", "Vazio", "Cheio", "Vazio"],
      ...montarLinhasExportacao(),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },
      { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },
      { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } },
    ];
    ws["!cols"] = [{ wch: 22 }, ...Array.from({ length: 8 }, () => ({ wch: 9 }))];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conferencia");
    XLSX.writeFile(wb, `conferencia-estoque-${dataConferencia}-${nomeArquivoSeguro(escopoLabel)}.xlsx`);
  };

  const exportarPDF = () => {
    if (linhas.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(15);
    doc.text("Conferencia de Estoque", 14, 16);
    doc.setFontSize(10);
    doc.text(`Contagem: ${formatarDataBR(dataContagem)} | Vendas: ${formatarDataBR(dataConferencia)} | Escopo: ${escopoLabel}`, 14, 23);

    autoTable(doc, {
      startY: 30,
      head: [
        ["Lojas", "P13", "", "P20", "", "P45", "", "Agua", ""],
        ["", "Cheio", "Vazio", "Cheio", "Vazio", "Cheio", "Vazio", "Cheio", "Vazio"],
      ],
      body: montarLinhasExportacao(),
      theme: "grid",
      styles: {
        halign: "center",
        valign: "middle",
        fontSize: 10,
        cellPadding: 2,
        lineColor: [30, 41, 59],
        lineWidth: 0.2,
      },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 42 } },
      headStyles: {
        fillColor: [17, 24, 39],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`conferencia-estoque-${dataConferencia}-${nomeArquivoSeguro(escopoLabel)}.pdf`);
  };

  return (
    <Layout>
      {portal ? <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 text-foreground">
        <div className="min-w-0"><h1 className="text-lg font-bold">Conferência de Estoque</h1><p className="break-words text-sm text-muted-foreground">{portal.name}</p></div>
        <Button variant="outline" onClick={() => void portal.onSignOut()}>Sair</Button>
      </header> : <Header title="Conferência de Estoque" subtitle="Gestão de Estoque" />}
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 p-3 sm:p-6">
        <EstoquePageHeader
          title="Conferência diária manual"
          description={`Contagem de ${formatarDataBR(dataContagem)} · Vendas de ${formatarDataBR(dataConferencia)}`}
          actions={
            <>
              {isMaster && <ConferentesAccessDialog />}
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={carregarConferencia} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </Button>
              <Button size="sm" className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={salvarConferencia} disabled={isSaving || isLoading}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportarPDF}>
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportarExcel}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </>
          }
        />

        <Card className="border-border/70 shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-[180px_180px_1fr] md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Data da contagem
                </Label>
                <Input
                  type="date"
                  aria-label="Data da contagem"
                  value={dataContagem}
                  onChange={(event) => { if (event.target.value) { setDataContagem(event.target.value); setMomentoConfirmado(false); } }}
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Momento da contagem</Label>
                <Select value={momento} onValueChange={(value) => { if (value === "inicio" || value === "fim") escolherMomento(value); }}>
                  <SelectTrigger aria-label="Momento da contagem" className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="inicio">Início do dia</SelectItem><SelectItem value="fim">Fim do dia</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:max-w-[320px]">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Loja
                </Label>
                <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as lojas juntas</SelectItem>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm font-semibold text-foreground md:col-span-3">
                <Store className="h-4 w-4" />
                {modoPersistencia === "local" ? "Modo local · " : ""}Venda apurada: {formatarDataBR(dataConferencia)}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            {
              label: "Saldo inicial",
              hint: `Inicial + entradas · ${formatarDataBR(dataConferencia)}`,
              icon: Archive,
              iconCls: "bg-muted text-foreground",
              cardCls: "border-border bg-card",
              valor: (k: GrupoProduto) => (
                <span>
                  {resumo.porGrupo[k].inicial} <span className="text-xs font-medium text-muted-foreground">cheio</span>
                  {" / "}
                  {resumo.porGrupo[k].inicialVazio} <span className="text-xs font-medium text-muted-foreground">vazio</span>
                </span>
              ),
            },
            { label: "Cheios", hint: `Contagem de ${formatarDataBR(dataContagem)}`, icon: Package, iconCls: "bg-warning/15 text-warning", cardCls: "border-border bg-card", valor: (k: GrupoProduto) => resumo.porGrupo[k].cheio },
            { label: "Vazios", hint: `Contagem de ${formatarDataBR(dataContagem)}`, icon: PackageOpen, iconCls: "bg-info/15 text-info", cardCls: "border-border bg-card", valor: (k: GrupoProduto) => resumo.porGrupo[k].vazio },
            { label: "Venda esperada", hint: `Vendas de ${formatarDataBR(dataConferencia)} · cheios`, icon: TrendingUp, iconCls: "bg-success/15 text-success", cardCls: "border-success/40 bg-success/5", valor: (k: GrupoProduto) => resumo.porGrupo[k].venda },
          ]).map((card) => (
            <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${card.cardCls}`}>
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconCls}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold uppercase tracking-wide text-foreground">{card.label}</p>
                  <p className="break-words text-xs text-muted-foreground">{card.hint}</p>
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {grupos.map((g) => (
                  <div key={g.key} className="flex items-center justify-between py-1.5">
                    <span className="text-sm font-semibold text-muted-foreground">{g.key === "Agua" ? "Água" : g.label}</span>
                    <span className="text-lg font-bold tabular-nums text-foreground">{card.valor(g.key)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <section className="space-y-4 border-y border-border py-5">
          <h2 className="text-lg font-bold text-foreground">Entrada</h2>
          <p className="text-sm text-muted-foreground">Movimentos de {formatarDataBR(dataConferencia)}</p>
          <div className="grid grid-cols-1 gap-3 min-[385px]:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2"><Label>Loja de origem</Label><Select value={movLoja} onValueChange={(id) => { setMovLoja(id); setEntradaQtd(String(entradas[id]?.[movGrupo] || 0)); }}><SelectTrigger aria-label="Loja do movimento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhum">Escolha a loja</SelectItem>{lojasVisiveis.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Produto</Label><Select value={movGrupo} onValueChange={(g) => { setMovGrupo(g as GrupoProduto); setEntradaQtd(String(entradas[movLoja]?.[g as GrupoProduto] || 0)); }}><SelectTrigger aria-label="Produto do movimento"><SelectValue /></SelectTrigger><SelectContent>{grupos.map((g) => <SelectItem key={g.key} value={g.key}>{g.key === "Agua" ? "Água" : g.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="entrada-dia">Entrada manual do dia</Label><Input id="entrada-dia" aria-label="Entrada manual do dia" type="number" min="0" inputMode="numeric" value={entradaQtd} onFocus={pedirMomento} onChange={(e) => setEntradaQtd(e.target.value)} className="text-base" /></div>
            <Button className="self-end" disabled={isSaving || isLoading} onClick={() => void registrarEntrada()}>Registrar entrada</Button>
          </div>
          {movLoja !== "nenhum" && <div className="space-y-1 text-sm text-muted-foreground"><p>Entrada manual registrada: {entradas[movLoja]?.[movGrupo] || 0} {movGrupo}</p>{transferencias.filter((t) => t.unidade_destino_id === movLoja && t.produto_grupo === movGrupo).map((t) => <p key={t.id}>+{t.quantidade} {movGrupo} recebido de {nomeLoja(t.unidade_id)}</p>)}</div>}
          <div className="space-y-3 border-t border-border pt-4">
            <h2 className="text-lg font-bold text-foreground">Transferência para filial</h2>
            <Button variant="outline" disabled={movLoja === "nenhum" || isSaving || isLoading} onClick={() => { if (!momentoConfirmado) { setPerguntarMomento(true); return; } abrirTransferencia(movLoja, movGrupo); }}>Transferir {movGrupo}</Button>
            {movLoja !== "nenhum" && <p className="text-sm text-muted-foreground">Transferências registradas: {fluxo(movLoja, movGrupo).transferencia} {movGrupo}</p>}
          </div>
        </section>

        <Card className="hidden overflow-hidden border-slate-300 shadow-[0_14px_40px_rgba(15,23,42,0.08)] md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className={`w-full border-collapse bg-white text-sm ${isMaster ? "min-w-[1600px]" : "min-w-[900px]"}`}>
                <thead>
                  <tr>
                    <th colSpan={totalCols} className="border border-slate-900 bg-white px-3 py-1.5 text-center text-lg font-black text-slate-950">
                      {`Contagem de ${formatarDataBR(dataContagem)} — vendas de ${formatarDataBR(dataConferencia)}`}
                    </th>
                  </tr>
                  <tr>
                    <th rowSpan={2} className="sticky left-0 z-20 min-w-[180px] border border-slate-900 bg-slate-800 px-3 py-3 text-center text-base font-black text-white">
                      Lojas
                    </th>
                    {grupos.map((grupo) => (
                      <th key={grupo.key} colSpan={colunas.length} className={`border border-slate-900 px-3 py-1.5 text-base font-black ${grupo.tone}`}>
                        {grupo.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {grupos.flatMap((grupo) =>
                      colunas.map((col) => (
                        <th key={`${grupo.key}-${col.key}`} className={`border border-slate-900 px-1.5 py-1.5 text-xs font-black text-slate-950 ${col.bg}`}>
                          {col.label}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {isLoading || unidadesLoading ? (
                    <tr>
                      <td colSpan={totalCols} className="border border-slate-300 px-3 py-10 text-center text-muted-foreground">
                        Carregando conferência...
                      </td>
                    </tr>
                  ) : linhas.length === 0 ? (
                    <tr>
                      <td colSpan={totalCols} className="border border-slate-300 px-3 py-10 text-center text-muted-foreground">
                        Nenhuma loja encontrada para o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    linhas.map((linha) => (
                      <tr key={linha.unidade.id} className="hover:bg-blue-50/40">
                        <th scope="row" className="sticky left-0 z-10 min-w-[180px] max-w-[180px] break-words border border-slate-900 bg-slate-100 px-2 py-1.5 text-left font-black text-slate-950">
                          <span className="block text-[10px] font-semibold uppercase text-slate-600">
                            {linha.unidade.tipo === "matriz" ? "Matriz" : "Filial"}
                          </span>
                          {linha.unidade.nome}
                        </th>
                        {grupos.flatMap((grupo) => {
                          const f = fluxo(linha.unidade.id, grupo.key);
                          const id = `${linha.unidade.id}-${grupo.key}`;
                          const inputCls = "h-10 w-16 rounded-none border-0 text-center text-base font-black shadow-none focus-visible:ring-2 focus-visible:ring-blue-500";
                          const recebida = entradaRecebida(linha.unidade.id, grupo.key);
                          const celulas: Record<string, JSX.Element> = {
                            ini: (
                              <td key={`${id}-ini`} className="border border-slate-900 bg-slate-50 p-0">
                                <button type="button" onClick={() => pedirEdicaoSaldo(linha.unidade.id, grupo.key)} title="Editar saldo inicial"
                                  className="h-10 w-full px-1 text-center font-bold hover:bg-slate-200">
                                  {f.saldoInicial}{ajustes[linha.unidade.id]?.[grupo.key] ? "*" : ""}
                                </button>
                              </td>
                            ),
                            ent: (
                              <td key={`${id}-ent`} className="border border-slate-900 p-0">
                                <Input type="number" min="0" inputMode="numeric" value={entradas[linha.unidade.id]?.[grupo.key] || ""}
                                  onChange={(e) => atualizarEntrada(linha.unidade.id, grupo.key, e.target.value)} className={`${inputCls} text-emerald-700`} />
                                {recebida > 0 && <span className="block text-center text-[10px] font-bold text-emerald-700">+{recebida} transf.</span>}
                              </td>
                            ),
                            tra: (
                              <td key={`${id}-tra`} className="border border-slate-900 p-0">
                                <button type="button" onClick={() => abrirTransferencia(linha.unidade.id, grupo.key)}
                                  className="h-10 w-full px-1 text-center font-black text-purple-700 underline-offset-2 hover:underline">
                                  -{f.transferencia}
                                </button>
                              </td>
                            ),
                            che: (
                              <td key={`${id}-che`} className="border border-slate-900 p-0">
                                <Input type="number" min="0" inputMode="numeric" value={linha.totais[grupo.key].cheio || ""} {...camposContagem(`${linha.unidade.nome} ${grupo.key} cheio`)}
                                  onChange={(e) => atualizarValor(linha.unidade.id, grupo.key, "cheio", e.target.value)} className={`${inputCls} text-blue-700`} />
                              </td>
                            ),
                            vaz: (
                              <td key={`${id}-vaz`} className="border border-slate-900 p-0">
                                <Input type="number" min="0" inputMode="numeric" value={linha.totais[grupo.key].vazio || ""} {...camposContagem(`${linha.unidade.nome} ${grupo.key} vazio`)}
                                  onChange={(e) => atualizarValor(linha.unidade.id, grupo.key, "vazio", e.target.value)} className={`${inputCls} text-blue-700`} />
                              </td>
                            ),
                            tot: (
                              <td key={`${id}-tot`} className="border border-slate-900 bg-slate-100 px-1 text-center font-black">
                                {linha.totais[grupo.key].cheio + linha.totais[grupo.key].vazio}
                              </td>
                            ),
                            ven: <td key={`${id}-ven`} className="border border-slate-900 bg-emerald-50 px-1 text-center font-black text-emerald-700">{f.vendaEsperada}</td>,
                          };
                          return colunas.map((col) => celulas[col.key]);
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {linhas.length > 0 && !isLoading && !unidadesLoading && (
                  <tfoot>
                    <tr>
                      <th scope="row" className="sticky left-0 z-10 border border-slate-900 bg-slate-800 px-2 py-1.5 text-left font-black text-white">
                        Total geral
                      </th>
                      {grupos.flatMap((grupo) => {
                        const g = resumo.porGrupo[grupo.key];
                        const vals: Record<string, number> = { ini: g.inicial, ent: g.entrada, tra: -g.transf, che: g.cheio, vaz: g.vazio, tot: g.cheio + g.vazio, ven: g.venda };
                        return colunas.map((col) => (
                          <td key={`tot-${grupo.key}-${col.key}`} className={`border border-slate-900 text-center font-black ${col.bg}`}>{vals[col.key]}</td>
                        ));
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:hidden">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contagem {formatarDataBR(dataContagem)} · Venda {formatarDataBR(dataConferencia)}
              </p>
              <p className="text-base font-bold text-slate-950">{escopoLabel}</p>
            </div>
            <CalendarDays className="h-5 w-5 text-blue-600" />
          </div>

          {isLoading || unidadesLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Carregando conferência...
              </CardContent>
            </Card>
          ) : linhas.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma loja encontrada para o filtro selecionado.
              </CardContent>
            </Card>
          ) : (
            linhas.map((linha) => (
              <Card key={linha.unidade.id} className="overflow-hidden border-slate-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b border-border bg-foreground px-4 py-3 text-background">
                    <p className="break-words text-base font-black">{linha.unidade.nome}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-3">
                    {grupos.map((grupo) => {
                      const f = fluxo(linha.unidade.id, grupo.key);
                      const recebida = entradaRecebida(linha.unidade.id, grupo.key);
                      return (
                        <div key={grupo.key} className={`rounded-xl border p-3 ${grupo.mobileTone}`}>
                          <p className="mb-2 text-base font-black text-slate-950">{grupo.label}</p>
                          {!isMaster ? (
                            <div className="grid grid-cols-3 gap-2">
                              {(["cheio", "vazio"] as TipoEstoque[]).map((tipo) => (
                                <div key={tipo} className="rounded-lg border border-slate-200 bg-white p-2">
                                  <p className="text-[11px] font-bold uppercase text-slate-500">{tipo === "cheio" ? "Cheio" : "Vazio"}</p>
                                  <Input type="number" min="0" inputMode="numeric" value={linha.totais[grupo.key][tipo] || ""} {...camposContagem(`${linha.unidade.nome} ${grupo.key} ${tipo}`)}
                                    onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, tipo, event.target.value)}
                                    className="h-9 text-right text-lg font-black text-slate-900" />
                                </div>
                              ))}
                              <div className="rounded-lg border border-slate-200 bg-slate-100 p-2">
                                <p className="text-[11px] font-bold uppercase text-slate-500">Total</p>
                                <p className="pt-1 text-right text-2xl font-black text-slate-950">{linha.totais[grupo.key].cheio + linha.totais[grupo.key].vazio}</p>
                              </div>
                            </div>
                          ) : (
                          <>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => pedirEdicaoSaldo(linha.unidade.id, grupo.key)} className="rounded-lg border border-slate-200 bg-white p-2 text-left">
                              <p className="flex justify-between text-[11px] font-bold uppercase text-slate-500">1. Saldo inicial <Pencil className="h-3 w-3" /></p>
                              <p className="text-right text-2xl font-black text-slate-950">{f.saldoInicial}</p>
                              <p className="text-[11px] text-slate-500">{ajustes[linha.unidade.id]?.[grupo.key] ? "Editado pelo Master" : `Abertura de ${formatarDataBR(dataConferencia)}`}</p>
                            </button>
                            <div className="rounded-lg border border-emerald-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-emerald-700">2. Entrada (+)</p>
                              <Input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={entradas[linha.unidade.id]?.[grupo.key] || ""}
                                onChange={(event) => atualizarEntrada(linha.unidade.id, grupo.key, event.target.value)}
                                className="h-9 text-right text-lg font-black text-emerald-700"
                              />
                              {recebida > 0 && <p className="text-[11px] text-emerald-700">+{recebida} recebido de lojas</p>}
                            </div>
                            <div className="rounded-lg border border-blue-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-blue-700">3. Total inicial (=)</p>
                              <p className="text-right text-2xl font-black text-blue-900">{f.totalInicial}</p>
                              <p className="text-[11px] text-blue-700">Inicial + entrada</p>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-amber-700">4. Cheios (-)</p>
                              <Input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={linha.totais[grupo.key].cheio || ""} {...camposContagem(`${linha.unidade.nome} ${grupo.key} cheio`)}
                                onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, "cheio", event.target.value)}
                                className="h-9 text-right text-lg font-black text-amber-800"
                              />
                              <p className="text-[11px] text-amber-700">Contagem atual</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => abrirTransferencia(linha.unidade.id, grupo.key)}
                              className="rounded-lg border border-purple-200 bg-white p-2 text-left"
                            >
                              <p className="flex justify-between text-[11px] font-bold uppercase text-purple-700">
                                5. Transf. (-) <span className="underline">Editar</span>
                              </p>
                              <p className="text-right text-2xl font-black text-purple-700">-{f.transferencia}</p>
                              <p className="text-[11px] text-purple-600">Para outras lojas</p>
                            </button>
                            <div className="rounded-lg border border-slate-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-slate-500">Vazio</p>
                              <Input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={linha.totais[grupo.key].vazio || ""} {...camposContagem(`${linha.unidade.nome} ${grupo.key} vazio`)}
                                onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, "vazio", event.target.value)}
                                className="h-9 text-right text-lg font-black text-slate-800"
                              />
                              <p className="text-[11px] text-slate-500">Vasilhames: {linha.totais[grupo.key].cheio + linha.totais[grupo.key].vazio}</p>
                            </div>
                          </div>
                          <div className="mt-2 rounded-xl bg-emerald-600 p-3 text-white">
                            <p className="text-xs font-bold uppercase">6. Venda esperada</p>
                            <p className="text-right text-3xl font-black">{f.vendaEsperada}</p>
                            <p className="text-[11px] opacity-90">Inicial + entrada − transf. − cheios</p>
                          </div>
                          </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <ResponsiveDialog open={perguntarMomento} onOpenChange={setPerguntarMomento}>
        <ResponsiveDialogContent className="max-w-md pb-12 md:pb-0">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Contagem é do início ou final do dia?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Data da contagem: {formatarDataBR(dataContagem)}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="grid gap-3 py-4">
            <Button className="h-auto flex-col gap-1 py-3" onClick={() => escolherMomento("inicio")}><span>Início do dia</span><span className="text-xs">Vendas de {formatarDataBR(datasApuracao(dataContagem, "inicio").dataVenda)}</span></Button>
            <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => escolherMomento("fim")}><span>Final do dia</span><span className="text-xs">Vendas de {formatarDataBR(dataContagem)}</span></Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={!!dialogTransf} onOpenChange={(open) => !open && setDialogTransf(null)}>
        <ResponsiveDialogContent className="max-w-md pb-12 md:pb-0">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Transferência {dialogTransf?.grupo} — {unidades.find((u) => u.id === dialogTransf?.unidadeId)?.nome}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Loja de destino</Label>
              <Select value={transfDestino} onValueChange={setTransfDestino}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Escolha a loja" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Escolha a loja</SelectItem>
                  {todasLojas
                    .filter((u) => u.id !== dialogTransf?.unidadeId)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input type="number" min="1" inputMode="numeric" value={transfQtd} onChange={(e) => setTransfQtd(e.target.value)} className="h-10 text-base" />
            </div>
            {transferenciasDoDialog.length > 0 && (
              <div className="space-y-1 rounded-lg border p-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Já registradas hoje</p>
                {transferenciasDoDialog.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span>{t.quantidade} → {nomeLoja(t.unidade_destino_id)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluirTransferencia(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setDialogTransf(null)}>Fechar</Button>
            <Button onClick={registrarTransferencia} disabled={isSaving}>Registrar transferência</Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog open={!!confirmEdit} onOpenChange={(open) => !open && setConfirmEdit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja editar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você vai alterar o saldo inicial de {confirmEdit?.grupo} em {nomeLoja(confirmEdit?.unidadeId || null)} no dia {formatarDataBR(dataConferencia)}. Isso muda a venda esperada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEdicaoSaldo}>Sim, editar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editSaldo} onOpenChange={(open) => !open && setEditSaldo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Saldo inicial {editSaldo?.grupo} — {nomeLoja(editSaldo?.unidadeId || null)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cheio</Label>
              <Input type="number" min="0" inputMode="numeric" value={editCheio} onChange={(e) => setEditCheio(e.target.value)} className="h-10 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>Vazio</Label>
              <Input type="number" min="0" inputMode="numeric" value={editVazio} onChange={(e) => setEditVazio(e.target.value)} className="h-10 text-base" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSaldo(null)}>Cancelar</Button>
            <Button onClick={salvarSaldoInicial} disabled={isSaving}>Salvar saldo inicial</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
