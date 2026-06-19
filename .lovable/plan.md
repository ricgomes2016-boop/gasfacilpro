## Objetivo
Alinhar a tela `Nova Venda` ao layout da imagem: cabeçalho com título + breadcrumb, coluna direita com **Resumo do Pedido** + **Ações Rápidas**, stepper movido para o **rodapé** com botão "Próxima etapa", e formulário do Cliente em grid de 4 colunas.

## Mudanças em `src/pages/vendas/NovaVenda.tsx`

### 1. Cabeçalho da página (novo)
Acima do card do stepper, adicionar bloco com:
- Título grande **Nova Venda** (gradiente primary, igual à imagem) + badge "Build {APP_BUILD}".
- Breadcrumb `Empresa › Unidade › Unidade atual` usando dados de `EmpresaContext`/`UnidadeContext`.
- À direita: botões **Assistente IA** (popover existente), **Antiga/Nova** e **Nova Venda** (já existem; só reposicionar nesta linha).

### 2. Stepper para o rodapé
- Remover o bloco do stepper que hoje fica no topo (linhas ~1394-1441).
- Criar `vendaFooter`: barra fixa no fim do `vendaContent` (`sticky bottom-0` no desktop, `border-t bg-card`), contendo:
  - `<VendaStepper compact …/>` ocupando o espaço flexível.
  - Botão **Próxima etapa →** à direita; quando `activeStep === "confirmar"` o botão muda para **Finalizar venda** chamando `handleFinalizar`. Avanço calcula próximo `VendaStepId` respeitando `canOpenStep`.
- `Badge #numero`, atalhos (Keyboard tooltip) e botão "Nova Venda/Antiga" são movidos para o cabeçalho do passo 1 (item 1) em vez de ficarem no stepper.

### 3. Coluna direita do passo Cliente
Ampliar a sidebar (`xl:grid-cols-[minmax(0,1fr)_360px]` → manter ~360-400px) e empilhar três cards:
1. **Histórico do Cliente** (já existe — `<CustomerHistory/>`).
2. **Resumo do Pedido** (novo card): exibe `Itens` (qtd), `Subtotal`, `Descontos`, `Taxas`, `Total` calculados a partir de `itens`/`pagamentos` (apenas leitura — sem alterar lógica de negócio). Total em destaque com cor primary.
3. **Ações rápidas** (novo card): três botões — `Adicionar produto` (vai para passo `produtos`), `Aplicar desconto` (vai para `pagamento`), `Observação` (foca textarea de observação).

A mesma sidebar passa a ser exibida em **todos os passos** (não só no Cliente), para manter o resumo sempre visível como na imagem. O conteúdo do passo continua na coluna esquerda.

### 4. Formulário do Cliente — grid em 4 colunas
A imagem mostra uma estrutura específica: linha 1 com **Data de entrega · Canal de venda · Telefone · Buscar cliente**; linha 2 com **Nome do cliente + Novo cliente + Salvar cliente**; depois **Endereço/Número/Mapa**, **CEP/Bairro/Complemento** e **Observação do pedido**.

Hoje esses campos vivem dentro de `CustomerSearch.tsx` (944 linhas) e do `metaCard`. Para evitar reescrever o `CustomerSearch`, faremos apenas ajustes **visuais/contêiner** em `NovaVenda.tsx`:
- Renderizar `metaCard` e `CustomerSearch` dentro de um único `<Card>` com cabeçalho **Cliente** (ícone `User`) — mesma “casca” da imagem.
- Ajustar o `metaCard` para 4 colunas (`md:grid-cols-4`) incluindo Telefone e Busca, apenas se for trivial; caso contrário manter 2 colunas. **Sem mudar lógica.**
- Caso o usuário queira o grid 4-colunas exato da imagem, isso exigirá refatorar `CustomerSearch` — fora do escopo desta etapa, aviso na resposta final.

### 5. Sem alterações
- Lógica de negócio, validações, atalhos F2-F5, draft, navegação e o `CustomerSearch` permanecem intactos.
- `metaCard` continua existindo (não foi removido conforme pedido anterior).
- Versão antiga (`useNewView=false`) não muda.

## Arquivos afetados
- `src/pages/vendas/NovaVenda.tsx` (cabeçalho, sidebar, footer com stepper, “Próxima etapa”).

## Pergunta antes de implementar
A coluna **Cliente** do mock tem layout interno bem diferente do `CustomerSearch` atual (4 inputs na 1ª linha, botões "Novo cliente"/"Salvar cliente" ao lado do nome, "Mapa" como botão ao lado do número). Quer que eu:

- **(A)** faça apenas os ajustes externos (cabeçalho, sidebar com Resumo/Ações, stepper no rodapé) e mantenha o `CustomerSearch` como está hoje; ou
- **(B)** refatore também o `CustomerSearch` para ficar 100 % igual ao mock (mais arriscado, mexe em ~944 linhas)?
