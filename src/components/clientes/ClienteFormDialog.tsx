import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Map, Loader2 } from "lucide-react";
import { geocodeAddress } from "@/lib/geocoding";
import { MapPickerDialog } from "@/components/ui/map-picker-dialog";
import type { GeocodingResult } from "@/lib/geocoding";
import type { ClienteForm } from "@/hooks/useClientes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: ClienteForm;
  editId?: string;
  onSave: (form: ClienteForm, editId?: string) => Promise<boolean>;
}

export function ClienteFormDialog({ open, onOpenChange, initialData, editId, onSave }: Props) {
  const [form, setForm] = useState<ClienteForm>(initialData);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialData);
  }, [open, initialData]);

  const update = (field: keyof ClienteForm, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressBlur = async () => {
    const addr = [form.endereco, form.numero, form.bairro, form.cidade].filter(Boolean).join(", ");
    if (addr.length < 5) return;
    setIsGeocoding(true);
    const result = await geocodeAddress(addr);
    if (result) {
      setForm((prev) => ({
        ...prev,
        latitude: result.latitude,
        longitude: result.longitude,
        bairro: prev.bairro || result.bairro || "",
        cep: prev.cep || result.cep || "",
      }));
    }
    setIsGeocoding(false);
  };

  const handleCepBlur = async () => {
    const cep = (form.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    setIsGeocoding(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
    setIsGeocoding(false);
  };

  const handleMapConfirm = (result: GeocodingResult) => {
    setForm((prev) => ({
      ...prev,
      latitude: result.latitude,
      longitude: result.longitude,
      endereco: result.endereco || prev.endereco,
      bairro: result.bairro || prev.bairro,
    }));
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      return;
    }
    setSaving(true);
    const ok = await onSave(form, editId);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>
              {editId ? "Atualize os dados do cliente" : "Preencha os dados do novo cliente"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 grid gap-1.5">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="grid gap-1.5">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div className="grid gap-1.5">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => update("cpf", e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>

            <div className="border-t pt-3 grid gap-3">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> Endereço
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-3 grid gap-1.5">
                  <Label className="text-xs">Logradouro</Label>
                  <div className="flex gap-1">
                    <Input
                      value={form.endereco}
                      onChange={(e) => update("endereco", e.target.value)}
                      onBlur={handleAddressBlur}
                      placeholder="Rua, Avenida..."
                      className="flex-1"
                    />
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => setMapPickerOpen(true)}>
                      {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Map className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Nº</Label>
                  <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} placeholder="123" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} placeholder="Bairro" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} placeholder="Cidade" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">CEP</Label>
                  <Input value={form.cep} onChange={(e) => update("cep", e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => update("tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residencial">Residencial</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="industrial">Industrial</SelectItem>
                      <SelectItem value="revenda">Revenda</SelectItem>
                      <SelectItem value="revendedor">Revendedor</SelectItem>
                      <SelectItem value="condominio">Condomínio</SelectItem>
                      <SelectItem value="orgao_publico">Órgão Público</SelectItem>
                      <SelectItem value="rural">Rural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end col-span-2 sm:col-span-1">
                  {form.latitude && form.longitude && (
                    <p className="text-[10px] text-muted-foreground pb-2">
                      📍 {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.nome.trim()}>
              {saving ? "Salvando..." : editId ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MapPickerDialog
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialPosition={
          form.latitude && form.longitude ? { lat: form.latitude, lng: form.longitude } : null
        }
        onConfirm={handleMapConfirm}
      />
    </>
  );
}
