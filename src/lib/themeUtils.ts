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
    description: "Azul confiança com cards limpos e sidebar gradiente",
    cor: "210 80% 50%",
    hex: "#1a6fcc",
    dark: false,
    gradient: "linear-gradient(135deg, #1a6fcc 0%, #143d80 100%)",
  },
  {
    id: "eco-verde",
    label: "Eco Verde",
    description: "Verde sustentável, cards branco com acento esmeralda",
    cor: "152 69% 40%",
    hex: "#1f9e5c",
    dark: false,
    gradient: "linear-gradient(135deg, #1f9e5c 0%, #0f6b3f 100%)",
  },
  {
    id: "premium-dark",
    label: "Premium Dark",
    description: "Escuro sofisticado com destaque roxo e cards grafite",
    cor: "260 60% 50%",
    hex: "#6b3fa0",
    dark: true,
    gradient: "linear-gradient(135deg, #1a1a26 0%, #6b3fa0 100%)",
  },
  {
    id: "energia-laranja",
    label: "Energia",
    description: "Laranja vibrante, dinamismo e cards branco neutro",
    cor: "30 80% 50%",
    hex: "#cc6b1a",
    dark: false,
    gradient: "linear-gradient(135deg, #cc6b1a 0%, #a3441a 100%)",
  },
  {
    id: "saas-moderno",
    label: "SaaS Moderno",
    description: "Teal + roxo + laranja, cards limpos e sidebar gradiente",
    cor: "174 61% 47%",
    hex: "#2EC4B6",
    dark: false,
    gradient: "linear-gradient(135deg, #2EC4B6 0%, #6C63FF 70%, #FF9F43 100%)",
    brandThemeId: "saas",
  },
  {
    id: "dashboard-pastel",
    label: "Dashboard Pastel",
    description: "Inspirado no Weihu: roxo, gelo e cards em tons pastel",
    cor: "250 100% 65%",
    hex: "#6D4AFF",
    dark: false,
    gradient: "linear-gradient(135deg, #6D4AFF 0%, #DDEBFF 28%, #FFD9F1 56%, #FFE5C4 78%, #CFF6E9 100%)",
    brandThemeId: "pastel-dashboard",
  },
  {
    id: "forte-gas",
    label: "Forte Gás · Fluid Energy",
    description: "Site institucional: azul profundo, ciano elétrico e fúcsia",
    cor: "217 91% 60%",
    hex: "#3b82f6",
    dark: true,
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 35%, #06b6d4 70%, #d946ef 100%)",
  },
  {
    id: "forte-gas-light",
    label: "Forte Gás · Fluid Light",
    description: "Versão clara: brilho azul/ciano, cards com glow suave",
    cor: "210 100% 55%",
    hex: "#1a8cff",
    dark: false,
    gradient: "linear-gradient(135deg, #dbeafe 0%, #93c5fd 35%, #38bdf8 70%, #06b6d4 100%)",
  },
  {
    id: "aurora-glass",
    label: "Aurora Glass",
    description: "Premium claro: violeta + ciano, glassmorphism e glow violeta",
    cor: "262 83% 58%",
    hex: "#6d28d9",
    dark: false,
    gradient: "linear-gradient(135deg, #6d28d9 0%, #8b5cf6 40%, #38bdf8 100%)",
  },
  {
    id: "onyx-prestige",
    label: "Onyx Prestige",
    description: "Premium escuro: preto azulado, dourado champanhe e filete dourado",
    cor: "42 88% 60%",
    hex: "#d4a84c",
    dark: true,
    gradient: "linear-gradient(135deg, #050810 0%, #14182a 60%, #d4a84c 100%)",
  },
];

/**
 * IMPORTANTE: Cada preset DEVE definir o conjunto completo de tokens abaixo
 * para garantir que o tema "se aplique de verdade" em cards, popovers,
 * borders, status e — principalmente — no menu lateral.
 *
 * Tokens obrigatórios por preset:
 *   Superfície : --background, --foreground, --card(+fg), --popover(+fg),
 *                --muted(+fg), --border, --input
 *   Acento     : --primary(+fg), --secondary(+fg), --accent(+fg), --ring
 *   Menu       : --sidebar-background, --sidebar-gradient-from/to,
 *                --sidebar-foreground, --sidebar-primary(+fg),
 *                --sidebar-accent(+fg), --sidebar-border, --sidebar-ring
 *   Efeitos    : --gradient-primary, --shadow-glow
 *
 * Componentes públicos (ForteGas, JapaGas, CentralGasCP, App Cliente,
 * Entregador, Parceiro, Contador, Auth) NÃO vivem dentro do MainLayout
 * (.system-surface) — preservam branding próprio mesmo após troca de tema.
 */
export const PRESET_THEME_OVERRIDES: Record<string, Record<string, string>> = {
  "gas-classico": {
    "--background": "210 40% 98%",
    "--foreground": "222 47% 11%",
    "--card": "0 0% 100%",
    "--card-foreground": "222 47% 11%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "222 47% 11%",
    "--primary": "210 80% 50%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "210 40% 94%",
    "--secondary-foreground": "222 47% 11%",
    "--muted": "210 40% 96%",
    "--muted-foreground": "215 16% 47%",
    "--accent": "210 80% 50%",
    "--accent-foreground": "0 0% 100%",
    "--border": "214 32% 91%",
    "--input": "214 32% 91%",
    "--ring": "210 80% 50%",
    "--sidebar-background": "210 80% 50%",
    "--sidebar-gradient-from": "210 80% 50%",
    "--sidebar-gradient-to": "218 80% 32%",
    "--sidebar-foreground": "0 0% 100%",
    "--sidebar-primary": "0 0% 100%",
    "--sidebar-primary-foreground": "210 80% 20%",
    "--sidebar-accent": "0 0% 100%",
    "--sidebar-accent-foreground": "210 80% 24%",
    "--sidebar-border": "210 50% 70%",
    "--sidebar-ring": "0 0% 100%",
    "--gradient-primary": "linear-gradient(135deg, hsl(210 80% 50%) 0%, hsl(218 80% 32%) 100%)",
    "--shadow-glow": "0 0 24px hsl(210 80% 50% / 0.3)",
  },
  "eco-verde": {
    "--background": "150 25% 97%",
    "--foreground": "160 30% 12%",
    "--card": "0 0% 100%",
    "--card-foreground": "160 30% 12%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "160 30% 12%",
    "--primary": "152 69% 40%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "150 25% 94%",
    "--secondary-foreground": "160 30% 18%",
    "--muted": "150 22% 95%",
    "--muted-foreground": "155 12% 45%",
    "--accent": "168 76% 42%",
    "--accent-foreground": "0 0% 100%",
    "--border": "150 22% 88%",
    "--input": "150 22% 88%",
    "--ring": "152 69% 40%",
    "--sidebar-background": "152 69% 40%",
    "--sidebar-gradient-from": "152 69% 40%",
    "--sidebar-gradient-to": "160 60% 26%",
    "--sidebar-foreground": "0 0% 100%",
    "--sidebar-primary": "0 0% 100%",
    "--sidebar-primary-foreground": "152 69% 20%",
    "--sidebar-accent": "0 0% 100%",
    "--sidebar-accent-foreground": "152 69% 24%",
    "--sidebar-border": "152 40% 65%",
    "--sidebar-ring": "0 0% 100%",
    "--gradient-primary": "linear-gradient(135deg, hsl(152 69% 40%) 0%, hsl(160 60% 26%) 100%)",
    "--shadow-glow": "0 0 24px hsl(152 69% 40% / 0.3)",
  },
  "premium-dark": {
    "--background": "240 12% 6%",
    "--foreground": "260 15% 96%",
    "--card": "240 12% 11%",
    "--card-foreground": "260 15% 96%",
    "--popover": "240 12% 11%",
    "--popover-foreground": "260 15% 96%",
    "--primary": "260 80% 65%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "240 14% 16%",
    "--secondary-foreground": "260 15% 96%",
    "--muted": "240 14% 14%",
    "--muted-foreground": "260 10% 70%",
    "--accent": "280 80% 65%",
    "--accent-foreground": "0 0% 100%",
    "--border": "260 25% 22%",
    "--input": "260 25% 22%",
    "--ring": "260 80% 65%",
    "--sidebar-background": "240 12% 8%",
    "--sidebar-gradient-from": "240 10% 8%",
    "--sidebar-gradient-to": "260 60% 24%",
    "--sidebar-foreground": "260 15% 92%",
    "--sidebar-primary": "260 80% 70%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": "260 60% 30%",
    "--sidebar-accent-foreground": "260 15% 98%",
    "--sidebar-border": "260 25% 22%",
    "--sidebar-ring": "260 80% 65%",
    "--gradient-primary": "linear-gradient(135deg, hsl(240 12% 10%) 0%, hsl(260 60% 36%) 100%)",
    "--shadow-glow": "0 0 28px hsl(260 80% 65% / 0.4)",
  },
  "energia-laranja": {
    "--background": "30 35% 98%",
    "--foreground": "20 30% 12%",
    "--card": "0 0% 100%",
    "--card-foreground": "20 30% 12%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "20 30% 12%",
    "--primary": "30 80% 50%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "30 35% 94%",
    "--secondary-foreground": "20 30% 18%",
    "--muted": "30 30% 96%",
    "--muted-foreground": "25 12% 45%",
    "--accent": "16 85% 50%",
    "--accent-foreground": "0 0% 100%",
    "--border": "30 35% 88%",
    "--input": "30 35% 88%",
    "--ring": "30 80% 50%",
    "--sidebar-background": "30 80% 50%",
    "--sidebar-gradient-from": "30 80% 50%",
    "--sidebar-gradient-to": "16 85% 42%",
    "--sidebar-foreground": "0 0% 100%",
    "--sidebar-primary": "0 0% 100%",
    "--sidebar-primary-foreground": "20 80% 22%",
    "--sidebar-accent": "0 0% 100%",
    "--sidebar-accent-foreground": "20 80% 28%",
    "--sidebar-border": "30 50% 70%",
    "--sidebar-ring": "0 0% 100%",
    "--gradient-primary": "linear-gradient(135deg, hsl(30 80% 50%) 0%, hsl(16 85% 42%) 100%)",
    "--shadow-glow": "0 0 24px hsl(30 80% 50% / 0.3)",
  },
  "saas-moderno": {
    "--background": "225 24% 97%",
    "--foreground": "222 47% 11%",
    "--card": "0 0% 100%",
    "--card-foreground": "222 47% 11%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "222 47% 11%",
    "--primary": "174 61% 47%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "243 100% 69%",
    "--secondary-foreground": "0 0% 100%",
    "--muted": "225 24% 94%",
    "--muted-foreground": "231 10% 45%",
    "--accent": "31 100% 58%",
    "--accent-foreground": "0 0% 100%",
    "--border": "225 22% 90%",
    "--input": "225 22% 90%",
    "--ring": "174 61% 47%",
    "--sidebar-background": "174 61% 47%",
    "--sidebar-gradient-from": "174 61% 47%",
    "--sidebar-gradient-to": "243 100% 69%",
    "--sidebar-foreground": "0 0% 100%",
    "--sidebar-primary": "0 0% 100%",
    "--sidebar-primary-foreground": "174 80% 22%",
    "--sidebar-accent": "0 0% 100%",
    "--sidebar-accent-foreground": "174 80% 24%",
    "--sidebar-border": "174 30% 70%",
    "--sidebar-ring": "0 0% 100%",
    "--gradient-primary": "linear-gradient(135deg, hsl(174 61% 47%) 0%, hsl(243 100% 69%) 100%)",
    "--shadow-glow": "0 0 24px hsl(174 61% 47% / 0.3)",
  },
  "dashboard-pastel": {
    "--background": "220 11% 96%",
    "--foreground": "240 10% 9%",
    "--card": "0 0% 100%",
    "--card-foreground": "240 10% 9%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "240 10% 9%",
    "--primary": "250 100% 65%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "217 100% 94%",
    "--secondary-foreground": "218 45% 40%",
    "--muted": "225 23% 94%",
    "--muted-foreground": "233 7% 45%",
    "--accent": "27 100% 70%",
    "--accent-foreground": "0 0% 100%",
    "--border": "225 20% 90%",
    "--input": "225 20% 90%",
    "--ring": "250 100% 65%",
    "--sidebar-background": "220 20% 98%",
    "--sidebar-gradient-from": "220 20% 98%",
    "--sidebar-gradient-to": "276 100% 96%",
    "--sidebar-foreground": "235 9% 28%",
    "--sidebar-primary": "250 100% 65%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": "250 100% 96%",
    "--sidebar-accent-foreground": "250 62% 40%",
    "--sidebar-border": "225 20% 88%",
    "--sidebar-ring": "250 100% 65%",
    "--gradient-primary": "linear-gradient(135deg, hsl(250 100% 65%) 0%, hsl(276 100% 80%) 100%)",
    "--shadow-glow": "0 0 24px hsl(250 100% 65% / 0.3)",
  },
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
    "--sidebar-gradient-from": "224 76% 8%",
    "--sidebar-gradient-to": "190 95% 22%",
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
    "--sidebar-gradient-from": "213 94% 88%",
    "--sidebar-gradient-to": "190 95% 60%",
    "--sidebar-foreground": "222 47% 20%",
    "--sidebar-primary": "210 100% 55%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": "0 0% 100%",
    "--sidebar-accent-foreground": "210 100% 30%",
    "--sidebar-border": "214 32% 88%",
    "--sidebar-ring": "210 100% 55%",
    "--gradient-primary": "linear-gradient(135deg, hsl(213 94% 88%) 0%, hsl(213 94% 78%) 35%, hsl(199 89% 60%) 70%, hsl(190 95% 50%) 100%)",
    "--gradient-dark": "linear-gradient(135deg, hsl(210 100% 55%) 0%, hsl(190 95% 50%) 100%)",
    "--gradient-card": "linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(210 50% 99%) 100%)",
    "--gradient-hero": "linear-gradient(135deg, hsl(213 94% 95%) 0%, hsl(199 89% 90%) 50%, hsl(190 95% 88%) 100%)",
    "--shadow-glow": "0 0 30px hsl(210 100% 60% / 0.35)",
  },
  "aurora-glass": {
    "--background": "260 40% 98%",
    "--foreground": "262 47% 12%",
    "--card": "0 0% 100%",
    "--card-foreground": "262 47% 12%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "262 47% 12%",
    "--primary": "262 83% 58%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "260 40% 94%",
    "--secondary-foreground": "262 47% 18%",
    "--muted": "260 30% 95%",
    "--muted-foreground": "262 12% 45%",
    "--accent": "190 95% 50%",
    "--accent-foreground": "0 0% 100%",
    "--border": "262 30% 90%",
    "--input": "262 30% 90%",
    "--ring": "262 83% 58%",
    "--sidebar-background": "262 83% 58%",
    "--sidebar-gradient-from": "262 83% 58%",
    "--sidebar-gradient-to": "190 95% 50%",
    "--sidebar-foreground": "0 0% 100%",
    "--sidebar-primary": "0 0% 100%",
    "--sidebar-primary-foreground": "262 83% 28%",
    "--sidebar-accent": "0 0% 100%",
    "--sidebar-accent-foreground": "262 83% 32%",
    "--sidebar-border": "262 40% 72%",
    "--sidebar-ring": "0 0% 100%",
    "--gradient-primary": "linear-gradient(135deg, hsl(262 83% 58%) 0%, hsl(218 90% 60%) 50%, hsl(190 95% 50%) 100%)",
    "--shadow-glow": "0 0 32px hsl(262 83% 58% / 0.35)",
  },
  "onyx-prestige": {
    "--background": "222 47% 5%",
    "--foreground": "42 30% 96%",
    "--card": "222 40% 9%",
    "--card-foreground": "42 30% 96%",
    "--popover": "222 40% 9%",
    "--popover-foreground": "42 30% 96%",
    "--primary": "42 88% 60%",
    "--primary-foreground": "222 47% 8%",
    "--secondary": "222 30% 14%",
    "--secondary-foreground": "42 30% 96%",
    "--muted": "222 30% 12%",
    "--muted-foreground": "42 15% 72%",
    "--accent": "36 92% 55%",
    "--accent-foreground": "222 47% 8%",
    "--border": "42 30% 22%",
    "--input": "42 30% 22%",
    "--ring": "42 88% 60%",
    "--sidebar-background": "222 47% 5%",
    "--sidebar-gradient-from": "222 47% 5%",
    "--sidebar-gradient-to": "222 30% 12%",
    "--sidebar-foreground": "42 25% 88%",
    "--sidebar-primary": "42 88% 60%",
    "--sidebar-primary-foreground": "222 47% 8%",
    "--sidebar-accent": "42 60% 18%",
    "--sidebar-accent-foreground": "42 90% 80%",
    "--sidebar-border": "42 40% 22%",
    "--sidebar-ring": "42 88% 60%",
    "--gradient-primary": "linear-gradient(135deg, hsl(222 47% 5%) 0%, hsl(222 30% 12%) 60%, hsl(42 88% 60%) 100%)",
    "--shadow-glow": "0 0 28px hsl(42 88% 60% / 0.35)",
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
  "aurora-glass": `
    html[data-theme-preset="aurora-glass"] .bg-card {
      background-image: linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(262 60% 99%) 100%);
      box-shadow:
        0 1px 2px 0 hsl(262 30% 40% / 0.04),
        0 10px 28px -10px hsl(262 83% 58% / 0.16),
        0 0 0 1px hsl(262 40% 92% / 0.6);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    html[data-theme-preset="aurora-glass"] .bg-card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, hsl(262 83% 58%) 0%, hsl(218 90% 60%) 50%, hsl(190 95% 50%) 100%);
      opacity: 0.85;
      pointer-events: none;
      z-index: 1;
    }
    html[data-theme-preset="aurora-glass"] .bg-card:hover {
      box-shadow:
        0 2px 6px 0 hsl(262 30% 40% / 0.06),
        0 18px 44px -14px hsl(262 83% 58% / 0.28),
        0 0 0 1px hsl(262 60% 86% / 0.8);
      transform: translateY(-2px);
    }
    html[data-theme-preset="aurora-glass"] body {
      background-image:
        radial-gradient(ellipse 80% 50% at 50% -20%, hsl(262 83% 90% / 0.45), transparent),
        radial-gradient(ellipse 60% 50% at 100% 100%, hsl(190 95% 88% / 0.35), transparent);
      background-attachment: fixed;
    }
  `,
  "onyx-prestige": `
    html[data-theme-preset="onyx-prestige"] .bg-card {
      background-image: linear-gradient(135deg, hsl(222 40% 9%) 0%, hsl(222 35% 11%) 100%);
      box-shadow:
        0 1px 2px 0 hsl(0 0% 0% / 0.3),
        0 12px 30px -12px hsl(0 0% 0% / 0.5),
        0 0 0 1px hsl(42 60% 50% / 0.12);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    html[data-theme-preset="onyx-prestige"] .bg-card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, hsl(42 88% 60%) 50%, transparent 100%);
      opacity: 0.7;
      pointer-events: none;
      z-index: 1;
    }
    html[data-theme-preset="onyx-prestige"] .bg-card:hover {
      box-shadow:
        0 2px 4px 0 hsl(0 0% 0% / 0.4),
        0 20px 50px -16px hsl(0 0% 0% / 0.6),
        0 0 0 1px hsl(42 88% 60% / 0.32);
      transform: translateY(-2px);
    }
    html[data-theme-preset="onyx-prestige"] body {
      background-image:
        radial-gradient(ellipse 70% 40% at 50% -20%, hsl(42 88% 60% / 0.10), transparent),
        radial-gradient(ellipse 60% 50% at 100% 100%, hsl(42 60% 40% / 0.08), transparent);
      background-attachment: fixed;
    }
  `,
};


export const OVERRIDABLE_VARS = Array.from(
  new Set(Object.values(PRESET_THEME_OVERRIDES).flatMap((o) => Object.keys(o)))
);

const PRESET_STYLE_ID = "preset-extra-css";
const PRESET_VARS_STYLE_ID = "preset-vars-override";

// Classes brand-theme-* que vivem em MainLayout/Sidebar e que, por herança
// local, sobrescrevem os tokens do preset escolhido. Precisamos forçar as
// variáveis também DENTRO dessas classes para o tema valer no menu/cards.
const BRAND_THEME_SELECTORS = [
  ".brand-theme-gasfacil",
  ".brand-theme-saas",
  ".brand-theme-pastel-dashboard",
  ".brand-theme-signature",
  ".brand-theme-gasmais",
  ".brand-theme-executive",
  ".brand-theme-classic",
];

function buildPresetVarsCss(presetId: string, overrides: Record<string, string>): string {
  const decls = Object.entries(overrides)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  const rootBlock = `html[data-theme-preset="${presetId}"],
html[data-theme-preset="${presetId}"] body {\n${decls}\n}`;
  const scopedSelectors = BRAND_THEME_SELECTORS.map(
    (sel) => `html[data-theme-preset="${presetId}"] ${sel}`
  ).join(",\n");
  const scopedBlock = `${scopedSelectors} {\n${decls}\n}`;
  return `${rootBlock}\n${scopedBlock}`;
}

export function applyTheme(darkMode: boolean, corPrimaria: string, presetId?: string) {
  const root = document.documentElement;
  const body = document.body;
  if (darkMode) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Limpa overrides inline anteriores (root + body)
  OVERRIDABLE_VARS.forEach((v) => {
    root.style.removeProperty(v);
    body?.style.removeProperty(v);
  });

  // Atributo do preset (para CSS escopado)
  if (presetId) {
    root.setAttribute("data-theme-preset", presetId);
  } else {
    root.removeAttribute("data-theme-preset");
  }

  // CSS extra (efeitos visuais avançados por preset)
  let extraStyleEl = document.getElementById(PRESET_STYLE_ID) as HTMLStyleElement | null;
  const extraCss = presetId ? PRESET_EXTRA_CSS[presetId] : undefined;
  if (extraCss) {
    if (!extraStyleEl) {
      extraStyleEl = document.createElement("style");
      extraStyleEl.id = PRESET_STYLE_ID;
      document.head.appendChild(extraStyleEl);
    }
    extraStyleEl.textContent = extraCss;
  } else if (extraStyleEl) {
    extraStyleEl.textContent = "";
  }

  // Stylesheet que força as variáveis do preset DENTRO das classes
  // .brand-theme-* (Sidebar/MainLayout). Sem isso, o sidebar herda os tokens
  // da própria classe brand-theme aplicada nele e o preset não aparece.
  let varsStyleEl = document.getElementById(PRESET_VARS_STYLE_ID) as HTMLStyleElement | null;
  const overrides = presetId ? PRESET_THEME_OVERRIDES[presetId] : undefined;

  if (presetId && overrides) {
    if (!varsStyleEl) {
      varsStyleEl = document.createElement("style");
      varsStyleEl.id = PRESET_VARS_STYLE_ID;
      document.head.appendChild(varsStyleEl);
    }
    varsStyleEl.textContent = buildPresetVarsCss(presetId, overrides);

    // Mantém inline em root+body por redundância
    Object.entries(overrides).forEach(([k, v]) => {
      root.style.setProperty(k, v);
      body?.style.setProperty(k, v);
    });
    return;
  }

  // Sem preset: limpa override e aplica apenas a cor primária
  if (varsStyleEl) varsStyleEl.textContent = "";

  const primaryVars: Record<string, string> = {
    "--primary": corPrimaria,
    "--sidebar-primary": corPrimaria,
    "--ring": corPrimaria,
    "--sidebar-ring": corPrimaria,
  };
  Object.entries(primaryVars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
    body?.style.setProperty(k, v);
  });
}
