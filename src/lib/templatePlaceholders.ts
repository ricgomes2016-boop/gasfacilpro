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

/**
 * Sugere data e hora de publicação ideais conforme a plataforma.
 * Retorna {data: 'YYYY-MM-DD', hora: 'HH:mm'} para amanhã.
 */
export function suggestSchedule(plataforma: string): { data: string; hora: string } {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const dd = String(tomorrow.getDate()).padStart(2, "0");
  const data = `${yyyy}-${mm}-${dd}`;

  const horaPorPlataforma: Record<string, string> = {
    instagram: "19:00",
    reels: "20:00",
    facebook: "12:00",
    whatsapp: "09:00",
    tiktok: "21:00",
    youtube: "18:00",
  };
  return { data, hora: horaPorPlataforma[plataforma] || "10:00" };
}
