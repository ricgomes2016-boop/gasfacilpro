

## Plano: Adicionar botão de navegação para Rota de Entrega na tela de Transferência entre Filiais

### Contexto
A tela de Transferência de Estoque (`/estoque/transferencia`) não possui um atalho direto para a Gestão de Rotas. O usuário precisa navegar manualmente.

### Alteração

**Arquivo:** `src/pages/estoque/TransferenciaEstoque.tsx`

- Adicionar um botão "Ir para Rota de Entrega" no topo da página (próximo ao título ou ao lado do botão de nova transferência)
- O botão navega para `/operacional/rotas` usando `useNavigate`
- Ícone: `Truck` ou `Route` do Lucide
- Estilo: `variant="outline"` para não competir com ações principais

### Detalhes técnicos
- Importar `useNavigate` do React Router e ícone `Truck` do Lucide
- Posicionar o botão no header da página, alinhado à direita
- Um único arquivo modificado

