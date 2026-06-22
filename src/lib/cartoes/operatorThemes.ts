// Temas visuais por operadora de cartão (estilo "portal da operadora")
// Espelha a API de src/lib/bancos/bankThemes.ts.

export interface OperatorTheme {
  nome: string;
  primary: string;
  secondary: string;
  textColor: string;
  initials: string;
}

const THEMES: Record<string, OperatorTheme> = {
  pagbank:      { nome: "PagBank",       primary: "#0F8048", secondary: "#00C853", textColor: "#FFFFFF", initials: "PB" },
  pagseguro:    { nome: "PagSeguro",     primary: "#0F8048", secondary: "#00C853", textColor: "#FFFFFF", initials: "PS" },
  stone:        { nome: "Stone",         primary: "#00A868", secondary: "#007A4D", textColor: "#FFFFFF", initials: "ST" },
  cielo:        { nome: "Cielo",         primary: "#005FAA", secondary: "#00A6E3", textColor: "#FFFFFF", initials: "CL" },
  rede:         { nome: "Rede",          primary: "#CC092F", secondary: "#7A001F", textColor: "#FFFFFF", initials: "RD" },
  getnet:       { nome: "GetNet",        primary: "#EC0000", secondary: "#9E0000", textColor: "#FFFFFF", initials: "GN" },
  safrapay:     { nome: "SafraPay",      primary: "#0033A0", secondary: "#001F66", textColor: "#FFFFFF", initials: "SP" },
  mercadopago:  { nome: "Mercado Pago",  primary: "#00B1EA", secondary: "#005F8F", textColor: "#FFFFFF", initials: "MP" },
  sumup:        { nome: "SumUp",         primary: "#3E70F1", secondary: "#1B3FA0", textColor: "#FFFFFF", initials: "SU" },
  ton:          { nome: "Ton",           primary: "#0F8048", secondary: "#00C853", textColor: "#FFFFFF", initials: "TN" },
  infinitepay:  { nome: "InfinitePay",   primary: "#7B61FF", secondary: "#3B1FA8", textColor: "#FFFFFF", initials: "IP" },
  bin:          { nome: "Bin",           primary: "#FFB300", secondary: "#B07700", textColor: "#1A1A1A", initials: "BN" },
};

const FALLBACK: OperatorTheme = {
  nome: "Operadora",
  primary: "#1E3A8A",
  secondary: "#0F172A",
  textColor: "#FFFFFF",
  initials: "OP",
};

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function getOperatorTheme(nome: string): OperatorTheme {
  const key = normalize(nome);
  for (const k of Object.keys(THEMES)) {
    if (key.includes(k)) return THEMES[k];
  }
  const initials = (nome || "OP")
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || FALLBACK.initials;
  return { ...FALLBACK, nome: nome || FALLBACK.nome, initials };
}

export function operatorGradient(theme: OperatorTheme): string {
  return `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`;
}
