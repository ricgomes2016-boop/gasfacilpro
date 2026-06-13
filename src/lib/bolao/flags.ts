// Converte código FIFA (3 letras) em emoji de bandeira do país.
const FIFA_TO_ISO2: Record<string, string> = {
  BRA: "BR", ARG: "AR", URU: "UY", MEX: "MX", USA: "US", CAN: "CA",
  FRA: "FR", ENG: "GB", GER: "DE", ESP: "ES", POR: "PT", NED: "NL",
  ITA: "IT", BEL: "BE", CRO: "HR", SUI: "CH", DEN: "DK", POL: "PL",
  SRB: "RS", AUT: "AT", UKR: "UA", WAL: "GB", SCO: "GB", IRL: "IE",
  JPN: "JP", KOR: "KR", AUS: "AU", IRN: "IR", KSA: "SA", QAT: "QA",
  MAR: "MA", SEN: "SN", TUN: "TN", EGY: "EG", ALG: "DZ", CMR: "CM",
  GHA: "GH", NGA: "NG", CIV: "CI", RSA: "ZA", COL: "CO", CHI: "CL",
  PER: "PE", ECU: "EC", PAR: "PY", VEN: "VE", BOL: "BO", CRC: "CR",
  PAN: "PA", HON: "HN", JAM: "JM",
};

export function bandeiraEmoji(codigo?: string | null): string {
  if (!codigo) return "🏳️";
  const iso = FIFA_TO_ISO2[codigo.toUpperCase()];
  if (!iso) return "🏳️";
  return iso
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}
