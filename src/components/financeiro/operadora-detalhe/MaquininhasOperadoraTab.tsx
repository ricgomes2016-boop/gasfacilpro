import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

export function MaquininhasOperadoraTab({ operadoraId, operadoraNome }: { operadoraId: string; operadoraNome: string }) {
  const { unidadeAtual } = useUnidade();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", numero_serie: "", modelo: "", status: "ativo" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["maquininhas-operadora", operadoraId, unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase
        .from("terminais_cartao")
        .select("id,nome,numero_serie,modelo,status,observacoes,created_at")
        .eq("operadora_id", operadoraId)
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    const { error } = await supabase.from("terminais_cartao").insert({
      ...form,
      operadora: operadoraNome,
      operadora_id: operadoraId,
      unidade_id: unidadeAtual?.id || null,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Maquininha cadastrada");
    setOpen(false);
    setForm({ nome: "", numero_serie: "", modelo: "", status: "ativo" });
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
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto opacity-40 mb-2" />Nenhuma maquininha cadastrada
                </TableCell></TableRow>
              )}
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.modelo || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.numero_serie || "—"}</TableCell>
                  <TableCell><Badge variant={r.status === "ativo" ? "default" : "outline"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => remover(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
