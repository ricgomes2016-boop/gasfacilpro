## Por que a foto não aparece

A unidade da **Central Gás** que você está usando está conectada via **Meta Cloud API** (`provedor = meta`). A API oficial da Meta **não expõe foto de perfil/status de clientes finais** — só devolve a foto do próprio número da loja. Por isso `ai_conversas.foto_url` fica `NULL` e o painel mostra só as iniciais.

O WhatsApp Web mostra a foto porque ele usa o protocolo Baileys (multi-device), o mesmo que a **Evolution API** usa. Hoje só `fetchContactProfilePicture` na Evolution e na Z‑API consegue buscar a foto do contato.

Além disso, mesmo quando a foto é buscada, a URL retornada (`pps.whatsapp.net/...`) é **temporária (expira em ~24 h)** e tem CORS/hot‑link bloqueado em muitos casos — então salvar a URL crua no banco também quebra.

## O que vou fazer

### 1. Fallback de provedor em `whatsapp-refresh-profile`

Atualizar `supabase/functions/whatsapp-refresh-profile/index.ts`:

- Quando o provedor da unidade do pedido é **Meta** (ou retorna `null`), tentar automaticamente, **na mesma empresa**, qualquer instância **Evolution ativa** (`status_conexao in ('conectado','open')`) como "buscador de fotos". A foto da loja continua vindo do provedor primário.
- Ordem de tentativa para foto do contato: `evolution (mesma empresa) → zapi (mesma empresa) → provedor primário`.
- Em `_shared/bia-core.ts` adicionar helper `resolveAnyEvolutionForEmpresa(supabase, empresa_id)` que devolve um `BiaConfig` Evolution ativo da empresa para reuso.

### 2. Cache da imagem em Supabase Storage (resolve expiração + CORS)

- Bucket público novo `whatsapp-avatars` (criar via migration).
- Em `whatsapp-refresh-profile`, depois de obter a URL temporária do WhatsApp, baixar o blob no edge function e fazer `storage.upload('whatsapp-avatars', '{conversa_id}.jpg', ...)` com `upsert: true`.
- Salvar em `ai_conversas.foto_url` a **URL pública do Storage** (estável), não a do `pps.whatsapp.net`.
- Mesmo tratamento para a foto da loja: salvar em `integracoes_whatsapp.loja_foto_url` a URL do Storage.

### 3. Re-sync automático quando estiver velho

- O efeito que já existe em `WhatsAppInbox.tsx` (linha 220) que faz background fetch para conversas sem `foto_url` passa a também re-enfileirar quando `foto_atualizada_em < now() - 7 dias` (renovação preventiva, já que a Evolution caching local segue válido por mais tempo que a URL da Meta).

### 4. Trigger manual no painel

- O botão "Atualizar foto do perfil" no `ContactDetailsPanel` já chama `whatsapp-refresh-profile`. Como agora ele tem fallback + cache, vai começar a funcionar para os contatos da unidade Meta.
- Exibir mensagem específica quando nenhum provedor da empresa consegue buscar (ex.: empresa só tem Meta sem Evolution complementar): "Foto indisponível — conecte uma instância Evolution na empresa para habilitar fotos de contatos".

## Arquivos tocados

- `supabase/functions/whatsapp-refresh-profile/index.ts` — fallback de provedor + upload no Storage.
- `supabase/functions/_shared/bia-core.ts` — helper `resolveAnyEvolutionForEmpresa`.
- Nova migration: criar bucket público `whatsapp-avatars` + policy de leitura pública.
- `src/components/atendimento/WhatsAppInbox.tsx` — adicionar re-sync para fotos > 7 dias e mensagem de "indisponível" quando edge function retornar `reason: "no_provider_for_contact_picture"`.

## Fora de escopo

- Não vou trocar o provedor principal da unidade; Meta continua sendo o canal de mensagens.
- Não vou implementar fetch via Baileys próprio — reuso da Evolution já configurada.
- Sem mudanças visuais no `ContactDetailsPanel` além da mensagem de status.
