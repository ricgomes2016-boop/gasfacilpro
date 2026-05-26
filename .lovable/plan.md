## Causa raiz

O comando "lança um gás na Rua Aparecido Cassiano, 115, cartão, R$ 125" **não tem nome de cliente**. Hoje, em `NovaVenda.applyParsedSale`:

- Sem `cliente_id` **e** sem `cliente_nome`, o bloco que chama `setCustomer(...)` é totalmente pulado → endereço falado é jogado fora.
- O wizard mostra **apenas uma etapa por vez** e começa em `activeStep = "cliente"`. Como nada foi setado no cliente, a tela parece "em branco" mesmo com itens/pagamento populados nos bastidores.
- O toast "Venda pré-preenchida por voz" aparece porque `applyParsedSale` rodou — mas visualmente o usuário não vê itens/pagamento (estão em outra aba do stepper).

## Mudanças

### 1. `src/pages/vendas/NovaVenda.tsx` — `applyParsedSale`

- Adicionar um **fallback** quando não há `cliente_id` nem `cliente_nome`: se vier qualquer dado de endereço/telefone (`data.endereco`, `data.numero`, `data.complemento`, `data.bairro`, `data.cliente_telefone`, `data.observacoes`), preencher `setCustomer({...initialCustomerData, nome: "", telefone, endereco, numero, complemento, bairro, cep, observacao})`. Assim a aba Cliente sai do vazio mostrando o endereço falado.
- **Depois** de aplicar itens/pagamento/cliente, calcular o "estágio mais avançado preenchido" e mover o stepper:
  - tem `pagamentos` com valor → `setActiveStep("confirmar")`
  - senão tem `itens` → `setActiveStep("pagamento")`
  - senão tem endereço/cliente → `setActiveStep("produtos")`
  - Faz isso só quando vier do fluxo de voz (passar flag `fromVoice` no chamador).
- Trocar o toast final para algo mais útil: "Venda pré-preenchida — confirme os dados antes de salvar."

### 2. `src/pages/vendas/NovaVenda.tsx` — chamadores

- `handleAiCommand` → `await applyParsedSale(data, { fromVoice: true })`.
- `useEffect` do `?fromVoice=1` → `applyParsedSale(payload, { fromVoice: true })`.

### 3. `supabase/functions/parse-sales-command/index.ts` — pequeno reforço

- Garantir que o JSON final **sempre** inclua os campos de endereço quando vierem das pistas, mesmo sem nome de cliente (o prompt já tenta, mas reforçar: "Se o operador NÃO mencionou nome do cliente, retorne `cliente_nome: null` e `cliente_id: null`, mas mantenha `endereco`, `numero`, `complemento`, `bairro` preenchidos a partir do comando").

## Não muda

- `App.tsx`, rotas, RLS, contextos, brand themes, layout do wizard.
- Fluxo de criação real do cliente (continua acontecendo só quando há nome).
- `VoiceAssistant.tsx`, `ai-assistant`.

## Validação manual

1. Mobile, Dashboard, microfone: "lança um gás na Rua Aparecido Cassiano 115, cartão, 125 reais" → abre `/vendas/nova`, aba **Confirmar** ativa, com endereço, item gás (R$ 125) e pagamento `cartao_credito` visíveis.
2. Mesmo comando dentro de Nova Venda → idem, sem navegar.
3. Comando com nome ("lança um gás pra Maria Rua X 10, pix, 120") → continua criando/reaproveitando cliente como antes.
