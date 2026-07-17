import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  KeyRound, CheckCircle2, Settings, QrCode, Trash2, Loader2,
  Copy, CheckCheck, Plus, AlertTriangle,
} from "lucide-react";

type MetaConexaoModo = "token" | "embedded_signup";

interface MetaDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  metaWebhookUrl: string;
  copiedWebhook: boolean;
  onCopyWebhook: () => void;
  metaConfigs: any[];
  metaDeletingId: string | null;
  unidades: { id: string; nome: string }[];
  metaEditId: string | null;
  metaConexaoModo: MetaConexaoModo;
  setMetaConexaoModo: (m: MetaConexaoModo) => void;
  metaUnidadeId: string;
  setMetaUnidadeId: (v: string) => void;
  metaAccessToken: string;
  setMetaAccessToken: (v: string) => void;
  metaPhoneNumberId: string;
  setMetaPhoneNumberId: (v: string) => void;
  metaWabaId: string;
  setMetaWabaId: (v: string) => void;
  metaVerifyToken: string;
  setMetaVerifyToken: (v: string) => void;
  metaSaving: boolean;
  metaAppId: string;
  setMetaAppId: (v: string) => void;
  embeddedSignupLoading: boolean;
  onSaveMeta: () => void;
  onEditMeta: (cfg: any) => void;
  onDeleteMeta: (id: string) => void;
  onResetMeta: () => void;
  onEmbeddedSignup: () => void;
  onShowCoexQr: (phoneNumberId: string, token: string) => void;
}

export function MetaDialog(p: MetaDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={(o) => { p.onOpenChange(o); if (!o) { p.onResetMeta(); p.setMetaConexaoModo("token"); } }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <KeyRound className="h-6 w-6 text-primary" />
            WhatsApp Oficial — Meta Cloud API
          </DialogTitle>
          <DialogDescription>
            Configure a API oficial do WhatsApp da Meta. Escolha entre Token Manual ou Embedded Signup com <strong>Coexistência (QR Code)</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-info/5 border border-info/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-info uppercase tracking-widest">URL do Webhook (configure no painel Meta)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono bg-muted px-3 py-2 rounded-lg break-all">{p.metaWebhookUrl}</code>
            <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={p.onCopyWebhook}>
              {p.copiedWebhook ? <CheckCheck className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {p.copiedWebhook ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cole esta URL no campo <strong>Webhook URL</strong> no painel do Meta for Developers.
          </p>
        </div>

        {p.metaConfigs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Configurações Ativas
            </h3>
            <div className="grid gap-2">
              {p.metaConfigs.map((cfg) => (
                <div key={cfg.id} className="p-3 rounded-xl border bg-card/50">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{cfg.unidades?.nome || "Unidade"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Phone ID: {cfg.meta_phone_number_id || "-"}
                      </p>
                      {cfg.provedor === "meta_coex" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success px-1.5 py-0.5 rounded-full mt-1">
                          <QrCode className="h-2.5 w-2.5" /> Coexistência
                        </span>
                      )}
                    </div>
                    <Badge variant="default" className="bg-success/10 text-success border-success/20 text-[10px] gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      Ativo
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => p.onEditMeta(cfg)}>
                      <Settings className="h-3 w-3" />
                      Editar
                    </Button>
                    {cfg.provedor === "meta_coex" && cfg.meta_access_token && (
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-[10px] gap-1 px-2 border-success text-success hover:bg-success"
                        onClick={() => p.onShowCoexQr(cfg.meta_phone_number_id, cfg.meta_access_token)}
                      >
                        <QrCode className="h-3 w-3" />
                        QR Code
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 text-[10px] gap-1 px-2 text-destructive hover:text-destructive"
                      onClick={() => p.onDeleteMeta(cfg.id)}
                      disabled={p.metaDeletingId === cfg.id}
                    >
                      {p.metaDeletingId === cfg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            {p.metaEditId ? "Editar Configuração" : "Nova Configuração"}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => p.setMetaConexaoModo("token")}
              className={`flex flex-col items-start gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                p.metaConexaoModo === "token" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <KeyRound className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs font-bold">Token Manual</p>
                <p className="text-[10px] text-muted-foreground">Insira credenciais manualmente</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => p.setMetaConexaoModo("embedded_signup")}
              className={`flex flex-col items-start gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                p.metaConexaoModo === "embedded_signup" ? "border-[#1877F2] bg-info dark:bg-info/20" : "border-border hover:border-info"
              }`}
            >
              <svg className="h-5 w-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <div>
                <p className="text-xs font-bold">Embedded Signup</p>
                <p className="text-[10px] text-muted-foreground">QR Code + Coexistência (recomendado)</p>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold">Filial / Unidade <span className="text-destructive">*</span></Label>
            <Select value={p.metaUnidadeId} onValueChange={p.setMetaUnidadeId} disabled={!!p.metaEditId}>
              <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
              <SelectContent>
                {p.unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {p.metaConexaoModo === "token" && (
            <div className="grid gap-4 bg-muted/20 p-4 rounded-2xl border border-primary/10">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Access Token <span className="text-destructive">*</span></Label>
                <Input className="h-10 text-xs font-mono" type="password" value={p.metaAccessToken} onChange={(e) => p.setMetaAccessToken(e.target.value)} placeholder="EAAxxxxxxx..." />
                <p className="text-[10px] text-muted-foreground">Token permanente do Sistema de Usuários.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Phone Number ID <span className="text-destructive">*</span></Label>
                <Input className="h-10 text-xs font-mono" value={p.metaPhoneNumberId} onChange={(e) => p.setMetaPhoneNumberId(e.target.value)} placeholder="123456789012345" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">WABA ID</Label>
                <Input className="h-10 text-xs font-mono" value={p.metaWabaId} onChange={(e) => p.setMetaWabaId(e.target.value)} placeholder="987654321098765" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Verify Token</Label>
                <Input className="h-10 text-xs font-mono" value={p.metaVerifyToken} onChange={(e) => p.setMetaVerifyToken(e.target.value)} placeholder="gasfacil_meta_verify" />
              </div>
              <Button onClick={p.onSaveMeta} disabled={p.metaSaving || !p.metaUnidadeId || !p.metaAccessToken || !p.metaPhoneNumberId} className="w-full gap-2 font-bold py-5">
                {p.metaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {p.metaEditId ? "Atualizar Configuração" : "Salvar e Ativar"}
              </Button>
            </div>
          )}

          {p.metaConexaoModo === "embedded_signup" && (
            <div className="grid gap-4 bg-info/50 dark:bg-info/10 p-4 rounded-2xl border border-info dark:border-info">
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-info dark:text-info">Como funciona a Coexistência:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success shrink-0" /> Continue usando o WhatsApp no celular normalmente</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success shrink-0" /> A BIA responde automaticamente via API Oficial</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success shrink-0" /> Mensagens aparecem nos dois lugares</li>
                  <li className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-warning shrink-0" /> Requer App Review aprovado na Meta</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">App ID da Meta <span className="text-destructive">*</span></Label>
                <Input className="h-10 text-xs font-mono" value={p.metaAppId} onChange={(e) => p.setMetaAppId(e.target.value)} placeholder="925541403793729" />
                <p className="text-[10px] text-muted-foreground">
                  Encontre em{" "}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    developers.facebook.com/apps
                  </a>
                </p>
              </div>
              <Button onClick={p.onEmbeddedSignup} disabled={p.embeddedSignupLoading || !p.metaUnidadeId || !p.metaAppId} className="w-full gap-2 font-bold py-5 bg-[#1877F2] hover:bg-[#166FE5] text-white">
                {p.embeddedSignupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                )}
                Continuar com Facebook
              </Button>
            </div>
          )}
        </div>

        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-warning uppercase tracking-widest">Como configurar no painel Meta</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Acesse <strong>developers.facebook.com</strong> e abra seu App</li>
            <li>Vá em <strong>WhatsApp &gt; Configuração</strong> e copie o <strong>Phone Number ID</strong></li>
            <li>Gere um <strong>Token de Acesso Permanente</strong> em Configurações do Sistema</li>
            <li>Em <strong>Webhooks</strong>, cole a URL acima e o <strong>Verify Token</strong></li>
            <li>Assine o campo <strong>messages</strong> no webhook</li>
            <li>Para Coexistência: habilite o recurso no App e solicite App Review</li>
          </ol>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
          {p.metaEditId && (
            <Button variant="ghost" onClick={p.onResetMeta} className="mr-auto">Cancelar edição</Button>
          )}
          <Button variant="ghost" onClick={() => { p.onOpenChange(false); p.onResetMeta(); p.setMetaConexaoModo("token"); }}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
