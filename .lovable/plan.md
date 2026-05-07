## Diagnóstico

Suas 2 ligações para 4337717463 (encaminhadas para 4323980020) FORAM registradas no banco. Confirmei direto:

- `2026-05-07 13:25` — telefone `+551140403654`, DID `+554323980020`, status `recebida`
- `2026-05-07 11:41` e `11:38` — telefone `+554323980020`, status `recebida`

Mas elas **não aparecem na aba "Chamadas"** porque na última iteração eu adicionei este filtro em `CentralAtendimento.tsx` (linha 169-170):

```ts
if (unidadeAtual?.id) {
  query = query.eq("unidade_id", unidadeAtual.id);
}
```

E **todas as chamadas inseridas pelas edge functions de voz (`elevenlabs-call-initiation`, `twilio-voice-webhook`, `vonage-voice-webhook`) gravam `unidade_id = NULL`** — o resolver por DID só retorna `empresa_id` confiável, a unidade fica vazia. Resultado: filtro `.eq("unidade_id", x)` exclui 100% delas.

## Correção

Trocar o filtro estrito por um que **inclua chamadas sem unidade** (mesmo padrão já usado para os outros filtros nas linhas 188-189 e 203-204):

```ts
if (unidadeAtual?.id) {
  query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
}
```

Assim a aba mostra:
- chamadas explicitamente da unidade atual, e
- chamadas globais (sem unidade definida) — que é o caso de TODAS as ligações de voz hoje.

## Arquivo afetado

- `src/pages/atendimento/CentralAtendimento.tsx` — apenas as linhas 169-170 dentro de `fetchChamadas`.

Sem mudanças de schema, edge functions, rotas ou App.tsx. Após o ajuste, suas ligações de hoje (e as próximas) aparecem imediatamente na aba "Chamadas" com período "Hoje".

## Observação adicional (opcional, não incluída)

A médio prazo vale fazer as edge functions de voz preencherem `unidade_id` quando houver apenas 1 unidade ativa para a empresa do DID — mas isso é uma melhoria separada. Esta correção resolve o sintoma reportado.