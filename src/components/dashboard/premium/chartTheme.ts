/**
 * Chart tokens and helpers — always use semantic tokens, never hex.
 * Colors resolve to hsl(var(--chart-N)) so they follow light/dark theme.
 */

export const CHART_TOKENS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
] as const;

export const CHART_SEMANTIC = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  info: "hsl(var(--info))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted-foreground))",
} as const;

export const chartColor = (i: number) => CHART_TOKENS[i % CHART_TOKENS.length];

/** Style object for recharts <CartesianGrid /> — sutil, alinhado ao token de border. */
export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: "hsl(var(--border))",
  strokeOpacity: 0.55,
  vertical: false,
} as const;

/** Style object for recharts axis ticks/text. */
export const chartAxisTick = {
  fill: "hsl(var(--muted-foreground))",
  fontSize: 11,
} as const;

export const fmtBRL = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const fmtBRLcompact = (v: number) => {
  const n = Number(v);
  if (Math.abs(n) >= 1000) return `R$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `R$${n.toFixed(0)}`;
};
