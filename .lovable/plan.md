

## Plano: Atualizar credenciais Meta + Página de Diagnóstico WhatsApp

### Contexto do problema

O banco de dados está com credenciais **desatualizadas**:
- Phone Number ID no DB: `975431282330331` (antigo)
- Phone Number ID correto: `1025260084009234`
- WABA ID correto: `898649429546834`
- Token no DB: token antigo (diferente do novo fornecido)
- Número oficial: `4335241094`

A Meta retorna erro 133010 ("Account not registered") porque o número precisa ser registrado na Cloud API via painel Meta, mas o sistema também precisa estar com as credenciais corretas.

### Passo 1 — Atualizar credenciais no banco

Usar o insert tool para atualizar `integracoes_whatsapp` (ID: `ad769548-dbd8-4813-a4c4-372eb4cc75af`) com:
- `meta_phone_number_id` = `1025260084009234`
- `instance_id` = `1025260084009234`
- `meta_waba_id` = `898649429546834`
- `token` e `meta_access_token` = novo token fornecido pelo usuário
- `numero_telefone` = `4335241094`
- `status_conexao` = `desconectado`

### Passo 2 — Criar Edge Function `meta-diagnostico`

Uma função que executa **5 verificações em sequência** e retorna o resultado de cada uma:

1. **Token válido?** — GET `/me?access_token=TOKEN` (verifica se o token é aceito)
2. **WABA acessível?** — GET `/{WABA_ID}?access_token=TOKEN` (verifica acesso à conta business)
3. **Número registrado?** — GET `/{PHONE_ID}?fields=display_phone_number,status,quality_rating` (verifica se retorna dados ou erro 133010)
4. **Registro automático** — POST `/{PHONE_ID}/register` com `messaging_product=whatsapp&pin=123456` (tenta registrar via API)
5. **Envio de teste** — POST `/{PHONE_ID}/messages` com mensagem de texto para um número de teste

Retorna um JSON com status de cada etapa (`ok`, `erro`, `mensagem`).

### Passo 3 — Criar página `/admin/diagnostico-whatsapp`

Uma página admin com:
- **Seleção de unidade** com dropdown
- **Exibição das credenciais atuais** (mascaradas) do banco
- **Botão "Executar Diagnóstico"** que chama a edge function e mostra um checklist visual:
  - Token valido
  - WABA acessível
  - Número registrado
  - Registro via API
  - Envio de mensagem teste
- Cada item com indicador verde/vermelho e mensagem de erro detalhada
- **Campo para número de teste** (para onde enviar a mensagem)
- **Instruções contextuais**: quando um passo falha, mostra exatamente o que fazer no painel Meta

### Passo 4 — Melhorar `AdminWhatsAppConfig`

- Adicionar link para a página de diagnóstico
- Exibir o número de telefone configurado no card da unidade

### Passo 5 — Atualizar rotas

Adicionar `/admin/diagnostico-whatsapp` em `adminRoutes.ts` com role `super_admin`.

### Detalhes técnicos

- A edge function `meta-diagnostico` usa `SUPABASE_SERVICE_ROLE_KEY` para ler credenciais do banco
- Todos os secrets necessários já estão configurados
- A função não requer JWT (acesso público como as demais webhooks)
- O novo token do usuário: `EAAYFZCjaZBn3kBR...` (já fornecido na conversa)

