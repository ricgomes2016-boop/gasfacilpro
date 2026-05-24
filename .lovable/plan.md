## Objetivo
Permitir que o modal "Vincular ao cadastro" do WhatsAppInbox busque clientes por endereço (rua, bairro, cidade, número, CEP) além de nome e telefone.

## Escopo
Arquivo: `src/components/atendimento/WhatsAppInbox.tsx`

## Mudanças

### 1. `handleOpenLinkDialog` (linha ~488)
- Expandir o `.select(...)` para incluir os campos de endereço: `endereco`, `numero`, `bairro`, `cidade`, `cep`

### 2. `searchLink` (linha ~504)
- Adicionar filtros `ilike` para os campos de endereço quando houver texto digitado:
  - `endereco.ilike.%${t}%`
  - `bairro.ilike.%${t}%`
  - `cidade.ilike.%${t}%`
  - `numero.ilike.%${t}%`
  - `cep.ilike.%${t}%`
- Manter a lógica existente de busca por nome e telefone/dígitos

### 3. UI do modal "Vincular ao cadastro" (linha ~1372)
- Atualizar o placeholder do input para: "Buscar por nome, telefone ou endereço..."
- Na lista de resultados, exibir o endereço do cliente abaixo do telefone (quando disponível), no formato: `Rua, Nº · Bairro · Cidade`

### 4. Tipos
- Adicionar campos de endereço ao tipo inferido usado em `linkResults` (se necessário, como `any` já é usado, tipagem inline mínima basta).

## Fora de escopo
- Não alterar `ContactDetailsPanel`
- Não alterar regras de WhatsApp, envio de mensagens ou lógica de conversa
- Não alterar banco de dados ou RLS