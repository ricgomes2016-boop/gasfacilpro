import logoMark from "@/assets/gasfacil-logo-mark.png";
import logoFull from "@/assets/logo.png";

export type BrandThemeId = "gasfacil" | "gasmais" | "signature" | "executive" | "saas" | "pastel-dashboard" | "classic";

export type BrandLogoVariant = "markText" | "full" | "compact";

export interface BrandThemePreset {
  id: BrandThemeId;
  name: string;
  description: string;
  className: string;
  logoVariant: BrandLogoVariant;
  logoMark: string;
  logoFull: string;
  fontLabel: string;
}

export const BRAND_THEME_STORAGE_KEY = "brandTheme";

export const brandThemes: BrandThemePreset[] = [
  {
    id: "gasfacil",
    name: "Gás Fácil Pro",
    description: "Paleta oficial azul e laranja com navegação vibrante.",
    className: "brand-theme-gasfacil",
    logoVariant: "markText",
    logoMark,
    logoFull,
    fontLabel: "Plus Jakarta Sans",
  },
  {
    id: "saas",
    name: "SaaS Moderno",
    description: "Dashboard limpo com teal, roxo e laranja em padrão profissional.",
    className: "brand-theme-saas",
    logoVariant: "markText",
    logoMark,
    logoFull,
    fontLabel: "Plus Jakarta Sans",
  },
  {
    id: "pastel-dashboard",
    name: "Dashboard Pastel",
    description: "Visual inspirado no Weihu: claro, roxo e cards em tons pastel.",
    className: "brand-theme-pastel-dashboard",
    logoVariant: "markText",
    logoMark,
    logoFull,
    fontLabel: "Plus Jakarta Sans",
  },
  {
    id: "signature",
    name: "Assinatura completa",
    description: "Usa a versão horizontal da marca no menu aberto.",
    className: "brand-theme-signature",
    logoVariant: "full",
    logoMark,
    logoFull,
    fontLabel: "Outfit",
  },
  {
    id: "gasmais",
    name: "GásMais",
    description: "Laranja dominante, azul profundo e visual fintech.",
    className: "brand-theme-gasmais theme-gasmais",
    logoVariant: "markText",
    logoMark,
    logoFull,
    fontLabel: "Manrope",
  },
  {
    id: "executive",
    name: "Executivo",
    description: "Contraste sóbrio para uso administrativo e relatórios.",
    className: "brand-theme-executive",
    logoVariant: "compact",
    logoMark,
    logoFull,
    fontLabel: "IBM Plex Sans",
  },
];

export const defaultBrandTheme = brandThemes[0];

export function getBrandTheme(id?: string | null) {
  return brandThemes.find((theme) => theme.id === id) || defaultBrandTheme;
}