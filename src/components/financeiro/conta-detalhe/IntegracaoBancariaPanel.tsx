import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, CheckCircle2, AlertCircle, ExternalLink, Plug, Loader2, Eye, EyeOff, ShieldCheck, CalendarClock, Database, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  type BankProvider,
  getProviderInfo,
} from "@/lib/bancos/bankProviders";

interface Props {
  contaId: string;
  banco: string;
  unidadeId: string | null;
  provider: BankProvider;
  accentColor: string;
}

interface IntegracaoRow {
  id: string;
  unidade_id: string;
  integracao_id: string;
  config: Record<string, any>;
  ativo: boolean;
}

const CAP_LABEL: Record<string, string> = {
  saldo: "Saldo",
  extrato: "Extrato",
  pix: "Pix",
  boleto: "Boleto",
  maquininha: "Maquininha",
};

export default function IntegracaoBancariaPanel({
  contaId,
  banco,
  unidadeId,
  provider,
  accentColor,
}: Props) {
  const queryClient = useQueryClient();
  const info = getProviderInfo(provider);

  const { data: integracao, isLoading } = useQuery({
    queryKey: ["integracao-conta", unidadeId, provider],
    queryFn: async () => {
      if (!unidadeId || !provider) return null;
      const { data } = await supabase
        .from("integracoes_config")
        .select("*")
        .eq("unidade_id", unidadeId)
        .eq("integracao_id", provider)
        .maybeSingle();
      return (data || null) as IntegracaoRow | null;
    },
    // PagBank usa um endpoint sanitizado; nunca carregue a configuração legada
    // (que pode conter token antigo) diretamente no navegador.
    enabled: !!unidadeId && !!provider && provider !== "pagbank",
  });

  if (!provider || !info) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Esta conta ({banco}) não possui integração via API disponível. Use as abas de Extrato, OFX e
          Transferência para gerenciar manualmente.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="p-4 flex items-center gap-3" style={{ background: `${accentColor}14` }}>
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: `${accentColor}26`, color: accentColor }}
          >
            <Plug className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight">Integração {info.label}</p>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </div>
          {provider === "pagbank" ? (
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">APIs PagBank</Badge>
          ) : integracao?.ativo ? (
            <Badge className="bg-success hover:bg-success">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-warning border-warning bg-warning">
              <AlertCircle className="h-3.5 w-3.5 mr-1" /> Não configurado
            </Badge>
          )}
        </div>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {info.capabilities.map((c) => (
              <Badge key={c} variant="secondary" className="text-xs">
                {CAP_LABEL[c] || c}
              </Badge>
            ))}
          </div>
          <a
            href={info.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Documentação oficial <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando configuração…</p>
      ) : provider === "pagbank" ? (
        <>
          <PagBankOnlineForm contaId={contaId} unidadeId={unidadeId!} />
          <PagBankForm contaId={contaId} unidadeId={unidadeId!} />
        </>
      ) : provider === "asaas" ? (
        <AsaasForm
          contaId={contaId}
          unidadeId={unidadeId!}
          integracao={integracao}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["integracao-conta", unidadeId, provider] })}
        />
      ) : null}
    </div>
  );
}

function PagBankOnlineForm({ contaId, unidadeId }: { contaId: string; unidadeId: string }) {
  const queryClient = useQueryClient();
  const [ambiente, setAmbiente] = useState<"sandbox" | "producao">("sandbox");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["pagbank-online-config", unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("pagbank-api", {
        body: { action: "get_online_config", unidade_id: unidadeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.config || null;
    },
    enabled: !!unidadeId,
  });

  const effectiveEnvironment = cfg?.ambiente || ambiente;
  const hasToken = Boolean(cfg?.token_mascara);

  useEffect(() => {
    if (cfg?.ambiente === "sandbox" || cfg?.ambiente === "producao") setAmbiente(cfg.ambiente);
  }, [cfg?.ambiente]);

  const salvar = async () => {
    setSaving(true);
    try {
      if (!token.trim()) throw new Error("Informe o token da API PagBank");
      const { data, error } = await supabase.functions.invoke("pagbank-api", {
        body: { action: "save_online_credentials", unidade_id: unidadeId,
          conta_bancaria_id: contaId, ambiente, api_token: token.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setToken("");
      toast.success("Token da API Pix salvo com segurança");
      await queryClient.invalidateQueries({ queryKey: ["pagbank-online-config", unidadeId] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const testar = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("pagbank-api", {
        body: { action: "test_connection", unidade_id: unidadeId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Conexão recusada");
      toast.success("Conexão validada; o teste já consta nos logs do Sandbox");
    } catch (e: any) {
      toast.error(e.message || "Falha ao testar", { duration: 9000 });
    } finally { setTesting(false); }
  };

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b bg-primary/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><QrCode className="h-4 w-4 text-primary" /> Pix em tempo real</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Gere QR Code por venda e confirme o pagamento automaticamente.</p>
          </div>
          <Badge variant="outline" className={hasToken ? "border-success/30 bg-success/10 text-success" : ""}>
            {hasToken ? "Configurado" : "Aguardando configuração"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-medium">Ambiente da API Order/Pix</p><p className="text-xs text-muted-foreground">Use Sandbox até a homologação ser aprovada.</p></div>
          <div className="flex items-center gap-2 text-sm">
            <span className={ambiente === "sandbox" ? "font-semibold" : "text-muted-foreground"}>Sandbox</span>
            <Switch checked={ambiente === "producao"} onCheckedChange={(v) => setAmbiente(v ? "producao" : "sandbox")} disabled={isLoading} />
            <span className={ambiente === "producao" ? "font-semibold" : "text-muted-foreground"}>Produção</span>
          </div>
        </div>
        {hasToken && <p className="text-xs text-muted-foreground">Ambiente salvo: <strong>{effectiveEnvironment === "producao" ? "Produção" : "Sandbox"}</strong> · Token: <span className="font-mono">{cfg.token_mascara}</span></p>}
        <div className="space-y-1.5">
          <Label htmlFor="pagbank-online-token">Token da API {ambiente === "sandbox" ? "Sandbox" : "Produção"}</Label>
          <div className="flex gap-2">
            <Input id="pagbank-online-token" type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} placeholder={hasToken ? "Digite apenas para substituir" : "Cole o token do Portal do Desenvolvedor"} autoComplete="off" />
            <Button type="button" size="icon" variant="outline" aria-label={showToken ? "Ocultar token" : "Mostrar token"} onClick={() => setShowToken(v => !v)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={salvar} disabled={saving || !token.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar token</Button>
          <Button variant="outline" onClick={testar} disabled={testing || !hasToken}>{testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Testar conexão</Button>
        </div>
        <p className="text-xs text-muted-foreground">No Sandbox, o teste cria uma cobrança técnica de R$ 1,00 para gerar o log exigido pela homologação. Nenhum valor real é movimentado.</p>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   PagBank form
   ============================================================ */
function PagBankForm({
  contaId,
  unidadeId,
}: {
  contaId: string;
  unidadeId: string;
}) {
  const queryClient = useQueryClient();
  const [estabelecimentoId, setEstabelecimentoId] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["pagbank-edi-config", unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("pagbank-api", {
        body: { action: "get_edi_config", unidade_id: unidadeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.config || null;
    },
    enabled: !!unidadeId,
  });

  const hasToken = Boolean(cfg?.token_mascara);
  const status = cfg?.status || "aguardando_credenciais";
  const statusInfo = status === "conectado"
    ? { label: "Conectado", className: "border-success/30 bg-success/10 text-success" }
    : status === "erro"
      ? { label: "Requer atenção", className: "border-destructive/30 bg-destructive/10 text-destructive" }
      : status === "configurado"
        ? { label: "Credenciais salvas", className: "border-warning/30 bg-warning/10 text-warning" }
        : { label: "Aguardando credenciais", className: "border-muted-foreground/25 bg-muted text-muted-foreground" };

  const salvar = async () => {
    setSaving(true);
    try {
      const id = (estabelecimentoId || cfg?.estabelecimento_id || "").replace(/\D/g, "");
      if (!id) throw new Error("Informe o USER/ID do estabelecimento");
      if (!token.trim()) throw new Error("Informe o Token API EDI recebido do PagBank");
      const { data, error } = await supabase.functions.invoke("pagbank-api", {
        body: {
          action: "save_edi_credentials",
          unidade_id: unidadeId,
          conta_bancaria_id: contaId,
          estabelecimento_id: id,
          edi_token: token.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Credenciais EDI protegidas e salvas");
      setToken("");
      setEstabelecimentoId("");
      await queryClient.invalidateQueries({ queryKey: ["pagbank-edi-config", unidadeId] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" /> API EDI PagBank
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Conciliação automática das maquininhas e da conta PagBank.</p>
          </div>
          <Badge variant="outline" className={statusInfo.className}>{statusInfo.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-3.5"><Database className="mb-2 h-4 w-4 text-primary" /><p className="text-sm font-medium">Vendas e recebíveis</p><p className="text-xs text-muted-foreground">Transações, taxas e liquidações.</p></div>
          <div className="rounded-xl border bg-card p-3.5"><CalendarClock className="mb-2 h-4 w-4 text-primary" /><p className="text-sm font-medium">Dados D+1</p><p className="text-xs text-muted-foreground">Movimentos validados pelo PagBank.</p></div>
          <div className="rounded-xl border bg-card p-3.5"><ShieldCheck className="mb-2 h-4 w-4 text-primary" /><p className="text-sm font-medium">Credencial protegida</p><p className="text-xs text-muted-foreground">Token armazenado no cofre do sistema.</p></div>
        </div>

        <div className="rounded-xl border border-warning/25 bg-warning/5 p-4 text-sm">
          <p className="font-medium">Use as credenciais exclusivas da API EDI</p>
          <p className="mt-1 text-muted-foreground">O token do Portal do Desenvolvedor em ambiente de teste não funciona aqui. Preencha somente quando o PagBank enviar o USER e o Token API EDI da ativação solicitada.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pagbank-edi-user">USER / ID do estabelecimento</Label>
            <Input id="pagbank-edi-user" inputMode="numeric" value={estabelecimentoId} onChange={(e) => setEstabelecimentoId(e.target.value.replace(/\D/g, ""))} placeholder={cfg?.estabelecimento_id || "Informe o USER recebido"} disabled={isLoading} />
          </div>
          <div className="space-y-1.5">
          <Label htmlFor="pagbank-edi-token">Token API EDI</Label>
          {hasToken && !token && (
            <p className="text-xs text-muted-foreground">Token atual: <span className="font-mono">{cfg.token_mascara}</span>. Digite um novo somente para substituir.</p>
          )}
          <div className="flex gap-2">
            <Input
              id="pagbank-edi-token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={hasToken ? "Digite para substituir" : "Cole o Token API EDI"}
              autoComplete="off"
              disabled={isLoading}
            />
            <Button variant="outline" size="icon" type="button" aria-label={showToken ? "Ocultar token" : "Mostrar token"} onClick={() => setShowToken((s) => !s)}>
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={salvar} disabled={saving || isLoading || !token.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar credenciais EDI
          </Button>
          <Button variant="outline" disabled title="Será liberado após a ativação das credenciais EDI">Testar conexão</Button>
          <Button variant="outline" disabled title="Será liberado após a ativação das credenciais EDI">Sincronizar agora</Button>
          <span className="text-xs text-muted-foreground sm:ml-auto">Conta de destino: esta conta PagBank</span>
        </div>
        {cfg?.ultimo_erro && <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Último erro: {cfg.ultimo_erro}</p>}
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Asaas form (read-only, redireciona para Configurações)
   ============================================================ */
function AsaasForm({
  contaId,
  unidadeId,
  integracao,
  onSaved,
}: {
  contaId: string;
  unidadeId: string;
  integracao: IntegracaoRow | null;
  onSaved: () => void;
}) {
  const [syncing, setSyncing] = useState(false);

  const sincronizarSaldo = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "get_balance" },
      });
      if (error) throw error;
      const saldo = Number(data?.balance?.totalBalance ?? data?.balance?.balance ?? 0);
      const { error: upErr } = await supabase
        .from("contas_bancarias")
        .update({ saldo_atual: saldo, updated_at: new Date().toISOString() })
        .eq("id", contaId);
      if (upErr) throw upErr;
      toast.success(`Saldo atualizado: R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" /> Conexão Asaas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A chave de API do Asaas é configurada por empresa em{" "}
          <a href="/configuracoes/asaas" className="text-primary underline">
            Configurações → Asaas
          </a>
          . Depois de configurar, use o botão abaixo para puxar o saldo atual da sua conta digital.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/configuracoes/asaas">
              <Settings className="h-4 w-4 mr-2" /> Abrir configurações
            </a>
          </Button>
          <Button onClick={sincronizarSaldo} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Sincronizar saldo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
