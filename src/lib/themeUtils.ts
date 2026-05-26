import { BrandThemeId } from "./brandThemes";

export const COLOR_OPTIONS = [
  { hsl: "187 65% 38%", label: "Teal", hex: "#219ebc" },
  { hsl: "210 80% 50%", label: "Azul", hex: "#1a6fcc" },
  { hsl: "260 60% 50%", label: "Roxo", hex: "#6b3fa0" },
  { hsl: "350 70% 50%", label: "Vermelho", hex: "#cc1a2e" },
  { hsl: "30 80% 50%", label: "Laranja", hex: "#cc6b1a" },
  { hsl: "152 69% 40%", label: "Verde", hex: "#1f9e5c" },
  { hsl: "220 70% 45%", label: "Índigo", hex: "#2246a8" },
  { hsl: "340 82% 52%", label: "Rosa", hex: "#e81e63" },
];

export const THEME_PRESETS = [
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
    id: "saas-moderno",
    label: "SaaS Moderno",
    description: "Teal, roxo e laranja com cards limpos e sidebar em gradiente",
    cor: "174 61% 47%",
    hex: "#2EC4B6",
    dark: false,
    gradient: "linear-gradient(135deg, #2EC4B6 0%, #6C63FF 70%, #FF9F43 100%)",
    brandThemeId: "saas",
  },
  {
    id: "dashboard-pastel",
    label: "Dashboard Pastel",
    description: "Inspirado no modelo Weihu: roxo, gelo e cards em tons pastel",
    cor: "250 100% 65%",
    hex: "#6D4AFF",
    dark: false,
    gradient: "linear-gradient(135deg, #6D4AFF 0%, #DDEBFF 28%, #FFD9F1 56%, #FFE5C4 78%, #CFF6E9 100%)",
    brandThemeId: "pastel-dashboard",
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

export const PRESET_THEME_OVERRIDES: Record<string, Record<string, string>> = {
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

export const PRESET_EXTRA_CSS: Record<string, string> = {
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

export const OVERRIDABLE_VARS = Array.from(
  new Set(Object.values(PRESET_THEME_OVERRIDES).flatMap((o) => Object.keys(o)))
);

const PRESET_STYLE_ID = "preset-extra-css";

export function applyTheme(darkMode: boolean, corPrimaria: string, presetId?: string) {
  const root = document.documentElement;
  if (darkMode) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Limpa overrides anteriores
  OVERRIDABLE_VARS.forEach((v) => root.style.removeProperty(v));

  // Atributo do preset (para CSS escopado)
  if (presetId) {
    root.setAttribute("data-theme-preset", presetId);
  } else {
    root.removeAttribute("data-theme-preset");
  }

  // Injeta/remove CSS extra do preset
  let styleEl = document.getElementById(PRESET_STYLE_ID) as HTMLStyleElement | null;
  const extraCss = presetId ? PRESET_EXTRA_CSS[presetId] : undefined;
  if (extraCss) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = PRESET_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = extraCss;
  } else if (styleEl) {
    styleEl.textContent = "";
  }

  // Aplica overrides do preset especial (se houver)
  const overrides = presetId ? PRESET_THEME_OVERRIDES[presetId] : undefined;
  if (overrides) {
    Object.entries(overrides).forEach(([k, v]) => root.style.setProperty(k, v));
    return;
  }

  // Caso padrao: so ajusta a cor primaria
  root.style.setProperty("--primary", corPrimaria);
  root.style.setProperty("--sidebar-primary", corPrimaria);
  root.style.setProperty("--ring", corPrimaria);
  root.style.setProperty("--sidebar-ring", corPrimaria);
}
