# Ajustes no /chat (WhatsAppInbox) — fotos, áudio e arquivos

## 1. Foto de perfil do cliente (avatar nas conversas)

**Onde aparece hoje:** Sidebar (lista) e header da conversa mostram apenas as iniciais em um círculo cinza.

**Plano:**
- Adicionar coluna `foto_url text` em `ai_conversas`.
- Atualizar webhooks de entrada para popular `foto_url` quando o provedor disponibilizar:
  - **Evolution**: chamar `/chat/fetchProfilePictureUrl` (já existe no Evolution API) usando o número do remetente; salvar a URL retornada.
  - **Z-API**: usar endpoint `/profile-picture` por número.
  - **uazapi / gateway**: idem (cada um tem seu endpoint equivalente).
  - **Meta Cloud API**: **não expõe** foto de perfil de clientes finais por restrição de privacidade — fica como iniciais (fallback).
- Atualizar a foto no máximo 1x por dia (cache em `metadata` da conversa) para não estourar rate limit.
- No `WhatsAppInbox.tsx`: trocar os dois círculos com iniciais por `<img src={conv.foto_url}>` com fallback automático para iniciais quando vazio/erro.

## 2. Botões de áudio e arquivos (envio de mídia)

**Hoje:** botões `Paperclip` e `Mic` existem visualmente mas não fazem nada. `whatsapp-send` só envia texto. Mensagens de mídia recebidas não são renderizadas (só texto).

**Plano (frontend):**
- **Anexar arquivo:** clique no Paperclip abre input file (image/* , application/pdf, etc.). Arquivo é enviado para um novo bucket `chat-anexos` (privado, RLS por `empresa_id`), e dispara `whatsapp-send` com `{ media_url, media_type, filename, caption? }`.
- **Áudio:** clique no Mic inicia gravação via `MediaRecorder` (formato `audio/webm` → opus). Botão muda para "stop / cancelar / enviar". Ao confirmar, sobe para o bucket e dispara `whatsapp-send` com `{ media_url, media_type: "audio" }`.
- Renderização das mensagens: detectar `metadata.media_type` e mostrar:
  - imagem → `<img>` clicável (abre lightbox simples)
  - áudio → `<audio controls>` com player nativo
  - documento → card com ícone + nome do arquivo + botão download
  - vídeo → `<video controls>`
  - mantém bolha verde/branca conforme `role`.

**Plano (backend `whatsapp-send` + `_shared/bia-core.ts`):**
- Estender o body aceito: `{ conversa_id, content?, unidade_id, media_url?, media_type?, filename?, mime_type? }`.
- Adicionar função `sendMedia(config, phone, { media_url, media_type, filename, caption })` em `bia-core.ts` cobrindo:
  - **Evolution**: `POST /message/sendMedia/{instance}` (image/document/video) e `/message/sendWhatsAppAudio/{instance}` (áudio PTT).
  - **Z-API**: `/send-image`, `/send-audio`, `/send-document`.
  - **uazapi / gateway**: endpoints equivalentes.
  - **Meta Cloud**: precisa primeiro fazer upload em `/v21.0/{phone_id}/media` e depois enviar referenciando o `media_id`.
- Salvar a mensagem em `ai_mensagens` com `metadata = { source, provedor, media_url, media_type, mime_type, filename }`.

**Webhooks de entrada:** já transcrevem áudio recebido (vira texto). Adicionalmente, salvar a `media_url` original em `metadata` para permitir tocar o áudio original na inbox (clientes esperam ouvir, não só ler).

## 3. Foto de perfil do WhatsApp da loja

**Hoje:** o header da sidebar mostra um ícone genérico de usuário.

**Plano:**
- Adicionar coluna `loja_foto_url text` em `integracoes_whatsapp`.
- Edge function `whatsapp-refresh-profile` (chamada 1x ao abrir o /chat, ou cron diário) que busca a foto:
  - **Meta**: `GET /v21.0/{phone_id}/whatsapp_business_profile?fields=profile_picture_url`.
  - **Evolution**: `GET /chat/fetchProfilePictureUrl/{instance}` com o próprio número.
  - **Z-API**: `GET /profile-picture` com o próprio número.
- Frontend lê via `useUnidade` + select em `integracoes_whatsapp` e exibe no avatar do header da sidebar (com fallback para `User` icon).

## Detalhes técnicos / segurança

- **Bucket `chat-anexos`** (Lovable Cloud Storage):
  - privado
  - políticas: SELECT/INSERT permitidas para usuários autenticados da mesma `empresa_id` (path `{empresa_id}/{conversa_id}/{filename}`).
  - URL assinada (signed URL, 7 dias) é o que vai pro WhatsApp + salvo em `ai_mensagens.metadata.media_url`.
- **RLS** das novas colunas: já coberto pelas policies existentes em `ai_conversas` e `integracoes_whatsapp` (tenant por `empresa_id`).
- **Mobile**: `MediaRecorder` requer HTTPS (já temos) e permissão de microfone — tratar `getUserMedia` rejeitado com toast.
- **Limite de tamanho**: 16 MB (Meta). Validar no frontend antes do upload.

## Arquivos afetados (estimativa)

- Migration: `ai_conversas.foto_url`, `integracoes_whatsapp.loja_foto_url`, bucket `chat-anexos` + policies.
- `supabase/functions/_shared/bia-core.ts` — novo `sendMedia` + helpers de profile pic.
- `supabase/functions/whatsapp-send/index.ts` — aceitar mídia.
- Nova edge function `whatsapp-refresh-profile`.
- Webhooks (`meta-webhook`, `evolution-webhook`, `zapi-webhook`, `uazapi-webhook`, `gateway-webhook`) — popular `foto_url` e salvar `media_url` da entrada.
- `src/components/atendimento/WhatsAppInbox.tsx` — avatares com `<img>`, renderização de mídia, gravação de áudio, upload de arquivo.

## Fora de escopo

- Emoji picker (Smile button continua decorativo).
- Lightbox/galeria avançada (usaremos clique simples → abrir em nova aba).
- Sticker, localização, contato — só image/audio/document/video.
