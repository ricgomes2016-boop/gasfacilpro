

## Plano: Tornar Nova Venda e Editar Pedido responsivos para mobile

### Problemas identificados

**EditarPedido.tsx:**
- `grid grid-cols-4` (Logradouro + Nº) não colapsa em telas < 400px — campos ficam espremidos
- `grid grid-cols-3` (CEP + Complemento + Coordenadas) idem
- `grid grid-cols-2` (Bairro + Cidade) fica apertado em 384px
- A sidebar do resumo (`lg:grid-cols-3`) empilha corretamente, mas o conteúdo interno das cards de endereço não

**NovaVenda.tsx:**
- A barra de IA com 4 botões de ação (mic, foto, câmera, enviar) pode transbordar em telas estreitas
- O layout principal (`lg:grid-cols-3`) já empilha, mas falta padding/spacing adequado

### Correções

**1. EditarPedido.tsx — Colapsar grids de endereço no mobile**
- Logradouro + Nº: `grid grid-cols-4` → `grid grid-cols-1 sm:grid-cols-4` (empilha no mobile, Nº fica abaixo)
- CEP + Complemento + Coords: `grid grid-cols-3` → `grid grid-cols-2 sm:grid-cols-3` (coords some no mobile, já é informacional)
- Bairro + Cidade: manter `grid-cols-2` mas com `gap-2` no mobile

**2. NovaVenda.tsx — Barra de IA mais compacta**
- Botões da barra de IA: agrupar em layout que quebra linha naturalmente (já usa `flex-wrap`, verificar se está funcionando)
- Garantir que inputs tenham `min-w-0` para não forçar overflow

**3. Ambas as telas — Ajustes gerais**
- Padding consistente: `p-3 sm:p-4 md:p-6` (EditarPedido já tem, NovaVenda usa `p-4 md:p-6`)
- Garantir `overflow-x-hidden` no container principal para evitar scroll horizontal

### Arquivos
- `src/pages/vendas/EditarPedido.tsx` — grids de endereço responsivos
- `src/pages/vendas/NovaVenda.tsx` — padding e barra de IA compacta

