## Objetivo

Separar claramente **Origem do Pedido** (de onde o pedido entrou no sistema) de **Canal de Venda** (qual unidade/ponto comercial registrou a venda), padronizando a tabela em `Vendas / Pedidos`.

## Mudanças no banco

Adicionar coluna `origem_pedido` em `pedidos` como enum fixo:

- `telefone_ia`
- `erp`
- `whatsapp`
- `site`
- `app_entregador`
- `app_cliente`
- `portal_parceiro`
- `balcao_pdv`
- `telefone`
- `portaria`
- `assistente_bia`
- `autoatendimento`

**Migração automática dos pedidos antigos** com base no `canal_venda` atual:

```text
telefone_ia / "telefone"          → origem = telefone_ia
whatsapp / WhatsApp                → origem = whatsapp
site_ia                            → origem = site
Aplicativo                         → origem = app_cliente
Entregador                         → origem = app_entregador
portaria / Portaria                → origem = portaria
assistente                         → origem = assistente_bia
Autoatendimento                    → origem = autoatendimento
demais valores (Comercio, Mercado Correia, Prefeitura, Amigao, etc.) → origem = erp
```

Quando o `canal_venda` mapear para uma Origem, esse `canal_venda` é **limpo** (vai para `NULL`) — assim o campo Canal passa a guardar somente canais reais cadastrados em `canais_venda`. Pedidos novos sem Origem informada recebem `erp` por padrão.

## Mudanças na UI — `src/pages/vendas/Pedidos.tsx`

Reordenar as colunas da tabela (desktop e cards mobile) exatamente para:

```text
Origem | Nº Pedido | Data | Cliente | Endereço | Produtos | Entregador | Canal de Venda | Valor | Status | Ações
```

- **Origem**: badge com ícone (📞 Telefone IA, 💬 WhatsApp, 🌐 Site, 🛵 App Entregador, 📱 App Cliente, 🤝 Portal Parceiro, 🏪 Balcão/PDV, 🚪 Portaria, 🤖 Assistente Bia, 🖥️ ERP, etc.). Não editável inline (definida na criação).
- **Canal de Venda**: continua editável via popover, mas o `CommandInput` passa a listar **somente** os canais cadastrados em `canais_venda` — sem opção "criar novo". A linha de fallback que aceitava texto livre é removida.
- Filtros do topo: acrescentar filtro "Origem" (multi-select) ao lado do filtro de Canal.
- Exportação CSV (`header` na linha 65): incluir "Origem" como primeira coluna.

## Pontos de criação de pedido — gravar `origem_pedido`

Ajustar cada fluxo para gravar a origem correta no insert:

- `src/pages/vendas/NovaVenda.tsx` e `PDV.tsx` → `erp` ou `balcao_pdv` (PDV)
- `src/pages/vendedor/VendedorNovaVenda.tsx` → `erp`
- Fluxos do app entregador (`src/pages/entregador/*` que criam pedido) → `app_entregador`
- Fluxos do app cliente (`src/pages/cliente/*` checkout) → `app_cliente`
- Portal do parceiro (vendas de vale) → `portal_parceiro` quando aplicável
- Edge functions/webhooks que criam pedidos via Bia/WhatsApp/Telefone IA → `whatsapp`, `telefone_ia`, `assistente_bia` (sem alterar lógica de canal_venda existente além de não duplicar a origem ali)

## Tipos

- `src/types/pedido.ts`: adicionar `origem_pedido?: OrigemPedido` com union type literal das 12 origens.
- `src/hooks/usePedidos.ts`: incluir `origem_pedido` no select e no mapeamento.

## Fora do escopo

- Não alteramos `canais_venda` nem a tela de cadastro de canais.
- Não mexemos no fluxo de pagamento/roteamento de contas.
- Sem mudanças em relatórios além do CSV de pedidos.

## Detalhe técnico

A migração usa enum Postgres `public.origem_pedido_enum` e um `UPDATE ... CASE` único para preencher os pedidos existentes e limpar `canal_venda` nos casos mapeados. Trigger simples garante default `erp` quando o insert vier sem origem.
