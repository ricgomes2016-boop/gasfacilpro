

# Bia: Identificar Entregadores e Parceiros no WhatsApp

## Problema

Atualmente, a Bia trata todas as mensagens recebidas como se fossem de clientes. Quando um entregador ou parceiro (vale-gás) entra em contato pelo WhatsApp, a Bia tenta vender gás para ele, o que e inadequado.

## Solucao

Adicionar uma etapa de identificacao no fluxo da Bia que cruza o telefone de quem mandou a mensagem com as tabelas `entregadores` e `vale_gas_parceiros`. Dependendo do resultado, o comportamento muda:

### Fluxo de Decisao

```text
Mensagem recebida
    │
    ├─ Telefone bate com entregadores? → Modo Entregador
    ├─ Telefone bate com vale_gas_parceiros? → Modo Parceiro
    └─ Nenhum match → Modo Cliente (fluxo atual, inalterado)
```

### Modo Entregador
- Bia responde de forma direta e profissional, como colega de trabalho
- Pode responder duvidas simples (horarios, enderecos de entrega pendentes)
- Registra a mensagem no chat do sistema (ai_mensagens) com metadata `{ tipo_contato: "entregador", entregador_id: "..." }`
- NAO tenta vender, NAO pede endereco, NAO segue fluxo de pedido

### Modo Parceiro (Instituicao)
- Bia responde educadamente, identifica como parceiro institucional
- Registra com metadata `{ tipo_contato: "parceiro", parceiro_id: "..." }`
- Pode informar sobre pedidos pendentes da instituicao
- NAO segue fluxo de venda normal

### Registro no Chat do Sistema
Todas as mensagens de entregadores/parceiros ficam visiveis no historico de conversas (ai_conversas + ai_mensagens), permitindo que o gestor veja o que foi conversado.

## Alteracoes Tecnicas

| Arquivo | Acao |
|---|---|
| `supabase/functions/_shared/bia-core.ts` | Criar funcao `identifyContact(supabase, phone)` que retorna `{ tipo: "cliente" | "entregador" | "parceiro", id, nome }` |
| `supabase/functions/_shared/bia-core.ts` | Modificar `buildSystemPrompt` para aceitar tipo de contato e injetar instrucoes especificas |
| Todos os webhooks (5 arquivos) | Chamar `identifyContact` antes do fluxo e passar o tipo para o prompt |

### Nova funcao: `identifyContact`

```text
1. Consulta entregadores WHERE telefone ILIKE %phone% AND ativo = true
2. Se encontrou → retorna { tipo: "entregador", id, nome }
3. Senao, consulta vale_gas_parceiros WHERE telefone ILIKE %phone% AND ativo = true
4. Se encontrou → retorna { tipo: "parceiro", id, nome }
5. Senao → retorna { tipo: "cliente" }
```

### Instrucoes injetadas no prompt

**Entregador:**
- "Voce esta conversando com o ENTREGADOR [nome]. Ele faz parte da equipe."
- "Responda de forma direta e objetiva. Pode informar sobre entregas pendentes, horarios e rotas."
- "NAO tente vender produtos. NAO siga o fluxo de pedido."

**Parceiro:**
- "Voce esta conversando com o PARCEIRO INSTITUCIONAL [nome]."
- "Responda de forma educada e profissional. Pode informar sobre pedidos da instituicao."
- "NAO siga o fluxo de venda normal."

### Metadata nas mensagens

As mensagens salvas terao metadata adicional para facilitar filtragem no painel:
- `tipo_contato: "entregador" | "parceiro" | "cliente"`
- `contato_id: uuid` (quando aplicavel)

## Garantias

- Zero alteracao no fluxo de clientes (so adiciona uma verificacao antes)
- Mensagens de entregadores/parceiros ficam no mesmo historico de conversas, visiveis no sistema
- Nenhuma tabela nova necessaria
- Nenhuma alteracao de RLS

