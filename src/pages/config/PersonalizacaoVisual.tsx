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
import { Palette, Image, Sun, Moon, Printer, Upload, Check, Save, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

const COLOR_OPTIONS = [
  { hsl: "187 65% 38%", label: "Teal", hex: "#219ebc" },
  { hsl: "210 80% 50%", label: "Azul", hex: "#1a6fcc" },
  { hsl: "260 60% 50%", label: "Roxo", hex: "#6b3fa0" },
  { hsl: "350 70% 50%", label: "Vermelho", hex: "#cc1a2e" },
  { hsl: "30 80% 50%", label: "Laranja", hex: "#cc6b1a" },
  { hsl: "152 69% 40%", label: "Verde", hex: "#1f9e5c" },
  { hsl: "220 70% 45%", label: "Índigo", hex: "#2246a8" },
  { hsl: "340 82% 52%", label: "Rosa", hex: "#e81e63" },
];

const THEME_PRESETS = [
  {
    id: "gas-classico",
    label: "Gás Clássico",
    description: "Azul confiança, ideal para revendas tradicionais",
    cor: "210 80% 50%",
    hex: "#1a6fcc",
    dark: false,
  },
  {
    id: "eco-verde",
    label: "Eco Verde",
    description: "Verde sustentável, perfeito para revendas ecológicas",
    cor: "152 69% 40%",
    hex: "#1f9e5c",
    dark: false,
  },
  {
    id: "premium-dark",
    label: "Premium Dark",
    description: "Tema escuro sofisticado com destaque roxo",
    cor: "260 60% 50%",
    hex: "#6b3fa0",
    dark: true,
  },
  {
    id: "energia-laranja",
    label: "Energia",
    description: "Laranja vibrante, transmite dinamismo e agilidade",
    cor: "30 80% 50%",
    hex: "#cc6b1a",
    dark: false,
  },
  {
    id: "forte-gas",
    label: "Forte Gás · Fluid Energy",
    description: "Visual do site institucional: azul profundo, ciano elétrico e fúcsia",
    cor: "217 91% 60%",
    hex: "#3b82f6",
    dark: true,
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 35%, #06b6d4 70%, #d946ef 100%)",
  },
  {
    id: "forte-gas-light",
    label: "Forte Gás · Fluid Light",
    description: "Versão clara e moderna: brilho azul/ciano, cards com glow suave",
    cor: "210 100% 55%",
    hex: "#1a8cff",
    dark: false,
    gradient: "linear-gradient(135deg, #dbeafe 0%, #93c5fd 35%, #38bdf8 70%, #06b6d4 100%)",
  },
];

/** Variáveis CSS extras aplicadas quando um preset especial é selecionado */
const PRESET_THEME_OVERRIDES: Record<string, Record<string, string>> = {
  "forte-gas": {
    "--background": "222 60% 5%",
    "--foreground": "210 40% 98%",
    "--card": "220 55% 9%",
    "--card-foreground": "210 40% 98%",
    "--popover": "220 55% 9%",
    "--popover-foreground": "210 40% 98%",
    "--primary": "210 100% 60%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "220 50% 14%",
    "--secondary-foreground": "210 40% 98%",
    "--muted": "220 45% 12%",
    "--muted-foreground": "215 25% 70%",
    "--accent": "292 84% 61%",
    "--accent-foreground": "0 0% 100%",
    "--border": "220 45% 18%",
    "--input": "220 45% 18%",
    "--ring": "210 100% 60%",
    "--sidebar-background": "224 70% 6%",
    "--sidebar-foreground": "215 25% 82%",
    "--sidebar-primary": "210 100% 60%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": "222 50% 12%",
    "--sidebar-accent-foreground": "210 40% 96%",
    "--sidebar-border": "220 45% 16%",
    "--sidebar-ring": "210 100% 60%",
    "--gradient-primary": "linear-gradient(135deg, hsl(224 76% 28%) 0%, hsl(217 91% 50%) 35%, hsl(190 95% 50%) 70%, hsl(292 84% 61%) 100%)",
    "--gradient-dark": "linear-gradient(135deg, hsl(224 76% 18%) 0%, hsl(217 91% 35%) 50%, hsl(190 90% 40%) 100%)",
    "--shadow-glow": "0 0 32px hsl(210 100% 60% / 0.5)",
  },
  "forte-gas-light": {
    "--background": "210 40% 98%",
    "--foreground": "222 47% 11%",
    "--card": "0 0% 100%",
    "--card-foreground": "222 47% 11%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "222 47% 11%",
    "--primary": "210 100% 55%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "210 40% 94%",
    "--secondary-foreground": "222 47% 11%",
    "--muted": "210 40% 96%",
    "--muted-foreground": "215 16% 47%",
    "--accent": "190 95% 50%",
    "--accent-foreground": "222 47% 11%",
    "--border": "214 32% 88%",
    "--input": "214 32% 88%",
    "--ring": "210 100% 55%",
    "--sidebar-background": "210 50% 99%",
    "--sidebar-foreground": "222 47% 20%",
    "--sidebar-primary": "210 100% 55%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": "210 40% 94%",
    "--sidebar-accent-foreground": "222 47% 11%",
    "--sidebar-border": "214 32% 88%",
    "--sidebar-ring": "210 100% 55%",
    "--gradient-primary": "linear-gradient(135deg, hsl(213 94% 88%) 0%, hsl(213 94% 78%) 35%, hsl(199 89% 60%) 70%, hsl(190 95% 50%) 100%)",
    "--gradient-dark": "linear-gradient(135deg, hsl(210 100% 55%) 0%, hsl(190 95% 50%) 100%)",
    "--gradient-card": "linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(210 50% 99%) 100%)",
    "--gradient-hero": "linear-gradient(135deg, hsl(213 94% 95%) 0%, hsl(199 89% 90%) 50%, hsl(190 95% 88%) 100%)",
    "--shadow-glow": "0 0 30px hsl(210 100% 60% / 0.35)",
  },
};

/** CSS extra escopado por preset (cards modernos com brilho) */
const PRESET_EXTRA_CSS: Record<string, string> = {
  "forte-gas-light": `
    html[data-theme-preset="forte-gas-light"] .bg-card {
      background-image: linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(210 50% 99.5%) 100%);
      box-shadow:
        0 1px 2px 0 hsl(210 40% 50% / 0.04),
        0 8px 24px -8px hsl(210 100% 55% / 0.12),
        0 0 0 1px hsl(210 60% 92% / 0.6);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    html[data-theme-preset="forte-gas-light"] .bg-card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, hsl(210 100% 55%) 0%, hsl(190 95% 50%) 50%, hsl(199 89% 60%) 100%);
      opacity: 0.7;
      pointer-events: none;
      z-index: 1;
    }
    html[data-theme-preset="forte-gas-light"] .bg-card:hover {
      box-shadow:
        0 2px 4px 0 hsl(210 40% 50% / 0.06),
        0 16px 40px -12px hsl(210 100% 55% / 0.25),
        0 0 0 1px hsl(210 80% 85% / 0.8);
      transform: translateY(-2px);
    }
    html[data-theme-preset="forte-gas-light"] body {
      background-image:
        radial-gradient(ellipse 80% 50% at 50% -20%, hsl(199 89% 90% / 0.5), transparent),
        radial-gradient(ellipse 60% 50% at 100% 100%, hsl(190 95% 88% / 0.3), transparent);
      background-attachment: fixed;
    }
  `,
};

/** Variáveis que precisam ser limpas ao trocar de preset especial para um normal */
const OVERRIDABLE_VARS = Array.from(
  new Set(Object.values(PRESET_THEME_OVERRIDES).flatMap((o) => Object.keys(o)))
);

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
  corPrimaria: "187 65% 38%",
  nomeEmpresa: "Gás Fácil",
  logoUrl: null,
  comprovante: {
    mostrarLogo: true,
    mostrarEndereco: true,
    mostrarTelefone: true,
    rodape: "Obrigado pela preferência! ♻️ Recicle seu botijão.",
  },
};

function applyTheme(darkMode: boolean, corPrimaria: string, presetId?: string) {
  const root = document.documentElement;
  if (darkMode) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Limpa overrides anteriores
  OVERRIDABLE_VARS.forEach((v) => root.style.removeProperty(v));

  // Aplica overrides do preset especial (se houver)
  const overrides = presetId ? PRESET_THEME_OVERRIDES[presetId] : undefined;
  if (overrides) {
    Object.entries(overrides).forEach(([k, v]) => root.style.setProperty(k, v));
    return;
  }

  // Caso padrão: só ajusta a cor primária
  root.style.setProperty("--primary", corPrimaria);
  root.style.setProperty("--sidebar-primary", corPrimaria);
  root.style.setProperty("--ring", corPrimaria);
  root.style.setProperty("--sidebar-ring", corPrimaria);
}

export default function PersonalizacaoVisual() {
  const { unidadeAtual } = useUnidade();
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
    const matchedPreset = THEME_PRESETS.find(
      (p) => p.cor === config.corPrimaria && p.dark === config.darkMode && PRESET_THEME_OVERRIDES[p.id]
    );
    applyTheme(config.darkMode, config.corPrimaria, matchedPreset?.id);
  }, [config.darkMode, config.corPrimaria]);

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
          darkMode: data.dark_mode ?? false,
          corPrimaria: data.cor_primaria ?? DEFAULT_CONFIG.corPrimaria,
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
            dark_mode: config.darkMode,
            cor_primaria: config.corPrimaria,
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
                <CardTitle>Tema e Cores</CardTitle>
              </div>
              <CardDescription>
                Escolha o tema e personalize as cores do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {config.darkMode ? (
                    <Moon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Sun className="h-5 w-5 text-foreground/60" />
                  )}
                  <div>
                    <p className="font-medium">Modo Escuro</p>
                    <p className="text-sm text-muted-foreground">
                      {config.darkMode ? "Tema escuro ativado" : "Tema claro ativado"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.darkMode}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, darkMode: v }))}
                />
              </div>
              <Separator />
              {/* Theme Presets */}
              <div className="space-y-3">
                <Label>Temas Prontos</Label>
                <div className="grid grid-cols-2 gap-3">
                  {THEME_PRESETS.map((preset) => {
                    const isActive = config.corPrimaria === preset.cor && config.darkMode === preset.dark;
                    return (
                      <button
                        key={preset.id}
                        className={cn(
                          "rounded-lg border-2 p-3 text-left transition-all hover:shadow-md",
                          isActive
                            ? "border-foreground shadow-md"
                            : "border-border hover:border-foreground/20"
                        )}
                        onClick={() => setConfig((p) => ({ ...p, corPrimaria: preset.cor, darkMode: preset.dark }))}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-5 w-5 rounded-full shrink-0 border"
                            style={{ background: (preset as any).gradient ?? preset.hex }}
                          />
                          <span className="text-sm font-semibold">{preset.label}</span>
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
                <Label>Cor Primária</Label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_OPTIONS.map((opt) => {
                    const isSelected = config.corPrimaria === opt.hsl;
                    return (
                      <button
                        key={opt.label}
                        className="flex flex-col items-center gap-1 group"
                        title={opt.label}
                        onClick={() => setConfig((p) => ({ ...p, corPrimaria: opt.hsl }))}
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
                  As cores são aplicadas imediatamente em toda a interface.
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
