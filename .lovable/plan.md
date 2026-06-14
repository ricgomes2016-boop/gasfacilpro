## Objetivo
Aprimorar a tela `Nova Venda` do portal do vendedor (`vendas.gasfacilpro.com.br`) com três melhorias: busca de cliente mais rica (com foco em endereço), cadastro rápido quando o cliente não existir, e envio do pedido finalizado via WhatsApp para o entregador selecionado.

## 1. Busca de cliente melhorada (unificada com foco em endereço)
- Substituir o input simples por um autocomplete que busca em paralelo por **endereço/rua/bairro/cidade**, **nome** e **telefone**.
- Reusar o RPC `autocomplete_clientes_v2` (já usado no ERP — vide `ClienteAutocompleteInput`) que já retorna endereço/bairro/cidade.
- Resultado mostra: **endereço completo em destaque**, nome abaixo, telefone + bairro como metadados.
- Ordenação: prioriza match em endereço quando o termo digitado parece endereço (contém número ou palavras como "rua", "av").
- Quando nenhum resultado for encontrado (≥3 caracteres), mostrar botão **"+ Cadastrar novo cliente"** logo abaixo, já passando o termo digitado como pré-preenchimento.

## 2. Cadastro rápido de cliente
Modal/sheet acionado pelo botão "+ Cadastrar novo cliente" com os campos:
- **Nome** (obrigatório)
- **Telefone** (obrigatório, com máscara BR)
- **CEP** com auto-preenchimento via ViaCEP → preenche rua, bairro, cidade, UF
- **Número** + **Complemento** + **Ponto de referência**
- **Tipo de cliente**: residencial / comercial (Select)
- **Canal de venda**: select com canais ativos da unidade (`canais_venda`)

Ao salvar:
- Insert em `clientes` com `unidade_id` + `empresa_id` (obrigatório pelas RLS).
- Geocodifica via `geocodeAddress` (Nominatim) se houver endereço completo, salvando `latitude/longitude` para o app do entregador.
- Validação client-side com Zod (nome ≤100, telefone ≥10 dígitos, CEP 8 dígitos).
- Após salvar, o cliente recém-criado vira o cliente selecionado da venda automaticamente, com endereço já pré-preenchido.

## 3. Seleção do entregador + envio por WhatsApp
- Novo bloco "Entregador" (visível quando tipo = entrega): Select carregado de `entregadores` filtrado por `unidade_id` e `ativo = true`. Mostrar apenas entregadores que estão de plantão hoje quando possível (usar `escalas_entregador`); fallback para todos os ativos.
- Cada item do select mostra: nome + telefone.
- Persistir `entregador_id` no `pedidos` (coluna já existe).
- **Ao finalizar** com sucesso o pedido de entrega:
  1. Monta uma mensagem padronizada:
     ```
     🛵 Novo Pedido #ABC123
     👤 Cliente: {nome} ({telefone})
     📍 Endereço: {endereco_entrega}
     📦 Itens:
       • 2x Gás P13 — R$ 240,00
       • 1x Água 20L — R$ 25,00
     💰 Total: R$ 265,00
     💳 Pagamento: PIX
     📝 Obs: {observações}
     ```
  2. Abre `https://wa.me/55{telefone_entregador}?text=...` em nova aba (`encodeURIComponent` no texto).
  3. Toast de confirmação + navegação para `/vendedor/historico`.
- Se o vendedor não tiver selecionado entregador (apenas em entrega), bloquear finalização com toast claro.

## Arquivos a alterar/criar
- `src/pages/vendedor/VendedorNovaVenda.tsx` — refatorar bloco de cliente, adicionar Select de entregador, adicionar envio WhatsApp no `finalizar()`.
- `src/components/vendedor/ClienteSearchVendedor.tsx` (novo) — autocomplete unificado focado em endereço + botão de cadastro.
- `src/components/vendedor/CadastroRapidoClienteModal.tsx` (novo) — Sheet/Dialog com ViaCEP, validação Zod, geocoding, insert em `clientes`.
- `src/components/vendedor/EntregadorSelectVendedor.tsx` (novo) — Select de entregadores ativos da unidade.
- `src/lib/whatsapp/pedidoMessage.ts` (novo) — função pura `buildPedidoWhatsappMessage(pedido, itens, cliente)` para reuso e testabilidade.

## Detalhes técnicos
- **Tenancy**: todo insert em `clientes` inclui `unidade_id` e `empresa_id` (regra Core).
- **Radix Select**: nenhum `SelectItem value=""` — usar `"nenhum"` quando aplicável.
- **Mobile**: usar `ResponsiveDialog` para o cadastro rápido (regra Core), inputs com `text-base` (16px) para evitar zoom iOS.
- **Performance**: `useMemo` para a lista filtrada de entregadores.
- **Segurança**: telefone do entregador sanitizado (`replace(/\D/g, "")`), texto WhatsApp via `encodeURIComponent`, validação Zod no formulário.
- **Sem mudanças** em `App.tsx`, rotas, providers, ou no schema do banco (campos `entregador_id`, `latitude`, `longitude` já existem).

## Fora de escopo
- Não altera a tela `/vendas/nova` do ERP.
- Não envia automaticamente via Evolution/Meta — apenas abre o `wa.me` no app/WhatsApp do vendedor (mais simples, sem custo de API e sem risco de ban).
- Geocoding fica como melhor esforço; falha não bloqueia o cadastro.