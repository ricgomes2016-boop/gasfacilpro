import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import type { FluxoLateral, ROAjuste } from "@/hooks/useROComplemento";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface Props {
  fluxo: FluxoLateral;
  ajustes: Record<string, ROAjuste>;
  onSave: (chave: string, valor: number, empresaId: string) => void;
  loading?: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function LinhaValor({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <TableRow className="border-border/50">
      <TableCell className="py-1.5 px-3 text-xs">{label}</TableCell>
      <TableCell className={`py-1.5 px-3 text-right text-xs tabular-nums whitespace-nowrap ${destaque ? "font-bold" : "font-medium"}`}>
        R$ {fmt(valor)}
      </TableCell>
    </TableRow>
  );
}

function LinhaEditavel({
  label, valor, onSave,
}: { label: string; valor: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(valor));
  return (
    <TableRow className="border-border/50">
      <TableCell className="py-1.5 px-3 text-xs">{label}</TableCell>
      <TableCell className="py-1 px-3 text-right">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const n = Number(draft.replace(/\./g, "").replace(",", ".")) || 0;
              onSave(n);
              setEditing(false);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="h-7 text-xs text-right tabular-nums w-28 ml-auto"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(String(valor)); setEditing(true); }}
            className={`text-xs tabular-nums whitespace-nowrap ${valor ? "font-medium" : "text-muted-foreground italic"} hover:text-primary`}
          >
            {valor ? `R$ ${fmt(valor)}` : "clique para editar"}
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function FluxoLateralPanel({ fluxo, ajustes, onSave, loading }: Props) {
  const { empresa } = useEmpresa();

  const save = (chave: string, v: number) => {
    if (!empresa?.id) return;
    onSave(chave, v, empresa.id);
  };

  const totalEntradas =
    fluxo.dinheiro + fluxo.cartao + fluxo.boletos + fluxo.chequesPreVista +
    fluxo.valeUltragazP13 + fluxo.valeUltragazP45 + (ajustes.fernando_abm?.valor || 0);
  const totalSaldosBanc = fluxo.saldosBancarios.reduce((s, b) => s + b.saldo, 0);
  const totalEstoque = fluxo.estoqueValorizado.reduce((s, e) => s + e.valor, 0);

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
      {/* Entradas */}
      <Card className="border-[#064e3b]/20 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-[#064e3b]/15 bg-gradient-to-r from-[#0d7a5f]/10 to-transparent px-4 py-2.5">
          <CardTitle className="font-['Sora'] text-[11px] font-bold uppercase tracking-[0.15em] text-[#064e3b] flex items-center justify-between gap-2">
            <span>Entradas</span>
            <span className="text-[10px] tabular-nums text-[#0d7a5f] normal-case tracking-normal">
              R$ {fmt(totalEntradas)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              <LinhaValor label="Dinheiro" valor={fluxo.dinheiro} />
              <LinhaValor label="Cheque Pré + Vista" valor={fluxo.chequesPreVista} />
              <LinhaValor label="Cheque Devolvido" valor={fluxo.chequesDevolvidos} />
              <LinhaValor label="Cartão" valor={fluxo.cartao} />
              <LinhaValor label="Boletos" valor={fluxo.boletos} />
              <LinhaValor label="Vale Ultragaz P13" valor={fluxo.valeUltragazP13} />
              <LinhaValor label="Vale Ultragaz P45" valor={fluxo.valeUltragazP45} />
              <LinhaEditavel label="Fernando ABM Gás" valor={ajustes.fernando_abm?.valor || 0} onSave={(v) => save("fernando_abm", v)} />
              <TableRow className="bg-[#0d7a5f]/10 border-t-2 border-[#0d7a5f]/25">
                <TableCell className="py-2 px-3 text-xs font-['Sora'] font-bold text-[#064e3b]">Total entradas</TableCell>
                <TableCell className="py-2 px-3 text-right text-xs font-['Sora'] font-bold tabular-nums text-[#0d7a5f] whitespace-nowrap">R$ {fmt(totalEntradas)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Saídas / Investimentos / Pendências */}
      <Card className="border-[#064e3b]/20 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-[#064e3b]/15 bg-gradient-to-r from-[#c9a84c]/15 to-transparent px-4 py-2.5">
          <CardTitle className="font-['Sora'] text-[11px] font-bold uppercase tracking-[0.15em] text-[#064e3b] flex items-center justify-between gap-2">
            <span>Saídas / Ajustes</span>
            <span className="text-[10px] tabular-nums text-[#064e3b] normal-case tracking-normal">
              Bancos R$ {fmt(totalSaldosBanc)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              <LinhaEditavel label="Saídas" valor={ajustes.saidas?.valor || 0} onSave={(v) => save("saidas", v)} />
              <LinhaEditavel label="Investimentos" valor={ajustes.investimentos?.valor || 0} onSave={(v) => save("investimentos", v)} />
              <LinhaEditavel label="Pendências" valor={ajustes.pendencias?.valor || 0} onSave={(v) => save("pendencias", v)} />
              <LinhaEditavel label="Nota Crédito" valor={ajustes.nota_credito?.valor || 0} onSave={(v) => save("nota_credito", v)} />
              <TableRow className="bg-[#064e3b]/6">
                <TableCell colSpan={2} className="py-1.5 px-3 text-[10px] font-['Sora'] font-bold uppercase tracking-wider text-[#064e3b]">
                  Saldos bancários
                </TableCell>
              </TableRow>
              {fluxo.saldosBancarios.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="py-2 px-3 text-xs text-center text-muted-foreground italic">Sem contas ativas</TableCell></TableRow>
              ) : fluxo.saldosBancarios.map((b) => (
                <LinhaValor key={b.banco} label={b.banco} valor={b.saldo} />
              ))}
              <TableRow className="bg-[#064e3b]/10 border-t-2 border-[#064e3b]/25">
                <TableCell className="py-2 px-3 text-xs font-['Sora'] font-bold text-[#064e3b]">Total em bancos</TableCell>
                <TableCell className="py-2 px-3 text-right text-xs font-['Sora'] font-bold tabular-nums text-[#064e3b] whitespace-nowrap">R$ {fmt(totalSaldosBanc)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Estoque valorizado */}
      <Card className="border-[#064e3b]/20 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-[#064e3b]/15 bg-gradient-to-r from-[#c9a84c]/20 to-transparent px-4 py-2.5">
          <CardTitle className="font-['Sora'] text-[11px] font-bold uppercase tracking-[0.15em] text-[#064e3b] flex items-center justify-between gap-2">
            <span>Estoque valorizado</span>
            <span className="text-[10px] tabular-nums text-[#c9a84c] normal-case tracking-normal font-bold">
              R$ {fmt(totalEstoque)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableBody>
                {fluxo.estoqueValorizado.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="py-4 px-3 text-xs text-center text-muted-foreground italic">Sem estoque cadastrado</TableCell></TableRow>
                ) : fluxo.estoqueValorizado.map((e) => (
                  <TableRow key={e.produto} className="border-border/40">
                    <TableCell className="py-1.5 px-3 text-xs">
                      <span className="font-medium">{e.produto}</span>
                      <span className="ml-1 text-muted-foreground tabular-nums">({e.qtd})</span>
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-right text-xs tabular-nums font-medium whitespace-nowrap">
                      R$ {fmt(e.valor)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-[#c9a84c]/15 border-t-2 border-[#c9a84c]/40">
                  <TableCell className="py-2 px-3 text-xs font-['Sora'] font-bold text-[#064e3b]">Total estoque</TableCell>
                  <TableCell className="py-2 px-3 text-right text-xs font-['Sora'] font-bold tabular-nums text-[#064e3b] whitespace-nowrap">R$ {fmt(totalEstoque)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
