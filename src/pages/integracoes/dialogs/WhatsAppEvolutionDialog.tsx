import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Smartphone, QrCode, Signal, Trash2, Loader2, Plus, Zap } from "lucide-react";

interface WhatsAppEvolutionDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  whatsappConfigs: any[];
  connectionStatuses: Record<string, string>;
  unidades: { id: string; nome: string }[];
  wpUnidadeId: string;
  setWpUnidadeId: (v: string) => void;
  wpInstanceId: string;
  setWpInstanceId: (v: string) => void;
  wpCreating: boolean;
  deletingId: string | null;
  onConnect: (cfg: any) => void;
  onStatus: (cfg: any) => void;
  onDelete: (id: string, instanceId: string) => void;
  onCreate: () => void;
}

export function WhatsAppEvolutionDialog(p: WhatsAppEvolutionDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <MessageSquare className="h-6 w-6 text-primary" />
            Central de WhatsApp
          </DialogTitle>
          <DialogDescription>
            Gerencie as conexões de WhatsApp das suas lojas e filiais.
          </DialogDescription>
        </DialogHeader>

        {p.whatsappConfigs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Conexões Ativas
            </h3>
            <div className="grid gap-2">
              {p.whatsappConfigs.map((cfg) => {
                const connStatus = p.connectionStatuses[cfg.id] || "disconnected";
                const isConnected = connStatus === "open" || connStatus === "connected";
                return (
                  <div key={cfg.id} className="p-3 rounded-xl border bg-card/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${isConnected ? "bg-success/10" : "bg-muted"}`}>
                          <Smartphone className={`h-5 w-5 ${isConnected ? "text-success" : "text-muted-foreground"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{cfg.instance_id}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {(cfg as any).unidades?.nome || "Unidade"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={isConnected ? "default" : "secondary"}
                        className={`text-[10px] gap-1 shrink-0 ${isConnected ? "bg-success/10 text-success border-success/20" : ""}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-success" : "bg-muted-foreground"}`} />
                        {isConnected ? "Conectado" : "Desconectado"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pl-11">
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 font-bold" onClick={() => p.onConnect(cfg)}>
                        <QrCode className="h-3 w-3" />
                        {isConnected ? "Reconectar" : "Conectar"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => p.onStatus(cfg)}>
                        <Signal className="h-3 w-3" />
                        Status
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-[10px] gap-1 px-2 text-destructive hover:text-destructive"
                        onClick={() => p.onDelete(cfg.id, cfg.instance_id)}
                        disabled={p.deletingId === cfg.id}
                      >
                        {p.deletingId === cfg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Excluir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator />
          </div>
        )}

        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Nova Conexão
          </h3>

          <div className="grid gap-4 bg-muted/20 p-4 rounded-2xl border border-primary/10">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Filial / Unidade</Label>
              <Select value={p.wpUnidadeId} onValueChange={p.setWpUnidadeId}>
                <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
                <SelectContent>
                  {p.unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Nome da Instância</Label>
              <Input
                className="h-10 text-xs font-mono"
                value={p.wpInstanceId}
                onChange={(e) => p.setWpInstanceId(e.target.value)}
                placeholder="Ex: suaempresa_matriz"
              />
              <p className="text-[10px] text-muted-foreground">
                Gerado automaticamente ao selecionar a unidade. Editável se necessário.
              </p>
            </div>

            <Button
              onClick={p.onCreate}
              disabled={p.wpCreating || !p.wpUnidadeId || !p.wpInstanceId}
              className="w-full gap-2 font-bold py-5"
            >
              {p.wpCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Criar Conexão e Gerar QR Code
            </Button>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
          <Button variant="ghost" onClick={() => p.onOpenChange(false)} className="font-semibold">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
