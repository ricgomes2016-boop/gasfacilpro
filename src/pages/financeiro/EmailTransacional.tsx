import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Mail, Send, Settings, Clock, CheckCircle2, XCircle, Eye,
  Loader2, FileText, Receipt, AlertTriangle, Zap, BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const TIPOS_EMAIL = [
  { value: "boleto", label: "Boleto / Cobrança", icon: Receipt },
  { value: "nfe", label: "Nota Fiscal", icon: FileText },
  { value: "lembrete", label: "Lembrete de Pagamento", icon: Clock },
  { value: "confirmacao", label: "Confirmação de Pedido", icon: CheckCircle2 },
  { value: "campanha", label: "Campanha / Promoção", icon: Zap },
  { value: "relatorio", label: "Relatório", icon: BarChart3 },
];

const TEMPLATES: Record<string, { assunto: string; corpo: string }> = {
  boleto: {
    assunto: "Boleto disponível - {empresa}",
    corpo: "Olá {nome},\n\nSeu boleto no valor de R$ {valor} com vencimento em {vencimento} está disponível.\n\nPara pagamento, utilize a linha digitável:\n{linha_digitavel}\n\nAtenciosamente,\n{empresa}",
  },
  nfe: {
    assunto: "Nota Fiscal Eletrônica - {empresa}",
    corpo: "Olá {nome},\n\nSegue em anexo a Nota Fiscal referente ao seu pedido #{pedido}.\n\nValor: R$ {valor}\n\nAtenciosamente,\n{empresa}",
  },
  lembrete: {
    assunto: "Lembrete: Pagamento pendente - {empresa}",
    corpo: "Olá {nome},\n\nGostaríamos de lembrar que você possui um pagamento pendente no valor de R$ {valor}, com vencimento em {vencimento}.\n\nCaso já tenha efetuado o pagamento, desconsidere esta mensagem.\n\nAtenciosamente,\n{empresa}",
  },
  confirmacao: {
    assunto: "Pedido confirmado #{pedido} - {empresa}",
    corpo: "Olá {nome},\n\nSeu pedido #{pedido} foi confirmado com sucesso!\n\nValor total: R$ {valor}\nPrevisão de entrega: {data_entrega}\n\nAtenciosamente,\n{empresa}",
  },
  campanha: {
    assunto: "Promoção especial para você! - {empresa}",
    corpo: "Olá {nome},\n\nTemos uma oferta especial para você!\n\n{descricao}\n\nAproveite!\n\n{empresa}",
  },
  relatorio: {
    assunto: "Relatório {periodo} - {empresa}",
    corpo: "Olá {nome},\n\nSegue o relatório do período {periodo}.\n\nAtenciosamente,\n{empresa}",
  },
};

export default function EmailTransacional() {
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [tipoEmail, setTipoEmail] = useState("boleto");
  const [destinatario, setDestinatario] = useState("");
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Config estados
  const [autoEnviarBoleto, setAutoEnviarBoleto] = useState(true);
  const [autoEnviarNfe, setAutoEnviarNfe] = useState(true);
  const [autoLembrete, setAutoLembrete] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["email_log", unidadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("email_log query error:", error);
        return [];
      }
      return data || [];
    },
  });

  const handleAbrirEnvio = (tipo?: string) => {
    const t = tipo || tipoEmail;
    setTipoEmail(t);
    const template = TEMPLATES[t];
    if (template) {
      setAssunto(template.assunto);
      setCorpo(template.corpo);
    }
    setEnviarOpen(true);
  };

  const handleEnviar = async () => {
    if (!destinatario || !assunto) {
      toast.error("Preencha destinatário e assunto"); return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          tipo: tipoEmail,
          destinatario_email: destinatario,
          destinatario_nome: destinatarioNome,
          assunto,
          corpo,
        },
      });
      if (error) throw error;
      toast.success(data?.message || "E-mail registrado!");
      if (data?.simulated) {
        toast.info("Modo simulação: Configure um provedor SMTP para envio real.", { duration: 5000 });
      }
      setEnviarOpen(false);
      setDestinatario(""); setDestinatarioNome(""); setAssunto(""); setCorpo("");
      queryClient.invalidateQueries({ queryKey: ["email_log"] });
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setEnviando(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === "enviado") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    if (s === "erro") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  };

  return (
    <MainLayout>
      <Header title="E-mail Transacional" subtitle="Envie boletos, notas fiscais e lembretes por e-mail" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Banner simulação */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Modo simulação ativo</p>
              <p className="text-muted-foreground">Os e-mails são registrados no sistema mas não enviados de fato. Para envio real, configure um provedor SMTP (Resend, SendGrid ou AWS SES) na tela de Integrações.</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="enviar">
          <TabsList>
            <TabsTrigger value="enviar">Enviar E-mail</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({logs.length})</TabsTrigger>
            <TabsTrigger value="config">Automações</TabsTrigger>
          </TabsList>

          <TabsContent value="enviar" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TIPOS_EMAIL.map(t => {
                const Icon = t.icon;
                return (
                  <Card
                    key={t.value}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleAbrirEnvio(t.value)}
                  >
                    <CardContent className="pt-5 pb-4 flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.label}</p>
                        <p className="text-xs text-muted-foreground">Clique para enviar</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum e-mail registrado ainda.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Destinatário</TableHead>
                          <TableHead>Assunto</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell>{statusIcon(log.status)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{log.tipo}</Badge></TableCell>
                            <TableCell className="text-sm">{log.destinatario_email}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{log.assunto}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Automações de e-mail</CardTitle>
                <CardDescription>Configure envios automáticos baseados em eventos do sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Enviar boleto ao emitir</p>
                    <p className="text-xs text-muted-foreground">Envia automaticamente quando um boleto é gerado</p>
                  </div>
                  <Switch checked={autoEnviarBoleto} onCheckedChange={setAutoEnviarBoleto} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Enviar NF-e ao emitir</p>
                    <p className="text-xs text-muted-foreground">Envia a nota fiscal por e-mail ao cliente</p>
                  </div>
                  <Switch checked={autoEnviarNfe} onCheckedChange={setAutoEnviarNfe} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Lembrete 3 dias antes do vencimento</p>
                    <p className="text-xs text-muted-foreground">Envia lembrete automático para títulos a vencer</p>
                  </div>
                  <Switch checked={autoLembrete} onCheckedChange={setAutoLembrete} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog enviar */}
      <Dialog open={enviarOpen} onOpenChange={setEnviarOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enviar {TIPOS_EMAIL.find(t => t.value === tipoEmail)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome do destinatário</Label>
                <Input value={destinatarioNome} onChange={e => setDestinatarioNome(e.target.value)} placeholder="João Silva" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={destinatario} onChange={e => setDestinatario(e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assunto *</Label>
              <Input value={assunto} onChange={e => setAssunto(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Corpo do e-mail</Label>
              <Textarea rows={8} value={corpo} onChange={e => setCorpo(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnviarOpen(false)}>Cancelar</Button>
            <Button onClick={handleEnviar} disabled={enviando} className="gap-2">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {enviando ? "Enviando..." : "Enviar (simulado)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
