import { useState, useEffect } from "react";
import { parseLocalDate, getBrasiliaDateString } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Send, Search, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarNotas, criarNota, transmitirParaSefaz, type NotaFiscal } from "@/services/focusNfeService";

export default function EmitirMDFe() {
  const { toast } = useToast();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarNotas = async () => {
    try {
      const data = await listarNotas("mdfe");
      setNotas(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregarNotas(); }, []);

  const statusColor = (s: string) => {
    if (s === "autorizada") return "default" as const;
    if (s === "cancelada") return "destructive" as const;
    return "secondary" as const;
  };

  const handleEmitir = async () => {
    try {
      const nota = await criarNota({
        tipo: "mdfe",
        status: "rascunho",
        uf_carregamento: "SP",
        uf_descarregamento: "RJ",
        motorista_nome: "",
        valor_total: 0,
      });
      const result = await transmitirParaSefaz(nota.id);
      toast({ title: "MDF-e transmitido", description: result.message });
      carregarNotas();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <Header title="MDF-e" subtitle="Gestão Fiscal" />
      <div className="space-y-6 p-4 md:p-6">
        <Tabs defaultValue="consultar">
          <TabsList className="h-11">
            <TabsTrigger value="consultar"><Search className="h-4 w-4 mr-2" />Consultar</TabsTrigger>
            <TabsTrigger value="emitir"><Plus className="h-4 w-4 mr-2" />Novo MDF-e</TabsTrigger>
          </TabsList>

          <TabsContent value="consultar">
            <Card>
              <CardHeader><CardTitle className="text-lg">Manifestos Eletrônicos</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Rota</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead className="text-right">Peso (kg)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : notas.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum MDF-e encontrado</TableCell></TableRow>
                    ) : notas.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-sm">{m.numero || "—"}</TableCell>
                        <TableCell>{parseLocalDate(m.data_emissao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.uf_carregamento || "?"} → {m.uf_descarregamento || "?"}</TableCell>
                        <TableCell className="font-medium">{m.motorista_nome || "—"}</TableCell>
                        <TableCell className="font-mono">{m.placa || "—"}</TableCell>
                        <TableCell className="text-right">{m.peso_bruto ? Number(m.peso_bruto).toLocaleString("pt-BR") : "—"}</TableCell>
                        <TableCell><Badge variant={statusColor(m.status)}>{m.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emitir">
            <div className="grid gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Dados do Manifesto</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>UF Carregamento</Label>
                    <Select defaultValue="SP">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SP">SP - São Paulo</SelectItem>
                        <SelectItem value="RJ">RJ - Rio de Janeiro</SelectItem>
                        <SelectItem value="MG">MG - Minas Gerais</SelectItem>
                        <SelectItem value="PR">PR - Paraná</SelectItem>
                        <SelectItem value="SC">SC - Santa Catarina</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>UF Descarregamento</Label>
                    <Select defaultValue="RJ">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SP">SP - São Paulo</SelectItem>
                        <SelectItem value="RJ">RJ - Rio de Janeiro</SelectItem>
                        <SelectItem value="MG">MG - Minas Gerais</SelectItem>
                        <SelectItem value="PR">PR - Paraná</SelectItem>
                        <SelectItem value="SC">SC - Santa Catarina</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data de Viagem</Label><Input type="date" defaultValue={getBrasiliaDateString()} /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-lg">Veículo e Motorista</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><Label>Placa</Label><Input placeholder="ABC-1D23" /></div>
                  <div><Label>RNTRC</Label><Input placeholder="12345678" /></div>
                  <div><Label>Motorista</Label><Input placeholder="Nome do motorista" /></div>
                  <div><Label>CPF do Motorista</Label><Input placeholder="000.000.000-00" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">NF-es Vinculadas</CardTitle>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Vincular NF-e</Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chave de Acesso</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Vincule NF-es ao manifesto</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <div className="flex justify-end gap-3">
                <Button variant="outline">Salvar Rascunho</Button>
                <Button onClick={handleEmitir}><Send className="h-4 w-4 mr-2" />Transmitir MDF-e</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
