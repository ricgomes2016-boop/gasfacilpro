
## Diagnóstico

O pedido criado pela Bia no site cai no banco com `status = pendente`, mas **não disparou popup nem som** no painel. Analisando o código:

1. **`bia-site-chat`** insere em `chamadas_recebidas` com `tipo: "voip"` — isso aciona o popup CallerID. Mas se a unidade não tiver telefonia VoIP configurada/ouvindo esse evento corretamente para origem "site", o popup não abre.
2. **Não existe alerta global no ERP** para "pedido pendente sem interação". Hoje só o app do entregador (`EntregadorEntregas.tsx`) tem alarme sonoro/visual para pedidos pendentes — o painel administrativo (Dashboard / Pedidos) **não tem isso**.
3. A notificação via `fn_notificar_admins_pedido` (trigger no INSERT de `pedidos`) cria um registro em `notificacoes`, mas é silenciosa (sininho do header) — sem som, sem popup modal.

## Objetivo

Garantir que **todo pedido pendente sem interação** (independente da origem: Bia site, WhatsApp, telefone, balcão) gere:
- **Popup visual modal** no painel do ERP (não só sininho)
- **Alarme sonoro** contínuo até o atendente interagir
- **Escalação**: se passar de X minutos sem aceite, alarme fica urgente (mais alto / vermelho piscando)

## Plano

### 1. Novo hook global: `usePedidosPendentesAlert`
- Roda em todo o ERP (montado uma vez no layout principal autenticado).
- Faz polling a cada 10s + Realtime na tabela `pedidos` filtrado pela `unidade_id` ativa do usuário.
- Detecta pedidos com `status = 'pendente'` E sem entregador atribuído E sem interação registrada.
- Mantém um set de IDs já "vistos" para não re-alarmar.

### 2. Componente: `<PedidoPendenteAlertProvider />`
- Renderiza um **modal/popup persistente** (não fechável por clique fora) quando há pedido pendente novo.
- Mostra: nome do cliente, telefone, endereço, itens, valor, **tempo de espera em vermelho piscando**, canal de origem (Bia/WhatsApp/Telefone/Balcão).
- Botões: **"Aceitar / Ir para Pedido"** (leva pra `/vendas/pedidos` e marca como visto) e **"Adiar 1 min"** (snooze curto).
- Toca alarme sonoro (reaproveitando `useDeliveryAlarm` que já existe).
- Mostra contador de pedidos pendentes empilhados se houver mais de um.

### 3. Lógica de escalação
- 0–5 min: bipe normal a cada 30s.
- 5–10 min: bipe a cada 15s + borda amarela.
- 10+ min: alarme contínuo + borda vermelha pulsando + título do navegador piscando "🔴 PEDIDO URGENTE".

### 4. Notificação Push do navegador
- Reaproveitar `useNotifications` já existente.
- Disparar notification nativa quando o ERP estiver em outra aba.

### 5. Configuração
- Adicionar toggle no header (igual ao do entregador): **🔔 Som Ativo / Mudo**.
- Salvo em `localStorage` por usuário.

### 6. Integração
- Montar `<PedidoPendenteAlertProvider />` no `Layout` autenticado do ERP (uma única vez), respeitando `unidadeAtual` selecionada.

## Arquivos a criar/editar

**Novos:**
- `src/hooks/usePedidosPendentesAlert.ts`
- `src/components/alerts/PedidoPendenteAlertProvider.tsx`
- `src/components/alerts/PedidoPendenteModal.tsx`

**Editar:**
- `src/components/layout/Layout.tsx` (ou equivalente do ERP) — montar o provider
- `supabase/functions/bia-site-chat/index.ts` — trocar `tipo: "voip"` por algo que não confunda com chamadas reais (ex: `tipo: "site_ia"`) e garantir que `observacoes` contenha "Pedido criado pela Bia (site)" para diferenciação visual

## Validação

1. Abrir painel ERP (qualquer rota).
2. Em outra aba, abrir `/fortegas` e fazer um pedido completo pela Bia.
3. Voltar pro painel → modal deve aparecer com som em até 10s.
4. Clicar "Ir para Pedido" → modal fecha, leva pra `/vendas/pedidos`.
5. Criar outro pedido e deixar 10+ min sem aceitar → verificar escalação visual + sonora.
6. Testar com som mudo (toggle).
