import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { addDays, format, startOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { conferenciaApi } from "@/lib/estoque/conferenciaPortal";
import { GRUPOS_REL, LinhaRel, nomeGrupo, relatorioEntradas, relatorioRecebidas, relatorioVendas, totaisPorGrupo } from "@/lib/estoque/conferenciaRelatorios";

type Tipo = "entradas" | "vendas" | "recebidas";
const TITULO: Record<Tipo, string> = { entradas: "Entradas", vendas: "Vendas", recebidas: "Transferências recebidas" };
const br = (d: string) => d.split("-").reverse().join("/");
const shift = (d: string, n: number) => format(addDays(new Date(`${d}T12:00:00`), n), "yyyy-MM-dd");

interface Props { portal: boolean; unidades: { id: string; nome: string }[] }

export function RelatoriosConferenciaDialog({ portal, unidades }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("entradas");
  const [de, setDe] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [ate, setAte] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loja, setLoja] = useState("todas");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linhas, setLinhas] = useState<LinhaRel[] | null>(null);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map(unidades.map((u) => [u.id, u.nome])));

  const gerar = async () => {
    setLoading(true); setError(""); setLinhas(null);
    try {
      if (de > ate) throw new Error("A data inicial deve ser antes da final.");
      const lojas = loja === "todas" ? unidades.map((u) => u.id) : [loja];
      let d: any;
      if (portal) {
        d = await conferenciaApi({ action: "report", from: de, to: ate });
      } else {
        const ids = unidades.map((u) => u.id).join(",");
        const sb = supabase as any;
        const [c, l, m, a, n] = await Promise.all([
          sb.from("estoque_conferencia_fechamentos").select("data_conferencia, data_contagem, momento, unidade_id, produto_grupo, tipo_estoque, quantidade").in("unidade_id", lojas).gte("data_contagem", shift(de, -1)).lte("data_contagem", shift(ate, 1)).limit(20000),
          sb.from("estoque_conferencias").select("data_conferencia, unidade_id, produto_grupo, tipo_estoque, quantidade").in("unidade_id", lojas).gte("data_conferencia", shift(de, -1)).lte("data_conferencia", shift(ate, 1)).limit(20000),
          sb.from("estoque_conferencia_movimentos").select("tipo, unidade_id, unidade_destino_id, produto_grupo, quantidade, data_conferencia").or(`unidade_id.in.(${ids}),unidade_destino_id.in.(${ids})`).gte("data_conferencia", de).lte("data_conferencia", ate).limit(20000),
          sb.from("estoque_conferencia_saldo_ajustes").select("data_conferencia, unidade_id, produto_grupo, cheio").in("unidade_id", lojas).gte("data_conferencia", de).lte("data_conferencia", ate),
          sb.from("unidades").select("id, nome"),
        ]);
        for (const r of [c, l, m, a]) if (r.error) throw r.error;
        d = { closings: c.data, legacy: l.data, movements: m.data, adjustments: a.data, names: n.data };
      }
      if (d.names) setNomes(new Map([...unidades.map((u) => [u.id, u.nome] as [string, string]), ...d.names.map((u: any) => [u.id, u.nome] as [string, string])]));
      const movs = d.movements || [];
      setLinhas(tipo === "entradas" ? relatorioEntradas(movs, lojas, de, ate)
        : tipo === "recebidas" ? relatorioRecebidas(movs, lojas, de, ate)
        : relatorioVendas(d.closings || [], d.legacy || [], movs, d.adjustments || [], lojas, de, ate));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally { setLoading(false); }
  };

  const totais = useMemo(() => totaisPorGrupo(linhas || []), [linhas]);
  const nome = (id?: string) => (id ? nomes.get(id) || "Loja" : "");
  type Q = Record<string, number | null>;
  const pivot = useMemo(() => {
    const m = new Map<string, { data: string; unidadeId: string; origemId?: string; q: Q }>();
    (linhas || []).forEach((l) => {
      const k = `${l.data}|${l.unidadeId}|${l.origemId || ""}`;
      const r = m.get(k) || { data: l.data, unidadeId: l.unidadeId, origemId: l.origemId, q: {} };
      r.q[l.grupo] = l.quantidade === null ? (r.q[l.grupo] ?? null) : ((r.q[l.grupo] as number) || 0) + l.quantidade;
      m.set(k, r);
    });
    return [...m.values()];
  }, [linhas]);
  const resumo = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    (linhas || []).forEach((l) => { const r = m.get(l.unidadeId) || { P13: 0, P20: 0, P45: 0, Agua: 0 }; if (l.quantidade !== null) r[l.grupo] += l.quantidade; m.set(l.unidadeId, r); });
    return [...m.entries()].map(([id, q]) => ({ id, q })).sort((a, b) => nome(a.id).localeCompare(nome(b.id)));
  }, [linhas, nomes]);
  const cel = (v: number | null | undefined) => (v === null ? "sem fechamento" : v ?? 0);

  const baixar = () => {
    if (!linhas) return;
    const lojaCol = tipo === "recebidas" ? "Loja que recebeu" : "Loja";
    const head = [tipo === "vendas" ? "Data da venda" : "Data", lojaCol, ...(tipo === "recebidas" ? ["Loja de origem"] : []), ...GRUPOS_REL.map(nomeGrupo)];
    const aoa: (string | number)[][] = [[`Relatório de ${TITULO[tipo]} — ${br(de)} a ${br(ate)}`], [], head,
      ...pivot.map((r) => [br(r.data), nome(r.unidadeId), ...(tipo === "recebidas" ? [nome(r.origemId)] : []), ...GRUPOS_REL.map((g) => cel(r.q[g]))]),
      [], ["Resumo por loja"], ["Loja", ...GRUPOS_REL.map(nomeGrupo)],
      ...resumo.map((r) => [nome(r.id), ...GRUPOS_REL.map((g) => r.q[g])]),
      ["Total geral", ...GRUPOS_REL.map((g) => totais[g])]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = head.map((_, k) => ({ wch: k < (tipo === "recebidas" ? 3 : 2) ? 22 : 10 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, TITULO[tipo].slice(0, 31));
    XLSX.writeFile(wb, `relatorio-${tipo}-${de}-a-${ate}.xlsx`);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" /> Relatórios
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle>Relatórios da conferência</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Relatório</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setLinhas(null); }}>
                <SelectTrigger className="h-10 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(TITULO) as Tipo[]).map((t) => <SelectItem key={t} value={t}>{TITULO[t]}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Loja</Label>
              <Select value={loja} onValueChange={(v) => { setLoja(v); setLinhas(null); }}>
                <SelectTrigger className="h-10 text-base"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todas">Todas as lojas</SelectItem>{unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>De</Label><Input type="date" className="h-10 text-base" value={de} onChange={(e) => setDe(e.target.value)} /></div>
            <div className="space-y-1"><Label>Até</Label><Input type="date" className="h-10 text-base" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={gerar} disabled={loading} className="h-10">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar relatório</Button>
            <Button variant="outline" onClick={baixar} disabled={!linhas?.length} className="h-10 gap-2"><FileSpreadsheet className="h-4 w-4" /> Baixar planilha (Excel)</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {linhas && (linhas.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nada encontrado no período.</p> : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRUPOS_REL.map((g) => (
                  <div key={g} className="overflow-hidden rounded-md border border-border text-center">
                    <div className="bg-foreground px-2 py-0.5 text-xs font-black text-background">{nomeGrupo(g)}</div>
                    <div className="py-1 text-base font-black">{totais[g]}</div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted"><tr>
                    <th className="p-2 text-left">Data</th><th className="p-2 text-left">Loja</th>
                    {tipo === "recebidas" && <th className="p-2 text-left">Origem</th>}
                    {GRUPOS_REL.map((g) => <th key={g} className="p-2 text-right">{nomeGrupo(g)}</th>)}
                  </tr></thead>
                  <tbody>{pivot.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap">{br(r.data)}</td><td className="p-2">{nome(r.unidadeId)}</td>
                      {tipo === "recebidas" && <td className="p-2">{nome(r.origemId)}</td>}
                      {GRUPOS_REL.map((g) => <td key={g} className="p-2 text-right font-bold">{r.q[g] === null ? <span className="text-xs font-normal text-muted-foreground">sem fech.</span> : r.q[g] ?? 0}</td>)}
                    </tr>))}</tbody>
                  <tfoot className="bg-muted">
                    <tr><th colSpan={tipo === "recebidas" ? 7 : 6} className="p-2 text-left">Resumo por loja</th></tr>
                    {resumo.map((r) => (
                      <tr key={r.id} className="border-t border-border"><td className="p-2 font-bold" colSpan={tipo === "recebidas" ? 3 : 2}>{nome(r.id)}</td>
                        {GRUPOS_REL.map((g) => <td key={g} className="p-2 text-right font-bold">{r.q[g]}</td>)}</tr>))}
                  </tfoot>
                </table>
              </div>
            </>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
