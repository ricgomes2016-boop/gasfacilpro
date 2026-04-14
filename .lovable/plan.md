

## Plano: Botão "Atualizar App" no app do entregador e no sistema administrativo

### O que será feito

Adicionar uma opção de **atualizar o app** em dois lugares:

1. **App do Entregador** — No menu do perfil (`EntregadorPerfil.tsx`), adicionar um item "Atualizar App" que força a atualização do Service Worker e recarrega a página
2. **Sistema Administrativo** — No dropdown do usuário no header (`Header.tsx`), adicionar um item "Atualizar Sistema" com a mesma lógica

### Como funciona

A função de atualização vai:
- Verificar se há um Service Worker registrado
- Chamar `registration.update()` para buscar nova versão
- Limpar caches antigos do navegador (`caches.delete`)
- Recarregar a página com `window.location.reload()`
- Exibir um toast "Verificando atualizações..." durante o processo

### Arquivos modificados

1. **`src/pages/entregador/EntregadorPerfil.tsx`** — Adicionar item "Atualizar App" com ícone `RefreshCw` no menu, antes do botão "Sair"
2. **`src/components/layout/Header.tsx`** — Adicionar item "Atualizar Sistema" com ícone `RefreshCw` no dropdown do usuário, antes de "Sair"

### Detalhes técnicos

```typescript
// Função reutilizada nos dois locais
const handleUpdateApp = async () => {
  toast.info("Verificando atualizações...");
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();
  }
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  window.location.reload();
};
```

