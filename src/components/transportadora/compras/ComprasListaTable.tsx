import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, X, Calendar, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/transp-utils";

interface Props { compras: any[]; }

export function ComprasListaTable({ compras }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingVenc, setEditingVenc] = useState<Record<string, string>>({});

  // Detectar NFs duplicadas (mesma chave_nfe ou mesmo numero_nf+fornecedor)
  const dupNFs = useMemo(() => {
    const counts: Record<string, number> = {};
    compras.forEach((c) => {
      const key = c.chave_nfe || (c.numero_nf ? `${c.numero_nf}_${c.fornecedor}` : null);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return new Set(
      compras
        .filter((c) => {
          const key = c.chave_nfe || (c.numero_nf ? `${c.numero_nf}_${c.fornecedor}` : null);
          return key && counts[key] > 1;
        })
        .map((c) => c.numero_nf || c.id)
    );
  }, [compras]);

  const filtered = useMemo(() => {
    if (!search.trim()) return compras;
    const q = search.toLowerCase();
    return compras.filter((c) =>
      (c.fornecedor || "").toLowerCase().includes(q) ||
      (c.numero_nf || "").toLowerCase().includes(q) ||
      (c.cidade_fornecedor || "").toLowerCase().includes(q) ||
      (c.cfop || "").includes(q)
    );
  }, [compras, search]);

  const display = showAll ? filtered : filtered.slice(0, 30);

  const updateField = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase as any).from("transp_compras").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePago = (c: any) => {
    const novo = !c.pago;
    updateField.mutate({
      id: c.id,
      patch: { pago: novo, data_pagamento: novo ? new Date().toISOString().slice(0, 10) : null },
    });
    toast.success(novo ? "NF marcada como paga" : "NF desmarcada");
  };

  const saveVenc = (c: any, val: string) => {
    setEditingVenc((p) => { const n = { ...p }; delete n[c.id]; return n; });
    updateField.mutate({ id: c.id, patch: { data_vencimento: val || null } });
    toast.success("Vencimento salvo");
  };

  const fmtDate = (d?: string) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "—";
  const isVencido = (c: any) => c.data_vencimento && !c.pago && new Date(c.data_vencimento) < new Date();

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

        <div className="p-4 border-b border-border/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              Histórico ({filtered.length}{filtered.length !== compras.length ? ` de ${compras.length}` : ""})
            </p>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar fornecedor, NF, cidade, CFOP..."
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

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                {["Data", "Fornecedor", "NF", "P13", "P20", "P45", "Total", "Vencimento", "Pago"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {display.map((c: any) => {
                const isDup = dupNFs.has(c.numero_nf || c.id);
                const vencido = isVencido(c);
                return (
                  <tr key={c.id} className={`hover:bg-muted/20 ${isDup ? "bg-warning/5" : ""} ${c.pago ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(c.data)}</td>
                    <td className="px-3 py-2 text-foreground font-medium max-w-[180px] truncate" title={c.fornecedor}>
                      {c.fornecedor}
                      {c.cidade_fornecedor && <span className="text-muted-foreground font-normal"> · {c.cidade_fornecedor}</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {isDup && <AlertTriangle className="inline h-3 w-3 text-warning mr-1" />}
                      {c.numero_nf || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">{c.qtd_p13 || "—"}</td>
                    <td className="px-3 py-2 text-center">{c.qtd_p20 || "—"}</td>
                    <td className="px-3 py-2 text-center">{c.qtd_p45 || "—"}</td>
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
                  </tr>
                );
              })}
              {display.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma compra encontrada</td>
                </tr>
              )}
            </tbody>
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
    </Card>
  );
}
