
## Objetivo
Adicionar a Bia (assistente IA) no site institucional `/fortegas` (e opcionalmente `/centralgascp`) como um chat flutuante que conversa com o cliente, identifica o cadastro, recebe o pedido e lança automaticamente no ERP — exatamente como já faz hoje pela telefonia ElevenLabs.

## Viabilidade
Sim, totalmente viável. A infraestrutura já existe:
- Edge function `elevenlabs-bia-tools` já sabe **identificar cliente por telefone** e **criar pedido** no sistema (cliente + pedido + itens + chamada registrada).
- Hoje ela atende voz (Twilio → ElevenLabs). Vamos reaproveitar a mesma lógica em **chat de texto no site**.

## Arquitetura proposta

```text
Cliente no site  →  Widget de Chat (Bia)  →  Edge Function "bia-site-chat"
                                                      ↓
                                          Gemini (Lovable AI) com tools
                                                      ↓
                          ┌───────────────────────────┼───────────────────────────┐
                          ↓                           ↓                           ↓
                  identificar_cliente            criar_pedido              consultar_produtos
                  (busca por telefone)     (cliente + pedido + itens)     (preços da unidade)
```

A função reutiliza a mesma lógica de `elevenlabs-bia-tools` (já testada), só muda a interface: texto em vez de voz.

## Fluxo da conversa (exemplo Forte Gás)
1. Cliente abre `/fortegas`, vê botão flutuante **"Falar com a Bia"** (canto inferior direito).
2. Bia: *"Oi! Sou a Bia da Forte Gás. Pra agilizar, me passa seu telefone com DDD?"*
3. Cliente digita → Bia chama `identificar_cliente`:
   - **Encontrado**: *"Achei aqui, João! Confirma o endereço Rua X, 123 - Centro?"*
   - **Novo**: *"Beleza! Me passa nome completo e endereço (rua, número, bairro)."*
4. Bia: *"O que você precisa? Temos P13, P20, P45 e Água 20L."*
5. Cliente: *"1 P13"* → Bia confirma valor e chama `criar_pedido`.
6. Pedido cai no ERP em **status pendente** → aparece imediatamente para o atendente / dispara notificação para os admins / abre popup de chamada recebida (já existe esse trigger).
7. Bia: *"Pronto! Pedido #145 confirmado. Entregador chega em até 30 min. 🛵"*

## Mudanças necessárias

### 1. Nova Edge Function: `bia-site-chat`
- Recebe histórico do chat + mensagem nova + slug da unidade (`fortegas` ou `centralgascp`).
- Usa **Lovable AI Gateway** (`google/gemini-2.5-flash`) com **tool calling**.
- Tools expostas ao modelo:
  - `identificar_cliente(telefone)`
  - `consultar_produtos()` (lista P13/P20/P45/Água com preços da unidade)
  - `criar_pedido(...)` 
- Resolve a unidade pelo slug recebido (não fica hardcoded como hoje).
- Registra `chamadas_recebidas` com tipo `"site"` para abrir o popup CallerID no painel.

### 2. Componente novo: `<BiaChatWidget />`
- Botão flutuante (canto inferior direito) com ícone de chat e badge "Online".
- Ao clicar abre painel de chat (estilo WhatsApp), responsivo para mobile.
- Mantém histórico em `sessionStorage` (não some ao recarregar).
- Indicador "Bia está digitando…" enquanto aguarda resposta.

### 3. Integração nas páginas públicas
- Adicionar `<BiaChatWidget unidadeSlug="fortegas" nomeLoja="Forte Gás" cor="magenta" />` em `src/pages/publico/ForteGas.tsx`.
- (Opcional) Adicionar em `CentralGasCP.tsx` com `unidadeSlug="centralgascp"`.

### 4. Configuração por unidade (opcional, mas recomendado)
- Adicionar toggle no painel **Configurações → Site Institucional**:
  - "Ativar Bia no site" (on/off)
  - "Mensagem de boas-vindas" (texto livre)
- Salvo em `configuracoes_empresa` (JSONB por unidade — padrão já usado no projeto).

## Arquivos a criar/editar
- `supabase/functions/bia-site-chat/index.ts` (novo)
- `src/components/publico/BiaChatWidget.tsx` (novo)
- `src/pages/publico/ForteGas.tsx` (adicionar widget)
- `src/pages/publico/CentralGasCP.tsx` (adicionar widget)
- `src/pages/config/SiteInstitucional.tsx` (adicionar toggle e mensagem de boas-vindas — opcional)

## Custos / dependências
- Usa **Lovable AI** (Gemini 2.5 Flash) — sem API key extra, já configurado.
- Sem necessidade de ElevenLabs, Twilio ou WhatsApp para esse fluxo (é texto puro no site).

## Validação
- Abrir `/fortegas` → clicar no botão da Bia → simular pedido completo.
- Confirmar que o pedido aparece em **Vendas → Pedidos** da unidade Forte Gás com status `pendente`.
- Confirmar que o popup CallerID abre no painel da unidade correta.
- Testar cliente novo (sem cadastro) e cliente existente.
- Testar no mobile (384px).
