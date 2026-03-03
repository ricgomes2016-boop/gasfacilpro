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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, AlertTriangle, Search, Loader2, QrCode, RotateCcw, Calendar } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

export default function LotesRastreabilidade() {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("lotes");
  const [novoLoteDialog, setNovoLoteDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [newLote, setNewLote] = useState({ produto_id: "", numero_lote: "", data_fabricacao: "", data_validade: "", quantidade_inicial: 0 });

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes", empresa?.id, unidadeAtual?.id],
    enabled: !!empresa?.id,
    queryFn: async () => {
      let q = supabase.from("lotes_produto").select("*, produtos(nome)").eq("empresa_id", empresa!.id);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      q = q.order("data_validade", { ascending: true });
      const { data } = await q;
      return data || [];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_lote", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("id, nome").eq("ativo", true).eq("unidade_id", unidadeAtual!.id);
      return data || [];
    },
  });

  const { data: rastreios = [] } = useQuery({
    queryKey: ["rastreio_lote", empresa?.id],
    enabled: !!empresa?.id && tab === "rastreio",
    queryFn: async () => {
      const { data } = await supabase.from("rastreio_lote").select("*, lotes_produto(numero_lote, produtos(nome)), clientes(nome), pedidos(id)").order("data", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const criarLote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lotes_produto").insert({
        empresa_id: empresa!.id,
        unidade_id: unidadeAtual?.id || null,
        ...newLote,
        quantidade_atual: newLote.quantidade_inicial,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["lotes"] }); setNovoLoteDialog(false); toast.success("Lote cadastrado!"); setNewLote({ produto_id: "", numero_lote: "", data_fabricacao: "", data_validade: "", quantidade_inicial: 0 }); },
  });

  const recallLote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lotes_produto").update({ status: "recall" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["lotes"] }); toast.warning("Lote marcado como RECALL!"); },
  });

  const today = new Date();
  const vencidos = lotes.filter((l: any) => l.status === "ativo" && l.data_validade && new Date(l.data_validade) < today);
  const vencendo = lotes.filter((l: any) => l.status === "ativo" && l.data_validade && differenceInDays(new Date(l.data_validade), today) <= 30 && differenceInDays(new Date(l.data_validade), today) >= 0);
  const recalls = lotes.filter((l: any) => l.status === "recall");
  const filtered = lotes.filter((l: any) => !search || l.numero_lote?.toLowerCase().includes(search.toLowerCase()) || (l.produtos as any)?.nome?.toLowerCase().includes(search.toLowerCase()));

  return (
    <MainLayout>
      <Header title="Lotes & Rastreabilidade" subtitle="Controle de lotes, validade e recall — SAP QM" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-primary">{lotes.filter((l: any) => l.status === "ativo").length}</p><p className="text-xs text-muted-foreground">Lotes Ativos</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-chart-4">{vencendo.length}</p><p className="text-xs text-muted-foreground">Vencendo (30d)</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-destructive">{vencidos.length}</p><p className="text-xs text-muted-foreground">Vencidos</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-destructive">{recalls.length}</p><p className="text-xs text-muted-foreground">Recalls</p></CardContent></Card>
        </div>

        {(vencidos.length > 0 || recalls.length > 0) && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium">
              {vencidos.length > 0 && `${vencidos.length} lote(s) vencido(s). `}
              {recalls.length > 0 && `${recalls.length} recall(s) ativo(s).`}
            </p>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="lotes"><Package className="h-4 w-4 mr-1" />Lotes</TabsTrigger>
              <TabsTrigger value="rastreio"><QrCode className="h-4 w-4 mr-1" />Rastreio</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar lote..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" /></div>
              <Button size="sm" onClick={() => setNovoLoteDialog(true)}><Plus className="h-4 w-4 mr-1" />Novo Lote</Button>
            </div>
          </div>

          <TabsContent value="lotes">
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Lote</TableHead><TableHead>Produto</TableHead><TableHead>Qtd</TableHead><TableHead>Fabricação</TableHead><TableHead>Validade</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((l: any) => {
                      const dias = l.data_validade ? differenceInDays(new Date(l.data_validade), today) : null;
                      return (
                        <TableRow key={l.id} className={l.status === "recall" ? "bg-destructive/5" : dias !== null && dias < 0 ? "bg-chart-4/5" : ""}>
                          <TableCell className="font-mono font-medium">{l.numero_lote}</TableCell>
                          <TableCell>{(l.produtos as any)?.nome || "-"}</TableCell>
                          <TableCell>{l.quantidade_atual}/{l.quantidade_inicial}</TableCell>
                          <TableCell>{l.data_fabricacao ? format(new Date(l.data_fabricacao), "dd/MM/yy") : "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {l.data_validade ? format(new Date(l.data_validade), "dd/MM/yy") : "-"}
                              {dias !== null && dias <= 30 && dias >= 0 && <Badge variant="default" className="text-[9px]">{dias}d</Badge>}
                              {dias !== null && dias < 0 && <Badge variant="destructive" className="text-[9px]">VENCIDO</Badge>}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant={l.status === "recall" ? "destructive" : l.status === "vencido" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            {l.status === "ativo" && <Button size="sm" variant="destructive" onClick={() => recallLote.mutate(l.id)}><RotateCcw className="h-3 w-3 mr-1" />Recall</Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="rastreio">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Lote</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead>Qtd</TableHead><TableHead>Cliente</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rastreios.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{(r.lotes_produto as any)?.numero_lote}</TableCell>
                      <TableCell>{(r.lotes_produto as any)?.produtos?.nome || "-"}</TableCell>
                      <TableCell><Badge variant={r.tipo === "recall" ? "destructive" : r.tipo === "saida" ? "default" : "secondary"}>{r.tipo}</Badge></TableCell>
                      <TableCell>{r.quantidade}</TableCell>
                      <TableCell>{(r.clientes as any)?.nome || "-"}</TableCell>
                      <TableCell>{format(new Date(r.data), "dd/MM/yy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <Dialog open={novoLoteDialog} onOpenChange={setNovoLoteDialog}>
          <DialogContent><DialogHeader><DialogTitle>Cadastrar Novo Lote</DialogTitle><DialogDescription>Registre o lote recebido do fornecedor.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>Produto</Label>
                <select className="w-full border rounded-md p-2 text-sm" value={newLote.produto_id} onChange={(e) => setNewLote(p => ({ ...p, produto_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div><Label>Número do Lote</Label><Input value={newLote.numero_lote} onChange={(e) => setNewLote(p => ({ ...p, numero_lote: e.target.value }))} placeholder="Ex: LOT-2026-001" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data Fabricação</Label><Input type="date" value={newLote.data_fabricacao} onChange={(e) => setNewLote(p => ({ ...p, data_fabricacao: e.target.value }))} /></div>
                <div><Label>Data Validade</Label><Input type="date" value={newLote.data_validade} onChange={(e) => setNewLote(p => ({ ...p, data_validade: e.target.value }))} /></div>
              </div>
              <div><Label>Quantidade</Label><Input type="number" value={newLote.quantidade_inicial} onChange={(e) => setNewLote(p => ({ ...p, quantidade_inicial: Number(e.target.value) }))} /></div>
              <Button className="w-full" onClick={() => criarLote.mutate()} disabled={!newLote.produto_id || !newLote.numero_lote}>Cadastrar Lote</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
