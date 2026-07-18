import { useState, useEffect } from "react";
import { parseLocalDate } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Send, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarNotas, criarNota, transmitirParaSefaz, type NotaFiscal } from "@/services/focusNfeService";

export default function EmitirCTe() {
  const { toast } = useToast();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarNotas = async () => {
    try {
      const data = await listarNotas("cte");
      setNotas(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregarNotas(); }, []);

  const handleEmitir = async () => {
    try {
      const nota = await criarNota({
        tipo: "cte",
        status: "rascunho",
        remetente_nome: "Empresa Emitente",
        destinatario_nome: "Destinatário",
        modal: "rodoviario",
        valor_total: 0,
      });
      const result = await transmitirParaSefaz(nota.id);
      toast({ title: "CT-e transmitido", description: result.message });
      carregarNotas();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <Header title="CT-e" subtitle="Gestão Fiscal" />
      <div className="space-y-6 p-4 md:p-6">
        <Tabs defaultValue="consultar">
          <TabsList className="h-11">
            <TabsTrigger value="consultar"><Search className="h-4 w-4 mr-2" />Consultar</TabsTrigger>
            <TabsTrigger value="emitir"><Plus className="h-4 w-4 mr-2" />Novo CT-e</TabsTrigger>
          </TabsList>

          <TabsContent value="consultar">
            <Card>
              <CardHeader><CardTitle className="text-lg">Conhecimentos de Transporte</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Remetente</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Modal</TableHead>
                      <TableHead className="text-right">Peso (kg)</TableHead>
                      <TableHead className="text-right">Valor Frete</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : notas.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum CT-e encontrado</TableCell></TableRow>
                    ) : notas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.numero || "—"}</TableCell>
                        <TableCell>{parseLocalDate(c.data_emissao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{c.remetente_nome || "—"}</TableCell>
                        <TableCell className="font-medium">{c.destinatario_nome || "—"}</TableCell>
                        <TableCell>{c.modal || "—"}</TableCell>
                        <TableCell className="text-right">{c.peso_bruto ? Number(c.peso_bruto).toLocaleString("pt-BR") : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">R$ {Number(c.valor_frete || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell><Badge variant={c.status === "autorizada" ? "default" : c.status === "cancelada" ? "destructive" : "secondary"}>{c.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emitir">
            <div className="grid gap-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Remetente</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div><Label>CNPJ</Label><Input placeholder="00.000.000/0000-00" /></div>
                    <div><Label>Razão Social</Label><Input placeholder="Razão social do remetente" /></div>
                    <div><Label>Endereço</Label><Input placeholder="Endereço completo" /></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-lg">Destinatário</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div><Label>CNPJ</Label><Input placeholder="00.000.000/0000-00" /></div>
                    <div><Label>Razão Social</Label><Input placeholder="Razão social do destinatário" /></div>
                    <div><Label>Endereço</Label><Input placeholder="Endereço completo" /></div>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-lg">Dados do Transporte</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Modal</Label>
                    <Select defaultValue="rodoviario">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rodoviario">Rodoviário</SelectItem>
                        <SelectItem value="aereo">Aéreo</SelectItem>
                        <SelectItem value="aquaviario">Aquaviário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Peso Bruto (kg)</Label><Input type="number" placeholder="0" /></div>
                  <div><Label>Valor da Mercadoria</Label><Input placeholder="0,00" /></div>
                  <div><Label>Valor do Frete</Label><Input placeholder="0,00" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-lg">Observações</CardTitle></CardHeader>
                <CardContent>
                  <Textarea placeholder="Observações do conhecimento de transporte..." />
                </CardContent>
              </Card>
              <div className="flex justify-end gap-3">
                <Button variant="outline">Salvar Rascunho</Button>
                <Button onClick={handleEmitir}><Send className="h-4 w-4 mr-2" />Transmitir CT-e</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
