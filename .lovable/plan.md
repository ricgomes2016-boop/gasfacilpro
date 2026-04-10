

## Corrigir campo de digitação do Chat com Entregadores

### Problema
O painel de chat usa `bottom-0` no mobile e `md:bottom-6` no desktop, mas a `MobileBottomBar` (altura ~52px, z-40) fica por cima do campo de input. No desktop, o rodapé também cobre parcialmente.

### Solução

**Arquivo: `src/components/chat/ChatOperador.tsx`**

1. **Mobile**: Elevar o painel acima da barra inferior — mudar de `bottom-0` para `bottom-[52px]` e reduzir altura de `h-[80vh]` para `h-[calc(80vh-52px)]` para não ultrapassar o topo da tela
2. **Desktop**: Aumentar `md:bottom-6` para `md:bottom-16` para ficar acima do rodapé desktop
3. **Z-index**: Subir para `z-50` para garantir que fique acima da `MobileBottomBar` (z-40)
4. Adicionar `pb-safe` (safe-area) no container do input para dispositivos com notch

Alteração em 1 arquivo, ~3 linhas modificadas na classe CSS do container principal (linha 183).

