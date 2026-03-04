import { useEffect, useState } from "react";
import { parseLocalDate } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Tag, Plus, Percent, Gift, Ticket, Calendar, Users, Copy,
  Edit, Trash2, Loader2, Link, CheckCircle, Megaphone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

const PUBLISHED_URL = "https://gasfacil-entregas.lovable.app";

interface Cupom {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo: string;
  valor: number;
  valor_minimo: number;
  limite_uso: number | null;
  usos: number;
  ativo: boolean;
  validade: string | null;
  unidade_id: string | null;
  created_at: string;
}

interface Promocao {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  valor: number;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  unidade_id: string | null;
  created_at: string;
}

const defaultCupom = {
  codigo: "",
  descricao: "",
  tipo: "percentual",
  valor: 10,
  valor_minimo: 0,
  limite_uso: null as number | null,
  ativo: true,
  validade: "",
};

const defaultPromocao = {
  nome: "",
  descricao: "",
  tipo: "desconto_percentual",
  valor: 10,
  status: "ativa",
  data_inicio: "",
  data_fim: "",
};

export default function PromocoesCupons() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [showCupomDialog, setShowCupomDialog] = useState(false);
  const [showPromocaoDialog, setShowPromocaoDialog] = useState(false);
  const [cupomForm, setCupomForm] = useState(defaultCupom);
  const [promocaoForm, setPromocaoForm] = useState(defaultPromocao);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      let qc = sb.from("cupons_desconto").select("*").order("created_at", { ascending: false });
      let qp = sb.from("promocoes").select("*").order("created_at", { ascending: false });
      if (unidadeAtual?.id) {
        qc = qc.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
        qp = qp.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      }
      const [rc, rp] = await Promise.all([qc, qp]);
      setCupons(rc.data || []);
      setPromocoes(rp.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const saveCupom = async () => {
    if (!cupomForm.codigo.trim()) { toast.error("Informe o código do cupom"); return; }
    setSaving(true);
    const sb = supabase as any;
    try {
      const payload = {
        codigo: cupomForm.codigo.toUpperCase().trim(),
        descricao: cupomForm.descricao || null,
        tipo: cupomForm.tipo,
        valor: cupomForm.valor,
        valor_minimo: cupomForm.valor_minimo,
        limite_uso: cupomForm.limite_uso || null,
        ativo: cupomForm.ativo,
        validade: cupomForm.validade || null,
        unidade_id: unidadeAtual?.id || null,
      };
      const { error } = await sb.from("cupons_desconto").insert(payload);
      if (error) throw error;
      toast.success("Cupom criado com sucesso!");
      setShowCupomDialog(false);
      setCupomForm(defaultCupom);
      fetchData();
    } catch (e: any) {
      if (e.code === "23505") toast.error("Já existe um cupom com esse código");
      else toast.error("Erro ao criar cupom");
    } finally { setSaving(false); }
  };

  const savePromocao = async () => {
    if (!promocaoForm.nome.trim()) { toast.error("Informe o nome da promoção"); return; }
    setSaving(true);
    const sb = supabase as any;
    try {
      const payload = {
        nome: promocaoForm.nome.trim(),
        descricao: promocaoForm.descricao || null,
        tipo: promocaoForm.tipo,
        valor: promocaoForm.valor,
        status: promocaoForm.status,
        data_inicio: promocaoForm.data_inicio || null,
        data_fim: promocaoForm.data_fim || null,
        unidade_id: unidadeAtual?.id || null,
      };
      const { error } = await sb.from("promocoes").insert(payload);
      if (error) throw error;
      toast.success("Promoção criada com sucesso!");
      setShowPromocaoDialog(false);
      setPromocaoForm(defaultPromocao);
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao criar promoção");
    } finally { setSaving(false); }
  };

  const toggleCupom = async (id: string, ativo: boolean) => {
    const sb = supabase as any;
    await sb.from("cupons_desconto").update({ ativo }).eq("id", id);
    fetchData();
  };

  const deleteCupom = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return;
    const sb = supabase as any;
    await sb.from("cupons_desconto").delete().eq("id", id);
    toast.success("Cupom excluído");
    fetchData();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("Código copiado!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const indicacaoLink = `${PUBLISHED_URL}/cliente/indicacao`;

  const ativos = cupons.filter(c => c.ativo).length;
  const promocoesAtivas = promocoes.filter(p => p.status === "ativa").length;
  const totalUsos = cupons.reduce((s, c) => s + c.usos, 0);

  if (loading) {
    return (
      <MainLayout>
        <Header title="Promoções e Cupons" subtitle="Descontos, cupons e programa de indicação" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Promoções e Cupons" subtitle="Descontos, cupons e programa de indicação" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10"><Ticket className="h-6 w-6 text-primary" /></div>
                <div><p className="text-2xl font-bold">{cupons.length}</p><p className="text-sm text-muted-foreground">Cupons Criados</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10"><CheckCircle className="h-6 w-6 text-green-500" /></div>
                <div><p className="text-2xl font-bold">{ativos}</p><p className="text-sm text-muted-foreground">Cupons Ativos</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10"><Users className="h-6 w-6 text-blue-500" /></div>
                <div><p className="text-2xl font-bold">{totalUsos}</p><p className="text-sm text-muted-foreground">Usos de Cupons</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10"><Megaphone className="h-6 w-6 text-orange-500" /></div>
                <div><p className="text-2xl font-bold">{promocoesAtivas}</p><p className="text-sm text-muted-foreground">Promoções Ativas</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Link de Indicação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Link de Indicação do App
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Compartilhe este link com clientes para que eles indiquem amigos. Ao acessar, o amigo é direcionado direto para o app de compras.
            </p>
            <div className="flex gap-2 items-center">
              <Input value={indicacaoLink} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(indicacaoLink); toast.success("Link copiado!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="cupons">
          <TabsList>
            <TabsTrigger value="cupons"><Ticket className="h-4 w-4 mr-2" />Cupons de Desconto</TabsTrigger>
            <TabsTrigger value="promocoes"><Percent className="h-4 w-4 mr-2" />Promoções</TabsTrigger>
          </TabsList>

          {/* CUPONS */}
          <TabsContent value="cupons" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCupomDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />Novo Cupom
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Valor Mínimo</TableHead>
                      <TableHead>Usos</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cupons.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum cupom cadastrado. Crie o primeiro!
                        </TableCell>
                      </TableRow>
                    )}
                    {cupons.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{c.codigo}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(c.codigo)}>
                              {copiedCode === c.codigo ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                          {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {c.tipo === "percentual" ? `${c.valor}%` : `R$ ${c.valor.toFixed(2)}`}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.valor_minimo > 0 ? `R$ ${c.valor_minimo.toFixed(2)}` : "—"}</TableCell>
                        <TableCell>
                          {c.usos}/{c.limite_uso ?? "∞"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.validade ? parseLocalDate(c.validade).toLocaleDateString("pt-BR") : "Sem prazo"}
                        </TableCell>
                        <TableCell>
                          <Switch checked={c.ativo} onCheckedChange={(v) => toggleCupom(c.id, v)} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteCupom(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROMOÇÕES */}
          <TabsContent value="promocoes" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowPromocaoDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />Nova Promoção
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promocoes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhuma promoção cadastrada. Crie a primeira!
                        </TableCell>
                      </TableRow>
                    )}
                    {promocoes.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-medium">{p.nome}</p>
                          {p.descricao && <p className="text-xs text-muted-foreground">{p.descricao}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {p.tipo === "desconto_percentual" ? "% Desconto" :
                              p.tipo === "desconto_fixo" ? "R$ Desconto" :
                                p.tipo === "frete_gratis" ? "Frete Grátis" : p.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.tipo === "desconto_percentual" ? `${p.valor}%` :
                            p.tipo === "desconto_fixo" ? `R$ ${p.valor.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.data_inicio ? parseLocalDate(p.data_inicio).toLocaleDateString("pt-BR") : "—"}
                          {" → "}
                          {p.data_fim ? parseLocalDate(p.data_fim).toLocaleDateString("pt-BR") : "Sem prazo"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "ativa" ? "default" : p.status === "pausada" ? "secondary" : "outline"}>
                            {p.status === "ativa" ? "Ativa" : p.status === "pausada" ? "Pausada" : "Encerrada"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Novo Cupom */}
      <Dialog open={showCupomDialog} onOpenChange={setShowCupomDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />Novo Cupom de Desconto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código do cupom *</Label>
              <Input
                placeholder="Ex: BEMVINDO10"
                value={cupomForm.codigo}
                onChange={e => setCupomForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Letras maiúsculas e números, sem espaços</p>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Desconto de boas-vindas"
                value={cupomForm.descricao}
                onChange={e => setCupomForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de desconto</Label>
                <Select value={cupomForm.tipo} onValueChange={v => setCupomForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor do desconto</Label>
                <Input
                  type="number"
                  min="0"
                  value={cupomForm.valor}
                  onChange={e => setCupomForm(f => ({ ...f, valor: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pedido mínimo (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0 = sem mínimo"
                  value={cupomForm.valor_minimo || ""}
                  onChange={e => setCupomForm(f => ({ ...f, valor_minimo: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Limite de usos</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Sem limite"
                  value={cupomForm.limite_uso ?? ""}
                  onChange={e => setCupomForm(f => ({ ...f, limite_uso: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>
            <div>
              <Label>Validade</Label>
              <Input
                type="date"
                value={cupomForm.validade}
                onChange={e => setCupomForm(f => ({ ...f, validade: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={cupomForm.ativo} onCheckedChange={v => setCupomForm(f => ({ ...f, ativo: v }))} />
              <Label>Cupom ativo ao criar</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCupomDialog(false)}>Cancelar</Button>
            <Button onClick={saveCupom} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Cupom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Promoção */}
      <Dialog open={showPromocaoDialog} onOpenChange={setShowPromocaoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />Nova Promoção
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da promoção *</Label>
              <Input
                placeholder="Ex: Promoção de Inverno"
                value={promocaoForm.nome}
                onChange={e => setPromocaoForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva os detalhes da promoção..."
                value={promocaoForm.descricao}
                onChange={e => setPromocaoForm(f => ({ ...f, descricao: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={promocaoForm.tipo} onValueChange={v => setPromocaoForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desconto_percentual">Desconto %</SelectItem>
                    <SelectItem value="desconto_fixo">Desconto R$</SelectItem>
                    <SelectItem value="frete_gratis">Frete Grátis</SelectItem>
                    <SelectItem value="brinde">Brinde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {promocaoForm.tipo === "desconto_percentual" ? "% Desconto" :
                    promocaoForm.tipo === "desconto_fixo" ? "Valor (R$)" : "Valor"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={promocaoForm.valor}
                  onChange={e => setPromocaoForm(f => ({ ...f, valor: Number(e.target.value) }))}
                  disabled={["frete_gratis", "brinde"].includes(promocaoForm.tipo)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data início</Label>
                <Input type="date" value={promocaoForm.data_inicio} onChange={e => setPromocaoForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Data fim</Label>
                <Input type="date" value={promocaoForm.data_fim} onChange={e => setPromocaoForm(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Status inicial</Label>
              <Select value={promocaoForm.status} onValueChange={v => setPromocaoForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromocaoDialog(false)}>Cancelar</Button>
            <Button onClick={savePromocao} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Promoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
