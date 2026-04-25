Plano para deixar o menu com fundo preto e ajustar as fontes

1. Menu lateral desktop
- Trocar o fundo atual semitransparente do `Sidebar` para preto/near-black consistente.
- Ajustar bordas e divisórias para tons escuros sutis, evitando o visual acinzentado claro.
- Deixar textos principais em branco com boa hierarquia: títulos mais fortes, itens de menu legíveis e submenus com contraste maior.
- Manter o destaque do item ativo com a cor primária do sistema, sem mudar rotas ou comportamento.

2. Submenus e estados de interação
- Melhorar hover, item ativo e submenu aberto para funcionar bem sobre fundo preto.
- Ajustar opacidade das fontes dos submenus para não ficarem apagadas.
- Preservar os ícones coloridos atuais, pois ajudam na identificação visual dos módulos.

3. Rodapé do usuário e seletor de unidade
- Adaptar o card do usuário e o seletor de loja para o novo fundo preto.
- Garantir que nome, cargo, botão de sair e loja selecionada tenham contraste suficiente.

4. Menu mobile
- Aplicar o mesmo padrão preto ao menu lateral mobile (`MobileNav`) para manter consistência entre desktop e celular.
- Ajustar fontes e estados ativos/hover no mobile com o mesmo padrão visual.

5. Barra inferior mobile
- Se necessário, ajustar a `MobileBottomBar` para combinar com o novo menu preto, mantendo legibilidade dos botões Chat, IA e Calc.

Arquivos previstos
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/MobileNav.tsx`
- `src/components/layout/MobileBottomBar.tsx`