import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ParceiroLayout } from "@/components/parceiro/ParceiroLayout";
import { useParceiroDados, ValeGasParceiro } from "@/hooks/useParceiroDados";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, Printer, QrCode, Clock, CheckCircle2, Package, ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { ValeGasQRCode } from "@/components/valegas/ValeGasQRCode";
import { esc } from "@/lib/escapeHtml";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof Clock }> = {
  disponivel: { label: "Disponível", variant: "default", icon: Package },
  vendido: { label: "Vendido", variant: "outline", icon: Clock },
  utilizado: { label: "Utilizado", variant: "secondary", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", variant: "destructive", icon: Clock },
};

function ValeCard({ vale, onVender, onUtilizar, onQRCode }: { vale: ValeGasParceiro; onVender?: () => void; onUtilizar?: () => void; onQRCode?: () => void }) {
  const cfg = statusConfig[vale.status] || { label: vale.status, variant: "outline" as const, icon: Clock };
  const StatusIcon = cfg.icon;

  const imprimirVale = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Vale Gás #${vale.numero}</title>
      <style>
        body { font-family: monospace; width: 280px; margin: 0 auto; padding: 10px; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .bold { font-weight: bold; }
        .small { font-size: 11px; }
      </style></head><body>
      <div class="center bold">VALE GÁS #${vale.numero}</div>
      <div>Código: ${vale.codigo}</div>
      <div class="bold">Valor: R$ ${Number(vale.valor).toFixed(2)}</div>
      ${vale.produto_nome ? `<div>Produto: ${vale.produto_nome}</div>` : ""}
      <div class="line"></div>
      ${vale.consumidor_nome ? `<div class="bold">Consumidor:</div><div>${vale.consumidor_nome}</div>` : ""}
      ${vale.consumidor_cpf ? `<div>CPF: ${vale.consumidor_cpf}</div>` : ""}
      <div class="line"></div>
      <div class="center small">Status: ${cfg.label}</div>
      <div class="center small">${new Date(vale.created_at).toLocaleDateString("pt-BR")}</div>
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <StatusIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">#{vale.numero}</span>
            <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
            <span className="text-xs font-bold text-foreground">R$ {Number(vale.valor).toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{vale.codigo}</p>
          {vale.consumidor_nome && (
            <p className="text-xs text-muted-foreground mt-0.5">{vale.consumidor_nome} {vale.consumidor_cpf ? `• ${vale.consumidor_cpf}` : ""}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onQRCode} title="QR Code">
          <QrCode className="h-4 w-4" />
        </Button>
        {vale.status === "disponivel" && onVender && (
          <Button size="sm" variant="outline" onClick={onVender} className="gap-1 h-8">
            <ShoppingCart className="h-3.5 w-3.5" />
            Vender
          </Button>
        )}
        {vale.status === "vendido" && onUtilizar && (
          <Button size="sm" onClick={onUtilizar} className="gap-1 h-8 bg-teal-600 hover:bg-teal-700 text-white">
            <Zap className="h-3.5 w-3.5" />
            Utilizar
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ParceiroVales() {
  const navigate = useNavigate();
  const { vales, disponiveis, vendidos, utilizados, isLoading, refetchVales } = useParceiroDados();
  const [busca, setBusca] = useState("");
  const [utilizarVale, setUtilizarVale] = useState<ValeGasParceiro | null>(null);
  const [loadingUtilizar, setLoadingUtilizar] = useState(false);
  const [qrVale, setQrVale] = useState<ValeGasParceiro | null>(null);

  const filtrar = (lista: ValeGasParceiro[]) => {
    if (!busca.trim()) return lista;
    const term = busca.toLowerCase();
    return lista.filter(
      (v) =>
        v.numero.toString().includes(term) ||
        v.codigo.toLowerCase().includes(term) ||
        (v.consumidor_nome || "").toLowerCase().includes(term) ||
        (v.consumidor_cpf || "").toLowerCase().includes(term)
    );
  };

  const confirmarUtilizacao = async () => {
    if (!utilizarVale) return;
    setLoadingUtilizar(true);
    try {
      const { error } = await (supabase as any).from("vale_gas").update({
        status: "utilizado",
        data_utilizacao: new Date().toISOString(),
      }).eq("id", utilizarVale.id);
      if (error) throw error;
      toast.success(`Vale #${utilizarVale.numero} marcado como utilizado!`);
      refetchVales();
    } catch (err: any) {
      toast.error(err.message || "Erro ao utilizar vale");
    } finally {
      setLoadingUtilizar(false);
      setUtilizarVale(null);
    }
  };

  const handleVender = (vale: ValeGasParceiro) => {
    navigate("/parceiro/vender", { state: { valeNumero: vale.numero.toString() } });
  };

  if (isLoading) {
    return (
      <ParceiroLayout title="Meus Vales">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParceiroLayout>
    );
  }

  return (
    <ParceiroLayout title="Meus Vales">
      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, código, nome ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs defaultValue="disponivel">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="disponivel">Disponíveis ({disponiveis.length})</TabsTrigger>
            <TabsTrigger value="vendido">Vendidos ({vendidos.length})</TabsTrigger>
            <TabsTrigger value="utilizado">Utilizados ({utilizados.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="disponivel" className="space-y-2 mt-3">
            {filtrar(disponiveis).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum vale disponível.</p>
            ) : (
              filtrar(disponiveis).map((v) => <ValeCard key={v.id} vale={v} onVender={() => handleVender(v)} onQRCode={() => setQrVale(v)} />)
            )}
          </TabsContent>

          <TabsContent value="vendido" className="space-y-2 mt-3">
            {filtrar(vendidos).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum vale vendido.</p>
            ) : (
              filtrar(vendidos).map((v) => <ValeCard key={v.id} vale={v} onUtilizar={() => setUtilizarVale(v)} onQRCode={() => setQrVale(v)} />)
            )}
          </TabsContent>

          <TabsContent value="utilizado" className="space-y-2 mt-3">
            {filtrar(utilizados).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum vale utilizado.</p>
            ) : (
              filtrar(utilizados).map((v) => <ValeCard key={v.id} vale={v} onQRCode={() => setQrVale(v)} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmação de utilização */}
      <AlertDialog open={!!utilizarVale} onOpenChange={(o) => !o && setUtilizarVale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar vale como utilizado?</AlertDialogTitle>
            <AlertDialogDescription>
              O vale <strong>#{utilizarVale?.numero}</strong> ({utilizarVale?.consumidor_nome}) será marcado como utilizado. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingUtilizar}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarUtilizacao} disabled={loadingUtilizar}>
              {loadingUtilizar ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {qrVale && (
        <ValeGasQRCode
          open={!!qrVale}
          onClose={() => setQrVale(null)}
          vale={{
            numero: qrVale.numero,
            codigo: qrVale.codigo,
            valor: Number(qrVale.valor),
            parceiroNome: qrVale.consumidor_nome || undefined,
          }}
        />
      )}
    </ParceiroLayout>
  );
}
