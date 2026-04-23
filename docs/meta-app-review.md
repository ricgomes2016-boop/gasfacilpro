# Meta App Review — Checklist GásFácilPro

Para liberar a integração Meta (Facebook + Instagram) para **qualquer empresa cliente** do SaaS (sem precisar adicionar cada Facebook como testador), o app precisa passar pelo App Review da Meta.

## 1. Permissões a solicitar

| Permissão | Justificativa |
|---|---|
| `pages_show_list` | Listar Páginas que o usuário administra para ele escolher qual conectar. |
| `pages_manage_posts` | Publicar posts agendados na Página do Facebook do cliente. |
| `pages_read_engagement` | Ler métricas básicas (curtidas, comentários) para mostrar no dashboard. |
| `instagram_basic` | Identificar a conta IG Business vinculada à Página. |
| `instagram_content_publish` | Publicar posts agendados no Instagram Business do cliente. |
| `business_management` | Permitir que o usuário escolha contas dentro do Business Manager dele. |

## 2. Materiais obrigatórios

- [ ] **Vídeo de demonstração** (1 por permissão, máx 3 min cada) mostrando o fluxo completo:
  1. Login no GásFácilPro
  2. Ir em `/marketing/redes-sociais`
  3. Clicar "Conectar oficialmente (Meta)"
  4. Autorizar no popup
  5. Voltar e ver a conta listada como "Conectado via OAuth"
  6. Ir em `/marketing/agendamento`, criar post, agendar
  7. Mostrar post publicado no Facebook/Instagram real
- [ ] **URL da Política de Privacidade**: `https://gasfacilpro.com.br/privacidade` (criar página se não existir)
- [ ] **URL dos Termos de Uso**: `https://gasfacilpro.com.br/termos`
- [ ] **URL da Data Deletion Instructions**: `https://gasfacilpro.com.br/exclusao-dados`
- [ ] **Conta de teste** para o revisor da Meta (login + senha + Página/IG de teste já vinculada)
- [ ] **Justificativa de negócio** (texto, ~200 palavras): explicar que é um SaaS B2B para distribuidoras de gás que agendam posts em suas próprias redes.

## 3. Configuração no painel Meta for Developers

- [ ] App Mode: **Live** (após aprovação)
- [ ] Domínios do app: `gasfacilpro.com.br`, `gasfacilpro.lovable.app`
- [ ] Privacy Policy URL preenchida
- [ ] Terms of Service URL preenchida
- [ ] App Icon (1024x1024)
- [ ] App Category: **Business**
- [ ] Business Verification (se exigido — geralmente sim para `business_management`)

## 4. Submissão

1. Em developers.facebook.com → seu app → **App Review → Permissions and Features**
2. Para cada permissão acima, clicar **Request** e preencher:
   - Como o app usa
   - Como o usuário se beneficia
   - Anexar vídeo
   - Step-by-step instructions (texto)
3. Enviar e aguardar (geralmente 5–14 dias úteis)

## 5. Após aprovação

1. Mudar app para **Live Mode**
2. Atualizar `configuracoes_globais.meta_app_review_status` para `"approved"`:
   ```sql
   UPDATE configuracoes_globais
   SET valor = '"approved"'::jsonb
   WHERE chave = 'meta_app_review_status';
   ```
3. O banner em `/marketing/redes-sociais` muda automaticamente de amarelo (Dev) para verde (Aprovado).

## 6. Enquanto não aprovado

- Adicionar Facebooks dos clientes manualmente como **Testadores** em:
  developers.facebook.com → App → Roles → Testers → Add People
- O cliente precisa aceitar o convite no Facebook dele antes de conseguir conectar.
