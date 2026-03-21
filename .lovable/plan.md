

# Trocar "Repetir última venda" por "Nova Venda" com modal

## O que muda

Na tela Nova Venda (`/vendas/nova`), substituir o botão "Repetir última venda" por um botão "Nova Venda" que abre um modal fullscreen com uma nova instância da tela de vendas — reutilizando o `NovaVendaModal` que já existe no projeto.

## Alterações

### Arquivo: `src/pages/vendas/NovaVenda.tsx`

1. **Remover** a função `handleRepetirUltimaVenda` e a importação de `RotateCcw`
2. **Adicionar** estado `const [showNovaVendaModal, setShowNovaVendaModal] = useState(false)`
3. **Importar** `NovaVendaModal` de `@/components/vendas/NovaVendaModal`
4. **Substituir** o botão (linha 895-898):
   - De: `Repetir última venda` com ícone `RotateCcw`
   - Para: `Nova Venda` com ícone `PlusCircle`, que seta `showNovaVendaModal = true`
5. **Renderizar** `<NovaVendaModal open={showNovaVendaModal} onClose={() => setShowNovaVendaModal(false)} />` no final do componente

O modal já existe e funciona em fullscreen — nenhum componente novo é necessário.

