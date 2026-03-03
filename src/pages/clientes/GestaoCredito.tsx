import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, DollarSign, Users, Lock, Unlock, Search, Loader2, Settings2, AlertTriangle, TrendingDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

export default function GestaoCredito() {
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("visao");
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState<any>(null);
  const [editData, setEditData] = useState({ limite_credito: 0, score_risco: "medio" });

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes_credito", empresa?.id],
    enabled: !!empresa?.id,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome, telefone, limite_credito, saldo_devedor, score_risco, bloqueio_credito, motivo_bloqueio, data_ultimo_pagamento").eq("empresa_id", empresa!.id).eq("ativo", true).order("saldo_devedor", { ascending: false });
      return data || [];
    },
  });

  const { data: politicas = [] } = useQuery({
    queryKey: ["politicas_cobranca", empresa?.id],
    enabled: !!empresa?.id,
    queryFn: async () => {
      const { data } = await supabase.from("politicas_cobranca").select("*").eq("empresa_id", empresa!.id);
      return data || [];
    },
  });

  const updateCredito = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase.from("clientes").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clientes_credito"] }); setEditDialog(null); toast.success("Crédito atualizado!"); },
  });

  const toggleBloqueio = useMutation({
    mutationFn: async ({ id, bloqueio }: { id: string; bloqueio: boolean }) => {
      const { error } = await supabase.from("clientes").update({ bloqueio_credito: bloqueio, motivo_bloqueio: bloqueio ? "Bloqueio manual pelo gestor" : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clientes_credito"] }); toast.success("Status atualizado!"); },
  });

  const filtered = clientes.filter((c: any) => !search || c.nome?.toLowerCase().includes(search.toLowerCase()));
  const bloqueados = clientes.filter((c: any) => c.bloqueio_credito);
  const riscoBaixo = clientes.filter((c: any) => c.score_risco === "baixo");
  const riscoAlto = clientes.filter((c: any) => c.score_risco === "alto");
  const totalDevedor = clientes.reduce((s: number, c: any) => s + (Number(c.saldo_devedor) || 0), 0);

  const scoreColor: Record<string, string> = { baixo: "text-green-600", medio: "text-chart-4", alto: "text-destructive" };
  const scoreBadge: Record<string, "default" | "secondary" | "destructive"> = { baixo: "secondary", medio: "default", alto: "destructive" };

  return (
    <MainLayout>
      <Header title="Gestão de Crédito" subtitle="Limites, scores e bloqueios — SAP SD Credit Management" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-destructive">R$ {totalDevedor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">Saldo Devedor Total</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-chart-4">{bloqueados.length}</p><p className="text-xs text-muted-foreground">Bloqueados</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-destructive">{riscoAlto.length}</p><p className="text-xs text-muted-foreground">Risco Alto</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-green-600">{riscoBaixo.length}</p><p className="text-xs text-muted-foreground">Risco Baixo</p></CardContent></Card>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Cliente</TableHead><TableHead>Limite</TableHead><TableHead>Devedor</TableHead><TableHead>Utilização</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((c: any) => {
                    const limite = Number(c.limite_credito) || 0;
                    const devedor = Number(c.saldo_devedor) || 0;
                    const util = limite > 0 ? Math.round((devedor / limite) * 100) : 0;
                    return (
                      <TableRow key={c.id} className={c.bloqueio_credito ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>R$ {limite.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className={devedor > 0 ? "text-destructive font-semibold" : ""}>R$ {devedor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${util > 80 ? "bg-destructive" : util > 50 ? "bg-chart-4" : "bg-green-500"}`} style={{ width: `${Math.min(util, 100)}%` }} /></div>
                            <span className="text-xs">{util}%</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={scoreBadge[c.score_risco] || "default"}>{c.score_risco?.toUpperCase()}</Badge></TableCell>
                        <TableCell>{c.bloqueio_credito ? <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" />Bloqueado</Badge> : <Badge variant="secondary">Liberado</Badge>}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => { setEditDialog(c); setEditData({ limite_credito: limite, score_risco: c.score_risco || "medio" }); }}>Editar</Button>
                          <Button size="sm" variant={c.bloqueio_credito ? "default" : "destructive"} onClick={() => toggleBloqueio.mutate({ id: c.id, bloqueio: !c.bloqueio_credito })}>
                            {c.bloqueio_credito ? <><Unlock className="h-3 w-3 mr-1" />Liberar</> : <><Lock className="h-3 w-3 mr-1" />Bloquear</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
          <DialogContent><DialogHeader><DialogTitle>Editar Crédito — {editDialog?.nome}</DialogTitle><DialogDescription>Configure limite e score de risco.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>Limite de Crédito (R$)</Label><Input type="number" value={editData.limite_credito} onChange={(e) => setEditData(p => ({ ...p, limite_credito: Number(e.target.value) }))} /></div>
              <div><Label>Score de Risco</Label>
                <Select value={editData.score_risco} onValueChange={(v) => setEditData(p => ({ ...p, score_risco: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="baixo">Baixo</SelectItem><SelectItem value="medio">Médio</SelectItem><SelectItem value="alto">Alto</SelectItem></SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => updateCredito.mutate({ id: editDialog.id, ...editData })}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
