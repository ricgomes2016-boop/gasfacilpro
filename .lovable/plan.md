# Webhook da Meta — status atual e o que falta

## Situação verificada (sem alterar nada)

Existe um endpoint de webhook da Meta já implementado: a função `meta-webhook`, com verificação GET (`hub.mode`/`hub.verify_token`/`hub.challenge`) e validação de assinatura `X-Hub-Signature-256`.

Porém ele é **exclusivo de WhatsApp**: o código ignora qualquer payload cujo `object` não seja `whatsapp_business_account`, e só processa `changes.field === "messages"`. Não há tratamento de eventos de **Instagram** (`object: "instagram"`) nem de **Página do Facebook** (`object: "page"`), como comentários, menções ou mensagens de Direct.

**Token de verificação** — onde fica:
- Guardado por unidade na tabela `integracoes_whatsapp`, coluna `meta_verify_token`, com `provedor = 'meta'`.
- O webhook lê esse valor quando a URL de callback traz `?unidade_id=<id da unidade>`.
- Sem `unidade_id` na URL, ele cai num valor padrão fixo embutido no código (não é secreto, o que é uma fragilidade).
- Hoje existe token cadastrado apenas para a unidade **Central Gas**. Para a **Forte Gás não há registro `provedor = 'meta'`**, ou seja, ainda **é preciso criar o token de verificação** dela.

**URL de callback**: por segurança não coloco o endereço do backend aqui no chat. Ele aparece pronto para copiar dentro do próprio sistema, em Marketing → Redes Sociais → bloco "Diagnóstico da conexão Meta" — é o mesmo endereço base, trocando o final `meta-oauth-callback` por `meta-webhook`, acrescido de `?unidade_id=<id da unidade Forte Gás>`.

## Proposta de implementação

1. **Exibir a URL de webhook pronta na tela**: estender o bloco de diagnóstico em Marketing → Redes Sociais para mostrar, além do redirect OAuth, a URL completa de webhook já com o `unidade_id` da unidade ativa, com botão copiar.
2. **Criar/registrar o verify token da Forte Gás**: gerar um token forte e gravá-lo em `integracoes_whatsapp` (`provedor = 'meta'`) para a unidade da Forte Gás, exibindo-o uma única vez na tela para colar no Meta Developers.
3. **Remover o fallback fixo** de verify token no `meta-webhook`: sem `unidade_id` válido ou sem token cadastrado, responder 403.
4. **Aceitar eventos de Instagram e Página**: no `meta-webhook`, tratar também `object: "instagram"` e `object: "page"`, registrando os eventos recebidos (comentários, menções, mensagens) em tabela de eventos, sem quebrar o fluxo atual do WhatsApp.

## Detalhes técnicos

- Arquivos: `supabase/functions/meta-webhook/index.ts`, `src/components/marketing/DiagnosticoMetaOAuth.tsx`, `src/pages/marketing/RedesSociais.tsx`.
- A verificação GET continua respondendo o `hub.challenge` em texto puro com status 200.
- A validação HMAC com o segredo do app permanece obrigatória para POST.
- Persistência dos eventos IG/Page com `empresa_id` e `unidade_id` explícitos, respeitando o isolamento multiempresa e com RLS + GRANT na criação da tabela.
