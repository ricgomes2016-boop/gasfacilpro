/** Códigos curtos para digitação manual. O número continua único no banco. */
export function codigoValeGas(numero: number): string {
  return `VG-${Math.trunc(numero).toString().padStart(6, "0")}`;
}

/** Combina número da venda (5) + item (2): VA-0000101. */
export function codigoVendaAntecipada(numeroVenda: number, numeroItem: number): string {
  return `VA-${Math.trunc(numeroVenda).toString().padStart(5, "0")}${Math.trunc(numeroItem).toString().padStart(2, "0")}`;
}

export function somenteDigitosCodigo(valor: string): string {
  return valor.replace(/\D/g, "");
}
