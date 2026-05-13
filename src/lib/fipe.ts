// Consulta FIPE via API pública Parallelum
// https://deividfortuna.github.io/fipe/

const BASE = "https://parallelum.com.br/fipe/api/v1";

export type FipeTipo = "carros" | "motos" | "caminhoes";

export function mapTipoToFipe(tipo: string | null | undefined): FipeTipo | null {
  const t = (tipo || "").toLowerCase();
  if (t === "moto") return "motos";
  if (t === "caminhao" || t === "caminhão") return "caminhoes";
  if (t === "carro" || t === "utilitario" || t === "utilitário" || t === "van") return "carros";
  return null;
}

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bestMatch<T extends { nome: string; codigo: string | number }>(items: T[], target: string): T | null {
  if (!items?.length || !target) return null;
  const t = norm(target);
  // exato
  let hit = items.find(i => norm(i.nome) === t);
  if (hit) return hit;
  // contém todas as palavras do target
  const words = t.split(" ").filter(w => w.length >= 2);
  hit = items.find(i => {
    const n = norm(i.nome);
    return words.every(w => n.includes(w));
  });
  if (hit) return hit;
  // contém pelo menos a primeira palavra significativa
  hit = items.find(i => norm(i.nome).includes(words[0] || t));
  return hit || null;
}

function parseValor(valor: string): number {
  // "R$ 25.000,00" -> 25000
  return parseFloat(
    (valor || "")
      .replace(/[R$\s.]/g, "")
      .replace(",", ".")
  ) || 0;
}

export interface FipeQuery {
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
}

export interface FipeResult {
  valor: number;
  marca: string;
  modelo: string;
  ano: string;
  combustivel?: string;
}

export async function consultarFipe(q: FipeQuery): Promise<FipeResult | null> {
  const tipo = mapTipoToFipe(q.tipo);
  if (!tipo || !q.marca || !q.modelo) return null;

  const marcas = await fetch(`${BASE}/${tipo}/marcas`).then(r => r.json());
  const marca = bestMatch(marcas, q.marca);
  if (!marca) return null;

  const modelosResp = await fetch(`${BASE}/${tipo}/marcas/${marca.codigo}/modelos`).then(r => r.json());
  const modelo = bestMatch(modelosResp.modelos || [], q.modelo);
  if (!modelo) return null;

  const anos = await fetch(`${BASE}/${tipo}/marcas/${marca.codigo}/modelos/${modelo.codigo}/anos`).then(r => r.json());
  let anoEscolhido = anos[0];
  if (q.ano) {
    const match = (anos as any[]).find(a => String(a.nome).startsWith(String(q.ano)));
    if (match) anoEscolhido = match;
  }
  if (!anoEscolhido) return null;

  const valor = await fetch(`${BASE}/${tipo}/marcas/${marca.codigo}/modelos/${modelo.codigo}/anos/${anoEscolhido.codigo}`).then(r => r.json());
  return {
    valor: parseValor(valor.Valor),
    marca: valor.Marca,
    modelo: valor.Modelo,
    ano: valor.AnoModelo?.toString() || anoEscolhido.nome,
    combustivel: valor.Combustivel,
  };
}
