import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Loader2, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props { onImported?: () => void; }

export function OutlookImportButton({ onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [remetente, setRemetente] = useState(localStorage.getItem("estoque_xml_remetente") || "");
  const [dias, setDias] = useState(localStorage.getItem("estoque_xml_dias") || "30");
  const [loading, setLoading] = useState(false);
  const [ultima, setUltima] = useState<string | null>(localStorage.getItem("estoque_xml_ultima"));
  const [resultado, setResultado] = useState<any>(null);

  async function importar() {
    setLoading(true);
    setResultado(null);
    try {
      localStorage.setItem("estoque_xml_remetente", remetente);
      localStorage.setItem("estoque_xml_dias", dias);
      const { data, error } = await supabase.functions.invoke("importar_xml_outlook_compras", {
        body: { filtro_remetente: remetente || null, dias: Number(dias) },
      });
      if (error) throw error;
      if (data?.ok === false) {
        toast.error("Erro ao importar", { description: data.error });
        return;
      }
      const agora = new Date().toISOString();
      localStorage.setItem("estoque_xml_ultima", agora);
      setUltima(agora);
      setResultado(data);
      toast.success("Importação concluída", {
        description: `${data?.total_importados ?? 0} importadas · ${data?.ja_existentes ?? 0} já existentes · ${data?.erros ?? 0} erros`,
      });
      onImported?.();
    } catch (err: any) {
      toast.error("Erro", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function reprocessar() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reprocessar_itens_compras_outlook", { body: {} });
      if (error) throw error;
      if (data?.ok === false) { toast.error("Erro", { description: data.error }); return; }
      toast.success("Reprocessamento concluído", {
        description: `${data?.processadas ?? 0}/${data?.total ?? 0} compras · ${data?.itens_criados ?? 0} itens · ${data?.produtos_criados ?? 0} produtos criados · ${data?.erros ?? 0} erros`,
      });
      setResultado({ ...data, _reprocess: true });
      onImported?.();
    } catch (err: any) {
      toast.error("Erro", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Mail className="h-4 w-4" /> Importar XML do Outlook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar XMLs do Outlook</DialogTitle>
          <DialogDescription>
            Busca anexos .xml nos e-mails recentes e cadastra como compras (com a parte fiscal completa).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div>
            <Label htmlFor="rem">Remetente (opcional)</Label>
            <Input id="rem" type="email" placeholder="ex: fornecedor@empresa.com"
              value={remetente} onChange={(e) => setRemetente(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dias">Período</Label>
            <Select value={dias} onValueChange={setDias}>
              <SelectTrigger id="dias"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {ultima && (
            <p className="text-xs text-muted-foreground">
              Última importação: {new Date(ultima).toLocaleString("pt-BR")}
            </p>
          )}
          {resultado && (
            <div className="text-xs bg-muted rounded p-2 space-y-0.5">
              <div>E-mails analisados: {resultado.total_emails ?? 0}</div>
              <div>XMLs encontrados: {resultado.total_xmls ?? 0}</div>
              <div>Importados: {resultado.total_importados ?? 0}</div>
              <div>Já existentes: {resultado.ja_existentes ?? 0}</div>
              <div>Erros: {resultado.erros ?? 0}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Fechar</Button>
          <Button onClick={importar} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…</> : "Importar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
