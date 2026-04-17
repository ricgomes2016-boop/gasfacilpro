

## Plano: Cards do Dashboard coloridos, modernos e animados (tema GásMais)

### Objetivo
Manter alguns cards de KPI **fora** do hero (no grid abaixo), mas com visual **colorido, moderno, com sombra e animação** — alinhado ao estilo fintech do tema GásMais.

### Escopo
- Apenas tema GásMais ativo (`isGasmais === true`).
- Apenas Dashboard (`src/pages/Dashboard.tsx`) e `StatCard.tsx`.
- Não toca em rotas, providers, App.tsx.

### O que muda

**1. Nova variante visual em `StatCard.tsx`** — prop `colored?: boolean`
Quando `isGasmais && colored`, renderiza um card com:
- Gradiente sutil baseado na `variant` (primary=laranja, success=verde, info=azul, warning=âmbar)
- Borda colorida fina (`border-{cor}/20`)
- Sombra elevada (`shadow-lg shadow-{cor}/10`)
- Ícone em círculo com gradiente sólido + ícone branco
- Hover: `hover:-translate-y-1 hover:shadow-xl` + transição 300ms
- Animação de entrada: `animate-fade-in` (já existe no `index.css`)
- Número grande com `tracking-tight`
- Pequeno indicador de trend animado (badge pulsante quando positivo)

**2. Em `Dashboard.tsx`** (apenas no ramo GásMais)
- Manter no **hero** (translúcidos): Vendas, Pedidos, Pendentes, Clientes Ativos, Ticket Médio, Entradas, Diferença (como já está).
- Adicionar **grid de 3-4 cards coloridos animados abaixo do hero**, com métricas complementares:
  - **Vendas Hoje** (variant primary / laranja) — gradiente laranja
  - **Recebimentos do Dia** (variant success / verde) — gradiente verde
  - **A Receber** (variant info / azul) — gradiente azul
  - **Estoque Crítico** (variant warning / âmbar) — gradiente âmbar
- Stagger de animação: cada card com `style={{ animationDelay: '${i * 80}ms' }}`.

### Detalhes técnicos

```tsx
// StatCard.tsx — nova ramificação
if (isGasmais && colored) {
  const tones = {
    primary: "from-orange-500 to-orange-600 shadow-orange-500/20 border-orange-500/20",
    success: "from-emerald-500 to-emerald-600 shadow-emerald-500/20 border-emerald-500/20",
    info:    "from-blue-500 to-blue-600 shadow-blue-500/20 border-blue-500/20",
    warning: "from-amber-500 to-amber-600 shadow-amber-500/20 border-amber-500/20",
    default: "from-slate-500 to-slate-600 shadow-slate-500/20 border-slate-500/20",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-lg
                    transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-in">
      {/* faixa gradiente decorativa no topo */}
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tones[variant])} />
      {/* glow sutil no hover */}
      <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-2xl bg-gradient-to-br", tones[variant])} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {trend && <Badge animado pulse />}
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform group-hover:scale-110", tones[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
```

```tsx
// Dashboard.tsx — após o hero, antes das outras seções
{isGasmais && (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {coloredCards.map((c, i) => (
      <div key={c.title} style={{ animationDelay: `${i * 80}ms` }} className="animate-fade-in">
        <StatCard {...c} colored />
      </div>
    ))}
  </div>
)}
```

### Fora de escopo
- Tema padrão (sem GásMais) permanece igual.
- Sem mudanças em outras páginas, backend, migrations.

### Próximo passo
Após aprovação: edito `StatCard.tsx` (nova variante `colored`) e `Dashboard.tsx` (adiciono grid colorido animado abaixo do hero, no ramo GásMais).

