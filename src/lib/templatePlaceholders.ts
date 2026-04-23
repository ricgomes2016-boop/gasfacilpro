// Utilitários para detectar e substituir placeholders {{var}} em templates de marketing.

export const PLACEHOLDER_LABELS: Record<string, string> = {
  empresa: "Nome da empresa",
  produto: "Produto",
  preco: "Preço (R$)",
  telefone: "Telefone",
  cupom: "Cupom de desconto",
  cliente: "Nome do cliente",
  data: "Data",
};

const RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function detectPlaceholders(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    let m: RegExpExecArray | null;
    RE.lastIndex = 0;
    while ((m = RE.exec(t))) found.add(m[1]);
  }
  return Array.from(found);
}

export function applyPlaceholders(text: string | null | undefined, values: Record<string, string>): string {
  if (!text) return "";
  return text.replace(RE, (_, key) => values[key] ?? `{{${key}}}`);
}

export function labelFor(key: string): string {
  return PLACEHOLDER_LABELS[key] || key;
}
