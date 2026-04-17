

## Problema
Na tela `/vendas/nova`, a IA recebe o comando do usuário e chama a edge function `parse-sales-command`. Essa função hoje:
1. Carrega só os **primeiros 200 clientes** (`.limit(200)`) e injeta no prompt da IA.
2. Como o sistema tem **+22.000 clientes**, a chance de o cliente certo estar nessa lista é mínima → a IA quase sempre cria um cliente novo em vez de reaproveitar.
3. Não faz busca por **endereço** — só por nome dentro da lista limitada.
4. Não filtra por `empresa_id` nem por `unidade_id`, então quebra o isolamento multi-empresa.

## Solução: pré-busca server-side por nome E endereço antes de chamar a IA

Vamos transformar o fluxo em duas etapas dentro da própria edge function:

```text
Comando do usuário
       │
       ▼
[1] Extração rápida de pistas (regex + IA leve)
    → nome provável, telefone, rua, número, bairro
       │
       ▼
[2] Busca no banco usando RPC otimizada
    → match por nome (trigram) + telefone + endereço (rua/bairro)
    → filtrada por empresa_id e unidade_id
    → retorna até 15 candidatos
       │
       ▼
[3] IA recebe SÓ os candidatos reais + dados do comando
    → escolhe o cliente_id correto
    → ou retorna null se nenhum bate
       │
       ▼
[4] Frontend usa cliente_id existente (sem duplicar)
```

## Mudanças

### Backend
**Nova RPC `buscar_clientes_para_ia`** (`empresa_id`, `unidade_id`, `nome`, `telefone`, `endereco_rua`, `bairro`, `numero`)
- Usa índices `pg_trgm` + `unaccent` já existentes
- Score combinado: similaridade de nome + match de telefone + similaridade de endereço/bairro + match exato de número
- Retorna top 15 candidatos com endereço completo

**Refactor `supabase/functions/parse-sales-command/index.ts`**
- Remove o `.limit(200)` global
- Adiciona etapa 1: chamada rápida ao Gemini Flash Lite só para extrair { nome?, telefone?, endereco?, numero?, bairro? } do comando
- Chama a nova RPC com esses campos + `empresa_id` (do JWT/profile) + `unidade_id` (recebido no body)
- Monta o prompt final só com os candidatos retornados (máx. 15) — agora cabe folgado e a IA escolhe o certo
- Reforça regra: "Se houver candidato com endereço similar, use o `cliente_id` dele. Só crie novo se realmente não bater."

### Frontend
**`src/pages/vendas/NovaVenda.tsx` (`handleAiCommand`)**
- Passa `unidade_id` no body do invoke
- Mantém o resto do fluxo (já trata `data.cliente_id` corretamente)

## Arquivos afetados
- `supabase/migrations/<nova>.sql` — cria RPC `buscar_clientes_para_ia`
- `supabase/functions/parse-sales-command/index.ts` — fluxo em 2 etapas
- `src/pages/vendas/NovaVenda.tsx` — envia `unidade_id` no invoke

## Resultado esperado
Quando o usuário falar "lança um P13 pra Maria da Rua das Flores 200", a IA primeiro vai buscar no banco todos os clientes cuja rua bate com "Rua das Flores" (mesmo se houver 50 Marias), encontra a correta e reutiliza o cadastro — em vez de criar mais uma duplicata.

