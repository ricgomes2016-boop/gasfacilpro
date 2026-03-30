

# Fonte Mais Moderna para o Sistema

## Situação Atual
- Fontes: **Space Grotesk** (principal) + **Inter** (fallback)
- Definidas no `index.html` (Google Fonts) e `src/index.css` (font-family)

## Proposta: Trocar para **Plus Jakarta Sans**

Uma das fontes mais modernas e populares em dashboards/SaaS atualmente. Geométrica, limpa, com ótima legibilidade em telas e excelente variedade de pesos.

**Alternativas consideradas:**
- **Outfit** — geométrica minimalista, muito usada em fintechs
- **Satoshi** — premium feel, mas não está no Google Fonts
- **DM Sans** — limpa e neutra, boa para dados

**Recomendação:** Plus Jakarta Sans por ser moderna, ter boa legibilidade em tabelas/números, e estar disponível no Google Fonts gratuitamente.

## Mudanças

### 1. `index.html`
- Trocar o link do Google Fonts de Space Grotesk + Inter para **Plus Jakarta Sans** (pesos 300-800)

### 2. `src/index.css`
- Atualizar `font-family` no body para `'Plus Jakarta Sans', system-ui, sans-serif`
- Remover referência ao Space Grotesk

**Impacto:** Apenas 2 arquivos. Zero quebra de layout — a fonte tem métricas muito similares.

