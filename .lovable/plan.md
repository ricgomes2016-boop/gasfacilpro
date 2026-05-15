
# Automação de Certidões e Documentos da Empresa

## Resposta direta sobre viabilidade

Antes do plano, é importante alinhar o que é realmente possível hoje no Brasil. Cada órgão tem um nível de automação diferente:

| # | Documento | Órgão | Automação possível? | Como |
|---|-----------|-------|---------------------|------|
| 1 | Consulta Revenda GLP | ANP | ✅ Sim, totalmente | Scraping do portal público da ANP (sem captcha forte) |
| 2 | CND Federal (Receita/PGFN) | Receita Federal | ⚠️ Parcial | Site tem **reCAPTCHA v2/v3**. Solução: API paga (Infosimples, SerproConsultas, Direct Data) OU resolver captcha (2Captcha) |
| 3 | CND Estadual | SEFAZ de cada estado | ⚠️ Parcial | Cada UF tem site próprio + captcha. Viável apenas via API agregadora paga |
| 4 | CND Municipal | Prefeitura de cada município | ❌ Difícil | Cada prefeitura tem site próprio, muitos sem emissão online. Só viável via API paga ou manual |
| 5 | CNDT Trabalhista | TST | ⚠️ Parcial | Tem captcha. Viável via API agregadora |
| 6 | Sintegra | Sintegra (UF) | ✅ Sim, na maioria | Vários estados sem captcha, scraping direto funciona |

**Conclusão honesta:** Para fazer isso 100% automático e confiável, o caminho prático é contratar uma **API agregadora** (Infosimples é a mais usada no Brasil — cobre todas as 6 certidões com uma única integração, custo por consulta entre R$ 0,30 e R$ 2,00). Sem ela, conseguimos cobrir bem ANP e Sintegra, e os demais ficariam manuais ou instáveis.

## Decisão necessária antes de implementar

Preciso saber qual caminho você quer seguir:

**Opção A — Híbrido (recomendado, sem custo extra inicial)**
- Automatiza ANP e Sintegra via scraping direto (grátis, estável)
- Para CND Federal/Estadual/Municipal/Trabalhista: cria UI para upload manual + lembretes de vencimento + botão "abrir site oficial" pré-preenchido com CNPJ

**Opção B — Tudo automático via Infosimples (ou similar)**
- Você contrata conta na Infosimples (ou SerproConsultas) e me passa o token
- Automatizo as 6 certidões, agendamento mensal, alertas
- Custo: ~R$ 0,30 a R$ 2,00 por certidão emitida

**Opção C — Só ANP + Sintegra automáticos por agora**
- Implementa o que dá grátis, deixa o resto pra depois

## Plano técnico (independente da opção)

### Banco de dados
Nova tabela `certidoes_empresa`:
- `unidade_id`, `empresa_id`, `tipo` (anp/cnd_federal/cnd_estadual/cnd_municipal/cndt/sintegra)
- `numero`, `data_emissao`, `data_vencimento`, `status` (regular/irregular/pendente/vencida)
- `arquivo_url` (PDF salvo em storage), `dados_json` (resposta crua)
- `ultima_consulta_at`, `ultimo_erro`

### Edge Functions
- `consultar-anp` — scraping do portal ANP por CNPJ
- `consultar-sintegra` — roteador por UF
- `consultar-certidoes` (se Opção B) — wrapper Infosimples para as 4 CNDs

### UI em Configurações › Documentos da Empresa
- Nova aba "Certidões" ao lado da lista atual
- Seletor de unidade (já existe `useUnidade`) usado como filtro
- Cards por certidão mostrando: status, vencimento, dias restantes, botão "Atualizar agora", botão "Baixar PDF"
- Badge vermelho/amarelo/verde por proximidade do vencimento

### Agendamento automático
- Cron diário (`pg_cron`) que chama `verificar-certidoes-vencendo`
- Reconsulta automática 30 dias antes do vencimento
- Notificação via sistema de notificações existente (`useNotificacoes`)

### Multi-tenant
- Respeita `empresa_id` + `unidade_id` em todos os payloads (regra do projeto)
- RLS por unidade

## Ações para você

Responda 3 coisas:

1. **Qual opção (A, B ou C)?**
2. Se B: qual provedor — **Infosimples**, **SerproConsultas**, **Direct Data** ou outro?
3. Para Sintegra automático: precisa cobrir **todas as UFs** ou só onde a Forte Gás opera (PR)?

Com isso eu fecho o escopo e parto pra implementação.
