import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Image, Sun, Printer, Upload, Check, Save, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";
import type { BrandThemeId } from "@/lib/brandThemes";
import {
  applyTheme,
  COLOR_OPTIONS,
  DASHBOARD_PASTEL_BRAND_THEME_ID,
  DASHBOARD_PASTEL_PRESET_ID,
  DASHBOARD_PASTEL_PRIMARY,
  THEME_PRESETS,
} from "@/lib/themeUtils";

interface ComprovanteConfig {
  mostrarLogo: boolean;
  mostrarEndereco: boolean;
  mostrarTelefone: boolean;
  rodape: string;
}

interface PersonalizacaoConfig {
  darkMode: boolean;
  corPrimaria: string;
  nomeEmpresa: string;
  logoUrl: string | null;
  comprovante: ComprovanteConfig;
}

const DEFAULT_CONFIG: PersonalizacaoConfig = {
  darkMode: false,
  corPrimaria: DASHBOARD_PASTEL_PRIMARY,
  nomeEmpresa: "Gás Fácil",
  logoUrl: null,
  comprovante: {
    mostrarLogo: true,
    mostrarEndereco: true,
    mostrarTelefone: true,
    rodape: "Obrigado pela preferência! ♻️ Recicle seu botijão.",
  },
};


export default function PersonalizacaoVisual() {
  const { unidadeAtual } = useUnidade();
  const { theme: brandTheme, setTheme: setBrandTheme } = useDashboardTheme();
  const [config, setConfig] = useState<PersonalizacaoConfig>(DEFAULT_CONFIG);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load config from DB whenever unidade changes
  useEffect(() => {
    if (!unidadeAtual) return;
    loadConfig();
  }, [unidadeAtual?.id]);

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(false, DASHBOARD_PASTEL_PRIMARY, DASHBOARD_PASTEL_PRESET_ID);
    setBrandTheme(DASHBOARD_PASTEL_BRAND_THEME_ID);
  }, [setBrandTheme]);

  const loadConfig = async () => {
    if (!unidadeAtual) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("configuracoes_visuais")
        .select("*")
        .eq("unidade_id", unidadeAtual.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const comprovante = (data.comprovante as unknown as ComprovanteConfig) ?? DEFAULT_CONFIG.comprovante;
        const loaded: PersonalizacaoConfig = {
          darkMode: false,
          corPrimaria: DASHBOARD_PASTEL_PRIMARY,
          nomeEmpresa: data.nome_empresa ?? DEFAULT_CONFIG.nomeEmpresa,
          logoUrl: data.logo_url ?? null,
          comprovante,
        };
        setConfig(loaded);
        setLogoPreview(data.logo_url ?? null);
      } else {
        // No config yet for this unidade — use defaults
        setConfig({ ...DEFAULT_CONFIG, nomeEmpresa: unidadeAtual.nome ?? DEFAULT_CONFIG.nomeEmpresa });
        setLogoPreview(null);
      }
      setLogoFile(null);
    } catch (err) {
      console.error("Erro ao carregar personalização:", err);
      toast.error("Erro ao carregar configurações da loja.");
    } finally {
      setLoading(false);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !unidadeAtual) return config.logoUrl;

    const ext = logoFile.name.split(".").pop();
    const path = `logos/${unidadeAtual.id}.${ext}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(path);

    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!unidadeAtual) return;
    setSaving(true);
    try {
      const uploadedLogoUrl = await uploadLogo();

      const comprovanteJson = JSON.parse(JSON.stringify(config.comprovante));

      const { error } = await supabase
        .from("configuracoes_visuais")
        .upsert(
          [{
            unidade_id: unidadeAtual.id,
            dark_mode: false,
            cor_primaria: DASHBOARD_PASTEL_PRIMARY,
            nome_empresa: config.nomeEmpresa,
            logo_url: logoPreview === null ? null : (uploadedLogoUrl ?? config.logoUrl),
            comprovante: comprovanteJson,
          }],
          { onConflict: "unidade_id" }
        );

      if (error) throw error;

      if (uploadedLogoUrl) {
        setLogoPreview(uploadedLogoUrl);
        setConfig((p) => ({ ...p, logoUrl: uploadedLogoUrl }));
      }
      setLogoFile(null);

      setSaved(true);
      toast.success("Personalização salva para esta loja!");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB.");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Personalização Visual" subtitle="Customize a identidade visual do sistema" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Personalização Visual" subtitle="Customize a identidade visual do sistema" />
      <div className="p-4 md:p-6 space-y-6">

        {/* Unidade indicator */}
        {unidadeAtual && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 w-fit">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Configurando: <strong>{unidadeAtual.nome}</strong>
            </span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Logo e Marca */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                <CardTitle>Logo e Marca</CardTitle>
              </div>
              <CardDescription>
                Logotipo exibido no sistema, comprovantes e app do cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-20 w-auto object-contain"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLogo();
                      }}
                    >
                      Remover logo
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-full bg-muted">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Arraste sua logo aqui</p>
                      <p className="text-sm text-muted-foreground">PNG, JPG ou SVG • Máx. 2MB</p>
                    </div>
                    <Button variant="outline" size="sm" type="button">
                      Escolher Arquivo
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Nome exibido no sistema</Label>
                <Input
                  value={config.nomeEmpresa}
                  onChange={(e) => setConfig((p) => ({ ...p, nomeEmpresa: e.target.value }))}
                  placeholder="Gás Fácil"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tema */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Tema do Sistema</CardTitle>
              </div>
              <CardDescription>
                Dashboard Pastel aplicado como padrão visual único.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sun className="h-5 w-5 text-foreground/60" />
                  <div>
                    <p className="font-medium">Modo claro</p>
                    <p className="text-sm text-muted-foreground">
                      Dashboard Pastel ativo em toda a interface
                    </p>
                  </div>
                </div>
                <Switch
                  checked={false}
                  disabled
                />
              </div>
              <Separator />
              {/* Theme Presets */}
              <div className="space-y-3">
                <Label>Padrão visual</Label>
                <div className="grid grid-cols-2 gap-3">
                  {THEME_PRESETS.filter((preset) => preset.id === DASHBOARD_PASTEL_PRESET_ID).map((preset) => {
                    const isActive = "brandThemeId" in preset
                      ? brandTheme === preset.brandThemeId
                      : config.corPrimaria === preset.cor && config.darkMode === preset.dark;
                    return (
                      <button
                        key={preset.id}
                        className={cn(
                          "rounded-lg border-2 p-3 text-left transition-all hover:shadow-md",
                          isActive
                            ? "border-foreground shadow-md"
                            : "border-border hover:border-foreground/20"
                        )}
                        onClick={() => {
                          setConfig((p) => ({ ...p, corPrimaria: preset.cor, darkMode: preset.dark }));
                          const nextBrand: BrandThemeId = "brandThemeId" in preset
                            ? (preset.brandThemeId as BrandThemeId)
                            : "classic";
                          setBrandTheme(nextBrand);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-5 w-5 rounded-full shrink-0 border"
                            style={{ background: (preset as any).gradient ?? preset.hex }}
                          />
                          <span className="text-sm font-semibold">{preset.label}</span>
                          {(preset as any).recommended && (
                            <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                              Padrão
                            </span>
                          )}
                          {isActive && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <Label>Cor principal</Label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_OPTIONS.filter((opt) => opt.hsl === DASHBOARD_PASTEL_PRIMARY).map((opt) => {
                    const isSelected = config.corPrimaria === opt.hsl;
                    return (
                      <button
                        key={opt.label}
                        className="flex flex-col items-center gap-1 group"
                        title={opt.label}
                        onClick={() => setConfig((p) => ({ ...p, corPrimaria: DASHBOARD_PASTEL_PRIMARY, darkMode: false }))}
                      >
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                            isSelected
                              ? "border-foreground scale-110 shadow-md"
                              : "border-transparent group-hover:border-foreground/20"
                          }`}
                          style={{ backgroundColor: opt.hex }}
                        >
                          {isSelected && <Check className="h-4 w-4 text-white" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  A cor oficial do Dashboard Pastel permanece fixa para manter consistência visual.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Comprovante / Cupom */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                <CardTitle>Comprovante / Cupom</CardTitle>
              </div>
              <CardDescription>
                Personalize o layout do comprovante impresso e digital
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Exibir logo no comprovante</p>
                      <p className="text-sm text-muted-foreground">Mostra o logotipo no topo</p>
                    </div>
                    <Switch
                      checked={config.comprovante.mostrarLogo}
                      onCheckedChange={(v) =>
                        setConfig((p) => ({
                          ...p,
                          comprovante: { ...p.comprovante, mostrarLogo: v },
                        }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Exibir endereço</p>
                      <p className="text-sm text-muted-foreground">Endereço da revenda no cabeçalho</p>
                    </div>
                    <Switch
                      checked={config.comprovante.mostrarEndereco}
                      onCheckedChange={(v) =>
                        setConfig((p) => ({
                          ...p,
                          comprovante: { ...p.comprovante, mostrarEndereco: v },
                        }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Exibir telefone</p>
                      <p className="text-sm text-muted-foreground">Telefone de contato no cabeçalho</p>
                    </div>
                    <Switch
                      checked={config.comprovante.mostrarTelefone}
                      onCheckedChange={(v) =>
                        setConfig((p) => ({
                          ...p,
                          comprovante: { ...p.comprovante, mostrarTelefone: v },
                        }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="grid gap-2">
                    <Label>Mensagem do rodapé</Label>
                    <Textarea
                      value={config.comprovante.rodape}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          comprovante: { ...p.comprovante, rodape: e.target.value },
                        }))
                      }
                      placeholder="Obrigado pela preferência!"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Preview do comprovante */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-3 text-center font-medium">Pré-visualização</p>
                  <div className="text-center space-y-1 text-xs font-mono">
                    {config.comprovante.mostrarLogo && (
                      <div className="flex justify-center mb-2">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-8 w-auto object-contain" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <Image className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </div>
                    )}
                    <p className="font-bold text-sm">{config.nomeEmpresa.toUpperCase()}</p>
                    {config.comprovante.mostrarEndereco && (
                      <p className="text-muted-foreground">Rua Exemplo, 123 - Centro</p>
                    )}
                    {config.comprovante.mostrarTelefone && (
                      <p className="text-muted-foreground">(11) 99999-9999</p>
                    )}
                    <Separator className="my-2" />
                    <div className="text-left space-y-1">
                      <p>1x P13 Cheio ............. R$ 120,00</p>
                      <p>1x P45 Cheio ............. R$ 380,00</p>
                    </div>
                    <Separator className="my-2" />
                    <p className="font-bold">TOTAL: R$ 500,00</p>
                    <p>Pagamento: Dinheiro</p>
                    <Separator className="my-2" />
                    <p className="text-muted-foreground italic">{config.comprovante.rodape}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="min-w-36" disabled={saving || saved}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
