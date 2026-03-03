import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard, Shield, ExternalLink, CheckCircle2, AlertTriangle,
  Loader2, Eye, EyeOff, RefreshCw, Banknote, QrCode, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

export default function AsaasConfig() {
  const { empresa } = useEmpresa();
  const [apiKey, setApiKey] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<{ balance: number; } | null>(null);

  useEffect(() => {
    if (empresa?.id) loadConfig();
  }, [empresa?.id]);

  const loadConfig = async () => {
    if (!empresa?.id) return;
    const { data } = await supabase
      .from("configuracoes_empresa")
      .select("*")
      .eq("empresa_id", empresa.id)
      .single();

    const row = data as any;
    if (row?.asaas_api_key) {
      setApiKey(row.asaas_api_key);
      setSandbox(row.asaas_sandbox ?? true);
      setConnected(true);
    }
  };

  const handleSave = async () => {
    if (!empresa?.id) return;
    if (!apiKey.trim()) {
      toast.error("Informe a API Key do Asaas");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes_empresa")
        .upsert({
          empresa_id: empresa.id,
          asaas_api_key: apiKey.trim(),
          asaas_sandbox: sandbox,
        } as any, { onConflict: "empresa_id" });

      if (error) throw error;
      setConnected(true);
      toast.success("Configuração do Asaas salva com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "get_balance" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setBalance(data.balance);
      toast.success("Conexão com Asaas estabelecida com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao testar conexão");
      setBalance(null);
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!empresa?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes_empresa")
        .update({ asaas_api_key: null, asaas_sandbox: true } as any)
        .eq("empresa_id", empresa.id);

      if (error) throw error;
      setApiKey("");
      setSandbox(true);
      setConnected(false);
      setBalance(null);
      toast.success("Asaas desconectado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao desconectar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <Header title="Asaas" subtitle="Configure a integração com o Asaas para cobranças via Boleto e PIX" />
      <div className="p-4 md:p-6 space-y-6 max-w-3xl">

        {/* Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Asaas Gateway</CardTitle>
                  <CardDescription>Boletos registrados e cobranças PIX</CardDescription>
                </div>
              </div>
              <Badge variant={connected ? "default" : "secondary"} className="gap-1.5">
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-muted-foreground"}`} />
                {connected ? "Conectado" : "Desconectado"}
              </Badge>
            </div>
          </CardHeader>
          {connected && balance && (
            <CardContent className="pt-0">
              <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-4">
                <Banknote className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Saldo Disponível</p>
                  <p className="text-lg font-bold">
                    R$ {balance.balance?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Config Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Credenciais
            </CardTitle>
            <CardDescription>
              Obtenha sua API Key em{" "}
              <a
                href="https://www.asaas.com/config/index#tab_api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                Asaas → Configurações → Integrações
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="$aact_xxxxxxxxxxxxxxxx..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">Ambiente Sandbox (Testes)</p>
                <p className="text-xs text-muted-foreground">
                  {sandbox
                    ? "Usando ambiente de homologação — cobranças simuladas"
                    : "Usando ambiente de PRODUÇÃO — cobranças reais"}
                </p>
              </div>
              <Switch checked={sandbox} onCheckedChange={setSandbox} />
            </div>

            {!sandbox && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  <strong>Atenção:</strong> No modo produção, cobranças serão reais e afetarão seu saldo no Asaas.
                </span>
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salvar Configuração
              </Button>
              {connected && (
                <>
                  <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                    {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Testar Conexão
                  </Button>
                  <Button variant="ghost" onClick={handleDisconnect} className="text-destructive hover:text-destructive">
                    Desconectar
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funcionalidades Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Banknote, title: "Boleto Registrado", desc: "Gere boletos bancários registrados com linha digitável e código de barras", ready: true },
                { icon: QrCode, title: "Cobrança PIX", desc: "QR Code dinâmico para pagamentos instantâneos via PIX", ready: true },
                { icon: Receipt, title: "Consulta de Cobranças", desc: "Visualize status, valores e vencimentos de todas as cobranças", ready: true },
                { icon: CreditCard, title: "Cartão de Crédito", desc: "Cobranças via cartão de crédito com tokenização segura", ready: false },
              ].map((feat) => (
                <div key={feat.title} className={`flex items-start gap-3 p-3 rounded-lg border ${feat.ready ? "" : "opacity-50"}`}>
                  <feat.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{feat.title}</p>
                      {feat.ready ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Docs */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">📚 Como começar</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Crie uma conta em <a href="https://sandbox.asaas.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">sandbox.asaas.com</a> para testes</li>
                <li>Acesse Configurações → Integrações → API e copie sua chave</li>
                <li>Cole a API Key acima e clique em "Salvar Configuração"</li>
                <li>Teste a conexão e comece a gerar cobranças!</li>
              </ol>
              <Separator className="my-3" />
              <a
                href="https://docs.asaas.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                Documentação oficial da API Asaas
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
