import { useState, useMemo } from "react";
import { parseLocalDate, getBrasiliaDateString } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, BarChart3, Trash2, MapPin, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ConcorrentesMap } from "@/components/concorrencia/ConcorrentesMap";
import { IndiceCompetitividade } from "@/components/concorrencia/IndiceCompetitividade";
import { AlertasPreco } from "@/components/concorrencia/AlertasPreco";
import { GraficoEvolucaoPrecos } from "@/components/concorrencia/GraficoEvolucaoPrecos";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function AnaliseConcorrencia() {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const empresaId = empresa?.id;
  const unidadeId = unidadeAtual?.id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoConcorrente, setNovoConcorrente] = useState("");
  const [novoProduto, setNovoProduto] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novaFonte, setNovaFonte] = useState("Visita");
  const [novoTipoPreco, setNovoTipoPreco] = useState("unico");

  // Fetch price records
  const { data: registros = [] } = useQuery({
    queryKey: ["concorrente_precos", empresaId, unidadeId],
    queryFn: async () => {
      let query = supabase
        .from("concorrente_precos")
        .select("*")
        .order("data", { ascending: false });
      if (unidadeId) query = query.eq("unidade_id", unidadeId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Fetch products with portaria/telefone prices
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_precos", empresaId, unidadeId],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("nome, preco_venda, preco_portaria, preco_telefone")
        .eq("ativo", true);
      if (unidadeId) query = query.eq("unidade_id", unidadeId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Build pricing map: { produto: { portaria, telefone, unico } }
  const nossosPrecos = useMemo(() => {
    const map: Record<string, { portaria: number; telefone: number; unico: number }> = {};
    produtos.forEach((p: any) => {
      if (p.nome) {
        map[p.nome] = {
          portaria: Number(p.preco_portaria) || Number(p.preco_venda) || 0,
          telefone: Number(p.preco_telefone) || Number(p.preco_venda) || 0,
          unico: Number(p.preco_venda) || 0,
        };
      }
    });
    return map;
  }, [produtos]);

  // Analyse per product
  const analise = useMemo(() => {
    const produtosUnicos = [...new Set(registros.map((r: any) => r.produto))];
    return produtosUnicos.map(produto => {
      const regs = registros.filter((r: any) => r.produto === produto);
      const regPortaria = regs.filter((r: any) => r.tipo_preco === "portaria");
      const regTelefone = regs.filter((r: any) => r.tipo_preco === "telefone");
      const allPrecos = regs.map((r: any) => Number(r.preco));
      const menorPreco = Math.min(...allPrecos);
      const maiorPreco = Math.max(...allPrecos);
      
      const nosso = nossosPrecos[produto] || { portaria: 0, telefone: 0, unico: 0 };
      const mediaPortaria = regPortaria.length > 0 
        ? regPortaria.reduce((s: number, r: any) => s + Number(r.preco), 0) / regPortaria.length : 0;
      const mediaTelefone = regTelefone.length > 0
        ? regTelefone.reduce((s: number, r: any) => s + Number(r.preco), 0) / regTelefone.length : 0;

      // Score: 100 = cheapest, 0 = most expensive. Based on position relative to range
      const calcScore = (nossoP: number, media: number) => {
        if (nossoP <= 0 || media <= 0) return 50;
        const diff = ((media - nossoP) / media) * 100;
        return Math.max(0, Math.min(100, 50 + diff * 2));
      };

      return {
        produto,
        nossoPrecoPortaria: nosso.portaria,
        nossoPrecoTelefone: nosso.telefone,
        mediaPortaria,
        mediaTelefone,
        menorPreco,
        maiorPreco,
        concorrentes: regs.length,
        scorePortaria: calcScore(nosso.portaria, mediaPortaria),
        scoreTelefone: calcScore(nosso.telefone, mediaTelefone),
      };
    });
  }, [registros, nossosPrecos]);

  // Price alerts: competitors cheaper than us
  const alertas = useMemo(() => {
    const result: { produto: string; concorrente: string; precoConcorrente: number; nossoPreco: number; tipo: string; diff: number }[] = [];
    registros.forEach((r: any) => {
      const nosso = nossosPrecos[r.produto];
      if (!nosso) return;
      const tipo = r.tipo_preco || "unico";
      const nossoPreco = tipo === "portaria" ? nosso.portaria : tipo === "telefone" ? nosso.telefone : nosso.unico;
      if (nossoPreco > 0 && Number(r.preco) < nossoPreco) {
        const diff = ((nossoPreco - Number(r.preco)) / nossoPreco) * 100;
        if (diff >= 3) {
          result.push({
            produto: r.produto,
            concorrente: r.concorrente_nome,
            precoConcorrente: Number(r.preco),
            nossoPreco,
            tipo,
            diff,
          });
        }
      }
    });
    return result.sort((a, b) => b.diff - a.diff);
  }, [registros, nossosPrecos]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!novoConcorrente || !novoProduto || !novoPreco) throw new Error("Preencha todos os campos");
      const { error } = await supabase.from("concorrente_precos").insert({
        empresa_id: empresaId,
        unidade_id: unidadeId || null,
        concorrente_nome: novoConcorrente,
        produto: novoProduto,
        preco: parseFloat(novoPreco),
        fonte: novaFonte,
        tipo_preco: novoTipoPreco,
        data: getBrasiliaDateString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concorrente_precos"] });
      setDialogOpen(false);
      setNovoConcorrente("");
      setNovoProduto("");
      setNovoPreco("");
      setNovoTipoPreco("unico");
      toast.success("Preço registrado!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("concorrente_precos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concorrente_precos"] });
      toast.success("Registro removido");
    },
  });

  return (
    <MainLayout>
      <Header title="Análise de Concorrência" subtitle="Monitore preços e posicionamento" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Tabs defaultValue="mapa" className="w-full">
            <div className="flex items-center justify-between mb-4 relative z-20">
              <TabsList>
                <TabsTrigger value="mapa" className="gap-1.5"><MapPin className="h-4 w-4" />Mapa</TabsTrigger>
                <TabsTrigger value="precos" className="gap-1.5"><BarChart3 className="h-4 w-4" />Preços</TabsTrigger>
                <TabsTrigger value="evolucao" className="gap-1.5"><TrendingUp className="h-4 w-4" />Evolução</TabsTrigger>
              </TabsList>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Registrar Preço</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Registrar Preço do Concorrente</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Concorrente</Label><Input value={novoConcorrente} onChange={e => setNovoConcorrente(e.target.value)} placeholder="Nome do concorrente" /></div>
                    <div><Label>Produto</Label>
                      <Select value={novoProduto} onValueChange={setNovoProduto}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {produtos.length > 0 ? (
                            produtos.map((p: any) => (
                              <SelectItem key={p.nome} value={p.nome}>{p.nome}</SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="P13 Cheio">P13 Cheio</SelectItem>
                              <SelectItem value="P45 Cheio">P45 Cheio</SelectItem>
                              <SelectItem value="P20 Cheio">P20 Cheio</SelectItem>
                              <SelectItem value="Água Mineral">Água Mineral</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Tipo de Preço</Label>
                      <Select value={novoTipoPreco} onValueChange={setNovoTipoPreco}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unico">Preço Único</SelectItem>
                          <SelectItem value="portaria">Portaria (retira)</SelectItem>
                          <SelectItem value="telefone">Telefone (entrega)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Preço (R$)</Label><Input type="number" value={novoPreco} onChange={e => setNovoPreco(e.target.value)} placeholder="0,00" /></div>
                    <div><Label>Fonte</Label>
                      <Select value={novaFonte} onValueChange={setNovaFonte}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Visita">Visita</SelectItem>
                          <SelectItem value="Cliente">Cliente informou</SelectItem>
                          <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                          <SelectItem value="Site">Site/App</SelectItem>
                          <SelectItem value="Entregador">Entregador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => addMutation.mutate()} className="w-full" disabled={addMutation.isPending}>
                      {addMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <TabsContent value="mapa">
              <ConcorrentesMap />
            </TabsContent>

            <TabsContent value="precos" className="space-y-4">
              {/* Alertas */}
              <AlertasPreco alertas={alertas} />

              {/* Índice de competitividade */}
              <IndiceCompetitividade analise={analise} />

              {/* Histórico */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Histórico de Preços</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Concorrente</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>vs Nosso</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registros.map((r: any) => {
                        const nosso = nossosPrecos[r.produto];
                        const tipo = r.tipo_preco || "unico";
                        const nossoPreco = nosso ? (tipo === "portaria" ? nosso.portaria : tipo === "telefone" ? nosso.telefone : nosso.unico) : 0;
                        const diff = nossoPreco > 0 ? ((Number(r.preco) - nossoPreco) / nossoPreco * 100) : 0;
                        return (
                          <TableRow key={r.id}>
                            <TableCell>{parseLocalDate(r.data).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell className="font-medium">{r.concorrente_nome}</TableCell>
                            <TableCell>{r.produto}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={tipo === 'portaria' ? 'border-blue-500 text-blue-600' : tipo === 'telefone' ? 'border-orange-500 text-orange-600' : ''}>
                                {tipo === 'portaria' ? 'Portaria' : tipo === 'telefone' ? 'Telefone' : 'Único'}
                              </Badge>
                            </TableCell>
                            <TableCell>R$ {Number(r.preco).toFixed(2)}</TableCell>
                            <TableCell><Badge variant="outline">{r.fonte}</Badge></TableCell>
                            <TableCell>
                              <span className={diff > 0 ? "text-chart-3" : diff < 0 ? "text-destructive" : "text-muted-foreground"}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {registros.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum registro de preço para esta unidade
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evolucao" className="space-y-4">
              <GraficoEvolucaoPrecos registros={registros} nossosPrecos={nossosPrecos} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
