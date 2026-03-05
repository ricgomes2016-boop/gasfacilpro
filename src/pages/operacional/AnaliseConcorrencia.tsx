import { useState } from "react";
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
import { Plus, TrendingUp, TrendingDown, Minus, BarChart3, Eye, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ConcorrentesMap } from "@/components/concorrencia/ConcorrentesMap";

interface RegistroPreco {
  id: string;
  concorrente: string;
  produto: string;
  preco: number;
  data: string;
  fonte: string;
}

export default function AnaliseConcorrencia() {
  const [registros, setRegistros] = useState<RegistroPreco[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoConcorrente, setNovoConcorrente] = useState("");
  const [novoProduto, setNovoProduto] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novaFonte, setNovaFonte] = useState("Visita");

  // Preços base dos produtos (idealmente viriam do banco)
  const nossosPrecos: Record<string, number> = {
    "P13 Cheio": 108,
    "P45 Cheio": 340,
    "P20 Cheio": 220,
  };

  const addRegistro = () => {
    if (!novoConcorrente || !novoProduto || !novoPreco) { toast.error("Preencha todos os campos"); return; }
    setRegistros(prev => [...prev, {
      id: Date.now().toString(), concorrente: novoConcorrente, produto: novoProduto,
      preco: parseFloat(novoPreco), data: getBrasiliaDateString(), fonte: novaFonte,
    }]);
    setDialogOpen(false);
    setNovoConcorrente(""); setNovoProduto(""); setNovoPreco("");
    toast.success("Preço registrado!");
  };

  const removeRegistro = (id: string) => {
    setRegistros(prev => prev.filter(r => r.id !== id));
    toast.success("Registro removido");
  };

  // Análise por produto
  const produtosUnicos = [...new Set(registros.map(r => r.produto))];
  const analise = produtosUnicos.map(produto => {
    const registrosProduto = registros.filter(r => r.produto === produto);
    const precoMedio = registrosProduto.reduce((s, r) => s + r.preco, 0) / registrosProduto.length;
    const menorPreco = Math.min(...registrosProduto.map(r => r.preco));
    const maiorPreco = Math.max(...registrosProduto.map(r => r.preco));
    const nossoPreco = nossosPrecos[produto] || 0;
    const posicao = nossoPreco < precoMedio ? "abaixo" : nossoPreco > precoMedio ? "acima" : "na_media";
    return { produto, precoMedio, menorPreco, maiorPreco, nossoPreco, posicao, concorrentes: registrosProduto.length };
  });

  return (
    <MainLayout>
      <Header title="Análise de Concorrência" subtitle="Monitore preços e posicionamento" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Tabs defaultValue="mapa" className="w-full">
            <div className="flex items-center justify-between mb-4 relative z-10">
              <TabsList>
                <TabsTrigger value="mapa" className="gap-1.5"><MapPin className="h-4 w-4" />Mapa</TabsTrigger>
                <TabsTrigger value="precos" className="gap-1.5"><BarChart3 className="h-4 w-4" />Preços</TabsTrigger>
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
                          <SelectItem value="P13 Cheio">P13 Cheio</SelectItem>
                          <SelectItem value="P45 Cheio">P45 Cheio</SelectItem>
                          <SelectItem value="P20 Cheio">P20 Cheio</SelectItem>
                          <SelectItem value="Água Mineral">Água Mineral</SelectItem>
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
                    <Button onClick={addRegistro} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <TabsContent value="mapa">
              <ConcorrentesMap />
            </TabsContent>

            <TabsContent value="precos" className="space-y-4">
              {/* Posicionamento */}
              <div className="grid gap-4 md:grid-cols-3">
                {analise.map(a => (
                  <Card key={a.produto}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{a.produto}</h3>
                        <Badge variant={a.posicao === "abaixo" ? "default" : a.posicao === "acima" ? "destructive" : "secondary"}>
                          {a.posicao === "abaixo" ? <><TrendingDown className="h-3 w-3 mr-1" />Competitivo</> : a.posicao === "acima" ? <><TrendingUp className="h-3 w-3 mr-1" />Acima</> : <><Minus className="h-3 w-3 mr-1" />Na média</>}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Nosso preço</span><span className="font-bold text-primary">R$ {a.nossoPreco.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Média concorrência</span><span>R$ {a.precoMedio.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Menor / Maior</span><span>R$ {a.menorPreco.toFixed(2)} - R$ {a.maiorPreco.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Registros</span><span>{a.concorrentes}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

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
                        <TableHead>Preço</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>vs Nosso</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registros.sort((a, b) => b.data.localeCompare(a.data)).map(r => {
                        const nosso = nossosPrecos[r.produto] || 0;
                        const diff = nosso > 0 ? ((r.preco - nosso) / nosso * 100) : 0;
                        return (
                          <TableRow key={r.id}>
                            <TableCell>{parseLocalDate(r.data).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell className="font-medium">{r.concorrente}</TableCell>
                            <TableCell>{r.produto}</TableCell>
                            <TableCell>R$ {r.preco.toFixed(2)}</TableCell>
                            <TableCell><Badge variant="outline">{r.fonte}</Badge></TableCell>
                            <TableCell>
                              <span className={diff > 0 ? "text-chart-3" : diff < 0 ? "text-destructive" : "text-muted-foreground"}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeRegistro(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
