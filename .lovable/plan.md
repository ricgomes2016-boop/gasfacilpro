

# Correção dos Erros de Build

## Diagnóstico

Os erros de build **não são relacionados às mudanças de frota/regras da Bia**. As alterações em `bia-core.ts`, `RegrasBia.tsx`, rotas e menu estão corretas. Os erros são:

### 1. `evolution-webhook/index.ts` — Import faltando (linha 9)
`downloadAudio` e `transcribeAudio` não estão no import, mas são usados nas linhas 70-72. Os outros webhooks (meta, zapi, uazapi) importam corretamente.

### 2. `evolution-webhook/index.ts` — `error` is unknown (linha 254)
`error.message` sem cast.

### 3. Erros `'error' is of type 'unknown'` em 5 funções (pré-existentes)
- `daily-briefing/index.ts:185` — `e.message`
- `parse-fuel-photo/index.ts:128` — `error.message`
- `parse-products-import/index.ts:118` — `error.message`
- `parse-orders-history/index.ts:149` — `error.message`
- `parse-receivables-import/index.ts:118` — `error.message`
- `recompra-alerts/index.ts:124` — `error.message`

### 4. `recompra-whatsapp-dispatch/index.ts:193` — `sendResp` possibly null

## Correções

| Arquivo | Correção |
|---------|----------|
| `evolution-webhook/index.ts` L9 | Adicionar `downloadAudio, transcribeAudio` ao import |
| `evolution-webhook/index.ts` L254 | `(error as Error).message` |
| `daily-briefing/index.ts` L185 | `(e as Error).message` |
| `parse-fuel-photo/index.ts` L128 | `(error as Error).message` |
| `parse-products-import/index.ts` L118 | `(error as Error).message` |
| `parse-orders-history/index.ts` L149 | `(error as Error).message` |
| `parse-receivables-import/index.ts` L118 | `(error as Error).message` |
| `recompra-alerts/index.ts` L124 | `(error as Error).message` |
| `recompra-whatsapp-dispatch/index.ts` L193 | `await sendResp?.text()` |

Todas são correções de 1 linha. Nenhuma mudança de lógica.

