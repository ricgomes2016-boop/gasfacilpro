# Plataforma de Marketing Inteligente — Plano Incremental

## Estado Atual

O projeto já possui:

- **MarketingIA.tsx** (556 linhas) — geração de posts, calendário de marketing e imagens via IA, com envio WhatsApp e webhook
- **Campanhas.tsx** — CRUD básico de campanhas (nome, tipo, status)
- **marketing-ai** edge function — geração de texto e imagem
- **marketing-dispatch** edge function — envio WhatsApp/webhook
- Estrutura multi-empresa/multi-unidade já funcional

## Escopo Proposto (Fase 1 — Base Sólida)

Dado o tamanho do pedido, proponho implementar em **3 blocos incrementais** para não quebrar o sistema. Esta Fase 1 entrega a base estrutural completa.

---

### Bloco 1 — Tabelas e Estrutura de Dados

Criar as tabelas necessárias no banco:


| Tabela                         | Propósito                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `social_accounts`              | Contas de redes sociais por empresa/unidade (Instagram, Facebook, TikTok, YouTube) |
| `marketing_conteudos`          | Biblioteca de conteúdos gerados (textos, imagens, vídeos)                          |
| `marketing_agendamentos`       | Posts agendados com data/hora, plataforma, status                                  |
| `marketing_metricas`           | Métricas de engajamento (alcance, cliques, conversões)                             |
| `marketing_fluxos_atendimento` | Fluxos de atendimento automático por intenção                                      |
| `marketing_conversas`          | Histórico de conversas de atendimento                                              |


Todas com `empresa_id`, `unidade_id` e RLS adequado.

### Bloco 2 — Novas Telas e Navegação

Criar um novo módulo `/marketing/` com as seguintes páginas:

1. **Dashboard Marketing** (`/marketing`) — KPIs, posts agendados, sugestões da IA, desempenho
2. **Redes Sociais** (`/marketing/redes-sociais`) — conectar contas, visualizar status por unidade
3. **Conteúdos** (`/marketing/conteudos`) — biblioteca de textos/imagens gerados, com filtros
4. **Agendamentos** (`/marketing/agendamentos`) — calendário visual de posts agendados
5. **Atendimento IA** (`/marketing/atendimento`) — fluxos de atendimento, intenções, histórico

Adicionar grupo "Marketing" no menu lateral com ícone dedicado.

A página **MarketingIA** existente será mantida e referenciada como "Criar Conteúdo" dentro do novo módulo.

### Bloco 3 — Agente de IA Proativo

Expandir a edge function `marketing-ai` para:

- Gerar sugestões proativas baseadas em: datas comemorativas, estoque baixo, clima/região, histórico de vendas
- Adaptar linguagem por unidade (cidade, bairro, público)
- Gerar roteiros de vídeos curtos (Reels/Shorts/TikTok)
- Criar campanhas completas (texto + imagem + hashtags + CTA + agendamento sugerido)

Criar nova edge function `marketing-agent` para sugestões proativas que consulta dados reais do sistema.

---

## Estrutura de Arquivos

```text
src/pages/marketing/
├── DashboardMarketing.tsx    — painel principal
├── RedesSociais.tsx          — gestão de contas conectadas
├── BibliotecaConteudos.tsx   — biblioteca de conteúdos
├── AgendamentoPosts.tsx      — calendário de agendamentos
├── AtendimentoIA.tsx         — fluxos e histórico

src/routes/
├── marketingRoutes.ts        — rotas do módulo

supabase/functions/
├── marketing-agent/index.ts  — agente proativo
```

## Integração com Redes Sociais

Nesta fase, as contas de redes sociais serão **cadastradas** (token, username, plataforma) com interface para configuração. A publicação automática via API oficial será preparada na estrutura mas o envio real será via:

- Webhook (Zapier/n8n) — já funciona
- WhatsApp direto — já funciona
- Cópia manual — já funciona

A integração direta com APIs do Instagram/Facebook/TikTok/YouTube será uma Fase 2 futura.

## Arquivos Modificados


| Arquivo                               | Ação                                  |
| ------------------------------------- | ------------------------------------- |
| `src/components/layout/menuItems.ts`  | Adicionar grupo "Marketing"           |
| `src/components/layout/Sidebar.tsx`   | Adicionar cor para itens de Marketing |
| `src/components/layout/MobileNav.tsx` | Adicionar cor para itens de Marketing |
| `src/routes/marketingRoutes.ts`       | Criar rotas do módulo                 |
| `src/App.tsx`                         | Importar e renderizar marketingRoutes |
| 6 migrations                          | Criar tabelas com RLS                 |
| 5 páginas novas                       | Telas do módulo                       |
| 1 edge function nova                  | Agente proativo                       |


## Garantias

- Zero alteração nas páginas existentes (MarketingIA.tsx e Campanhas.tsx mantidas intactas)
- Zero alteração em fluxos de vendas, caixa, estoque ou autenticação
- Multi-empresa/multi-unidade respeitado em todas as tabelas
- RLS em todas as tabelas novas
- Mesma stack e padrões do projeto

&nbsp;