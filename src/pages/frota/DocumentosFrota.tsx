import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Shield, AlertTriangle, CheckCircle2, Loader2, Edit, Truck, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

export default function DocumentosFrota() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [entregadores, setEntregadores] = useState<any[]>([]);

  const [editVeiculo, setEditVeiculo] = useState<any | null>(null);
  const [editEntregador, setEditEntregador] = useState<any | null>(null);
  const [formVeiculo, setFormVeiculo] = useState({ crlv_vencimento: "", seguro_vencimento: "", seguro_empresa: "" });
  const [formEntregador, setFormEntregador] = useState({ cnh_vencimento: "" });

  useEffect(() => { fetchData(); }, [unidadeAtual?.id]);

  const fetchData = async () => {
    setLoading(true);
    let vq = supabase.from("veiculos").select("id, placa, modelo, crlv_vencimento, seguro_vencimento, seguro_empresa").eq("ativo", true).order("placa");
    if (unidadeAtual?.id) vq = vq.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    const { data: v } = await vq;
    setVeiculos(v || []);

    let eq = supabase.from("entregadores").select("id, nome, cnh, cnh_vencimento").eq("ativo", true).order("nome");
    if (unidadeAtual?.id) eq = eq.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    const { data: e } = await eq;
    setEntregadores(e || []);
    setLoading(false);
  };

  const getStatus = (date: string | null) => {
    if (!date) return { label: "Não informado", variant: "secondary" as const, dias: null };
    const dias = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return { label: `Vencido (${Math.abs(dias)}d)`, variant: "destructive" as const, dias };
    if (dias <= 30) return { label: `${dias}d restantes`, variant: "default" as const, dias };
    return { label: `${dias}d`, variant: "secondary" as const, dias };
  };

  const handleSaveVeiculo = async () => {
    if (!editVeiculo) return;
    const { error } = await supabase.from("veiculos").update({
      crlv_vencimento: formVeiculo.crlv_vencimento || null,
      seguro_vencimento: formVeiculo.seguro_vencimento || null,
      seguro_empresa: formVeiculo.seguro_empresa || null,
    } as any).eq("id", editVeiculo.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Documentos atualizados!");
    setEditVeiculo(null);
    fetchData();
  };

  const handleSaveEntregador = async () => {
    if (!editEntregador) return;
    const { error } = await supabase.from("entregadores").update({
      cnh_vencimento: formEntregador.cnh_vencimento || null,
    } as any).eq("id", editEntregador.id);
    if (error) { toast.error(error.message); return; }
    toast.success("CNH atualizada!");
    setEditEntregador(null);
    fetchData();
  };

  const alertasVeiculos = veiculos.filter(v => {
    const crlv = getStatus(v.crlv_vencimento);
    const seguro = getStatus(v.seguro_vencimento);
    return (crlv.dias !== null && crlv.dias <= 30) || (seguro.dias !== null && seguro.dias <= 30);
  }).length;

  const alertasCNH = entregadores.filter(e => {
    const s = getStatus(e.cnh_vencimento);
    return s.dias !== null && s.dias <= 30;
  }).length;

  if (loading) {
    return (
      <MainLayout>
        <Header title="Documentos da Frota" subtitle="Controle de CRLV, Seguro e CNH" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Documentos da Frota" subtitle="Controle de CRLV, Seguro e CNH" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Veículos</CardTitle><Truck className="h-4 w-4 text-primary" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{veiculos.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Alertas Veículos</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{alertasVeiculos}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Entregadores</CardTitle><User className="h-4 w-4 text-primary" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{entregadores.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">CNH Vencendo</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-500" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-600">{alertasCNH}</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="veiculos">
          <TabsList>
            <TabsTrigger value="veiculos"><Truck className="h-4 w-4 mr-2" />Veículos</TabsTrigger>
            <TabsTrigger value="cnh"><User className="h-4 w-4 mr-2" />CNH Motoristas</TabsTrigger>
          </TabsList>

          <TabsContent value="veiculos" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Placa</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>CRLV</TableHead>
                        <TableHead>Seguro</TableHead>
                        <TableHead>Seguradora</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {veiculos.map(v => {
                        const crlv = getStatus(v.crlv_vencimento);
                        const seguro = getStatus(v.seguro_vencimento);
                        return (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium">{v.placa}</TableCell>
                            <TableCell>{v.modelo}</TableCell>
                            <TableCell>
                              <Badge variant={crlv.variant}>{crlv.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={seguro.variant}>{seguro.label}</Badge>
                            </TableCell>
                            <TableCell>{v.seguro_empresa || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => {
                                setEditVeiculo(v);
                                setFormVeiculo({
                                  crlv_vencimento: v.crlv_vencimento || "",
                                  seguro_vencimento: v.seguro_vencimento || "",
                                  seguro_empresa: v.seguro_empresa || "",
                                });
                              }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cnh" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entregador</TableHead>
                        <TableHead>CNH</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entregadores.map(e => {
                        const s = getStatus(e.cnh_vencimento);
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.nome}</TableCell>
                            <TableCell>{e.cnh || "—"}</TableCell>
                            <TableCell>{e.cnh_vencimento ? new Date(e.cnh_vencimento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                            <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => {
                                setEditEntregador(e);
                                setFormEntregador({ cnh_vencimento: e.cnh_vencimento || "" });
                              }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Veículo Dialog */}
      <Dialog open={!!editVeiculo} onOpenChange={(o) => !o && setEditVeiculo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Documentos — {editVeiculo?.placa}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vencimento CRLV</Label>
              <Input type="date" value={formVeiculo.crlv_vencimento} onChange={e => setFormVeiculo(p => ({ ...p, crlv_vencimento: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Vencimento Seguro</Label>
              <Input type="date" value={formVeiculo.seguro_vencimento} onChange={e => setFormVeiculo(p => ({ ...p, seguro_vencimento: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Seguradora</Label>
              <Input value={formVeiculo.seguro_empresa} onChange={e => setFormVeiculo(p => ({ ...p, seguro_empresa: e.target.value }))} placeholder="Nome da seguradora" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVeiculo(null)}>Cancelar</Button>
            <Button onClick={handleSaveVeiculo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit CNH Dialog */}
      <Dialog open={!!editEntregador} onOpenChange={(o) => !o && setEditEntregador(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>CNH — {editEntregador?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vencimento CNH</Label>
              <Input type="date" value={formEntregador.cnh_vencimento} onChange={e => setFormEntregador({ cnh_vencimento: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntregador(null)}>Cancelar</Button>
            <Button onClick={handleSaveEntregador}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
