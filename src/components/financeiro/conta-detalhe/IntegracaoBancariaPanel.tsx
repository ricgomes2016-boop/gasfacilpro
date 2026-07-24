import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, CheckCircle2, AlertCircle, ExternalLink, RefreshCcw, Plug, Loader2, Eye, EyeOff } from "lucide-react";
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
    enabled: !!unidadeId && !!provider,
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
          {integracao?.ativo ? (
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
        <PagBankForm
          contaId={contaId}
          unidadeId={unidadeId!}
          integracao={integracao}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["integracao-conta", unidadeId, provider] })}
        />
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

/* ============================================================
   PagBank form
   ============================================================ */
function PagBankForm({
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
  const cfg = integracao?.config || {};
  const [ambiente, setAmbiente] = useState<"sandbox" | "producao">(cfg.ambiente || "sandbox");
  const [email, setEmail] = useState<string>(cfg.email_conta || "");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const hasToken = Boolean(cfg.token_mascara);
  const cleanToken = (value: string) => value.trim().replace(/^Bearer\s+/i, "").trim();

  const salvar = async () => {
    setSaving(true);
    try {
      const newConfig: Record<string, any> = {
        ...cfg,
        ambiente,
        email_conta: email || null,
        conta_bancaria_id: contaId,
      };
      if (token.trim()) {
        const normalizedToken = cleanToken(token);
        newConfig.token = normalizedToken;
        newConfig.token_mascara = `••••${normalizedToken.slice(-4)}`;
      }
      const payload = {
        unidade_id: unidadeId,
        integracao_id: "pagbank",
        config: newConfig,
        ativo: true,
      };
      const { error } = await supabase
        .from("integracoes_config")
        .upsert(payload, { onConflict: "unidade_id,integracao_id" });
      if (error) throw error;
      toast.success("Configuração salva");
      setToken("");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const testar = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("pagbank-api", {
        body: { action: "test_connection", unidade_id: unidadeId },
      });
      if (error) throw error;
      if (data?.success) toast.success("Conexão OK com PagBank");
      else toast.error(data?.error || "Falha na conexão", { duration: 9000 });
    } catch (e: any) {
      toast.error(e.message || "Erro ao testar");
    } finally {
      setTesting(false);
    }
  };

  const sincronizar = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("pagbank-api", {
        body: {
          action: "list_transactions",
          unidade_id: unidadeId,
          conta_bancaria_id: contaId,
          dias: 30,
        },
      });
      if (error) throw error;
      toast.success(`${data?.importadas ?? 0} movimentações importadas`);
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
          <Settings className="h-4 w-4" /> Credenciais PagBank
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium text-sm">Ambiente</p>
            <p className="text-xs text-muted-foreground">
              Sandbox para testes, Produção para cobranças reais.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={ambiente === "sandbox" ? "font-semibold" : "text-muted-foreground"}>Sandbox</span>
            <Switch
              checked={ambiente === "producao"}
              onCheckedChange={(v) => setAmbiente(v ? "producao" : "sandbox")}
            />
            <span className={ambiente === "producao" ? "font-semibold" : "text-muted-foreground"}>Produção</span>
          </div>
        </div>

        <div>
          <Label>E-mail da conta PagBank</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@pagbank.com" />
        </div>

        <div>
          <Label>Token da API</Label>
          {hasToken && !token && (
            <p className="text-xs text-muted-foreground mb-1">
              Token atual: <span className="font-mono">{cfg.token_mascara}</span> — preencha abaixo apenas se quiser
              substituir.
            </p>
          )}
          <div className="flex gap-2">
            <Input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={hasToken ? "Deixe vazio para manter o atual" : "Cole seu token aqui"}
              autoComplete="off"
            />
            <Button variant="outline" size="icon" type="button" onClick={() => setShowToken((s) => !s)}>
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gere em{" "}
            <a
              href="https://acesso.pagseguro.uol.com.br/integracoes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              PagBank → Integrações
            </a>{" "}
            (Sandbox usa{" "}
            <a
              href="https://acesso.sandbox.pagseguro.uol.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              ambiente de testes
            </a>
            ).
          </p>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
          <Button variant="outline" onClick={testar} disabled={testing || !hasToken}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Testar conexão
          </Button>
          <Button variant="outline" onClick={sincronizar} disabled={syncing || !hasToken}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Sincronizar extrato (30 dias)
          </Button>
        </div>
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
