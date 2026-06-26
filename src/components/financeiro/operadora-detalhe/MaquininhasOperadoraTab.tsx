import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, CreditCard, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { getBankTheme } from "@/lib/bancos/bankThemes";

export function MaquininhasOperadoraTab({ operadoraId, operadoraNome }: { operadoraId: string; operadoraNome: string }) {
  const { unidadeAtual } = useUnidade();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", numero_serie: "", modelo: "", status: "ativo", conta_bancaria_id: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["maquininhas-operadora", operadoraId, unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase
        .from("terminais_cartao")
        .select("id,nome,numero_serie,modelo,status,observacoes,conta_bancaria_id,created_at,conta_bancaria:contas_bancarias(id,nome,banco)")
        .eq("operadora_id", operadoraId)
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-bancarias-maquininha", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id,nome,banco").eq("ativo", true);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    const { error } = await supabase.from("terminais_cartao").insert({
      nome: form.nome,
      numero_serie: form.numero_serie || null,
      modelo: form.modelo || null,
      status: form.status,
      operadora: operadoraNome,
      operadora_id: operadoraId,
      unidade_id: unidadeAtual?.id || null,
      conta_bancaria_id: form.conta_bancaria_id && form.conta_bancaria_id !== "nenhuma" ? form.conta_bancaria_id : null,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Maquininha cadastrada");
    setOpen(false);
    setForm({ nome: "", numero_serie: "", modelo: "", status: "ativo", conta_bancaria_id: "" });
    qc.invalidateQueries({ queryKey: ["maquininhas-operadora", operadoraId] });
  };

  const atualizarConta = async (terminalId: string, contaId: string) => {
    const novo = contaId === "nenhuma" ? null : contaId;
    const { error } = await supabase.from("terminais_cartao").update({ conta_bancaria_id: novo }).eq("id", terminalId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Conta atualizada");
    qc.invalidateQueries({ queryKey: ["maquininhas-operadora", operadoraId] });
  };

  const remover = async (id: string) => {
    if (!confirm("Remover esta maquininha?")) return;
    const { error } = await supabase.from("terminais_cartao").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Removida");
    qc.invalidateQueries({ queryKey: ["maquininhas-operadora", operadoraId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{rows.length} maquininha(s) cadastrada(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Nova maquininha</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova maquininha</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome / Apelido</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>Número de série</Label><Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Moderninha Pro 2, Stone S920..." /></div>
              <div>
                <Label>Conta de recebimento (opcional)</Label>
                <Select value={form.conta_bancaria_id || "nenhuma"} onValueChange={v => setForm({ ...form, conta_bancaria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Usar da operadora" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">— Usar conta da operadora —</SelectItem>
                    {contas.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} ({c.banco})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Sobrescreve a conta da operadora apenas para esta maquininha.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar}>Cadastrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Nº Série</TableHead>
                <TableHead>Conta de recebimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto opacity-40 mb-2" />Nenhuma maquininha cadastrada
                </TableCell></TableRow>
              )}
              {rows.map((r: any) => {
                const conta = r.conta_bancaria;
                const theme = conta ? getBankTheme(conta.banco) : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.modelo || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.numero_serie || "—"}</TableCell>
                    <TableCell>
                      <Select value={r.conta_bancaria_id || "nenhuma"} onValueChange={v => atualizarConta(r.id, v)}>
                        <SelectTrigger className="h-8 min-w-[200px]">
                          {conta && theme ? (
                            <span className="flex items-center gap-1.5">
                              <span
                                className="h-4 w-4 rounded flex items-center justify-center text-[9px] font-bold"
                                style={{ background: theme.primary, color: theme.textColor }}
                              >
                                {theme.initials}
                              </span>
                              <span className="text-xs truncate">{conta.nome}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Da operadora</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhuma">— Da operadora —</SelectItem>
                          {contas.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome} ({c.banco})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Badge variant={r.status === "ativo" ? "default" : "outline"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => remover(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-dashed p-3 bg-muted/20 text-xs text-muted-foreground flex items-start gap-2">
        <Banknote className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <span>
          O recebível de uma venda no cartão cai na <strong>conta da maquininha</strong> (se preenchida) ou, por padrão, na <strong>conta da operadora</strong>.
          Útil quando você tem maquininhas PagBank e Itaú depositando em contas diferentes.
        </span>
      </div>
    </div>
  );
}
