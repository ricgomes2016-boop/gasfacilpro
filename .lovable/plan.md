# Reorganização da tela Nova Venda

Refatorar apenas o cabeçalho/rodapé da página `src/pages/vendas/NovaVenda.tsx` (sem mexer em lógica de venda).

## 1. Stepper no rodapé com setas de navegação

- Mover o componente do stepper (Cliente → Produtos → Pagamento → Entregador → Confirmar) atualmente no topo para uma **barra fixa no rodapé** (`sticky bottom-0`, fundo `bg-card`, borda superior hairline, respeitando `pb-safe` no mobile e não cobrindo os botões flutuantes do WhatsApp/IA).
- Adicionar à esquerda do stepper uma **seta "Voltar"** (ChevronLeft, `ghost` icon button) que recua para a etapa anterior. Desabilitada quando já está em "Cliente".
- Adicionar à direita uma **seta "Continuar"** (ChevronRight) que avança para a próxima etapa. Na última etapa ("Confirmar") vira **"Finalizar"** (verde, executa o submit atual).
- As bolinhas/labels do stepper continuam clicáveis como hoje; as setas apenas acrescentam navegação sequencial.

## 2. Card da data assume nº do pedido e "Nova Venda"

A barra superior atual (`#506` · Assistente IA · Antiga · + Nova Venda`) é desmontada. Reaproveitar o **card de cabeçalho que mostra a data/saudação** para abrigar:

- À esquerda: **#506** (badge sutil monoespaçado) + título "Nova Venda" + data atual.
- À direita: botão **+ Nova Venda** (abrir nova aba/janela de venda) e o toggle **Antiga/Nova** (versão da tela).

Sugestão UX (recomendada): manter "Antiga/Nova" como um pequeno `SegmentedControl` discreto, e o `+ Nova Venda` como botão primário compacto — assim o card vira o "header da venda atual" sem poluir a área de conteúdo.

## 3. Botão Assistente IA → fundir com o do header

- Remover o botão verde "Assistente IA" local da Nova Venda.
- O ícone **IA já existente no Header global** (tema Clean) passa a, quando a rota for `/vendas/nova-venda` (ou o modal flutuante estiver aberto), abrir o mesmo painel de assistente que esse botão local abria hoje. Um único ponto de entrada para IA.

## 4. Seletor de versão (Antiga/Nova) → perfil

- Conforme pedido: além de aparecer no card da data (item 2), espelhar a opção em `src/pages/MeuPerfil.tsx`, em um bloco **"Preferências de interface"** posicionado **acima do card "Nova atualização"**, com um switch "Usar nova tela de Nova Venda" persistido na mesma chave já usada hoje (`useNewView`).

## 5. Botão de informações/atalhos — sugestão UI/UX

Recomendo **remover o ícone solto** e transformar em um item dentro do menu **"Mais ações"** já criado em Pedidos, replicado aqui na Nova Venda como botão `⋯` discreto ao lado de "+ Nova Venda" no card da data, com:

- "Atalhos de teclado" (abre um `Dialog` listando os atalhos — Enter avança etapa, Esc volta, F2 cliente, F3 produtos, etc.).
- "Ajuda da tela" (link para doc).
- "Importar foto / PDF" (se fizer sentido aqui também).

Alternativa mais minimalista: manter só o ícone `?` (HelpCircle) no canto do stepper do rodapé, abrindo o mesmo dialog de atalhos. **Recomendo a primeira opção** (dentro de "Mais ações") para manter a barra superior limpa e consistente com Pedidos.

## Arquivos afetados

- `src/pages/vendas/NovaVenda.tsx` — remontar header (card da data) e mover stepper para rodapé com setas.
- `src/components/layout/Header.tsx` — ligar o botão IA global ao painel do assistente quando estiver em Nova Venda.
- `src/pages/MeuPerfil.tsx` — novo bloco "Preferências de interface" com o toggle de versão.
- Sem alterações de schema, rotas ou lógica de negócio.

## Pendente de confirmação

1. OK em adotar a sugestão do item 5 (atalhos dentro de "Mais ações") em vez de um botão dedicado?
2. Manter o toggle "Antiga/Nova" também visível no card da data, ou deixar exclusivamente no perfil?
