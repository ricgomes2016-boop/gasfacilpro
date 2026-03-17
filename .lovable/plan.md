

# Implementação: Notificações SW + Vale Gás + Fix Build

## 1. Fix Build Error — `ComissaoEntregador.tsx` (linha 189)

Adicionar `produtoId: string` ao tipo do array `linhas`:

```typescript
// Antes:
const linhas: { produto: string; canal: string; quantidade: number; comissaoUnit: number; total: number }[] = [];

// Depois:
const linhas: { produtoId: string; produto: string; canal: string; quantidade: number; comissaoUnit: number; total: number }[] = [];
```

---

## 2. Vale Gás na Bia — `bia-core.ts` (linha 393)

Adicionar regex para "vale gás" na função `extractCollectedData`, após a linha do "fiado":

```typescript
else if (/\b(vale\s*g[aá]s|vale)\b/i.test(t)) result.pagamento = "vale gás";
```

---

## 3. Notificações via Service Worker

### `src/hooks/useDesktopNotification.ts` — Reescrever `notify()`

- Usar `navigator.serviceWorker.ready` → `registration.showNotification()` como método primário
- Opções: `requireInteraction: true`, `renotify: true`, `vibrate: [200, 100, 200]`, `data: { url: "/pedidos" }`
- Fallback para `new Notification()` se SW indisponível
- Manter `navigator.vibrate` complementar

### `src/services/notificationService.ts` — Atualizar `sendOrderNotification()`

- Adicionar parâmetro opcional `formaPagamento?: string` e incluir no body
- Usar `registration.showNotification()` com `requireInteraction: true` e tag único por pedido
- Fallback com `new Notification()` + `onclick` que redireciona para `/pedidos`

### `src/hooks/usePedidos.ts` (linha 124) — Passar forma de pagamento

```typescript
sendOrderNotification(
  p?.cliente_nome || "Cliente",
  Number(p?.valor_total || 0),
  p?.forma_pagamento
);
```

---

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/rh/ComissaoEntregador.tsx` | Adicionar `produtoId` ao tipo de `linhas` |
| `supabase/functions/_shared/bia-core.ts` | Adicionar "vale gás" no regex de pagamento |
| `src/hooks/useDesktopNotification.ts` | Usar SW `showNotification` como primário |
| `src/services/notificationService.ts` | Adicionar `formaPagamento`, usar SW, fallback |
| `src/hooks/usePedidos.ts` | Passar `forma_pagamento` na notificação |

