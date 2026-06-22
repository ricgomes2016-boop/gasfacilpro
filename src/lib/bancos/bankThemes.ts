// Temas visuais por banco (estilo "app do banco")
// Usado em Contas Bancárias para identificar visualmente cada banco.

export interface BankTheme {
  /** Nome canônico exibido no header */
  nome: string;
  /** Cor principal — usada em gradiente/header */
  primary: string;
  /** Cor secundária — usada no fim do gradiente */
  secondary: string;
  /** Cor do texto sobre o header (claro/escuro) */
  textColor: string;
  /** Iniciais ou símbolo exibido no avatar do banco */
  initials: string;
}

const THEMES: Record<string, BankTheme> = {
  pagbank:   { nome: "PagBank",          primary: "#0F8048", secondary: "#00C853", textColor: "#FFFFFF", initials: "PB" },
  pagseguro: { nome: "PagSeguro",        primary: "#0F8048", secondary: "#00C853", textColor: "#FFFFFF", initials: "PS" },
  itau:      { nome: "Itaú",             primary: "#EC7000", secondary: "#003C71", textColor: "#FFFFFF", initials: "IT" },
  bradesco:  { nome: "Bradesco",         primary: "#CC092F", secondary: "#7A001F", textColor: "#FFFFFF", initials: "BR" },
  bb:        { nome: "Banco do Brasil",  primary: "#FAE128", secondary: "#003D7A", textColor: "#003D7A", initials: "BB" },
  santander: { nome: "Santander",        primary: "#EC0000", secondary: "#9E0000", textColor: "#FFFFFF", initials: "SA" },
  caixa:     { nome: "Caixa",            primary: "#0070AF", secondary: "#F39200", textColor: "#FFFFFF", initials: "CX" },
  nubank:    { nome: "Nubank",           primary: "#820AD1", secondary: "#4A0080", textColor: "#FFFFFF", initials: "NU" },
  inter:     { nome: "Inter",            primary: "#FF7A00", secondary: "#CC5500", textColor: "#FFFFFF", initials: "IN" },
  sicoob:    { nome: "Sicoob",           primary: "#003641", secondary: "#7DB61C", textColor: "#FFFFFF", initials: "SC" },
  sicredi:   { nome: "Sicredi",          primary: "#3FA535", secondary: "#1B5E20", textColor: "#FFFFFF", initials: "SR" },
  c6:        { nome: "C6 Bank",          primary: "#1A1A1A", secondary: "#3A3A3A", textColor: "#FFFFFF", initials: "C6" },
  btg:       { nome: "BTG Pactual",      primary: "#1A2E5B", secondary: "#0A1A3D", textColor: "#FFFFFF", initials: "BTG" },
  mercadopago: { nome: "Mercado Pago",   primary: "#00B1EA", secondary: "#005F8F", textColor: "#FFFFFF", initials: "MP" },
  stone:     { nome: "Stone",            primary: "#00A868", secondary: "#007A4D", textColor: "#FFFFFF", initials: "ST" },
  safra:     { nome: "Safra",            primary: "#0033A0", secondary: "#001F66", textColor: "#FFFFFF", initials: "SF" },
};

const FALLBACK: BankTheme = {
  nome: "Banco",
  primary: "#1E3A8A",
  secondary: "#0F172A",
  textColor: "#FFFFFF",
  initials: "BK",
};

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function getBankTheme(banco: string): BankTheme {
  const key = normalize(banco);
  for (const k of Object.keys(THEMES)) {
    if (key.includes(k)) return THEMES[k];
  }
  // fallback com iniciais geradas a partir do nome real
  const initials = (banco || "Banco")
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || FALLBACK.initials;
  return { ...FALLBACK, nome: banco || FALLBACK.nome, initials };
}

export function bankGradient(theme: BankTheme): string {
  return `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`;
}
