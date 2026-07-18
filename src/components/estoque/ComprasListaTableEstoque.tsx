import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, X, Calendar, Check, Wallet, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  compras: any[];
  unidadesMap?: Map<string, string>;
  onChanged?: () => void;
  onDelete?: (id: string) => void;
}

type FiltroTipo = "todos" | "cheio" | "vasilhame" | "outros";

const TIPO_LABEL: Record<string, { label: string; cls: string }> = {
  cheio: { label: "Cheio", cls: "bg-success/10 text-success border-success/20" },
  vasilhame: { label: "Vasilhame", cls: "bg-warning/10 text-warning border-warning/20" },
  outros: { label: "Outros", cls: "bg-muted text-muted-foreground border-border" },
};

const SUBTIPO_CLS: Record<string, string> = {
  P13: "bg-info/10 text-info dark:text-info border-info/30",
  P20: "bg-primary/10 text-primary dark:text-primary border-primary/30",
  P45: "bg-destructive/10 text-destructive dark:text-destructive border-destructive/30",
  "Água": "bg-info/10 text-info dark:text-info border-info/30",
};

const fmtBRL = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (n: number, d = 0) =>
  (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function ComprasListaTableEstoque({ compras, unidadesMap, onChanged, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingVenc, setEditingVenc] = useState<Record<string, string>>({});
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroConf, setFiltroConf] = useState<"todos" | "conferidas" | "nao_conferidas">("todos");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const qtdTotal = (c: any) =>
    (c.compra_itens || []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);

  const dupNFs = useMemo(() => {
    const counts: Record<string, number> = {};
    const keyOf = (c: any) => {
      const nfKey =
        c.chave_nfe ||
        (c.numero_nota_fiscal ? `${c.numero_nota_fiscal}_${c.fornecedores?.razao_social || ""}` : null);
      if (!nfKey) return null;
      const val = Number(c.valor_total || 0).toFixed(2);
      return `${nfKey}__${val}`;
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
        .map((c) => c.numero_nota_fiscal || c.id),
    );
  }, [compras]);

  const descontosTotais = useMemo(
    () => compras.reduce((s, c) => s + Number(c.valor_desconto || 0), 0),
    [compras],
  );

  const filtered = useMemo(() => {
    let list = compras;
    if (filtroTipo !== "todos") {
      list = list.filter((c) => (c.tipo_produto || "outros") === filtroTipo);
    }
    if (filtroConf === "conferidas") list = list.filter((c) => !!c.conferida);
    else if (filtroConf === "nao_conferidas") list = list.filter((c) => !c.conferida);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.fornecedores?.razao_social || "").toLowerCase().includes(q) ||
          (c.numero_nota_fiscal || "").toLowerCase().includes(q) ||
          (c.cfop_predominante || "").includes(q) ||
          (c.observacoes || "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const da = String(a.data_compra || a.created_at || "");
      const db = String(b.data_compra || b.created_at || "");
      return db.localeCompare(da);
    });
  }, [compras, search, filtroTipo, filtroConf]);

  const totaisFiltrados = useMemo(() => {
    let qtd = 0,
      total = 0,
      desconto = 0;
    for (const c of filtered) {
      qtd += qtdTotal(c);
      total += Number(c.valor_total || 0);
      desconto += Number(c.valor_desconto || 0);
    }
    return { qtd, total, desconto };
  }, [filtered]);

  const display = showAll ? filtered : filtered.slice(0, 30);

  const updateField = async (id: string, patch: any) => {
    const { error } = await supabase.from("compras").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    onChanged?.();
    return true;
  };

  const togglePago = async (c: any) => {
    const novo = !c.pago;
    const ok = await updateField(c.id, {
      pago: novo,
      data_pagamento: novo ? new Date().toISOString().slice(0, 10) : null,
    });
    if (ok) toast.success(novo ? "NF marcada como paga" : "NF desmarcada");
  };

  const toggleConferida = async (c: any) => {
    const novo = !c.conferida;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ok = await updateField(c.id, {
      conferida: novo,
      conferida_em: novo ? new Date().toISOString() : null,
      conferida_por: novo ? user?.id || null : null,
    });
    if (ok) toast.success(novo ? "NF conferida" : "Conferência removida");
  };

  const saveVenc = async (c: any, val: string) => {
    setEditingVenc((p) => {
      const n = { ...p };
      delete n[c.id];
      return n;
    });
    const ok = await updateField(c.id, { data_vencimento: val || null });
    if (ok) toast.success("Vencimento salvo");
  };

  const fmtDate = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "—");
  const isVencido = (c: any) =>
    c.data_vencimento && !c.pago && new Date(c.data_vencimento) < new Date();

  const lojaNome = (id?: string | null) => (id ? unidadesMap?.get(id) || "—" : "—");

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const subtiposFor = (c: any): string[] => {
    const desc = String(c.observacoes || "").toLowerCase();
    const itensTxt = (c.compra_itens || [])
      .map((i: any) => `${i.produtos?.nome || ""} ${i.descricao || ""}`)
      .join(" ")
      .toLowerCase();
    const t = `${desc} ${itensTxt}`;
    const found: string[] = [];
    if (/\bp[\s\-\.]*13\b|13\s*kg|glp\s*13|botij[aã]o\s*13/.test(t)) found.push("P13");
    if (/\bp[\s\-\.]*20\b|20\s*kg|glp\s*20/.test(t)) found.push("P20");
    if (/\bp[\s\-\.]*45\b|45\s*kg|glp\s*45/.test(t)) found.push("P45");
    if (/[áa]gua|gal[aã]o\s*20\s*l|20\s*litros/.test(t)) found.push("Água");
    return found;
  };

  return (
    <Card className="border-border/40">
      <CardContent className="p-0">
        {dupNFs.size > 0 && (
          <div className="flex items-start gap-2 m-4 mb-0 bg-warning/10 border border-warning/30 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {dupNFs.size} NF(s) duplicada(s) detectada(s)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verifique os registros marcados em amarelo abaixo.
              </p>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              Histórico ({filtered.length}
              {filtered.length !== compras.length ? ` de ${compras.length}` : ""})
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {descontosTotais > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-success/10 text-success border border-success/20 rounded-md px-2.5 py-1 text-xs font-medium">
                  <Wallet className="h-3 w-3" /> Descontos totais: <strong>{fmtBRL(descontosTotais)}</strong>
                </span>
              )}
              <div className="relative w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar fornecedor, NF, CFOP..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowAll(false);
                  }}
                  className="pl-8 pr-8 h-8 text-xs"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
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
                  onClick={() => {
                    setFiltroTipo(c.v);
                    setShowAll(false);
                  }}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    filtroTipo === c.v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
              {(
                [
                  { v: "todos", label: "Todas" },
                  { v: "conferidas", label: "✓ Conferidas" },
                  { v: "nao_conferidas", label: "Não conferidas" },
                ] as const
              ).map((c) => (
                <button
                  key={c.v}
                  onClick={() => {
                    setFiltroConf(c.v);
                    setShowAll(false);
                  }}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    filtroConf === c.v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border/40">
          {display.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma compra encontrada</p>
          )}
          {display.map((c: any) => {
            const isDup = dupNFs.has(c.numero_nota_fiscal || c.id);
            const vencido = isVencido(c);
            const tipoBase = TIPO_LABEL[c.tipo_produto || "outros"] || TIPO_LABEL.outros;
            const subtipos = subtiposFor(c);
            const qtd = qtdTotal(c);
            const dataExibida = c.data_compra ? c.data_compra : String(c.created_at || "").slice(0, 10);
            return (
              <div key={c.id} className={`p-3 space-y-2 ${isDup ? "bg-warning/5" : ""} ${c.pago ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {c.fornecedores?.razao_social || "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {fmtDate(dataExibida)} · NF {c.numero_nota_fiscal || "—"}
                      {isDup && <AlertTriangle className="inline h-3 w-3 text-warning ml-1" />}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-foreground whitespace-nowrap">
                      {fmtBRL(Number(c.valor_total || 0))}
                    </p>
                    {qtd > 0 && (
                      <p className="text-[10px] text-muted-foreground">{fmtNum(qtd, 0)} un</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(subtipos.length > 0 ? subtipos.map((s) => (
                    <span key={s} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${SUBTIPO_CLS[s]}`}>{s}</span>
                  )) : (
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${tipoBase.cls}`}>{tipoBase.label}</span>
                  ))}
                  {c.data_vencimento && (
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                      c.pago ? "bg-success/10 text-success border-success/30"
                        : vencido ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      <Calendar className="h-2.5 w-2.5" /> Venc {fmtDate(c.data_vencimento)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleConferida(c)}
                      className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-md border text-[11px] font-medium ${
                        c.conferida ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      <Check className="h-3 w-3" />{c.conferida ? "Conferida" : "Conferir"}
                    </button>
                    <button
                      onClick={() => togglePago(c)}
                      className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-md border text-[11px] font-medium ${
                        c.pago ? "bg-success/10 border-success/40 text-success" : "border-border text-muted-foreground"
                      }`}
                    >
                      <Wallet className="h-3 w-3" />{c.pago ? "Pago" : "Marcar pago"}
                    </button>
                  </div>
                  {onDelete && (
                    <button onClick={() => onDelete(c.id)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                {[
                  "Conferida",
                  "Data",
                  "Loja",
                  "Fornecedor",
                  "NF",
                  "Tipo",
                  "CFOP",
                  "Qtd",
                  "Preço Unit.",
                  "Desconto",
                  "Total",
                  "Vencimento",
                  "Pago",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {display.map((c: any) => {
                const isDup = dupNFs.has(c.numero_nota_fiscal || c.id);
                const vencido = isVencido(c);
                const tipoBase = TIPO_LABEL[c.tipo_produto || "outros"] || TIPO_LABEL.outros;
                const subtipos = subtiposFor(c);
                const qtd = qtdTotal(c);
                const desc = Number(c.valor_desconto || 0);
                const valorProdutos = Number(c.valor_produtos || c.valor_total || 0);
                const pu = qtd > 0 ? valorProdutos / qtd : 0;
                const puLiquido = qtd > 0 && desc > 0 ? pu - desc / qtd : pu;
                const dataExibida = c.data_compra
                  ? c.data_compra
                  : String(c.created_at || "").slice(0, 10);
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-muted/20 ${isDup ? "bg-warning/5" : ""} ${
                      c.pago ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleConferida(c)}
                        className={`inline-flex items-center justify-center h-5 w-5 rounded border ${
                          c.conferida
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border hover:border-primary"
                        }`}
                        title={c.conferida ? "Conferida — clique para desmarcar" : "Marcar NF como conferida"}
                      >
                        {c.conferida && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDate(dataExibida)}
                    </td>
                    <td className="px-3 py-2 text-foreground">{lojaNome(c.unidade_id)}</td>
                    <td
                      className="px-3 py-2 text-foreground font-medium max-w-[180px] truncate"
                      title={c.fornecedores?.razao_social || ""}
                    >
                      {c.fornecedores?.razao_social || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {isDup && <AlertTriangle className="inline h-3 w-3 text-warning mr-1" />}
                      {c.numero_nota_fiscal || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 flex-wrap">
                        {subtipos.length > 0 ? (
                          subtipos.map((s) => (
                            <span
                              key={s}
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${SUBTIPO_CLS[s]}`}
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${tipoBase.cls}`}
                          >
                            {tipoBase.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.cfop_predominante || "—"}</td>
                    <td className="px-3 py-2 text-center text-foreground">
                      {qtd > 0 ? fmtNum(qtd, 0) : "—"}
                    </td>
                    <td className="px-3 py-2 text-primary font-semibold">
                      {puLiquido > 0 ? fmtBRL(puLiquido) : "—"}
                      {desc > 0 && pu > 0 && (
                        <div className="text-[9px] text-muted-foreground font-normal line-through">
                          {fmtBRL(pu)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-success">{desc > 0 ? fmtBRL(desc) : "—"}</td>
                    <td className="px-3 py-2 font-bold text-foreground">
                      {fmtBRL(Number(c.valor_total || 0))}
                    </td>
                    <td className="px-3 py-2">
                      {editingVenc[c.id] !== undefined ? (
                        <Input
                          type="date"
                          autoFocus
                          value={editingVenc[c.id]}
                          onChange={(e) =>
                            setEditingVenc((p) => ({ ...p, [c.id]: e.target.value }))
                          }
                          onBlur={(e) => saveVenc(c, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveVenc(c, editingVenc[c.id]);
                            if (e.key === "Escape")
                              setEditingVenc((p) => {
                                const n = { ...p };
                                delete n[c.id];
                                return n;
                              });
                          }}
                          className="h-7 text-xs w-32"
                        />
                      ) : (
                        <button
                          onClick={() =>
                            setEditingVenc((p) => ({ ...p, [c.id]: c.data_vencimento || "" }))
                          }
                          className={`inline-flex items-center gap-1 hover:underline ${
                            c.pago
                              ? "line-through text-success"
                              : vencido
                              ? "text-destructive font-semibold"
                              : "text-foreground"
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
                          c.pago
                            ? "bg-success border-success text-success-foreground"
                            : "border-border hover:border-primary"
                        }`}
                        title={c.pago ? "Marcar como não pago" : "Marcar como pago"}
                      >
                        {c.pago && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {onDelete && (
                        <button
                          onClick={() => onDelete(c.id)}
                          className="text-destructive/70 hover:text-destructive"
                          title="Excluir compra"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {display.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center py-8 text-muted-foreground">
                    Nenhuma compra encontrada
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-muted/40 border-t-2 border-border">
                <tr className="font-semibold">
                  <td colSpan={7} className="px-3 py-2.5 text-right text-muted-foreground">
                    Totais filtrados:
                  </td>
                  <td className="px-3 py-2.5 text-center text-foreground">
                    {totaisFiltrados.qtd > 0 ? fmtNum(totaisFiltrados.qtd, 0) : "—"}
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-success">
                    {totaisFiltrados.desconto > 0 ? fmtBRL(totaisFiltrados.desconto) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-foreground">{fmtBRL(totaisFiltrados.total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {filtered.length > 30 && (
          <div className="p-3 border-t border-border/40 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Mostrar menos" : `Ver todas (${filtered.length})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
