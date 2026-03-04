import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, Plus, Users, Send, Calendar, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDateString } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

export default function Campanhas() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novaCampanha, setNovaCampanha] = useState({ nome: "", tipo: "WhatsApp", status: "rascunho" });

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let q = supabase.from("campanhas").select("*").order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      setCampanhas(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSalvar = async () => {
    if (!novaCampanha.nome.trim()) {
      toast.error("Informe o nome da campanha");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from("campanhas").insert({
        nome: novaCampanha.nome.trim(),
        tipo: novaCampanha.tipo,
        status: novaCampanha.status,
        unidade_id: unidadeAtual?.id || null,
        alcance: 0,
        enviados: 0,
        data_criacao: getBrasiliaDateString(),
      });
      if (error) throw error;
      toast.success("Campanha criada com sucesso!");
      setDialogOpen(false);
      setNovaCampanha({ nome: "", tipo: "WhatsApp", status: "rascunho" });
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao salvar campanha: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const ativas = campanhas.filter(c => c.status === "ativa").length;
  const totalAlcance = campanhas.reduce((s, c) => s + (c.alcance || 0), 0);
  const totalEnviados = campanhas.reduce((s, c) => s + (c.enviados || 0), 0);

  return (
    <MainLayout>
      <Header title="Campanhas" subtitle="Marketing e comunicação" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nova Campanha
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Megaphone className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{campanhas.length}</p><p className="text-sm text-muted-foreground">Campanhas</p></div></div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-secondary/50"><Users className="h-6 w-6 text-secondary-foreground" /></div><div><p className="text-2xl font-bold">{totalAlcance}</p><p className="text-sm text-muted-foreground">Alcance Total</p></div></div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-accent/50"><Send className="h-6 w-6 text-accent-foreground" /></div><div><p className="text-2xl font-bold">{totalEnviados}</p><p className="text-sm text-muted-foreground">Mensagens Enviadas</p></div></div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-muted"><Calendar className="h-6 w-6 text-muted-foreground" /></div><div><p className="text-2xl font-bold">{ativas}</p><p className="text-sm text-muted-foreground">Ativas Agora</p></div></div></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Todas as Campanhas</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Alcance</TableHead>
                      <TableHead>Enviados</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campanhas.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma campanha cadastrada. Crie a primeira!</TableCell></TableRow>
                    )}
                    {campanhas.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                        <TableCell>{c.alcance}</TableCell>
                        <TableCell>{c.enviados}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "ativa" ? "default" : c.status === "concluida" ? "secondary" : "outline"}>
                            {c.status === "ativa" ? "Ativa" : c.status === "concluida" ? "Concluída" : "Rascunho"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.data_criacao ? new Date(c.data_criacao).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Dialog Nova Campanha */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Campanha *</Label>
              <Input
                id="nome"
                placeholder="Ex: Promoção de Inverno"
                value={novaCampanha.nome}
                onChange={e => setNovaCampanha(p => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Canal / Tipo</Label>
              <Select value={novaCampanha.tipo} onValueChange={v => setNovaCampanha(p => ({ ...p, tipo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                  <SelectItem value="Push">Push Notification</SelectItem>
                  <SelectItem value="Ligação">Ligação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Inicial</Label>
              <Select value={novaCampanha.status} onValueChange={v => setNovaCampanha(p => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
