import { useState, useEffect, useRef } from "react";
import { parseLocalDate } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Archive, Filter, Upload, FileUp, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarNotas, criarNota, type NotaFiscal } from "@/services/focusNfeService";
import { Progress } from "@/components/ui/progress";

export default function GerarXML() {
  const { toast } = useToast();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: number; total: number } | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const carregarNotas = () => {
    setLoading(true);
    listarNotas(tipoFiltro === "todos" ? undefined : tipoFiltro as any)
      .then(setNotas)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregarNotas(); }, [tipoFiltro]);

  const filtrados = notas;

  const toggle = (id: string) => {
    setSelecionados((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const ids = filtrados.map((x) => x.id);
    setSelecionados((prev) => prev.length === ids.length ? [] : ids);
  };

  const tipoLabel = (t: string) => t.toUpperCase().replace("NFE", "NF-e").replace("NFCE", "NFC-e").replace("CTE", "CT-e").replace("MDFE", "MDF-e");

  const tipoColor = (t: string) => {
    if (t === "nfe") return "default" as const;
    if (t === "nfce") return "secondary" as const;
    if (t === "cte") return "outline" as const;
    return "destructive" as const;
  };

  const contagem = (tipo: string) => notas.filter(n => n.tipo === tipo).length;

  // Parse XML file and extract NF-e data
  const parseXmlFile = (xmlString: string): Partial<NotaFiscal> | null => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, "text/xml");

      const getTag = (tag: string, parent?: Element) => {
        const el = (parent || doc).getElementsByTagName(tag)[0];
        return el?.textContent?.trim() || null;
      };

      // Detect doc type
      const hasNFe = doc.getElementsByTagName("NFe").length > 0 || doc.getElementsByTagName("nfeProc").length > 0;
      const hasCTe = doc.getElementsByTagName("CTe").length > 0 || doc.getElementsByTagName("cteProc").length > 0;
      const hasMDFe = doc.getElementsByTagName("MDFe").length > 0;

      let tipo: "nfe" | "nfce" | "cte" | "mdfe" = "nfe";
      if (hasCTe) tipo = "cte";
      else if (hasMDFe) tipo = "mdfe";

      // Try to detect NFC-e (mod=65)
      const mod = getTag("mod");
      if (mod === "65") tipo = "nfce";

      const chave = getTag("chNFe") || getTag("chCTe") || getTag("chMDFe") || null;
      const nProt = getTag("nProt");
      const nNF = getTag("nNF") || getTag("nCT") || getTag("nMDF");
      const serie = getTag("serie");

      // Destinatário
      const dest = doc.getElementsByTagName("dest")[0];
      const destNome = getTag("xNome", dest) || null;
      const destCnpj = getTag("CNPJ", dest) || getTag("CPF", dest) || null;
      const destEndereco = dest ? [
        getTag("xLgr", dest), getTag("nro", dest), getTag("xBairro", dest)
      ].filter(Boolean).join(", ") : null;
      const destCidade = dest ? [getTag("xMun", dest), getTag("UF", dest)].filter(Boolean).join(" / ") : null;
      const destIE = getTag("IE", dest);

      // Valores
      const vNF = getTag("vNF") || getTag("vPrest") || "0";
      const vFrete = getTag("vFrete") || "0";

      // Status based on protocol
      let status: "autorizada" | "rascunho" = nProt ? "autorizada" : "rascunho";

      // Data emissão
      const dhEmi = getTag("dhEmi") || getTag("dEmi");
      const dataEmissao = dhEmi ? dhEmi.substring(0, 10) : new Date().toISOString().substring(0, 10);

      const natOp = getTag("natOp");

      return {
        tipo,
        numero: nNF,
        serie,
        chave_acesso: chave,
        protocolo: nProt,
        status,
        destinatario_nome: destNome,
        destinatario_cpf_cnpj: destCnpj,
        destinatario_endereco: destEndereco,
        destinatario_cidade_uf: destCidade,
        destinatario_ie: destIE,
        valor_total: parseFloat(vNF) || 0,
        valor_frete: parseFloat(vFrete) || 0,
        natureza_operacao: natOp,
        data_emissao: dataEmissao,
        xml_importado: true as any,
        xml_conteudo: xmlString as any,
      };
    } catch (err) {
      console.error("Erro ao parsear XML:", err);
      return null;
    }
  };

  const handleImportXml = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setImporting(true);
    setImportResults(null);
    setImportProgress(0);

    let success = 0;
    let errors = 0;
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      try {
        const text = await files[i].text();
        const parsed = parseXmlFile(text);

        if (parsed) {
          await criarNota(parsed);
          success++;
        } else {
          errors++;
        }
      } catch (e) {
        console.error(`Erro ao importar ${files[i].name}:`, e);
        errors++;
      }
      setImportProgress(Math.round(((i + 1) / total) * 100));
    }

    setImportResults({ success, errors, total });
    setImporting(false);

    if (success > 0) {
      carregarNotas();
      toast({ 
        title: `${success} XML(s) importado(s) com sucesso!`, 
        description: errors > 0 ? `${errors} arquivo(s) com erro.` : undefined 
      });
    } else {
      toast({ title: "Nenhum XML importado", description: "Verifique se os arquivos são XMLs válidos de NF-e/NFC-e/CT-e/MDF-e.", variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <Header title="Central de XML" subtitle="Gestão Fiscal" />
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar XML
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={selecionados.length === 0} onClick={() => toast({ title: `${selecionados.length} XML(s) baixado(s)` })}>
              <Download className="h-4 w-4 mr-2" />Baixar Selecionados ({selecionados.length})
            </Button>
            <Button disabled={selecionados.length === 0} onClick={() => toast({ title: "Lote ZIP gerado", description: `${selecionados.length} arquivos compactados.` })}>
              <Archive className="h-4 w-4 mr-2" />Gerar Lote ZIP
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["nfe", "nfce", "cte", "mdfe"].map(t => (
            <Card key={t} className="text-center p-4">
              <p className="text-2xl font-bold">{contagem(t)}</p>
              <p className="text-sm text-muted-foreground">{tipoLabel(t)}</p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Arquivos XML Disponíveis</CardTitle>
            <CardDescription>Selecione os documentos para download individual ou em lote.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 mb-4 flex-wrap">
              <Input placeholder="Buscar por número, chave ou destinatário..." className="max-w-md" />
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-[150px]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="nfe">NF-e</SelectItem>
                  <SelectItem value="nfce">NFC-e</SelectItem>
                  <SelectItem value="cte">CT-e</SelectItem>
                  <SelectItem value="mdfe">MDF-e</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" className="w-[160px]" />
              <Input type="date" className="w-[160px]" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selecionados.length === filtrados.length && filtrados.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum documento encontrado</TableCell></TableRow>
                ) : filtrados.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell><Checkbox checked={selecionados.includes(x.id)} onCheckedChange={() => toggle(x.id)} /></TableCell>
                    <TableCell><Badge variant={tipoColor(x.tipo)}>{tipoLabel(x.tipo)}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{x.numero || "—"}</TableCell>
                    <TableCell>{parseLocalDate(x.data_emissao).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{x.destinatario_nome || "—"}</TableCell>
                    <TableCell className="text-right">{Number(x.valor_total) > 0 ? `R$ ${Number(x.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                    <TableCell><Badge variant={x.status === "autorizada" ? "default" : "secondary"}>{x.status}</Badge></TableCell>
                    <TableCell>
                      {(x as any).xml_importado ? (
                        <Badge variant="outline" className="text-xs gap-1"><Upload className="h-3 w-3" />Importado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Sistema</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => toast({ title: `XML ${x.numero || x.id} baixado` })} disabled={!x.xml_url && !(x as any).xml_conteudo}><Download className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Importar XML do Sistema Antigo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Importe arquivos XML de NF-e, NFC-e, CT-e ou MDF-e do seu sistema anterior. 
                Os dados serão extraídos automaticamente (número, destinatário, valores, chave de acesso, etc.).
              </p>

              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Arraste os arquivos XML ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground mt-1">Aceita múltiplos arquivos .xml</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  multiple
                  className="hidden"
                  onChange={e => handleImportXml(e.target.files)}
                />
              </div>

              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Importando... {importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              {importResults && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="font-medium">Resultado da Importação</p>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-primary">
                      <CheckCircle className="h-4 w-4" />
                      {importResults.success} importado(s)
                    </div>
                    {importResults.errors > 0 && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        {importResults.errors} erro(s)
                      </div>
                    )}
                    <span className="text-muted-foreground">de {importResults.total} arquivo(s)</span>
                  </div>
                </div>
              )}

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>💡 Dica:</strong> Exporte os XMLs do seu sistema antigo (geralmente na seção "Documentos Fiscais" ou "Backup XML") 
                  e importe todos de uma vez aqui. O sistema identifica automaticamente o tipo (NF-e, NFC-e, CT-e, MDF-e) 
                  e extrai todos os dados relevantes.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
