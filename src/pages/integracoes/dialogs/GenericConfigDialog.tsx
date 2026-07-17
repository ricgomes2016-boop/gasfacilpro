import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ExternalLink, Settings, CheckCircle2 } from "lucide-react";
import type { Integracao } from "../types";

interface GenericConfigDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  integracao: Integracao | null;
  unidades: { id: string; nome: string }[];
  configs: any[];
  configUnidadeId: string;
  setConfigUnidadeId: (v: string) => void;
  configValues: Record<string, string>;
  setConfigValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  configEditId: string | null;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  onEdit: (cfg: any, integracao: Integracao) => void;
  onDelete: (id: string) => void;
}

export function GenericConfigDialog({
  open, onOpenChange, integracao, unidades, configs,
  configUnidadeId, setConfigUnidadeId, configValues, setConfigValues,
  configEditId, saving, onSave, onReset, onEdit, onDelete,
}: GenericConfigDialogProps) {
  const integracaoConfigs = integracao
    ? configs.filter((c) => c.integracao_id === integracao.id)
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) onReset(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {integracao && <integracao.icon className="h-5 w-5" />}
            {integracao?.nome} — por Unidade
          </DialogTitle>
          <DialogDescription>
            Configure esta integração individualmente para cada unidade/filial.
            {integracao?.helpUrl && (
              <a href={integracao.helpUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary mt-1 hover:underline">
                <ExternalLink className="h-3 w-3" /> Documentação do serviço
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        {integracao && integracaoConfigs.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Configurações ativas:</p>
            {integracaoConfigs.map((cfg) => (
              <div key={cfg.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{cfg.unidades?.nome || "Unidade"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {Object.entries(cfg.config || {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "Configurado"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={cfg.ativo ? "default" : "secondary"} className="text-[10px]">
                    {cfg.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(cfg, integracao)}>
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(cfg.id)}>
                    <span className="text-xs">✕</span>
                  </Button>
                </div>
              </div>
            ))}
            <Separator />
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={configUnidadeId} onValueChange={setConfigUnidadeId}>
              <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {integracao?.configFields?.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`cfg-${field.key}`}>{field.label}</Label>
              <Input
                id={`cfg-${field.key}`}
                type={field.type === "password" ? "password" : "text"}
                placeholder={field.placeholder}
                value={configValues[field.key] || ""}
                onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}

          {integracao?.beneficios && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
              <p className="text-xs font-medium">Recursos:</p>
              {integracao.beneficios.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onReset(); }}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {configEditId ? "Atualizar" : "Vincular à Unidade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
