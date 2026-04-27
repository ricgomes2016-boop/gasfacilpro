import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Truck, Clock, CheckCircle, MapPin, Phone, User, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { getBrasiliaDate } from "@/lib/utils";

const statusConfig = {
  pendente: { label: "Pendente", variant: "secondary" as const, icon: Clock, color: "text-muted-foreground" },
  em_preparo: { label: "Em Preparo", variant: "outline" as const, icon: Clock, color: "text-warning" },
  em_rota: { label: "Em Rota", variant: "default" as const, icon: Truck, color: "text-warning" },
  entregue: { label: "Entregue", variant: "outline" as const, icon: CheckCircle, color: "text-success" },
  cancelado: { label: "Cancelado", variant: "destructive" as const, icon: Clock, color: "text-destructive" },
};

export default function Entregas() {
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const today = getBrasiliaDate();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["entregas-hoje", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select(`
          id, status, created_at, endereco_entrega, forma_pagamento, valor_total, observacoes,
          clientes (nome, telefone, bairro),
          entregadores (nome),
          pedido_itens (quantidade, produtos (nome))
        `)
        .gte("created_at", startOfDay(today).toISOString())
        .lte("created_at", endOfDay(today).toISOString())
        .in("status", ["pendente", "em_preparo", "em_rota", "entregue"])
        .order("created_at", { ascending: false });

      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["entregas-hoje"] });
      const label = statusConfig[status as keyof typeof statusConfig]?.label || status;
      toast.success(`Pedido atualizado para ${label}`);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar"),
  });

  const filtradas = filtroStatus === "todos"
    ? pedidos
    : pedidos.filter((p: any) => p.status === filtroStatus);

  const count = (s: string) => pedidos.filter((p: any) => p.status === s).length;

  return (
    <MainLayout>
      <Header title="Entregas" subtitle="Gestão de entregas do dia" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 grid-cols-3">
          <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => setFiltroStatus("pendente")}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-muted p-3"><Clock className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{count("pendente") + count("em_preparo")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => setFiltroStatus("em_rota")}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-warning/10 p-3"><Truck className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Em Rota</p>
                <p className="text-2xl font-bold">{count("em_rota")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => setFiltroStatus("entregue")}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-success/10 p-3"><CheckCircle className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Entregues</p>
                <p className="text-2xl font-bold">{count("entregue")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="section-header-catalog">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="section-header-title">Entregas do Dia</CardTitle>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Filtrar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="em_rota">Em Rota</SelectItem>
                  <SelectItem value="entregue">Entregues</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtradas.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">Nenhuma entrega encontrada</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden md:table-cell">Endereço</TableHead>
                      <TableHead className="hidden sm:table-cell">Itens</TableHead>
                      <TableHead className="hidden lg:table-cell">Entregador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((p: any) => {
                      const st = statusConfig[p.status as keyof typeof statusConfig] || statusConfig.pendente;
                      const StatusIcon = st.icon;
                      const itens = (p.pedido_itens || []).map((i: any) => `${i.quantidade}x ${i.produtos?.nome || "Produto"}`).join(", ");

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{format(new Date(p.created_at), "HH:mm")}</TableCell>
                          <TableCell>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm font-medium">{p.clientes?.nome || "Sem cliente"}</span>
                              </div>
                              {p.clientes?.telefone && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                  <Phone className="h-3 w-3" />{p.clientes.telefone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {p.endereco_entrega ? (
                              <div className="flex items-start gap-1.5">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-sm">{p.endereco_entrega}</p>
                                  {p.clientes?.bairro && <Badge variant="secondary" className="mt-1 text-xs">{p.clientes.bairro}</Badge>}
                                </div>
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{itens || "-"}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {p.entregadores?.nome ? <Badge variant="outline">{p.entregadores.nome}</Badge> : <span className="text-xs text-muted-foreground">Não atribuído</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <StatusIcon className={`h-3.5 w-3.5 ${st.color}`} />
                              <Badge variant={st.variant}>{st.label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {(p.status === "pendente" || p.status === "em_preparo") && (
                              <Button size="sm" variant="outline" disabled={updateStatus.isPending}
                                onClick={() => updateStatus.mutate({ id: p.id, status: "em_rota" })}>
                                <Truck className="mr-1 h-3.5 w-3.5" /> Iniciar
                              </Button>
                            )}
                            {p.status === "em_rota" && (
                              <Button size="sm" disabled={updateStatus.isPending}
                                onClick={() => updateStatus.mutate({ id: p.id, status: "entregue" })}>
                                <CheckCircle className="mr-1 h-3.5 w-3.5" /> Finalizar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
