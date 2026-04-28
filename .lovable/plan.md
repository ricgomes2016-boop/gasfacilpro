Plano de correção

1. Corrigir a data do pedido em Nova Venda

- Na tela `/vendas/nova`, usar o valor selecionado em `Data de Entrega` ao criar o pedido.
- Hoje o campo existe na interface, mas o pedido é inserido sem enviar essa data; por isso o banco usa `now()` e a tela de pedidos mostra a data atual.
- Ao finalizar, gravar `created_at` com a data escolhida em horário seguro de Brasília, por exemplo:
  - `2026-04-27T12:00:00-03:00`
- Usar meio-dia em vez de meia-noite para evitar virada de dia por fuso horário.

2. Corrigir a exibição e filtros na tela de Pedidos

- Manter a tela `/vendas/pedidos` usando `created_at` como data do pedido, agora respeitando a data escolhida.
- Ajustar a formatação para exibir corretamente em pt-BR/Brasília, evitando que `27/04/2026` apareça como `28/04/2026` ou vice-versa por causa do timezone.
- Os filtros por data já usam intervalo com `-03:00`; vou preservar esse padrão.

3. Restaurar/mostrar botão “Salvar Cliente” no fluxo de venda publicado

- Em `CustomerSearch`, o botão atual só aparece quando existe `value.id` e é apenas um ícone, o que pode ficar pouco perceptível no publicado.
- Vou trocar para uma ação visível com texto, por exemplo “Salvar cliente”, mantendo ícone e loading.
- O botão ficará disponível quando houver cliente selecionado e campos editáveis; se necessário, em telas estreitas, ele será compacto mas ainda reconhecível.
- A função atual de salvar cliente será mantida: atualiza nome, telefone, endereço, número, bairro, CEP e coordenadas.

4. Pequeno ajuste de UX para evitar confusão

- Quando for cliente novo sem cadastro, manter a mensagem de que será cadastrado automaticamente ao finalizar a venda.
- Quando for cliente existente, deixar claro que o botão “Salvar cliente” salva alterações cadastrais antes de finalizar a venda.

&nbsp;

Arquivos previstos

- `src/pages/vendas/NovaVenda.tsx`
- `src/hooks/usePedidos.ts`
- `src/components/vendas/CustomerSearch.tsx`

Observações técnicas

- Não será criada nova tabela.
- Não será alterado o fluxo de autenticação/RLS.
- A correção usará o campo `created_at` existente em `pedidos`, porque a listagem e os filtros atuais já se baseiam nele.