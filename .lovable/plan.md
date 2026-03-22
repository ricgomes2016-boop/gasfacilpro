

# Revisao Completa — Gestão de Marketing

## Problemas Identificados

1. **Dashboard Marketing** — mostra KPIs genéricos e sugestões hardcoded, sem ações práticas
2. **Criar Conteúdo IA** (MarketingIA.tsx) — gera textos e imagens mas **nao gera vídeos/roteiros de forma prática**
3. **Biblioteca** — apenas lista conteúdos salvos, sem preview visual, sem categorias úteis
4. **Agendamentos** — formulário manual sem integração com conteúdos gerados pela IA
5. **Redes Sociais** — apenas CRUD de contas, sem utilidade prática
6. **Atendimento IA** — fluxos e conversas sem conexão real, pouco útil
7. **Campanhas** — página separada em `/clientes/campanhas`, desconectada do módulo
8. **Nenhuma funcionalidade de criação de vídeos**

## Plano de Revisão

### 1. Reorganizar Menu (menuItems.ts)

Novo menu simplificado e prático:
- **Criar Conteúdo** — página principal unificada (textos, imagens, vídeos, roteiros)
- **Biblioteca** — conteúdos salvos com preview visual
- **Agendamentos** — calendário de posts
- **Campanhas** — campanhas promocionais
- **Configurações** — contas de redes sociais e fluxos de atendimento (consolidar)

Remover "Dashboard" redundante e "Atendimento IA" como item separado (mover para Configurações).

### 2. Reformular "Criar Conteúdo" (página principal)

Reescrever a página `MarketingIA.tsx` com foco em **praticidade**:

**Abas claras e diretas:**
- **Post** — gerar legenda + hashtags para plataforma escolhida (1 clique)
- **Imagem** — gerar imagem promocional com IA
- **Vídeo/Roteiro** — gerar roteiro de Reels/TikTok/Shorts com: cenas, falas, duração, trilha sugerida
- **Campanha** — gerar pacote completo (texto + imagem + roteiro + agendamento sugerido)

**Melhorias de UX:**
- Botões de sugestão de temas pré-prontos (já existe, manter)
- Seletor de tom (formal, informal, promocional)
- Botão "Salvar na Biblioteca" direto
- Botão "Agendar" direto do resultado gerado
- Botão "Copiar" sempre visível

### 3. Adicionar Geração de Roteiros de Vídeo

Na edge function `marketing-ai`, adicionar tipo `video_script`:
- Prompt específico para gerar roteiros de vídeos curtos (15-60s)
- Formato estruturado: cenas numeradas, duração por cena, texto falado, ação visual, trilha sonora sugerida
- Plataformas: Reels, TikTok, YouTube Shorts

### 4. Reformular Biblioteca de Conteúdos

- Cards maiores com preview do conteúdo
- Filtros por tipo: texto, imagem, vídeo/roteiro
- Ações rápidas: copiar, agendar, deletar (sempre visíveis, não só no hover)
- Mostrar plataforma e data de forma clara

### 5. Reformular Agendamentos

- Adicionar botão "Gerar com IA" no dialog de novo agendamento
- Listar conteúdos da biblioteca para selecionar ao agendar
- Visualização em lista (manter) com melhor hierarquia visual

### 6. Consolidar Configurações de Marketing

Mover "Redes Sociais" e "Atendimento IA" para uma única página `ConfigMarketing.tsx`:
- Aba "Contas" — CRUD de contas (já existe)
- Aba "Fluxos de Atendimento" — CRUD de fluxos (já existe)

### 7. Mover Campanhas para dentro do módulo

Mudar rota de `/clientes/campanhas` para `/marketing/campanhas`.

---

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `src/components/layout/menuItems.ts` | Reorganizar submenu |
| `src/pages/clientes/MarketingIA.tsx` | Reescrever com aba de vídeo/roteiro, UX melhor |
| `src/pages/marketing/BibliotecaConteudos.tsx` | Cards maiores, ações visíveis |
| `src/pages/marketing/AgendamentoPosts.tsx` | Botão "Gerar com IA" no dialog |
| `src/pages/marketing/ConfigMarketing.tsx` | **Nova** — unifica Redes Sociais + Fluxos |
| `src/routes/marketingRoutes.ts` | Atualizar rotas |
| `supabase/functions/marketing-ai/index.ts` | Adicionar tipo `video_script` |

## Arquivos Removidos do Menu (mantidos no código)
- `RedesSociais.tsx` — conteúdo migra para ConfigMarketing
- `AtendimentoIA.tsx` — conteúdo migra para ConfigMarketing
- `DashboardMarketing.tsx` — removido do menu (redundante com Dashboard principal)

## Novo Menu Final

```text
Gestão de Marketing
├── Criar Conteúdo    → /clientes/marketing (reescrito)
├── Biblioteca        → /marketing/conteudos
├── Agendamentos      → /marketing/agendamentos
├── Campanhas         → /marketing/campanhas
└── Configurações     → /marketing/configuracoes (novo)
```

