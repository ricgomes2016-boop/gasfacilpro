

## Plano: Atualizar menu do entregador + novas páginas

### Resumo
Reordenar o menu do entregador colocando "Nova Venda" no lugar de "Produtividade" na barra inferior, e adicionar duas novas páginas: "Contas a Prazo" e "Devoluções/Trocas".

### Alterações

**1. `src/components/entregador/EntregadorLayout.tsx`**
- Reordenar `menuItems`: mover "Nova Venda" para a posição 4 (índice 3), substituindo "Produtividade" na barra inferior (que exibe `slice(0, 4)`)
- Adicionar dois novos itens ao menu lateral:
  - `{ path: "/entregador/contas-prazo", icon: HandCoins, label: "Contas a Prazo" }`
  - `{ path: "/entregador/devolucoes", icon: RotateCcw, label: "Devoluções/Trocas" }`

Nova ordem dos 4 primeiros (barra inferior):
1. Início
2. Jornada
3. Entregas
4. Nova Venda

**2. Criar `src/pages/entregador/EntregadorContasPrazo.tsx`**
- Página para o entregador registrar recebimentos de contas a prazo (fiado) durante a rota
- Layout usando `EntregadorLayout`
- Lista de contas pendentes do cliente com opção de registrar pagamento

**3. Criar `src/pages/entregador/EntregadorDevolucoes.tsx`**
- Página de devoluções/trocas adaptada para o contexto mobile do entregador
- Layout usando `EntregadorLayout`
- Formulário simplificado para registrar devolução ou troca durante a entrega

**4. `src/routes/entregadorRoutes.ts`**
- Adicionar rotas:
  - `/entregador/contas-prazo` → `EntregadorContasPrazo`
  - `/entregador/devolucoes` → `EntregadorDevolucoes`

**5. `.github/workflows/android-build.yml`**
- Nenhuma alteração necessária no workflow — o APK será atualizado automaticamente no próximo push, pois o workflow roda em cada push na branch main

### Escopo
- 2 arquivos modificados, 2 arquivos criados
- Zero mudanças de banco (reutiliza tabelas existentes)
- O APK será regenerado automaticamente pelo GitHub Actions após o push

