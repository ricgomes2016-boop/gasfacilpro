import { describe, expect, it } from "vitest";
import {
  buscarIdempotente,
  registrarNonce,
  salvarIdempotente,
} from "../../../supabase/functions/whatsapp-portal-api/store";

/** Client falso em memória que simula unicidade de nonce. */
function fakeDb() {
  const linhas: any[] = [];
  return {
    linhas,
    from() {
      let filtros: Array<(r: any) => boolean> = [];
      const api: any = {
        insert(row: any) {
          if (linhas.some((l) => l.nonce === row.nonce)) {
            return Promise.resolve({ error: { code: "23505" } });
          }
          linhas.push({ response: null, idempotency_key: null, ...row });
          return Promise.resolve({ error: null });
        },
        select() {
          return api;
        },
        eq(col: string, val: any) {
          filtros.push((r) => r[col] === val);
          return api;
        },
        not(col: string) {
          filtros.push((r) => r[col] !== null && r[col] !== undefined);
          return api;
        },
        update(patch: any) {
          const p = {
            eq(col: string, val: any) {
              linhas.filter((r) => r[col] === val).forEach((r) => Object.assign(r, patch));
              return Promise.resolve({ error: null });
            },
          };
          return p;
        },
        maybeSingle() {
          const hit = linhas.find((r) => filtros.every((f) => f(r)));
          filtros = [];
          return Promise.resolve({ data: hit ?? null });
        },
      };
      return api;
    },
  };
}

describe("anti-replay e idempotência", () => {
  it("aceita o nonce uma única vez", async () => {
    const db = fakeDb();
    expect(await registrarNonce(db, "n-1", "create-order")).toBe(true);
    expect(await registrarNonce(db, "n-1", "create-order")).toBe(false);
  });

  it("devolve a mesma resposta para a mesma idempotency key", async () => {
    const db = fakeDb();
    await registrarNonce(db, "n-2", "create-order");
    expect(await buscarIdempotente(db, "idem-1")).toBeNull();
    await salvarIdempotente(db, {
      nonce: "n-2",
      idempotencyKey: "idem-1",
      action: "create-order",
      response: { success: true, order_id: "ped-1" },
    });
    expect(await buscarIdempotente(db, "idem-1")).toEqual({ success: true, order_id: "ped-1" });
  });
});
