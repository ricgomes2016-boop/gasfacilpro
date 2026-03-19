

# Plano: Otimização da Bia para Atendimento Excelente

## Problemas Identificados

1. **Nome do cliente não salvo** — `createOrder` cria o cliente mas `findCliente` não atualiza o nome quando o pushName do WhatsApp é diferente/melhor
2. **Endereço não reconhecido** — O prompt exige "Rua/Av + número" mas clientes enviam o endereço em partes (ex: "Rua Goiás" numa msg, "número 100" na próxima)
3. **Resposta rápida demais** — O webhook responde instantaneamente sem dar tempo ao cliente de completar a mensagem (ele pode enviar 2-3 msgs seguidas)
4. **Forma de pagamento verbosa** — O prompt diz para listar "(Dinheiro, Pix ou Cartão)" em vez de simplesmente perguntar "Qual a forma de pagamento?"
5. **Cliente institucional** — A lógica existe mas o prompt precisa ser mais enfático sobre reconhecer órgãos e confirmar endereço já cadastrado
6. **Cliente conhecido** — O prompt faz saudação genérica em vez de cumprimentar pelo nome e **esperar** a resposta

## Alterações

### Arquivo: `supabase/functions/_shared/bia-core.ts`

**1. Atualizar nome do cliente existente** (função `findCliente` ou novo trecho)
- Após encontrar o cliente, se o campo `nome` estiver vazio/genérico ("Cliente WhatsApp", "Cliente Vapi") e o `pushName` do WhatsApp tiver um nome real, atualizar o registro com `UPDATE clientes SET nome = pushName`
- Adicionar parâmetro opcional `senderName` a `findCliente`

**2. Buffer de mensagens (anti-resposta-rápida)**
- Adicionar lógica de "debounce" no webhook: ao receber uma mensagem, aguardar ~3 segundos e verificar se chegou outra mensagem do mesmo número
- Se sim, concatenar tudo antes de processar pela IA
- Implementar via consulta ao banco: antes de chamar a IA, buscar mensagens recentes (últimos 4s) do mesmo conversa_id que ainda não foram processadas

**3. Melhorar reconhecimento de endereço no prompt**
- Instruir a IA a **acumular** fragmentos de endereço: se o cliente manda "Rua Goiás" e depois "número 500, Centro", juntar tudo
- Remover a exigência rígida de "Rua/Av/Travessa + número" e substituir por: "Considere QUALQUER informação de localização como parte do endereço"

**4. Simplificar pergunta de pagamento**
- Alterar o Passo 4 do prompt de `"Qual será a forma de pagamento (Dinheiro, Pix ou Cartão)?"` para apenas `"Qual a forma de pagamento?"`
- Remover listagem de opções; esperar o cliente falar

**5. Fortalecer lógica institucional**
- Expandir regex para incluir mais palavras-chave: "damasco", "municipal", "estadual", "EMEI", "EMEF", "UBS", "posto de saúde", "cre