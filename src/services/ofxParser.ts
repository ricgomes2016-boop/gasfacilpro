// Parser OFX 1.x (SGML) e 2.x (XML), suporte a múltiplas contas (STMTRS)
export interface OFXTxn {
  date: string;       // YYYY-MM-DD
  amount: number;
  type: string;       // CREDIT/DEBIT/etc
  memo: string;
  fitid: string;
}

export interface OFXConta {
  bankId: string;       // código do banco
  bankName?: string;    // nome (se disponível em <ORG>)
  acctId: string;       // número da conta
  acctType?: string;    // CHECKING/SAVINGS
  cnpj?: string;        // se aparecer em <ORG> ou metadados
  saldoFinal: number;
  saldoData?: string;   // YYYY-MM-DD
  dataInicio: string;
  dataFim: string;
  txns: OFXTxn[];
}

export interface OFXParseResult {
  contas: OFXConta[];
  fiName?: string;     // <ORG> da instituição
  fiOrg?: string;
}

const BANCO_NOMES: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "077": "Inter",
  "104": "Caixa Econômica",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "237": "Bradesco",
  "260": "Nu Pagamentos",
  "290": "PagBank",
  "323": "Mercado Pago",
  "335": "Banco Digio",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "422": "Safra",
  "461": "Asaas",
  "655": "Votorantim",
  "748": "Sicredi",
  "756": "Sicoob",
};

export function bancoNome(bankId: string): string {
  return BANCO_NOMES[bankId?.padStart(3, "0")] ?? (bankId ? `Banco ${bankId}` : "Banco");
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const dt = raw.slice(0, 8);
  if (dt.length === 8 && /^\d{8}$/.test(dt)) {
    return `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function getTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function getBlock(text: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = text.match(re);
  if (m) return m[1];
  // fallback SGML sem fechamento
  const open = text.toUpperCase().indexOf(`<${tag.toUpperCase()}>`);
  return open >= 0 ? text.slice(open) : "";
}

export function isOFX(text: string): boolean {
  const upper = text.slice(0, 2000).toUpperCase();
  return upper.includes("OFXHEADER") || upper.includes("<OFX>");
}

export function parseOFXMultiConta(text: string): OFXParseResult {
  const contas: OFXConta[] = [];

  // FI (instituição) — opcional
  const fiBlock = getBlock(text, "FI");
  const fiName = fiBlock ? getTag(fiBlock, "ORG") : undefined;
  const fiOrg = fiName;

  // Cada extrato: <STMTRS> ... </STMTRS>
  const stmtRe = /<STMTRS>([\s\S]*?)<\/STMTRS>/gi;
  let stmtMatch: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((stmtMatch = stmtRe.exec(text)) !== null) {
    const stmt = stmtMatch[1];
    const acctBlock = getBlock(stmt, "BANKACCTFROM") || getBlock(stmt, "CCACCTFROM");
    const bankId = getTag(acctBlock, "BANKID");
    const acctId = getTag(acctBlock, "ACCTID");
    const acctType = getTag(acctBlock, "ACCTTYPE");

    // chave para deduplicar contas iguais
    const key = `${bankId}::${acctId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Saldo final
    const ledgerBlock = getBlock(stmt, "LEDGERBAL");
    const saldoFinal = parseFloat(getTag(ledgerBlock, "BALAMT") || "0") || 0;
    const saldoData = parseDate(getTag(ledgerBlock, "DTASOF"));

    // Período
    const dataInicio = parseDate(getTag(stmt, "DTSTART"));
    const dataFim = parseDate(getTag(stmt, "DTEND"));

    // Transações
    const txns: OFXTxn[] = [];
    const trnRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let trnMatch: RegExpExecArray | null;
    while ((trnMatch = trnRe.exec(stmt)) !== null) {
      const b = trnMatch[1];
      txns.push({
        date: parseDate(getTag(b, "DTPOSTED")),
        amount: parseFloat(getTag(b, "TRNAMT") || "0") || 0,
        type: getTag(b, "TRNTYPE"),
        memo: getTag(b, "MEMO") || getTag(b, "NAME"),
        fitid: getTag(b, "FITID"),
      });
    }

    contas.push({
      bankId,
      bankName: bancoNome(bankId),
      acctId,
      acctType,
      saldoFinal,
      saldoData,
      dataInicio: dataInicio || (txns[0]?.date ?? new Date().toISOString().slice(0, 10)),
      dataFim: dataFim || (txns[txns.length - 1]?.date ?? new Date().toISOString().slice(0, 10)),
      txns,
    });
  }

  // Fallback: nenhum STMTRS encontrado, mas existem STMTTRN soltas
  if (contas.length === 0) {
    const trnRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    const txns: OFXTxn[] = [];
    let m: RegExpExecArray | null;
    while ((m = trnRe.exec(text)) !== null) {
      const b = m[1];
      txns.push({
        date: parseDate(getTag(b, "DTPOSTED")),
        amount: parseFloat(getTag(b, "TRNAMT") || "0") || 0,
        type: getTag(b, "TRNTYPE"),
        memo: getTag(b, "MEMO") || getTag(b, "NAME"),
        fitid: getTag(b, "FITID"),
      });
    }
    if (txns.length > 0) {
      const acctBlock = getBlock(text, "BANKACCTFROM");
      contas.push({
        bankId: getTag(acctBlock, "BANKID"),
        bankName: bancoNome(getTag(acctBlock, "BANKID")),
        acctId: getTag(acctBlock, "ACCTID"),
        saldoFinal: 0,
        dataInicio: txns[0].date,
        dataFim: txns[txns.length - 1].date,
        txns,
      });
    }
  }

  return { contas, fiName, fiOrg };
}
