import { useState, useEffect } from "react";
import { useRegrasCadastro } from "@/hooks/useRegrasCadastro";
import {
  ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogDescription as DialogDescription, ResponsiveDialogFooter as DialogFooter, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
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
  const { regras } = useRegrasCadastro();
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
    if (regras.telefone_obrigatorio && !form.telefone.trim()) {
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
        <DialogContent className="sm:max-w-lg p-3 sm:p-6 overflow-x-hidden">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base sm:text-lg">{editId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editId ? "Atualize os dados do cliente" : "Preencha os dados do novo cliente"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1 max-h-[65vh] overflow-y-auto -mx-1 px-1">
            <div className="grid gap-2.5">
              <div className="grid gap-1">
                <Label className="text-xs sm:text-sm">Nome *</Label>
                <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Nome completo" className="h-9 text-base md:text-sm" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs sm:text-sm">CPF/CNPJ</Label>
                <Input value={form.cpf} onChange={(e) => update("cpf", e.target.value)} placeholder="CPF ou CNPJ" className="h-9 w-full min-w-0 text-base md:text-sm" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs sm:text-sm">Telefone *</Label>
                <Input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} placeholder="(11) 99999-9999" className="h-9 text-base md:text-sm" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs sm:text-sm">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@example.com" className="h-9 text-base md:text-sm" />
              </div>
            </div>

            <div className="border-t pt-2.5 grid gap-2.5">
              <Label className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Endereço
              </Label>
              <div className="grid gap-1">
                <Label className="text-xs">CEP</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={form.cep} onChange={(e) => update("cep", e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" className="h-9 min-w-0 flex-1 text-base md:text-sm" />
                  <Button variant="outline" size="sm" className="h-9 w-full shrink-0 px-3 text-xs sm:w-auto" onClick={handleCepBlur} disabled={isGeocoding}>
                    {isGeocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Endereço</Label>
                <div className="flex min-w-0 gap-1.5">
                  <Input
                    value={form.endereco}
                    onChange={(e) => update("endereco", e.target.value)}
                    onBlur={handleAddressBlur}
                    placeholder="Digite a rua para buscar..."
                    className="h-9 min-w-0 flex-1 text-base md:text-sm"
                  />
                  <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => setMapPickerOpen(true)}>
                    <Map className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Número</Label>
                  <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} placeholder="Nº" className="h-9 text-base md:text-sm" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} placeholder="Bairro" className="h-9 text-base md:text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} placeholder="Cidade" className="h-9 text-base md:text-sm" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => update("tipo", v)}>
                    <SelectTrigger className="h-9 text-base md:text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residencial">Residencial</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="industrial">Industrial</SelectItem>
                      
                      <SelectItem value="revendedor">Revendedor</SelectItem>
                      <SelectItem value="condominio">Condomínio</SelectItem>
                      <SelectItem value="orgao_publico">Órgão Público</SelectItem>
                      <SelectItem value="rural">Rural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.latitude && form.longitude && (
                <p className="text-[10px] text-muted-foreground">
                  📍 {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={handleSubmit} disabled={saving || !form.nome.trim()}>
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
