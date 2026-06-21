## Problema

Na tela **Criar Conteúdo** (`/clientes/marketing`), a IA está inventando marcas genéricas (ex.: "Gás Express") porque a edge function `marketing-ai` nunca recebe o nome real da empresa/unidade. Além disso, só existem 6 sugestões fixas de tema.

## O que vou fazer

### 1. Passar a identidade da empresa/unidade para a IA
Arquivo: `src/pages/clientes/MarketingIA.tsx`
- Já existem `empresa` e `unidadeAtual` no contexto. Vou enviar no body de cada chamada (`post`, `video_script`, `calendar`, `image`):
  - `brandName`: `unidadeAtual?.nome || empresa?.nome_fantasia || empresa?.razao_social`
  - `cidade`, `whatsapp`, `instagram_handle` (se existirem na unidade/empresa)

### 2. Usar a marca real nos prompts
Arquivo: `supabase/functions/marketing-ai/index.ts`
- Ler `brandName`, `cidade`, `whatsapp`, `instagram` do body.
- Injetar no `systemPrompt` de **post**, **video_script** e **calendar** algo como:
  > "Você está criando conteúdo para a revenda **{brandName}** localizada em **{cidade}**. SEMPRE use exatamente este nome da marca. NUNCA invente nomes como 'Gás Express', 'Gás Rápido' etc. Se houver WhatsApp ({whatsapp}) ou Instagram (@{handle}), inclua no CTA."
- Mesmo tratamento no prompt de **imagem**: "logo/marca: {brandName}; não escreva nenhum outro nome".

### 3. Mais sugestões de tema
Arquivo: `src/pages/clientes/MarketingIA.tsx`
- Expandir `suggestedTopics` para ~24 ideias agrupadas em categorias visíveis como chips:
  - **Promoções**: P13 fim de semana, combo P13+água, primeira compra, indicação, recompra
  - **Datas**: Dia das Mães, Festa Junina, Dia do Cliente, Black Friday, Natal, inverno
  - **Educacional**: segurança com botijão, validade do gás, como economizar, sinais de vazamento
  - **Diferencial**: entrega em 20 min, atendimento 24h, pagamento PIX/cartão, app do cliente
  - **Fidelidade**: programa de pontos, cashback, vale-gás digital, clube do cliente
- Renderizar com sub-rótulo de categoria (não muda layout, só agrupa).

### 4. Painel "Ideias prontas" com 1 clique
Adicionar acima do textarea um pequeno bloco "💡 Sugestões para hoje" com 4-6 cards prontos (tema + tom sugerido + plataforma sugerida) que ao clicar preenchem `topic`/`tone`/`platform` automaticamente. Conteúdo estático rotativo baseado no mês atual (ex.: junho → Festa Junina + inverno).

### 5. Sugestões dinâmicas no Dashboard
Arquivo: `src/pages/marketing/DashboardMarketing.tsx`
- Trocar o card "Sugestões da IA" estático por 5-6 sugestões geradas localmente combinando: mês atual + nome da unidade + última promoção. Cada sugestão "Gerar post" navega para `/clientes/marketing` com query params (`?topic=...&tone=...&platform=...`) que `MarketingIA` lê e pré-preenche.

## Detalhes técnicos

- Tabela `unidades` tem `nome`, `cidade`, `whatsapp`. Tabela `empresas` tem `nome_fantasia`, `razao_social`. Já estão nos contextos `useUnidade` / `useEmpresa`, sem queries novas.
- A edge function `marketing-ai` continua compatível com chamadas antigas (campos novos opcionais).
- Não mexo em `App.tsx`, providers, rotas, RLS nem auth. Apenas frontend + 1 edge function.

## Fora do escopo

- Mudanças em `marketing-agent`, `marketing-dispatch`, `BibliotecaConteudos`, `AgendamentoPosts`.
- Persistência de novas configurações de marca (a marca já vem da unidade existente).
