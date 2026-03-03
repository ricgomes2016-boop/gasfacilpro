import { useState, useEffect } from "react";
import { parseLocalDate } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, Send, Search, FileText, XCircle, Truck, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarNotas, criarNota, transmitirParaSefaz, cancelarNaSefaz, enviarCartaCorrecao, type NotaFiscal } from "@/services/focusNfeService";

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

const MODALIDADE_FRETE = [
  { value: "0", label: "0 - Contratação do Frete por conta do Remetente (CIF)" },
  { value: "1", label: "1 - Contratação do Frete por conta do Destinatário (FOB)" },
  { value: "2", label: "2 - Contratação do Frete por conta de Terceiros" },
  { value: "3", label: "3 - Transporte Próprio por conta do Remetente" },
  { value: "4", label: "4 - Transporte Próprio por conta do Destinatário" },
  { value: "9", label: "9 - Sem Ocorrência de Transporte" },
];

const CFOP_COMUNS = [
  { value: "5102", label: "5102 - Venda mercadoria dentro do estado" },
  { value: "5405", label: "5405 - Venda mercadoria ST dentro do estado" },
  { value: "6102", label: "6102 - Venda mercadoria fora do estado" },
  { value: "6108", label: "6108 - Venda mercadoria fora estado não contribuinte" },
  { value: "5949", label: "5949 - Outra saída não especificada" },
  { value: "6949", label: "6949 - Outra saída não especificada (interestadual)" },
];

interface NFeFormData {
  destinatario_cpf_cnpj: string;
  destinatario_nome: string;
  destinatario_endereco: string;
  destinatario_cidade_uf: string;
  destinatario_ie: string;
  destinatario_cep: string;
  destinatario_telefone: string;
  natureza_operacao: string;
  forma_pagamento: string;
  observacoes: string;
  // Transporte
  modalidade_frete: string;
  transportadora_nome: string;
  transportadora_cnpj: string;
  transportadora_ie: string;
  transportadora_endereco: string;
  transportadora_cidade_uf: string;
  placa: string;
  uf_placa: string;
  rntrc: string;
  peso_bruto: string;
  peso_liquido: string;
  quantidade_volumes: string;
  especie_volumes: string;
  marca_volumes: string;
  numeracao_volumes: string;
  valor_frete: string;
  // Info adicionais
  info_complementares: string;
  info_fisco: string;
}

const initialForm: NFeFormData = {
  destinatario_cpf_cnpj: "",
  destinatario_nome: "",
  destinatario_endereco: "",
  destinatario_cidade_uf: "",
  destinatario_ie: "",
  destinatario_cep: "",
  destinatario_telefone: "",
  natureza_operacao: "Venda de mercadoria",
  forma_pagamento: "vista",
  observacoes: "",
  modalidade_frete: "9",
  transportadora_nome: "",
  transportadora_cnpj: "",
  transportadora_ie: "",
  transportadora_endereco: "",
  transportadora_cidade_uf: "",
  placa: "",
  uf_placa: "",
  rntrc: "",
  peso_bruto: "",
  peso_liquido: "",
  quantidade_volumes: "",
  especie_volumes: "",
  marca_volumes: "",
  numeracao_volumes: "",
  valor_frete: "",
  info_complementares: "",
  info_fisco: "",
};

export default function EmitirNFe() {
  const { toast } = useToast();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [form, setForm] = useState<NFeFormData>(initialForm);

  const carregarNotas = async () => {
    try {
      const data = await listarNotas("nfe", { busca, status: filtroStatus });
      setNotas(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregarNotas(); }, [busca, filtroStatus]);

  const updateForm = (field: keyof NFeFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const statusColor = (s: string) => {
    if (s === "autorizada") return "default" as const;
    if (s === "cancelada") return "destructive" as const;
    return "secondary" as const;
  };

  const handleEmitir = async () => {
    if (!form.destinatario_nome.trim()) {
      toast({ title: "Preencha o destinatário", variant: "destructive" });
      return;
    }
    try {
      const nota = await criarNota({
        tipo: "nfe",
        status: "rascunho",
        destinatario_nome: form.destinatario_nome,
        destinatario_cpf_cnpj: form.destinatario_cpf_cnpj,
        destinatario_endereco: form.destinatario_endereco,
        destinatario_cidade_uf: form.destinatario_cidade_uf,
        destinatario_ie: form.destinatario_ie,
        natureza_operacao: form.natureza_operacao,
        forma_pagamento: form.forma_pagamento,
        observacoes: form.observacoes,
        valor_total: 0,
        valor_frete: parseFloat(form.valor_frete) || 0,
        peso_bruto: parseFloat(form.peso_bruto) || 0,
        placa: form.placa,
        rntrc: form.rntrc,
        motorista_nome: form.transportadora_nome,
      });
      const result = await transmitirParaSefaz(nota.id);
      toast({ title: "NF-e enviada", description: result.message });
      setForm(initialForm);
      carregarNotas();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleCancelar = async (id: string) => {
    try {
      const result = await cancelarNaSefaz(id, "Cancelamento solicitado pelo operador");
      toast({ title: "NF-e cancelada", description: result.message });
      carregarNotas();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const showTransport = form.modalidade_frete !== "9";

  return (
    <MainLayout>
      <Header title="NF-e" subtitle="Gestão Fiscal" />
      <div className="space-y-6 p-4 md:p-6">
        <Tabs defaultValue="consultar">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="consultar"><Search className="h-4 w-4 mr-2" />Consultar</TabsTrigger>
              <TabsTrigger value="emitir"><Plus className="h-4 w-4 mr-2" />Nova NF-e</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="consultar">
            <Card>
              <CardHeader><CardTitle className="text-lg">Notas Fiscais Eletrônicas</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-3 mb-4">
                  <Input placeholder="Buscar por destinatário ou número..." className="max-w-sm" value={busca} onChange={e => setBusca(e.target.value)} />
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="autorizada">Autorizadas</SelectItem>
                      <SelectItem value="cancelada">Canceladas</SelectItem>
                      <SelectItem value="rejeitada">Rejeitadas</SelectItem>
                      <SelectItem value="rascunho">Rascunhos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>CNPJ/CPF</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : notas.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma NF-e encontrada</TableCell></TableRow>
                    ) : notas.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-mono text-sm">{n.numero || "—"}</TableCell>
                        <TableCell>{parseLocalDate(n.data_emissao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="font-medium">{n.destinatario_nome || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{n.destinatario_cpf_cnpj || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">R$ {Number(n.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell><Badge variant={statusColor(n.status)}>{n.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" title="Ver XML"><FileText className="h-4 w-4" /></Button>
                            {n.status === "autorizada" && (
                              <Button variant="ghost" size="icon" title="Cancelar" onClick={() => handleCancelar(n.id)}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emitir">
            <div className="grid gap-6">
              {/* Destinatário */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Dados do Destinatário</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><Label>CNPJ / CPF *</Label><Input placeholder="00.000.000/0000-00" value={form.destinatario_cpf_cnpj} onChange={e => updateForm("destinatario_cpf_cnpj", e.target.value)} /></div>
                  <div className="md:col-span-2"><Label>Razão Social *</Label><Input placeholder="Nome do destinatário" value={form.destinatario_nome} onChange={e => updateForm("destinatario_nome", e.target.value)} /></div>
                  <div className="md:col-span-2"><Label>Endereço</Label><Input placeholder="Rua, número, complemento, bairro" value={form.destinatario_endereco} onChange={e => updateForm("destinatario_endereco", e.target.value)} /></div>
                  <div><Label>Cidade / UF</Label><Input placeholder="São Paulo / SP" value={form.destinatario_cidade_uf} onChange={e => updateForm("destinatario_cidade_uf", e.target.value)} /></div>
                  <div><Label>Inscrição Estadual</Label><Input placeholder="Isento ou número" value={form.destinatario_ie} onChange={e => updateForm("destinatario_ie", e.target.value)} /></div>
                  <div><Label>CEP</Label><Input placeholder="00000-000" value={form.destinatario_cep} onChange={e => updateForm("destinatario_cep", e.target.value)} /></div>
                  <div><Label>Telefone</Label><Input placeholder="(00) 0000-0000" value={form.destinatario_telefone} onChange={e => updateForm("destinatario_telefone", e.target.value)} /></div>
                </CardContent>
              </Card>

              {/* Produtos */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Produtos / Serviços</CardTitle>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Adicionar Item</Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>NCM</TableHead>
                        <TableHead>CFOP</TableHead>
                        <TableHead>UN</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">Adicione itens à nota fiscal</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      <strong>CFOPs comuns:</strong> {CFOP_COMUNS.map(c => c.label).join(" | ")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Transporte */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Transporte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Modalidade do Frete *</Label>
                      <Select value={form.modalidade_frete} onValueChange={v => updateForm("modalidade_frete", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MODALIDADE_FRETE.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Valor do Frete</Label>
                      <Input type="number" step="0.01" placeholder="0,00" value={form.valor_frete} onChange={e => updateForm("valor_frete", e.target.value)} />
                    </div>
                  </div>

                  {showTransport && (
                    <Accordion type="single" collapsible defaultValue="transportadora">
                      <AccordionItem value="transportadora">
                        <AccordionTrigger className="text-sm font-medium">Dados da Transportadora</AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="md:col-span-2"><Label>Razão Social</Label><Input placeholder="Transportadora" value={form.transportadora_nome} onChange={e => updateForm("transportadora_nome", e.target.value)} /></div>
                            <div><Label>CNPJ</Label><Input placeholder="00.000.000/0000-00" value={form.transportadora_cnpj} onChange={e => updateForm("transportadora_cnpj", e.target.value)} /></div>
                            <div><Label>Inscrição Estadual</Label><Input placeholder="IE da transportadora" value={form.transportadora_ie} onChange={e => updateForm("transportadora_ie", e.target.value)} /></div>
                            <div><Label>Endereço</Label><Input placeholder="Endereço" value={form.transportadora_endereco} onChange={e => updateForm("transportadora_endereco", e.target.value)} /></div>
                            <div><Label>Cidade / UF</Label><Input placeholder="Cidade / UF" value={form.transportadora_cidade_uf} onChange={e => updateForm("transportadora_cidade_uf", e.target.value)} /></div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="veiculo">
                        <AccordionTrigger className="text-sm font-medium">Veículo</AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div><Label>Placa</Label><Input placeholder="ABC-1234" value={form.placa} onChange={e => updateForm("placa", e.target.value)} /></div>
                            <div>
                              <Label>UF da Placa</Label>
                              <Select value={form.uf_placa} onValueChange={v => updateForm("uf_placa", v)}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>{UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div><Label>RNTRC (ANTT)</Label><Input placeholder="Registro ANTT" value={form.rntrc} onChange={e => updateForm("rntrc", e.target.value)} /></div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="volumes">
                        <AccordionTrigger className="text-sm font-medium">Volumes Transportados</AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                            <div><Label>Quantidade</Label><Input type="number" placeholder="0" value={form.quantidade_volumes} onChange={e => updateForm("quantidade_volumes", e.target.value)} /></div>
                            <div><Label>Espécie</Label><Input placeholder="Ex: Caixa, Botijão" value={form.especie_volumes} onChange={e => updateForm("especie_volumes", e.target.value)} /></div>
                            <div><Label>Marca</Label><Input placeholder="Marca dos volumes" value={form.marca_volumes} onChange={e => updateForm("marca_volumes", e.target.value)} /></div>
                            <div><Label>Numeração</Label><Input placeholder="Numeração" value={form.numeracao_volumes} onChange={e => updateForm("numeracao_volumes", e.target.value)} /></div>
                            <div><Label>Peso Bruto (kg)</Label><Input type="number" step="0.001" placeholder="0,000" value={form.peso_bruto} onChange={e => updateForm("peso_bruto", e.target.value)} /></div>
                            <div><Label>Peso Líquido (kg)</Label><Input type="number" step="0.001" placeholder="0,000" value={form.peso_liquido} onChange={e => updateForm("peso_liquido", e.target.value)} /></div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </CardContent>
              </Card>

              {/* Informações Complementares */}
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5" />Informações Complementares</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>Natureza da Operação *</Label><Input value={form.natureza_operacao} onChange={e => updateForm("natureza_operacao", e.target.value)} /></div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Select value={form.forma_pagamento} onValueChange={v => updateForm("forma_pagamento", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vista">À Vista</SelectItem>
                        <SelectItem value="prazo">A Prazo</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                        <SelectItem value="sem_pagamento">Sem Pagamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Informações Complementares de Interesse do Contribuinte</Label>
                    <Textarea 
                      placeholder="Ex: Venda realizada conforme convênio ICMS XX/XXXX. Produto sujeito a substituição tributária..." 
                      className="min-h-[80px]"
                      value={form.info_complementares} 
                      onChange={e => updateForm("info_complementares", e.target.value)} 
                    />
                    <p className="text-xs text-muted-foreground mt-1">Campo impresso no DANFE. Use para informar dados de benefícios fiscais, base legal de ST, etc.</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Informações Adicionais de Interesse do Fisco</Label>
                    <Textarea 
                      placeholder="Informações de interesse exclusivo do fisco..." 
                      className="min-h-[60px]"
                      value={form.info_fisco} 
                      onChange={e => updateForm("info_fisco", e.target.value)} 
                    />
                    <p className="text-xs text-muted-foreground mt-1">Campo exclusivo para informações exigidas pela legislação fiscal.</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Observações Internas</Label>
                    <Textarea placeholder="Observações internas (não aparece na nota)..." value={form.observacoes} onChange={e => updateForm("observacoes", e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setForm(initialForm)}>Limpar</Button>
                <Button variant="outline">Salvar Rascunho</Button>
                <Button onClick={handleEmitir}><Send className="h-4 w-4 mr-2" />Transmitir para SEFAZ</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
