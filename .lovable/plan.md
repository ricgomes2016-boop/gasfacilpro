## Recomendações para evoluir a Gestão de Marketing

Baseado no que já existe (Criar Conteúdo IA, Agendamento, Biblioteca, Redes Sociais, Atendimento IA, Config) e nas melhores práticas para revendas de gás/GLP no Brasil. Sugestões priorizadas por impacto × esforço.

---

### 🥇 Prioridade ALTA — alto impacto, baixo/médio esforço

**1. Brand Kit por unidade**
- Tela de configuração com: logo, paleta de cores, slogan, tom de voz preferido, hashtags fixas, lista de "frases proibidas" (ex.: nomes de concorrentes), bairros atendidos, faixa de preço, link do app/cardápio.
- Toda chamada da IA (post, vídeo, imagem) injeta esse contexto → conteúdo 100% fiel à marca, sem mais "Gás Express" inventado.
- Tabela: `marketing_brand_kit` (1:1 com `unidades`).

**2. Aprovação e histórico (workflow editorial)**
- Estados de conteúdo: Rascunho → Em revisão → Aprovado → Agendado → Publicado.
- Quem criou, quem aprovou, comentários internos. Reaproveita a infra `aprovacoes` que já existe.
- Evita publicar promoção errada e dá rastreabilidade.

**3. Métricas reais por post (analytics unificado)**
- Já existe `marketing_metricas`. Falta UI: gráfico de alcance, curtidas, cliques, conversões por plataforma e por tema.
- Ranking dos posts que mais geraram pedidos (cruzar com `pedidos.canal_origem`).
- Insight automático: "Posts promocionais à sexta 18h convertem 3× mais."

**4. Segmentação de clientes para campanhas WhatsApp**
- Usar `cliente_tags`, `fidelidade_clientes`, RFM (recência/frequência/valor) já presentes no CRM.
- Públicos prontos: inativos 30d, top fidelidade, novos da semana, aniversariantes, clientes do bairro X.
- Disparo em massa via WhatsApp com template aprovado + variáveis ({nome}, {ultimo_pedido}).

**5. Calendário editorial visual**
- Já existe `AgendamentoPosts`. Evoluir para visão mensal drag-and-drop com cores por plataforma e legenda.
- Indicador de "lacunas" (dias sem post) e sugestão automática de preencher com IA.

---

### 🥈 Prioridade MÉDIA — diferenciação competitiva

**6. Geração em lote (campanhas multi-canal)**
- 1 briefing → IA gera variações para Instagram + Facebook + WhatsApp + TikTok ao mesmo tempo, adaptando formato e tamanho.
- "Plano de conteúdo de 30 dias" gerado de uma vez (já temos a aba Calendário, falta materializar em rascunhos).

**7. Templates visuais editáveis**
- Galeria de templates 1:1, 9:16, 4:5 prontos (promoção, dica, depoimento, novo cliente).
- Editor leve no navegador trocando texto/preço/foto sobre o template (canvas + fabric.js).
- Branding automático: logo + cores da unidade aplicados.

**8. Banco de imagens de produto + variações IA**
- Cada produto da revenda com fotos profissionais (botijão P13, P20, P45, água 20L).
- Botão "Variações IA": gera mesma cena em diferentes ambientes (cozinha, churrasco, festa junina).
- Resolve "imagens genéricas" que a IA inventa.

**9. Programa de indicação amplificado**
- Já existe `cliente_indicacoes` e `programa_indicacao_config`. Faltam:
  - Card de marketing com link/QR code único do cliente.
  - Mensagem WhatsApp pronta para o cliente compartilhar com amigos.
  - Ranking de indicadores do mês.

**10. Chatbot de atendimento com qualificação**
- `AtendimentoIA` já existe. Adicionar:
  - Resposta automática fora do horário com captura de pedido.
  - Detecção de intenção (preço, pedido, reclamação, status) → roteamento.
  - Handoff para humano com contexto.

**11. Avaliações & reputação**
- Pós-entrega: link automático WhatsApp pedindo avaliação no Google Maps / Instagram.
- Já existe `avaliacoes_entrega`. Conectar com fluxo de marketing reputacional.

---

### 🥉 Prioridade BAIXA — refinamento / wow factor

**12. SEO local automatizado**
- Página pública por unidade (ex.: `/forte-gas-cidade`) com schema.org LocalBusiness, horário, telefone, bairros atendidos.
- Sitemap por unidade. Aumenta achabilidade no Google Maps / "gás perto de mim".

**13. Anúncios pagos guiados (Meta Ads / Google Ads)**
- Wizard que pega um post existente e sugere público, orçamento e copy de anúncio.
- Integração futura com Meta Ads API (já está na trilha do projeto).

**14. Concorrência (preços de fachada)**
- Já existe `concorrentes` e `concorrente_precos`. Cruzar com IA: "Seu P13 está R$ 5 mais caro que a média da região — sugiro post justificando qualidade."

**15. Voice/áudio para Reels e WhatsApp**
- Geração de narração TTS (ElevenLabs já está no stack) para Reels.
- Áudios prontos no WhatsApp ("áudio motivacional do dono", "lembrete de promoção").

**16. UTM e rastreio de conversão**
- Toda mensagem/post com link curto + UTM gerado automaticamente.
- Dashboard mostra qual post trouxe pedido real.

**17. Biblioteca de copy testado (swipe file)**
- Conteúdos com performance >X automaticamente entram numa "biblioteca de campeões" para reuso/remix.

**18. Acessibilidade e compliance**
- Geração automática de alt text, legendas em vídeo, aviso legal de "consumo consciente de gás".

---

### Próximos passos sugeridos

Esta é só uma lista de recomendações — não vou implementar nada agora. Posso transformar **2 ou 3 itens** em planos detalhados de implementação. Quais te interessam mais?

Sugestão minha de combo de maior ROI:
1. **Brand Kit por unidade** (resolve definitivamente o problema do nome inventado e personaliza tudo).
2. **Métricas reais + ranking de posts** (mostra valor concreto da ferramenta).
3. **Segmentação WhatsApp** (gera receita imediata reativando inativos).

Me diga quais escolher e eu volto com plano técnico detalhado.
