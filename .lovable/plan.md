
## Plano: Tema "GásMais" opcional para Dashboard + Sidebar

### Decisões confirmadas
- **Escopo**: somente Dashboard e Sidebar (resto do ERP fica intocado).
- **Aplicação**: tema **opcional** (não sobrescrever o `index.css` global).
- **Portar**: layout/cards do dashboard + tokens (cores e tipografia).
- **Estabilidade**: nada de refatorar `App.tsx`, providers, rotas (regra do projeto).

### Como o tema opcional vai funcionar
Em vez de trocar variáveis HSL globais (que afetariam tudo), vou criar um **escopo de tema** ativável por classe CSS:

```text
<body>
  <Sidebar class="theme-gasmais"> ... </Sidebar>
  <main>
    <Dashboard class="theme-gasmais"> ... </Dashboard>
  </main>
</body>
```

Dentro de `.theme-gasmais { --primary: ...; --card: ...; ... }` redefino as variáveis HSL apenas no escopo desses dois containers. O resto do ERP continua usando o tema atual (amber/cyan).

Toggle: um switch em **Configurações → Aparência** grava `localStorage.dashboardTheme = "gasmais" | "default"` e um hook aplica/remove a classe. Reversível a qualquer momento.

### Paleta GásMais proposta (inspirada no projeto)
Tons neutros escuros + accent quente (laranja/azul profundo), estilo "fintech":

| Token | Light | Uso |
|---|---|---|
| `--primary` | `24 95% 53%` (laranja vibrante) | Botões CTA, KPI principal |
| `--accent` | `217 91% 60%` (azul) | Links, gráficos secundários |
| `--card` | `0 0% 100%` com sombra suave | Cards de KPI |
| `--muted` | `220 14% 96%` | Fundos de seção |
| `--success` / `--warning` / `--destructive` | mantidos | Sem mudança |
| Fonte | Plus Jakarta Sans (já é a do projeto) | Sem mudança |

> Observação: não consegui extrair o ZIP no modo plano (sandbox restrito). Vou começar com esta paleta e, na primeira preview, ajustamos os HSLs exatos olhando lado a lado se necessário.

### Mudanças no layout dos cards do dashboard
Adotar o estilo "GásMais":
- Cards com **borda fina + sombra muito sutil** (substituir `shadow-md` por borda + `shadow-sm`).
- Ícone em **círculo com fundo tonalizado** (não quadrado preenchido sólido).
- Tipografia do valor maior e mais densa (`text-3xl font-bold tracking-tight`).
- Trend com **chip arredondado verde/vermelho**, não texto solto.
- Espaçamento `gap-4` nos grids, padding interno `p-5`.

Isso ficará controlado por uma prop `variant="gasmais"` no `StatCard` — sem quebrar usos existentes (default continua como está).

### Arquivos a criar/editar

**Criar**
- `src/styles/theme-gasmais.css` — bloco `.theme-gasmais { ... }` com variáveis HSL.
- `src/hooks/useDashboardTheme.ts` — lê/grava localStorage e retorna a classe ativa.
- `src/components/dashboard/StatCardGasmais.tsx` — variante visual nova (ou prop `variant` no atual).

**Editar**
- `src/index.css` — apenas `@import` do novo arquivo de tema (sem alterar `:root`).
- `src/pages/Dashboard.tsx` — wrapper aplica `theme-gasmais` quando ativo; troca `StatCard variant` quando ativo.
- `src/components/layout/Sidebar.tsx` — wrapper aplica `theme-gasmais` quando ativo.
- `src/pages/Configuracoes.tsx` (ou seção Aparência existente) — adicionar Switch "Tema GásMais (Dashboard + Sidebar)".

### Fora de escopo
- Não toco em `App.tsx`, providers, rotas, autenticação.
- Não altero outras páginas (Vendas, Estoque, Financeiro etc.).
- Não mexo em backend nem migrations.

### Próximo passo após aprovação
1. Criar arquivos do tema + hook.
2. Adicionar toggle em Configurações.
3. Aplicar wrapper em Dashboard e Sidebar.
4. Atualizar `StatCard` com a variante visual.
5. Pedir para você ativar o switch e ajustarmos os HSLs finos.
