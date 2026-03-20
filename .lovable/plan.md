

# Corrigir: Botao de login do Painel Super Admin nao funciona

## Problema

O hook `useAuthForm` tem `defaultLoginMethod = "phone"`. O `AuthErp` corrige isso chamando `form.setLoginMethod("email")` no `useEffect`, mas o `AuthPainel` **nao faz isso**.

Quando o usuario digita email e senha no AuthPainel e clica "Acessar Painel Admin":
1. `handleLogin` executa com `loginMethod = "phone"`
2. Valida usando `phoneLoginSchema` contra `loginPhone` (que esta vazio)
3. Seta erro no campo `phone` — mas o formulario so mostra campo `email`
4. **Nada visivel acontece** — o erro e silencioso

## Correcao

**Arquivo:** `src/pages/auth/AuthPainel.tsx`

Adicionar `useEffect` para forcar `loginMethod = "email"`, identico ao que ja existe no `AuthErp`:

```typescript
useEffect(() => {
  form.setLoginMethod("email");
}, []);
```

Uma linha resolve o problema.

