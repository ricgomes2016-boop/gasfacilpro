// Converte código FIFA (3 letras) em emoji de bandeira do país.
const FIFA_TO_ISO2: Record<string, string> = {
  // Américas
  BRA: "BR", ARG: "AR", URU: "UY", MEX: "MX", USA: "US", CAN: "CA",
  COL: "CO", CHI: "CL", PER: "PE", ECU: "EC", PAR: "PY", VEN: "VE",
  BOL: "BO", CRC: "CR", PAN: "PA", HON: "HN", JAM: "JM", HAI: "HT",
  CUW: "CW",
  // Europa
  FRA: "FR", ENG: "GB-ENG", GER: "DE", ESP: "ES", POR: "PT", NED: "NL",
  ITA: "IT", BEL: "BE", CRO: "HR", SUI: "CH", DEN: "DK", POL: "PL",
  SRB: "RS", AUT: "AT", UKR: "UA", WAL: "GB-WLS", SCO: "GB-SCT",
  IRL: "IE", SWE: "SE", NOR: "NO", BIH: "BA", TUR: "TR",
  // Ásia/Oceania
  JPN: "JP", KOR: "KR", AUS: "AU", IRN: "IR", KSA: "SA", QAT: "QA",
  IRQ: "IQ", UZB: "UZ", NZL: "NZ", JOR: "JO",
  // África
  MAR: "MA", SEN: "SN", TUN: "TN", EGY: "EG", ALG: "DZ", CMR: "CM",
  GHA: "GH", NGA: "NG", CIV: "CI", RSA: "ZA", CPV: "CV", CGO: "CD",
  // Outros
  CZE: "CZ", // República Tcheca
};

const REGIONAL: Record<string, string> = {
  "GB-ENG": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "GB-SCT": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "GB-WLS": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
};

export function bandeiraEmoji(codigo?: string | null): string {
  if (!codigo) return "🏳️";
  const iso = FIFA_TO_ISO2[codigo.toUpperCase()];
  if (!iso) return "🏳️";
  if (REGIONAL[iso]) return REGIONAL[iso];
  return iso
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}
