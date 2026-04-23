

## Templates por Plataforma na Biblioteca de Marketing

### Objetivo
Permitir aplicar modelos prontos de texto/legenda/hashtags antes de agendar um post, acelerando a criação de conteúdo para Instagram, Facebook e WhatsApp.

### O que será entregue

**1. Nova aba "Templates" em `/marketing/conteudos`**
- Adicionar terceira tab ao lado de "Conteúdos" e "Galeria".
- Grid de cards de templates filtráveis por plataforma (Instagram, Facebook, WhatsApp, Todos) e categoria (Promoção, Institucional, Datas Comemorativas, Engajamento, Lançamento).
- Cada card mostra: nome, plataforma (emoji), categoria (badge), prévia da legenda (3 linhas), hashtags sugeridas e botões: **Usar template**, **Visualizar (preview)**, **Editar**, **Duplicar**, **Excluir**, **Favoritar**.

**2. Biblioteca padrão de 12-15 templates pré-cadastrados** (seed na migração)
- Instagram: "Promoção Relâmpago", "Bom dia + produto", "Antes/Depois", "Carrossel educativo", "Reels — receita rápida"
- Facebook: "Post institucional", "Promoção semanal", "Depoimento de cliente"
- WhatsApp: "Status promo", "Aviso de horário", "Lista de transmissão", "Cupom"
- Datas: "Dia das Mães", "Natal", "Black Friday"

Cada template traz placeholders `{{empresa}}`, `{{produto}}`, `{{preco}}`, `{{telefone}}`, `{{cupom}}` que são substituídos automaticamente ao aplicar.

**3. Modal "Aplicar Template"**
- Escolher imagem da Galeria (opcional).
- Preencher variáveis (campos dinâmicos baseados nos placeholders detectados).
- Preview ao vivo no mockup da rede social (reusando `PostPreview.tsx`).
- Botões: **Salvar na Biblioteca** (cria registro em `marketing_conteudos`) ou **Agendar agora** (vai direto para `/marketing/agendamentos` com tudo preenchido).

**4. Editor de templates personalizados**
- Botão **"Novo template"** abre modal com: nome, plataforma, categoria, legenda (textarea), hashtags, dica/observação.
- Suporte a inserir placeholders via botões rápidos.
- Templates do sistema (seed) são read-only com badge "Padrão"; usuários só editam/excluem os próprios.

### Detalhes técnicos

**Migração SQL — nova tabela `marketing_templates`:**
```sql
CREATE TABLE public.marketing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,                          -- NULL = template padrão do sistema
  nome text NOT NULL,
  plataforma text NOT NULL,                 -- instagram|facebook|whatsapp|reels
  categoria text NOT NULL,                  -- promocao|institucional|data|engajamento|lancamento
  legenda text NOT NULL,
  hashtags text,
  dica text,
  is_padrao boolean NOT NULL DEFAULT false,
  favorito boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: vê padrões (empresa_id NULL) + próprios da empresa
CREATE POLICY "view_templates" ON public.marketing_templates FOR SELECT
  USING (is_padrao = true OR empresa_id = public.get_user_empresa_id());
-- INSERT/UPDATE/DELETE: só nos próprios da empresa, nunca nos padrões
CREATE POLICY "manage_own_templates" ON public.marketing_templates
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND is_padrao = false)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND is_padrao = false);
```
+ INSERT dos 12-15 templates seed com `is_padrao = true` e `empresa_id = NULL`.

**Arquivos novos:**
- `src/components/marketing/TemplatesBiblioteca.tsx` — grid + filtros
- `src/components/marketing/TemplateCard.tsx` — card individual
- `src/components/marketing/AplicarTemplateModal.tsx` — preencher variáveis + preview + ação final
- `src/components/marketing/EditorTemplateModal.tsx` — criar/editar template próprio
- `src/lib/templatePlaceholders.ts` — utilitário de detecção/substituição de `{{var}}`

**Arquivos alterados:**
- `src/pages/marketing/BibliotecaConteudos.tsx` — adicionar tab "Templates"
- `src/pages/marketing/AgendamentoPosts.tsx` — aceitar query params `?template_id=` e `?legenda=` para pré-preencher
- `src/integrations/supabase/types.ts` — regenerado automaticamente

### Critérios de aceite
- Tab "Templates" visível com grid filtrável por plataforma e categoria.
- Pelo menos 12 templates padrão disponíveis ao abrir.
- "Usar template" abre modal com substituição de variáveis e preview real.
- Salvar gera registro em `marketing_conteudos` ou navega para o agendador já preenchido.
- Usuário pode criar/editar/excluir os próprios templates; não pode mexer nos padrões.
- RLS isola templates da empresa; padrões são compartilhados.

