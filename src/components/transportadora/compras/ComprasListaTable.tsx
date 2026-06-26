import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, AlertTriangle, X, Calendar, Check, Wallet, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatNumber } from "@/lib/transp-utils";

interface Props {
  compras: any[];
  unidadesMap?: Map<string, string>;
}

type FiltroTipo = "todos" | "cheio" | "vasilhame" | "outros";

const TIPO_LABEL: Record<string, { label: string; cls: string }> = {
  cheio: { label: "Cheio", cls: "bg-success/10 text-success border-success/20" },
  vasilhame: { label: "Vasilhame", cls: "bg-warning/10 text-warning border-warning/20" },
  outros: { label: "Outros", cls: "bg-muted text-muted-foreground border-border" },
};

const SUBTIPO_CLS: Record<string, string> = {
  P13: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  P20: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  P45: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  "Água": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
};

export function ComprasListaTable({ compras, unidadesMap }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingVenc, setEditingVenc] = useState<Record<string, string>>({});
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroConf, setFiltroConf] = useState<"todos" | "conferidas" | "nao_conferidas">("todos");
  const [excluindo, setExcluindo] = useState<{ id: string; nf?: string; fornecedor?: string; escopo: "linha" | "nf" } | null>(null);

  const dupNFs = useMemo(() => {
    // Considera duplicado apenas quando NF + fornecedor + produto + quantidade + valor coincidem
    // (NFs com vários itens diferentes na mesma nota NÃO são duplicidade)
    const counts: Record<string, number> = {};
    const keyOf = (c: any) => {
      const nfKey = c.chave_nfe || (c.numero_nf ? `${c.numero_nf}_${c.fornecedor}` : null);
      if (!nfKey) return null;
      const prod = (c.produto_descricao || "").trim().toLowerCase();
      const qtd = Number(c.quantidade || 0);
      const val = Number(c.custo_total || 0).toFixed(2);
      return `${nfKey}__${prod}__${qtd}__${val}`;
    };
    compras.forEach((c) => {
      const k = keyOf(c);
      if (!k) return;
      counts[k] = (counts[k] || 0) + 1;
    });
    return new Set(
      compras
        .filter((c) => {
          const k = keyOf(c);
          return k && counts[k] > 1;
        })
        .map((c) => c.numero_nf || c.id)
    );
  }, [compras]);

  const descontosTotais = useMemo(
    () => compras.reduce((s, c) => s + Number(c.desconto || 0), 0),
    [compras]
  );

  const filtered = useMemo(() => {
    let list = compras;
    if (filtroTipo !== "todos") {
      list = list.filter((c) => (c.tipo_produto || "outros") === filtroTipo);
    }
    if (filtroConf === "conferidas") {
      list = list.filter((c) => !!c.conferida);
    } else if (filtroConf === "nao_conferidas") {
      list = list.filter((c) => !c.conferida);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.fornecedor || "").toLowerCase().includes(q) ||
        (c.numero_nf || "").toLowerCase().includes(q) ||
        (c.cidade_fornecedor || "").toLowerCase().includes(q) ||
        (c.cfop || "").includes(q) ||
        (c.produto_descricao || "").toLowerCase().includes(q)
      );
    }
    // Ordena por data DESC, depois por loja ASC
    const lojaName = (id?: string | null) => (id ? (unidadesMap?.get(id) || "") : "");
    return [...list].sort((a, b) => {
      const da = String(a.data || "");
      const db = String(b.data || "");
      if (da !== db) return db.localeCompare(da);
      return lojaName(a.unidade_id).localeCompare(lojaName(b.unidade_id), "pt-BR");
    });
  }, [compras, search, filtroTipo, filtroConf, unidadesMap]);

  const totaisFiltrados = useMemo(() => {
    let qtd = 0, total = 0, desconto = 0;
    for (const c of filtered) {
      const q = Number(c.quantidade || 0) || (Number(c.qtd_p13 || 0) + Number(c.qtd_p20 || 0) + Number(c.qtd_p45 || 0) + Number(c.qtd_agua || 0));
      qtd += q;
      total += Number(c.custo_total || 0);
      desconto += Number(c.desconto || 0);
    }
    return { qtd, total, desconto };
  }, [filtered]);

  const display = showAll ? filtered : filtered.slice(0, 30);

  const updateField = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase as any).from("transp_compras").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transp-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: async (alvo: { id: string; nf?: string; fornecedor?: string; escopo: "linha" | "nf" }) => {
      const q: any = supabase.from("transp_compras").delete();
      if (alvo.escopo === "nf" && alvo.nf) {
        let del = q.eq("numero_nf", alvo.nf);
        if (alvo.fornecedor) del = del.eq("fornecedor", alvo.fornecedor);
        const { error } = await del;
        if (error) throw error;
      } else {
        const { error } = await q.eq("id", alvo.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-compras"] });
      toast.success("Compra excluída");
      setExcluindo(null);
    },
    onError: (e: any) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const togglePago = (c: any) => {
    const novo = !c.pago;
    updateField.mutate({
      id: c.id,
      patch: { pago: novo, data_pagamento: novo ? new Date().toISOString().slice(0, 10) : null },
    });
    toast.success(novo ? "NF marcada como paga" : "NF desmarcada");
  };

  const toggleConferida = async (c: any) => {
    const novo = !c.conferida;
    const { data: { user } } = await supabase.auth.getUser();
    updateField.mutate({
      id: c.id,
      patch: {
        conferida: novo,
        conferida_em: novo ? new Date().toISOString() : null,
        conferida_por: novo ? user?.id || null : null,
      },
    });
    toast.success(novo ? "NF conferida" : "Conferência removida");
  };

  const saveVenc = (c: any, val: string) => {
    setEditingVenc((p) => { const n = { ...p }; delete n[c.id]; return n; });
    updateField.mutate({ id: c.id, patch: { data_vencimento: val || null } });
    toast.success("Vencimento salvo");
  };

  const fmtDate = (d?: string) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "—";
  const isVencido = (c: any) => c.data_vencimento && !c.pago && new Date(c.data_vencimento) < new Date();

  const lojaNome = (id?: string | null) =>
    id ? (unidadesMap?.get(id) || "—") : "—";

  const tipoCounts = useMemo(() => {
    const c = { todos: compras.length, cheio: 0, vasilhame: 0, outros: 0 } as Record<FiltroTipo, number>;
    for (const x of compras) {
      const t = (x.tipo_produto || "outros") as FiltroTipo;
      if (t === "cheio" || t === "vasilhame") c[t]++;
      else c.outros++;
    }
    return c;
  }, [compras]);

  const chips: { v: FiltroTipo; label: string }[] = [
    { v: "todos", label: `Todos (${tipoCounts.todos})` },
    { v: "cheio", label: `Cheio (${tipoCounts.cheio})` },
    { v: "vasilhame", label: `Vasilhame (${tipoCounts.vasilhame})` },
    { v: "outros", label: `Outros (${tipoCounts.outros})` },
  ];

  return (
    <Card className="border-border/40">
      <CardContent className="p-0">
        {dupNFs.size > 0 && (
          <div className="flex items-start gap-2 m-4 mb-0 bg-warning/10 border border-warning/30 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{dupNFs.size} NF(s) duplicada(s) detectada(s)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Verifique os registros marcados em amarelo abaixo.</p>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              Histórico ({filtered.length}{filtered.length !== compras.length ? ` de ${compras.length}` : ""})
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {descontosTotais > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-success/10 text-success border border-success/20 rounded-md px-2.5 py-1 text-xs font-medium">
                  <Wallet className="h-3 w-3" /> Descontos totais: <strong>{formatCurrency(descontosTotais)}</strong>
                </span>
              )}
              <div className="relative w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar fornecedor, NF, produto..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
                  className="pl-8 pr-8 h-8 text-xs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
              {chips.map((c) => (
                <button
                  key={c.v}
                  onClick={() => { setFiltroTipo(c.v); setShowAll(false); }}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    filtroTipo === c.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
              {([
                { v: "todos", label: "Todas" },
                { v: "conferidas", label: "✓ Conferidas" },
                { v: "nao_conferidas", label: "Não conferidas" },
              ] as const).map((c) => (
                <button
                  key={c.v}
                  onClick={() => { setFiltroConf(c.v); setShowAll(false); }}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    filtroConf === c.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                {["Conferida", "Data", "Loja", "Fornecedor", "NF", "Tipo", "CFOP", "Qtd", "Preço Unit.", "Desconto", "Total", "Vencimento", "Pago", ""].map((h, i) => (
                  <th key={`${h}-${i}`} className="px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {display.map((c: any) => {
                const isDup = dupNFs.has(c.numero_nf || c.id);
                const vencido = isVencido(c);
                const tipoBase = TIPO_LABEL[c.tipo_produto || "outros"] || TIPO_LABEL.outros;
                let subtipo: string | null = null;
                if (c.tipo_produto === "cheio" || c.tipo_produto === "vasilhame") {
                  const desc = String(c.produto_descricao || "").toLowerCase();
                  if (Number(c.qtd_p13 || 0) > 0 || /p[\s-]?13|13\s*kg/.test(desc)) subtipo = "P13";
                  else if (Number(c.qtd_p20 || 0) > 0 || /p[\s-]?20|20\s*kg/.test(desc)) subtipo = "P20";
                  else if (Number(c.qtd_p45 || 0) > 0 || /p[\s-]?45|45\s*kg/.test(desc)) subtipo = "P45";
                  else if (Number(c.qtd_agua || 0) > 0 || /água|agua|water/.test(desc)) subtipo = "Água";
                }
                const qtd = Number(c.quantidade || 0) || (Number(c.qtd_p13 || 0) + Number(c.qtd_p20 || 0) + Number(c.qtd_p45 || 0) + Number(c.qtd_agua || 0));
                const pu = Number(c.preco_unitario || 0);
                const desc = Number(c.desconto || 0);
                const puLiquido = qtd > 0 && desc > 0 ? pu - desc / qtd : pu;
                return (
                  <tr key={c.id} className={`hover:bg-muted/20 ${isDup ? "bg-warning/5" : ""} ${c.pago ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleConferida(c)}
                        className={`inline-flex items-center justify-center h-5 w-5 rounded border ${
                          c.conferida ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
                        }`}
                        title={
                          c.conferida
                            ? `Conferida${c.conferida_em ? ` em ${fmtDate(String(c.conferida_em).slice(0, 10))}` : ""} — clique para desmarcar`
                            : "Marcar NF como conferida"
                        }
                      >
                        {c.conferida && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(c.data)}</td>
                    <td className="px-3 py-2 text-foreground">{lojaNome(c.unidade_id)}</td>
                    <td className="px-3 py-2 text-foreground font-medium max-w-[180px] truncate" title={c.fornecedor}>
                      {c.fornecedor}
                      {c.cidade_fornecedor && <span className="text-muted-foreground font-normal"> · {c.cidade_fornecedor}</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {isDup && <AlertTriangle className="inline h-3 w-3 text-warning mr-1" />}
                      {c.numero_nf || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 flex-wrap">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${tipoBase.cls}`}>
                          {tipoBase.label}
                        </span>
                        {subtipo && (
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${SUBTIPO_CLS[subtipo]}`}>
                            {subtipo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.cfop || "—"}</td>
                    <td className="px-3 py-2 text-center text-foreground">{qtd > 0 ? formatNumber(qtd, 0) : "—"}</td>
                    <td className="px-3 py-2 text-primary font-semibold">
                      {puLiquido > 0 ? formatCurrency(puLiquido) : "—"}
                      {desc > 0 && pu > 0 && (
                        <div className="text-[9px] text-muted-foreground font-normal line-through">{formatCurrency(pu)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-success">{desc > 0 ? formatCurrency(desc) : "—"}</td>
                    <td className="px-3 py-2 font-bold text-foreground">{formatCurrency(Number(c.custo_total))}</td>
                    <td className="px-3 py-2">
                      {editingVenc[c.id] !== undefined ? (
                        <Input
                          type="date"
                          autoFocus
                          value={editingVenc[c.id]}
                          onChange={(e) => setEditingVenc((p) => ({ ...p, [c.id]: e.target.value }))}
                          onBlur={(e) => saveVenc(c, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveVenc(c, editingVenc[c.id]);
                            if (e.key === "Escape") setEditingVenc((p) => { const n = { ...p }; delete n[c.id]; return n; });
                          }}
                          className="h-7 text-xs w-32"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingVenc((p) => ({ ...p, [c.id]: c.data_vencimento || "" }))}
                          className={`inline-flex items-center gap-1 hover:underline ${
                            c.pago ? "line-through text-success" : vencido ? "text-destructive font-semibold" : "text-foreground"
                          }`}
                          title="Clique para editar"
                        >
                          <Calendar className="h-3 w-3" />
                          {fmtDate(c.data_vencimento)}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => togglePago(c)}
                        className={`inline-flex items-center justify-center h-5 w-5 rounded border ${
                          c.pago ? "bg-success border-success text-success-foreground" : "border-border hover:border-primary"
                        }`}
                        title={c.pago ? "Marcar como não pago" : "Marcar como pago"}
                      >
                        {c.pago && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          setExcluindo({
                            id: c.id,
                            nf: c.numero_nf || undefined,
                            fornecedor: c.fornecedor || undefined,
                            escopo: c.numero_nf ? "nf" : "linha",
                          })
                        }
                        className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Excluir esta NF"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {display.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center py-8 text-muted-foreground">Nenhuma compra encontrada</td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-muted/40 border-t-2 border-border">
                <tr className="font-semibold">
                  <td colSpan={7} className="px-3 py-2.5 text-right text-foreground">Totais ({filtered.length} {filtered.length === 1 ? "registro" : "registros"})</td>
                  <td className="px-3 py-2.5 text-center text-foreground">{formatNumber(totaisFiltrados.qtd, 0)}</td>
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-success">{totaisFiltrados.desconto > 0 ? formatCurrency(totaisFiltrados.desconto) : "—"}</td>
                  <td className="px-3 py-2.5 text-foreground font-bold">{formatCurrency(totaisFiltrados.total)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>

        </div>

        {filtered.length > 30 && (
          <div className="p-3 border-t border-border/40 text-center">
            <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Mostrar menos" : `Ver todas (${filtered.length})`}
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta nota fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo?.escopo === "nf"
                ? `Todos os itens da NF ${excluindo?.nf} (${excluindo?.fornecedor || "—"}) serão removidos permanentemente.`
                : "Este registro será removido permanentemente. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluindo && excluirMut.mutate(excluindo)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
