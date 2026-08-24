// Cliente HTTP/1.1 mínimo sobre TLS com certificado de cliente (mTLS).
// Necessário porque o `fetch` do Supabase Edge Runtime negocia HTTP/2 por
// padrão (a SEFAZ responde "endpoint requires HTTP/1.1") e, ao forçar
// `http1: true`, o servidor derruba a conexão (RST) por causa do ALPN.
// Aqui abrimos o socket TLS sem anunciar ALPN e falamos HTTP/1.1 direto.

export interface RespostaHttp1 {
  status: number;
  body: string;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function indexOfSeq(buf: Uint8Array, seq: number[], from = 0): number {
  outer: for (let i = from; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer;
    return i;
  }
  return -1;
}

/** POST HTTP/1.1 sobre TLS com certificado de cliente. */
export async function postHttp1Tls(
  url: string,
  body: string,
  headers: Record<string, string>,
  cert: { certPem: string; keyPem: string },
  timeoutMs = 25000,
): Promise<RespostaHttp1> {
  const u = new URL(url);
  const porta = Number(u.port || 443);
  const conn = await (Deno as any).connectTls({
    hostname: u.hostname,
    port: porta,
    cert: cert.certPem,
    key: cert.keyPem,
    // Sem alpnProtocols: servidores legados da SEFAZ resetam quando o cliente
    // anuncia "http/1.1" via ALPN, mas aceitam a conexão sem extensão ALPN.
  });

  const timer = setTimeout(() => { try { conn.close(); } catch (_e) { /* noop */ } }, timeoutMs);
  try {
    const enc = new TextEncoder();
    const corpo = enc.encode(body);
    const linhas = [
      `POST ${u.pathname}${u.search} HTTP/1.1`,
      `Host: ${u.host}`,
      `Content-Length: ${corpo.length}`,
      `Connection: close`,
      ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
    ].join("\r\n");
    await conn.write(concat(enc.encode(linhas + "\r\n\r\n"), corpo));

    let buf = new Uint8Array(0);
    const tmp = new Uint8Array(65536);
    while (true) {
      const n = await conn.read(tmp);
      if (n === null) break;
      buf = concat(buf, tmp.subarray(0, n));
    }

    const sep = indexOfSeq(buf, [13, 10, 13, 10]);
    if (sep < 0) throw new Error("resposta HTTP/1.1 malformada (sem cabeçalho)");
    const cabecalho = new TextDecoder().decode(buf.subarray(0, sep));
    let corpoBytes = buf.subarray(sep + 4);
    const status = Number(cabecalho.match(/^HTTP\/1\.[01] (\d{3})/)?.[1] ?? 0);

    if (/transfer-encoding:\s*chunked/i.test(cabecalho)) {
      const partes: Uint8Array[] = [];
      let p = 0;
      while (p < corpoBytes.length) {
        const fim = indexOfSeq(corpoBytes, [13, 10], p);
        if (fim < 0) break;
        const tam = parseInt(new TextDecoder().decode(corpoBytes.subarray(p, fim)).trim().split(";")[0], 16);
        if (!Number.isFinite(tam) || tam <= 0) break;
        partes.push(corpoBytes.subarray(fim + 2, fim + 2 + tam));
        p = fim + 2 + tam + 2;
      }
      let total = new Uint8Array(0);
      for (const parte of partes) total = concat(total, parte);
      corpoBytes = total;
    }

    return { status, body: new TextDecoder().decode(corpoBytes) };
  } finally {
    clearTimeout(timer);
    try { conn.close(); } catch (_e) { /* noop */ }
  }
}
