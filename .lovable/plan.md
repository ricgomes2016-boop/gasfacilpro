

## Gestão de Marketing — Galeria de Imagens + Auditoria do Módulo

### Parte 1 — Galeria de Imagens na Biblioteca

**Nova aba "Galeria" em `/marketing/conteudos`**

Reformular `BibliotecaConteudos.tsx` com tabs no topo:
- **Conteúdos** (atual: textos, posts, roteiros)
- **Galeria** (nova: imagens geradas + importadas)

**Funcionalidades da Galeria:**
- Grid responsivo (2 col mobile / 3-4 col desktop) com preview quadrado das imagens.
- Cada card: imagem, badge de origem (Gerada IA / Importada), data, ações (usar em post, baixar, copiar URL, favoritar, excluir).
- Filtros: origem (todas / IA / importadas), favoritas, busca por título/tag.
- Botão **"Importar Imagem"** (upload via `ImageUpload` existente, bucket `marketing-assets` que já existe e é público).
- Botão **"Gerar com IA"** → abre modal usando edge function `marketing-ai` com `modalities: ["image","text"]` (Nano Banana já documentado no contexto).
- Botão **"Usar neste post"** em cada imagem → navega para `/marketing/agendamentos` com a URL da imagem pré-anexada, ou abre modal de novo post.

**Backend:**
- Nova tabela `marketing_imagens` (id, empresa_id, unidade_id, url, titulo, tags, origem `'ia'|'importada'`, prompt, favorito, created_by, created_at) com RLS por empresa/unidade.
- Bucket `marketing-assets` (já existe, público) — pasta `imagens/{empresa_id}/`.
- Edge function `marketing-ai` ganha rota `?tipo=imagem` que gera via Nano Banana, salva no bucket e insere em `marketing_imagens`.

### Parte 2 — Auditoria do Módulo de Marketing

**O que já existe (verificado nos arquivos):**
- `/marketing/conteudos` — Biblioteca de textos/roteiros
- `/marketing/agendamentos` — Agenda de posts
- `/marketing/campanhas` — Campanhas (compartilhada com clientes)
- `/marketing/configuracoes` — Configurações
- `/clientes/marketing` — Criação de conteúdo com IA (textos, vídeos, roteiros TikTok/Reels)
- Edge function `marketing-ai` com suporte a textos e roteiros de vídeo cena-a-cena

**Ajustes propostos (quick wins):**
1. **Dashboard de Marketing reativado** — recolocar `/marketing` no menu com KPIs: posts agendados, taxa de publicação, conteúdos gerados no mês, imagens na galeria.
2. **Vincular conteúdo + imagem** — ao criar post de "imagem" na Biblioteca, permitir anexar uma imagem da Galeria (campo `imagem_url` em `marketing_conteudos`).
3. **Preview real do post** — mostrar mockup de Instagram/Facebook com imagem + legenda + hashtags antes de salvar.
4. **Calendário visual** em `/marketing/agendamentos` com drag-and-drop de posts entre dias.

**Novas funcionalidades sugeridas (médio prazo):**
5. **Templates de post** — modelos prontos por categoria (promoção, institucional, datas comemorativas).
6. **Hashtag sugerida por IA** baseada no conteúdo + nicho (gás/água/delivery local).
7. **Integração de publicação automática** — conectar com Meta Graph API para publicar direto no Instagram/Facebook (já há infraestrutura WhatsApp Meta).
8. **Análise de performance** — quando publicado, puxar métricas (curtidas, alcance, comentários) via Graph API.
9. **Banco de ideias** — feed de ideias geradas proativamente pela IA com base em sazonalidade (frio = mais gás, calor = mais água).
10. **Aprovação multinível** — usar workflow de aprovações já existente para posts antes de publicar.

### Detalhes técnicos

**Migration (Parte 1):**
```sql
CREATE TABLE public.marketing_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  unidade_id uuid,
  url text NOT NULL,
  titulo text,
  tags text,
  origem text NOT NULL CHECK (origem IN ('ia','importada')),
  prompt text,
  favorito boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_imagens ENABLE ROW LEVEL SECURITY;
-- Policies: SELECT/INSERT/UPDATE/DELETE para usuários da mesma empresa
```

**Arquivos a alterar:**
- `src/pages/marketing/BibliotecaConteudos.tsx` — adicionar tabs e seção Galeria
- `src/components/marketing/GaleriaImagens.tsx` — novo componente
- `src/components/marketing/GerarImagemModal.tsx` — novo modal
- `supabase/functions/marketing-ai/index.ts` — adicionar tipo `imagem`
- `src/routes/marketingRoutes.ts` — restaurar `DashboardMarketing` no menu

### Critérios de aceite

- Tab "Galeria" visível em `/marketing/conteudos`.
- Importar imagem do dispositivo funciona e aparece na grid.
- Gerar imagem com IA funciona e salva no bucket + tabela.
- Botão "Usar neste post" leva a fluxo de criação de post com a imagem anexada.
- RLS isola imagens por empresa.
- Auditoria entregue como lista priorizada (quick wins implementados nesta entrega; itens 5-10 ficam como roadmap para você aprovar individualmente).

### Pergunta antes de executar

Quer que eu já implemente os **4 quick wins** (Dashboard, vincular imagem em conteúdo, preview de post, calendário visual) junto com a Galeria, ou prefere **apenas a Galeria** nesta primeira entrega e os ajustes em seguida?

