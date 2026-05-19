# Boleto Asaas integrado à Nova Venda + Envio + Canhoto Assinado

## 1. Gerar boleto Asaas automaticamente ao confirmar a venda

**Onde:** `src/pages/vendas/NovaVenda.tsx` (fluxo de finalizar pedido) + `src/components/vendas/PaymentSection.tsx`.

- Quando a forma de pagamento for **Boleto** (ou **PIX Asaas**), após gravar o pedido:
  1. Garantir/criar `customer` no Asaas (busca por CPF/CNPJ; cria se não existir) — reusando `supabase/functions/asaas-api`.
  2. Criar `payment` (boleto ou pix) com `dueDate` = data de entrega + N dias (configurável, default 3) e `externalReference` = id do pedido.
  3. Inserir registro em `contas_receber` já com `asaas_id`, `boleto_url`, `linha_digitavel`, `pix_copia_cola`.
- Toast com link "Ver boleto" + opção "Enviar agora".
- Se falhar (sem CPF, Asaas off, etc.), grava a venda normal e mostra alerta amarelo "Boleto não emitido — gere manualmente em Contas a Receber".

## 2. Envio por WhatsApp

**Novo botão** no `EmitirBoletoAsaasDialog` e no toast pós-venda:

- Usa o provider WhatsApp já configurado na unidade (Z-API/Meta/Evolution — `whatsappRealtimeService`).
- Mensagem template:
  ```
  Olá {nome}! Segue seu boleto da {empresa}:
  💰 R$ {valor} — vencimento {data}
  🔗 {boleto_url}
  📋 PIX copia-e-cola: {pix_payload}
  ```
- Telefone vem do cliente do pedido; se faltar, abre input.

## 3. Envio por e-mail

- Botão "Enviar e-mail" chama endpoint `/payments/{id}/email` do Asaas via `asaas-api` (Asaas dispara o e-mail oficial com PDF anexo).
- Se cliente sem e-mail, pede no diálogo antes.

## 4. Assinatura simples no app do entregador (canhoto digital)

**Substitui a discussão de A1 no boleto** — A1 ICP-Brasil não faz sentido em boleto. Em vez disso, comprovante de entrega assinado pelo cliente no celular do entregador:

- Nova tela `src/pages/entregador/AssinarEntrega.tsx`:
  - Mostra resumo do pedido (cliente, itens, valor, forma pgto).
  - Canvas de assinatura (`react-signature-canvas`) + campo "Nome de quem recebeu" + foto opcional do local.
  - Captura geolocalização + timestamp.
- Ao salvar:
  - Upload da imagem PNG da assinatura para Storage bucket `comprovantes-entrega/{pedido_id}.png`.
  - Cria registro em nova tabela `comprovantes_entrega` (pedido_id, assinatura_url, nome_recebedor, lat, lng, assinado_em, foto_url).
  - Marca pedido como `entregue` + dispara webhook de status (já existe).
- No ERP (detalhes do pedido / contas a receber), botão "Ver canhoto assinado" mostra a imagem + dados.
- PDF do canhoto pode ser gerado on-demand (pdf-lib) e enviado por WhatsApp/e-mail ao cliente.

> Observação: assinatura no canvas é **assinatura eletrônica simples** (MP 2.200-2 art. 10 §2º) — válida juridicamente entre as partes desde que haja vínculo de autoria (telefone/CPF + geolocalização + timestamp), o que cobriremos.

## Detalhes técnicos

- **Edge Function `asaas-api`** ganha 2 novas ações: `criarCobrancaCompleta` (customer+payment numa chamada) e `enviarEmail`.
- **Migração** (`supabase--migration`):
  - `contas_receber`: adicionar `pix_copia_cola text`, `linha_digitavel text` (se não existirem).
  - Nova tabela `comprovantes_entrega` com RLS por `empresa_id`/`unidade_id`.
  - Bucket Storage `comprovantes-entrega` (privado, com policies por unidade).
- **Dependência nova:** `react-signature-canvas` (~30kb).
- **Rota nova entregador:** `/entregador/entrega/:pedidoId/assinar` em `entregadorRoutes.ts`.
- Reutiliza `whatsappRealtimeService` — zero secret novo.

## Ordem de implementação

1. Migration (tabela canhoto + colunas em contas_receber + bucket).
2. Estender `asaas-api` (createCustomer/createPayment/sendEmail).
3. Hook `useEmitirBoletoVenda` chamado no submit da Nova Venda.
4. Botões WhatsApp/E-mail no `EmitirBoletoAsaasDialog` + toast pós-venda.
5. Tela `AssinarEntrega` no app entregador + visualização no ERP.
6. Geração de PDF do canhoto + envio opcional.

## Fora do escopo

- Assinatura A1 ICP-Brasil no PDF do boleto (sem valor legal adicional).
- Conciliação automática de baixa via webhook Asaas (já existe parcialmente em `Asaas Payments`).
